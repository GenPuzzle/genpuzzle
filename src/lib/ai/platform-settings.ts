/**
 * Read/write GenPuzzle platform settings for the AI agent.
 * Uses the same Word Search / book setters the sidebar uses.
 */

import type { BookSettings, TitleWordsSettings, WordSearchSettings } from '@/lib/puzzles/types';
import { normalizeAnswersPerPage } from '@/lib/puzzles/types';
import {
  findPlatformSetting,
  listPlatformSettings,
  normalizePlatformCategory,
  type PlatformCategory,
  type PlatformSettingDef,
} from './platform-settings-registry';

export interface PlatformSettingsSource {
  wordSearchSettings: WordSearchSettings;
  titleWords: TitleWordsSettings;
  bookSettings: BookSettings;
  pageMargin: number;
  puzzleGridScale: number;
}

export type PlatformSettingsSnapshot = Record<
  PlatformCategory,
  Record<string, string | number | boolean | string[] | null>
>;

function asStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((v) => String(v).trim()).filter(Boolean);
  }
  if (typeof value === 'string') {
    return value
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
  }
  return [];
}

function coerceValue(
  def: PlatformSettingDef,
  raw: unknown
): { ok: true; value: string | number | boolean | string[] } | { ok: false; error: string } {
  if (def.type === 'boolean') {
    if (typeof raw === 'boolean') return { ok: true, value: raw };
    if (typeof raw === 'string') {
      const v = raw.trim().toLowerCase();
      if (['true', '1', 'yes', 'on'].includes(v)) return { ok: true, value: true };
      if (['false', '0', 'no', 'off'].includes(v)) return { ok: true, value: false };
    }
    return { ok: false, error: `${def.name} expects a boolean.` };
  }
  if (def.type === 'number') {
    const n = typeof raw === 'number' ? raw : Number(raw);
    if (!Number.isFinite(n)) return { ok: false, error: `${def.name} expects a number.` };
    const clamped = Math.max(def.min ?? n, Math.min(def.max ?? n, n));
    return { ok: true, value: Math.round(clamped * 1000) / 1000 };
  }
  if (def.type === 'string[]') {
    return { ok: true, value: asStringArray(raw) };
  }
  if (def.type === 'enum') {
    const s = String(raw ?? '').trim();
    if (def.enumValues && !def.enumValues.includes(s)) {
      return {
        ok: false,
        error: `${def.name} must be one of: ${def.enumValues.join(', ')}.`,
      };
    }
    return { ok: true, value: s };
  }
  return { ok: true, value: String(raw ?? '') };
}

export function readPlatformSettingValue(
  source: PlatformSettingsSource,
  def: PlatformSettingDef
): string | number | boolean | string[] | null {
  const ws = source.wordSearchSettings;
  const { name, category } = def;

  if (category === 'trim') {
    if (name === 'trimSizePreset') return ws.bookCanvas.trimSizePreset ?? '8_5X11IN';
    if (name === 'includeBleed') return Boolean(ws.bookCanvas.includeBleed);
    if (name === 'pageMargin') return source.pageMargin;
    if (name === 'puzzleGridScale') return source.puzzleGridScale;
    if (name === 'answersPerPage') {
      return normalizeAnswersPerPage(ws.bookCanvas.answersPerPage ?? 1);
    }
  }

  if (category === 'style') {
    if (name === 'backgroundColor') return ws.colors.puzzlePage?.backgroundColor ?? '#FFFFFF';
    if (name === 'titleColor') return ws.colors.puzzlePage?.titleColor ?? '#000000';
    if (name === 'gridLetterColor') return ws.colors.puzzlePage?.puzzleColor ?? '#000000';
    if (name === 'wordListColor') return ws.colors.puzzlePage?.wordListColor ?? '#000000';
    if (name === 'pageFrameEnabled') return Boolean(ws.pageFrameSettings?.enabled);
    if (name === 'pageNumberEnabled') return Boolean(ws.typography.pageNumber?.enabled);
    if (name === 'pageNumberPosition') return ws.typography.pageNumber?.position ?? 'bottom-center';
  }

  if (category === 'chapters') {
    if (name === 'mixPuzzles') return Boolean(source.bookSettings.mixPuzzles);
    if (name === 'chapterTopics') return source.bookSettings.chapterTopics ?? [];
  }

  if (category === 'puzzle') {
    const core = ws.core as Record<string, unknown>;
    if (name in core) return core[name] as string | number | boolean;
  }

  if (category === 'words') {
    if (name === 'words') return source.titleWords.words ?? [];
    if (name === 'wordsPerPuzzle') return ws.wordList.wordsPerPuzzle ?? 15;
    if (name === 'wordListFontSize') return ws.wordList.wordListFontSize ?? 14;
    if (name === 'wordListFontFamily') return ws.wordList.wordListFontFamily ?? 'Arial';
    if (name === 'wordListColumns') return ws.wordList.wordListColumns ?? 2;
    if (name === 'includeFunFacts') return Boolean(ws.typography.includeFunFacts);
    if (name === 'funFactsText') return ws.typography.funFactsText ?? '';
  }

  if (category === 'titles') {
    const ty = ws.typography as Record<string, unknown>;
    if (name in ty) return ty[name] as string | number | boolean;
  }

  return null;
}

export function buildPlatformSettingsSnapshot(
  source: PlatformSettingsSource,
  categories?: PlatformCategory[]
): PlatformSettingsSnapshot {
  const defs = listPlatformSettings(categories);
  const out: PlatformSettingsSnapshot = {
    trim: {},
    style: {},
    chapters: {},
    puzzle: {},
    words: {},
    titles: {},
  };
  for (const def of defs) {
    out[def.category][def.name] = readPlatformSettingValue(source, def);
  }
  return out;
}

