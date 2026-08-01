/**
 * Insert a blank title page after a compiled book page.
 * When the anchor is a mid-document puzzle, the word-search document is split so the
 * separator sits between puzzle pages in the book order.
 */

import type { WordSearchPuzzle } from './puzzles/types';
import type { CompiledPage } from './book-compiler';
import {
  createDocumentPage,
  type DocumentPage,
  type PuzzleModuleSettings,
  type TextModuleSettings,
} from './document-model';

export function formatSeparatorPageName(bookPageIndex: number): string {
  return `Pg ${bookPageIndex + 1} - sep`;
}

export interface SeparatorInsertResult {
  documentPages: DocumentPage[];
  batchPuzzles: WordSearchPuzzle[];
  newTitlePageId: string;
}

function clonePuzzleModuleSettings(settings: PuzzleModuleSettings): PuzzleModuleSettings {
  return structuredClone(settings);
}

function createBlankTitlePage(name: string): DocumentPage {
  const page = createDocumentPage('title-page');
  page.name = name;
  const settings = page.settings as TextModuleSettings;
  settings.title = name;
  settings.blocks = [];
  settings.isSeparatorPage = true;
  settings.textColor = '#000000';
  return page;
}

export function isSeparatorTitlePage(
  page: Pick<DocumentPage, 'name' | 'moduleType' | 'settings'> | null | undefined
): boolean {
  if (!page || page.moduleType !== 'title-page') return false;
  const settings = page.settings as TextModuleSettings;
  if (settings.isSeparatorPage) return true;
  return /^Pg \d+ - sep$/i.test(page.name.trim());
}

export function isChapterTitlePage(
  page: Pick<DocumentPage, 'name' | 'moduleType' | 'settings'> | null | undefined
): boolean {
  if (!page || page.moduleType !== 'title-page') return false;
  const settings = page.settings as TextModuleSettings;
  return !!settings.isChapterPage;
}

/**
 * Build updated documents + puzzles after inserting a blank title page after `anchor`.
 * Insert is skipped for solution pages (returns null).
 */
export function buildSeparatorInsertAfterCompiledPage(
  documents: DocumentPage[],
  puzzles: WordSearchPuzzle[],
  anchor: CompiledPage
): SeparatorInsertResult | null {
  if (anchor.kind === 'solution') return null;

  const insertAtBookPage = anchor.bookPageIndex + 1;
  const name = formatSeparatorPageName(insertAtBookPage);
  const titlePage = createBlankTitlePage(name);

  const sourceIdx = documents.findIndex((doc) => doc.id === anchor.sourceDocumentId);
  if (sourceIdx === -1) {
    return {
      documentPages: [...documents, titlePage],
      batchPuzzles: puzzles,
      newTitlePageId: titlePage.id,
    };
  }

  const sourceDoc = documents[sourceIdx];

  // Between puzzles inside a word-search document: split remaining puzzles into a new doc.
  if (
    anchor.kind === 'puzzle' &&
    sourceDoc.moduleType === 'word-search' &&
    typeof anchor.puzzleIndexInDocument === 'number'
  ) {
    const docPuzzles = puzzles.filter((puzzle) => puzzle.pageId === sourceDoc.id);
    const splitAfter = anchor.puzzleIndexInDocument;
    const remaining = docPuzzles.slice(splitAfter + 1);

    if (remaining.length === 0) {
      const nextDocs = [...documents];
      nextDocs.splice(sourceIdx + 1, 0, titlePage);
      return {
        documentPages: nextDocs,
        batchPuzzles: puzzles,
        newTitlePageId: titlePage.id,
      };
    }

    const sourceSettings = sourceDoc.settings as PuzzleModuleSettings;
    const keptCount = docPuzzles.length - remaining.length;

    const updatedSource: DocumentPage = {
      ...sourceDoc,
      settings: {
        ...sourceSettings,
        wordSearchSettings: sourceSettings.wordSearchSettings
          ? {
              ...sourceSettings.wordSearchSettings,
              core: {
                ...sourceSettings.wordSearchSettings.core,
                numberOfPuzzles: Math.max(1, keptCount),
              },
            }
          : sourceSettings.wordSearchSettings,
      },
    };

    const tailDoc = createDocumentPage('word-search');
    tailDoc.name = sourceDoc.name;
    const cloned = clonePuzzleModuleSettings(sourceSettings);
    if (cloned.wordSearchSettings?.core) {
      cloned.wordSearchSettings = {
        ...cloned.wordSearchSettings,
        core: {
          ...cloned.wordSearchSettings.core,
          numberOfPuzzles: remaining.length,
        },
      };
    }
    tailDoc.settings = cloned;

    const remainingSet = new Set(remaining);
    let remIdx = 0;
    let keptIdx = 0;
    const normalized = puzzles.map((puzzle) => {
      if (remainingSet.has(puzzle)) {
        return {
          ...puzzle,
          pageId: tailDoc.id,
          pageName: tailDoc.name,
          puzzleIndexInDocument: remIdx++,
        };
      }
      if (puzzle.pageId === sourceDoc.id) {
        return { ...puzzle, puzzleIndexInDocument: keptIdx++ };
      }
      return puzzle;
    });

    const nextDocs = [...documents];
    nextDocs[sourceIdx] = updatedSource;
    nextDocs.splice(sourceIdx + 1, 0, titlePage, tailDoc);

    return {
      documentPages: nextDocs,
      batchPuzzles: normalized,
      newTitlePageId: titlePage.id,
    };
  }

  // After a text/blank page: insert title page after that document.
  const nextDocs = [...documents];
  nextDocs.splice(sourceIdx + 1, 0, titlePage);
  return {
    documentPages: nextDocs,
    batchPuzzles: puzzles,
    newTitlePageId: titlePage.id,
  };
}
