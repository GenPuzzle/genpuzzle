'use client';

import React, { useEffect, useRef } from 'react';
import { WordSearchPuzzle } from '@/lib/puzzles/types';
import {
  drawShapeMaskImageOnCanvas,
  isWordSearchShapeCell,
  type ShapeMaskFit,
} from '@/lib/puzzles/word-search-shape-mask';
import { wordSearchFontFamily } from '@/lib/puzzles/word-search-letters';
import { getGridCellWrapperStyle, getGridLetterGlyphStyle } from '@/lib/grid-letter-centering';
import { drawSolutionGridInterior } from '@/lib/solution-grid-interior-draw';

interface WordSearchGridProps {
  puzzle: WordSearchPuzzle;
  showSolution?: boolean;
  cellSize?: number;
  noBoxAroundPuzzle?: boolean;
  borderStrokeThickness?: number;
  puzzleColor?: string;
  letterStrokeColor?: string;
  letterStrokeThickness?: number;
  boxColor?: string;
  solutionStrokeColor?: string;
  solutionStrokeThickness?: number;
  solutionStrokePadding?: number;
  solutionHighlightStrokeColor?: string;
  solutionHighlightStrokeThickness?: number;
  solutionFrameStyle?: 'rounded' | 'square' | 'circle';
  solutionFrameRadius?: number;
  solutionHighlightAlpha?: number;
  puzzleGridFontSize?: number;
  puzzleGridFontFamily?: string;
  answerGridFontSize?: number;
  answerGridFontFamily?: string;
  gridBorderPadding?: number;
  borderRadius?: number;
  /** Uploaded silhouette image (data URL) shown under letters when enabled. */
  shapeImageSrc?: string;
  shapeImageShow?: boolean;
  /** 0–100 */
  shapeImageOpacity?: number;
  shapeImageFit?: ShapeMaskFit;
}

