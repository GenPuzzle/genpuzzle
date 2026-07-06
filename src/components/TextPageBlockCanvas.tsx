'use client';

import React, { useCallback, useEffect, useRef } from 'react';
import { Move } from 'lucide-react';
import type { DocumentPage, TextModuleSettings, TextPageBlock } from '@/lib/document-model';
import type { WordSearchSettings } from '@/lib/puzzles/types';
import { getPageDimensionsInches, getPageMarginInches } from '@/lib/puzzle-layout';
import {
  clampPercent,
  getMutableTextPageBlocks,
  updateTextPageBlock,
} from '@/lib/text-page-blocks';
import {
  resolveTextPageBackground,
  resolveTextPageFrameSettings,
  resolveTextPageTextColor,
} from '@/lib/text-page-settings';
import { resolvePageFrameSettings } from '@/lib/page-frame-settings';
import { cn } from '@/lib/utils';

const DRAG_THRESHOLD_PX = 4;

function PageFrameOverlay({
  frame,
  pageBackgroundColor,
  hasBackgroundImage,
}: {
  frame: ReturnType<typeof resolvePageFrameSettings>;
  pageBackgroundColor: string;
  hasBackgroundImage: boolean;
}) {
  if (!frame.enabled) return null;

  const marginPx = frame.marginSizeIn * 96;
  const cornerRadiusPx = frame.cornerRadiusPx;
  const inset = { left: marginPx, top: marginPx, right: marginPx, bottom: marginPx };

  return (
    <>
      {hasBackgroundImage && (
        <div
          className="absolute pointer-events-none z-[1]"
          style={{
            ...inset,
            borderRadius: cornerRadiusPx,
            backgroundColor: pageBackgroundColor || '#ffffff',
          }}
        />
      )}
      <div
        className="absolute pointer-events-none z-[40]"
        style={{
          ...inset,
          borderRadius: cornerRadiusPx,
          border: `${frame.strokeThicknessPx}px solid ${frame.borderColor}`,
          backgroundColor: 'transparent',
          boxSizing: 'border-box',
        }}
      />
    </>
  );
}

function blockFrameRadius(block: TextPageBlock): number | string {
  if (!block.frameEnabled) return 0;
  switch (block.frameShape) {
    case 'circle':
      return '50%';
    case 'pill':
      return 9999;
    case 'rounded':
      return block.frameCornerRadiusPx ?? 10;
    default:
      return block.frameCornerRadiusPx ?? 0;
  }
}

