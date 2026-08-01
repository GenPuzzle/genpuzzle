'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { ImagePlus, Layers } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AddImageSourceDialog } from '@/components/AddImageSourceDialog';
import type { DocumentPage, TextModuleSettings, TextPageBlock } from '@/lib/document-model';
import type { WordSearchSettings } from '@/lib/puzzles/types';
import { blockDisplayLabel, resolveTextPageBlocks } from '@/lib/text-page-blocks';
import {
  collectSeparatorLayoutUpdates,
  isVariableImageBlock,
  isVariableTextBlock,
  listLayoutSyncPages,
  seedVariationFromBlocks,
  separatorChapterLabel,
  type SeparatorImageVariation,
  type SeparatorPageVariation,
} from '@/lib/separator-layout-sync';
import { loadImageNaturalSize } from '@/lib/text-page-image-layout';

export function SeparatorLayoutSyncPanel({
  activePageId,
  settings,
  pageName,
  globalSettings,
  documentPages,
  onApply,
}: {
  activePageId: string;
  settings: TextModuleSettings;
  pageName: string;
  globalSettings: WordSearchSettings;
  documentPages: DocumentPage[];
  onApply: (updates: Array<{ pageId: string; settings: TextModuleSettings }>) => void;
}) {
  const layoutPages = useMemo(() => listLayoutSyncPages(documentPages), [documentPages]);
  const sourceBlocks = useMemo(
    () => resolveTextPageBlocks(settings, pageName, globalSettings),
    [settings, pageName, globalSettings]
  );
  const textBlocks = useMemo(() => sourceBlocks.filter(isVariableTextBlock), [sourceBlocks]);
  const imageBlocks = useMemo(() => sourceBlocks.filter(isVariableImageBlock), [sourceBlocks]);

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [variationsByPageId, setVariationsByPageId] = useState<
    Record<string, SeparatorPageVariation>
  >({});
  const [activeChapterId, setActiveChapterId] = useState<string>(activePageId);
  const [imageDialogBlockId, setImageDialogBlockId] = useState<string | null>(null);
  const [applyMessage, setApplyMessage] = useState<string | null>(null);

  // Always reflect every layout page in the checklist; auto-select newly added pages.
  useEffect(() => {
    setSelectedIds((prev) => {
      const ids = layoutPages.map((page) => page.id);
      if (ids.length === 0) return [];
      if (prev.length === 0) return ids;
      const kept = prev.filter((id) => ids.includes(id));
      const added = ids.filter((id) => !prev.includes(id));
      const next = [...kept, ...added];
      return next.length > 0 ? next : ids;
    });
  }, [layoutPages]);

  // Seed / refresh variations for selected pages from their current content (or source).
  useEffect(() => {
    setVariationsByPageId((prev) => {
      const next: Record<string, SeparatorPageVariation> = { ...prev };
      for (const page of layoutPages) {
        if (!selectedIds.includes(page.id)) continue;
        const targetSettings = page.settings as TextModuleSettings;
        const seeded = seedVariationFromBlocks(
          sourceBlocks,
          page.id === activePageId ? sourceBlocks : targetSettings.blocks
        );
        const existing = next[page.id];
        if (!existing) {
          next[page.id] = seeded;
          continue;
        }
        next[page.id] = {
          texts: { ...seeded.texts, ...existing.texts },
          images: { ...seeded.images, ...existing.images },
        };
      }
      return next;
    });
  }, [layoutPages, selectedIds, sourceBlocks, activePageId]);

  const selectedOrdered = useMemo(
    () => layoutPages.filter((page) => selectedIds.includes(page.id)),
    [layoutPages, selectedIds]
  );

  useEffect(() => {
    if (selectedOrdered.length === 0) return;
    if (!selectedOrdered.some((page) => page.id === activeChapterId)) {
      setActiveChapterId(selectedOrdered[0].id);
    }
  }, [selectedOrdered, activeChapterId]);

  const activeChapterIndex = selectedOrdered.findIndex((page) => page.id === activeChapterId);
  const activeVariation =
    variationsByPageId[activeChapterId] ?? seedVariationFromBlocks(sourceBlocks, sourceBlocks);

  const togglePage = (pageId: string, checked: boolean) => {
    setSelectedIds((prev) => {
      if (checked) return prev.includes(pageId) ? prev : [...prev, pageId];
      return prev.filter((id) => id !== pageId);
    });
  };

  const selectAll = () => setSelectedIds(layoutPages.map((page) => page.id));
  const selectNone = () => setSelectedIds([activePageId]);

  const updateTextVariation = (blockId: string, text: string) => {
    setVariationsByPageId((prev) => ({
      ...prev,
      [activeChapterId]: {
        texts: {
          ...(prev[activeChapterId]?.texts ?? {}),
          [blockId]: { text, richTextHtml: undefined },
        },
        images: { ...(prev[activeChapterId]?.images ?? {}) },
      },
    }));
  };

  const updateImageVariation = (blockId: string, image: SeparatorImageVariation) => {
    setVariationsByPageId((prev) => ({
      ...prev,
      [activeChapterId]: {
        texts: { ...(prev[activeChapterId]?.texts ?? {}) },
        images: {
          ...(prev[activeChapterId]?.images ?? {}),
          [blockId]: image,
        },
      },
    }));
  };

  const handleImageSelected = async (dataUrl: string) => {
    if (!imageDialogBlockId) return;
    try {
      const { width, height } = await loadImageNaturalSize(dataUrl);
      updateImageVariation(imageDialogBlockId, {
        imageSrc: dataUrl,
        imageNaturalWidth: width,
        imageNaturalHeight: height,
      });
    } catch {
      updateImageVariation(imageDialogBlockId, { imageSrc: dataUrl });
    }
    setImageDialogBlockId(null);
  };

  const handleApply = () => {
    if (selectedOrdered.length === 0) return;
    const liveSourceVariation = seedVariationFromBlocks(sourceBlocks, sourceBlocks);
    const mergedVariations: Record<string, SeparatorPageVariation> = {
      ...variationsByPageId,
      [activePageId]: variationsByPageId[activePageId] ?? liveSourceVariation,
    };

    for (const block of textBlocks) {
      const current = mergedVariations[activePageId]?.texts[block.id];
      if (!current) {
        mergedVariations[activePageId] = {
          texts: {
            ...(mergedVariations[activePageId]?.texts ?? {}),
            [block.id]: { text: block.text, richTextHtml: block.richTextHtml },
          },
          images: { ...(mergedVariations[activePageId]?.images ?? {}) },
        };
      }
    }

    const updates = collectSeparatorLayoutUpdates(
      settings,
      selectedOrdered.map((page) => page.id),
      mergedVariations
    );
    onApply(updates);
    setApplyMessage(
      `Applied layout to ${updates.length} page${updates.length === 1 ? '' : 's'}.`
    );
  };

  if (layoutPages.length === 0) {
    return (
      <p className="text-xs text-muted-foreground p-2">
        No blank / title pages found. Add blank pages with the + between book pages.
      </p>
    );
  }

  return (
    <div className="sep-layout-sync space-y-3 border-t border-slate-200 pt-3 mt-3">
      <div className="canvas-context-panel__section">
        <Label className="canvas-context-panel__section-label flex items-center gap-1.5">
          <Layers className="h-3.5 w-3.5" aria-hidden />
          Apply layout to pages
        </Label>
        <div className="canvas-context-panel__card space-y-2">
          <div className="flex gap-2">
            <Button type="button" size="sm" variant="outline" className="h-7 text-xs" onClick={selectAll}>
              Select all
            </Button>
            <Button type="button" size="sm" variant="outline" className="h-7 text-xs" onClick={selectNone}>
              Only this page
            </Button>
          </div>
          <div className="max-h-40 space-y-1.5 overflow-y-auto pr-1">
            {layoutPages.map((page, index) => {
              const chapter = separatorChapterLabel(index);
              const checked = selectedIds.includes(page.id);
              return (
                <label
                  key={page.id}
                  className="flex items-center gap-2 rounded px-1 py-0.5 text-xs cursor-pointer hover:bg-slate-50"
                >
                  <Checkbox
                    checked={checked}
                    onCheckedChange={(value) => togglePage(page.id, value === true)}
                  />
                  <span className="font-medium text-slate-700">{chapter}</span>
                  <span className="text-slate-400 truncate">{page.name}</span>
                  {page.id === activePageId && (
                    <span className="ml-auto text-[10px] uppercase tracking-wide text-blue-600">
                      Layout
                    </span>
                  )}
                </label>
              );
            })}
          </div>
          {layoutPages.length < 2 && (
            <p className="text-[11px] text-amber-700 leading-snug">
              Only one separate blank page exists. Add more with the blue <strong>+</strong>{' '}
              between pages in All Pages preview, then select them here.
            </p>
          )}
          <p className="text-[11px] text-muted-foreground leading-snug">
            Checked separate pages get this layout. Use Chapter tabs for different text/images on
            each page.
          </p>
        </div>
      </div>

      {selectedOrdered.length > 0 && (
        <div className="canvas-context-panel__section">
          <Label className="canvas-context-panel__section-label">Content variations</Label>
          <div className="canvas-context-panel__card space-y-3">
            <div className="flex flex-wrap gap-1">
              {selectedOrdered.map((page, index) => {
                const chapterIndex = layoutPages.findIndex((entry) => entry.id === page.id);
                const label = separatorChapterLabel(chapterIndex >= 0 ? chapterIndex : index);
                const isActive = page.id === activeChapterId;
                return (
                  <button
                    key={page.id}
                    type="button"
                    className={`rounded-md border px-2 py-1 text-[11px] font-semibold transition-colors ${
                      isActive
                        ? 'border-blue-400 bg-blue-50 text-blue-700'
                        : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                    }`}
                    onClick={() => setActiveChapterId(page.id)}
                  >
                    {label}
                  </button>
                );
              })}
            </div>

            {activeChapterIndex >= 0 && (
              <p className="text-[11px] text-slate-500">
                Editing{' '}
                {separatorChapterLabel(
                  layoutPages.findIndex((page) => page.id === activeChapterId)
                )}{' '}
                · {selectedOrdered[activeChapterIndex]?.name}
              </p>
            )}

            {textBlocks.length === 0 && imageBlocks.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                Add a text box or image on this layout page first, then set variations per chapter.
              </p>
            ) : (
              <div className="space-y-3">
                {textBlocks.map((block) => (
                  <TextVariationField
                    key={block.id}
                    block={block}
                    value={activeVariation.texts[block.id]?.text ?? block.text}
                    onChange={(value) => updateTextVariation(block.id, value)}
                  />
                ))}

                {imageBlocks.map((block) => {
                  const imageSrc = activeVariation.images[block.id]?.imageSrc ?? block.imageSrc;
                  return (
                    <div key={block.id} className="space-y-1.5">
                      <Label className="text-xs text-gray-500">
                        {blockDisplayLabel(block)} image
                      </Label>
                      {imageSrc ? (
                        <div className="relative overflow-hidden rounded border border-slate-200 bg-slate-50">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={imageSrc}
                            alt=""
                            className="mx-auto max-h-24 object-contain"
                          />
                        </div>
                      ) : (
                        <div className="rounded border border-dashed border-slate-300 px-2 py-3 text-center text-[11px] text-slate-400">
                          No image for this chapter
                        </div>
                      )}
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-7 w-full text-xs"
                        onClick={() => setImageDialogBlockId(block.id)}
                      >
                        <ImagePlus className="mr-1 h-3.5 w-3.5" />
                        {imageSrc ? 'Change image' : 'Add image'}
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      <div className="canvas-context-panel__section space-y-2">
        <Button
          type="button"
          className="w-full"
          disabled={selectedOrdered.length === 0}
          onClick={handleApply}
        >
          Apply layout to {selectedOrdered.length} page{selectedOrdered.length === 1 ? '' : 's'}
        </Button>
        {applyMessage && (
          <p className="text-[11px] text-emerald-700 text-center">{applyMessage}</p>
        )}
      </div>

      <AddImageSourceDialog
        open={imageDialogBlockId !== null}
        onOpenChange={(open) => {
          if (!open) setImageDialogBlockId(null);
        }}
        onImageSelected={handleImageSelected}
      />
    </div>
  );
}

function TextVariationField({
  block,
  value,
  onChange,
}: {
  block: TextPageBlock;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="space-y-1">
      <Label className="text-xs text-gray-500">{blockDisplayLabel(block)}</Label>
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={block.text || 'Enter text for this chapter'}
        className="h-8 text-xs"
      />
    </div>
  );
}
