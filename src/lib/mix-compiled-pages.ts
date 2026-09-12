/**
 * Reorder compiled puzzle pages so each chapter interleaves types:
 * word search #1, crossword #1, scramble #1, … then #2 of each type.
 * Front matter and solution pages keep their relative positions
 * (front first, solutions last). Murdoku two-page units stay together.
 */

import type { CompiledPage, CompiledTextPage } from './book-compiler';

function isSolutionKind(kind: CompiledPage['kind']): boolean {
  return (
    kind === 'solution' ||
    kind === 'crossword-solution' ||
    kind === 'generic-puzzle-solution' ||
    kind === 'murdoku-solution'
  );
}

function isPuzzleContentPage(page: CompiledPage): boolean {
  return (
    page.kind === 'puzzle' ||
    page.kind === 'crossword' ||
    page.kind === 'generic-puzzle' ||
    page.kind === 'murdoku'
  );
}

function isChapterCompiledPage(page: CompiledPage): page is CompiledTextPage {
  return page.kind === 'text' && Boolean(page.settings.isChapterPage);
}

function chapterTitle(page: CompiledTextPage): string {
  const blockTitle = page.settings.blocks?.find((b) => b.kind === 'title')?.text?.trim();
  return blockTitle || page.settings.title?.trim() || page.sourceDocumentName?.trim() || '';
}

function chapterIndexFromPage(page: CompiledPage): number | undefined {
  if (page.kind === 'puzzle') return page.puzzle.chapterIndex;
  if (page.kind === 'crossword') return page.puzzle.chapterIndex;
  if (page.kind === 'generic-puzzle') return page.puzzles[0]?.chapterIndex;
  if (page.kind === 'murdoku') return page.puzzle.chapterIndex;
  return undefined;
}

function puzzleLocalIndex(page: CompiledPage): number {
  if (
    page.kind === 'puzzle' ||
    page.kind === 'crossword' ||
    page.kind === 'murdoku' ||
    page.kind === 'generic-puzzle'
  ) {
    return page.puzzleIndexInDocument ?? 0;
  }
  return 0;
}

interface MixUnit {
  pages: CompiledPage[];
  docId: string;
  localIndex: number;
  chapterIndex?: number;
}

function groupPuzzleUnits(pages: CompiledPage[]): MixUnit[] {
  const units: MixUnit[] = [];
  let i = 0;
  while (i < pages.length) {
    const page = pages[i];
    if (!page) {
      i += 1;
      continue;
    }
    if (!isPuzzleContentPage(page)) {
      if (page.kind === 'blank' && units.length > 0) {
        units[units.length - 1]!.pages.push(page);
      }
      i += 1;
      continue;
    }

    const docId = page.sourceDocumentId;
    const localIndex = puzzleLocalIndex(page);
    const unitPages: CompiledPage[] = [page];
    i += 1;
    while (i < pages.length) {
      const next = pages[i];
      if (!next) break;
      if (
        next.kind === 'murdoku' &&
        next.sourceDocumentId === docId &&
        next.puzzleIndexInDocument === localIndex
      ) {
        unitPages.push(next);
        i += 1;
        continue;
      }
      if (next.kind === 'blank' && next.sourceDocumentId === docId) {
        unitPages.push(next);
        i += 1;
        continue;
      }
      break;
    }
    units.push({
      pages: unitPages,
      docId,
      localIndex,
      chapterIndex: chapterIndexFromPage(page),
    });
  }
  return units;
}

function pickChapterPage(
  chapterPages: CompiledTextPage[],
  chapterIndex: number,
  topics: string[],
  usedIds: Set<string>
): CompiledTextPage | undefined {
  const unused = chapterPages.filter((page) => !usedIds.has(page.sourceDocumentId));
  const indexed = unused.find((page) => page.settings.chapterIndex === chapterIndex);
  if (indexed) return indexed;

  const topic = topics[chapterIndex]?.trim().toLowerCase();
  if (topic) {
    const match = unused.find((page) => chapterTitle(page).toLowerCase() === topic);
    if (match) return match;
  }
  return undefined;
}

export function reorderCompiledPagesForMixedPuzzles(
  pages: CompiledPage[],
  options?: { chapterTopics?: string[] }
): CompiledPage[] {
  if (pages.length === 0) return pages;

  const solutions: CompiledPage[] = [];
  const rest: CompiledPage[] = [];
  for (const page of pages) {
    if (isSolutionKind(page.kind)) solutions.push(page);
    else rest.push(page);
  }

  const firstPuzzle = rest.findIndex(isPuzzleContentPage);
  if (firstPuzzle < 0) return pages;

  const front: CompiledPage[] = [];
  const chapterPages: CompiledTextPage[] = [];
  const content: CompiledPage[] = [];

  for (let i = 0; i < rest.length; i++) {
    const page = rest[i];
    if (!page) continue;
    if (isChapterCompiledPage(page)) {
      chapterPages.push(page);
      continue;
    }
    if (i < firstPuzzle && !isPuzzleContentPage(page) && page.kind !== 'blank') {
      front.push(page);
      continue;
    }
    content.push(page);
  }

  const units = groupPuzzleUnits(content);
  if (units.length === 0) return pages;

  const topics = (options?.chapterTopics ?? []).map((topic) => topic.trim()).filter(Boolean);
  const maxExplicit = units.reduce((max, unit) => {
    const idx = unit.chapterIndex;
    return idx != null && Number.isFinite(idx) ? Math.max(max, idx) : max;
  }, -1);
  const chapterCount = Math.max(1, topics.length, maxExplicit + 1);

  const byDoc = new Map<string, MixUnit[]>();
  const docOrder: string[] = [];
  for (const unit of units) {
    if (!byDoc.has(unit.docId)) {
      byDoc.set(unit.docId, []);
      docOrder.push(unit.docId);
    }
    byDoc.get(unit.docId)!.push(unit);
  }

  for (const list of byDoc.values()) {
    list.sort((a, b) => a.localIndex - b.localIndex);
    const per =
      chapterCount > 1 ? Math.max(1, Math.round(list.length / chapterCount)) : list.length;
    for (const unit of list) {
      if (unit.chapterIndex == null || !Number.isFinite(unit.chapterIndex)) {
        unit.chapterIndex =
          chapterCount <= 1
            ? 0
            : Math.min(chapterCount - 1, Math.floor(unit.localIndex / per));
      }
    }
  }

  const usedChapterPageIds = new Set<string>();
  const mixed: CompiledPage[] = [...front];

  for (let ch = 0; ch < chapterCount; ch++) {
    const chapterPage = pickChapterPage(chapterPages, ch, topics, usedChapterPageIds);
    if (chapterPage) {
      mixed.push(chapterPage);
      usedChapterPageIds.add(chapterPage.sourceDocumentId);
    }
    const maxLen = Math.max(
      0,
      ...docOrder.map(
        (id) => (byDoc.get(id) ?? []).filter((unit) => unit.chapterIndex === ch).length
      )
    );
    for (let i = 0; i < maxLen; i++) {
      for (const docId of docOrder) {
        const chapterUnits = (byDoc.get(docId) ?? []).filter((unit) => unit.chapterIndex === ch);
        const unit = chapterUnits[i];
        if (unit) mixed.push(...unit.pages);
      }
    }
  }

  mixed.push(...solutions);
  return mixed;
}
