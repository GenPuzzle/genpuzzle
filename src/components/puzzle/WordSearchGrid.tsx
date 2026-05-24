'use client';

import React, { useMemo } from 'react';
import { WordSearchPuzzle } from '@/lib/puzzles/types';
import { getGridCellWrapperStyle, getGridLetterGlyphStyle } from '@/lib/grid-letter-centering';

interface WordSearchGridProps {
  puzzle: WordSearchPuzzle;
  showSolution?: boolean;
  cellSize?: number;
  noBoxAroundPuzzle?: boolean;
  borderStrokeThickness?: number;
  puzzleColor?: string;
  boxColor?: string;
  // Solution stroke settings
  solutionStrokeColor?: string;
  solutionStrokeThickness?: number;
  solutionStrokePadding?: number;
  // Frame style settings
  solutionFrameStyle?: 'rounded' | 'square' | 'circle';
  solutionFrameRadius?: number;
  solutionHighlightAlpha?: number; // 0-100
  onlyHighlightWordListWords?: boolean;
  wordList?: string[];
  puzzleGridFontSize?: number;
  puzzleGridFontFamily?: string;
  answerGridFontSize?: number;
  answerGridFontFamily?: string;
}

export function WordSearchGrid({
  puzzle,
  showSolution = false,
  cellSize = 28,
  noBoxAroundPuzzle = false,
  borderStrokeThickness = 2,
  puzzleColor = '#1f2937',
  boxColor = '#1f2937',
  solutionStrokeColor = '#000000',
  solutionStrokeThickness = 12,
  solutionStrokePadding = 0,
  solutionFrameStyle = 'rounded',
  solutionFrameRadius = 6,
  solutionHighlightAlpha = 30,
  onlyHighlightWordListWords = true,
  wordList = [],
  puzzleGridFontSize = 14,
  puzzleGridFontFamily = 'monospace',
  answerGridFontSize,
  answerGridFontFamily,

}: WordSearchGridProps) {
  // Fixed configuration (not user-editable)
  const solutionHighlightMode = 'box-frame'; // Always use box-frame
  const solutionLineCap = 'round'; // Always use rounded ends
  const getHighlightBand = (placement: { start: { row: number; col: number }; end: { row: number; col: number } }) => {
    const thickness = Math.max(1, solutionStrokeThickness || 1);
    const padding = solutionStrokePadding || 0;
    const startX = placement.start.col * cellSize + cellSize / 2;
    const startY = placement.start.row * cellSize + cellSize / 2;
    const endX = placement.end.col * cellSize + cellSize / 2;
    const endY = placement.end.row * cellSize + cellSize / 2;

    const isHorizontal = placement.start.row === placement.end.row;
    const isVertical = placement.start.col === placement.end.col;
    const isDiagonal = !isHorizontal && !isVertical;

    if (isDiagonal) {
      const centerX = (startX + endX) / 2;
      const centerY = (startY + endY) / 2;
      const dx = endX - startX;
      const dy = endY - startY;
      const distance = Math.sqrt(dx * dx + dy * dy);
      const angle = Math.atan2(dy, dx) * (180 / Math.PI);

      return {
        x: centerX - (distance + padding * 2) / 2,
        y: centerY - thickness / 2,
        width: distance + padding * 2,
        height: thickness,
        rotation: angle,
        centerX,
        centerY,
      };
    }

    if (isHorizontal) {
      const minCol = Math.min(placement.start.col, placement.end.col);
      const maxCol = Math.max(placement.start.col, placement.end.col);
      const width = (maxCol - minCol + 1) * cellSize + padding * 2;
      const x = minCol * cellSize - padding;
      const y = placement.start.row * cellSize + (cellSize - thickness) / 2;
      return { x, y, width, height: thickness };
    }

    const minRow = Math.min(placement.start.row, placement.end.row);
    const maxRow = Math.max(placement.start.row, placement.end.row);
    const height = (maxRow - minRow + 1) * cellSize + padding * 2;
    const x = placement.start.col * cellSize + (cellSize - thickness) / 2;
    const y = minRow * cellSize - padding;
    return { x, y, width: thickness, height };
  };

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
              left: 0,
              top: 0,
          }}
        >
          <defs>
            <filter id="shadow" x="-50%" y="-50%" width="200%" height="200%">
              <feDropShadow dx="0" dy="0" stdDeviation="1" floodOpacity="0.1" />
            </filter>
          </defs>
            {placementCells.map((placement, idx) => {

              const normalizedOpacity = Math.max(0, Math.min(100, solutionHighlightAlpha)) / 100;
              // Debug: log opacity so we can verify UI changes reach the renderer
              if (typeof window !== 'undefined' && (window as any).__WORDSEARCH_DEBUG_OPACITY__) {
                // eslint-disable-next-line no-console
                console.log('WordSearchGrid: solutionHighlightAlpha=', solutionHighlightAlpha, 'opacity=', normalizedOpacity);
              }

              const thickness = Math.max(1, solutionStrokeThickness);
              const padding = solutionStrokePadding || 0;
              const startCellX = placement.start.col * cellSize + cellSize / 2;
              const startCellY = placement.start.row * cellSize + cellSize / 2;
              const endCellX = placement.end.col * cellSize + cellSize / 2;
              const endCellY = placement.end.row * cellSize + cellSize / 2;
              const isHorizontal = placement.start.row === placement.end.row;
              const isVertical = placement.start.col === placement.end.col;
              const isDiagonal = !isHorizontal && !isVertical;

              // Use per-word color if available, otherwise use default color
              const wordColor = placement.word && puzzle.placements && puzzle.placements.find(p => p.word === placement.word)?.color || solutionStrokeColor;
              
              // Fixed: always use box-frame with rounded ends
              const bandFill = wordColor;
              const bandFillOpacity = normalizedOpacity;
              const radius = thickness / 2; // Always rounded ends

              if (isDiagonal) {
                const dx = endCellX - startCellX;
                const dy = endCellY - startCellY;
                const distance = Math.sqrt(dx * dx + dy * dy);
                const centerX = (startCellX + endCellX) / 2;
                const centerY = (startCellY + endCellY) / 2;
                const angle = Math.atan2(dy, dx) * (180 / Math.PI);
                const width = distance + padding * 2;
                const height = thickness;

                return (
                  <rect
                    key={idx}
                    x={centerX - width / 2}
                    y={centerY - height / 2}
                    width={width}
                    height={height}
                    rx={radius}
                    ry={radius}
                    fill={bandFill}
                    fillOpacity={bandFillOpacity}
                    strokeLinejoin="round"
                    transform={`rotate(${angle} ${centerX} ${centerY})`}
                    filter="url(#shadow)"
                  />
                );
              }

              if (isHorizontal) {
                const minCol = Math.min(placement.start.col, placement.end.col);
                const maxCol = Math.max(placement.start.col, placement.end.col);
                const width = (maxCol - minCol + 1) * cellSize + padding * 2;
                const x = minCol * cellSize - padding;
                const y = placement.start.row * cellSize + (cellSize - thickness) / 2;

                return (
                  <rect
                    key={idx}
                    x={x}
                    y={y}
                    width={width}
                    height={thickness}
                    rx={radius}
                    ry={radius}
                    fill={bandFill}
                    fillOpacity={bandFillOpacity}
                    strokeLinejoin="round"
                    filter="url(#shadow)"
                  />
                );
              }

              const minRow = Math.min(placement.start.row, placement.end.row);
              const maxRow = Math.max(placement.start.row, placement.end.row);
              const height = (maxRow - minRow + 1) * cellSize + padding * 2;
              const x = placement.start.col * cellSize + (cellSize - thickness) / 2;
              const y = minRow * cellSize - padding;

              return (
                <rect
                  key={idx}
                  x={x}
                  y={y}
                  width={thickness}
                  height={height}
                  rx={radius}
                  ry={radius}
                  fill={bandFill}
                  fillOpacity={bandFillOpacity}
                  strokeLinejoin="round"
                  filter="url(#shadow)"
                />
              );
            })}
        </svg>
      )}

      {/* Border wraps exact cell grid (cols × cellSize, rows × cellSize) */}
      <div
        className="relative inline-block"
        style={{
          border: noBoxAroundPuzzle ? 'none' : `${borderStrokeThickness}px solid ${boxColor}`,
          borderRadius: '4px',
          padding: 0,
          margin: 0,
          lineHeight: 0,
          backgroundColor: '#ffffff',
          boxSizing: 'content-box',
        }}
      >
        <div
          className="grid gap-0 relative"
          style={{
            gridTemplateColumns: `repeat(${puzzle.grid[0].length}, ${cellSize}px)`,
            gridTemplateRows: `repeat(${puzzle.grid.length}, ${cellSize}px)`,
            width: puzzle.grid[0].length * cellSize,
            height: puzzle.grid.length * cellSize,
            gap: 0,
            zIndex: 2,
          }}
        >
          {puzzle.grid.map((row, rowIndex) =>
            row.map((letter, colIndex) => {
              const isHighlighted = showSolution && isInPlacement(rowIndex, colIndex) !== null;
              // Calculate rounded radius proportional to cell size
              const borderRadius = Math.max(cellSize * 0.15, 3);
              const letterFontSize = showSolution
                ? answerGridFontSize || puzzleGridFontSize
                : puzzleGridFontSize;
              const letterFontFamily = showSolution
                ? answerGridFontFamily || puzzleGridFontFamily
                : puzzleGridFontFamily;

              return (
                <div
                  key={`${rowIndex}-${colIndex}`}
                  className="select-none"
                  style={getGridCellWrapperStyle({
                    cellSize,
                    fontSize: letterFontSize,
                    fontFamily: letterFontFamily,
                    color: puzzleColor,
                    fontWeight: 400,
                    borderRadius,
                  })}
                >
                  <span style={getGridLetterGlyphStyle(letterFontSize)}>{letter}</span>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
