'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  UploadCloud, 
  CheckCircle2, 
  AlertCircle, 
  ChevronDown, 
  ChevronUp, 
  X, 
  Eye, 
  Loader2,
  FileText
} from 'lucide-react';
import Link from 'next/link';

export interface BatchUploadTask {
  id: string;
  name: string;
  size?: number;
  status: 'QUEUED' | 'UPLOADING' | 'INGESTED' | 'PROCESSING' | 'AWAITING_REVIEW' | 'PROCESSED' | 'FAILED';
  progress: number;
  documentId?: string | null;
  category?: string | null;
  error?: string | null;
}

interface BatchUploadDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  tasks: BatchUploadTask[];
  onClearCompleted?: () => void;
}

export const BatchUploadDrawer: React.FC<BatchUploadDrawerProps> = ({
  isOpen,
  onClose,
  tasks,
  onClearCompleted,
}) => {
  const [isMinimized, setIsMinimized] = useState(false);

  if (!isOpen || tasks.length === 0) return null;

  const totalCount = tasks.length;
  const completedCount = tasks.filter(
    (t) => t.status === 'PROCESSED' || t.status === 'AWAITING_REVIEW'
  ).length;
  const failedCount = tasks.filter((t) => t.status === 'FAILED').length;
  const inProgressCount = totalCount - completedCount - failedCount;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 40, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 40, scale: 0.95 }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        className="fixed bottom-6 right-6 z-50 w-96 max-w-[calc(100vw-2rem)] bg-[#0c121e]/95 border border-primary/25 rounded-2xl shadow-2xl backdrop-blur-xl overflow-hidden flex flex-col font-sans"
      >
        {/* Drawer Header */}
        <div className="p-3.5 px-4 bg-white/[0.02] border-b border-white/[0.06] flex items-center justify-between select-none">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-primary/15 text-primary border border-primary/20">
              {inProgressCount > 0 ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : failedCount > 0 ? (
                <AlertCircle className="h-4 w-4 text-rose-400" />
              ) : (
                <CheckCircle2 className="h-4 w-4 text-emerald-400" />
              )}
            </div>
            <div className="flex flex-col">
              <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                Batch Ingestion
                <span className="text-[10px] font-mono font-normal text-muted-foreground">
                  ({completedCount}/{totalCount})
                </span>
              </span>
              <span className="text-[10px] text-muted-foreground font-mono">
                {inProgressCount > 0
                  ? `Processing ${inProgressCount} file${inProgressCount === 1 ? '' : 's'}...`
                  : failedCount > 0
                  ? `${failedCount} file${failedCount === 1 ? '' : 's'} flagged/failed`
                  : 'All files ingested successfully'}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => setIsMinimized(!isMinimized)}
              className="p-1.5 rounded-lg hover:bg-white/[0.06] text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
              title={isMinimized ? 'Expand' : 'Minimize'}
            >
              {isMinimized ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-white/[0.06] text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
              title="Close drawer"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* Expandable Task List */}
        {!isMinimized && (
          <div className="max-h-72 overflow-y-auto scrollbar p-3 flex flex-col gap-2">
            {tasks.map((task) => {
              const isDone = task.status === 'PROCESSED' || task.status === 'AWAITING_REVIEW';
              const isFailed = task.status === 'FAILED';
              const isRunning = task.status === 'UPLOADING' || task.status === 'PROCESSING' || task.status === 'INGESTED';

              return (
                <div
                  key={task.id}
                  className="p-2.5 rounded-xl border border-white/[0.04] bg-neutral-900/60 flex flex-col gap-1.5 transition-colors"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 truncate flex-1">
                      <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <span className="text-xs font-medium text-neutral-200 truncate" title={task.name}>
                        {task.name}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {isRunning && (
                        <span className="text-[10px] font-mono text-primary font-bold">
                          {task.progress}%
                        </span>
                      )}
                      {isDone && (
                        <span className="px-2 py-0.5 rounded-md text-[9px] font-mono font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/25">
                          READY
                        </span>
                      )}
                      {isFailed && (
                        <span className="px-2 py-0.5 rounded-md text-[9px] font-mono font-bold bg-rose-500/15 text-rose-400 border border-rose-500/25">
                          FAILED
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Progress Bar for In-flight tasks */}
                  {isRunning && (
                    <div className="h-1 w-full bg-neutral-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-primary to-indigo-400 transition-all duration-300 rounded-full"
                        style={{ width: `${task.progress}%` }}
                      />
                    </div>
                  )}

                  {/* Error Message if Failed */}
                  {isFailed && task.error && (
                    <p className="text-[10px] text-rose-400/90 font-mono truncate" title={task.error}>
                      {task.error}
                    </p>
                  )}

                  {/* Document ID & Quick Review Action */}
                  {task.documentId && isDone && (
                    <div className="flex items-center justify-between pt-1 text-[10px] font-mono text-muted-foreground border-t border-white/[0.03]">
                      <span>{task.category || 'DOCUMENT'}</span>
                      <Link
                        href={`/review?doc_id=${task.documentId}`}
                        className="flex items-center gap-1 text-primary hover:text-primary-hover font-semibold cursor-pointer transition-colors"
                      >
                        <Eye className="h-3 w-3" />
                        <span>Review</span>
                      </Link>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Footer Actions */}
        {!isMinimized && onClearCompleted && completedCount > 0 && (
          <div className="p-2.5 px-4 bg-white/[0.01] border-t border-white/[0.04] flex items-center justify-between text-[10px] text-muted-foreground font-mono">
            <span>{completedCount} completed</span>
            <button
              onClick={onClearCompleted}
              className="text-primary hover:underline cursor-pointer"
            >
              Clear completed
            </button>
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  );
};
