'use client';

import React, { useRef } from 'react';
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Bold,
  ImagePlus,
  Italic,
  Plus,
  Trash2,
  Underline,
  Upload,
} from 'lucide-react';
import { PUBLISHING_FONTS } from '@/lib/publishing-fonts';
import { SliderField } from '@/components/ui/slider-field';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { FloatingPanelShell } from '@/components/FloatingPanelShell';
import type { TextModuleSettings, TextPageBlock, TextPageBlockKind } from '@/lib/document-model';
import type { WordSearchSettings } from '@/lib/puzzles/types';
import {
  addTextPageBlock,
  applyPositionPreset,
  blockDisplayLabel,
  canAddBlockKind,
  createBlockForKind,
  removeTextPageBlock,
  resolveTextPageBlocks,
  updateTextPageBlock,
  type TitlePagePositionPreset,
} from '@/lib/text-page-blocks';
import {
  resolveTextPageBackground,
  resolveTextPageFrameSettings,
  resolveTextPageTextColor,
} from '@/lib/text-page-settings';
import { resolvePageFrameSettings } from '@/lib/page-frame-settings';
import { cn } from '@/lib/utils';
import './canvas-contextual-controls.css';

export type TextPageEditTarget = 'page-elements' | 'page-frame';

const WORD_FONT_SIZES = [8, 9, 10, 11, 12, 14, 16, 18, 20, 24, 28, 32, 36, 48, 72];

const ADD_ELEMENT_OPTIONS: Array<{ kind: TextPageBlockKind; label: string }> = [
  { kind: 'subtitle', label: 'Subtitle' },
  { kind: 'text', label: 'Additional text' },
  { kind: 'image', label: 'Image' },
  { kind: 'ownership', label: 'This book belongs to' },
  { kind: 'copyright', label: 'Copyright' },
];

function MiniColorInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <Label className="text-xs text-gray-500 shrink-0">{label}</Label>
      <input
        type="color"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-7 w-10 cursor-pointer rounded border border-gray-200"
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
}: {
  image?: string;
  opacity?: number;
  fit?: 'cover' | 'contain' | 'stretch';
  onImageChange: (base64: string) => void;
  onOpacityChange: (value: number) => void;
  onFitChange: (value: 'cover' | 'contain' | 'stretch') => void;
  onRemove: () => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="space-y-2">
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
          <div className="space-y-1">
            <Label className="text-xs text-gray-500">Fit</Label>
            <Select value={fit ?? 'contain'} onValueChange={(v) => onFitChange(v as typeof fit)}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="contain">Contain</SelectItem>
                <SelectItem value="cover">Cover</SelectItem>
                <SelectItem value="stretch">Stretch</SelectItem>
              </SelectContent>
            </Select>
          </div>
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
  onSelectBlock: (blockId: string) => void;
  onSettingsChange: (updates: Partial<TextModuleSettings>) => void;
  onClose: () => void;
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
  onClose,
}: TextPageContextualControlsProps) {
  const pageFrame = resolveTextPageFrameSettings(settings, globalSettings);
  const globalFrame = resolvePageFrameSettings(globalSettings);
  const background = resolveTextPageBackground(settings, globalSettings);
  const blocks = resolveTextPageBlocks(settings, pageName, globalSettings);

  const selectedBlock =
    blocks.find((block) => block.id === selectedBlockId) ??
    blocks.find((block) => block.kind === 'title') ??
    blocks[0] ??
    null;

  const updateBlock = (patch: Partial<TextPageBlock>) => {
    if (!selectedBlock) return;
    onSettingsChange(updateTextPageBlock(settings, selectedBlock.id, patch, pageName, globalSettings));
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

  const handleAddElement = (kind: TextPageBlockKind) => {
    if (!canAddBlockKind(blocks, kind)) return;
    const block = createBlockForKind(kind, settings, globalSettings);
    onSettingsChange(addTextPageBlock(settings, block, pageName, globalSettings));
    onTargetChange('page-elements');
    onSelectBlock(block.id);
  };

  const handleRemoveBlock = () => {
    if (!selectedBlock || selectedBlock.kind === 'title') return;
    onSettingsChange(removeTextPageBlock(settings, selectedBlock.id, pageName, globalSettings));
    const remaining = blocks.filter((b) => b.id !== selectedBlock.id);
    onSelectBlock(remaining.find((b) => b.kind === 'title')?.id ?? remaining[0]?.id ?? '');
  };

  const blockTextColor =
    selectedBlock?.textColor ?? resolveTextPageTextColor(settings, globalSettings);

  const isImageBlock = selectedBlock?.kind === 'image';

  return (
    <FloatingPanelShell
      title={pageName}
      onClose={onClose}
      tabs={[
        { id: 'page-elements', label: 'Page Title' },
        { id: 'page-frame', label: 'Frame' },
      ]}
      activeTabId={activeTarget}
      onTabSelect={(id) => onTargetChange(id as TextPageEditTarget)}
      onTabClose={() => {}}
    >
      {activeTarget === 'page-elements' && (
        <>
          <div className="canvas-context-panel__section">
            <Label className="canvas-context-panel__section-label">Page elements</Label>
            <div className="title-page-element-list">
              {blocks.map((block) => (
                <button
                  key={block.id}
                  type="button"
                  className={cn(
                    'title-page-element-chip',
                    selectedBlock?.id === block.id && 'title-page-element-chip--active'
                  )}
                  onClick={() => {
                    onTargetChange('page-elements');
                    onSelectBlock(block.id);
                  }}
                >
                  {blockDisplayLabel(block)}
                </button>
              ))}
            </div>
          </div>

          <div className="canvas-context-panel__section">
            <Label className="canvas-context-panel__section-label">Add element</Label>
            <div className="title-page-add-grid">
              {ADD_ELEMENT_OPTIONS.map((option) => (
                <Button
                  key={option.kind}
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-7 text-[11px] px-2"
                  disabled={!canAddBlockKind(blocks, option.kind)}
                  onClick={() => handleAddElement(option.kind)}
                >
                  <Plus className="h-3 w-3 mr-1 shrink-0" />
                  {option.label}
                </Button>
              ))}
            </div>
          </div>

          {selectedBlock && (
            <>
              <div className="canvas-context-panel__section">
                <Label className="canvas-context-panel__section-label">
                  {blockDisplayLabel(selectedBlock)}
                </Label>

                {!isImageBlock && (
                  <div className="canvas-context-panel__card space-y-2 mb-3">
                    <Label className="text-xs text-gray-500">Text content</Label>
                    <Input
                      className="h-8 text-xs"
                      value={selectedBlock.text}
                      onChange={(e) => updateBlock({ text: e.target.value })}
                      placeholder="Type here or edit on canvas…"
                    />
                  </div>
                )}

                {isImageBlock ? (
                  <div className="canvas-context-panel__card space-y-3">
                    <BackgroundImageControl
                      image={selectedBlock.imageSrc}
                      opacity={selectedBlock.imageOpacity}
                      fit={selectedBlock.imageFit}
                      onImageChange={(base64) => updateBlock({ imageSrc: base64 })}
                      onOpacityChange={(v) => updateBlock({ imageOpacity: v })}
                      onFitChange={(v) => updateBlock({ imageFit: v })}
                      onRemove={() => updateBlock({ imageSrc: undefined })}
                    />
                    {!selectedBlock.imageSrc && (
                      <p className="text-[11px] text-slate-500 flex items-center gap-1">
                        <ImagePlus className="h-3.5 w-3.5" />
                        Upload an image for the center of your title page.
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="title-page-word-toolbar">
                    <Select
                      value={selectedBlock.fontFamily}
                      onValueChange={(value) => updateBlock({ fontFamily: value })}
                    >
                      <SelectTrigger className="title-page-word-font h-8 text-xs flex-1 min-w-0">
                        <SelectValue />
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
                      value={String(selectedBlock.fontSize)}
                      onValueChange={(v) => updateBlock({ fontSize: Number(v) })}
                    >
                      <SelectTrigger className="title-page-word-size h-8 text-xs w-[4.5rem]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {WORD_FONT_SIZES.map((size) => (
                          <SelectItem key={size} value={String(size)}>
                            {size}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    <div className="title-page-word-style-group">
                      <WordToolbarButton
                        title="Bold"
                        active={!!selectedBlock.bold}
                        onClick={() => updateBlock({ bold: !selectedBlock.bold })}
                      >
                        <Bold className="h-3.5 w-3.5" />
                      </WordToolbarButton>
                      <WordToolbarButton
                        title="Italic"
                        active={!!selectedBlock.italic}
                        onClick={() => updateBlock({ italic: !selectedBlock.italic })}
                      >
                        <Italic className="h-3.5 w-3.5" />
                      </WordToolbarButton>
                      <WordToolbarButton
                        title="Underline"
                        active={!!selectedBlock.underline}
                        onClick={() => updateBlock({ underline: !selectedBlock.underline })}
                      >
                        <Underline className="h-3.5 w-3.5" />
                      </WordToolbarButton>
                    </div>

                    <div className="title-page-word-style-group">
                      <WordToolbarButton
                        title="Align left"
                        active={selectedBlock.alignment === 'left'}
                        onClick={() => updateBlock({ alignment: 'left' })}
                      >
                        <AlignLeft className="h-3.5 w-3.5" />
                      </WordToolbarButton>
                      <WordToolbarButton
                        title="Align center"
                        active={selectedBlock.alignment === 'center'}
                        onClick={() => updateBlock({ alignment: 'center' })}
                      >
                        <AlignCenter className="h-3.5 w-3.5" />
                      </WordToolbarButton>
                      <WordToolbarButton
                        title="Align right"
                        active={selectedBlock.alignment === 'right'}
                        onClick={() => updateBlock({ alignment: 'right' })}
                      >
                        <AlignRight className="h-3.5 w-3.5" />
                      </WordToolbarButton>
                    </div>

                    <input
                      type="color"
                      value={blockTextColor}
                      onChange={(e) => updateBlock({ textColor: e.target.value })}
                      className="title-page-word-color h-8 w-9 cursor-pointer rounded border border-gray-200"
                      title="Font color"
                    />
                  </div>
                )}
              </div>

              <div className="canvas-context-panel__section">
                <Label className="canvas-context-panel__section-label">Position</Label>
                <div className="canvas-context-panel__card space-y-3">
                  <div className="flex flex-wrap gap-1">
                    {(
                      [
                        ['top', 'Top'],
                        ['upper-center', 'Upper'],
                        ['center', 'Center'],
                        ['lower-center', 'Lower'],
                        ['bottom', 'Bottom'],
                      ] as Array<[TitlePagePositionPreset, string]>
                    ).map(([preset, label]) => (
                      <Button
                        key={preset}
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-7 text-[11px] px-2"
                        onClick={() => updateBlock(applyPositionPreset(selectedBlock, preset))}
                      >
                        {label}
                      </Button>
                    ))}
                  </div>
                  <SliderField
                    label="Vertical (Y)"
                    value={selectedBlock.yPercent}
                    onValueChange={(v) => updateBlock({ yPercent: v })}
                    min={0}
                    max={90}
                    step={0.5}
                    format="%"
                  />
                  <SliderField
                    label="Width"
                    value={selectedBlock.widthPercent}
                    onValueChange={(v) => updateBlock({ widthPercent: v })}
                    min={15}
                    max={100}
                    step={1}
                    format="%"
                  />
                  {isImageBlock && (
                    <SliderField
                      label="Height"
                      value={selectedBlock.heightPercent ?? 28}
                      onValueChange={(v) => updateBlock({ heightPercent: v })}
                      min={10}
                      max={70}
                      step={1}
                      format="%"
                    />
                  )}
                  <p className="text-[11px] text-slate-500">
                    Click and drag the selected element to reposition it. Use sliders and presets for fine tuning.
                  </p>
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
                          value={selectedBlock.frameShape ?? 'rounded'}
                          onValueChange={(value) =>
                            updateBlock({ frameShape: value as TextPageBlock['frameShape'] })
                          }
                        >
                          <SelectTrigger className="h-8 text-xs">
                            <SelectValue placeholder="Shape" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="rectangle">Rectangle</SelectItem>
                            <SelectItem value="rounded">Rounded</SelectItem>
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
                        {selectedBlock.kind === 'ownership' && (
                          <div className="flex items-center gap-2">
                            <Checkbox
                              id="block-name-line"
                              checked={selectedBlock.showNameLine !== false}
                              onCheckedChange={(checked) => updateBlock({ showNameLine: !!checked })}
                            />
                            <Label htmlFor="block-name-line" className="text-xs font-normal cursor-pointer">
                              Show name line
                            </Label>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>
              )}

              {selectedBlock.kind !== 'title' && (
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

      {activeTarget === 'page-frame' && (
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
              <div className="flex items-center gap-2">
                <Checkbox
                  id="text-page-frame-enabled"
                  checked={pageFrame.enabled}
                  disabled={!settings.useCustomFrame}
                  onCheckedChange={(checked) => updateCustomFrame({ enabled: !!checked })}
                />
                <Label htmlFor="text-page-frame-enabled" className="text-xs font-normal cursor-pointer">
                  Enable page container frame
                </Label>
              </div>
              {pageFrame.enabled && settings.useCustomFrame && (
                <>
                  <SliderField
                    label="Frame margin"
                    value={pageFrame.marginSizeIn}
                    onValueChange={(v) => updateCustomFrame({ marginSizeIn: v })}
                    min={0.5}
                    max={1}
                    step={0.0625}
                    format="inches"
                  />
                  <MiniColorInput
                    label="Frame color"
                    value={pageFrame.borderColor}
                    onChange={(v) => updateCustomFrame({ borderColor: v })}
                  />
                </>
              )}
            </div>
          </div>
          <div className="canvas-context-panel__section">
            <Label className="canvas-context-panel__section-label">Page background</Label>
            <div className="canvas-context-panel__card space-y-3">
              <MiniColorInput
                label="Background color"
                value={background.backgroundColor || '#ffffff'}
                onChange={(v) =>
                  onSettingsChange({ useCustomBackground: true, backgroundColor: v })
                }
              />
              <BackgroundImageControl
                image={background.backgroundImage}
                opacity={background.backgroundImageOpacity}
                fit={background.backgroundImageFit}
                onImageChange={(base64) =>
                  onSettingsChange({ useCustomBackground: true, backgroundImage: base64 })
                }
                onOpacityChange={(v) =>
                  onSettingsChange({ useCustomBackground: true, backgroundImageOpacity: v })
                }
                onFitChange={(v) =>
                  onSettingsChange({ useCustomBackground: true, backgroundImageFit: v })
                }
                onRemove={() =>
                  onSettingsChange({ useCustomBackground: true, backgroundImage: undefined })
                }
              />
            </div>
          </div>
        </>
      )}
    </FloatingPanelShell>
  );
}
