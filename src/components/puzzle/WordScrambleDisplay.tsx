'use client';

import React from 'react';
import { WordScramblePuzzle } from '@/lib/puzzles/types';

interface WordScrambleDisplayProps {
  puzzle: WordScramblePuzzle;
  showSolution?: boolean;
}

export function WordScrambleDisplay({ puzzle, showSolution = false }: WordScrambleDisplayProps) {
  return (
    <div className="inline-block p-6 bg-white rounded-lg">
      <table className="border-collapse">
        <thead>
          <tr className="border-b-2 border-gray-300">
            <th className="pr-8 pb-2 text-left text-sm font-bold text-gray-600">#</th>
            <th className="pr-8 pb-2 text-left text-sm font-bold text-gray-600">Scrambled</th>
            <th className="pb-2 text-left text-sm font-bold text-gray-600">Answer</th>
          </tr>
        </thead>
        <tbody>
          {puzzle.words.map((word, index) => (
            <tr key={index} className="border-b border-gray-200">
              <td className="pr-8 py-3 text-gray-600">{index + 1}.</td>
              <td className="pr-8 py-3 font-mono text-lg tracking-wider">
                {word.scrambled}
              </td>
              <td className="py-3 font-medium">
                {showSolution ? (
                  <span className="text-green-600">{word.original}</span>
                ) : (
                  <span className="text-gray-300">_________</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
