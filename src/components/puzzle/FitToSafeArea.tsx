'use client';

/**
 * Scales children down (never up) so they fit inside the available box —
 * used for printable page previews so content never scrolls past the safe margin.
 *
 * The outer layout box uses the *scaled* width/height so flex parents (e.g. a
 * solution cell with a title sibling) are not forced to reserve the unscaled
 * content height — that bug hid word-scramble solution titles.
 */

import React, { useLayoutEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

type FitToSafeAreaProps = {
  children: React.ReactNode;
  className?: string;
  /** Horizontal alignment inside the available box */
  originX?: 'left' | 'center' | 'right';
  /** Vertical alignment inside the available box (default: top) */
  originY?: 'top' | 'center';
  /** Minimum scale floor so text stays readable */
  minScale?: number;
  /** Span the full available width (crossword clues, text puzzles). */
  fillWidth?: boolean;
};

export function FitToSafeArea({
  children,
  className,
  originX = 'center',
  originY = 'top',
  minScale = 0.35,
  fillWidth = false,
}: FitToSafeAreaProps) {
  const outerRef = useRef<HTMLDivElement>(null);
  const measureRef = useRef<HTMLDivElement>(null);
  const scaleRef = useRef(1);
  const [scale, setScale] = useState(1);
  const [natural, setNatural] = useState({ w: 0, h: 0 });

  useLayoutEffect(() => {
    const outer = outerRef.current;
    const measure = measureRef.current;
    if (!outer || !measure) return;

    let frame = 0;
    const run = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const availW = outer.clientWidth;
        const availH = outer.clientHeight;
        if (availW <= 1 || availH <= 1) return;

        // Temporarily clear transform so we measure true unscaled size.
        const prevTransform = measure.style.transform;
        measure.style.transform = 'none';
        const needW = Math.max(measure.scrollWidth, measure.offsetWidth, 1);
        const needH = Math.max(measure.scrollHeight, measure.offsetHeight, 1);
        measure.style.transform = prevTransform;

        setNatural((prev) =>
          Math.abs(prev.w - needW) > 0.5 || Math.abs(prev.h - needH) > 0.5
            ? { w: needW, h: needH }
            : prev
        );

        const next = Math.max(
          minScale,
          Math.min(1, availW / needW, availH / needH)
        );

        if (Math.abs(next - scaleRef.current) > 0.005) {
          scaleRef.current = next;
          setScale(next);
        }
      });
    };

    run();
    const ro = new ResizeObserver(run);
    ro.observe(outer);
    ro.observe(measure);

    const mo = new MutationObserver(run);
    mo.observe(measure, { childList: true, subtree: true, characterData: true });

    return () => {
      cancelAnimationFrame(frame);
      ro.disconnect();
      mo.disconnect();
    };
  }, [children, minScale, originX, originY, fillWidth]);

  const justify =
    originX === 'left' ? 'flex-start' : originX === 'right' ? 'flex-end' : 'center';
  const align = originY === 'center' ? 'center' : 'flex-start';

  const scaledW = natural.w > 0 ? Math.max(1, natural.w * scale) : undefined;
  const scaledH = natural.h > 0 ? Math.max(1, natural.h * scale) : undefined;

  return (
    <div
      ref={outerRef}
      className={cn('w-full h-full min-w-0 min-h-0 overflow-hidden', className)}
      style={{
        position: 'relative',
        display: 'flex',
        justifyContent: justify,
        alignItems: align,
      }}
    >
      <div
        style={{
          width: fillWidth ? '100%' : scaledW,
          height: scaledH,
          maxWidth: '100%',
          maxHeight: '100%',
          position: 'relative',
          flexShrink: 0,
          overflow: 'hidden',
        }}
      >
        <div
          ref={measureRef}
          style={{
            transform: `scale(${scale})`,
            // top-left origin + scaled layout box = no flex sibling overflow
            transformOrigin: 'top left',
            width: fillWidth ? '100%' : natural.w > 0 ? natural.w : 'fit-content',
            boxSizing: 'border-box',
          }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
