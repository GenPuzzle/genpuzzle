'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import type { DetectionKind } from '@/lib/image-to-ppt/types';
import { useImageToPpt } from '@/lib/image-to-ppt-context';
import { getPageDimensionsInches, getPageMarginInches } from '@/lib/puzzle-layout';
import { useApp } from '@/lib/app-context';

const KIND_COLORS: Record<DetectionKind, string> = {
  text: 'rgba(37, 99, 235, 0.9)',
  graphic: 'rgba(5, 150, 105, 0.9)',
  'keep-original': 'rgba(217, 119, 6, 0.9)',
  delete: 'rgba(220, 38, 38, 0.9)',
};

export function ImageToPptReviewOverlay({
  pageWidthPx,
  pageHeightPx,
  marginPx,
}: {
  pageWidthPx: number;
  pageHeightPx: number;
  marginPx: number;
}) {
  const {
    activePage,
    reviewMode,
    selectedDetectionIds,
    selectDetection,
    setDetectionKind,
    updateDetection,
    mergeSelectedGraphics,
    splitSelectedGraphic,
  } = useImageToPpt();

  if (!reviewMode || !activePage?.detections.length) return null;

  const contentW = pageWidthPx - marginPx * 2;
  const contentH = pageHeightPx - marginPx * 2;
  const srcW = activePage.processedWidth || activePage.sourceWidth || 1;
  const srcH = activePage.processedHeight || activePage.sourceHeight || 1;
  const selected = activePage.detections.find((item) => item.id === selectedDetectionIds[0]);

  return (
    <>
      <div
        className="pointer-events-none absolute z-[40]"
        style={{ left: marginPx, top: marginPx, width: contentW, height: contentH }}
      >
        {activePage.detections.map((detection) => {
          const active = selectedDetectionIds.includes(detection.id);
          return (
            <button
              key={detection.id}
              type="button"
              className="pointer-events-auto absolute border-2 bg-white/10"
              style={{
                left: `${(detection.bbox.x / srcW) * 100}%`,
                top: `${(detection.bbox.y / srcH) * 100}%`,
                width: `${(detection.bbox.width / srcW) * 100}%`,
                height: `${(detection.bbox.height / srcH) * 100}%`,
                borderColor: KIND_COLORS[detection.kind],
                boxShadow: active ? `0 0 0 2px ${KIND_COLORS[detection.kind]}` : undefined,
              }}
              title={`${detection.kind}${detection.text ? `: ${detection.text}` : ''}`}
              onClick={(event) => {
                event.stopPropagation();
                selectDetection(detection.id, event.shiftKey);
              }}
            />
          );
        })}
      </div>
      <div className="absolute bottom-3 left-1/2 z-[45] w-[min(34rem,calc(100%-1.5rem))] -translate-x-1/2 rounded-xl border border-slate-200 bg-white/95 p-3 shadow-xl dark:border-slate-700 dark:bg-slate-900/95">
        <div className="mb-2 flex flex-wrap gap-2 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
          {(['text', 'graphic', 'keep-original', 'delete'] as DetectionKind[]).map((kind) => (
            <span key={kind} className="inline-flex items-center gap-1">
              <span className="h-2.5 w-2.5 rounded-sm" style={{ background: KIND_COLORS[kind] }} />
              {kind.replace('-', ' ')}
            </span>
          ))}
        </div>
        {selected ? (
          <div className="space-y-2">
            <div className="flex flex-wrap gap-2">
              {(['text', 'graphic', 'keep-original', 'delete'] as DetectionKind[]).map((kind) => (
                <button
                  key={kind}
                  type="button"
                  className={cn(
                    'rounded-md border px-2 py-1 text-xs font-semibold capitalize',
                    selected.kind === kind
                      ? 'border-[var(--gp-blue)] bg-[var(--gp-blue)] text-white'
                      : 'border-slate-200 bg-white'
                  )}
                  onClick={() => setDetectionKind(selected.id, kind)}
                >
                  {kind.replace('-', ' ')}
                </button>
              ))}
              <button
                type="button"
                className="rounded-md border border-slate-200 px-2 py-1 text-xs font-semibold"
                onClick={mergeSelectedGraphics}
                disabled={selectedDetectionIds.length < 2}
              >
                Merge graphics
              </button>
              <button
                type="button"
                className="rounded-md border border-slate-200 px-2 py-1 text-xs font-semibold"
                onClick={splitSelectedGraphic}
                disabled={selectedDetectionIds.length !== 1}
              >
                Separate graphic
              </button>
            </div>
            {selected.kind === 'text' && (
              <textarea
                className="h-20 w-full rounded-md border border-slate-200 p-2 text-xs"
                value={selected.text ?? ''}
                onChange={(event) => updateDetection(selected.id, { text: event.target.value })}
              />
            )}
          </div>
        ) : (
          <p className="text-xs text-slate-500">Click a box to classify it. Shift-click to select multiple graphics to merge.</p>
        )}
      </div>
    </>
  );
}

export function useImageToPptPageMetrics() {
  const { wordSearchSettings } = useApp();
  const dims = getPageDimensionsInches(wordSearchSettings);
  const widthPx = dims.width * 96;
  const heightPx = dims.height * 96;
  const marginPx = getPageMarginInches(wordSearchSettings) * 96;
  const includeBleed = wordSearchSettings.bookCanvas.includeBleed;
  const safetyMarginPx = (includeBleed ? 0.375 : 0.25) * 96;
  return { wordSearchSettings, widthPx, heightPx, marginPx, safetyMarginPx };
}
