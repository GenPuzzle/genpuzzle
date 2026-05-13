'use client';

import React, { useState } from 'react';
import { useApp } from '@/lib/app-context';
import { Button } from './ui/button';
import { X, FolderOpen, Trash2, Copy } from 'lucide-react';
import { PuzzleType } from '@/lib/puzzles/types';

interface SavedPuzzlesLibraryProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SavedPuzzlesLibrary({ isOpen, onClose }: SavedPuzzlesLibraryProps) {
  const { savedPuzzles, loadPuzzle, deletePuzzle } = useApp();

  if (!isOpen) return null;

  const getPuzzleIcon = (type: PuzzleType) => {
    const icons: Record<PuzzleType, string> = {
      'word-search': 'WS',
      'crossword': 'CW',
      'sudoku': 'SD',
      'cryptogram': 'CG',
      'word-scramble': 'SC',
      'maze': 'MZ',
      'word-match': 'WM',
      'dot-to-dot': 'DD',
    };
    return icons[type] || '?';
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[80vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <FolderOpen className="w-5 h-5 text-indigo-600" />
            <h2 className="text-lg font-semibold">My Puzzles</h2>
            <span className="px-2 py-0.5 bg-gray-100 rounded-full text-sm text-gray-600">
              {savedPuzzles.length}
            </span>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="w-5 h-5" />
          </Button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[60vh]">
          {savedPuzzles.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <FolderOpen className="w-12 h-12 mx-auto mb-4 text-gray-300" />
              <p>No saved puzzles yet</p>
              <p className="text-sm mt-1">Save a puzzle to see it here</p>
            </div>
          ) : (
            <div className="space-y-3">
              {savedPuzzles.map((puzzle) => (
                <div
                  key={puzzle.id}
                  className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-indigo-100 rounded-lg flex items-center justify-center">
                      <span className="text-sm font-bold text-indigo-700">
                        {getPuzzleIcon(puzzle.type)}
                      </span>
                    </div>
                    <div>
                      <h3 className="font-medium text-gray-900">{puzzle.name}</h3>
                      <p className="text-sm text-gray-500">
                        {puzzle.type.replace('-', ' ')} • {formatDate(puzzle.createdAt)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="ghost" size="sm" onClick={() => loadPuzzle(puzzle.id)}>
                      <Copy className="w-4 h-4 mr-1" />
                      Load
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => deletePuzzle(puzzle.id)}
                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
