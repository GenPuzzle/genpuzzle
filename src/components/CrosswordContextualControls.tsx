'use client';

import React from 'react';
import { RefreshCw, X } from 'lucide-react';
import { useApp } from '@/lib/app-context';
import { FloatingPanelShell } from '@/components/FloatingPanelShell';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { SliderField } from '@/components/ui/slider-field';
import { IntegerInput } from '@/components/ui/integer-input';
import { SettingsTextInput, SettingsTextarea } from '@/components/ui/settings-text-input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { MiniColorInput } from '@/components/ui/color-input';
import { PUBLISHING_FONTS } from '@/lib/publishing-fonts';
import type {
  CrosswordClueLayout,
  CrosswordNumberingStyle,
  CrosswordSettings,
  CrosswordSolutionTitleStyle,
  CrosswordTitleOption,
} from '@/lib/crossword-settings';
import { greyscaleToCss, normalizeCrosswordSettings } from '@/lib/crossword-settings';
import './canvas-contextual-controls.css';

export type CrosswordEditTarget =
  | 'title'
  | 'clues'
  | 'numbering'
  | 'solutions'
  | 'colors'
  | 'page-frame';

const TARGET_TITLES: Record<CrosswordEditTarget, string> = {
  title: 'Title',
  clues: 'Clues',
  numbering: 'Grid & Numbers',
  solutions: 'Solutions',
  colors: 'Colors',
  'page-frame': 'Frame',
};

export type CrosswordContextualControlsProps = {
  settings: CrosswordSettings;
  activeTarget: CrosswordEditTarget;
  onTargetChange: (target: CrosswordEditTarget) => void;
  onSettingsChange: (updates: Partial<CrosswordSettings>) => void;
  onClose: () => void;
  variant?: 'floating' | 'sidebar';
  onCommitPage?: () => void;
  onCommitAll?: () => void;
  onCommitRange?: (range: string) => void;
  hasUnsavedChanges?: boolean;
  canApplyToAllPages?: boolean;
  documentPuzzleCount?: number;
  rangeError?: string | null;
  canApplyToSelectedPages?: (range: string) => boolean;
};

function CrosswordEditActions({
  onCommitPage,
  onCommitAll,
  onCommitRange,
  onCancel,
  hasUnsavedChanges,
  canApplyToAllPages,
  documentPuzzleCount = 0,
  rangeError = null,
  canApplyToSelectedPages,
}: {
  onCommitPage?: () => void;
  onCommitAll?: () => void;
  onCommitRange?: (range: string) => void;
  onCancel: () => void;
  hasUnsavedChanges?: boolean;
  canApplyToAllPages?: boolean;
  documentPuzzleCount?: number;
  rangeError?: string | null;
  canApplyToSelectedPages?: (range: string) => boolean;
}) {
  const [rangeInput, setRangeInput] = React.useState('');
  const showRangeSelect = documentPuzzleCount > 1 && !!onCommitRange;
  const rangeApplyEnabled =
    rangeInput.trim().length > 0 &&
    (canApplyToSelectedPages ? canApplyToSelectedPages(rangeInput) : true);

  return (
    <div className="canvas-context-panel__footer">
      {onCommitPage && (
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
          <Label htmlFor="crossword-edit-range" className="canvas-context-panel__footer-range-label">
            Range select
          </Label>
          <Input
            id="crossword-edit-range"
            value={rangeInput}
            onChange={(event) => setRangeInput(event.target.value)}
            placeholder="e.g. 1-4, 7-10, 12"
            className="canvas-context-panel__footer-range-input"
            onKeyDown={(event) => {
              if (event.key === 'Enter' && rangeApplyEnabled && onCommitRange) {
                event.preventDefault();
                onCommitRange(rangeInput);
              }
            }}
          />
          {rangeError && (
            <p className="canvas-context-panel__footer-range-error">{rangeError}</p>
          )}
          <Button
            type="button"
            size="sm"
            className="canvas-context-panel__footer-btn canvas-context-panel__footer-btn--range"
            onClick={() => onCommitRange?.(rangeInput)}
            disabled={!rangeApplyEnabled}
          >
            Apply to range pages
          </Button>
        </div>
      )}
      {onCommitAll && (
        <Button
          type="button"
          size="sm"
          className="canvas-context-panel__footer-btn canvas-context-panel__footer-btn--all"
          onClick={onCommitAll}
          disabled={!canApplyToAllPages}
        >
          Apply to all pages
        </Button>
      )}
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="canvas-context-panel__footer-btn canvas-context-panel__footer-btn--cancel"
        onClick={onCancel}
      >
        Cancel
      </Button>
    </div>
  );
}

