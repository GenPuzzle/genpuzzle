'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Slider } from '@/components/ui/slider';
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
import { usePersistedState } from '@/hooks/usePersistedState';
import { useDebouncedCallback } from '@/hooks/useDebouncedCallback';
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

/**
 * Batch-create chapter title pages + shared layout/style editor.
 * Style edits apply to every existing chapter title page.
 */
export function ChapterPagesBatchPanel() {
  const { documentPages, wordSearchSettings, replaceDocumentPages, activeDocumentPageId } =
    useApp();

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
  const titlesTouchedRef = useRef(getExistingChapterTitleLines(documentPages).length > 0);
  const subtitlesTouchedRef = useRef(getExistingChapterSubtitleLines(documentPages).some(Boolean));
  const skipNextStyleSyncRef = useRef(true);
  const documentPagesRef = useRef(documentPages);
  documentPagesRef.current = documentPages;
  const styleRef = useRef(style);
  styleRef.current = style;

  // Keep title/subtitle lines in sync until the user edits the textareas.
  useEffect(() => {
    if (!titlesTouchedRef.current) {
      const existing = getExistingChapterTitleLines(documentPagesRef.current);
      if (existing.length > 0) {
        setTitlesText(existing.join('\n'));
      } else {
        setTitlesText(defaultChapterTitleLines(puzzleDocs.length || 3).join('\n'));
      }
    }
    if (!subtitlesTouchedRef.current) {
      const existingSubs = getExistingChapterSubtitleLines(documentPagesRef.current);
      if (existingSubs.some(Boolean)) {
        setSubtitlesText(existingSubs.join('\n'));
      }
    }
  }, [puzzleDocs.length, chapterCount]);

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
      return;
    }

    if (puzzleDocs.length === 0) {
      setStatus('Add at least one puzzle document tab first (Word Search, Crossword, …).');
      return;
    }

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
          <div className="space-y-1">
            <Label className="text-[10px] text-muted-foreground">
              Title size ({style.titleFontSize}pt)
            </Label>
            <Slider
              value={[style.titleFontSize]}
              min={14}
              max={64}
              step={1}
              onValueChange={([v]) => updateStyle({ titleFontSize: v })}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <Label className="text-[10px] text-muted-foreground">Title color</Label>
            <Input
              type="color"
              value={style.titleColor}
              onChange={(e) => updateStyle({ titleColor: e.target.value })}
              className="h-8 p-1"
            />
          </div>
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
                <div className="space-y-1">
                  <Label className="text-[10px] text-muted-foreground">
                    Size ({style.subtitleFontSize}pt)
                  </Label>
                  <Slider
                    value={[style.subtitleFontSize]}
                    min={10}
                    max={36}
                    step={1}
                    onValueChange={([v]) => updateStyle({ subtitleFontSize: v })}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-[10px] text-muted-foreground">Subtitle color</Label>
                  <Input
                    type="color"
                    value={style.subtitleColor}
                    onChange={(e) => updateStyle({ subtitleColor: e.target.value })}
                    className="h-8 p-1"
                  />
                </div>
                <div className="flex items-center gap-2 pt-4">
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
            <div className="grid grid-cols-2 gap-2">
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
              <div className="flex gap-1">
                <Input
                  type="color"
                  value={style.frameBorderColor}
                  onChange={(e) => updateStyle({ frameBorderColor: e.target.value })}
                  className="h-8 p-1 flex-1"
                  title="Border"
                />
                <Input
                  type="color"
                  value={style.frameFillColor}
                  onChange={(e) => updateStyle({ frameFillColor: e.target.value })}
                  className="h-8 p-1 flex-1"
                  title="Fill"
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] text-muted-foreground">
                Border ({style.frameBorderThicknessPx}px)
              </Label>
              <Slider
                value={[style.frameBorderThicknessPx]}
                min={1}
                max={10}
                step={1}
                onValueChange={([v]) => updateStyle({ frameBorderThicknessPx: v })}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] text-muted-foreground">
                Corner radius ({style.frameCornerRadiusPx}px)
              </Label>
              <Slider
                value={[style.frameCornerRadiusPx]}
                min={0}
                max={32}
                step={1}
                onValueChange={([v]) => updateStyle({ frameCornerRadiusPx: v })}
              />
            </div>
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
              <div className="space-y-1">
                <Label className="text-[10px] text-muted-foreground">
                  Image size in slot ({Math.round(style.imageSizeScale * 100)}%)
                </Label>
                <Slider
                  value={[style.imageSizeScale]}
                  min={0.5}
                  max={1}
                  step={0.05}
                  onValueChange={([v]) => updateStyle({ imageSizeScale: v })}
                />
              </div>
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

        <div className="space-y-1">
          <Label className="text-[10px] text-muted-foreground">Page background</Label>
          <Input
            type="color"
            value={style.pageBackgroundColor}
            onChange={(e) => updateStyle({ pageBackgroundColor: e.target.value })}
            className="h-8 p-1 w-full"
          />
        </div>

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
                setTitlesText(suggestedTitles.join('\n'));
              }}
            >
              Use puzzle names
            </Button>
          )}
        </div>
        <Textarea
          value={titlesText}
          onChange={(e) => {
            titlesTouchedRef.current = true;
            setTitlesText(e.target.value);
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
