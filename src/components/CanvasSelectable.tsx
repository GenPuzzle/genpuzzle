'use client';

import React, { useEffect, useMemo, useRef } from 'react';
import { cn } from '@/lib/utils';
import type { CanvasFormatTarget } from '@/lib/canvas-native-format';
import {
  CanvasObjectChrome,
  type CanvasObjectChromeActions,
} from '@/components/CanvasObjectChrome';
import {
  mergeCanvasChromeActions,
  useCanvasNativePositionChrome,
  type CanvasElementMetrics,
} from '@/components/CanvasNativePositionContext';
import './canvas-contextual-controls.css';

export type SelectionHandleId = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';

const SELECTION_HANDLES: Array<{ id: SelectionHandleId; className: string }> = [
  { id: 'nw', className: 'canvas-selectable__handle--nw' },
  { id: 'n', className: 'canvas-selectable__handle--n' },
  { id: 'ne', className: 'canvas-selectable__handle--ne' },
  { id: 'e', className: 'canvas-selectable__handle--e' },
  { id: 'se', className: 'canvas-selectable__handle--se' },
  { id: 's', className: 'canvas-selectable__handle--s' },
  { id: 'sw', className: 'canvas-selectable__handle--sw' },
  { id: 'w', className: 'canvas-selectable__handle--w' },
];

function CanvasSelectionChrome({
  resizable = true,
  onHandlePointerDown,
}: {
  resizable?: boolean;
  onHandlePointerDown?: (handle: SelectionHandleId, event: React.PointerEvent<HTMLElement>) => void;
}) {
  return (
    <>
      <span className="canvas-selectable__outline" aria-hidden />
      {SELECTION_HANDLES.map((handle) => (
        <span
          key={handle.id}
          className={cn(
            'canvas-selectable__handle',
            handle.className,
            !resizable && 'canvas-selectable__handle--visual-only'
          )}
          onPointerDown={
            resizable && onHandlePointerDown
              ? (event) => {
                  event.stopPropagation();
                  onHandlePointerDown(handle.id, event);
                }
              : (event) => event.stopPropagation()
          }
          aria-hidden
        />
      ))}
    </>
  );
}

function scaleDeltaForHandle(handle: SelectionHandleId, dx: number, dy: number): number {
  let delta = 0;
  if (handle.includes('e')) delta += dx;
  if (handle.includes('w')) delta -= dx;
  if (handle.includes('s')) delta += dy;
  if (handle.includes('n')) delta -= dy;
  if (handle === 'n' || handle === 's') delta = handle === 's' ? dy : -dy;
  if (handle === 'e' || handle === 'w') delta = handle === 'e' ? dx : -dx;
  return delta * 0.35;
}

