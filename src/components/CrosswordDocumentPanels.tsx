'use client';

/**
 * Document-tab panels for Crossword — same Puzzle / Words / Titles structure as Word Search.
 */

import React, { useCallback, useMemo, useState } from 'react';
import { AlertTriangle, RefreshCw, Save } from 'lucide-react';
import { useApp } from '@/lib/app-context';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { SliderField } from '@/components/ui/slider-field';
import { IntegerInput } from '@/components/ui/integer-input';
import { SettingsTextInput, SettingsTextarea } from '@/components/ui/settings-text-input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { MiniColorInput } from '@/components/ui/color-input';
import { PUBLISHING_FONTS } from '@/lib/publishing-fonts';

import { DivideListsIntoChaptersControl } from '@/components/DivideListsIntoChaptersControl';
import {
  computeCrosswordAutoFit,
  fitValuesUnchanged,
  pageFitApplyKey,
} from '@/lib/auto-page-fit';
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
  greyscaleToCss,
  normalizeCrosswordSettings,
  parseCrosswordLines,
} from '@/lib/crossword-settings';

function useCrosswordDoc() {
  const {
    crosswordSettings,
    updateCrosswordSettings,
    titleWords,
    setTitleWords,
    wordSearchSettings,
  } = useApp();

  const settings = normalizeCrosswordSettings(crosswordSettings ?? getDefaultCrosswordSettings());
  const { core, typography, colors, bookCanvas } = settings;

  const patchCore = (patch: Partial<CrosswordSettings['core']>) => {
    updateCrosswordSettings({ core: { ...core, ...patch } });
  };
  const patchTypography = (patch: Partial<CrosswordSettings['typography']>) => {
    updateCrosswordSettings({ typography: { ...typography, ...patch } });
  };
  const patchColors = (patch: Partial<CrosswordSettings['colors']>) => {
    updateCrosswordSettings({ colors: { ...colors, ...patch } });
  };
  const patchBookCanvas = (patch: Partial<CrosswordSettings['bookCanvas']>) => {
    updateCrosswordSettings({ bookCanvas: { ...bookCanvas, ...patch } });
  };

  const answerLines = useMemo(() => {
    const fromCore = parseCrosswordLines(core.answersText);
    if (fromCore.length > 0) return fromCore;
    return titleWords.words.filter(Boolean);
  }, [core.answersText, titleWords.words]);

  const clueLines = useMemo(() => parseCrosswordLines(core.cluesText), [core.cluesText]);
  const requiredPairs = Math.max(1, core.numberOfPuzzles) * Math.max(1, core.cluesPerPuzzle);

  const setAnswersText = (text: string) => {
    const words = parseCrosswordLines(text);
    patchCore({ answersText: text });
    setTitleWords({ ...titleWords, words });
  };

  return {
    core,
    typography,
    colors,
    bookCanvas,
    patchCore,
    patchTypography,
    patchColors,
    patchBookCanvas,
    settings,
    wordSearchSettings,
    updateCrosswordSettings,
    answerLines,
    clueLines,
    requiredPairs,
    setAnswersText,
    setCluesText: (text: string) => patchCore({ cluesText: text }),
  };
}

