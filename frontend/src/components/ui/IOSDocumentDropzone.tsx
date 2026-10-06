'use client';

import React, { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { motion, AnimatePresence } from 'framer-motion';
import { UploadCloud, FileText, CheckCircle2, Loader2, Sparkles, Zap } from 'lucide-react';
import { iosAudio } from '@/lib/iosAudio';
import clsx from 'clsx';

interface IOSDocumentDropzoneProps {
  onFilesAccepted: (files: File[]) => void;
  isUploading?: boolean;
  className?: string;
}

export const IOSDocumentDropzone: React.FC<IOSDocumentDropzoneProps> = ({
  onFilesAccepted,
  isUploading = false,
  className,
}) => {
  const [isScanning, setIsScanning] = useState(false);

  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      if (acceptedFiles.length > 0) {
        iosAudio.playScan();
        setIsScanning(true);
        setTimeout(() => {
          setIsScanning(false);
          iosAudio.playSuccess();
          onFilesAccepted(acceptedFiles);
        }, 1200);
      }
    },
    [onFilesAccepted]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'image/*': ['.png', '.jpg', '.jpeg', '.webp', '.tiff'],
      'application/json': ['.json'],
      'text/csv': ['.csv'],
    },
    disabled: isUploading || isScanning,
  });

  return (
    <div
      {...getRootProps()}
      className={clsx(
        'relative overflow-hidden rounded-3xl border transition-all duration-300 cursor-pointer select-none p-6 sm:p-8',
        'ios-glass-card group',
        isDragActive
          ? 'border-blue-500 bg-blue-500/10 shadow-[0_0_40px_rgba(0,113,227,0.35)] scale-[1.01]'
          : 'border-white/[0.08] hover:border-white/20 bg-[#121217]/70 hover:bg-[#16161d]/90',
        (isUploading || isScanning) && 'pointer-events-none opacity-90',
        className
      )}
    >
      <input {...getInputProps()} />

      {/* Laser Scanner Beam (Active during drag or scanning) */}
      <AnimatePresence>
        {(isDragActive || isScanning || isUploading) && (
          <div className="scanner-beam pointer-events-none z-20" />
        )}
      </AnimatePresence>

      <div className="flex flex-col items-center text-center relative z-10">
        {/* Glowing Icon Capsule */}
        <div
          className={clsx(
            'w-14 h-14 rounded-2xl flex items-center justify-center mb-4 transition-all duration-300 border',
            isDragActive || isScanning
              ? 'bg-blue-500/20 border-blue-400/40 text-blue-400 shadow-[0_0_24px_rgba(0,113,227,0.4)]'
              : 'bg-white/[0.05] border-white/10 text-zinc-300 group-hover:scale-105 group-hover:bg-white/[0.08]'
          )}
        >
          {isScanning || isUploading ? (
            <Loader2 className="w-7 h-7 text-blue-400 animate-spin" />
          ) : isDragActive ? (
            <Sparkles className="w-7 h-7 text-blue-400 animate-pulse" />
          ) : (
            <UploadCloud className="w-7 h-7 text-zinc-400 group-hover:text-white transition-colors" />
          )}
        </div>

        {/* Dynamic Titles */}
        <h4 className="text-sm sm:text-base font-semibold text-white tracking-tight">
          {isScanning
            ? 'Neural Scanner Analyzing Document Topology...'
            : isUploading
            ? 'Ingesting & Multi-Agent Verifying...'
            : isDragActive
            ? 'Release to Ingest into Neural Cluster'
            : 'Drop PDF Invoices, Receipts, or Contracts Here'}
        </h4>

        <p className="text-xs text-zinc-400 mt-1 max-w-md font-light leading-relaxed">
          {isScanning || isUploading
            ? 'Applying spatial bounding OCR, vector embeddings, and mathematical consistency checks.'
            : 'Supports PDF, PNG, JPEG, TIFF, CSV & JSON. Automatic OCR, 7-agent verification, and ERP reconciliation.'}
        </p>

        {/* Supported Types Badges */}
        <div className="flex flex-wrap items-center justify-center gap-1.5 mt-4">
          {['PDF Documents', 'Spatial OCR', 'Auto-Reconcile', 'Vector RAG'].map((tag) => (
            <span
              key={tag}
              className="px-2.5 py-0.5 rounded-full text-[10px] font-mono bg-white/[0.04] text-zinc-400 border border-white/5 group-hover:border-white/10 transition-colors"
            >
              {tag}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
};
