'use client';

import React from 'react';
import { FloatingPanelShell } from '@/components/FloatingPanelShell';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { SliderField } from '@/components/ui/slider-field';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PUBLISHING_FONTS } from '@/lib/publishing-fonts';
import type {
  CrosswordClueLayout,
  CrosswordSettings,
  CrosswordTitleOption,
} from '@/lib/crossword-settings';
import './canvas-contextual-controls.css';

export type CrosswordEditTarget =
  | 'title'
  | 'clues'
  | 'numbering'
  | 'colors'
  | 'page-frame';

/**
 * Right pane — crossword visual styling / per-page layout (mirrors Word Search canvas controls).
 */
export function CrosswordContextualControls({
  settings,
  activeTarget,
  onTargetChange,
  onSettingsChange,
  onClose,
}: {
  settings: CrosswordSettings;
  activeTarget: CrosswordEditTarget;
  onTargetChange: (target: CrosswordEditTarget) => void;
  onSettingsChange: (updates: Partial<CrosswordSettings>) => void;
  onClose: () => void;
}) {
  const { typography, colors, pageFrameSettings } = settings;
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

  return (
    <FloatingPanelShell
      title="Crossword — Canvas"
      onClose={onClose}
      tabs={[
        { id: 'title', label: 'Title' },
        { id: 'clues', label: 'Clues' },
        { id: 'numbering', label: 'Numbers' },
        { id: 'colors', label: 'Colors' },
        { id: 'page-frame', label: 'Frame' },
      ]}
      activeTabId={activeTarget}
      onTabSelect={(id) => onTargetChange(id as CrosswordEditTarget)}
      onTabClose={() => {}}
    >
      <div className="space-y-3 p-1 max-h-[70vh] overflow-y-auto">
        {activeTarget === 'title' && (
          <>
            <div className="canvas-context-panel__section space-y-2">
              <Label className="canvas-context-panel__section-label">Title Settings</Label>
              <div className="canvas-context-panel__card space-y-3">
                <div className="space-y-1">
                  <Label className="text-xs text-slate-500">Title Option</Label>
                  <Select
                    value={typography.selectTitleOption}
                    onValueChange={(v) =>
                      patchTypography({ selectTitleOption: v as CrosswordTitleOption })
                    }
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="title-number">Title #</SelectItem>
                      <SelectItem value="different-titles">Different Titles</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {typography.selectTitleOption === 'different-titles' ? (
                  <div className="space-y-1">
                    <Label className="text-xs text-slate-500">Titles (one per line)</Label>
                    <textarea
                      className="w-full min-h-[80px] rounded-md border border-slate-200 px-2 py-1.5 text-xs"
                      value={typography.differentTitles}
                      onChange={(e) => patchTypography({ differentTitles: e.target.value })}
                      placeholder="Cruise Boarding Basics&#10;Ship Deck Map"
                    />
                  </div>
                ) : (
                  <div className="space-y-1">
                    <Label className="text-xs text-slate-500">Title Text</Label>
                    <Input
                      className="h-8 text-xs"
                      value={typography.titleText}
                      onChange={(e) => patchTypography({ titleText: e.target.value })}
                    />
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
                  min={3}
                  max={40}
                  step={1}
                />
                <SliderField
                  label="Font Size — Answer Pages"
                  value={typography.answerTitleFontSize}
                  onValueChange={(v) => patchTypography({ answerTitleFontSize: v })}
                  min={3}
                  max={40}
                  step={1}
                />
                <SliderField
                  label="Start Title At (in)"
                  value={typography.titleStartAt}
                  onValueChange={(v) => patchTypography({ titleStartAt: v })}
                  min={0.35}
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
                  label="Space Between Title & Answer"
                  value={typography.spaceBetweenTitleAndAnswer}
                  onValueChange={(v) => patchTypography({ spaceBetweenTitleAndAnswer: v })}
                  min={0}
                  max={2}
                  step={0.1}
                  format="inches"
                />
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
                min={3}
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

        {activeTarget === 'numbering' && (
          <div className="canvas-context-panel__section space-y-2">
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
                min={3}
                max={40}
                step={1}
              />
              <SliderField
                label="Font Size (Answers)"
                value={typography.numberFontSizeAnswers}
                onValueChange={(v) => patchTypography({ numberFontSizeAnswers: v })}
                min={3}
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
                  ['lineColor', 'Line Color'],
                  ['titleColor', 'Title Color'],
                  ['cluesColor', 'Clues Color'],
                  ['numbersColor', 'Numbers Color'],
                  ['answersColor', 'Answers Color'],
                  ['hintLettersColor', 'Hint Letters Color'],
                  ['blackSquareColor', 'Filled Square Color'],
                  ['backgroundColor', 'Background'],
                ] as const
              ).map(([key, label]) => (
                <div key={key} className="flex items-center justify-between gap-2">
                  <Label className="text-xs text-slate-500">{label}</Label>
                  <input
                    id={
                      key === 'lineColor'
                        ? 'line_color'
                        : key === 'titleColor'
                          ? 'title_color'
                          : key === 'cluesColor'
                            ? 'clues_color'
                            : key === 'numbersColor'
                              ? 'numbers_color'
                              : key === 'answersColor'
                                ? 'answers_color'
                                : key === 'hintLettersColor'
                                  ? 'hint_letters_color'
                                  : undefined
                    }
                    type="color"
                    value={colors[key]}
                    onChange={(e) => patchColors({ [key]: e.target.value })}
                    className="h-8 w-14 cursor-pointer rounded border border-slate-200"
                  />
                </div>
              ))}
              <SliderField
                label="Square Color Range (empty squares)"
                value={colors.squareColorRange}
                onValueChange={(v) => patchColors({ squareColorRange: v })}
                min={0}
                max={255}
                step={1}
              />
              <p className="text-[10px] text-muted-foreground">
                Set to 255 for white empty squares (no shading/fill).
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
                min={0.25}
                max={1.5}
                step={0.05}
                format="inches"
                disabled={!frame.enabled}
              />
              <SliderField
                label="Stroke"
                value={frame.strokeThicknessPx}
                onValueChange={(v) => patchFrame({ strokeThicknessPx: v })}
                min={1}
                max={8}
                step={1}
                format="px"
                disabled={!frame.enabled}
              />
              <div className="flex items-center justify-between gap-2">
                <Label className="text-xs text-slate-500">Frame Color</Label>
                <input
                  type="color"
                  value={frame.borderColor}
                  onChange={(e) => patchFrame({ borderColor: e.target.value })}
                  disabled={!frame.enabled}
                  className="h-8 w-14 cursor-pointer rounded border border-slate-200"
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </FloatingPanelShell>
  );
}
