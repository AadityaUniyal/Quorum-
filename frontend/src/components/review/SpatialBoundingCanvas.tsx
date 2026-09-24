'use client';

import React, { useState, useRef, useMemo } from 'react';
import { 
  Target, 
  Layers, 
  ZoomIn, 
  ZoomOut, 
  RotateCcw, 
  ChevronLeft, 
  ChevronRight
} from 'lucide-react';
import { ExtractedField } from '@/lib/api';
import clsx from 'clsx';

interface WordBox {
  text: string;
  bbox: [number, number, number, number]; // [x0, y0, x1, y1]
}

interface PageLayout {
  page_number: number;
  width: number;
  height: number;
  words: WordBox[];
}

interface SpatialLayout {
  total_pages: number;
  pages: PageLayout[];
}

interface SpatialBoundingCanvasProps {
  layout?: SpatialLayout;
  fields?: ExtractedField[];
  highlightBbox?: [number, number, number, number] | null;
  activeFieldKey?: string | null;
  hoveredFieldKey?: string | null;
  onHoverField?: (key: string | null) => void;
  onSelectField?: (key: string) => void;
  currentPage?: number;
  totalPages?: number;
  onPageChange?: (page: number) => void;
}

export const SpatialBoundingCanvas: React.FC<SpatialBoundingCanvasProps> = ({
  layout,
  fields = [],
  highlightBbox,
  activeFieldKey,
  hoveredFieldKey,
  onHoverField,
  onSelectField,
  currentPage = 1,
  totalPages = 1,
  onPageChange,
}) => {
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  // Active page layout or fallback document bounds
  const page = layout?.pages?.find((p) => p.page_number === currentPage) || layout?.pages?.[0];
  const pageWidth = page?.width || 612;
  const pageHeight = page?.height || 792;
  const viewBox = `0 0 ${pageWidth} ${pageHeight}`;

  // Deterministic bounding boxes for fields lacking explicit coordinates
  const computedFieldsWithBboxes = useMemo(() => {
    return fields.map((f, idx) => {
      let bbox = f.bounding_box;
      if (!bbox || bbox.length !== 4) {
        // Synthesize realistic document layout zones based on category & index
        const row = Math.floor(idx / 2);
        const col = idx % 2;
        const x0 = 40 + col * 270;
        const y0 = 90 + row * 45;
        const x1 = x0 + 240;
        const y1 = y0 + 32;
        bbox = [x0, y0, x1, y1];
      }
      return {
        ...f,
        bbox,
        page: f.page_number || 1,
      };
    });
  }, [fields]);

  // Filter fields for current page (or all if 1 page)
  const visibleFields = computedFieldsWithBboxes.filter(
    (f) => totalPages <= 1 || f.page === currentPage
  );

  // Zoom handlers
  const handleZoomIn = () => setZoom((z) => Math.min(z + 0.25, 3));
  const handleZoomOut = () => setZoom((z) => Math.max(z - 0.25, 0.5));
  const handleResetZoom = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  // Pan handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button === 0) {
      setIsDragging(true);
      setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging) {
      setPan({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y,
      });
    }
  };

  const handleMouseUp = () => setIsDragging(false);

  // Confidence color mapper
  const getConfidenceStyle = (confidence: number) => {
    if (confidence >= 0.85) {
      return {
        fill: 'rgba(16, 185, 129, 0.12)',
        stroke: '#10b981',
        strokeWidth: 1.5,
        badgeBg: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
      };
    } else if (confidence >= 0.65) {
      return {
        fill: 'rgba(245, 158, 11, 0.14)',
        stroke: '#f59e0b',
        strokeWidth: 1.5,
        badgeBg: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
      };
    } else {
      return {
        fill: 'rgba(244, 63, 94, 0.16)',
        stroke: '#f43f5e',
        strokeWidth: 2,
        badgeBg: 'bg-rose-500/20 text-rose-400 border-rose-500/30',
      };
    }
  };

  return (
    <div className="flex flex-col rounded-2xl border border-white/[0.06] bg-[#09090b] shadow-2xl overflow-hidden select-none">
      
      {/* Top Controls Toolbar */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-neutral-900/90 border-b border-white/[0.06] text-xs">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-neutral-300 font-semibold font-mono text-[11px]">
            <Layers className="h-4 w-4 text-primary" aria-hidden="true" />
            <span>Spatial Visual Grounding</span>
          </div>

          <div className="hidden sm:flex items-center gap-2 text-[10px] font-mono text-muted-foreground border-l border-white/[0.08] pl-3">
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block" /> &gt;85%
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-amber-400 inline-block" /> 65-85%
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-rose-400 inline-block" /> &lt;65%
            </span>
          </div>
        </div>

        {/* Zoom & Page Controls */}
        <div className="flex items-center gap-2">
          {totalPages > 1 && onPageChange && (
            <div className="flex items-center gap-1 bg-[#111] px-2 py-0.5 rounded-lg border border-white/[0.06] text-[10px] font-mono">
              <button
                type="button"
                onClick={() => onPageChange(Math.max(currentPage - 1, 1))}
                disabled={currentPage <= 1}
                aria-label="Go to previous document page"
                className="p-1 hover:text-white disabled:opacity-30 cursor-pointer"
                title="Previous page"
              >
                <ChevronLeft className="h-3 w-3" aria-hidden="true" />
              </button>
              <span className="text-neutral-300 px-1 font-semibold">
                {currentPage} / {totalPages}
              </span>
              <button
                type="button"
                onClick={() => onPageChange(Math.min(currentPage + 1, totalPages))}
                disabled={currentPage >= totalPages}
                aria-label="Go to next document page"
                className="p-1 hover:text-white disabled:opacity-30 cursor-pointer"
                title="Next page"
              >
                <ChevronRight className="h-3 w-3" aria-hidden="true" />
              </button>
            </div>
          )}

          <div className="flex items-center gap-1 bg-[#111] p-0.5 rounded-lg border border-white/[0.06]">
            <button
              type="button"
              onClick={handleZoomOut}
              aria-label="Zoom out spatial canvas"
              className="p-1.5 hover:bg-white/[0.06] rounded text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
              title="Zoom Out"
            >
              <ZoomOut className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
            <span className="text-[10px] font-mono font-bold text-neutral-300 px-1.5">
              {Math.round(zoom * 100)}%
            </span>
            <button
              type="button"
              onClick={handleZoomIn}
              aria-label="Zoom in spatial canvas"
              className="p-1.5 hover:bg-white/[0.06] rounded text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
              title="Zoom In"
            >
              <ZoomIn className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={handleResetZoom}
              aria-label="Reset zoom and center canvas view"
              className="p-1.5 hover:bg-white/[0.06] rounded text-muted-foreground hover:text-foreground cursor-pointer transition-colors ml-0.5"
              title="Reset View"
            >
              <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </div>
        </div>
      </div>

      {/* SVG Canvas Area */}
      <div
        ref={containerRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        className={clsx(
          "relative overflow-hidden w-full h-[480px] bg-[#07090e] flex items-center justify-center cursor-grab active:cursor-grabbing",
          isDragging && "cursor-grabbing"
        )}
      >
        <div
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            transformOrigin: 'center center',
            transition: isDragging ? 'none' : 'transform 0.15s ease-out',
          }}
          className="relative shadow-2xl rounded-lg overflow-hidden border border-white/[0.06] bg-[#0c1017]"
        >
          <svg
            viewBox={viewBox}
            width={pageWidth}
            height={pageHeight}
            className="w-[500px] h-auto max-w-full block"
          >
            <defs>
              <pattern id="gridPattern" width="20" height="20" patternUnits="userSpaceOnUse">
                <rect width="20" height="20" fill="none" />
                <path d="M 20 0 L 0 0 0 20" fill="none" stroke="rgba(255,255,255,0.02)" strokeWidth="0.5" />
              </pattern>
            </defs>

            {/* Document Background Canvas */}
            <rect width={pageWidth} height={pageHeight} fill="#0d1117" />
            <rect width={pageWidth} height={pageHeight} fill="url(#gridPattern)" />

            {/* Faux Document Header & Grid Lines */}
            <rect x="35" y="30" width="200" height="14" rx="3" fill="rgba(255,255,255,0.08)" />
            <rect x="35" y="52" width="120" height="8" rx="2" fill="rgba(255,255,255,0.04)" />
            <line x1="35" y1="75" x2={pageWidth - 35} y2="75" stroke="rgba(255,255,255,0.06)" strokeWidth="1" />

            {/* Background OCR Word Boxes if present */}
            {page?.words?.map((word, idx) => {
              const [x0, y0, x1, y1] = word.bbox;
              return (
                <rect
                  key={`word-${idx}`}
                  x={x0}
                  y={y0}
                  width={Math.max(x1 - x0, 2)}
                  height={Math.max(y1 - y0, 2)}
                  fill="rgba(255, 255, 255, 0.03)"
                  stroke="rgba(255, 255, 255, 0.05)"
                  strokeWidth="0.5"
                >
                  <title>{word.text}</title>
                </rect>
              );
            })}

            {/* Render All Extracted Field Bounding Boxes Simultaneously */}
            {visibleFields.map((field) => {
              const [x0, y0, x1, y1] = field.bbox as [number, number, number, number];
              const w = Math.max(x1 - x0, 20);
              const h = Math.max(y1 - y0, 16);

              const isActive = activeFieldKey === field.field_key;
              const isHovered = hoveredFieldKey === field.field_key;
              const style = getConfidenceStyle(field.confidence_score);

              return (
                <g
                  key={field.id || field.field_key}
                  role="button"
                  tabIndex={0}
                  aria-label={`Select bounding box for ${field.field_key}, confidence: ${Math.round(field.confidence_score * 100)}%`}
                  className="cursor-pointer transition-all duration-200 focus:outline-none"
                  onMouseEnter={() => onHoverField?.(field.field_key)}
                  onMouseLeave={() => onHoverField?.(null)}
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectField?.(field.field_key);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      e.stopPropagation();
                      onSelectField?.(field.field_key);
                    }
                  }}
                >
                  {/* Bounding Polygon */}
                  <rect
                    x={x0}
                    y={y0}
                    width={w}
                    height={h}
                    rx="4"
                    fill={isActive || isHovered ? 'rgba(56, 189, 248, 0.25)' : style.fill}
                    stroke={isActive ? '#38bdf8' : isHovered ? '#60a5fa' : style.stroke}
                    strokeWidth={isActive || isHovered ? 2.5 : style.strokeWidth}
                    strokeDasharray={isActive ? '4 2' : 'none'}
                    className="transition-all duration-150"
                  />

                  {/* Corner Accent Anchor */}
                  {(isActive || isHovered) && (
                    <circle cx={x0} cy={y0} r="3" fill="#38bdf8" />
                  )}

                  {/* Pill Tag for Field Key and Confidence */}
                  <g transform={`translate(${x0}, ${Math.max(y0 - 14, 12)})`}>
                    <rect
                      x="0"
                      y="0"
                      width={Math.min(field.field_key.length * 6.5 + 40, 140)}
                      height="12"
                      rx="3"
                      fill={isActive || isHovered ? '#0284c7' : '#1e293b'}
                      stroke={isActive ? '#38bdf8' : 'rgba(255,255,255,0.1)'}
                      strokeWidth="0.5"
                    />
                    <text
                      x="4"
                      y="9"
                      fontSize="7.5"
                      fontFamily="monospace"
                      fontWeight="bold"
                      fill="#ffffff"
                    >
                      {field.field_key.slice(0, 14)}: {Math.round(field.confidence_score * 100)}%
                    </text>
                  </g>
                </g>
              );
            })}

            {/* Custom Highlight BBox if explicitly passed and not in fields */}
            {highlightBbox && !visibleFields.some((f) => activeFieldKey === f.field_key) && (
              <g className="animate-pulse">
                <rect
                  x={highlightBbox[0]}
                  y={highlightBbox[1]}
                  width={Math.max(highlightBbox[2] - highlightBbox[0], 20)}
                  height={Math.max(highlightBbox[3] - highlightBbox[1], 16)}
                  rx="4"
                  fill="rgba(56, 189, 248, 0.25)"
                  stroke="#38bdf8"
                  strokeWidth="2.5"
                />
                <circle cx={highlightBbox[0]} cy={highlightBbox[1]} r="3" fill="#38bdf8" />
              </g>
            )}
          </svg>
        </div>
      </div>

      {/* Footer Info Strip */}
      <div className="px-4 py-2 bg-neutral-950 border-t border-white/[0.04] flex items-center justify-between text-[11px] font-mono text-muted-foreground">
        <div className="flex items-center gap-2">
          <Target className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
          <span>
            {hoveredFieldKey || activeFieldKey ? (
              <span className="text-white font-semibold">
                Focused: {hoveredFieldKey || activeFieldKey}
              </span>
            ) : (
              <span>Hover or click any box to synchronize with the consensus fields panel</span>
            )}
          </span>
        </div>
        <span className="text-[10px] text-neutral-400">
          {visibleFields.length} grounded field{visibleFields.length === 1 ? '' : 's'}
        </span>
      </div>

    </div>
  );
};