function DraggableTextPageBlock({
  block,
  globalSettings,
  settings,
  pageTitle,
  contentWidth,
  contentHeight,
  canvasScale,
  ptToPx,
  isSelected,
  isEditing,
  onSelect,
  onUpdate,
}: {
  block: TextPageBlock;
  globalSettings: WordSearchSettings;
  settings: TextModuleSettings;
  pageTitle: string;
  contentWidth: number;
  contentHeight: number;
  canvasScale: number;
  ptToPx: (pt: number) => number;
  isSelected: boolean;
  isEditing: boolean;
  onSelect: () => void;
  onUpdate: (patch: Partial<TextPageBlock>) => void;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    origX: number;
    origY: number;
    dragging: boolean;
    blockTextSelect: boolean;
  } | null>(null);

  const textColor = block.textColor ?? resolveTextPageTextColor(settings, globalSettings);
  const fontSizePx = ptToPx(block.fontSize);
  const leftPx = (block.xPercent / 100) * contentWidth;
  const topPx = (block.yPercent / 100) * contentHeight;
  const widthPx = (block.widthPercent / 100) * contentWidth;
  const heightPx =
    block.kind === 'image'
      ? ((block.heightPercent ?? 28) / 100) * contentHeight
      : undefined;

  const scale = canvasScale > 0 ? canvasScale : 1;

  useEffect(() => {
    if (block.kind === 'image' || !textRef.current) return;
    if (document.activeElement !== textRef.current) {
      textRef.current.textContent = block.text;
    }
  }, [block.text, block.kind]);

  const applyDragDelta = useCallback(
    (clientX: number, clientY: number) => {
      const drag = dragRef.current;
      if (!drag) return;
      const dx = (clientX - drag.startX) / scale;
      const dy = (clientY - drag.startY) / scale;
      onUpdate({
        xPercent: clampPercent(drag.origX + (dx / contentWidth) * 100),
        yPercent: clampPercent(drag.origY + (dy / contentHeight) * 100),
      });
    },
    [contentWidth, contentHeight, onUpdate, scale]
  );

  useEffect(() => {
    if (!isEditing) return;

    const onPointerMove = (event: PointerEvent) => {
      const drag = dragRef.current;
      if (!drag || drag.pointerId !== event.pointerId) return;

      const dx = Math.abs(event.clientX - drag.startX);
      const dy = Math.abs(event.clientY - drag.startY);
      if (!drag.dragging && (dx > DRAG_THRESHOLD_PX || dy > DRAG_THRESHOLD_PX)) {
        drag.dragging = true;
        if (drag.blockTextSelect && textRef.current) {
          textRef.current.blur();
          window.getSelection()?.removeAllRanges();
        }
      }
      if (!drag.dragging) return;

      event.preventDefault();
      applyDragDelta(event.clientX, event.clientY);
    };

    const endDrag = (event: PointerEvent) => {
      const drag = dragRef.current;
      if (!drag || drag.pointerId !== event.pointerId) return;
      dragRef.current = null;
      rootRef.current?.releasePointerCapture(event.pointerId);
    };

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', endDrag);
    window.addEventListener('pointercancel', endDrag);
    return () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', endDrag);
      window.removeEventListener('pointercancel', endDrag);
    };
  }, [isEditing, applyDragDelta]);

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!isEditing) return;
    event.stopPropagation();
    onSelect();

    const target = event.target as HTMLElement;
    const onText = block.kind !== 'image' && !!target.closest('.text-page-block__text');

    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      origX: block.xPercent,
      origY: block.yPercent,
      dragging: false,
      blockTextSelect: onText,
    };

    rootRef.current?.setPointerCapture(event.pointerId);
  };

  const frameStyle: React.CSSProperties = block.frameEnabled
    ? {
        border: `${block.frameBorderThicknessPx ?? 2}px solid ${block.frameBorderColor ?? '#1f2937'}`,
        borderRadius: blockFrameRadius(block),
        backgroundColor: block.frameFillColor ?? '#ffffff',
        padding: block.framePaddingPx ?? 12,
      }
    : {};

  return (
    <div
      ref={rootRef}
      className={cn(
        'text-page-block absolute',
        isSelected && isEditing && 'text-page-block--selected',
        isEditing && 'text-page-block--editable'
      )}
      style={{
        left: leftPx,
        top: topPx,
        width: widthPx,
        height: heightPx,
        zIndex: isSelected ? 30 : 20,
        touchAction: isEditing ? 'none' : undefined,
      }}
      onPointerDown={handlePointerDown}
      onClick={(event) => {
        event.stopPropagation();
        onSelect();
      }}
    >
      {isEditing && isSelected && (
        <div className="text-page-block__move-badge" title="Drag to move" aria-hidden>
          <Move className="text-page-block__move-icon" strokeWidth={2.5} />
        </div>
      )}
      <div style={frameStyle} className="text-page-block__body">
        {block.kind === 'image' ? (
          block.imageSrc ? (
            <img
              src={block.imageSrc}
              alt=""
              className="text-page-block__image pointer-events-none"
              draggable={false}
              style={{
                height: heightPx
                  ? heightPx - (block.frameEnabled ? (block.framePaddingPx ?? 12) * 2 : 0)
                  : '100%',
                objectFit: block.imageFit ?? 'contain',
                opacity: (block.imageOpacity ?? 100) / 100,
              }}
            />
          ) : (
            <div
              className="text-page-block__image-placeholder pointer-events-none"
              style={{ minHeight: heightPx ? Math.max(60, heightPx - 24) : 80 }}
            >
              Add image in panel
            </div>
          )
        ) : (
          <>
            <div
              ref={textRef}
              className={cn(
                'text-page-block__text outline-none',
                block.bold && 'font-bold',
                block.italic && 'italic',
                block.underline && 'underline'
              )}
              style={{
                fontFamily: block.fontFamily,
                fontSize: fontSizePx,
                color: textColor,
                textAlign: block.alignment,
                whiteSpace: 'pre-wrap',
                lineHeight: block.lineHeight ?? 1.35,
              }}
              contentEditable={isEditing}
              suppressContentEditableWarning
              onInput={() => {
                if (textRef.current) {
                  onUpdate({ text: textRef.current.textContent ?? '' });
                }
              }}
              onClick={(event) => event.stopPropagation()}
            />
            {block.kind === 'ownership' && block.showNameLine !== false && (
              <div
                className="text-page-block__name-line pointer-events-none"
                style={{
                  marginTop: 8,
                  borderBottom: `1px solid ${block.frameBorderColor ?? textColor}`,
                  minHeight: fontSizePx * 1.4,
                }}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}

export function TextPageBlockCanvas({
  page,
  settings,
  wordSearchSettings,
  showMargins,
  showSafetyZone,
  safetyMarginPx,
  ptToPx,
  canvasScale = 1,
  textEditEnabled = false,
  selectedBlockId = null,
  onSelectBlock,
  onSettingsChange,
  onSelectPageFrame,
}: {
  page: DocumentPage;
  settings: TextModuleSettings;
  wordSearchSettings: WordSearchSettings;
  showMargins: boolean;
  showSafetyZone: boolean;
  safetyMarginPx: number;
  ptToPx: (pt: number) => number;
  canvasScale?: number;
  textEditEnabled?: boolean;
  selectedBlockId?: string | null;
  onSelectBlock?: (blockId: string) => void;
  onSettingsChange?: (updates: Partial<TextModuleSettings>) => void;
  onSelectPageFrame?: () => void;
}) {
  const blocks = getMutableTextPageBlocks(settings, page.name, wordSearchSettings);
  const isEditing = textEditEnabled && !!onSettingsChange;

  const dims = getPageDimensionsInches(wordSearchSettings);
  const pageWidthPt = dims.width * 72;
  const pageHeightPt = dims.height * 72;
  const widthPx = ptToPx(pageWidthPt);
  const heightPx = ptToPx(pageHeightPt);
  const marginPx = ptToPx(getPageMarginInches(wordSearchSettings) * 72);
  const contentWidth = widthPx - marginPx * 2;
  const contentHeight = heightPx - marginPx * 2;

  const pageBackground = resolveTextPageBackground(settings, wordSearchSettings);
  const pageFrame = resolveTextPageFrameSettings(settings, wordSearchSettings);

  const handleBlockUpdate = useCallback(
    (blockId: string, patch: Partial<TextPageBlock>) => {
      if (!onSettingsChange) return;
      onSettingsChange(
        updateTextPageBlock(settings, blockId, patch, page.name, wordSearchSettings)
      );
    },
    [onSettingsChange, settings, page.name, wordSearchSettings]
  );

  return (
    <div
      className="relative shadow-2xl border border-gray-300 select-none transition-shadow duration-300 hover:shadow-3xl"
      style={{
        width: widthPx,
        height: heightPx,
        boxSizing: 'border-box',
        backgroundColor: pageBackground.backgroundColor || '#ffffff',
        overflow: 'hidden',
      }}
      onClick={() => {
        if (textEditEnabled) {
          onSelectPageFrame?.();
        }
      }}
    >
      {pageBackground.backgroundImage && (
        <div
          className="absolute inset-0 pointer-events-none z-0"
          style={{
            backgroundImage: `url(${pageBackground.backgroundImage})`,
            backgroundSize: pageBackground.backgroundImageFit || 'cover',
            backgroundRepeat: 'no-repeat',
            backgroundPosition: 'center',
            opacity: (pageBackground.backgroundImageOpacity ?? 100) / 100,
          }}
        />
      )}

      <PageFrameOverlay
        frame={pageFrame}
        pageBackgroundColor={pageBackground.backgroundColor || '#ffffff'}
        hasBackgroundImage={!!pageBackground.backgroundImage}
      />

      {showMargins && (
        <div
          className="absolute border border-dashed border-blue-400 pointer-events-none z-50 opacity-40"
          style={{ left: marginPx, top: marginPx, right: marginPx, bottom: marginPx }}
        >
          <span className="absolute -top-4 left-0 text-[9px] font-bold text-blue-500 bg-white/95 px-1 rounded shadow-sm">
            Print Margin
          </span>
        </div>
      )}

      {showSafetyZone && (
        <div
          className="absolute border border-dashed border-black pointer-events-none z-50 opacity-40"
          style={{
            left: safetyMarginPx,
            top: safetyMarginPx,
            right: safetyMarginPx,
            bottom: safetyMarginPx,
          }}
        >
          <span className="absolute -bottom-4 right-0 text-[9px] font-bold text-black bg-white/95 px-1 rounded shadow-sm">
            KDP Safe Zone
          </span>
        </div>
      )}

      <div
        className="absolute"
        style={{
          left: marginPx,
          top: marginPx,
          width: contentWidth,
          height: contentHeight,
          zIndex: 10,
        }}
      >
        {blocks.map((block) => (
          <DraggableTextPageBlock
            key={block.id}
            block={block}
            pageTitle={page.name}
            globalSettings={wordSearchSettings}
            settings={settings}
            contentWidth={contentWidth}
            contentHeight={contentHeight}
            canvasScale={canvasScale}
            ptToPx={ptToPx}
            isSelected={selectedBlockId === block.id}
            isEditing={isEditing}
            onSelect={() => onSelectBlock?.(block.id)}
            onUpdate={(patch) => handleBlockUpdate(block.id, patch)}
          />
        ))}
      </div>
    </div>
  );
}
