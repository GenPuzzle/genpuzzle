/**
 * Full in-browser session recovery for the puzzle book editor.
 * Persists the complete .gp project snapshot (settings + all puzzle batches)
 * to IndexedDB so F5 restores generated puzzles without regenerating.
 * No Supabase / remote DB.
 */
import {
  isGpProjectFile,
  type GpProjectFile,
} from './project-file';

export const SESSION_DB_NAME = 'genpuzzle-editor-session';
export const SESSION_DB_VERSION = 1;
export const SESSION_STORE = 'session';
export const SESSION_KEY = 'current-project';
/** Lightweight flag in localStorage so we know a session exists even before IDB opens. */
export const SESSION_FLAG_KEY = 'genpuzzle-session-v1-present';

export type SessionRecord = {
  version: 1;
  savedAt: string;
  project: GpProjectFile;
};

/** Pure helper — used by persistence and regression tests. */
export function createSessionRecord(project: GpProjectFile, savedAt = new Date().toISOString()): SessionRecord {
  return {
    version: 1,
    savedAt,
    project,
  };
}

export function projectFromSessionRecord(record: unknown): GpProjectFile | null {
  if (!record || typeof record !== 'object') return null;
  const candidate = record as Partial<SessionRecord>;
  if (candidate.version !== 1 || !candidate.project) return null;
  if (!isGpProjectFile(candidate.project)) return null;
  return candidate.project;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB unavailable'));
      return;
    }
    const request = indexedDB.open(SESSION_DB_NAME, SESSION_DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(SESSION_STORE)) {
        db.createObjectStore(SESSION_STORE);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('IndexedDB open failed'));
  });
}

function txDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('IndexedDB transaction failed'));
    tx.onabort = () => reject(tx.error ?? new Error('IndexedDB transaction aborted'));
  });
}

function markSessionFlag(present: boolean): void {
  if (typeof window === 'undefined') return;
  try {
    if (present) window.localStorage.setItem(SESSION_FLAG_KEY, '1');
    else window.localStorage.removeItem(SESSION_FLAG_KEY);
  } catch {
    /* ignore quota / private mode */
  }
}

export async function saveSessionProject(project: GpProjectFile): Promise<void> {
  if (typeof window === 'undefined') return;
  const record = createSessionRecord(project);
  try {
    const db = await openDb();
    const tx = db.transaction(SESSION_STORE, 'readwrite');
    tx.objectStore(SESSION_STORE).put(record, SESSION_KEY);
    await txDone(tx);
    markSessionFlag(true);
  } catch (error) {
    console.warn('[session-persistence] Failed to save session:', error);
  }
}

export async function loadSessionProject(): Promise<GpProjectFile | null> {
  if (typeof window === 'undefined') return null;
  try {
    const db = await openDb();
    const record = await new Promise<unknown>((resolve, reject) => {
      const tx = db.transaction(SESSION_STORE, 'readonly');
      const request = tx.objectStore(SESSION_STORE).get(SESSION_KEY);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    return projectFromSessionRecord(record);
  } catch (error) {
    console.warn('[session-persistence] Failed to load session:', error);
    return null;
  }
}

export async function clearSessionProject(): Promise<void> {
  if (typeof window === 'undefined') return;
  markSessionFlag(false);
  try {
    const db = await openDb();
    const tx = db.transaction(SESSION_STORE, 'readwrite');
    tx.objectStore(SESSION_STORE).delete(SESSION_KEY);
    await txDone(tx);
  } catch (error) {
    console.warn('[session-persistence] Failed to clear session:', error);
  }
}

/** True when a previous tab wrote a session flag (best-effort; IDB is source of truth). */
export function hasSessionFlag(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(SESSION_FLAG_KEY) === '1';
  } catch {
    return false;
  }
}
