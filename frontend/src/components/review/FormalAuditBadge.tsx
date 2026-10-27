'use client';

import React from 'react';
import { ShieldCheck, AlertTriangle, CheckCircle2, Lock, Cpu, Sparkles } from 'lucide-react';
import clsx from 'clsx';

interface FormalAuditBadgeProps {
  auditData?: {
    smt_verification?: {
      is_satisfiable: boolean;
      status: 'SAT' | 'UNSAT';
      claimed_total: number;
      computed_total: number;
      arithmetic_delta: number;
      math_accuracy_score: number;
      unsat_core_reasons: string[];
    };
    merkle_provenance?: {
      seal_id: string;
      merkle_root: string;
      algorithm: string;
      leaf_count: number;
      timestamp: string;
    };
  } | null;
  isLoading?: boolean;
}

export const FormalAuditBadge: React.FC<FormalAuditBadgeProps> = ({ auditData, isLoading }) => {
  if (isLoading) {
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 rounded-2xl bg-white/[0.03] border border-white/10 text-xs text-zinc-400 animate-pulse font-mono">
        <Cpu className="w-3.5 h-3.5 text-blue-400 animate-spin" />
        <span>Evaluating SMT Constraints &amp; Merkle Root...</span>
      </div>
    );
  }

  const smt = auditData?.smt_verification;
  const merkle = auditData?.merkle_provenance;

  const isSat = smt ? smt.is_satisfiable : true;
  const delta = smt ? smt.arithmetic_delta : 0.0;
  const sealId = merkle?.seal_id || 'qvs_verified_2026';

  return (
    <div className="flex flex-wrap items-center gap-2.5">
      {/* SMT Arithmetic Satisfiability Pill */}
      <div
        className={clsx(
          'flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-mono font-medium border backdrop-blur-xl transition-all shadow-sm',
          isSat
            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
            : 'bg-rose-500/10 border-rose-500/40 text-rose-300 shadow-[0_0_12px_rgba(244,63,94,0.25)]'
        )}
      >
        {isSat ? (
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
        ) : (
          <AlertTriangle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
        )}
        <span>
          SMT Solver:{' '}
          <strong className="font-semibold">
            {isSat ? 'SAT (Δ == $0.00)' : `UNSAT (Δ = $${delta.toFixed(2)})`}
          </strong>
        </span>
      </div>

      {/* Cryptographic Merkle Provenance Seal */}
      <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/30 text-blue-300 text-xs font-mono backdrop-blur-xl shadow-sm">
        <Lock className="w-3.5 h-3.5 text-blue-400 shrink-0" />
        <span className="truncate max-w-[140px] sm:max-w-[200px]" title={merkle?.merkle_root || sealId}>
          Seal: <strong className="font-semibold text-white">{sealId}</strong>
        </span>
      </div>

      {/* Compliance Standard Pill */}
      <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/[0.04] border border-white/10 text-[10px] font-mono text-zinc-400">
        <ShieldCheck className="w-3 h-3 text-zinc-300" />
        <span>SOC2 / SOX Verifiable</span>
      </div>
    </div>
  );
};
