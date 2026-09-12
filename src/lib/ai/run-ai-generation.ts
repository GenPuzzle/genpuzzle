import type { PuzzleModuleType } from '@/lib/document-model';
import { AI_BATCH_MAX_RETRIES, getAiBatchSize } from './config';
import type {
  AiBatchRequest,
  AiFrontMatterCopy,
  AiGenerationProgress,
  AiProjectSetup,
  AiPuzzleContent,
} from './types';
import {
  assignDifficulties,
  applyCustomThemeTitles,
  aiChapterMultiplier,
  aiFrontMatterNeedsCopy,
  aiMurdokuHasDistinctThemeTitles,
  getAiChapterTopics,
  getAiPuzzleTypeLabel,
  isAiByChapter,
  parseAiThemeTitles,
  supportsAiThemeTitles,
} from './types';
import type { AiDifficulty, AiPuzzleTypeConfig } from './types';

export type AiRunResult =
  | {
      ok: true;
      contentByType: Partial<Record<PuzzleModuleType, AiPuzzleContent[]>>;
      frontMatterCopy: AiFrontMatterCopy;
    }
  | { ok: false; error: string; partial?: Partial<Record<PuzzleModuleType, AiPuzzleContent[]>> };

export function isAbortError(error: unknown): boolean {
  return (
    (typeof DOMException !== 'undefined' &&
      error instanceof DOMException &&
      error.name === 'AbortError') ||
    (error instanceof Error && (error.name === 'AbortError' || /aborted/i.test(error.message)))
  );
}

function throwIfAborted(signal?: AbortSignal) {
  if (signal?.aborted) {
    throw new DOMException('Aborted', 'AbortError');
  }
}

async function requestBatch(
  body: AiBatchRequest,
  signal?: AbortSignal
): Promise<{ ok: true; puzzles: AiPuzzleContent[] } | { ok: false; error: string }> {
  throwIfAborted(signal);
  let response: Response;
  try {
    response = await fetch('/api/ai/generate-batch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal,
    });
  } catch (error) {
    if (isAbortError(error)) throw error;
    return { ok: false, error: 'AI generation could not be completed. Please try again.' };
  }
  let json: { ok?: boolean; puzzles?: AiPuzzleContent[]; error?: string } = {};
  try {
    json = await response.json();
  } catch (error) {
    if (isAbortError(error)) throw error;
    return { ok: false, error: 'AI generation could not be completed. Please try again.' };
  }
  if (!response.ok || !json.ok || !Array.isArray(json.puzzles)) {
    return {
      ok: false,
      error: json.error || 'AI generation could not be completed. Please try again.',
    };
  }
  return { ok: true, puzzles: json.puzzles };
}

async function requestFrontMatterCopy(
  setup: AiProjectSetup,
  signal?: AbortSignal
): Promise<AiFrontMatterCopy> {
  const fm = setup.frontMatter;
  if (!aiFrontMatterNeedsCopy(fm)) return {};
  throwIfAborted(signal);
  const response = await fetch('/api/ai/generate-front-matter', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      setup: {
        bookTitle: setup.bookTitle,
        subtitle: setup.subtitle,
        description: setup.description,
        language: setup.language,
        audience: setup.audience,
        customAudience: setup.customAudience,
      },
      puzzleTypeLabels: setup.puzzleTypes.map((t) => getAiPuzzleTypeLabel(t.type)),
      needIntroduction: Boolean(fm?.includeIntroduction),
      needInstructions: Boolean(fm?.includeInstructions),
    }),
    signal,
  });
  try {
    const json = (await response.json()) as {
      ok?: boolean;
      introduction?: string;
      instructions?: string;
    };
    if (!response.ok || !json.ok) return {};
    return {
      introduction: json.introduction?.trim() || undefined,
      instructions: json.instructions?.trim() || undefined,
    };
  } catch (error) {
    if (isAbortError(error)) throw error;
    return {};
  }
}

function chapterAwareSetup(
  setup: AiProjectSetup,
  topic: string,
  chapterIndex: number,
  chapterCount: number
): AiBatchRequest['setup'] {
  const trimmed = topic.trim();
  const extra = trimmed
    ? `Chapter ${chapterIndex + 1} of ${chapterCount}: "${trimmed}". Every puzzle in this batch must be about "${trimmed}" only.`
    : '';
  return {
    bookTitle: setup.bookTitle,
    subtitle: setup.subtitle,
    description: [setup.description.trim(), extra].filter(Boolean).join('\n\n'),
    language: setup.language,
    audience: setup.audience,
    customAudience: setup.customAudience,
  };
}

