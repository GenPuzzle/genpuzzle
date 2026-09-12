'use client';

/**
 * Document-tab panels for Sudoku / Maze / Cryptogram / Word Scramble —
 * same Puzzle / Titles structure as Word Search and Crossword.
 */

import React, { useCallback, useRef } from 'react';
import { Save, Trash2, Upload, ChevronDown } from 'lucide-react';
import { useApp } from '@/lib/app-context';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { readImageFileAsDataUrl, readImageFilesAsDataUrls } from '@/lib/puzzles/word-search-shape-mask';
import { SliderField } from '@/components/ui/slider-field';
import { IntegerInput } from '@/components/ui/integer-input';
import { SettingsTextInput } from '@/components/ui/settings-text-input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { MiniColorInput } from '@/components/ui/color-input';
import { Textarea } from '@/components/ui/textarea';
import { PUBLISHING_FONTS } from '@/lib/publishing-fonts';

import { computeGenericAutoFit, fitValuesUnchanged, pageFitApplyKey } from '@/lib/auto-page-fit';
import { DivideListsIntoChaptersControl } from '@/components/DivideListsIntoChaptersControl';
import type {
  CryptogramCipherType,
  CryptogramFormat,
  GenericLetterCase,
  GenericPuzzleModuleType,
  GenericPuzzleNumberingStyle,
  GenericPuzzleSettings,
  GenericPuzzleTitleOption,
  GenericSolutionTitleStyle,
  GenericTitleAlign,
  MazeShapeMode,
  MazeSizeMode,
  ScrambleAnswerStyle,
  ScrambleSeparator,
  SudokuDifficultyPlacement,
  SudokuMixedSizeCounts,
  SudokuPuzzleMode,
  CalcudokuConcreteDifficulty,
} from '@/lib/generic-puzzle-settings';
import {
  defaultMixedMazeLevelCounts,
  defaultMixedMazeShapeCounts,
  defaultMixedSudokuLevelCounts,
  defaultMixedSudokuSizeCounts,
  getGenericModuleDefaultTitle,
  MAZE_SHAPE_MIX_META,
  MAZE_SIZE_LEVEL_META,
  normalizeGenericPuzzleSettings,
  sumMixedMazeShapeCounts,
  sumMixedSudokuSizeCounts,
  SUDOKU_SIZE_META,
  SUDOKU_SIZES,
  CALCUDOKU_GRID_SIZES,
  CALCUDOKU_DIFFICULTIES,
  CALCUDOKU_MIX_SIZE_FIELD,
  CALCUDOKU_MIX_DIFFICULTY_FIELD,
  isCalcudokuGridSize,
  selectedCalcudokuMixSizes,
  selectedCalcudokuMixDifficulties,
  sudokuModeGenerationBlockMessage,
  sudokuModeGenerationHint,
  type MazeMixedShapeCounts,
} from '@/lib/generic-puzzle-settings';
import type {
  MazeEndSide,
  MazeMarkerStyle,
  MazeShape,
  MazeSolutionPathStyle,
  MazeStartSide,
} from '@/lib/puzzles/types';
import { isSudokuSize, type SudokuSize } from '@/lib/puzzles/sudoku';

const SUDOKU_SIZE_COUNT_FIELD: Record<
  SudokuSize,
  | 'sudokuMixedSize4'
  | 'sudokuMixedSize6'
  | 'sudokuMixedSize9'
  | 'sudokuMixedSize12'
  | 'sudokuMixedSize16'
  | 'sudokuMixedSize25'
> = {
  4: 'sudokuMixedSize4',
  6: 'sudokuMixedSize6',
  9: 'sudokuMixedSize9',
  12: 'sudokuMixedSize12',
  16: 'sudokuMixedSize16',
  25: 'sudokuMixedSize25',
};

function sudokuSizeCountsFromCore(core: GenericPuzzleSettings['core']): SudokuMixedSizeCounts {
  return {
    4: core.sudokuMixedSize4,
    6: core.sudokuMixedSize6,
    9: core.sudokuMixedSize9,
    12: core.sudokuMixedSize12,
    16: core.sudokuMixedSize16,
    25: core.sudokuMixedSize25,
  };
}

function patchFromSudokuSizeCounts(
  counts: SudokuMixedSizeCounts,
  syncQuantity = true
) {
  return {
    sudokuMixedSize4: counts[4],
    sudokuMixedSize6: counts[6],
    sudokuMixedSize9: counts[9],
    sudokuMixedSize12: counts[12],
    sudokuMixedSize16: counts[16],
    sudokuMixedSize25: counts[25],
    ...(syncQuantity ? { numberOfPuzzles: sumMixedSudokuSizeCounts(counts) } : {}),
  };
}

function MultiSelectPicker<T extends string>({
  label,
  options,
  selected,
  onChange,
  hint,
}: {
  label: string;
  options: Array<{ value: T; label: string; description?: string }>;
  selected: T[];
  onChange: (next: T[]) => void;
  hint?: string;
}) {
  const allValues = options.map((option) => option.value);
  const allSelected = allValues.length > 0 && allValues.every((value) => selected.includes(value));
  const summary = allSelected
    ? 'Mix all'
    : selected.length === 0
      ? 'Select…'
      : selected.length === 1
        ? (options.find((option) => option.value === selected[0])?.label ?? selected[0])
        : selected
            .map((value) => options.find((option) => option.value === value)?.label ?? value)
            .join(', ');

  const setSelected = (next: T[]) => {
    if (next.length === 0) return;
    const unique = allValues.filter((value) => next.includes(value));
    if (unique.length === 0) return;
    onChange(unique);
  };

  return (
    <div className="space-y-1">
      <Label className="text-sm font-medium">{label}</Label>
      <Popover>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            className="h-10 w-full justify-between font-normal"
          >
            <span className="truncate">{summary}</span>
            <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-[var(--radix-popover-trigger-width)] p-2">
          <button
            type="button"
            className={`mb-1 flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm ${
              allSelected
                ? 'bg-slate-100 font-medium dark:bg-slate-800'
                : 'hover:bg-slate-50 dark:hover:bg-slate-800/60'
            }`}
            onClick={() => setSelected(allValues)}
          >
            <Checkbox checked={allSelected} className="pointer-events-none" />
            <span>Mix all</span>
          </button>
          <div className="my-1 h-px bg-slate-200 dark:bg-slate-700" />
          {options.map((option) => {
            const checked = selected.includes(option.value);
            return (
              <label
                key={option.value}
                className="flex cursor-pointer items-start gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-slate-50 dark:hover:bg-slate-800/60"
              >
                <Checkbox
                  checked={checked}
                  className="mt-0.5"
                  onCheckedChange={(value) => {
                    if (value === true) {
                      setSelected([...selected, option.value]);
                    } else {
                      setSelected(selected.filter((item) => item !== option.value));
                    }
                  }}
                />
                <span>
                  <span className="block">{option.label}</span>
                  {option.description ? (
                    <span className="block text-[11px] text-gray-500">{option.description}</span>
                  ) : null}
                </span>
              </label>
            );
          })}
        </PopoverContent>
      </Popover>
      {hint ? <p className="text-[11px] text-gray-500">{hint}</p> : null}
    </div>
  );
}

function redistributeSizeCounts(
  selected: SudokuSize[],
  total: number
): SudokuMixedSizeCounts {
  const empty: SudokuMixedSizeCounts = { 4: 0, 6: 0, 9: 0, 12: 0, 16: 0, 25: 0 };
  if (selected.length === 0) return empty;
  if (selected.length === SUDOKU_SIZES.length) return defaultMixedSudokuSizeCounts(total);
  const weights = defaultMixedSudokuSizeCounts(Math.max(selected.length * 4, total));
  const raw = selected.map((size) => Math.max(1, weights[size] ?? 1));
  const rawSum = raw.reduce((sum, value) => sum + value, 0);
  let used = 0;
  selected.forEach((size, index) => {
    if (index === selected.length - 1) {
      empty[size] = Math.max(0, total - used);
    } else {
      const n = Math.max(0, Math.round((total * raw[index]!) / rawSum));
      empty[size] = n;
      used += n;
    }
  });
  return empty;
}

function redistributeLevelCounts(
  selected: Array<'easy' | 'medium' | 'hard'>,
  total: number
): { easy: number; medium: number; hard: number } {
  const next = { easy: 0, medium: 0, hard: 0 };
  if (selected.length === 0) return next;
  if (selected.length === 3) return defaultMixedSudokuLevelCounts(total);
  const defaults = defaultMixedSudokuLevelCounts(Math.max(selected.length * 3, total));
  const raw = selected.map((level) => Math.max(1, defaults[level]));
  const rawSum = raw.reduce((sum, value) => sum + value, 0);
  let used = 0;
  selected.forEach((level, index) => {
    if (index === selected.length - 1) {
      next[level] = Math.max(0, total - used);
    } else {
      const n = Math.max(0, Math.round((total * raw[index]!) / rawSum));
      next[level] = n;
      used += n;
    }
  });
  return next;
}

function selectedStandardSizes(core: GenericPuzzleSettings['core']): SudokuSize[] {
  if (core.sudokuSize === 'mixed') {
    const counts = sudokuSizeCountsFromCore(core);
    const selected = SUDOKU_SIZES.filter((size) => (counts[size] ?? 0) > 0);
    return selected.length > 0 ? selected : [...SUDOKU_SIZES];
  }
  return isSudokuSize(core.sudokuSize) ? [core.sudokuSize] : [9];
}

function selectedStandardLevels(
  core: GenericPuzzleSettings['core']
): Array<'easy' | 'medium' | 'hard'> {
  if (core.sudokuDifficulty === 'mixed') {
    const levels: Array<'easy' | 'medium' | 'hard'> = [];
    if (core.sudokuMixedEasyCount > 0) levels.push('easy');
    if (core.sudokuMixedMediumCount > 0) levels.push('medium');
    if (core.sudokuMixedHardCount > 0) levels.push('hard');
    return levels.length > 0 ? levels : ['easy', 'medium', 'hard'];
  }
  if (core.sudokuDifficulty === 'easy' || core.sudokuDifficulty === 'hard') {
    return [core.sudokuDifficulty];
  }
  return ['medium'];
}

