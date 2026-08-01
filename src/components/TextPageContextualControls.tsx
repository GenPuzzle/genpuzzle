'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Bold,
  ImagePlus,
  Italic,
  Plus,
  Trash2,
  Type,
  Underline,
  Upload,
} from 'lucide-react';
import { PUBLISHING_FONTS } from '@/lib/publishing-fonts';
import { SliderField } from '@/components/ui/slider-field';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { FloatingPanelShell } from '@/components/FloatingPanelShell';
import { AddImageSourceDialog } from '@/components/AddImageSourceDialog';
import { SeparatorLayoutSyncPanel } from '@/components/SeparatorLayoutSyncPanel';
import { ChapterCanvasApplyPanel } from '@/components/ChapterCanvasApplyPanel';
import type { DocumentPage, TextModuleSettings, TextPageBlock, OwnershipNameLineType } from '@/lib/document-model';
import type { WordSearchSettings } from '@/lib/puzzles/types';
import { isChapterTitlePage, isSeparatorTitlePage } from '@/lib/insert-separator-page';
import { countChapterTitlePages } from '@/lib/chapter-page-layouts';
import { collectChapterLayoutStyleUpdates } from '@/lib/chapter-layout-sync';
import {
  addTextPageBlock,
  applyPageHorizontalAlign,
  blockDisplayLabel,
  createAdditionalTextBlock,
  createBlockForKind,
  findTextPageBlockByKind,
  getPageHorizontalAlign,
  normalizeTextPageBlock,
  removeTextPageBlock,
  resolveOwnershipNameLineType,
  resolveTextPageBlocks,
  toggleTextPageBlockKind,
  updateTextPageBlock,
} from '@/lib/text-page-blocks';
import {
  resolveTextPageBackground,
  resolveTextPageFrameSettings,
  resolveReadableTextPageColor,
} from '@/lib/text-page-settings';
import {
  fitImageBlockToNaturalSize,
  getPageContentAspectRatio,
  loadImageNaturalSize,
} from '@/lib/text-page-image-layout';
import { ImageBlockControls } from '@/components/ImageBlockControls';
import { resolvePageFrameSettings } from '@/lib/page-frame-settings';
import {
  applyRichTextFormatToBlock,
  flattenTextBlockEditorContent,
  isEntireTextBlockSelected,
  isTextBlockKind,
  notifyTextBlockSelectionChange,
  readSelectionFormat,
  syncRichTextBlockFromDom,
  TEXT_BLOCK_SELECTION_EVENT,
  textSelectionFormatsEqual,
  type TextSelectionFormat,
} from '@/lib/text-page-rich-text';
import { cn } from '@/lib/utils';
import './canvas-contextual-controls.css';

export type TextPageEditTarget = 'page-elements' | 'page-frame';

const WORD_FONT_SIZES = [8, 9, 10, 11, 12, 14, 16, 18, 20, 24, 28, 32, 36, 48, 50, 72];

const PAGE_ALIGN_OPTIONS: Array<{
  value: 'left' | 'center' | 'right';
  label: string;
  title: string;
  icon: React.ReactNode;
}> = [
  {
    value: 'left',
    label: 'Left',
    title: 'Align box to left of page',
    icon: <AlignLeft className="h-3.5 w-3.5" />,
  },
  {
    value: 'center',
    label: 'Center',
    title: 'Align box to center of page',
    icon: <AlignCenter className="h-3.5 w-3.5" />,
  },
  {
    value: 'right',
    label: 'Right',
    title: 'Align box to right of page',
    icon: <AlignRight className="h-3.5 w-3.5" />,
  },
];