function typeConfigForChapter(
  typeConfig: AiPuzzleTypeConfig,
  topic: string,
  perChapter: number
): AiPuzzleTypeConfig {
  const theme = topic.trim();
  const useTheme = Boolean(theme) && supportsAiThemeTitles(typeConfig.type);
  return {
    ...typeConfig,
    count: perChapter,
    useCustomThemeTitles: useTheme || Boolean(typeConfig.useCustomThemeTitles),
    themeTitles: useTheme
      ? Array.from({ length: perChapter }, () => theme).join('\n')
      : typeConfig.themeTitles,
  };
}

function difficultiesForType(
  typeConfig: AiPuzzleTypeConfig,
  total: number,
  chapterCount: number,
  perChapter: number
): AiDifficulty[] {
  if (typeConfig.difficultyStrategy === 'custom') {
    const out: AiDifficulty[] = [];
    for (let i = 0; i < chapterCount; i++) {
      out.push(
        ...assignDifficulties(perChapter, 'custom', typeConfig.customDistribution)
      );
    }
    while (out.length < total) out.push('medium');
    return out.slice(0, total);
  }
  return assignDifficulties(
    total,
    typeConfig.difficultyStrategy,
    typeConfig.customDistribution
  );
}

function collectExclusions(contentByType: Partial<Record<PuzzleModuleType, AiPuzzleContent[]>>) {
  const excludeTitles: string[] = [];
  const excludeWords: string[] = [];
  const excludeAnswers: string[] = [];
  for (const list of Object.values(contentByType)) {
    for (const p of list ?? []) {
      excludeTitles.push(p.title);
      if (p.type === 'word-search' || p.type === 'word-scramble') {
        excludeWords.push(...p.words);
      }
      if (p.type === 'crossword') {
        excludeAnswers.push(...p.entries.map((e) => e.answer));
      }
    }
  }
  return { excludeTitles, excludeWords, excludeAnswers };
}