const SHAPE_COUNT_FIELD: Record<
  MazeShapeMode,
  | 'mazeMixedShapeSquare'
  | 'mazeMixedShapeCircle'
  | 'mazeMixedShapeDiamond'
  | 'mazeMixedShapeHexagon'
  | 'mazeMixedShapeTriangle'
  | 'mazeMixedShapeCustomImage'
> = {
  square: 'mazeMixedShapeSquare',
  circle: 'mazeMixedShapeCircle',
  diamond: 'mazeMixedShapeDiamond',
  hexagon: 'mazeMixedShapeHexagon',
  triangle: 'mazeMixedShapeTriangle',
  custom_image: 'mazeMixedShapeCustomImage',
};

function shapeCountsFromCore(core: GenericPuzzleSettings['core']): MazeMixedShapeCounts {
  return {
    square: core.mazeMixedShapeSquare,
    circle: core.mazeMixedShapeCircle,
    diamond: core.mazeMixedShapeDiamond,
    hexagon: core.mazeMixedShapeHexagon,
    triangle: core.mazeMixedShapeTriangle,
    custom_image: core.mazeMixedShapeCustomImage ?? 0,
  };
}

function patchFromShapeCounts(counts: MazeMixedShapeCounts) {
  return {
    mazeMixedShapeSquare: counts.square,
    mazeMixedShapeCircle: counts.circle,
    mazeMixedShapeDiamond: counts.diamond,
    mazeMixedShapeHexagon: counts.hexagon,
    mazeMixedShapeTriangle: counts.triangle,
    mazeMixedShapeCustomImage: counts.custom_image,
    numberOfPuzzles: sumMixedMazeShapeCounts(counts),
  };
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.onerror = () => reject(reader.error ?? new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}

function MazeMarkerImageUploads({
  startImage,
  endImage,
  onStartImage,
  onEndImage,
}: {
  startImage: string;
  endImage: string;
  onStartImage: (url: string) => void;
  onEndImage: (url: string) => void;
}) {
  const startRef = useRef<HTMLInputElement>(null);
  const endRef = useRef<HTMLInputElement>(null);

  const slot = (
    label: string,
    value: string,
    inputRef: React.RefObject<HTMLInputElement | null>,
    onChange: (url: string) => void
  ) => (
    <div className="flex items-center gap-2 rounded border border-gray-200 dark:border-slate-700 px-2 py-1.5">
      {value ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={value}
          alt=""
          className="h-10 w-10 rounded object-cover border shrink-0"
        />
      ) : (
        <div className="h-10 w-10 rounded border border-dashed shrink-0 bg-muted/40" />
      )}
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium truncate">{label}</p>
        <p className="text-[10px] text-muted-foreground">Used on all maze pages</p>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = '';
          if (!file) return;
          void readFileAsDataUrl(file).then(onChange);
        }}
      />
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-7 text-[10px] px-2"
        onClick={() => inputRef.current?.click()}
      >
        <Upload className="w-3 h-3 mr-1" />
        {value ? 'Replace' : 'Upload'}
      </Button>
      {value ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 px-1"
          onClick={() => onChange('')}
        >
          <Trash2 className="w-3 h-3" />
        </Button>
      ) : null}
    </div>
  );

  return (
    <div className="space-y-2">
      <Label className="text-sm font-medium">Marker images</Label>
      <p className="text-[11px] text-gray-500">
        Upload one start image and one end image — applied to every maze page in this
        document.
      </p>
      {slot('Start image', startImage, startRef, onStartImage)}
      {slot('End image', endImage, endRef, onEndImage)}
    </div>
  );
}

function useGenericPuzzleDoc(moduleType: GenericPuzzleModuleType) {
  const { genericPuzzleSettings, updateGenericPuzzleSettings, wordSearchSettings } = useApp();

  const settings = normalizeGenericPuzzleSettings(genericPuzzleSettings, moduleType);
  const { core, typography, colors } = settings;

  const patchCore = (patch: Partial<GenericPuzzleSettings['core']>) => {
    updateGenericPuzzleSettings({ core: { ...core, ...patch } });
  };
  const patchTypography = (patch: Partial<GenericPuzzleSettings['typography']>) => {
    updateGenericPuzzleSettings({ typography: { ...typography, ...patch } });
  };
  const patchColors = (patch: Partial<GenericPuzzleSettings['colors']>) => {
    updateGenericPuzzleSettings({ colors: { ...colors, ...patch } });
  };

  return {
    core,
    typography,
    colors,
    settings,
    wordSearchSettings,
    updateGenericPuzzleSettings,
    patchCore,
    patchTypography,
    patchColors,
  };
}

function useGenericAutoFit(moduleType: GenericPuzzleModuleType) {
  const {
    core,
    typography,
    settings,
    wordSearchSettings,
    updateGenericPuzzleSettings,
    patchCore,
  } = useGenericPuzzleDoc(moduleType);

  const applyKey = [
    pageFitApplyKey(wordSearchSettings),
    moduleType,
    core.puzzlesPerPage,
    core.sudokuSize,
    core.sudokuPuzzleMode,
    core.calcudokuGridSize,
    core.mazeSize,
    core.mazeEasyGridLength,
    core.mazeMediumGridLength,
    core.mazeHardGridLength,
    core.wordsPerPuzzle,
    core.questionsPerPage,
    typography.titleStartAt,
    typography.spaceBetweenTitleAndPuzzle,
  ].join('|');

  const apply = useCallback(() => {
    const fit = computeGenericAutoFit(settings, wordSearchSettings, moduleType, {
      fitGrid: false,
      fitFont: core.autoBalanceFont === true,
    });
    if (Object.keys(fit).length === 0) return;
    const current: Record<string, number | undefined> = {
      puzzleGridScale: core.puzzleGridScale,
      solutionGridScale: core.solutionGridScale,
      puzzleTitleFontSize: typography.puzzleTitleFontSize,
      answerTitleFontSize: typography.answerTitleFontSize,
      puzzleFontSize: typography.puzzleFontSize,
      answerFontSize: typography.answerFontSize,
    };
    if (fitValuesUnchanged(current, fit)) return;
    const typePatch: Partial<GenericPuzzleSettings['typography']> = {};
    if (fit.puzzleTitleFontSize != null) typePatch.puzzleTitleFontSize = fit.puzzleTitleFontSize;
    if (fit.answerTitleFontSize != null) typePatch.answerTitleFontSize = fit.answerTitleFontSize;
    if (fit.puzzleFontSize != null) typePatch.puzzleFontSize = fit.puzzleFontSize;
    if (fit.answerFontSize != null) typePatch.answerFontSize = fit.answerFontSize;
    updateGenericPuzzleSettings({
      ...(Object.keys(typePatch).length ? { typography: { ...typography, ...typePatch } } : {}),
    });
  }, [core, typography, settings, wordSearchSettings, moduleType, updateGenericPuzzleSettings]);

  return {
    autoBalanceFont: core.autoBalanceFont === true,
    setFontEnabled: (next: boolean) => patchCore({ autoBalanceFont: next }),
    apply,
    applyKey,
  };
}



function PanelHeader({ title, onSave }: { title: string; onSave?: () => void }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-wide text-sky-600 dark:text-sky-400">
          Document Â· This tab
        </p>
        <h3 className="font-semibold text-gray-900 dark:text-white">{title}</h3>
      </div>
      {onSave && (
        <Button variant="outline" size="sm" onClick={onSave}>
          <Save className="w-4 h-4 mr-2" />Save
        </Button>
      )}
    </div>
  );
}

