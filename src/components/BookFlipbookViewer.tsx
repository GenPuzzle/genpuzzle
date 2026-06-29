'use client';

import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Maximize2,
  Minimize2,
  Pencil,
  Volume2,
  VolumeX,
  X,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { pageFlipSound } from '@/lib/flipbook-sound';
import {
  computeLeafVisuals,
  easePageTurn,
  type FlipPageSide,
} from '@/lib/flipbook-page-physics';

interface BookFlipbookViewerProps {
  pageCount: number;
  pageWidthPx: number;
  pageHeightPx: number;
  renderPage: (index: number) => React.ReactNode;
  className?: string;
  onClose?: () => void;
  onEditPage?: (index: number) => void;
}

const FLIP_MS = 920;
const SNAP_MS = 420;
const SPINE_PX = 0;
const DRAG_COMMIT_DEG = 55;
const DRAG_START_PX = 8;

type FlipDirection = 'next' | 'prev';
type DragSide = 'left' | 'right' | null;

function BlankFlipPage() {
  return <div className="book-flipbook__blank-page" aria-hidden />;
}

/** First spread: blank left, page 0 on right; later spreads pair pages 1–2, 3–4, … */
function spreadPageIndices(spreadIndex: number) {
  if (spreadIndex === 0) {
    return { left: -1, right: 0 };
  }
  return { left: spreadIndex * 2 - 1, right: spreadIndex * 2 };
}

