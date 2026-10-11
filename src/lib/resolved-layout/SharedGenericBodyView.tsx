'use client';

import React from 'react';
import type { CrosswordSettings } from '../crossword-settings';
import { computeGenericPageLayout } from '../generic-puzzle-page-layout';
import type { GenericPuzzleSettings } from '../generic-puzzle-settings';
import type { TitleWordsSettings, WordSearchSettings } from '../puzzles/types';
import {
  buildCrosswordElements,
  buildCryptogramElements,
  buildScrambleElements,
  buildTriviaElements,
} from './book-elements';
import { ResolvedElementsView } from './ResolvedElementsView';
import { getResolvedPage, settingsRevision, stableRevision } from './snapshot';
import { shiftElements } from './shift';
import type { ResolvedElement } from './types';

type BodyType = 'crossword' | 'cryptogram' | 'word-scramble' | 'trivia';

/** Crossword, scramble, trivia, and cryptogram bodies. Same elements as PDF and PPTX. */
export function SharedGenericBodyView({
  puzzleType,
  puzzle,
  puzzles,
  settings,
  titleWords,
  showSolution,
  gp,
  cw,
  puzzleIndex,
  hideClues,
}: {
  puzzleType: BodyType;
  puzzle: any;
  puzzles: any[];
  settings: WordSearchSettings;
  titleWords: TitleWordsSettings;
  showSolution: boolean;
  gp: GenericPuzzleSettings | null;
  cw: CrosswordSettings | null;
  puzzleIndex: number;
  hideClues?: boolean;
}) {
  const page = React.useMemo(() => {
    const layout = computeGenericPageLayout({
      puzzleType,
      showSolution,
      layoutSettings: settings,
      titleWords,
      puzzleIndex,
      puzzles,
      cw,
      gp,
    });
    const slotIndex = Math.max(
      0,
      layout.slots.findIndex((slot) => slot.puzzleIndex === (puzzle?.puzzleIndexInDocument ?? puzzleIndex))
    );
    const slot = layout.slots[slotIndex]?.content ?? layout.slots[0]?.content;
    if (!slot) return null;
    // Settings must be part of the key: fonts, colours, cipher format, answer
    // key rows, clue layout… all change the elements without touching the slot.
    const revision = stableRevision({
      puzzleType,
      showSolution,
      slot,
      hideClues: Boolean(hideClues || showSolution),
      cell: layout.genericCellPt,
      crosswordCell: layout.crosswordCellPt,
      gap: layout.puzzleToCluesGapPt,
      zone: layout.pageNumberZoneTopPt,
      scramble: layout.scrambleFit,
      gp: puzzleType === 'crossword' ? undefined : settingsRevision(gp),
      cw: puzzleType === 'crossword' ? settingsRevision(cw) : undefined,
      grid: puzzle?.grid,
      words: puzzle?.words,
      questions: puzzle?.questions,
      allQuestions:
        puzzleType === 'trivia' && showSolution ? puzzles.map((p) => p?.questions) : undefined,
      encoded: puzzle?.encodedText,
      original: puzzle?.originalText,
      mapping: puzzle?.letterMapping,
      hints: puzzle?.hintLetters,
      cipher: puzzle?.cipherType,
      index: puzzle?.puzzleIndexInDocument ?? puzzleIndex,
    });
    return getResolvedPage(revision, () => {
      let absolute: ResolvedElement[] = [];
      if (puzzleType === 'crossword' && cw) {
        absolute = buildCrosswordElements({
          puzzle,
          slot,
          cw,
          showSolution,
          preferredCellPt: layout.crosswordCellPt,
          clueGapPt: layout.puzzleToCluesGapPt,
          hideClues: Boolean(hideClues || showSolution),
          pageNumberZoneTopPt: layout.pageNumberZoneTopPt,
        });
      } else if (puzzleType === 'word-scramble' && gp) {
        absolute = buildScrambleElements({
          puzzle,
          slot,
          gp,
          showSolution,
          fontSizePt: layout.scrambleFit?.fontSizePt ?? gp.typography.puzzleFontSize ?? 14,
          wordGapPt: layout.scrambleFit?.wordGapPt ?? gp.typography.scrambleSpaceBetweenWords ?? 8,
          letterEm: layout.scrambleFit?.letterEm ?? gp.typography.scrambleSpaceBetweenLetters ?? 0.12,
        });
      } else if (puzzleType === 'trivia' && gp) {
        const list = showSolution && puzzles.length > 0 ? puzzles : [puzzle];
        absolute = buildTriviaElements({ puzzles: list, slot, gp, showSolution });
      } else if (puzzleType === 'cryptogram' && gp) {
        absolute = buildCryptogramElements({ puzzle, slot, gp, showSolution });
      }
      return {
        id: revision,
        kind: puzzleType,
        widthPt: slot.widthPt,
        heightPt: slot.heightPt,
        revision,
        elements: shiftElements(absolute, slot.leftPt, slot.topPt),
      };
    });
  }, [cw, gp, hideClues, puzzle, puzzleIndex, puzzleType, puzzles, settings, showSolution, titleWords]);

  if (!page) return null;
  return <ResolvedElementsView elements={page.elements} widthPt={page.widthPt} heightPt={page.heightPt} />;
}
