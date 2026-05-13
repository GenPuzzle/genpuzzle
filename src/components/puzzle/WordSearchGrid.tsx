'use client';

import React, { useMemo } from 'react';
import { WordSearchPuzzle } from '@/lib/puzzles/types';

interface WordSearchGridProps {
  puzzle: WordSearchPuzzle;
  showSolution?: boolean;
  cellSize?: number;
  gridLines?: boolean;
  puzzleColor?: string;
  boxColor?: string;
  // Solution stroke settings
  solutionStrokeColor?: string;
  solutionStrokeThickness?: number;
  solutionStrokePadding?: number;
  // Frame style settings
  solutionFrameStyle?: 'rounded' | 'square' | 'circle';
  solutionFrameRadius?: number;
  onlyHighlightWordListWords?: boolean;
  wordList?: string[];
}

export function WordSearchGrid({
  puzzle,
  showSolution = false,
  cellSize = 28,
  gridLines = false,
  puzzleColor = '#1f2937',
  boxColor = '#1f2937',
  solutionStrokeColor = '#000000',
  solutionStrokeThickness = 1,
  solutionStrokePadding = 0,
  solutionFrameStyle = 'rounded',
  solutionFrameRadius = 6,
  onlyHighlightWordListWords = true,
  wordList = [],
}: WordSearchGridProps) {
  // Build placement cells map for highlighting frames
  const placementCells = useMemo(() => {
    const cells: { start: { row: number; col: number }; end: { row: number; col: number }; word?: string }[] = [];

    if (!puzzle.placements) return cells;

    if (showSolution) {
      return puzzle.placements.map((placement) => ({
        start: placement.start,
        end: placement.end,
        word: placement.word,
      }));
    }

    for (const placement of puzzle.placements) {
      if (onlyHighlightWordListWords && !wordList.some(w => w.toUpperCase() === placement.word.toUpperCase())) {
        continue;
      }

      cells.push({
        start: placement.start,
        end: placement.end,
        word: placement.word,
      });
    }

    return cells;
  }, [puzzle.placements, onlyHighlightWordListWords, wordList, showSolution]);

  // Check if a cell is part of a word placement
  const isInPlacement = (row: number, col: number): { start: { row: number; col: number }; end: { row: number; col: number } } | null => {
    for (const placement of placementCells) {
      const minRow = Math.min(placement.start.row, placement.end.row);
      const maxRow = Math.max(placement.start.row, placement.end.row);
      const minCol = Math.min(placement.start.col, placement.end.col);
      const maxCol = Math.max(placement.start.col, placement.end.col);

      if (row >= minRow && row <= maxRow && col >= minCol && col <= maxCol) {
        // Check if it's on the same row, column, or diagonal
        const isHorizontal = placement.start.row === placement.end.row && row === placement.start.row;
        const isVertical = placement.start.col === placement.end.col && col === placement.start.col;
        const isDiagonal = Math.abs(placement.start.row - placement.end.row) === Math.abs(placement.start.col - placement.end.col);

        if (isHorizontal || isVertical || isDiagonal) {
          return placement;
        }
      }
    }
    return null;
  };

  return (
    <div className="inline-block relative">
      {/* Frame overlay for solution highlighting - rendered BELOW letters */}
      {showSolution && placementCells.length > 0 && (
        <svg
          className="absolute pointer-events-none"
          style={{
            width: puzzle.grid[0].length * cellSize,
            height: puzzle.grid.length * cellSize,
            overflow: 'visible',
            zIndex: 1,
          }}
        >
          <defs>
            <filter id="shadow" x="-50%" y="-50%" width="200%" height="200%">
              <feDropShadow dx="0" dy="0" stdDeviation="1" floodOpacity="0.1" />
            </filter>
          </defs>
          {placementCells.map((placement, idx) => {
            const isHorizontal = placement.start.row === placement.end.row;
            const isVertical = placement.start.col === placement.end.col;
            const isDiagonal = Math.abs(placement.end.col - placement.start.col) === Math.abs(placement.end.row - placement.start.row);
            
            if (isDiagonal) {
              // Draw rotated rectangle frame for diagonal words
              const startCellX = placement.start.col * cellSize;
              const startCellY = placement.start.row * cellSize;
              const endCellX = placement.end.col * cellSize;
              const endCellY = placement.end.row * cellSize;

              const centerX = (startCellX + endCellX) / 2 + cellSize / 2;
              const centerY = (startCellY + endCellY) / 2 + cellSize / 2;

              const dx = endCellX - startCellX;
              const dy = endCellY - startCellY;
              const distance = Math.sqrt(dx * dx + dy * dy);
              const angle = Math.atan2(dy, dx) * (180 / Math.PI);

              const padding = Math.min(cellSize * 0.08, 3);
              const width = distance + cellSize * 0.16;
              const height = cellSize - padding * 2;
              const radius = Math.min(cellSize * 0.2, height / 2);

              return (
                <g key={idx} filter="url(#shadow)">
                  <rect
                    x={centerX - width / 2}
                    y={centerY - height / 2}
                    width={width}
                    height={height}
                    rx={radius}
                    ry={radius}
                    fill="none"
                    stroke={solutionStrokeColor}
                    strokeWidth={solutionStrokeThickness}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    transform={`rotate(${angle} ${centerX} ${centerY})`}
                  />
                </g>
              );
            } else {
              // Draw frames for horizontal/vertical words
              const startCol = Math.min(placement.start.col, placement.end.col);
              const endCol = Math.max(placement.start.col, placement.end.col);
              const startRow = Math.min(placement.start.row, placement.end.row);
              const endRow = Math.max(placement.start.row, placement.end.row);

              const padding = Math.min(cellSize * 0.12, 3);
              const x = startCol * cellSize + padding;
              const y = startRow * cellSize + padding;
              const width = (endCol - startCol + 1) * cellSize - padding * 2;
              const height = (endRow - startRow + 1) * cellSize - padding * 2;
              const radius = Math.min(cellSize * 0.25, Math.min(width, height) / 2);

              return (
                <rect
                  key={idx}
                  x={x}
                  y={y}
                  width={width}
                  height={height}
                  rx={radius}
                  ry={radius}
                  fill="none"
                  stroke={solutionStrokeColor}
                  strokeWidth={Math.max(solutionStrokeThickness, 1)}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  filter="url(#shadow)"
                />
              );
            }
          })}
        </svg>
      )}

      <div
        className="grid gap-0 relative"
        style={{
          gridTemplateColumns: `repeat(${puzzle.grid[0].length}, ${cellSize}px)`,
          border: gridLines ? `2px solid ${boxColor}` : 'none',
          zIndex: 2,
        }}
      >
        {puzzle.grid.map((row, rowIndex) =>
          row.map((letter, colIndex) => {
            const isHighlighted = showSolution && isInPlacement(rowIndex, colIndex) !== null;

            return (
              <div
                key={`${rowIndex}-${colIndex}`}
                className="flex items-center justify-center font-bold select-none"
                style={{
                  width: cellSize,
                  height: cellSize,
                  backgroundColor: '#ffffff',
                  color: showSolution && !isHighlighted ? '#9ca3af' : puzzleColor, // Gray out non-solution letters
                  borderRight: gridLines ? `1px solid ${boxColor}` : 'none',
                  borderBottom: gridLines ? `1px solid ${boxColor}` : 'none',
                  fontSize: cellSize * 0.5,
                  fontFamily: 'inherit',
                  position: 'relative',
                  zIndex: 2,
                }}
              >
                {letter}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
