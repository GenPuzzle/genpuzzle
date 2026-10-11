'use client';

import React from 'react';
import { computeGenericPageLayout } from '../generic-puzzle-page-layout';
import type { GenericPuzzleSettings } from '../generic-puzzle-settings';
import { mazeStartEndRevisionKey } from '../maze-start-end-images';
import type { TitleWordsSettings, WordSearchSettings } from '../puzzles/types';
import { buildMazeElementParts, buildMazeElements } from './maze-elements';
import { ResolvedElementsView } from './ResolvedElementsView';
import { getResolvedPage, stableRevision } from './snapshot';
import { shiftElements } from './shift';
import { buildSudokuElements } from './sudoku-elements';
import { buildCodewordsElements } from './codewords-elements';
import { buildBinairoElements } from './binairo-elements';
import { buildKakuroElements } from './kakuro-elements';
import { buildMathMazeElements } from './math-maze-elements';
import { buildFillElements } from './fill-elements';
import { buildSnakeElements } from './snake-elements';
import type { ResolvedElement, ResolvedImage } from './types';

/** Fields that must invalidate the canvas snapshot. Path style is included so Solid/Dashed/Dotted redraw immediately. */
export function mazeSudokuPreviewRevision(input: {
  puzzleType: 'maze' | 'sudoku' | 'codewords' | 'binairo' | 'kakuro' | 'math-maze' | 'word-fill' | 'number-fill' | 'snake';
  showSolution: boolean;
  slot: unknown;
  cell: number;
  frame: number | null;
  puzzle: {
    grid?: unknown;
    solution?: unknown;
    solutionGrid?: unknown;
    puzzleGrid?: unknown;
    puzzle?: unknown;
    puzzleIndexInDocument?: number;
    equations?: unknown;
    path?: unknown;
    variant?: unknown;
    cages?: unknown;
    inequalities?: unknown;
  };
  gp: GenericPuzzleSettings;
}): string {
  const { puzzleType, showSolution, slot, cell, frame, puzzle, gp } = input;
  return stableRevision({
    puzzleType,
    showSolution,
    slot,
    cell,
    frame,
    grid: puzzle.grid ?? puzzle.puzzleGrid ?? puzzle.puzzle,
    solution: puzzle.solution ?? puzzle.solutionGrid,
    variant: puzzle.variant,
    cages: puzzle.cages,
    inequalities: puzzle.inequalities,
    wall: gp.core.mazeWallThickness,
    line: showSolution ? gp.core.sudokuSolutionLineThickness : gp.core.sudokuPuzzleLineThickness,
    sudokuXStyle: gp.core.sudokuXMarkStyle,
    sudokuXLineThick: gp.core.sudokuXLineThickness,
    sudokuXLineTrans: gp.core.sudokuXLineTransparency,
    sudokuXBox: gp.colors.sudokuXBoxColor,
    sudokuXLine: gp.colors.sudokuXLineColor,
    pathStyle: gp.core.mazeSolutionPathStyle,
    pathThickness: gp.core.mazeSolutionPathThickness,
    pathColor: gp.colors.solutionPathColor,
    startEnd: mazeStartEndRevisionKey(gp.core.mazeStartEndImages, puzzle.puzzleIndexInDocument ?? 0),
    cwBlocked: gp.core.codewordsBlockedCellColor,
    cwPlayable: gp.core.codewordsPlayableCellColor,
    cwLine: gp.core.codewordsGridLineColor,
    cwStroke: gp.core.codewordsGridStrokeWidth,
    cwNum: gp.core.codewordsNumberColor,
    cwLet: gp.core.codewordsLetterColor,
    binLine: gp.core.binairoGridLineColor,
    binStroke: gp.core.binairoGridStrokeWidth,
    binSym: gp.core.binairoSymbolColor,
    binSymbols: gp.core.binairoSymbols,
    kakGrid: gp.core.kakuroGridLineColor,
    kakBlock: gp.core.kakuroBlockFill,
    kakClueFill: gp.core.kakuroClueCellFill,
    kakPlay: gp.core.kakuroPlayableFill,
    kakClueText: gp.core.kakuroClueTextColor,
    kakDigit: gp.core.kakuroDigitColor,
    kakLineW: gp.core.kakuroGridLineWidth ?? gp.core.kakuroInnerLineWidth,
    kakCluePad: gp.core.kakuroCluePadding,
    kakCellPad: gp.core.kakuroCellPadding,
    kakClueFont: gp.typography.kakuroClueFontFamily,
    kakClueSize: gp.typography.kakuroClueFontSize,
    kakClueBold: gp.typography.kakuroClueBold,
    puzzleFont: gp.typography.puzzleFontSize,
    answerFont: gp.typography.answerFontSize,
    puzzleFamily: gp.typography.puzzleFontFamily,
    answerFamily: gp.typography.answerFontFamily,
    wordListFont: gp.typography.wordListFontSize,
    wordListFamily: gp.typography.wordListFontFamily,
    wordListBold: gp.typography.wordListBold,
    puzzleBold: gp.typography.puzzleBold,
    puzzleItalic: gp.typography.puzzleItalic,
    letterCase: gp.core.letterCase,
    showKey: gp.core.showCodewordsCodeBox,
    fillBlock: gp.core.fillBlockFill,
    fillPlay: gp.core.fillPlayableFill,
    fillLine: gp.core.fillGridLineColor,
    fillLineW: gp.core.fillGridLineWidth,
  });
}

