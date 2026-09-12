'use client';

import React, { useRef } from 'react';
import { Copy, RotateCcw, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useImageToPpt } from '@/lib/image-to-ppt-context';

export function ImageToPptPageRail() {
  const {
    pages,
    activePageId,
    setActivePageId,
    deletePage,
    duplicatePage,
    resetPage,
    reorderPages,
    job,
  } = useImageToPpt();
  const dragFrom = useRef<number | null>(null);

  if (!pages.length) {
    return (
      <div className="px-3 py-6 text-center text-xs text-slate-500">
        Upload PNG, JPG, JPEG, or WEBP images. Each image becomes one document page.
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="px-3 py-2 text-[11px] font-bold uppercase tracking-wide text-slate-500">
        Pages ({pages.length})
      </div>
      <div className="min-h-0 flex-1 space-y-2 overflow-auto px-2 pb-3">
        {pages.map((page, index) => {
          const active = page.id === activePageId;
          const failed = job.failedPageIds.includes(page.id) || page.status === 'error';
          return (
            <div
              key={page.id}
              draggable
              onDragStart={() => {
                dragFrom.current = index;
              }}
              onDragOver={(event) => event.preventDefault()}
              onDrop={() => {
                if (dragFrom.current == null || dragFrom.current === index) return;
                reorderPages(dragFrom.current, index);
                dragFrom.current = null;
              }}
              className={cn(
                'rounded-xl border bg-white p-2 shadow-sm transition-colors dark:bg-slate-900',
                active ? 'border-[var(--gp-blue)] ring-2 ring-[var(--gp-blue)]/20' : 'border-slate-200 dark:border-slate-700',
                failed && 'border-red-400'
              )}
            >
              <button
                type="button"
                onClick={() => setActivePageId(page.id)}
                className="flex w-full items-start gap-2 text-left"
              >
                <img
                  src={page.thumbnailUrl}
                  alt=""
                  className="h-16 w-12 shrink-0 rounded-md object-cover bg-slate-100"
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-xs font-semibold text-slate-800 dark:text-slate-100">
                    {index + 1}. {page.name}
                  </span>
                  <span className="mt-1 block text-[10px] font-medium text-slate-500">
                    {page.stageLabel || page.status}
                  </span>
                  {page.status === 'ready' && (
                    <span className="mt-1 block text-[10px] text-slate-500">
                      {page.detections.filter((item) => item.kind === 'text').length} text
                      {' · '}
                      {page.detections.filter((item) => item.kind === 'graphic' && item.svgMarkup).length} SVG
                      {page.detections.some((item) => item.kind === 'keep-original')
                        ? ` · ${page.detections.filter((item) => item.kind === 'keep-original').length} photo`
                        : ''}
                    </span>
                  )}
                  {page.error && (
                    <span className="mt-1 block text-[10px] text-red-600">{page.error}</span>
                  )}
                </span>
              </button>
              <div className="mt-2 flex justify-end gap-1">
                <button
                  type="button"
                  title="Duplicate page"
                  className="rounded-md p-1 text-slate-500 hover:bg-slate-100"
                  onClick={() => void duplicatePage(page.id)}
                >
                  <Copy className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  title="Reset to original"
                  className="rounded-md p-1 text-slate-500 hover:bg-slate-100"
                  onClick={() => void resetPage(page.id)}
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  title="Delete page"
                  className="rounded-md p-1 text-red-500 hover:bg-red-50"
                  onClick={() => deletePage(page.id)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
