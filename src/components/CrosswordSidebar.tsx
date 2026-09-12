'use client';

import React, { useMemo, useState } from 'react';
import { AlertTriangle, BookOpen, ListTree, Palette, Settings2, Sparkles, Zap } from 'lucide-react';
import { useApp } from '@/lib/app-context';
import { useOptionalAppBusy } from '@/lib/app-busy-context';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { SliderField } from '@/components/ui/slider-field';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { MiniColorInput } from '@/components/ui/color-input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { SettingsTextInput, SettingsTextarea } from '@/components/ui/settings-text-input';
import { PUBLISHING_FONTS } from '@/lib/publishing-fonts';
import type {
  CrosswordAnswerCase,
  CrosswordClueLayout,
  CrosswordNumberingStyle,
  CrosswordSettings,
  CrosswordSolutionTitleStyle,
  CrosswordTitleOption,
} from '@/lib/crossword-settings';
import {
  cleanCrosswordAnswer,
  getDefaultCrosswordSettings,
  normalizeCrosswordSettings,
  parseCrosswordLines,
} from '@/lib/crossword-settings';
import type { PuzzleModuleSettings } from '@/lib/document-model';
import { ChapterPagesBatchPanel } from '@/components/ChapterPagesBatchPanel';
import { cn } from '@/lib/utils';

/**
 * Left pane — crossword generation / document controls (mirrors Word Search structure).
 */
