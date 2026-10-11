'use client';

import React, { useEffect, useRef } from 'react';
import { diagMark } from '@/lib/crossword-freeze-diag';

/**
 * Temporary render-timing probe for Crossword switch lag.
 * Logs commits >= 8ms when gpDiag is enabled.
 */
export function DiagRenderProbe({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  const countRef = useRef(0);
  const t0Ref = useRef(0);
  t0Ref.current = typeof performance !== 'undefined' ? performance.now() : 0;
  countRef.current += 1;
  const renderN = countRef.current;

  useEffect(() => {
    const ms = performance.now() - t0Ref.current;
    if (ms >= 8) {
      diagMark(`render.${label}`, ms, `n=${renderN}`);
    }
  });

  return <>{children}</>;
}