export function WordSearchGrid({
  puzzle,
  showSolution = false,
  cellSize = 28,
  noBoxAroundPuzzle = false,
  borderStrokeThickness = 2,
  puzzleColor = '#1f2937',
  letterStrokeColor = '#000000',
  letterStrokeThickness = 0,
  boxColor = '#1f2937',
  solutionStrokeColor = '#000000',
  solutionStrokeThickness = 12,
  solutionStrokePadding = 0,
  solutionHighlightStrokeColor = '#000000',
  solutionHighlightStrokeThickness = 0,
  solutionHighlightAlpha = 30,
  puzzleGridFontSize = 14,
  puzzleGridFontFamily = 'monospace',
  answerGridFontSize,
  answerGridFontFamily,
  gridBorderPadding = 0,
  borderRadius = 4,
  shapeImageSrc,
  shapeImageShow = false,
  shapeImageOpacity = 35,
  shapeImageFit = 'contain',
}: WordSearchGridProps) {
  const solutionCanvasRef = useRef<HTMLCanvasElement>(null);

  const cols = puzzle.grid[0]?.length ?? 0;
  const rows = puzzle.grid.length;
  const innerWidthPx = cols * cellSize;
  const innerHeightPx = rows * cellSize;
  const hasShapeMask = Boolean(puzzle.shapeMask);
  const hideOuterBox = noBoxAroundPuzzle || hasShapeMask;
  const strokePx = Math.max(0, letterStrokeThickness);
  const showShapeImage =
    Boolean(shapeImageShow) && Boolean(shapeImageSrc) && (shapeImageOpacity ?? 0) > 0;
  const shapeOpacity01 = Math.max(0, Math.min(100, shapeImageOpacity ?? 35)) / 100;

  const letterFontSize = showSolution
    ? answerGridFontSize !== undefined && answerGridFontSize !== null && answerGridFontSize !== 0
      ? answerGridFontSize
      : 18
    : puzzleGridFontSize;
  const letterFontFamily = showSolution
    ? answerGridFontFamily || puzzleGridFontFamily
    : puzzleGridFontFamily;
  const renderFontFamily = wordSearchFontFamily(letterFontFamily, puzzle);

  const shapeObjectFit =
    shapeImageFit === 'cover' ? 'cover' : shapeImageFit === 'stretch' ? 'fill' : 'contain';

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

    let cancelled = false;

    const draw = async () => {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, innerWidthPx, innerHeightPx);

      if (showShapeImage && shapeImageSrc) {
        try {
          await drawShapeMaskImageOnCanvas(ctx, shapeImageSrc, innerWidthPx, innerHeightPx, {
            fit: shapeImageFit,
            opacity: shapeOpacity01,
          });
        } catch {
          // Non-fatal — letters still draw
        }
      }
      if (cancelled) return;

      drawSolutionGridInterior(ctx, puzzle, {
        cellPx: cellSize,
        fontPx: Math.max(4, letterFontSize),
        letterColor: puzzleColor,
        fontFamily: renderFontFamily,
        solutionFrameColor: solutionStrokeColor,
        solutionStrokeThicknessPx: Math.max(1, solutionStrokeThickness),
        solutionStrokePaddingPx: Math.max(0, solutionStrokePadding),
        solutionHighlightAlpha,
        letterStrokeColor,
        letterStrokeThicknessPx: strokePx,
        solutionHighlightStrokeColor,
        solutionHighlightStrokeThicknessPx: Math.max(0, solutionHighlightStrokeThickness),
      });
    };

    const run = () => {
      void draw();
    };

    if (typeof document !== 'undefined' && document.fonts?.ready) {
      void document.fonts.ready.then(run).catch(run);
    } else {
      run();
    }

    return () => {
      cancelled = true;
    };
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
    renderFontFamily,
    puzzleColor,
    letterStrokeColor,
    strokePx,
    solutionStrokeColor,
    solutionStrokeThickness,
    solutionStrokePadding,
    solutionHighlightAlpha,
    solutionHighlightStrokeColor,
    solutionHighlightStrokeThickness,
    showShapeImage,
    shapeImageSrc,
    shapeImageFit,
    shapeOpacity01,
  ]);

  return (
    <div className="block relative">
      <div
        className="relative inline-block"
        style={{
          border: hideOuterBox ? 'none' : `${borderStrokeThickness}px solid ${boxColor}`,
          borderRadius: `${borderRadius}px`,
          padding: hideOuterBox ? 0 : `${gridBorderPadding}px`,
          margin: 0,
          lineHeight: 0,
          backgroundColor: hideOuterBox ? 'transparent' : '#ffffff',
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
            {showShapeImage && shapeImageSrc ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={shapeImageSrc}
                alt=""
                aria-hidden
                draggable={false}
                style={{
                  position: 'absolute',
                  inset: 0,
                  width: '100%',
                  height: '100%',
                  objectFit: shapeObjectFit,
                  objectPosition: 'center',
                  opacity: shapeOpacity01,
                  pointerEvents: 'none',
                  zIndex: 0,
                  userSelect: 'none',
                }}
              />
            ) : null}
          {puzzle.grid.map((row, rowIndex) =>
            row.map((letter, colIndex) => {
                const inside = isWordSearchShapeCell(puzzle.shapeMask, rowIndex, colIndex);
                if (!inside) {
                  return (
                    <div
                      key={`${rowIndex}-${colIndex}`}
                      aria-hidden
                      style={{ width: cellSize, height: cellSize, position: 'relative', zIndex: 1 }}
                    />
                  );
                }

                const cellBorderRadius = Math.max(cellSize * 0.15, 3);
                const fittedFontSize = letterFontSize;

              return (
                <div
                  key={`${rowIndex}-${colIndex}`}
                  className="select-none"
                    style={{
                      ...getGridCellWrapperStyle({
                    cellSize,
                        fontSize: fittedFontSize,
                    fontFamily: renderFontFamily,
                    color: puzzleColor,
                    fontWeight: 400,
                        borderRadius: cellBorderRadius,
                      }),
                      position: 'relative',
                      zIndex: 1,
                    }}
                  >
                    <span
                      style={getGridLetterGlyphStyle(fittedFontSize, {
                        strokeColor: letterStrokeColor,
                        strokeThicknessPx: strokePx,
                      })}
                    >
                      {letter}
                    </span>
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