export interface PlatformUpdatePatch {
  wordSearch?: Partial<WordSearchSettings>;
  titleWords?: TitleWordsSettings;
  bookSettings?: Partial<BookSettings>;
  pageMargin?: number;
  puzzleGridScale?: number;
  trimSizePreset?: string;
  highlight: { category: PlatformCategory; settingName: string };
  tab: PlatformSettingDef['tab'];
  panel: PlatformSettingDef['panel'];
  label: string;
}

/**
 * Build a patch object for one setting change. Caller applies via app bridge setters.
 */
export function buildPlatformSettingUpdate(
  source: PlatformSettingsSource,
  categoryRaw: string,
  settingName: string,
  rawValue: unknown
): { ok: true; patch: PlatformUpdatePatch } | { ok: false; error: string } {
  const category = normalizePlatformCategory(categoryRaw);
  if (!category) {
    return {
      ok: false,
      error: `Unknown category "${categoryRaw}". Use trim, style, chapters, puzzle, words, or titles.`,
    };
  }
  const def = findPlatformSetting(category, settingName);
  if (!def) {
    return {
      ok: false,
      error: `Unknown setting "${settingName}" in ${category}. Call get_platform_settings for the list.`,
    };
  }
  const coerced = coerceValue(def, rawValue);
  if (!coerced.ok) return coerced;

  const value = coerced.value;
  const patch: PlatformUpdatePatch = {
    highlight: { category, settingName: def.name },
    tab: def.tab,
    panel: def.panel,
    label: def.label,
  };

  const name = def.name;

  // Nested patches must only include the changed keys. Spreading the full live
  // object here made sequential AI updates overwrite each other when the bridge
  // still held a stale React snapshot.
  if (category === 'trim') {
    if (name === 'trimSizePreset') {
      patch.trimSizePreset = String(value);
      return { ok: true, patch };
    }
    if (name === 'includeBleed') {
      patch.wordSearch = {
        bookCanvas: { includeBleed: Boolean(value) } as WordSearchSettings['bookCanvas'],
      };
      return { ok: true, patch };
    }
    if (name === 'pageMargin') {
      patch.pageMargin = Number(value);
      return { ok: true, patch };
    }
    if (name === 'puzzleGridScale') {
      patch.puzzleGridScale = Number(value);
      return { ok: true, patch };
    }
    if (name === 'answersPerPage') {
      patch.wordSearch = {
        bookCanvas: {
          answersPerPage: normalizeAnswersPerPage(value),
        } as WordSearchSettings['bookCanvas'],
      };
      return { ok: true, patch };
    }
  }

  if (category === 'style') {
    if (name === 'backgroundColor') {
      patch.wordSearch = {
        colors: {
          puzzlePage: { backgroundColor: String(value) },
        } as WordSearchSettings['colors'],
      };
      return { ok: true, patch };
    }
    if (name === 'titleColor') {
      patch.wordSearch = {
        colors: {
          puzzlePage: { titleColor: String(value) },
        } as WordSearchSettings['colors'],
      };
      return { ok: true, patch };
    }
    if (name === 'gridLetterColor') {
      patch.wordSearch = {
        colors: {
          puzzlePage: { puzzleColor: String(value) },
        } as WordSearchSettings['colors'],
      };
      return { ok: true, patch };
    }
    if (name === 'wordListColor') {
      patch.wordSearch = {
        colors: {
          puzzlePage: { wordListColor: String(value) },
        } as WordSearchSettings['colors'],
      };
      return { ok: true, patch };
    }
    if (name === 'pageFrameEnabled') {
      patch.wordSearch = {
        pageFrameSettings: { enabled: Boolean(value) } as WordSearchSettings['pageFrameSettings'],
      };
      return { ok: true, patch };
    }
    if (name === 'pageNumberEnabled') {
      patch.wordSearch = {
        typography: {
          pageNumber: { enabled: Boolean(value) },
        } as WordSearchSettings['typography'],
      };
      return { ok: true, patch };
    }
    if (name === 'pageNumberPosition') {
      patch.wordSearch = {
        typography: {
          pageNumber: { position: String(value) as never },
        } as WordSearchSettings['typography'],
      };
      return { ok: true, patch };
    }
  }

  if (category === 'chapters') {
    if (name === 'mixPuzzles') {
      patch.bookSettings = { mixPuzzles: Boolean(value) };
      return { ok: true, patch };
    }
    if (name === 'chapterTopics') {
      patch.bookSettings = { chapterTopics: asStringArray(value) };
      return { ok: true, patch };
    }
  }

  if (category === 'puzzle') {
    patch.wordSearch = {
      core: { [name]: value } as WordSearchSettings['core'],
    };
    return { ok: true, patch };
  }

  if (category === 'words') {
    if (name === 'words') {
      patch.titleWords = {
        ...source.titleWords,
        words: asStringArray(value),
      };
      return { ok: true, patch };
    }
    if (
      name === 'wordsPerPuzzle' ||
      name === 'wordListFontSize' ||
      name === 'wordListFontFamily' ||
      name === 'wordListColumns'
    ) {
      patch.wordSearch = {
        wordList: { [name]: value } as WordSearchSettings['wordList'],
      };
      return { ok: true, patch };
    }
    if (name === 'includeFunFacts' || name === 'funFactsText') {
      patch.wordSearch = {
        typography: { [name]: value } as WordSearchSettings['typography'],
      };
      return { ok: true, patch };
    }
  }

  if (category === 'titles') {
    patch.wordSearch = {
      typography: { [name]: value } as WordSearchSettings['typography'],
    };
    return { ok: true, patch };
  }

  return { ok: false, error: `Setting ${category}.${name} is not writable yet.` };
}
