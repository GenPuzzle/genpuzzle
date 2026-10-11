'use client';

import React from 'react';
import {
  AlignCenterHorizontal,
  AlignCenterVertical,
  ArrowDown,
  ArrowUp,
  FlipHorizontal2,
  FlipVertical2,
  Move,
  RotateCw,
  Trash2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import './canvas-contextual-controls.css';
import './canvas-format-bar.css';

export type CanvasObjectChromeActions = {
  onMovePointerDown?: (event: React.PointerEvent<HTMLButtonElement>) => void;
  onCenterHorizontal?: () => void;
  onCenterVertical?: () => void;
  onBringForward?: () => void;
  onSendBackward?: () => void;
  canBringForward?: boolean;
  canSendBackward?: boolean;
  onFlipH?: () => void;
  onFlipV?: () => void;
  flipH?: boolean;
  flipV?: boolean;
  onRotate?: () => void;
  onDelete?: () => void;
};

/** Floating toolbar above a selected canvas object (move / center / stack / flip / rotate / delete). */
export function CanvasObjectChrome({
  actions,
  className,
}: {
  actions: CanvasObjectChromeActions;
  className?: string;
}) {
  const {
    onMovePointerDown,
    onCenterHorizontal,
    onCenterVertical,
    onBringForward,
    onSendBackward,
    canBringForward = false,
    canSendBackward = false,
    onFlipH,
    onFlipV,
    flipH,
    flipV,
    onRotate,
    onDelete,
  } = actions;

  const hasStack = !!(onBringForward || onSendBackward);
  const hasFlip = !!(onFlipH || onFlipV);
  const hasRotate = !!onRotate;
  const hasDelete = !!onDelete;
  const hasPosition = !!(onMovePointerDown || onCenterHorizontal || onCenterVertical);

  if (!hasPosition && !hasStack && !hasFlip && !hasRotate && !hasDelete) {
    return null;
  }

  return (
    <div
      className={cn(
        'text-page-block__chrome-actions canvas-object__chrome-actions',
        className
      )}
      onPointerDown={(event) => event.stopPropagation()}
    >
      <button
        type="button"
        className="text-page-block__tool-handle text-page-block__move-handle"
        disabled={!onMovePointerDown}
        onPointerDown={(event) => {
          if (!onMovePointerDown) return;
          event.stopPropagation();
          onMovePointerDown(event);
        }}
        title="Move"
        aria-label="Move"
      >
        <Move className="text-page-block__tool-icon" strokeWidth={2.25} />
      </button>
      <button
        type="button"
        className="text-page-block__tool-handle"
        disabled={!onCenterHorizontal}
        onClick={(event) => {
          event.stopPropagation();
          onCenterHorizontal?.();
        }}
        title="Center horizontally on page"
        aria-label="Center horizontally on page"
      >
        <AlignCenterHorizontal className="text-page-block__tool-icon" strokeWidth={2.25} />
      </button>
      <button
        type="button"
        className="text-page-block__tool-handle"
        disabled={!onCenterVertical}
        onClick={(event) => {
          event.stopPropagation();
          onCenterVertical?.();
        }}
        title="Center vertically on page"
        aria-label="Center vertically on page"
      >
        <AlignCenterVertical className="text-page-block__tool-icon" strokeWidth={2.25} />
      </button>
      {hasStack ? (
        <>
          <button
            type="button"
            className="text-page-block__tool-handle"
            disabled={!onBringForward || !canBringForward}
            onClick={(event) => {
              event.stopPropagation();
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
            disabled={!onSendBackward || !canSendBackward}
            onClick={(event) => {
              event.stopPropagation();
              onSendBackward?.();
            }}
            title="Send backward"
            aria-label="Send backward"
          >
            <ArrowDown className="text-page-block__tool-icon" strokeWidth={2.25} />
          </button>
        </>
      ) : null}
      {hasFlip ? (
        <>
          <button
            type="button"
            className="text-page-block__tool-handle"
            disabled={!onFlipH}
            onClick={(event) => {
              event.stopPropagation();
              onFlipH?.();
            }}
            title="Flip horizontal"
            aria-label="Flip horizontal"
            aria-pressed={!!flipH}
          >
            <FlipHorizontal2 className="text-page-block__tool-icon" strokeWidth={2.25} />
          </button>
          <button
            type="button"
            className="text-page-block__tool-handle"
            disabled={!onFlipV}
            onClick={(event) => {
              event.stopPropagation();
              onFlipV?.();
            }}
            title="Flip vertical"
            aria-label="Flip vertical"
            aria-pressed={!!flipV}
          >
            <FlipVertical2 className="text-page-block__tool-icon" strokeWidth={2.25} />
          </button>
        </>
      ) : null}
      {hasRotate ? (
        <button
          type="button"
          className="text-page-block__rotate-handle"
          disabled={!onRotate}
          onClick={(event) => {
            event.stopPropagation();
            onRotate?.();
          }}
          title="Rotate 15°"
          aria-label="Rotate 15 degrees"
        >
          <RotateCw className="text-page-block__rotate-icon" strokeWidth={2.25} />
        </button>
      ) : null}
      {hasDelete ? (
        <button
          type="button"
          className="text-page-block__delete-handle"
          disabled={!onDelete}
          onClick={(event) => {
            event.stopPropagation();
            onDelete?.();
          }}
          title="Delete"
          aria-label="Delete"
        >
          <Trash2 className="text-page-block__delete-icon" strokeWidth={2.25} />
        </button>
      ) : null}
    </div>
  );
}
