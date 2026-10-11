'use client';

import React, { createContext, useCallback, useContext, useMemo } from 'react';
import type { CanvasFormatTarget } from '@/lib/canvas-native-format';
import type { CanvasObjectChromeActions } from '@/components/CanvasObjectChrome';
import {
  centerCanvasOffsetHorizontal,
  centerCanvasOffsetVertical,
  formatTargetToOffsetKey,
  nudgeCanvasOffset,
  patchCanvasOffset,
  readCanvasOffset,
  type CanvasLayoutOffsetKey,
  type CanvasLayoutOffsets,
} from '@/lib/canvas-element-position';

export type CanvasElementMetrics = {
  /** Current rendered top (includes any offset already applied). */
  topPt: number;
  leftPt: number;
  widthPt: number;
  heightPt: number;
};

type CanvasNativePositionContextValue = {
  offsets: CanvasLayoutOffsets;
  pageHeightPt: number;
  marginPt: number;
  ptToCssPx: (pt: number) => number;
  onOffsetsChange: (next: CanvasLayoutOffsets) => void;
};

const CanvasNativePositionContext = createContext<CanvasNativePositionContextValue | null>(null);

export function CanvasNativePositionProvider({
  offsets,
  pageHeightPt,
  marginPt,
  ptToCssPx,
  onOffsetsChange,
  children,
}: CanvasNativePositionContextValue & { children: React.ReactNode }) {
  const value = useMemo(
    () => ({ offsets, pageHeightPt, marginPt, ptToCssPx, onOffsetsChange }),
    [offsets, pageHeightPt, marginPt, ptToCssPx, onOffsetsChange]
  );
  return (
    <CanvasNativePositionContext.Provider value={value}>
      {children}
    </CanvasNativePositionContext.Provider>
  );
}

export function useCanvasNativePositionChrome(
  target: CanvasFormatTarget | null | undefined,
  metrics?: CanvasElementMetrics | null
): CanvasObjectChromeActions | undefined {
  const ctx = useContext(CanvasNativePositionContext);
  const key = formatTargetToOffsetKey(target);

  const commit = useCallback(
    (next: CanvasLayoutOffsets) => {
      ctx?.onOffsetsChange(next);
    },
    [ctx]
  );

  return useMemo(() => {
    if (!ctx || !key) return undefined;

    const startMove = (event: React.PointerEvent<HTMLButtonElement>) => {
      event.preventDefault();
      event.stopPropagation();
      const startX = event.clientX;
      const startY = event.clientY;
      const startOffsets = ctx.offsets;
      const pointerId = event.pointerId;
      const button = event.currentTarget;
      button.setPointerCapture(pointerId);

      const onMove = (moveEvent: PointerEvent) => {
        const dxCss = moveEvent.clientX - startX;
        const dyCss = moveEvent.clientY - startY;
        const dxPt = dxCss / (ctx.ptToCssPx(1) || 1);
        const dyPt = dyCss / (ctx.ptToCssPx(1) || 1);
        commit(nudgeCanvasOffset(startOffsets, key, dxPt, dyPt));
      };
      const onUp = () => {
        button.releasePointerCapture(pointerId);
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
        window.removeEventListener('pointercancel', onUp);
      };
      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
      window.addEventListener('pointercancel', onUp);
    };

    return {
      onMovePointerDown: startMove,
      onCenterHorizontal: () => commit(centerCanvasOffsetHorizontal(ctx.offsets, key)),
      onCenterVertical: () => {
        if (!metrics || metrics.heightPt <= 0) {
          commit(patchCanvasOffset(ctx.offsets, key, { offsetYPt: 0 }));
          return;
        }
        const current = readCanvasOffset(ctx.offsets, key);
        const naturalTopPt = metrics.topPt - current.offsetYPt;
        commit(
          centerCanvasOffsetVertical(ctx.offsets, key, {
            naturalTopPt,
            heightPt: metrics.heightPt,
            pageHeightPt: ctx.pageHeightPt,
            marginPt: ctx.marginPt,
          })
        );
      },
    };
  }, [commit, ctx, key, metrics]);
}

export function mergeCanvasChromeActions(
  ...parts: Array<CanvasObjectChromeActions | undefined>
): CanvasObjectChromeActions | undefined {
  const merged: CanvasObjectChromeActions = {};
  let any = false;
  for (const part of parts) {
    if (!part) continue;
    any = true;
    Object.assign(merged, part);
  }
  return any ? merged : undefined;
}

/** Expose offset key helper for callers that apply metrics. */
export type { CanvasLayoutOffsetKey };
