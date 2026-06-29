'use client';

import { useMemo } from 'react';
import { useApp } from '@/lib/app-context';
import type { BookExportInput } from '@/lib/book-export-actions';

export function useBookExportInput(): BookExportInput {
  const app = useApp();

  return useMemo(
    () => ({
      currentPuzzleType: app.currentPuzzleType,
      bookSettings: app.bookSettings,
      titleWords: app.titleWords,
      wordSearchSettings: app.wordSearchSettings,
      batchPuzzles: app.batchPuzzles,
      currentPuzzle: app.currentPuzzle,
      puzzleGridScale: app.puzzleGridScale,
      titleToAnswerGap: app.titleToAnswerGap,
      pageMargin: app.pageMargin,
      solutionToSolutionGap: app.solutionToSolutionGap,
      pageOverrides: app.pageOverrides,
      applyMode: app.applyMode,
      documentPages: app.documentPages,
      activeDocumentPageId: app.activeDocumentPageId,
    }),
    [
      app.currentPuzzleType,
      app.bookSettings,
      app.titleWords,
      app.wordSearchSettings,
      app.batchPuzzles,
      app.currentPuzzle,
      app.puzzleGridScale,
      app.titleToAnswerGap,
      app.pageMargin,
      app.solutionToSolutionGap,
      app.pageOverrides,
      app.applyMode,
      app.documentPages,
      app.activeDocumentPageId,
    ]
  );
}