export function CrosswordSidebar() {
  const {
    activeDocumentPage,
    crosswordSettings,
    updateCrosswordSettings,
    generatePuzzle,
    titleWords,
    setTitleWords,
  } = useApp();
  const { showBusy, hideBusy } = useOptionalAppBusy();

  const settings = normalizeCrosswordSettings(crosswordSettings ?? getDefaultCrosswordSettings());
  const { core, typography, colors, bookCanvas } = settings;
  const [activeTab, setActiveTab] = useState('words');
  const [collapsed, setCollapsed] = useState(false);

  const answerLines = useMemo(() => {
    const fromCore = parseCrosswordLines(core.answersText);
    if (fromCore.length > 0) return fromCore;
    return titleWords.words.filter(Boolean);
  }, [core.answersText, titleWords.words]);

  const clueLines = useMemo(() => parseCrosswordLines(core.cluesText), [core.cluesText]);
  const requiredPairs = Math.max(1, core.numberOfPuzzles) * Math.max(1, core.cluesPerPuzzle);
  const missingAnswers = Math.max(0, requiredPairs - answerLines.length);
  const missingClues = Math.max(0, requiredPairs - clueLines.length);

  const maxGridDimension = Math.max(core.lettersAcross || 15, core.lettersDown || 13);
  const tooLongAnswers = useMemo(() => {
    return answerLines
      .map((raw) => {
        const clean = cleanCrosswordAnswer(raw, core.allowNumbersInAnswers, core.language);
        return { raw, cleanLength: clean.length };
      })
      .filter((item) => item.cleanLength > maxGridDimension);
  }, [answerLines, core.allowNumbersInAnswers, core.language, maxGridDimension]);

  if (activeDocumentPage?.moduleType !== 'crossword') {
    return null;
  }

  const patchCore = (patch: Partial<CrosswordSettings['core']>) => {
    updateCrosswordSettings({ core: { ...core, ...patch } });
  };

  const patchTypography = (patch: Partial<CrosswordSettings['typography']>) => {
    updateCrosswordSettings({ typography: { ...typography, ...patch } });
  };

  const patchColors = (patch: Partial<CrosswordSettings['colors']>) => {
    updateCrosswordSettings({ colors: { ...colors, ...patch } });
  };

  const setAnswersText = (text: string) => {
    const words = parseCrosswordLines(text);
    patchCore({ answersText: text });
    setTitleWords({ ...titleWords, words });
  };

  const setCluesText = (text: string) => {
    patchCore({ cluesText: text });
  };

  const handleGenerate = () => {
    showBusy('Generating crossword…');
    window.setTimeout(() => {
      try {
        generatePuzzle();
      } finally {
        window.setTimeout(() => hideBusy(), 280);
      }
    }, 40);
  };

  const tabBtn =
    'flex flex-col gap-1 h-auto py-3 data-[state=active]:bg-blue-50 data-[state=active]:text-blue-700';

  return (
    <div
      className={cn(
        'crossword-sidebar h-full flex bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-700 shadow-xl transition-all duration-300 max-lg:w-full',
        collapsed ? 'w-24' : 'w-[22rem]'
      )}
    >
      <Tabs
        value={activeTab}
        onValueChange={(v) => {
          setActiveTab(v);
          setCollapsed(false);
        }}
        orientation="vertical"
        className="flex h-full w-full"
      >
        <TabsList className="flex h-auto flex-col w-24 gap-2 bg-transparent shrink-0 py-4 px-2">
          {(
            [
              ['words', ListTree, 'Words'],
              ['general', Settings2, 'Puzzle'],
              ['design', Palette, 'Titles'],
              ['ai', Sparkles, 'AI'],
              ['book', BookOpen, 'Book'],
            ] as const
          ).map(([value, Icon, label]) => (
            <TabsTrigger
              key={value}
              value={value}
              className={tabBtn}
              onPointerDown={(e) => {
                if (activeTab === value) {
                  e.preventDefault();
                  setCollapsed((c) => !c);
                }
              }}
            >
              <Icon className="h-4 w-4" />
              <span className="text-[10px] font-semibold">{label}</span>
            </TabsTrigger>
          ))}
          <div className="mt-auto px-1">
            <Button
              type="button"
              size="sm"
              className="w-full h-auto flex flex-col gap-1 py-2.5"
              onClick={handleGenerate}
              title="Generate crossword puzzles"
            >
              <Zap className="h-4 w-4" />
              <span className="text-[9px] font-bold leading-tight">
                {core.numberOfPuzzles > 1 ? `Generate ${core.numberOfPuzzles}` : 'Generate'}
              </span>
            </Button>
          </div>
        </TabsList>

        {!collapsed && (
          <div className="flex-1 overflow-y-auto border-l border-slate-100 dark:border-slate-800 p-4 space-y-4">
            {/* —— WORDS: clues + answers —— */}
            <TabsContent value="words" className="mt-0 space-y-4">
              <div>
                <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 mb-1">
                  Clues & Answers
                </h3>
                <p className="text-[11px] text-slate-500 mb-3">
                  One clue and one answer per line. Lines are paired by index (line 1 clue ↔ line 1
                  answer).
                </p>
              </div>

              <SliderField
                label="Clues per Puzzle"
                value={core.cluesPerPuzzle}
                onValueChange={(v) => patchCore({ cluesPerPuzzle: v })}
                min={0}
                max={50}
                step={1}
              />
              <label className="flex items-start gap-2 text-sm cursor-pointer">
                <Checkbox
                  checked={core.exactClueCount === true}
                  onCheckedChange={(c) => patchCore({ exactClueCount: c === true })}
                  className="mt-0.5"
                />
                <span>
                  Make exactly {Math.max(1, core.cluesPerPuzzle || 15)} clues
                  <span className="block text-[11px] text-slate-500">This could take time</span>
                </span>
              </label>
              <p className="text-[11px] text-slate-500">
                Total needed: {requiredPairs} ({core.numberOfPuzzles} × {core.cluesPerPuzzle})
              </p>

              <div className="space-y-1">
                <Label className="text-xs font-semibold text-slate-600">
                  Answers (one answer per line)
                </Label>
                <textarea
                  className="w-full min-h-[120px] rounded-md border border-slate-200 bg-white px-2 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-950"
                  value={core.answersText || answerLines.join('\n')}
                  onChange={(e) => setAnswersText(e.target.value)}
                  placeholder={'KIWI\nWALRUS\nTURTLE\nMOUSE'}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') e.stopPropagation();
                  }}
                />
                {missingAnswers > 0 && (
                  <p className="text-xs font-medium text-rose-700">
                    {missingAnswers} more answer{missingAnswers === 1 ? '' : 's'} needed
                  </p>
                )}
                {tooLongAnswers.length > 0 && (
                  <div className="rounded-md border border-amber-300 bg-amber-50 p-2 text-xs text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-200 space-y-1 mt-1">
                    <p className="font-semibold text-amber-800 dark:text-amber-300 flex items-center gap-1">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                      {tooLongAnswers.length} answer{tooLongAnswers.length === 1 ? '' : 's'} longer than grid size ({maxGridDimension}×{maxGridDimension})
                    </p>
                    <ul className="list-disc pl-4 space-y-0.5 text-[11px] max-h-[80px] overflow-y-auto">
                      {tooLongAnswers.map(({ raw, cleanLength }) => (
                        <li key={raw}>
                          <span className="font-semibold">{raw}</span> — {cleanLength} letters (grid max: {maxGridDimension})
                        </li>
                      ))}
                    </ul>
                    <p className="text-[10px] text-amber-700 dark:text-amber-400">
                      Spaces are ignored when measuring length. Increase grid size in Puzzle Settings or shorten long answers.
                    </p>
                  </div>
                )}
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold text-slate-600">
                  Clues (one clue per line)
                </Label>
                <textarea
                  className="w-full min-h-[140px] rounded-md border border-slate-200 bg-white px-2 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-950"
                  value={core.cluesText}
                  onChange={(e) => setCluesText(e.target.value)}
                  placeholder={
                    'Flightless bird native to New Zealand\nLarge marine animal known for its tusks\nAnimal known for its slow movement and shell\nSmall rodent, often kept as a pet'
                  }
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') e.stopPropagation();
                  }}
                />
                {missingClues > 0 && (
                  <p className="text-xs font-medium text-amber-700">
                    {missingClues} clue{missingClues === 1 ? '' : 's'} missing — placeholders will
                    be used for those answers
                  </p>
                )}
              </div>
            </TabsContent>

            {/* —— GENERAL / PUZZLE —— */}
            <TabsContent value="general" className="mt-0 space-y-4">
              <div>
                <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 mb-1">
                  Puzzle Settings
                </h3>
                <p className="text-[11px] text-slate-500 mb-3">
                  Batch size, grid size, and scale — same idea as Word Search.
                </p>
              </div>

              <SliderField
                label="Number of Puzzles"
                value={core.numberOfPuzzles}
                onValueChange={(v) => patchCore({ numberOfPuzzles: v })}
                min={0}
                max={400}
                step={1}
              />
              <SliderField
                label="Puzzles Starting Number"
                value={core.puzzlesStartingNumber}
                onValueChange={(v) => patchCore({ puzzlesStartingNumber: v })}
                min={0}
                max={1000000}
                step={1}
              />
              <SliderField
                label="Clues per Puzzle"
                value={core.cluesPerPuzzle}
                onValueChange={(v) => patchCore({ cluesPerPuzzle: v })}
                min={0}
                max={50}
                step={1}
              />
              <label className="flex items-start gap-2 text-sm cursor-pointer">
                <Checkbox
                  checked={core.exactClueCount === true}
                  onCheckedChange={(c) => patchCore({ exactClueCount: c === true })}
                  className="mt-0.5"
                />
                <span>
                  Make exactly {Math.max(1, core.cluesPerPuzzle || 15)} clues
                  <span className="block text-[11px] text-slate-500">This could take time</span>
                </span>
              </label>

              <div className="space-y-2 pt-2 border-t border-slate-100">
                <Label className="text-xs font-semibold text-slate-600">Grid Dimensions</Label>
                <SliderField
                  label="Letters Across"
                  value={core.lettersAcross}
                  onValueChange={(v) => patchCore({ lettersAcross: v })}
                  min={0}
                  max={50}
                  step={1}
                />
                <SliderField
                  label="Letters Down"
                  value={core.lettersDown}
                  onValueChange={(v) => patchCore({ lettersDown: v })}
                  min={0}
                  max={50}
                  step={1}
                />
                <SliderField
                  label="Puzzle Grid Scale"
                  value={core.puzzleGridScale}
                  onValueChange={(v) => patchCore({ puzzleGridScale: v })}
                  min={0}
                  max={200}
                  step={5}
                  format="%"
                />
                <SliderField
                  label="Puzzle Size (% of Page)"
                  value={core.puzzleSizePercent}
                  onValueChange={(v) => patchCore({ puzzleSizePercent: v })}
                  min={0}
                  max={80}
                  step={1}
                  format="%"
                />
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
              </div>

              <div className="space-y-2 pt-2 border-t border-slate-100">
                <Label className="text-xs font-semibold text-slate-600">Answer Formatting</Label>
                <div className="space-y-1">
                  <Label className="text-xs text-slate-500">Select Case</Label>
                  <Select
                    value={core.answerCase}
                    onValueChange={(v) => patchCore({ answerCase: v as CrosswordAnswerCase })}
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="upper">UPPER</SelectItem>
                      <SelectItem value="lower">lower</SelectItem>
                      <SelectItem value="original">Original</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <label className="flex items-center gap-2 text-xs cursor-pointer">
                  <Checkbox
                    checked={core.twoPagePuzzles}
                    onCheckedChange={(c) => patchCore({ twoPagePuzzles: c === true })}
                  />
                  Two Page Puzzles
                </label>
                <label className="flex items-center gap-2 text-xs cursor-pointer">
                  <Checkbox
                    checked={core.allowNumbersInAnswers}
                    onCheckedChange={(c) => patchCore({ allowNumbersInAnswers: c === true })}
                  />
                  Allow Numbers in Answers
                </label>
                <label className="flex items-center gap-2 text-xs cursor-pointer">
                  <Checkbox
                    checked={core.kidsMode}
                    onCheckedChange={(c) => patchCore({ kidsMode: c === true })}
                  />
                  Kids Mode
                </label>
              </div>
            </TabsContent>

            {/* —— DESIGN: titles / subtitle / clues fonts / solutions —— */}
            <TabsContent value="design" className="mt-0 space-y-4">
              <div>
                <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 mb-1">
                  Titles & Typography
                </h3>
                <p className="text-[11px] text-slate-500 mb-3">
                  Same title / subtitle / solution patterns as Word Search documents.
                </p>
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-semibold text-slate-600">Title</Label>
                <Select
                  value={
                    typography.selectTitleOption === 'title-number'
                      ? 'one-custom-title'
                      : typography.selectTitleOption === 'different-titles'
                        ? 'custom'
                        : typography.selectTitleOption
                  }
                  onValueChange={(value) => {
                    const next = value as CrosswordTitleOption;
                    const updates: Partial<CrosswordSettings['typography']> = {
                      selectTitleOption: next,
                    };
                    if (next === 'none') updates.titleText = '';
                    if (next === 'one-custom-title' && typography.titleText) {
                      updates.titleText =
                        (typography.titleText || '').split('\n')[0] || 'Crossword';
                    }
                    patchTypography(updates);
                  }}
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

                {typography.selectTitleOption !== 'none' &&
                  typography.selectTitleOption !== 'custom' &&
                  typography.selectTitleOption !== 'different-titles' && (
                    <SettingsTextInput
                      className="h-8 text-xs"
                      value={typography.titleText}
                      onChange={(v) => patchTypography({ titleText: v })}
                      placeholder="Crossword"
                    />
                  )}

                {(typography.selectTitleOption === 'custom' ||
                  typography.selectTitleOption === 'different-titles') && (
                  <SettingsTextarea
                    className="w-full min-h-[80px] rounded-md border border-slate-200 px-2 py-1.5 text-xs"
                    value={typography.titleText || typography.differentTitles}
                    onChange={(v) =>
                      patchTypography({
                        titleText: v,
                        differentTitles: v,
                      })
                    }
                    placeholder={'1. Animals\n2. Ocean\n3. Space'}
                  />
                )}

                {typography.selectTitleOption !== 'none' && (
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
                    {(typography.selectTitleOption === 'custom' ||
                      typography.selectTitleOption === 'different-titles') &&
                      typography.puzzleNumberingStyle === 'none' && (
                        <p className="text-[11px] text-slate-500">
                          Type numbers in each title line if you want them (e.g.
                          &quot;1. Animals&quot;).
                        </p>
                      )}
                  </div>
                )}
              </div>

              <div className="space-y-2 pt-2 border-t border-slate-100">
                <Label className="text-xs font-semibold text-slate-600">Title Font</Label>
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
                <SliderField
                  label="Font Size — Puzzle Pages"
                  value={typography.puzzleTitleFontSize}
                  onValueChange={(v) => patchTypography({ puzzleTitleFontSize: v })}
                  min={0}
                  max={50}
                  step={1}
                />
                <SliderField
                  label="Font Size — Answer Pages"
                  value={typography.answerTitleFontSize}
                  onValueChange={(v) => patchTypography({ answerTitleFontSize: v })}
                  min={0}
                  max={50}
                  step={1}
                />
                <SliderField
                  label="Start Title At (in)"
                  value={typography.titleStartAt}
                  onValueChange={(v) => patchTypography({ titleStartAt: v })}
                  min={0}
                  max={2}
                  step={0.05}
                  format="inches"
                />
                <SliderField
                  label="Space Between Title & Grid"
                  value={typography.spaceBetweenTitleAndPuzzle}
                  onValueChange={(v) => patchTypography({ spaceBetweenTitleAndPuzzle: v })}
                  min={0}
                  max={2}
                  step={0.05}
                  format="inches"
                />
                <SliderField
                  label="Space Between Puzzle & Clues"
                  value={typography.spaceBetweenPuzzleAndClues}
                  onValueChange={(v) => patchTypography({ spaceBetweenPuzzleAndClues: v })}
                  min={0}
                  max={2}
                  step={0.05}
                  format="inches"
                />
              </div>

              <div className="space-y-2 pt-2 border-t border-slate-100">
                <label className="flex items-center gap-2 text-xs cursor-pointer">
                  <Checkbox
                    checked={typography.includeFunFacts}
                    onCheckedChange={(c) => patchTypography({ includeFunFacts: c === true })}
                  />
                  Add Subtitle / Fun Facts
                </label>
                {typography.includeFunFacts && (
                  <>
                    <textarea
                      className="w-full min-h-[72px] rounded-md border border-slate-200 px-2 py-1.5 text-xs"
                      value={typography.funFactsText}
                      onChange={(e) => patchTypography({ funFactsText: e.target.value })}
                      placeholder="One subtitle or fun fact per line…"
                    />
                    <Select
                      value={typography.subtitleFontFamily}
                      onValueChange={(v) => patchTypography({ subtitleFontFamily: v })}
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
                    <SliderField
                      label="Subtitle Font Size"
                      value={typography.subtitleFontSize}
                      onValueChange={(v) => patchTypography({ subtitleFontSize: v })}
                      min={0}
                      max={24}
                      step={1}
                    />
                    <MiniColorInput
                      label="Subtitle Color"
                      value={colors.subtitleColor}
                      onChange={(v) => patchColors({ subtitleColor: v })}
                    />
                    <SliderField
                      label="Gap Title → Subtitle"
                      value={typography.subtitleToTitleGap}
                      onValueChange={(v) => patchTypography({ subtitleToTitleGap: v })}
                      min={0}
                      max={1}
                      step={0.05}
                      format="inches"
                    />
                    <SliderField
                      label="Gap Subtitle → Grid"
                      value={typography.subtitleToPuzzleGap}
                      onValueChange={(v) => patchTypography({ subtitleToPuzzleGap: v })}
                      min={0}
                      max={1}
                      step={0.05}
                      format="inches"
                    />
                  </>
                )}
              </div>

              <div className="space-y-2 pt-2 border-t border-slate-100">
                <Label className="text-xs font-semibold text-slate-600">
                  Clue Numbers (in grid)
                </Label>
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
                <SliderField
                  label="Number Font Size (Puzzle)"
                  value={typography.numberFontSizePuzzle}
                  onValueChange={(v) => patchTypography({ numberFontSizePuzzle: v })}
                  min={0}
                  max={40}
                  step={1}
                />
                <SliderField
                  label="Number Font Size (Answers)"
                  value={typography.numberFontSizeAnswers}
                  onValueChange={(v) => patchTypography({ numberFontSizeAnswers: v })}
                  min={0}
                  max={40}
                  step={1}
                />
                <SliderField
                  label="Grid Letter Font Size (Solutions)"
                  value={typography.gridLetterFontSize}
                  onValueChange={(v) => patchTypography({ gridLetterFontSize: v })}
                  min={0}
                  max={40}
                  step={1}
                />
              </div>

              <div className="space-y-2 pt-2 border-t border-slate-100">
                <Label className="text-xs font-semibold text-slate-600">Across / Down Labels</Label>
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
                <SliderField
                  label="Across/Down Font Size"
                  value={typography.acrossDownFontSize}
                  onValueChange={(v) => patchTypography({ acrossDownFontSize: v })}
                  min={0}
                  max={40}
                  step={1}
                />
              </div>

              <div className="space-y-2 pt-2 border-t border-slate-100">
                <Label className="text-xs font-semibold text-slate-600">Clues Format</Label>
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
                <SliderField
                  label="Clue Font Size"
                  value={typography.clueFontSize}
                  onValueChange={(v) => patchTypography({ clueFontSize: v })}
                  min={0}
                  max={40}
                  step={1}
                />
                <div className="space-y-1">
                  <Label className="text-xs text-slate-500">Clue Layout</Label>
                  <Select
                    value={typography.clueLayout}
                    onValueChange={(v) =>
                      patchTypography({ clueLayout: v as CrosswordClueLayout })
                    }
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="single">Single column</SelectItem>
                      <SelectItem value="double">Double column (Across | Down)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2 pt-2 border-t border-slate-100">
                <Label className="text-xs font-semibold text-slate-600">Solution Page Title</Label>
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
                <SliderField
                  label="Space Between Title & Answer"
                  value={typography.spaceBetweenTitleAndAnswer}
                  onValueChange={(v) => patchTypography({ spaceBetweenTitleAndAnswer: v })}
                  min={0}
                  max={2}
                  step={0.05}
                  format="inches"
                />
              </div>
            </TabsContent>

            {/* —— AI —— */}
            <TabsContent value="ai" className="mt-0 space-y-4">
              <div>
                <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 mb-1">
                  AI & Content
                </h3>
              </div>
              <label className="flex items-center gap-2 text-xs cursor-pointer">
                <Checkbox
                  checked={core.useAiClues}
                  onCheckedChange={(c) => patchCore({ useAiClues: c === true })}
                />
                Use AI to Generate Clues/Answers
              </label>
              <div className="space-y-1">
                <Label className="text-xs text-slate-500">Themes (one per line)</Label>
                <textarea
                  className="w-full min-h-[88px] rounded-md border border-slate-200 bg-white px-2 py-1.5 text-xs"
                  value={core.themes}
                  onChange={(e) => patchCore({ themes: e.target.value })}
                  placeholder={'Animals\nOcean life'}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-slate-500">Language</Label>
                <Input
                  className="h-8 text-xs"
                  value={core.language}
                  onChange={(e) => patchCore({ language: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-slate-500">Age Level</Label>
                <Input
                  className="h-8 text-xs"
                  value={core.ageLevel}
                  onChange={(e) => patchCore({ ageLevel: e.target.value })}
                />
              </div>
              <SliderField
                label="Max Clue Characters"
                value={core.maxClueCharacters}
                onValueChange={(v) => patchCore({ maxClueCharacters: v })}
                min={0}
                max={500}
                step={1}
              />
              <SliderField
                label="Max Answer Length"
                value={core.maxAnswerLength}
                onValueChange={(v) => patchCore({ maxAnswerLength: v })}
                min={0}
                max={50}
                step={1}
              />
            </TabsContent>

            {/* —— BOOK —— */}
            <TabsContent value="book" className="mt-0 space-y-4">
              <div>
                <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 mb-1">Book</h3>
                <p className="text-[11px] text-slate-500">
                  Solution page packing and chapter helpers.
                </p>
              </div>
              <label className="flex items-center gap-2 text-xs cursor-pointer">
                <Checkbox
                  checked={bookCanvas.includeBleed}
                  onCheckedChange={(c) =>
                    updateCrosswordSettings({
                      bookCanvas: { ...bookCanvas, includeBleed: c === true },
                    })
                  }
                />
                Include Bleed
              </label>
              <label className="flex items-center gap-2 text-xs cursor-pointer">
                <Checkbox
                  checked={bookCanvas.includePageBetweenPuzzleAndSolutions}
                  onCheckedChange={(c) =>
                    updateCrosswordSettings({
                      bookCanvas: {
                        ...bookCanvas,
                        includePageBetweenPuzzleAndSolutions: c === true,
                      },
                    })
                  }
                />
                Blank page between puzzles and solutions
              </label>
              <SliderField
                label="Answers Per Page"
                value={bookCanvas.answersPerPage}
                onValueChange={(v) =>
                  updateCrosswordSettings({
                    bookCanvas: { ...bookCanvas, answersPerPage: v },
                  })
                }
                min={0}
                max={6}
                step={1}
              />
              <div className="pt-3 border-t border-slate-200 dark:border-slate-700">
                <ChapterPagesBatchPanel />
              </div>
            </TabsContent>
          </div>
        )}
      </Tabs>
    </div>
  );
}

/** Persist helper used by app-context when leaving a crossword document. */
export function readCrosswordSettingsFromDocument(
  settings: PuzzleModuleSettings | undefined
): CrosswordSettings {
  return normalizeCrosswordSettings(settings?.crosswordSettings ?? getDefaultCrosswordSettings());
}
