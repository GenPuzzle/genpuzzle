'use client';

import React, { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { CrosswordPuzzle } from '@/lib/puzzles/types';
import type { CrosswordSettings } from '@/lib/crossword-settings';
import {
  getDefaultCrosswordSettings,
  normalizeCrosswordSettings,
  greyscaleToCss,
  INTERIOR_LIGHT_GREY_FILL,
} from '@/lib/crossword-settings';
import { findInteriorUnusedCells } from '@/lib/puzzles/crossword';
import {
  crosswordClueSpacingFromSettings,
  estimateWrapLineCount,
  fitCrosswordClueSpacing,
  minCrosswordClueSpacing,
  type CrosswordClueSpacing,
} from '@/lib/crossword-puzzle-page-layout';

interface CrosswordGridProps {
  puzzle: CrosswordPuzzle;
  showSolution?: boolean;
  cellSize?: number;
  crosswordSettings?: CrosswordSettings | null;
  /** Optional override for gap between grid and clues (px). */
  puzzleToCluesGapPx?: number;
  /** Hide Across/Down clue lists (e.g. multi-solution pages). */
  hideClues?: boolean;
}

function emptySquareFill(squareColorRange: number): string {
  const v = Math.max(0, Math.min(255, Math.round(squareColorRange)));
  const hex = v.toString(16).padStart(2, '0');
  return `#${hex}${hex}${hex}`;
}

/** Numbered answers as "1.WORD  4.WORD" — never pipe-separated. */
function formatAnswerKeyLine(
  clues: { number: number; answer: string }[],
  formatAnswer: (answer: string) => string
): string {
  return clues
    .map((clue) => `${clue.number}.${formatAnswer(clue.answer)}`)
    .join('  ');
}

function clueItemText(clue: { number: number; clue: string }): string {
  return `${clue.number}. ${clue.clue}`;
}

/** Across / Down clue columns — always intended to span full page content width. */
export function CrosswordClueLists({
  puzzle,
  crosswordSettings,
  className,
  availableHeightPx,
  fillHeight = false,
}: {
  puzzle: CrosswordPuzzle;
  crosswordSettings?: CrosswordSettings | null;
  className?: string;
  /** Remaining vertical space for clues (px). Spacing compresses to fit. */
  availableHeightPx?: number;
  /** Fill the parent and measure its height for fitting. */
  fillHeight?: boolean;
}) {
  const settings = normalizeCrosswordSettings(
    crosswordSettings ?? getDefaultCrosswordSettings()
  );
  const { colors, typography } = settings;
  const preferredColumns = typography.clueLayout === 'single' ? 1 : 2;
  const preferred = useMemo(
    () => crosswordClueSpacingFromSettings(settings),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [settings.typography.clueSpaceVertical, settings.typography.clueSpaceHorizontal]
  );
  const wrapRef = useRef<HTMLDivElement>(null);
  const [measured, setMeasured] = useState({ width: 0, height: 0 });

  useLayoutEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const apply = () => {
      const height =
        availableHeightPx != null && availableHeightPx > 0
          ? availableHeightPx
          : fillHeight
            ? el.clientHeight
            : 0;
      const width = el.clientWidth;
      setMeasured((prev) =>
        Math.abs(prev.width - width) > 0.5 || Math.abs(prev.height - height) > 0.5
          ? { width, height }
          : prev
      );
    };
    apply();
    const ro = new ResizeObserver(apply);
    ro.observe(el);
    return () => ro.disconnect();
  }, [availableHeightPx, fillHeight, puzzle, typography.clueFontSize, typography.clueLayout]);

  const fitWidth = measured.width > 0 ? measured.width : 1;
  const fitHeight = measured.height > 0 ? measured.height : availableHeightPx ?? 0;
  const fitted = useMemo(() => {
    if (fitHeight <= 0) {
      return { spacing: preferred, columns: preferredColumns as 1 | 2 };
    }
    return {
      spacing: fitCrosswordClueSpacing({
        availableHeight: fitHeight,
        availableWidth: fitWidth,
        columns: preferredColumns as 1 | 2,
        clueFontSize: typography.clueFontSize,
        headingFontSize: typography.acrossDownFontSize || typography.clueFontSize + 2,
        preferred,
        min: minCrosswordClueSpacing(),
        acrossTexts: puzzle.acrossClues.map(clueItemText),
        downTexts: puzzle.downClues.map(clueItemText),
        measureLineCount: estimateWrapLineCount,
      }).spacing,
      columns: preferredColumns as 1 | 2,
    };
  }, [
    fitHeight,
    fitWidth,
    preferred,
    preferredColumns,
    puzzle.acrossClues,
    puzzle.downClues,
    typography.acrossDownFontSize,
    typography.clueFontSize,
  ]);

  const spacing: CrosswordClueSpacing = fitted.spacing;
  const clueColumns = fitted.columns;

  return (
    <div
      ref={wrapRef}
      className={className}
      style={{
        display: 'grid',
        width: '100%',
        maxWidth: '100%',
        minWidth: 0,
        height: fillHeight || availableHeightPx != null ? '100%' : undefined,
        boxSizing: 'border-box',
        gridTemplateColumns: `repeat(${clueColumns}, minmax(0, 1fr))`,
        columnGap: spacing.columnGap,
        rowGap: spacing.sectionGap,
        overflow: 'hidden',
        alignContent: 'start',
      }}
    >
      <div className="min-w-0">
        <h4
          className="font-bold uppercase tracking-wide"
          style={{
            fontFamily: typography.acrossDownFontFamily || typography.clueFontFamily,
            fontSize: typography.acrossDownFontSize || typography.clueFontSize + 2,
            color: colors.cluesColor,
            marginBottom: spacing.headingAfter,
            lineHeight: 1.35,
          }}
        >
          ACROSS
        </h4>
        <ul style={{ display: 'flex', flexDirection: 'column', gap: spacing.itemGap }}>
          {puzzle.acrossClues.map((clue) => (
            <li
              key={`across-${clue.number}`}
              style={{
                fontFamily: typography.clueFontFamily,
                fontSize: typography.clueFontSize,
                lineHeight: spacing.lineHeightFactor,
                color: colors.cluesColor,
                overflowWrap: 'anywhere',
                wordBreak: 'break-word',
              }}
            >
              <span className="font-bold" style={{ color: colors.numbersColor, fontWeight: 'bold' }}>
                {clue.number}.
              </span>{' '}
              {clue.clue}
            </li>
          ))}
        </ul>
      </div>
      <div className="min-w-0">
        <h4
          className="font-bold uppercase tracking-wide"
          style={{
            fontFamily: typography.acrossDownFontFamily || typography.clueFontFamily,
            fontSize: typography.acrossDownFontSize || typography.clueFontSize + 2,
            color: colors.cluesColor,
            marginBottom: spacing.headingAfter,
            lineHeight: 1.35,
          }}
        >
          DOWN
        </h4>
        <ul style={{ display: 'flex', flexDirection: 'column', gap: spacing.itemGap }}>
          {puzzle.downClues.map((clue) => (
            <li
              key={`down-${clue.number}`}
              style={{
                fontFamily: typography.clueFontFamily,
                fontSize: typography.clueFontSize,
                lineHeight: spacing.lineHeightFactor,
                color: colors.cluesColor,
                overflowWrap: 'anywhere',
                wordBreak: 'break-word',
              }}
            >
              <span className="font-bold" style={{ color: colors.numbersColor, fontWeight: 'bold' }}>
                {clue.number}.
              </span>{' '}
              {clue.clue}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

/**
 * Build the SVG path data for all grid lines needed for a crossword.
 *
 * Strategy — draw one line segment per contiguous run of active cells
 * along each grid edge, so lines are drawn EXACTLY ONCE with no doubling.
 * SVG stroke is always crisp and ignores the container's fractional position.
 *
 * lineOffset: half the stroke width, used to align centre of stroke exactly
 * on integer grid coordinates (SVG strokes are centred on the path).
 */
function buildGridLinePaths(
  puzzle: CrosswordPuzzle,
  rows: number,
  cols: number,
  cs: number,
  unusedTransparent: boolean,
  interiorUnused: boolean[][]
): { horizontal: string; vertical: string } {
  const isCellVisible = (r: number, c: number): boolean => {
    if (r < 0 || r >= rows || c < 0 || c >= cols) return false;
    const cell = puzzle.grid[r]?.[c];
    if (!cell) return false;
    if (!cell.isBlack) return true;
    if (unusedTransparent) {
      return interiorUnused[r]?.[c] === true;
    }
    return true;
  };

  const needsHLine = (r: number, c: number): boolean => {
    const topVisible = isCellVisible(r - 1, c);
    const botVisible = isCellVisible(r, c);
    return topVisible !== botVisible || (topVisible && botVisible);
  };

  const needsVLine = (r: number, c: number): boolean => {
    const leftVisible = isCellVisible(r, c - 1);
    const rightVisible = isCellVisible(r, c);
    return leftVisible !== rightVisible || (leftVisible && rightVisible);
  };

  let hPath = '';
  // Horizontal lines: scan row edges (r = 0..rows)
  for (let r = 0; r <= rows; r++) {
    let runStart = -1;
    const flush = (endC: number) => {
      if (runStart < 0) return;
      const y = r * cs;
      hPath += `M${runStart * cs} ${y}L${endC * cs} ${y}`;
      runStart = -1;
    };
    for (let c = 0; c < cols; c++) {
      if (needsHLine(r, c)) {
        if (runStart < 0) runStart = c;
      } else {
        flush(c);
      }
    }
    flush(cols);
  }

  let vPath = '';
  // Vertical lines: scan column edges (c = 0..cols)
  for (let c = 0; c <= cols; c++) {
    let runStart = -1;
    const flush = (endR: number) => {
      if (runStart < 0) return;
      const x = c * cs;
      vPath += `M${x} ${runStart * cs}L${x} ${endR * cs}`;
      runStart = -1;
    };
    for (let r = 0; r < rows; r++) {
      if (needsVLine(r, c)) {
        if (runStart < 0) runStart = r;
      } else {
        flush(r);
      }
    }
    flush(rows);
  }

  return { horizontal: hPath, vertical: vPath };
}

export function CrosswordGrid({
  puzzle,
  showSolution = false,
  cellSize = 30,
  crosswordSettings,
  puzzleToCluesGapPx,
  hideClues = false,
}: CrosswordGridProps) {
  const settings = normalizeCrosswordSettings(
    crosswordSettings ?? getDefaultCrosswordSettings()
  );
  const { colors, typography, core } = settings;
  const emptyFill = emptySquareFill(colors.squareColorRange);

  /**
   * Unused boxes are treated as transparent (completely invisible, no stroke)
   * when EITHER of these conditions is true:
   *   1. The "Make unused boxes transparent" checkbox is checked.
   *   2. The "Unused Boxes (white → black)" slider is at 0 (maps to #ffffff).
   */
  const unusedTransparent =
    colors.unusedBoxesTransparent === true ||
    (colors.blackSquareGreyscale ?? 255) === 0;

  const blackFill = unusedTransparent
    ? null
    : greyscaleToCss(colors.blackSquareGreyscale ?? 255);

  const interiorUnused = useMemo(
    () => findInteriorUnusedCells(puzzle.grid),
    [puzzle.grid]
  );

  /**
   * Integer cell size — guarantees all grid coordinates are on integer pixels.
   * The SVG overlay then draws crisp lines at those exact pixel positions.
   */
  const cs = Math.max(4, Math.round(cellSize));

  /**
   * lineThicknessPx is already normalised in crossword-settings.ts (≥0.5).
   * We use the exact normalised value as the SVG stroke-width.
   */
  const strokeW = Math.max(0.5, colors.lineThicknessPx ?? 1);

  /**
   * lineColor comes directly from settings — no fallback substitution here.
   * The normalizeCrosswordSettings spreads the user's value on top of the
   * default, so if the user picked black (#000000) this will be '#000000'.
   */
  const lineColor = colors.lineColor ?? '#cccccc';

  const showClueLists = !showSolution && !hideClues;
  const showAnswerKey = showSolution && typography.showAnswerKey !== false;
  const gapPx =
    puzzleToCluesGapPx ??
    Math.round((typography.spaceBetweenPuzzleAndClues || 0.25) * 72);
  const answerKeyFontSize = typography.answerKeyFontSize ?? 11;
  const gridCols = puzzle.grid[0]?.length ?? 0;
  const gridRows = puzzle.grid.length;
  const gridW = gridCols * cs;
  const gridH = gridRows * cs;

  const formatAnswer = (answer: string) => {
    if (core.answerCase === 'lower') return answer.toLowerCase();
    if (core.answerCase === 'original') return answer;
    return answer.toUpperCase();
  };

  const numberFontSize = showSolution
    ? typography.numberFontSizeAnswers
    : typography.numberFontSizePuzzle;

  const letterFontSize = Math.min(
    typography.gridLetterFontSize || cs * 0.5,
    cs * 0.72
  );

  const acrossKey = formatAnswerKeyLine(puzzle.acrossClues, formatAnswer);
  const downKey = formatAnswerKeyLine(puzzle.downClues, formatAnswer);

  /**
   * SVG line paths — computed once per render.
   * The SVG is absolutely positioned over the cell divs so it never affects layout.
   * stroke-width is set to strokeW; SVG strokes are centred on the path, so a
   * 1px stroke at coordinate N spans N-0.5 to N+0.5 — still exactly 1 physical
   * pixel when the SVG is pixel-aligned (which it is because gridW/gridH are integers).
   */
  const { horizontal: hPath, vertical: vPath } = useMemo(
    () => buildGridLinePaths(puzzle, gridRows, gridCols, cs, unusedTransparent, interiorUnused),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [puzzle.grid, gridRows, gridCols, cs, unusedTransparent, interiorUnused]
  );
  const combinedPath = hPath + vPath;

  return (
    <div
      className="w-full max-w-full min-w-0"
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: showClueLists ? gapPx : 0,
      }}
    >
      {/* Grid + answer key — fixed width so key aligns with grid */}
      <div
        className="flex flex-col max-w-full"
        style={{
          width: gridW > 0 ? gridW : undefined,
          gap: showAnswerKey ? gapPx : 0,
        }}
      >
        {/*
         * Grid area:
         *   Layer 1 (bottom) — cell fill divs: background colors only, NO CSS borders.
         *   Layer 2 (top)    — SVG overlay: pixel-perfect grid lines in lineColor.
         *
         * Because CSS borders on box-sizing:border-box cells shrink the content area
         * inconsistently (cells with top/left border vs without have different inner
         * heights), they cause text/numbers to shift by 1px per row — the "not straight"
         * visual. By removing all CSS borders from cells and drawing lines via SVG, the
         * cell content areas are always exactly cs×cs with no shrinkage, and the SVG
         * strokes land on exact integer coordinates regardless of the container's
         * fractional scroll/transform position.
         */}
        <div
          className="shrink-0"
          style={{
            width: gridW,
            height: gridH,
            position: 'relative',
            // Page background shows through transparent black cells.
            // We do NOT set a background here — the page's own background is correct.
          }}
        >
          {/* ── Layer 1: cell fills ── */}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'grid',
              gridTemplateColumns: `repeat(${gridCols}, ${cs}px)`,
              gridTemplateRows: `repeat(${gridRows}, ${cs}px)`,
            }}
          >
            {puzzle.grid.map((row, rowIndex) =>
              row.map((cell, colIndex) => {
                if (cell.isBlack) {
                  const isInterior = interiorUnused[rowIndex]?.[colIndex] === true;
                  const bg = unusedTransparent
                    ? (isInterior ? INTERIOR_LIGHT_GREY_FILL : 'transparent')
                    : (blackFill ?? 'transparent');

                  return (
                    <div
                      key={`${rowIndex}-${colIndex}`}
                      style={{
                        width: cs,
                        height: cs,
                        backgroundColor: bg,
                      }}
                    />
                  );
                }


                // Active cell — fill + content (no border; SVG layer draws the line).
                return (
                  <div
                    key={`${rowIndex}-${colIndex}`}
                    style={{
                      width: cs,
                      height: cs,
                      backgroundColor: emptyFill,
                      position: 'relative',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {!showSolution && cell.clueNumber != null && (
                      <span
                        style={{
                          position: 'absolute',
                          top: 0,
                          left: 2,
                          lineHeight: 1,
                          zIndex: 1,
                          fontSize: Math.max(1, Math.min(numberFontSize, cs * 0.55)),
                          fontFamily: typography.numberFontFamily,
                          color: colors.numbersColor,
                        }}
                      >
                        {cell.clueNumber}
                      </span>
                    )}
                    {showSolution && cell.letter && (
                      <span
                        style={{
                          fontWeight: 'bold',
                          fontSize: letterFontSize,
                          color: colors.answersColor,
                          fontFamily: typography.numberFontFamily,
                        }}
                      >
                        {formatAnswer(cell.letter)}
                      </span>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* ── Layer 2: SVG grid lines ── */}
          {combinedPath && (
            <svg
              style={{
                position: 'absolute',
                inset: 0,
                width: gridW,
                height: gridH,
                // Prevent the SVG from blocking pointer events on cells.
                pointerEvents: 'none',
                // Disable anti-aliasing so 1px strokes stay sharp.
                shapeRendering: 'crispEdges',
                overflow: 'visible',
              }}
              viewBox={`0 0 ${gridW} ${gridH}`}
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d={combinedPath}
                stroke={lineColor}
                strokeWidth={strokeW}
                fill="none"
                strokeLinecap="square"
              />
            </svg>
          )}
        </div>

        {showAnswerKey ? (
          <div
            className="text-left w-full box-border"
            style={{
              fontFamily: typography.clueFontFamily,
              fontSize: answerKeyFontSize,
              color: colors.answersColor,
              lineHeight: 1.45,
              display: 'flex',
              flexDirection: 'column',
              gap: Math.max(1, Math.round(answerKeyFontSize * 0.35)),
              overflowWrap: 'anywhere',
              wordBreak: 'break-word',
            }}
          >
            {acrossKey ? (
              <p style={{ margin: 0 }}>
                <span className="font-bold" style={{ color: colors.numbersColor }}>
                  Across:{' '}
                </span>
                {acrossKey}
              </p>
            ) : null}
            {downKey ? (
              <p style={{ margin: 0 }}>
                <span className="font-bold" style={{ color: colors.numbersColor }}>
                  Down:{' '}
                </span>
                {downKey}
              </p>
            ) : null}
          </div>
        ) : null}
      </div>

      {showClueLists ? (
        <CrosswordClueLists
          puzzle={puzzle}
          crosswordSettings={settings}
          className="w-full min-w-0"
        />
      ) : null}
    </div>
  );
}
