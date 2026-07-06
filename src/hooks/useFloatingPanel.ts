'use client';

import { useCallback, useEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react';

const STORAGE_KEY = 'gp-canvas-context-panel-layout';

type PanelPosition = { x: number; y: number };

type PanelLayout = {
  position: PanelPosition | null;
  minimized: boolean;
};

function readLayout(): PanelLayout {
  if (typeof window === 'undefined') return { position: null, minimized: false };
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return { position: null, minimized: false };
    const parsed = JSON.parse(raw) as PanelLayout;
    return {
      position:
        parsed.position &&
        typeof parsed.position.x === 'number' &&
        typeof parsed.position.y === 'number'
          ? parsed.position
          : null,
      minimized: Boolean(parsed.minimized),
    };
  } catch {
    return { position: null, minimized: false };
  }
}

function writeLayout(layout: PanelLayout) {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(layout));
  } catch {
    /* ignore quota errors */
  }
}

function clampPosition(
  x: number,
  y: number,
  panelW: number,
  panelH: number,
  containerW: number,
  containerH: number
): PanelPosition {
  const maxX = Math.max(0, containerW - panelW);
  const maxY = Math.max(0, containerH - panelH);
  return {
    x: Math.min(Math.max(0, x), maxX),
    y: Math.min(Math.max(0, y), maxY),
  };
}

export function useFloatingPanel() {
  const panelRef = useRef<HTMLDivElement>(null);
  const [layout, setLayout] = useState<PanelLayout>({ position: null, minimized: false });
  const [hydrated, setHydrated] = useState(false);
  const [dragging, setDragging] = useState(false);
  const dragState = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    originX: number;
    originY: number;
  } | null>(null);

  useEffect(() => {
    setLayout(readLayout());
    setHydrated(true);
  }, []);

  const persistLayout = useCallback((next: PanelLayout) => {
    setLayout(next);
    writeLayout(next);
  }, []);

  const resolvePosition = useCallback((): PanelPosition => {
    if (layout.position) return layout.position;
    const panel = panelRef.current;
    const parent = panel?.offsetParent as HTMLElement | null;
    if (!panel || !parent) return { x: 12, y: 56 };
    const panelRect = panel.getBoundingClientRect();
    const parentRect = parent.getBoundingClientRect();
    return {
      x: panelRect.left - parentRect.left,
      y: panelRect.top - parentRect.top,
    };
  }, [layout.position]);

  const clampToContainer = useCallback(
    (pos: PanelPosition): PanelPosition => {
      const panel = panelRef.current;
      const parent = panel?.offsetParent as HTMLElement | null;
      if (!panel || !parent) return pos;
      return clampPosition(
        pos.x,
        pos.y,
        panel.offsetWidth,
        panel.offsetHeight,
        parent.clientWidth,
        parent.clientHeight
      );
    },
    []
  );

  const setMinimized = useCallback(
    (minimized: boolean) => {
      persistLayout({ ...layout, minimized });
    },
    [layout, persistLayout]
  );

  const toggleMinimized = useCallback(() => {
    setMinimized(!layout.minimized);
  }, [layout.minimized, setMinimized]);

  const handleHeaderPointerDown = useCallback(
    (event: ReactPointerEvent<HTMLElement>) => {
      if (event.button !== 0) return;
      if ((event.target as HTMLElement).closest('button')) return;

      const panel = panelRef.current;
      if (!panel) return;

      const origin = resolvePosition();
      dragState.current = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        originX: origin.x,
        originY: origin.y,
      };

      event.currentTarget.setPointerCapture(event.pointerId);
      setDragging(true);
      event.preventDefault();
    },
    [resolvePosition]
  );

  useEffect(() => {
    const handlePointerMove = (event: PointerEvent) => {
      const drag = dragState.current;
      if (!drag || event.pointerId !== drag.pointerId) return;

      const dx = event.clientX - drag.startX;
      const dy = event.clientY - drag.startY;
      const next = clampToContainer({
        x: drag.originX + dx,
        y: drag.originY + dy,
      });

      setLayout((prev) => {
        const updated = { ...prev, position: next };
        writeLayout(updated);
        return updated;
      });
    };

    const handlePointerUp = (event: PointerEvent) => {
      const drag = dragState.current;
      if (!drag || event.pointerId !== drag.pointerId) return;
      dragState.current = null;
      setDragging(false);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('pointercancel', handlePointerUp);
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('pointercancel', handlePointerUp);
    };
  }, [clampToContainer]);

  const panelStyle: CSSProperties | undefined =
    hydrated && layout.position
      ? { top: layout.position.y, left: layout.position.x, right: 'auto' }
      : undefined;

  return {
    panelRef,
    minimized: layout.minimized,
    dragging,
    panelStyle,
    toggleMinimized,
    handleHeaderPointerDown,
  };
}