function useCrosswordAutoFit() {
  const { crosswordBatchPuzzles, activeDocumentPageId } = useApp();
  const { core, typography, settings, wordSearchSettings, updateCrosswordSettings, patchCore } =
    useCrosswordDoc();

  const activeCrosswordPuzzles = useMemo(() => {
    return crosswordBatchPuzzles.filter(
      (puzzle) => !puzzle.pageId || puzzle.pageId === activeDocumentPageId
    );
  }, [crosswordBatchPuzzles, activeDocumentPageId]);

  const puzzleFitKey = useMemo(() => {
    return activeCrosswordPuzzles
      .map((puzzle) => {
        const across = puzzle.acrossClues ?? [];
        const down = puzzle.downClues ?? [];
        const chars =
          across.reduce((sum, clue) => sum + (clue.clue?.length ?? 0), 0) +
          down.reduce((sum, clue) => sum + (clue.clue?.length ?? 0), 0);
        return `${across.length}:${down.length}:${chars}`;
      })
      .join(',');
  }, [activeCrosswordPuzzles]);

  const applyKey = [
    pageFitApplyKey(wordSearchSettings),
    core.lettersAcross,
    core.lettersDown,
    core.cluesPerPuzzle,
    core.puzzleSizePercent,
    typography.clueLayout,
    typography.titleStartAt,
    typography.spaceBetweenTitleAndPuzzle,
    typography.spaceBetweenPuzzleAndClues,
    puzzleFitKey,
  ].join('|');

  const apply = useCallback(() => {
    const fit = computeCrosswordAutoFit(
      settings,
      wordSearchSettings,
      {
        fitGrid: true,
        fitFont: core.autoBalanceFont === true,
      },
      activeCrosswordPuzzles
    );
    if (Object.keys(fit).length === 0) return;
    const current: Record<string, number | undefined> = {
      puzzleGridScale: core.puzzleGridScale,
      solutionGridScale: core.solutionGridScale,
      puzzleTitleFontSize: typography.puzzleTitleFontSize,
      answerTitleFontSize: typography.answerTitleFontSize,
      clueFontSize: typography.clueFontSize,
      acrossDownFontSize: typography.acrossDownFontSize,
      numberFontSizePuzzle: typography.numberFontSizePuzzle,
      numberFontSizeAnswers: typography.numberFontSizeAnswers,
      gridLetterFontSize: typography.gridLetterFontSize,
      subtitleFontSize: typography.subtitleFontSize,
    };
    if (fitValuesUnchanged(current, fit)) return;
    const corePatch: Partial<CrosswordSettings['core']> = {};
    const typePatch: Partial<CrosswordSettings['typography']> = {};
    if (fit.puzzleGridScale != null) corePatch.puzzleGridScale = fit.puzzleGridScale;
    if (fit.solutionGridScale != null) corePatch.solutionGridScale = fit.solutionGridScale;
    if (fit.puzzleTitleFontSize != null) typePatch.puzzleTitleFontSize = fit.puzzleTitleFontSize;
    if (fit.answerTitleFontSize != null) typePatch.answerTitleFontSize = fit.answerTitleFontSize;
    if (fit.clueFontSize != null) typePatch.clueFontSize = fit.clueFontSize;
    if (fit.acrossDownFontSize != null) typePatch.acrossDownFontSize = fit.acrossDownFontSize;
    if (fit.numberFontSizePuzzle != null) typePatch.numberFontSizePuzzle = fit.numberFontSizePuzzle;
    if (fit.numberFontSizeAnswers != null) typePatch.numberFontSizeAnswers = fit.numberFontSizeAnswers;
    if (fit.gridLetterFontSize != null) typePatch.gridLetterFontSize = fit.gridLetterFontSize;
    if (fit.subtitleFontSize != null) typePatch.subtitleFontSize = fit.subtitleFontSize;
    updateCrosswordSettings({
      ...(Object.keys(corePatch).length ? { core: { ...core, ...corePatch } } : {}),
      ...(Object.keys(typePatch).length ? { typography: { ...typography, ...typePatch } } : {}),
    });
  }, [
    core,
    typography,
    settings,
    wordSearchSettings,
    crosswordBatchPuzzles,
    updateCrosswordSettings,
  ]);

  return {
    autoBalanceFont: core.autoBalanceFont === true,
    setFontEnabled: (next: boolean) => patchCore({ autoBalanceFont: next }),
    apply,
    applyKey,
  };
}



