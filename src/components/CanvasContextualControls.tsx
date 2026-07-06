'use client';

import React, { useCallback, useState } from 'react';
import { Trash2, Upload, X, ArrowRight, ArrowLeft, ArrowDown, ArrowUp, ArrowDownRight, ArrowUpRight, ArrowUpLeft, ArrowDownLeft } from 'lucide-react';
import { PUBLISHING_FONTS } from '@/lib/publishing-fonts';
import { SliderField } from '@/components/ui/slider-field';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { HeaderAssemblyEditor } from '@/components/header/HeaderAssemblyEditor';
import { normalizeHeaderAssemblySettings, type HeaderAssemblySettings } from '@/lib/header-assembly/types';
import { PageNumberShapeEditor } from '@/components/page-number/PageNumberShapeEditor';
import { normalizePageNumberSettings } from '@/lib/page-number/settings';
import { applyPageFrameSettingsPatch, resolvePageFrameSettings } from '@/lib/page-frame-settings';
import type {
  PageNumberSettings,
  TitleWordsSettings,
  WordSearchPuzzle,
  WordSearchSettings,
} from '@/lib/puzzles/types';
import {
  getPuzzleContentLineIndex,
  getRawContentLineAt,
  setRawContentLineAt,
} from '@/lib/puzzle-line-index';
import { CanvasPageWordListEditor } from '@/components/CanvasPageWordListEditor';
import { FloatingPanelShell } from '@/components/FloatingPanelShell';
import type { CanvasEditPanelTab } from '@/components/CanvasEditTabsBar';
import { patchWordSearchSettings } from '@/lib/canvas-edit-session';
import type { CanvasEditTarget } from '@/lib/canvas-edit-session';
import { cn } from '@/lib/utils';
import './canvas-contextual-controls.css';

export type { CanvasEditTarget } from '@/lib/canvas-edit-session';

interface CanvasContextualControlsProps {
  target: CanvasEditTarget;
  pageKind: 'puzzle' | 'solution';
  pageIndex: number;
  draftSettings: WordSearchSettings;
  onDraftSettingsChange: (updater: (prev: WordSearchSettings) => WordSearchSettings) => void;
  draftPuzzleGridScale: number;
  onDraftPuzzleGridScaleChange: (scale: number) => void;
  draftTitleWords: TitleWordsSettings;
  onDraftTitleWordsChange: (titleWords: TitleWordsSettings) => void;
  currentPuzzle?: WordSearchPuzzle | null;
  onCommitPage: () => void;
  onCommitAll: () => void;
  onCommitRange?: (range: string) => void;
  onCancel: () => void;
  hasUnsavedChanges: boolean;
  canApplyToAllPages: boolean;
  documentPuzzleCount?: number;
  rangeError?: string | null;
  canApplyToSelectedPages?: (range: string) => boolean;
  editTabs?: CanvasEditPanelTab[];
  activeEditTabId?: string | null;
  onEditTabSelect?: (id: string) => void;
  onEditTabClose?: (id: string) => void;
}

function CanvasEditActions({
  onCommitPage,
  onCommitAll,
  onCommitRange,
  onCancel,
  showPageOnly,
  hasUnsavedChanges,
  canApplyToAllPages,
  documentPuzzleCount = 0,
  rangeError = null,
  canApplyToSelectedPages,
}: {
  onCommitPage: () => void;
  onCommitAll: () => void;
  onCommitRange?: (range: string) => void;
  onCancel: () => void;
  showPageOnly: boolean;
  hasUnsavedChanges: boolean;
  canApplyToAllPages: boolean;
  documentPuzzleCount?: number;
  rangeError?: string | null;
  canApplyToSelectedPages?: (range: string) => boolean;
}) {
  const [rangeInput, setRangeInput] = useState('');
  const showRangeSelect = showPageOnly && documentPuzzleCount > 1 && onCommitRange;
  const rangeApplyEnabled =
    rangeInput.trim().length > 0 &&
    (canApplyToSelectedPages ? canApplyToSelectedPages(rangeInput) : true);

  return (
    <div className="canvas-context-panel__footer">
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="canvas-context-panel__footer-btn canvas-context-panel__footer-btn--cancel"
        onClick={onCancel}
      >
        Cancel
      </Button>
      {showPageOnly && (
        <Button
          type="button"
          size="sm"
          className="canvas-context-panel__footer-btn canvas-context-panel__footer-btn--page"
          onClick={onCommitPage}
          disabled={!hasUnsavedChanges}
        >
          Update this page only
        </Button>
      )}
      {showRangeSelect && (
        <div className="canvas-context-panel__footer-range">
          <Label htmlFor="canvas-edit-range" className="canvas-context-panel__footer-range-label">
            Range select
          </Label>
          <Input
            id="canvas-edit-range"
            value={rangeInput}
            onChange={(event) => setRangeInput(event.target.value)}
            placeholder="e.g. 1-4, 7-10, 12"
            className="canvas-context-panel__footer-range-input"
            onKeyDown={(event) => {
              if (event.key === 'Enter' && rangeApplyEnabled) {
                event.preventDefault();
                onCommitRange(rangeInput);
              }
            }}
          />
          {rangeError && <p className="canvas-context-panel__footer-range-error">{rangeError}</p>}
          <Button
            type="button"
            size="sm"
            className="canvas-context-panel__footer-btn canvas-context-panel__footer-btn--range"
            onClick={() => onCommitRange(rangeInput)}
            disabled={!rangeApplyEnabled}
          >
            Apply to selected pages
          </Button>
        </div>
      )}
      <Button
        type="button"
        size="sm"
        className="canvas-context-panel__footer-btn canvas-context-panel__footer-btn--all"
        onClick={onCommitAll}
        disabled={!canApplyToAllPages}
      >
        Apply to all pages
      </Button>
    </div>
  );
}

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

