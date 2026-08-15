'use client';

import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useDropzone } from 'react-dropzone';
import { toast } from 'react-hot-toast';
import { Badge } from '@/components/ui/Badge';
import { ConfidenceBar } from '@/components/ui/ConfidenceBar';
import { TableRowSkeleton } from '@/components/ui/Skeleton';
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
  Clock,
  Sparkles,
  Download
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';

export default function DocumentsPage() {
  const queryClient = useQueryClient();
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [selectedStatus, setSelectedStatus] = useState<string>('');
  const [uploadingFiles, setUploadingFiles] = useState<{ name: string; progress: number }[]>([]);
  const [viewMode, setViewMode] = useState<'table' | 'grid'>('table');
  const [sortBy, setSortBy] = useState<'date' | 'confidence' | 'name'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [searchFilter, setSearchFilter] = useState('');
  
  // Drawer state
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);
  const [pipelineEvents, setPipelineEvents] = useState<{ stage: string; message: string }[]>([]);

  // Fetch Documents
  const { data: documents, isLoading } = useQuery({
    queryKey: ['documents', selectedCategory, selectedStatus],
    queryFn: () => api.listDocuments(selectedCategory || undefined, selectedStatus || undefined),
    refetchInterval: 10000,
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
        } catch (e) {
          // parse error
        }
      };

      es.onerror = () => {
        es?.close();
      };
    } catch (err) {
      console.error("SSE connection failed:", err);
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
  });

  // Reprocess Mutation
  const reprocessMutation = useMutation({
    mutationFn: api.reprocessDocument,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents'] });
      queryClient.invalidateQueries({ queryKey: ['documentDetails', selectedDocId] });
      toast.success('Document re-processing queued');
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to queue re-processing');
    }
  });

  // Delete Mutation
  const deleteMutation = useMutation({
    mutationFn: api.deleteDocument,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents'] });
      setSelectedDocId(null);
      toast.success('Document deleted successfully');
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to delete document');
    }
  });

  // Dropzone File Upload
  const onDrop = async (acceptedFiles: File[]) => {
    const uploadPromises = acceptedFiles.map(async (file) => {
      setUploadingFiles((prev) => [...prev, { name: file.name, progress: 10 }]);
      
      const interval = setInterval(() => {
        setUploadingFiles((prev) => 
          prev.map((f) => f.name === file.name ? { ...f, progress: Math.min(f.progress + 15, 90) } : f)
        );
      }, 300);
      
      try {
        await api.uploadDocument(file);
        clearInterval(interval);
        setUploadingFiles((prev) => prev.filter((f) => f.name !== file.name));
        toast.success(`Uploaded ${file.name} successfully!`);
      } catch (err: unknown) {
        clearInterval(interval);
        setUploadingFiles((prev) => prev.filter((f) => f.name !== file.name));
        const errMsg = err instanceof Error ? err.message : 'Duplicate or invalid';
        toast.error(`Failed to upload ${file.name}: ${errMsg}`);
      }
    });

    await Promise.all(uploadPromises);
    queryClient.invalidateQueries({ queryKey: ['documents'] });
    queryClient.invalidateQueries({ queryKey: ['kpis'] });
    queryClient.invalidateQueries({ queryKey: ['charts'] });
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    maxSize: 10 * 1024 * 1024, // 10MB
    accept: {
      'application/pdf': ['.pdf'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'text/plain': ['.txt'],
      'image/png': ['.png'],
      'image/jpeg': ['.jpg', '.jpeg'],
      'image/tiff': ['.tiff']
    }
  });

  return (
    <div className="flex flex-col gap-8 animate-fadeIn max-w-7xl mx-auto w-full pb-16 relative">
      
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground font-sans">Document Pipeline</h1>
        <p className="text-xs text-muted-foreground mt-1 font-sans">
          Upload commercial documents (PDFs, images, docx) to classify, extract, and index semantically.
        </p>
      </div>

      {/* Upload Dropzone */}
      <div 
        {...getRootProps()} 
        className={clsx(
          "relative border-2 border-dashed rounded-2xl p-8 flex flex-col items-center justify-center text-center cursor-pointer transition-all duration-300 min-h-[180px] bg-[#0c0c0c]/40 shadow-inner select-none",
          isDragActive 
            ? "border-primary bg-primary/5 shadow-primary/5" 
            : "border-white/6 hover:border-white/[0.12] hover:bg-[#0c0c0c]/60"
        )}
      >
        <input {...getInputProps()} />
        <div className="flex flex-col items-center gap-3">
          <div className="p-3 rounded-2xl bg-white/2 border border-white/4 text-muted-foreground transition-all duration-300">
            <UploadCloud className="h-6 w-6 text-primary" />
          </div>
          <div className="flex flex-col gap-1">
            <p className="text-sm font-semibold text-neutral-200">
              {isDragActive ? 'Drop the files here' : 'Drag & drop files here, or click to browse'}
            </p>
            <p className="text-[10px] text-muted-foreground">
              Supports PDF, DOCX, TXT, PNG, JPG, TIFF up to 10 MB.
            </p>
          </div>
        </div>
      </div>

      {/* Active Uploads List */}
      <AnimatePresence>
        {uploadingFiles.length > 0 && (
          <motion.div 
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="flex flex-col gap-2 p-4 rounded-xl border border-white/4 bg-[#0c0c0c]/80"
          >
            <span className="text-[10px] font-bold font-mono tracking-wider uppercase text-neutral-400 flex items-center gap-2">
              <Loader2 className="h-3 w-3 text-primary animate-spin" /> Ingestion active ({uploadingFiles.length})
            </span>
            <div className="flex flex-col gap-2 mt-2">
              {uploadingFiles.map((file, idx) => (
                <div key={idx} className="flex flex-col gap-1.5 py-1.5 border-b border-white/2 last:border-0 text-xs text-muted-foreground font-mono">
                  <div className="flex items-center justify-between">
                    <span className="truncate max-w-[240px] text-neutral-200">{file.name}</span>
                    <span className="text-primary font-bold">{file.progress}%</span>
                  </div>
                  <div className="h-1 w-full bg-neutral-900 rounded-full overflow-hidden border border-neutral-950">
                    <div 
                      className="h-full bg-gradient-to-r from-primary to-accent-2 transition-all duration-300 rounded-full" 
                      style={{ width: `${file.progress}%` }} 
                    />
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
 
      {/* Filters / Headers */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/4 pb-4">
        
        {/* Filter Pills */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground mr-2">
            <Filter className="h-3.5 w-3.5" />
            <span className="font-semibold">Filters:</span>
          </div>

          <input
            type="text"
            placeholder="Search filename..."
            value={searchFilter}
            onChange={(e) => setSearchFilter(e.target.value)}
            className="bg-[#111] border border-white/6 rounded-xl px-3 py-1.5 text-xs text-neutral-350 focus:outline-none focus:border-primary/50 w-36 placeholder-neutral-600 font-sans"
          />
 
          {/* Category Dropdown */}
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="bg-[#111] border border-white/6 rounded-xl px-3 py-1.5 text-xs text-neutral-300 focus:outline-none focus:border-primary/50"
          >
            <option value="">All Categories</option>
            <option value="INVOICE">Invoices</option>
            <option value="RFQ">RFQs</option>
            <option value="CONTRACT">Contracts</option>
            <option value="COMPLIANCE">Compliance Certificates</option>
            <option value="PURCHASE_ORDER">Purchase Orders</option>
          </select>
 
          {/* Status Dropdown */}
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="bg-[#111] border border-white/6 rounded-xl px-3 py-1.5 text-xs text-neutral-300 focus:outline-none focus:border-primary/50"
          >
            <option value="">All Statuses</option>
            <option value="INGESTED">Ingested</option>
            <option value="PROCESSING">Processing</option>
            <option value="AWAITING_REVIEW">Awaiting Review</option>
            <option value="PROCESSED">Processed</option>
            <option value="FAILED">Failed</option>
          </select>

          <div className="h-4 w-px bg-white/[0.06] mx-1 hidden sm:block" />

          {/* Sort Toggles */}
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="bg-[#111] border border-white/6 rounded-xl px-3 py-1.5 text-xs text-neutral-300 focus:outline-none focus:border-primary/50 cursor-pointer"
          >
            <option value="date">Sort by Date</option>
            <option value="confidence">Sort by Confidence</option>
            <option value="name">Sort by Filename</option>
          </select>
          <button
            onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
            className="px-2.5 py-1.5 rounded-xl border border-white/4 bg-[#111]/80 hover:bg-[#161b22] text-muted-foreground hover:text-foreground cursor-pointer text-[10px] font-mono font-bold uppercase transition-colors"
          >
            {sortOrder}
          </button>
        </div>
 
        <div className="flex items-center gap-4 self-end sm:self-center select-none">
          <div className="flex items-center gap-1 bg-[#111] p-1 rounded-xl border border-white/4">
            <button
              onClick={() => setViewMode('table')}
              className={clsx(
                "px-3 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider font-mono cursor-pointer transition-all duration-200",
                viewMode === 'table' ? "bg-primary text-white font-semibold" : "text-muted-foreground hover:text-foreground"
              )}
            >
              Table
            </button>
            <button
              onClick={() => setViewMode('grid')}
              className={clsx(
                "px-3 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider font-mono cursor-pointer transition-all duration-200",
                viewMode === 'grid' ? "bg-primary text-white font-semibold" : "text-muted-foreground hover:text-foreground"
              )}
            >
              Grid
            </button>
          </div>
          <span className="text-xs font-mono font-semibold text-muted-foreground">
            Count: {processedDocs?.length || 0}
          </span>
        </div>
      </div>

      {/* Table vs Grid View Ingestion Render */}
      {viewMode === 'table' ? (
        <div className="glass-card border border-white/4 bg-[#0c0c0c]/80 overflow-hidden shadow-2xl rounded-2xl select-none">
          <div className="overflow-x-auto w-full">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-white/4 bg-white/1 text-[10px] font-bold tracking-wider text-muted-foreground uppercase font-mono">
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Filename</th>
                  <th className="py-3 px-4">Category</th>
                  <th className="py-3 px-4">Confidence</th>
                  <th className="py-3 px-4">Ingested At</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.02]">
                {isLoading ? (
                  Array.from({ length: 5 }).map((_, idx) => (
                    <TableRowSkeleton key={idx} />
                  ))
                ) : processedDocs?.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-16 text-center">
                      <div className="flex flex-col items-center justify-center gap-2.5 text-muted-foreground font-sans text-xs">
                        <AlertCircle className="h-6 w-6 opacity-30" />
                        <span className="font-semibold text-neutral-400">No documents found matching the criteria.</span>
                        <span>Try dragging in a commercial PDF/image above.</span>
                      </div>
                    </td>
                  </tr>
                ) : (
                  processedDocs?.map((doc) => (
                    <tr 
                      key={doc.id} 
                      onClick={() => setSelectedDocId(doc.id)}
                      className={clsx(
                        "hover:bg-white/1 transition-colors duration-200 text-xs text-neutral-300 font-sans cursor-pointer",
                        selectedDocId === doc.id && "bg-white/2"
                      )}
                    >
                      <td className="py-4 px-4 align-middle">
                        <Badge variant="status" value={doc.status}>
                          {doc.status}
                        </Badge>
                      </td>
                      <td className="py-4 px-4 align-middle font-medium text-foreground truncate max-w-[200px]">
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                          <span className="truncate">{doc.filename}</span>
                        </div>
                      </td>
                      <td className="py-4 px-4 align-middle">
                        <Badge variant="category" value={doc.category}>
                          {doc.category}
                        </Badge>
                      </td>
                      <td className="py-4 px-4 align-middle w-48">
                        {doc.consensus_score !== null ? (
                          <ConfidenceBar score={doc.consensus_score} showText={true} />
                        ) : (
                          <span className="text-[10px] text-muted-foreground font-mono">--</span>
                        )}
                      </td>
                      <td className="py-4 px-4 align-middle font-mono text-muted-foreground text-[10px] whitespace-nowrap">
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
                              className="p-2 rounded-lg border border-white/4 bg-white/1 hover:bg-white/[0.06] hover:border-white/8 text-neutral-300 hover:text-foreground cursor-pointer transition-all duration-200"
                              title="Inspect extraction fields"
                            >
                              <Eye className="h-3.5 w-3.5" />
                            </Link>
                          )}
                          <button
                            onClick={() => reprocessMutation.mutate(doc.id)}
                            disabled={reprocessMutation.isPending}
                            className="p-2 rounded-lg border border-white/4 bg-white/1 hover:bg-white/[0.06] hover:border-white/8 text-neutral-300 hover:text-foreground cursor-pointer disabled:opacity-50 transition-all duration-200"
                            title="Queue re-processing"
                          >
                            <RefreshCw className={clsx("h-3.5 w-3.5", reprocessMutation.isPending && "animate-spin")} />
                          </button>
                          <button
                            onClick={() => {
                              if (confirm('Are you sure you want to delete this document?')) {
                                deleteMutation.mutate(doc.id);
                              }
                            }}
                            disabled={deleteMutation.isPending}
                            className="p-2 rounded-lg border border-white/4 bg-[#500]/5 hover:bg-rose-500/10 border-transparent text-rose-400 hover:text-rose-300 hover:border-rose-500/20 cursor-pointer disabled:opacity-50 transition-all duration-200"
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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {isLoading ? (
            Array.from({ length: 6 }).map((_, idx) => (
              <div key={idx} className="glass-card p-5 border border-white/4 bg-[#0c0c0c]/80 flex flex-col gap-4 animate-pulse min-h-[160px]">
                <div className="flex justify-between items-center">
                  <div className="h-4 w-16 bg-neutral-800 rounded" />
                  <div className="h-4 w-12 bg-neutral-800 rounded" />
                </div>
                <div className="h-6 w-3/4 bg-neutral-800 rounded mt-2" />
                <div className="h-2 w-full bg-neutral-800 rounded-full mt-4" />
              </div>
            ))
          ) : processedDocs.length === 0 ? (
            <div className="col-span-full py-16 text-center glass-card border border-white/4 bg-[#0c0c0c]/80">
              <div className="flex flex-col items-center justify-center gap-2.5 text-muted-foreground font-sans text-xs">
                <AlertCircle className="h-6 w-6 opacity-30" />
                <span className="font-semibold text-neutral-400">No documents found matching the criteria.</span>
                <span>Try dragging in a commercial PDF/image above.</span>
              </div>
            </div>
          ) : (
            processedDocs.map((doc) => (
              <motion.div
                key={doc.id}
                onClick={() => setSelectedDocId(doc.id)}
                whileHover={{ y: -2 }}
                className={clsx(
                  "p-5 rounded-2xl border bg-[#0c0c0c]/85 hover:bg-[#0c0c0c] hover:border-primary/20 transition-all duration-300 shadow-lg flex flex-col justify-between min-h-[170px] cursor-pointer relative overflow-hidden",
                  selectedDocId === doc.id ? "border-primary/45 bg-white/1" : "border-white/4"
                )}
              >
                <div className="flex flex-col gap-3.5">
                  <div className="flex justify-between items-start">
                    <Badge variant="status" value={doc.status} size="sm">
                      {doc.status}
                    </Badge>
                    <Badge variant="category" value={doc.category} size="sm">
                      {doc.category}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2.5 mt-1 min-w-0">
                    <FileText className="h-4.5 w-4.5 text-muted-foreground shrink-0" />
                    <span className="text-xs font-semibold text-neutral-100 truncate w-full" title={doc.filename}>
                      {doc.filename}
                    </span>
                  </div>
                </div>

                <div className="mt-4 flex flex-col gap-2 border-t border-white/2 pt-3">
                  <div className="flex justify-between items-center text-[10px] text-muted-foreground font-mono">
                    <span>Confidence Score</span>
                    {doc.consensus_score !== null ? (
                      <span className="font-bold text-neutral-200">{Math.round(doc.consensus_score * 100)}%</span>
                    ) : (
                      <span>--</span>
                    )}
                  </div>
                  {doc.consensus_score !== null ? (
                    <ConfidenceBar score={doc.consensus_score} showText={false} />
                  ) : (
                    <div className="h-1.5 w-full rounded bg-neutral-900 border border-neutral-950" />
                  )}
                  
                  <div className="flex items-center justify-between text-[9px] text-muted-foreground font-mono mt-1">
                    <span>Ingested At:</span>
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
            {/* Backdrop overlay */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.4 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedDocId(null)}
              className="fixed inset-0 z-40 bg-black/60 backdrop-blur-xs"
            />

            {/* Slide-in Drawer Container */}
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 26, stiffness: 220 }}
              className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-lg border-l border-white/4 bg-[#0c0c0c] p-6 shadow-2xl overflow-y-auto scrollbar flex flex-col gap-6"
            >
              {/* Header */}
              <div className="flex items-center justify-between pb-4 border-b border-white/4 select-none">
                <div className="flex items-center gap-2">
                  <FileText className="h-4.5 w-4.5 text-primary" />
                  <span className="text-sm font-bold text-neutral-200 font-sans truncate max-w-[240px]">Document Inspector</span>
                </div>
                <button
                  onClick={() => setSelectedDocId(null)}
                  className="p-1.5 rounded-lg border border-white/4 bg-white/1 hover:bg-white/[0.06] text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {isDetailsLoading ? (
                <div className="flex-1 flex flex-col items-center justify-center py-20 select-none">
                  <Loader2 className="h-7 w-7 text-primary animate-spin" />
                  <span className="text-xs text-muted-foreground mt-3 font-mono">Fetching document details...</span>
                </div>
              ) : !fullDoc ? (
                <div className="flex-1 flex flex-col items-center justify-center py-20 text-rose-400 select-none gap-2">
                  <AlertCircle className="h-6 w-6" />
                  <span className="text-xs">Failed to load detailed metrics.</span>
                </div>
              ) : (
                <div className="flex flex-col gap-6">
                  {/* Real-time Pipeline Progress (SSE) */}
                  {pipelineEvents.length > 0 && (
                    <div className="p-4 rounded-xl border border-primary/10 bg-primary/5 flex flex-col gap-3 font-mono">
                      <div className="flex items-center gap-2 text-xs font-bold text-primary">
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        <span>Live Pipeline Activity</span>
                      </div>
                      <div className="flex flex-col gap-1.5 text-[10px] text-neutral-300 max-h-40 overflow-y-auto scrollbar">
                        {pipelineEvents.map((evt, idx) => (
                          <div key={idx} className="flex gap-2 border-l border-white/8 pl-2 py-0.5">
                            <span className="text-primary font-semibold">[{evt.stage}]</span>
                            <span>{evt.message}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* File Metadata Info */}
                  <div className="p-4 rounded-xl border border-white/4 bg-neutral-900/35 flex flex-col gap-3 font-sans select-none">
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-muted-foreground">Filename:</span>
                      <span className="font-semibold text-neutral-200 truncate max-w-[200px]">{fullDoc.filename}</span>
                    </div>
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-muted-foreground">Category:</span>
                      <Badge variant="category" value={fullDoc.category} size="sm">{fullDoc.category}</Badge>
                    </div>
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-muted-foreground">Status:</span>
                      <Badge variant="status" value={fullDoc.status} size="sm">{fullDoc.status}</Badge>
                    </div>
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-muted-foreground">Ingested At:</span>
                      <span className="font-mono text-[10px] text-neutral-400">
                        {new Date(fullDoc.created_at).toLocaleString()}
                      </span>
                    </div>
                  </div>

                  {/* Actions Row */}
                  <div className="flex items-center gap-2 select-none">
                    {(fullDoc.status === 'AWAITING_REVIEW' || fullDoc.status === 'PROCESSED') && (
                      <Link
                        href={`/review?doc_id=${fullDoc.id}`}
                        className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg border border-primary/20 bg-primary/10 hover:bg-primary/20 text-primary text-xs font-semibold cursor-pointer transition-colors"
                      >
                        <Eye className="h-4 w-4" />
                        <span>Manual Review Workspace</span>
                      </Link>
                    )}
                    <button
                      onClick={() => reprocessMutation.mutate(fullDoc.id)}
                      disabled={reprocessMutation.isPending}
                      className="p-2 rounded-lg border border-white/4 bg-white/1 hover:bg-white/5 text-neutral-300 hover:text-foreground cursor-pointer disabled:opacity-50"
                      title="Reprocess Document"
                    >
                      <RefreshCw className={clsx("h-4 w-4", reprocessMutation.isPending && "animate-spin")} />
                    </button>
                    <button
                      onClick={() => {
                        if (confirm('Are you sure you want to delete this document?')) {
                          deleteMutation.mutate(fullDoc.id);
                        }
                      }}
                      disabled={deleteMutation.isPending}
                      className="p-2 rounded-lg border border-[#500]/10 bg-[#500]/5 hover:bg-rose-500/10 text-rose-400 cursor-pointer disabled:opacity-50"
                      title="Delete Document"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>

                  {/* Consensus Confidence Index */}
                  <div className="flex flex-col gap-2.5 select-none font-mono">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-neutral-400">Consensus Confidence Index</span>
                      {fullDoc.consensus_score !== null ? (
                        <span className="font-bold text-neutral-200">{Math.round(fullDoc.consensus_score * 100)}%</span>
                      ) : (
                        <span className="text-muted-foreground">--</span>
                      )}
                    </div>
                    {fullDoc.consensus_score !== null ? (
                      <ConfidenceBar score={fullDoc.consensus_score} showText={false} />
                    ) : (
                      <div className="h-2 w-full rounded bg-neutral-900 border border-neutral-950" />
                    )}
                  </div>

                  {/* Extracted Fields Waterfall List */}
                  <div className="flex flex-col gap-3 font-sans">
                    <h4 className="text-[10px] font-bold tracking-widest text-muted-foreground uppercase font-mono">Extracted Key-Value Fields</h4>
                    
                    {fullDoc.fields.length === 0 ? (
                      <div className="text-center py-6 text-xs text-muted-foreground font-mono select-none">
                        No fields extracted yet.
                      </div>
                    ) : (
                      <div className="flex flex-col gap-2.5">
                        {fullDoc.fields.map((field) => (
                          <div 
                            key={field.id}
                            className="p-3 rounded-lg border border-white/[0.03] bg-neutral-950/45 flex flex-col gap-2"
                          >
                            <div className="flex items-center justify-between text-xs">
                              <span className="font-mono text-xs font-semibold text-neutral-300">{field.field_key}</span>
                              <Badge variant="status" value={field.validation_status} size="sm">{field.validation_status}</Badge>
                            </div>
                            
                            <div className="text-xs font-mono bg-black/30 border border-white/2 p-1.5 rounded text-neutral-200">
                              {field.consensus_value || field.extracted_value || <span className="text-muted-foreground italic">empty</span>}
                            </div>
                            
                            <div className="flex justify-between items-center text-[9px] font-mono text-muted-foreground">
                              <span>Critic: {(field.critic_score * 100).toFixed(0)}%</span>
                              <span>Auditor: {(field.auditor_score * 100).toFixed(0)}%</span>
                              <span className="text-neutral-300">Confidence: {(field.confidence_score * 100).toFixed(0)}%</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Raw OCR Text Preview Accordion */}
                  <div className="flex flex-col gap-3">
                    <h4 className="text-[10px] font-bold tracking-widest text-muted-foreground uppercase font-mono">Raw OCR Text Output</h4>
                    <div className="p-4 rounded-xl border border-white/4 bg-neutral-950/75 max-h-48 overflow-y-auto scrollbar select-text">
                      <pre className="text-[11px] font-mono text-neutral-400 leading-relaxed whitespace-pre-wrap">
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

    </div>
  );
}
