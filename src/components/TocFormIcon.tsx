'use client';

import React from 'react';
import type { TocTableFormat } from '@/lib/toc-settings';
import { cn } from '@/lib/utils';

/** Mini diagram for the three common book TOC forms. */
export function TocFormIcon({
  formId,
  className,
}: {
  formId: TocTableFormat;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 56 40"
      className={cn('h-9 w-12', className)}
      aria-hidden
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect
        x="1"
        y="1"
        width="54"
        height="38"
        rx="2.5"
        className="fill-white stroke-slate-300 dark:fill-slate-900 dark:stroke-slate-600"
        strokeWidth="1.25"
      />
      {formId === 'classic' && (
        <>
          <LineRow y={10} titleW={16} dots leader="dots" />
          <LineRow y={20} titleW={20} dots leader="dots" />
          <LineRow y={30} titleW={14} dots leader="dots" />
        </>
      )}
      {formId === 'simple' && (
        <>
          <LineRow y={10} titleW={18} leader="flush" />
          <LineRow y={20} titleW={22} leader="flush" />
          <LineRow y={30} titleW={16} leader="flush" />
        </>
      )}
      {formId === 'indented' && (
        <>
          <LineRow y={9} titleW={18} x={6} leader="dots" />
          <LineRow y={18} titleW={14} x={12} leader="dots" />
          <LineRow y={27} titleW={16} x={12} leader="dots" />
        </>
      )}
    </svg>
  );
}

function LineRow({
  y,
  titleW,
  x = 6,
  leader,
}: {
  y: number;
  titleW: number;
  x?: number;
  leader: 'dots' | 'flush';
}) {
  return (
    <g>
      <rect
        x={x}
        y={y - 1.5}
        width={titleW}
        height={3}
        rx="0.75"
        className="fill-slate-700 dark:fill-slate-200"
      />
      {leader === 'dots' ? (
        <line
          x1={x + titleW + 2}
          y1={y}
          x2={44}
          y2={y}
          className="stroke-slate-400 dark:stroke-slate-500"
          strokeWidth="1"
          strokeDasharray="1.2 1.8"
        />
      ) : null}
      <rect
        x="46"
        y={y - 1.5}
        width={5}
        height={3}
        rx="0.75"
        className="fill-slate-500 dark:fill-slate-400"
      />
    </g>
  );
}