export function CrosswordPuzzleSettingsPanel({ onSave }: { onSave?: () => void }) {
  const { core, colors, bookCanvas, patchCore, patchColors, patchBookCanvas } =
    useCrosswordDoc();
  const { generatePuzzle } = useApp();
  const [isRegenerating, setIsRegenerating] = useState(false);

  const handleRegenerate = async () => {
    setIsRegenerating(true);
    try {
      await generatePuzzle();
    } finally {
      setIsRegenerating(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-sky-600 dark:text-sky-400">
            Document · This tab
          </p>
          <h3 className="font-semibold text-gray-900 dark:text-white">Puzzle Settings</h3>
        </div>
        {onSave && (
          <Button variant="outline" size="sm" onClick={onSave}>
            <Save className="w-4 h-4 mr-2" />Save
          </Button>
        )}
      </div>


      <div className="space-y-3">
        <Label className="text-sm font-medium">Quantity</Label>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-xs text-gray-500">Number of Puzzles</Label>
            <IntegerInput
              value={core.numberOfPuzzles}
              onChange={(v) => patchCore({ numberOfPuzzles: v })}
              min={0}
              max={400}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-gray-500">Starting Number</Label>
            <IntegerInput
              value={core.puzzlesStartingNumber}
              onChange={(v) => patchCore({ puzzlesStartingNumber: v })}
              min={0}
              max={1000000}
            />
          </div>
        </div>
        <DivideListsIntoChaptersControl
          numberOfPuzzles={core.numberOfPuzzles}
          puzzlesStartingNumber={core.puzzlesStartingNumber}
        />
        <div className="space-y-1">
          <Label className="text-xs text-gray-500">Clues per Puzzle</Label>
          <IntegerInput
            value={core.cluesPerPuzzle}
            onChange={(v) => patchCore({ cluesPerPuzzle: v })}
            min={0}
            max={50}
          />
          <label className="flex items-start gap-2 text-sm cursor-pointer pt-1">
            <Checkbox
              checked={core.exactClueCount === true}
              onCheckedChange={(c) => patchCore({ exactClueCount: c === true })}
              className="mt-0.5"
            />
            <span>
              Make exactly {Math.max(1, core.cluesPerPuzzle || 15)} clues (this could take time)
            </span>
          </label>
        </div>
        <div className="space-y-1">
          <Label className="text-sm font-medium">Solutions Per Page</Label>
          <Select
            value={(bookCanvas.answersPerPage || 1).toString()}
            onValueChange={(value) =>
              patchBookCanvas({ answersPerPage: parseInt(value, 10) })
            }
          >
            <SelectTrigger>
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
      </div>

      <div className="space-y-3 border-t pt-3">
        <div className="flex items-center justify-between">
          <Label className="text-sm font-medium">Grid Size</Label>
          <span className="text-sm text-gray-600">
            {core.lettersAcross} x {core.lettersDown}
          </span>
        </div>
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
          label="Letters Across"
          value={core.lettersAcross}
          onValueChange={(v) => patchCore({ lettersAcross: v })}
          min={0}
          max={30}
          step={1}
        />
        <SliderField
          label="Letters Down"
          value={core.lettersDown}
          onValueChange={(v) => patchCore({ lettersDown: v })}
          min={0}
          max={30}
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

      <div className="space-y-3 border-t pt-3">
        <Label className="text-sm font-medium">Grid Boxes</Label>
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
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <Checkbox
            checked={colors.unusedBoxesTransparent === true}
            onCheckedChange={(c) =>
              patchColors({ unusedBoxesTransparent: c === true })
            }
          />
          Make unused boxes transparent
        </label>
        <p className="text-xs text-slate-500">
          Default is solid black. Borders of unused boxes match their fill color.
        </p>
      </div>

      <div className="space-y-2 border-t pt-3">
        <Label className="text-sm font-medium">Answer Formatting</Label>
        <Select
          value={core.answerCase}
          onValueChange={(v) => patchCore({ answerCase: v as CrosswordAnswerCase })}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="upper">UPPER</SelectItem>
            <SelectItem value="lower">lower</SelectItem>
            <SelectItem value="original">Original</SelectItem>
          </SelectContent>
        </Select>
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <Checkbox
            checked={core.allowNumbersInAnswers}
            onCheckedChange={(c) => patchCore({ allowNumbersInAnswers: c === true })}
          />
          Allow Numbers in Answers
        </label>
      </div>
    </div>
  );
}

export function CrosswordWordsSettingsPanel({ onSave }: { onSave?: () => void }) {
  const {
    core,
    typography,
    patchTypography,
    answerLines,
    clueLines,
    requiredPairs,
    setAnswersText,
    setCluesText,
  } = useCrosswordDoc();
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

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-sky-600 dark:text-sky-400">
            Document · This tab
          </p>
          <h3 className="font-semibold text-gray-900 dark:text-white">Clues & Answers</h3>
        </div>
        {onSave && (
          <Button variant="outline" size="sm" onClick={onSave}>
            <Save className="w-4 h-4 mr-2" />Save
          </Button>
        )}
      </div>

      <p className="text-xs text-gray-500">
        Total needed: {requiredPairs} ({core.numberOfPuzzles} × {core.cluesPerPuzzle} clues per
        puzzle — set in Puzzle Settings)
      </p>

      <div className="space-y-2">
        <Label className="text-sm font-medium">Answers (one answer per line)</Label>
        <textarea
          className="w-full min-h-[120px] rounded-md border border-gray-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
          value={core.answersText || answerLines.join('\n')}
          onChange={(e) => setAnswersText(e.target.value)}
          placeholder={'REFLECT\nVALUES\nCHOICE\nHONESTY'}
          onKeyDown={(e) => {
            if (e.key === 'Enter') e.stopPropagation();
          }}
        />
        {missingAnswers > 0 && (
          <p className="text-sm font-medium text-rose-700">
            {missingAnswers} more answer{missingAnswers === 1 ? '' : 's'} needed
          </p>
        )}
        {tooLongAnswers.length > 0 && (
          <div className="rounded-md border border-amber-300 bg-amber-50 p-2.5 text-xs text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-200 space-y-1">
            <p className="font-semibold text-amber-800 dark:text-amber-300 flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
              {tooLongAnswers.length} answer{tooLongAnswers.length === 1 ? '' : 's'} longer than grid size ({maxGridDimension}×{maxGridDimension})
            </p>
            <ul className="list-disc pl-4 space-y-0.5 text-[11px] max-h-[100px] overflow-y-auto">
              {tooLongAnswers.map(({ raw, cleanLength }) => (
                <li key={raw}>
                  <span className="font-semibold">{raw}</span> — {cleanLength} letters (grid max: {maxGridDimension})
                </li>
              ))}
            </ul>
            <p className="text-[10px] text-amber-700 dark:text-amber-400">
              Spaces are ignored when measuring letter length. Increase grid size in Puzzle Settings or shorten long answers.
            </p>
          </div>
        )}
      </div>

      <div className="space-y-2">
        <Label className="text-sm font-medium">Clues (one clue per line)</Label>
        <textarea
          className="w-full min-h-[140px] rounded-md border border-gray-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
          value={core.cluesText}
          onChange={(e) => setCluesText(e.target.value)}
          placeholder={'Think about yourself\nGuiding personal principles\nDecision between options'}
          onKeyDown={(e) => {
            if (e.key === 'Enter') e.stopPropagation();
          }}
        />
        {missingClues > 0 && (
          <p className="text-sm font-medium text-amber-700">
            {missingClues} clue{missingClues === 1 ? '' : 's'} missing — placeholders used for those
            answers
          </p>
        )}
      </div>

      <div className="space-y-3 border-t pt-3">
        <Label className="text-sm font-medium">Clue Spacing</Label>
        <SliderField
          label="Space Vertical"
          value={typography.clueSpaceVertical ?? 4}
          onValueChange={(v) => patchTypography({ clueSpaceVertical: v })}
          min={0}
          max={40}
          step={1}
          format="px"
        />
        <SliderField
          label="Space Horizontal"
          value={typography.clueSpaceHorizontal ?? 24}
          onValueChange={(v) => patchTypography({ clueSpaceHorizontal: v })}
          min={0}
          max={80}
          step={1}
          format="px"
        />
      </div>
    </div>
  );
}

export function CrosswordTitlesSettingsPanel({ onSave }: { onSave?: () => void }) {
  const { core, typography, colors, patchTypography, patchColors } = useCrosswordDoc();

  const titleOptionValue =
    typography.selectTitleOption === 'title-number'
      ? 'one-custom-title'
      : typography.selectTitleOption === 'different-titles'
        ? 'custom'
        : typography.selectTitleOption;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-sky-600 dark:text-sky-400">
            Document · This tab
          </p>
          <h3 className="font-semibold text-gray-900 dark:text-white">Titles</h3>
        </div>
        {onSave && (
          <Button variant="outline" size="sm" onClick={onSave}>
            <Save className="w-4 h-4 mr-2" />Save
          </Button>
        )}
      </div>


      <div className="space-y-3">
        <Label className="text-sm font-medium">Title</Label>
        <Select
          value={titleOptionValue}
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
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="one-custom-title">One Custom Title</SelectItem>
            <SelectItem value="custom">Custom Title Per Puzzle</SelectItem>
            <SelectItem value="none">No Title</SelectItem>
          </SelectContent>
        </Select>

        {titleOptionValue !== 'none' && titleOptionValue !== 'custom' && (
          <SettingsTextInput
            value={typography.titleText}
            onChange={(v) => patchTypography({ titleText: v })}
            placeholder="Crossword"
          />
        )}
        {titleOptionValue === 'custom' && (
          <SettingsTextarea
            className="w-full min-h-[80px] rounded-md border border-gray-200 px-3 py-2 text-sm"
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
        {titleOptionValue !== 'none' && (
          <Select
            value={typography.puzzleNumberingStyle}
            onValueChange={(v) =>
              patchTypography({ puzzleNumberingStyle: v as CrosswordNumberingStyle })
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">None</SelectItem>
              <SelectItem value="prefix">Prefix (1. Title)</SelectItem>
              <SelectItem value="suffix">Suffix (Title #1)</SelectItem>
            </SelectContent>
          </Select>
        )}
        {titleOptionValue === 'custom' && typography.puzzleNumberingStyle === 'none' && (
          <p className="text-[11px] text-slate-500">
            With numbering set to None, type numbers in each line if you want them
            (e.g. &quot;1. Animals&quot;).
          </p>
        )}
      </div>

      <div className="space-y-3 border-t pt-3">
        <Label className="text-sm font-medium">Title Font</Label>
        <Select
          value={typography.puzzleTitleFontFamily}
          onValueChange={(v) => patchTypography({ puzzleTitleFontFamily: v })}
        >
          <SelectTrigger>
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
          label="Title Size (Puzzle Pages)"
          value={typography.puzzleTitleFontSize}
          onValueChange={(v) => patchTypography({ puzzleTitleFontSize: v })}
          min={0}
          max={50}
          step={1}
        />
        <SliderField
          label="Title Size (Answer Pages)"
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

      <div className="space-y-3 border-t pt-3">
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <Checkbox
            checked={typography.includeFunFacts}
            onCheckedChange={(c) => patchTypography({ includeFunFacts: c === true })}
          />
          Add Subtitle / Fun Facts
        </label>
        {typography.includeFunFacts && (
          <>
            <textarea
              className="w-full min-h-[72px] rounded-md border border-gray-200 px-3 py-2 text-sm"
              value={typography.funFactsText}
              onChange={(e) => patchTypography({ funFactsText: e.target.value })}
              placeholder="One subtitle per line…"
            />
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
          </>
        )}
      </div>

      <div className="space-y-3 border-t pt-3">
        <Label className="text-sm font-medium">Clue Numbers (in grid)</Label>
        <Select
          value={typography.numberFontFamily}
          onValueChange={(v) => patchTypography({ numberFontFamily: v })}
        >
          <SelectTrigger>
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
          label="Number Font Size"
          value={typography.numberFontSizePuzzle}
          onValueChange={(v) =>
            patchTypography({ numberFontSizePuzzle: v, numberFontSizeAnswers: v })
          }
          min={0}
          max={40}
          step={1}
        />
      </div>

      <div className="space-y-3 border-t pt-3">
        <Label className="text-sm font-medium">Across / Down Labels</Label>
        <Select
          value={typography.acrossDownFontFamily}
          onValueChange={(v) => patchTypography({ acrossDownFontFamily: v })}
        >
          <SelectTrigger>
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
          min={core.autoBalanceFont === true ? 20 : 0}
          max={40}
          step={1}
        />
      </div>

      <div className="space-y-3 border-t pt-3">
        <Label className="text-sm font-medium">Clues Format</Label>
        <Select
          value={typography.clueFontFamily}
          onValueChange={(v) => patchTypography({ clueFontFamily: v })}
        >
          <SelectTrigger>
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
          min={core.autoBalanceFont === true ? 18 : 0}
          max={40}
          step={1}
        />
        <Select
          value={typography.clueLayout}
          onValueChange={(v) => patchTypography({ clueLayout: v as CrosswordClueLayout })}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="single">Single column</SelectItem>
            <SelectItem value="double">Double column (Across | Down)</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-3 border-t pt-3">
        <Label className="text-sm font-medium">Solution Page Title</Label>
        <Select
          value={typography.solutionTitleStyle}
          onValueChange={(v) => {
            const next = v as CrosswordSolutionTitleStyle;
            if (next === 'same_as_puzzle') {
              patchTypography({ solutionTitleStyle: next, solutionNumberingStyle: 'none' });
            } else {
              patchTypography({ solutionTitleStyle: next });
            }
          }}
        >
          <SelectTrigger>
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
              value={typography.customSolutionTitle}
              onChange={(v) => patchTypography({ customSolutionTitle: v })}
              placeholder="Solution"
            />
            <Select
              value={typography.solutionNumberingStyle}
              onValueChange={(v) =>
                patchTypography({ solutionNumberingStyle: v as CrosswordNumberingStyle })
              }
            >
              <SelectTrigger>
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

      <div className="space-y-3 border-t pt-3">
        <Label className="text-sm font-medium">Answer Key</Label>
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <Checkbox
            checked={typography.showAnswerKey !== false}
            onCheckedChange={(c) => patchTypography({ showAnswerKey: c === true })}
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
        <p className="text-xs text-slate-500">
          Across/Down answers appear under each solution grid as numbered words (not
          pipe-separated).
        </p>
      </div>
    </div>
  );
}
