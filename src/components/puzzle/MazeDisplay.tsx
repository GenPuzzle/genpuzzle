'use client';

import React from 'react';
import { MazePuzzle } from '@/lib/puzzles/types';

interface MazeDisplayProps {
  puzzle: MazePuzzle;
  showSolution?: boolean;
  cellSize?: number;
}

export function MazeDisplay({ puzzle, showSolution = false, cellSize = 16 }: MazeDisplayProps) {
  return (
    <div className="inline-block p-4 bg-white rounded-lg">
      <div
        className="grid gap-0"
        style={{
          gridTemplateColumns: `repeat(${puzzle.grid[0].length}, ${cellSize}px)`,
        }}
      >
        {puzzle.grid.map((row, rowIndex) =>
          row.map((isWall, colIndex) => (
            <div
              key={`${rowIndex}-${colIndex}`}
              style={{
                width: cellSize,
                height: cellSize,
                backgroundColor: isWall ? '#1f2937' : '#ffffff',
              }}
            />
          ))
        )}
      </div>

      {/* Legend */}
      <div className="mt-4 flex gap-4 text-sm">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-green-500 rounded" />
          <span>Start</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-red-500 rounded" />
          <span>End</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-gray-800" />
          <span>Wall</span>
        </div>
      </div>
    </div>
  );
}