function CanvasBackgroundImageControl({
  label,
  image,
  opacity,
  fit,
  onImageChange,
  onOpacityChange,
  onFitChange,
  onRemove,
}: {
  label: string;
  image?: string;
  opacity?: number;
  fit?: 'cover' | 'contain' | 'stretch';
  onImageChange: (base64: string) => void;
  onOpacityChange: (value: number) => void;
  onFitChange: (value: 'cover' | 'contain' | 'stretch') => void;
  onRemove: () => void;
}) {
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === 'string') {
        onImageChange(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="canvas-context-panel__card space-y-3">
      <div className="flex items-center justify-between">
        <Label className="text-xs font-semibold">{label} Background</Label>
        {image && (
          <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={onRemove}>
            <Trash2 className="w-3 h-3 mr-1" />
            Remove
          </Button>
        )}
      </div>
      {!image ? (
        <>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept="image/png, image/jpeg, image/jpg"
            className="hidden"
          />
          <Button
            type="button"
            variant="outline"
            onClick={() => fileInputRef.current?.click()}
            className="w-full h-14 border-dashed text-xs"
          >
            <Upload className="w-4 h-4 mr-1" />
            Upload Image
          </Button>
        </>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          <Select value={fit || 'cover'} onValueChange={(val) => onFitChange(val as 'cover' | 'contain' | 'stretch')}>
            <SelectTrigger className="h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="cover">Cover</SelectItem>
              <SelectItem value="contain">Contain</SelectItem>
              <SelectItem value="stretch">Stretch</SelectItem>
            </SelectContent>
          </Select>
          <SliderField
            label="Opacity"
            value={opacity ?? 100}
            onValueChange={onOpacityChange}
            min={0}
            max={100}
            step={1}
            format="percent"
          />
        </div>
      )}
    </div>
  );
}

