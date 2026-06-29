'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useApp } from '@/lib/app-context';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  clampPuzzleWordLineInput,
  countPuzzleWordLines,
  formatPuzzleWordLines,
  getPuzzleIndexInDocument,
  getWordsForPuzzlePage,
  parsePuzzleWordLines,
  replacePuzzleWordsInTitleList,
} from '@/lib/puzzle-word-list';
import type { TitleWordsSettings, WordSearchSettings } from '@/lib/puzzles/types';

interface CanvasPageWordListEditorProps {
  pageIndex: number;
  draftTitleWords: TitleWordsSettings;
  onDraftTitleWordsChange: (titleWords: TitleWordsSettings) => void;
  draftWordListSettings: WordSearchSettings['wordList'];
  onDraftWordListSettingsChange: (wordList: WordSearchSettings['wordList']) => void;
}

export function CanvasPageWordListEditor({
  pageIndex,
  draftTitleWords,
  onDraftTitleWordsChange,
  draftWordListSettings,
  onDraftWordListSettingsChange,
}: CanvasPageWordListEditorProps) {
  const { batchPuzzles, puzzleGenerationVersion } = useApp();

  const puzzle = batchPuzzles[pageIndex];
  const wordsPerPuzzle = Math.max(1, draftWordListSettings.wordsPerPuzzle);
  const [draft, setDraft] = useState('');
  const lastSyncKeyRef = useRef('');

  useEffect(() => {
    if (!puzzle) return;
    const syncKey = `${pageIndex}:${puzzleGenerationVersion}`;
    if (lastSyncKeyRef.current === syncKey) return;
    lastSyncKeyRef.current = syncKey;

    const puzzleWords = getWordsForPuzzlePage(puzzle, draftTitleWords, wordsPerPuzzle, 'titleWords');
    setDraft(formatPuzzleWordLines(puzzleWords, wordsPerPuzzle));
  }, [pageIndex, puzzleGenerationVersion, puzzle, draftTitleWords, wordsPerPuzzle]);

  if (!puzzle) return null;

  const handleWordsChange = (value: string) => {
    const clamped = clampPuzzleWordLineInput(value, wordsPerPuzzle);
    setDraft(clamped);

    const docIndex = getPuzzleIndexInDocument(puzzle);
    const slotWords = parsePuzzleWordLines(clamped, wordsPerPuzzle);
    const nextTitleWords = replacePuzzleWordsInTitleList(
      draftTitleWords,
      docIndex,
      wordsPerPuzzle,
      slotWords
    );
    onDraftTitleWordsChange(nextTitleWords);
    onDraftWordListSettingsChange({
      ...draftWordListSettings,
      selectWordListOption: 'manual',
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && countPuzzleWordLines(draft) >= wordsPerPuzzle) {
      e.preventDefault();
      return;
    }
    if (e.key === 'Enter' || e.key === ' ') {
      e.stopPropagation();
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const pasted = e.clipboardData.getData('text');
    const textarea = e.currentTarget;
    const { selectionStart, selectionEnd } = textarea;
    const nextValue =
      draft.slice(0, selectionStart) + pasted + draft.slice(selectionEnd);
    const lineCount = nextValue.split('\n').length;
    if (lineCount > wordsPerPuzzle) {
      e.preventDefault();
      handleWordsChange(clampPuzzleWordLineInput(nextValue, wordsPerPuzzle));
    }
  };

  return (
    <div className="canvas-context-panel__card canvas-context-panel__word-list-editor space-y-2">
      <Label className="canvas-context-panel__section-label">Words on this page</Label>
      <Textarea
        value={draft}
        onChange={(e) => handleWordsChange(e.target.value)}
        onKeyDown={handleKeyDown}
        onPaste={handlePaste}
        placeholder="One word per line..."
        className="min-h-[88px] text-xs"
      />
      <p className="text-[10px] text-slate-500 leading-snug">
        Enter up to {wordsPerPuzzle} word{wordsPerPuzzle === 1 ? '' : 's'} (one per line), matching
        Words per puzzle in settings. Click Update this page only to rebuild the grid.
      </p>
    </div>
  );
}
