"use client";

import React from "react";
import * as Dialog from '@radix-ui/react-dialog';
import { EmptyState } from '@/components/ui/EmptyState';
import { X } from 'lucide-react';

interface DocumentDiffViewerProps {
  isOpen?: boolean;
  originalFields: Record<string, any>;
  currentFields: Record<string, any>;
  onClose: () => void;
}

export const DocumentDiffViewer: React.FC<DocumentDiffViewerProps> = ({
  isOpen = true,
  originalFields,
  currentFields,
  onClose,
}) => {
  const allKeys = Array.from(
    new Set([...Object.keys(originalFields || {}), ...Object.keys(currentFields || {})])
  );

  return (
    <Dialog.Root open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm p-4 flex items-center justify-center animate-fadeIn" />
        <Dialog.Content className="fixed left-[50%] top-[50%] z-50 translate-x-[-50%] translate-y-[-50%] bg-slate-900 border border-slate-800 rounded-xl w-[calc(100%-2rem)] max-w-4xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden text-slate-100 focus:outline-none">
          <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/50">
            <div>
              <Dialog.Title className="font-semibold text-lg text-white">Document Extraction Visual Diff</Dialog.Title>
              <Dialog.Description className="sr-only">Visual comparison of AI-extracted vs human-edited field values</Dialog.Description>
              <p className="text-xs text-slate-400">Comparing original AI extraction vs human edited values</p>
            </div>
            <Dialog.Close asChild>
              <button
                type="button"
                className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-medium transition flex items-center gap-2 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                aria-label="Close diff viewer"
              >
                <span>Close Diff (Esc)</span>
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </Dialog.Close>
          </div>

          <div
            tabIndex={0}
            aria-label="Field comparison list"
            className="p-4 overflow-y-auto flex-1 space-y-3 focus:outline-none focus:ring-1 focus:ring-slate-700 rounded-lg"
          >
            <div className="grid grid-cols-12 text-xs font-semibold text-slate-400 uppercase tracking-wider px-3 py-2 bg-slate-950 rounded-lg">
              <div className="col-span-3">Field Key</div>
              <div className="col-span-4">Original AI Value</div>
              <div className="col-span-5">Current Human Edited Value</div>
            </div>

            {allKeys.length === 0 ? (
              <div className="py-8">
                <EmptyState
                  title="No fields to compare"
                  description="There are no extraction fields available for comparison."
                  icon={X}
                />
              </div>
            ) : (
              allKeys.map((key) => {
                const origVal = originalFields?.[key] ?? "";
                const currVal = currentFields?.[key] ?? "";
                const isModified = String(origVal) !== String(currVal);

                return (
                  <div
                    key={key}
                    className={`grid grid-cols-12 text-sm p-3 rounded-lg border transition ${
                      isModified
                        ? "bg-amber-950/20 border-amber-800/40 text-amber-200"
                        : "bg-slate-900/50 border-slate-800 text-slate-300"
                    }`}
                  >
                    <div className="col-span-3 font-mono font-medium text-slate-300 truncate">{key}</div>
                    <div className="col-span-4 font-mono text-slate-400 break-words pr-2">
                      {String(origVal) || <span className="italic text-slate-600">empty</span>}
                    </div>
                    <div className="col-span-5 font-mono font-semibold break-words flex items-center gap-2">
                      <span className={isModified ? "text-emerald-400" : "text-slate-200"}>
                        {String(currVal) || <span className="italic text-slate-600">empty</span>}
                      </span>
                      {isModified && (
                        <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                          Modified
                        </span>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <div className="p-3 border-t border-slate-800 bg-slate-950/50 flex justify-between items-center text-xs text-slate-400">
            <div>
              Total fields: <span className="font-semibold text-white">{allKeys.length}</span>
            </div>
            <div>
              Modified fields:{" "}
              <span className="font-semibold text-amber-400">
                {allKeys.filter((k) => String(originalFields?.[k]) !== String(currentFields?.[k])).length}
              </span>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
};