function useScaleResizeDrag(
  scalePercent: number | undefined,
  onScaleChange: ((scale: number) => void) | undefined,
  scaleMin: number,
  scaleMax: number
) {
  const scaleRef = useRef(scalePercent ?? 100);
  useEffect(() => {
    scaleRef.current = scalePercent ?? 100;
  }, [scalePercent]);

  return (handle: SelectionHandleId, event: React.PointerEvent<HTMLElement>) => {
    if (!onScaleChange || scalePercent == null) return;
    event.preventDefault();
    const startX = event.clientX;
    const startY = event.clientY;
    const startScale = scaleRef.current;
    const target = event.currentTarget;
    const pointerId = event.pointerId;
    target.setPointerCapture(pointerId);

    const onMove = (moveEvent: PointerEvent) => {
      const dx = moveEvent.clientX - startX;
      const dy = moveEvent.clientY - startY;
      const next = Math.round(
        Math.max(scaleMin, Math.min(scaleMax, startScale + scaleDeltaForHandle(handle, dx, dy)))
      );
      scaleRef.current = next;
      onScaleChange(next);
    };
    const onUp = () => {
      target.releasePointerCapture(pointerId);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
  };
}

export function CanvasChrome({
  label,
  active,
  onSelect,
  children,
  className,
  style,
  resizable = true,
  onBoxResize,
  scalePercent,
  onScaleChange,
  scaleMin = 30,
  scaleMax = 250,
  chrome,
  showChrome = true,
  formatTarget,
  positionMetrics,
}: {
  label: string;
  active: boolean;
  onSelect?: () => void;
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  resizable?: boolean;
  onBoxResize?: (handle: SelectionHandleId, event: React.PointerEvent<HTMLElement>) => void;
  scalePercent?: number;
  onScaleChange?: (scale: number) => void;
  scaleMin?: number;
  scaleMax?: number;
  chrome?: CanvasObjectChromeActions;
  showChrome?: boolean;
  /** When set, enables move / center controls from CanvasNativePositionProvider. */
  formatTarget?: CanvasFormatTarget;
  positionMetrics?: CanvasElementMetrics | null;
}) {
  const handleScaleDrag = useScaleResizeDrag(scalePercent, onScaleChange, scaleMin, scaleMax);
  const handleResize = onScaleChange ? handleScaleDrag : onBoxResize;
  const positionChrome = useCanvasNativePositionChrome(
    active ? formatTarget ?? null : null,
    positionMetrics
  );
  const mergedChrome = useMemo(
    () => mergeCanvasChromeActions(positionChrome, chrome),
    [chrome, positionChrome]
  );

  if (!onSelect) {
    if (!className && !style) return <>{children}</>;
    return (
      <div className={className} style={style}>
        {children}
      </div>
    );
  }

  return (
    <div
      className={cn('canvas-selectable', active && 'canvas-selectable--active', className)}
      style={style}
      onPointerDown={(event) => {
        event.stopPropagation();
        onSelect();
      }}
      aria-label={active ? label : undefined}
    >
      {children}
      {active ? (
        <>
          {showChrome && mergedChrome ? <CanvasObjectChrome actions={mergedChrome} /> : null}
          <CanvasSelectionChrome resizable={resizable} onHandlePointerDown={handleResize} />
        </>
      ) : null}
    </div>
  );
}

export function CanvasSelectable({
  target,
  label,
  active,
  onSelect,
  children,
  className,
  style,
  editable = false,
  value,
  onTextChange,
  resizable = true,
  onBoxResize,
  scalePercent,
  onScaleChange,
  scaleMin = 30,
  scaleMax = 250,
  chrome,
  showChrome = true,
  positionMetrics,
}: {
  target: CanvasFormatTarget;
  label: string;
  active: boolean;
  onSelect?: (target: CanvasFormatTarget) => void;
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  editable?: boolean;
  value?: string;
  onTextChange?: (text: string) => void;
  resizable?: boolean;
  onBoxResize?: (handle: SelectionHandleId, event: React.PointerEvent<HTMLElement>) => void;
  /** When set with onScaleChange, corner/edge handles resize via scale percent. */
  scalePercent?: number;
  onScaleChange?: (scale: number) => void;
  scaleMin?: number;
  scaleMax?: number;
  /** Floating move/rotate/delete bar above the selection (same as page shapes/images). */
  chrome?: CanvasObjectChromeActions;
  showChrome?: boolean;
  /** Element box in page points — used for center-vertical calculations. */
  positionMetrics?: CanvasElementMetrics | null;
}) {
  const textRef = useRef<HTMLDivElement>(null);
  const handleScaleDrag = useScaleResizeDrag(scalePercent, onScaleChange, scaleMin, scaleMax);
  const handleResize = onScaleChange ? handleScaleDrag : onBoxResize;
  const positionChrome = useCanvasNativePositionChrome(active ? target : null, positionMetrics);
  const mergedChrome = useMemo(
    () => mergeCanvasChromeActions(positionChrome, chrome),
    [chrome, positionChrome]
  );

  useEffect(() => {
    if (!editable || !textRef.current || value == null) return;
    if (document.activeElement === textRef.current) return;
    if (textRef.current.textContent !== value) {
      textRef.current.textContent = value;
    }
  }, [editable, value]);

  const liveText = editable && onTextChange;

  if (!onSelect) {
    if (!className && !style) return <>{children}</>;
    return (
      <div className={className} style={style}>
        {children}
      </div>
    );
  }

  return (
    <div
      className={cn('canvas-selectable', active && 'canvas-selectable--active', className)}
      style={style}
      onPointerDown={(event) => {
        event.stopPropagation();
        onSelect(target);
      }}
      data-canvas-target={target}
      aria-label={active ? label : undefined}
    >
      {liveText ? (
        <div
          ref={textRef}
          className="outline-none"
          contentEditable
          suppressContentEditableWarning
          onPointerDown={(event) => {
            event.stopPropagation();
            onSelect(target);
          }}
          onInput={() => onTextChange(textRef.current?.textContent ?? '')}
        />
      ) : (
        children
      )}
      {active ? (
        <>
          {showChrome && mergedChrome ? <CanvasObjectChrome actions={mergedChrome} /> : null}
          <CanvasSelectionChrome resizable={resizable} onHandlePointerDown={handleResize} />
        </>
      ) : null}
    </div>
  );
}
