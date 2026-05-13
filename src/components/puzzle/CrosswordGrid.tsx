'use client';

import React from 'react';
import { CrosswordPuzzle } from '@/lib/puzzles/types';

interface CrosswordGridProps {
  puzzle: CrosswordPuzzle;
  showSolution?: boolean;
  cellSize?: number;
}

export function CrosswordGrid({ puzzle, showSolution = false, cellSize = 30 }: CrosswordGridProps) {
  return (
    <div className="space-y-4">
      <div className="inline-block p-4 bg-white rounded-lg">
        <div
          className="grid gap-0"
          style={{
            gridTemplateColumns: `repeat(${puzzle.grid[0].length}, ${cellSize}px)`,
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
                  backgroundColor: cell.isBlack ? '#1f2937' : '#ffffff',
                  border: cell.isBlack ? 'none' : '1px solid #d1d5db',
                }}
              >
                {cell.isBlack ? null : (
                  <>
                    {cell.clueNumber && (
                      <span
                        className="absolute top-0 left-1 text-xs"
                        style={{ fontSize: cellSize * 0.25 }}
                      >
                        {cell.clueNumber}
                      </span>
                    )}
                    {showSolution && cell.letter && (
                      <span className="font-bold" style={{ fontSize: cellSize * 0.5 }}>
                        {cell.letter}
                      </span>
                    )}
                  </>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      {/* Clues */}
      <div className="grid grid-cols-2 gap-4 max-w-2xl">
        <div>
          <h4 className="font-bold text-gray-700 mb-2">Across</h4>
          <ul className="space-y-1 text-sm">
            {puzzle.acrossClues.map((clue) => (
              <li key={clue.number}>
                <span className="font-bold">{clue.number}.</span>{' '}
                <span className="text-gray-600">
                  {showSolution ? (
                    <span className="font-medium text-green-600">{clue.answer}</span>
                  ) : (
                    clue.clue
                  )}
                </span>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h4 className="font-bold text-gray-700 mb-2">Down</h4>
          <ul className="space-y-1 text-sm">
            {puzzle.downClues.map((clue) => (
              <li key={clue.number}>
                <span className="font-bold">{clue.number}.</span>{' '}
                <span className="text-gray-600">
                  {showSolution ? (
                    <span className="font-medium text-green-600">{clue.answer}</span>
                  ) : (
                    clue.clue
                  )}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
