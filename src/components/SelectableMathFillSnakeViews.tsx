'use client';

import React from 'react';
import { CanvasSelectable, CanvasChrome } from '@/components/CanvasSelectable';
import type { CanvasFormatTarget } from '@/lib/canvas-native-format';
import type { GenericPuzzleSettings } from '@/lib/generic-puzzle-settings';
import { computeGenericPageLayout } from '@/lib/generic-puzzle-page-layout';
import { PT_TO_CSS_PX } from '@/lib/puzzle-layout';
import type { TitleWordsSettings, WordSearchSettings } from '@/lib/puzzles/types';
import {
  buildMathMazeElementParts,
  type MathMazeFontHit,
} from '@/lib/resolved-layout/math-maze-elements';
import { buildFillElementParts } from '@/lib/resolved-layout/fill-elements';
import { buildSnakeElementParts } from '@/lib/resolved-layout/snake-elements';
import { mazeSudokuPreviewRevision } from '@/lib/resolved-layout/SharedMazeSudokuView';
import { getResolvedPage } from '@/lib/resolved-layout/snapshot';
import { ResolvedElementsView } from '@/lib/resolved-layout/ResolvedElementsView';
import { shiftElements } from '@/lib/resolved-layout/shift';

type Family = 'word-fill' | 'number-fill' | 'snake';

function buildParts(
  family: Family,
  args: {
    puzzle: any;
    slot: { leftPt: number; topPt: number; widthPt: number; heightPt: number };
    gp: GenericPuzzleSettings;
    showSolution: boolean;
    preferredCellPt: number;
  }
) {
  if (family === 'snake') return buildSnakeElementParts(args);
  return buildFillElementParts(args);
}

function hitAt(hits: MathMazeFontHit[], xPt: number, yPt: number): MathMazeFontHit | null {
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

function SelectableFamilyView({
  family,
  label,
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
  family: Family;
  label: string;
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
      puzzleType: family,
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

    const parts = buildParts(family, {
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
      puzzleType: family,
      showSolution,
      slot,
      cell: layout.genericCellPt,
      frame: null,
      puzzle,
      gp,
    });
    getResolvedPage(revision, () => ({
      id: revision,
      kind: family,
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
      listBox: parts.listBox
        ? {
            x: parts.listBox.x - dx,
            y: parts.listBox.y - dy,
            w: parts.listBox.w,
            h: parts.listBox.h,
          }
        : null,
    };
  }, [family, gp, puzzle, puzzleIndex, puzzles, settings, showSolution, titleWords]);

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
      {layers.listBox ? (
        <CanvasSelectable
          target="word-list"
          label={family === 'number-fill' ? 'Number List' : 'Word List'}
          active={selectedTarget === 'word-list'}
          onSelect={onSelectTarget}
          style={{
            position: 'absolute',
            left: layers.listBox.x * scale,
            top: layers.listBox.y * scale,
            width: layers.listBox.w * scale,
            height: layers.listBox.h * scale,
            zIndex: 2,
          }}
        >
          <div style={{ width: '100%', height: '100%' }} />
        </CanvasSelectable>
      ) : null}
      <CanvasSelectable
        target="grid"
        label={label}
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

/** Math Maze: click equations / path numbers / Start·End to format with the shared font bar. */
export function SelectableMathMazeView({
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
      puzzleType: 'math-maze',
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

    const parts = buildMathMazeElementParts({
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
      puzzleType: 'math-maze',
      showSolution,
      slot,
      cell: layout.genericCellPt,
      frame: null,
      puzzle,
      gp,
    });
    getResolvedPage(revision, () => ({
      id: revision,
      kind: 'math-maze',
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

  const textSelected =
    selectedTarget === 'math-equations' ||
    selectedTarget === 'math-path-numbers' ||
    selectedTarget === 'math-start-end';
  const selectActive = selectedTarget === 'grid' || textSelected;

  const chromeLabel =
    selectedTarget === 'math-path-numbers'
      ? 'Path numbers'
      : selectedTarget === 'math-start-end'
        ? 'Start / End'
        : selectedTarget === 'math-equations'
          ? 'Equations'
          : 'Math Maze';

  const onFontPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!onSelectTarget) return;
    event.stopPropagation();
    const bounds = event.currentTarget.getBoundingClientRect();
    const xPt =
      ((event.clientX - bounds.left) / Math.max(1, bounds.width)) * layers.widthPt;
    const yPt =
      ((event.clientY - bounds.top) / Math.max(1, bounds.height)) * layers.heightPt;
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
          aria-label="Math Maze text hit area"
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
          label={chromeLabel}
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

export function SelectableFillView(
  props: Omit<Parameters<typeof SelectableFamilyView>[0], 'family' | 'label'>
) {
  const family: Family = props.puzzle?.type === 'number-fill' ? 'number-fill' : 'word-fill';
  return (
    <SelectableFamilyView
      {...props}
      family={family}
      label={family === 'number-fill' ? 'Number Fill-In Grid' : 'Word Fill-In Grid'}
    />
  );
}

export function SelectableSnakeView(
  props: Omit<Parameters<typeof SelectableFamilyView>[0], 'family' | 'label'>
) {
  return <SelectableFamilyView {...props} family="snake" label="Word Snake Grid" />;
}
