'use client';

import React from 'react';
import { PuzzleType } from '@/lib/puzzles/types';
import { useApp } from '@/lib/app-context';
import { Search, Grid3X3, Hash, Lock, Shuffle, Box, List, CircleDot } from 'lucide-react';

const PUZZLE_TYPES: { type: PuzzleType; name: string; description: string; icon: React.ReactNode }[] = [
  {
    type: 'word-search',
    name: 'Word Search',
    description: 'Find hidden words in a grid',
    icon: <Search className="w-6 h-6" />,
  },
  {
    type: 'crossword',
    name: 'Crossword',
    description: 'Fill in the interlocking grid',
    icon: <Grid3X3 className="w-6 h-6" />,
  },
  {
    type: 'sudoku',
    name: 'Sudoku',
    description: 'Classic number puzzle',
    icon: <Hash className="w-6 h-6" />,
  },
  {
    type: 'cryptogram',
    name: 'Cryptogram',
    description: 'Decode the substitution cipher',
    icon: <Lock className="w-6 h-6" />,
  },
  {
    type: 'word-scramble',
    name: 'Word Scramble',
    description: 'Unscramble the letters',
    icon: <Shuffle className="w-6 h-6" />,
  },
  {
    type: 'maze',
    name: 'Maze',
    description: 'Find your way through',
    icon: <Box className="w-6 h-6" />,
  },
  {
    type: 'word-match',
    name: 'Word Match',
    description: 'Match words in two columns',
    icon: <List className="w-6 h-6" />,
  },
  {
    type: 'dot-to-dot',
    name: 'Dot-to-Dot',
    description: 'Connect the numbered dots',
    icon: <CircleDot className="w-6 h-6" />,
  },
];

export function PuzzleDashboard() {
  const { currentPuzzleType, setCurrentPuzzleType } = useApp();

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
      {PUZZLE_TYPES.map((puzzle) => (
        <button
          key={puzzle.type}
          onClick={() => setCurrentPuzzleType(puzzle.type)}
          className={`p-4 rounded-xl border-2 transition-all text-left ${
            currentPuzzleType === puzzle.type
              ? 'border-indigo-500 bg-indigo-50'
              : 'border-gray-200 bg-white hover:border-indigo-300 hover:shadow-md'
          }`}
        >
          <div
            className={`mb-2 ${
              currentPuzzleType === puzzle.type ? 'text-indigo-600' : 'text-gray-600'
            }`}
          >
            {puzzle.icon}
          </div>
          <h3 className="font-semibold text-gray-900">{puzzle.name}</h3>
          <p className="text-xs text-gray-500 mt-1">{puzzle.description}</p>
        </button>
      ))}
    </div>
  );
}
