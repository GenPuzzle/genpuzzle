'use client';

import React, { useMemo, useState } from 'react';
import { EyeOff, Eye, Trash2, Plus } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { SliderField } from '@/components/ui/slider-field';
import { Button } from '@/components/ui/button';
import { FloatingPanelShell } from '@/components/FloatingPanelShell';
import { TocFormIcon } from '@/components/TocFormIcon';
import { PUBLISHING_FONTS } from '@/lib/publishing-fonts';
import type { DocumentPage, TextModuleSettings, PuzzleModuleSettings } from '@/lib/document-model';
import type { WordSearchSettings } from '@/lib/puzzles/types';
import {
  getDocumentsAfterToc,
  getTitlePagesAfterToc,
  isDocumentListedInToc,
  type ResolvedTocEntry,
} from '@/lib/book-compiler';
import {
  applyTocTableForm,
  ensureTocChapters,
  normalizeTocSettings,
  TOC_TABLE_FORMS,
  type TocColumnLayout,
  type TocEntryScope,
  type TocTableFormat,
} from '@/lib/toc-settings';
import { tocEntryOverrideKey } from '@/lib/toc-layout';
import { resolveTextPageTextColor } from '@/lib/text-page-settings';
import { isSeparatorTitlePage } from '@/lib/insert-separator-page';
import './canvas-contextual-controls.css';

type TocPanelTab = 'page' | 'content' | 'layout' | 'type' | 'advanced';

function resolveCandidateLabel(doc: DocumentPage): string {
  if (doc.moduleType === 'word-search') {
    const settings = doc.settings as PuzzleModuleSettings;
    return settings.titleWords?.title?.trim() || settings.title?.trim() || doc.name;
  }
  if (doc.moduleType === 'table-of-contents') return doc.name;
  const settings = doc.settings as TextModuleSettings;
  return settings.title?.trim() || doc.name;
}

