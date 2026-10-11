'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { MiniColorInput } from '@/components/ui/color-input';
import { SliderField } from '@/components/ui/slider-field';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useApp } from '@/lib/app-context';
import {
  buildBatchChapterPages,
  defaultChapterTitleLines,
  getExistingChapterSubtitleLines,
  getExistingChapterTitleLines,
  suggestChapterTitlesFromPuzzleDocuments,
  updateExistingChapterPages,
  type ChapterBatchEntry,
} from '@/lib/batch-chapter-pages';
import { isPuzzleModuleType } from '@/lib/document-model';
import {
  applyChapterStyleToAllDocuments,
  CHAPTER_LAYOUT_PRESETS,
  CHAPTER_PAGE_STYLE_STORAGE_KEY,
  countChapterTitlePages,
  DEFAULT_CHAPTER_PAGE_STYLE,
  normalizeChapterPageStyle,
  type ChapterLayoutId,
  type ChapterPageStyleSettings,
} from '@/lib/chapter-page-layouts';
import {
  CHAPTER_TITLES_DRAFT_EVENT,
  parseChapterTitleLines,
  readChapterTitlesDraft,
  writeChapterTitlesDraft,
  type ChapterTitlesDraft,
} from '@/lib/chapter-titles-draft';
import { usePersistedState } from '@/hooks/usePersistedState';
import { useDebouncedCallback } from '@/hooks/useDebouncedCallback';
import { useOptionalAppBusy } from '@/lib/app-busy-context';
import { PUBLISHING_FONTS } from '@/lib/publishing-fonts';
import { Upload, Trash2, Layers, LayoutTemplate } from 'lucide-react';
import { ChapterLayoutIcon } from '@/components/ChapterLayoutIcon';

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

/** Stable merge for usePersistedState — must not be recreated each render. */
function mergeChapterPageStyle(
  stored: ChapterPageStyleSettings,
  initial: ChapterPageStyleSettings
): ChapterPageStyleSettings {
  return normalizeChapterPageStyle({ ...initial, ...stored });
}

type ChapterDataType =
  | 'word-search'
  | 'crossword'
  | 'trivia'
  | 'sudoku'
  | 'maze'
  | 'cryptogram'
  | 'word-scramble'
  | 'murdoku';
type EditScope = 'chapter' | 'all';

const CHAPTER_DATA_TYPE_LABELS: Record<ChapterDataType, string> = {
  'word-search': 'Word Search',
  crossword: 'Crossword',
  trivia: 'Trivia',
  sudoku: 'Sudoku',
  maze: 'Maze',
  cryptogram: 'Cryptogram',
  'word-scramble': 'Word Scramble',
  murdoku: 'Murdoku',
};

