'use client';

import { useEffect, useState } from 'react';
import type { WordSearchPuzzle, WordSearchSettings } from '@/lib/puzzles/types';
import { captureGridSnapshot } from '@/lib/solution-canvas-snapshot';

interface SolutionGridSnapshotProps {
  puzzle: WordSearchPuzzle;
  settings: WordSearchSettings;
  cellSizePt: number;
  gridFontSizePt: number;
  leftPx: number;
  topPx: number;
  widthPx: number;
  heightPx: number;
}

export function SolutionGridSnapshot({
  puzzle,
  settings,
  cellSizePt,
  gridFontSizePt,
  leftPx,
  topPx,
  widthPx,
  heightPx,
}: SolutionGridSnapshotProps) {
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void captureGridSnapshot(puzzle, settings, cellSizePt, gridFontSizePt, { scale: 2 }).then(
      (url) => {
        if (!cancelled) setSrc(url);
      }
    );
    return () => {
      cancelled = true;
    };
  }, [puzzle, settings, cellSizePt, gridFontSizePt]);

  const boxStyle = {
    position: 'absolute' as const,
    left: leftPx,
    top: topPx,
    width: widthPx,
    height: heightPx,
    display: 'block' as const,
    zIndex: 2,
    pointerEvents: 'none' as const,
  };

  if (!src) {
    return <div style={{ ...boxStyle, backgroundColor: '#f8fafc' }} aria-hidden />;
  }

  return <img src={src} alt="" style={boxStyle} draggable={false} />;
}
