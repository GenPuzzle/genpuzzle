'use client';

import React from 'react';
import { Progress } from '@/components/ui/progress';

export function EnhanceProgressBar({
  label = 'Enhancing',
  current,
  total,
  busy,
}: {
  label?: string;
  current?: number | null;
  total?: number | null;
  busy?: boolean;
}) {
  const hasCounts = typeof current === 'number' && typeof total === 'number' && total > 0;
  const percent = hasCounts ? Math.round((current / Math.max(1, total)) * 100) : busy ? 15 : 0;
  if (!busy && !hasCounts) return null;
  return (
    <div className="border-b border-slate-200 bg-white px-4 py-2">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-semibold text-slate-700">
          {hasCounts ? `${label} ${current} / ${total}` : `${label}…`}
        </p>
        <span className="text-xs font-semibold tabular-nums text-slate-500">{percent}%</span>
      </div>
      <Progress value={percent} className="mt-1.5 h-2" />
    </div>
  );
}