function ChapterPuzzleDataEditor({
  documentPages,
  updateDocumentPage,
  applyWordSearchChapterChanges,
}: {
  documentPages: import('@/lib/document-model').DocumentPage[];
  updateDocumentPage: (id: string, updates: Partial<import('@/lib/document-model').DocumentPage>) => void;
  applyWordSearchChapterChanges: (pages: import('@/lib/document-model').DocumentPage[]) => Promise<void>;
}) {
  const chapterDocs = documentPages.filter(
    (page) => isPuzzleModuleType(page.moduleType) &&
      typeof (page.settings as { chapterIndex?: number }).chapterIndex === 'number'
  );
  const chapterCount = chapterDocs.reduce(
    (max, page) => Math.max(max, (page.settings as { chapterIndex: number }).chapterIndex + 1),
    0
  );
  const [open, setOpen] = useState(false);
  const [scope, setScope] = useState<EditScope>('chapter');
  const [chapterIndex, setChapterIndex] = useState(0);
  const [dataType, setDataType] = useState<ChapterDataType | ''>('');
  const [draft, setDraft] = useState<Record<string, string>>({});

  const availableTypes = Array.from(
    new Set(chapterDocs.map((page) => page.moduleType as ChapterDataType))
  ).filter((type): type is ChapterDataType => type in CHAPTER_DATA_TYPE_LABELS);

  useEffect(() => {
    if (!dataType || !availableTypes.includes(dataType)) {
      setDataType(availableTypes[0] ?? '');
    }
  }, [availableTypes.join('|'), dataType]);

  const selectedPages = chapterDocs.filter(
    (page) =>
      (scope === 'all' ||
        (page.settings as { chapterIndex?: number }).chapterIndex === chapterIndex) &&
      page.moduleType === dataType
  );
  const selectedPage = selectedPages[0];

  const readPageFields = (page: (typeof chapterDocs)[number]) => {
    const settings = page.settings as any;
    if (dataType === 'word-search') {
      return {
        title: settings.wordSearchSettings?.typography?.titleText || settings.titleWords?.title || '',
        words: (settings.titleWords?.words ?? []).join('\n'),
      };
    }
    if (dataType === 'crossword') {
      return {
        title: settings.crosswordSettings?.typography?.titleText ?? '',
        answers: settings.crosswordSettings?.core?.answersText ?? '',
        clues: settings.crosswordSettings?.core?.cluesText ?? '',
      };
    }
    if (dataType === 'trivia') {
      const generic = settings.genericPuzzleSettings;
      return {
        titles: generic?.typography?.differentTitles || generic?.typography?.titleText || '',
        questions: generic?.core?.questionsText ?? '',
        suggestions: generic?.core?.suggestionsText ?? '',
        answers: generic?.core?.answersText ?? '',
      };
    }
    if (dataType === 'cryptogram') {
      return { phrases: settings.genericPuzzleSettings?.core?.cryptogramPhrases ?? '' };
    }
    if (dataType === 'word-scramble') {
      return { words: settings.genericPuzzleSettings?.core?.scrambleWords ?? '' };
    }
    return {};
  };

  useEffect(() => {
    if (selectedPages.length === 0 || !dataType) {
      setDraft({});
      return;
    }
    const pages = scope === 'all' ? selectedPages : [selectedPages[0]];
    const fieldKeys = Object.keys(readPageFields(pages[0]));
    const next: Record<string, string> = {};
    for (const key of fieldKeys) {
      next[key] = pages.map((page) => readPageFields(page)[key] ?? '').filter(Boolean).join('\n');
    }
    setDraft(next);
  }, [selectedPages.map((page) => page.id).join('|'), dataType, chapterIndex, scope]);

  const saveDraft = async () => {
    if (!selectedPage || !dataType) return;
    const pages = scope === 'all' ? selectedPages : [selectedPage];
    const splitLines = (value: string, count: number) => {
      const lines = value.split(/\r?\n/);
      const size = Math.ceil(lines.length / Math.max(1, count));
      return Array.from({ length: count }, (_, index) => lines.slice(index * size, (index + 1) * size).join('\n'));
    };
    const chunksByField: Record<string, string[]> = {};
    for (const key of Object.keys(draft)) chunksByField[key] = splitLines(draft[key] ?? '', pages.length);
    const updatedPages = pages.map((page, index) => {
      const settings = structuredClone(page.settings) as any;
      const value = (key: string) => chunksByField[key]?.[index] ?? '';
      if (dataType === 'word-search') {
        settings.wordSearchSettings = {
          ...settings.wordSearchSettings,
          typography: {
            ...settings.wordSearchSettings?.typography,
            selectTitleOption: 'custom',
            titleText: value('title'),
          },
        };
        settings.titleWords = {
          ...settings.titleWords,
          words: value('words').split(/\r?\n/).map((line) => line.trim()).filter(Boolean),
        };
      } else if (dataType === 'crossword') {
        settings.crosswordSettings = { ...settings.crosswordSettings, typography: { ...settings.crosswordSettings.typography, titleText: value('title') }, core: { ...settings.crosswordSettings.core, answersText: value('answers'), cluesText: value('clues') } };
      } else if (dataType === 'trivia') {
        settings.genericPuzzleSettings = { ...settings.genericPuzzleSettings, typography: { ...settings.genericPuzzleSettings.typography, selectTitleOption: 'custom_per_puzzle', differentTitles: value('titles') }, core: { ...settings.genericPuzzleSettings.core, questionsText: value('questions'), suggestionsText: value('suggestions'), answersText: value('answers') } };
      } else if (dataType === 'cryptogram') {
        settings.genericPuzzleSettings = { ...settings.genericPuzzleSettings, core: { ...settings.genericPuzzleSettings.core, cryptogramPhrases: value('phrases') } };
      } else if (dataType === 'word-scramble') {
        settings.genericPuzzleSettings = { ...settings.genericPuzzleSettings, core: { ...settings.genericPuzzleSettings.core, scrambleWords: value('words') } };
      }
      return { ...page, settings };
    });
    updatedPages.forEach((page) => updateDocumentPage(page.id, { settings: page.settings }));
    if (dataType === 'word-search') {
      const originalWords = pages.map((page) => readPageFields(page).words ?? '').join('\n');
      const updatedWords = updatedPages.map((page) => (page.settings as any).titleWords?.words?.join('\n') ?? '').join('\n');
      if (originalWords !== updatedWords) {
        await applyWordSearchChapterChanges(updatedPages);
      }
    }
    setOpen(false);
  };

  const field = (key: string, label: string, rows = 6) => (
    <div className="space-y-1">
      <Label>{label}</Label>
      <Textarea value={draft[key] ?? ''} onChange={(event) => setDraft((prev) => ({ ...prev, [key]: event.target.value }))} rows={rows} />
    </div>
  );

  return (
    <>
      <Button type="button" variant="outline" className="w-full" disabled={chapterCount === 0} onClick={() => setOpen(true)}>
        Edit puzzles data of the chapters
      </Button>
      {open && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4" role="dialog" aria-modal="true" aria-label="Edit chapter puzzle data">
          <div className="flex max-h-[90vh] w-full max-w-3xl flex-col gap-4 overflow-y-auto rounded-lg border border-slate-200 bg-white p-6 text-slate-900 shadow-2xl dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100">
            <div>
              <h2 className="text-lg font-semibold">Edit chapter puzzle data</h2>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Edit the source data for one puzzle type in one chapter, then save.</p>
            </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label>Edit scope</Label>
            <Select value={scope} onValueChange={(value) => setScope(value as EditScope)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="chapter">One chapter</SelectItem>
                <SelectItem value="all">All chapters</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Chapter</Label>
            <Select value={String(chapterIndex)} onValueChange={(value) => setChapterIndex(Number(value))} disabled={scope === 'all'}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{Array.from({ length: chapterCount }, (_, index) => <SelectItem key={index} value={String(index)}>Chapter {index + 1}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="col-span-2 space-y-1">
            <Label>Puzzle type</Label>
            <Select value={dataType} onValueChange={(value) => setDataType(value as ChapterDataType)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{availableTypes.map((type) => <SelectItem key={type} value={type}>{CHAPTER_DATA_TYPE_LABELS[type]}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </div>
        {!selectedPage && <p className="text-sm text-amber-600">This selection does not contain a {dataType || 'puzzle type'} document.</p>}
        {selectedPage && dataType === 'word-search' && <>{field('title', 'Theme titles, one per line', 5)}{field('words', 'Word list, one word per line', 12)}</>}
        {selectedPage && dataType === 'crossword' && <>{field('title', 'Theme title', 2)}{field('answers', 'Answers, one per line', 8)}{field('clues', 'Clues, one per line', 8)}</>}
        {selectedPage && dataType === 'trivia' && <>{field('titles', 'Theme titles, one per line', 5)}{field('questions', 'Questions, one per line', 10)}{field('suggestions', 'Suggestions, one per line', 10)}{field('answers', 'Correct answers, one per line', 8)}</>}
        {selectedPage && dataType === 'cryptogram' && field('phrases', 'Cryptogram phrases, one per line', 12)}
        {selectedPage && dataType === 'word-scramble' && field('words', 'Scramble words, one per line', 12)}
        {selectedPage && (dataType === 'maze' || dataType === 'murdoku') && <p className="text-sm text-slate-600">This puzzle type has no chapter text list to edit here. Use its document controls for generation settings.</p>}
        {selectedPage && dataType === 'sudoku' && <p className="text-sm text-slate-600">Sudoku has no text question bank. Its chapter settings are available through the Sudoku document controls.</p>}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button type="button" onClick={() => void saveDraft()} disabled={!selectedPage || dataType === 'sudoku'}>
                {dataType === 'word-search' ? 'Apply changes (regenerate if word lists changed)' : 'Apply changes'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/**
 * Batch-create chapter title pages + shared layout/style editor.
 * Style edits apply to every existing chapter title page.
 */
export function ChapterPagesBatchPanel() {
  const { documentPages, wordSearchSettings, replaceDocumentPages, activeDocumentPageId, updateDocumentPage, applyWordSearchChapterChanges } =
    useApp();
  const { showBusy, hideBusy } = useOptionalAppBusy();

  const puzzleDocs = useMemo(
    () => documentPages.filter((d) => isPuzzleModuleType(d.moduleType)),
    [documentPages]
  );

  const chapterCount = useMemo(() => countChapterTitlePages(documentPages), [documentPages]);

  const suggestedTitles = useMemo(
    () => suggestChapterTitlesFromPuzzleDocuments(documentPages),
    [documentPages]
  );

  const [style, setStyle] = usePersistedState<ChapterPageStyleSettings>(
    CHAPTER_PAGE_STYLE_STORAGE_KEY,
    DEFAULT_CHAPTER_PAGE_STYLE,
    { merge: mergeChapterPageStyle }
  );

  const [titlesText, setTitlesText] = useState(() => {
    const existing = getExistingChapterTitleLines(documentPages);
    if (existing.length > 0) return existing.join('\n');
    const draft = readChapterTitlesDraft();
    if (draft.touched && draft.titles.length > 0) return draft.titles.join('\n');
    return defaultChapterTitleLines(puzzleDocs.length || 3).join('\n');
  });
  const [subtitlesText, setSubtitlesText] = useState(() => {
    const existing = getExistingChapterSubtitleLines(documentPages);
    if (existing.length > 0) return existing.join('\n');
    return '';
  });
  const [sharedBackgroundImage, setSharedBackgroundImage] = useState<string | undefined>();
  const [placeImageAsBlock, setPlaceImageAsBlock] = useState(true);
  const [perChapterImages, setPerChapterImages] = useState<(string | undefined)[]>([]);
  const [status, setStatus] = useState<string | null>(null);
  const sharedInputRef = useRef<HTMLInputElement>(null);
  const multiImageInputRef = useRef<HTMLInputElement>(null);
  const chapterImageInputRef = useRef<HTMLInputElement>(null);
  const chapterImageTargetIndex = useRef<number | null>(null);
  const titlesTouchedRef = useRef(
    getExistingChapterTitleLines(documentPages).length > 0 || readChapterTitlesDraft().touched
  );
  const subtitlesTouchedRef = useRef(getExistingChapterSubtitleLines(documentPages).some(Boolean));
  const skipNextStyleSyncRef = useRef(true);
  const documentPagesRef = useRef(documentPages);
  documentPagesRef.current = documentPages;
  const styleRef = useRef(style);
  styleRef.current = style;

  const isEditingTitlesRef = useRef(false);
  const titlesDebounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Keep title/subtitle lines in sync until the user edits the textareas.
  useEffect(() => {
    if (!titlesTouchedRef.current) {
      const existing = getExistingChapterTitleLines(documentPagesRef.current);
      if (existing.length > 0) {
        setTitlesText(existing.join('\n'));
      } else {
        const draft = readChapterTitlesDraft();
        if (draft.touched && draft.titles.length > 0) {
          setTitlesText(draft.titles.join('\n'));
        } else {
          setTitlesText(defaultChapterTitleLines(puzzleDocs.length || 3).join('\n'));
        }
      }
    }
    if (!subtitlesTouchedRef.current) {
      const existingSubs = getExistingChapterSubtitleLines(documentPagesRef.current);
      if (existingSubs.some(Boolean)) {
        setSubtitlesText(existingSubs.join('\n'));
      }
    }
  }, [puzzleDocs.length, chapterCount]);

  useEffect(() => {
    const onDraft = (event: Event) => {
      // If user is actively typing in the textarea, never clobber their typing!
      if (isEditingTitlesRef.current) return;
      const detail = (event as CustomEvent<ChapterTitlesDraft>).detail;
      if (!detail?.titles) return;
      titlesTouchedRef.current = detail.touched;
      setTitlesText((prev) => {
        const currentParsed = parseChapterTitleLines(prev);
        const newParsed = detail.titles;
        const isSame =
          currentParsed.length === newParsed.length &&
          currentParsed.every((t, i) => t === newParsed[i]);
        if (isSame) return prev;
        return detail.titles.join('\n');
      });
    };
    window.addEventListener(CHAPTER_TITLES_DRAFT_EVENT, onDraft as EventListener);
    return () => {
      window.removeEventListener(CHAPTER_TITLES_DRAFT_EVENT, onDraft as EventListener);
      if (titlesDebounceTimerRef.current) {
        clearTimeout(titlesDebounceTimerRef.current);
      }
    };
  }, []);

  const titles = useMemo(
    () =>
      titlesText
        .split('\n')
        .map((line) => line.trimEnd())
        .filter((line) => line.trim().length > 0),
    [titlesText]
  );

  const subtitleLines = useMemo(
    () => subtitlesText.split('\n').map((line) => line.trimEnd()),
    [subtitlesText]
  );

  useEffect(() => {
    setPerChapterImages((prev) => titles.map((_, i) => prev[i]));
  }, [titles.length]);

  const applyStyleToAllChapters = useCallback(
    (nextStyle: ChapterPageStyleSettings) => {
      const pages = documentPagesRef.current;
      if (countChapterTitlePages(pages) === 0) return;
      const updated = applyChapterStyleToAllDocuments(pages, nextStyle, {
        layoutSettings: wordSearchSettings,
      });
      replaceDocumentPages(updated, activeDocumentPageId);
      setStatus(`Updated layout/style on ${countChapterTitlePages(updated)} chapter page(s).`);
    },
    [activeDocumentPageId, replaceDocumentPages, wordSearchSettings]
  );

  const debouncedApplyStyle = useDebouncedCallback(
    (nextStyle: ChapterPageStyleSettings) => {
      applyStyleToAllChapters(nextStyle);
    },
    280
  );

  const updateStyle = useCallback(
    (patch: Partial<ChapterPageStyleSettings>) => {
      const next = normalizeChapterPageStyle({ ...styleRef.current, ...patch });
      setStyle(next);
      if (!skipNextStyleSyncRef.current) {
        debouncedApplyStyle(next);
      }
    },
    [debouncedApplyStyle, setStyle]
  );

  // After hydrate from localStorage, allow live sync (don't rewrite pages on first mount).
  useEffect(() => {
    const t = window.setTimeout(() => {
      skipNextStyleSyncRef.current = false;
    }, 400);
    return () => window.clearTimeout(t);
  }, []);

  const handleCreate = () => {
    const hasSubtitleEdits =
      subtitlesTouchedRef.current || subtitleLines.some((line) => line.trim().length > 0);
    const entries: ChapterBatchEntry[] = titles.map((title, i) => {
      const entry: ChapterBatchEntry = {
        title: title.trim() || `Chapter ${i + 1}: `,
      };
      if (hasSubtitleEdits) {
        const subtitle = subtitleLines[i] ?? '';
        entry.subtitle = subtitle;
        entry.clearSubtitle = !subtitle.trim();
      }
      if (perChapterImages[i]) {
        entry.imageSrc = perChapterImages[i];
      }
      return entry;
    });

    if (entries.length === 0) {
      setStatus('Add at least one chapter title (one per line).');
      return;
    }

    const chapterOptions = {
      sharedBackgroundImage,
      placeImageAsBlock,
      layoutSettings: wordSearchSettings,
      chapterStyle: { ...style, showImage: placeImageAsBlock ? style.showImage : false },
    };

    // Chapters already exist → update titles/style in place (no duplicate pages).
    if (chapterCount > 0) {
      showBusy(`Updating ${entries.length} chapter page${entries.length === 1 ? '' : 's'}…`);
      window.setTimeout(() => {
        try {
          const { documentPages: nextPages, updatedCount, firstPageId } = updateExistingChapterPages(
            documentPages,
            entries,
            chapterOptions
          );

          skipNextStyleSyncRef.current = true;
          replaceDocumentPages(nextPages, firstPageId ?? activeDocumentPageId);
          window.setTimeout(() => {
            skipNextStyleSyncRef.current = false;
          }, 500);

          setStatus(
            `Updated ${updatedCount} chapter title page${updatedCount === 1 ? '' : 's'} (no new pages created).`
          );
        } finally {
          window.setTimeout(() => hideBusy(), 280);
        }
      }, 40);
      return;
    }

    if (puzzleDocs.length === 0) {
      setStatus('Add at least one puzzle document tab first (Word Search, Crossword, …).');
      return;
    }

    showBusy(`Generating ${entries.length} chapter page${entries.length === 1 ? '' : 's'}…`);
    window.setTimeout(() => {
      try {
        const { documentPages: nextPages, firstNewPageId } = buildBatchChapterPages(
          documentPages,
          entries,
          {
            position: 'before-each-puzzle',
            ...chapterOptions,
          }
        );

        // Avoid double-apply from style effect right after create
        skipNextStyleSyncRef.current = true;
        replaceDocumentPages(nextPages, firstNewPageId);
        window.setTimeout(() => {
          skipNextStyleSyncRef.current = false;
        }, 500);

        setStatus(
          `Placed ${Math.min(entries.length, puzzleDocs.length)} chapter page(s) before puzzle documents${
            entries.length > puzzleDocs.length
              ? ` (${entries.length - puzzleDocs.length} extra appended)`
              : ''
          }.`
        );
      } finally {
        window.setTimeout(() => hideBusy(), 280);
      }
    }, 40);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-2">
        <Layers className="w-4 h-4 mt-0.5 text-sky-600 shrink-0" />
        <div>
          <h3 className="font-semibold text-gray-900 dark:text-white">Chapter title</h3>
          <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
            Choose a layout and style once — edits apply to all chapter title pages. First create
            places one chapter before each puzzle; clicking again updates existing chapter titles
            instead of adding duplicates.
          </p>
        </div>
      </div>

      {puzzleDocs.length > 0 && (
        <p className="text-[11px] rounded-md border border-sky-200 bg-sky-50 px-2.5 py-1.5 text-sky-800 dark:border-sky-800 dark:bg-sky-950/40 dark:text-sky-200">
          {puzzleDocs.length} puzzle document{puzzleDocs.length === 1 ? '' : 's'}
          {chapterCount > 0 ? ` · ${chapterCount} chapter page${chapterCount === 1 ? '' : 's'}` : ''}
        </p>
      )}

      <ChapterPuzzleDataEditor
        documentPages={documentPages}
        updateDocumentPage={updateDocumentPage}
        applyWordSearchChapterChanges={applyWordSearchChapterChanges}
      />

      {/* Layout picker — 4 icon presets */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <LayoutTemplate className="w-3.5 h-3.5 text-muted-foreground" />
          <Label className="text-sm font-medium">Chapter title layout</Label>
        </div>
        <div className="grid grid-cols-3 gap-1.5">
          {CHAPTER_LAYOUT_PRESETS.map((preset) => {
            const selected = style.layoutId === preset.id;
            return (
              <button
                key={preset.id}
                type="button"
                onClick={() => updateStyle({ layoutId: preset.id as ChapterLayoutId })}
                className={`flex flex-col items-center justify-center rounded-md border px-1.5 py-2 transition-colors ${
                  selected
                    ? 'border-sky-500 bg-sky-50 ring-1 ring-sky-400 dark:bg-sky-950/50 dark:border-sky-400'
                    : 'border-gray-200 hover:border-gray-300 hover:bg-slate-50 dark:border-slate-700 dark:hover:border-slate-500 dark:hover:bg-slate-900/40'
                }`}
                title={preset.description}
                aria-label={preset.description}
                aria-pressed={selected}
              >
                <ChapterLayoutIcon layoutId={preset.id} />
              </button>
            );
          })}
        </div>
      </div>

      {/* Shared style controls */}
      <div className="space-y-3 p-3 rounded-lg bg-gray-50 dark:bg-slate-900/40 border border-gray-200 dark:border-slate-700">
        <Label className="text-sm font-medium">Shared style (all chapters)</Label>

        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <Label className="text-[10px] text-muted-foreground">Title font</Label>
            <Select
              value={style.titleFontFamily}
              onValueChange={(v) => updateStyle({ titleFontFamily: v })}
            >
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PUBLISHING_FONTS.map((font) => (
                  <SelectItem key={font} value={font} style={{ fontFamily: font }}>
                    {font}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <SliderField
            label="Title Size"
            value={style.titleFontSize}
            onValueChange={(v) => updateStyle({ titleFontSize: v })}
            min={0}
            max={64}
            step={1}
            format="pt"
          />
        </div>

        <MiniColorInput
          label="Title color"
          value={style.titleColor}
          onChange={(v) => updateStyle({ titleColor: v })}
        />
        <div className="space-y-1">
          <Label className="text-[10px] text-muted-foreground">Alignment</Label>
          <Select
            value={style.titleAlignment}
            onValueChange={(v) =>
              updateStyle({ titleAlignment: v as ChapterPageStyleSettings['titleAlignment'] })
            }
          >
            <SelectTrigger className="h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="left">Left</SelectItem>
              <SelectItem value="center">Center</SelectItem>
              <SelectItem value="right">Right</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2">
          <Checkbox
            id="title-bold"
            checked={style.titleBold}
            onCheckedChange={(c) => updateStyle({ titleBold: !!c })}
          />
          <Label htmlFor="title-bold" className="text-xs cursor-pointer">
            Bold titles
          </Label>
        </div>

        <div className="flex items-center gap-2">
          <Checkbox
            id="title-frame"
            checked={style.titleFrameEnabled}
            onCheckedChange={(c) => updateStyle({ titleFrameEnabled: !!c })}
          />
          <Label htmlFor="title-frame" className="text-xs cursor-pointer">
            Title border frame
          </Label>
        </div>

        <div className="border-t border-gray-200 dark:border-slate-700 pt-2 space-y-2">
          <div className="flex items-center gap-2">
            <Checkbox
              id="subtitle-enabled"
              checked={style.subtitleEnabled}
              onCheckedChange={(c) => updateStyle({ subtitleEnabled: !!c })}
            />
            <Label htmlFor="subtitle-enabled" className="text-xs cursor-pointer">
              Show subtitle on all chapters
            </Label>
          </div>
          {style.subtitleEnabled && (
            <>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-[10px] text-muted-foreground">Subtitle font</Label>
                  <Select
                    value={style.subtitleFontFamily}
                    onValueChange={(v) => updateStyle({ subtitleFontFamily: v })}
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PUBLISHING_FONTS.map((font) => (
                        <SelectItem key={font} value={font} style={{ fontFamily: font }}>
                          {font}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <SliderField
                  label="Subtitle Size"
                  value={style.subtitleFontSize}
                  onValueChange={(v) => updateStyle({ subtitleFontSize: v })}
                  min={0}
                  max={36}
                  step={1}
                  format="pt"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <MiniColorInput
                  label="Subtitle color"
                  value={style.subtitleColor}
                  onChange={(v) => updateStyle({ subtitleColor: v })}
                />
                <div className="flex items-center gap-2 pt-1">
                  <Checkbox
                    id="subtitle-frame"
                    checked={style.subtitleFrameEnabled}
                    onCheckedChange={(c) => updateStyle({ subtitleFrameEnabled: !!c })}
                  />
                  <Label htmlFor="subtitle-frame" className="text-xs cursor-pointer">
                    Subtitle frame
                  </Label>
                </div>
              </div>
              <p className="text-[10px] text-muted-foreground">
                Enter one subtitle per chapter in the Chapter subtitles box below.
              </p>
            </>
          )}
        </div>

        {(style.titleFrameEnabled || style.subtitleFrameEnabled) && (
          <div className="border-t border-gray-200 dark:border-slate-700 pt-2 space-y-2">
            <Label className="text-[10px] text-muted-foreground">Frame style</Label>
            <Select
              value={style.frameShape}
              onValueChange={(v) =>
                updateStyle({ frameShape: v as ChapterPageStyleSettings['frameShape'] })
              }
            >
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="rectangle">Rectangle</SelectItem>
                <SelectItem value="rounded">Rounded</SelectItem>
                <SelectItem value="circle">Circle</SelectItem>
                <SelectItem value="pill">Pill</SelectItem>
              </SelectContent>
            </Select>
            <MiniColorInput
              label="Frame border"
              value={style.frameBorderColor}
              onChange={(v) => updateStyle({ frameBorderColor: v })}
            />
            <MiniColorInput
              label="Frame fill"
              value={style.frameFillColor}
              onChange={(v) => updateStyle({ frameFillColor: v })}
            />
            <SliderField
              label="Border Thickness"
              value={style.frameBorderThicknessPx}
              onValueChange={(v) => updateStyle({ frameBorderThicknessPx: v })}
              min={0}
              max={10}
              step={1}
              format="px"
            />
            <SliderField
              label="Corner Radius"
              value={style.frameCornerRadiusPx}
              onValueChange={(v) => updateStyle({ frameCornerRadiusPx: v })}
              min={0}
              max={32}
              step={1}
              format="px"
            />
          </div>
        )}

        <div className="border-t border-gray-200 dark:border-slate-700 pt-2 space-y-2">
          <div className="flex items-center gap-2">
            <Checkbox
              id="show-image"
              checked={style.showImage}
              onCheckedChange={(c) => updateStyle({ showImage: !!c })}
            />
            <Label htmlFor="show-image" className="text-xs cursor-pointer">
              Show chapter images
            </Label>
          </div>
          {style.showImage && (
            <>
              <SliderField
                label="Image Size"
                value={Math.round(style.imageSizeScale * 100)}
                onValueChange={(v) => updateStyle({ imageSizeScale: v / 100 })}
                min={0}
                max={100}
                step={5}
                format="percent"
              />
              <div className="space-y-1">
                <Label className="text-[10px] text-muted-foreground">Image fit</Label>
                <Select
                  value={style.imageFit}
                  onValueChange={(v) =>
                    updateStyle({ imageFit: v as ChapterPageStyleSettings['imageFit'] })
                  }
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cover">Cover</SelectItem>
                    <SelectItem value="contain">Contain</SelectItem>
                    <SelectItem value="stretch">Stretch</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </>
          )}
        </div>

        <MiniColorInput
          label="Page background"
          value={style.pageBackgroundColor}
          onChange={(v) => updateStyle({ pageBackgroundColor: v })}
        />

        {chapterCount > 0 && (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="w-full h-8 text-xs"
            onClick={() => applyStyleToAllChapters(style)}
          >
            Apply style to {chapterCount} chapter page{chapterCount === 1 ? '' : 's'} now
          </Button>
        )}
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <Label className="text-sm font-medium">Chapter titles</Label>
          {suggestedTitles.length > 0 && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 text-[10px]"
              onClick={() => {
                titlesTouchedRef.current = true;
                const next = suggestedTitles.join('\n');
                setTitlesText(next);
                writeChapterTitlesDraft({
                  titles: parseChapterTitleLines(next),
                  touched: true,
                });
              }}
            >
              Use puzzle names
            </Button>
          )}
        </div>
        <Textarea
          value={titlesText}
          onFocus={() => {
            isEditingTitlesRef.current = true;
          }}
          onBlur={(e) => {
            isEditingTitlesRef.current = false;
            if (titlesDebounceTimerRef.current) {
              clearTimeout(titlesDebounceTimerRef.current);
            }
            writeChapterTitlesDraft({
              titles: parseChapterTitleLines(e.target.value),
              touched: true,
            });
          }}
          onChange={(e) => {
            const next = e.target.value;
            titlesTouchedRef.current = true;
            setTitlesText(next);
            if (titlesDebounceTimerRef.current) {
              clearTimeout(titlesDebounceTimerRef.current);
            }
            titlesDebounceTimerRef.current = setTimeout(() => {
              writeChapterTitlesDraft({
                titles: parseChapterTitleLines(next),
                touched: true,
              });
            }, 300);
          }}
          rows={5}
          placeholder={'Chapter 1: Animals\nChapter 2: Nature\nChapter 3: Space'}
          className="font-sans text-sm"
        />
        <p className="text-[10px] text-muted-foreground">
          One title per line. {titles.length} chapter{titles.length === 1 ? '' : 's'}
          {puzzleDocs.length > 0
            ? ` → ${Math.min(titles.length, puzzleDocs.length)} before puzzles`
            : ''}
        </p>
      </div>

      {style.subtitleEnabled && (
        <div className="space-y-2">
          <Label className="text-sm font-medium">Chapter subtitles</Label>
          <Textarea
            value={subtitlesText}
            onChange={(e) => {
              subtitlesTouchedRef.current = true;
              setSubtitlesText(e.target.value);
            }}
            rows={5}
            placeholder={'Find the animals\nExplore the outdoors\nSolve in space'}
            className="font-sans text-sm"
          />
          <p className="text-[10px] text-muted-foreground">
            One subtitle per line, matching chapter title order (line 1 → chapter 1).
          </p>
        </div>
      )}

      <div className="space-y-2 p-3 rounded-lg bg-gray-50 dark:bg-slate-900/40 border border-gray-200 dark:border-slate-700">
        <Label className="text-sm font-medium">Shared page background image (optional)</Label>
        <input
          ref={sharedInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void readFileAsDataUrl(file).then(setSharedBackgroundImage);
            e.target.value = '';
          }}
        />
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => sharedInputRef.current?.click()}
          >
            <Upload className="w-3.5 h-3.5 mr-1.5" />
            {sharedBackgroundImage ? 'Replace image' : 'Upload image'}
          </Button>
          {sharedBackgroundImage && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setSharedBackgroundImage(undefined)}
            >
              <Trash2 className="w-3.5 h-3.5 mr-1" />
              Remove
            </Button>
          )}
        </div>
        {sharedBackgroundImage && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={sharedBackgroundImage}
            alt="Shared background preview"
            className="mt-2 h-16 w-full object-cover rounded border"
          />
        )}
      </div>

      <div className="flex items-center gap-2">
        <Checkbox
          id="place-image-block"
          checked={placeImageAsBlock}
          onCheckedChange={(c) => setPlaceImageAsBlock(!!c)}
        />
        <Label htmlFor="place-image-block" className="text-xs cursor-pointer">
          Place per-chapter images in the layout image slot
        </Label>
      </div>

      {titles.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <Label className="text-sm font-medium">Chapter images</Label>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 text-[10px]"
              onClick={() => multiImageInputRef.current?.click()}
            >
              <Upload className="w-3 h-3 mr-1" />
              Upload multiple
            </Button>
          </div>
          <p className="text-[10px] text-muted-foreground">
            Select several images at once — they are assigned to chapters in order (1st image →
            chapter 1, etc.).
          </p>
          <input
            ref={multiImageInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => {
              const files = Array.from(e.target.files ?? []);
              e.target.value = '';
              if (files.length === 0) return;
              void Promise.all(files.map((file) => readFileAsDataUrl(file))).then((urls) => {
                setPerChapterImages((prev) => {
                  const next = titles.map((_, i) => prev[i]);
                  urls.forEach((url, i) => {
                    if (i < next.length) next[i] = url;
                  });
                  return next;
                });
                setStatus(
                  `Assigned ${Math.min(urls.length, titles.length)} image${
                    Math.min(urls.length, titles.length) === 1 ? '' : 's'
                  } to chapter${titles.length === 1 ? '' : 's'} in order.`
                );
              });
            }}
          />
          <input
            ref={chapterImageInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const idx = chapterImageTargetIndex.current;
              const file = e.target.files?.[0];
              if (idx != null && file) {
                void readFileAsDataUrl(file).then((dataUrl) => {
                  setPerChapterImages((prev) => {
                    const next = [...prev];
                    next[idx] = dataUrl;
                    return next;
                  });
                });
              }
              chapterImageTargetIndex.current = null;
              e.target.value = '';
            }}
          />
          <div className="space-y-2 max-h-56 overflow-y-auto">
            {titles.map((title, index) => (
              <div
                key={`${title}-${index}`}
                className="flex items-center gap-2 rounded border border-gray-200 dark:border-slate-700 px-2 py-1.5"
              >
                {perChapterImages[index] ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={perChapterImages[index]}
                    alt=""
                    className="h-8 w-8 rounded object-cover border shrink-0"
                  />
                ) : (
                  <div className="h-8 w-8 rounded border border-dashed shrink-0 bg-muted/40" />
                )}
                <span className="text-xs flex-1 truncate font-medium">{title}</span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 text-[10px] px-2"
                  onClick={() => {
                    chapterImageTargetIndex.current = index;
                    chapterImageInputRef.current?.click();
                  }}
                >
                  {perChapterImages[index] ? 'Replace' : 'Image'}
                </Button>
                {perChapterImages[index] && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 px-1"
                    onClick={() =>
                      setPerChapterImages((prev) => {
                        const next = [...prev];
                        next[index] = undefined;
                        return next;
                      })
                    }
                  >
                    <Trash2 className="w-3 h-3" />
                  </Button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <Button type="button" className="w-full" onClick={handleCreate}>
        {chapterCount > 0
          ? `Update ${chapterCount} chapter title${chapterCount === 1 ? '' : 's'}`
          : `Place chapters before ${puzzleDocs.length || 0} puzzle doc${
              puzzleDocs.length === 1 ? '' : 's'
            }`}
      </Button>

      {status && <p className="text-xs text-muted-foreground">{status}</p>}
    </div>
  );
}