export function TocContextualControls({
  pageName,
  settings,
  globalSettings,
  documentPages = [],
  tocEntries = [],
  onSettingsChange,
  onClose,
}: {
  pageName: string;
  settings: TextModuleSettings;
  globalSettings: WordSearchSettings;
  documentPages?: DocumentPage[];
  /** Current compiled TOC entries (for title / page-number editors) */
  tocEntries?: ResolvedTocEntry[];
  onSettingsChange: (updates: Partial<TextModuleSettings>) => void;
  onClose: () => void;
}) {
  const toc = normalizeTocSettings(settings.tocSettings);
  const defaultColor = resolveTextPageTextColor(settings, globalSettings);
  const [activeTab, setActiveTab] = useState<TocPanelTab>('layout');

  const updateToc = (patch: Partial<typeof toc>) => {
    onSettingsChange({
      tocSettings: normalizeTocSettings({ ...toc, ...patch }),
    });
  };

  const setEntryTitleOverride = (entry: ResolvedTocEntry, title: string) => {
    const key = tocEntryOverrideKey(entry);
    onSettingsChange({
      tocEntryOverrides: {
        ...(settings.tocEntryOverrides ?? {}),
        [key]: title,
      },
    });
  };

  const setEntryPageOverride = (entry: ResolvedTocEntry, pageNumber: string) => {
    const key = tocEntryOverrideKey(entry);
    const next = { ...(settings.tocPageNumberOverrides ?? {}) };
    if (!pageNumber.trim()) {
      delete next[key];
    } else {
      next[key] = pageNumber.trim();
    }
    onSettingsChange({ tocPageNumberOverrides: next });
  };

  const pagesAfterToc = useMemo(() => getDocumentsAfterToc(documentPages), [documentPages]);
  const titlePagesAfterToc = useMemo(() => getTitlePagesAfterToc(documentPages), [documentPages]);

  const candidates = useMemo(() => {
    return pagesAfterToc
      .filter((doc) => doc.moduleType !== 'table-of-contents')
      .map((doc) => ({
        id: doc.id,
        label: resolveCandidateLabel(doc),
        kind: doc.moduleType,
        isTitlePage: doc.moduleType === 'title-page',
        isSeparator: isSeparatorTitlePage(doc),
      }));
  }, [pagesAfterToc]);

  const excludedSet = useMemo(() => new Set(toc.excludedDocumentIds), [toc.excludedDocumentIds]);
  const revealedSet = useMemo(() => new Set(toc.revealedDocumentIds), [toc.revealedDocumentIds]);

  const toggleExcluded = (docId: string, currentlyListed: boolean) => {
    // currentlyListed → hide; not listed → show
    if (currentlyListed) {
      updateToc({
        excludedDocumentIds: Array.from(new Set([...toc.excludedDocumentIds, docId])),
        revealedDocumentIds: toc.revealedDocumentIds.filter((id) => id !== docId),
      });
      return;
    }
    updateToc({
      excludedDocumentIds: toc.excludedDocumentIds.filter((id) => id !== docId),
      revealedDocumentIds: Array.from(new Set([...toc.revealedDocumentIds, docId])),
    });
  };

  const addCustomEntry = () => {
    updateToc({
      customEntries: [
        ...toc.customEntries,
        {
          id: `custom-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
          title: 'Custom title',
          pageNumber: '',
        },
      ],
    });
  };

  const updateCustomEntry = (
    id: string,
    patch: Partial<{ title: string; pageNumber: string }>
  ) => {
    updateToc({
      customEntries: toc.customEntries.map((entry) =>
        entry.id === id ? { ...entry, ...patch } : entry
      ),
    });
  };

  const removeCustomEntry = (id: string) => {
    updateToc({
      customEntries: toc.customEntries.filter((entry) => entry.id !== id),
    });
  };

  const setEntryScope = (value: TocEntryScope) => {
    if (value === 'chapters') {
      const pages = getTitlePagesAfterToc(documentPages);
      const count = Math.max(1, pages.length);
      const chapters = ensureTocChapters(
        pages.map((doc, i) => ({
          id: toc.chapters[i]?.id || `chapter-${doc.id}`,
          title: toc.chapters[i]?.title?.trim() || resolveCandidateLabel(doc),
        })),
        count
      );
      updateToc({ entryScope: 'chapters', chapterCount: count, chapters });
      return;
    }
    updateToc({ entryScope: 'all' });
  };

  const updateChapterTitle = (index: number, title: string) => {
    const count = Math.max(toc.chapters.length, titlePagesAfterToc.length, 1);
    const chapters = ensureTocChapters(toc.chapters, count).map((ch, i) =>
      i === index ? { ...ch, title } : ch
    );
    updateToc({ chapterCount: count, chapters });
  };

  const headingFont = toc.titleFontFamily || settings.fontFamily || 'Arial';
  const entryFont = toc.entryFontFamily || settings.fontFamily || 'Arial';

  return (
    <FloatingPanelShell
      title={`${pageName} — Table of Contents`}
      onClose={onClose}
      tabs={[
        { id: 'page', label: 'Page' },
        { id: 'content', label: 'Content' },
        { id: 'layout', label: 'Layout' },
        { id: 'type', label: 'Fonts' },
        { id: 'advanced', label: 'Advanced' },
      ]}
      activeTabId={activeTab}
      onTabSelect={(id) => setActiveTab(id as TocPanelTab)}
      onTabClose={() => {}}
    >
      <div className="space-y-3 p-3 max-h-[70vh] overflow-y-auto">
        {activeTab === 'page' && (
          <div className="canvas-context-panel__section">
            <Label className="canvas-context-panel__section-label">Page</Label>
            <div className="canvas-context-panel__card space-y-3">
              <div className="space-y-1">
                <Label className="text-xs text-slate-500">Page Title</Label>
                <Input
                  value={settings.title}
                  onChange={(e) => onSettingsChange({ title: e.target.value })}
                  className="h-8 text-xs"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-slate-500">TOC Mode</Label>
                <Select
                  value={settings.tocMode ?? 'auto'}
                  onValueChange={(value) =>
                    onSettingsChange({ tocMode: value as 'auto' | 'manual' })
                  }
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="auto">Auto (from documents)</SelectItem>
                    <SelectItem value="manual">Manual</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-slate-500">Alignment</Label>
                <Select
                  value={settings.alignment}
                  onValueChange={(value) =>
                    onSettingsChange({ alignment: value as 'left' | 'center' | 'right' })
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
              <p className="text-[10px] text-muted-foreground">
                Pages before the Table of Contents are never listed. Footer page numbers are never
                printed on TOC pages.
              </p>
            </div>
          </div>
        )}

        {activeTab === 'content' && (
          <>
            <div className="canvas-context-panel__section">
              <Label className="canvas-context-panel__section-label">Entries</Label>
              <div className="canvas-context-panel__card space-y-3">
                <div className="space-y-1">
                  <Label className="text-xs text-slate-500">Show in TOC</Label>
                  <Select
                    value={toc.entryScope}
                    onValueChange={(value) => setEntryScope(value as TocEntryScope)}
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All pages (after TOC)</SelectItem>
                      <SelectItem value="chapters">Chapters only (title / sep pages)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {toc.entryScope === 'all' && (
                  <>
                    <label className="flex items-start gap-2 text-xs cursor-pointer">
                      <Checkbox
                        checked={toc.includePuzzlePages}
                        onCheckedChange={(c) => updateToc({ includePuzzlePages: c === true })}
                        className="mt-0.5"
                      />
                      <span>Always list every puzzle page (even with the same title)</span>
                    </label>
                    <label className="flex items-start gap-2 text-xs cursor-pointer">
                      <Checkbox
                        checked={toc.includeSolutionPages}
                        onCheckedChange={(c) => updateToc({ includeSolutionPages: c === true })}
                        className="mt-0.5"
                      />
                      <span>Include solution page</span>
                    </label>
                    <label className="flex items-start gap-2 text-xs cursor-pointer">
                      <Checkbox
                        checked={toc.hideDocuments}
                        onCheckedChange={(c) => updateToc({ hideDocuments: c === true })}
                        className="mt-0.5"
                      />
                      <span>Hide documents on TOC by default</span>
                    </label>
                    <label className="flex items-start gap-2 text-xs cursor-pointer">
                      <Checkbox
                        checked={toc.hidePuzzleDocuments}
                        onCheckedChange={(c) => updateToc({ hidePuzzleDocuments: c === true })}
                        className="mt-0.5"
                      />
                      <span>Hide puzzle documents on TOC by default</span>
                    </label>
                  </>
                )}

                {toc.entryScope === 'chapters' && (
                  <p className="text-[10px] text-muted-foreground">
                    Lists every title page and separator after the Table of Contents (
                    {titlePagesAfterToc.length} found).
                  </p>
                )}
              </div>
            </div>

            {toc.entryScope === 'chapters' && (
              <div className="canvas-context-panel__section">
                <Label className="canvas-context-panel__section-label">Chapter Titles</Label>
                <div className="canvas-context-panel__card space-y-3">
                  {titlePagesAfterToc.length === 0 ? (
                    <p className="text-xs text-slate-400">
                      Add title or separator pages after the Table of Contents to create chapters.
                    </p>
                  ) : (
                    <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                      {titlePagesAfterToc.map((doc, index) => (
                        <div key={doc.id} className="space-y-1">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-[10px] font-semibold text-slate-400">
                              Chapter {index + 1}
                            </span>
                            <span className="text-[10px] text-slate-400 truncate">
                              {isSeparatorTitlePage(doc) ? 'Separator' : 'Title page'} · {doc.name}
                            </span>
                          </div>
                          <Input
                            value={toc.chapters[index]?.title ?? resolveCandidateLabel(doc)}
                            onChange={(e) => updateChapterTitle(index, e.target.value)}
                            className="h-8 text-xs"
                            placeholder={resolveCandidateLabel(doc)}
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="canvas-context-panel__section">
              <Label className="canvas-context-panel__section-label">Remove from TOC</Label>
              <div className="canvas-context-panel__card space-y-2">
                <p className="text-[10px] text-muted-foreground">
                  Documents and puzzle documents are hidden by default. Use the eye to show or hide
                  each page after the Table of Contents.
                </p>
                {candidates.length === 0 ? (
                  <p className="text-xs text-slate-400">No pages after the Table of Contents yet.</p>
                ) : (
                  <div className="space-y-1.5 max-h-52 overflow-y-auto pr-1">
                    {candidates.map((item) => {
                      const listed = isDocumentListedInToc(item.id, documentPages, toc);
                      return (
                        <div
                          key={item.id}
                          className="flex items-center gap-2 rounded-md border border-slate-100 px-2 py-1.5"
                        >
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-medium text-slate-800 truncate">{item.label}</p>
                            <p className="text-[10px] text-slate-400 capitalize">
                              {item.isSeparator
                                ? 'separator'
                                : item.isTitlePage
                                  ? 'title page'
                                  : item.kind.replace(/-/g, ' ')}
                            </p>
                          </div>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            className="h-7 w-7 p-0 shrink-0"
                            title={listed ? 'Remove from TOC' : 'Include in TOC'}
                            onClick={() => toggleExcluded(item.id, listed)}
                          >
                            {listed ? (
                              <Eye className="h-3.5 w-3.5 text-slate-500" />
                            ) : (
                              <EyeOff className="h-3.5 w-3.5 text-amber-600" />
                            )}
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                )}
                {(excludedSet.size > 0 || revealedSet.size > 0) && (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-7 text-[11px] w-full"
                    onClick={() =>
                      updateToc({ excludedDocumentIds: [], revealedDocumentIds: [] })
                    }
                  >
                    <Trash2 className="h-3 w-3 mr-1" />
                    Reset visibility to defaults
                  </Button>
                )}
              </div>
            </div>

            <div className="canvas-context-panel__section">
              <div className="flex items-center justify-between gap-2 mb-1">
                <Label className="canvas-context-panel__section-label !mb-0">
                  Titles &amp; page numbers
                </Label>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-7 px-2 text-[11px]"
                  onClick={addCustomEntry}
                  title="Add custom title and page number"
                >
                  <Plus className="h-3.5 w-3.5 mr-0.5" />
                  Add
                </Button>
              </div>
              <div className="canvas-context-panel__card space-y-2">
                <p className="text-[10px] text-muted-foreground">
                  Edit how each line appears in the table. Leave page blank to use the auto page
                  number. Use + to add a custom line.
                </p>
                {toc.customEntries.length > 0 && (
                  <div className="space-y-2 border-b border-slate-100 pb-2 mb-1">
                    {toc.customEntries.map((entry) => (
                      <div
                        key={entry.id}
                        className="grid grid-cols-[1fr_52px_28px] gap-1.5 items-start"
                      >
                        <Input
                          value={entry.title}
                          onChange={(e) => updateCustomEntry(entry.id, { title: e.target.value })}
                          className="h-8 text-xs"
                          placeholder="Custom title"
                        />
                        <Input
                          value={entry.pageNumber}
                          onChange={(e) =>
                            updateCustomEntry(entry.id, { pageNumber: e.target.value })
                          }
                          className="h-8 text-xs text-center tabular-nums"
                          placeholder="#"
                          title="Page number"
                        />
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          className="h-8 w-7 p-0"
                          title="Remove custom line"
                          onClick={() => removeCustomEntry(entry.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5 text-slate-400" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
                {tocEntries.length === 0 && toc.customEntries.length === 0 ? (
                  <p className="text-xs text-slate-400">
                    No TOC entries yet. Add documents after the Table of Contents, reveal pages with
                    the eye icons, or add a custom line.
                  </p>
                ) : (
                  <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                    {tocEntries
                      .filter((entry) => !entry.documentId.startsWith('custom:'))
                      .map((entry) => {
                      const key = tocEntryOverrideKey(entry);
                      const titleValue =
                        settings.tocEntryOverrides?.[key] ?? entry.title;
                      const pageValue =
                        settings.tocPageNumberOverrides?.[key] ?? entry.pageNumber ?? '';
                      return (
                        <div
                          key={key}
                          className="grid grid-cols-[1fr_52px] gap-1.5 items-start"
                        >
                          <Input
                            value={titleValue}
                            onChange={(e) => setEntryTitleOverride(entry, e.target.value)}
                            className="h-8 text-xs"
                            placeholder="Entry title"
                          />
                          <Input
                            value={pageValue}
                            onChange={(e) => setEntryPageOverride(entry, e.target.value)}
                            className="h-8 text-xs text-center tabular-nums"
                            placeholder="#"
                            title="Page number"
                          />
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </>
        )}

        {activeTab === 'layout' && (
          <>
            <div className="canvas-context-panel__section">
              <Label className="canvas-context-panel__section-label">Table form</Label>
              <div className="canvas-context-panel__card space-y-2">
                <p className="text-[10px] text-muted-foreground">
                  Three common book table-of-contents styles.
                </p>
                <div className="grid grid-cols-3 gap-1.5">
                  {TOC_TABLE_FORMS.map((form) => {
                    const selected = toc.tableFormat === form.id;
                    return (
                      <button
                        key={form.id}
                        type="button"
                        title={form.description}
                        aria-label={form.description}
                        aria-pressed={selected}
                        onClick={() =>
                          onSettingsChange({
                            tocSettings: applyTocTableForm(toc, form.id as TocTableFormat),
                          })
                        }
                        className={`flex flex-col items-center gap-1 rounded-md border px-1 py-2 transition-colors ${
                          selected
                            ? 'border-sky-500 bg-sky-50 ring-1 ring-sky-400 dark:bg-sky-950/50 dark:border-sky-400'
                            : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700'
                        }`}
                      >
                        <TocFormIcon formId={form.id} />
                        <span className="text-[10px] font-semibold text-slate-700 dark:text-slate-200">
                          {form.name}
                        </span>
                      </button>
                    );
                  })}
                </div>
                <label className="flex items-center gap-2 text-xs cursor-pointer pt-1">
                  <Checkbox
                    checked={toc.showPageNumbers}
                    onCheckedChange={(c) => updateToc({ showPageNumbers: c === true })}
                  />
                  Show page numbers
                </label>
              </div>
            </div>

            <div className="canvas-context-panel__section">
              <Label className="canvas-context-panel__section-label">Columns</Label>
              <div className="canvas-context-panel__card space-y-3">
                <div className="grid grid-cols-2 gap-1.5">
                  {(
                    [
                      { id: 'one' as const, label: '1 column' },
                      { id: 'two' as const, label: '2 columns' },
                    ] as const
                  ).map((opt) => {
                    const selected = toc.columnLayout === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => updateToc({ columnLayout: opt.id as TocColumnLayout })}
                        className={`rounded-md border px-2 py-2 text-[11px] font-semibold transition-colors ${
                          selected
                            ? 'border-sky-500 bg-sky-50 ring-1 ring-sky-400 dark:bg-sky-950/50'
                            : 'border-slate-200 hover:bg-slate-50 dark:border-slate-700'
                        }`}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
                {toc.columnLayout === 'two' && (
                  <SliderField
                    label="Column Gap"
                    value={toc.columnGapPx}
                    onValueChange={(v) => updateToc({ columnGapPx: v })}
                    min={8}
                    max={48}
                    step={1}
                    format="px"
                  />
                )}
              </div>
            </div>

            <div className="canvas-context-panel__section">
              <Label className="canvas-context-panel__section-label">TOC pages</Label>
              <div className="canvas-context-panel__card space-y-3">
                <SliderField
                  label="Number of TOC pages"
                  value={toc.targetPageCount}
                  onValueChange={(v) => updateToc({ targetPageCount: v, pageCountMode: 'fixed' })}
                  min={1}
                  max={8}
                  step={1}
                />
                <label className="flex items-start gap-2 text-xs cursor-pointer">
                  <Checkbox
                    checked={toc.autoFitText}
                    onCheckedChange={(c) => updateToc({ autoFitText: c === true })}
                    className="mt-0.5"
                  />
                  <span>
                    Auto-resize text to fit these pages and columns (no overlapping titles)
                  </span>
                </label>
                <p className="text-[10px] text-muted-foreground leading-snug">
                  Entries are split evenly across {toc.targetPageCount} page
                  {toc.targetPageCount === 1 ? '' : 's'}
                  {toc.columnLayout === 'two' ? ' with 2 columns' : ' in 1 column'}
                  {toc.autoFitText ? '. Font size and line spacing adjust automatically.' : '.'}
                </p>
              </div>
            </div>

            <div className="canvas-context-panel__section">
              <Label className="canvas-context-panel__section-label">Spacing</Label>
              <div className="canvas-context-panel__card space-y-3">
                <SliderField
                  label="Space between lines"
                  value={toc.lineSpacingPx ?? 10}
                  onValueChange={(v) => updateToc({ lineSpacingPx: v })}
                  min={0}
                  max={28}
                  step={1}
                  format="px"
                />
                <SliderField
                  label="Space below heading"
                  value={toc.titleBottomGapPx}
                  onValueChange={(v) => updateToc({ titleBottomGapPx: v })}
                  min={0}
                  max={48}
                  step={1}
                  format="px"
                />
              </div>
            </div>
          </>
        )}

        {activeTab === 'type' && (
          <div className="canvas-context-panel__section">
            <Label className="canvas-context-panel__section-label">Fonts & Colors</Label>
            <div className="canvas-context-panel__card space-y-3">
              <div className="space-y-1">
                <Label className="text-xs text-slate-500">Heading Font</Label>
                <Select
                  value={headingFont}
                  onValueChange={(value) => updateToc({ titleFontFamily: value })}
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
                <Label className="text-xs text-slate-500">Entry Font</Label>
                <Select
                  value={entryFont}
                  onValueChange={(value) => updateToc({ entryFontFamily: value })}
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
              <label className="flex items-center gap-2 text-xs cursor-pointer">
                <Checkbox
                  checked={toc.titleFontWeight !== false}
                  onCheckedChange={(c) => updateToc({ titleFontWeight: c === true })}
                />
                Bold heading
              </label>
              <label className="flex items-center gap-2 text-xs cursor-pointer">
                <Checkbox
                  checked={!!toc.entryFontWeight}
                  onCheckedChange={(c) => updateToc({ entryFontWeight: c === true })}
                />
                Bold entries
              </label>
              <SliderField
                label="Heading Font Size"
                value={toc.titleFontSize ?? settings.titleFontSize ?? Math.round(settings.fontSize * 1.2)}
                onValueChange={(v) => updateToc({ titleFontSize: v })}
                min={12}
                max={48}
                step={1}
              />
              <SliderField
                label="Entry Font Size"
                value={toc.entryFontSize ?? settings.fontSize}
                onValueChange={(v) => updateToc({ entryFontSize: v })}
                min={10}
                max={36}
                step={1}
              />
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs text-slate-500">Heading Color</Label>
                  <input
                    type="color"
                    value={toc.titleTextColor ?? defaultColor}
                    onChange={(e) => updateToc({ titleTextColor: e.target.value })}
                    className="h-8 w-full cursor-pointer rounded border border-slate-200"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-slate-500">Entry Color</Label>
                  <input
                    type="color"
                    value={toc.entryTextColor ?? defaultColor}
                    onChange={(e) => updateToc({ entryTextColor: e.target.value })}
                    className="h-8 w-full cursor-pointer rounded border border-slate-200"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'advanced' && (
          <div className="canvas-context-panel__section">
            <Label className="canvas-context-panel__section-label">Spacing & Advanced</Label>
            <div className="canvas-context-panel__card space-y-3">
              <SliderField
                label="Space Below Title"
                value={toc.titleBottomGapPx}
                onValueChange={(v) => updateToc({ titleBottomGapPx: v })}
                min={0}
                max={64}
                step={1}
                format="px"
              />
              <SliderField
                label="Entries Top Gap"
                value={toc.entriesTopGapPx}
                onValueChange={(v) => updateToc({ entriesTopGapPx: v })}
                min={0}
                max={64}
                step={1}
                format="px"
              />
              <SliderField
                label="Line Spacing"
                value={toc.lineSpacingPx ?? 8}
                onValueChange={(v) => updateToc({ lineSpacingPx: v })}
                min={0}
                max={40}
                step={1}
                format="px"
              />
              <SliderField
                label="Title ↔ Number Gap"
                value={toc.entryHorizontalGapPx}
                onValueChange={(v) => updateToc({ entryHorizontalGapPx: v })}
                min={0}
                max={24}
                step={1}
                format="px"
              />
              <SliderField
                label="Sub-entry Indent"
                value={toc.entryIndentPx}
                onValueChange={(v) => updateToc({ entryIndentPx: v })}
                min={0}
                max={48}
                step={1}
                format="px"
              />
              <SliderField
                label="Letter Spacing"
                value={toc.entryLetterSpacingPx}
                onValueChange={(v) => updateToc({ entryLetterSpacingPx: v })}
                min={-1}
                max={4}
                step={0.5}
                format="px"
              />
              <p className="text-[10px] text-muted-foreground pt-1 border-t border-slate-100">
                Footer page numbers are always disabled on Table of Contents pages (preview, PDF, and
                PPT).
              </p>
            </div>
          </div>
        )}
      </div>
    </FloatingPanelShell>
  );
}
