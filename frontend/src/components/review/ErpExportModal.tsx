'use client';

import React, { useState, useEffect } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { 
  Building2, 
  Copy, 
  Check, 
  Download, 
  X, 
  Loader2, 
  FileCode, 
  FileSpreadsheet,
  FileText
} from 'lucide-react';
import { api, DocumentResponse } from '@/lib/api';
import { toast } from 'react-hot-toast';
import clsx from 'clsx';

interface ErpExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  document: DocumentResponse | null;
}

type ExportFormat = 'quickbooks' | 'xero' | 'sap' | 'universal';

export const ErpExportModal: React.FC<ErpExportModalProps> = ({
  isOpen,
  onClose,
  document,
}) => {
  const [activeFormat, setActiveFormat] = useState<ExportFormat>('quickbooks');
  const [loading, setLoading] = useState(false);
  const [exportData, setExportData] = useState<string>('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!isOpen || !document) return;

    let isMounted = true;
    setLoading(true);

    api.exportDocumentErp(document.id, activeFormat)
      .then((res: any) => {
        if (!isMounted) return;
        if (activeFormat === 'xero') {
          setExportData(res.xml_payload || res);
        } else if (activeFormat === 'sap') {
          setExportData(res.csv_payload || res);
        } else {
          setExportData(JSON.stringify(res, null, 2));
        }
      })
      .catch(() => {
        if (!isMounted) return;
        // Fallback live generator from document object
        const fieldsMap: Record<string, string> = {};
        document.fields.forEach((f) => {
          fieldsMap[f.field_key] = f.consensus_value || f.extracted_value || '';
        });

        if (activeFormat === 'quickbooks') {
          setExportData(
            JSON.stringify(
              {
                Bill: {
                  DocNumber: fieldsMap['invoice_number'] || 'INV-001',
                  TxnDate: fieldsMap['invoice_date'] || new Date().toISOString().split('T')[0],
                  TotalAmt: parseFloat(fieldsMap['total_amount'] || '0.00'),
                  VendorRef: { name: fieldsMap['vendor_name'] || 'Vendor Inc' },
                  Line: [
                    {
                      DetailType: 'AccountBasedExpenseLineDetail',
                      Amount: parseFloat(fieldsMap['total_amount'] || '0.00'),
                      Description: fieldsMap['description'] || 'Extracted by DocIntel AI',
                    },
                  ],
                },
              },
              null,
              2
            )
          );
        } else if (activeFormat === 'xero') {
          setExportData(
            `<?xml version="1.0" encoding="utf-8"?>\n<Invoices>\n  <Invoice>\n    <Type>ACCPAY</Type>\n    <Contact>\n      <Name>${fieldsMap['vendor_name'] || 'Vendor Inc'}</Name>\n    </Contact>\n    <InvoiceNumber>${fieldsMap['invoice_number'] || 'INV-001'}</InvoiceNumber>\n    <Date>${fieldsMap['invoice_date'] || '2026-09-19'}</Date>\n    <Total>${fieldsMap['total_amount'] || '0.00'}</Total>\n    <Status>AUTHORISED</Status>\n  </Invoice>\n</Invoices>`
          );
        } else if (activeFormat === 'sap') {
          setExportData(
            `RecordType,DocNumber,VendorName,PostingDate,Currency,Amount,TaxAmount\nHEADER,${fieldsMap['invoice_number'] || 'INV-001'},"${fieldsMap['vendor_name'] || 'Vendor Inc'}",${fieldsMap['invoice_date'] || '20260919'},USD,${fieldsMap['total_amount'] || '0.00'},${fieldsMap['tax_amount'] || '0.00'}`
          );
        } else {
          setExportData(
            JSON.stringify(
              {
                document_id: document.id,
                filename: document.filename,
                category: document.category,
                consensus_score: document.consensus_score,
                extracted_fields: fieldsMap,
                exported_at: new Date().toISOString(),
              },
              null,
              2
            )
          );
        }
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen, document, activeFormat]);

  const handleCopy = () => {
    navigator.clipboard.writeText(exportData);
    setCopied(true);
    toast.success('Copied payload to clipboard');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    if (!document) return;
    const ext =
      activeFormat === 'quickbooks' || activeFormat === 'universal'
        ? 'json'
        : activeFormat === 'xero'
        ? 'xml'
        : 'csv';
    const mime =
      ext === 'json'
        ? 'application/json'
        : ext === 'xml'
        ? 'application/xml'
        : 'text/csv';

    const blob = new Blob([exportData], { type: mime });
    const url = URL.createObjectURL(blob);
    const link = window.document.createElement('a');
    link.href = url;
    link.download = `${document.filename.replace(/\.[^/.]+$/, '')}_${activeFormat}.${ext}`;
    window.document.body.appendChild(link);
    link.click();
    window.document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success(`Downloaded ${activeFormat.toUpperCase()} file`);
  };

  return (
    <Dialog.Root open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm font-sans select-none animate-fadeIn p-4 flex items-center justify-center" />
        <Dialog.Content className="fixed left-[50%] top-[50%] z-50 translate-x-[-50%] translate-y-[-50%] bg-[#0c121e] border border-white/[0.08] rounded-2xl w-[calc(100%-2rem)] max-w-3xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden font-sans select-none animate-fadeIn">
          
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.06] bg-white/[0.01]">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-primary/10 border border-primary/20 text-primary">
                <Building2 className="h-5 w-5" aria-hidden="true" />
              </div>
              <div>
                <Dialog.Title className="text-sm font-bold text-foreground">
                  Enterprise Accounting &amp; ERP Export
                </Dialog.Title>
                <Dialog.Description className="sr-only">
                  Export document data to various ERP formats
                </Dialog.Description>
                <p className="text-[11px] text-muted-foreground font-mono">
                  {document ? document.filename : 'No Document Selected'} &bull; Ready for automated ledger journal ingestion
                </p>
              </div>
            </div>

            <Dialog.Close asChild>
              <button
                type="button"
                className="p-1.5 rounded-lg border border-white/[0.06] hover:bg-white/[0.06] text-muted-foreground hover:text-foreground cursor-pointer transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                aria-label="Close ERP export modal"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </Dialog.Close>
          </div>

        {/* Format Selector Tabs */}
        <div role="tablist" aria-label="Export format options" className="flex items-center gap-2 px-6 pt-4 border-b border-white/[0.06] bg-neutral-900/30">
          <button
            type="button"
            role="tab"
            id="tab-quickbooks"
            aria-selected={activeFormat === 'quickbooks'}
            aria-controls="export-preview-panel"
            onClick={() => setActiveFormat('quickbooks')}
            className={clsx(
              "flex items-center gap-2 px-3.5 py-2 rounded-t-xl text-xs font-semibold font-mono border-t border-x transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-primary",
              activeFormat === 'quickbooks'
                ? "bg-[#0c121e] border-white/[0.08] border-b-transparent text-primary"
                : "border-transparent text-muted-foreground hover:text-neutral-200"
            )}
          >
            <FileCode className="h-3.5 w-3.5" aria-hidden="true" />
            <span>QuickBooks JSON</span>
          </button>

          <button
            type="button"
            role="tab"
            id="tab-xero"
            aria-selected={activeFormat === 'xero'}
            aria-controls="export-preview-panel"
            onClick={() => setActiveFormat('xero')}
            className={clsx(
              "flex items-center gap-2 px-3.5 py-2 rounded-t-xl text-xs font-semibold font-mono border-t border-x transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-primary",
              activeFormat === 'xero'
                ? "bg-[#0c121e] border-white/[0.08] border-b-transparent text-primary"
                : "border-transparent text-muted-foreground hover:text-neutral-200"
            )}
          >
            <FileText className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Xero XML</span>
          </button>

          <button
            type="button"
            role="tab"
            id="tab-sap"
            aria-selected={activeFormat === 'sap'}
            aria-controls="export-preview-panel"
            onClick={() => setActiveFormat('sap')}
            className={clsx(
              "flex items-center gap-2 px-3.5 py-2 rounded-t-xl text-xs font-semibold font-mono border-t border-x transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-primary",
              activeFormat === 'sap'
                ? "bg-[#0c121e] border-white/[0.08] border-b-transparent text-primary"
                : "border-transparent text-muted-foreground hover:text-neutral-200"
            )}
          >
            <FileSpreadsheet className="h-3.5 w-3.5" aria-hidden="true" />
            <span>SAP / NetSuite CSV</span>
          </button>

          <button
            type="button"
            role="tab"
            id="tab-universal"
            aria-selected={activeFormat === 'universal'}
            aria-controls="export-preview-panel"
            onClick={() => setActiveFormat('universal')}
            className={clsx(
              "flex items-center gap-2 px-3.5 py-2 rounded-t-xl text-xs font-semibold font-mono border-t border-x transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-primary",
              activeFormat === 'universal'
                ? "bg-[#0c121e] border-white/[0.08] border-b-transparent text-primary"
                : "border-transparent text-muted-foreground hover:text-neutral-200"
            )}
          >
            <FileCode className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Universal JSON</span>
          </button>
        </div>

        {/* Code Content Body */}
        <div className="flex-1 p-6 overflow-y-auto scrollbar bg-[#080b12] flex flex-col gap-3">
          <div className="flex items-center justify-between text-[11px] font-mono text-muted-foreground select-none">
            <span>
              Format: <strong className="text-neutral-200 uppercase">{activeFormat}</strong>
            </span>
            <span>UTF-8 Encoded</span>
          </div>

          <div
            id="export-preview-panel"
            role="tabpanel"
            aria-labelledby={`tab-${activeFormat}`}
            tabIndex={0}
            aria-label="Export payload content"
            className="relative rounded-xl border border-white/[0.06] bg-[#05070c] p-4 min-h-[260px] overflow-auto scrollbar focus:outline-none focus:ring-1 focus:ring-primary/40"
          >
            {loading ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-muted-foreground text-xs font-mono">
                <Loader2 className="h-6 w-6 text-primary animate-spin" aria-hidden="true" />
                <span>Formatting ERP schema payload...</span>
              </div>
            ) : (
              <pre className="text-xs font-mono text-neutral-300 leading-relaxed whitespace-pre-wrap select-text">
                {exportData}
              </pre>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3.5 border-t border-white/[0.06] bg-neutral-900/60 flex items-center justify-between">
          <Dialog.Close asChild>
            <button
              type="button"
              className="px-4 py-2 rounded-xl text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-white/[0.04] transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              Close
            </button>
          </Dialog.Close>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={handleCopy}
              disabled={loading || !exportData}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-white/[0.04] border border-white/[0.08] hover:bg-white/[0.08] text-neutral-200 transition-colors cursor-pointer disabled:opacity-40 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" aria-hidden="true" /> : <Copy className="h-3.5 w-3.5" aria-hidden="true" />}
              <span>{copied ? 'Copied!' : 'Copy Code'}</span>
            </button>

            <button
              type="button"
              onClick={handleDownload}
              disabled={loading || !exportData}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-primary hover:bg-primary-hover text-white shadow-md shadow-primary/20 transition-all cursor-pointer disabled:opacity-40 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <Download className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Download File</span>
            </button>
          </div>
        </div>

      </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
};
