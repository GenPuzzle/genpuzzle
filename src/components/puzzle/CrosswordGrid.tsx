'use client';

import React from 'react';
import { CrosswordPuzzle } from '@/lib/puzzles/types';
import type { CrosswordSettings } from '@/lib/crossword-settings';
import { getDefaultCrosswordSettings } from '@/lib/crossword-settings';

interface CrosswordGridProps {
  puzzle: CrosswordPuzzle;
  showSolution?: boolean;
  cellSize?: number;
  crosswordSettings?: CrosswordSettings | null;
}

function emptySquareFill(squareColorRange: number): string {
  const v = Math.max(0, Math.min(255, Math.round(squareColorRange)));
  const hex = v.toString(16).padStart(2, '0');
  return `#${hex}${hex}${hex}`;
}

export function CrosswordGrid({
  puzzle,
  showSolution = false,
  cellSize = 30,
  crosswordSettings,
}: CrosswordGridProps) {
  const settings = crosswordSettings ?? getDefaultCrosswordSettings();
  const { colors, typography, core } = settings;
  const emptyFill = emptySquareFill(colors.squareColorRange);
  const clueColumns = typography.clueLayout === 'single' ? 1 : 2;

  const formatAnswer = (answer: string) => {
    if (core.answerCase === 'lower') return answer.toLowerCase();
    if (core.answerCase === 'original') return answer;
    return answer.toUpperCase();
  };

  const numberFontSize = showSolution
    ? typography.numberFontSizeAnswers
    : typography.numberFontSizePuzzle;

  return (
    <div className="space-y-4">
      <div className="inline-block p-4 rounded-lg" style={{ backgroundColor: colors.backgroundColor }}>
        <div
          className="grid gap-0"
          style={{
            gridTemplateColumns: `repeat(${puzzle.grid[0]?.length ?? 0}, ${cellSize}px)`,
          }}
        >
          {puzzle.grid.map((row, rowIndex) =>
            row.map((cell, colIndex) => (
              <div
                key={`${rowIndex}-${colIndex}`}
                className="flex items-center justify-center relative"
                style={{
                  width: cellSize,
                  height: cellSize,
                  backgroundColor: cell.isBlack ? colors.blackSquareColor : emptyFill,
                  border: cell.isBlack ? 'none' : `1px solid ${colors.lineColor}`,
                  boxSizing: 'border-box',
                }}
              >
                {cell.isBlack ? null : (
                  <>
                    {cell.clueNumber != null && (
                      <span
                        className="absolute top-0 left-0.5 leading-none"
                        style={{
                          fontSize: Math.max(6, Math.min(numberFontSize, cellSize * 0.35)),
                          fontFamily: typography.numberFontFamily,
                          color: colors.numbersColor,
                        }}
                      >
                        {cell.clueNumber}
                      </span>
                    )}
                    {showSolution && cell.letter && (
                      <span
                        className="font-bold"
                        style={{
                          fontSize: cellSize * 0.5,
                          color: colors.answersColor,
                          fontFamily: typography.numberFontFamily,
                        }}
                      >
                        {formatAnswer(cell.letter)}
                      </span>
                    )}
                  </>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      <div
        className="grid gap-4 max-w-2xl"
        style={{ gridTemplateColumns: `repeat(${clueColumns}, minmax(0, 1fr))` }}
      >
        <div>
          <h4
            className="font-bold mb-2"
            style={{
              fontFamily: typography.clueFontFamily,
              fontSize: typography.clueFontSize + 2,
              color: colors.cluesColor,
            }}
          >
            Across
          </h4>
          <ul className="space-y-1">
            {puzzle.acrossClues.map((clue) => (
              <li
                key={`across-${clue.number}`}
                style={{
                  fontFamily: typography.clueFontFamily,
                  fontSize: typography.clueFontSize,
                  color: colors.cluesColor,
                }}
              >
                <span className="font-bold" style={{ color: colors.numbersColor }}>
                  {clue.number}.
                </span>{' '}
                {showSolution ? (
                  <span className="font-medium" style={{ color: colors.answersColor }}>
                    {formatAnswer(clue.answer)}
                  </span>
                ) : (
                  clue.clue
                )}
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h4
            className="font-bold mb-2"
            style={{
              fontFamily: typography.clueFontFamily,
              fontSize: typography.clueFontSize + 2,
              color: colors.cluesColor,
            }}
          >
            Down
          </h4>
          <ul className="space-y-1">
            {puzzle.downClues.map((clue) => (
              <li
                key={`down-${clue.number}`}
                style={{
                  fontFamily: typography.clueFontFamily,
                  fontSize: typography.clueFontSize,
                  color: colors.cluesColor,
                }}
              >
                <span className="font-bold" style={{ color: colors.numbersColor }}>
                  {clue.number}.
                </span>{' '}
                {showSolution ? (
                  <span className="font-medium" style={{ color: colors.answersColor }}>
                    {formatAnswer(clue.answer)}
                  </span>
                ) : (
                  clue.clue
                )}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
