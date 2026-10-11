import assert from 'node:assert/strict';
import {
  aiProjectSpecToSetup,
  mergeAiProjectSpecs,
  parseProjectPromptHeuristic,
  summarizeAiProjectSpec,
  validateAiProjectSpec,
  validateSetupFromSpec,
} from './project-spec';
import { applyAiDivideIntoChapters } from './build-ai-project';
import { createDocumentPage } from '@/lib/document-model';
import { getDefaultWordSearchSettings } from '@/lib/puzzles/types';
import {
  resolveTextVariableTokens,
  tokenForVariableKey,
} from './text-variable-tokens';
import {
  buildPageVariableElements,
  createPageVariableField,
  formatPageVariableText,
} from '@/lib/page-variables';

const prompt =
  'Create a sea book with 6 chapters, 10 Word Search, 10 Crossword and 10 Maze puzzles per chapter, 4 solutions per page, minimum font 18pt, fun fact under every title.';

const spec = parseProjectPromptHeuristic(prompt);
const error = validateAiProjectSpec(spec);
assert.equal(error, null, error || '');
assert.ok(/sea/i.test(spec.theme) || /sea/i.test(spec.bookTitle || ''));
assert.equal(spec.chapters.count, 6);
assert.equal(spec.solutions.perPage, 4);
assert.equal(spec.typography.minimumFontSize, 18);
assert.equal(spec.funFacts.enabled, true);
assert.equal(spec.funFacts.position, 'below_title');

const byType = Object.fromEntries(spec.puzzleTypes.map((pt) => [pt.type, pt.countPerChapter]));
assert.equal(byType['word-search'], 10);
assert.equal(byType.crossword, 10);
assert.equal(byType.maze, 10);

const summary = summarizeAiProjectSpec(spec);
assert.equal(summary.chapters, 6);
assert.equal(summary.totalPuzzles, 180);
assert.equal(summary.puzzleTypes.find((p) => p.type === 'word-search')?.total, 60);
assert.equal(summary.puzzleTypes.find((p) => p.type === 'crossword')?.total, 60);
assert.equal(summary.puzzleTypes.find((p) => p.type === 'maze')?.total, 60);
assert.equal(summary.solutionsPerPage, 4);
assert.equal(summary.minimumFontSize, 18);
assert.equal(summary.funFacts.enabled, true);

// Divide-into-chapters: 5 chapters × 4 WS → 5 tabs of 4 (not one tab of 20).
{
  const page = createDocumentPage('word-search');
  const ws = getDefaultWordSearchSettings();
  ws.core.numberOfPuzzles = 20;
  page.settings = {
    ...(page.settings as object),
    wordSearchSettings: ws,
    titleWords: { title: 'WS', fontFamily: 'Arial', fontSize: 24, words: ['SEA'] },
  } as never;
  const puzzles = Array.from({ length: 20 }, (_, i) => ({
    pageId: page.id,
    pageName: page.name,
    puzzleIndexInDocument: i,
    puzzleNumber: i + 1,
    grid: [['A']],
    words: [] as string[],
  }));
  const divided = applyAiDivideIntoChapters(
    {
      bookTitle: 'Test',
      subtitle: '',
      description: 'Sea',
      language: 'English',
      audience: 'adults',
      puzzleTypes: [{ type: 'word-search', count: 4, difficultyStrategy: 'medium' }],
      organization: 'by-chapter',
      chapterTopics: ['One', 'Two', 'Three', 'Four', 'Five'].join('\n'),
      ensureFunFactPageVariable: true,
    },
    {
      pages: [page],
      batchPuzzles: puzzles as never,
      crosswordBatchPuzzles: [],
      genericBatchPuzzles: [],
      murdokuBatchPuzzles: [],
    }
  );
  const wsTabs = divided.pages.filter((p) => p.moduleType === 'word-search');
  assert.equal(wsTabs.length, 5);
  assert.deepEqual(
    wsTabs.map(
      (p) =>
        (p.settings as { wordSearchSettings?: { core: { numberOfPuzzles: number } } })
          .wordSearchSettings?.core.numberOfPuzzles
    ),
    [4, 4, 4, 4, 4]
  );
  assert.equal(new Set(divided.batchPuzzles.map((p) => p.pageId)).size, 5);
}