export function CanvasContextualControls({
  target,
  pageKind,
  pageIndex,
  draftSettings: wordSearchSettings,
  onDraftSettingsChange,
  draftPuzzleGridScale: puzzleGridScale,
  onDraftPuzzleGridScaleChange: setPuzzleGridScale,
  draftTitleWords,
  onDraftTitleWordsChange,
  currentPuzzle,
  onCommitPage,
  onCommitAll,
  onCommitRange,
  onCancel,
  hasUnsavedChanges,
  canApplyToAllPages,
  documentPuzzleCount,
  rangeError,
  canApplyToSelectedPages,
  editTabs,
  activeEditTabId,
  onEditTabSelect,
  onEditTabClose,
}: CanvasContextualControlsProps) {
  const applySettingsUpdate = useCallback(
    (updates: Partial<WordSearchSettings>) => {
      onDraftSettingsChange((prev) => patchWordSearchSettings(prev, updates));
    },
    [onDraftSettingsChange]
  );

  const updateCore = useCallback(
    (updates: Partial<WordSearchSettings['core']>) => {
      onDraftSettingsChange((prev) =>
        patchWordSearchSettings(prev, {
          core: { ...prev.core, ...updates },
        })
      );
    },
    [onDraftSettingsChange]
  );

  const updateTypography = useCallback(
    (updates: Partial<WordSearchSettings['typography']>) => {
      onDraftSettingsChange((prev) =>
        patchWordSearchSettings(prev, {
          typography: { ...prev.typography, ...updates },
        })
      );
    },
    [onDraftSettingsChange]
  );

  const updateWordListSettings = useCallback(
    (updates: Partial<WordSearchSettings['wordList']>) => {
      onDraftSettingsChange((prev) =>
        patchWordSearchSettings(prev, {
          wordList: { ...prev.wordList, ...updates },
        })
      );
    },
    [onDraftSettingsChange]
  );

  const updateBookCanvas = useCallback(
    (updates: Partial<WordSearchSettings['bookCanvas']>) => {
      onDraftSettingsChange((prev) =>
        patchWordSearchSettings(prev, {
          bookCanvas: { ...prev.bookCanvas, ...updates },
        })
      );
    },
    [onDraftSettingsChange]
  );

  const updatePuzzlePageColors = useCallback(
    (updates: Partial<WordSearchSettings['colors']['puzzlePage']>) => {
      onDraftSettingsChange((prev) =>
        patchWordSearchSettings(prev, {
          colors: {
            puzzlePage: {
              ...prev.colors.puzzlePage,
              ...updates,
            },
          },
        } as Partial<WordSearchSettings>)
      );
    },
    [onDraftSettingsChange]
  );

  const updateAnswerPageColors = useCallback(
    (updates: Partial<WordSearchSettings['colors']['answerPage']>) => {
      onDraftSettingsChange((prev) =>
        patchWordSearchSettings(prev, {
          colors: {
            answerPage: {
              ...prev.colors.answerPage,
              ...updates,
            },
          },
        } as Partial<WordSearchSettings>)
      );
    },
    [onDraftSettingsChange]
  );

  const updatePageNumber = useCallback(
    (updates: Partial<PageNumberSettings>) => {
      onDraftSettingsChange((prev) => {
        const pageNumber = normalizePageNumberSettings(prev.typography.pageNumber);
        return patchWordSearchSettings(prev, {
          typography: {
            pageNumber: normalizePageNumberSettings({ ...pageNumber, ...updates }),
          },
        } as Partial<WordSearchSettings>);
      });
    },
    [onDraftSettingsChange]
  );

  const updatePageFrameSettings = useCallback(
    (updates: Parameters<typeof applyPageFrameSettingsPatch>[1]) => {
      onDraftSettingsChange((prev) => {
        const patched = applyPageFrameSettingsPatch(prev, updates);
        return patchWordSearchSettings(prev, { pageFrameSettings: patched.pageFrameSettings });
      });
    },
    [onDraftSettingsChange]
  );

  const updateHeaderAssembly = useCallback(
    (updates: Partial<HeaderAssemblySettings>) => {
      onDraftSettingsChange((prev) => {
        const current = normalizeHeaderAssemblySettings(prev.colors.puzzlePage.headerAssembly);
        return patchWordSearchSettings(prev, {
          colors: {
            puzzlePage: {
              headerAssembly: normalizeHeaderAssemblySettings({ ...current, ...updates }),
            },
          },
        } as Partial<WordSearchSettings>);
      });
    },
    [onDraftSettingsChange]
  );

  const { bookCanvas, core, typography, wordList, colors } = wordSearchSettings;

  const pageNumber = normalizePageNumberSettings(typography.pageNumber);
  const pageFrame = resolvePageFrameSettings(wordSearchSettings);
  const headerAssembly = normalizeHeaderAssemblySettings(colors.puzzlePage.headerAssembly);

  const puzzleContentLineIndex =
    currentPuzzle != null ? getPuzzleContentLineIndex(currentPuzzle, wordSearchSettings) : 0;

  const titles: Record<CanvasEditTarget, string> = {
    title: 'Title & Header',
    grid: 'Puzzle Grid',
    'word-list': 'Word List',
    'page-number': 'Page Number',
    'page-background': 'Page Frame & Background',
    'solution-title': 'Solution Title',
    'solution-grid': 'Solution Grid',
  };

  return (
    <FloatingPanelShell
      title={editTabs && editTabs.length > 0 ? 'Edit controls' : titles[target]}
      onClose={onCancel}
      tabs={editTabs}
      activeTabId={activeEditTabId}
      onTabSelect={onEditTabSelect}
      onTabClose={onEditTabClose}
      footer={
        <CanvasEditActions
          onCancel={onCancel}
          onCommitPage={onCommitPage}
          onCommitAll={onCommitAll}
          onCommitRange={onCommitRange}
          showPageOnly
          hasUnsavedChanges={hasUnsavedChanges}
          canApplyToAllPages={canApplyToAllPages}
          documentPuzzleCount={documentPuzzleCount}
          rangeError={rangeError}
          canApplyToSelectedPages={canApplyToSelectedPages}
        />
      }
    >
        {editTabs && editTabs.length > 0 && (
          <p className="canvas-context-panel__active-target">{titles[target]}</p>
        )}
        {target === 'title' && (
          <div className="canvas-context-panel__section">
            <Label className="canvas-context-panel__section-label">Title Text</Label>
            {typography.selectTitleOption === 'none' ? (
              <p className="text-xs text-slate-500 mb-2">
                Titles are turned off. Enable a title mode in the sidebar to edit title text.
              </p>
            ) : typography.selectTitleOption === 'custom' ? (
              <Input
                className="h-8 text-xs mb-1"
                value={getRawContentLineAt(typography.titleText, puzzleContentLineIndex)}
                onChange={(e) =>
                  updateTypography({
                    titleText: setRawContentLineAt(
                      typography.titleText,
                      puzzleContentLineIndex,
                      e.target.value
                    ),
                  })
                }
                placeholder="Title for this page..."
              />
            ) : (
              <Input
                className="h-8 text-xs mb-1"
                value={typography.titleText}
                onChange={(e) => updateTypography({ titleText: e.target.value })}
                placeholder="Title for all puzzles..."
              />
            )}
            {typography.selectTitleOption === 'custom' && (
              <p className="text-xs text-slate-500 mb-3">
                Custom title for puzzle {currentPuzzle?.puzzleNumber ?? pageIndex + 1} only.
              </p>
            )}
            {typography.selectTitleOption !== 'none' &&
              typography.selectTitleOption !== 'custom' && (
                <p className="text-xs text-slate-500 mb-3">Same title on every puzzle page.</p>
              )}

            <Label className="canvas-context-panel__section-label">Subtitle Text</Label>
            <div className="flex items-center gap-2 mb-2">
              <Checkbox
                id="canvas-include-fun-facts"
                checked={typography.includeFunFacts}
                onCheckedChange={(checked) =>
                  updateTypography({ includeFunFacts: checked === true })
                }
              />
              <Label
                htmlFor="canvas-include-fun-facts"
                className="text-xs font-normal cursor-pointer"
              >
                Show subtitle / fun fact
              </Label>
            </div>
            {typography.includeFunFacts && (
              <>
                <Textarea
                  className="min-h-[4.5rem] text-xs mb-1"
                  value={getRawContentLineAt(typography.funFactsText, puzzleContentLineIndex)}
                  onChange={(e) =>
                    updateTypography({
                      funFactsText: setRawContentLineAt(
                        typography.funFactsText,
                        puzzleContentLineIndex,
                        e.target.value
                      ),
                    })
                  }
                  placeholder="Subtitle or fun fact for this page..."
                />
                <p className="text-xs text-slate-500 mb-3">
                  Subtitle for puzzle {currentPuzzle?.puzzleNumber ?? pageIndex + 1} only.
                </p>
              </>
            )}

            <Label className="canvas-context-panel__section-label">Title Font</Label>
            <Select
              value={typography.puzzleTitleFontFamily}
              onValueChange={(value) => updateTypography({ puzzleTitleFontFamily: value })}
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

            {headerAssembly.enabled && (
              <Select
                value={headerAssembly.number.fontFamily || typography.puzzleTitleFontFamily}
                onValueChange={(value) =>
                  updateHeaderAssembly({
                    number: { ...headerAssembly.number, fontFamily: value },
                  })
                }
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="Number font" />
                </SelectTrigger>
                <SelectContent>
                  {PUBLISHING_FONTS.map((font) => (
                    <SelectItem key={`number-${font}`} value={font} style={{ fontFamily: font }}>
                      Number: {font}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            <div className="canvas-context-panel__grid-2">
              <SliderField
                label="Title Size"
                value={typography.puzzleTitleFontSize}
                onValueChange={(v) => updateTypography({ puzzleTitleFontSize: v })}
                min={8}
                max={50}
                step={1}
                format="px"
              />
              <SliderField
                label="Subtitle Size"
                value={typography.subtitleFontSize}
                onValueChange={(v) => updateTypography({ subtitleFontSize: v })}
                min={10}
                max={24}
                step={1}
                format="px"
                disabled={!typography.includeFunFacts}
              />
              {headerAssembly.enabled && (
                <SliderField
                  label="Number Size"
                  value={
                    headerAssembly.number.fontSizePt > 0
                      ? headerAssembly.number.fontSizePt
                      : typography.puzzleTitleFontSize
                  }
                  onValueChange={(v) =>
                    updateHeaderAssembly({
                      number: { ...headerAssembly.number, fontSizePt: v },
                    })
                  }
                  min={8}
                  max={50}
                  step={1}
                  format="px"
                />
              )}
            </div>

            <Label className="canvas-context-panel__section-label">Colors</Label>
            <div className="canvas-context-panel__grid-2">
              <MiniColorInput
                label="Title color"
                value={colors.puzzlePage.titleColor || '#1f2937'}
                onChange={(v) => updatePuzzlePageColors({ titleColor: v })}
              />
              <MiniColorInput
                label="Subtitle color"
                value={colors.puzzlePage.subtitleColor || '#6b7280'}
                onChange={(v) => updatePuzzlePageColors({ subtitleColor: v })}
              />
              {headerAssembly.enabled && (
                <MiniColorInput
                  label="Number color"
                  value={headerAssembly.number.textColor}
                  onChange={(v) =>
                    updateHeaderAssembly({
                      number: { ...headerAssembly.number, textColor: v },
                    })
                  }
                />
              )}
            </div>

            <Label className="canvas-context-panel__section-label">Subtitle Font</Label>
            <Select
              value={typography.subtitleFontFamily || typography.puzzleTitleFontFamily}
              onValueChange={(value) => updateTypography({ subtitleFontFamily: value })}
              disabled={!typography.includeFunFacts && !headerAssembly.enabled}
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

            <Label className="canvas-context-panel__section-label">Title Spacing</Label>
            <div className="canvas-context-panel__grid-2">
              <SliderField
                label="Title Start At"
                value={typography.titleStartAt}
                onValueChange={(v) => updateTypography({ titleStartAt: v })}
                min={0}
                max={200}
                step={1}
                format="px"
              />
              <SliderField
                label="Title to Puzzle"
                value={typography.subtitleToTitleGap}
                onValueChange={(v) => updateTypography({ subtitleToTitleGap: v })}
                min={0}
                max={100}
                step={1}
                format="px"
                disabled={!typography.includeFunFacts && !headerAssembly.enabled}
              />
              <SliderField
                label="Subtitle Box Margin"
                value={typography.subtitleBoxMargin}
                onValueChange={(v) => updateTypography({ subtitleBoxMargin: v })}
                min={0}
                max={100}
                step={1}
                format="pt"
                disabled={!typography.includeFunFacts}
              />
            </div>

            <Label className="canvas-context-panel__section-label">Header Assembly</Label>
            <div className="canvas-context-panel__card">
              <div className="flex items-center gap-2 mb-2">
                <Checkbox
                  id="canvas-header-assembly"
                  checked={headerAssembly.enabled}
                  onCheckedChange={(checked) => updateHeaderAssembly({ enabled: checked === true })}
                />
                <Label htmlFor="canvas-header-assembly" className="text-xs font-normal cursor-pointer">
                  Modular header shapes
                </Label>
              </div>
              {headerAssembly.enabled && (
                <HeaderAssemblyEditor value={headerAssembly} onChange={updateHeaderAssembly} />
              )}
            </div>
          </div>
        )}

        {target === 'grid' && (
          <div className="canvas-context-panel__section">
            <Label className="canvas-context-panel__section-label">Grid Scale</Label>
            <div className="flex items-center gap-1 border border-slate-200 rounded-md mb-3">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 px-2"
                onClick={() => setPuzzleGridScale(Math.max(puzzleGridScale - 10, 50))}
              >
                −
              </Button>
              <span className="flex-1 text-center text-xs font-semibold">{puzzleGridScale}%</span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 px-2"
                onClick={() => setPuzzleGridScale(Math.min(puzzleGridScale + 10, 200))}
              >
                +
              </Button>
            </div>

            <Label className="canvas-context-panel__section-label">Grid Size</Label>
            <div className="canvas-context-panel__grid-2">
              <SliderField
                label="Letters Across"
                value={core.lettersAcross}
                onValueChange={(v) => updateCore({ lettersAcross: v })}
                min={8}
                max={30}
                step={1}
              />
              <SliderField
                label="Letters Down"
                value={core.lettersDown}
                onValueChange={(v) => updateCore({ lettersDown: v })}
                min={8}
                max={30}
                step={1}
              />
            </div>

            <Label className="canvas-context-panel__section-label">Word Directions</Label>
            <div className="canvas-context-panel__direction-grid">
              <DirectionToggle label="Right" icon={ArrowRight} checked={core.allowRight} onCheckedChange={(v) => updateCore({ allowRight: v })} />
              <DirectionToggle label="Left" icon={ArrowLeft} checked={core.allowLeft} onCheckedChange={(v) => updateCore({ allowLeft: v })} />
              <DirectionToggle label="Down" icon={ArrowDown} checked={core.allowDown} onCheckedChange={(v) => updateCore({ allowDown: v })} />
              <DirectionToggle label="Up" icon={ArrowUp} checked={core.allowUp} onCheckedChange={(v) => updateCore({ allowUp: v })} />
              <DirectionToggle label="Diagonal down" icon={ArrowDownRight} checked={core.allowDiagonalDown} onCheckedChange={(v) => updateCore({ allowDiagonalDown: v })} />
              <DirectionToggle label="Diagonal up" icon={ArrowUpRight} checked={core.allowDiagonalUp} onCheckedChange={(v) => updateCore({ allowDiagonalUp: v })} />
              <DirectionToggle label="Diagonal down reverse" icon={ArrowUpLeft} checked={core.allowDiagonalDownReverse} onCheckedChange={(v) => updateCore({ allowDiagonalDownReverse: v })} />
              <DirectionToggle label="Diagonal up reverse" icon={ArrowDownLeft} checked={core.allowDiagonalUpReverse} onCheckedChange={(v) => updateCore({ allowDiagonalUpReverse: v })} />
            </div>

            <Label className="canvas-context-panel__section-label">Grid Letters</Label>
            <Select
              value={typography.puzzleGridFontFamily}
              onValueChange={(value) => updateTypography({ puzzleGridFontFamily: value })}
            >
              <SelectTrigger className="h-8 text-xs mb-2">
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
            <div className="canvas-context-panel__grid-2">
              <SliderField
                label="Grid Font Size"
                value={typography.puzzleGridFontSize}
                onValueChange={(v) => updateTypography({ puzzleGridFontSize: v })}
                min={8}
                max={50}
                step={1}
                format="pt"
              />
              <div>
                <Label className="text-xs text-gray-500 mb-1 block">Letter Case</Label>
                <Select
                  value={typography.puzzleGridCase}
                  onValueChange={(value) => updateTypography({ puzzleGridCase: value as 'upper' | 'lower' })}
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="upper">UPPERCASE</SelectItem>
                    <SelectItem value="lower">lowercase</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Label className="canvas-context-panel__section-label">Puzzle Grid Border</Label>
            <div className="canvas-context-panel__grid-2">
              <SliderField
                label="Border Thickness"
                value={core.borderStrokeThickness}
                onValueChange={(v) => updateCore({ borderStrokeThickness: v })}
                min={1}
                max={10}
                step={1}
                format="px"
              />
              <SliderField
                label="Corner Radius"
                value={core.borderCornerRadius}
                onValueChange={(v) => updateCore({ borderCornerRadius: v })}
                min={0}
                max={40}
                step={1}
                format="px"
              />
              <SliderField
                label="Border Padding"
                value={core.gridBorderPadding}
                onValueChange={(v) => updateCore({ gridBorderPadding: v })}
                min={0}
                max={40}
                step={1}
                format="px"
              />
            </div>
          </div>
        )}

        {target === 'word-list' && (
          <div className="canvas-context-panel__section">
            <Label className="canvas-context-panel__section-label">Formatting</Label>
            <Select
              value={wordList.wordListFontFamily}
              onValueChange={(value) => updateWordListSettings({ wordListFontFamily: value })}
            >
              <SelectTrigger className="h-8 text-xs mb-2">
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
            <div className="canvas-context-panel__grid-2">
              <SliderField
                label="Font Size"
                value={wordList.wordListFontSize}
                onValueChange={(v) => updateWordListSettings({ wordListFontSize: v })}
                min={8}
                max={50}
                step={1}
                format="px"
              />
              <div>
                <Label className="text-xs text-gray-500 mb-1 block">Case</Label>
                <Select
                  value={wordList.wordListCase}
                  onValueChange={(value) =>
                    updateWordListSettings({ wordListCase: value as 'upper' | 'lower' | 'title' })
                  }
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="upper">UPPERCASE</SelectItem>
                    <SelectItem value="lower">lowercase</SelectItem>
                    <SelectItem value="title">Title Case</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Label className="canvas-context-panel__section-label">Spacing</Label>
            <SliderField
              label="Puzzle to Word List"
              value={typography.spaceBetweenPuzzleAndWordList}
              onValueChange={(v) => updateTypography({ spaceBetweenPuzzleAndWordList: v })}
              min={0}
              max={100}
              step={1}
              format="px"
            />

            <Label className="canvas-context-panel__section-label">Layout</Label>
            <div className="canvas-context-panel__grid-2">
              <div>
                <Label className="text-xs text-gray-500 mb-1 block">Columns</Label>
                <Select
                  value={wordList.wordListColumns.toString()}
                  onValueChange={(value) => updateWordListSettings({ wordListColumns: parseInt(value, 10) })}
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[1, 2, 3, 4].map((n) => (
                      <SelectItem key={n} value={n.toString()}>
                        {n} col{n > 1 ? 's' : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <SliderField
                label="Space Horizontal"
                value={wordList.wordSpacingHorizontal ?? 50}
                onValueChange={(v) => updateWordListSettings({ wordSpacingHorizontal: v })}
                min={0}
                max={100}
                step={1}
                format="px"
              />
              <SliderField
                label="Space Vertical"
                value={wordList.wordSpacingVertical ?? 8}
                onValueChange={(v) => updateWordListSettings({ wordSpacingVertical: v })}
                min={0}
                max={40}
                step={1}
                format="px"
              />
            </div>

            <Label className="canvas-context-panel__section-label">Options</Label>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="canvas-checkboxes"
                  checked={wordList.addCheckboxes}
                  onCheckedChange={(checked) => updateWordListSettings({ addCheckboxes: checked === true })}
                />
                <Label htmlFor="canvas-checkboxes" className="text-xs font-normal cursor-pointer">
                  Add checkboxes
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="canvas-no-alpha"
                  checked={wordList.dontAlphabetize}
                  onCheckedChange={(checked) => updateWordListSettings({ dontAlphabetize: checked === true })}
                />
                <Label htmlFor="canvas-no-alpha" className="text-xs font-normal cursor-pointer">
                  Don&apos;t alphabetize
                </Label>
              </div>
            </div>

            {pageKind === 'puzzle' && (
              <CanvasPageWordListEditor
                pageIndex={pageIndex}
                draftTitleWords={draftTitleWords}
                onDraftTitleWordsChange={onDraftTitleWordsChange}
                draftWordListSettings={wordList}
                onDraftWordListSettingsChange={(nextWordList) =>
                  applySettingsUpdate({ wordList: nextWordList })
                }
              />
            )}
          </div>
        )}

        {target === 'page-number' && (
          <div className="canvas-context-panel__section">
            <div className="flex items-center gap-2 mb-2">
              <Checkbox
                id="canvas-page-number-enabled"
                checked={pageNumber.enabled}
                onCheckedChange={(checked) => updatePageNumber({ enabled: !!checked })}
              />
              <Label htmlFor="canvas-page-number-enabled" className="text-xs font-normal cursor-pointer">
                Show page number
              </Label>
            </div>

            {pageNumber.enabled && (
              <>
                <div className="canvas-context-panel__grid-2">
                  <div className="space-y-1">
                    <Label className="text-xs text-gray-500">Start numbering from</Label>
                    <Input
                      type="number"
                      min={0}
                      className="h-8 text-xs"
                      value={pageNumber.startNumberingFrom}
                      onChange={(e) =>
                        updatePageNumber({ startNumberingFrom: Number(e.target.value) || 1 })
                      }
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-gray-500">Start at page</Label>
                    <Input
                      type="number"
                      min={1}
                      className="h-8 text-xs"
                      value={pageNumber.startAtPage}
                      onChange={(e) => updatePageNumber({ startAtPage: Number(e.target.value) || 1 })}
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs text-gray-500">Position</Label>
                  <Select
                    value={pageNumber.position}
                    onValueChange={(value) =>
                      updatePageNumber({ position: value as PageNumberSettings['position'] })
                    }
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="bottom-center">Bottom centre</SelectItem>
                      <SelectItem value="bottom-left">Bottom left</SelectItem>
                      <SelectItem value="bottom-right">Bottom right</SelectItem>
                      <SelectItem value="alternating">Alternating</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="canvas-context-panel__grid-2">
                  <SliderField
                    label="Bottom offset"
                    value={pageNumber.bottomOffsetPx}
                    onValueChange={(v) => updatePageNumber({ bottomOffsetPx: v })}
                    min={0}
                    max={80}
                    step={1}
                    format="px"
                  />
                  <SliderField
                    label="Side offset"
                    value={pageNumber.sideOffsetPx}
                    onValueChange={(v) => updatePageNumber({ sideOffsetPx: v })}
                    min={0}
                    max={80}
                    step={1}
                    format="px"
                    disabled={pageNumber.position === 'bottom-center'}
                  />
                </div>

                <PageNumberShapeEditor
                  shape={pageNumber.shape}
                  textColor={pageNumber.textColor}
                  fontFamily={pageNumber.fontFamily}
                  fontSize={pageNumber.fontSize}
                  fontOptions={PUBLISHING_FONTS}
                  onShapeChange={(patch) =>
                    updatePageNumber({ shape: { ...pageNumber.shape, ...patch } })
                  }
                  onTextColorChange={(v) => updatePageNumber({ textColor: v })}
                  onFontFamilyChange={(v) => updatePageNumber({ fontFamily: v })}
                  onFontSizeChange={(v) => updatePageNumber({ fontSize: v })}
                />
              </>
            )}
          </div>
        )}

        {target === 'page-background' && (
          <div className="canvas-context-panel__section">
            <Label className="canvas-context-panel__section-label">Page Frame</Label>
            <div className="canvas-context-panel__card space-y-3">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="canvas-page-frame-enabled"
                  checked={pageFrame.enabled}
                  onCheckedChange={(checked) => updatePageFrameSettings({ enabled: !!checked })}
                />
                <Label htmlFor="canvas-page-frame-enabled" className="text-xs font-normal cursor-pointer">
                  Enable page container frame
                </Label>
              </div>
              {pageFrame.enabled && (
                <>
                  <SliderField
                    label="Frame Margin"
                    value={pageFrame.marginSizeIn}
                    onValueChange={(v) => updatePageFrameSettings({ marginSizeIn: v })}
                    min={0.5}
                    max={1}
                    step={0.0625}
                    format="inches"
                  />
                  <div className="canvas-context-panel__grid-2">
                    <SliderField
                      label="Corner Radius"
                      value={pageFrame.cornerRadiusPx}
                      onValueChange={(v) => updatePageFrameSettings({ cornerRadiusPx: v })}
                      min={0}
                      max={40}
                      step={1}
                      format="px"
                    />
                    <SliderField
                      label="Stroke"
                      value={pageFrame.strokeThicknessPx}
                      onValueChange={(v) => updatePageFrameSettings({ strokeThicknessPx: v })}
                      min={1}
                      max={10}
                      step={1}
                      format="px"
                    />
                  </div>
                  <MiniColorInput
                    label="Frame color"
                    value={pageFrame.borderColor}
                    onChange={(v) => updatePageFrameSettings({ borderColor: v })}
                  />
                </>
              )}
            </div>

            <Label className="canvas-context-panel__section-label">
              {pageKind === 'solution' ? 'Solution Page' : 'Puzzle Page'}
            </Label>
            {pageKind === 'solution' ? (
              <>
                <MiniColorInput
                  label="Background"
                  value={colors.answerPage.backgroundColor || '#ffffff'}
                  onChange={(v) => updateAnswerPageColors({ backgroundColor: v })}
                />
                <CanvasBackgroundImageControl
                  label="Solution Page"
                  image={colors.answerPage.backgroundImage}
                  opacity={colors.answerPage.backgroundImageOpacity}
                  fit={colors.answerPage.backgroundImageFit}
                  onImageChange={(base64) => updateAnswerPageColors({ backgroundImage: base64 })}
                  onOpacityChange={(v) => updateAnswerPageColors({ backgroundImageOpacity: v })}
                  onFitChange={(v) => updateAnswerPageColors({ backgroundImageFit: v })}
                  onRemove={() => updateAnswerPageColors({ backgroundImage: undefined })}
                />
              </>
            ) : (
              <>
                <MiniColorInput
                  label="Background"
                  value={colors.puzzlePage.backgroundColor || '#ffffff'}
                  onChange={(v) => updatePuzzlePageColors({ backgroundColor: v })}
                />
                <CanvasBackgroundImageControl
                  label="Puzzle Page"
                  image={colors.puzzlePage.backgroundImage}
                  opacity={colors.puzzlePage.backgroundImageOpacity}
                  fit={colors.puzzlePage.backgroundImageFit}
                  onImageChange={(base64) => updatePuzzlePageColors({ backgroundImage: base64 })}
                  onOpacityChange={(v) => updatePuzzlePageColors({ backgroundImageOpacity: v })}
                  onFitChange={(v) => updatePuzzlePageColors({ backgroundImageFit: v })}
                  onRemove={() => updatePuzzlePageColors({ backgroundImage: undefined })}
                />
              </>
            )}
          </div>
        )}

        {target === 'solution-title' && (
          <div className="canvas-context-panel__section">
            <Label className="canvas-context-panel__section-label">Title Font</Label>
            <Select
              value={colors.answerPage.answerTitleFontFamily || typography.puzzleTitleFontFamily}
              onValueChange={(value) => updateAnswerPageColors({ answerTitleFontFamily: value })}
            >
              <SelectTrigger className="h-8 text-xs mb-2">
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
            <div className="canvas-context-panel__grid-2">
              <SliderField
                label="Title Size"
                value={colors.answerPage.answerTitleFontSize || 20}
                onValueChange={(v) => updateAnswerPageColors({ answerTitleFontSize: v })}
                min={8}
                max={50}
                step={1}
                format="px"
              />
              <div>
                <Label className="text-xs text-gray-500 mb-1 block">Alignment</Label>
                <Select
                  value={colors.answerPage.answerTitleAlignment || 'center'}
                  onValueChange={(value) =>
                    updateAnswerPageColors({
                      answerTitleAlignment: value as 'left' | 'center' | 'right',
                    })
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

            <MiniColorInput
              label="Title color"
              value={colors.answerPage.titleColor || '#000000'}
              onChange={(v) => updateAnswerPageColors({ titleColor: v })}
            />

            <Label className="canvas-context-panel__section-label">Title Style</Label>
            <Select
              value={typography.solutionTitleStyle}
              onValueChange={(value) => {
                if (value === 'same_as_puzzle') {
                  updateTypography({ solutionTitleStyle: value as 'same_as_puzzle' | 'custom', solutionNumberingStyle: 'none' });
                } else {
                  updateTypography({ solutionTitleStyle: value as 'same_as_puzzle' | 'custom' });
                }
              }}
            >
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="same_as_puzzle">Same as Puzzle</SelectItem>
                <SelectItem value="custom">Custom Title</SelectItem>
              </SelectContent>
            </Select>

            {typography.solutionTitleStyle === 'custom' && (
              <>
                <Input
                  className="h-8 text-xs"
                  value={typography.customSolutionTitle || ''}
                  onChange={(e) => updateTypography({ customSolutionTitle: e.target.value })}
                  placeholder="Custom solution title..."
                />
                <Select
                  value={typography.solutionNumberingStyle}
                  onValueChange={(value) =>
                    updateTypography({ solutionNumberingStyle: value as 'none' | 'prefix' | 'suffix' })
                  }
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No numbering</SelectItem>
                    <SelectItem value="prefix">Prefix (1. Title)</SelectItem>
                    <SelectItem value="suffix">Suffix (Title #1)</SelectItem>
                  </SelectContent>
                </Select>
              </>
            )}
          </div>
        )}

        {target === 'solution-grid' && (
          <div className="canvas-context-panel__section">
            <Label className="canvas-context-panel__section-label">Layout</Label>
            <div>
              <Label className="text-xs text-gray-500 mb-1 block">Answers Per Page</Label>
              <Select
                value={bookCanvas.answersPerPage.toString()}
                onValueChange={(value) => updateBookCanvas({ answersPerPage: parseInt(value, 10) })}
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[1, 2, 4].map((n) => (
                    <SelectItem key={n} value={n.toString()}>
                      {n} Solution{n > 1 ? 's' : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <SliderField
              label="Solution font size"
              value={typography.answerGridFontSize}
              onValueChange={(v) =>
                updateTypography({ answerGridFontSize: v, setFontSizeForAnswerPages: true })
              }
              min={8}
              max={50}
              step={1}
              format="pt"
            />

            <Label className="canvas-context-panel__section-label">Solution Marking</Label>
            <MiniColorInput
              label="Highlight color"
              value={colors.answerPage.solutionFrameColor || '#22c55e'}
              onChange={(v) => updateAnswerPageColors({ solutionFrameColor: v })}
            />
            <div className="canvas-context-panel__grid-2">
              <SliderField
                label="Stroke thickness"
                value={colors.answerPage.solutionStrokeThickness || 12}
                onValueChange={(v) => updateAnswerPageColors({ solutionStrokeThickness: v })}
                min={1}
                max={15}
                step={1}
                format="px"
              />
              <SliderField
                label="Transparency"
                value={colors.answerPage.solutionHighlightAlpha ?? 30}
                onValueChange={(v) => updateAnswerPageColors({ solutionHighlightAlpha: v })}
                min={0}
                max={100}
                step={1}
                format="percent"
              />
            </div>

            <Label className="canvas-context-panel__section-label">Solution Grid Border</Label>
            <MiniColorInput
              label="Border color"
              value={colors.answerPage.boxColor || '#1f2937'}
              onChange={(v) => updateAnswerPageColors({ boxColor: v })}
            />
            <div className="canvas-context-panel__grid-2">
              <SliderField
                label="Border thickness"
                value={core.solutionBorderStrokeThickness ?? core.borderStrokeThickness}
                onValueChange={(v) => updateCore({ solutionBorderStrokeThickness: v })}
                min={1}
                max={10}
                step={1}
                format="px"
              />
              <SliderField
                label="Corner radius"
                value={core.solutionBorderCornerRadius ?? core.borderCornerRadius}
                onValueChange={(v) => updateCore({ solutionBorderCornerRadius: v })}
                min={0}
                max={40}
                step={1}
                format="px"
              />
              <SliderField
                label="Border padding"
                value={core.solutionGridBorderPadding}
                onValueChange={(v) => updateCore({ solutionGridBorderPadding: v })}
                min={0}
                max={40}
                step={1}
                format="px"
              />
            </div>
          </div>
        )}
    </FloatingPanelShell>
  );
}

function DirectionToggle({
  label,
  icon: Icon,
  checked,
  onCheckedChange,
}: {
  label: string;
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={checked}
      title={checked ? `${label} (enabled)` : `${label} (disabled)`}
      onClick={() => onCheckedChange(!checked)}
      className={cn('direction-toggle', checked && 'direction-toggle--active')}
    >
      <Icon strokeWidth={2.25} />
    </button>
  );
}
