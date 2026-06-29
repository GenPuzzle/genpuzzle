'use client';

import React from 'react';
import { WordMatchPuzzle } from '@/lib/puzzles/types';

interface WordMatchDisplayProps {
  puzzle: WordMatchPuzzle;
  showSolution?: boolean;
}

export function WordMatchDisplay({ puzzle, showSolution = false }: WordMatchDisplayProps) {
  return (
    <div className="inline-block p-6 bg-white rounded-lg">
      <div className="flex gap-8">
        {/* Left Column */}
        <div className="space-y-2">
          {puzzle.leftColumn.map((word, index) => (
            <div
              key={`left-${index}`}
              className="flex items-center gap-3"
            >
              <span className="w-8 h-8 flex flex-shrink-0 items-center justify-center rounded-full text-sm font-bold" style={{background: `rgba(34, 118, 180, 0.1)`, color: `#404040`}}>
                {index + 1}
              </span>
              <span className="text-lg font-medium whitespace-nowrap">{word}</span>
            </div>
          ))}
        </div>

        {/* Right Column */}
        <div className="space-y-2">
          {puzzle.rightColumn.map((word, index) => (
            <div
              key={`right-${index}`}
              className="flex items-center gap-3"
            >
              {showSolution && (
                <span className="w-8 h-8 flex flex-shrink-0 items-center justify-center bg-green-100 rounded-full text-sm font-bold text-green-700">
                  {puzzle.leftColumn.indexOf(word) + 1}
                </span>
              )}
              <span className="text-lg font-medium text-gray-700 whitespace-nowrap">{word}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
