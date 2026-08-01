'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Trash2, Move, ArrowUp, ArrowDown } from 'lucide-react';
import type { DocumentPage, TextModuleSettings, TextPageBlock } from '@/lib/document-model';
import type { WordSearchSettings } from '@/lib/puzzles/types';
import { getPageDimensionsInches, getPageMarginInches } from '@/lib/puzzle-layout';
import {
  clampPercent,
  getMutableTextPageBlocks,
  ownershipNameLineIsVisible,
  reorderTextPageBlock,
  resolveOwnershipNameLineType,
  updateTextPageBlock,
} from '@/lib/text-page-blocks';
import {
  resolveTextPageBackground,
  resolveTextPageFrameSettings,
  resolveReadableTextPageColor,
} from '@/lib/text-page-settings';
import { resolvePageFrameSettings } from '@/lib/page-frame-settings';
import { cn } from '@/lib/utils';
import {
  constrainCornerResizeToBoxAspect,
  loadImageNaturalSize,
} from '@/lib/text-page-image-layout';
import {
  buildImageEffectOptions,
  imageEffectCssFilter,
  processImageEffect,
} from '@/lib/text-page-image-effects';
import { captureTextBlockSelection, notifyTextBlockSelectionChange, readRichTextFromElement } from '@/lib/text-page-rich-text';
import './canvas-contextual-controls.css';

const MIN_WIDTH_PERCENT = 6;
const MIN_HEIGHT_PERCENT = 4;
const CHROME_INSET_PX = 14;
const ROTATE_ZONE_PX = 48;
const HANDLE_SIZE_PX = 12;

type ResizeMode = 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w' | 'nw';

const RESIZE_HANDLES: Array<{ mode: ResizeMode; label: string }> = [
  { mode: 'nw', label: 'Resize top-left' },
  { mode: 'n', label: 'Resize top' },
  { mode: 'ne', label: 'Resize top-right' },
  { mode: 'e', label: 'Resize right' },
  { mode: 'se', label: 'Resize bottom-right' },
  { mode: 's', label: 'Resize bottom' },
  { mode: 'sw', label: 'Resize bottom-left' },
  { mode: 'w', label: 'Resize left' },
];

const HANDLE_HALF = HANDLE_SIZE_PX / 2;

function resizeHandleStyle(mode: ResizeMode): React.CSSProperties {
  const base: React.CSSProperties = {
    position: 'absolute',
    width: HANDLE_SIZE_PX,
    height: HANDLE_SIZE_PX,
    margin: 0,
    padding: 0,
    backgroundColor: '#ffffff',
    border: '2px solid #0078d4',
    borderRadius: 1,
    boxSizing: 'border-box',
    boxShadow: '0 1px 3px rgba(15, 23, 42, 0.25)',
    zIndex: 100,
    pointerEvents: 'auto',
    touchAction: 'none',
  };

  switch (mode) {
    case 'nw':
      return { ...base, top: 1, left: 1, cursor: 'nwse-resize' };
    case 'n':
      return { ...base, top: 1, left: `calc(50% - ${HANDLE_HALF}px)`, cursor: 'ns-resize' };
    case 'ne':
      return { ...base, top: 1, right: 1, cursor: 'nesw-resize' };
    case 'e':
      return { ...base, top: `calc(50% - ${HANDLE_HALF}px)`, right: 1, cursor: 'ew-resize' };
    case 'se':
      return { ...base, bottom: 1, right: 1, cursor: 'nwse-resize' };
    case 's':
      return { ...base, bottom: 1, left: `calc(50% - ${HANDLE_HALF}px)`, cursor: 'ns-resize' };
    case 'sw':
      return { ...base, bottom: 1, left: 1, cursor: 'nesw-resize' };
    case 'w':
      return { ...base, top: `calc(50% - ${HANDLE_HALF}px)`, left: 1, cursor: 'ew-resize' };
    default:
      return base;
  }
}

function pointerAngleDeg(clientX: number, clientY: number, centerX: number, centerY: number): number {
  return (Math.atan2(clientY - centerY, clientX - centerX) * 180) / Math.PI;
}

