'use client';

import React from 'react';
import { Target, Layers } from 'lucide-react';

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
  highlightBbox?: [number, number, number, number] | null;
  activeFieldKey?: string | null;
  currentPage?: number;
}

export const SpatialBoundingCanvas: React.FC<SpatialBoundingCanvasProps> = ({
  layout,
  highlightBbox,
  activeFieldKey,
  currentPage = 1,
}) => {
  const page = layout?.pages?.find((p) => p.page_number === currentPage) || layout?.pages?.[0];

  if (!page) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-slate-400 bg-slate-900/40 rounded-xl border border-slate-800">
        <Target className="w-10 h-10 mb-2 opacity-50 text-indigo-400 animate-pulse" />
        <p className="text-sm font-medium">Spatial Geometry Layer Active</p>
        <p className="text-xs text-slate-500 mt-1">Select an extracted field to inspect verified visual coordinates.</p>
        {highlightBbox && (
          <div className="mt-4 px-3 py-1.5 bg-indigo-950/60 border border-indigo-700/50 rounded-lg text-xs font-mono text-indigo-300">
            Grounding BBox: [{highlightBbox.map((n) => Math.round(n)).join(', ')}]
          </div>
        )}
      </div>
    );
  }

  const viewBox = `0 0 ${page.width || 612} ${page.height || 792}`;

  return (
    <div className="relative w-full bg-slate-950 rounded-xl border border-slate-800 overflow-hidden shadow-2xl">
      <div className="flex items-center justify-between px-4 py-2 bg-slate-900/80 border-b border-slate-800">
        <div className="flex items-center space-x-2 text-xs text-slate-400 font-medium">
          <Layers className="w-4 h-4 text-indigo-400" />
          <span>Spatial Provenance Canvas (Page {page.page_number} / {layout?.total_pages || 1})</span>
        </div>
        {activeFieldKey && (
          <span className="text-xs font-mono bg-indigo-900/60 text-indigo-300 px-2.5 py-0.5 rounded-full border border-indigo-700/50">
            Field: {activeFieldKey}
          </span>
        )}
      </div>

      <div className="p-4 flex justify-center overflow-auto max-h-[600px]">
        <svg
          viewBox={viewBox}
          className="w-full h-auto max-w-[550px] bg-slate-900 rounded border border-slate-800 shadow-inner"
        >
          {/* Render background word bounding boxes */}
          {page.words?.map((word, idx) => {
            const [x0, y0, x1, y1] = word.bbox;
            const w = Math.max(x1 - x0, 2);
            const h = Math.max(y1 - y0, 2);

            return (
              <rect
                key={idx}
                x={x0}
                y={y0}
                width={w}
                height={h}
                className="fill-slate-700/20 hover:fill-indigo-500/30 stroke-slate-700/30 stroke-[0.5] transition-colors cursor-pointer"
              >
                <title>{word.text}</title>
              </rect>
            );
          })}

          {/* Render Active Field Highlight Box */}
          {highlightBbox && (
            <g className="animate-pulse">
              <rect
                x={highlightBbox[0]}
                y={highlightBbox[1]}
                width={Math.max(highlightBbox[2] - highlightBbox[0], 10)}
                height={Math.max(highlightBbox[3] - highlightBbox[1], 10)}
                className="fill-amber-400/25 stroke-amber-400 stroke-[2] rx-1"
              />
              <circle
                cx={highlightBbox[0]}
                cy={highlightBbox[1]}
                r="3"
                className="fill-amber-400"
              />
            </g>
          )}
        </svg>
      </div>
    </div>
  );
};