const setupError = validateSetupFromSpec(spec);
assert.equal(setupError, null, setupError || '');
const setup = aiProjectSpecToSetup(spec);
assert.equal(setup.organization, 'by-chapter');
assert.equal(setup.solutionsPerPage, 4);
assert.equal(setup.minimumFontSize, 18);
assert.equal(setup.ensureFunFactPageVariable, true);
assert.ok((setup.chapterTopics || '').split(/\n/).filter(Boolean).length >= 6);

// Book totals without "per chapter" divide evenly across chapters.
{
  const totalPrompt =
    'Make a USA history puzzle book with 5 chapters and Word Search, Crossword, binairo and Mazes. Create 20 Word Search, 20 Crossword, 20 binairo and 20 Maze puzzles.';
  const totalSpec = parseProjectPromptHeuristic(totalPrompt);
  assert.equal(totalSpec.chapters.count, 5);
  const totals = Object.fromEntries(
    totalSpec.puzzleTypes.map((pt) => [pt.type, pt.countPerChapter])
  );
  assert.equal(totals['word-search'], 4, '20 WS / 5 chapters → 4 each');
  assert.equal(totals.crossword, 4);
  assert.equal(totals.binairo, 4);
  assert.equal(totals.maze, 4);
  const totalSummary = summarizeAiProjectSpec(totalSpec);
  assert.equal(totalSummary.puzzleTypes.find((p) => p.type === 'word-search')?.total, 20);
}

// Explicit "per chapter" must keep the stated per-chapter count.
{
  const perChapterPrompt =
    'Create a book with 5 chapters and 20 Word Search puzzles per chapter.';
  const perSpec = parseProjectPromptHeuristic(perChapterPrompt);
  assert.equal(perSpec.chapters.count, 5);
  assert.equal(perSpec.puzzleTypes.find((p) => p.type === 'word-search')?.countPerChapter, 20);
}

const unicodeCtx = {
  funFact: 'Une école française — Mädchen Größe — mañana pingüino',
  puzzleTitle: 'École de la mer',
  puzzleNumber: 25,
  chapterTitle: 'Océan',
  chapterNumber: 2,
  instruction: 'Trouvez tous les mots.',
  puzzleSentence: '¡Ánimo!',
  solutionPage: 145,
  solutionPageLocation: 'Solution on page 145',
  difficulty: 'medium',
  theme: 'Sea',
  puzzleType: 'Word Search',
  pageNumber: 12,
  wordCount: 15,
  contentIndex: 0,
  funFactsByIndex: ['Blue whales are huge.', 'Coral reefs thrive.'],
  titlesByIndex: ['Ocean Giants', 'Coral Reef Life'],
};

assert.equal(
  resolveTextVariableTokens('[fun fact]', unicodeCtx),
  'Une école française — Mädchen Größe — mañana pingüino'
);
assert.equal(resolveTextVariableTokens('[puzzle title]', unicodeCtx), 'École de la mer');
assert.equal(resolveTextVariableTokens('[puzzle number]', unicodeCtx), '25');
assert.equal(resolveTextVariableTokens('[chapter title]', unicodeCtx), 'Océan');
assert.equal(resolveTextVariableTokens('[solution page]', unicodeCtx), '145');
assert.equal(
  resolveTextVariableTokens('[fun fact]', {
    contentIndex: 1,
    funFactsByIndex: unicodeCtx.funFactsByIndex,
  }),
  'Coral reefs thrive.'
);