export function BookFlipbookViewer({
  pageCount,
  pageWidthPx,
  pageHeightPx,
  renderPage,
  className,
  onClose,
  onEditPage,
}: BookFlipbookViewerProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const bookRef = useRef<HTMLDivElement>(null);
  const isBusyRef = useRef(false);
  const dragRef = useRef<{
    side: DragSide;
    pointerId: number;
    startX: number;
    lastX: number;
    halfWidth: number;
    active: boolean;
    captureEl: HTMLElement | null;
  } | null>(null);
  const leafAngleRef = useRef(0);
  const flipSideRef = useRef<FlipPageSide>('right');
  const leafRef = useRef<HTMLDivElement>(null);
  const soundEnabledRef = useRef(false);
  const flipRafRef = useRef<number | null>(null);
  const dragMotionRafRef = useRef<number | null>(null);
  const pendingDragMotionRef = useRef<{ angle: number; pointerDelta: number } | null>(null);
  const autoFlipPendingRef = useRef<{
    direction: FlipDirection;
    from: number;
    to: number;
    duration: number;
  } | null>(null);

  const [spreadIndex, setSpreadIndex] = useState(0);
  const [flipMode, setFlipMode] = useState<'idle' | 'animating' | 'dragging'>('idle');
  const [flipDirection, setFlipDirection] = useState<FlipDirection>('next');
  const [zoom, setZoom] = useState(100);
  const [soundEnabled, setSoundEnabled] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [containerSize, setContainerSize] = useState({ width: 1200, height: 720 });
  const [bookEntered, setBookEntered] = useState(false);
  const [spreadInput, setSpreadInput] = useState('1');

  const safeCount = Math.max(1, pageCount);
  const maxSpread = Math.max(1, Math.ceil((safeCount + 1) / 2));
  const isBusy = flipMode !== 'idle';
  const canGoPrev = spreadIndex > 0 && !isBusy;
  const canGoNext = spreadIndex < maxSpread - 1 && !isBusy;

  const { left: leftIndex, right: rightIndex } = spreadPageIndices(spreadIndex);
  const { right: nextRightIndex } = spreadPageIndices(spreadIndex + 1);
  const { left: prevLeftIndex } = spreadPageIndices(spreadIndex - 1);

  useEffect(() => {
    isBusyRef.current = isBusy;
  }, [isBusy]);

  useEffect(() => {
    soundEnabledRef.current = soundEnabled;
  }, [soundEnabled]);

  useEffect(() => {
    setSpreadIndex((idx) => Math.min(idx, maxSpread - 1));
  }, [maxSpread]);

  useEffect(() => {
    setSpreadInput(String(spreadIndex + 1));
  }, [spreadIndex]);

  const leftPageNumber = leftIndex >= 0 ? leftIndex + 1 : null;
  const rightPageNumber = Math.min(rightIndex + 1, safeCount);
  const pageRangeLabel =
    leftPageNumber === null
      ? `${rightPageNumber}`
      : rightIndex >= safeCount
        ? `${leftPageNumber}`
        : `${leftPageNumber}–${rightPageNumber}`;

  useEffect(() => {
    const t = window.setTimeout(() => setBookEntered(true), 60);
    return () => window.clearTimeout(t);
  }, []);

  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;

    const update = () => {
      setContainerSize({ width: el.clientWidth, height: el.clientHeight });
    };
    update();

    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const openBookWidth = pageWidthPx * 2 + SPINE_PX;

  const baseScale = useMemo(() => {
    const hintReserve = 40;
    const padReserve = 28;
    const liftReserve = 36;
    const usableH = Math.max(160, containerSize.height - hintReserve - padReserve - liftReserve);
    const maxW = containerSize.width * 0.82;
    const maxH = usableH * 0.96;
    return Math.min(maxW / openBookWidth, maxH / pageHeightPx, 1);
  }, [containerSize.width, containerSize.height, openBookWidth, pageHeightPx]);

  const scale = baseScale * (zoom / 100);

  const fitPageContent = useCallback((portalOnly = false) => {
    if (!bookRef.current) return;
    const selector = portalOnly
      ? '.book-flipbook__flip-portal .book-flipbook__page-inner'
      : '.book-flipbook__page-inner';
    bookRef.current.querySelectorAll(selector).forEach((inner) => {
      const content = inner.querySelector('.book-flipbook__page-content') as HTMLElement | null;
      if (!content || inner.clientWidth <= 0) return;
      const scaleX = inner.clientWidth / pageWidthPx;
      const scaleY = inner.clientHeight / pageHeightPx;
      const fit = Math.min(scaleX, scaleY, 1);
      content.style.transform = fit >= 0.999 ? 'none' : `scale(${fit})`;
    });
  }, [pageWidthPx, pageHeightPx]);

  useEffect(() => {
    if (isBusy) return;
    fitPageContent();
  }, [fitPageContent, spreadIndex, pageCount, scale, isBusy]);

  /** Imperative leaf motion — avoids React re-render every animation frame. */
  const applyLeafMotion = useCallback((angle: number, side: FlipPageSide) => {
    const leaf = leafRef.current;
    if (!leaf) return;

    const visuals = computeLeafVisuals(angle, side);
    leaf.style.transform = visuals.transform;

    const pastHalf = side === 'right' ? angle < -90 : angle > 90;
    const front = leaf.querySelector('.book-flipbook__leaf-sheet--front') as HTMLElement | null;
    const back = leaf.querySelector('.book-flipbook__leaf-sheet--back') as HTMLElement | null;
    if (front) front.style.visibility = pastHalf ? 'hidden' : 'visible';
    if (back) back.style.visibility = pastHalf ? 'visible' : 'hidden';

    const shadow = leaf.querySelector('.book-flipbook__leaf-shadow') as HTMLElement | null;
    if (shadow) {
      shadow.style.opacity = String(visuals.shadowOpacity);
    }

    const shade = leaf.querySelector('.book-flipbook__fold-shade') as HTMLElement | null;
    if (shade) shade.style.opacity = String(visuals.foldOpacity);

    const spec = leaf.querySelector('.book-flipbook__fold-specular') as HTMLElement | null;
    if (spec) spec.style.opacity = String(visuals.specularOpacity);

    const curl = leaf.querySelector('.book-flipbook__page-curl') as HTMLElement | null;
    if (curl) {
      curl.style.width = `${visuals.curlWidth}%`;
      curl.style.opacity = String(visuals.foldOpacity * 0.9);
    }

    const thickness = leaf.querySelector('.book-flipbook__page-thickness') as HTMLElement | null;
    if (thickness) thickness.style.opacity = String(visuals.thicknessOpacity);

    const edge = leaf.querySelector('.book-flipbook__page-edge') as HTMLElement | null;
    if (edge) edge.style.opacity = String(visuals.edgeOpacity);
  }, []);

  const cancelDragMotionRaf = useCallback(() => {
    if (dragMotionRafRef.current !== null) {
      cancelAnimationFrame(dragMotionRafRef.current);
      dragMotionRafRef.current = null;
    }
    pendingDragMotionRef.current = null;
  }, []);

  const cancelFlipAnimation = useCallback(() => {
    if (flipRafRef.current !== null) {
      cancelAnimationFrame(flipRafRef.current);
      flipRafRef.current = null;
    }
  }, []);

  const goToSpread = useCallback(
    (target: number) => {
      if (isBusyRef.current) return;
      const clamped = Math.max(0, Math.min(maxSpread - 1, target));
      if (clamped === spreadIndex) return;

      cancelFlipAnimation();
      cancelDragMotionRaf();
      autoFlipPendingRef.current = null;
      leafAngleRef.current = 0;
      setFlipMode('idle');
      setSpreadIndex(clamped);
    },
    [spreadIndex, maxSpread, cancelFlipAnimation, cancelDragMotionRaf]
  );

  const handleSpreadInputCommit = useCallback(
    (raw: string) => {
      const parsed = Number.parseInt(raw, 10);
      if (!Number.isFinite(parsed)) {
        setSpreadInput(String(spreadIndex + 1));
        return;
      }
      const spreadNum = Math.max(1, Math.min(maxSpread, parsed));
      setSpreadInput(String(spreadNum));
      goToSpread(spreadNum - 1);
    },
    [goToSpread, maxSpread, spreadIndex]
  );

  const scheduleDragMotion = useCallback(
    (angle: number, _pointerDelta: number, side: FlipPageSide) => {
      pendingDragMotionRef.current = { angle, pointerDelta: 0 };
      if (dragMotionRafRef.current !== null) return;

      dragMotionRafRef.current = requestAnimationFrame(() => {
        dragMotionRafRef.current = null;
        const pending = pendingDragMotionRef.current;
        if (!pending) return;
        leafAngleRef.current = pending.angle;
        applyLeafMotion(pending.angle, side);
      });
    },
    [applyLeafMotion]
  );

  const scaledBookWidth = openBookWidth * scale;
  const scaledBookHeight = pageHeightPx * scale;

  const playTurnSound = useCallback(() => {
    if (!soundEnabledRef.current) return;
    pageFlipSound.playTurn();
  }, []);

  const queueAutoFlip = useCallback(
    (direction: FlipDirection, from: number, to: number, duration: number) => {
      autoFlipPendingRef.current = { direction, from, to, duration };
      flipSideRef.current = direction === 'next' ? 'right' : 'left';
      setFlipDirection(direction);
      leafAngleRef.current = from;
      setFlipMode('animating');
    },
    []
  );

  const finishFlip = useCallback(
    (direction: FlipDirection) => {
      leafAngleRef.current = 0;
      autoFlipPendingRef.current = null;
      setSpreadIndex((idx) => (direction === 'next' ? idx + 1 : idx - 1));
      setFlipMode('idle');
      setFlipDirection('next');
      playTurnSound();
    },
    [playTurnSound]
  );

  const animateAngle = useCallback(
    (
      from: number,
      to: number,
      duration: number,
      onComplete: () => void
    ) => {
      cancelFlipAnimation();

      const startTime = performance.now();

      const step = (now: number) => {
        const elapsed = now - startTime;
        const t = Math.min(1, elapsed / duration);
        const eased = easePageTurn(t);
        const angle = from + (to - from) * eased;
        leafAngleRef.current = angle;
        applyLeafMotion(angle, flipSideRef.current);

        if (t < 1) {
          flipRafRef.current = requestAnimationFrame(step);
        } else {
          flipRafRef.current = null;
          onComplete();
        }
      };

      flipRafRef.current = requestAnimationFrame(step);
    },
    [cancelFlipAnimation, applyLeafMotion]
  );

  const snapBack = useCallback(() => {
    const from = leafAngleRef.current;
    animateAngle(from, 0, SNAP_MS, () => setFlipMode('idle'));
  }, [animateAngle]);

  const runFlip = useCallback(
    (direction: FlipDirection) => {
      if (isBusyRef.current) return;
      if (direction === 'next' && spreadIndex >= maxSpread - 1) return;
      if (direction === 'prev' && spreadIndex <= 0) return;

      const target = direction === 'next' ? -180 : 180;
      queueAutoFlip(direction, 0, target, FLIP_MS);
    },
    [spreadIndex, maxSpread, queueAutoFlip]
  );

  const angleFromDrag = useCallback((side: Exclude<DragSide, null>, deltaX: number, halfWidth: number) => {
    const travel = Math.max(halfWidth * 0.72, 1);
    const ratio = Math.max(-1, Math.min(1, deltaX / travel));
    if (side === 'right') {
      return Math.max(-180, Math.min(0, ratio * 180));
    }
    return Math.max(0, Math.min(180, ratio * 180));
  }, []);

  const getHalfWidth = useCallback(() => {
    if (bookRef.current) {
      const half = bookRef.current.querySelector('.book-flipbook__half--right');
      if (half instanceof HTMLElement && half.clientWidth > 0) {
        return half.clientWidth;
      }
    }
    return pageWidthPx;
  }, [pageWidthPx]);

  const onWindowPointerMoveRef = useRef<(e: PointerEvent) => void>(() => {});
  const onWindowPointerUpRef = useRef<(e: PointerEvent) => void>(() => {});
  const onWindowPointerCancelRef = useRef<(e: PointerEvent) => void>(() => {});

  const detachWindowDrag = useCallback(() => {
    window.removeEventListener('pointermove', onWindowPointerMoveRef.current);
    window.removeEventListener('pointerup', onWindowPointerUpRef.current);
    window.removeEventListener('pointercancel', onWindowPointerCancelRef.current);
  }, []);

  const endDrag = useCallback(
    (pointerId: number) => {
      const drag = dragRef.current;
      if (!drag || drag.pointerId !== pointerId) return;

      dragRef.current = null;
      detachWindowDrag();
      cancelDragMotionRaf();
      try {
        drag.captureEl?.releasePointerCapture(pointerId);
      } catch {
        /* pointer may already be released */
      }

      if (!drag.active || !drag.side) {
        setFlipMode('idle');
        return;
      }

      const direction: FlipDirection = drag.side === 'right' ? 'next' : 'prev';
      const currentAngle = leafAngleRef.current;
      const shouldCommit =
        direction === 'next' ? currentAngle <= -DRAG_COMMIT_DEG : currentAngle >= DRAG_COMMIT_DEG;

      if (shouldCommit) {
        const from = leafAngleRef.current;
        const target = direction === 'next' ? -180 : 180;
        const remaining = Math.max(
          220,
          FLIP_MS * (Math.abs(target - from) / 180)
        );
        queueAutoFlip(direction, from, target, remaining);
      } else {
        snapBack();
      }
    },
    [detachWindowDrag, snapBack, queueAutoFlip, cancelDragMotionRaf]
  );

  const onWindowPointerMove = useCallback(
    (e: PointerEvent) => {
      const drag = dragRef.current;
      if (!drag || drag.pointerId !== e.pointerId) return;

      const deltaX = e.clientX - drag.startX;
      if (!drag.active && Math.abs(deltaX) < DRAG_START_PX) return;

      if (!drag.active) {
        let side: Exclude<DragSide, null> | null = null;
        if (deltaX < 0 && spreadIndex < maxSpread - 1) {
          side = 'right';
        } else if (deltaX > 0 && spreadIndex > 0) {
          side = 'left';
        }
        if (!side) return;

        drag.side = side;
        drag.active = true;
        drag.lastX = e.clientX;
        flipSideRef.current = side;
        setFlipDirection(side === 'right' ? 'next' : 'prev');
        setFlipMode('dragging');
        leafAngleRef.current = 0;
      }

      if (!drag.side) return;

      const pointerDelta = e.clientX - drag.lastX;
      drag.lastX = e.clientX;

      e.preventDefault();
      const angle = angleFromDrag(drag.side, deltaX, drag.halfWidth);
      scheduleDragMotion(angle, pointerDelta, drag.side);
    },
    [angleFromDrag, scheduleDragMotion, spreadIndex, maxSpread]
  );

  const onWindowPointerUp = useCallback(
    (e: PointerEvent) => {
      endDrag(e.pointerId);
    },
    [endDrag]
  );

  const onWindowPointerCancel = useCallback(
    (e: PointerEvent) => {
      const drag = dragRef.current;
      if (!drag || drag.pointerId !== e.pointerId) return;
      const wasActive = drag.active;
      try {
        drag.captureEl?.releasePointerCapture(e.pointerId);
      } catch {
        /* pointer may already be released */
      }
      dragRef.current = null;
      detachWindowDrag();
      if (wasActive) {
        snapBack();
      } else {
        setFlipMode('idle');
      }
    },
    [detachWindowDrag, snapBack]
  );

  useEffect(() => {
    onWindowPointerMoveRef.current = onWindowPointerMove;
    onWindowPointerUpRef.current = onWindowPointerUp;
    onWindowPointerCancelRef.current = onWindowPointerCancel;
  }, [onWindowPointerMove, onWindowPointerUp, onWindowPointerCancel]);

  const handleBookPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (isBusyRef.current) return;
      if (spreadIndex <= 0 && spreadIndex >= maxSpread - 1) return;
      if (e.button !== 0) return;

      e.preventDefault();
      e.stopPropagation();
      const captureEl = e.currentTarget as HTMLElement;
      captureEl.setPointerCapture(e.pointerId);

      dragRef.current = {
        side: null,
        pointerId: e.pointerId,
        startX: e.clientX,
        lastX: e.clientX,
        halfWidth: getHalfWidth(),
        active: false,
        captureEl,
      };

      window.addEventListener('pointermove', onWindowPointerMoveRef.current, { passive: false });
      window.addEventListener('pointerup', onWindowPointerUpRef.current);
      window.addEventListener('pointercancel', onWindowPointerCancelRef.current);
    },
    [spreadIndex, maxSpread, getHalfWidth]
  );

  useEffect(() => {
    return () => {
      detachWindowDrag();
      cancelFlipAnimation();
      cancelDragMotionRaf();
      pageFlipSound.cancel();
    };
  }, [detachWindowDrag, cancelFlipAnimation, cancelDragMotionRaf]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') runFlip('next');
      if (e.key === 'ArrowLeft') runFlip('prev');
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [runFlip]);

  useEffect(() => {
    const onFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', onFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', onFullscreenChange);
  }, []);

  const toggleFullscreen = async () => {
    if (!rootRef.current) return;
    if (!document.fullscreenElement) {
      await rootRef.current.requestFullscreen();
    } else {
      await document.exitFullscreen();
    }
  };

  const renderSafePage = (index: number, showEdit = true) => {
    if (index < 0 || index >= safeCount) {
      return <BlankFlipPage />;
    }
    return (
      <div className="book-flipbook__page-inner">
        <div
          className="book-flipbook__page-content"
          style={{ width: pageWidthPx, height: pageHeightPx }}
        >
          {renderPage(index)}
        </div>
        {onEditPage && showEdit && (
          <button
            type="button"
            className="book-flipbook__edit-btn"
            onClick={(e) => {
              e.stopPropagation();
              onEditPage(index);
            }}
            onPointerDown={(e) => e.stopPropagation()}
            aria-label={`Edit page ${index + 1}`}
          >
            <Pencil className="h-3.5 w-3.5" aria-hidden />
            Edit
          </button>
        )}
      </div>
    );
  };

  const renderLeafFacePage = (index: number) => (
    <div key={`leaf-page-${index}`} className="book-flipbook__leaf-page">
      {renderSafePage(index, false)}
    </div>
  );

  const showNextFlip = flipMode !== 'idle' && flipDirection === 'next';
  const showPrevFlip = flipMode !== 'idle' && flipDirection === 'prev';

  const animateAngleRef = useRef(animateAngle);
  const finishFlipRef = useRef(finishFlip);
  animateAngleRef.current = animateAngle;
  finishFlipRef.current = finishFlip;

  useLayoutEffect(() => {
    if (flipMode === 'idle') return;

    const side: FlipPageSide = flipDirection === 'next' ? 'right' : 'left';
    flipSideRef.current = side;

    const pending = autoFlipPendingRef.current;
    if (pending) {
      autoFlipPendingRef.current = null;
      fitPageContent(true);
      applyLeafMotion(pending.from, side);
      animateAngleRef.current(pending.from, pending.to, pending.duration, () =>
        finishFlipRef.current(pending.direction)
      );
      return;
    }

    if (flipMode === 'dragging') {
      fitPageContent(true);
      applyLeafMotion(leafAngleRef.current, side);
    }
  }, [flipMode, flipDirection, fitPageContent, applyLeafMotion]);

  const renderFlipLeaf = (side: FlipPageSide, frontIndex: number, backIndex: number) => {
    const hinge = side === 'right' ? 'left' : 'right';
    const freeEdge = side === 'right' ? 'right' : 'left';

    return (
      <div
        ref={leafRef}
        key={`leaf-${side}-${frontIndex}-${backIndex}`}
        className={`book-flipbook__leaf book-flipbook__leaf--${side}`}
      >
        <div className="book-flipbook__leaf-shadow" aria-hidden />
        <div className="book-flipbook__leaf-sheet book-flipbook__leaf-sheet--front">
          {renderLeafFacePage(frontIndex)}
        </div>
        <div className="book-flipbook__leaf-sheet book-flipbook__leaf-sheet--back">
          {renderLeafFacePage(backIndex)}
        </div>
        <div className="book-flipbook__fold-shade" aria-hidden />
        <div className="book-flipbook__fold-specular" aria-hidden />
        <div
          className={`book-flipbook__page-curl book-flipbook__page-curl--${freeEdge}`}
          aria-hidden
        />
        <div
          className={`book-flipbook__page-thickness book-flipbook__page-thickness--${hinge}`}
          aria-hidden
        />
        <div
          className={`book-flipbook__page-edge book-flipbook__page-edge--${freeEdge}`}
          aria-hidden
        />
      </div>
    );
  };

  return (
    <div
      ref={rootRef}
      className={cn('book-flipbook', className)}
      onClick={() => onClose?.()}
    >
      {onClose && (
        <button
          type="button"
          className="book-flipbook__close-btn"
          onClick={(e) => {
            e.stopPropagation();
            onClose();
          }}
          aria-label="Close full-book preview"
          title="Close preview"
        >
          <X className="h-4 w-4" />
        </button>
      )}
      <div
        className="book-flipbook__toolbar"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          className="book-flipbook__tool-btn"
          onClick={() => setSoundEnabled((v) => !v)}
          aria-label={soundEnabled ? 'Mute page flip sound' : 'Enable page flip sound'}
          title={soundEnabled ? 'Mute sound' : 'Enable sound'}
        >
          {soundEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
        </button>
        <span className="book-flipbook__tool-sep" aria-hidden />
        <button
          type="button"
          className="book-flipbook__tool-btn"
          onClick={() => setZoom((z) => Math.max(50, z - 10))}
          aria-label="Zoom out"
        >
          <ZoomOut className="h-4 w-4" />
        </button>
        <span className="book-flipbook__zoom-label">{zoom}%</span>
        <button
          type="button"
          className="book-flipbook__tool-btn"
          onClick={() => setZoom((z) => Math.min(150, z + 10))}
          aria-label="Zoom in"
        >
          <ZoomIn className="h-4 w-4" />
        </button>
        <span className="book-flipbook__tool-sep" aria-hidden />
        <button
          type="button"
          className="book-flipbook__tool-btn"
          onClick={toggleFullscreen}
          aria-label={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
        >
          {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
        </button>
      </div>

      <div
        className="book-flipbook__stage-wrap"
        onClick={() => onClose?.()}
      >
        <button
          type="button"
          className={cn(
            'book-flipbook__nav-arrow book-flipbook__nav-arrow--left',
            !canGoPrev && 'book-flipbook__nav-arrow--disabled'
          )}
          disabled={!canGoPrev}
          onClick={(e) => {
            e.stopPropagation();
            runFlip('prev');
          }}
          aria-label="Previous page"
        >
          <ChevronLeft className="h-7 w-7" strokeWidth={2.5} />
        </button>

        <div
          className={cn('book-flipbook__stage', bookEntered && 'book-flipbook__stage--entered')}
          onClick={(e) => e.stopPropagation()}
        >
          <div
            className="book-flipbook__stage-shell"
            style={{
              width: scaledBookWidth,
              height: scaledBookHeight,
            }}
          >
            <div
              className="book-flipbook__scale-wrap"
              style={{
                width: openBookWidth,
                height: pageHeightPx,
                transform: `scale(${scale})`,
              }}
            >
            <div
              ref={bookRef}
              className="book-flipbook__book"
              style={{ width: openBookWidth, height: pageHeightPx }}
            >
              <div className="book-flipbook__desk-shadow" aria-hidden />
              <div className="book-flipbook__glow" aria-hidden />

              <div
                className="book-flipbook__open"
                onPointerDown={flipMode === 'idle' ? handleBookPointerDown : undefined}
              >
                <div className="book-flipbook__half book-flipbook__half--left">
                  {showPrevFlip ? renderSafePage(prevLeftIndex) : renderSafePage(leftIndex)}
                </div>

                <div className="book-flipbook__half book-flipbook__half--right">
                  {showNextFlip ? renderSafePage(nextRightIndex) : renderSafePage(rightIndex)}
                </div>

                {showNextFlip && (
                  <div
                    key={`flip-next-${spreadIndex}`}
                    className="book-flipbook__flip-portal book-flipbook__flip-portal--right"
                    style={{
                      left: pageWidthPx,
                      width: pageWidthPx,
                      height: pageHeightPx,
                    }}
                  >
                    <div className="book-flipbook__flip-portal-body book-flipbook__flip-portal-body--right">
                      {renderFlipLeaf('right', rightIndex, rightIndex + 1)}
                    </div>
                  </div>
                )}

                {showPrevFlip && (
                  <div
                    key={`flip-prev-${spreadIndex}`}
                    className="book-flipbook__flip-portal book-flipbook__flip-portal--left"
                    style={{
                      left: 0,
                      width: pageWidthPx,
                      height: pageHeightPx,
                    }}
                  >
                    <div className="book-flipbook__flip-portal-body book-flipbook__flip-portal-body--left">
                      {renderFlipLeaf('left', leftIndex, leftIndex - 1)}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
          </div>
        </div>

        <button
          type="button"
          className={cn(
            'book-flipbook__nav-arrow book-flipbook__nav-arrow--right',
            !canGoNext && 'book-flipbook__nav-arrow--disabled'
          )}
          disabled={!canGoNext}
          onClick={(e) => {
            e.stopPropagation();
            runFlip('next');
          }}
          aria-label="Next page"
        >
          <ChevronRight className="h-7 w-7" strokeWidth={2.5} />
        </button>
      </div>

      <div
        className="book-flipbook__pagination"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          className="book-flipbook__pagination-btn"
          disabled={!canGoPrev}
          onClick={() => runFlip('prev')}
          aria-label="Previous spread"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>

        <div className="book-flipbook__pagination-meta">
          <span className="book-flipbook__pagination-pages">Pg {pageRangeLabel}</span>
          <span className="book-flipbook__pagination-spread">
            Spread
            <input
              type="number"
              min={1}
              max={maxSpread}
              value={spreadInput}
              onChange={(e) => setSpreadInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleSpreadInputCommit(e.currentTarget.value);
                }
              }}
              onBlur={(e) => handleSpreadInputCommit(e.currentTarget.value)}
              className="book-flipbook__pagination-input"
              aria-label="Spread number"
            />
            <span className="book-flipbook__pagination-total">/ {maxSpread}</span>
          </span>
        </div>

        <button
          type="button"
          className="book-flipbook__pagination-btn"
          disabled={!canGoNext}
          onClick={() => runFlip('next')}
          aria-label="Next spread"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      <p
        className="book-flipbook__hint"
        onClick={(e) => e.stopPropagation()}
      >
        Drag a page, use the controls below, or press ← →
      </p>

      <style jsx global>{`
        .book-flipbook {
          position: relative;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          width: 100%;
          height: 100%;
          min-height: 0;
          flex: 1;
          padding: 0.5rem;
          background-color: #cfe8f6;
          background-image:
            linear-gradient(30deg, #b5d8ef 12%, transparent 12.5%, transparent 87%, #b5d8ef 87.5%, #b5d8ef),
            linear-gradient(150deg, #b5d8ef 12%, transparent 12.5%, transparent 87%, #b5d8ef 87.5%, #b5d8ef),
            linear-gradient(30deg, #b5d8ef 12%, transparent 12.5%, transparent 87%, #b5d8ef 87.5%, #b5d8ef),
            linear-gradient(150deg, #b5d8ef 12%, transparent 12.5%, transparent 87%, #b5d8ef 87.5%, #b5d8ef),
            linear-gradient(60deg, #e3f2fa 25%, transparent 25.5%, transparent 75%, #e3f2fa 75%, #e3f2fa),
            linear-gradient(60deg, #e3f2fa 25%, transparent 25.5%, transparent 75%, #e3f2fa 75%, #e3f2fa);
          background-size: 52px 90px;
          background-position:
            0 0, 0 0, 26px 45px, 26px 45px, 0 0, 26px 45px;
          touch-action: none;
          overflow: visible;
        }

        .book-flipbook:fullscreen {
          padding: 1.5rem;
        }

        .book-flipbook__toolbar {
          position: absolute;
          top: 0.65rem;
          right: 0.65rem;
          z-index: 40;
          display: flex;
          align-items: center;
          gap: 0.2rem;
          padding: 0.3rem 0.5rem;
          border-radius: 0.55rem;
          background: rgba(255, 255, 255, 0.92);
          border: 1px solid rgba(148, 163, 184, 0.35);
          box-shadow: 0 4px 20px rgba(15, 23, 42, 0.1);
          backdrop-filter: blur(10px);
        }

        .book-flipbook__close-btn {
          position: absolute;
          top: 0.65rem;
          left: 0.65rem;
          z-index: 40;
          display: flex;
          align-items: center;
          justify-content: center;
          width: 2rem;
          height: 2rem;
          padding: 0;
          border: 1px solid rgba(148, 163, 184, 0.35);
          border-radius: 0.55rem;
          background: rgba(255, 255, 255, 0.92);
          color: #b91c1c;
          box-shadow: 0 4px 20px rgba(15, 23, 42, 0.1);
          backdrop-filter: blur(10px);
          cursor: pointer;
          transition: background 0.2s ease, color 0.2s ease, transform 0.15s ease;
        }

        .book-flipbook__close-btn:hover {
          background: #fef2f2;
          color: #991b1b;
          transform: scale(1.05);
        }

        .book-flipbook__close-btn:active {
          transform: scale(0.96);
        }

        .book-flipbook__tool-btn {
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;
          width: 2rem !important;
          height: 2rem !important;
          min-width: 2rem !important;
          min-height: 2rem !important;
          padding: 0 !important;
          border: none !important;
          border-radius: 0.4rem !important;
          background: transparent !important;
          color: #334155 !important;
          box-shadow: none !important;
          cursor: pointer;
          transform: none !important;
          transition: background 0.2s ease, color 0.2s ease, transform 0.15s ease !important;
        }

        .book-flipbook__tool-btn:hover:not(:disabled) {
          background: #f1f5f9 !important;
          color: #1a5a8c !important;
        }

        .book-flipbook__tool-btn:active:not(:disabled) {
          transform: scale(0.94) !important;
        }

        .book-flipbook__tool-btn:disabled {
          opacity: 0.35;
          cursor: not-allowed;
        }

        .book-flipbook__zoom-label {
          font-size: 0.625rem;
          font-weight: 700;
          color: #475569;
          min-width: 2rem;
          text-align: center;
        }

        .book-flipbook__tool-sep {
          width: 1px;
          height: 1.1rem;
          background: #e2e8f0;
          margin: 0 0.12rem;
        }

        .book-flipbook__stage-wrap {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: clamp(0.35rem, 2vw, 1.25rem);
          width: 100%;
          max-width: 100%;
          flex: 1;
          min-height: 0;
          z-index: 10;
        }

        .book-flipbook__nav-arrow {
          flex-shrink: 0;
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;
          width: 3rem !important;
          height: 3rem !important;
          min-width: 3rem !important;
          min-height: 3rem !important;
          padding: 0 !important;
          border: none !important;
          border-radius: 9999px !important;
          background: rgba(255, 255, 255, 0.92) !important;
          color: #1e5a8c !important;
          box-shadow:
            0 4px 18px rgba(26, 90, 140, 0.18),
            0 0 0 1px rgba(148, 163, 184, 0.35) !important;
          cursor: pointer;
          transform: none !important;
          transition:
            transform 0.25s cubic-bezier(0.34, 1.4, 0.64, 1),
            box-shadow 0.25s ease,
            background 0.2s ease !important;
          animation: book-flipbook-arrow-pulse 2.8s ease-in-out infinite;
        }

        .book-flipbook__nav-arrow--left {
          animation-delay: 0s;
        }

        .book-flipbook__nav-arrow--right {
          animation-delay: 1.4s;
        }

        .book-flipbook__nav-arrow:hover:not(:disabled) {
          transform: scale(1.08) !important;
          background: #ffffff !important;
          box-shadow:
            0 8px 28px rgba(26, 90, 140, 0.28),
            0 0 0 1px rgba(26, 90, 140, 0.25) !important;
          animation: none;
        }

        .book-flipbook__nav-arrow:active:not(:disabled) {
          transform: scale(0.96) !important;
        }

        .book-flipbook__nav-arrow--disabled,
        .book-flipbook__nav-arrow:disabled {
          opacity: 0.28 !important;
          cursor: not-allowed !important;
          animation: none !important;
          box-shadow: 0 2px 8px rgba(15, 23, 42, 0.08) !important;
        }

        @keyframes book-flipbook-arrow-pulse {
          0%, 100% { box-shadow: 0 4px 18px rgba(26, 90, 140, 0.18), 0 0 0 1px rgba(148, 163, 184, 0.35); }
          50% { box-shadow: 0 6px 24px rgba(26, 90, 140, 0.32), 0 0 0 1px rgba(26, 90, 140, 0.2); }
        }

        .book-flipbook__stage {
          position: relative;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          overflow: visible;
          opacity: 0;
          transition: opacity 0.65s cubic-bezier(0.22, 1, 0.36, 1);
        }

        .book-flipbook__stage--entered {
          opacity: 1;
        }

        .book-flipbook__stage-shell {
          position: relative;
          flex-shrink: 0;
          overflow: visible;
        }

        .book-flipbook__scale-wrap {
          flex-shrink: 0;
          transform-origin: 0 0;
          position: absolute;
          top: 0;
          left: 0;
        }

        .book-flipbook__book {
          position: relative;
        }

        .book-flipbook__desk-shadow {
          position: absolute;
          left: 4%;
          right: 4%;
          bottom: -26px;
          height: 36px;
          border-radius: 50%;
          background: radial-gradient(ellipse at center, rgba(15, 23, 42, 0.35), transparent 72%);
          filter: blur(10px);
          pointer-events: none;
          transition: opacity 0.4s ease, transform 0.4s ease;
        }

        .book-flipbook__glow {
          position: absolute;
          inset: -8%;
          border-radius: 12px;
          background: radial-gradient(ellipse at center, rgba(255, 255, 255, 0.35), transparent 65%);
          pointer-events: none;
          z-index: -1;
        }

        .book-flipbook__open {
          position: relative;
          display: flex;
          align-items: stretch;
          width: 100%;
          height: 100%;
          border-radius: 4px 8px 8px 4px;
          box-shadow:
            0 36px 72px rgba(15, 23, 42, 0.32),
            0 12px 28px rgba(15, 23, 42, 0.16);
          overflow: visible;
          isolation: isolate;
          cursor: grab;
          touch-action: none;
        }

        .book-flipbook__open:active {
          cursor: grabbing;
        }

        .book-flipbook__flip-portal {
          position: absolute;
          top: 0;
          z-index: 120;
          perspective: 2800px;
          transform-style: preserve-3d;
          pointer-events: none;
        }

        .book-flipbook__flip-portal--right {
          perspective-origin: left center;
        }

        .book-flipbook__flip-portal--left {
          perspective-origin: right center;
        }

        .book-flipbook__flip-portal-body {
          position: relative;
          height: 100%;
          transform-style: preserve-3d;
        }

        .book-flipbook__flip-portal-body--right {
          width: ${pageWidthPx}px;
        }

        .book-flipbook__flip-portal-body--left {
          width: ${pageWidthPx}px;
        }

        .book-flipbook__half {
          position: relative;
          flex: 0 0 ${pageWidthPx}px;
          width: ${pageWidthPx}px;
          height: 100%;
          background: #ffffff;
          overflow: hidden;
          z-index: 1;
        }

        .book-flipbook__half--left {
          border-radius: 5px 0 0 5px;
        }

        .book-flipbook__half--right {
          border-radius: 0 5px 5px 0;
          margin-left: -1px;
        }

        .book-flipbook__drag-layer {
          display: none;
        }

        .book-flipbook__page-inner {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          overflow: hidden;
          background: #fff;
          pointer-events: none;
        }

        .book-flipbook__page-content {
          position: absolute;
          top: 0;
          left: 0;
          transform-origin: top left;
          pointer-events: none;
        }

        .book-flipbook__page-content > * {
          box-shadow: none !important;
          border: none !important;
          pointer-events: none;
        }

        .book-flipbook__edit-btn {
          position: absolute;
          top: 0.75rem;
          right: 0.75rem;
          z-index: 30;
          display: inline-flex;
          align-items: center;
          gap: 0.35rem;
          padding: 0.35rem 0.65rem;
          border-radius: 0.5rem;
          border: 1px solid #cbd5e1;
          background: rgba(255, 255, 255, 0.95);
          color: #1e293b;
          font-size: 11px;
          font-weight: 700;
          box-shadow: 0 4px 14px rgba(15, 23, 42, 0.12);
          transition: background-color 0.15s ease, transform 0.1s ease;
          cursor: pointer;
          pointer-events: auto;
        }

        .book-flipbook__edit-btn:hover {
          background: #f8fafc;
          transform: translateY(-1px);
        }

        .book-flipbook__blank-page {
          position: absolute;
          inset: 0;
          background: #ffffff;
        }

        .book-flipbook__leaf {
          position: absolute;
          inset: 0;
          z-index: 2;
          transform-style: preserve-3d;
          width: 100%;
          height: 100%;
          will-change: transform;
          contain: layout style;
        }

        .book-flipbook__leaf-shadow {
          position: absolute;
          inset: -2px -6px -2px -2px;
          pointer-events: none;
          z-index: -1;
          border-radius: 2px;
          box-shadow: 0 10px 28px rgba(15, 23, 42, 0.32);
          opacity: 0;
          will-change: transform, opacity;
        }

        .book-flipbook__leaf--right {
          transform-origin: left center;
        }

        .book-flipbook__leaf--left {
          transform-origin: right center;
        }

        .book-flipbook__leaf-sheet {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          overflow: hidden;
          background: #ffffff;
          transform-style: flat;
          backface-visibility: hidden;
        }

        .book-flipbook__leaf-sheet--back {
          transform: rotateY(180deg);
        }

        .book-flipbook__leaf-sheet .book-flipbook__leaf-page {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
        }

        .book-flipbook__leaf-sheet .book-flipbook__page-inner {
          position: absolute;
          inset: 0;
        }

        .book-flipbook__leaf-sheet .book-flipbook__page-content {
          transform-origin: top left;
        }

        .book-flipbook__fold-shade {
          position: absolute;
          inset: 0;
          pointer-events: none;
          z-index: 3;
        }

        .book-flipbook__leaf--right .book-flipbook__fold-shade {
          background: linear-gradient(
            90deg,
            rgba(15, 23, 42, 0.42) 0%,
            rgba(15, 23, 42, 0.14) 40%,
            transparent 80%
          );
        }

        .book-flipbook__leaf--left .book-flipbook__fold-shade {
          background: linear-gradient(
            270deg,
            rgba(15, 23, 42, 0.42) 0%,
            rgba(15, 23, 42, 0.14) 40%,
            transparent 80%
          );
        }

        .book-flipbook__fold-specular {
          position: absolute;
          inset: 0;
          pointer-events: none;
          z-index: 3;
          background: linear-gradient(
            125deg,
            rgba(255, 255, 255, 0.42) 0%,
            rgba(255, 255, 255, 0.08) 28%,
            transparent 52%
          );
          mix-blend-mode: soft-light;
        }

        .book-flipbook__page-curl {
          position: absolute;
          top: 0;
          bottom: 0;
          pointer-events: none;
          z-index: 4;
        }

        .book-flipbook__page-curl--right {
          right: 0;
          background: linear-gradient(
            270deg,
            rgba(255, 255, 255, 0.55) 0%,
            rgba(226, 232, 240, 0.35) 40%,
            rgba(15, 23, 42, 0.12) 100%
          );
          box-shadow: inset 12px 0 18px rgba(15, 23, 42, 0.08);
        }

        .book-flipbook__page-curl--left {
          left: 0;
          background: linear-gradient(
            90deg,
            rgba(255, 255, 255, 0.55) 0%,
            rgba(226, 232, 240, 0.35) 40%,
            rgba(15, 23, 42, 0.12) 100%
          );
          box-shadow: inset -12px 0 18px rgba(15, 23, 42, 0.08);
        }

        .book-flipbook__page-thickness {
          position: absolute;
          top: 0;
          bottom: 0;
          width: 4px;
          z-index: 3;
          pointer-events: none;
          background: linear-gradient(
            90deg,
            #e8edf2 0%,
            #b8c5d4 50%,
            #8fa0b3 100%
          );
          box-shadow: 0 0 4px rgba(15, 23, 42, 0.12);
        }

        .book-flipbook__page-thickness--left {
          left: 0;
        }

        .book-flipbook__page-thickness--right {
          right: 0;
        }

        .book-flipbook__page-edge {
          position: absolute;
          top: 0;
          bottom: 0;
          width: 2px;
          z-index: 5;
          pointer-events: none;
          background: linear-gradient(180deg, #e2e8f0, #94a3b8, #e2e8f0);
        }

        .book-flipbook__page-edge--right {
          right: 0;
          box-shadow: 2px 0 6px rgba(15, 23, 42, 0.18);
        }

        .book-flipbook__page-edge--left {
          left: 0;
          box-shadow: -2px 0 6px rgba(15, 23, 42, 0.18);
        }

        .book-flipbook__hint {
          margin: 0.45rem 0 0;
          font-size: 0.6875rem;
          font-weight: 600;
          color: #4b6478;
          text-shadow: 0 1px 0 rgba(255, 255, 255, 0.55);
          letter-spacing: 0.02em;
        }

        .book-flipbook__pagination {
          position: relative;
          z-index: 40;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.75rem;
          margin-top: 0.55rem;
          padding: 0.4rem 0.75rem;
          border-radius: 9999px;
          background: rgba(255, 255, 255, 0.92);
          border: 1px solid rgba(148, 163, 184, 0.35);
          box-shadow: 0 4px 18px rgba(15, 23, 42, 0.1);
          backdrop-filter: blur(10px);
        }

        .book-flipbook__pagination-btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 2rem;
          height: 2rem;
          border: 1px solid #e2e8f0;
          border-radius: 9999px;
          background: #f8fafc;
          color: #334155;
          cursor: pointer;
          transition: background 0.15s ease, transform 0.1s ease;
        }

        .book-flipbook__pagination-btn:hover:not(:disabled) {
          background: #e2e8f0;
        }

        .book-flipbook__pagination-btn:active:not(:disabled) {
          transform: scale(0.96);
        }

        .book-flipbook__pagination-btn:disabled {
          opacity: 0.35;
          cursor: not-allowed;
        }

        .book-flipbook__pagination-meta {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 0.15rem;
          min-width: 7.5rem;
        }

        .book-flipbook__pagination-pages {
          font-size: 0.75rem;
          font-weight: 800;
          color: #1e293b;
          letter-spacing: 0.01em;
        }

        .book-flipbook__pagination-spread {
          display: inline-flex;
          align-items: center;
          gap: 0.3rem;
          font-size: 0.625rem;
          font-weight: 700;
          color: #64748b;
          text-transform: uppercase;
          letter-spacing: 0.04em;
        }

        .book-flipbook__pagination-input {
          width: 2.25rem;
          padding: 0.1rem 0.2rem;
          border: 1px solid #cbd5e1;
          border-radius: 0.35rem;
          background: #f8fafc;
          text-align: center;
          font-size: 0.6875rem;
          font-weight: 800;
          color: #334155;
        }

        .book-flipbook__pagination-input:focus {
          outline: 2px solid rgba(37, 99, 235, 0.35);
          outline-offset: 1px;
        }

        .book-flipbook__pagination-total {
          font-size: 0.6875rem;
          font-weight: 700;
          color: #475569;
          text-transform: none;
          letter-spacing: 0;
        }

        @media (max-width: 640px) {
          .book-flipbook__nav-arrow {
            width: 2.5rem !important;
            height: 2.5rem !important;
            min-width: 2.5rem !important;
            min-height: 2.5rem !important;
          }

          .book-flipbook__hint {
            font-size: 0.625rem;
          }
        }
      `}</style>
    </div>
  );
}
