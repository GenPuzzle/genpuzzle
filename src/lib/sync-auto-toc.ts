import type { WordSearchPuzzle } from './puzzles/types';
import type { PageNumberSettings } from './puzzles/types';
import type { DocumentPage, TextModuleSettings } from './document-model';
import { compileBook, groupPuzzlesByDocument } from './book-compiler';
import { formatTocLines } from './toc-settings';

/**
 * Sync auto-generated TOC content on all table-of-contents documents.
 * Returns a new document array only when content changed.
 */
export function syncAutoTocInDocuments(
  documents: DocumentPage[],
  puzzles: WordSearchPuzzle[],
  pageNumberSettings?: PageNumberSettings
): DocumentPage[] {
  const hasToc = documents.some((doc) => doc.moduleType === 'table-of-contents');
  if (!hasToc) return documents;

  const puzzleMap = groupPuzzlesByDocument(puzzles, documents);
  const compiled = compileBook(documents, puzzleMap, {
    includeSolutions: true,
    pageNumberSettings,
  });

  let changed = false;
  const next = documents.map((doc) => {
    if (doc.moduleType !== 'table-of-contents') return doc;
    const settings = doc.settings as TextModuleSettings;
    if (settings.tocMode === 'manual') return doc;

    const compiledPage = compiled.pages.find(
      (page) => page.kind === 'text' && page.sourceDocumentId === doc.id
    );
    const content =
      compiledPage && compiledPage.kind === 'text'
        ? compiledPage.settings.content
        : formatTocLines(compiled.tocEntries, settings.tocSettings);

    if (content === settings.content) return doc;
    changed = true;
    return {
      ...doc,
      settings: {
        ...settings,
        content,
        tocEntryOverrides: settings.tocEntryOverrides,
        tocPageNumberOverrides: settings.tocPageNumberOverrides,
      },
    };
  });

  return changed ? next : documents;
}
