'use client';

import React, { useCallback, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { TextPageBlockCanvas } from '@/components/TextPageBlockCanvas';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { isTextModuleSettings, type TextModuleSettings } from '@/lib/document-model';
import { makeFullPageImageBlock } from '@/lib/image-to-ppt/reconstruct';
import { IMAGE_TO_PPT_ACCEPT } from '@/lib/image-to-ppt/types';
import { useImageToPpt } from '@/lib/image-to-ppt-context';
import { ImageToPptReviewOverlay, useImageToPptPageMetrics } from '@/components/image-to-ppt/ImageToPptReviewOverlay';
import '@/components/preview-canvas-toolbar.css';

export function ImageToPptCanvasStage() {
  const {
    pages,
    activePage,
    activeDocumentPage,
    activePageId,
    selectedBlockId,
    reviewMode,
    showMargins,
    showSafetyZone,
    previewZoom,
    setPreviewZoom,
    setShowMargins,
    setShowSafetyZone,
    setActivePageId,
    selectBlock,
    updateActiveTextSettings,
    deleteActiveBlock,
    uploadFiles,
    addMoreImages,
    job,
  } = useImageToPpt();
  const { wordSearchSettings, widthPx, heightPx, marginPx, safetyMarginPx } = useImageToPptPageMetrics();
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const [dragging, setDragging] = useState(false);
  const ptToPx = useCallback((pt: number) => pt * (96 / 72), []);
  const reviewDocumentPage =
    reviewMode && activePage && activeDocumentPage && isTextModuleSettings(activeDocumentPage.settings)
      ? {
          ...activeDocumentPage,
          settings: {
            ...activeDocumentPage.settings,
            blocks: [
              makeFullPageImageBlock(
                activePage.previewUrl,
                activePage.sourceWidth,
                activePage.sourceHeight
              ),
            ],
            backgroundImage: undefined,
          } satisfies TextModuleSettings,
        }
      : activeDocumentPage;

  const onDrop = async (event: React.DragEvent) => {
    event.preventDefault();
    setDragging(false);
    const files = event.dataTransfer.files;
    if (!files?.length) return;
    if (pages.length) await addMoreImages(files);
    else await uploadFiles(files, true);
  };

  const activeIndex = Math.max(0, pages.findIndex((page) => page.id === activePageId));

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      <div className="preview-top-toolbar">
        <div className="preview-top-toolbar__guides preview-top-toolbar__guides--desktop">
          <Checkbox compact label="Margins" checked={showMargins} onCheckedChange={setShowMargins} />
          <Checkbox compact label="KDP Bleed Safe Zone" checked={showSafetyZone} onCheckedChange={setShowSafetyZone} />
        </div>
        <div className="preview-compact-toolbar__zoom ml-auto flex items-center gap-2 pr-3">
          <span className="preview-compact-toolbar__label">Zoom</span>
          <button type="button" className="preview-zoom-btn" onClick={() => setPreviewZoom(Math.max(25, previewZoom - 5))}>
            −
          </button>
          <span className="min-w-[2.5rem] text-center text-xs font-bold text-slate-700">{previewZoom}%</span>
          <button type="button" className="preview-zoom-btn" onClick={() => setPreviewZoom(Math.min(150, previewZoom + 5))}>
            +
          </button>
        </div>
      </div>

      <div
        ref={viewportRef}
        className={cn('preview-viewport preview-viewport--text-edit relative flex-1', dragging && 'ring-2 ring-[var(--gp-blue)]')}
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
      >
        {!reviewDocumentPage || !isTextModuleSettings(reviewDocumentPage.settings) ? (
          <label className="m-auto flex h-[min(28rem,70%)] w-[min(36rem,90%)] cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-300 bg-white/80 text-center text-sm text-slate-600">
            <span className="font-semibold text-slate-800">Drop images here</span>
            <span className="mt-1 text-xs">PNG, JPG, JPEG, or WEBP. Each image becomes one page.</span>
            <input
              type="file"
              accept={IMAGE_TO_PPT_ACCEPT}
              multiple
              className="hidden"
              onChange={(event) => {
                if (event.target.files?.length) void uploadFiles(event.target.files, true);
                event.target.value = '';
              }}
            />
          </label>
        ) : (
          <div className="flex min-h-full items-start justify-center py-4">
            <div
              className="preview-canvas-scale preview-canvas-scale--text-edit origin-top shrink-0"
              style={{
                transform: `scale(${previewZoom / 100})`,
                transformOrigin: 'top center',
                width: widthPx,
              }}
            >
              <div className="relative" style={{ width: widthPx, height: heightPx }}>
                <TextPageBlockCanvas
                  page={reviewDocumentPage}
                  settings={reviewDocumentPage.settings}
                  wordSearchSettings={wordSearchSettings}
                  showMargins={showMargins}
                  showSafetyZone={showSafetyZone}
                  safetyMarginPx={safetyMarginPx}
                  ptToPx={ptToPx}
                  canvasScale={previewZoom / 100}
                  textEditEnabled={!reviewMode}
                  selectedBlockId={reviewMode ? null : selectedBlockId}
                  showBlockChrome={!reviewMode}
                  onSelectBlock={reviewMode ? undefined : selectBlock}
                  onSettingsChange={reviewMode ? undefined : updateActiveTextSettings}
                  onCanvasBackgroundClick={() => selectBlock(null)}
                  onDeleteBlock={reviewMode ? undefined : deleteActiveBlock}
                />
                <ImageToPptReviewOverlay
                  pageWidthPx={widthPx}
                  pageHeightPx={heightPx}
                  marginPx={marginPx}
                />
              </div>
            </div>
          </div>
        )}
        {job.active && (
          <div className="pointer-events-none absolute bottom-4 left-1/2 z-50 w-[min(28rem,calc(100%-2rem))] -translate-x-1/2 rounded-xl border border-slate-200 bg-white/95 p-3 text-center shadow-xl">
            <div className="text-sm font-semibold text-slate-800">
              Processing {job.current} of {job.total} pages
            </div>
            <div className="mt-1 text-xs text-slate-500">{job.pageName}</div>
            <div className="mt-1 text-xs font-medium text-[var(--gp-blue)]">{job.stageLabel}</div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-200">
              <div
                className="h-full bg-[var(--gp-blue)]"
                style={{ width: `${job.total ? (job.current / job.total) * 100 : 0}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {pages.length > 0 && (
        <div className="preview-pagination-bar">
          <div className="preview-pagination-bar__row">
            <div className="preview-pagination-bar__group">
              <Button
                size="xs"
                variant="outline"
                disabled={activeIndex <= 0}
                onClick={() => setActivePageId(pages[activeIndex - 1].id)}
              >
                <ChevronLeft className="h-3 w-3" />
              </Button>
              <span className="text-[10px] font-bold text-slate-600">
                {activeIndex + 1} / {pages.length}
              </span>
              <Button
                size="xs"
                variant="outline"
                disabled={activeIndex >= pages.length - 1}
                onClick={() => setActivePageId(pages[activeIndex + 1].id)}
              >
                <ChevronRight className="h-3 w-3" />
              </Button>
              {activePage?.name && (
                <span className="preview-pagination-bar__doc-name text-[9px] font-semibold text-slate-500">
                  {activePage.name}
                </span>
              )}
            </div>
            <div className="preview-pagination-bar__sep hidden sm:block" aria-hidden />
            <div className="preview-pagination-bar__group preview-pagination-bar__zoom">
              <span className="min-w-[32px] text-center text-[10px] font-bold text-slate-600">{previewZoom}%</span>
              <input
                type="range"
                min={25}
                max={150}
                value={previewZoom}
                onChange={(event) => setPreviewZoom(Number(event.target.value))}
                className="preview-pagination-bar__zoom-slider w-24"
                aria-label="Zoom level"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
