'use client';

import React from 'react';

/**
 * Drag handle that adjusts spacing between multi-up solution tiles.
 * Horizontal drag changes column gap; vertical drag changes row gap (same value).
 */
export function SolutionGapDragHandle({
  orientation,
  gapPx,
  onGapChange,
  className,
  style,
}: {
  orientation: 'horizontal' | 'vertical';
  gapPx: number;
  onGapChange: (nextGapPx: number) => void;
  className?: string;
  style?: React.CSSProperties;
}) {
  const dragging = React.useRef(false);
  const start = React.useRef({ pos: 0, gap: gapPx });

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    dragging.current = true;
    start.current = {
      pos: orientation === 'horizontal' ? e.clientX : e.clientY,
      gap: gapPx,
    };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragging.current) return;
    const cur = orientation === 'horizontal' ? e.clientX : e.clientY;
    const delta = cur - start.current.pos;
    const next = Math.max(0, Math.min(120, Math.round(start.current.gap + delta)));
    if (next !== gapPx) onGapChange(next);
  };

  const onPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    dragging.current = false;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
  };

  const isH = orientation === 'horizontal';
  return (
    <div
      role="separator"
      aria-orientation={isH ? 'vertical' : 'horizontal'}
      aria-valuenow={gapPx}
      aria-label="Solution spacing"
      title="Drag to adjust space between solutions"
      className={className}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      style={{
        position: 'absolute',
        zIndex: 40,
        cursor: isH ? 'col-resize' : 'row-resize',
        background: 'transparent',
        ...(isH
          ? {
              top: 0,
              bottom: 0,
              width: Math.max(8, gapPx || 8),
              marginLeft: -Math.max(4, (gapPx || 8) / 2),
            }
          : {
              left: 0,
              right: 0,
              height: Math.max(8, gapPx || 8),
              marginTop: -Math.max(4, (gapPx || 8) / 2),
            }),
        ...style,
      }}
    />
  );
}
