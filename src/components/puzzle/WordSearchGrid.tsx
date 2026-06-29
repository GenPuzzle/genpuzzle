'use client';

import React, { useEffect, useRef } from 'react';
import { WordSearchPuzzle } from '@/lib/puzzles/types';
import { getGridCellWrapperStyle, getGridLetterGlyphStyle, fitGridLetterSizeCss } from '@/lib/grid-letter-centering';
import { drawSolutionGridInterior } from '@/lib/solution-grid-interior-draw';

interface WordSearchGridProps {
  puzzle: WordSearchPuzzle;
  showSolution?: boolean;
  cellSize?: number;
  noBoxAroundPuzzle?: boolean;
  borderStrokeThickness?: number;
  puzzleColor?: string;
  boxColor?: string;
  solutionStrokeColor?: string;
  solutionStrokeThickness?: number;
  solutionStrokePadding?: number;
  solutionFrameStyle?: 'rounded' | 'square' | 'circle';
  solutionFrameRadius?: number;
  solutionHighlightAlpha?: number;
  puzzleGridFontSize?: number;
  puzzleGridFontFamily?: string;
  answerGridFontSize?: number;
  answerGridFontFamily?: string;
  gridBorderPadding?: number;
  borderRadius?: number;
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
  solutionHighlightAlpha = 30,
  puzzleGridFontSize = 14,
  puzzleGridFontFamily = 'monospace',
  answerGridFontSize,
  answerGridFontFamily,
  gridBorderPadding = 0,
  borderRadius = 4,
}: WordSearchGridProps) {
  const solutionCanvasRef = useRef<HTMLCanvasElement>(null);

  const cols = puzzle.grid[0]?.length ?? 0;
  const rows = puzzle.grid.length;
  const innerWidthPx = cols * cellSize;
  const innerHeightPx = rows * cellSize;

  const letterFontSize = showSolution
    ? answerGridFontSize !== undefined && answerGridFontSize !== null && answerGridFontSize !== 0
      ? answerGridFontSize
      : 18
    : puzzleGridFontSize;
  const letterFontFamily = showSolution
    ? answerGridFontFamily || puzzleGridFontFamily
    : puzzleGridFontFamily;

  useEffect(() => {
    if (!showSolution || !solutionCanvasRef.current || cols === 0 || rows === 0) return;

    const canvas = solutionCanvasRef.current;
    const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;

    canvas.width = Math.max(1, Math.ceil(innerWidthPx * dpr));
    canvas.height = Math.max(1, Math.ceil(innerHeightPx * dpr));
    canvas.style.width = `${innerWidthPx}px`;
    canvas.style.height = `${innerHeightPx}px`;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const draw = () => {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, innerWidthPx, innerHeightPx);
      drawSolutionGridInterior(ctx, puzzle, {
        cellPx: cellSize,
        fontPx: Math.max(4, letterFontSize),
        letterColor: puzzleColor,
        fontFamily: letterFontFamily,
        solutionFrameColor: solutionStrokeColor,
        solutionStrokeThicknessPx: Math.max(1, solutionStrokeThickness),
        solutionStrokePaddingPx: Math.max(0, solutionStrokePadding),
        solutionHighlightAlpha,
      });
    };

    if (typeof document !== 'undefined' && document.fonts?.ready) {
      void document.fonts.ready.then(draw).catch(draw);
    } else {
      draw();
    }
  }, [
    showSolution,
    puzzle,
    cellSize,
    cols,
    rows,
    innerWidthPx,
    innerHeightPx,
    letterFontSize,
    letterFontFamily,
    puzzleColor,
    solutionStrokeColor,
    solutionStrokeThickness,
    solutionStrokePadding,
    solutionHighlightAlpha,
  ]);

  return (
    <div className="block relative">
      <div
        className="relative inline-block"
        style={{
          border: noBoxAroundPuzzle ? 'none' : `${borderStrokeThickness}px solid ${boxColor}`,
          borderRadius: `${borderRadius}px`,
          padding: `${gridBorderPadding}px`,
          margin: 0,
          lineHeight: 0,
          backgroundColor: '#ffffff',
          boxSizing: 'content-box',
        }}
      >
        {showSolution ? (
          <canvas
            ref={solutionCanvasRef}
            className="block"
            style={{
              width: innerWidthPx,
              height: innerHeightPx,
              display: 'block',
            }}
            aria-hidden
          />
        ) : (
          <div
            className="grid gap-0 relative"
            style={{
              gridTemplateColumns: `repeat(${cols}, ${cellSize}px)`,
              gridTemplateRows: `repeat(${rows}, ${cellSize}px)`,
              width: innerWidthPx,
              height: innerHeightPx,
              gap: 0,
            }}
          >
            {puzzle.grid.map((row, rowIndex) =>
              row.map((letter, colIndex) => {
                const cellBorderRadius = Math.max(cellSize * 0.15, 3);
                const fittedFontSize = fitGridLetterSizeCss(
                  letter,
                  letterFontSize,
                  cellSize,
                  letterFontFamily,
                  400
                );

                return (
                  <div
                    key={`${rowIndex}-${colIndex}`}
                    className="select-none"
                    style={getGridCellWrapperStyle({
                      cellSize,
                      fontSize: fittedFontSize,
                      fontFamily: letterFontFamily,
                      color: puzzleColor,
                      fontWeight: 400,
                      borderRadius: cellBorderRadius,
                    })}
                  >
                    <span style={getGridLetterGlyphStyle(fittedFontSize)}>{letter}</span>
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>
    </div>
  );
}
