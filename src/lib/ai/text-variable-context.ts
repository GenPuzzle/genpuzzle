/**
 * Build TextVariableResolveContext from existing GenPuzzle typography / settings.
 * Keeps Canvas / PDF / PPTX variable resolution aligned with funFactsText & titles.
 */

import type { DocumentPage, PuzzleModuleSettings } from '@/lib/document-model';
import { isPuzzleModuleSettings } from '@/lib/document-model';
import type { TextVariableResolveContext } from './text-variable-tokens';

function splitLines(text: string | undefined | null): string[] {
  if (!text) return [];
  return text.split(/\r?\n/).map((line) => line.normalize('NFC'));
}

export function textVariableContextFromPuzzleSettings(
  settings: PuzzleModuleSettings | null | undefined,
  extras?: Partial<TextVariableResolveContext>
): TextVariableResolveContext {
  if (!settings) return { ...extras };

  const ws = settings.wordSearchSettings;
  const cw = settings.crosswordSettings;
  const gp = settings.genericPuzzleSettings;

  const funFactsByIndex = splitLines(
    ws?.typography.funFactsText ||
      cw?.typography.funFactsText ||
      gp?.typography.funFactsText
  ).filter((line) => line.trim().length > 0);

  const titlesByIndex = splitLines(
    (ws?.typography.selectTitleOption === 'custom' ? ws.typography.titleText : '') ||
      cw?.typography.differentTitles ||
      (gp?.typography.selectTitleOption === 'custom_per_puzzle'
        ? gp.typography.differentTitles
        : gp?.typography.titleText) ||
      ''
  ).filter((line) => line.trim().length > 0);

  const contentIndex = Math.max(0, Math.round(extras?.contentIndex ?? 0));

  return {
    funFactsByIndex,
    titlesByIndex,
    funFact: funFactsByIndex[contentIndex],
    puzzleTitle: titlesByIndex[contentIndex] || extras?.puzzleTitle,
    puzzleType: extras?.puzzleType,
    theme: extras?.theme,
    ...extras,
    contentIndex,
  };
}

export function textVariableContextFromDocument(
  page: DocumentPage | null | undefined,
  extras?: Partial<TextVariableResolveContext>
): TextVariableResolveContext {
  if (!page || !isPuzzleModuleSettings(page.settings)) {
    return { ...extras };
  }
  return textVariableContextFromPuzzleSettings(page.settings, {
    puzzleType: page.moduleType,
    ...extras,
  });
}