function MiniColorInput({
  label,
  value,
  onChange,
  disabled = false,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  return (
    <div className={cn('flex items-center justify-between gap-2', disabled && 'opacity-50 pointer-events-none')}>
      <Label className="text-xs text-gray-500 shrink-0">{label}</Label>
      <input
        type="color"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className="h-7 w-10 cursor-pointer rounded border border-gray-200 disabled:cursor-default"
      />
    </div>
  );
}

function BackgroundImageControl({
  image,
  opacity,
  fit,
  onImageChange,
  onOpacityChange,
  onFitChange,
  onRemove,
  showFit = true,
  disabled = false,
}: {
  image?: string;
  opacity?: number;
  fit?: 'cover' | 'contain' | 'stretch';
  onImageChange: (base64: string) => void;
  onOpacityChange: (value: number) => void;
  onFitChange?: (value: 'cover' | 'contain' | 'stretch') => void;
  onRemove: () => void;
  showFit?: boolean;
  disabled?: boolean;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  return (
    <div className={cn('space-y-2', disabled && 'opacity-50 pointer-events-none')}>
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-7 text-xs"
          onClick={() => fileInputRef.current?.click()}
        >
          <Upload className="h-3 w-3 mr-1" />
          Upload image
        </Button>
        {image && (
          <Button type="button" variant="ghost" size="sm" className="h-7 text-xs text-red-600" onClick={onRemove}>
            <Trash2 className="h-3 w-3 mr-1" />
            Remove
          </Button>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = () => {
              if (typeof reader.result === 'string') onImageChange(reader.result);
            };
            reader.readAsDataURL(file);
            e.target.value = '';
          }}
        />
      </div>
      {image && (
        <>
          <SliderField
            label="Opacity"
            value={opacity ?? 100}
            onValueChange={onOpacityChange}
            min={0}
            max={100}
            step={1}
            format="%"
          />
          {showFit && onFitChange && (
            <div className="space-y-1">
              <Label className="text-xs text-gray-500">Fit</Label>
              <Select
                value={fit === 'stretch' || !fit ? 'cover' : fit}
                onValueChange={(v) => onFitChange(v as 'cover' | 'contain')}
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cover">Cover</SelectItem>
                  <SelectItem value="contain">Contain</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function WordToolbarButton({
  active,
  onClick,
  title,
  children,
}: {
  active?: boolean;
  onClick: () => void;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      className={cn('title-page-word-btn', active && 'title-page-word-btn--active')}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

interface TextPageContextualControlsProps {
  pageName: string;
  settings: TextModuleSettings;
  globalSettings: WordSearchSettings;
  activeTarget: TextPageEditTarget;
  selectedBlockId: string | null;
  onTargetChange: (target: TextPageEditTarget) => void;
  onSelectBlock: (blockId: string, options?: { showChrome?: boolean }) => void;
  onSettingsChange: (
    updates:
      | Partial<TextModuleSettings>
      | ((prev: TextModuleSettings) => Partial<TextModuleSettings>)
  ) => void;
  documentPages?: DocumentPage[];
  activePageId?: string;
  onApplySeparatorLayouts?: (
    updates: Array<{ pageId: string; settings: TextModuleSettings }>,
    options?: { recordHistory?: boolean }
  ) => void;
  onClose: () => void;
  onHideBlockChrome?: () => void;
}

export function TextPageContextualControls({
  pageName,
  settings,
  globalSettings,
  activeTarget,
  selectedBlockId,
  onTargetChange,
  onSelectBlock,
  onSettingsChange,
  documentPages = [],
  activePageId,
  onApplySeparatorLayouts,
  onClose,
  onHideBlockChrome,
}: TextPageContextualControlsProps) {
  const [addImageDialogOpen, setAddImageDialogOpen] = useState(false);
  const globalFrame = resolvePageFrameSettings(globalSettings);
  const globalPuzzlePage = globalSettings.colors.puzzlePage;
  const pageFrame = resolveTextPageFrameSettings(settings, globalSettings);
  const background = resolveTextPageBackground(settings, globalSettings);
  const displayFrame = settings.useCustomFrame
    ? { ...globalFrame, ...(settings.pageFrameSettings ?? {}) }
    : globalFrame;
  const displayBackground = settings.useCustomBackground
    ? background
    : globalPuzzlePage;
  const blocks = resolveTextPageBlocks(settings, pageName, globalSettings);

  const selectedBlock =
    blocks.find((block) => block.id === selectedBlockId) ??
    blocks.find((block) => block.kind === 'title') ??
    blocks[0] ??
    null;

  const updateBlock = (patch: Partial<TextPageBlock>) => {
    if (!selectedBlock) return;
    onSettingsChange((current) =>
      updateTextPageBlock(current, selectedBlock.id, patch, pageName, globalSettings)
    );
  };

  const syncRichTextFromCanvas = () => {
    if (!selectedBlock) return;
    syncRichTextBlockFromDom(selectedBlock.id, (payload) => {
      updateBlock(payload);
      notifyTextBlockSelectionChange(selectedBlock.id);
    });
  };

  const applyTextFormat = (
    command: Parameters<typeof applyRichTextFormatToBlock>[1],
    blockPatch: Partial<TextPageBlock>
  ) => {
    if (!selectedBlock || !isTextBlockKind(selectedBlock)) return;

    if (isEntireTextBlockSelected(selectedBlock.id)) {
      const text = flattenTextBlockEditorContent(selectedBlock.id) || selectedBlock.text;
      updateBlock({ ...blockPatch, text, richTextHtml: undefined });
      notifyTextBlockSelectionChange(selectedBlock.id);
      return;
    }

    const appliedToSelection = applyRichTextFormatToBlock(selectedBlock.id, command);
    if (appliedToSelection) {
      syncRichTextFromCanvas();
      return;
    }

    updateBlock(blockPatch);
    notifyTextBlockSelectionChange(selectedBlock.id);
  };

  const updateCustomFrame = (patch: Partial<typeof pageFrame>) => {
    onSettingsChange({
      useCustomFrame: true,
      pageFrameSettings: {
        ...(settings.pageFrameSettings ?? globalFrame),
        ...patch,
      },
    });
  };

  const updateCustomBackground = (
    patch: Partial<Pick<TextModuleSettings, 'backgroundColor' | 'backgroundImage' | 'backgroundImageFit' | 'backgroundImageOpacity'>>
  ) => {
    onSettingsChange({
      useCustomBackground: true,
      ...patch,
    });
  };

  const handleAddBoxText = () => {
    const block = createAdditionalTextBlock(settings, globalSettings);
    // Ensure page-level color is black so caret/text stay visible on white pages.
    const pageColorPatch =
      !settings.textColor || settings.textColor.toLowerCase() === '#ffffff'
        ? { textColor: '#000000' as const }
        : {};
    onSettingsChange({
      ...addTextPageBlock(settings, block, pageName, globalSettings),
      ...pageColorPatch,
    });
    onTargetChange('page-elements');
    onSelectBlock(block.id, { showChrome: true });
  };

  const handleAddImage = () => {
    setAddImageDialogOpen(true);
  };

  const handleImageSelected = async (dataUrl: string) => {
    const baseBlock = createBlockForKind('image', settings, globalSettings);
    try {
      const { width, height } = await loadImageNaturalSize(dataUrl);
      const pageAspect = getPageContentAspectRatio(globalSettings);
      const block = normalizeTextPageBlock({
        ...baseBlock,
        imageSrc: dataUrl,
        ...fitImageBlockToNaturalSize(baseBlock, width, height, pageAspect),
        imageNaturalWidth: width,
        imageNaturalHeight: height,
      });
      onSettingsChange(addTextPageBlock(settings, block, pageName, globalSettings));
      onTargetChange('page-elements');
      onSelectBlock(block.id, { showChrome: true });
    } catch {
      const block = normalizeTextPageBlock({
        ...baseBlock,
        imageSrc: dataUrl,
      });
      onSettingsChange(addTextPageBlock(settings, block, pageName, globalSettings));
      onTargetChange('page-elements');
      onSelectBlock(block.id, { showChrome: true });
    }
  };

  const handleImageBlockUpload = async (dataUrl: string) => {
    if (!selectedBlock || selectedBlock.kind !== 'image') return;
    try {
      const { width, height } = await loadImageNaturalSize(dataUrl);
      const pageAspect = getPageContentAspectRatio(globalSettings);
      updateBlock({
        imageSrc: dataUrl,
        imageEffect: 'none',
        ...fitImageBlockToNaturalSize(selectedBlock, width, height, pageAspect),
        imageNaturalWidth: width,
        imageNaturalHeight: height,
      });
    } catch {
      updateBlock({ imageSrc: dataUrl });
    }
  };

  const handleRemoveBlock = () => {
    if (!selectedBlock) return;
    onSettingsChange(removeTextPageBlock(settings, selectedBlock.id, pageName, globalSettings));
    const remaining = blocks.filter((b) => b.id !== selectedBlock.id);
    onSelectBlock(remaining.find((b) => b.kind === 'title')?.id ?? remaining[0]?.id ?? '');
  };

  const isImageBlock = selectedBlock?.kind === 'image';
  const ownershipBlock = findTextPageBlockByKind(blocks, 'ownership');
  const showFontSettings = !!selectedBlock && !isImageBlock;
  const showPositionSettings = !!selectedBlock;
  const pageAlign = selectedBlock ? getPageHorizontalAlign(selectedBlock) : 'center';
  const blockTextColor = resolveReadableTextPageColor(
    selectedBlock?.textColor,
    settings,
    globalSettings
  );

  const [selectionFormat, setSelectionFormat] = useState<TextSelectionFormat | null>(null);
  const selectionRefreshRafRef = useRef<number | null>(null);

  const blocksRef = useRef(blocks);
  blocksRef.current = blocks;

  const selectedBlockIdForFormat = selectedBlock?.id ?? null;

  const refreshSelectionFormat = useCallback(() => {
    if (!selectedBlockIdForFormat) {
      setSelectionFormat((prev) => (prev === null ? prev : null));
      return;
    }

    const block = blocksRef.current.find((entry) => entry.id === selectedBlockIdForFormat);
    if (!block || !isTextBlockKind(block)) {
      setSelectionFormat((prev) => (prev === null ? prev : null));
      return;
    }

    const next = readSelectionFormat(block.id, block, blockTextColor);
    setSelectionFormat((prev) => (textSelectionFormatsEqual(prev, next) ? prev : next));
  }, [selectedBlockIdForFormat, blockTextColor, selectedBlock?.richTextHtml, selectedBlock?.text]);

  const scheduleSelectionFormatRefresh = useCallback(() => {
    if (selectionRefreshRafRef.current != null) return;
    selectionRefreshRafRef.current = window.requestAnimationFrame(() => {
      selectionRefreshRafRef.current = null;
      refreshSelectionFormat();
    });
  }, [refreshSelectionFormat]);

  useEffect(() => {
    refreshSelectionFormat();
  }, [refreshSelectionFormat]);

  useEffect(() => {
    const onSelectionEvent = (event: Event) => {
      const detail = (event as CustomEvent<{ blockId: string }>).detail;
      if (!selectedBlock || detail?.blockId !== selectedBlock.id) return;
      scheduleSelectionFormatRefresh();
    };

    window.addEventListener(TEXT_BLOCK_SELECTION_EVENT, onSelectionEvent);
    return () => {
      window.removeEventListener(TEXT_BLOCK_SELECTION_EVENT, onSelectionEvent);
      if (selectionRefreshRafRef.current != null) {
        window.cancelAnimationFrame(selectionRefreshRafRef.current);
        selectionRefreshRafRef.current = null;
      }
    };
  }, [scheduleSelectionFormatRefresh, selectedBlock?.id]);

  const effectiveFontFamily = selectionFormat?.fontFamily ?? selectedBlock?.fontFamily ?? 'Arial';
  const effectiveFontSize = selectionFormat?.fontSize ?? selectedBlock?.fontSize ?? 18;
  const effectiveBold = selectionFormat?.mixedBold
    ? false
    : (selectionFormat?.bold ?? !!selectedBlock?.bold);
  const effectiveItalic = selectionFormat?.mixedItalic
    ? false
    : (selectionFormat?.italic ?? !!selectedBlock?.italic);
  const effectiveUnderline = selectionFormat?.mixedUnderline
    ? false
    : (selectionFormat?.underline ?? !!selectedBlock?.underline);
  const effectiveTextColor = selectionFormat?.mixedTextColor
    ? blockTextColor
    : (selectionFormat?.textColor ?? blockTextColor);
  const mixedFontFamily = !!selectionFormat?.mixedFontFamily;
  const mixedFontSize = !!selectionFormat?.mixedFontSize;
  const fontSizeSelectValue = mixedFontSize ? undefined : String(effectiveFontSize);
  const fontFamilySelectValue = mixedFontFamily ? undefined : effectiveFontFamily;
  const fontSizeOptions = useMemo(() => {
    if (mixedFontSize || WORD_FONT_SIZES.includes(effectiveFontSize)) {
      return WORD_FONT_SIZES;
    }
    return [...WORD_FONT_SIZES, effectiveFontSize].sort((a, b) => a - b);
  }, [effectiveFontSize, mixedFontSize]);

  const hideBlockChrome = () => {
    onHideBlockChrome?.();
  };

  const resolvedTarget: TextPageEditTarget =
    activeTarget === 'page-frame' ? 'page-frame' : 'page-elements';

  return (
    <>
    <FloatingPanelShell
      title={pageName}
      onClose={onClose}
      tabs={[
        { id: 'page-elements', label: 'Page Title' },
        { id: 'page-frame', label: 'Frame' },
      ]}
      activeTabId={resolvedTarget}
      onTabSelect={(id) => {
        hideBlockChrome();
        onTargetChange(id as TextPageEditTarget);
      }}
      onTabClose={() => {}}
    >
      <div
        onPointerDownCapture={hideBlockChrome}
        onFocusCapture={hideBlockChrome}
      >
      {resolvedTarget === 'page-elements' && (
        <>
          <div className="canvas-context-panel__section">
            <button
              type="button"
              className="title-page-add-textbox-btn"
              onClick={handleAddBoxText}
            >
              <span className="title-page-add-textbox-btn__icon" aria-hidden>
                <Type className="h-4 w-4" strokeWidth={2.25} />
              </span>
              <span className="title-page-add-textbox-btn__copy">
                <span className="title-page-add-textbox-btn__title">Text Box</span>
                <span className="title-page-add-textbox-btn__hint">
                  Insert a box on the page — resize and type like PowerPoint
                </span>
              </span>
              <Plus className="h-4 w-4 shrink-0 opacity-60" aria-hidden />
            </button>

            <button
              type="button"
              className="title-page-add-textbox-btn mt-2"
              onClick={handleAddImage}
            >
              <span className="title-page-add-textbox-btn__icon" aria-hidden>
                <ImagePlus className="h-4 w-4" strokeWidth={2.25} />
              </span>
              <span className="title-page-add-textbox-btn__copy">
                <span className="title-page-add-textbox-btn__title">Add Image</span>
                <span className="title-page-add-textbox-btn__hint">
                  Place an image on the page — resize and position like PowerPoint
                </span>
              </span>
              <Plus className="h-4 w-4 shrink-0 opacity-60" aria-hidden />
            </button>
          </div>

          {!settings.isSeparatorPage && !/^Pg \d+ - sep$/i.test(pageName.trim()) && (
          <div className="canvas-context-panel__section">
            <div className="canvas-context-panel__card space-y-2">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="page-element-ownership"
                  checked={!!ownershipBlock}
                  onCheckedChange={(checked) => {
                    const patch = toggleTextPageBlockKind(
                      settings,
                      'ownership',
                      !!checked,
                      pageName,
                      globalSettings
                    );
                    onSettingsChange(patch);
                    if (checked && patch.blocks) {
                      const block = findTextPageBlockByKind(patch.blocks, 'ownership');
                      if (block) onSelectBlock(block.id);
                    }
                  }}
                />
                <Label htmlFor="page-element-ownership" className="text-xs font-normal cursor-pointer">
                  This book belongs to
                </Label>
              </div>
              {ownershipBlock && (
                <div className="space-y-1 pl-6">
                  <Label className="text-xs text-gray-500">Type of line</Label>
                  <Select
                    value={resolveOwnershipNameLineType(ownershipBlock)}
                    onValueChange={(value) =>
                      onSettingsChange(
                        updateTextPageBlock(
                          settings,
                          ownershipBlock.id,
                          { nameLineType: value as OwnershipNameLineType },
                          pageName,
                          globalSettings
                        )
                      )
                    }
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="solid">Solid</SelectItem>
                      <SelectItem value="dashed">Dashed</SelectItem>
                      <SelectItem value="dotted">Dotted</SelectItem>
                      <SelectItem value="none">None</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          </div>
          )}

          {isImageBlock && selectedBlock && (
            <div className="canvas-context-panel__section">
              <Label className="canvas-context-panel__section-label">Image</Label>
              <div className="canvas-context-panel__card space-y-3">
                <BackgroundImageControl
                  image={selectedBlock.imageSrc}
                  opacity={selectedBlock.imageOpacity}
                  onImageChange={handleImageBlockUpload}
                  onOpacityChange={(v) => updateBlock({ imageOpacity: v })}
                  onRemove={() => updateBlock({ imageSrc: undefined, imageEffect: 'none' })}
                  showFit={false}
                />
                {selectedBlock.imageSrc && (
                  <ImageBlockControls block={selectedBlock} onUpdate={updateBlock} />
                )}
                {!selectedBlock.imageSrc && (
                  <p className="text-[11px] text-slate-500 flex items-center gap-1">
                    <ImagePlus className="h-3.5 w-3.5" />
                    Upload an image for the center of your title page.
                  </p>
                )}
              </div>
            </div>
          )}

          {showPositionSettings && selectedBlock && (
            <div className="canvas-context-panel__section">
              <Label className="canvas-context-panel__section-label">Position on page</Label>
              <div className="canvas-context-panel__card">
                <p className="text-[11px] text-slate-500 mb-2">
                  Align the selected box on the page. Drag on canvas for custom placement.
                </p>
                <div className="title-page-page-align-row">
                  {PAGE_ALIGN_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      title={option.title}
                      className={cn(
                        'title-page-page-align-btn',
                        pageAlign === option.value && 'title-page-page-align-btn--active'
                      )}
                      onClick={() =>
                        updateBlock(applyPageHorizontalAlign(selectedBlock, option.value))
                      }
                    >
                      {option.icon}
                      <span>{option.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {showFontSettings && selectedBlock && (
            <>
              <div className="canvas-context-panel__section">
                <Label className="canvas-context-panel__section-label">Font settings</Label>
                <div className="title-page-word-toolbar">
                  <Select
                    key={mixedFontFamily ? 'font-family-mixed' : `font-family-${effectiveFontFamily}`}
                    value={fontFamilySelectValue}
                    onValueChange={(value) =>
                      applyTextFormat({ type: 'fontFamily', value }, { fontFamily: value })
                    }
                  >
                    <SelectTrigger className="title-page-word-font h-8 text-xs flex-1 min-w-0">
                      {mixedFontFamily ? (
                        <span className="text-slate-400">—</span>
                      ) : (
                        <SelectValue />
                      )}
                    </SelectTrigger>
                    <SelectContent>
                      {PUBLISHING_FONTS.map((font) => (
                        <SelectItem key={font} value={font}>
                          {font}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Select
                    key={mixedFontSize ? 'font-size-mixed' : `font-size-${effectiveFontSize}`}
                    value={fontSizeSelectValue}
                    onValueChange={(v) => {
                      const fontSize = Number(v);
                      applyTextFormat({ type: 'fontSize', value: fontSize }, { fontSize });
                    }}
                  >
                    <SelectTrigger className="title-page-word-size h-8 text-xs w-[4.5rem]">
                      {mixedFontSize ? (
                        <span className="text-slate-400">—</span>
                      ) : (
                        <SelectValue />
                      )}
                    </SelectTrigger>
                    <SelectContent>
                      {fontSizeOptions.map((size) => (
                        <SelectItem key={size} value={String(size)}>
                          {size}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <div className="title-page-word-style-group">
                    <WordToolbarButton
                      title="Bold"
                      active={effectiveBold}
                      onClick={() =>
                        applyTextFormat(
                          { type: 'bold' },
                          { bold: selectionFormat?.mixedBold ? true : !effectiveBold }
                        )
                      }
                    >
                      <Bold className="h-3.5 w-3.5" />
                    </WordToolbarButton>
                    <WordToolbarButton
                      title="Italic"
                      active={effectiveItalic}
                      onClick={() =>
                        applyTextFormat({ type: 'italic' }, { italic: !effectiveItalic })
                      }
                    >
                      <Italic className="h-3.5 w-3.5" />
                    </WordToolbarButton>
                    <WordToolbarButton
                      title="Underline"
                      active={effectiveUnderline}
                      onClick={() =>
                        applyTextFormat({ type: 'underline' }, { underline: !effectiveUnderline })
                      }
                    >
                      <Underline className="h-3.5 w-3.5" />
                    </WordToolbarButton>
                  </div>

                  <div className="title-page-spacing-fields">
                    <SliderField
                      label="Line spacing"
                      value={Math.round((selectedBlock.lineHeight ?? 1.35) * 100)}
                      onValueChange={(v) => updateBlock({ lineHeight: v / 100 })}
                      min={80}
                      max={300}
                      step={5}
                      format="%"
                    />
                    <SliderField
                      label="Word spacing"
                      value={selectedBlock.wordSpacingPx ?? 0}
                      onValueChange={(v) => updateBlock({ wordSpacingPx: v })}
                      min={0}
                      max={24}
                      step={1}
                      format="px"
                    />
                    <SliderField
                      label="Letter spacing"
                      value={selectedBlock.letterSpacingPx ?? 0}
                      onValueChange={(v) => updateBlock({ letterSpacingPx: v })}
                      min={0}
                      max={12}
                      step={0.5}
                      format="px"
                    />
                  </div>

                  <div className="title-page-word-style-group">
                    <WordToolbarButton
                      title="Align text left in box"
                      active={selectedBlock.alignment === 'left'}
                      onClick={() => updateBlock({ alignment: 'left' })}
                    >
                      <AlignLeft className="h-3.5 w-3.5" />
                    </WordToolbarButton>
                    <WordToolbarButton
                      title="Align text center in box"
                      active={selectedBlock.alignment === 'center'}
                      onClick={() => updateBlock({ alignment: 'center' })}
                    >
                      <AlignCenter className="h-3.5 w-3.5" />
                    </WordToolbarButton>
                    <WordToolbarButton
                      title="Align text right in box"
                      active={selectedBlock.alignment === 'right'}
                      onClick={() => updateBlock({ alignment: 'right' })}
                    >
                      <AlignRight className="h-3.5 w-3.5" />
                    </WordToolbarButton>
                  </div>

                  <input
                    type="color"
                    value={effectiveTextColor}
                    onChange={(e) =>
                      applyTextFormat(
                        { type: 'textColor', value: e.target.value },
                        { textColor: e.target.value }
                      )
                    }
                    className="title-page-word-color h-8 w-9 cursor-pointer rounded border border-gray-200"
                    title="Font color"
                  />
                </div>
              </div>

              {(selectedBlock.kind === 'ownership' || selectedBlock.frameEnabled) && (
                <div className="canvas-context-panel__section">
                  <Label className="canvas-context-panel__section-label">Frame &amp; shape</Label>
                  <div className="canvas-context-panel__card space-y-3">
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="block-frame-enabled"
                        checked={!!selectedBlock.frameEnabled}
                        onCheckedChange={(checked) => updateBlock({ frameEnabled: !!checked })}
                      />
                      <Label htmlFor="block-frame-enabled" className="text-xs font-normal cursor-pointer">
                        Show frame
                      </Label>
                    </div>
                    {selectedBlock.frameEnabled && (
                      <>
                        <Select
                          value={
                            selectedBlock.frameShape === 'rounded' || !selectedBlock.frameShape
                              ? 'rectangle'
                              : selectedBlock.frameShape
                          }
                          onValueChange={(value) =>
                            updateBlock({ frameShape: value as TextPageBlock['frameShape'] })
                          }
                        >
                          <SelectTrigger className="h-8 text-xs">
                            <SelectValue placeholder="Shape" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="rectangle">Rectangle</SelectItem>
                            <SelectItem value="pill">Pill</SelectItem>
                            <SelectItem value="circle">Circle</SelectItem>
                          </SelectContent>
                        </Select>
                        <MiniColorInput
                          label="Fill"
                          value={selectedBlock.frameFillColor ?? '#ffffff'}
                          onChange={(v) => updateBlock({ frameFillColor: v })}
                        />
                        <MiniColorInput
                          label="Border"
                          value={selectedBlock.frameBorderColor ?? '#1f2937'}
                          onChange={(v) => updateBlock({ frameBorderColor: v })}
                        />
                        <SliderField
                          label="Border thickness"
                          value={selectedBlock.frameBorderThicknessPx ?? 2}
                          onValueChange={(v) => updateBlock({ frameBorderThicknessPx: v })}
                          min={1}
                          max={12}
                          step={1}
                          format="px"
                        />
                        <SliderField
                          label="Corner radius"
                          value={selectedBlock.frameCornerRadiusPx ?? 10}
                          onValueChange={(v) => updateBlock({ frameCornerRadiusPx: v })}
                          min={0}
                          max={40}
                          step={1}
                          format="px"
                          disabled={
                            selectedBlock.frameShape === 'pill' ||
                            selectedBlock.frameShape === 'circle'
                          }
                        />
                        <SliderField
                          label="Padding"
                          value={selectedBlock.framePaddingPx ?? 12}
                          onValueChange={(v) => updateBlock({ framePaddingPx: v })}
                          min={4}
                          max={48}
                          step={1}
                          format="px"
                        />
                      </>
                    )}
                  </div>
                </div>
              )}

              {selectedBlock && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs text-red-600 w-full"
                  onClick={handleRemoveBlock}
                >
                  <Trash2 className="h-3 w-3 mr-1" />
                  Remove {blockDisplayLabel(selectedBlock)}
                </Button>
              )}
            </>
          )}
        </>
      )}

      {resolvedTarget === 'page-frame' && (
        <>
          <div className="canvas-context-panel__section">
            <Label className="canvas-context-panel__section-label">Page Frame</Label>
            <div className="canvas-context-panel__card space-y-3">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="text-page-custom-frame"
                  checked={!!settings.useCustomFrame}
                  onCheckedChange={(checked) =>
                    onSettingsChange({
                      useCustomFrame: !!checked,
                      pageFrameSettings: checked
                        ? (settings.pageFrameSettings ?? globalFrame)
                        : settings.pageFrameSettings,
                    })
                  }
                />
                <Label htmlFor="text-page-custom-frame" className="text-xs font-normal cursor-pointer">
                  Custom frame for this page
                </Label>
              </div>
              {!settings.useCustomFrame && (
                <p className="text-[10px] text-muted-foreground leading-tight">
                  Using the global page frame from Color Settings in the left sidebar.
                </p>
              )}
              <div className="flex items-center gap-2">
                <Checkbox
                  id="text-page-frame-enabled"
                  checked={displayFrame.enabled}
                  disabled={!settings.useCustomFrame}
                  onCheckedChange={(checked) => updateCustomFrame({ enabled: !!checked })}
                />
                <Label
                  htmlFor="text-page-frame-enabled"
                  className={cn(
                    'text-xs font-normal',
                    settings.useCustomFrame ? 'cursor-pointer' : 'cursor-default opacity-70'
                  )}
                >
                  Enable page container frame
                </Label>
              </div>
              {displayFrame.enabled && (
                <>
                  <SliderField
                    label="Frame margin"
                    value={displayFrame.marginSizeIn}
                    onValueChange={(v) => updateCustomFrame({ marginSizeIn: v })}
                    min={0.5}
                    max={1}
                    step={0.0625}
                    format="inches"
                    disabled={!settings.useCustomFrame}
                  />
                  <div className="canvas-context-panel__grid-2">
                    <SliderField
                      label="Corner radius"
                      value={displayFrame.cornerRadiusPx}
                      onValueChange={(v) => updateCustomFrame({ cornerRadiusPx: v })}
                      min={0}
                      max={40}
                      step={1}
                      format="px"
                      disabled={!settings.useCustomFrame}
                    />
                    <SliderField
                      label="Stroke"
                      value={displayFrame.strokeThicknessPx}
                      onValueChange={(v) => updateCustomFrame({ strokeThicknessPx: v })}
                      min={1}
                      max={10}
                      step={1}
                      format="px"
                      disabled={!settings.useCustomFrame}
                    />
                  </div>
                  <MiniColorInput
                    label="Frame color"
                    value={displayFrame.borderColor}
                    onChange={(v) => updateCustomFrame({ borderColor: v })}
                    disabled={!settings.useCustomFrame}
                  />
                </>
              )}
            </div>
          </div>
          <div className="canvas-context-panel__section">
            <Label className="canvas-context-panel__section-label">Page background</Label>
            <div className="canvas-context-panel__card space-y-3">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="text-page-custom-background"
                  checked={!!settings.useCustomBackground}
                  onCheckedChange={(checked) =>
                    onSettingsChange({ useCustomBackground: !!checked })
                  }
                />
                <Label htmlFor="text-page-custom-background" className="text-xs font-normal cursor-pointer">
                  Custom background for this page
                </Label>
              </div>
              {!settings.useCustomBackground && (
                <p className="text-[10px] text-muted-foreground leading-tight">
                  Using the global puzzle page background from Color Settings in the left sidebar.
                </p>
              )}
              <MiniColorInput
                label="Background color"
                value={displayBackground.backgroundColor || '#ffffff'}
                onChange={(v) => updateCustomBackground({ backgroundColor: v })}
                disabled={!settings.useCustomBackground}
              />
              <BackgroundImageControl
                image={displayBackground.backgroundImage}
                opacity={displayBackground.backgroundImageOpacity}
                fit={displayBackground.backgroundImageFit}
                onImageChange={(base64) => updateCustomBackground({ backgroundImage: base64 })}
                onOpacityChange={(v) => updateCustomBackground({ backgroundImageOpacity: v })}
                onFitChange={(v) => updateCustomBackground({ backgroundImageFit: v })}
                onRemove={() => updateCustomBackground({ backgroundImage: undefined })}
                disabled={!settings.useCustomBackground}
              />
            </div>
          </div>
        </>
      )}

      {/* Chapter title pages: apply layout like puzzle page footer buttons */}
      {activePageId &&
        onApplySeparatorLayouts &&
        isChapterTitlePage(
          documentPages.find((page) => page.id === activePageId) ?? {
            name: pageName,
            moduleType: 'title-page',
            settings,
          }
        ) && (
          <ChapterCanvasApplyPanel
            chapterCount={countChapterTitlePages(documentPages)}
            onApplyToAll={() => {
              const updates = collectChapterLayoutStyleUpdates(
                settings,
                documentPages,
                activePageId
              );
              onApplySeparatorLayouts(updates);
            }}
          />
        )}

      {/* Apply layout only on separate blank pages — never on regular Title Page */}
      {activePageId &&
        onApplySeparatorLayouts &&
        isSeparatorTitlePage(
          documentPages.find((page) => page.id === activePageId) ?? {
            name: pageName,
            moduleType: 'title-page',
            settings,
          }
        ) && (
          <SeparatorLayoutSyncPanel
            activePageId={activePageId}
            settings={settings}
            pageName={pageName}
            globalSettings={globalSettings}
            documentPages={documentPages}
            onApply={onApplySeparatorLayouts}
          />
        )}
      </div>
    </FloatingPanelShell>

    <AddImageSourceDialog
      open={addImageDialogOpen}
      onOpenChange={setAddImageDialogOpen}
      onImageSelected={handleImageSelected}
    />
  </>
  );
}
