'use client';

import React from 'react';
import { SudokuPuzzle } from '@/lib/puzzles/types';
import { formatSudokuSymbol, SUDOKU_BOX, isSudokuSize } from '@/lib/puzzles/sudoku';
import type { SudokuDifficultyPlacement } from '@/lib/generic-puzzle-settings';
import {
  buildCalcudokuCageIdGrid,
  calcudokuCageLabel,
  calcudokuInternalBorder,
  calcudokuLabelCell,
  isCalcudokuPuzzle,
} from '@/lib/puzzles/calcudoku';

interface SudokuGridProps {
  puzzle: SudokuPuzzle;
  showSolution?: boolean;
  cellSize?: number;
  gridColor?: string;
  /** @deprecated Prefer difficultyPlacement */
  showDifficulty?: boolean;
  difficultyPlacement?: SudokuDifficultyPlacement;
  /**
   * Absolute digit font size in px (legacy). Prefer `fontSizePt` so size
   * survives FitToSafeArea / multi-up cell shrinkage.
   */
  fontSizePx?: number;
  /**
   * Typography setting in points. Mapped to a cell fill ratio so the slider
   * always changes digit size even when cells are tiny (multi-up solutions).
   */
  fontSizePt?: number;
  /** Line thickness scale percent (100 = default 1px thin / 2px box). */
  lineThicknessPercent?: number;
}

function resolveSize(puzzle: SudokuPuzzle): number {
  const n = Number(puzzle.size ?? puzzle.grid?.length ?? puzzle.solution?.length ?? 9);
  if (Number.isFinite(n) && n >= 2 && n <= 36) return Math.round(n);
  return 9;
}

/** Map typography pt → digit fill of the cell (independent of absolute px). */
export function sudokuDigitFillRatio(fontSizePt: number): number {
  const t = Math.max(6, Math.min(56, fontSizePt));
  // 8pt → ~0.36, 16pt → ~0.50, 28pt → ~0.70, 48pt → ~0.90
  return 0.32 + ((t - 6) / 50) * (0.92 - 0.32);
}

function resolveDigitPx(
  cellSize: number,
  fontSizePt: number | undefined,
  fontSizePx: number | undefined
): number {
  if (fontSizePt != null && Number.isFinite(fontSizePt) && fontSizePt > 0) {
    return cellSize * sudokuDigitFillRatio(fontSizePt);
  }
  if (fontSizePx != null && Number.isFinite(fontSizePx) && fontSizePx > 0) {
    return Math.max(cellSize * 0.28, Math.min(fontSizePx, cellSize * 0.92));
  }
  return cellSize * 0.5;
}

function calcudokuLabelPx(cellSize: number, label: string): number {
  const len = Math.max(2, label.length);
  return Math.max(6, Math.min(cellSize * 0.28, (cellSize * 0.9) / len));
}

export function SudokuGrid({
  puzzle,
  showSolution = false,
  cellSize = 40,
  gridColor = '#1f2937',
  showDifficulty = false,
  difficultyPlacement,
  fontSizePx,
  fontSizePt,
  lineThicknessPercent = 100,
}: SudokuGridProps) {
  const displayGrid = showSolution ? puzzle.solution : puzzle.grid;
  const size = resolveSize(puzzle);
  const calcudoku = isCalcudokuPuzzle(puzzle);
  const box = !calcudoku && isSudokuSize(size) ? SUDOKU_BOX[size] : { boxH: size, boxW: size };
  const cageIds = calcudoku ? buildCalcudokuCageIdGrid(size, puzzle.cages) : null;
  const labelByCell = new Map<string, string>();
  if (calcudoku) {
    for (const cage of puzzle.cages) {
      const cell = calcudokuLabelCell(cage);
      labelByCell.set(`${cell.row},${cell.col}`, calcudokuCageLabel(cage));
    }
  }
  const scale = Math.max(0.25, (lineThicknessPercent || 100) / 100);
  const thinPx = Math.max(0.5, 1 * scale);
  const thickPx = Math.max(1, 2 * scale);
  const outerPx = Math.max(1.5, 2 * scale);
  const digitPx = resolveDigitPx(cellSize, fontSizePt, fontSizePx);

  const placement: SudokuDifficultyPlacement =
    difficultyPlacement ?? (showDifficulty ? 'bottom' : 'none');
  const difficultyLabel =
    placement === 'top' || placement === 'bottom' ? (
      <div
        className="text-center text-gray-600"
        style={{
          fontSize: Math.max(10, Math.min(digitPx * 0.7, cellSize * 0.34)),
          marginTop: placement === 'bottom' ? 8 : 0,
          marginBottom: placement === 'top' ? 8 : 0,
        }}
      >
        Difficulty: <span className="font-medium capitalize">{puzzle.difficulty}</span>
      </div>
    ) : null;

  return (
    <div className="inline-block bg-white">
      {placement === 'top' ? difficultyLabel : null}
      <div
        className="grid gap-0"
        style={{
          gridTemplateColumns: `repeat(${size}, ${cellSize}px)`,
          border: `${outerPx}px solid ${gridColor}`,
          boxSizing: 'border-box',
        }}
      >
        {displayGrid.map((row, rowIndex) =>
          row.map((num, colIndex) => {
            const isBoxColBorder = (colIndex + 1) % box.boxW === 0 && colIndex < size - 1;
            const isBoxRowBorder = (rowIndex + 1) % box.boxH === 0 && rowIndex < size - 1;
            const rightKind = cageIds
              ? calcudokuInternalBorder(cageIds, rowIndex, colIndex, 'right')
              : isBoxColBorder
                ? 'thick'
                : 'thin';
            const bottomKind = cageIds
              ? calcudokuInternalBorder(cageIds, rowIndex, colIndex, 'bottom')
              : isBoxRowBorder
                ? 'thick'
                : 'thin';
            const isGiven = puzzle.grid[rowIndex]?.[colIndex] !== 0;
            const label = labelByCell.get(`${rowIndex},${colIndex}`);
            const labelPx = label ? calcudokuLabelPx(cellSize, label) : 0;

            return (
              <div
                key={`${rowIndex}-${colIndex}`}
                className="flex items-center justify-center select-none"
                style={{
                  position: 'relative',
                  width: cellSize,
                  height: cellSize,
                  backgroundColor: '#ffffff',
                  color: isGiven || showSolution ? gridColor : '#6b7280',
                  fontWeight: isGiven || showSolution ? 700 : 400,
                  borderRight:
                    rightKind === 'thick'
                      ? `${thickPx}px solid ${gridColor}`
                      : rightKind === 'thin'
                        ? `${thinPx}px solid #d1d5db`
                        : undefined,
                  borderBottom:
                    bottomKind === 'thick'
                      ? `${thickPx}px solid ${gridColor}`
                      : bottomKind === 'thin'
                        ? `${thinPx}px solid #d1d5db`
                        : undefined,
                  fontSize: digitPx,
                  lineHeight: 1,
                }}
              >
                {label ? (
                  <span
                    style={{
                      position: 'absolute',
                      top: Math.max(1, cellSize * 0.04),
                      left: Math.max(2, cellSize * 0.05),
                      fontSize: labelPx,
                      fontWeight: 700,
                      color: gridColor,
                      lineHeight: 1,
                      pointerEvents: 'none',
                    }}
                  >
                    {label}
                  </span>
                ) : null}
                {formatSudokuSymbol(num)}
              </div>
            );
          })
        )}
      </div>
      {placement === 'bottom' ? difficultyLabel : null}
    </div>
  );
}
