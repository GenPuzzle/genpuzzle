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
      crosswordBatchPuzzles: app.crosswordBatchPuzzles,
      crosswordSettings: app.crosswordSettings,
      pageCrosswordOverrides: app.pageCrosswordOverrides,
      genericBatchPuzzles: app.genericBatchPuzzles,
      genericPuzzleSettings: app.genericPuzzleSettings,
      pageGenericOverrides: app.pageGenericOverrides,
      murdokuBatchPuzzles: app.murdokuBatchPuzzles,
      murdokuSettings: app.murdokuSettings,
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
      app.crosswordBatchPuzzles,
      app.crosswordSettings,
      app.pageCrosswordOverrides,
      app.genericBatchPuzzles,
      app.genericPuzzleSettings,
      app.pageGenericOverrides,
      app.murdokuBatchPuzzles,
      app.murdokuSettings,
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