function PuzzlesPerPageSelect({
  value,
  onChange,
  options = [1, 2, 3, 4],
  labels,
}: {
  value: number;
  onChange: (n: number) => void;
  options?: number[];
  labels?: Record<number, string>;
}) {
  const safeOptions = options.length > 0 ? options : [1, 2, 4];
  const selected = safeOptions.includes(value) ? value : safeOptions[0];
  return (
    <div className="space-y-1">
      <Label className="text-sm font-medium">Puzzles Per Page</Label>
      <Select
        value={selected.toString()}
        onValueChange={(v) => onChange(parseInt(v, 10))}
      >
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {safeOptions.map((n) => (
            <SelectItem key={n} value={n.toString()}>
              {labels?.[n] ?? String(n)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

type CorePatch = (patch: Partial<GenericPuzzleSettings['core']>) => void;

function StandardSudokuGenerationFields({
  core,
  patchCore,
  syncQuantity,
}: {
  core: GenericPuzzleSettings['core'];
  patchCore: CorePatch;
  syncQuantity: boolean;
}) {
  return (
    <>
      <MultiSelectPicker
        label="Grid Size"
        options={SUDOKU_SIZE_META.map((row) => ({
          value: String(row.size) as `${SudokuSize}`,
          label: row.label,
          description: row.description,
        }))}
        selected={selectedStandardSizes(core).map((size) => String(size) as `${SudokuSize}`)}
        onChange={(values) => {
          const selected = values
            .map((value) => parseInt(value, 10))
            .filter((size): size is SudokuSize => isSudokuSize(size));
          if (selected.length === 1) {
            patchCore({ sudokuSize: selected[0] });
            return;
          }
          const counts = redistributeSizeCounts(selected, core.numberOfPuzzles);
          const patch: Partial<GenericPuzzleSettings['core']> = {
            sudokuSize: 'mixed',
            ...patchFromSudokuSizeCounts(counts, syncQuantity),
          };
          if (syncQuantity && core.sudokuDifficulty === 'mixed') {
            const levels = defaultMixedSudokuLevelCounts(patch.numberOfPuzzles!);
            patch.sudokuMixedEasyCount = levels.easy;
            patch.sudokuMixedMediumCount = levels.medium;
            patch.sudokuMixedHardCount = levels.hard;
          }
          patchCore(patch);
        }}
        hint="Open the menu to pick one size, several sizes, or Mix all. Larger grids (16×16, 25×25) use numbers 1–9 plus letters."
      />

      {core.sudokuSize === 'mixed' ? (
        <div className="rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/40 p-3 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-medium text-slate-700 dark:text-slate-200">
              Puzzles per grid size
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 text-[10px]"
              onClick={() => {
                const counts = defaultMixedSudokuSizeCounts(core.numberOfPuzzles);
                const patch: Partial<GenericPuzzleSettings['core']> = {
                  ...patchFromSudokuSizeCounts(counts, syncQuantity),
                };
                if (syncQuantity && core.sudokuDifficulty === 'mixed') {
                  const levels = defaultMixedSudokuLevelCounts(patch.numberOfPuzzles!);
                  patch.sudokuMixedEasyCount = levels.easy;
                  patch.sudokuMixedMediumCount = levels.medium;
                  patch.sudokuMixedHardCount = levels.hard;
                }
                patchCore(patch);
              }}
            >
              Reset split
            </Button>
          </div>
          <p className="text-[11px] text-gray-500">
            {syncQuantity
              ? 'Harder sizes get the largest share by default. Edit freely — total becomes the number of puzzles.'
              : 'Used as the size mix for Standard Sudoku puzzles in this batch. Total puzzle count is set above.'}
          </p>
          {SUDOKU_SIZE_META.map((row) => {
            const key = SUDOKU_SIZE_COUNT_FIELD[row.size];
            const value = core[key];
            return (
              <div key={row.size} className="grid grid-cols-[1fr_88px] items-center gap-2">
                <div>
                  <p className="text-xs font-medium">
                    {row.label}
                    <span className="text-gray-500 font-normal"> Â· {row.description}</span>
                  </p>
                </div>
                <IntegerInput
                  value={value}
                  onChange={(v) => {
                    const next = {
                      ...sudokuSizeCountsFromCore(core),
                      [row.size]: Math.max(0, v),
                    };
                    const patch: Partial<GenericPuzzleSettings['core']> = {
                      ...patchFromSudokuSizeCounts(next, syncQuantity),
                    };
                    if (syncQuantity && core.sudokuDifficulty === 'mixed') {
                      const levels = defaultMixedSudokuLevelCounts(patch.numberOfPuzzles!);
                      patch.sudokuMixedEasyCount = levels.easy;
                      patch.sudokuMixedMediumCount = levels.medium;
                      patch.sudokuMixedHardCount = levels.hard;
                    }
                    patchCore(patch);
                  }}
                  min={0}
                  max={600}
                />
              </div>
            );
          })}
          <p className="text-[11px] text-slate-600 dark:text-slate-300">
            Total:{' '}
            <span className="font-semibold">
              {sumMixedSudokuSizeCounts(sudokuSizeCountsFromCore(core))}
            </span>{' '}
            {syncQuantity ? 'puzzles' : 'weight'}
          </p>
        </div>
      ) : null}

      <MultiSelectPicker
        label="Difficulty"
        options={[
          { value: 'easy', label: 'Easy' },
          { value: 'medium', label: 'Medium' },
          { value: 'hard', label: 'Hard' },
        ]}
        selected={selectedStandardLevels(core)}
        onChange={(selected) => {
          if (selected.length === 1) {
            patchCore({ sudokuDifficulty: selected[0] });
            return;
          }
          const counts = redistributeLevelCounts(selected, core.numberOfPuzzles);
          const patch: Partial<GenericPuzzleSettings['core']> = {
            sudokuDifficulty: 'mixed',
            sudokuMixedEasyCount: counts.easy,
            sudokuMixedMediumCount: counts.medium,
            sudokuMixedHardCount: counts.hard,
            ...(syncQuantity
              ? { numberOfPuzzles: counts.easy + counts.medium + counts.hard }
              : {}),
          };
          if (syncQuantity && core.sudokuSize === 'mixed') {
            Object.assign(
              patch,
              patchFromSudokuSizeCounts(
                defaultMixedSudokuSizeCounts(patch.numberOfPuzzles ?? core.numberOfPuzzles),
                true
              )
            );
          }
          patchCore(patch);
        }}
        hint="Open the menu to pick one level, several levels, or Mix all. Clue density scales with board size."
      />

      {core.sudokuDifficulty === 'mixed' ? (
        <div className="rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/40 p-3 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-medium text-slate-700 dark:text-slate-200">
              Puzzles per level
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 text-[10px]"
              onClick={() => {
                const counts = defaultMixedSudokuLevelCounts(core.numberOfPuzzles);
                const patch: Partial<GenericPuzzleSettings['core']> = {
                  sudokuMixedEasyCount: counts.easy,
                  sudokuMixedMediumCount: counts.medium,
                  sudokuMixedHardCount: counts.hard,
                  ...(syncQuantity
                    ? { numberOfPuzzles: counts.easy + counts.medium + counts.hard }
                    : {}),
                };
                if (syncQuantity && core.sudokuSize === 'mixed') {
                  Object.assign(
                    patch,
                    patchFromSudokuSizeCounts(
                      defaultMixedSudokuSizeCounts(patch.numberOfPuzzles ?? core.numberOfPuzzles),
                      true
                    )
                  );
                }
                patchCore(patch);
              }}
            >
              Reset split
            </Button>
          </div>
          <p className="text-[11px] text-gray-500">
            Hard gets the largest share by default (~50%), then medium (~30%), then
            easy (~20%).{syncQuantity ? ' Edit freely — total becomes the number of puzzles.' : ''}
          </p>
          {(
            [
              { level: 'easy' as const, key: 'sudokuMixedEasyCount' as const, label: 'Easy' },
              {
                level: 'medium' as const,
                key: 'sudokuMixedMediumCount' as const,
                label: 'Medium',
              },
              { level: 'hard' as const, key: 'sudokuMixedHardCount' as const, label: 'Hard' },
            ] as const
          ).map((row) => (
            <div key={row.level} className="grid grid-cols-[1fr_88px] items-center gap-2">
              <p className="text-xs font-medium">{row.label}</p>
              <IntegerInput
                value={core[row.key]}
                onChange={(v) => {
                  const next = {
                    sudokuMixedEasyCount: core.sudokuMixedEasyCount,
                    sudokuMixedMediumCount: core.sudokuMixedMediumCount,
                    sudokuMixedHardCount: core.sudokuMixedHardCount,
                    [row.key]: Math.max(0, v),
                  };
                  const patch: Partial<GenericPuzzleSettings['core']> = {
                    ...next,
                    ...(syncQuantity
                      ? {
                          numberOfPuzzles:
                            next.sudokuMixedEasyCount +
                            next.sudokuMixedMediumCount +
                            next.sudokuMixedHardCount,
                        }
                      : {}),
                  };
                  if (syncQuantity && core.sudokuSize === 'mixed') {
                    Object.assign(
                      patch,
                      patchFromSudokuSizeCounts(
                        defaultMixedSudokuSizeCounts(patch.numberOfPuzzles ?? core.numberOfPuzzles),
                        true
                      )
                    );
                  }
                  patchCore(patch);
                }}
                min={0}
                max={600}
              />
            </div>
          ))}
          <p className="text-[11px] text-slate-600 dark:text-slate-300">
            Total:{' '}
            <span className="font-semibold">
              {core.sudokuMixedEasyCount +
                core.sudokuMixedMediumCount +
                core.sudokuMixedHardCount}
            </span>{' '}
            {syncQuantity ? 'puzzles' : 'weight'}
          </p>
        </div>
      ) : null}
    </>
  );
}

function CalcudokuGenerationFields({
  core,
  patchCore,
}: {
  core: GenericPuzzleSettings['core'];
  patchCore: CorePatch;
}) {
  const selectedSizes =
    core.calcudokuGridSize === 'mixed'
      ? selectedCalcudokuMixSizes(core)
      : isCalcudokuGridSize(core.calcudokuGridSize)
        ? [core.calcudokuGridSize]
        : [6];
  const sizeSelection = selectedSizes.length > 0 ? selectedSizes : [...CALCUDOKU_GRID_SIZES];

  const selectedLevels: CalcudokuConcreteDifficulty[] =
    core.calcudokuDifficulty === 'mixed'
      ? selectedCalcudokuMixDifficulties(core)
      : core.calcudokuDifficulty === 'medium' ||
          core.calcudokuDifficulty === 'hard' ||
          core.calcudokuDifficulty === 'expert'
        ? [core.calcudokuDifficulty]
        : ['easy'];
  const levelSelection =
    selectedLevels.length > 0 ? selectedLevels : [...CALCUDOKU_DIFFICULTIES];

  return (
    <div className="space-y-3">
      <MultiSelectPicker
        label="Grid Size"
        options={CALCUDOKU_GRID_SIZES.map((size) => ({
          value: String(size),
          label: `${size}×${size}`,
        }))}
        selected={sizeSelection.map(String)}
        onChange={(values) => {
          const selected = values
            .map((value) => parseInt(value, 10))
            .filter((size): size is (typeof CALCUDOKU_GRID_SIZES)[number] =>
              isCalcudokuGridSize(size)
            );
          if (selected.length === 1) {
            patchCore({ calcudokuGridSize: selected[0] });
            return;
          }
          const patch: Partial<GenericPuzzleSettings['core']> = { calcudokuGridSize: 'mixed' };
          for (const size of CALCUDOKU_GRID_SIZES) {
            patch[CALCUDOKU_MIX_SIZE_FIELD[size]] = selected.includes(size);
          }
          patchCore(patch);
        }}
        hint="Open the menu to pick one size, several sizes, or Mix all."
      />

      <MultiSelectPicker
        label="Difficulty"
        options={[
          { value: 'easy', label: 'Easy', description: 'Addition only' },
          { value: 'medium', label: 'Medium', description: 'Addition and subtraction' },
          { value: 'hard', label: 'Hard', description: 'Adds multiplication' },
          { value: 'expert', label: 'Expert', description: 'Adds division' },
        ]}
        selected={levelSelection}
        onChange={(selected) => {
          if (selected.length === 1) {
            patchCore({ calcudokuDifficulty: selected[0] });
            return;
          }
          const patch: Partial<GenericPuzzleSettings['core']> = { calcudokuDifficulty: 'mixed' };
          for (const level of CALCUDOKU_DIFFICULTIES) {
            patch[CALCUDOKU_MIX_DIFFICULTY_FIELD[level]] = selected.includes(level);
          }
          patchCore(patch);
        }}
        hint="Open the menu to pick one level, several levels, or Mix all."
      />
    </div>
  );
}

function SudokuTypeSelector({
  selected,
  onChange,
}: {
  selected: Array<'standard' | 'calcudoku'>;
  onChange: (next: Array<'standard' | 'calcudoku'>) => void;
}) {
  return (
    <MultiSelectPicker
      label="Sudoku Type"
      options={[
        { value: 'standard', label: 'Standard Sudoku' },
        { value: 'calcudoku', label: 'Calcudoku' },
      ]}
      selected={selected}
      onChange={onChange}
      hint="Open the menu to pick Standard, Calcudoku, or Mix all."
    />
  );
}

export function GenericPuzzleSettingsPanel({
  moduleType,
  onSave,
}: {
  moduleType: GenericPuzzleModuleType;
  onSave?: () => void;
}) {
  const { core, typography, colors, patchCore, patchTypography, patchColors } =
    useGenericPuzzleDoc(moduleType);

  return (
    <div className="space-y-4">
      <PanelHeader title="Puzzle Settings" onSave={onSave} />



      <div className="space-y-3">
        <Label className="text-sm font-medium">Quantity</Label>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-xs text-gray-500">Number of Puzzles</Label>
            <IntegerInput
              value={core.numberOfPuzzles}
              onChange={(v) => {
                if (moduleType === 'maze') {
                  const patch: Partial<GenericPuzzleSettings['core']> = { numberOfPuzzles: v };
                  if (core.mazeSize === 'mixed') {
                    const counts = defaultMixedMazeLevelCounts(v);
                    patch.mazeMixedEasyCount = counts.easy;
                    patch.mazeMixedMediumCount = counts.medium;
                    patch.mazeMixedHardCount = counts.hard;
                    patch.numberOfPuzzles = counts.easy + counts.medium + counts.hard;
                  }
                  if (core.mazeShape === 'mixed') {
                    const shapes = defaultMixedMazeShapeCounts(patch.numberOfPuzzles ?? v);
                    Object.assign(patch, patchFromShapeCounts(shapes));
                  }
                  patchCore(patch);
                  return;
                }
                if (moduleType === 'sudoku') {
                  const patch: Partial<GenericPuzzleSettings['core']> = { numberOfPuzzles: v };
                  const mode = core.sudokuPuzzleMode ?? 'standard';
                  if (mode === 'standard' && core.sudokuDifficulty === 'mixed') {
                    const counts = defaultMixedSudokuLevelCounts(v);
                    patch.sudokuMixedEasyCount = counts.easy;
                    patch.sudokuMixedMediumCount = counts.medium;
                    patch.sudokuMixedHardCount = counts.hard;
                    patch.numberOfPuzzles = counts.easy + counts.medium + counts.hard;
                  }
                  if (mode === 'standard' && core.sudokuSize === 'mixed') {
                    const sizes = defaultMixedSudokuSizeCounts(patch.numberOfPuzzles ?? v);
                    Object.assign(patch, patchFromSudokuSizeCounts(sizes, true));
                  }
                  patchCore(patch);
                  return;
                }
                patchCore({ numberOfPuzzles: v });
              }}
              min={0}
              max={600}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-gray-500">Starting Number</Label>
            <IntegerInput
              value={core.puzzlesStartingNumber}
              onChange={(v) => patchCore({ puzzlesStartingNumber: v })}
              min={0}
              max={9999}
            />
          </div>
        </div>
        <DivideListsIntoChaptersControl
          numberOfPuzzles={core.numberOfPuzzles}
          puzzlesStartingNumber={core.puzzlesStartingNumber}
        />

        <PuzzlesPerPageSelect
          value={core.puzzlesPerPage}
          onChange={(n) => patchCore({ puzzlesPerPage: n })}
          options={moduleType === 'word-scramble' ? [1, 2, 4] : [1, 2, 3, 4]}
          labels={
            moduleType === 'word-scramble'
              ? {
                  1: '1 per page',
                  2: '2 puzzles per page',
                  4: '4 puzzles per page',
                }
              : undefined
          }
        />

        {moduleType === 'sudoku' ? (
          <>
            <SudokuTypeSelector
              selected={
                core.sudokuPuzzleMode === 'calcudoku'
                  ? ['calcudoku']
                  : core.sudokuPuzzleMode === 'mixed'
                    ? [
                        ...(core.sudokuMixedIncludeStandard !== false ? (['standard'] as const) : []),
                        ...(core.sudokuMixedIncludeCalcudoku !== false
                          ? (['calcudoku'] as const)
                          : []),
                      ]
                    : ['standard']
              }
              onChange={(selected) => {
                if (selected.length === 1) {
                  patchCore({
                    sudokuPuzzleMode: selected[0],
                    sudokuMixedIncludeStandard: selected[0] === 'standard',
                    sudokuMixedIncludeCalcudoku: selected[0] === 'calcudoku',
                  });
                  return;
                }
                patchCore({
                  sudokuPuzzleMode: 'mixed',
                  sudokuMixedIncludeStandard: selected.includes('standard'),
                  sudokuMixedIncludeCalcudoku: selected.includes('calcudoku'),
                });
              }}
            />

            {core.sudokuPuzzleMode === 'standard' || !core.sudokuPuzzleMode ? (
              <StandardSudokuGenerationFields core={core} patchCore={patchCore} syncQuantity />
            ) : null}

            {core.sudokuPuzzleMode === 'calcudoku' ? (
              <div className="space-y-2">
                <p className="text-sm font-medium">Calcudoku Settings</p>
                <CalcudokuGenerationFields core={core} patchCore={patchCore} />
              </div>
            ) : null}

            {core.sudokuPuzzleMode === 'mixed' && core.sudokuMixedIncludeStandard !== false ? (
              <details open className="rounded-md border border-slate-200 dark:border-slate-700">
                <summary className="cursor-pointer select-none px-3 py-2 text-sm font-medium">
                  Standard Sudoku Settings
                </summary>
                <div className="space-y-3 px-3 pb-3">
                  <StandardSudokuGenerationFields
                    core={core}
                    patchCore={patchCore}
                    syncQuantity={false}
                  />
                </div>
              </details>
            ) : null}

            {core.sudokuPuzzleMode === 'mixed' && core.sudokuMixedIncludeCalcudoku !== false ? (
              <details open className="rounded-md border border-slate-200 dark:border-slate-700">
                <summary className="cursor-pointer select-none px-3 py-2 text-sm font-medium">
                  Calcudoku Settings
                </summary>
                <div className="space-y-3 px-3 pb-3">
                  <CalcudokuGenerationFields core={core} patchCore={patchCore} />
                </div>
              </details>
            ) : null}

            {sudokuModeGenerationBlockMessage(core) ? (
              <p className="text-[11px] text-red-600">{sudokuModeGenerationBlockMessage(core)}</p>
            ) : sudokuModeGenerationHint(core) ? (
              <p className="text-[11px] text-amber-700">{sudokuModeGenerationHint(core)}</p>
            ) : null}

            <div className="space-y-1">
              <Label className="text-sm font-medium">Difficulty Label</Label>
              <Select
                value={core.sudokuDifficultyPlacement}
                onValueChange={(value) => {
                  const sudokuDifficultyPlacement = value as SudokuDifficultyPlacement;
                  patchCore({
                    sudokuDifficultyPlacement,
                    showDifficultyLabel: sudokuDifficultyPlacement !== 'none',
                  });
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="bottom">Below grid (Difficulty: Easy)</SelectItem>
                  <SelectItem value="top">Under title / above grid</SelectItem>
                  <SelectItem value="in_title">Include in title (Easy Sudoku)</SelectItem>
                  <SelectItem value="none">Hide difficulty label</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <SliderField
              label="Puzzle Line Thickness"
              value={core.sudokuPuzzleLineThickness}
              onValueChange={(v) => patchCore({ sudokuPuzzleLineThickness: v })}
              min={0}
              max={250}
              format="percent"
            />
            <SliderField
              label="Solution Line Thickness"
              value={core.sudokuSolutionLineThickness}
              onValueChange={(v) => patchCore({ sudokuSolutionLineThickness: v })}
              min={0}
              max={250}
              format="percent"
            />
          </>
        ) : null}

        {moduleType === 'maze' ? (
          <>
            <div className="space-y-1">
              <Label className="text-sm font-medium">Maze Size</Label>
              <Select
                value={core.mazeSize}
                onValueChange={(value) => {
                  const mazeSize = value as MazeSizeMode;
                  if (mazeSize === 'mixed') {
                    const counts = defaultMixedMazeLevelCounts(core.numberOfPuzzles);
                    const patch: Partial<GenericPuzzleSettings['core']> = {
                      mazeSize,
                      mazeMixedEasyCount: counts.easy,
                      mazeMixedMediumCount: counts.medium,
                      mazeMixedHardCount: counts.hard,
                      numberOfPuzzles: counts.easy + counts.medium + counts.hard,
                    };
                    if (core.mazeShape === 'mixed') {
                      Object.assign(
                        patch,
                        patchFromShapeCounts(
                          defaultMixedMazeShapeCounts(patch.numberOfPuzzles!)
                        )
                      );
                    }
                    patchCore(patch);
                  } else {
                    patchCore({ mazeSize });
                  }
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="small">Small (10 × 10)</SelectItem>
                  <SelectItem value="medium">Medium (15 × 15)</SelectItem>
                  <SelectItem value="large">Large (20 × 20)</SelectItem>
                  <SelectItem value="xl">XL (25 × 25)</SelectItem>
                  <SelectItem value="mixed">Mixed difficulty (easy â†’ hard)</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-[11px] text-gray-500">
                Perfect mazes — exactly one path from start to end. Difficulty is based
                mainly on how many turns the path takes (easy/medium) or how long the
                route is (hard).
              </p>
            </div>
            {core.mazeSize === 'mixed' ? (
              <div className="rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/40 p-3 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-medium text-slate-700 dark:text-slate-200">
                    Puzzles per level
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 text-[10px]"
                    onClick={() => {
                      const counts = defaultMixedMazeLevelCounts(core.numberOfPuzzles);
                      const patch: Partial<GenericPuzzleSettings['core']> = {
                        mazeMixedEasyCount: counts.easy,
                        mazeMixedMediumCount: counts.medium,
                        mazeMixedHardCount: counts.hard,
                        numberOfPuzzles: counts.easy + counts.medium + counts.hard,
                      };
                      if (core.mazeShape === 'mixed') {
                        Object.assign(
                          patch,
                          patchFromShapeCounts(
                            defaultMixedMazeShapeCounts(patch.numberOfPuzzles!)
                          )
                        );
                      }
                      patchCore(patch);
                    }}
                  >
                    Reset split
                  </Button>
                </div>
                <p className="text-[11px] text-gray-500">
                  Edit Length × Width per level, plus how many puzzles each level gets.
                  Easy/medium prioritize turn count; hard prioritizes longer routes.
                </p>
                <div className="grid grid-cols-[minmax(0,1fr)_52px_52px_56px] items-center gap-2 px-0.5">
                  <span className="text-[10px] text-gray-500">Level</span>
                  <span className="text-[10px] text-gray-500 text-center">Length</span>
                  <span className="text-[10px] text-gray-500 text-center">Width</span>
                  <span className="text-[10px] text-gray-500 text-center">Count</span>
                </div>
                {MAZE_SIZE_LEVEL_META.map((row) => {
                  const countKey =
                    row.level === 'easy'
                      ? 'mazeMixedEasyCount'
                      : row.level === 'medium'
                        ? 'mazeMixedMediumCount'
                        : 'mazeMixedHardCount';
                  const lengthKey =
                    row.level === 'easy'
                      ? 'mazeEasyGridLength'
                      : row.level === 'medium'
                        ? 'mazeMediumGridLength'
                        : 'mazeHardGridLength';
                  const widthKey =
                    row.level === 'easy'
                      ? 'mazeEasyGridWidth'
                      : row.level === 'medium'
                        ? 'mazeMediumGridWidth'
                        : 'mazeHardGridWidth';
                  const count = core[countKey];
                  const lengthN = core[lengthKey];
                  const widthN = core[widthKey];
                  return (
                    <div
                      key={row.level}
                      className="grid grid-cols-[minmax(0,1fr)_52px_52px_56px] items-center gap-2"
                    >
                      <div className="min-w-0">
                        <p className="text-xs font-medium">{row.label}</p>
                        <p className="text-[10px] text-gray-500 truncate">{row.sizeLabel}</p>
                      </div>
                      <IntegerInput
                        value={lengthN}
                        onChange={(v) =>
                          patchCore({ [lengthKey]: Math.max(5, Math.min(40, v)) })
                        }
                        min={0}
                        max={40}
                      />
                      <IntegerInput
                        value={widthN}
                        onChange={(v) =>
                          patchCore({ [widthKey]: Math.max(5, Math.min(40, v)) })
                        }
                        min={0}
                        max={40}
                      />
                      <IntegerInput
                        value={count}
                        onChange={(v) => {
                          const next = {
                            mazeMixedEasyCount: core.mazeMixedEasyCount,
                            mazeMixedMediumCount: core.mazeMixedMediumCount,
                            mazeMixedHardCount: core.mazeMixedHardCount,
                            [countKey]: Math.max(0, v),
                          };
                          const patch: Partial<GenericPuzzleSettings['core']> = {
                            ...next,
                            numberOfPuzzles:
                              next.mazeMixedEasyCount +
                              next.mazeMixedMediumCount +
                              next.mazeMixedHardCount,
                          };
                          if (core.mazeShape === 'mixed') {
                            Object.assign(
                              patch,
                              patchFromShapeCounts(
                                defaultMixedMazeShapeCounts(patch.numberOfPuzzles!)
                              )
                            );
                          }
                          patchCore(patch);
                        }}
                        min={0}
                        max={600}
                      />
                    </div>
                  );
                })}
                <p className="text-[11px] font-medium text-slate-600 dark:text-slate-300">
                  Total:{' '}
                  {core.mazeMixedEasyCount +
                    core.mazeMixedMediumCount +
                    core.mazeMixedHardCount}{' '}
                  puzzles
                </p>
              </div>
            ) : null}
            <div className="space-y-1">
              <Label className="text-sm font-medium">Maze Shape</Label>
              <Select
                value={core.mazeShape}
                onValueChange={(value) => {
                  const mazeShape = value as MazeShapeMode;
                  if (mazeShape === 'mixed') {
                    const counts = defaultMixedMazeShapeCounts(core.numberOfPuzzles);
                    const patch: Partial<GenericPuzzleSettings['core']> = {
                      mazeShape,
                      ...patchFromShapeCounts(counts),
                    };
                    if (core.mazeSize === 'mixed') {
                      const levels = defaultMixedMazeLevelCounts(patch.numberOfPuzzles!);
                      patch.mazeMixedEasyCount = levels.easy;
                      patch.mazeMixedMediumCount = levels.medium;
                      patch.mazeMixedHardCount = levels.hard;
                    }
                    patchCore(patch);
                  } else if (mazeShape === 'custom_image') {
                    patchCore({ mazeShape, shapeMazeEnabled: true });
                  } else {
                    patchCore({ mazeShape, shapeMazeEnabled: false });
                  }
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="square">Square</SelectItem>
                  <SelectItem value="circle">Circle</SelectItem>
                  <SelectItem value="triangle">Triangle</SelectItem>
                  <SelectItem value="diamond">Diamond</SelectItem>
                  <SelectItem value="hexagon">Hexagon</SelectItem>
                  <SelectItem value="custom_image">Image to maze</SelectItem>
                  <SelectItem value="mixed">Mixed shapes (easy → hard)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {core.mazeShape === 'mixed' ? (
              <div className="rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/40 p-3 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-medium text-slate-700 dark:text-slate-200">
                    Puzzles per shape
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 text-[10px]"
                    onClick={() => {
                      const counts = defaultMixedMazeShapeCounts(core.numberOfPuzzles);
                      const patch: Partial<GenericPuzzleSettings['core']> = {
                        ...patchFromShapeCounts(counts),
                      };
                      if (core.mazeSize === 'mixed') {
                        const levels = defaultMixedMazeLevelCounts(patch.numberOfPuzzles!);
                        patch.mazeMixedEasyCount = levels.easy;
                        patch.mazeMixedMediumCount = levels.medium;
                        patch.mazeMixedHardCount = levels.hard;
                      }
                      patchCore(patch);
                    }}
                  >
                    Reset split
                  </Button>
                </div>
                <p className="text-[11px] text-gray-500">
                  Hard gets the largest share by default (~50%), then medium (~30%), then
                  easy (~20%). Edit freely — total becomes the number of puzzles.
                </p>
                {MAZE_SHAPE_MIX_META.map((row) => {
                  const field = SHAPE_COUNT_FIELD[row.shape];
                  const value = core[field];
                  return (
                    <div
                      key={row.shape}
                      className="grid grid-cols-[1fr_88px] items-center gap-2"
                    >
                      <div>
                        <p className="text-xs font-medium">
                          {row.label}
                          <span className="text-gray-500 font-normal"> · {row.level}</span>
                        </p>
                      </div>
                      <IntegerInput
                        value={value}
                        onChange={(v) => {
                          const next = {
                            ...shapeCountsFromCore(core),
                            [row.shape]: Math.max(0, v),
                          };
                          const patch: Partial<GenericPuzzleSettings['core']> = {
                            ...patchFromShapeCounts(next),
                          };
                          if (core.mazeSize === 'mixed') {
                            const levels = defaultMixedMazeLevelCounts(patch.numberOfPuzzles!);
                            patch.mazeMixedEasyCount = levels.easy;
                            patch.mazeMixedMediumCount = levels.medium;
                            patch.mazeMixedHardCount = levels.hard;
                          }
                          patchCore(patch);
                        }}
                        min={0}
                        max={600}
                      />
                    </div>
                  );
                })}
                <p className="text-[11px] font-medium text-slate-600 dark:text-slate-300">
                  Total: {sumMixedMazeShapeCounts(shapeCountsFromCore(core))} puzzles
                </p>
              </div>
            ) : null}

            {/* Shape Mazes */}
            <div className="pt-2 border-t border-gray-100 dark:border-slate-700/60 space-y-2">
              <div className="flex items-center justify-between">
                <Label
                  htmlFor="shape-maze-toggle"
                  className="text-xs font-semibold text-gray-700 dark:text-gray-200 cursor-pointer"
                >
                  Shape Mazes
                </Label>
                <Switch
                  id="shape-maze-toggle"
                  checked={core.mazeShape === 'custom_image' || Boolean(core.shapeMazeEnabled)}
                  onCheckedChange={(v) =>
                    patchCore({
                      shapeMazeEnabled: v,
                      mazeShape: v ? 'custom_image' : 'square',
                      shapeMaskMode: core.shapeMaskMode ?? 'common',
                    })
                  }
                />
              </div>
              <p className="text-xs text-muted-foreground -mt-1">
                Mazes follow a PNG silhouette (e.g. animal or object outline).
              </p>
              {(core.mazeShape === 'custom_image' || Boolean(core.shapeMazeEnabled)) && (
                <div className="p-3 bg-white dark:bg-slate-700/50 rounded-lg border border-gray-200 dark:border-slate-700 space-y-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-gray-700 dark:text-gray-200">
                      Shape images
                    </Label>
                    <Select
                      value={core.shapeMaskMode ?? 'common'}
                      onValueChange={(v) =>
                        patchCore({
                          shapeMaskMode: v as 'common' | 'per-puzzle',
                        })
                      }
                    >
                      <SelectTrigger className="h-8">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="common">One common image for all puzzles</SelectItem>
                        <SelectItem value="per-puzzle">Image shape for each puzzle</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {(core.shapeMaskMode ?? 'common') === 'common' ? (
                    <>
                      <div className="flex items-center justify-between">
                        <Label className="text-xs font-semibold text-gray-700 dark:text-gray-200">
                          Common shape PNG
                        </Label>
                        {core.shapeMaskImage && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => patchCore({ shapeMaskImage: undefined })}
                            className="h-8 px-2 text-[var(--gp-grey-800)] hover:text-[var(--gp-black)] hover:bg-[var(--gp-grey-100)] transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5 mr-1" />
                            Remove
                          </Button>
                        )}
                      </div>
                      {!core.shapeMaskImage ? (
                        <div>
                          <input
                            type="file"
                            id="maze-shape-mask-upload-common"
                            accept="image/png,image/jpeg,image/jpg,.png,.jpg,.jpeg,.webp"
                            className="hidden"
                            onChange={async (e) => {
                              const file = e.target.files?.[0];
                              e.target.value = '';
                              if (!file) return;
                              try {
                                const dataUrl = await readImageFileAsDataUrl(file);
                                patchCore({
                                  shapeMaskImage: dataUrl,
                                  shapeMaskMode: 'common',
                                  shapeMazeEnabled: true,
                                });
                              } catch (error) {
                                toast.error(
                                  error instanceof Error
                                    ? error.message
                                    : 'Could not read the shape image'
                                );
                              }
                            }}
                          />
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() =>
                              document.getElementById('maze-shape-mask-upload-common')?.click()
                            }
                            className="w-full h-16 border-dashed border-2 border-gray-300 dark:border-slate-600 hover:border-blue-400 hover:bg-blue-50/10 transition-all flex flex-col items-center justify-center gap-1 text-gray-500 hover:text-blue-500"
                          >
                            <Upload className="w-5 h-5" />
                            <span className="text-xs font-medium">Upload silhouette PNG</span>
                          </Button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-3">
                          <div className="w-14 h-14 rounded border border-gray-200 dark:border-slate-600 bg-[length:8px_8px] bg-[linear-gradient(45deg,#e5e7eb_25%,transparent_25%,transparent_75%,#e5e7eb_75%,#e5e7eb)] bg-[position:0_0,4px_4px] overflow-hidden flex items-center justify-center">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={core.shapeMaskImage}
                              alt="Shape mask"
                              className="max-w-full max-h-full object-contain"
                            />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs text-muted-foreground">
                              Same shape is used for every puzzle.
                            </p>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() =>
                                document.getElementById('maze-shape-mask-upload-common')?.click()
                              }
                              className="mt-1 h-7 text-xs"
                            >
                              Change image
                            </Button>
                            <input
                              type="file"
                              id="maze-shape-mask-upload-common"
                              accept="image/png,image/jpeg,image/jpg,.png,.jpg,.jpeg,.webp"
                              className="hidden"
                              onChange={async (e) => {
                                const file = e.target.files?.[0];
                                e.target.value = '';
                                if (!file) return;
                                try {
                                  const dataUrl = await readImageFileAsDataUrl(file);
                                  patchCore({ shapeMaskImage: dataUrl });
                                } catch (error) {
                                  toast.error('Could not read image');
                                }
                              }}
                            />
                          </div>
                        </div>
                      )}
                    </>
                  ) : (
                    <>
                      <div className="flex items-center justify-between gap-2">
                        <Label className="text-xs font-semibold text-gray-700 dark:text-gray-200">
                          Per-puzzle shapes ({(core.shapeMaskImages ?? []).filter(Boolean).length}/
                          {core.numberOfPuzzles})
                        </Label>
                        {(core.shapeMaskImages ?? []).some(Boolean) && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => patchCore({ shapeMaskImages: [] })}
                            className="h-8 px-2 text-[var(--gp-grey-800)] hover:text-[var(--gp-black)] hover:bg-[var(--gp-grey-100)] transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5 mr-1" />
                            Clear all
                          </Button>
                        )}
                      </div>
                      <input
                        type="file"
                        id="maze-shape-mask-upload-batch"
                        accept="image/png,image/jpeg,image/jpg,.png,.jpg,.jpeg,.webp"
                        multiple
                        className="hidden"
                        onChange={async (e) => {
                          const files = e.target.files;
                          e.target.value = '';
                          if (!files || files.length === 0) return;
                          try {
                            const urls = await readImageFilesAsDataUrls(files);
                            if (urls.length === 0) {
                              toast.error('No readable image files selected');
                              return;
                            }
                            const next = Array.from(
                              { length: core.numberOfPuzzles },
                              (_, i) => urls[i] || core.shapeMaskImages?.[i] || ''
                            );
                            for (let i = 0; i < Math.min(urls.length, core.numberOfPuzzles); i++) {
                              next[i] = urls[i];
                            }
                            patchCore({
                              shapeMaskImages: next,
                              shapeMaskMode: 'per-puzzle',
                              shapeMazeEnabled: true,
                            });
                            toast.success(
                              `Loaded ${Math.min(urls.length, core.numberOfPuzzles)} shape image${
                                Math.min(urls.length, core.numberOfPuzzles) === 1 ? '' : 's'
                              }`
                            );
                          } catch (error) {
                            toast.error(
                              error instanceof Error
                                ? error.message
                                : 'Could not read the shape images'
                            );
                          }
                        }}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() =>
                          document.getElementById('maze-shape-mask-upload-batch')?.click()
                        }
                        className="w-full h-14 border-dashed border-2 border-gray-300 dark:border-slate-600 hover:border-blue-400 hover:bg-blue-50/10 transition-all flex flex-col items-center justify-center gap-1 text-gray-500 hover:text-blue-500"
                      >
                        <Upload className="w-5 h-5" />
                        <span className="text-xs font-medium">
                          Upload batch images ({core.numberOfPuzzles} puzzles)
                        </span>
                      </Button>
                      <p className="text-[11px] text-muted-foreground">
                        Select multiple PNGs at once. They fill puzzle slots in order (1…{core.numberOfPuzzles}).
                      </p>
                      <div className="grid grid-cols-3 gap-2">
                        {Array.from({ length: core.numberOfPuzzles }, (_, index) => {
                          const image = core.shapeMaskImages?.[index];
                          const inputId = `maze-shape-mask-slot-${index}`;
                          return (
                            <div
                              key={inputId}
                              className="rounded border border-gray-200 dark:border-slate-600 p-1.5 space-y-1 bg-gray-50 dark:bg-slate-800/60"
                            >
                              <div className="flex items-center justify-between gap-1">
                                <span className="text-[10px] font-medium text-muted-foreground">
                                  #{core.puzzlesStartingNumber + index}
                                </span>
                                {image ? (
                                  <button
                                    type="button"
                                    className="text-[10px] text-muted-foreground hover:text-foreground"
                                    onClick={() => {
                                      const next = [...(core.shapeMaskImages ?? [])];
                                      next[index] = '';
                                      patchCore({ shapeMaskImages: next });
                                    }}
                                  >
                                    Remove
                                  </button>
                                ) : null}
                              </div>
                              <input
                                type="file"
                                id={inputId}
                                accept="image/png,image/jpeg,image/jpg,.png,.jpg,.jpeg,.webp"
                                className="hidden"
                                onChange={async (e) => {
                                  const file = e.target.files?.[0];
                                  e.target.value = '';
                                  if (!file) return;
                                  try {
                                    const dataUrl = await readImageFileAsDataUrl(file);
                                    const next = [...(core.shapeMaskImages ?? [])];
                                    while (next.length <= index) next.push('');
                                    next[index] = dataUrl;
                                    patchCore({
                                      shapeMaskImages: next,
                                      shapeMaskMode: 'per-puzzle',
                                    });
                                  } catch (error) {
                                    toast.error(
                                      error instanceof Error
                                        ? error.message
                                        : 'Could not read the shape image'
                                    );
                                  }
                                }}
                              />
                              <button
                                type="button"
                                onClick={() => document.getElementById(inputId)?.click()}
                                className="w-full aspect-square rounded border border-dashed border-gray-300 dark:border-slate-600 overflow-hidden bg-[length:8px_8px] bg-[linear-gradient(45deg,#e5e7eb_25%,transparent_25%,transparent_75%,#e5e7eb_75%,#e5e7eb),linear-gradient(45deg,#e5e7eb_25%,#fff_25%,#fff_75%,#e5e7eb_75%,#e5e7eb)] bg-[position:0_0,4px_4px] hover:border-blue-400 transition-colors flex items-center justify-center"
                                title={`Upload shape for puzzle ${index + 1}`}
                              >
                                {image ? (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img
                                    src={image}
                                    alt={`Shape ${index + 1}`}
                                    className="w-full h-full object-contain"
                                  />
                                ) : (
                                  <Upload className="w-4 h-4 text-gray-400" />
                                )}
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    </>
                  )}
                  <div className="grid grid-cols-1 gap-2 pt-2 border-t border-gray-100 dark:border-slate-600">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold text-gray-700 dark:text-gray-200">Fit to grid</Label>
                      <Select
                        value={core.shapeMaskFit ?? 'contain'}
                        onValueChange={(v) =>
                          patchCore({
                            shapeMaskFit: v as 'contain' | 'cover' | 'stretch',
                          })
                        }
                      >
                        <SelectTrigger className="h-8">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="contain">Contain (keep proportions)</SelectItem>
                          <SelectItem value="cover">Cover (fill grid)</SelectItem>
                          <SelectItem value="stretch">Stretch</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <SliderField
                      label="Shape threshold"
                      value={core.shapeMaskAlphaThreshold ?? 40}
                      onValueChange={(v) => patchCore({ shapeMaskAlphaThreshold: v })}
                      min={0}
                      max={200}
                      step={5}
                      control="input"
                    />
                    {((core.shapeMaskMode ?? 'common') === 'common'
                      ? Boolean(core.shapeMaskImage)
                      : (core.shapeMaskImages ?? []).some(Boolean)) && (
                      <div className="space-y-2 pt-1 border-t border-gray-100 dark:border-slate-600">
                        <div className="flex items-center space-x-2">
                          <Checkbox
                            id="maze-shape-mask-show-image"
                            checked={Boolean(core.shapeMaskShowImage)}
                            onCheckedChange={(v) => patchCore({ shapeMaskShowImage: Boolean(v) })}
                          />
                          <Label
                            htmlFor="maze-shape-mask-show-image"
                            className="text-xs font-medium cursor-pointer"
                          >
                            Show shape image
                          </Label>
                        </div>
                        {core.shapeMaskShowImage && (
                          <SliderField
                            label="Image opacity"
                            value={core.shapeMaskImageOpacity ?? 35}
                            onValueChange={(v) => patchCore({ shapeMaskImageOpacity: v })}
                            min={0}
                            max={100}
                            step={5}
                            format="percent"
                            control="popover"
                          />
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
            <SliderField
              label="Wall Thickness"
              value={core.mazeWallThickness}
              onValueChange={(v) => patchCore({ mazeWallThickness: v })}
              min={0}
              max={100}
              format="percent"
            />
            <div className="space-y-1">
              <Label className="text-sm font-medium">Fix start point on</Label>
              <Select
                value={core.mazeStartSide}
                onValueChange={(value) =>
                  patchCore({ mazeStartSide: value as MazeStartSide })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="left">Left (top edge)</SelectItem>
                  <SelectItem value="middle">Middle (top edge)</SelectItem>
                  <SelectItem value="right">Right (top edge)</SelectItem>
                  <SelectItem value="mixed">Mixed (random per puzzle)</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-[11px] text-gray-500">
                {core.mazeStartSide === 'mixed'
                  ? 'Each maze picks left, middle, or right on the top edge at random.'
                  : 'Exact start cell still varies within that third of the top edge.'}
              </p>
            </div>
            <div className="space-y-1">
              <Label className="text-sm font-medium">End point position</Label>
              <Select
                value={core.mazeEndSide}
                onValueChange={(value) => patchCore({ mazeEndSide: value as MazeEndSide })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="bottom">Bottom</SelectItem>
                  <SelectItem value="middle">Middle (bottom center)</SelectItem>
                  <SelectItem value="left">Left side</SelectItem>
                  <SelectItem value="right">Right side</SelectItem>
                  <SelectItem value="mixed">Mixed (random per puzzle)</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-[11px] text-gray-500">
                {core.mazeEndSide === 'mixed'
                  ? 'Each maze picks bottom, middle, left, or right at random.'
                  : 'End region is fixed; the exact exit cell changes every puzzle.'}
              </p>
            </div>
            <div className="space-y-1">
              <Label className="text-sm font-medium">Start and end point as</Label>
              <Select
                value={core.mazeMarkerStyle}
                onValueChange={(value) =>
                  patchCore({ mazeMarkerStyle: value as MazeMarkerStyle })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="point">Point</SelectItem>
                  <SelectItem value="arrow">Arrow (start) + point (end)</SelectItem>
                  <SelectItem value="image">Image</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-[11px] text-gray-500">
                For point or arrow, the end marker is always a point.
              </p>
            </div>
            {core.mazeMarkerStyle === 'image' ? (
              <MazeMarkerImageUploads
                startImage={core.mazeStartImage}
                endImage={core.mazeEndImage}
                onStartImage={(url) => patchCore({ mazeStartImage: url })}
                onEndImage={(url) => patchCore({ mazeEndImage: url })}
              />
            ) : null}
            <div className="space-y-1">
              <Label className="text-sm font-medium">Solution Path Line</Label>
              <Select
                value={core.mazeSolutionPathStyle}
                onValueChange={(value) =>
                  patchCore({ mazeSolutionPathStyle: value as MazeSolutionPathStyle })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="solid">Solid</SelectItem>
                  <SelectItem value="dashed">Dashed</SelectItem>
                  <SelectItem value="dotted">Dotted</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <SliderField
              label="Solution Path Thickness"
              value={core.mazeSolutionPathThickness}
              onValueChange={(v) => patchCore({ mazeSolutionPathThickness: v })}
              min={0}
              max={100}
              format="percent"
            />
            <MiniColorInput
              label="Solution Path Color"
              value={colors.solutionPathColor}
              onChange={(v) => patchColors({ solutionPathColor: v })}
            />
            <p className="text-[11px] text-gray-500">
              Solution path is always drawn on solution pages.
            </p>
          </>
        ) : null}

        {moduleType === 'cryptogram' ? (
          <>
            <div className="space-y-1">
              <Label className="text-sm font-medium">Puzzle Type</Label>
              <Select
                value={core.cipherType}
                onValueChange={(value) =>
                  patchCore({ cipherType: value as CryptogramCipherType })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="letters">Letters</SelectItem>
                  <SelectItem value="numbers">Numbers</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-sm font-medium">Letter Case</Label>
              <Select
                value={core.letterCase}
                onValueChange={(value) =>
                  patchCore({ letterCase: value as GenericLetterCase })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="upper">UPPER CASE</SelectItem>
                  <SelectItem value="lower">lower case</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-sm font-medium">Puzzle Format</Label>
              <Select
                value={core.cryptogramFormat}
                onValueChange={(value) =>
                  patchCore({ cryptogramFormat: value as CryptogramFormat })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="lines">Lines</SelectItem>
                  <SelectItem value="boxes">Boxes</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-sm font-medium">Phrases for Puzzles</Label>
              <p className="text-[11px] text-gray-500">
                One phrase per line. Leave blank to use built-in famous quotes.
              </p>
              <Textarea
                value={core.cryptogramPhrases}
                onChange={(e) => patchCore({ cryptogramPhrases: e.target.value })}
                rows={6}
                placeholder={'THE ONLY THING WE HAVE TO FEAR IS FEAR ITSELF\nKNOWLEDGE IS POWER'}
              />
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="gp-show-letter-hints"
                checked={core.showLetterHints}
                onCheckedChange={(checked) =>
                  patchCore({ showLetterHints: checked === true })
                }
              />
              <Label htmlFor="gp-show-letter-hints" className="text-sm">
                Include answer key on puzzle page
              </Label>
            </div>
            {core.showLetterHints ? (
              <>
                <div className="space-y-1">
                  <Label className="text-xs text-gray-500">Hint Letters to Show</Label>
                  <IntegerInput
                    value={core.hintLettersCount}
                    onChange={(v) => patchCore({ hintLettersCount: v })}
                    min={0}
                    max={25}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-sm font-medium">Answer Key Table Lines</Label>
                  <Select
                    value={String(core.cryptogramAnswerKeyLines ?? 2)}
                    onValueChange={(value) =>
                      patchCore({
                        cryptogramAnswerKeyLines: parseInt(value, 10) as 1 | 2 | 3,
                      })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">1 line (A–Z full width)</SelectItem>
                      <SelectItem value="2">2 lines (13 + 13)</SelectItem>
                      <SelectItem value="3">3 lines (9 + 9 + 8)</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-[11px] text-gray-500">
                    Full-width A–Z grid under the title at 18pt; only hint letters are filled
                    in.
                  </p>
                </div>
              </>
            ) : null}
            <div className="flex items-center gap-2">
              <Checkbox
                id="gp-crypto-solution-only"
                checked={core.cryptogramSolutionOnlyAnswers}
                onCheckedChange={(checked) =>
                  patchCore({ cryptogramSolutionOnlyAnswers: checked === true })
                }
              />
              <Label htmlFor="gp-crypto-solution-only" className="text-sm">
                Solutions: show answer sentences only
              </Label>
            </div>
          </>
        ) : null}

        {moduleType === 'word-scramble' ? (
          <>
            <div className="space-y-1">
              <Label className="text-xs text-gray-500">Words Per Puzzle</Label>
              <IntegerInput
                value={core.wordsPerPuzzle}
                onChange={(v) => patchCore({ wordsPerPuzzle: v })}
                min={0}
                max={50}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-sm font-medium">Letter Case</Label>
              <Select
                value={core.letterCase}
                onValueChange={(value) =>
                  patchCore({ letterCase: value as GenericLetterCase })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="upper">UPPER CASE</SelectItem>
                  <SelectItem value="lower">lower case</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-sm font-medium">After Scrambled Words</Label>
              <Select
                value={core.afterScrambled}
                onValueChange={(value) =>
                  patchCore({ afterScrambled: value as ScrambleSeparator })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="equal">Equal sign</SelectItem>
                  <SelectItem value="blank">blank space</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-sm font-medium">Blank Style</Label>
              <Select
                value={core.answerBlankStyle}
                onValueChange={(value) =>
                  patchCore({ answerBlankStyle: value as ScrambleAnswerStyle })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="dash">dash</SelectItem>
                  <SelectItem value="underline">underline</SelectItem>
                  <SelectItem value="blank">blank</SelectItem>
                  <SelectItem value="boxes">boxes</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-sm font-medium">Words for Puzzles</Label>
              <p className="text-[11px] text-gray-500">
                One word or phrase per line. Leave blank to use a built-in word list.
              </p>
              <Textarea
                value={core.scrambleWords}
                onChange={(e) => patchCore({ scrambleWords: e.target.value })}
                rows={6}
                placeholder={'PUZZLE\nSCRAMBLE\nMYSTERY'}
              />
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="gp-include-word-bank"
                checked={core.includeWordBank}
                onCheckedChange={(checked) =>
                  patchCore({ includeWordBank: checked === true })
                }
              />
              <Label htmlFor="gp-include-word-bank" className="text-sm">
                Include word bank below puzzle
              </Label>
            </div>
            {core.includeWordBank ? (
              <div className="space-y-1">
                <Label className="text-xs text-gray-500">Word Bank Title</Label>
                <Input
                  value={core.wordBankTitle}
                  onChange={(e) => patchCore({ wordBankTitle: e.target.value })}
                  placeholder="Word Bank"
                />
              </div>
            ) : null}
          </>
        ) : null}

        <div className="space-y-1">
          <Label className="text-sm font-medium">Solutions Per Page</Label>
          <Select
            value={(core.solutionsPerPage || 1).toString()}
            onValueChange={(value) => patchCore({ solutionsPerPage: parseInt(value, 10) })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[1, 2, 3, 4, 6, 9].map((n) => (
                <SelectItem key={n} value={n.toString()}>
                  {n}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {(moduleType === 'cryptogram' || moduleType === 'word-scramble' || moduleType === 'sudoku') ? (
          <>
            {moduleType === 'cryptogram' ? (
              <>
                <div className="space-y-1">
                  <Label className="text-sm font-medium">Puzzle Font</Label>
                  <Select
                    value={typography.puzzleFontFamily}
                    onValueChange={(value) => patchTypography({ puzzleFontFamily: value })}
                  >
                    <SelectTrigger>
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
                </div>
                <SliderField
                  label="Puzzle Font Size"
                  value={typography.puzzleFontSize}
                  onValueChange={(v) => patchTypography({ puzzleFontSize: v })}
                  min={0}
                  max={72}
                  format="pt"
                />
                <div className="space-y-1">
                  <Label className="text-sm font-medium">Answer Key Font</Label>
                  <Select
                    value={typography.answerKeyFontFamily}
                    onValueChange={(value) => patchTypography({ answerKeyFontFamily: value })}
                  >
                    <SelectTrigger>
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
                  <p className="text-[11px] text-gray-500">Answer key size is fixed at 18pt.</p>
                </div>
                <div className="space-y-1">
                  <Label className="text-sm font-medium">Solution Font</Label>
                  <Select
                    value={typography.answerFontFamily}
                    onValueChange={(value) => patchTypography({ answerFontFamily: value })}
                  >
                    <SelectTrigger>
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
                </div>
                <SliderField
                  label="Solution Font Size"
                  value={typography.answerFontSize}
                  onValueChange={(v) => patchTypography({ answerFontSize: v })}
                  min={0}
                  max={72}
                  format="pt"
                />
                <SliderField
                  label="Title to Puzzle Gap"
                  value={typography.spaceBetweenTitleAndPuzzle}
                  onValueChange={(v) => patchTypography({ spaceBetweenTitleAndPuzzle: v })}
                  min={0}
                  max={2}
                  step={0.05}
                  format="inches"
                />
                <SliderField
                  label="Answer Key to Puzzle Gap"
                  value={typography.spaceBetweenAnswerKeyAndPuzzle}
                  onValueChange={(v) =>
                    patchTypography({ spaceBetweenAnswerKeyAndPuzzle: v })
                  }
                  min={0}
                  max={2}
                  step={0.05}
                  format="inches"
                />
                <SliderField
                  label="Space Between Puzzle Lines"
                  value={typography.spaceBetweenPuzzleLines}
                  onValueChange={(v) => patchTypography({ spaceBetweenPuzzleLines: v })}
                  min={0}
                  max={48}
                  format="pt"
                />
              </>
            ) : (
              <>
                <SliderField
                  label={moduleType === 'sudoku' ? 'Puzzle Numbers Font Size' : 'Puzzle Font Size'}
                  value={typography.puzzleFontSize}
                  onValueChange={(v) => patchTypography({ puzzleFontSize: v })}
                  min={0}
                  max={72}
                  format="pt"
                />
                <SliderField
                  label={
                    moduleType === 'sudoku' ? 'Solution Numbers Font Size' : 'Answer Font Size'
                  }
                  value={typography.answerFontSize}
                  onValueChange={(v) => patchTypography({ answerFontSize: v })}
                  min={0}
                  max={72}
                  format="pt"
                />
                {moduleType === 'word-scramble' ? (
                  <>
                    <SliderField
                      label="Space Between Words"
                      value={typography.scrambleSpaceBetweenWords}
                      onValueChange={(v) =>
                        patchTypography({ scrambleSpaceBetweenWords: v })
                      }
                      min={0}
                      max={36}
                      format="pt"
                    />
                    <SliderField
                      label="Space Between Letters"
                      value={Math.round(typography.scrambleSpaceBetweenLetters * 100)}
                      onValueChange={(v) =>
                        patchTypography({ scrambleSpaceBetweenLetters: v / 100 })
                      }
                      min={0}
                      max={40}
                      format="percent"
                    />
                    <SliderField
                      label="Space Between Puzzles"
                      value={typography.scrambleSpaceBetweenPuzzles}
                      onValueChange={(v) =>
                        patchTypography({ scrambleSpaceBetweenPuzzles: v })
                      }
                      min={0}
                      max={48}
                      format="pt"
                    />
                  </>
                ) : null}
              </>
            )}
          </>
        ) : null}
        {(moduleType === 'sudoku' || moduleType === 'maze') ? (
          <>
            <SliderField
              label="Puzzle Grid Scale"
              value={core.puzzleGridScale}
              onValueChange={(v) => patchCore({ puzzleGridScale: v })}
              min={0}
              max={250}
              format="percent"
            />
            <SliderField
              label="Solution Grid Scale"
              value={core.solutionGridScale}
              onValueChange={(v) => patchCore({ solutionGridScale: v })}
              min={0}
              max={250}
              format="percent"
            />
          </>
        ) : null}

        <MiniColorInput
          label={
            moduleType === 'cryptogram' || moduleType === 'word-scramble'
              ? 'Puzzle Color'
              : 'Grid Color'
          }
          value={colors.gridColor}
          onChange={(v) => patchColors({ gridColor: v })}
        />
      </div>
    </div>
  );
}

export function GenericPuzzleTitlesPanel({
  moduleType,
  onSave,
}: {
  moduleType: GenericPuzzleModuleType;
  onSave?: () => void;
}) {
  const { core, typography, colors, patchTypography, patchColors } =
    useGenericPuzzleDoc(moduleType);
  const defaultTitle = getGenericModuleDefaultTitle(moduleType);

  return (
    <div className="space-y-4">
      <PanelHeader title="Titles" onSave={onSave} />



      <div className="space-y-3">
        <div className="space-y-1">
          <Label className="text-sm font-medium">Title Option</Label>
          <Select
            value={typography.selectTitleOption}
            onValueChange={(value) =>
              patchTypography({ selectTitleOption: value as GenericPuzzleTitleOption })
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="custom">Same title for all puzzles</SelectItem>
              <SelectItem value="custom_per_puzzle">Different title per puzzle</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {typography.selectTitleOption === 'custom' ? (
          <div className="space-y-1">
            <Label className="text-xs text-gray-500">Title Text</Label>
            <Input
              value={typography.titleText}
              onChange={(e) => patchTypography({ titleText: e.target.value })}
              placeholder={defaultTitle}
            />
          </div>
        ) : (
          <div className="space-y-1">
            <Label className="text-xs text-gray-500">Titles (one per line)</Label>
            <Textarea
              value={typography.differentTitles}
              onChange={(e) => patchTypography({ differentTitles: e.target.value })}
              rows={5}
            />
          </div>
        )}

        <div className="space-y-1">
          <Label className="text-sm font-medium">Puzzle Numbering</Label>
          <Select
            value={typography.puzzleNumberingStyle}
            onValueChange={(value) =>
              patchTypography({
                puzzleNumberingStyle: value as GenericPuzzleNumberingStyle,
              })
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="prefix">Number before title (1. {defaultTitle})</SelectItem>
              <SelectItem value="suffix">Number after title ({defaultTitle} 1)</SelectItem>
              <SelectItem value="none">No number</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <Label className="text-sm font-medium">Title Position</Label>
          <Select
            value={typography.puzzleTitleAlign === 'left' ? 'left' : 'center'}
            onValueChange={(value) =>
              patchTypography({ puzzleTitleAlign: value as GenericTitleAlign })
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="left">Left</SelectItem>
              <SelectItem value="center">Middle</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <Label className="text-sm font-medium">Title Font</Label>
          <Select
            value={typography.puzzleTitleFontFamily}
            onValueChange={(value) => patchTypography({ puzzleTitleFontFamily: value })}
          >
            <SelectTrigger>
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
        </div>

        <SliderField
          label="Title Font Size"
          value={typography.puzzleTitleFontSize}
          onValueChange={(v) => patchTypography({ puzzleTitleFontSize: v })}
          min={0}
          max={72}
          format="pt"
        />
        <SliderField
          label="Solution Title Font Size"
          value={typography.answerTitleFontSize}
          onValueChange={(v) => patchTypography({ answerTitleFontSize: v })}
          min={8}
          max={72}
          format="pt"
        />

        <MiniColorInput
          label="Title Color"
          value={colors.titleColor}
          onChange={(v) => patchColors({ titleColor: v })}
        />

        <div className="space-y-1">
          <Label className="text-sm font-medium">Solution Title</Label>
          <Select
            value={typography.solutionTitleStyle}
            onValueChange={(value) =>
              patchTypography({ solutionTitleStyle: value as GenericSolutionTitleStyle })
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="same_as_puzzle">Same as puzzle title</SelectItem>
              <SelectItem value="custom">Custom text</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {typography.solutionTitleStyle === 'custom' ? (
          <>
            <div className="space-y-1">
              <Label className="text-xs text-gray-500">Custom Solution Title</Label>
              <SettingsTextInput
                value={typography.customSolutionTitle}
                onChange={(v) => patchTypography({ customSolutionTitle: v })}
                placeholder="Solution"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-sm font-medium">Solution Numbering</Label>
              <Select
                value={typography.solutionNumberingStyle}
                onValueChange={(value) =>
                  patchTypography({
                    solutionNumberingStyle: value as GenericPuzzleNumberingStyle,
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="prefix">Number before title</SelectItem>
                  <SelectItem value="suffix">Number after title</SelectItem>
                  <SelectItem value="none">No number</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </>
        ) : null}

        <SliderField
          label="Title Start Position"
          value={typography.titleStartAt}
          onValueChange={(v) => patchTypography({ titleStartAt: v })}
          min={0}
          max={3}
          step={0.05}
          format="inches"
        />
        <SliderField
          label="Title to Puzzle Gap"
          value={typography.spaceBetweenTitleAndPuzzle}
          onValueChange={(v) => patchTypography({ spaceBetweenTitleAndPuzzle: v })}
          min={0}
          max={2}
          step={0.05}
          format="inches"
        />
      </div>
    </div>
  );
}
