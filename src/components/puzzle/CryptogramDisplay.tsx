'use client';

import React from 'react';
import { CryptogramPuzzle } from '@/lib/puzzles/types';

interface CryptogramDisplayProps {
  puzzle: CryptogramPuzzle;
  showSolution?: boolean;
}

export function CryptogramDisplay({ puzzle, showSolution = false }: CryptogramDisplayProps) {
  const lines = puzzle.encodedText.split(' ');

  return (
    <div className="inline-block p-6 bg-white rounded-lg max-w-2xl">
      {/* Letter Key Box */}
      <div className="mb-6 p-4 bg-gray-50 rounded border border-gray-200">
        <h4 className="text-sm font-bold text-gray-600 mb-2">LETTER KEY</h4>
        <div className="grid grid-cols-9 gap-1">
          {Object.entries(puzzle.letterMapping)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([encoded, original]) => (
              <div key={encoded} className="flex flex-col items-center">
                <span className="text-lg font-bold" style={{ color: '#6366f1' }}>
                  {showSolution ? original : encoded}
                </span>
                <span className="text-gray-400">↓</span>
                <span className="text-lg font-bold text-gray-700">
                  {showSolution ? encoded : original}
                </span>
              </div>
            ))}
        </div>
      </div>

      {/* Encoded Text */}
      <div className="space-y-3">
        <p className="text-lg leading-relaxed tracking-wider font-mono">
          {lines.map((word, i) => (
            <span key={i} className="mr-3">
              {word.split('').map((char, j) => {
                const isLetter = /[A-Z]/.test(char);
                return (
                  <span
                    key={j}
                    className={`inline-block min-w-[0.75em] text-center`}
                    style={{
                      color: showSolution ? '#22c55e' : '#1f2937',
                      borderColor: showSolution ? '#16a34a' : `rgba(34, 118, 180, 0.3)`,
                      borderBottom: isLetter ? '2px solid' : 'none',
                    }}
                  >
                    {isLetter ? (showSolution ? puzzle.originalText.split(' ')[i]?.[j] || '' : char) : char}
                  </span>
                );
              })}
            </span>
          ))}
        </p>
      </div>

      {showSolution && (
        <div className="mt-4 p-3 bg-green-50 rounded border border-green-200">
          <p className="text-sm text-green-700">
            <span className="font-bold">Original:</span> {puzzle.originalText}
          </p>
        </div>
      )}
    </div>
  );
}