for (const sample of ['école', 'français', 'Mädchen', 'Größe', 'español', 'mañana', 'pingüino']) {
  assert.equal(resolveTextVariableTokens('[fun fact]', { funFact: sample }), sample);
  const stripped = sample.normalize('NFD').replace(/\p{M}/gu, '');
  assert.notEqual(stripped, sample, `expected accents preserved for ${sample}`);
}

const funField = createPageVariableField('text', 50, 20, {
  variableKey: 'fun_fact',
  textLines: [tokenForVariableKey('fun_fact')],
  fontSize: 18,
});
assert.equal(
  formatPageVariableText(funField, 0, false, {
    funFactsByIndex: ['Octopuses have three hearts.', 'Sharks never stop swimming.'],
    contentIndex: 0,
  }),
  'Octopuses have three hearts.'
);

const page1 = buildPageVariableElements({
  fields: [funField],
  pageWidthPt: 612,
  pageHeightPt: 792,
  contentIndex: 0,
  bookPageNumber: 3,
  puzzleNumber: 1,
  resolveContext: {
    funFactsByIndex: ['Octopuses have three hearts.', 'Sharks never stop swimming.'],
  },
});
const page2 = buildPageVariableElements({
  fields: [funField],
  pageWidthPt: 612,
  pageHeightPt: 792,
  contentIndex: 1,
  bookPageNumber: 4,
  puzzleNumber: 2,
  resolveContext: {
    funFactsByIndex: ['Octopuses have three hearts.', 'Sharks never stop swimming.'],
  },
});
assert.ok(page1.some((el) => el.kind === 'text' && el.text === 'Octopuses have three hearts.'));
assert.ok(page2.some((el) => el.kind === 'text' && el.text === 'Sharks never stop swimming.'));
const t1 = page1.find((el) => el.kind === 'text');
const t2 = page2.find((el) => el.kind === 'text');
assert.ok(t1 && t2 && t1.kind === 'text' && t2.kind === 'text');
assert.equal(t1.fontSize, t2.fontSize);

// Create-with-AI plan must keep every type the user named (DeepSeek often drops some).
{
  const fullPrompt =
    'Make a sea puzzle book with 5 chapters. Add Word Search, Crossword, binairo, codewords and Mazes to every chapter. Create 4 puzzles of each type per chapter. Use 2 solutions per page. Make sure all fonts are at least 18pt. Add a unique fun fact under the title on every puzzle page. theme: USA history';
  const seed = parseProjectPromptHeuristic(fullPrompt);
  assert.deepEqual(
    seed.puzzleTypes.map((p) => p.type),
    ['word-search', 'crossword', 'binairo', 'codewords', 'maze']
  );
  const incompleteAi = {
    ...seed,
    bookTitle: 'USA History Puzzle Book',
    puzzleTypes: seed.puzzleTypes.filter((p) =>
      ['word-search', 'crossword', 'maze'].includes(p.type)
    ),
  };
  const merged = mergeAiProjectSpecs(seed, incompleteAi);
  assert.equal(merged.bookTitle, 'USA History Puzzle Book');
  assert.deepEqual(
    merged.puzzleTypes.map((p) => p.type),
    ['word-search', 'crossword', 'binairo', 'codewords', 'maze']
  );
  assert.equal(merged.puzzleTypes.find((p) => p.type === 'binairo')?.countPerChapter, 4);
  assert.equal(merged.puzzleTypes.find((p) => p.type === 'codewords')?.countPerChapter, 4);
  const mergedSummary = summarizeAiProjectSpec(merged);
  assert.equal(mergedSummary.totalPuzzles, 100);
  assert.equal(mergedSummary.puzzleTypes.length, 5);
}

console.log('ai-agent.selftest: OK', {
  chapters: summary.chapters,
  totalPuzzles: summary.totalPuzzles,
  solutionsPerPage: summary.solutionsPerPage,
  minimumFontSize: summary.minimumFontSize,
});
