'use client';

import React from 'react';
import { SudokuPuzzle } from '@/lib/puzzles/types';

interface SudokuGridProps {
  puzzle: SudokuPuzzle;
  showSolution?: boolean;
  cellSize?: number;
}

export function SudokuGrid({ puzzle, showSolution = false, cellSize = 40 }: SudokuGridProps) {
  const displayGrid = showSolution ? puzzle.solution : puzzle.grid;

  return (
    <div className="inline-block p-4 bg-white rounded-lg">
      <div
        className="grid gap-0 border-2"
        style={{
          gridTemplateColumns: `repeat(9, ${cellSize}px)`,
          borderColor: '#1f2937',
        }}
      >
        {displayGrid.map((row, rowIndex) =>
          row.map((num, colIndex) => {
            const is3x3Border = (colIndex + 1) % 3 === 0 && colIndex < 8;
            const isRowBorder = (rowIndex + 1) % 3 === 0 && rowIndex < 8;
            const isGiven = puzzle.grid[rowIndex][colIndex] !== 0;

            return (
              <div
                key={`${rowIndex}-${colIndex}`}
                className="flex items-center justify-center font-bold select-none"
                style={{
                  width: cellSize,
                  height: cellSize,
                  backgroundColor: isGiven ? '#f3f4f6' : '#ffffff',
                  color: showSolution ? '#22c55e' : isGiven ? '#1f2937' : '#6b7280',
                  borderRight: is3x3Border ? '2px solid #1f2937' : '1px solid #d1d5db',
                  borderBottom: isRowBorder ? '2px solid #1f2937' : '1px solid #d1d5db',
                  fontSize: cellSize * 0.5,
                }}
              >
                {num || ''}
              </div>
            );
          })
        )}
      </div>

      <div className="mt-2 text-center text-sm text-gray-600">
        Difficulty: <span className="font-medium capitalize">{puzzle.difficulty}</span>
      </div>
    </div>
  );
}
