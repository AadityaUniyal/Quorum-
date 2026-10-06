'use client';

import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { toast } from 'react-hot-toast';
import { Badge } from '@/components/ui/Badge';
import { ConfidenceBar } from '@/components/ui/ConfidenceBar';
import { TableRowSkeleton } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { IOSSegmentedControl } from '@/components/ui/IOSSegmentedControl';
import { IOSDocumentDropzone } from '@/components/ui/IOSDocumentDropzone';
import { iosAudio } from '@/lib/iosAudio';
import clsx from 'clsx';
import { 
  UploadCloud, 
  FileText, 
  Trash2, 
  RefreshCw, 
  Filter, 
  AlertCircle,
  Eye, 
  Loader2,
  X,
  Edit2,
  Check,
  FolderOpen,
  CheckSquare,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  Search
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import { BatchUploadDrawer, BatchUploadTask } from '@/components/documents/BatchUploadDrawer';

export default function DocumentsPage() {
  const queryClient = useQueryClient();
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [selectedStatus, setSelectedStatus] = useState<string>('');
  const [batchTasks, setBatchTasks] = useState<BatchUploadTask[]>([]);
  const [showBatchDrawer, setShowBatchDrawer] = useState(false);
  const [viewMode, setViewMode] = useState<'table' | 'grid'>('table');
  const [sortBy, setSortBy] = useState<'date' | 'confidence' | 'name'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [searchFilter, setSearchFilter] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  
  // Selection and inline editing state
  const [selectedDocIds, setSelectedDocIds] = useState<string[]>([]);
  const [editingDocId, setEditingDocId] = useState<string | null>(null);
  const [editingDocName, setEditingDocName] = useState<string>('');

  // Drawer state
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);
  const [pipelineEvents, setPipelineEvents] = useState<{ stage: string; message: string }[]>([]);

  // Pagination state
  const [page, setPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(50);

  // Fetch Documents with pagination
  const { data: documents, isLoading } = useQuery({
    queryKey: ['documents', selectedCategory, selectedStatus, page, pageSize],
    queryFn: () => api.listDocuments(selectedCategory || undefined, selectedStatus || undefined, (page - 1) * pageSize, pageSize),
    refetchInterval: 10000,
    refetchIntervalInBackground: true,
  });

  // Real-time SSE Document Processing Pipeline
  useEffect(() => {
    if (!selectedDocId) {
      setPipelineEvents([]);
      return;
    }

    const currentDoc = documents?.find(d => d.id === selectedDocId);
    if (!currentDoc || (currentDoc.status !== 'INGESTED' && currentDoc.status !== 'PROCESSING' && currentDoc.status !== 'AWAITING_REVIEW')) {
      setPipelineEvents([]);
      return;
    }

    let es: EventSource | null = null;
    try {
      es = api.streamDocumentPipeline(selectedDocId);
      
      es.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.message) {
            setPipelineEvents((prev) => {
              if (prev.some(e => e.message === data.message && e.stage === data.stage)) {
                return prev;
              }
              return [...prev, { stage: data.stage, message: data.message }];
            });
          }
          if (data.stage === 'COMPLETED' || data.stage === 'FAILED' || data.stage === 'PROCESSED') {
            queryClient.invalidateQueries({ queryKey: ['documents'] });
            queryClient.invalidateQueries({ queryKey: ['documentDetails', selectedDocId] });
            es?.close();
          }
        } catch {
          // parse error
        }
      };

      es.onerror = () => {
        es?.close();
      };
    } catch {
      console.error("SSE connection failed");
    }

    return () => {
      if (es) {
        es.close();
      }
    };
  }, [selectedDocId, documents, queryClient]);

  const processedDocs = React.useMemo(() => {
    if (!documents) return [];
    let list = [...documents];
    if (searchFilter.trim()) {
      const q = searchFilter.toLowerCase();
      list = list.filter(d => d.filename.toLowerCase().includes(q));
    }
    list.sort((a, b) => {
      let valA: any = a.created_at;
      let valB: any = b.created_at;
      if (sortBy === 'confidence') {
        valA = a.consensus_score ?? 0;
        valB = b.consensus_score ?? 0;
      } else if (sortBy === 'name') {
        valA = a.filename;
        valB = b.filename;
      }
      if (typeof valA === 'string') {
        return sortOrder === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
      } else {
        return sortOrder === 'asc' ? valA - valB : valB - valA;
      }
    });
    return list;
  }, [documents, searchFilter, sortBy, sortOrder]);

  // Fetch Full Document Details when selected
  const { data: fullDoc, isLoading: isDetailsLoading } = useQuery({
    queryKey: ['documentDetails', selectedDocId],
    queryFn: () => api.getDocument(selectedDocId!),
    enabled: !!selectedDocId,
    refetchInterval: selectedDocId ? 8000 : false,
    refetchIntervalInBackground: true,
  });

  // Reprocess Mutation
  const reprocessMutation = useMutation({
    mutationFn: api.reprocessDocument,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents'] });
      queryClient.invalidateQueries({ queryKey: ['documentDetails', selectedDocId] });
      iosAudio.playSuccess();
      toast.success('Document re-processing queued');
    },
    onError: (err: Error) => {
      iosAudio.playError();
      toast.error(err.message || 'Failed to queue re-processing');
    }
  });

  // Delete Mutation
  const deleteMutation = useMutation({
    mutationFn: api.deleteDocument,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents'] });
      setSelectedDocId(null);
      iosAudio.playSuccess();
      toast.success('Document deleted successfully');
    },
    onError: (err: Error) => {
      iosAudio.playError();
      toast.error(err.message || 'Failed to delete document');
    }
  });

  // Update Document Mutation (Inline rename / category change)
  const updateDocMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: { filename?: string; category?: string } }) =>
      api.updateDocument(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents'] });
      queryClient.invalidateQueries({ queryKey: ['documentDetails', selectedDocId] });
      setEditingDocId(null);
      iosAudio.playSuccess();
      toast.success('Document updated successfully');
    },
    onError: (err: Error) => {
      iosAudio.playError();
      toast.error(err.message || 'Failed to update document');
    }
  });

  // Bulk Delete Mutation
  const bulkDeleteMutation = useMutation({
    mutationFn: (ids: string[]) => api.bulkDeleteDocuments(ids),
    onSuccess: (res: any) => {
      queryClient.invalidateQueries({ queryKey: ['documents'] });
      setSelectedDocIds([]);
      iosAudio.playSuccess();
      toast.success(res?.message || 'Selected documents deleted');
    },
    onError: (err: Error) => {
      iosAudio.playError();
      toast.error(err.message || 'Failed to delete selected documents');
    }
  });

  // Dropzone File Upload Handler
  const handleDropzoneAccepted = async (acceptedFiles: File[]) => {
    if (!acceptedFiles || acceptedFiles.length === 0) return;

    const newTasks: BatchUploadTask[] = acceptedFiles.map((file, i) => ({
      id: `${file.name}-${Date.now()}-${i}`,
      name: file.name,
      size: file.size,
      status: 'UPLOADING',
      progress: 30,
      documentId: null,
    }));

    setBatchTasks((prev) => [...newTasks, ...prev]);
    setShowBatchDrawer(true);

    const progressTimer = setInterval(() => {
      setBatchTasks((prev) =>
        prev.map((t) => {
          if (newTasks.some((nt) => nt.id === t.id) && t.status === 'UPLOADING') {
            return { ...t, progress: Math.min(t.progress + 15, 85) };
          }
          return t;
        })
      );
    }, 400);

    try {
      const response = await api.batchUploadDocuments(acceptedFiles);
      clearInterval(progressTimer);

      setBatchTasks((prev) =>
        prev.map((task) => {
          const matched = response.items?.find((it) => it.filename === task.name);
          if (matched) {
            return {
              ...task,
              progress: 100,
              status: matched.error ? 'FAILED' : (matched.status as any || 'AWAITING_REVIEW'),
              documentId: matched.document_id,
              category: matched.category,
              error: matched.error,
            };
          }
          return task;
        })
      );

      if (response.failed > 0) {
        toast.error(`Batch upload: ${response.successful} processed, ${response.failed} failed`);
      } else {
        toast.success(`Batch upload: All ${response.successful} documents processed successfully!`);
      }
    } catch (err: any) {
      clearInterval(progressTimer);
      setBatchTasks((prev) =>
        prev.map((task) =>
          newTasks.some((nt) => nt.id === task.id)
            ? { ...task, status: 'FAILED', error: err.message || 'Upload failed' }
            : task
        )
      );
      toast.error(`Batch upload failed: ${err.message || 'Unknown error'}`);
    } finally {
      queryClient.invalidateQueries({ queryKey: ['documents'] });
      queryClient.invalidateQueries({ queryKey: ['kpis'] });
      queryClient.invalidateQueries({ queryKey: ['charts'] });
    }
  };

  return (
    <div className="flex flex-col gap-8 animate-fadeIn max-w-7xl mx-auto w-full pb-24 p-4 sm:p-6 lg:p-8 text-white font-sans relative">
      
      {/* Page Title */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-white/[0.08]">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
            Document Intelligence Library
          </h1>
          <p className="text-xs sm:text-sm text-zinc-400 mt-1 font-light">
            Upload, classify, and extract high-confidence structured telemetry from commercial documents.
          </p>
        </div>

        {/* View Mode & Count */}
        <div className="flex items-center gap-3">
          <IOSSegmentedControl
            options={[
              { value: 'table', label: 'Table View' },
              { value: 'grid', label: 'Grid Cards' },
            ]}
            value={viewMode}
            onChange={(v) => setViewMode(v as any)}
            size="sm"
          />
        </div>
      </div>

      {/* Apple Scanner Dropzone */}
      <IOSDocumentDropzone
        onFilesAccepted={handleDropzoneAccepted}
        isUploading={isUploading}
      />

      {/* Filter & Search Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 p-4 rounded-3xl ios-glass-card">
        
        {/* Left: Search input + Category & Status Pills */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Search Input */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-400" />
            <input
              type="text"
              placeholder="Search filename..."
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              className="pl-8.5 pr-3 py-1.5 rounded-2xl bg-white/[0.04] border border-white/10 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-blue-500/60 transition-colors w-48"
            />
          </div>

          {/* Category Dropdown */}
          <select
            value={selectedCategory}
            onChange={(e) => {
              iosAudio.playSwitch(true);
              setSelectedCategory(e.target.value);
            }}
            className="bg-white/[0.04] border border-white/10 rounded-2xl px-3 py-1.5 text-xs text-zinc-200 focus:outline-none focus:border-blue-500/60 cursor-pointer"
            aria-label="Filter by category"
          >
            <option value="" className="bg-[#121217]">All Categories</option>
            <option value="INVOICE" className="bg-[#121217]">Invoices</option>
            <option value="RFQ" className="bg-[#121217]">RFQs</option>
            <option value="CONTRACT" className="bg-[#121217]">Contracts</option>
            <option value="COMPLIANCE" className="bg-[#121217]">Compliance</option>
            <option value="PURCHASE_ORDER" className="bg-[#121217]">Purchase Orders</option>
          </select>

          {/* Status Dropdown */}
          <select
            value={selectedStatus}
            onChange={(e) => {
              iosAudio.playSwitch(true);
              setSelectedStatus(e.target.value);
            }}
            className="bg-white/[0.04] border border-white/10 rounded-2xl px-3 py-1.5 text-xs text-zinc-200 focus:outline-none focus:border-blue-500/60 cursor-pointer"
            aria-label="Filter by status"
          >
            <option value="" className="bg-[#121217]">All Statuses</option>
            <option value="INGESTED" className="bg-[#121217]">Ingested</option>
            <option value="PROCESSING" className="bg-[#121217]">Processing</option>
            <option value="AWAITING_REVIEW" className="bg-[#121217]">Awaiting Review</option>
            <option value="PROCESSED" className="bg-[#121217]">Processed</option>
            <option value="FAILED" className="bg-[#121217]">Failed</option>
          </select>

          {/* Clear Filter Button */}
          {(selectedCategory || selectedStatus || searchFilter) && (
            <button
              onClick={() => {
                iosAudio.playTap();
                setSelectedCategory('');
                setSelectedStatus('');
                setSearchFilter('');
              }}
              className="px-2.5 py-1 rounded-full bg-white/10 hover:bg-white/15 text-[11px] text-zinc-300 transition-colors cursor-pointer"
            >
              Clear Filters
            </button>
          )}
        </div>

        {/* Right: Sort controls */}
        <div className="flex items-center gap-2">
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="bg-white/[0.04] border border-white/10 rounded-2xl px-3 py-1.5 text-xs text-zinc-200 focus:outline-none focus:border-blue-500/60 cursor-pointer"
          >
            <option value="date" className="bg-[#121217]">Sort by Date</option>
            <option value="confidence" className="bg-[#121217]">Sort by Confidence</option>
            <option value="name" className="bg-[#121217]">Sort by Name</option>
          </select>

          <button
            onClick={() => {
              iosAudio.playTap();
              setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
            }}
            className="px-3 py-1.5 rounded-2xl border border-white/10 bg-white/[0.04] hover:bg-white/[0.08] text-xs font-mono font-medium text-zinc-300 cursor-pointer transition-colors"
          >
            {sortOrder.toUpperCase()}
          </button>

          <span className="text-xs font-mono text-zinc-400 ml-2">
            Total: {processedDocs.length}
          </span>
        </div>
      </div>

      {/* Table vs Grid View */}
      {viewMode === 'table' ? (
        <div className="ios-glass-card rounded-3xl overflow-hidden shadow-2xl">
          <div className="overflow-x-auto w-full">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-white/10 bg-white/[0.02] text-[10px] font-semibold tracking-wider text-zinc-400 uppercase font-mono">
                  <th className="py-3.5 px-4 w-10">
                    <input
                      type="checkbox"
                      checked={processedDocs.length > 0 && selectedDocIds.length === processedDocs.length}
                      onChange={(e) => {
                        iosAudio.playTap();
                        if (e.target.checked) {
                          setSelectedDocIds(processedDocs.map((d) => d.id));
                        } else {
                          setSelectedDocIds([]);
                        }
                      }}
                      className="rounded-lg bg-black/40 border-white/20 text-blue-600 focus:ring-0 cursor-pointer"
                      aria-label="Select all documents"
                    />
                  </th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4">Filename</th>
                  <th className="py-3.5 px-4">Category</th>
                  <th className="py-3.5 px-4">Consensus Score</th>
                  <th className="py-3.5 px-4">Ingested At</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                {isLoading ? (
                  Array.from({ length: 5 }).map((_, idx) => (
                    <TableRowSkeleton key={idx} />
                  ))
                ) : processedDocs.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-16 text-center">
                      <EmptyState
                        icon={AlertCircle}
                        title="No Documents Found"
                        description="No documents match the current filter criteria. Drag a PDF invoice into the dropzone above."
                      />
                    </td>
                  </tr>
                ) : (
                  processedDocs.map((doc) => (
                    <tr 
                      key={doc.id} 
                      onClick={() => {
                        iosAudio.playPop();
                        setSelectedDocId(doc.id);
                      }}
                      className={clsx(
                        "hover:bg-white/[0.03] transition-colors duration-150 text-xs text-zinc-300 cursor-pointer select-none",
                        selectedDocId === doc.id && "bg-white/[0.05]"
                      )}
                    >
                      <td className="py-4 px-4 align-middle w-10" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={selectedDocIds.includes(doc.id)}
                          onChange={(e) => {
                            iosAudio.playTap();
                            if (e.target.checked) {
                              setSelectedDocIds((prev) => [...prev, doc.id]);
                            } else {
                              setSelectedDocIds((prev) => prev.filter((id) => id !== doc.id));
                            }
                          }}
                          className="rounded-lg bg-black/40 border-white/20 text-blue-600 focus:ring-0 cursor-pointer"
                        />
                      </td>
                      <td className="py-4 px-4 align-middle">
                        <Badge variant="status" value={doc.status}>
                          {doc.status}
                        </Badge>
                      </td>
                      <td className="py-4 px-4 align-middle font-medium text-white truncate max-w-[220px]">
                        {editingDocId === doc.id ? (
                          <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                            <input
                              type="text"
                              value={editingDocName}
                              onChange={(e) => setEditingDocName(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  updateDocMutation.mutate({ id: doc.id, data: { filename: editingDocName } });
                                } else if (e.key === 'Escape') {
                                  setEditingDocId(null);
                                }
                              }}
                              className="bg-black/80 border border-blue-500 rounded-xl px-2.5 py-1 text-xs text-white focus:outline-none w-full"
                              autoFocus
                            />
                            <button
                              onClick={() => updateDocMutation.mutate({ id: doc.id, data: { filename: editingDocName } })}
                              className="p-1 rounded-lg bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 cursor-pointer"
                            >
                              <Check className="h-3.5 w-3.5" />
                            </button>
                            <button
                              onClick={() => setEditingDocId(null)}
                              className="p-1 rounded-lg bg-rose-500/20 text-rose-400 hover:bg-rose-500/30 cursor-pointer"
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center justify-between group/title">
                            <div className="flex items-center gap-2 truncate">
                              <FileText className="h-4 w-4 text-zinc-400 shrink-0" />
                              <span className="truncate">{doc.filename}</span>
                            </div>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                iosAudio.playTap();
                                setEditingDocId(doc.id);
                                setEditingDocName(doc.filename);
                              }}
                              className="opacity-0 group-hover/title:opacity-100 p-1 rounded-lg hover:bg-white/10 text-zinc-400 hover:text-white transition-opacity cursor-pointer ml-1 shrink-0"
                            >
                              <Edit2 className="h-3 w-3" />
                            </button>
                          </div>
                        )}
                      </td>
                      <td className="py-4 px-4 align-middle" onClick={(e) => e.stopPropagation()}>
                        <select
                          value={doc.category}
                          onChange={(e) => updateDocMutation.mutate({ id: doc.id, data: { category: e.target.value } })}
                          className="bg-[#121217] border border-white/10 hover:border-blue-500/50 rounded-xl px-2 py-1 text-[10px] font-mono font-semibold text-zinc-300 focus:outline-none cursor-pointer transition-colors"
                        >
                          <option value="INVOICE">INVOICE</option>
                          <option value="CONTRACT">CONTRACT</option>
                          <option value="PURCHASE_ORDER">PURCHASE_ORDER</option>
                          <option value="RFQ">RFQ</option>
                          <option value="COMPLIANCE">COMPLIANCE</option>
                          <option value="UNKNOWN">UNKNOWN</option>
                        </select>
                      </td>
                      <td className="py-4 px-4 align-middle w-48">
                        {doc.consensus_score !== null ? (
                          <ConfidenceBar score={doc.consensus_score} showText={true} />
                        ) : (
                          <span className="text-[10px] text-zinc-500 font-mono">--</span>
                        )}
                      </td>
                      <td className="py-4 px-4 align-middle font-mono text-zinc-400 text-[10px] whitespace-nowrap">
                        {new Date(doc.created_at).toLocaleString([], {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </td>
                      <td className="py-4 px-4 align-middle text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1.5">
                          {(doc.status === 'AWAITING_REVIEW' || doc.status === 'PROCESSED') && (
                            <Link
                              href={`/review?doc_id=${doc.id}`}
                              onClick={() => iosAudio.playTap()}
                              className="p-2 rounded-xl border border-white/10 bg-white/[0.04] hover:bg-white/[0.1] text-zinc-200 hover:text-white cursor-pointer transition-all"
                              title="Inspect extraction fields"
                            >
                              <Eye className="h-3.5 w-3.5" />
                            </Link>
                          )}
                          <button
                            onClick={() => reprocessMutation.mutate(doc.id)}
                            disabled={reprocessMutation.isPending}
                            className="p-2 rounded-xl border border-white/10 bg-white/[0.04] hover:bg-white/[0.1] text-zinc-300 hover:text-white cursor-pointer disabled:opacity-50 transition-all"
                            title="Queue re-processing"
                          >
                            <RefreshCw className={clsx("h-3.5 w-3.5", reprocessMutation.isPending && "animate-spin")} />
                          </button>
                          <button
                            onClick={() => {
                              if (confirm('Delete this document permanently?')) {
                                deleteMutation.mutate(doc.id);
                              }
                            }}
                            disabled={deleteMutation.isPending}
                            className="p-2 rounded-xl border border-rose-500/20 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 cursor-pointer disabled:opacity-50 transition-all"
                            title="Delete permanently"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* Grid Card View */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {isLoading ? (
            Array.from({ length: 6 }).map((_, idx) => (
              <div key={idx} className="ios-glass-card p-6 flex flex-col gap-4 animate-pulse min-h-[180px] rounded-3xl">
                <div className="flex justify-between items-center">
                  <div className="h-4 w-16 bg-zinc-800 rounded-lg" />
                  <div className="h-4 w-12 bg-zinc-800 rounded-lg" />
                </div>
                <div className="h-6 w-3/4 bg-zinc-800 rounded-lg mt-2" />
                <div className="h-2 w-full bg-zinc-800 rounded-full mt-4" />
              </div>
            ))
          ) : processedDocs.length === 0 ? (
            <div className="col-span-full py-16 text-center ios-glass-card rounded-3xl">
              <EmptyState
                icon={AlertCircle}
                title="No Documents Found"
                description="No documents match the current filter criteria. Drag a PDF invoice into the dropzone above."
              />
            </div>
          ) : (
            processedDocs.map((doc) => (
              <motion.div
                key={doc.id}
                onClick={() => {
                  iosAudio.playPop();
                  setSelectedDocId(doc.id);
                }}
                whileHover={{ y: -3 }}
                className={clsx(
                  "p-6 rounded-3xl ios-glass-card transition-all duration-300 shadow-xl flex flex-col justify-between min-h-[190px] cursor-pointer relative overflow-hidden touch-press",
                  selectedDocId === doc.id ? "ring-2 ring-blue-500/60" : ""
                )}
              >
                <div className="flex flex-col gap-3">
                  <div className="flex justify-between items-start">
                    <Badge variant="status" value={doc.status} size="sm">
                      {doc.status}
                    </Badge>
                    <Badge variant="category" value={doc.category} size="sm">
                      {doc.category}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2.5 mt-1 min-w-0">
                    <div className="p-2 rounded-xl bg-white/5 border border-white/10 shrink-0">
                      <FileText className="h-4 w-4 text-blue-400" />
                    </div>
                    <span className="text-xs font-semibold text-white truncate w-full" title={doc.filename}>
                      {doc.filename}
                    </span>
                  </div>
                </div>

                <div className="mt-4 flex flex-col gap-2 border-t border-white/5 pt-3">
                  <div className="flex justify-between items-center text-[10px] text-zinc-400 font-mono">
                    <span>Consensus Score</span>
                    {doc.consensus_score !== null ? (
                      <span className="font-bold text-emerald-400">{Math.round(doc.consensus_score * 100)}%</span>
                    ) : (
                      <span>--</span>
                    )}
                  </div>
                  {doc.consensus_score !== null ? (
                    <ConfidenceBar score={doc.consensus_score} showText={false} />
                  ) : (
                    <div className="h-1.5 w-full rounded bg-zinc-800" />
                  )}
                  
                  <div className="flex items-center justify-between text-[10px] text-zinc-500 font-mono mt-1">
                    <span>Ingested</span>
                    <span>{new Date(doc.created_at).toLocaleDateString()}</span>
                  </div>
                </div>
              </motion.div>
            ))
          )}
        </div>
      )}

      {/* Slide-in Details Drawer */}
      <AnimatePresence>
        {selectedDocId && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.6 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedDocId(null)}
              className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm"
            />

            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 280 }}
              className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-lg border-l border-white/10 bg-[#0A0A0C]/98 p-6 shadow-2xl overflow-y-auto backdrop-blur-3xl flex flex-col gap-6"
            >
              {/* Header */}
              <div className="flex items-center justify-between pb-4 border-b border-white/10 select-none">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-2xl bg-blue-500/20 border border-blue-500/30 text-blue-400">
                    <FileText className="h-4 w-4" />
                  </div>
                  <span className="text-sm font-semibold text-white tracking-tight">Document Inspector</span>
                </div>
                <button
                  onClick={() => {
                    iosAudio.playPop();
                    setSelectedDocId(null);
                  }}
                  className="p-1.5 rounded-full bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white transition-colors cursor-pointer"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {isDetailsLoading ? (
                <div className="flex-1 flex flex-col items-center justify-center py-20 select-none">
                  <Loader2 className="h-7 w-7 text-blue-400 animate-spin" />
                  <span className="text-xs text-zinc-400 mt-3 font-mono">Fetching document details...</span>
                </div>
              ) : !fullDoc ? (
                <div className="flex-1 flex flex-col items-center justify-center py-20 text-rose-400 select-none gap-2">
                  <AlertCircle className="h-6 w-6" />
                  <span className="text-xs">Failed to load document details.</span>
                </div>
              ) : (
                <div className="flex flex-col gap-6">
                  {/* Real-time SSE Pipeline Progress */}
                  {pipelineEvents.length > 0 && (
                    <div className="p-4 rounded-2xl border border-blue-500/20 bg-blue-500/5 flex flex-col gap-3 font-mono">
                      <div className="flex items-center gap-2 text-xs font-bold text-blue-400">
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        <span>Live Pipeline Activity</span>
                      </div>
                      <div className="flex flex-col gap-1.5 text-[10px] text-zinc-300 max-h-40 overflow-y-auto">
                        {pipelineEvents.map((evt, idx) => (
                          <div key={idx} className="flex gap-2 border-l border-white/10 pl-2 py-0.5">
                            <span className="text-blue-400 font-semibold">[{evt.stage}]</span>
                            <span>{evt.message}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* File Metadata Info */}
                  <div className="p-4 rounded-2xl border border-white/10 bg-white/[0.02] flex flex-col gap-3 font-sans select-none">
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-zinc-400">Filename:</span>
                      <span className="font-semibold text-white truncate max-w-[220px]">{fullDoc.filename}</span>
                    </div>
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-zinc-400">Category:</span>
                      <Badge variant="category" value={fullDoc.category} size="sm">{fullDoc.category}</Badge>
                    </div>
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-zinc-400">Status:</span>
                      <Badge variant="status" value={fullDoc.status} size="sm">{fullDoc.status}</Badge>
                    </div>
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-zinc-400">Ingested At:</span>
                      <span className="font-mono text-[10px] text-zinc-400">
                        {new Date(fullDoc.created_at).toLocaleString()}
                      </span>
                    </div>
                  </div>

                  {/* Actions Row */}
                  <div className="flex items-center gap-2 select-none">
                    {(fullDoc.status === 'AWAITING_REVIEW' || fullDoc.status === 'PROCESSED') && (
                      <Link
                        href={`/review?doc_id=${fullDoc.id}`}
                        onClick={() => iosAudio.playTap()}
                        className="flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold cursor-pointer transition-colors shadow-lg"
                      >
                        <Eye className="h-4 w-4" />
                        <span>Spatial Review Studio</span>
                      </Link>
                    )}
                    <button
                      onClick={() => reprocessMutation.mutate(fullDoc.id)}
                      disabled={reprocessMutation.isPending}
                      className="p-2.5 rounded-2xl border border-white/10 bg-white/[0.04] hover:bg-white/10 text-zinc-300 hover:text-white cursor-pointer disabled:opacity-50 transition-colors"
                      title="Reprocess Document"
                    >
                      <RefreshCw className={clsx("h-4 w-4", reprocessMutation.isPending && "animate-spin")} />
                    </button>
                    <button
                      onClick={() => {
                        if (confirm('Delete this document permanently?')) {
                          deleteMutation.mutate(fullDoc.id);
                        }
                      }}
                      disabled={deleteMutation.isPending}
                      className="p-2.5 rounded-2xl border border-rose-500/20 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 cursor-pointer disabled:opacity-50 transition-colors"
                      title="Delete Document"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>

                  {/* Consensus Confidence Index */}
                  <div className="flex flex-col gap-2 select-none font-mono">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-zinc-400">Consensus Confidence</span>
                      {fullDoc.consensus_score !== null ? (
                        <span className="font-bold text-emerald-400">{Math.round(fullDoc.consensus_score * 100)}%</span>
                      ) : (
                        <span className="text-zinc-500">--</span>
                      )}
                    </div>
                    {fullDoc.consensus_score !== null ? (
                      <ConfidenceBar score={fullDoc.consensus_score} showText={false} />
                    ) : (
                      <div className="h-2 w-full rounded-full bg-zinc-800" />
                    )}
                  </div>

                  {/* Extracted Fields List */}
                  <div className="flex flex-col gap-3 font-sans">
                    <h4 className="text-[10px] font-semibold tracking-widest text-zinc-400 uppercase font-mono">
                      Extracted Key-Value Telemetry
                    </h4>
                    
                    {fullDoc.fields.length === 0 ? (
                      <EmptyState
                        icon={FileText}
                        title="No Fields Extracted"
                        description="No structured fields have been extracted for this document yet."
                        compact
                      />
                    ) : (
                      <div className="flex flex-col gap-2">
                        {fullDoc.fields.map((field) => (
                          <div 
                            key={field.id}
                            className="p-3 rounded-2xl border border-white/5 bg-white/[0.02] flex flex-col gap-1.5"
                          >
                            <div className="flex items-center justify-between text-xs">
                              <span className="font-mono text-xs font-semibold text-white">{field.field_key}</span>
                              <Badge variant="status" value={field.validation_status} size="sm">{field.validation_status}</Badge>
                            </div>
                            
                            <div className="text-xs font-mono bg-black/40 border border-white/5 p-2 rounded-xl text-zinc-200">
                              {field.consensus_value || field.extracted_value || <span className="text-zinc-600 italic">empty</span>}
                            </div>
                            
                            <div className="flex justify-between items-center text-[9px] font-mono text-zinc-500">
                              <span>Critic: {(field.critic_score * 100).toFixed(0)}%</span>
                              <span>Auditor: {(field.auditor_score * 100).toFixed(0)}%</span>
                              <span className="text-zinc-300">Conf: {(field.confidence_score * 100).toFixed(0)}%</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Raw OCR Text Preview */}
                  <div className="flex flex-col gap-2">
                    <h4 className="text-[10px] font-semibold tracking-widest text-zinc-400 uppercase font-mono">
                      Raw OCR Text Output
                    </h4>
                    <div className="p-4 rounded-2xl border border-white/10 bg-black/50 max-h-48 overflow-y-auto select-text">
                      <pre className="text-[11px] font-mono text-zinc-400 leading-relaxed whitespace-pre-wrap">
                        {fullDoc.ocr_text || 'No text extracted.'}
                      </pre>
                    </div>
                  </div>

                </div>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Floating Apple Multi-Select Action Bar */}
      <AnimatePresence>
        {selectedDocIds.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.95 }}
            transition={{ type: 'spring', damping: 26, stiffness: 320 }}
            className="fixed bottom-8 left-1/2 -translate-x-1/2 z-40 bg-[#121217]/95 border border-white/15 shadow-[0_20px_50px_rgba(0,0,0,0.9)] px-5 py-3 rounded-full flex items-center gap-4 text-xs font-medium select-none backdrop-blur-3xl text-white"
          >
            <span className="font-mono text-xs">
              {selectedDocIds.length} {selectedDocIds.length === 1 ? 'item' : 'items'} selected
            </span>
            <div className="h-4 w-px bg-white/15" />
            <button
              onClick={() => {
                if (confirm(`Delete ${selectedDocIds.length} selected documents permanently?`)) {
                  bulkDeleteMutation.mutate(selectedDocIds);
                }
              }}
              disabled={bulkDeleteMutation.isPending}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-rose-500/20 border border-rose-500/40 text-rose-300 hover:bg-rose-500/30 transition-all cursor-pointer font-semibold disabled:opacity-50"
            >
              <Trash2 className="h-3.5 w-3.5" />
              <span>Delete Selected</span>
            </button>
            <button
              onClick={() => {
                iosAudio.playTap();
                setSelectedDocIds([]);
              }}
              className="text-zinc-400 hover:text-white text-xs cursor-pointer transition-colors"
            >
              Deselect
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Batch Upload Floating Drawer */}
      <BatchUploadDrawer
        isOpen={showBatchDrawer}
        onClose={() => setShowBatchDrawer(false)}
        tasks={batchTasks}
        onClearCompleted={() =>
          setBatchTasks((prev) =>
            prev.filter((t) => t.status !== 'PROCESSED' && t.status !== 'AWAITING_REVIEW')
          )
        }
      />

    </div>
  );
}
