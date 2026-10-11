import type { ResolvedPage } from './types';

const pages = new Map<string, ResolvedPage>();

/**
 * Upper bound on cached revisions. Every settings tweak produces a new
 * revision, so an unbounded map keeps every intermediate page alive for the
 * whole session (a long slider drag on a crossword alone adds hundreds).
 */
const MAX_CACHED_PAGES = 240;

/** Immutable snapshot for one content revision. Later exports reuse it. */
export function getResolvedPage(revision: string, build: () => ResolvedPage): ResolvedPage {
  const cached = pages.get(revision);
  if (cached) {
    // Refresh insertion order so hot pages survive eviction.
    pages.delete(revision);
    pages.set(revision, cached);
    return cached;
  }
  const page = build();
  const frozen: ResolvedPage = {
    ...page,
    revision,
    elements: page.elements.map((element) => Object.freeze({ ...element })),
  };
  Object.freeze(frozen.elements);
  Object.freeze(frozen);
  if (pages.size >= MAX_CACHED_PAGES) {
    const oldest = pages.keys().next().value;
    if (oldest !== undefined) pages.delete(oldest);
  }
  pages.set(revision, frozen);
  return frozen;
}

export function invalidateResolvedPages(): void {
  pages.clear();
}

export function stableRevision(value: unknown): string {
  return JSON.stringify(value);
}

/**
 * Settings objects can carry image data URLs (maze markers, shape masks) that
 * run to megabytes. Only their identity matters for a revision, so keep a
 * cheap fingerprint instead of serialising them on every render.
 */
function compactReplacer(_key: string, value: unknown): unknown {
  if (typeof value === 'string' && value.length > 512) {
    return `len:${value.length}:${value.slice(0, 48)}:${value.slice(-48)}`;
  }
  return value;
}

/**
 * Revision fragment for a settings object (`gp`, `cw`, …): every field that
 * can change what the page looks like, with heavy image payloads reduced to a
 * fingerprint. Puzzle content must go through `stableRevision` instead.
 */
export function settingsRevision(settings: unknown): string {
  if (!settings || typeof settings !== 'object') return '';
  return JSON.stringify(settings, compactReplacer);
}
