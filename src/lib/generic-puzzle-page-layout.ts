/**
 * Shared page layout for crossword / sudoku / maze / scramble / trivia / cryptogram.
 * Canvas, PDF, and PPT must all consume these numbers so export cannot drift.
 *
 * Units: PDF points (72/in). CSS px at 96dpi = pt * 96/72.
 */

import type { UnifiedHeaderAssemblyBlock } from './word-search-page-layout';
import {
  buildGenericHeaderAssembly,
  isGlobalHeaderAssemblyEnabled,
  resolveGenericPageContentInsetPt,
} from './generic-page-chrome';
import {
  getGenericModuleDefaultTitle,
  resolveGenericPuzzleTitle,
  resolveGenericPuzzleTitleParts,
  resolveGenericSolutionTitle,
  type GenericPuzzleModuleType,
  type GenericPuzzleSettings,
} from './generic-puzzle-settings';
import {
  resolveCrosswordPuzzleTitle,
  resolveCrosswordSolutionTitle,
  resolveCrosswordSubtitle,
  type CrosswordSettings,
} from './crossword-settings';
import { cssPxToPoints, getPageDimensionsInches } from './puzzle-layout';
import { getSolutionGridLayout } from './solution-page-layout';
import { computeTriviaSolutionsPerPage } from './puzzles/trivia';
import type { TitleWordsSettings, WordSearchSettings } from './puzzles/types';
import {
  crosswordFixedCellPt,
  resolveCrosswordPageNumberZoneTopPt,
} from './crossword-puzzle-page-layout';

export const GENERIC_FIT_MIN_SCALE = 0.35;

function resolveGapInPt(val: number | undefined, defaultPt: number): number {
  if (val == null || !Number.isFinite(val)) return defaultPt;
  return val <= 2 ? val * 72 : val;
}

export type GenericExportPuzzleType =
  | 'crossword'
  | 'sudoku'
  | 'maze'
  | 'word-scramble'
  | 'trivia'
  | 'cryptogram'
  | string;

export interface RectPt {
  leftPt: number;
  topPt: number;
  widthPt: number;
  heightPt: number;
}

export interface GenericTitleStyle {
  text: string;
  fontSizePt: number;
  fontFamily: string;
  color: string;
  align: 'left' | 'center' | 'right';
  bold: boolean;
}

export interface GenericBodySlot {
  index: number;
  puzzleIndex: number;
  frame: RectPt;
  title: GenericTitleStyle | null;
  titleBox: RectPt | null;
  content: RectPt;
}

export interface ScrambleFitPt {
  fontSizePt: number;
  wordGapPt: number;
  letterEm: number;
  keepRowsOnOneLine: boolean;
  titleFontSizePt: number;
}

export interface GenericPageLayout {
  pageWidthPt: number;
  pageHeightPt: number;
  marginPt: number;
  puzzleType: string;
  showSolution: boolean;
  multi: boolean;
  isTriviaSolution: boolean;
  scaleFactor: number;
  multiShrink: number;
  header: UnifiedHeaderAssemblyBlock | null;
  pageTitle: GenericTitleStyle | null;
  pageTitleBox: RectPt | null;
  subtitle: GenericTitleStyle | null;
  subtitleBox: RectPt | null;
  body: RectPt;
  slots: GenericBodySlot[];
  scrambleFit: ScrambleFitPt | null;
  crosswordCellPt: number;
  genericCellPt: number;
  mazeFramePt: number | null;
  puzzleToCluesGapPt: number;
  titleColor: string;
  titleFontFamily: string;
  contentWidthPt: number;
  pageNumberZoneTopPt: number;
}

export interface GenericPageLayoutInput {
  puzzleType: string;
  showSolution: boolean;
  layoutSettings: WordSearchSettings;
  titleWords: TitleWordsSettings;
  puzzleIndex: number;
  puzzles: Array<{
    puzzleIndexInDocument?: number;
    difficulty?: string;
    grid?: unknown[][];
    size?: number;
    words?: unknown[];
  }>;
  cw: CrosswordSettings | null;
  gp: GenericPuzzleSettings | null;
}

