'use client';

import React from 'react';
import { CanvasChrome } from '@/components/CanvasSelectable';
import type { CanvasFormatTarget } from '@/lib/canvas-native-format';
import type { GenericPuzzleSettings } from '@/lib/generic-puzzle-settings';
import { computeGenericPageLayout } from '@/lib/generic-puzzle-page-layout';
import { PT_TO_CSS_PX } from '@/lib/puzzle-layout';
import type { TitleWordsSettings, WordSearchSettings } from '@/lib/puzzles/types';
import {
  buildCodewordsElementParts,
  type CodewordsFontHit,
} from '@/lib/resolved-layout/codewords-elements';
import { ResolvedElementsView } from '@/lib/resolved-layout/ResolvedElementsView';
import { shiftElements } from '@/lib/resolved-layout/shift';

function hitAt(
  hits: CodewordsFontHit[],
  xPt: number,
  yPt: number
): CodewordsFontHit | null {
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

function unionBoxes(
  a: { x: number; y: number; w: number; h: number },
  b: { x: number; y: number; w: number; h: number } | null
) {
  if (!b) return a;
  const left = Math.min(a.x, b.x);
  const top = Math.min(a.y, b.y);
  const right = Math.max(a.x + a.w, b.x + b.w);
  const bottom = Math.max(a.y + a.h, b.y + b.h);
  return { x: left, y: top, w: right - left, h: bottom - top };
}

/**
 * Codewords canvas: shared fonts for grid + alphabet key.
 * One selection/resize chrome wraps grid and alphabet box together on puzzle pages.
 */
export function SelectableCodewordsView({
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
      puzzleType: 'codewords',
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

    const parts = buildCodewordsElementParts({
      puzzle,
      slot,
      gp,
      showSolution,
      preferredCellPt: layout.genericCellPt,
    });
    const dx = slot.leftPt;
    const dy = slot.topPt;

    const gridBox = {
      x: parts.gridBox.x - dx,
      y: parts.gridBox.y - dy,
      w: parts.gridBox.w,
      h: parts.gridBox.h,
    };
    const keyBox = parts.keyBox
      ? {
          x: parts.keyBox.x - dx,
          y: parts.keyBox.y - dy,
          w: parts.keyBox.w,
          h: parts.keyBox.h,
        }
      : null;

    const contentBottom = parts.keyBox
      ? parts.keyBox.y + parts.keyBox.h
      : parts.gridBox.y + parts.gridBox.h;

    return {
      widthPt: slot.widthPt,
      heightPt: Math.max(slot.heightPt, contentBottom - slot.topPt),
      gridBox,
      keyBox,
      /** Puzzle pages: one chrome for grid + alphabet box. Solutions: grid only. */
      selectBox: unionBoxes(gridBox, keyBox),
      elements: shiftElements(
        [
          ...parts.grid,
          ...parts.gridNumbers,
          ...parts.gridLetters,
          ...parts.key,
          ...parts.keyNumbers,
          ...parts.keyLetters,
        ],
        dx,
        dy
      ),
      fontHits: parts.fontHits.map((hit) => ({
        ...hit,
        x: hit.x - dx,
        y: hit.y - dy,
      })),
    };
  }, [gp, puzzle, puzzleIndex, puzzles, settings, showSolution, titleWords]);

  if (!layers) return null;
  const scale = PT_TO_CSS_PX;

  const fontSelected =
    selectedTarget === 'code-numbers' || selectedTarget === 'code-letters';
  const selectActive = selectedTarget === 'grid' || fontSelected;

  const onFontPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!onSelectTarget) return;
    event.stopPropagation();
    const bounds = event.currentTarget.getBoundingClientRect();
    const xPt = ((event.clientX - bounds.left) / Math.max(1, bounds.width)) * layers.widthPt;
    const yPt = ((event.clientY - bounds.top) / Math.max(1, bounds.height)) * layers.heightPt;
    const hit = hitAt(layers.fontHits, xPt, yPt);
    if (!hit) return;
    onSelectTarget(hit.target);
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
          aria-label="Codewords font hit area"
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
          label={layers.keyBox ? 'Grid & alphabet box' : 'Grid'}
          active={selectActive}
          onSelect={() => {
            if (showSolution) onSelectTarget('code-letters');
          }}
          scalePercent={onGridScaleChange ? gridScalePercent : undefined}
          onScaleChange={onGridScaleChange}
          scaleMin={30}
          scaleMax={250}
          showChrome={false}
          style={{
            position: 'absolute',
            left: layers.selectBox.x * scale,
            top: layers.selectBox.y * scale,
            width: layers.selectBox.w * scale,
            height: layers.selectBox.h * scale,
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
