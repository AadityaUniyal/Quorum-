"use client";

import React from "react";
import { CheckCircle, AlertTriangle, XCircle, FileText } from "lucide-react";

export interface EvidenceFieldProps {
  fieldKey: string;
  value: string | number | null;
  confidence: number;
  pageNumber?: number;
  evidenceText?: string;
  validationStatus?: "VALID" | "FLAGGED" | "MANUAL_CORRECTION";
  notes?: string;
  onVerify?: () => void;
}

export const EvidenceCard: React.FC<EvidenceFieldProps> = ({
  fieldKey,
  value,
  confidence,
  pageNumber = 1,
  evidenceText,
  validationStatus = "VALID",
  notes,
  onVerify,
}) => {
  const getStatusBadge = () => {
    switch (validationStatus) {
      case "VALID":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <CheckCircle className="w-3 h-3" /> Validated
          </span>
        );
      case "FLAGGED":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <AlertTriangle className="w-3 h-3" /> Flagged Review
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-500/10 text-blue-400 border border-blue-500/20">
            <XCircle className="w-3 h-3" /> Corrected
          </span>
        );
    }
  };

  const confidencePercent = Math.round(confidence * 100);

  return (
    <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 transition-all hover:border-slate-700 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            {fieldKey.replace(/_/g, " ")}
          </span>
          <span className="text-xs text-slate-500">Page {pageNumber}</span>
        </div>
        {getStatusBadge()}
      </div>

      <div className="flex items-baseline justify-between">
        <div className="text-lg font-bold text-slate-100 font-mono">
          {value !== null && value !== undefined ? String(value) : <span className="text-slate-500 italic">Not found</span>}
        </div>
        <div className="text-xs font-medium text-slate-400">
          <span className={confidencePercent >= 85 ? "text-emerald-400" : confidencePercent >= 60 ? "text-amber-400" : "text-rose-400"}>
            {confidencePercent}%
          </span>{" "}
          confidence
        </div>
      </div>

      {evidenceText && (
        <div className="bg-slate-950/60 rounded-lg p-2.5 border border-slate-800/80 text-xs text-slate-300 font-mono flex items-start gap-2">
          <FileText className="w-3.5 h-3.5 text-indigo-400 shrink-0 mt-0.5" />
          <span className="line-clamp-2">{evidenceText}</span>
        </div>
      )}

      {notes && <p className="text-xs text-slate-400 italic">{notes}</p>}

      {onVerify && (
        <div className="pt-1">
          <button
            type="button"
            onClick={onVerify}
            className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[11px] font-semibold tracking-wide text-slate-200 transition-colors hover:bg-white/10"
          >
            Mark as verified
          </button>
        </div>
      )}
    </div>
  );
};
