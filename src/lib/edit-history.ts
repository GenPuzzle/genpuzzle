import type { WordSearchPuzzle } from './puzzles/types';
import type { PersistedAppSettings } from './settings-persistence';
import { diagTime } from './crossword-freeze-diag';

export const EDIT_HISTORY_LIMIT = 50;

export interface EditHistorySnapshot {
  settings: PersistedAppSettings;
  batchPuzzles: WordSearchPuzzle[];
}

export function cloneEditHistorySnapshot<T>(value: T): T {
  return diagTime(
    'cloneEditHistorySnapshot',
    () => {
      if (typeof structuredClone === 'function') {
        return structuredClone(value);
      }
      return JSON.parse(JSON.stringify(value)) as T;
    },
    typeof value === 'object' && value && 'batchPuzzles' in (value as object)
      ? `batch?`
      : Array.isArray(value)
        ? `array[${(value as unknown[]).length}]`
        : undefined
  );
}