/**
 * Crossword visual styling / per-page layout (mirrors Word Search canvas controls).
 */
export function CrosswordContextualControls({
  settings,
  activeTarget,
  onTargetChange,
  onSettingsChange,
  onClose,
  variant = 'floating',
  onCommitPage,
  onCommitAll,
  onCommitRange,
  hasUnsavedChanges = false,
  canApplyToAllPages = false,
  documentPuzzleCount = 0,
  rangeError = null,
  canApplyToSelectedPages,
}: CrosswordContextualControlsProps) {
  const { generatePuzzle } = useApp();
  const [isRegenerating, setIsRegenerating] = React.useState(false);

  const handleRegenerate = async () => {
    setIsRegenerating(true);
    try {
      await generatePuzzle();
    } finally {
      setIsRegenerating(false);
    }
  };

  const normalized = normalizeCrosswordSettings(settings);
  const { typography, colors, pageFrameSettings, bookCanvas, core } = normalized;
  const frame = pageFrameSettings ?? {
    enabled: true,
    marginSizeIn: 0.5,
    cornerRadiusPx: 0,
    strokeThicknessPx: 1,
    borderColor: '#cccccc',
  };

  const patchTypography = (patch: Partial<CrosswordSettings['typography']>) => {
    onSettingsChange({ typography: { ...typography, ...patch } });
  };

  const patchColors = (patch: Partial<CrosswordSettings['colors']>) => {
    onSettingsChange({ colors: { ...colors, ...patch } });
  };

  const patchFrame = (patch: Partial<typeof frame>) => {
    onSettingsChange({ pageFrameSettings: { ...frame, ...patch } });
  };

  const patchBookCanvas = (patch: Partial<CrosswordSettings['bookCanvas']>) => {
    onSettingsChange({ bookCanvas: { ...bookCanvas, ...patch } });
  };

  const patchCore = (patch: Partial<CrosswordSettings['core']>) => {
    onSettingsChange({ core: { ...core, ...patch } });
  };

  const titleOptionValue =
    typography.selectTitleOption === 'title-number'
      ? 'one-custom-title'
      : typography.selectTitleOption === 'different-titles'
        ? 'custom'
        : typography.selectTitleOption;

  const body = (
      <div className={variant === 'sidebar' ? 'space-y-3 p-1' : 'space-y-3 p-1 max-h-[70vh] overflow-y-auto'}>
        {activeTarget === 'title' && (
          <>
            <div className="canvas-context-panel__section space-y-2">
              <Label className="canvas-context-panel__section-label">Title Settings</Label>
              <div className="canvas-context-panel__card space-y-3">
                <div className="space-y-1">
                  <Label className="text-xs text-slate-500">Title Option</Label>
                  <Select
                    value={titleOptionValue}
                    onValueChange={(v) =>
                      patchTypography({ selectTitleOption: v as CrosswordTitleOption })
                    }
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="one-custom-title">One Custom Title</SelectItem>
                      <SelectItem value="custom">Custom Title Per Puzzle</SelectItem>
                      <SelectItem value="none">No Title</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {(titleOptionValue === 'custom') ? (
                  <div className="space-y-1">
                    <Label className="text-xs text-slate-500">Titles (one per line)</Label>
                    <SettingsTextarea
                      className="w-full min-h-[80px] rounded-md border border-slate-200 px-2 py-1.5 text-xs"
                      value={typography.titleText || typography.differentTitles}
                      onChange={(v) =>
                        patchTypography({
                          titleText: v,
                          differentTitles: v,
                        })
                      }
                      placeholder={'1. Animals\n2. Ocean'}
                    />
                  </div>
                ) : titleOptionValue !== 'none' ? (
                  <div className="space-y-1">
                    <Label className="text-xs text-slate-500">Title Text</Label>
                    <SettingsTextInput
                      className="h-8 text-xs"
                      value={typography.titleText}
                      onChange={(v) => patchTypography({ titleText: v })}
                    />
                  </div>
                ) : null}

                {titleOptionValue !== 'none' && (
                  <div className="space-y-1">
                    <Label className="text-xs text-slate-500">Puzzle Numbering Style</Label>
                    <Select
                      value={typography.puzzleNumberingStyle}
                      onValueChange={(v) =>
                        patchTypography({ puzzleNumberingStyle: v as CrosswordNumberingStyle })
                      }
                    >
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">None</SelectItem>
                        <SelectItem value="prefix">Prefix (1. Title)</SelectItem>
                        <SelectItem value="suffix">Suffix (Title #1)</SelectItem>
                      </SelectContent>
                    </Select>
                    {titleOptionValue === 'custom' &&
                      typography.puzzleNumberingStyle === 'none' && (
                        <p className="text-[11px] text-slate-500">
                          Type numbers in each title line if you want them (e.g.
                          &quot;1. Animals&quot;).
                        </p>
                      )}
                  </div>
                )}

                <div className="space-y-1">
                  <Label className="text-xs text-slate-500">Font</Label>
                  <Select
                    value={typography.puzzleTitleFontFamily}
                    onValueChange={(v) => patchTypography({ puzzleTitleFontFamily: v })}
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
                  label="Font Size — Puzzle Pages"
                  value={typography.puzzleTitleFontSize}
                  onValueChange={(v) => patchTypography({ puzzleTitleFontSize: v })}
                  min={0}
                  max={40}
                  step={1}
                />
                <SliderField
                  label="Font Size — Answer Pages"
                  value={typography.answerTitleFontSize}
                  onValueChange={(v) => patchTypography({ answerTitleFontSize: v })}
                  min={0}
                  max={40}
                  step={1}
                />
                <SliderField
                  label="Start Title At (in)"
                  value={typography.titleStartAt}
                  onValueChange={(v) => patchTypography({ titleStartAt: v })}
                  min={0}
                  max={2}
                  step={0.1}
                  format="inches"
                />
                <SliderField
                  label="Space Between Title & Puzzle"
                  value={typography.spaceBetweenTitleAndPuzzle}
                  onValueChange={(v) => patchTypography({ spaceBetweenTitleAndPuzzle: v })}
                  min={0}
                  max={2}
                  step={0.1}
                  format="inches"
                />
                <SliderField
                  label="Space Between Puzzle & Clues"
                  value={typography.spaceBetweenPuzzleAndClues}
                  onValueChange={(v) => patchTypography({ spaceBetweenPuzzleAndClues: v })}
                  min={0}
                  max={2}
                  step={0.1}
                  format="inches"
                />

                <label className="flex items-center gap-2 text-xs cursor-pointer">
                  <Checkbox
                    checked={typography.includeFunFacts}
                    onCheckedChange={(c) => patchTypography({ includeFunFacts: c === true })}
                  />
                  Subtitle / Fun Facts
                </label>
                {typography.includeFunFacts && (
                  <>
                    <textarea
                      className="w-full min-h-[64px] rounded-md border border-slate-200 px-2 py-1.5 text-xs"
                      value={typography.funFactsText}
                      onChange={(e) => patchTypography({ funFactsText: e.target.value })}
                      placeholder="One subtitle per line"
                    />
                    <SliderField
                      label="Subtitle Font Size"
                      value={typography.subtitleFontSize}
                      onValueChange={(v) => patchTypography({ subtitleFontSize: v })}
                      min={0}
                      max={24}
                      step={1}
                    />
                  </>
                )}
              </div>
            </div>
          </>
        )}

        {activeTarget === 'clues' && (
          <div className="canvas-context-panel__section space-y-2">
            <Label className="canvas-context-panel__section-label">Clue Settings</Label>
            <div className="canvas-context-panel__card space-y-3">
              <div className="space-y-1">
                <Label className="text-xs text-slate-500">Clue Font</Label>
                <Select
                  value={typography.clueFontFamily}
                  onValueChange={(v) => patchTypography({ clueFontFamily: v })}
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
                label="Clue Font Size"
                value={typography.clueFontSize}
                onValueChange={(v) => patchTypography({ clueFontSize: v })}
                min={0}
                max={40}
                step={1}
              />
              <SliderField
                label="Space Vertical (between clues)"
                value={typography.clueSpaceVertical ?? 4}
                onValueChange={(v) => patchTypography({ clueSpaceVertical: v })}
                min={0}
                max={40}
                step={1}
                format="px"
              />
              <SliderField
                label="Space Horizontal (column gap)"
                value={typography.clueSpaceHorizontal ?? 24}
                onValueChange={(v) => patchTypography({ clueSpaceHorizontal: v })}
                min={0}
                max={80}
                step={1}
                format="px"
              />
              <div className="space-y-1">
                <Label className="text-xs text-slate-500">Across / Down Font</Label>
                <Select
                  value={typography.acrossDownFontFamily}
                  onValueChange={(v) => patchTypography({ acrossDownFontFamily: v })}
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
                label="Across / Down Font Size"
                value={typography.acrossDownFontSize}
                onValueChange={(v) => patchTypography({ acrossDownFontSize: v })}
                min={0}
                max={40}
                step={1}
              />
              <div className="space-y-1">
                <Label className="text-xs text-slate-500">Clue Layout</Label>
                <Select
                  value={typography.clueLayout}
                  onValueChange={(v) => patchTypography({ clueLayout: v as CrosswordClueLayout })}
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="single">Single column</SelectItem>
                    <SelectItem value="double">Double column</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        )}

        {activeTarget === 'solutions' && (
          <div className="canvas-context-panel__section space-y-2">
            <Label className="canvas-context-panel__section-label">Layout</Label>
            <div className="canvas-context-panel__card space-y-3">
              <div className="space-y-1">
                <Label className="text-xs text-slate-500">Answers Per Page</Label>
                <Select
                  value={(bookCanvas.answersPerPage || 1).toString()}
                  onValueChange={(value) =>
                    patchBookCanvas({ answersPerPage: parseInt(value, 10) })
                  }
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

              <Label className="canvas-context-panel__section-label">
                Solution Page Layout Spacing
              </Label>
              <SliderField
                label="Title to Answer"
                value={typography.titleToAnswerGapPx}
                onValueChange={(v) => patchTypography({ titleToAnswerGapPx: v })}
                min={0}
                max={100}
                step={1}
                format="px"
                control="popover"
              />
              <SliderField
                label="Solution to Solution"
                value={typography.solutionToSolutionGapPx}
                onValueChange={(v) => patchTypography({ solutionToSolutionGapPx: v })}
                min={0}
                max={80}
                step={1}
                format="px"
                control="popover"
              />
              <SliderField
                label="Solution Page Margin"
                value={typography.solutionPageMarginPx}
                onValueChange={(v) => patchTypography({ solutionPageMarginPx: v })}
                min={0}
                max={200}
                step={5}
                format="px"
                control="popover"
              />
              <p className="text-xs text-slate-500">
                Solution Page Margin controls distance from solution page edges only
                (KDP safe zone).
              </p>

              <SliderField
                label="Solution Grid Scale"
                value={core.solutionGridScale}
                onValueChange={(v) => patchCore({ solutionGridScale: v })}
                min={0}
                max={200}
                step={5}
                format="%"
              />
              <SliderField
                label="Solution font size"
                value={typography.gridLetterFontSize}
                onValueChange={(v) => patchTypography({ gridLetterFontSize: v })}
                min={0}
                max={40}
                step={1}
              />

              <div className="space-y-2 pt-2 border-t">
                <Label className="canvas-context-panel__section-label">Answer Key</Label>
                <label className="flex items-center gap-2 text-xs cursor-pointer">
                  <Checkbox
                    checked={typography.showAnswerKey !== false}
                    onCheckedChange={(c) =>
                      patchTypography({ showAnswerKey: c === true })
                    }
                  />
                  Show answers under each solution
                </label>
                <SliderField
                  label="Answer Key Font Size"
                  value={typography.answerKeyFontSize ?? 11}
                  onValueChange={(v) => patchTypography({ answerKeyFontSize: v })}
                  min={0}
                  max={28}
                  step={1}
                  disabled={typography.showAnswerKey === false}
                />
                <p className="text-[10px] text-muted-foreground">
                  Lists Across/Down answers under each solution grid (e.g. 1.WORD  4.WORD).
                </p>
              </div>

              <div className="space-y-1 pt-2 border-t">
                <Label className="text-xs text-slate-500">Solution Title Style</Label>
                <Select
                  value={typography.solutionTitleStyle}
                  onValueChange={(v) => {
                    const next = v as CrosswordSolutionTitleStyle;
                    if (next === 'same_as_puzzle') {
                      patchTypography({
                        solutionTitleStyle: next,
                        solutionNumberingStyle: 'none',
                      });
                    } else {
                      patchTypography({ solutionTitleStyle: next });
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
              </div>
              {typography.solutionTitleStyle === 'custom' && (
                <>
                  <SettingsTextInput
                    className="h-8 text-xs"
                    value={typography.customSolutionTitle}
                    onChange={(v) => patchTypography({ customSolutionTitle: v })}
                    placeholder="Solution"
                  />
                  <Select
                    value={typography.solutionNumberingStyle}
                    onValueChange={(v) =>
                      patchTypography({
                        solutionNumberingStyle: v as CrosswordNumberingStyle,
                      })
                    }
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      <SelectItem value="prefix">Prefix (1. Title)</SelectItem>
                      <SelectItem value="suffix">Suffix (Title #1)</SelectItem>
                    </SelectContent>
                  </Select>
                </>
              )}
            </div>
          </div>
        )}

        {activeTarget === 'numbering' && (
          <div className="canvas-context-panel__section space-y-2">
            <div className="flex items-center justify-between">
              <Label className="canvas-context-panel__section-label">Grid Size</Label>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-7 text-xs gap-1.5 border-sky-300 text-sky-700 hover:bg-sky-50 dark:border-sky-700 dark:text-sky-300 dark:hover:bg-sky-950 font-medium"
                onClick={handleRegenerate}
                disabled={isRegenerating}
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isRegenerating ? 'animate-spin' : ''}`} />
                Regenerate
              </Button>
            </div>
            <div className="canvas-context-panel__card space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-xs text-slate-500">Letters Across</Label>
                  <IntegerInput
                    className="h-8 text-xs"
                    value={core.lettersAcross}
                    onChange={(v) => patchCore({ lettersAcross: v })}
                    min={0}
                    max={30}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-slate-500">Letters Down</Label>
                  <IntegerInput
                    className="h-8 text-xs"
                    value={core.lettersDown}
                    onChange={(v) => patchCore({ lettersDown: v })}
                    min={0}
                    max={30}
                  />
                </div>
              </div>
              <p className="text-[10px] text-muted-foreground">
                Grid is {core.lettersAcross} × {core.lettersDown}. Click regenerate to rebuild
                the crossword with new size or layout.
              </p>
              <Button
                type="button"
                size="sm"
                className="w-full h-8 text-xs font-semibold gap-1.5 bg-sky-600 hover:bg-sky-700 text-white shadow-sm transition-all"
                onClick={handleRegenerate}
                disabled={isRegenerating}
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isRegenerating ? 'animate-spin' : ''}`} />
                Regenerate this puzzle
              </Button>
              <SliderField
                label="Puzzle Grid Scale"
                value={core.puzzleGridScale}
                onValueChange={(v) => patchCore({ puzzleGridScale: v })}
                min={0}
                max={200}
                step={5}
                format="%"
              />
            </div>

            <Label className="canvas-context-panel__section-label">Numbering & Page Numbers</Label>
            <div className="canvas-context-panel__card space-y-3">
              <div className="space-y-1">
                <Label className="text-xs text-slate-500">Number Font</Label>
                <Select
                  value={typography.numberFontFamily}
                  onValueChange={(v) => patchTypography({ numberFontFamily: v })}
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
                label="Font Size (Puzzle)"
                value={typography.numberFontSizePuzzle}
                onValueChange={(v) => patchTypography({ numberFontSizePuzzle: v })}
                min={0}
                max={40}
                step={1}
              />
              <SliderField
                label="Font Size (Answers)"
                value={typography.numberFontSizeAnswers}
                onValueChange={(v) => patchTypography({ numberFontSizeAnswers: v })}
                min={0}
                max={40}
                step={1}
              />
              <label className="flex items-center gap-2 text-xs cursor-pointer">
                <Checkbox
                  checked={typography.includePageNumbers}
                  onCheckedChange={(c) => patchTypography({ includePageNumbers: c === true })}
                />
                Include page numbers
              </label>
            </div>
          </div>
        )}

        {activeTarget === 'colors' && (
          <div className="canvas-context-panel__section space-y-2">
            <Label className="canvas-context-panel__section-label">Colors</Label>
            <p className="text-[11px] text-muted-foreground px-1">
              Defaults avoid pure black (#000) for coloring-page friendly prints.
            </p>
            <div className="canvas-context-panel__card space-y-3">
              {(
                [
                  ['lineColor', 'Boxes Stroke Color'],
                  ['titleColor', 'Title Color'],
                  ['subtitleColor', 'Subtitle Color'],
                  ['cluesColor', 'Clues Color'],
                  ['numbersColor', 'Numbers Color'],
                  ['answersColor', 'Answers Color'],
                  ['hintLettersColor', 'Hint Letters Color'],
                  ['backgroundColor', 'Background'],
                ] as const
              ).map(([key, label]) => (
                <MiniColorInput
                  key={key}
                  label={label}
                  value={colors[key]}
                  onChange={(v) => patchColors({ [key]: v })}
                />
              ))}
              <SliderField
                label="Boxes Stroke Thickness"
                value={colors.lineThicknessPx ?? 1}
                onValueChange={(v) => patchColors({ lineThicknessPx: v })}
                min={0}
                max={8}
                step={0.5}
              />
              <MiniColorInput
                label="Boxes Stroke Color"
                value={colors.lineColor}
                onChange={(v) => patchColors({ lineColor: v })}
              />
              <SliderField
                label="Unused Boxes (white → black)"
                value={colors.blackSquareGreyscale ?? 255}
                onValueChange={(v) => {
                  const greyscale = Math.max(0, Math.min(255, Math.round(v)));
                  patchColors({
                    blackSquareGreyscale: greyscale,
                    blackSquareColor: greyscaleToCss(greyscale),
                    unusedBoxesTransparent: false,
                  });
                }}
                min={0}
                max={255}
                step={1}
                disabled={colors.unusedBoxesTransparent === true}
              />
              <label className="flex items-center gap-2 text-xs cursor-pointer">
                <Checkbox
                  checked={colors.unusedBoxesTransparent === true}
                  onCheckedChange={(c) =>
                    patchColors({ unusedBoxesTransparent: c === true })
                  }
                />
                Make unused boxes transparent
              </label>
              <SliderField
                label="Square Color Range (empty squares)"
                value={colors.squareColorRange}
                onValueChange={(v) => patchColors({ squareColorRange: v })}
                min={0}
                max={255}
                step={1}
              />
              <p className="text-[10px] text-muted-foreground">
                Set to 255 for white empty squares (no shading/fill). Unused box borders match fill.
              </p>
            </div>
          </div>
        )}

        {activeTarget === 'page-frame' && (
          <div className="canvas-context-panel__section space-y-2">
            <Label className="canvas-context-panel__section-label">Page Frame Layout</Label>
            <div className="canvas-context-panel__card space-y-3">
              <label className="flex items-center gap-2 text-xs cursor-pointer">
                <Checkbox
                  checked={frame.enabled}
                  onCheckedChange={(c) => patchFrame({ enabled: c === true })}
                />
                Enable page frame
              </label>
              <SliderField
                label="Margins (in)"
                value={frame.marginSizeIn}
                onValueChange={(v) => patchFrame({ marginSizeIn: v })}
                min={0}
                max={1.5}
                step={0.05}
                format="inches"
                disabled={!frame.enabled}
              />
              <SliderField
                label="Stroke"
                value={frame.strokeThicknessPx}
                onValueChange={(v) => patchFrame({ strokeThicknessPx: v })}
                min={0}
                max={8}
                step={1}
                format="px"
                disabled={!frame.enabled}
              />
              <MiniColorInput
                label="Frame Color"
                value={frame.borderColor}
                onChange={(v) => patchFrame({ borderColor: v })}
                disabled={!frame.enabled}
              />
            </div>
          </div>
        )}
      </div>
  );

  const footer = (
    <CrosswordEditActions
      onCancel={onClose}
      onCommitPage={onCommitPage}
      onCommitAll={onCommitAll}
      onCommitRange={onCommitRange}
      hasUnsavedChanges={hasUnsavedChanges}
      canApplyToAllPages={canApplyToAllPages}
      documentPuzzleCount={documentPuzzleCount}
      rangeError={rangeError}
      canApplyToSelectedPages={canApplyToSelectedPages}
    />
  );

  if (variant === 'sidebar') {
    return (
      <div
        className="canvas-context-panel canvas-context-panel--sidebar"
        role="region"
        aria-label="Crossword edit controls"
      >
        <div className="canvas-context-panel__header canvas-context-panel__header--sidebar">
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-sky-600 dark:text-sky-400">
              Document · This tab
            </p>
            <span className="canvas-context-panel__title">Edit controls</span>
            <p className="canvas-context-panel__select-hint">
              Select what element to adjust on the canvas, then edit it here.
            </p>
          </div>
          <button
            type="button"
            className="canvas-context-panel__close"
            onClick={onClose}
            aria-label="Close"
            title="Close"
          >
            <X className="h-3.5 w-3.5" strokeWidth={2.5} />
          </button>
        </div>
        <div className="canvas-context-panel__body">
          <p className="canvas-context-panel__active-target">{TARGET_TITLES[activeTarget]}</p>
          {body}
        </div>
        {footer}
      </div>
    );
  }

  return (
    <FloatingPanelShell
      title="Crossword — Canvas"
      onClose={onClose}
      tabs={[
        { id: 'title', label: 'Title' },
        { id: 'clues', label: 'Clues' },
        { id: 'numbering', label: 'Grid' },
        { id: 'solutions', label: 'Solutions' },
        { id: 'colors', label: 'Colors' },
        { id: 'page-frame', label: 'Frame' },
      ]}
      activeTabId={activeTarget}
      onTabSelect={(id) => onTargetChange(id as CrosswordEditTarget)}
      onTabClose={() => {}}
      footer={footer}
    >
      {body}
    </FloatingPanelShell>
  );
}