function finite(n: number, fallback: number): number {
  return Number.isFinite(n) ? n : fallback;
}

export function fitScale(
  needW: number,
  needH: number,
  availW: number,
  availH: number,
  minScale = GENERIC_FIT_MIN_SCALE
): number {
  if (needW <= 0 || needH <= 0 || availW <= 0 || availH <= 0) return 1;
  return Math.max(minScale, Math.min(1, availW / needW, availH / needH));
}

export function centerRectInSlot(innerW: number, innerH: number, slot: RectPt, alignTop = true): RectPt {
  const w = Math.min(innerW, slot.widthPt);
  const h = Math.min(innerH, slot.heightPt);
  return {
    leftPt: slot.leftPt + (slot.widthPt - w) / 2,
    topPt: alignTop ? slot.topPt : slot.topPt + (slot.heightPt - h) / 2,
    widthPt: w,
    heightPt: h,
  };
}

export function resolveGenericExportTitle(args: {
  puzzleType: string;
  puzzleIndex: number;
  showSolution: boolean;
  titleWords: TitleWordsSettings;
  cw: CrosswordSettings | null;
  gp: GenericPuzzleSettings | null;
  puzzle?: { difficulty?: string } | null;
}): string {
  const { puzzleType, puzzleIndex, showSolution, titleWords, cw, gp, puzzle } = args;
  if (gp) {
    const puzzleTitle = resolveGenericPuzzleTitle({
      typography: gp.typography,
      puzzleIndex,
      puzzlesStartingNumber: gp.core.puzzlesStartingNumber,
      fallback: titleWords.title || getGenericModuleDefaultTitle(puzzleType as GenericPuzzleModuleType),
      difficulty: puzzleType === 'sudoku' ? puzzle?.difficulty : undefined,
      difficultyPlacement:
        puzzleType === 'sudoku' ? gp.core.sudokuDifficultyPlacement : undefined,
    });
    if (showSolution) {
      return resolveGenericSolutionTitle({
        typography: gp.typography,
        puzzleTitle,
        puzzleIndex,
        puzzlesStartingNumber: gp.core.puzzlesStartingNumber,
      });
    }
    return puzzleTitle;
  }
  if (cw) {
    const puzzleTitle = resolveCrosswordPuzzleTitle({
      typography: cw.typography,
      puzzleIndex,
      puzzlesStartingNumber: cw.core.puzzlesStartingNumber,
      fallback: titleWords.title || 'Crossword',
    });
    if (showSolution) {
      return resolveCrosswordSolutionTitle({
        typography: cw.typography,
        puzzleTitle,
        puzzleIndex,
        puzzlesStartingNumber: cw.core.puzzlesStartingNumber,
        fallbackTitle: titleWords.title || 'Crossword',
      });
    }
    return puzzleTitle;
  }
  return titleWords.title || puzzleType;
}

