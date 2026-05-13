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
              className="flex items-center gap-3 min-w-[120px]"
            >
              <span className="w-8 h-8 flex items-center justify-center bg-indigo-100 rounded-full text-sm font-bold text-indigo-700">
                {index + 1}
              </span>
              <span className="text-lg font-medium">{word}</span>
            </div>
          ))}
        </div>

        {/* Right Column */}
        <div className="space-y-2">
          {puzzle.rightColumn.map((word, index) => (
            <div
              key={`right-${index}`}
              className="flex items-center gap-3 min-w-[120px]"
            >
              {showSolution && (
                <span className="w-8 h-8 flex items-center justify-center bg-green-100 rounded-full text-sm font-bold text-green-700">
                  {puzzle.leftColumn.indexOf(word) + 1}
                </span>
              )}
              <span className="text-lg font-medium text-gray-700">{word}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
