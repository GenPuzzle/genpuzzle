/**
 * Natural-language → AiProjectSpec planner.
 * Uses a deterministic heuristic first, then optionally DeepSeek for refinement.
 */

import { getAIProvider } from './provider';
import {
  AI_PROJECT_SPEC_JSON_SCHEMA_HINT,
  mergeAiProjectSpecs,
  normalizeAiProjectSpec,
  parseProjectPromptHeuristic,
  summarizeAiProjectSpec,
  validateAiProjectSpec,
  type AiProjectPlanSummary,
  type AiProjectSpec,
} from './project-spec';

export interface PlanProjectResult {
  ok: true;
  spec: AiProjectSpec;
  summary: AiProjectPlanSummary;
  source: 'heuristic' | 'deepseek' | 'hybrid';
  requestId?: string;
}

export interface PlanProjectFailure {
  ok: false;
  error: string;
  partialSpec?: AiProjectSpec;
}

export { mergeAiProjectSpecs, mergePuzzleTypes } from './project-spec';

function mergeSpec(base: AiProjectSpec, overlay: AiProjectSpec): AiProjectSpec {
  return mergeAiProjectSpecs(base, overlay);
}

export async function planProjectFromPrompt(
  prompt: string,
  options?: { useDeepSeek?: boolean; projectId?: string; userId?: string }
): Promise<PlanProjectResult | PlanProjectFailure> {
  const trimmed = (prompt || '').normalize('NFC').trim();
  if (!trimmed) {
    return { ok: false, error: 'Please describe the puzzle book you want to create.' };
  }

  const heuristic = parseProjectPromptHeuristic(trimmed);
  const heuristicError = validateAiProjectSpec(heuristic);

  const useDeepSeek = options?.useDeepSeek !== false;
  if (!useDeepSeek) {
    if (heuristicError) return { ok: false, error: heuristicError, partialSpec: heuristic };
    return {
      ok: true,
      spec: heuristic,
      summary: summarizeAiProjectSpec(heuristic),
      source: 'heuristic',
    };
  }

  const provider = getAIProvider();
  const ai = await provider.generateStructuredContent({
    operationType: 'project_plan',
    projectId: options?.projectId,
    userId: options?.userId,
    temperature: 0.2,
    timeoutMs: 60_000,
    systemPrompt: `You convert natural-language puzzle-book requests into strict JSON matching this schema:
${AI_PROJECT_SPEC_JSON_SCHEMA_HINT}

Rules:
- Supported puzzle type ids (use exact ids): word-search, sudoku, crossword, maze, cryptogram, word-scramble, trivia, codewords, binairo, kakuro, math-maze, word-fill, number-fill, snake, murdoku.
- Never drop a puzzle type that appears in the seed interpretation — include every type the user named (including misspellings mapped in the seed, e.g. biniro → binairo).
- You may refine titles, chapter names, counts, and fun-fact flags, but puzzleTypes must be a superset of the seed's puzzleTypes.
- countPerChapter is per chapter when chapters.count > 1.
- If the user gives a book TOTAL (e.g. "20 Word Search" with 5 chapters) without saying "per chapter", divide evenly: countPerChapter = floor(total / chapters) (20÷5 → 4).
- If the user says "per chapter", "of each type", or "every chapter", treat the number as countPerChapter already.
- Prefer by-chapter organization when chapters.count > 1.
- If the user asks for fun facts under titles, set funFacts.enabled=true and position=below_title.
- Preserve the user's language for titles/themes (Unicode intact).
- Return JSON only.`,
    userPrompt: `User request:
"""
${trimmed}
"""

Seed interpretation (refine titles/chapters; KEEP every puzzle type listed here):
${JSON.stringify(heuristic, null, 2)}

Return the final AiProjectSpec JSON object.`,
  });

  if (!ai.ok) {
    if (!heuristicError && heuristic.puzzleTypes.length > 0) {
      return {
        ok: true,
        spec: heuristic,
        summary: summarizeAiProjectSpec(heuristic),
        source: 'heuristic',
        requestId: ai.requestId,
      };
    }
    return { ok: false, error: ai.message, partialSpec: heuristic };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(ai.content);
  } catch {
    if (!heuristicError && heuristic.puzzleTypes.length > 0) {
      return {
        ok: true,
        spec: heuristic,
        summary: summarizeAiProjectSpec(heuristic),
        source: 'heuristic',
        requestId: ai.requestId,
      };
    }
    return { ok: false, error: 'AI returned an invalid plan. Please retry.', partialSpec: heuristic };
  }

  const refined = mergeSpec(heuristic, normalizeAiProjectSpec(parsed));
  const error = validateAiProjectSpec(refined);
  if (error) {
    if (!heuristicError) {
      return {
        ok: true,
        spec: heuristic,
        summary: summarizeAiProjectSpec(heuristic),
        source: 'heuristic',
        requestId: ai.requestId,
      };
    }
    return { ok: false, error, partialSpec: refined };
  }

  return {
    ok: true,
    spec: refined,
    summary: summarizeAiProjectSpec(refined),
    source: 'hybrid',
    requestId: ai.requestId,
  };
}
