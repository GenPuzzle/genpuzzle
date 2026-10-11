'use client';

import React from 'react';
import { CanvasSelectable } from '@/components/CanvasSelectable';
import type { CanvasFormatTarget } from '@/lib/canvas-native-format';
import type { GenericPuzzleSettings } from '@/lib/generic-puzzle-settings';
import { computeGenericPageLayout } from '@/lib/generic-puzzle-page-layout';
import { PT_TO_CSS_PX } from '@/lib/puzzle-layout';
import type { TitleWordsSettings, WordSearchSettings } from '@/lib/puzzles/types';
import { buildBinairoElementParts } from '@/lib/resolved-layout/binairo-elements';
import { mazeSudokuPreviewRevision } from '@/lib/resolved-layout/SharedMazeSudokuView';
import { getResolvedPage } from '@/lib/resolved-layout/snapshot';
import { ResolvedElementsView } from '@/lib/resolved-layout/ResolvedElementsView';
import { shiftElements } from '@/lib/resolved-layout/shift';

/**
 * Binairo canvas: selection chrome hugs the fitted grid, not the full content slot.
 */
export function SelectableBinairoView({
  puzzle,
  puzzles,
  settings,
  titleWords,
  showSolution,
  gp,
  puzzleIndex,
  selectedTarget = null,
  onSelectTarget,
  gridScalePercent,
  onGridScaleChange,
}: {
  puzzle: any;
  puzzles: any[];
  settings: WordSearchSettings;
  titleWords: TitleWordsSettings;
  showSolution: boolean;
  gp: GenericPuzzleSettings;
  puzzleIndex: number;
  selectedTarget?: CanvasFormatTarget | null;
  onSelectTarget?: (target: CanvasFormatTarget) => void;
  gridScalePercent?: number;
  onGridScaleChange?: (scale: number) => void;
}) {
  const layers = React.useMemo(() => {
    const layout = computeGenericPageLayout({
      puzzleType: 'binairo',
      showSolution,
      layoutSettings: settings,
      titleWords,
      puzzleIndex,
      puzzles,
      cw: null,
      gp,
    });
    const slotIndex = Math.max(
      0,
      layout.slots.findIndex((slot) => slot.index === puzzles.indexOf(puzzle))
    );
    const slot = layout.slots[slotIndex]?.content ?? layout.slots[0]?.content;
    if (!slot) return null;

    const parts = buildBinairoElementParts({
      puzzle,
      slot,
      gp,
      showSolution,
      preferredCellPt: layout.genericCellPt,
    });
    const dx = slot.leftPt;
    const dy = slot.topPt;
    const elements = shiftElements(parts.elements, dx, dy);
    const revision = mazeSudokuPreviewRevision({
      puzzleType: 'binairo',
      showSolution,
      slot,
      cell: layout.genericCellPt,
      frame: null,
      puzzle,
      gp,
    });
    getResolvedPage(revision, () => ({
      id: revision,
      kind: 'binairo',
      widthPt: slot.widthPt,
      heightPt: slot.heightPt,
      revision,
      elements,
    }));

    return {
      widthPt: slot.widthPt,
      heightPt: slot.heightPt,
      elements,
      gridBox: {
        x: parts.gridBox.x - dx,
        y: parts.gridBox.y - dy,
        w: parts.gridBox.w,
        h: parts.gridBox.h,
      },
    };
  }, [gp, puzzle, puzzleIndex, puzzles, settings, showSolution, titleWords]);

  if (!layers) return null;
  const scale = PT_TO_CSS_PX;

  return (
    <div
      className="relative mx-auto"
      style={{
        width: layers.widthPt * scale,
        height: layers.heightPt * scale,
      }}
    >
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
        <ResolvedElementsView
          elements={layers.elements}
          widthPt={layers.widthPt}
          heightPt={layers.heightPt}
        />
      </div>
      <CanvasSelectable
        target="grid"
        label="Grid"
        active={selectedTarget === 'grid'}
        onSelect={onSelectTarget}
        scalePercent={onGridScaleChange ? gridScalePercent : undefined}
        onScaleChange={onGridScaleChange}
        scaleMin={30}
        scaleMax={250}
        style={{
          position: 'absolute',
          left: layers.gridBox.x * scale,
          top: layers.gridBox.y * scale,
          width: layers.gridBox.w * scale,
          height: layers.gridBox.h * scale,
          zIndex: 2,
        }}
      >
        <div style={{ width: '100%', height: '100%' }} />
      </CanvasSelectable>
    </div>
  );
}