export async function runAiBookGeneration(
  setup: AiProjectSetup,
  onProgress?: (progress: AiGenerationProgress) => void,
  signal?: AbortSignal
): Promise<AiRunResult> {
  const contentByType: Partial<Record<PuzzleModuleType, AiPuzzleContent[]>> = {};
  const byType: AiGenerationProgress['byType'] = {};
  let overallTotal = 0;
  const chapterMul = aiChapterMultiplier(setup);
  const topics = isAiByChapter(setup) ? getAiChapterTopics(setup) : [''];
  const chapterCount = Math.max(1, topics.length);

  for (const cfg of setup.puzzleTypes) {
    const total = cfg.count * chapterMul;
    overallTotal += total;
    byType[cfg.type] = {
      done: 0,
      total,
      label: getAiPuzzleTypeLabel(cfg.type),
    };
  }

  const report = (statusMessage: string) => {
    const overallDone = Object.values(byType).reduce((s, t) => s + t.done, 0);
    onProgress?.({ overallDone, overallTotal, byType: { ...byType }, statusMessage });
  };

  report('Starting AI generation…');

  for (const typeConfig of setup.puzzleTypes) {
    throwIfAborted(signal);
    const type = typeConfig.type;
    const perChapter = typeConfig.count;
    const total = perChapter * chapterCount;
    const difficulties = difficultiesForType(typeConfig, total, chapterCount, perChapter);
    contentByType[type] = [];

    // Sudoku / maze are built by the app engines — never ask AI for themes or titles.
    if (type === 'sudoku' || type === 'maze') {
      const label = type === 'sudoku' ? 'Sudoku' : 'Maze';
      report(`Building ${total} ${label} puzzles…`);
      contentByType[type] = difficulties.map((difficulty) =>
        type === 'sudoku'
          ? { type: 'sudoku' as const, title: 'Sudoku', difficulty }
          : { type: 'maze' as const, title: 'Maze', difficulty }
      );
      byType[type]!.done = contentByType[type]!.length;
      report(`Built ${byType[type]!.done} / ${byType[type]!.total} ${byType[type]!.label}`);
      continue;
    }

    // Murdoku: one shared case pack per chapter unless the user entered
    // distinct per-puzzle theme titles (then use the normal batch path).
    if (type === 'murdoku' && !aiMurdokuHasDistinctThemeTitles(typeConfig)) {
      const generated: Extract<AiPuzzleContent, { type: 'murdoku' }>[] = [];
      for (let ch = 0; ch < chapterCount; ch++) {
        const topic = topics[ch] ?? '';
        const sliceConfig = typeConfigForChapter(typeConfig, topic, perChapter);
        const exclusions = collectExclusions(contentByType);
        const flavorBody: AiBatchRequest = {
          setup: chapterAwareSetup(setup, topic, ch, chapterCount),
          puzzleType: type,
          typeConfig: sliceConfig,
          startIndex: 0,
          count: 1,
          assignedDifficulties: [difficulties[ch * perChapter] ?? 'medium'],
          ...exclusions,
        };

        let pack: Extract<AiPuzzleContent, { type: 'murdoku' }> | undefined;
        let lastError = 'AI generation could not be completed. Please try again.';
        for (let attempt = 0; attempt <= AI_BATCH_MAX_RETRIES; attempt++) {
          throwIfAborted(signal);
          const chapterLabel =
            topic.trim() && chapterCount > 1 ? ` for “${topic.trim()}”` : '';
          report(
            `Writing Murdoku case copy${chapterLabel}` +
              (attempt > 0 ? ` (retry ${attempt})` : '') +
              '…'
          );
          const result = await requestBatch(flavorBody, signal);
          if (result.ok && result.puzzles[0]?.type === 'murdoku') {
            pack = result.puzzles[0];
            break;
          }
          lastError = result.ok ? lastError : result.error;
        }
        if (!pack) {
          return { ok: false, error: lastError, partial: contentByType };
        }

        const customTitles = parseAiThemeTitles(sliceConfig.themeTitles);
        for (let i = 0; i < perChapter; i++) {
          const index = ch * perChapter + i;
          const custom = customTitles[i];
          const titleBase = custom || topic.trim() || pack.title;
          generated.push({
            ...pack,
            type: 'murdoku',
            difficulty: difficulties[index] ?? pack.difficulty,
            title: custom || (i === 0 ? titleBase : `${titleBase} ${i + 1}`),
            theme: custom || topic.trim() || pack.theme,
            caseTitle: custom || pack.caseTitle || titleBase,
          });
        }
        contentByType[type] = generated;
        byType[type]!.done = generated.length;
        report(`Prepared ${byType[type]!.done} / ${byType[type]!.total} ${byType[type]!.label}`);
      }
      continue;
    }

    const batchSize = getAiBatchSize(type);

    for (let ch = 0; ch < chapterCount; ch++) {
      const topic = topics[ch] ?? '';
      const sliceConfig = typeConfigForChapter(typeConfig, topic, perChapter);
      const typeLabel = getAiPuzzleTypeLabel(type);
      const chapterLabel =
        topic.trim() && chapterCount > 1 ? ` · ${topic.trim()}` : '';

      for (let start = 0; start < perChapter; start += batchSize) {
        const count = Math.min(batchSize, perChapter - start);
        const globalStart = ch * perChapter + start;
        const exclusions = collectExclusions(contentByType);
        const body: AiBatchRequest = {
          setup: chapterAwareSetup(setup, topic, ch, chapterCount),
          puzzleType: type,
          typeConfig: sliceConfig,
          startIndex: start,
          count,
          assignedDifficulties: difficulties.slice(globalStart, globalStart + count),
          ...exclusions,
        };

        let success = false;
        let lastError = 'AI generation could not be completed. Please try again.';
        for (let attempt = 0; attempt <= AI_BATCH_MAX_RETRIES; attempt++) {
          throwIfAborted(signal);
          report(
            `Generating ${typeLabel} ${globalStart + 1}–${globalStart + count}${chapterLabel}` +
              (attempt > 0 ? ` (retry ${attempt})` : '') +
              '…'
          );
          const result = await requestBatch(body, signal);
          if (result.ok) {
            const puzzles = applyCustomThemeTitles(result.puzzles, sliceConfig, start);
            contentByType[type]!.push(...puzzles);
            byType[type]!.done = contentByType[type]!.length;
            success = true;
            report(`Generated ${byType[type]!.done} / ${byType[type]!.total} ${byType[type]!.label}`);
            break;
          }
          lastError = result.error;
        }

        if (!success) {
          return { ok: false, error: lastError, partial: contentByType };
        }
      }
    }
  }

  report('Finalizing puzzles…');

  let frontMatterCopy: AiFrontMatterCopy = {};
  if (aiFrontMatterNeedsCopy(setup.frontMatter)) {
    throwIfAborted(signal);
    report('Writing introduction and instructions…');
    frontMatterCopy = await requestFrontMatterCopy(setup, signal);
  }

  return { ok: true, contentByType, frontMatterCopy };
}
