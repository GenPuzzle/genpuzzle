'use client';

import React from 'react';
import type { ChapterLayoutId } from '@/lib/chapter-page-layouts';
import { cn } from '@/lib/utils';

/** Mini page diagram for a chapter layout (title / subtitle / image bands). */
export function ChapterLayoutIcon({
  layoutId,
  className,
}: {
  layoutId: ChapterLayoutId;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 40 52"
      className={cn('h-11 w-8', className)}
      aria-hidden
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect
        x="1"
        y="1"
        width="38"
        height="50"
        rx="2.5"
        className="fill-white stroke-slate-300 dark:fill-slate-900 dark:stroke-slate-600"
        strokeWidth="1.5"
      />
      {layoutId === 'title-sub-image' && (
        <>
          <rect x="7" y="5" width="26" height="4" rx="1" className="fill-slate-700 dark:fill-slate-200" />
          <rect x="10" y="11" width="20" height="2.5" rx="0.75" className="fill-slate-400 dark:fill-slate-500" />
          <ImageBand x={5} y={17} w={30} h={30} />
        </>
      )}
      {layoutId === 'title-image-sub' && (
        <>
          <rect x="7" y="5" width="26" height="4" rx="1" className="fill-slate-700 dark:fill-slate-200" />
          <ImageBand x={5} y={12} w={30} h={30} />
          <rect x="10" y="43.5" width="20" height="2.5" rx="0.75" className="fill-slate-400 dark:fill-slate-500" />
        </>
      )}
      {layoutId === 'image-title-sub' && (
        <>
          <ImageBand x={5} y={4} w={30} h={30} />
          <rect x="7" y="37" width="26" height="4" rx="1" className="fill-slate-700 dark:fill-slate-200" />
          <rect x="10" y="43.5" width="20" height="2.5" rx="0.75" className="fill-slate-400 dark:fill-slate-500" />
        </>
      )}
    </svg>
  );
}

function ImageBand({ x, y, w, h }: { x: number; y: number; w: number; h: number }) {
  const cx = x + w / 2;
  const cy = y + h / 2;
  return (
    <g>
      <rect
        x={x}
        y={y}
        width={w}
        height={h}
        rx="1.5"
        className="fill-sky-100 stroke-sky-400/80 dark:fill-sky-950 dark:stroke-sky-500/70"
        strokeWidth="1"
      />
      {/* Mountain / photo glyph */}
      <path
        d={`M${x + 3} ${y + h - 4} L${cx - 2} ${cy - 2} L${cx + 3} ${cy + 4} L${x + w - 3} ${y + h - 4} Z`}
        className="fill-sky-300/90 dark:fill-sky-600/80"
      />
      <circle
        cx={x + w - 7}
        cy={y + 7}
        r="2.2"
        className="fill-amber-300 dark:fill-amber-400/90"
      />
    </g>
  );
}
