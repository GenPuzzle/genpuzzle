/**
 * Central DeepSeek / AI book-generation configuration.
 * Change the model here only — do not scatter model strings elsewhere.
 */

export const DEEPSEEK_BASE_URL = 'https://api.deepseek.com';

/** Fast content-generation model (swap later without hunting call sites). */
export const DEEPSEEK_MODEL = 'deepseek-v4-flash';

export const DEEPSEEK_CHAT_PATH = '/chat/completions';

/** Soft limits for automatic retries of a failed batch. */
export const AI_BATCH_MAX_RETRIES = 2;

/**
 * Approx. puzzles requested per DeepSeek call by type.
 * Keep batches small so JSON stays reliable for large books.
 * Crossword is especially heavy (many clue/answer pairs per puzzle).
 */
export const AI_BATCH_SIZE_BY_TYPE: Record<string, number> = {
  'word-search': 8,
  crossword: 2,
  sudoku: 20,
  maze: 20,
  cryptogram: 10,
  'word-scramble': 8,
  trivia: 4,
  murdoku: 1,
};

/** Client-side fetch timeout per batch (DeepSeek server timeout is separate). */
export const AI_BATCH_CLIENT_TIMEOUT_MS: Record<string, number> = {
  crossword: 75_000,
  trivia: 90_000,
  murdoku: 90_000,
  'word-search': 90_000,
};

export function getAiBatchClientTimeoutMs(puzzleType: string): number {
  return AI_BATCH_CLIENT_TIMEOUT_MS[puzzleType] ?? 90_000;
}

export function getAiBatchSize(puzzleType: string): number {
  return AI_BATCH_SIZE_BY_TYPE[puzzleType] ?? 8;
}
