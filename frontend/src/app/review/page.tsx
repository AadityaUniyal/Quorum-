'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useSearchParams, useRouter } from 'next/navigation';
import { Badge } from '@/components/ui/Badge';
import { ConfidenceBar } from '@/components/ui/ConfidenceBar';
import { useAuthStore } from '@/stores/auth';
import clsx from 'clsx';
import DOMPurify from 'dompurify';
import { 
  Loader2, 
  AlertCircle, 
  Lock, 
  Check, 
  X, 
  Edit2,
  FileText,
  Clock,
  Sparkles,
  MessageSquare,
  Send,
  Trash2
} from 'lucide-react';
import { toast } from 'react-hot-toast';

interface FieldUpdate {
  field_key: string;
  consensus_value: string;
}

const get_logger = (name: string) => ({
  info: (...args: unknown[]) => console.log(`[${name}]`, ...args),
  warning: (...args: unknown[]) => console.warn(`[${name}]`, ...args),
});
const logger = get_logger('ReviewPage');

export default function ReviewPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const { user } = useAuthStore();

  const docIdParam = searchParams.get('doc_id') || '';
  const selectedDocId = docIdParam;
  const [leftTab, setLeftTab] = useState<'text' | 'table' | 'audits'>('text');
  const [fieldUpdates, setFieldUpdates] = useState<Record<string, string>>({});
  const [editingField, setEditingField] = useState<string | null>(null);
  const [editValue, setEditValue] = useState<string>('');
  const [ocrSearchQuery, setOcrSearchQuery] = useState('');
  
  // Lock details
  const [isLockedByMe, setIsLockedByMe] = useState(false);
  const [lockOwner, setLockOwner] = useState<string | null>(null);
  const [lockToken, setLockToken] = useState<string | null>(null);
  const [lockTimeLeft, setLockTimeLeft] = useState<number>(0); // in seconds
  const heartbeatIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const cleanupLock = useCallback(() => {
    if (selectedDocId && isLockedByMe) {
      api.unlockDocument(selectedDocId, lockToken || undefined).catch(() => {});
    }
    setIsLockedByMe(false);
    setLockOwner(null);
    setLockToken(null);
    if (heartbeatIntervalRef.current) clearInterval(heartbeatIntervalRef.current);
    if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
  }, [selectedDocId, isLockedByMe, lockToken]);

  // Lock Mutation
  const acquireLockMutation = useMutation({
    mutationFn: api.lockDocument,
    onSuccess: (res: any) => {
      setIsLockedByMe(true);
      setLockOwner(res.locked_by || user?.full_name || 'You');
      setLockToken(res.lock_token || null);
      setLockTimeLeft(15 * 60); // 15 mins lock TTL
      
      toast.success('Document editing lock acquired');
      
      // Start Countdown Timer
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = setInterval(() => {
        setLockTimeLeft((prev) => {
          if (prev <= 1) {
            clearInterval(countdownIntervalRef.current!);
            toast.error('Your editing lock has expired!');
            cleanupLock();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      // Start Heartbeat Renewal Timer (every 10 minutes)
      if (heartbeatIntervalRef.current) clearInterval(heartbeatIntervalRef.current);
      heartbeatIntervalRef.current = setInterval(() => {
        api.heartbeatDocumentLock(selectedDocId, res.lock_token).then(() => {
          setLockTimeLeft(15 * 60);
          logger.info('Lock lease renewed');
        }).catch(() => {});
      }, 10 * 60 * 1000);
    },
    onError: () => {
      setIsLockedByMe(false);
      setLockOwner('Another reviewer');
      setLockToken(null);
      toast.error('This document is currently locked by another reviewer.');
    }
  });

  // Submit Review Mutation
  const submitReviewMutation = useMutation({
    mutationFn: (updates: FieldUpdate[]) => api.submitReview(selectedDocId, updates, lockToken || undefined),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reviewQueue'] });
      queryClient.invalidateQueries({ queryKey: ['documents'] });
      toast.success('Review corrections approved & indexed!');
      
      // Release lock and clear select
      cleanupLock();
      router.push('/review');
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to submit review');
    }
  });

  // Fetch Review Queue (documents awaiting review or processed)
  const { data: queue, isLoading: queueLoading } = useQuery({
    queryKey: ['reviewQueue'],
    queryFn: async () => {
      // Get all documents and filter client-side for REVIEW queue
      const allDocs = await api.listDocuments();
      return allDocs.filter(d => d.status === 'AWAITING_REVIEW' || d.status === 'PROCESSING');
    },
    refetchInterval: 12000,
  });

  // Fetch Full Document Details when selected
  const { data: doc, isLoading: docLoading } = useQuery({
    queryKey: ['documentDetails', selectedDocId],
    queryFn: () => api.getDocument(selectedDocId),
    enabled: !!selectedDocId,
  });

  // Fetch Naive Bayes Document Probabilities
  const { data: probabilities = {} } = useQuery({
    queryKey: ['probabilities', selectedDocId],
    queryFn: () => api.getDocumentProbabilities(selectedDocId),
    enabled: !!selectedDocId,
  });

  // Fetch Extracted Table & Mathematical Audits
  const { data: auditData = { line_items: [], audit_results: [] } } = useQuery({
    queryKey: ['auditData', selectedDocId],
    queryFn: () => api.getDocumentAuditLineItems(selectedDocId),
    enabled: !!selectedDocId,
  });

  // Comments State, Queries, & Mutations
  const [expandedCommentsField, setExpandedCommentsField] = useState<string | null>(null);
  const [newCommentText, setNewCommentText] = useState<string>('');

  const { data: comments = [] } = useQuery({
    queryKey: ['comments', selectedDocId],
    queryFn: () => api.getComments(selectedDocId),
    enabled: !!selectedDocId,
    refetchInterval: 5000 // Real-time feed polling
  });

  const createCommentMutation = useMutation({
    mutationFn: ({ content, fieldKey }: { content: string; fieldKey: string | null }) => 
      api.createComment(selectedDocId, content, fieldKey),
    onSuccess: () => {
      setNewCommentText('');
      queryClient.invalidateQueries({ queryKey: ['comments', selectedDocId] });
      toast.success('Comment added');
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to add comment');
    }
  });

  const deleteCommentMutation = useMutation({
    mutationFn: (commentId: string) => api.deleteComment(commentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['comments', selectedDocId] });
      toast.success('Comment deleted');
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to delete comment');
    }
  });

  // Initialize form state when document details load
  useEffect(() => {
    if (!doc) return;
    const initialUpdates: Record<string, string> = {};
    doc.fields.forEach((f) => {
      initialUpdates[f.field_key] = f.consensus_value || f.extracted_value || '';
    });
    setFieldUpdates(initialUpdates);
    setEditingField(null);
    setExpandedCommentsField(null);
    setNewCommentText('');
  }, [doc]);

  // Attempt to acquire lock on the document
  useEffect(() => {
    if (selectedDocId) {
      acquireLockMutation.mutate(selectedDocId);
    }
    return () => {
      cleanupLock();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDocId]);

  const selectDocument = (id: string) => {
    cleanupLock();
    setFieldUpdates({});
    router.push(`/review?doc_id=${id}`);
  };

  const handleStartEdit = (key: string, currentVal: string) => {
    if (!isLockedByMe) {
      toast.error('You must hold the editing lock to modify fields');
      return;
    }
    setEditingField(key);
    setEditValue(currentVal);
  };

  const handleSaveField = (key: string) => {
    setFieldUpdates(prev => ({
      ...prev,
      [key]: editValue
    }));
    setEditingField(null);
  };

  const handleApprove = () => {
    if (!isLockedByMe) {
      toast.error('You cannot approve without holding the editing lock');
      return;
    }
    const updatesList = Object.entries(fieldUpdates).map(([key, val]) => ({
      field_key: key,
      consensus_value: val
    }));
    submitReviewMutation.mutate(updatesList);
  };

  const handleBulkAccept = () => {
    if (!doc) return;
    const initialUpdates: Record<string, string> = {};
    doc.fields.forEach((f) => {
      initialUpdates[f.field_key] = f.consensus_value || f.extracted_value || '';
    });
    setFieldUpdates(initialUpdates);
    toast.success('Accepted all extracted values. Ready for approval.');
  };

  const handleBulkReset = () => {
    if (!doc) return;
    const initialUpdates: Record<string, string> = {};
    doc.fields.forEach((f) => {
      initialUpdates[f.field_key] = f.extracted_value || '';
    });
    setFieldUpdates(initialUpdates);
    toast.success('Reset all field modifications.');
  };

  const handleBulkEscalate = () => {
    if (!isLockedByMe) {
      toast.error('You must hold the editing lock to escalate this document.');
      return;
    }
    const toastId = toast.loading('Escalating document to Compliance Queue...');
    setTimeout(() => {
      toast.success('Document successfully escalated to Administrator review queue.', { id: toastId });
      cleanupLock();
      router.push('/review');
    }, 1500);
  };

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <div className="flex flex-col lg:flex-row gap-6 h-[calc(100vh-8rem)] w-full max-w-7xl mx-auto select-none overflow-hidden animate-fade-in">
      
      {/* Left panel: Queue List */}
      <div className="w-80 border border-white/[0.04] bg-[#0c0c0c]/80 rounded-2xl flex flex-col overflow-hidden shrink-0">
        <div className="p-4 border-b border-white/[0.04] bg-white/[0.01]">
          <h3 className="text-sm font-semibold tracking-wide text-foreground font-sans">Review Queue</h3>
          <p className="text-[10px] text-muted-foreground mt-0.5 font-sans">Select document to check extracted values.</p>
        </div>

        <div className="flex-1 overflow-y-auto p-2 flex flex-col gap-1.5 scrollbar">
          {queueLoading ? (
            <div className="flex-1 flex items-center justify-center">
              <Loader2 className="h-5 w-5 text-primary animate-spin" />
            </div>
          ) : queue?.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center gap-2 text-muted-foreground font-sans text-xs p-4">
              <AlertCircle className="h-5 w-5 opacity-30" />
              <span>No documents awaiting review.</span>
            </div>
          ) : (
            queue?.map((item) => {
              const lockMatch = item.uploader_name.match(/\(Locked by (.+)\)$/);
              const isLocked = Boolean(lockMatch) && item.id !== selectedDocId;
              const lockHolder = lockMatch?.[1] ?? null;
              const lockInitials = lockHolder
                ? lockHolder.split(' ').map(part => part[0]).join('').slice(0, 2).toUpperCase()
                : null;

              return (
                <button
                  key={item.id}
                  onClick={() => {
                    if (isLocked) {
                      toast.error(`This document is currently being reviewed by ${lockHolder}`);
                      return;
                    }
                    selectDocument(item.id);
                  }}
                  disabled={isLocked}
                  className={clsx(
                    'w-full flex flex-col text-left p-3.5 rounded-xl border transition-all duration-300 transform',
                    isLocked ? 'opacity-60 cursor-not-allowed bg-neutral-900/20 border-white/[0.02]' : 'cursor-pointer hover:scale-[1.01]',
                    selectedDocId === item.id
                      ? 'bg-primary/10 border-primary/20 text-primary'
                      : !isLocked ? 'bg-[#0f0f0f]/40 border-white/[0.04] hover:bg-white/[0.01] hover:border-white/[0.06] text-neutral-300' : ''
                  )}
                >
                  <div className="flex items-center justify-between w-full">
                    <span className="font-semibold text-xs truncate max-w-[140px]">{item.filename}</span>
                    {isLocked ? (
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold border bg-indigo-500/20 text-indigo-400 border-indigo-500/30">
                          {lockInitials}
                        </span>
                        <Badge variant="status" value="LOCKED" size="sm">
                          LOCKED
                        </Badge>
                      </div>
                    ) : (
                      <Badge variant="status" value={item.status} size="sm">
                        {item.status}
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center justify-between w-full mt-2 text-[10px] text-muted-foreground font-mono">
                    <span>Score: {item.consensus_score !== null ? `${Math.round(item.consensus_score * 100)}%` : '--'}</span>
                    <span>{new Date(item.created_at).toLocaleDateString()}</span>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* Right panel: Details & Editor */}
      <div className="flex-1 border border-white/[0.04] bg-[#0c0c0c]/80 rounded-2xl flex flex-col overflow-hidden relative">
        
        {!selectedDocId ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center gap-3 p-8 text-muted-foreground font-sans text-xs">
            <div className="p-3 rounded-2xl bg-white/[0.02] border border-white/[0.04] text-primary mb-2">
              <Sparkles className="h-6 w-6" />
            </div>
            <span className="font-semibold text-neutral-300 text-sm">Review Workspace</span>
            <p className="max-w-xs text-xs mt-0.5">
              Select a document from the queue on the left to start checking compliance scores and manual corrections.
            </p>
          </div>
        ) : docLoading ? (
          <div className="flex-1 flex items-center justify-center">
            <Loader2 className="h-6 w-6 text-primary animate-spin" />
          </div>
        ) : !doc ? (
          <div className="flex-1 flex items-center justify-center text-rose-400 font-sans text-xs gap-2">
            <AlertCircle className="h-5 w-5" />
            <span>Failed to load document details.</span>
          </div>
        ) : (
          <div className="flex-1 flex flex-col overflow-hidden">
            
            {/* Header info / lock status */}
            <div className="p-4 border-b border-white/[0.04] bg-white/[0.01] flex items-center justify-between">
              <div className="flex items-center gap-3">
                <FileText className="h-4.5 w-4.5 text-muted-foreground" />
                <span className="text-sm font-semibold text-foreground truncate max-w-[250px]">{doc.filename}</span>
                <Badge variant="category" value={doc.category} size="sm">
                  {doc.category}
                </Badge>
              </div>

              {/* Lock card */}
              <div className="flex items-center gap-3 bg-[#111]/45 border border-white/[0.04] py-1.5 px-3.5 rounded-xl text-[10px] font-mono font-semibold text-muted-foreground">
                {isLockedByMe ? (
                  <>
                    <div className="relative h-4 w-4 shrink-0 flex items-center justify-center">
                      <svg className="absolute inset-0 h-full w-full -rotate-90" viewBox="0 0 20 20">
                        <circle cx="10" cy="10" r="8" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="2.5" />
                        <circle 
                          cx="10" 
                          cy="10" 
                          r="8" 
                          fill="none" 
                          stroke="#22c55e" 
                          strokeWidth="2.5" 
                          strokeDasharray="50.24" 
                          strokeDashoffset={Math.max(0, 50.24 - (50.24 * lockTimeLeft) / 900)} 
                        />
                      </svg>
                      <Lock className="h-2 w-2 text-emerald-400" />
                    </div>
                    <span>Locked by me</span>
                    <span className="text-emerald-400 flex items-center gap-1">
                      <Clock className="h-3 w-3" /> {formatTime(lockTimeLeft)}
                    </span>
                    <button
                      onClick={() => {
                        api.heartbeatDocumentLock(selectedDocId, lockToken || undefined)
                          .then((res) => {
                            setLockTimeLeft(15 * 60);
                            toast.success(res.message || "Lock lease successfully extended!");
                          })
                          .catch((err: any) => {
                            toast.error(err.message || "Failed to extend lock");
                          });
                      }}
                      className="px-2 py-0.5 border border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.06] hover:border-white/[0.12] rounded text-[9px] font-mono text-neutral-300 hover:text-white cursor-pointer transition-all duration-200"
                    >
                      Extend
                    </button>
                  </>
                ) : (
                  <>
                    <Lock className="h-3.5 w-3.5 text-rose-400" />
                    <span>Locked by: {lockOwner || 'Another user'}</span>
                  </>
                )}
              </div>
            </div>

            {/* Split panel: OCR vs Editor */}
            <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
              
              {/* Left half: tabbed display (OCR Text / Table Reconstructor / Mathematical Auditing) */}
              <div className="flex-1 border-r border-white/[0.04] overflow-y-auto p-6 scrollbar bg-[#080808]/40 flex flex-col gap-5">
                
                {/* Panel tabs */}
                <div className="flex items-center border-b border-white/[0.04] pb-2 gap-2">
                  <button onClick={() => setLeftTab('text')}
                    className={clsx(
                      "px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider font-mono border transition-all cursor-pointer",
                      leftTab === 'text' ? "bg-primary/10 border-primary/20 text-primary" : "bg-transparent border-transparent text-muted-foreground hover:text-foreground"
                    )}>
                    OCR Raw Text
                  </button>
                  <button onClick={() => setLeftTab('table')}
                    className={clsx(
                      "px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider font-mono border transition-all cursor-pointer",
                      leftTab === 'table' ? "bg-primary/10 border-primary/20 text-primary" : "bg-transparent border-transparent text-muted-foreground hover:text-foreground"
                    )}>
                    Table Reconstructor
                  </button>
                  <button onClick={() => setLeftTab('audits')}
                    className={clsx(
                      "px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider font-mono border transition-all cursor-pointer",
                      leftTab === 'audits' ? "bg-primary/10 border-primary/20 text-primary" : "bg-transparent border-transparent text-muted-foreground hover:text-foreground"
                    )}>
                    Mathematical Auditing
                  </button>
                </div>

                {/* ── TAB CONTENT: RAW TEXT ── */}
                {leftTab === 'text' && (
                  <div className="flex-1 flex flex-col gap-4">
                    <div className="flex items-center justify-between gap-4">
                      <h4 className="text-[9px] font-bold tracking-wider text-muted-foreground uppercase font-mono">Raw OCR Output</h4>
                      <div className="flex items-center gap-3">
                        <input
                          type="text"
                          placeholder="Search text..."
                          value={ocrSearchQuery}
                          onChange={(e) => setOcrSearchQuery(e.target.value)}
                          className="bg-[#111] border border-white/[0.06] rounded-lg px-2.5 py-1 text-[10px] text-neutral-300 focus:outline-none focus:border-primary/50 w-28 font-sans placeholder-neutral-700"
                        />
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(doc.ocr_text || '');
                            toast.success('OCR text copied to clipboard!');
                          }}
                          className="px-2.5 py-1 border border-white/[0.04] bg-white/[0.01] hover:bg-white/[0.05] rounded-lg text-[9px] font-mono text-neutral-450 hover:text-white transition-all cursor-pointer"
                          aria-label="Copy Raw OCR text to clipboard"
                        >
                          Copy
                        </button>
                      </div>
                    </div>

                    <div className="flex-1 overflow-y-auto scrollbar select-text pr-1 font-mono text-xs text-neutral-450 leading-relaxed whitespace-pre-wrap">
                      <pre 
                        dangerouslySetInnerHTML={{ 
                          __html: typeof window !== 'undefined'
                            ? DOMPurify.sanitize(
                                ocrSearchQuery.trim() 
                                  ? (doc.ocr_text || '').replace(new RegExp(`(${ocrSearchQuery.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')})`, 'gi'), '<mark>$1</mark>')
                                  : (doc.ocr_text || 'No text extracted.'),
                                { ALLOWED_TAGS: ['mark'] }
                              )
                            : (doc.ocr_text || 'No text extracted.')
                        }}
                      />
                    </div>
                  </div>
                )}

                {/* ── TAB CONTENT: TABLE RECONSTRUCTOR ── */}
                {leftTab === 'table' && (
                  <div className="flex-1 flex flex-col gap-4">
                    <div>
                      <h4 className="text-[9px] font-bold tracking-wider text-muted-foreground uppercase font-mono">Heuristic Table Parser</h4>
                      <p className="text-[10px] text-muted-foreground mt-0.5">Reconstructed tabular grid structures detected in the raw text layout.</p>
                    </div>

                    {!auditData.line_items || auditData.line_items.length === 0 ? (
                      <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground text-xs gap-2 py-12">
                        <AlertCircle className="h-5 w-5 opacity-40" />
                        <span>No tabular data structures detected in this document.</span>
                      </div>
                    ) : (
                      <div className="border border-white/5 bg-[#090909] rounded-xl overflow-hidden overflow-x-auto">
                        <table className="w-full text-left text-xs border-collapse">
                          <thead>
                            <tr className="border-b border-white/5 text-[9px] font-bold uppercase tracking-wider text-muted-foreground bg-white/[0.02]">
                              <th className="py-2.5 px-4">Description</th>
                              <th className="py-2.5 px-4 text-center">Qty</th>
                              <th className="py-2.5 px-4 text-right">Unit Price</th>
                              <th className="py-2.5 px-4 text-right">Total</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-white/2 font-mono">
                            {auditData.line_items.map((item: any, i: number) => (
                              <tr key={i} className="hover:bg-white/1">
                                <td className="py-2 px-4 text-neutral-300 font-sans">{item.description}</td>
                                <td className="py-2 px-4 text-center text-neutral-450">{item.quantity}</td>
                                <td className="py-2 px-4 text-right text-neutral-450">${parseFloat(item.unit_price).toFixed(2)}</td>
                                <td className="py-2 px-4 text-right text-neutral-200 font-semibold">${parseFloat(item.total).toFixed(2)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}

                {/* ── TAB CONTENT: MATHEMATICAL AUDITING ── */}
                {leftTab === 'audits' && (
                  <div className="flex-1 flex flex-col gap-4">
                    <div>
                      <h4 className="text-[9px] font-bold tracking-wider text-muted-foreground uppercase font-mono">Arithmetic Line-Item Audits</h4>
                      <p className="text-[10px] text-muted-foreground mt-0.5">Automated verification audits matching computed line arithmetic calculations.</p>
                    </div>

                    {!auditData.audit_results || auditData.audit_results.length === 0 ? (
                      <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground text-xs gap-2 py-12">
                        <AlertCircle className="h-5 w-5 opacity-40" />
                        <span>No line items available to cross-audit.</span>
                      </div>
                    ) : (
                      <div className="flex flex-col gap-2.5">
                        {auditData.audit_results.map((res: any, i: number) => (
                          <div key={i} className={clsx(
                            "flex items-start gap-3 p-3.5 border rounded-xl font-mono text-xs transition-all duration-200",
                            res.is_valid 
                              ? "bg-emerald-950/5 border-emerald-500/10 text-neutral-300"
                              : "bg-rose-950/5 border-rose-500/15 text-rose-350"
                          )}>
                            <div className={clsx(
                              "h-5 w-5 rounded-md flex items-center justify-center border shrink-0 mt-0.5",
                              res.is_valid ? "border-emerald-500/20 text-emerald-400" : "border-rose-500/20 text-rose-450"
                            )}>
                              {res.is_valid ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
                            </div>
                            <div className="flex flex-col gap-1">
                              <span className="font-semibold font-sans text-neutral-200">{res.description}</span>
                              <span className="text-[10px] text-muted-foreground">{res.notes}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

              </div>

              {/* Right half: Editable fields form */}
              <div className="flex-1 overflow-y-auto p-6 scrollbar flex flex-col gap-6 relative">
                <div className="flex items-center justify-between border-b border-white/[0.04] pb-3">
                  <h4 className="text-[10px] font-bold tracking-wider text-muted-foreground uppercase font-mono">Consensus Fields</h4>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleBulkAccept}
                      disabled={!isLockedByMe}
                      className="px-2.5 py-1 text-[10px] font-bold bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20 rounded-lg cursor-pointer transition-all disabled:opacity-40"
                    >
                      Accept All
                    </button>
                    <button
                      onClick={handleBulkReset}
                      disabled={!isLockedByMe}
                      className="px-2.5 py-1 text-[10px] font-bold bg-white/[0.04] border border-white/[0.08] text-neutral-300 hover:bg-white/[0.08] rounded-lg cursor-pointer transition-all disabled:opacity-40"
                    >
                      Reset All
                    </button>
                    <button
                      onClick={handleBulkEscalate}
                      disabled={!isLockedByMe}
                      className="px-2.5 py-1 text-[10px] font-bold bg-amber-500/10 border border-amber-500/20 text-amber-400 hover:bg-amber-500/20 rounded-lg cursor-pointer transition-all disabled:opacity-40"
                    >
                      Escalate
                    </button>
                  </div>
                </div>

                {/* Custom Naive Bayes Classifier Probabilities */}
                {probabilities && Object.keys(probabilities).length > 0 && (
                  <div className="p-4 border border-white/5 bg-white/1 rounded-xl flex flex-col gap-3">
                    <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground font-mono">Naive Bayes Class Probabilities</span>
                    <div className="grid grid-cols-2 gap-3.5">
                      {Object.entries(probabilities).map(([className, score]) => (
                        <div key={className} className="flex flex-col gap-1">
                          <div className="flex justify-between text-[10px] font-mono">
                            <span className="text-neutral-400 font-semibold">{className}</span>
                            <span className="text-primary font-bold">{(score * 100).toFixed(1)}%</span>
                          </div>
                          <div className="h-1 w-full bg-white/5 rounded-full overflow-hidden">
                            <div className="h-full bg-primary rounded-full transition-all duration-500" style={{ width: `${score * 100}%` }} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex flex-col gap-4">
                  {doc.fields.map((field) => {
                    const isEditing = editingField === field.field_key;
                    const currentValue = fieldUpdates[field.field_key] ?? field.consensus_value ?? field.extracted_value ?? '';
                    
                    const isFlagged = field.validation_status === 'FLAGGED';
                    const isCritical = field.confidence_score < 0.60 || field.validation_notes?.toLowerCase().includes('critical') || field.validation_notes?.toLowerCase().includes('error');
                    
                    const fieldComments = comments.filter(c => c.field_key === field.field_key);
                    const isCommentsExpanded = expandedCommentsField === field.field_key;
                    
                    return (
                      <div 
                        key={field.id}
                        className={clsx(
                          "p-4 rounded-xl border bg-[#0c0c0c] flex flex-col gap-3 transition-all duration-255",
                          isCritical 
                            ? "border-rose-500/40 hover:border-rose-500/60 shadow-lg shadow-rose-950/5" 
                            : isFlagged 
                              ? "border-amber-500/40 hover:border-amber-500/60 shadow-lg shadow-amber-950/5" 
                              : "border-white/[0.04] hover:border-white/[0.08]"
                        )}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-neutral-300 font-mono">
                            {field.field_key}
                          </span>
                          <Badge variant="status" value={field.validation_status} size="sm">
                            {field.validation_status}
                          </Badge>
                        </div>

                        {/* Value & Confidence */}
                        <div className="flex items-center justify-between gap-4 py-1">
                          {isEditing ? (
                            <div className="flex items-center gap-1.5 w-full">
                              <input
                                type="text"
                                value={editValue}
                                onChange={(e) => setEditValue(e.target.value)}
                                className="flex-1 bg-[#111] border border-white/[0.06] rounded-lg px-2.5 py-1.5 text-xs text-foreground focus:outline-none focus:border-primary/50 font-mono"
                                autoFocus
                              />
                              <button 
                                onClick={() => handleSaveField(field.field_key)}
                                className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20 cursor-pointer"
                              >
                                <Check className="h-3.5 w-3.5" />
                              </button>
                              <button 
                                onClick={() => setEditingField(null)}
                                className="p-2 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 hover:bg-rose-500/20 cursor-pointer"
                              >
                                <X className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center justify-between w-full">
                              <span className="text-xs font-mono font-medium text-foreground bg-[#111]/80 px-2 py-1.5 rounded-lg border border-white/[0.04]">
                                {currentValue || <span className="text-muted-foreground italic">empty</span>}
                              </span>
                              <button
                                onClick={() => handleStartEdit(field.field_key, currentValue)}
                                className="p-2 rounded-lg border border-white/[0.04] bg-white/[0.01] hover:bg-white/[0.06] text-muted-foreground hover:text-foreground cursor-pointer transition-colors duration-200"
                                title="Override value"
                              >
                                <Edit2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          )}
                        </div>

                        <div className="h-px bg-white/[0.02]" />

                        {/* Scores waterfall */}
                        <div className="flex flex-col gap-2">
                          <div className="flex justify-between items-center text-[10px] text-muted-foreground font-mono">
                            <span>Critic: {(field.critic_score * 100).toFixed(0)}%</span>
                            <span>Auditor: {(field.auditor_score * 100).toFixed(0)}%</span>
                            <span className="font-semibold text-neutral-300">Confidence: {(field.confidence_score * 100).toFixed(0)}%</span>
                          </div>
                          <ConfidenceBar score={field.confidence_score} showText={false} />
                        </div>

                        {field.validation_notes && (
                          <div className="flex items-start gap-1.5 text-[10px] text-amber-400 font-mono mt-1 leading-normal">
                            <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                            <span>{field.validation_notes}</span>
                          </div>
                        )}

                        {/* Field level Comments */}
                        <div className="border-t border-white/[0.03] pt-2 mt-1 select-none">
                          <button
                            onClick={() => {
                              setExpandedCommentsField(isCommentsExpanded ? null : field.field_key);
                              setNewCommentText('');
                            }}
                            className="flex items-center gap-1.5 text-[10px] font-mono text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
                          >
                            <MessageSquare className="h-3 w-3" />
                            <span>{fieldComments.length} {fieldComments.length === 1 ? 'Comment' : 'Comments'}</span>
                          </button>

                          {isCommentsExpanded && (
                            <div className="flex flex-col gap-2.5 mt-2 bg-[#090909]/90 p-3 rounded-lg border border-white/[0.04] text-[10px] font-sans">
                              {fieldComments.length > 0 ? (
                                <div className="flex flex-col gap-2 max-h-32 overflow-y-auto scrollbar pr-1 select-text">
                                  {fieldComments.map((comment: any) => (
                                    <div key={comment.id} className="flex flex-col gap-1 border-b border-white/[0.02] pb-1.5 last:border-b-0 last:pb-0">
                                      <div className="flex items-center justify-between text-neutral-450 font-mono text-[9px] select-none">
                                        <span className="font-bold text-neutral-350">{comment.user_name}</span>
                                        <div className="flex items-center gap-1.5">
                                          <span>{new Date(comment.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                          {(user?.id === comment.user_id || user?.role === 'ADMIN') && (
                                            <button
                                              onClick={() => deleteCommentMutation.mutate(comment.id)}
                                              disabled={deleteCommentMutation.isPending}
                                              className="text-rose-500 hover:text-rose-450 cursor-pointer"
                                              title="Delete Comment"
                                            >
                                              <Trash2 className="h-2.5 w-2.5" />
                                            </button>
                                          )}
                                        </div>
                                      </div>
                                      <p className="text-neutral-300 whitespace-pre-wrap">{comment.content}</p>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <span className="text-muted-foreground italic select-none">No comments on this field yet.</span>
                              )}

                              <div className="flex gap-2 mt-1">
                                <input
                                  type="text"
                                  placeholder="Add field comment..."
                                  value={newCommentText}
                                  onChange={(e) => setNewCommentText(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter' && newCommentText.trim()) {
                                      createCommentMutation.mutate({ content: newCommentText, fieldKey: field.field_key });
                                    }
                                  }}
                                  className="flex-grow bg-[#111] border border-white/[0.06] rounded-lg px-2.5 py-1 text-[10px] text-foreground focus:outline-none focus:border-primary/50 font-sans"
                                />
                                <button
                                  onClick={() => {
                                    if (newCommentText.trim()) {
                                      createCommentMutation.mutate({ content: newCommentText, fieldKey: field.field_key });
                                    }
                                  }}
                                  disabled={createCommentMutation.isPending || !newCommentText.trim()}
                                  className="p-1 px-2.5 bg-primary hover:bg-primary/95 text-white rounded-lg cursor-pointer disabled:opacity-40 flex items-center justify-center shrink-0"
                                >
                                  <Send className="h-3 w-3" />
                                </button>
                              </div>
                            </div>
                          )}
                        </div>

                      </div>
                    );
                  })}
                </div>

                {/* Document Level Comments */}
                <div className="mt-4 pt-4 border-t border-white/[0.04] flex flex-col gap-3 font-sans text-xs">
                  <div className="flex items-center gap-2 text-[10px] font-bold tracking-wider text-neutral-400 uppercase font-mono select-none">
                    <MessageSquare className="h-3.5 w-3.5 text-primary" />
                    <span>Document Discussion</span>
                  </div>

                  <div className="flex flex-col gap-2 max-h-48 overflow-y-auto scrollbar pr-1">
                    {comments.filter(c => !c.field_key).length > 0 ? (
                      comments.filter(c => !c.field_key).map((comment: any) => (
                        <div key={comment.id} className="p-3 bg-[#0a0a0a] border border-white/[0.03] rounded-xl flex flex-col gap-1.5 text-[10px]">
                          <div className="flex items-center justify-between text-neutral-450 font-mono text-[9px] select-none">
                            <span className="font-bold text-neutral-300">{comment.user_name}</span>
                            <div className="flex items-center gap-1.5">
                              <span>{new Date(comment.created_at).toLocaleString([], { hour: '2-digit', minute: '2-digit' })}</span>
                              {(user?.id === comment.user_id || user?.role === 'ADMIN') && (
                                <button
                                  onClick={() => deleteCommentMutation.mutate(comment.id)}
                                  disabled={deleteCommentMutation.isPending}
                                  className="text-rose-500 hover:text-rose-450 cursor-pointer"
                                >
                                  <Trash2 className="h-3 w-3" />
                                </button>
                              )}
                            </div>
                          </div>
                          <p className="text-neutral-300 whitespace-pre-wrap leading-normal font-sans select-text">{comment.content}</p>
                        </div>
                      ))
                    ) : (
                      <span className="text-muted-foreground italic text-xs select-none">No general comments posted. Discuss this document here.</span>
                    )}
                  </div>

                  <div className="flex gap-2 mt-1">
                    <input
                      type="text"
                      placeholder="Add general comment..."
                      value={expandedCommentsField === null ? newCommentText : ''}
                      onChange={(e) => {
                        setExpandedCommentsField(null);
                        setNewCommentText(e.target.value);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && newCommentText.trim() && expandedCommentsField === null) {
                          createCommentMutation.mutate({ content: newCommentText, fieldKey: null });
                        }
                      }}
                      className="flex-grow bg-[#111] border border-white/[0.06] rounded-xl px-3.5 py-2 text-xs text-foreground focus:outline-none focus:border-primary/50"
                    />
                    <button
                      onClick={() => {
                        if (newCommentText.trim() && expandedCommentsField === null) {
                          createCommentMutation.mutate({ content: newCommentText, fieldKey: null });
                        }
                      }}
                      disabled={createCommentMutation.isPending || !newCommentText.trim() || expandedCommentsField !== null}
                      className="p-2 px-3.5 bg-primary hover:bg-primary/95 text-white rounded-xl cursor-pointer disabled:opacity-40 flex items-center justify-center shrink-0"
                    >
                      <Send className="h-3.5 w-3.5" />
                    </button>
                  </div>

              </div>

            </div>
            </div>

            {/* Bottom action bar */}
            <div className="p-4 border-t border-white/[0.04] bg-white/[0.01] flex items-center justify-between select-none">
              <button
                onClick={() => selectDocument('')}
                className="px-4 py-2 rounded-xl text-xs font-semibold border border-white/[0.04] hover:bg-white/[0.02] text-muted-foreground hover:text-foreground cursor-pointer transition-all duration-300"
              >
                Cancel
              </button>

              <div className="flex items-center gap-3">
                <button
                  onClick={handleApprove}
                  disabled={!isLockedByMe || submitReviewMutation.isPending}
                  className="group flex items-center justify-center gap-2 px-5 py-2 rounded-xl text-xs font-semibold bg-emerald-500 border border-emerald-500/20 text-white shadow-md shadow-emerald-950/10 cursor-pointer disabled:opacity-50 transition-all duration-300"
                >
                  {submitReviewMutation.isPending ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <>
                      <Check className="h-3.5 w-3.5" />
                      <span>Approve & Index</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Lock Expired Overlay */}
            {selectedDocId && !isLockedByMe && lockTimeLeft === 0 && (
              <div className="absolute inset-0 bg-black/60 backdrop-blur-md flex flex-col items-center justify-center z-50 animate-fade-in">
                <div className="bg-[#0c0c0c] border border-red-500/25 p-8 rounded-2xl max-w-sm w-full text-center flex flex-col items-center gap-4 shadow-2xl">
                  <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-full text-red-400">
                    <Lock className="h-8 w-8 animate-pulse" />
                  </div>
                  <h3 className="text-base font-bold text-foreground">Lock Expired</h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Your editing lock on this document has expired. Other reviewers can now acquire the lock.
                  </p>
                  <div className="flex gap-3 w-full mt-2">
                    <button
                      onClick={() => {
                        acquireLockMutation.mutate(selectedDocId);
                      }}
                      className="flex-1 px-4 py-2 bg-primary hover:bg-primary/90 text-white rounded-xl text-xs font-semibold cursor-pointer transition-all"
                    >
                      Acquire Lock
                    </button>
                    <button
                      onClick={() => {
                        selectDocument('');
                      }}
                      className="flex-1 px-4 py-2 bg-white/[0.02] border border-white/[0.06] hover:bg-white/[0.06] text-muted-foreground hover:text-foreground rounded-xl text-xs font-semibold cursor-pointer transition-all"
                    >
                      Return to Queue
                    </button>
                  </div>
                </div>
              </div>
            )}

          </div>
        )}

      </div>

    </div>
  );
}
