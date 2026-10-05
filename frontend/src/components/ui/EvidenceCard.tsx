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
    <div className="bg-[#121217]/85 backdrop-blur-2xl border border-white/[0.08] rounded-2xl p-4 transition-all duration-200 hover:border-white/[0.16] hover:bg-[#16161d] space-y-3 shadow-sm select-none">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-[#a1a1a6] uppercase tracking-wider font-sans">
            {fieldKey.replace(/_/g, " ")}
          </span>
          <span className="text-xs text-[#86868b]">Page {pageNumber}</span>
        </div>
        {getStatusBadge()}
      </div>

      <div className="flex items-baseline justify-between">
        <div className="text-lg font-bold text-[#f5f5f7] font-mono">
          {value !== null && value !== undefined ? (
            String(value)
          ) : (
            <span className="text-[#86868b] italic">Not found</span>
          )}
        </div>
        <div className="text-xs font-medium text-[#a1a1a6]">
          <span
            className={
              confidencePercent >= 85
                ? "text-emerald-400 font-mono font-semibold"
                : confidencePercent >= 60
                ? "text-amber-400 font-mono font-semibold"
                : "text-rose-400 font-mono font-semibold"
            }
          >
            {confidencePercent}%
          </span>{" "}
          confidence
        </div>
      </div>

      {evidenceText && (
        <div className="bg-[#0A0A0C]/90 rounded-xl p-2.5 border border-white/[0.06] text-xs text-[#f5f5f7] font-mono flex items-start gap-2.5">
          <FileText className="w-3.5 h-3.5 text-[#38bdf8] shrink-0 mt-0.5" />
          <span className="line-clamp-2 leading-relaxed">{evidenceText}</span>
        </div>
      )}

      {notes && <p className="text-xs text-[#a1a1a6] italic">{notes}</p>}

      {onVerify && (
        <div className="pt-1">
          <button
            type="button"
            onClick={onVerify}
            className="inline-flex items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.04] hover:bg-white/[0.08] active:bg-white/[0.12] px-3 py-1.5 text-[11px] font-semibold tracking-wide text-[#f5f5f7] transition-all touch-press cursor-pointer"
          >
            Mark as verified
          </button>
        </div>
      )}
    </div>
  );
};