function solutionTitleColor(raw: string): string {
  const trimmed = (raw || '').trim();
  if (/^#(?:fff(?:fff)?|f5f5f5|fafafa|ffffff)$/i.test(trimmed)) return '#1f2937';
  return trimmed || '#1f2937';
}

function scrambleFitPt(args: {
  gp: GenericPuzzleSettings;
  showSolution: boolean;
  multi: boolean;
  answersPerPage: number;
  scaleFactor: number;
  slotWPt: number;
  slotHPt: number;
  sampleWords: unknown[];
}): ScrambleFitPt {
  const { gp, showSolution, multi, answersPerPage, scaleFactor, slotWPt, slotHPt, sampleWords } = args;
  const rawWords = Array.isArray(sampleWords) ? sampleWords : [];
  const wordCount = Math.max(
    1,
    rawWords.length > 0 ? rawWords.length : gp.core.wordsPerPuzzle || 10
  );
  const longestChars = Math.max(
    6,
    ...rawWords.map((w) => {
      if (typeof w === 'string') return w.replace(/[\s-]/g, '').length;
      const src = String(
        (w as { original?: string; scrambled?: string })?.original ||
          (w as { scrambled?: string })?.scrambled ||
          ''
      );
      return src.replace(/[\s-]/g, '').length;
    }),
    8
  );

  const includeBank = !showSolution && (gp.core.includeWordBank ?? false);
  const baseFontPt = showSolution ? gp.typography.answerFontSize : gp.typography.puzzleFontSize;
  let fontPt = finite(baseFontPt, 14) * (scaleFactor || 1);
  const letterEm = gp.typography.scrambleSpaceBetweenLetters ?? 0.12;
  const requestedWordGapPt = finite(gp.typography.scrambleSpaceBetweenWords, 8);
  const lineFactor = gp.core.answerBlankStyle === 'boxes' ? 1.5 : 1.32;
  const bankReserve = includeBank ? fontPt * 2.8 : 0;
  const keepOneLine = multi && answersPerPage >= 4;

  if (keepOneLine) {
    const charW = 0.62;
    const estimateWidth = (fs: number) => {
      const scrambleW = longestChars * fs * (charW + letterEm * 0.55);
      const blankW =
        gp.core.answerBlankStyle === 'boxes'
          ? longestChars * (fs * 1.1 + Math.max(1, letterEm * fs))
          : longestChars * fs * (charW + letterEm * 0.55);
      return fs * 1.6 + scrambleW + fs * 0.9 + blankW;
    };
    let guard = 0;
    while (estimateWidth(fontPt) > slotWPt && fontPt > 5.25 && guard < 40) {
      fontPt *= 0.92;
      guard += 1;
    }
  }

  const lineH = fontPt * lineFactor;
  const gaps = Math.max(0, wordCount - 1);
  const fixedH = wordCount * lineH + bankReserve;
  const maxGapPt = gaps > 0 ? Math.max(0, (slotHPt * 0.98 - fixedH) / gaps) : requestedWordGapPt;
  let wordGapPt = Math.min(requestedWordGapPt, maxGapPt);

  if (multi && answersPerPage === 2) {
    const used = fixedH + gaps * wordGapPt;
    const maxFill = showSolution ? 1.12 : 1.35;
    const fillScale = Math.min(maxFill, Math.max(1, (slotHPt * 0.96) / Math.max(1, used)));
    fontPt *= fillScale;
    const lineH2 = fontPt * lineFactor;
    const fixedH2 = wordCount * lineH2 + (includeBank ? fontPt * 2.8 : 0);
    const maxGap2 = gaps > 0 ? Math.max(0, (slotHPt * 0.98 - fixedH2) / gaps) : wordGapPt;
    wordGapPt = Math.min(Math.max(wordGapPt * fillScale, wordGapPt), maxGap2);
  }

  if (keepOneLine) {
    const used = wordCount * (fontPt * lineFactor) + gaps * wordGapPt + bankReserve;
    if (used > slotHPt * 0.98) {
      const s = (slotHPt * 0.98) / Math.max(1, used);
      fontPt *= s;
      wordGapPt *= s;
    }
  }

  return {
    fontSizePt: Math.max(5.25, fontPt),
    wordGapPt: Math.max(0, wordGapPt),
    letterEm,
    keepRowsOnOneLine: keepOneLine,
    titleFontSizePt: Math.max(
      11,
      (showSolution ? gp.typography.answerTitleFontSize : gp.typography.puzzleTitleFontSize) *
        (keepOneLine ? 0.7 : showSolution ? 0.9 : 0.75)
    ),
  };
}

export function computeGenericPageLayout(input: GenericPageLayoutInput): GenericPageLayout {
  const { puzzleType, showSolution, layoutSettings, titleWords, puzzleIndex, puzzles, cw, gp } =
    input;
  const dims = getPageDimensionsInches(layoutSettings);
  const pageWidthPt = dims.width * 72;
  const pageHeightPt = dims.height * 72;
  const marginPt = resolveGenericPageContentInsetPt(layoutSettings);
  const colors = layoutSettings.colors;
  const typography = layoutSettings.typography;

  const scaleFactor =
    (cw
      ? (showSolution ? cw.core.solutionGridScale : cw.core.puzzleGridScale) || 100
      : gp
        ? (showSolution ? gp.core.solutionGridScale : gp.core.puzzleGridScale) || 100
        : 70) / 100;
  const sizePercent = cw ? cw.core.puzzleSizePercent / 60 : 1;
  const answersPerPage = cw
    ? cw.bookCanvas.answersPerPage || 1
    : gp
      ? puzzleType === 'trivia'
        ? computeTriviaSolutionsPerPage({
            answersPerColumn: gp.core.solutionsPerPage || 20,
            solutionColumns: gp.core.triviaSolutionColumns || 3,
          })
        : showSolution
          ? gp.core.solutionsPerPage || 1
          : gp.core.puzzlesPerPage || 1
      : 1;

  const isTriviaSolution = puzzleType === 'trivia' && showSolution;
  const multi = !isTriviaSolution && puzzles.length > 1;
  const solutionLayout = getSolutionGridLayout(Math.max(answersPerPage, puzzles.length || 1));
  const multiShrink = multi ? (answersPerPage >= 4 ? 0.45 : 0.62) : 1;
  const isTextPuzzleType =
    puzzleType === 'word-scramble' || puzzleType === 'cryptogram' || puzzleType === 'trivia';
  const isSudokuOrMaze = puzzleType === 'sudoku' || puzzleType === 'maze';

  const contentWidthPt = Math.max(60, pageWidthPt - marginPt * 2);
  const contentHeightPt = Math.max(
    90,
    pageHeightPt - marginPt * 2 - (multi && isTextPuzzleType ? 28 : 120)
  );
  const solutionGapPt = cw
    ? cssPxToPoints(cw.typography.solutionToSolutionGapPx ?? 14)
    : puzzleType === 'word-scramble' && multi
      ? finite(gp?.typography.scrambleSpaceBetweenPuzzles, 18)
      : 12;

  const headerAssemblyEnabled = !showSolution && isGlobalHeaderAssemblyEnabled(layoutSettings);
  const isSolutionPage = showSolution && !!(cw || gp);

  const rawSolutionTitleColor =
    colors.answerPage.titleColor ||
    gp?.colors.titleColor ||
    cw?.colors.titleColor ||
    colors.puzzlePage.titleColor ||
    '#1f2937';
  const titleColor = isSolutionPage
    ? solutionTitleColor(rawSolutionTitleColor)
    : cw?.colors.titleColor ?? gp?.colors.titleColor ?? colors.puzzlePage.titleColor ?? '#333333';
  const titleFontFamily = isSolutionPage
    ? colors.answerPage.answerTitleFontFamily ||
      gp?.typography.puzzleTitleFontFamily ||
      cw?.typography.puzzleTitleFontFamily ||
      typography.puzzleTitleFontFamily ||
      'Arial'
    : cw?.typography.puzzleTitleFontFamily ??
      gp?.typography.puzzleTitleFontFamily ??
      typography.puzzleTitleFontFamily ??
      'Arial';
  const titleSizePt = cw && showSolution
    ? Math.max(10, colors.answerPage.answerTitleFontSize || cw.typography.answerTitleFontSize || 20)
    : gp && showSolution
      ? Math.max(10, gp.typography.answerTitleFontSize || 18)
      : cw?.typography.puzzleTitleFontSize ??
        gp?.typography.puzzleTitleFontSize ??
        typography.puzzleTitleFontSize ??
        24;
  const titleAlign: 'left' | 'center' | 'right' = isSolutionPage
    ? colors.answerPage.answerTitleAlignment || 'center'
    : gp?.typography.puzzleTitleAlign === 'left'
      ? 'left'
      : 'center';

  const first = puzzles[0];
  const pageTitleText =
    multi || isTriviaSolution
      ? ''
      : resolveGenericExportTitle({
          puzzleType,
          puzzleIndex,
          showSolution,
          titleWords,
          cw,
          gp,
          puzzle: first,
        });

  const usePageHeader = headerAssemblyEnabled && !multi && !isTriviaSolution && !showSolution;
  const headerTitleParts = usePageHeader
    ? gp
      ? resolveGenericPuzzleTitleParts({
          typography: gp.typography,
          puzzleIndex,
          puzzlesStartingNumber: gp.core.puzzlesStartingNumber,
          fallback:
            titleWords.title ||
            getGenericModuleDefaultTitle(puzzleType as GenericPuzzleModuleType),
        })
      : cw
        ? (() => {
            const number = cw.core.puzzlesStartingNumber + puzzleIndex;
            const style = cw.typography.puzzleNumberingStyle;
            const combined = resolveCrosswordPuzzleTitle({
              typography: cw.typography,
              puzzleIndex,
              puzzlesStartingNumber: cw.core.puzzlesStartingNumber,
              fallback: titleWords.title || 'Crossword',
            });
            const numberText =
              style === 'prefix' ? String(number) : style === 'suffix' ? `#${number}` : '';
            const titleOnly =
              style === 'prefix'
                ? combined.replace(new RegExp(`^${number}\\.\\s*`), '')
                : style === 'suffix'
                  ? combined.replace(new RegExp(`\\s*#${number}$`), '')
                  : combined;
            return {
              titleText: titleOnly || combined,
              numberText,
              showNumber: numberText.length > 0,
            };
          })()
        : null
    : null;

  const subtitleFontSizePt =
    layoutSettings.typography.subtitleFontSize ||
    cw?.typography.subtitleFontSize ||
    14;
  const subtitleFontFamily =
    layoutSettings.typography.subtitleFontFamily ||
    cw?.typography.subtitleFontFamily ||
    layoutSettings.typography.puzzleTitleFontFamily ||
    cw?.typography.puzzleTitleFontFamily ||
    'Arial';
  const subtitleColor =
    layoutSettings.colors.puzzlePage.subtitleColor ||
    cw?.colors.subtitleColor ||
    '#6b7280';

  const subtitleToTitleGapPt = resolveGapInPt(
    layoutSettings.typography.subtitleToTitleGap ?? cw?.typography.subtitleToTitleGap,
    10
  );
  const subtitleToPuzzleGapPt = resolveGapInPt(
    layoutSettings.typography.subtitleToPuzzleGap ?? cw?.typography.subtitleToPuzzleGap,
    10.8
  );
  const subtitleBoxMarginPt = resolveGapInPt(
    layoutSettings.typography.subtitleBoxMargin ?? cw?.typography.subtitleBoxMargin,
    0
  );
  const subtitleMaxWidthPercent =
    layoutSettings.typography.subtitleMaxWidthPercent ??
    cw?.typography.subtitleMaxWidthPercent ??
    100;

  const subtitleText: string = cw
    ? resolveCrosswordSubtitle(cw.typography, puzzleIndex) || ''
    : '';

  const header = usePageHeader
    ? buildGenericHeaderAssembly({
        settings: layoutSettings,
        pageWidthPt,
        titleText: headerTitleParts?.titleText || pageTitleText || '',
        numberText: headerTitleParts?.numberText || '',
        subtitleText: subtitleText || '',
        titleFontSizePt: titleSizePt,
        titleColor,
        subtitleFontSizePt,
        subtitleColor,
        subtitleFontFamily,
        subtitleToTitleGapPt,
        subtitleBoxMarginPt,
        subtitleMaxWidthPercent,
      })
    : null;

  const titleStartAtPt = cw
    ? cw.typography.titleStartAt * 72
    : gp
      ? gp.typography.titleStartAt * 72
      : marginPt;
  const titleGapPt = cw
    ? showSolution
      ? cssPxToPoints(cw.typography.titleToAnswerGapPx ?? 10) ||
        (cw.typography.spaceBetweenTitleAndAnswer ?? 0.3) * 72
      : (subtitleText
          ? subtitleToPuzzleGapPt
          : cw.typography.spaceBetweenTitleAndPuzzle * 72)
    : gp
      ? (gp.typography.spaceBetweenTitleAndPuzzle ?? 0) * 72
      : 0;

  const rawContentTopPt = header
    ? header.topPt + header.heightPt + (subtitleText ? subtitleToPuzzleGapPt : (titleGapPt || 12))
    : isSolutionPage
      ? marginPt + 6
      : multi && isTextPuzzleType
        ? marginPt + 6
        : Number.isFinite(titleStartAtPt)
          ? titleStartAtPt
          : marginPt;
  const midPagePt = pageHeightPt * 0.5;
  const contentTopPt = Math.max(
    marginPt,
    Number.isFinite(rawContentTopPt) && rawContentTopPt < midPagePt
      ? rawContentTopPt
      : Number.isFinite(titleStartAtPt)
        ? titleStartAtPt
        : marginPt
  );

  const pageTitle: GenericTitleStyle | null =
    !header && pageTitleText
      ? {
          text: pageTitleText,
          fontSizePt: titleSizePt,
          fontFamily: titleFontFamily,
          color: titleColor,
          align: titleAlign,
          bold: true,
        }
      : null;
  const pageTitleHeightPt = pageTitle ? titleSizePt * 1.25 : 0;
  const pageTitleBox: RectPt | null = pageTitle
    ? {
        leftPt: marginPt,
        topPt: contentTopPt,
        widthPt: contentWidthPt,
        heightPt: pageTitleHeightPt,
      }
    : null;

  const subtitle: GenericTitleStyle | null = !header && subtitleText
    ? {
        text: subtitleText,
        fontSizePt: subtitleFontSizePt,
        fontFamily: subtitleFontFamily,
        color: subtitleColor,
        align: 'center',
        bold: false,
      }
    : null;
  const subtitleHeightPt = subtitle ? subtitle.fontSizePt * 1.3 : 0;
  const subtitleMaxWidthPt = Math.max(
    50,
    (contentWidthPt * subtitleMaxWidthPercent) / 100 - 2 * subtitleBoxMarginPt
  );
  const subtitleLeftPt = marginPt + (contentWidthPt - subtitleMaxWidthPt) / 2;
  const subtitleBox: RectPt | null = subtitle
    ? {
        leftPt: subtitleLeftPt,
        topPt: contentTopPt + pageTitleHeightPt + (pageTitle ? subtitleToTitleGapPt : 0),
        widthPt: subtitleMaxWidthPt,
        heightPt: subtitleHeightPt,
      }
    : null;

  let bodyTop = contentTopPt;
  if (pageTitleBox) bodyTop = pageTitleBox.topPt + pageTitleBox.heightPt + titleGapPt;
  if (subtitleBox) bodyTop = subtitleBox.topPt + subtitleBox.heightPt + subtitleToPuzzleGapPt;
  if (header && !pageTitle) bodyTop = contentTopPt;

  const pageNumberZoneTopPt = resolveCrosswordPageNumberZoneTopPt(
    pageWidthPt,
    pageHeightPt,
    layoutSettings
  );
  const bodyBottomLimitPt =
    puzzleType === 'crossword' && !showSolution && !multi
      ? pageNumberZoneTopPt
      : pageHeightPt - marginPt;
  const body: RectPt = {
    leftPt: marginPt,
    topPt: bodyTop,
    widthPt: contentWidthPt,
    heightPt: Math.max(40, bodyBottomLimitPt - bodyTop),
  };

  const crosswordCellPt = cw
    ? crosswordFixedCellPt(cw, { showSolution, multiShrink })
    : cssPxToPoints(Math.max(10, Math.round(28 * sizePercent * scaleFactor * multiShrink)));

  const sampleGrid = first?.grid;
  const sudokuSize = Math.max(
    4,
    Number(first?.size ?? (Array.isArray(sampleGrid) ? sampleGrid.length : 9)) || 9
  );
  const mazeCells = Math.max(
    Array.isArray(sampleGrid) ? sampleGrid.length : 21,
    Array.isArray(sampleGrid) && Array.isArray(sampleGrid[0]) ? sampleGrid[0].length : 21
  );
  const gridCells = puzzleType === 'sudoku' ? sudokuSize : mazeCells;

  const solutionTitleReservePt = multi
    ? Math.max(
        10,
        (showSolution
          ? (cw?.typography.answerTitleFontSize ?? gp?.typography.answerTitleFontSize ?? 18)
          : (cw?.typography.puzzleTitleFontSize ?? gp?.typography.puzzleTitleFontSize ?? 24)) *
          (headerAssemblyEnabled ? 1.15 : 0.75)
      ) + (headerAssemblyEnabled ? 12 : 9)
    : 0;

  const cols = Math.max(1, solutionLayout.columns);
  const rows = Math.max(1, solutionLayout.rows);
  const slotW = multi
    ? (contentWidthPt - solutionGapPt * (cols - 1)) / cols
    : body.widthPt;
  const slotH = multi
    ? (contentHeightPt - solutionGapPt * (rows - 1)) / rows
    : body.heightPt;

  const mazeFramePt =
    multi && gp && !isTextPuzzleType
      ? Math.max(30, Math.min(slotW, slotH - solutionTitleReservePt) * 0.96 * scaleFactor)
      : null;

  const fitBasePt = mazeFramePt ?? Math.min(contentWidthPt, contentHeightPt);
  const genericCellPt = Math.max(
    2.25,
    (fitBasePt / Math.max(1, gridCells)) * 0.9 * (mazeFramePt ? 1 : scaleFactor * multiShrink)
  );

  const scrambleSlotW = Math.max(45, (multi ? slotW : contentWidthPt) - 6);
  const scrambleSlotH = multi ? slotH - solutionTitleReservePt : contentHeightPt;
  const scrambleFit =
    puzzleType === 'word-scramble' && gp
      ? scrambleFitPt({
          gp,
          showSolution,
          multi,
          answersPerPage,
          scaleFactor,
          slotWPt: scrambleSlotW,
          slotHPt: scrambleSlotH,
          sampleWords: first?.words ?? [],
        })
      : null;

  const blockTitleSizePt = isSolutionPage
    ? Math.max(11, scrambleFit?.titleFontSizePt ?? titleSizePt)
    : scrambleFit?.titleFontSizePt ?? Math.max(10, titleSizePt * 0.75);

  const slots: GenericBodySlot[] = [];
  if (multi) {
    puzzles.forEach((p, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      if (row >= rows) return;
      const leftPt = body.leftPt + col * (slotW + solutionGapPt);
      const topPt = body.topPt + row * (slotH + solutionGapPt);
      const idx = p.puzzleIndexInDocument ?? puzzleIndex + i;
      const titleText = resolveGenericExportTitle({
        puzzleType,
        puzzleIndex: idx,
        showSolution,
        titleWords,
        cw,
        gp,
        puzzle: p,
      });
      const titleH = blockTitleSizePt * 1.25;
      const title: GenericTitleStyle | null = titleText
        ? {
            text: titleText,
            fontSizePt: blockTitleSizePt,
            fontFamily: titleFontFamily,
            color: titleColor,
            align: titleAlign,
            bold: true,
          }
        : null;
      slots.push({
        index: i,
        puzzleIndex: idx,
        frame: { leftPt, topPt, widthPt: slotW, heightPt: slotH },
        title,
        titleBox: title
          ? { leftPt, topPt, widthPt: slotW, heightPt: titleH }
          : null,
        content: {
          leftPt,
          topPt: topPt + (title ? titleH : 0),
          widthPt: slotW,
          heightPt: Math.max(24, slotH - (title ? titleH : 0)),
        },
      });
    });
  } else {
    slots.push({
      index: 0,
      puzzleIndex,
      frame: body,
      title: null,
      titleBox: null,
      content: body,
    });
  }

  return {
    pageWidthPt,
    pageHeightPt,
    marginPt,
    puzzleType,
    showSolution,
    multi,
    isTriviaSolution,
    scaleFactor,
    multiShrink,
    header,
    pageTitle,
    pageTitleBox,
    subtitle,
    subtitleBox,
    body,
    slots,
    scrambleFit,
    crosswordCellPt,
    genericCellPt,
    mazeFramePt,
    puzzleToCluesGapPt: cw ? (cw.typography.spaceBetweenPuzzleAndClues || 0.25) * 72 : 0,
    titleColor,
    titleFontFamily,
    contentWidthPt,
    pageNumberZoneTopPt,
  };
}
