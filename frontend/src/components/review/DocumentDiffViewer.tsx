"use client";

import React from "react";

interface DocumentDiffViewerProps {
  originalFields: Record<string, any>;
  currentFields: Record<string, any>;
  onClose: () => void;
}

export const DocumentDiffViewer: React.FC<DocumentDiffViewerProps> = ({
  originalFields,
  currentFields,
  onClose,
}) => {
  const allKeys = Array.from(
    new Set([...Object.keys(originalFields || {}), ...Object.keys(currentFields || {})])
  );

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-xl w-full max-w-4xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden text-slate-100">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/50">
          <div>
            <h3 className="font-semibold text-lg text-white">Document Extraction Visual Diff</h3>
            <p className="text-xs text-slate-400">Comparing original AI extraction vs human edited values</p>
          </div>
          <button
            onClick={onClose}
            className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-medium transition"
          >
            Close Diff (Esc)
          </button>
        </div>

        <div className="p-4 overflow-y-auto flex-1 space-y-3">
          <div className="grid grid-cols-12 text-xs font-semibold text-slate-400 uppercase tracking-wider px-3 py-2 bg-slate-950 rounded-lg">
            <div className="col-span-3">Field Key</div>
            <div className="col-span-4">Original AI Value</div>
            <div className="col-span-5">Current Human Edited Value</div>
          </div>

          {allKeys.length === 0 ? (
            <div className="text-center py-8 text-slate-500 text-sm">No fields to compare.</div>
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
      </div>
    </div>
  );
};
