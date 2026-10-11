'use client';

import React from 'react';
import { CanvasChrome } from '@/components/CanvasSelectable';
import type { CanvasFormatTarget } from '@/lib/canvas-native-format';
import type { GenericPuzzleSettings } from '@/lib/generic-puzzle-settings';
import { computeGenericPageLayout } from '@/lib/generic-puzzle-page-layout';
import { PT_TO_CSS_PX } from '@/lib/puzzle-layout';
import type { TitleWordsSettings, WordSearchSettings } from '@/lib/puzzles/types';
import {
  buildKakuroElementParts,
  type KakuroFontHit,
} from '@/lib/resolved-layout/kakuro-elements';
import { mazeSudokuPreviewRevision } from '@/lib/resolved-layout/SharedMazeSudokuView';
import { getResolvedPage } from '@/lib/resolved-layout/snapshot';
import { ResolvedElementsView } from '@/lib/resolved-layout/ResolvedElementsView';
import { shiftElements } from '@/lib/resolved-layout/shift';

function hitAt(hits: KakuroFontHit[], xPt: number, yPt: number): KakuroFontHit | null {
  for (let i = hits.length - 1; i >= 0; i--) {
    const hit = hits[i]!;
    if (
      xPt >= hit.x &&
      xPt < hit.x + hit.w &&
      yPt >= hit.y &&
      yPt < hit.y + hit.h
    ) {
      return hit;
    }
  }
  return null;
}

/** Kakuro canvas: click clue/digit text to format; grid chrome for resize. */
export function SelectableKakuroView({
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
      puzzleType: 'kakuro',
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

    const parts = buildKakuroElementParts({
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
      puzzleType: 'kakuro',
      showSolution,
      slot,
      cell: layout.genericCellPt,
      frame: null,
      puzzle,
      gp,
    });
    getResolvedPage(revision, () => ({
      id: revision,
      kind: 'kakuro',
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
      fontHits: parts.fontHits.map((hit) => ({
        ...hit,
        x: hit.x - dx,
        y: hit.y - dy,
      })),
    };
  }, [gp, puzzle, puzzleIndex, puzzles, settings, showSolution, titleWords]);

  if (!layers) return null;
  const scale = PT_TO_CSS_PX;

  const textSelected = selectedTarget === 'clues' || selectedTarget === 'grid';
  const selectActive = textSelected;

  const onFontPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!onSelectTarget) return;
    event.stopPropagation();
    const bounds = event.currentTarget.getBoundingClientRect();
    const xPt = ((event.clientX - bounds.left) / Math.max(1, bounds.width)) * layers.widthPt;
    const yPt = ((event.clientY - bounds.top) / Math.max(1, bounds.height)) * layers.heightPt;
    const hit = hitAt(layers.fontHits, xPt, yPt);
    if (hit) {
      onSelectTarget(hit.target);
      return;
    }
    const g = layers.gridBox;
    if (xPt >= g.x && xPt < g.x + g.w && yPt >= g.y && yPt < g.y + g.h) {
      onSelectTarget('grid');
    }
  };

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

      {onSelectTarget ? (
        <div
          role="presentation"
          aria-label="Kakuro text hit area"
          onPointerDown={onFontPointerDown}
          style={{
            position: 'absolute',
            inset: 0,
            zIndex: 3,
            cursor: 'pointer',
          }}
        />
      ) : null}

      {onSelectTarget ? (
        <CanvasChrome
          label={selectedTarget === 'clues' ? 'Clue numbers' : 'Grid'}
          active={selectActive}
          onSelect={() => onSelectTarget('grid')}
          scalePercent={onGridScaleChange ? gridScalePercent : undefined}
          onScaleChange={onGridScaleChange}
          scaleMin={30}
          scaleMax={250}
          showChrome={false}
          style={{
            position: 'absolute',
            left: layers.gridBox.x * scale,
            top: layers.gridBox.y * scale,
            width: layers.gridBox.w * scale,
            height: layers.gridBox.h * scale,
            zIndex: 6,
            pointerEvents: 'none',
          }}
        >
          <div style={{ width: '100%', height: '100%', pointerEvents: 'none' }} />
        </CanvasChrome>
      ) : null}
    </div>
  );
}