function RotateHandleIcon() {
  return (
    <svg
      className="text-page-block__rotate-icon"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <path
        d="M21 12a9 9 0 1 1-3-6.7M21 3v6h-6"
        stroke="#0f172a"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function FlipHorizontalIcon() {
  return (
    <svg
      className="text-page-block__tool-icon"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <path
        d="M8 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h3M16 3h3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-3M12 20v2M12 14v2M12 8v2M12 2v2"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function FlipVerticalIcon() {
  return (
    <svg
      className="text-page-block__tool-icon"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <path
        d="M3 8V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v3M3 16v3a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-3M20 12h2M14 12h2M8 12h2M2 12h2"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function resolveImageObjectFit(
  fit?: TextPageBlock['imageFit']
): React.CSSProperties['objectFit'] {
  // Canvas editing always fills the selection box so handles match visible image edges.
  if (fit === 'stretch' || !fit) return 'fill';
  if (fit === 'cover') return 'cover';
  return 'contain';
}

function canvasImageObjectFit(): React.CSSProperties['objectFit'] {
  return 'fill';
}

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
  contentWidth,
  contentHeight,
  canvasScale,
  ptToPx,
  isSelected,
  showChrome,
  stackIndex,
  totalBlocks,
  isEditing,
  onSelect,
  onUpdate,
  onDelete,
  onBringForward,
  onSendBackward,
  canDelete = false,
  onInteractionStart,
}: {
  block: TextPageBlock;
  globalSettings: WordSearchSettings;
  settings: TextModuleSettings;
  contentWidth: number;
  contentHeight: number;
  canvasScale: number;
  ptToPx: (pt: number) => number;
  isSelected: boolean;
  showChrome: boolean;
  stackIndex: number;
  totalBlocks: number;
  isEditing: boolean;
  onSelect: () => void;
  onUpdate: (patch: Partial<TextPageBlock>, options?: { recordHistory?: boolean }) => void;
  onInteractionStart?: () => void;
  onDelete?: () => void;
  onBringForward?: () => void;
  onSendBackward?: () => void;
  canDelete?: boolean;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    origX: number;
    origY: number;
  } | null>(null);
  const resizeRef = useRef<{
    pointerId: number;
    mode: ResizeMode;
    startX: number;
    startY: number;
    origX: number;
    origY: number;
    origW: number;
    origH: number;
    origRotation: number;
  } | null>(null);
  const rotateRef = useRef<{
    pointerId: number;
    startAngle: number;
    origRotation: number;
    centerX: number;
    centerY: number;
  } | null>(null);

  const textColor = resolveReadableTextPageColor(block.textColor, settings, globalSettings);
  const fontSizePx = ptToPx(block.fontSize);
  const leftPx = (block.xPercent / 100) * contentWidth;
  const topPx = (block.yPercent / 100) * contentHeight;
  const widthPx = (block.widthPercent / 100) * contentWidth;
  const heightPercent = block.heightPercent ?? (block.kind === 'image' ? 28 : 18);
  const heightPx = (heightPercent / 100) * contentHeight;
  const boxPadding = block.boxPaddingPx ?? 10;
  const rotationDeg = block.rotationDeg ?? 0;

  const scale = canvasScale > 0 ? canvasScale : 1;
  const isImageBlock = block.kind === 'image';
  const isTextBox = block.kind === 'text';
  const fittedImageSrcRef = useRef<string | null>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const [processedImageSrc, setProcessedImageSrc] = useState<string | null>(null);
  const imageEffect = block.imageEffect ?? 'none';

  useEffect(() => {
    if (!isImageBlock || !block.imageSrc || imageEffect === 'none' || imageEffect === 'coloring-page') {
      setProcessedImageSrc(null);
      return;
    }

    let cancelled = false;
    const effectOptions = buildImageEffectOptions(block);
    processImageEffect(block.imageSrc, imageEffect, effectOptions)
      .then((result) => {
        if (cancelled) return;
        setProcessedImageSrc(result.src);
      })
      .catch(() => {
        if (!cancelled) setProcessedImageSrc(null);
      });

    return () => {
      cancelled = true;
    };
  }, [
    isImageBlock,
    block.imageSrc,
    imageEffect,
    block.imageEffectLumCutoff,
    block.imageEffectSatCutoff,
    block.imageEffectEdgeThreshold,
    block.imageGrayscaleContrast,
  ]);

  const displayImageSrc =
    imageEffect === 'none' || imageEffect === 'coloring-page'
      ? block.imageSrc
      : processedImageSrc ?? block.imageSrc;

  // Stamp natural size metadata only — never re-fit geometry on remount/tab switch.
  // Auto-fit belongs in add/replace-image handlers, not here.
  useEffect(() => {
    if (!isImageBlock || !block.imageSrc || !isEditing) return;
    if (fittedImageSrcRef.current === block.imageSrc) return;
    if (
      block.imageNaturalWidth &&
      block.imageNaturalHeight &&
      block.imageNaturalWidth > 0 &&
      block.imageNaturalHeight > 0
    ) {
      fittedImageSrcRef.current = block.imageSrc;
      return;
    }

    let cancelled = false;
    loadImageNaturalSize(block.imageSrc)
      .then(({ width, height }) => {
        if (cancelled) return;
        fittedImageSrcRef.current = block.imageSrc ?? null;
        if (block.imageNaturalWidth === width && block.imageNaturalHeight === height) return;
        onUpdate(
          { imageNaturalWidth: width, imageNaturalHeight: height },
          { recordHistory: false }
        );
      })
      .catch(() => {
        fittedImageSrcRef.current = block.imageSrc ?? null;
      });

    return () => {
      cancelled = true;
    };
  }, [
    isImageBlock,
    isEditing,
    block.imageSrc,
    block.id,
    block.imageNaturalWidth,
    block.imageNaturalHeight,
    onUpdate,
  ]);

  useEffect(() => {
    if (isImageBlock || !textRef.current) return;
    if (document.activeElement === textRef.current) return;

    const el = textRef.current;
    if (block.richTextHtml) {
      if (el.innerHTML !== block.richTextHtml) {
        el.innerHTML = block.richTextHtml;
      }
      return;
    }

    if (el.textContent !== block.text) {
      el.textContent = block.text;
    }
  }, [block.text, block.richTextHtml, isImageBlock]);

  useEffect(() => {
    if (!isEditing || isImageBlock || !textRef.current) return;

    const el = textRef.current;
    const onSelectionChange = () => {
      captureTextBlockSelection(block.id, el);
    };

    document.addEventListener('selectionchange', onSelectionChange);
    return () => document.removeEventListener('selectionchange', onSelectionChange);
  }, [block.id, isEditing, isImageBlock]);

  useEffect(() => {
    if (!isSelected || !isEditing || isImageBlock || !textRef.current) return;
    textRef.current.focus();
    if (!block.text.trim()) {
      const selection = window.getSelection();
      if (!selection || !textRef.current) return;
      const range = document.createRange();
      range.selectNodeContents(textRef.current);
      range.collapse(true);
      selection.removeAllRanges();
      selection.addRange(range);
    }
  }, [isSelected, isEditing, isImageBlock, block.id]);

  const applyDragDelta = useCallback(
    (clientX: number, clientY: number) => {
      const drag = dragRef.current;
      if (!drag) return;
      const dx = (clientX - drag.startX) / scale;
      const dy = (clientY - drag.startY) / scale;
      onUpdate(
        {
          xPercent: clampPercent(
            drag.origX + (dx / contentWidth) * 100,
            0,
            100 - block.widthPercent
          ),
          yPercent: clampPercent(
            drag.origY + (dy / contentHeight) * 100,
            0,
            100 - heightPercent
          ),
        },
        { recordHistory: false }
      );
    },
    [contentWidth, contentHeight, onUpdate, scale, block.widthPercent, heightPercent]
  );

  const applyResizeDelta = useCallback(
    (clientX: number, clientY: number) => {
      const resize = resizeRef.current;
      if (!resize) return;

      const dxPx = (clientX - resize.startX) / scale;
      const dyPx = (clientY - resize.startY) / scale;
      let dxPct = (dxPx / contentWidth) * 100;
      let dyPct = (dyPx / contentHeight) * 100;

      const theta = (-resize.origRotation * Math.PI) / 180;
      const localDx = dxPct * Math.cos(theta) - dyPct * Math.sin(theta);
      const localDy = dxPct * Math.sin(theta) + dyPct * Math.cos(theta);
      dxPct = localDx;
      dyPct = localDy;

      const mode = resize.mode;
      let x = resize.origX;
      let y = resize.origY;
      let w = resize.origW;
      let h = resize.origH;

      if (mode.includes('e')) w = resize.origW + dxPct;
      if (mode.includes('w')) {
        w = resize.origW - dxPct;
        x = resize.origX + dxPct;
      }
      if (mode.includes('s')) h = resize.origH + dyPct;
      if (mode.includes('n')) {
        h = resize.origH - dyPct;
        y = resize.origY + dyPct;
      }

      if (isImageBlock && mode.length === 2) {
        ({ x, y, w, h } = constrainCornerResizeToBoxAspect(
          mode,
          { x, y, w, h },
          {
            x: resize.origX,
            y: resize.origY,
            w: resize.origW,
            h: resize.origH,
          }
        ));
      }

      w = clampPercent(w, MIN_WIDTH_PERCENT, 100);
      h = clampPercent(h, MIN_HEIGHT_PERCENT, 100);
      x = clampPercent(x, 0, 100 - w);
      y = clampPercent(y, 0, 100 - h);

      onUpdate(
        {
          xPercent: x,
          yPercent: y,
          widthPercent: w,
          heightPercent: h,
          ...(isImageBlock ? { imageFit: 'stretch' as const } : {}),
        },
        { recordHistory: false }
      );
    },
    [contentWidth, contentHeight, onUpdate, scale, isImageBlock]
  );

  const applyRotateDelta = useCallback((clientX: number, clientY: number) => {
    const rotate = rotateRef.current;
    if (!rotate) return;
    const angle = pointerAngleDeg(clientX, clientY, rotate.centerX, rotate.centerY);
    const delta = angle - rotate.startAngle;
    let next = rotate.origRotation + delta;
    while (next > 180) next -= 360;
    while (next < -180) next += 360;
    onUpdate({ rotationDeg: Math.round(next * 10) / 10 }, { recordHistory: false });
  }, [onUpdate]);

  useEffect(() => {
    if (!isEditing) return;

    const onPointerMove = (event: PointerEvent) => {
      if (rotateRef.current?.pointerId === event.pointerId) {
        event.preventDefault();
        applyRotateDelta(event.clientX, event.clientY);
        return;
      }

      const resize = resizeRef.current;
      if (resize && resize.pointerId === event.pointerId) {
        event.preventDefault();
        applyResizeDelta(event.clientX, event.clientY);
        return;
      }

      const drag = dragRef.current;
      if (!drag || drag.pointerId !== event.pointerId) return;

      event.preventDefault();
      applyDragDelta(event.clientX, event.clientY);
    };

    const endInteraction = (event: PointerEvent) => {
      if (rotateRef.current?.pointerId === event.pointerId) {
        rotateRef.current = null;
      }
      if (resizeRef.current?.pointerId === event.pointerId) {
        resizeRef.current = null;
      }
      if (dragRef.current?.pointerId === event.pointerId) {
        dragRef.current = null;
      }
      try {
        (event.target as Element)?.releasePointerCapture?.(event.pointerId);
      } catch {
        // ignore
      }
    };

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', endInteraction);
    window.addEventListener('pointercancel', endInteraction);
    return () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', endInteraction);
      window.removeEventListener('pointercancel', endInteraction);
    };
  }, [isEditing, applyDragDelta, applyResizeDelta, applyRotateDelta]);

  const beginPointerInteraction = () => {
    onInteractionStart?.();
  };

  const handleDragPointerDown = (event: React.PointerEvent<HTMLElement>) => {
    if (!isEditing) return;
    event.stopPropagation();
    event.preventDefault();
    onSelect();
    beginPointerInteraction();

    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      origX: block.xPercent,
      origY: block.yPercent,
    };

    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handleTextPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!isEditing) return;
    event.stopPropagation();
    onSelect();

    const el = textRef.current;
    if (!el) return;

    // Always restore the caret when re-selecting (especially empty boxes).
    window.requestAnimationFrame(() => {
      if (!textRef.current) return;
      textRef.current.focus();
      if (!(textRef.current.textContent ?? '').trim()) {
        const selection = window.getSelection();
        if (!selection) return;
        const range = document.createRange();
        range.selectNodeContents(textRef.current);
        range.collapse(true);
        selection.removeAllRanges();
        selection.addRange(range);
      }
      captureTextBlockSelection(block.id, textRef.current);
      notifyTextBlockSelectionChange(block.id);
    });
  };

  const handleFlipClick = (axis: 'horizontal' | 'vertical') => {
    if (!isEditing || !isImageBlock) return;
    onSelect();
    if (axis === 'horizontal') {
      onUpdate({ imageFlipHorizontal: !block.imageFlipHorizontal });
    } else {
      onUpdate({ imageFlipVertical: !block.imageFlipVertical });
    }
  };

  const handleResizePointerDown = (
    event: React.PointerEvent<HTMLDivElement>,
    mode: ResizeMode
  ) => {
    if (!isEditing) return;
    event.stopPropagation();
    event.preventDefault();
    onSelect();
    beginPointerInteraction();
    dragRef.current = null;
    rotateRef.current = null;

    resizeRef.current = {
      pointerId: event.pointerId,
      mode,
      startX: event.clientX,
      startY: event.clientY,
      origX: block.xPercent,
      origY: block.yPercent,
      origW: block.widthPercent,
      origH: heightPercent,
      origRotation: rotationDeg,
    };

    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handleRotatePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!isEditing || !innerRef.current) return;
    event.stopPropagation();
    event.preventDefault();
    onSelect();
    beginPointerInteraction();
    dragRef.current = null;
    resizeRef.current = null;

    const rect = innerRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    rotateRef.current = {
      pointerId: event.pointerId,
      startAngle: pointerAngleDeg(event.clientX, event.clientY, centerX, centerY),
      origRotation: rotationDeg,
      centerX,
      centerY,
    };

    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handleDeleteClick = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (!isEditing || !canDelete || !onDelete) return;
    event.stopPropagation();
    event.preventDefault();
    onDelete();
  };

  const frameStyle: React.CSSProperties = block.frameEnabled
    ? {
        border: `${block.frameBorderThicknessPx ?? 2}px solid ${block.frameBorderColor ?? '#1f2937'}`,
        borderRadius: blockFrameRadius(block),
        backgroundColor: block.frameFillColor ?? '#ffffff',
        padding: block.framePaddingPx ?? 12,
      }
    : {
        padding: isImageBlock ? 0 : boxPadding,
      };

  const rotationTransform = rotationDeg ? `rotate(${rotationDeg}deg)` : undefined;
  const imageFlipTransform =
    isImageBlock && (block.imageFlipHorizontal || block.imageFlipVertical)
      ? `scale(${block.imageFlipHorizontal ? -1 : 1}, ${block.imageFlipVertical ? -1 : 1})`
      : undefined;
  const layerBoxStyle: React.CSSProperties = {
    position: 'absolute',
    left: CHROME_INSET_PX,
    top: ROTATE_ZONE_PX + CHROME_INSET_PX,
    width: widthPx,
    height: heightPx,
    transform: rotationTransform,
    transformOrigin: 'center center',
  };

  const canBringForward = stackIndex < totalBlocks - 1;
  const canSendBackward = stackIndex > 0;
  const chromeVisible = isEditing && isSelected && showChrome;

  const blockBoxStyle: React.CSSProperties = {
    position: 'absolute',
    left: leftPx - CHROME_INSET_PX,
    top: topPx - CHROME_INSET_PX - ROTATE_ZONE_PX,
    width: widthPx + CHROME_INSET_PX * 2,
    height: heightPx + CHROME_INSET_PX * 2 + ROTATE_ZONE_PX,
    boxSizing: 'border-box',
    overflow: 'visible',
  };

  return (
    <>
      <div
        ref={rootRef}
        className={cn(
          'text-page-block absolute',
          isEditing && 'text-page-block--editable',
          isTextBox && isEditing && 'text-page-block--ppt-box',
          isImageBlock && 'text-page-block--image',
          isEditing && isSelected && 'text-page-block--selected'
        )}
        style={{
          ...blockBoxStyle,
          zIndex: 20 + stackIndex,
          touchAction: isEditing && isImageBlock ? 'none' : undefined,
        }}
        onClick={(event) => {
          event.stopPropagation();
          onSelect();
          if (!isEditing || isImageBlock || !textRef.current) return;
          window.requestAnimationFrame(() => {
            if (!textRef.current) return;
            textRef.current.focus();
            if (!(textRef.current.textContent ?? '').trim()) {
              const selection = window.getSelection();
              if (!selection) return;
              const range = document.createRange();
              range.selectNodeContents(textRef.current);
              range.collapse(true);
              selection.removeAllRanges();
              selection.addRange(range);
            }
          });
        }}
      >
      <div
        ref={innerRef}
        className={cn(
          'text-page-block__transform-layer',
          isImageBlock && 'text-page-block__transform-layer--image'
        )}
        style={layerBoxStyle}
      >
        <div className="text-page-block__content-layer">
          <div
          style={frameStyle}
          className={cn(
            'text-page-block__body',
            isEditing && !block.frameEnabled && 'text-page-block__body--box',
            block.frameEnabled && 'text-page-block__body--framed',
            block.kind === 'ownership' && 'text-page-block__body--ownership',
            isImageBlock && 'text-page-block__body--image',
            isEditing && !isImageBlock && 'text-page-block__body--pass-through'
          )}
          onPointerDown={isEditing && isImageBlock ? handleDragPointerDown : undefined}
        >
        {isImageBlock ? (
          block.imageSrc ? (
            <div
              className="text-page-block__image-wrap"
              style={
                imageFlipTransform
                  ? {
                      transform: imageFlipTransform,
                      transformOrigin: 'center center',
                    }
                  : undefined
              }
            >
              <img
                ref={imageRef}
                src={displayImageSrc}
                alt=""
                className="text-page-block__image pointer-events-none"
                draggable={false}
                style={{
                  objectFit: isEditing ? canvasImageObjectFit() : resolveImageObjectFit(block.imageFit),
                  opacity: (block.imageOpacity ?? 100) / 100,
                  filter: imageEffectCssFilter(imageEffect),
                }}
                onLoad={(event) => {
                  const nw = event.currentTarget.naturalWidth;
                  const nh = event.currentTarget.naturalHeight;
                  if (nw <= 0 || nh <= 0) return;
                  if (block.imageNaturalWidth === nw && block.imageNaturalHeight === nh) return;
                  onUpdate(
                    {
                      imageNaturalWidth: nw,
                      imageNaturalHeight: nh,
                    },
                    { recordHistory: false }
                  );
                }}
              />
            </div>
          ) : (
            <div className="text-page-block__image-placeholder pointer-events-none">
              Add image in panel
            </div>
          )
        ) : (
          <>
            <div
              ref={textRef}
              data-text-block-id={block.id}
              className={cn(
                'text-page-block__text outline-none',
                !block.richTextHtml && block.bold && 'font-bold',
                !block.richTextHtml && block.italic && 'italic',
                !block.richTextHtml && block.underline && 'underline',
                block.kind === 'ownership' && 'text-page-block__text--ownership',
                !block.text.trim() && block.kind !== 'ownership' && 'text-page-block__text--empty'
              )}
              style={{
                fontFamily: block.fontFamily,
                fontSize: fontSizePx,
                color: textColor,
                caretColor: textColor,
                textAlign: block.alignment,
                whiteSpace: 'pre-wrap',
                lineHeight: block.lineHeight ?? 1.35,
                wordSpacing: block.wordSpacingPx ? `${block.wordSpacingPx}px` : undefined,
                letterSpacing: block.letterSpacingPx ? `${block.letterSpacingPx}px` : undefined,
              }}
              contentEditable={isEditing}
              suppressContentEditableWarning
              onPointerDown={handleTextPointerDown}
              onMouseUp={() => {
                if (!textRef.current) return;
                captureTextBlockSelection(block.id, textRef.current);
                notifyTextBlockSelectionChange(block.id);
              }}
              onKeyDown={(event) => {
                if (!textRef.current) return;
                if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'a') {
                  window.requestAnimationFrame(() => {
                    if (!textRef.current) return;
                    captureTextBlockSelection(block.id, textRef.current);
                    notifyTextBlockSelectionChange(block.id);
                  });
                }
              }}
              onKeyUp={() => {
                if (!textRef.current) return;
                captureTextBlockSelection(block.id, textRef.current);
                notifyTextBlockSelectionChange(block.id);
              }}
              onInput={() => {
                if (!textRef.current) return;
                onUpdate(readRichTextFromElement(textRef.current));
                notifyTextBlockSelectionChange(block.id);
              }}
              onClick={(event) => event.stopPropagation()}
            />
            {block.kind === 'ownership' && (() => {
              const nameLineType = resolveOwnershipNameLineType(block);
              if (!ownershipNameLineIsVisible(nameLineType)) return null;
              const lineColor = block.frameBorderColor ?? textColor;
              return (
                <div
                  className="text-page-block__name-line pointer-events-none"
                  style={{
                    borderBottom: `1px ${nameLineType} ${lineColor}`,
                    minHeight: fontSizePx * 1.4,
                  }}
                />
              );
            })()}
          </>
        )}
          </div>
        </div>
      </div>
      </div>

      {chromeVisible && (
        <div
          className={cn(
            'text-page-block text-page-block--chrome-host absolute',
            'text-page-block--selected',
            isImageBlock && 'text-page-block--image'
          )}
          style={{
            ...blockBoxStyle,
            zIndex: 20 + totalBlocks + stackIndex,
            pointerEvents: 'none',
          }}
        >
          <div className="text-page-block__chrome" style={layerBoxStyle}>
            <div className="text-page-block__selection-outline" aria-hidden />
            <div
              className="text-page-block__outline-drag text-page-block__outline-drag--top"
              onPointerDown={handleDragPointerDown}
              title="Drag to move"
              aria-label="Drag top edge to move"
            />
            <div
              className="text-page-block__outline-drag text-page-block__outline-drag--right"
              onPointerDown={handleDragPointerDown}
              title="Drag to move"
              aria-label="Drag right edge to move"
            />
            <div
              className="text-page-block__outline-drag text-page-block__outline-drag--bottom"
              onPointerDown={handleDragPointerDown}
              title="Drag to move"
              aria-label="Drag bottom edge to move"
            />
            <div
              className="text-page-block__outline-drag text-page-block__outline-drag--left"
              onPointerDown={handleDragPointerDown}
              title="Drag to move"
              aria-label="Drag left edge to move"
            />
            <div className="text-page-block__rotate-stem" aria-hidden />
            <div className="text-page-block__chrome-actions">
              <button
                type="button"
                className="text-page-block__tool-handle text-page-block__move-handle"
                onPointerDown={handleDragPointerDown}
                title="Move"
                aria-label="Move"
              >
                <Move className="text-page-block__tool-icon" strokeWidth={2.25} />
              </button>
              <button
                type="button"
                className="text-page-block__tool-handle"
                disabled={!canBringForward}
                onClick={(event) => {
                  event.stopPropagation();
                  onSelect();
                  onBringForward?.();
                }}
                title="Bring forward"
                aria-label="Bring forward"
              >
                <ArrowUp className="text-page-block__tool-icon" strokeWidth={2.25} />
              </button>
              <button
                type="button"
                className="text-page-block__tool-handle"
                disabled={!canSendBackward}
                onClick={(event) => {
                  event.stopPropagation();
                  onSelect();
                  onSendBackward?.();
                }}
                title="Send backward"
                aria-label="Send backward"
              >
                <ArrowDown className="text-page-block__tool-icon" strokeWidth={2.25} />
              </button>
              {isImageBlock && (
                <>
                  <button
                    type="button"
                    className="text-page-block__tool-handle"
                    onClick={(event) => {
                      event.stopPropagation();
                      handleFlipClick('horizontal');
                    }}
                    title="Flip horizontal"
                    aria-label="Flip horizontal"
                    aria-pressed={!!block.imageFlipHorizontal}
                  >
                    <FlipHorizontalIcon />
                  </button>
                  <button
                    type="button"
                    className="text-page-block__tool-handle"
                    onClick={(event) => {
                      event.stopPropagation();
                      handleFlipClick('vertical');
                    }}
                    title="Flip vertical"
                    aria-label="Flip vertical"
                    aria-pressed={!!block.imageFlipVertical}
                  >
                    <FlipVerticalIcon />
                  </button>
                </>
              )}
              <button
                type="button"
                className="text-page-block__rotate-handle"
                onPointerDown={handleRotatePointerDown}
                title="Rotate"
                aria-label="Rotate"
              >
                <RotateHandleIcon />
              </button>
              {canDelete && onDelete && (
                <button
                  type="button"
                  className="text-page-block__delete-handle"
                  onPointerDown={handleDeleteClick}
                  title="Remove element (Delete)"
                  aria-label="Remove element"
                >
                  <Trash2 className="text-page-block__delete-icon" strokeWidth={2.25} />
                </button>
              )}
            </div>
            {RESIZE_HANDLES.map((handle) => (
              <span
                key={handle.mode}
                className="text-page-block__resize-handle"
                style={resizeHandleStyle(handle.mode)}
                onPointerDown={(event) => handleResizePointerDown(event, handle.mode)}
                title={handle.label}
                aria-label={handle.label}
              />
            ))}
          </div>
        </div>
      )}
    </>
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
  showBlockChrome = true,
  onSelectBlock,
  onSettingsChange,
  onCanvasBackgroundClick,
  onDeleteBlock,
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
  showBlockChrome?: boolean;
  onSelectBlock?: (blockId: string) => void;
  onSettingsChange?: (
    updates:
      | Partial<TextModuleSettings>
      | ((prev: TextModuleSettings) => Partial<TextModuleSettings>),
    options?: { recordHistory?: boolean }
  ) => void;
  onCanvasBackgroundClick?: () => void;
  onDeleteBlock?: (blockId: string) => void;
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
    (
      blockId: string,
      patch: Partial<TextPageBlock>,
      options?: { recordHistory?: boolean }
    ) => {
      if (!onSettingsChange) return;
      onSettingsChange(
        (current) => updateTextPageBlock(current, blockId, patch, page.name, wordSearchSettings),
        options
      );
    },
    [onSettingsChange, page.name, wordSearchSettings]
  );

  const handleInteractionStart = useCallback(() => {
    onSettingsChange?.({}, { recordHistory: true });
  }, [onSettingsChange]);

  const handleBlockReorder = useCallback(
    (blockId: string, delta: 1 | -1) => {
      if (!onSettingsChange) return;
      onSettingsChange((current) =>
        reorderTextPageBlock(current, blockId, delta, page.name, wordSearchSettings)
      );
    },
    [onSettingsChange, page.name, wordSearchSettings]
  );

  const handleBackgroundClick = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      if (!textEditEnabled || event.target !== event.currentTarget) return;
      onCanvasBackgroundClick?.();
    },
    [textEditEnabled, onCanvasBackgroundClick]
  );

  return (
    <div
      className={cn(
        'relative shadow-2xl border border-gray-300 select-none transition-shadow duration-300 hover:shadow-3xl',
        isEditing && 'text-page-canvas--editing'
      )}
      style={{
        width: widthPx,
        height: heightPx,
        boxSizing: 'border-box',
        backgroundColor: pageBackground.backgroundColor || '#ffffff',
        overflow: isEditing ? 'visible' : 'hidden',
      }}
      onClick={handleBackgroundClick}
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
        className={cn('absolute text-page-canvas__content', isEditing && 'text-page-canvas__content--editing')}
        style={{
          left: marginPx,
          top: marginPx,
          width: contentWidth,
          height: contentHeight,
          zIndex: 10,
          overflow: isEditing ? 'visible' : 'hidden',
        }}
        onClick={handleBackgroundClick}
      >
        {blocks.map((block, index) => (
          <DraggableTextPageBlock
            key={block.id}
            block={block}
            globalSettings={wordSearchSettings}
            settings={settings}
            contentWidth={contentWidth}
            contentHeight={contentHeight}
            canvasScale={canvasScale}
            ptToPx={ptToPx}
            isSelected={selectedBlockId === block.id}
            showChrome={showBlockChrome}
            stackIndex={index}
            totalBlocks={blocks.length}
            isEditing={isEditing}
            onSelect={() => onSelectBlock?.(block.id)}
            onUpdate={(patch, options) => handleBlockUpdate(block.id, patch, options)}
            onInteractionStart={handleInteractionStart}
            onBringForward={() => handleBlockReorder(block.id, 1)}
            onSendBackward={() => handleBlockReorder(block.id, -1)}
            canDelete={true}
            onDelete={
              block.kind !== 'title' && onDeleteBlock
                ? () => onDeleteBlock(block.id)
                : undefined
            }
          />
        ))}
      </div>
    </div>
  );
}
