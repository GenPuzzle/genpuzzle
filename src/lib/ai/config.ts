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
 */
export const AI_BATCH_SIZE_BY_TYPE: Record<string, number> = {
  'word-search': 10,
  crossword: 8,
  sudoku: 20,
  maze: 20,
  cryptogram: 12,
  'word-scramble': 10,
  trivia: 5,
  murdoku: 1,
};

export function getAiBatchSize(puzzleType: string): number {
  return AI_BATCH_SIZE_BY_TYPE[puzzleType] ?? 10;
}
