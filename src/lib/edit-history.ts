import type { WordSearchPuzzle } from './puzzles/types';
import type { PersistedAppSettings } from './settings-persistence';

export const EDIT_HISTORY_LIMIT = 50;

export interface EditHistorySnapshot {
  settings: PersistedAppSettings;
  batchPuzzles: WordSearchPuzzle[];
}

export function cloneEditHistorySnapshot<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