export type MazeCanvasLayers = {
  widthPt: number;
  heightPt: number;
  elements: ResolvedElement[];
  maze: ResolvedElement[];
  startImage: ResolvedImage | null;
  endImage: ResolvedImage | null;
  mazeBox: { x: number; y: number; w: number; h: number };
};

/** Slot-local maze layers for separate canvas selection of grid / start / end. */
export function computeMazeCanvasLayers(input: {
  puzzle: any;
  puzzles: any[];
  settings: WordSearchSettings;
  titleWords: TitleWordsSettings;
  showSolution: boolean;
  gp: GenericPuzzleSettings;
  puzzleIndex: number;
}): MazeCanvasLayers | null {
  const { puzzle, puzzles, settings, titleWords, showSolution, gp, puzzleIndex } = input;
  const layout = computeGenericPageLayout({
    puzzleType: 'maze',
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
  const parts = buildMazeElementParts({
    puzzle,
    slot,
    preferredCellPt: layout.genericCellPt,
    framePt: layout.mazeFramePt,
    gp,
    showSolution,
  });
  const dx = slot.leftPt;
  const dy = slot.topPt;
  const maze = shiftElements(parts.maze, dx, dy);
  const startImage = parts.startImage
    ? (shiftElements([parts.startImage], dx, dy)[0] as ResolvedImage)
    : null;
  const endImage = parts.endImage
    ? (shiftElements([parts.endImage], dx, dy)[0] as ResolvedImage)
    : null;
  const elements = [...maze, ...(startImage ? [startImage] : []), ...(endImage ? [endImage] : [])];
  const revision = mazeSudokuPreviewRevision({
    puzzleType: 'maze',
    showSolution,
    slot,
    cell: layout.genericCellPt,
    frame: layout.mazeFramePt,
    puzzle,
    gp,
  });
  getResolvedPage(revision, () => ({
    id: revision,
    kind: 'maze',
    widthPt: slot.widthPt,
    heightPt: slot.heightPt,
    revision,
    elements,
  }));
  return {
    widthPt: slot.widthPt,
    heightPt: slot.heightPt,
    elements,
    maze,
    startImage,
    endImage,
    mazeBox: {
      x: parts.mazeBox.x - dx,
      y: parts.mazeBox.y - dy,
      w: parts.mazeBox.w,
      h: parts.mazeBox.h,
    },
  };
}

/** Canvas body for maze and sudoku. Uses the same resolved elements as PDF and PPTX. */
export function SharedMazeSudokuView({
  puzzleType,
  puzzle,
  puzzles,
  settings,
  titleWords,
  showSolution,
  gp,
  puzzleIndex,
}: {
  puzzleType: 'maze' | 'sudoku' | 'codewords' | 'binairo' | 'kakuro' | 'math-maze' | 'word-fill' | 'number-fill' | 'snake';
  puzzle: any;
  puzzles: any[];
  settings: WordSearchSettings;
  titleWords: TitleWordsSettings;
  showSolution: boolean;
  gp: GenericPuzzleSettings;
  puzzleIndex: number;
}) {
  const page = React.useMemo(() => {
    const layout = computeGenericPageLayout({
      puzzleType,
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
    const revision = mazeSudokuPreviewRevision({
      puzzleType,
      showSolution,
      slot,
      cell: layout.genericCellPt,
      frame: layout.mazeFramePt,
      puzzle,
      gp,
    });
    return getResolvedPage(revision, () => {
      const absolute =
        puzzleType === 'maze'
          ? buildMazeElements({
              puzzle,
              slot,
              preferredCellPt: layout.genericCellPt,
              framePt: layout.mazeFramePt,
              gp,
              showSolution,
            })
          : puzzleType === 'codewords'
            ? buildCodewordsElements({
                puzzle,
                slot,
                gp,
                showSolution,
                preferredCellPt: layout.genericCellPt,
              })
            : puzzleType === 'binairo'
              ? buildBinairoElements({
                  puzzle,
                  slot,
                  gp,
                  showSolution,
                  preferredCellPt: layout.genericCellPt,
                })
              : puzzleType === 'kakuro'
                ? buildKakuroElements({
                    puzzle,
                    slot,
                    gp,
                    showSolution,
                    preferredCellPt: layout.genericCellPt,
                  })
                : puzzleType === 'math-maze'
                  ? buildMathMazeElements({
                      puzzle,
                      slot,
                      gp,
                      showSolution,
                      preferredCellPt: layout.genericCellPt,
                    })
                  : (puzzleType === 'word-fill' || puzzleType === 'number-fill')
                    ? buildFillElements({
                        puzzle,
                        slot,
                        gp,
                        showSolution,
                        preferredCellPt: layout.genericCellPt,
                      })
                    : puzzleType === 'snake'
                      ? buildSnakeElements({
                          puzzle,
                          slot,
                          gp,
                          showSolution,
                          preferredCellPt: layout.genericCellPt,
                        })
                : buildSudokuElements({
                  puzzle,
                  slot,
                  gp,
                  showSolution,
                  preferredCellPt: layout.genericCellPt,
                });
      return {
        id: revision,
        kind: puzzleType,
        widthPt: slot.widthPt,
        heightPt: slot.heightPt,
        revision,
        elements: shiftElements(absolute, slot.leftPt, slot.topPt),
      };
    });
  }, [gp, puzzle, puzzleIndex, puzzleType, puzzles, settings, showSolution, titleWords]);

  if (!page) return null;
  return <ResolvedElementsView elements={page.elements} widthPt={page.widthPt} heightPt={page.heightPt} />;
}
