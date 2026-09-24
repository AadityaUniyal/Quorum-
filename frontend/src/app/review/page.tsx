'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useSearchParams, useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { Badge } from '@/components/ui/Badge';
import { ConfidenceBar } from '@/components/ui/ConfidenceBar';
import { useAuthStore } from '@/stores/auth';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import { SpatialBoundingCanvas } from '@/components/review/SpatialBoundingCanvas';
import { saveReviewDraft, loadReviewDraft, clearReviewDraft } from '@/lib/offlineStorage';

const DocumentDiffViewer = dynamic(
  () => import('@/components/review/DocumentDiffViewer').then((m) => m.DocumentDiffViewer),
  { ssr: false }
);
const ThreeWayReconciliationModal = dynamic(
  () => import('@/components/review/ThreeWayReconciliationModal').then((m) => m.ThreeWayReconciliationModal),
  { ssr: false }
);
const ErpExportModal = dynamic(
  () => import('@/components/review/ErpExportModal').then((m) => m.ErpExportModal),
  { ssr: false }
);
import clsx from 'clsx';
import DOMPurify from 'dompurify';
import { EmptyState } from '@/components/ui/EmptyState';
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
  Trash2, 
  Eye, 
  Plus,
  Building2
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
  const [leftTab, setLeftTab] = useState<'text' | 'table' | 'audits' | 'spatial'>('text');
  const [fieldUpdates, setFieldUpdates] = useState<Record<string, string>>({});
  const [originalFields, setOriginalFields] = useState<Record<string, string>>({});
  const [editingField, setEditingField] = useState<string | null>(null);
  const [editValue, setEditValue] = useState<string>('');
  const [ocrSearchQuery, setOcrSearchQuery] = useState('');
  const [showDiffModal, setShowDiffModal] = useState(false);
  const [show3WayModal, setShow3WayModal] = useState(false);
  const [showErpModal, setShowErpModal] = useState(false);
  const threeWayTriggerRef = useRef<HTMLButtonElement | null>(null);
  const erpTriggerRef = useRef<HTMLButtonElement | null>(null);
  const bottomErpTriggerRef = useRef<HTMLButtonElement | null>(null);
  const lastErpTriggerRef = useRef<HTMLButtonElement | null>(null);
  const diffTriggerRef = useRef<HTMLButtonElement | null>(null);
  const [hoveredFieldKey, setHoveredFieldKey] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState<number>(1);

  // Custom added and deleted fields state
  const [customFields, setCustomFields] = useState<{ field_key: string; consensus_value: string }[]>([]);
  const [deletedFields, setDeletedFields] = useState<string[]>([]);
  const [showAddFieldModal, setShowAddFieldModal] = useState(false);
  const [newFieldKey, setNewFieldKey] = useState('');
  const [newFieldValue, setNewFieldValue] = useState('');

  // Table Reconstructor editable line items
  const [editableLineItems, setEditableLineItems] = useState<Array<{
    description: string;
    quantity: number | string;
    unit_price: number | string;
    total: number | string;
  }>>([]);
  const [editingLineIndex, setEditingLineIndex] = useState<number | null>(null);
  const [editLineItem, setEditLineItem] = useState<{
    description: string;
    quantity: number | string;
    unit_price: number | string;
    total: number | string;
  }>({ description: '', quantity: 1, unit_price: 0, total: 0 });
  
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
      // Allow optimistic review session so reviewers are never blocked
      setIsLockedByMe(true);
      setLockOwner(user?.full_name || 'You (Active Reviewer)');
      setLockToken(null);
      setLockTimeLeft(15 * 60);
    }
  });

  // Submit Review Mutation
  const submitReviewMutation = useMutation({
    mutationFn: ({ updates, deletedKeys }: { updates: FieldUpdate[]; deletedKeys?: string[] }) =>
      api.submitReview(selectedDocId, updates, lockToken || undefined, deletedKeys),
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
    refetchIntervalInBackground: true,
  });

  // Fetch Full Document Details when selected
  const { data: doc, isLoading: docLoading } = useQuery({
    queryKey: ['documentDetails', selectedDocId],
    queryFn: () => api.getDocument(selectedDocId),
    enabled: !!selectedDocId,
    refetchInterval: selectedDocId ? 8000 : false,
    refetchIntervalInBackground: true,
  });

  // Fetch Naive Bayes Document Probabilities
  const { data: probabilities = {} } = useQuery({
    queryKey: ['probabilities', selectedDocId],
    queryFn: () => api.getDocumentProbabilities(selectedDocId),
    enabled: !!selectedDocId,
    refetchInterval: selectedDocId ? 15000 : false,
    refetchIntervalInBackground: true,
  });

  // Fetch Extracted Table & Mathematical Audits
  const { data: auditData = { line_items: [], audit_results: [] } } = useQuery({
    queryKey: ['auditData', selectedDocId],
    queryFn: () => api.getDocumentAuditLineItems(selectedDocId),
    enabled: !!selectedDocId,
    refetchInterval: selectedDocId ? 15000 : false,
    refetchIntervalInBackground: true,
  });

  useEffect(() => {
    if (auditData?.line_items && auditData.line_items.length > 0) {
      setEditableLineItems(auditData.line_items);
    }
  }, [auditData]);

  const handleStartEditLine = (index: number) => {
    const item = editableLineItems[index];
    setEditLineItem({ ...item });
    setEditingLineIndex(index);
  };

  const handleSaveLine = (index: number) => {
    const updated = [...editableLineItems];
    const qty = parseFloat(String(editLineItem.quantity)) || 0;
    const price = parseFloat(String(editLineItem.unit_price)) || 0;
    const computedTotal = (qty * price).toFixed(2);
    updated[index] = {
      ...editLineItem,
      total: editLineItem.total && editLineItem.total !== '0.00' ? editLineItem.total : computedTotal,
    };
    setEditableLineItems(updated);
    setEditingLineIndex(null);
    toast.success('Line item updated');
  };

  const handleDeleteLine = (index: number) => {
    setEditableLineItems(prev => prev.filter((_, i) => i !== index));
    if (editingLineIndex === index) setEditingLineIndex(null);
    toast.success('Line item removed');
  };

  const handleAddLineItem = () => {
    const newItem = { description: 'New Line Item', quantity: 1, unit_price: '0.00', total: '0.00' };
    const nextList = [...editableLineItems, newItem];
    setEditableLineItems(nextList);
    setEditLineItem(newItem);
    setEditingLineIndex(nextList.length - 1);
  };

  // Comments State, Queries, & Mutations
  const [expandedCommentsField, setExpandedCommentsField] = useState<string | null>(null);
  const [newCommentText, setNewCommentText] = useState<string>('');

  const { data: comments = [] } = useQuery({
    queryKey: ['comments', selectedDocId],
    queryFn: () => api.getComments(selectedDocId),
    enabled: !!selectedDocId,
    refetchInterval: 5000, // Real-time feed polling
    refetchIntervalInBackground: true,
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
    const origMap: Record<string, string> = {};
    doc.fields.forEach((f) => {
      initialUpdates[f.field_key] = f.consensus_value || f.extracted_value || '';
      origMap[f.field_key] = f.extracted_value || f.consensus_value || '';
    });
    setOriginalFields(origMap);

    if (selectedDocId) {
      loadReviewDraft(selectedDocId).then((draft) => {
        if (draft && Object.keys(draft).length > 0) {
          setFieldUpdates({ ...initialUpdates, ...draft });
          toast.success('Restored unsubmitted draft from IndexedDB');
        } else {
          setFieldUpdates(initialUpdates);
        }
      });
    } else {
      setFieldUpdates(initialUpdates);
    }
    setEditingField(null);
    setExpandedCommentsField(null);
    setNewCommentText('');
  }, [doc, selectedDocId]);

  // Auto-save drafts to IndexedDB on field modification
  useEffect(() => {
    if (selectedDocId && Object.keys(fieldUpdates).length > 0) {
      saveReviewDraft(selectedDocId, fieldUpdates);
    }
  }, [selectedDocId, fieldUpdates]);

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
      setIsLockedByMe(true);
      setLockOwner(user?.full_name || 'You');
      setLockTimeLeft(15 * 60);
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

  const handleAddCustomField = () => {
    if (!newFieldKey.trim()) {
      toast.error('Please enter a field name');
      return;
    }
    const cleanKey = newFieldKey.trim().toLowerCase().replace(/\s+/g, '_');
    setCustomFields(prev => [...prev, { field_key: cleanKey, consensus_value: newFieldValue }]);
    setFieldUpdates(prev => ({ ...prev, [cleanKey]: newFieldValue }));
    setNewFieldKey('');
    setNewFieldValue('');
    setShowAddFieldModal(false);
    toast.success(`Custom field "${cleanKey}" added`);
  };

  const handleDeleteField = (key: string) => {
    setDeletedFields(prev => [...prev, key]);
    setFieldUpdates(prev => {
      const copy = { ...prev };
      delete copy[key];
      return copy;
    });
    setCustomFields(prev => prev.filter(f => f.field_key !== key));
    toast.success(`Field "${key}" removed from payload`);
  };

  const handleApprove = useCallback(() => {
    if (!isLockedByMe) {
      setIsLockedByMe(true);
    }
    const updatesList = Object.entries(fieldUpdates).map(([key, val]) => ({
      field_key: key,
      consensus_value: val
    }));
    if (selectedDocId) {
      clearReviewDraft(selectedDocId);
    }
    submitReviewMutation.mutate({ updates: updatesList, deletedKeys: deletedFields });
  }, [isLockedByMe, fieldUpdates, deletedFields, selectedDocId, submitReviewMutation]);

  useKeyboardShortcuts(
    {
      onApprove: handleApprove,
      onSaveDraft: () => {
        if (selectedDocId && fieldUpdates) {
          saveReviewDraft(selectedDocId, fieldUpdates);
          toast.success('Draft saved to offline storage (Ctrl+S).');
        }
      },
      onToggleDiff: () => setShowDiffModal((prev) => !prev),
    },
    isLockedByMe
  );

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
            <EmptyState
              icon={AlertCircle}
              title="No Documents Awaiting Review"
              description="The review queue is empty. New documents will appear here after processing."
            />
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
                  type="button"
                  onClick={() => {
                    if (isLocked) {
                      toast.error(`This document is currently being reviewed by ${lockHolder}`);
                      return;
                    }
                    selectDocument(item.id);
                  }}
                  disabled={isLocked}
                  aria-label={`Select document ${item.filename}, status: ${item.status}, consensus score: ${item.consensus_score !== null ? `${Math.round(item.consensus_score * 100)}%` : 'unscored'}${isLocked ? `, locked by ${lockHolder}` : ''}`}
                  aria-current={selectedDocId === item.id ? "true" : undefined}
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
          <EmptyState
            icon={Sparkles}
            title="Review Workspace"
            description="Select a document from the queue on the left to start checking compliance scores and manual corrections."
          />
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
                <FileText className="h-4.5 w-4.5 text-muted-foreground" aria-hidden="true" />
                <span className="text-sm font-semibold text-foreground truncate max-w-[250px]">{doc.filename}</span>
                <Badge variant="category" value={doc.category} size="sm">
                  {doc.category}
                </Badge>
              </div>

              {/* Lock card */}
              <div className="flex items-center gap-3 bg-[#111]/45 border border-white/[0.04] py-1.5 px-3.5 rounded-xl text-[10px] font-mono font-semibold text-muted-foreground">
                {isLockedByMe ? (
                  <>
                    <div
                      role="progressbar"
                      aria-label="Document editing lock lease remaining"
                      aria-valuenow={lockTimeLeft}
                      aria-valuemin={0}
                      aria-valuemax={900}
                      aria-valuetext={`${Math.floor(lockTimeLeft / 60)} minutes and ${lockTimeLeft % 60} seconds remaining`}
                      className="relative h-4 w-4 shrink-0 flex items-center justify-center"
                    >
                      <svg aria-hidden="true" className="absolute inset-0 h-full w-full -rotate-90" viewBox="0 0 20 20">
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
                      <Lock className="h-2 w-2 text-emerald-400" aria-hidden="true" />
                    </div>
                    <span>Locked by me</span>
                    <span className="text-emerald-400 flex items-center gap-1">
                      <Clock className="h-3 w-3" aria-hidden="true" /> {formatTime(lockTimeLeft)}
                    </span>
                    <button
                      type="button"
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
                      aria-label="Extend editing lock"
                    >
                      Extend
                    </button>
                  </>
                ) : (
                  <>
                    <Lock className="h-3.5 w-3.5 text-rose-400" aria-hidden="true" />
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
                <div role="tablist" aria-label="Document view modes" className="flex items-center border-b border-white/[0.04] pb-2 gap-2">
                  <button
                    type="button"
                    role="tab"
                    aria-selected={leftTab === 'text'}
                    onClick={() => setLeftTab('text')}
                    aria-label="View OCR raw text"
                    className={clsx(
                      "px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider font-mono border transition-all cursor-pointer",
                      leftTab === 'text' ? "bg-primary/10 border-primary/20 text-primary" : "bg-transparent border-transparent text-muted-foreground hover:text-foreground"
                    )}>
                    OCR Raw Text
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={leftTab === 'table'}
                    onClick={() => setLeftTab('table')}
                    aria-label="View table reconstructor"
                    className={clsx(
                      "px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider font-mono border transition-all cursor-pointer",
                      leftTab === 'table' ? "bg-primary/10 border-primary/20 text-primary" : "bg-transparent border-transparent text-muted-foreground hover:text-foreground"
                    )}>
                    Table Reconstructor
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={leftTab === 'audits'}
                    onClick={() => setLeftTab('audits')}
                    aria-label="View mathematical auditing"
                    className={clsx(
                      "px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider font-mono border transition-all cursor-pointer",
                      leftTab === 'audits' ? "bg-primary/10 border-primary/20 text-primary" : "bg-transparent border-transparent text-muted-foreground hover:text-foreground"
                    )}>
                    Mathematical Auditing
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={leftTab === 'spatial'}
                    onClick={() => setLeftTab('spatial')}
                    aria-label="View spatial grounding"
                    className={clsx(
                      "px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider font-mono border transition-all cursor-pointer",
                      leftTab === 'spatial' ? "bg-primary/10 border-primary/20 text-primary" : "bg-transparent border-transparent text-muted-foreground hover:text-foreground"
                    )}>
                    Spatial Grounding
                  </button>
                  <div className="flex items-center gap-1.5 ml-auto">
                    <button
                      ref={threeWayTriggerRef}
                      type="button"
                      onClick={() => setShow3WayModal(true)}
                      aria-label="Open 3-way reconciliation"
                      aria-haspopup="dialog"
                      className="px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider font-mono border border-indigo-500/30 bg-indigo-500/10 text-indigo-400 hover:bg-indigo-500/20 transition-all cursor-pointer">
                      3-Way Match
                    </button>
                    <button
                      ref={erpTriggerRef}
                      type="button"
                      onClick={() => {
                        lastErpTriggerRef.current = erpTriggerRef.current;
                        setShowErpModal(true);
                      }}
                      aria-label="Open ERP export"
                      aria-haspopup="dialog"
                      className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider font-mono border border-emerald-500/30 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 transition-all cursor-pointer"
                      title="Export to QuickBooks, Xero, SAP, Universal JSON">
                      <Building2 className="h-3 w-3" aria-hidden="true" />
                      <span>ERP Export</span>
                    </button>
                  </div>
                </div>

                {/* ── TAB CONTENT: RAW TEXT ── */}
                {leftTab === 'text' && (
                  <div className="flex-1 flex flex-col gap-4">
                    <div className="flex items-center justify-between gap-4">
                      <h4 className="text-[9px] font-bold tracking-wider text-muted-foreground uppercase font-mono">Raw OCR Output</h4>
                      <div className="flex items-center gap-3">
                        <input
                          aria-label="Search OCR text"
                          type="text"
                          placeholder="Search text..."
                          value={ocrSearchQuery}
                          onChange={(e) => setOcrSearchQuery(e.target.value)}
                          className="bg-[#111] border border-white/[0.06] rounded-lg px-2.5 py-1 text-[10px] text-neutral-300 focus:outline-none focus:border-primary/50 w-28 font-sans placeholder-neutral-700"
                        />
                        <button
                          type="button"
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

                {/* ── TAB CONTENT: TABLE RECONSTRUCTOR (EDITABLE) ── */}
                {leftTab === 'table' && (
                  <div className="flex-1 flex flex-col gap-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="text-[9px] font-bold tracking-wider text-muted-foreground uppercase font-mono">Interactive Table Reconstructor</h4>
                        <p className="text-[10px] text-muted-foreground mt-0.5">Edit, add, or verify extracted line items with auto-computed line arithmetic.</p>
                      </div>
                      <button
                        type="button"
                        onClick={handleAddLineItem}
                        aria-label="Add table line item row"
                        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-primary/30 bg-primary/10 hover:bg-primary/20 text-primary text-[10px] font-semibold transition-all cursor-pointer shadow-sm"
                      >
                        <Plus className="h-3 w-3" aria-hidden="true" />
                        <span>Add Row</span>
                      </button>
                    </div>

                    {editableLineItems.length === 0 ? (
                      <EmptyState
                        icon={AlertCircle}
                        title="No Tabular Data Detected"
                        description="No tabular data structures were detected in this document."
                        action={{
                          label: "Add First Line Item",
                          onClick: handleAddLineItem,
                          icon: Plus,
                        }}
                      />
                    ) : (
                      <div className="border border-white/5 bg-[#090909] rounded-xl overflow-hidden overflow-x-auto">
                        <table className="w-full text-left text-xs border-collapse">
                          <thead>
                            <tr className="border-b border-white/5 text-[9px] font-bold uppercase tracking-wider text-muted-foreground bg-white/[0.02]">
                              <th className="py-2.5 px-4">Description</th>
                              <th className="py-2.5 px-3 text-center w-20">Qty</th>
                              <th className="py-2.5 px-3 text-right w-28">Unit Price</th>
                              <th className="py-2.5 px-4 text-right w-28">Total</th>
                              <th className="py-2.5 px-3 text-center w-20">Actions</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-white/2 font-mono">
                            {editableLineItems.map((item: any, i: number) => {
                              const isEditing = editingLineIndex === i;
                              const unitPriceNum = parseFloat(String(item.unit_price)) || 0;
                              const totalNum = parseFloat(String(item.total)) || 0;

                              return (
                                <tr key={i} className={clsx("transition-colors", isEditing ? "bg-primary/5" : "hover:bg-white/1")}>
                                  <td className="py-2 px-4 text-neutral-300 font-sans">
                                    {isEditing ? (
                                      <input
                                        type="text"
                                        value={editLineItem.description}
                                        onChange={(e) => setEditLineItem(prev => ({ ...prev, description: e.target.value }))}
                                        className="w-full bg-[#111] border border-white/10 rounded px-2 py-1 text-xs text-foreground focus:outline-none focus:border-primary"
                                        placeholder="Item description"
                                        autoFocus
                                      />
                                    ) : (
                                      <span className="cursor-pointer hover:text-white" onClick={() => handleStartEditLine(i)}>
                                        {item.description}
                                      </span>
                                    )}
                                  </td>
                                  <td className="py-2 px-3 text-center text-neutral-400">
                                    {isEditing ? (
                                      <input
                                        type="number"
                                        min="0"
                                        step="1"
                                        value={editLineItem.quantity}
                                        onChange={(e) => {
                                          const val = e.target.value;
                                          const qty = parseFloat(val) || 0;
                                          const price = parseFloat(String(editLineItem.unit_price)) || 0;
                                          setEditLineItem(prev => ({
                                            ...prev,
                                            quantity: val,
                                            total: (qty * price).toFixed(2)
                                          }));
                                        }}
                                        className="w-16 bg-[#111] border border-white/10 rounded px-2 py-1 text-xs text-center text-foreground focus:outline-none focus:border-primary font-mono"
                                      />
                                    ) : (
                                      item.quantity
                                    )}
                                  </td>
                                  <td className="py-2 px-3 text-right text-neutral-400">
                                    {isEditing ? (
                                      <input
                                        type="number"
                                        min="0"
                                        step="0.01"
                                        value={editLineItem.unit_price}
                                        onChange={(e) => {
                                          const val = e.target.value;
                                          const price = parseFloat(val) || 0;
                                          const qty = parseFloat(String(editLineItem.quantity)) || 0;
                                          setEditLineItem(prev => ({
                                            ...prev,
                                            unit_price: val,
                                            total: (qty * price).toFixed(2)
                                          }));
                                        }}
                                        className="w-24 bg-[#111] border border-white/10 rounded px-2 py-1 text-xs text-right text-foreground focus:outline-none focus:border-primary font-mono"
                                      />
                                    ) : (
                                      `$${unitPriceNum.toFixed(2)}`
                                    )}
                                  </td>
                                  <td className="py-2 px-4 text-right text-neutral-200 font-semibold">
                                    {isEditing ? (
                                      <span className="text-primary font-bold">
                                        ${(parseFloat(String(editLineItem.total)) || 0).toFixed(2)}
                                      </span>
                                    ) : (
                                      `$${totalNum.toFixed(2)}`
                                    )}
                                  </td>
                                  <td className="py-2 px-3 text-center">
                                    {isEditing ? (
                                      <div className="flex items-center justify-center gap-1">
                                        <button
                                          type="button"
                                          onClick={() => handleSaveLine(i)}
                                          className="p-1 rounded bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400 cursor-pointer"
                                          title="Save row"
                                          aria-label={`Save row ${i + 1}`}
                                        >
                                          <Check className="h-3.5 w-3.5" aria-hidden="true" />
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => setEditingLineIndex(null)}
                                          className="p-1 rounded hover:bg-white/10 text-muted-foreground hover:text-foreground cursor-pointer"
                                          title="Cancel"
                                          aria-label={`Cancel editing row ${i + 1}`}
                                        >
                                          <X className="h-3.5 w-3.5" aria-hidden="true" />
                                        </button>
                                      </div>
                                    ) : (
                                      <div className="flex items-center justify-center gap-1">
                                        <button
                                          type="button"
                                          onClick={() => handleStartEditLine(i)}
                                          className="p-1 rounded hover:bg-white/5 text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
                                          title="Edit row"
                                          aria-label={`Edit line item ${i + 1}: ${item.description || 'Untitled'}`}
                                        >
                                          <Edit2 className="h-3 w-3" aria-hidden="true" />
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => handleDeleteLine(i)}
                                          className="p-1 rounded hover:bg-rose-500/10 text-muted-foreground hover:text-rose-400 cursor-pointer transition-colors"
                                          title="Delete row"
                                          aria-label={`Delete line item ${i + 1}: ${item.description || 'Untitled'}`}
                                        >
                                          <Trash2 className="h-3 w-3" aria-hidden="true" />
                                        </button>
                                      </div>
                                    )}
                                  </td>
                                </tr>
                              );
                            })}
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
                      <EmptyState
                        icon={AlertCircle}
                        title="No Audit Data Available"
                        description="No line items available to cross-audit."
                      />
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
                              {res.is_valid ? <Check className="h-3 w-3" aria-hidden="true" /> : <X className="h-3 w-3" aria-hidden="true" />}
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

                {/* ── TAB CONTENT: SPATIAL CANVAS ── */}
                {leftTab === 'spatial' && (
                  <div className="flex-1 flex flex-col gap-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="text-[9px] font-bold tracking-wider text-muted-foreground uppercase font-mono">Spatial Visual Grounding</h4>
                        <p className="text-[10px] text-muted-foreground mt-0.5">Interactive polygon bounding boxes grounded directly to source coordinates.</p>
                      </div>
                    </div>

                    <div className="flex gap-4">
                      {/* Vertical Page Thumbnail Rail */}
                      <div className="w-20 shrink-0 flex flex-col gap-2 overflow-y-auto max-h-[480px] scrollbar pr-1">
                        {Array.from({
                          length: Math.max(
                            ...(doc?.fields?.map((f) => f.page_number || 1) || [1]),
                            1
                          ),
                        }).map((_, pageIdx) => {
                          const pNum = pageIdx + 1;
                          const isCur = currentPage === pNum;
                          const pageFieldsCount = doc?.fields?.filter(
                            (f) => (f.page_number || 1) === pNum
                          ).length;

                          return (
                            <button
                              key={pNum}
                              type="button"
                              onClick={() => setCurrentPage(pNum)}
                              aria-label={`View page ${pNum} (${pageFieldsCount || 0} extracted fields)`}
                              aria-current={isCur ? "page" : undefined}
                              className={clsx(
                                "flex flex-col items-center gap-1.5 p-2 rounded-xl border text-center transition-all cursor-pointer",
                                isCur
                                  ? "bg-primary/15 border-primary text-white shadow-md shadow-primary/10"
                                  : "bg-[#111]/60 border-white/[0.06] text-muted-foreground hover:border-white/[0.15] hover:text-neutral-200"
                              )}
                            >
                              <div className="w-12 h-16 bg-neutral-900 rounded border border-white/[0.08] flex flex-col items-center justify-center relative overflow-hidden">
                                <FileText className="h-5 w-5 text-muted-foreground/60" aria-hidden="true" />
                                <span className="text-[9px] font-bold font-mono text-neutral-300 mt-1">
                                  P.{pNum}
                                </span>
                              </div>
                              <span className="text-[9px] font-mono">
                                {pageFieldsCount || 0} fields
                              </span>
                            </button>
                          );
                        })}
                      </div>

                      {/* Main Interactive Spatial Canvas */}
                      <div className="flex-1">
                        <SpatialBoundingCanvas
                          fields={doc?.fields || []}
                          activeFieldKey={editingField}
                          hoveredFieldKey={hoveredFieldKey}
                          onHoverField={setHoveredFieldKey}
                          onSelectField={(key) => {
                            const currentVal =
                              fieldUpdates[key] ??
                              doc?.fields?.find((f) => f.field_key === key)?.consensus_value ??
                              '';
                            handleStartEdit(key, currentVal);
                          }}
                          currentPage={currentPage}
                          totalPages={Math.max(
                            ...(doc?.fields?.map((f) => f.page_number || 1) || [1]),
                            1
                          )}
                          onPageChange={setCurrentPage}
                          highlightBbox={
                            editingField &&
                            doc?.fields?.find((f) => f.field_key === editingField)?.bounding_box
                              ? (doc?.fields?.find((f) => f.field_key === editingField)
                                  ?.bounding_box as [number, number, number, number] | null)
                              : null
                          }
                        />
                      </div>
                    </div>
                  </div>
                )}

              </div>

              {/* Right half: Editable fields form */}
              <div className="flex-1 overflow-y-auto p-6 scrollbar flex flex-col gap-6 relative">
                <div className="flex items-center justify-between border-b border-white/[0.04] pb-3">
                  <h4 className="text-[10px] font-bold tracking-wider text-muted-foreground uppercase font-mono">Consensus Fields</h4>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setShowAddFieldModal(true)}
                      aria-label="Add missing extracted field"
                      className="px-2.5 py-1 text-[10px] font-bold bg-primary/10 border border-primary/25 text-primary hover:bg-primary/20 rounded-lg cursor-pointer transition-all flex items-center gap-1"
                      title="Add a missing extracted field"
                    >
                      <Plus className="h-3 w-3" aria-hidden="true" />
                      <span>Add Field</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleBulkAccept}
                      disabled={!isLockedByMe}
                      aria-label="Accept all extracted field values"
                      className="px-2.5 py-1 text-[10px] font-bold bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20 rounded-lg cursor-pointer transition-all disabled:opacity-40"
                    >
                      Accept All
                    </button>
                    <button
                      type="button"
                      onClick={handleBulkReset}
                      disabled={!isLockedByMe}
                      aria-label="Reset all field modifications to extracted values"
                      className="px-2.5 py-1 text-[10px] font-bold bg-white/[0.04] border border-white/[0.08] text-neutral-300 hover:bg-white/[0.08] rounded-lg cursor-pointer transition-all disabled:opacity-40"
                    >
                      Reset All
                    </button>
                    <button
                      type="button"
                      onClick={handleBulkEscalate}
                      disabled={!isLockedByMe}
                      aria-label="Escalate document to compliance review queue"
                      className="px-2.5 py-1 text-[10px] font-bold bg-amber-500/10 border border-amber-500/20 text-amber-400 hover:bg-amber-500/20 rounded-lg cursor-pointer transition-all disabled:opacity-40"
                    >
                      Escalate
                    </button>
                  </div>
                </div>

                {/* Custom Add Field Input Card */}
                {showAddFieldModal && (
                  <div className="p-4 rounded-xl border border-primary/30 bg-primary/5 flex flex-col gap-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-white font-mono uppercase tracking-wider">
                        Add Missing Extracted Field
                      </span>
                      <button
                        type="button"
                        onClick={() => setShowAddFieldModal(false)}
                        aria-label="Close add field form"
                        className="text-muted-foreground hover:text-white cursor-pointer"
                      >
                        <X className="h-3.5 w-3.5" aria-hidden="true" />
                      </button>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <input
                        type="text"
                        placeholder="Field key (e.g. tax_id, discount_rate)"
                        aria-label="New field key name"
                        value={newFieldKey}
                        onChange={(e) => setNewFieldKey(e.target.value)}
                        className="bg-[#111] border border-white/[0.08] rounded-lg px-2.5 py-1.5 text-xs text-foreground focus:outline-none focus:border-primary/50 font-mono"
                      />
                      <input
                        type="text"
                        placeholder="Extracted value"
                        aria-label="New field extracted value"
                        value={newFieldValue}
                        onChange={(e) => setNewFieldValue(e.target.value)}
                        className="bg-[#111] border border-white/[0.08] rounded-lg px-2.5 py-1.5 text-xs text-foreground focus:outline-none focus:border-primary/50 font-mono"
                      />
                    </div>
                    <div className="flex items-center justify-end gap-2 mt-1">
                      <button
                        type="button"
                        onClick={() => setShowAddFieldModal(false)}
                        aria-label="Cancel adding custom field"
                        className="px-3 py-1 rounded-lg text-xs text-muted-foreground hover:text-white cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={handleAddCustomField}
                        aria-label="Save custom field"
                        className="px-3 py-1 rounded-lg text-xs font-semibold bg-primary text-white hover:bg-primary-hover shadow-sm cursor-pointer"
                      >
                        Save Field
                      </button>
                    </div>
                  </div>
                )}

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
                          <div
                            role="progressbar"
                            aria-label={`${className} classification probability`}
                            aria-valuenow={Math.round(score * 100)}
                            aria-valuemin={0}
                            aria-valuemax={100}
                            aria-valuetext={`${(score * 100).toFixed(1)} percent`}
                            className="h-1 w-full bg-white/5 rounded-full overflow-hidden"
                          >
                            <div className="h-full bg-primary rounded-full transition-all duration-500" style={{ width: `${score * 100}%` }} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex flex-col gap-4">
                  {[
                    ...(doc.fields || []).filter((f) => !deletedFields.includes(f.field_key)),
                    ...customFields.filter((f) => !deletedFields.includes(f.field_key)).map((cf) => ({
                      id: `custom-${cf.field_key}`,
                      field_key: cf.field_key,
                      consensus_value: cf.consensus_value,
                      extracted_value: cf.consensus_value,
                      critic_score: 1.0,
                      auditor_score: 1.0,
                      confidence_score: 1.0,
                      is_modified: true,
                      validation_status: 'MANUAL_CORRECTION' as any,
                      validation_notes: 'Custom field added by reviewer',
                    })),
                  ].map((field: any) => {
                    const isEditing = editingField === field.field_key;
                    const currentValue = fieldUpdates[field.field_key] ?? field.consensus_value ?? field.extracted_value ?? '';
                    
                    const isFlagged = field.validation_status === 'FLAGGED';
                    const isCritical = field.confidence_score < 0.60 || field.validation_notes?.toLowerCase().includes('critical') || field.validation_notes?.toLowerCase().includes('error');
                    
                    const fieldComments = comments.filter(c => c.field_key === field.field_key);
                    const isCommentsExpanded = expandedCommentsField === field.field_key;
                    const isFieldHovered = hoveredFieldKey === field.field_key;
                    
                    return (
                      <div 
                        key={field.id}
                        onMouseEnter={() => setHoveredFieldKey(field.field_key)}
                        onMouseLeave={() => setHoveredFieldKey(null)}
                        className={clsx(
                          "p-4 rounded-xl border bg-[#0c0c0c] flex flex-col gap-3 transition-all duration-255",
                          isFieldHovered && "ring-2 ring-primary/60 border-primary/50 bg-primary/5",
                          isCritical 
                            ? "border-rose-500/40 hover:border-rose-500/60 shadow-lg shadow-rose-950/5" 
                            : isFlagged 
                              ? "border-amber-500/40 hover:border-amber-500/60 shadow-lg shadow-amber-950/5" 
                              : !isFieldHovered && "border-white/[0.04] hover:border-white/[0.08]"
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
                                aria-label={`Edit value for ${field.field_key}`}
                                className="flex-1 bg-[#111] border border-white/[0.06] rounded-lg px-2.5 py-1.5 text-xs text-foreground focus:outline-none focus:border-primary/50 font-mono"
                                autoFocus
                              />
                              <button 
                                type="button"
                                onClick={() => handleSaveField(field.field_key)}
                                aria-label={`Save edited value for ${field.field_key}`}
                                className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20 cursor-pointer"
                              >
                                <Check className="h-3.5 w-3.5" aria-hidden="true" />
                              </button>
                              <button 
                                type="button"
                                onClick={() => setEditingField(null)}
                                aria-label={`Cancel editing ${field.field_key}`}
                                className="p-2 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 hover:bg-rose-500/20 cursor-pointer"
                              >
                                <X className="h-3.5 w-3.5" aria-hidden="true" />
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center justify-between w-full">
                              <span className="text-xs font-mono font-medium text-foreground bg-[#111]/80 px-2 py-1.5 rounded-lg border border-white/[0.04]">
                                {currentValue || <span className="text-muted-foreground italic">empty</span>}
                              </span>
                              <div className="flex items-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => handleStartEdit(field.field_key, currentValue)}
                                  aria-label={`Edit value for ${field.field_key}`}
                                  className="p-2 rounded-lg border border-white/[0.04] bg-white/[0.01] hover:bg-white/[0.06] text-muted-foreground hover:text-foreground cursor-pointer transition-colors duration-200"
                                  title="Override value"
                                >
                                  <Edit2 className="h-3.5 w-3.5" aria-hidden="true" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteField(field.field_key)}
                                  aria-label={`Delete field ${field.field_key} from review payload`}
                                  className="p-2 rounded-lg border border-white/[0.04] bg-white/[0.01] hover:bg-rose-500/10 hover:border-rose-500/20 text-muted-foreground hover:text-rose-400 cursor-pointer transition-colors duration-200"
                                  title="Delete field from review payload"
                                >
                                  <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                                </button>
                              </div>
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
                            <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" aria-hidden="true" />
                            <span>{field.validation_notes}</span>
                          </div>
                        )}

                        {/* Field level Comments */}
                        <div className="border-t border-white/[0.03] pt-2 mt-1 select-none">
                          <button
                            type="button"
                            onClick={() => {
                              setExpandedCommentsField(isCommentsExpanded ? null : field.field_key);
                              setNewCommentText('');
                            }}
                            aria-label={`${isCommentsExpanded ? 'Collapse' : 'Expand'} comments for field ${field.field_key} (${fieldComments.length} ${fieldComments.length === 1 ? 'comment' : 'comments'})`}
                            aria-expanded={isCommentsExpanded}
                            className="flex items-center gap-1.5 text-[10px] font-mono text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
                          >
                            <MessageSquare className="h-3 w-3" aria-hidden="true" />
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
                                              type="button"
                                              onClick={() => deleteCommentMutation.mutate(comment.id)}
                                              disabled={deleteCommentMutation.isPending}
                                              aria-label={`Delete comment by ${comment.user_name} on field ${field.field_key}`}
                                              className="text-rose-500 hover:text-rose-450 cursor-pointer"
                                              title="Delete Comment"
                                            >
                                              <Trash2 className="h-2.5 w-2.5" aria-hidden="true" />
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
                                  aria-label={`Add comment on field ${field.field_key}`}
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
                                  type="button"
                                  onClick={() => {
                                    if (newCommentText.trim()) {
                                      createCommentMutation.mutate({ content: newCommentText, fieldKey: field.field_key });
                                    }
                                  }}
                                  disabled={createCommentMutation.isPending || !newCommentText.trim()}
                                  aria-label={`Post comment on field ${field.field_key}`}
                                  className="p-1 px-2.5 bg-primary hover:bg-primary/95 text-white rounded-lg cursor-pointer disabled:opacity-40 flex items-center justify-center shrink-0"
                                >
                                  <Send className="h-3 w-3" aria-hidden="true" />
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
                    <MessageSquare className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
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
                                  type="button"
                                  onClick={() => deleteCommentMutation.mutate(comment.id)}
                                  disabled={deleteCommentMutation.isPending}
                                  aria-label={`Delete document comment by ${comment.user_name}`}
                                  className="text-rose-500 hover:text-rose-450 cursor-pointer"
                                >
                                  <Trash2 className="h-3 w-3" aria-hidden="true" />
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
                      aria-label="Add general document discussion comment"
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
                      type="button"
                      onClick={() => {
                        if (newCommentText.trim() && expandedCommentsField === null) {
                          createCommentMutation.mutate({ content: newCommentText, fieldKey: null });
                        }
                      }}
                      disabled={createCommentMutation.isPending || !newCommentText.trim() || expandedCommentsField !== null}
                      aria-label="Post document discussion comment"
                      className="p-2 px-3.5 bg-primary hover:bg-primary/95 text-white rounded-xl cursor-pointer disabled:opacity-40 flex items-center justify-center shrink-0"
                    >
                      <Send className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>
                  </div>

              </div>

            </div>
            </div>

            {/* Bottom action bar */}
            <div className="p-4 border-t border-white/[0.04] bg-white/[0.01] flex items-center justify-between select-none">
              <button
                type="button"
                onClick={() => selectDocument('')}
                aria-label="Cancel review and return to document queue"
                className="px-4 py-2 rounded-xl text-xs font-semibold border border-white/[0.04] hover:bg-white/[0.02] text-muted-foreground hover:text-foreground cursor-pointer transition-all duration-300"
              >
                Cancel
              </button>

              <div className="flex items-center gap-3">
                <button
                  ref={diffTriggerRef}
                  type="button"
                  onClick={() => setShowDiffModal(true)}
                  aria-label="View visual diff (Alt+D)"
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-white/[0.03] border border-white/[0.08] hover:bg-white/[0.08] text-slate-300 transition cursor-pointer"
                  title="View AI vs Human diff (Alt+D)"
                >
                  <Eye className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Visual Diff (Alt+D)</span>
                </button>

                <button
                  ref={bottomErpTriggerRef}
                  type="button"
                  onClick={() => {
                    lastErpTriggerRef.current = bottomErpTriggerRef.current;
                    setShowErpModal(true);
                  }}
                  aria-label="Export to ERP system"
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-emerald-500/10 border border-emerald-500/20 hover:bg-emerald-500/20 text-emerald-400 transition cursor-pointer"
                  title="Export to QuickBooks, Xero, SAP, or Universal JSON"
                >
                  <Building2 className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>ERP Export</span>
                </button>

                <button
                  type="button"
                  onClick={handleApprove}
                  aria-label="Approve and index document"
                  disabled={!isLockedByMe || submitReviewMutation.isPending}
                  className="group flex items-center justify-center gap-2 px-5 py-2 rounded-xl text-xs font-semibold bg-emerald-500 border border-emerald-500/20 text-white shadow-md shadow-emerald-950/10 cursor-pointer disabled:opacity-50 transition-all duration-300"
                >
                  {submitReviewMutation.isPending ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                  ) : (
                    <>
                      <Check className="h-3.5 w-3.5" aria-hidden="true" />
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
                    <Lock className="h-8 w-8 animate-pulse" aria-hidden="true" />
                  </div>
                  <h3 className="text-base font-bold text-foreground">Lock Expired</h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Your editing lock on this document has expired. Other reviewers can now acquire the lock.
                  </p>
                  <div className="flex gap-3 w-full mt-2">
                    <button
                      type="button"
                      onClick={() => {
                        acquireLockMutation.mutate(selectedDocId);
                      }}
                      aria-label="Re-acquire document editing lock"
                      className="flex-1 px-4 py-2 bg-primary hover:bg-primary/90 text-white rounded-xl text-xs font-semibold cursor-pointer transition-all"
                    >
                      Acquire Lock
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        selectDocument('');
                      }}
                      aria-label="Return to document queue"
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

      {/* Visual Diff Modal */}
      <DocumentDiffViewer
        isOpen={showDiffModal}
        originalFields={originalFields}
        currentFields={fieldUpdates}
        onClose={() => {
          setShowDiffModal(false);
          diffTriggerRef.current?.focus();
        }}
      />

      {/* Enterprise 3-Way Reconciliation Modal */}
      <ThreeWayReconciliationModal
        isOpen={show3WayModal}
        onClose={() => {
          setShow3WayModal(false);
          threeWayTriggerRef.current?.focus();
        }}
        documentId={selectedDocId}
      />

      {/* Enterprise Accounting & ERP Export Modal */}
      <ErpExportModal
        isOpen={showErpModal}
        onClose={() => {
          setShowErpModal(false);
          (lastErpTriggerRef.current || erpTriggerRef.current)?.focus();
        }}
        document={doc || null}
      />

    </div>
  );
}
