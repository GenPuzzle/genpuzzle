'use client';

import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { useApp } from '@/lib/app-context';
import { useOptionalAppBusy } from '@/lib/app-busy-context';
import { Eye, EyeOff, ChevronLeft, ChevronRight, AlertCircle, Layout, FileText, Files, BookOpen, X } from 'lucide-react';
import { Button } from './ui/button';
import { resolvePageFrameSettings } from '@/lib/page-frame-settings';
import type { PageFrameSettings } from '@/lib/puzzles/types';
import {
  buildGenericHeaderAssembly,
  getHeaderAssemblySettings,
  isGlobalHeaderAssemblyEnabled,
  resolveGenericPageContentInsetPt,
  resolveGenericPageSurfaceColors,
} from '@/lib/generic-page-chrome';
import {
  crosswordFixedCellCssPx,
  resolveCrosswordPageNumberZoneTopPt,
} from '@/lib/crossword-puzzle-page-layout';
import {
  computeSolutionPageContentArea,
  computeSolutionPageLayout,
  getSolutionGridLayout,
} from '@/lib/solution-page-layout';
import { WordSearchPuzzle, WordSearchSettings, TitleWordsSettings, CrosswordPuzzle } from '@/lib/puzzles/types';
import type { MurdokuPuzzle } from '@/lib/puzzles/murdoku';
import { MurdokuPageCanvas } from '@/components/puzzle/MurdokuPagePreview';
import {
  getDefaultMurdokuSettings,
  normalizeMurdokuSettings,
  type MurdokuSettings,
} from '@/lib/murdoku-settings';
import type { MurdokuPagePart } from '@/lib/murdoku-page-layout';
import { DocumentPage, TextModuleSettings, PuzzleModuleSettings, isTextModuleType, isPuzzleModuleType, isTextModuleSettings, getDefaultTextModuleSettings } from '@/lib/document-model';
import {
  resolveTextPageBackground,
  resolveTextPageFrameSettings,
  resolveTextPageTextColor,
  resolveTextPageTitleFontSize,
  isNearWhiteCssColor,
} from '@/lib/text-page-settings';
import {
  type TextPageEditTarget,
} from '@/components/TextPageContextualControls';
import { type CrosswordEditTarget } from '@/components/CrosswordContextualControls';
import type { GenericPuzzleEditTarget } from '@/components/GenericPuzzleContextualControls';
import {
  getDefaultCrosswordSettings,
  normalizeCrosswordSettings,
  resolveCrosswordPuzzleTitle,
  resolveCrosswordSolutionTitle,
  resolveCrosswordSubtitle,
  type CrosswordSettings,
} from '@/lib/crossword-settings';
import {
  getDefaultGenericPuzzleSettings,
  normalizeGenericPuzzleSettings,
  resolveGenericPuzzleTitle,
  resolveGenericPuzzleTitleParts,
  resolveGenericSolutionTitle,
  isGenericPuzzleModuleType,
  getGenericModuleDefaultTitle,
  type GenericPuzzleSettings,
  type GenericPuzzleModuleType,
} from '@/lib/generic-puzzle-settings';
import {
  computeTriviaSolutionsPerPage,
  packTriviaGamesForSolutionPages,
  formatTriviaSolutionHeading,
  resolveTriviaAnswerLabel,
} from '@/lib/puzzles/trivia';
import { TextPageBlockCanvas } from '@/components/TextPageBlockCanvas';
import {
  createDefaultTitlePageBlocks,
  resolveTextPageBlocks,
  removeTextPageBlock,
  syncLegacyFieldsFromBlocks,
} from '@/lib/text-page-blocks';
import { isSpecialBlankTitlePage } from '@/lib/insert-separator-page';
import {
  compileBook,
  groupPuzzlesByDocument,
  groupCrosswordPuzzlesByDocument,
  groupGenericPuzzlesByDocument,
  groupMurdokuPuzzlesByDocument,
  getTitleWordsForDocument,
  findBookPageIndexForDocument,
  findBookPageIndexForSolution,
  getCompiledSolutionPagesForDocument,
  shouldDrawBookPageNumber,
  visibleBookPageIndex,
  isCompiledSolutionKind,
  type CompiledPage,
  type CompiledSolutionPage,
  type CompiledTextPage,
  type CompiledBook,
} from '@/lib/book-compiler';
import { TocPageCanvas } from '@/components/TocPageCanvas';
import { resolvePageNumberSettingsForBook } from '@/lib/text-page-pdf-draw';
import { BookFlipbookViewer } from '@/components/BookFlipbookViewer';
import { AllPagesGridPreview } from '@/components/AllPagesGridPreview';
import { overlayBookLayoutOnAllDocuments } from '@/lib/visual-settings-sync';
import { getEffectiveSettingsForPage } from '@/lib/page-settings';
import { TRIM_SIZE_PRESETS, computeTrimScaleRatio, resolveTrimDimensions, type TrimSizePresetId } from '@/lib/trim-size-layout';
import {
  computeWordSearchPageLayout,
  distributeWordsIntoColumns,
  getWordListRowTopOffsetPt,
  layoutPtToCss,
  UnifiedPageLayout,
  PT_TO_CSS_PX,
} from '@/lib/word-search-page-layout';
import {
  computeBookHeaderTitleFontSizePt,
  isHeaderAssemblyEnabled,
  resolvePageHeaderTitleFontSizePt,
} from '@/lib/header-assembly/book-title-size';
import { getPuzzleContentLine } from '@/lib/puzzle-line-index';
import { PageNumberOverlay } from '@/components/page-number/PageNumberOverlay';
import { computePageNumberLayout } from '@/lib/page-number/layout';
import { normalizePageNumberSettings } from '@/lib/page-number/settings';
import { CanvasDocumentTabsBar } from '@/components/CanvasDocumentTabsBar';
import { AiProjectWizard } from '@/components/ai/AiProjectWizard';
import { RemoveDocumentConfirmDialog } from '@/components/RemoveDocumentConfirmDialog';
import { Checkbox } from '@/components/ui/checkbox';
import {
  computePuzzleBookPageIndex,
  computeSolutionBookPageIndex,
} from '@/lib/page-number/settings';
import {
  cssPxToPoints,
  getPageDimensionsInches,
  getPageMarginInches,
  getSolutionGridFontSize,
} from '@/lib/puzzle-layout';
import { SolutionGridSnapshot } from '@/components/SolutionGridSnapshot';
import { computeGridBorderOuterBounds } from '@/lib/grid-border-geometry';
import {
  resolvePuzzleGridBorder,
  resolveSolutionGridBorder,
} from '@/lib/grid-border-settings';
import { layoutSolutionBlockTitlePt } from '@/lib/header-assembly/fit-title';
import { HeaderAssemblyBar } from '@/components/header/HeaderAssemblyBar';
import {
  type CanvasEditTarget,
} from '@/components/CanvasContextualControls';
import { useCanvasEditPanel } from '@/lib/canvas-edit-panel-context';
import {
  anyCanvasEditTabHasUnsavedEdits,
  buildGlobalBookTextUpdatesForAllCommit,
  buildGlobalBookTextUpdatesForPageCommit,
  buildGlobalAnswersPerPageUpdate,
  buildPageOverrideForOpenTabs,
  CANVAS_EDIT_TARGETS_BY_PREVIEW_TAB,
  selectedRangePagesMatchDraftForRangeApply,
  CANVAS_EDIT_TARGET_CATEGORY,
  cloneTitleWords,
  cloneWordSearchSettings,
  createCanvasEditSession,
  createSnapshotFromSession,
  formatCanvasEditTabLabel,
  tabHasUnsavedEdits,
  getBatchIndexForCompiledPuzzlePage,
  getPuzzleGridScaleForPage,
  hasUnsavedCanvasEdits,
  canApplyCanvasEditsToAllPages,
  getOtherEditedPageIndices,
  makeCanvasEditTabId,
  patchWordSearchSettings,
  resolveApplyToAllPromotionSource,
  shouldRegeneratePuzzleOnPageCommit,
  shouldRegeneratePuzzlesOnAllCommit,
  scaleCanvasEditSessionForTrim,
  syncEditSessionBaseline,
  type CanvasEditSession,
  type CanvasEditTab,
} from '@/lib/canvas-edit-session';
import { getWordsForPuzzlePage, getEffectiveWordsPerPuzzle } from '@/lib/puzzle-word-list';
import {
  documentPagesToBatchIndices,
  parsePageRangeSelection,
} from '@/lib/page-range-selection';
import type { InsertableDocumentKind } from '@/lib/document-model';
import { CanvasEditUnsavedDialog } from '@/components/CanvasEditUnsavedDialog';
import { CanvasApplyToAllConfirmDialog } from '@/components/CanvasApplyToAllConfirmDialog';
import '@/components/canvas-contextual-controls.css';
import '@/components/preview-canvas-toolbar.css';
import { cn } from '@/lib/utils';
import { WordSearchGrid } from './puzzle/WordSearchGrid';
import { resolveShapeMaskImageSrc } from '@/lib/puzzles/word-search-shape-mask';
import { SudokuGrid } from './puzzle/SudokuGrid';
import { PageBackgroundImage } from './puzzle/PageBackgroundImage';
import { CrosswordGrid, CrosswordClueLists } from './puzzle/CrosswordGrid';
import { MazeDisplay } from './puzzle/MazeDisplay';
import { CryptogramDisplay } from './puzzle/CryptogramDisplay';
import { WordScrambleDisplay } from './puzzle/WordScrambleDisplay';
import { TriviaDisplay } from './puzzle/TriviaDisplay';
import { FitToSafeArea } from './puzzle/FitToSafeArea';
import { WordMatchDisplay } from './puzzle/WordMatchDisplay';
import { DotToDotDisplay } from './puzzle/DotToDotDisplay';

/** Global page container frame overlay (Color Settings) — separate from grid border. */
function PageFrameOverlay({
  frame,
  pageBackgroundColor,
  hasBackgroundImage,
}: {
  frame: PageFrameSettings;
  pageBackgroundColor: string;
  hasBackgroundImage: boolean;
}) {
  if (!frame.enabled) return null;

  const marginPx = frame.marginSizeIn * 96;
  const cornerRadiusPx = frame.cornerRadiusPx;
  const inset = {
    left: marginPx,
    top: marginPx,
    right: marginPx,
    bottom: marginPx,
  };

  return (
    <>
      {hasBackgroundImage && (
        <div
          className="absolute pointer-events-none z-[1]"
          style={{
            ...inset,
            borderRadius: cornerRadiusPx,
            backgroundColor: pageBackgroundColor || '#ffffff',
          }}
        />
      )}
      <div
        className="absolute pointer-events-none z-[40]"
        style={{
          ...inset,
          borderRadius: cornerRadiusPx,
          border: `${frame.strokeThicknessPx}px solid ${frame.borderColor}`,
          backgroundColor: 'transparent',
          boxSizing: 'border-box',
        }}
      />
    </>
  );
}

/** Helper to calculate pixel dimensions and KDP safety margins */
function useCanvasDimensions(settings: WordSearchSettings) {
  const units = (settings.bookCanvas.measurementUnits || 'INCHES').toUpperCase();
  const includeBleed = settings.bookCanvas.includeBleed;

  let widthInches = settings.bookCanvas.customWidth;
  let heightInches = settings.bookCanvas.customHeight;

  if (!settings.bookCanvas.useCustomTrim && settings.bookCanvas.trimSizePreset) {
    const preset = TRIM_SIZE_PRESETS[settings.bookCanvas.trimSizePreset as TrimSizePresetId];
    if (preset) {
      widthInches = preset.width;
      heightInches = preset.height;
    }
  }

  if (!widthInches) widthInches = 8.5;
  if (!heightInches) heightInches = 11;

  let widthPx = 0;
  let heightPx = 0;

  // Mathematically convert trim size to screen pixels using Layout Scale PPI = 96
  if (units === 'INCHES') {
    widthPx = widthInches * 96;
    heightPx = heightInches * 96;
  } else if (units === 'CENTIMETERS' || units === 'CM') {
    const widthCm = widthInches * 2.54;
    const heightCm = heightInches * 2.54;
    widthPx = (widthCm / 2.54) * 96;
    heightPx = (heightCm / 2.54) * 96;
  } else if (units === 'MM' || units === 'MILLIMETERS') {
    const widthMm = widthInches * 25.4;
    const heightMm = heightInches * 25.4;
    widthPx = (widthMm / 25.4) * 96;
    heightPx = (heightMm / 25.4) * 96;
  } else {
    widthPx = widthInches * 96;
    heightPx = heightInches * 96;
  }

  // Safe margin is:
  // - 0.25 inches (18 points = 24 pixels) for no bleed
  // - 0.375 inches (27 points = 36 pixels) for bleed
  const safetyMarginPt = includeBleed ? 0.375 * 72 : 0.25 * 72;
  const safetyMarginPx = (safetyMarginPt / 72) * 96;

  return {
    widthPx,
    heightPx,
    safetyMarginPx,
    includeBleed,
    widthInches,
    heightInches,
  };
}

/** Check if any element of the unified layout overlaps/crosses the KDP safe zone boundary */
function checkKDPSafety(layout: UnifiedPageLayout, safetyMarginPt: number): boolean {
  const { page, title, subtitle, headerAssembly, grid, wordList } = layout;
  const rightBound = page.widthPt - safetyMarginPt;
  const bottomBound = page.heightPt - safetyMarginPt;

  // Check top margins
  if (title && title.topPt < safetyMarginPt) return true;
  if (headerAssembly && headerAssembly.topPt < safetyMarginPt) return true;
  if (subtitle && subtitle.topPt < safetyMarginPt) return true;
  if (grid.topPt < safetyMarginPt) return true;
  if (wordList && wordList.topPt < safetyMarginPt) return true;

  // Check bottom margins
  if (grid.topPt + grid.heightPt > bottomBound) return true;
  if (wordList) {
    const wlHeight = wordList.wordsPerColumn * wordList.lineHeightPt + 24;
    if (wordList.topPt + wlHeight > bottomBound) return true;
  }

  // Check horizontal margins
  if (headerAssembly) {
    const headerRight = headerAssembly.leftPt + headerAssembly.widthPt;
    if (headerAssembly.leftPt < safetyMarginPt || headerRight > rightBound) return true;
  }
  if (grid.leftPt < safetyMarginPt || grid.leftPt + grid.widthPt > rightBound) return true;
  if (wordList) {
    const wlLeft = wordList.centeredLeftPt;
    if (wlLeft < safetyMarginPt || wlLeft + wordList.blockWidthPt > rightBound) return true;
  }

  return false;
}

/** Helper component to draw word list inside content area in preview */
function WordListPreview({ layout, ptToPx }: { layout: UnifiedPageLayout; ptToPx: (pt: number) => number }) {
  const wl = layout.wordList;
  if (!wl) return null;

  const columns = distributeWordsIntoColumns(wl.words, wl.columns);

  // Fallback safe values (in points) to avoid NaN when layout fields are missing
  const DEFAULT_FONT_PT = 12;
  const DEFAULT_BLOCK_WIDTH_PT = 120;

  const safeNumber = (v: any, fallback: number) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : fallback;
  };

  const fontSizePt = safeNumber(wl.fontSizePt, DEFAULT_FONT_PT);
  const lineHeightPt = safeNumber(wl.lineHeightPt, Math.max(fontSizePt, 14));
  const blockWidthPt = safeNumber(wl.blockWidthPt, DEFAULT_BLOCK_WIDTH_PT);
  const columnGapPt = safeNumber(wl.columnGapPt, 6);

  const marginPt = safeNumber(layout.page?.marginPt, 0);
  const topPx = ptToPx(safeNumber(wl.topPt, 0));
  const leftPx = ptToPx(
    safeNumber(wl.centeredLeftPt, marginPt + safeNumber(wl.contentLeftPt, 0))
  );
  const minWidthPx = ptToPx(blockWidthPt);
  const fontSizePx = ptToPx(fontSizePt);
  const lineHeightPx = ptToPx(lineHeightPt);
  const gapPx = ptToPx(columnGapPt);

  return (
    <div
      style={{
        position: 'absolute',
        top: topPx,
        left: leftPx,
        minWidth: minWidthPx,
        fontFamily: wl.fontFamily,
        fontSize: fontSizePx,
        fontWeight: 400,
        color: wl.color,
        display: 'flex',
        flexDirection: 'row',
        gap: gapPx,
        textAlign: 'left',
        overflow: 'visible',
        flexWrap: 'nowrap',
        zIndex: 2,
      }}
    >
      {columns.map((col, colIdx) => (
        <div
          key={colIdx}
          style={{
            position: 'relative',
            width: ptToPx(safeNumber(wl.columnWidthsPt?.[colIdx], blockWidthPt / wl.columns || 40)),
            minWidth: ptToPx(safeNumber(wl.columnWidthsPt?.[colIdx], blockWidthPt / wl.columns || 40)),
            flex: '0 0 auto',
            height: ptToPx(col.length * lineHeightPt),
            overflow: 'visible',
          }}
        >
          {col.map((word, rowIdx) => (
            <div
              key={`${colIdx}-${rowIdx}`}
              className="flex items-center"
              style={{
                position: 'absolute',
                top: ptToPx(getWordListRowTopOffsetPt(rowIdx, lineHeightPt)),
                left: 0,
                height: ptToPx(lineHeightPt),
                lineHeight: `${lineHeightPx}px`,
                fontWeight: 400,
                gap: ptToPx(safeNumber(wl.checkboxGapPt, 6)),
              }}
            >
              {wl.addCheckboxes && (
                <span
                  className="border border-current shrink-0"
                  style={{
                    width: ptToPx(safeNumber(wl.checkboxSizePt, Math.round(fontSizePt * 0.8))),
                    height: ptToPx(safeNumber(wl.checkboxSizePt, Math.round(fontSizePt * 0.8))),
                    borderColor: wl.checkboxColor,
                  }}
                />
              )}
              <span
                style={{
                  whiteSpace: 'nowrap',
                  display: 'inline-flex',
                  flexShrink: 0,
                  wordBreak: 'normal',
                  overflowWrap: 'normal',
                }}
              >
                {word}
              </span>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

function CanvasHitZone({
  active,
  label,
  onSelect,
  style,
  hideGuides = false,
}: {
  active: boolean;
  label: string;
  onSelect: () => void;
  style: React.CSSProperties;
  hideGuides?: boolean;
}) {
  return (
    <button
      type="button"
      className={cn(
        'canvas-hit-zone',
        active && !hideGuides && 'canvas-hit-zone--active',
        hideGuides && 'canvas-hit-zone--hidden-guides'
      )}
      style={style}
      onClick={(event) => {
        event.stopPropagation();
        onSelect();
      }}
      aria-label={`Edit ${label}`}
      aria-pressed={active && !hideGuides}
    >
      {active && !hideGuides && <span className="canvas-hit-zone__badge">{label}</span>}
    </button>
  );
}

function PuzzlePageCanvas({
  puzzle,
  settings,
  titleWords,
  showSolution,
  showMargins,
  showSafetyZone,
  safetyMarginPx,
  ptToPx,
  puzzleGridScale,
  bookHeaderTitleFontSizePt,
  bookPageIndex,
  canvasEditEnabled = false,
  canvasEditTarget = null,
  canvasEditHighlightTarget = null,
  canvasEditHideGuides = false,
  onCanvasEditTargetChange,
  pagePart = 'clues',
}: {
  puzzle: WordSearchPuzzle;
  settings: WordSearchSettings;
  titleWords: TitleWordsSettings;
  showSolution: boolean;
  showMargins: boolean;
  showSafetyZone: boolean;
  safetyMarginPx: number;
  ptToPx: (pt: number) => number;
  puzzleGridScale: number;
  bookHeaderTitleFontSizePt?: number | null;
  bookPageIndex?: number;
  canvasEditEnabled?: boolean;
  canvasEditTarget?: CanvasEditTarget | null;
  canvasEditHighlightTarget?: CanvasEditTarget | null;
  canvasEditHideGuides?: boolean;
  onCanvasEditTargetChange?: (target: CanvasEditTarget | null) => void;
  pagePart?: 'clues' | 'grid';
}) {
  const editHighlight = canvasEditHighlightTarget ?? canvasEditTarget;
  const isGridOnlyPage = pagePart === 'grid';

  const layout = useMemo(() => {
    return computeWordSearchPageLayout(
      puzzle,
      settings,
      titleWords,
      showSolution,
      puzzleGridScale,
      10,
      bookHeaderTitleFontSizePt,
      pagePart
    );
  }, [puzzle, settings, titleWords, showSolution, puzzleGridScale, bookHeaderTitleFontSizePt, pagePart]);

  const { page, title, subtitle, headerAssembly, grid, wordList } = layout;
  const shouldRenderGrid = !settings.core.twoPagePuzzles || pagePart === 'grid';

  const widthPx = ptToPx(page.widthPt);
  const heightPx = ptToPx(page.heightPt);
  const marginPx = ptToPx(page.marginPt);
  const framePaddingPt = grid.framePaddingPt || 0;
  const activeGridBorder = showSolution
    ? resolveSolutionGridBorder(settings.core)
    : resolvePuzzleGridBorder(settings.core);
  const gridBorderPaddingCssPx = activeGridBorder.paddingPx;
  const borderThicknessCssPx = activeGridBorder.strokeThicknessPx;
  const borderRadiusCssPx = activeGridBorder.cornerRadiusPx;
  const borderThicknessPt = cssPxToPoints(borderThicknessCssPx);
  const gridRootLeftPt = grid.leftPt - borderThicknessPt - framePaddingPt;
  const gridRootTopPt = grid.topPt - borderThicknessPt - framePaddingPt;

  const canvasHitZones = useMemo(() => {
    if (!canvasEditEnabled || showSolution) return null;

    let titleTopPt = page.marginPt;
    let titleLeftPt = page.marginPt;
    let titleWidthPt = page.widthPt - page.marginPt * 2;
    let titleHeightPt = Math.max(36, grid.topPt - titleTopPt - 6);

    if (headerAssembly && headerAssembly.settings.enabled) {
      titleTopPt = headerAssembly.topPt;
      titleLeftPt = headerAssembly.leftPt;
      titleWidthPt = headerAssembly.widthPt;
      titleHeightPt = headerAssembly.heightPt;
    } else if (title) {
      titleTopPt = title.topPt;
      titleHeightPt = Math.max(36, grid.topPt - title.topPt - 6);
    }

    const gridOuterPadPt = borderThicknessPt + framePaddingPt;
    const gridZone = {
      topPt: gridRootTopPt,
      leftPt: gridRootLeftPt,
      widthPt: grid.widthPt + gridOuterPadPt * 2 + borderThicknessPt * 2,
      heightPt: grid.heightPt + gridOuterPadPt * 2 + borderThicknessPt * 2,
    };

    let wordListZone: { topPt: number; leftPt: number; widthPt: number; heightPt: number } | null = null;
    if (wordList && !settings.wordList.hideWordList) {
      const lineHeightPt = wordList.lineHeightPt || Math.max(wordList.fontSizePt, 14);
      const columns = distributeWordsIntoColumns(wordList.words, wordList.columns);
      const maxRows = columns.reduce((max, col) => Math.max(max, col.length), 0);
      wordListZone = {
        topPt: wordList.topPt,
        leftPt: wordList.centeredLeftPt ?? wordList.leftPt,
        widthPt: wordList.blockWidthPt || wordList.widthPt,
        heightPt: Math.max(lineHeightPt, maxRows * lineHeightPt + 8),
      };
    }

    const pageNumberSettings = normalizePageNumberSettings(settings.typography.pageNumber);
    const pageNumberLayout =
      pageNumberSettings.enabled && typeof bookPageIndex === 'number'
        ? computePageNumberLayout(
            page.widthPt,
            page.heightPt,
            settings,
            bookPageIndex,
            pageNumberSettings
          )
        : null;

    return {
      title: { topPt: titleTopPt, leftPt: titleLeftPt, widthPt: titleWidthPt, heightPt: titleHeightPt },
      grid: gridZone,
      wordList: wordListZone,
      pageNumber: pageNumberLayout,
    };
  }, [
    canvasEditEnabled,
    showSolution,
    page.marginPt,
    page.widthPt,
    page.heightPt,
    bookPageIndex,
    settings,
    headerAssembly,
    title,
    grid.topPt,
    grid.widthPt,
    grid.heightPt,
    gridRootTopPt,
    gridRootLeftPt,
    borderThicknessPt,
    framePaddingPt,
    wordList,
    settings.wordList.hideWordList,
  ]);

  return (
    <div
      className="relative shadow-2xl border border-gray-300 select-none transition-shadow duration-300 hover:shadow-3xl"
      style={{
        width: widthPx,
        height: heightPx,
        boxSizing: 'border-box',
        backgroundColor: settings.colors.puzzlePage.backgroundColor || '#ffffff',
        overflow: 'hidden',
      }}
      onClick={() => {
        if (canvasEditEnabled) {
          onCanvasEditTargetChange?.('page-background');
        }
      }}
    >
      {/* Background Image Layer */}
      {settings.colors.puzzlePage.backgroundImage && (
        <PageBackgroundImage
          src={settings.colors.puzzlePage.backgroundImage}
          opacity={settings.colors.puzzlePage.backgroundImageOpacity}
          fit={settings.colors.puzzlePage.backgroundImageFit}
        />
      )}
      {/* Page container frame (global Color Settings) */}
      <PageFrameOverlay
        frame={resolvePageFrameSettings(settings)}
        pageBackgroundColor={settings.colors.puzzlePage.backgroundColor || '#ffffff'}
        hasBackgroundImage={!!settings.colors.puzzlePage.backgroundImage}
      />
      {/* Margin guides */}
      {showMargins && (
        <div
          className="absolute border border-dashed border-blue-400 pointer-events-none z-50 opacity-40 hover:opacity-100 transition-opacity duration-200"
          style={{
            left: marginPx,
            top: marginPx,
            right: marginPx,
            bottom: marginPx,
          }}
        >
          <span className="absolute -top-4 left-0 text-[9px] font-bold text-blue-500 bg-white/95 px-1 rounded shadow-sm">Print Margin</span>
        </div>
      )}

      {/* KDP Safe Zone boundaries */}
      {showSafetyZone && (
        <div
          className="absolute border border-dashed border-black pointer-events-none z-50 opacity-40 hover:opacity-100 transition-opacity duration-200"
          style={{
            left: safetyMarginPx,
            top: safetyMarginPx,
            right: safetyMarginPx,
            bottom: safetyMarginPx,
          }}
        >
          <span className="absolute -bottom-4 right-0 text-[9px] font-bold text-black bg-white/95 px-1 rounded shadow-sm">KDP Safe Zone</span>
        </div>
      )}

      {/* Content — page-absolute coordinates (matches PDF/PPT export) */}
      <>
        {/* Modular header assembly */}
        {!isGridOnlyPage && headerAssembly && (
      <div
        style={{
          position: 'absolute',
              top: ptToPx(headerAssembly.topPt),
              left: ptToPx(headerAssembly.leftPt),
              width: ptToPx(headerAssembly.widthPt),
              maxWidth: ptToPx(headerAssembly.widthPt),
              overflow: 'hidden',
          zIndex: 2,
        }}
      >
            <HeaderAssemblyBar
              parts={headerAssembly.parts}
              settings={headerAssembly.settings}
              headerWidthPt={headerAssembly.widthPt}
              titleFontSizePt={headerAssembly.titleFontSizePt}
              subtitleFontSizePt={headerAssembly.subtitleFontSizePt}
              subtitleLines={headerAssembly.subtitleLines}
              titleColor={headerAssembly.titleColor}
              subtitleColor={headerAssembly.subtitleColor}
              fontFamily={headerAssembly.fontFamily}
              subtitleFontFamily={headerAssembly.subtitleFontFamily}
              subtitleTextWidthPt={headerAssembly.subtitleTextWidthPt}
              ptToPx={ptToPx}
            />
          </div>
        )}

        {/* Title (legacy plain text) */}
        {!isGridOnlyPage && !headerAssembly && title && (
          <div
            style={{
              position: 'absolute',
              top: ptToPx(title.topPt),
              left: 0,
              right: 0,
              textAlign: title.align,
              fontFamily: title.fontFamily,
              fontSize: ptToPx(title.fontSizePt),
              fontWeight: 700,
              color: title.color,
              lineHeight: 1.1,
              zIndex: 2,
            }}
          >
            {title.text}
          </div>
        )}

        {/* Subtitle / Fun facts (legacy) */}
        {!isGridOnlyPage && !headerAssembly && subtitle && (
          <div
            style={{
              position: 'absolute',
              top: ptToPx(subtitle.topPt),
              left: ptToPx(subtitle.leftPt),
              width: ptToPx(subtitle.widthPt),
              textAlign: 'center',
              fontFamily: subtitle.fontFamily,
              fontSize: ptToPx(subtitle.fontSizePt),
              color: subtitle.color,
              lineHeight: 1.2,
              whiteSpace: 'pre-wrap',
              zIndex: 2,
            }}
          >
            {(subtitle.wrappedLines || [subtitle.text]).map((line, i) => (
              <div key={i} style={{ margin: 0 }}>
                {line}
              </div>
            ))}
          </div>
        )}

        {/* Puzzle grid — only shown on the grid page for split-page puzzles */}
        {shouldRenderGrid && (
          <div
            style={{
              position: 'absolute',
              left: ptToPx(gridRootLeftPt),
              top: ptToPx(gridRootTopPt),
              display: 'block',
              lineHeight: 0,
              zIndex: 2,
            }}
          >
            <WordSearchGrid
              puzzle={puzzle}
              showSolution={showSolution}
              cellSize={ptToPx(grid.cellSizePt)}
              noBoxAroundPuzzle={grid.noBox}
              borderStrokeThickness={borderThicknessCssPx}
              borderRadius={borderRadiusCssPx}
              puzzleColor={grid.letterColor}
              letterStrokeColor={grid.letterStrokeColor}
              letterStrokeThickness={ptToPx(grid.letterStrokeThicknessPt)}
              boxColor={grid.boxColor}
              solutionStrokeColor={settings.colors.answerPage.solutionFrameColor}
              solutionStrokeThickness={ptToPx(settings.colors.answerPage.solutionStrokeThickness || 12)}
              solutionStrokePadding={ptToPx(settings.colors.answerPage.solutionStrokePadding || 0)}
              solutionHighlightStrokeColor={
                settings.colors.answerPage.solutionHighlightStrokeColor || '#000000'
              }
              solutionHighlightStrokeThickness={
                settings.colors.answerPage.solutionHighlightStrokeThickness ?? 0
              }
              solutionFrameStyle={settings.colors.answerPage.solutionFrameStyle}
              solutionFrameRadius={ptToPx(settings.colors.answerPage.solutionFrameRadius || 4)}
              solutionHighlightAlpha={settings.colors.answerPage.solutionHighlightAlpha ?? 30}
              puzzleGridFontSize={ptToPx(grid.fontSizePt)}
              puzzleGridFontFamily={grid.fontFamily}
              answerGridFontSize={showSolution ? ptToPx(grid.fontSizePt) : undefined}
              answerGridFontFamily={showSolution ? grid.fontFamily : undefined}
              gridBorderPadding={gridBorderPaddingCssPx}
              shapeImageSrc={
                settings.core.shapeWordSearchEnabled
                  ? resolveShapeMaskImageSrc(
                      settings.core,
                      puzzle.puzzleIndexInDocument ?? 0
                    )
                  : undefined
              }
              shapeImageShow={Boolean(
                settings.core.shapeWordSearchEnabled && settings.core.shapeMaskShowImage
              )}
              shapeImageOpacity={settings.core.shapeMaskImageOpacity ?? 35}
              shapeImageFit={settings.core.shapeMaskFit ?? 'contain'}
            />
          </div>
        )}

        {/* Word List */}
        {!showSolution && !isGridOnlyPage && wordList && (
          <WordListPreview layout={layout} ptToPx={ptToPx} />
        )}

        {typeof bookPageIndex === 'number' ? (
        <PageNumberOverlay
          settings={settings}
          bookPageIndex={bookPageIndex}
          pageWidthPt={page.widthPt}
          pageHeightPt={page.heightPt}
          ptToPx={ptToPx}
        />
        ) : null}

        {canvasHitZones && onCanvasEditTargetChange && (
          <>
            <CanvasHitZone
              active={editHighlight === 'page-background'}
              hideGuides={canvasEditHideGuides}
              label="Background"
              onSelect={() => onCanvasEditTargetChange?.('page-background')}
              style={{
                position: 'absolute',
                inset: 0,
                zIndex: 15,
              }}
            />
            <CanvasHitZone
              active={editHighlight === 'title'}
              hideGuides={canvasEditHideGuides}
              label="Title"
              onSelect={() => onCanvasEditTargetChange?.('title')}
              style={{
                position: 'absolute',
                top: ptToPx(canvasHitZones.title.topPt),
                left: ptToPx(canvasHitZones.title.leftPt),
                width: ptToPx(canvasHitZones.title.widthPt),
                height: ptToPx(canvasHitZones.title.heightPt),
                zIndex: 25,
              }}
            />
            <CanvasHitZone
              active={editHighlight === 'grid'}
              hideGuides={canvasEditHideGuides}
              label="Grid"
              onSelect={() => onCanvasEditTargetChange?.('grid')}
              style={{
                position: 'absolute',
                top: ptToPx(canvasHitZones.grid.topPt),
                left: ptToPx(canvasHitZones.grid.leftPt),
                width: ptToPx(canvasHitZones.grid.widthPt),
                height: ptToPx(canvasHitZones.grid.heightPt),
                zIndex: 25,
              }}
            />
            {canvasHitZones.wordList && (
              <CanvasHitZone
                active={editHighlight === 'word-list'}
                hideGuides={canvasEditHideGuides}
                label="Word List"
                onSelect={() => onCanvasEditTargetChange?.('word-list')}
                style={{
                  position: 'absolute',
                  top: ptToPx(canvasHitZones.wordList.topPt),
                  left: ptToPx(canvasHitZones.wordList.leftPt),
                  width: ptToPx(canvasHitZones.wordList.widthPt),
                  height: ptToPx(canvasHitZones.wordList.heightPt),
                  zIndex: 25,
                }}
              />
            )}
            {canvasHitZones.pageNumber && (
              <CanvasHitZone
                active={editHighlight === 'page-number'}
                hideGuides={canvasEditHideGuides}
                label="Page #"
                onSelect={() => onCanvasEditTargetChange?.('page-number')}
                style={{
                  position: 'absolute',
                  top: ptToPx(canvasHitZones.pageNumber.topPt),
                  left: ptToPx(canvasHitZones.pageNumber.leftPt),
                  width: ptToPx(canvasHitZones.pageNumber.widthPt),
                  height: ptToPx(canvasHitZones.pageNumber.heightPt),
                  zIndex: 26,
                }}
              />
            )}
          </>
        )}
      </>
    </div>
  );
}

function normalizeTextModuleSettings(
  page: DocumentPage,
  raw: TextModuleSettings | PuzzleModuleSettings
): TextModuleSettings {
  if (isTextModuleType(page.moduleType) && isTextModuleSettings(raw)) {
    const fontSize =
      typeof raw.fontSize === 'number' && Number.isFinite(raw.fontSize) && raw.fontSize > 0
        ? raw.fontSize
        : 18;
    return {
      ...getDefaultTextModuleSettings(page.moduleType),
      ...raw,
      fontSize,
      fontFamily: raw.fontFamily || 'Arial',
    };
  }
  return {
    ...getDefaultTextModuleSettings('title-page'),
    title: page.name,
    content: page.name,
  };
}

function TextPageCanvas({
  page,
  settings,
  wordSearchSettings,
  showMargins,
  showSafetyZone,
  safetyMarginPx,
  ptToPx,
  textEditEnabled = false,
  textEditTarget = null,
  textEditHideGuides = false,
  onTextEditTargetChange,
  onSettingsChange,
  bookPageIndex = null,
}: {
  page: DocumentPage;
  settings: TextModuleSettings;
  wordSearchSettings: WordSearchSettings;
  showMargins: boolean;
  showSafetyZone: boolean;
  safetyMarginPx: number;
  ptToPx: (pt: number) => number;
  textEditEnabled?: boolean;
  textEditTarget?: TextPageEditTarget | null;
  textEditHideGuides?: boolean;
  onTextEditTargetChange?: (target: TextPageEditTarget) => void;
  onSettingsChange?: (updates: Partial<TextModuleSettings>) => void;
  bookPageIndex?: number | null;
}) {
  const titleRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  const dims = getPageDimensionsInches(wordSearchSettings);
  const pageWidthPt = dims.width * 72;
  const pageHeightPt = dims.height * 72;
  const widthPx = ptToPx(pageWidthPt);
  const heightPx = ptToPx(pageHeightPt);
  const marginPx = ptToPx(getPageMarginInches(wordSearchSettings) * 72);

  const content = settings.content?.trim() || '';
  const title = settings.title || page.name;
  const alignment = settings.alignment || 'center';
  const alignItems =
    alignment === 'left' ? 'flex-start' : alignment === 'right' ? 'flex-end' : 'center';
  const fontSizePt =
    typeof settings.fontSize === 'number' && Number.isFinite(settings.fontSize) && settings.fontSize > 0
      ? settings.fontSize
      : 18;
  const bodyFontPx = ptToPx(fontSizePt);
  const titleFontPx = ptToPx(resolveTextPageTitleFontSize(settings));
  const textColor = resolveTextPageTextColor(settings, wordSearchSettings);
  const pageBackground = resolveTextPageBackground(settings, wordSearchSettings);
  const pageFrame = resolveTextPageFrameSettings(settings, wordSearchSettings);
  const isEditing = textEditEnabled && !!onSettingsChange;

  useEffect(() => {
    if (titleRef.current && document.activeElement !== titleRef.current) {
      titleRef.current.textContent = title;
    }
  }, [title]);

  useEffect(() => {
    if (contentRef.current && document.activeElement !== contentRef.current) {
      contentRef.current.textContent = content;
    }
  }, [content]);

  const handleTitleInput = () => {
    if (!titleRef.current || !onSettingsChange) return;
    onSettingsChange({ title: titleRef.current.textContent ?? '' });
  };

  const handleContentInput = () => {
    if (!contentRef.current || !onSettingsChange) return;
    onSettingsChange({ content: contentRef.current.textContent ?? '' });
  };

  return (
    <div
      className="relative shadow-2xl border border-gray-300 select-none transition-shadow duration-300 hover:shadow-3xl"
      style={{
        width: widthPx,
        height: heightPx,
        boxSizing: 'border-box',
        backgroundColor: pageBackground.backgroundColor || '#ffffff',
        overflow: 'hidden',
      }}
      onClick={() => {
        if (textEditEnabled) {
          onTextEditTargetChange?.('page-frame');
        }
      }}
    >
      {pageBackground.backgroundImage && (
        <PageBackgroundImage
          src={pageBackground.backgroundImage}
          opacity={pageBackground.backgroundImageOpacity}
          fit={pageBackground.backgroundImageFit}
        />
      )}

      <PageFrameOverlay
        frame={pageFrame}
        pageBackgroundColor={pageBackground.backgroundColor || '#ffffff'}
        hasBackgroundImage={!!pageBackground.backgroundImage}
      />

      {showMargins && (
        <div
          className="absolute border border-dashed border-blue-400 pointer-events-none z-50 opacity-40 hover:opacity-100 transition-opacity duration-200"
          style={{
            left: marginPx,
            top: marginPx,
            right: marginPx,
            bottom: marginPx,
          }}
        >
          <span className="absolute -top-4 left-0 text-[9px] font-bold text-blue-500 bg-white/95 px-1 rounded shadow-sm">Print Margin</span>
        </div>
      )}

      {showSafetyZone && (
        <div
          className="absolute border border-dashed border-black pointer-events-none z-50 opacity-40 hover:opacity-100 transition-opacity duration-200"
          style={{
            left: safetyMarginPx,
            top: safetyMarginPx,
            right: safetyMarginPx,
            bottom: safetyMarginPx,
          }}
        >
          <span className="absolute -bottom-4 right-0 text-[9px] font-bold text-black bg-white/95 px-1 rounded shadow-sm">KDP Safe Zone</span>
        </div>
      )}

      <div
        style={{
          position: 'absolute',
          left: marginPx,
          top: marginPx,
          right: marginPx,
          bottom: marginPx,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: alignItems,
          textAlign: alignment,
          padding: ptToPx(12),
          boxSizing: 'border-box',
          zIndex: 10,
          pointerEvents: isEditing ? 'auto' : 'none',
        }}
        onClick={(event) => {
          event.stopPropagation();
          if (textEditEnabled) {
            onTextEditTargetChange?.('text-content');
          }
        }}
      >
        <div
          style={{
            width: '100%',
            fontFamily: settings.fontFamily || 'Arial',
            color: textColor,
            whiteSpace: 'pre-wrap',
            fontSize: bodyFontPx,
            lineHeight: 1.3,
          }}
        >
          <div
            ref={titleRef}
            className="font-bold mb-4 outline-none"
            style={{ fontSize: titleFontPx }}
            contentEditable={isEditing}
            suppressContentEditableWarning
            onInput={handleTitleInput}
            onClick={(event) => event.stopPropagation()}
          />
          <div
            ref={contentRef}
            className="outline-none min-h-[1.5em]"
            contentEditable={isEditing}
            suppressContentEditableWarning
            onInput={handleContentInput}
            onClick={(event) => event.stopPropagation()}
          />
          {!content && !title && isEditing && (
            <span className="pointer-events-none text-slate-400 italic" aria-hidden>
              Click to add text…
            </span>
          )}
          </div>
        </div>

      {typeof bookPageIndex === 'number' && (
        <PageNumberOverlay
          settings={wordSearchSettings}
          bookPageIndex={bookPageIndex}
          pageWidthPt={pageWidthPt}
          pageHeightPt={pageHeightPt}
          ptToPx={ptToPx}
        />
      )}
    </div>
  );
}
function PuzzleModulePlaceholderCanvas({
  page,
  wordSearchSettings,
  showMargins,
  showSafetyZone,
  safetyMarginPx,
  ptToPx,
}: {
  page: DocumentPage;
  wordSearchSettings: WordSearchSettings;
  showMargins: boolean;
  showSafetyZone: boolean;
  safetyMarginPx: number;
  ptToPx: (pt: number) => number;
}) {
  const dims = getPageDimensionsInches(wordSearchSettings);
  const widthPx = ptToPx(dims.width * 72);
  const heightPx = ptToPx(dims.height * 72);
  const marginPx = ptToPx(getPageMarginInches(wordSearchSettings) * 72);
  const label = page.name || page.moduleType.replace(/-/g, ' ');

  return (
    <div
      className="relative shadow-2xl border border-gray-300 select-none"
      style={{
        width: widthPx,
        height: heightPx,
        boxSizing: 'border-box',
        backgroundColor: wordSearchSettings.colors.puzzlePage.backgroundColor || '#ffffff',
        overflow: 'hidden',
      }}
    >
      {showMargins && (
        <div
          className="absolute border border-dashed border-blue-400 pointer-events-none z-50 opacity-40"
          style={{ left: marginPx, top: marginPx, right: marginPx, bottom: marginPx }}
        />
      )}
      {showSafetyZone && (
        <div
          className="absolute border border-dashed border-black pointer-events-none z-50 opacity-40"
          style={{ left: safetyMarginPx, top: safetyMarginPx, right: safetyMarginPx, bottom: safetyMarginPx }}
        />
      )}
      <div
        className="absolute inset-0 flex flex-col items-center justify-center text-center px-8"
        style={{ color: '#64748b' }}
      >
        <p className="text-lg font-semibold text-slate-700 capitalize">{label}</p>
        <p className="mt-2 text-sm text-slate-500">Generate puzzles to preview this section.</p>
      </div>
    </div>
  );
}

function DocumentPageCanvas({
  page,
  activeDocumentPageId,
  currentPuzzleType,
  currentPuzzle,
  batchPuzzles,
  currentBatchIndex,
  activePreviewTab,
  previewRangeMode,
  wordSearchSettings,
  titleWords,
  showSolution,
  showMargins,
  showSafetyZone,
  safetyMarginPx,
  ptToPx,
  puzzleGridScale,
  titleToAnswerGap,
  solutionToSolutionGap,
  pageMargin,
  bookHeaderTitleFontSizePt,
  currentSolutionPageIndex,
  compiledSolutionPages,
  canvasEditEnabled = false,
  canvasEditTarget = null,
  canvasEditHighlightTarget = null,
  canvasEditHideGuides = false,
  onCanvasEditTargetChange,
  textEditEnabled = false,
  textEditTarget = null,
  textEditHideGuides = false,
  onTextEditTargetChange,
  onTextSettingsChange,
  selectedTextBlockId = null,
  showTextBlockChrome = true,
  onSelectTextBlock,
  onCanvasBackgroundClick,
  onDeleteTextBlock,
  canvasScale = 1,
  compiledBook = null,
  onTocCanvasClick,
  crosswordSettings = null,
  crosswordBatchPuzzles = [],
  crosswordCanvasEditEnabled = false,
  crosswordEditTarget = null,
  crosswordEditHideGuides = false,
  onCrosswordEditTargetChange,
  genericPuzzleSettings = null,
  genericBatchPuzzles = [],
  genericPuzzleCanvasEditEnabled = false,
  genericPuzzleEditHideGuides = false,
  onGenericPuzzleEditTargetChange,
  murdokuSettings = null,
  murdokuBatchPuzzles = [],
}: {
  page: DocumentPage;
  activeDocumentPageId: string;
  currentPuzzleType: string;
  currentPuzzle: any;
  batchPuzzles: WordSearchPuzzle[];
  currentBatchIndex: number;
  activePreviewTab: string;
  previewRangeMode: string;
  wordSearchSettings: WordSearchSettings;
  titleWords: TitleWordsSettings;
  showSolution: boolean;
  showMargins: boolean;
  showSafetyZone: boolean;
  safetyMarginPx: number;
  ptToPx: (pt: number) => number;
  puzzleGridScale: number;
  titleToAnswerGap: number;
  solutionToSolutionGap: number;
  pageMargin: number;
  bookHeaderTitleFontSizePt?: number | null;
  currentSolutionPageIndex: number;
  compiledSolutionPages?: CompiledSolutionPage[];
  canvasEditEnabled?: boolean;
  canvasEditTarget?: CanvasEditTarget | null;
  canvasEditHighlightTarget?: CanvasEditTarget | null;
  canvasEditHideGuides?: boolean;
  onCanvasEditTargetChange?: (target: CanvasEditTarget | null) => void;
  textEditEnabled?: boolean;
  textEditTarget?: TextPageEditTarget | null;
  textEditHideGuides?: boolean;
  onTextEditTargetChange?: (target: TextPageEditTarget) => void;
  onTextSettingsChange?: (updates: Partial<TextModuleSettings>) => void;
  selectedTextBlockId?: string | null;
  showTextBlockChrome?: boolean;
  onSelectTextBlock?: (blockId: string) => void;
  onCanvasBackgroundClick?: () => void;
  onDeleteTextBlock?: (blockId: string) => void;
  canvasScale?: number;
  compiledBook?: CompiledBook | null;
  onTocCanvasClick?: () => void;
  crosswordSettings?: CrosswordSettings | null;
  crosswordBatchPuzzles?: CrosswordPuzzle[];
  crosswordCanvasEditEnabled?: boolean;
  crosswordEditTarget?: CrosswordEditTarget | null;
  crosswordEditHideGuides?: boolean;
  onCrosswordEditTargetChange?: (target: CrosswordEditTarget) => void;
  genericPuzzleSettings?: GenericPuzzleSettings | null;
  genericBatchPuzzles?: import('@/lib/puzzles/types').GenericBatchPuzzle[];
  genericPuzzleCanvasEditEnabled?: boolean;
  genericPuzzleEditHideGuides?: boolean;
  onGenericPuzzleEditTargetChange?: (target: GenericPuzzleEditTarget) => void;
  murdokuSettings?: MurdokuSettings | null;
  murdokuBatchPuzzles?: MurdokuPuzzle[];
}) {
  if (page.moduleType === 'word-search') {
    const pageSettings = page.settings as PuzzleModuleSettings;
    const pageWordSearchSettings =
      page.id === activeDocumentPageId
        ? wordSearchSettings
        : pageSettings.wordSearchSettings ?? wordSearchSettings;
    const pageTitleWords =
      page.id === activeDocumentPageId
        ? titleWords
        : pageSettings.titleWords ?? titleWords;
    const pagePuzzles = batchPuzzles.filter((puzzle) => puzzle.pageId === page.id);
    const pageStartIndex = batchPuzzles.findIndex((puzzle) => puzzle.pageId === page.id);
    const includeBlankAfterEachPuzzle =
      !!pageWordSearchSettings.bookCanvas.includePageBetweenPuzzleAndSolutions;
    const answersPerPage = pageWordSearchSettings.bookCanvas.answersPerPage || 1;
    const activePagePuzzle = page.id === activeDocumentPageId
      ? pagePuzzles[Math.max(0, Math.min(pagePuzzles.length - 1, currentBatchIndex - Math.max(pageStartIndex, 0)))]
      : pagePuzzles[0];
    const puzzleIndexInDoc = page.id === activeDocumentPageId
      ? Math.max(0, Math.min(pagePuzzles.length - 1, currentBatchIndex - Math.max(pageStartIndex, 0)))
      : 0;
    const resolvedBookPageIndex = visibleBookPageIndex(
      compiledBook,
      compiledBook
        ? findBookPageIndexForDocument(compiledBook, page.id, puzzleIndexInDoc)
        : computePuzzleBookPageIndex(
            Math.max(0, pageStartIndex) + puzzleIndexInDoc,
            includeBlankAfterEachPuzzle
          )
    );

    if (activePreviewTab === 'puzzles') {
      if (previewRangeMode === 'sample') {
        if (!activePagePuzzle) {
          return (
            <PuzzleModulePlaceholderCanvas
              page={page}
              wordSearchSettings={pageWordSearchSettings}
              showMargins={showMargins}
              showSafetyZone={showSafetyZone}
              safetyMarginPx={safetyMarginPx}
              ptToPx={ptToPx}
            />
          );
        }

        const pageParts = pageWordSearchSettings.core.twoPagePuzzles ? ['clues', 'grid'] : ['clues'];

        return (
          <div className="flex flex-col gap-10 items-center w-full pb-16">
            {pageParts.map((pagePart) => (
              <div key={`${page.id}-${pagePart}`} className="w-full">
                <PuzzlePageCanvas
                  puzzle={activePagePuzzle}
                  settings={pageWordSearchSettings}
                  titleWords={pageTitleWords}
                  showSolution={showSolution}
                  showMargins={showMargins}
                  showSafetyZone={showSafetyZone}
                  safetyMarginPx={safetyMarginPx}
                  ptToPx={ptToPx}
                  puzzleGridScale={puzzleGridScale}
                  bookHeaderTitleFontSizePt={bookHeaderTitleFontSizePt}
                  bookPageIndex={resolvedBookPageIndex}
                  canvasEditEnabled={canvasEditEnabled}
                  canvasEditTarget={canvasEditTarget}
                  canvasEditHighlightTarget={canvasEditHighlightTarget}
                  canvasEditHideGuides={canvasEditHideGuides}
                  onCanvasEditTargetChange={onCanvasEditTargetChange}
                  pagePart={pagePart}
                />
              </div>
            ))}
          </div>
        );
      }

      return (
        <div className="flex flex-col gap-10 items-center w-full pb-16">
          {pagePuzzles.length > 0 ? (
            pagePuzzles.flatMap((puzzle, idx) => {
              const parts = pageWordSearchSettings.core.twoPagePuzzles ? ['clues', 'grid'] : ['clues'];
              return parts.map((pagePart) => (
                <div key={`${page.id}-${puzzle.puzzleNumber || idx}-${pagePart}`} className="w-full">
                  <PuzzlePageCanvas
                    puzzle={puzzle}
                    settings={pageWordSearchSettings}
                    titleWords={pageTitleWords}
                    showSolution={showSolution}
                    showMargins={showMargins}
                    showSafetyZone={showSafetyZone}
                    safetyMarginPx={safetyMarginPx}
                    ptToPx={ptToPx}
                    puzzleGridScale={puzzleGridScale}
                    bookHeaderTitleFontSizePt={bookHeaderTitleFontSizePt}
                    bookPageIndex={visibleBookPageIndex(
                      compiledBook,
                      compiledBook
                        ? findBookPageIndexForDocument(compiledBook, page.id, idx)
                        : computePuzzleBookPageIndex(
                            Math.max(0, pageStartIndex) + idx,
                            includeBlankAfterEachPuzzle
                          )
                    )}
                    pagePart={pagePart}
                  />
                </div>
              ));
            })
          ) : (
            <PuzzleModulePlaceholderCanvas
              page={page}
              wordSearchSettings={pageWordSearchSettings}
              showMargins={showMargins}
              showSafetyZone={showSafetyZone}
              safetyMarginPx={safetyMarginPx}
              ptToPx={ptToPx}
            />
          )}
        </div>
      );
    }

    // In full-book view, solutions are rendered together at the end of the book.
    if (previewRangeMode === 'all' && activePreviewTab === 'solutions') {
      return null;
    }

    const pageSolutionChunks: WordSearchPuzzle[][] = [];
    for (let i = 0; i < pagePuzzles.length; i += answersPerPage) {
      pageSolutionChunks.push(pagePuzzles.slice(i, i + answersPerPage));
    }
    const compiledDocSolutionPages = compiledBook
      ? getCompiledSolutionPagesForDocument(compiledBook, page.id)
      : compiledSolutionPages ?? [];
    const solutionChunkIndex = Math.min(
      Math.max(0, currentSolutionPageIndex),
      Math.max(0, (compiledDocSolutionPages.length || pageSolutionChunks.length) - 1)
    );
    const compiledSolutionEntry = compiledDocSolutionPages[solutionChunkIndex];
    const compiledWsSolution =
      compiledSolutionEntry && compiledSolutionEntry.kind === 'solution'
        ? compiledSolutionEntry
        : undefined;
    const solutionChunk =
      compiledWsSolution?.puzzles ?? pageSolutionChunks[solutionChunkIndex] ?? [];
    const rawSolutionBookPageIndex = compiledBook
      ? compiledSolutionEntry?.bookPageIndex ??
        findBookPageIndexForSolution(compiledBook, page.id, solutionChunkIndex) ??
        compiledBook.pages.length + solutionChunkIndex
      : computeSolutionBookPageIndex(
          batchPuzzles.length,
          Math.max(0, Math.floor(pageStartIndex / answersPerPage) + solutionChunkIndex),
          includeBlankAfterEachPuzzle
        );
    const solutionBookPageIndexForChunk =
      visibleBookPageIndex(compiledBook, rawSolutionBookPageIndex) ??
      (compiledBook ? undefined : rawSolutionBookPageIndex);

    if (previewRangeMode === 'sample') {
    return (
      <SolutionsPageCanvas
          puzzles={solutionChunk}
        settings={pageWordSearchSettings}
        titleWords={pageTitleWords}
          pageIndex={solutionChunkIndex}
          bookPageIndex={solutionBookPageIndexForChunk}
        showMargins={showMargins}
        showSafetyZone={showSafetyZone}
        safetyMarginPx={safetyMarginPx}
        ptToPx={ptToPx}
        titleToAnswerGap={titleToAnswerGap}
        solutionToSolutionGap={solutionToSolutionGap}
        pageMargin={pageMargin}
          canvasEditEnabled={canvasEditEnabled}
          canvasEditTarget={canvasEditTarget}
          canvasEditHighlightTarget={canvasEditHighlightTarget}
          canvasEditHideGuides={canvasEditHideGuides}
          onCanvasEditTargetChange={onCanvasEditTargetChange}
        />
      );
    }

    return (
      <div className="flex flex-col gap-10 items-center w-full pb-16">
        {pageSolutionChunks.map((chunk, chunkIdx) => (
          <div key={`${page.id}-solution-${chunkIdx}`} className="w-full">
            <SolutionsPageCanvas
              puzzles={chunk}
              settings={pageWordSearchSettings}
              titleWords={pageTitleWords}
              pageIndex={chunkIdx}
              bookPageIndex={visibleBookPageIndex(
                compiledBook,
                compiledDocSolutionPages[chunkIdx]?.bookPageIndex ??
                  (compiledBook
                    ? findBookPageIndexForSolution(compiledBook, page.id, chunkIdx)
                    : computeSolutionBookPageIndex(
                        batchPuzzles.length,
                        Math.max(0, Math.floor(pageStartIndex / answersPerPage) + chunkIdx),
                        includeBlankAfterEachPuzzle
                      ))
              )}
              showMargins={showMargins}
              showSafetyZone={showSafetyZone}
              safetyMarginPx={safetyMarginPx}
              ptToPx={ptToPx}
              titleToAnswerGap={titleToAnswerGap}
              solutionToSolutionGap={solutionToSolutionGap}
              pageMargin={pageMargin}
            />
          </div>
        ))}
      </div>
    );
  }

  if (
    page.moduleType === 'title-page' ||
    page.moduleType === 'table-of-contents' ||
    page.moduleType === 'copyright' ||
    page.moduleType === 'cta' ||
    page.moduleType === 'introduction' ||
    page.moduleType === 'instructions'
  ) {
    const normalized = normalizeTextModuleSettings(page, page.settings as TextModuleSettings);
    const textBookPageIndex =
      (compiledBook && findBookPageIndexForDocument(compiledBook, page.id, 0)) ?? null;
    const showTextPageNumber =
      typeof textBookPageIndex === 'number' &&
      (!compiledBook || shouldDrawBookPageNumber(textBookPageIndex, compiledBook.pages));

    if (page.moduleType === 'title-page') {
      return (
        <TextPageBlockCanvas
          page={page}
          settings={normalized}
          wordSearchSettings={wordSearchSettings}
          showMargins={showMargins}
          showSafetyZone={showSafetyZone}
          safetyMarginPx={safetyMarginPx}
          ptToPx={ptToPx}
          canvasScale={canvasScale}
          textEditEnabled={textEditEnabled && page.id === activeDocumentPageId}
          selectedBlockId={selectedTextBlockId}
          showBlockChrome={showTextBlockChrome}
          onSelectBlock={onSelectTextBlock}
          onSettingsChange={onTextSettingsChange}
          onCanvasBackgroundClick={onCanvasBackgroundClick}
          onDeleteBlock={onDeleteTextBlock}
        />
      );
    }

    if (page.moduleType === 'table-of-contents') {
      const compiledTocPages =
        compiledBook?.pages.filter(
          (compiledPage): compiledPage is CompiledTextPage =>
            compiledPage.kind === 'text' && compiledPage.sourceDocumentId === page.id
        ) ?? [];
      const tocPages =
        compiledTocPages.length > 0
          ? compiledTocPages
          : [
              {
                kind: 'text' as const,
                sourceDocumentId: page.id,
                sourceDocumentName: page.name,
                moduleType: page.moduleType,
                bookPageIndex: textBookPageIndex ?? 0,
                pageNumber: null,
                settings: normalized,
                resolvedToc: compiledBook?.tocEntries ?? [],
              },
            ];

      return (
        <div className="flex flex-col gap-10 items-center w-full">
          {tocPages.map((compiledTocPage, sliceIndex) => (
            <TocPageCanvas
              key={`${page.id}-toc-${sliceIndex}`}
              page={page}
              settings={{
                ...normalized,
                tocPageIndex: compiledTocPage.settings?.tocPageIndex ?? sliceIndex,
                tocPageCount: compiledTocPage.settings?.tocPageCount ?? tocPages.length,
                tocTotalEntryCount:
                  compiledBook?.tocEntries?.length ??
                  compiledTocPage.settings?.tocTotalEntryCount ??
                  compiledTocPage.resolvedToc?.length,
              }}
              wordSearchSettings={wordSearchSettings}
              entries={compiledTocPage.resolvedToc ?? compiledBook?.tocEntries ?? []}
              totalEntryCount={
                compiledBook?.tocEntries?.length ??
                compiledTocPage.settings?.tocTotalEntryCount ??
                compiledTocPage.resolvedToc?.length
              }
              bookPageIndex={compiledTocPage.bookPageIndex ?? textBookPageIndex}
              tocPageIndex={compiledTocPage.settings?.tocPageIndex ?? sliceIndex}
              tocPageCount={compiledTocPage.settings?.tocPageCount ?? tocPages.length}
              showMargins={showMargins}
              showSafetyZone={showSafetyZone}
              safetyMarginPx={safetyMarginPx}
              ptToPx={ptToPx}
              textEditEnabled={textEditEnabled && page.id === activeDocumentPageId}
              onSettingsChange={onTextSettingsChange}
              onCanvasClick={onTocCanvasClick}
            />
          ))}
        </div>
      );
    }

    return (
      <TextPageCanvas
        page={page}
        settings={normalized}
        wordSearchSettings={wordSearchSettings}
        showMargins={showMargins}
        showSafetyZone={showSafetyZone}
        safetyMarginPx={safetyMarginPx}
        ptToPx={ptToPx}
        textEditEnabled={textEditEnabled && page.id === activeDocumentPageId}
        textEditTarget={textEditTarget}
        textEditHideGuides={textEditHideGuides}
        onTextEditTargetChange={onTextEditTargetChange}
        onSettingsChange={onTextSettingsChange}
        bookPageIndex={showTextPageNumber ? textBookPageIndex : null}
      />
    );
  }

  if (isPuzzleModuleType(page.moduleType)) {
    const moduleSettings = page.settings as PuzzleModuleSettings;
    const isGenericModule = isGenericPuzzleModuleType(page.moduleType);
    const isMurdokuModule = page.moduleType === 'murdoku';
    // Modules that carry a per-document batch of generated puzzles.
    const isBatchModule =
      page.moduleType === 'crossword' || isGenericModule || isMurdokuModule;
    const pageCrosswordBatch = crosswordBatchPuzzles.filter(
      (puzzle) =>
        puzzle.pageId === page.id ||
        (!puzzle.pageId && page.id === activeDocumentPageId && page.moduleType === 'crossword')
    );
    const pageGenericBatch = genericBatchPuzzles.filter(
      (puzzle) =>
        puzzle.type === page.moduleType &&
        (puzzle.pageId === page.id ||
          (!puzzle.pageId && page.id === activeDocumentPageId && isGenericModule))
    );
    const pageMurdokuBatch = murdokuBatchPuzzles.filter(
      (puzzle) =>
        puzzle.pageId === page.id ||
        (!puzzle.pageId && page.id === activeDocumentPageId && isMurdokuModule)
    );
    const pageBatch: any[] =
      page.moduleType === 'crossword'
        ? pageCrosswordBatch
        : isMurdokuModule
          ? pageMurdokuBatch
          : pageGenericBatch;
    const pageCwSettings =
      page.moduleType === 'crossword'
        ? page.id === activeDocumentPageId
          ? crosswordSettings
          : (moduleSettings.crosswordSettings ?? crosswordSettings)
        : null;
    const pageMdSettings = isMurdokuModule
      ? normalizeMurdokuSettings(
          page.id === activeDocumentPageId
            ? murdokuSettings ?? moduleSettings.murdokuSettings
            : moduleSettings.murdokuSettings ?? murdokuSettings ?? getDefaultMurdokuSettings()
        )
      : null;
    const pageGpSettings = isGenericModule
      ? page.id === activeDocumentPageId
        ? genericPuzzleSettings
        : (moduleSettings.genericPuzzleSettings ?? genericPuzzleSettings)
      : null;
    const normalizedPageGp = isGenericModule
      ? normalizeGenericPuzzleSettings(
          pageGpSettings ?? undefined,
          page.moduleType as GenericPuzzleModuleType
        )
      : null;
    const batchSolutionsPerPage =
      page.moduleType === 'crossword'
        ? normalizeCrosswordSettings(pageCwSettings ?? getDefaultCrosswordSettings()).bookCanvas
            .answersPerPage || 1
        : normalizedPageGp
          ? page.moduleType === 'trivia'
            ? computeTriviaSolutionsPerPage({
                answersPerColumn: normalizedPageGp.core.solutionsPerPage || 20,
                solutionColumns: normalizedPageGp.core.triviaSolutionColumns || 3,
              })
            : normalizedPageGp.core.solutionsPerPage || 1
          : 1;
    const batchPuzzlesPerPage = normalizedPageGp?.core.puzzlesPerPage || 1;
    const batchShowSolution = isBatchModule ? activePreviewTab === 'solutions' : showSolution;
    const murdokuTwoPage =
      isMurdokuModule && !!pageMdSettings?.core.twoPagePuzzles && !batchShowSolution;
    const murdokuPagesPerPuzzle = murdokuTwoPage ? 2 : 1;
    const murdokuVisualCount = Math.max(0, pageBatch.length * murdokuPagesPerPuzzle);

    // Batch pagination uses a document-local index (0..N-1), same as the page flipper.
    const batchRangeMax = isMurdokuModule && !batchShowSolution
      ? Math.max(0, murdokuVisualCount - 1)
      : Math.max(0, pageBatch.length - 1);
    const batchLocalIndex =
      page.id === activeDocumentPageId
        ? Math.max(
            0,
            Math.min(batchRangeMax, Math.max(0, currentBatchIndex))
          )
        : 0;
    const murdokuPuzzleIndex = isMurdokuModule
      ? Math.floor(batchLocalIndex / murdokuPagesPerPuzzle)
      : batchLocalIndex;
    const murdokuPagePart: MurdokuPagePart = murdokuTwoPage
      ? batchLocalIndex % 2 === 0
        ? 'characters'
        : 'scene'
      : pageMdSettings?.core.twoPagePuzzles && batchShowSolution
        ? 'scene'
        : 'single';

    const puzzleFromBatch =
      isBatchModule && !batchShowSolution
        ? pageBatch.find(
            (puzzle) =>
              (puzzle.puzzleIndexInDocument ?? 0) ===
              (isMurdokuModule ? murdokuPuzzleIndex : batchLocalIndex)
          ) ??
          pageBatch[isMurdokuModule ? murdokuPuzzleIndex : batchLocalIndex] ??
          (page.id === activeDocumentPageId && currentPuzzle?.type === page.moduleType
            ? currentPuzzle
            : null)
        : null;

    const batchSolutionChunk =
      isBatchModule && batchShowSolution
        ? (() => {
            if (page.moduleType === 'trivia') {
              const triviaPages = packTriviaGamesForSolutionPages(
                pageBatch as import('@/lib/puzzles/types').TriviaPuzzle[],
                batchSolutionsPerPage
              );
              const games =
                triviaPages[Math.max(0, currentSolutionPageIndex)] ?? triviaPages[0];
              if (games && games.length > 0) return games;
              if (page.id === activeDocumentPageId && currentPuzzle?.type === 'trivia') {
                return [currentPuzzle as import('@/lib/puzzles/types').TriviaPuzzle];
              }
              return [];
            }
            const start = Math.max(0, currentSolutionPageIndex) * batchSolutionsPerPage;
            const chunk = pageBatch.slice(start, start + batchSolutionsPerPage);
            if (chunk.length > 0) return chunk;
            if (page.id === activeDocumentPageId && currentPuzzle?.type === page.moduleType) {
              return [currentPuzzle];
            }
            return [];
          })()
        : [];

    const hasBatch = isBatchModule && pageBatch.length > 0;

  const isActiveGeneratedPuzzle =
    page.id === activeDocumentPageId &&
      ((isBatchModule && (!!puzzleFromBatch || batchSolutionChunk.length > 0)) ||
        (!isBatchModule && currentPuzzle && currentPuzzleType === page.moduleType));

    // Inactive batch docs still preview their first generated puzzle.
    if (isBatchModule && page.id !== activeDocumentPageId && hasBatch && !batchShowSolution) {
      const thumb = pageBatch[0];
      const thumbIndex = thumb.puzzleIndexInDocument ?? 0;
      const thumbBookPageIndex = visibleBookPageIndex(
        compiledBook,
        compiledBook
          ? findBookPageIndexForDocument(
              compiledBook,
              page.id,
              thumbIndex,
              isMurdokuModule
                ? {
                    murdokuPagePart: pageMdSettings?.core.twoPagePuzzles
                      ? 'scene'
                      : 'single',
                  }
                : undefined
            )
          : normalizePageNumberSettings(wordSearchSettings.typography.pageNumber).enabled
            ? 0
            : undefined
      );
      return isMurdokuModule ? (
        <MurdokuPageCanvas
          puzzle={thumb}
          settings={pageMdSettings ?? getDefaultMurdokuSettings()}
          layoutSettings={wordSearchSettings}
          showSolution={false}
          showMargins={showMargins}
          showSafetyZone={showSafetyZone}
          safetyMarginPx={safetyMarginPx}
          pagePart={pageMdSettings?.core.twoPagePuzzles ? 'scene' : 'single'}
          bookPageIndex={thumbBookPageIndex}
        />
      ) : (
    <GenericPuzzlePageCanvas
      puzzleType={page.moduleType}
          puzzle={thumb}
      settings={wordSearchSettings}
          titleWords={moduleSettings.titleWords ?? titleWords}
          showSolution={false}
      showMargins={showMargins}
      showSafetyZone={showSafetyZone}
      safetyMarginPx={safetyMarginPx}
      ptToPx={ptToPx}
          crosswordSettings={pageCwSettings}
          genericSettings={pageGpSettings}
          puzzleGridScale={puzzleGridScale}
          puzzleIndex={thumbIndex}
          bookPageIndex={thumbBookPageIndex}
          canvasEditEnabled={false}
        />
      );
    }

    // Multi puzzles per page: show the chunk containing the current puzzle.
    const puzzlePageChunk =
      isBatchModule && !batchShowSolution && batchPuzzlesPerPage > 1 && pageBatch.length > 0
        ? (() => {
            const chunkStart =
              Math.floor(batchLocalIndex / batchPuzzlesPerPage) * batchPuzzlesPerPage;
            return pageBatch.slice(chunkStart, chunkStart + batchPuzzlesPerPage);
          })()
        : null;

    if (isActiveGeneratedPuzzle) {
      const puzzleForCanvas = isBatchModule
        ? batchShowSolution
          ? batchSolutionChunk[0]
          : (puzzlePageChunk?.[0] ?? puzzleFromBatch)
        : currentPuzzle;
      const puzzleIndex = isBatchModule
        ? batchShowSolution
          ? (batchSolutionChunk[0]?.puzzleIndexInDocument ?? 0)
          : puzzlePageChunk
            ? (puzzlePageChunk[0]?.puzzleIndexInDocument ?? 0)
            : (puzzleFromBatch?.puzzleIndexInDocument ?? batchLocalIndex)
        : 0;
      const activeBookPageIndex = compiledBook
        ? batchShowSolution
          ? findBookPageIndexForSolution(
              compiledBook,
              page.id,
              page.id === activeDocumentPageId ? currentSolutionPageIndex : 0
            )
          : findBookPageIndexForDocument(
              compiledBook,
              page.id,
              puzzleIndex,
              isMurdokuModule ? { murdokuPagePart: murdokuPagePart } : undefined
            )
        : normalizePageNumberSettings(wordSearchSettings.typography.pageNumber).enabled
          ? 0
          : undefined;
      const visibleActiveBookPageIndex = visibleBookPageIndex(
        compiledBook,
        activeBookPageIndex
      );
      return isMurdokuModule ? (
        <MurdokuPageCanvas
          puzzle={puzzleForCanvas}
          settings={pageMdSettings ?? getDefaultMurdokuSettings()}
          layoutSettings={wordSearchSettings}
          showSolution={batchShowSolution}
          showMargins={showMargins}
          showSafetyZone={showSafetyZone}
          safetyMarginPx={safetyMarginPx}
          pagePart={murdokuPagePart}
          bookPageIndex={visibleActiveBookPageIndex}
        />
      ) : (
    <GenericPuzzlePageCanvas
      puzzleType={page.moduleType}
      puzzle={puzzleForCanvas}
      puzzles={
        batchShowSolution
          ? batchSolutionChunk
          : puzzlePageChunk ?? undefined
      }
      settings={wordSearchSettings}
          titleWords={moduleSettings.titleWords ?? titleWords}
      showSolution={batchShowSolution}
      showMargins={showMargins}
      showSafetyZone={showSafetyZone}
      safetyMarginPx={safetyMarginPx}
      ptToPx={ptToPx}
      crosswordSettings={pageCwSettings}
      genericSettings={pageGpSettings}
      puzzleGridScale={puzzleGridScale}
      puzzleIndex={puzzleIndex}
      bookPageIndex={visibleActiveBookPageIndex}
      canvasEditEnabled={
        (crosswordCanvasEditEnabled || genericPuzzleCanvasEditEnabled) &&
        page.id === activeDocumentPageId
      }
      canvasEditTarget={crosswordEditTarget}
      canvasEditHideGuides={crosswordEditHideGuides || genericPuzzleEditHideGuides}
      onCrosswordEditTargetChange={onCrosswordEditTargetChange}
      onGenericPuzzleEditTargetChange={onGenericPuzzleEditTargetChange}
    />
      );
    }

    return (
      <PuzzleModulePlaceholderCanvas
        page={page}
        wordSearchSettings={wordSearchSettings}
        showMargins={showMargins}
        showSafetyZone={showSafetyZone}
        safetyMarginPx={safetyMarginPx}
        ptToPx={ptToPx}
      />
    );
  }

  return (
    <TextPageCanvas
      page={page}
      settings={normalizeTextModuleSettings(page, page.settings as TextModuleSettings)}
      wordSearchSettings={wordSearchSettings}
      showMargins={showMargins}
      showSafetyZone={showSafetyZone}
      safetyMarginPx={safetyMarginPx}
      ptToPx={ptToPx}
      textEditEnabled={textEditEnabled && page.id === activeDocumentPageId}
      textEditTarget={textEditTarget}
      textEditHideGuides={textEditHideGuides}
      onTextEditTargetChange={onTextEditTargetChange}
      onSettingsChange={onTextSettingsChange}
    />
  );
}

function CompiledBookPageCanvas({
  compiledPage,
  compiledPages,
  documentPages,
  titleWords,
  wordSearchSettings,
  showMargins,
  showSafetyZone,
  safetyMarginPx,
  ptToPx,
  puzzleGridScale,
  titleToAnswerGap,
  solutionToSolutionGap,
  pageMargin,
  bookHeaderTitleFontSizePt,
}: {
  compiledPage: CompiledPage;
  compiledPages: CompiledPage[];
  documentPages: DocumentPage[];
  titleWords: TitleWordsSettings;
  wordSearchSettings: WordSearchSettings;
  showMargins: boolean;
  showSafetyZone: boolean;
  safetyMarginPx: number;
  ptToPx: (pt: number) => number;
  puzzleGridScale: number;
  titleToAnswerGap: number;
  solutionToSolutionGap: number;
  pageMargin: number;
  bookHeaderTitleFontSizePt?: number | null;
}) {
  const showPageNumber = shouldDrawBookPageNumber(
    compiledPage.bookPageIndex,
    compiledPages
  );

  if (compiledPage.kind === 'text') {
    const docPage =
      documentPages.find((doc) => doc.id === compiledPage.sourceDocumentId) ??
      ({
        id: compiledPage.sourceDocumentId,
        name: compiledPage.sourceDocumentName,
        moduleType: compiledPage.moduleType,
        settings: compiledPage.settings,
      } as DocumentPage);

    if (docPage.moduleType === 'title-page') {
      return (
        <TextPageBlockCanvas
          page={docPage}
          settings={compiledPage.settings}
          wordSearchSettings={wordSearchSettings}
          showMargins={showMargins}
          showSafetyZone={showSafetyZone}
          safetyMarginPx={safetyMarginPx}
          ptToPx={ptToPx}
        />
      );
    }

    if (docPage.moduleType === 'table-of-contents') {
      const tocPage = compiledPage as CompiledTextPage;
      return (
        <TocPageCanvas
          page={docPage}
          settings={{
            ...normalizeTextModuleSettings(docPage, docPage.settings as TextModuleSettings),
            tocPageIndex: tocPage.settings.tocPageIndex ?? 0,
            tocPageCount: tocPage.settings.tocPageCount ?? 1,
            tocTotalEntryCount:
              tocPage.settings.tocTotalEntryCount ?? tocPage.resolvedToc?.length,
          }}
          wordSearchSettings={wordSearchSettings}
          entries={tocPage.resolvedToc ?? []}
          totalEntryCount={
            tocPage.settings.tocTotalEntryCount ?? tocPage.resolvedToc?.length
          }
          bookPageIndex={tocPage.bookPageIndex}
          tocPageIndex={tocPage.settings.tocPageIndex ?? 0}
          tocPageCount={tocPage.settings.tocPageCount ?? 1}
          showMargins={showMargins}
          showSafetyZone={showSafetyZone}
          safetyMarginPx={safetyMarginPx}
          ptToPx={ptToPx}
        />
      );
    }

    return (
      <TextPageCanvas
        page={docPage}
        settings={compiledPage.settings}
        wordSearchSettings={wordSearchSettings}
        showMargins={showMargins}
        showSafetyZone={showSafetyZone}
        safetyMarginPx={safetyMarginPx}
        ptToPx={ptToPx}
        bookPageIndex={showPageNumber ? compiledPage.bookPageIndex : null}
      />
    );
  }

  // Crossword pages reuse the exact same canvas component as the sample preview,
  // so all-pages / 3D book / export snapshots match the editing canvas.
  if (compiledPage.kind === 'crossword' || compiledPage.kind === 'crossword-solution') {
    const isSolution = compiledPage.kind === 'crossword-solution';
    const docPage = documentPages.find((doc) => doc.id === compiledPage.sourceDocumentId);
    const docTitleWords =
      (docPage?.settings as PuzzleModuleSettings | undefined)?.titleWords ?? titleWords;
    const cwPuzzles = isSolution ? compiledPage.puzzles : [compiledPage.puzzle];

    return (
      <GenericPuzzlePageCanvas
        puzzleType="crossword"
        puzzle={cwPuzzles[0]}
        puzzles={isSolution ? cwPuzzles : undefined}
        settings={wordSearchSettings}
        titleWords={docTitleWords}
        showSolution={isSolution}
        showMargins={showMargins}
        showSafetyZone={showSafetyZone}
        safetyMarginPx={safetyMarginPx}
        ptToPx={ptToPx}
        crosswordSettings={compiledPage.crosswordSettings}
        puzzleGridScale={puzzleGridScale}
        puzzleIndex={
          isSolution
            ? (cwPuzzles[0]?.puzzleIndexInDocument ?? 0)
            : compiledPage.puzzleIndexInDocument
        }
        bookPageIndex={showPageNumber ? compiledPage.bookPageIndex : undefined}
        canvasEditEnabled={false}
      />
    );
  }

  // Sudoku / maze pages reuse the same canvas component as the sample preview.
  if (
    compiledPage.kind === 'generic-puzzle' ||
    compiledPage.kind === 'generic-puzzle-solution'
  ) {
    const isSolution = compiledPage.kind === 'generic-puzzle-solution';
    const docPage = documentPages.find((doc) => doc.id === compiledPage.sourceDocumentId);
    const docTitleWords =
      (docPage?.settings as PuzzleModuleSettings | undefined)?.titleWords ?? titleWords;
    const gpPuzzles = compiledPage.puzzles;

    return (
      <GenericPuzzlePageCanvas
        puzzleType={compiledPage.puzzleType}
        puzzle={gpPuzzles[0]}
        puzzles={isSolution || gpPuzzles.length > 1 ? gpPuzzles : undefined}
        settings={wordSearchSettings}
        titleWords={docTitleWords}
        showSolution={isSolution}
        showMargins={showMargins}
        showSafetyZone={showSafetyZone}
        safetyMarginPx={safetyMarginPx}
        ptToPx={ptToPx}
        genericSettings={compiledPage.genericSettings}
        puzzleIndex={
          isSolution
            ? (gpPuzzles[0]?.puzzleIndexInDocument ?? 0)
            : compiledPage.puzzleIndexInDocument
        }
        bookPageIndex={showPageNumber ? compiledPage.bookPageIndex : undefined}
        canvasEditEnabled={false}
      />
    );
  }

  if (compiledPage.kind === 'murdoku' || compiledPage.kind === 'murdoku-solution') {
    const isSolution = compiledPage.kind === 'murdoku-solution';
    const puzzle = isSolution ? compiledPage.puzzles[0] : compiledPage.puzzle;
    return (
      <MurdokuPageCanvas
        puzzle={puzzle}
        settings={compiledPage.murdokuSettings}
        layoutSettings={wordSearchSettings}
        showSolution={isSolution}
        showMargins={showMargins}
        showSafetyZone={showSafetyZone}
        safetyMarginPx={safetyMarginPx}
        bookPageIndex={showPageNumber ? compiledPage.bookPageIndex : undefined}
        pagePart={
          isSolution
            ? compiledPage.murdokuSettings.core.twoPagePuzzles
              ? 'scene'
              : 'single'
            : compiledPage.kind === 'murdoku'
              ? compiledPage.pagePart
              : 'single'
        }
      />
    );
  }

  if (compiledPage.kind === 'blank') {
    const dims = getPageDimensionsInches(wordSearchSettings);
  const pageWidthPt = dims.width * 72;
  const pageHeightPt = dims.height * 72;
  const widthPx = ptToPx(pageWidthPt);
  const heightPx = ptToPx(pageHeightPt);
    const marginPx = ptToPx(getPageMarginInches(wordSearchSettings) * 72);

  return (
    <div
        className="relative shadow-2xl border border-gray-300 select-none"
      style={{
        width: widthPx,
        height: heightPx,
        boxSizing: 'border-box',
          backgroundColor: wordSearchSettings.colors.puzzlePage.backgroundColor || '#ffffff',
        overflow: 'hidden',
      }}
    >
        {showMargins && (
          <div
            className="absolute border border-dashed border-blue-400 pointer-events-none z-50 opacity-40"
            style={{ left: marginPx, top: marginPx, right: marginPx, bottom: marginPx }}
          />
        )}
      {showSafetyZone && (
        <div
            className="absolute border border-dashed border-black pointer-events-none z-50 opacity-40"
          style={{
            left: safetyMarginPx,
            top: safetyMarginPx,
            right: safetyMarginPx,
            bottom: safetyMarginPx,
          }}
          />
        )}
        {showPageNumber && (
          <PageNumberOverlay
            settings={wordSearchSettings}
            bookPageIndex={compiledPage.bookPageIndex}
            pageWidthPt={pageWidthPt}
            pageHeightPt={pageHeightPt}
            ptToPx={ptToPx}
          />
        )}
      </div>
    );
  }

  if (compiledPage.kind === 'puzzle') {
    const pageWordSearchSettings = wordSearchSettings;
    const pageTitleWords = getTitleWordsForDocument(
      documentPages,
      compiledPage.sourceDocumentId,
      titleWords
    );

    return (
      <PuzzlePageCanvas
        puzzle={compiledPage.puzzle}
        settings={pageWordSearchSettings}
        titleWords={pageTitleWords}
        showSolution={false}
        showMargins={showMargins}
        showSafetyZone={showSafetyZone}
        safetyMarginPx={safetyMarginPx}
        ptToPx={ptToPx}
        puzzleGridScale={puzzleGridScale}
        bookHeaderTitleFontSizePt={bookHeaderTitleFontSizePt}
        bookPageIndex={showPageNumber ? compiledPage.bookPageIndex : undefined}
        pagePart={compiledPage.pagePart ?? 'clues'}
      />
    );
  }

  if (compiledPage.kind === 'solution') {
    const pageWordSearchSettings = compiledPage.wordSearchSettings;
    const pageTitleWords = getTitleWordsForDocument(
      documentPages,
      compiledPage.sourceDocumentId,
      titleWords
    );

    return (
      <SolutionsPageCanvas
        puzzles={compiledPage.puzzles}
        settings={pageWordSearchSettings}
        titleWords={pageTitleWords}
        pageIndex={0}
        bookPageIndex={showPageNumber ? compiledPage.bookPageIndex : undefined}
        showMargins={showMargins}
        showSafetyZone={showSafetyZone}
        safetyMarginPx={safetyMarginPx}
        ptToPx={ptToPx}
        titleToAnswerGap={titleToAnswerGap}
        solutionToSolutionGap={solutionToSolutionGap}
        pageMargin={pageMargin}
      />
    );
  }

  return null;
}

/** Renders a solution page with dynamic grid structure (1, 2, or 4 solution grids per page) */
function resolveSolutionBlockTitle(
  puzzle: WordSearchPuzzle,
  index: number,
  settings: WordSearchSettings,
  titleWords: TitleWordsSettings,
  answersPerPage: number,
  pageIndex: number
): string {
  const { typography } = settings;
        let baseTitle = '';
  let numberingStyle: 'none' | 'prefix' | 'suffix' = 'none';

        if (typography.solutionTitleStyle === 'same_as_puzzle') {
          switch (typography.selectTitleOption) {
            case 'puzzle-number':
            case 'one-custom-title':
              baseTitle = typography.titleText || titleWords.title || 'Word Search';
              break;
            case 'custom': {
              const lines = (typography.titleText || '')
                .split(/\r?\n/)
                .map((line) => line.trim())
                .filter(Boolean);
        baseTitle = getPuzzleContentLine(lines, puzzle, settings, true);
              break;
            }
            default:
              baseTitle = titleWords.title || 'Word Search';
          }
    numberingStyle = (typography.puzzleNumberingStyle as 'none' | 'prefix' | 'suffix') || 'none';
        } else {
          baseTitle = typography.customSolutionTitle || 'Solution';
    numberingStyle = (typography.solutionNumberingStyle as 'none' | 'prefix' | 'suffix') || 'none';
        }

  const puzzleNum = puzzle.puzzleNumber || pageIndex * answersPerPage + index + 1;
        if (baseTitle && numberingStyle !== 'none') {
    if (numberingStyle === 'prefix') return `${puzzleNum}. ${baseTitle}`;
    if (numberingStyle === 'suffix') return `${baseTitle} #${puzzleNum}`;
  }
  return baseTitle;
}

function SolutionsPageCanvas({
  puzzles,
  settings,
  titleWords,
  pageIndex,
  bookPageIndex,
  showMargins,
  showSafetyZone,
  safetyMarginPx,
  ptToPx,
  titleToAnswerGap,
  solutionToSolutionGap,
  pageMargin,
  canvasEditEnabled = false,
  canvasEditTarget = null,
  canvasEditHighlightTarget = null,
  canvasEditHideGuides = false,
  onCanvasEditTargetChange,
}: {
  puzzles: WordSearchPuzzle[];
  settings: WordSearchSettings;
  titleWords: TitleWordsSettings;
  pageIndex: number;
  bookPageIndex?: number;
  showMargins: boolean;
  showSafetyZone: boolean;
  safetyMarginPx: number;
  ptToPx: (pt: number) => number;
  titleToAnswerGap: number;
  solutionToSolutionGap: number;
  pageMargin: number;
  canvasEditEnabled?: boolean;
  canvasEditTarget?: CanvasEditTarget | null;
  canvasEditHighlightTarget?: CanvasEditTarget | null;
  canvasEditHideGuides?: boolean;
  onCanvasEditTargetChange?: (target: CanvasEditTarget | null) => void;
}) {
  const editHighlight = canvasEditHighlightTarget ?? canvasEditTarget;

  const { colors } = settings;
  const dims = getPageDimensionsInches(settings);
  const pageWidthPt = dims.width * 72;
  const pageHeightPt = dims.height * 72;
  const widthPx = ptToPx(pageWidthPt);
  const heightPx = ptToPx(pageHeightPt);
  const answersPerPage = settings.bookCanvas.answersPerPage || 1;
  const pageFrame = resolvePageFrameSettings(settings);

  const toPx = (pt: number) => {
    const px = ptToPx(Number.isFinite(pt) ? pt : 0);
    return Number.isFinite(px) ? px : 0;
  };

  const pagePuzzles = useMemo(
    () =>
      puzzles
        .filter(
          (puzzle) =>
            Array.isArray(puzzle.grid) &&
            puzzle.grid.length > 0 &&
            (puzzle.grid[0]?.length ?? 0) > 0
        )
        .slice(0, answersPerPage),
    [puzzles, answersPerPage]
  );

  const solutionLayout = useMemo(
    () =>
      computeSolutionPageLayout(
        pagePuzzles,
        settings,
        pageWidthPt,
        pageHeightPt,
        pageMargin,
        titleToAnswerGap,
        solutionToSolutionGap
      ),
    [
      pagePuzzles,
      settings,
      pageWidthPt,
      pageHeightPt,
      pageMargin,
      titleToAnswerGap,
      solutionToSolutionGap,
    ]
  );

  const paddingPt = cssPxToPoints(
    resolveSolutionGridBorder(settings.core).paddingPx
  );
  const solutionGridBorder = resolveSolutionGridBorder(settings.core);
  const borderCssPx = solutionGridBorder.strokeThicknessPx;

  const canvasHitZones = useMemo(() => {
    if (!canvasEditEnabled || pagePuzzles.length === 0) return null;

    const { blocks } = solutionLayout;
    const pageNumberSettings = normalizePageNumberSettings(settings.typography.pageNumber);
    const pageNumberLayout = pageNumberSettings.enabled
      ? computePageNumberLayout(
          pageWidthPt,
          pageHeightPt,
          settings,
          bookPageIndex,
          pageNumberSettings
        )
      : null;

    const blockZones = pagePuzzles.map((puzzle, index) => {
      const block = blocks[index];
      if (!block) return null;

      const titleSizePt = colors.answerPage.answerTitleFontSize || 20;
      const titleFontFamily =
        colors.answerPage.answerTitleFontFamily ||
        settings.typography.puzzleTitleFontFamily ||
        'Arial';
      const titleText = resolveSolutionBlockTitle(
        puzzle,
        index,
        settings,
        titleWords,
        answersPerPage,
        pageIndex
      );
      const titleMaxWidthPt = Math.max(1, block.widthPt - block.innerMarginPt * 2);
      const titleLayout = layoutSolutionBlockTitlePt(
        titleText,
        titleMaxWidthPt,
        titleSizePt,
        titleFontFamily,
        true
      );
      const titleBoxHeightPt = Math.max(
        titleLayout.lineHeightPt,
        titleLayout.lines.length * titleLayout.lineHeightPt
      );

      const outerBounds = computeGridBorderOuterBounds(
        block.gridLeftPt,
        block.gridTopPt,
        block.gridWidthPt,
        block.gridHeightPt,
        paddingPt,
        borderCssPx,
        settings.core.noBoxAroundPuzzle ?? false
      );

      return {
        title: {
          topPt: block.titleTopPt,
          leftPt: block.leftPt + block.innerMarginPt,
          widthPt: titleMaxWidthPt,
          heightPt: titleBoxHeightPt,
        },
        grid: {
          topPt: outerBounds.topPt,
          leftPt: outerBounds.leftPt,
          widthPt: outerBounds.widthPt,
          heightPt: outerBounds.heightPt,
        },
      };
    }).filter((zone): zone is NonNullable<typeof zone> => zone !== null);

    return { pageNumber: pageNumberLayout, blocks: blockZones };
  }, [
    canvasEditEnabled,
    pagePuzzles,
    solutionLayout,
    settings,
    titleWords,
    answersPerPage,
    pageIndex,
    pageWidthPt,
    pageHeightPt,
    bookPageIndex,
    colors.answerPage,
    paddingPt,
    borderCssPx,
  ]);

  if (pagePuzzles.length === 0) {
        return (
          <div
        className="relative shadow-2xl border border-gray-300 flex items-center justify-center text-slate-500 text-sm"
            style={{
          width: widthPx,
          height: heightPx,
              boxSizing: 'border-box',
          backgroundColor: colors.answerPage.backgroundColor || '#ffffff',
        }}
      >
        Generate puzzles to preview solutions
      </div>
    );
  }

  const { contentArea, blocks } = solutionLayout;
  const contentLeftPx = toPx(contentArea.leftPt);
  const contentTopPx = toPx(contentArea.topPt);
  const contentWidthPx = toPx(contentArea.widthPt);
  const contentHeightPx = toPx(contentArea.heightPt);

  return (
    <div
      className="relative shadow-2xl border border-gray-300 select-none transition-shadow duration-300 hover:shadow-3xl"
              style={{
        width: widthPx,
        height: heightPx,
        boxSizing: 'border-box',
        backgroundColor: colors.answerPage.backgroundColor || '#ffffff',
        overflow: 'hidden',
        isolation: 'isolate',
      }}
      onClick={() => {
        if (canvasEditEnabled) {
          onCanvasEditTargetChange?.('page-background');
        }
      }}
    >
      {colors.answerPage.backgroundImage && (
        <PageBackgroundImage
          src={colors.answerPage.backgroundImage}
          opacity={colors.answerPage.backgroundImageOpacity}
          fit={colors.answerPage.backgroundImageFit}
        />
      )}

      <PageFrameOverlay
        frame={pageFrame}
        pageBackgroundColor={colors.answerPage.backgroundColor || '#ffffff'}
        hasBackgroundImage={!!colors.answerPage.backgroundImage}
      />

      {showMargins && (
        <div
          className="absolute border border-dashed border-blue-400 pointer-events-none z-50 opacity-40 hover:opacity-100 transition-opacity duration-200"
          style={{
            left: contentLeftPx,
            top: contentTopPx,
            width: contentWidthPx,
            height: contentHeightPx,
          }}
        >
          <span className="absolute -top-4 left-0 text-[9px] font-bold text-blue-500 bg-white/95 px-1 rounded shadow-sm">
            Solution Margin
          </span>
            </div>
      )}

      {showSafetyZone && (
        <div
          className="absolute border border-dashed border-black pointer-events-none z-50 opacity-40 hover:opacity-100 transition-opacity duration-200"
          style={{
            left: safetyMarginPx,
            top: safetyMarginPx,
            right: safetyMarginPx,
            bottom: safetyMarginPx,
          }}
        >
          <span className="absolute -bottom-4 right-0 text-[9px] font-bold text-black bg-white/95 px-1 rounded shadow-sm">
            KDP Safe Zone
          </span>
        </div>
      )}

      {pagePuzzles.map((puzzle, index) => {
        const block = blocks[index];
        if (!block) return null;

        const titleSizePt = colors.answerPage.answerTitleFontSize || 20;
        const titleFontFamily =
          colors.answerPage.answerTitleFontFamily ||
          settings.typography.puzzleTitleFontFamily ||
          'Arial';
        const titleAlignment = colors.answerPage.answerTitleAlignment || 'center';
        const titleColor = colors.answerPage.titleColor || '#000000';
        const titleText = resolveSolutionBlockTitle(
          puzzle,
          index,
          settings,
          titleWords,
          answersPerPage,
          pageIndex
        );
        const titleMaxWidthPt = Math.max(1, block.widthPt - block.innerMarginPt * 2);
        const titleLayout = layoutSolutionBlockTitlePt(
          titleText,
          titleMaxWidthPt,
          titleSizePt,
          titleFontFamily,
          true
        );
        const titleBoxHeightPt = Math.max(
          titleLayout.lineHeightPt,
          titleLayout.lines.length * titleLayout.lineHeightPt
        );

        const cellSizePt = block.cellSizePt;
        const gridFontSizePt = getSolutionGridFontSize(settings.typography);

        const outerBounds = computeGridBorderOuterBounds(
          block.gridLeftPt,
          block.gridTopPt,
          block.gridWidthPt,
          block.gridHeightPt,
          paddingPt,
          borderCssPx,
          settings.core.noBoxAroundPuzzle ?? false
        );

        return (
          <div
            key={puzzle.puzzleNumber ?? `${pageIndex}-${index}`}
            style={{ position: 'absolute', inset: 0, zIndex: 2, pointerEvents: 'none' }}
          >
            <div
              style={{
                position: 'absolute',
                left: toPx(block.leftPt + block.innerMarginPt),
                top: toPx(block.titleTopPt),
                width: toPx(titleMaxWidthPt),
                height: toPx(titleBoxHeightPt),
                textAlign: titleAlignment,
                fontFamily: titleFontFamily,
                fontSize: toPx(titleLayout.fontSizePt),
                fontWeight: 700,
                color: titleColor,
                lineHeight: 1.1,
                whiteSpace: 'pre-wrap',
              }}
            >
              {titleLayout.lines.join('\n')}
            </div>

            <SolutionGridSnapshot
                puzzle={puzzle}
              settings={settings}
              cellSizePt={cellSizePt}
              gridFontSizePt={gridFontSizePt}
              leftPx={toPx(outerBounds.leftPt)}
              topPx={toPx(outerBounds.topPt)}
              widthPx={toPx(outerBounds.widthPt)}
              heightPx={toPx(outerBounds.heightPt)}
            />
          </div>
        );
      })}

      {typeof bookPageIndex === 'number' ? (
      <PageNumberOverlay
        settings={settings}
        bookPageIndex={bookPageIndex}
        pageWidthPt={pageWidthPt}
        pageHeightPt={pageHeightPt}
        ptToPx={ptToPx}
      />
      ) : null}

      {canvasHitZones && onCanvasEditTargetChange && (
        <>
          <CanvasHitZone
            active={editHighlight === 'page-background'}
            hideGuides={canvasEditHideGuides}
            label="Background"
            onSelect={() => onCanvasEditTargetChange?.('page-background')}
            style={{
              position: 'absolute',
              inset: 0,
              zIndex: 15,
            }}
          />
          {canvasHitZones.blocks.map((blockZone, blockIndex) => (
            <React.Fragment key={`solution-hit-${blockIndex}`}>
              <CanvasHitZone
                active={editHighlight === 'solution-title'}
                hideGuides={canvasEditHideGuides}
                label="Title"
                onSelect={() => onCanvasEditTargetChange?.('solution-title')}
                style={{
                  position: 'absolute',
                  top: toPx(blockZone.title.topPt),
                  left: toPx(blockZone.title.leftPt),
                  width: toPx(blockZone.title.widthPt),
                  height: toPx(blockZone.title.heightPt),
                  zIndex: 25,
                }}
              />
              <CanvasHitZone
                active={editHighlight === 'solution-grid'}
                hideGuides={canvasEditHideGuides}
                label="Grid"
                onSelect={() => onCanvasEditTargetChange?.('solution-grid')}
                style={{
                  position: 'absolute',
                  top: toPx(blockZone.grid.topPt),
                  left: toPx(blockZone.grid.leftPt),
                  width: toPx(blockZone.grid.widthPt),
                  height: toPx(blockZone.grid.heightPt),
                  zIndex: 25,
                }}
              />
            </React.Fragment>
          ))}
          {canvasHitZones.pageNumber && (
            <CanvasHitZone
              active={editHighlight === 'page-number'}
              hideGuides={canvasEditHideGuides}
              label="Page #"
              onSelect={() => onCanvasEditTargetChange?.('page-number')}
              style={{
                position: 'absolute',
                top: toPx(canvasHitZones.pageNumber.topPt),
                left: toPx(canvasHitZones.pageNumber.leftPt),
                width: toPx(canvasHitZones.pageNumber.widthPt),
                height: toPx(canvasHitZones.pageNumber.heightPt),
                zIndex: 26,
              }}
            />
          )}
        </>
      )}
    </div>
  );
}

/**
 * Canvas page for non-word-search puzzle categories.
 * Exported so PDF/PPT export can rasterize the identical markup (single source of truth).
 */
export function GenericPuzzlePageCanvas({
  puzzleType,
  puzzle,
  puzzles,
  settings,
  titleWords,
  showSolution,
  showMargins,
  showSafetyZone,
  safetyMarginPx,
  ptToPx,
  crosswordSettings,
  genericSettings,
  puzzleGridScale = 70,
  puzzleIndex = 0,
  bookPageIndex,
  canvasEditEnabled = false,
  canvasEditTarget = null,
  canvasEditHideGuides = false,
  onCrosswordEditTargetChange,
  onGenericPuzzleEditTargetChange,
  omitBackground = false,
  hidePageNumber = false,
}: {
  puzzleType: string;
  puzzle: any;
  /** When showing multi-per-page solutions (crossword / sudoku / maze). */
  puzzles?: any[];
  settings: WordSearchSettings;
  titleWords: TitleWordsSettings;
  showSolution: boolean;
  showMargins: boolean;
  showSafetyZone: boolean;
  safetyMarginPx: number;
  ptToPx: (pt: number) => number;
  crosswordSettings?: CrosswordSettings | null;
  genericSettings?: GenericPuzzleSettings | null;
  puzzleGridScale?: number;
  puzzleIndex?: number;
  /** Book page index for global page-number overlay (Style settings). */
  bookPageIndex?: number;
  canvasEditEnabled?: boolean;
  canvasEditTarget?: CrosswordEditTarget | null;
  canvasEditHideGuides?: boolean;
  onCrosswordEditTargetChange?: (target: CrosswordEditTarget) => void;
  onGenericPuzzleEditTargetChange?: (target: GenericPuzzleEditTarget) => void;
  /** Export: skip Style background layers (PPT keeps native slide background). */
  omitBackground?: boolean;
  /** Export: skip page-number overlay (PPT draws it as editable text). */
  hidePageNumber?: boolean;
}) {
  const { colors, typography } = settings;
  const cw =
    puzzleType === 'crossword'
      ? normalizeCrosswordSettings(crosswordSettings ?? getDefaultCrosswordSettings())
      : null;
  const gp = isGenericPuzzleModuleType(puzzleType)
    ? normalizeGenericPuzzleSettings(
        genericSettings ?? getDefaultGenericPuzzleSettings(puzzleType),
        puzzleType
      )
    : null;
  const dims = getPageDimensionsInches(settings);
  const pageWidthPt = dims.width * 72;
  const pageHeightPt = dims.height * 72;
  const widthPx = ptToPx(pageWidthPt);
  const heightPx = ptToPx(pageHeightPt);
  // Global Style settings drive the page frame for every puzzle type.
  const pageFrame = resolvePageFrameSettings(settings);
  const contentInsetPt = resolveGenericPageContentInsetPt(settings);
  const marginPx = ptToPx(contentInsetPt);
  const scaleFactor =
    (cw
      ? (showSolution ? cw.core.solutionGridScale : cw.core.puzzleGridScale) || 100
      : gp
        ? (showSolution ? gp.core.solutionGridScale : gp.core.puzzleGridScale) || 100
        : puzzleGridScale || 70) / 100;
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
  const solutionPuzzles =
    (cw || gp) && (showSolution || (gp && (gp.core.puzzlesPerPage || 1) > 1))
      ? puzzles && puzzles.length > 0
        ? puzzles
        : puzzle
          ? [puzzle]
          : []
      : [];
  const isTriviaSolution = puzzleType === 'trivia' && showSolution;
  const multiSolution = !isTriviaSolution && solutionPuzzles.length > 1;
  const solutionLayout = getSolutionGridLayout(
    Math.max(answersPerPage, solutionPuzzles.length || 1)
  );
  const multiShrink = multiSolution ? (answersPerPage >= 4 ? 0.45 : 0.62) : 1;
  const cellSize = cw
    ? crosswordFixedCellCssPx(cw, { showSolution, multiShrink })
    : 30;
  // Content area available for a single grid (used to auto-fit sudoku/maze).
  const contentWidthPx = Math.max(80, widthPx - marginPx * 2);
  const isTextPuzzleType =
    puzzleType === 'word-scramble' ||
    puzzleType === 'cryptogram' ||
    puzzleType === 'trivia';
  const contentHeightPx = Math.max(
    120,
    heightPx -
      marginPx * 2 -
      (multiSolution && isTextPuzzleType ? ptToPx(28) : ptToPx(120))
  );
  const solutionGapPx =
    cw?.typography.solutionToSolutionGapPx ??
    (puzzleType === 'word-scramble' && multiSolution
      ? ptToPx(gp?.typography.scrambleSpaceBetweenPuzzles ?? 18)
      : isTextPuzzleType && multiSolution
        ? ptToPx(12)
        : ptToPx(12));
  const headerAssemblyEnabled =
    !showSolution && isGlobalHeaderAssemblyEnabled(settings);
  const solutionTitleReservePx = multiSolution
    ? ptToPx(
        Math.max(
          10,
          (showSolution
            ? (cw?.typography.answerTitleFontSize ?? gp?.typography.answerTitleFontSize ?? 18)
            : (cw?.typography.puzzleTitleFontSize ?? gp?.typography.puzzleTitleFontSize ?? 24)) *
            (headerAssemblyEnabled ? 1.15 : 0.75)
        )
      ) + (headerAssemblyEnabled ? 16 : 12)
    : 0;
  /** Equal Width×Height frame for every maze/sudoku on a multi-solution page. */
  const multiSolutionFramePx = React.useMemo(() => {
    if (!multiSolution || !gp) return null;
    if (isTextPuzzleType) return null;
    const cols = Math.max(1, solutionLayout.columns);
    const rows = Math.max(1, solutionLayout.rows);
    const slotW = (contentWidthPx - solutionGapPx * (cols - 1)) / cols;
    const slotH =
      (contentHeightPx - solutionGapPx * (rows - 1)) / rows - solutionTitleReservePx;
    const side = Math.max(40, Math.floor(Math.min(slotW, slotH) * 0.96 * scaleFactor));
    return side;
  }, [
    multiSolution,
    gp,
    isTextPuzzleType,
    solutionLayout.columns,
    solutionLayout.rows,
    contentWidthPx,
    contentHeightPx,
    solutionGapPx,
    solutionTitleReservePx,
    scaleFactor,
  ]);
  /**
   * Word-scramble auto-fit:
   * - Clamp vertical word gap so content never hits the next title / safe area
   * - 2-up: scale to fill the page
   * - 4-up: shrink until each scramble row stays on one line
   */
  const scrambleFit = React.useMemo(() => {
    if (puzzleType !== 'word-scramble' || !gp) return null;
    const cols = multiSolution ? Math.max(1, solutionLayout.columns) : 1;
    const rows = multiSolution ? Math.max(1, solutionLayout.rows) : 1;
    const slotW = Math.max(60, (contentWidthPx - solutionGapPx * (cols - 1)) / cols - 8);
    const slotH = multiSolution
      ? (contentHeightPx - solutionGapPx * (rows - 1)) / rows - solutionTitleReservePx
      : contentHeightPx;

    const samplePuzzle = (solutionPuzzles[0] ?? puzzle) as
      | { words?: Array<{ original?: string; scrambled?: string } | string> }
      | null
      | undefined;
    const rawWords = Array.isArray(samplePuzzle?.words) ? samplePuzzle!.words! : [];
    const wordCount = Math.max(
      1,
      rawWords.length > 0 ? rawWords.length : gp.core.wordsPerPuzzle || 10
    );
    const longestChars = Math.max(
      6,
      ...rawWords.map((w) => {
        if (typeof w === 'string') return w.replace(/[\s-]/g, '').length;
        const src = String(w?.original || w?.scrambled || '');
        return src.replace(/[\s-]/g, '').length;
      }),
      8
    );

    const includeBank = !showSolution && (gp.core.includeWordBank ?? false);
    const baseFontPt = showSolution
      ? gp.typography.answerFontSize
      : gp.typography.puzzleFontSize;
    let fontPx = ptToPx(baseFontPt ?? 14) * (scaleFactor || 1);
    const letterEm = gp.typography.scrambleSpaceBetweenLetters ?? 0.12;
    const requestedWordGapPx = ptToPx(gp.typography.scrambleSpaceBetweenWords ?? 8);
    const lineFactor = gp.core.answerBlankStyle === 'boxes' ? 1.5 : 1.32;
    const bankReserve = includeBank ? fontPx * 2.8 : 0;
    const keepOneLine = multiSolution && answersPerPage >= 4;

    // 4-up: shrink font until longest "N. SCRAMBLE = _____…" fits one line.
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
      while (estimateWidth(fontPx) > slotW && fontPx > 7 && guard < 40) {
        fontPx *= 0.92;
        guard += 1;
      }
    }

    const lineH = fontPx * lineFactor;
    const gaps = Math.max(0, wordCount - 1);
    const fixedH = wordCount * lineH + bankReserve;
    // Max gap before content would hit the next title / slot bottom (safe area).
    const maxGapPx =
      gaps > 0 ? Math.max(0, (slotH * 0.98 - fixedH) / gaps) : requestedWordGapPx;
    let wordGapPx = Math.min(requestedWordGapPx, maxGapPx);

    // 2-up: if there's leftover room, grow font (and gap a little) to fill.
    // On solution pages keep fill milder so per-puzzle titles stay visible.
    if (multiSolution && answersPerPage === 2) {
      const used = fixedH + gaps * wordGapPx;
      const maxFill = showSolution ? 1.12 : 1.35;
      const fillScale = Math.min(maxFill, Math.max(1, (slotH * 0.96) / Math.max(1, used)));
      fontPx *= fillScale;
      const lineH2 = fontPx * lineFactor;
      const fixedH2 = wordCount * lineH2 + (includeBank ? fontPx * 2.8 : 0);
      const maxGap2 = gaps > 0 ? Math.max(0, (slotH * 0.98 - fixedH2) / gaps) : wordGapPx;
      wordGapPx = Math.min(Math.max(wordGapPx * fillScale, wordGapPx), maxGap2);
    }

    // 4-up vertical clamp after width fit.
    if (keepOneLine) {
      const used = wordCount * (fontPx * lineFactor) + gaps * wordGapPx + bankReserve;
      if (used > slotH * 0.98) {
        const s = (slotH * 0.98) / Math.max(1, used);
        fontPx *= s;
        wordGapPx *= s;
      }
    }

    return {
      fontSize: Math.max(7, fontPx),
      spaceBetweenWordsPx: Math.max(0, wordGapPx),
      spaceBetweenLettersEm: letterEm,
      maxWidthPx: slotW,
      keepRowsOnOneLine: keepOneLine,
      titleFontSizePt: Math.max(
        11,
        (showSolution
          ? gp.typography.answerTitleFontSize
          : gp.typography.puzzleTitleFontSize) *
          (keepOneLine ? 0.7 : showSolution ? 0.9 : 0.75)
      ),
    };
  }, [
    puzzleType,
    gp,
    multiSolution,
    solutionLayout.columns,
    solutionLayout.rows,
    contentWidthPx,
    contentHeightPx,
    solutionGapPx,
    solutionTitleReservePx,
    solutionPuzzles,
    puzzle,
    showSolution,
    answersPerPage,
    scaleFactor,
    ptToPx,
  ]);
  const genericCellSize = React.useMemo(() => {
    if (!gp || (puzzleType !== 'sudoku' && puzzleType !== 'maze')) return 0;
    if (puzzleType === 'maze' && multiSolutionFramePx) {
      // Cell size is derived per-puzzle inside MazeDisplay via frameSize.
      return multiSolutionFramePx;
    }
    const sudokuSize =
      puzzleType === 'sudoku'
        ? Math.max(
            4,
            Number(
              (puzzle as { size?: number } | undefined)?.size ??
                puzzle?.grid?.length ??
                9
            ) || 9
          )
        : 9;
    const gridCells =
      puzzleType === 'sudoku'
        ? sudokuSize
        : Math.max(puzzle?.grid?.length ?? 21, puzzle?.grid?.[0]?.length ?? 21);
    const fitBase = multiSolutionFramePx
      ? multiSolutionFramePx
      : Math.min(contentWidthPx, contentHeightPx);
    const fitPx = fitBase / gridCells;
    return Math.max(3, Math.floor(fitPx * 0.9 * (multiSolutionFramePx ? 1 : scaleFactor * multiShrink)));
  }, [
    gp,
    puzzleType,
    puzzle,
    contentWidthPx,
    contentHeightPx,
    scaleFactor,
    multiShrink,
    multiSolutionFramePx,
  ]);
  const puzzleToCluesGapPx = cw
    ? ptToPx((cw.typography.spaceBetweenPuzzleAndClues || 0.25) * 72)
    : undefined;

  const renderSingleGrid = (p: any, opts?: { hideClues?: boolean; cellSizeOverride?: number }) => {
    switch (puzzleType) {
      case 'sudoku':
        return (
          <div className="mx-auto flex justify-center w-fit max-w-full">
            <SudokuGrid
              puzzle={p}
              showSolution={showSolution}
              cellSize={
                gp
                  ? (() => {
                      const n = Math.max(
                        4,
                        Number(p?.size ?? p?.grid?.length ?? 9) || 9
                      );
                      if (multiSolutionFramePx) {
                        return Math.max(3, Math.floor(multiSolutionFramePx / n));
                      }
                      return genericCellSize;
                    })()
                  : 40
              }
              gridColor={gp?.colors.gridColor ?? '#1f2937'}
              difficultyPlacement={
                showSolution
                  ? 'none'
                  : (gp?.core.sudokuDifficultyPlacement ??
                    (gp?.core.showDifficultyLabel === false ? 'none' : 'bottom'))
              }
              fontSizePt={
                gp
                  ? (showSolution
                      ? gp.typography.answerFontSize
                      : gp.typography.puzzleFontSize) ?? 14
                  : undefined
              }
              lineThicknessPercent={
                showSolution
                  ? (gp?.core.sudokuSolutionLineThickness ?? 100)
                  : (gp?.core.sudokuPuzzleLineThickness ?? 100)
              }
            />
          </div>
        );
      case 'crossword':
        return (
          <CrosswordGrid
            puzzle={p}
            showSolution={showSolution}
            cellSize={opts?.cellSizeOverride ?? cellSize}
            crosswordSettings={cw}
            puzzleToCluesGapPx={puzzleToCluesGapPx}
            hideClues={opts?.hideClues || showSolution}
          />
        );
      case 'maze': {
        const isShapeMaze = gp?.core.mazeShape === 'custom_image' || Boolean(gp?.core.shapeMazeEnabled);
        const mazeShapeImageSrc = isShapeMaze && gp ? resolveShapeMaskImageSrc(gp.core, p?.puzzleIndexInDocument ?? puzzleIndex ?? 0) : undefined;
        return (
          <div className="mx-auto flex justify-center w-fit max-w-full">
            <MazeDisplay
              puzzle={p}
              showSolution={showSolution}
              cellSize={gp ? (multiSolutionFramePx ? 8 : genericCellSize) : 16}
              frameSize={
                puzzleType === 'maze' && multiSolutionFramePx
                  ? multiSolutionFramePx
                  : undefined
              }
              wallColor={gp?.colors.gridColor ?? '#1f2937'}
              solutionPathColor={gp?.colors.solutionPathColor ?? '#e11d48'}
              solutionPathThickness={gp?.core.mazeSolutionPathThickness ?? 34}
              solutionPathStyle={gp?.core.mazeSolutionPathStyle ?? 'solid'}
              wallThickness={gp?.core.mazeWallThickness ?? 45}
              markerStyle={gp?.core.mazeMarkerStyle ?? 'arrow'}
              startImage={gp?.core.mazeStartImage}
              endImage={gp?.core.mazeEndImage}
              shapeImageSrc={mazeShapeImageSrc}
              showShapeImage={gp?.core.shapeMaskShowImage}
              shapeImageFit={gp?.core.shapeMaskFit}
              shapeImageOpacity={(gp?.core.shapeMaskImageOpacity ?? 35) / 100}
            />
          </div>
        );
      }
      case 'cryptogram':
        return (
          <CryptogramDisplay
            puzzle={p}
            showSolution={showSolution}
            cipherFormat={gp?.core.cryptogramFormat ?? 'lines'}
            letterCase={gp?.core.letterCase ?? 'upper'}
            showLetterHints={!showSolution && (gp?.core.showLetterHints ?? true)}
            answerKeyLines={gp?.core.cryptogramAnswerKeyLines ?? 2}
            solutionOnlyAnswers={gp?.core.cryptogramSolutionOnlyAnswers ?? false}
            fontSize={ptToPx(
              (showSolution
                ? gp?.typography.answerFontSize
                : gp?.typography.puzzleFontSize) ?? 14
            ) * (scaleFactor * multiShrink)}
            fontFamily={
              showSolution
                ? (gp?.typography.answerFontFamily ?? gp?.typography.puzzleFontFamily ?? 'Arial')
                : (gp?.typography.puzzleFontFamily ?? 'Arial')
            }
            answerFontSize={
              ptToPx(gp?.typography.answerFontSize ?? 16) * (scaleFactor * multiShrink)
            }
            answerFontFamily={gp?.typography.answerFontFamily ?? 'Arial'}
            answerKeyFontSizePx={ptToPx(18) * (scaleFactor * multiShrink)}
            answerKeyFontFamily={gp?.typography.answerKeyFontFamily ?? 'Arial'}
            answerKeyGapPx={ptToPx(
              (gp?.typography.spaceBetweenAnswerKeyAndPuzzle ?? 0.25) * 72
            )}
            puzzleLineGapPx={ptToPx(gp?.typography.spaceBetweenPuzzleLines ?? 10)}
            textColor={gp?.colors.gridColor ?? '#1f2937'}
            maxWidthPx={contentWidthPx}
          />
        );
      case 'word-scramble':
        return (
          <WordScrambleDisplay
            puzzle={p}
            showSolution={showSolution}
            letterCase={gp?.core.letterCase ?? 'upper'}
            afterScrambled={gp?.core.afterScrambled ?? 'equal'}
            answerBlankStyle={gp?.core.answerBlankStyle ?? 'underline'}
            includeWordBank={!showSolution && (gp?.core.includeWordBank ?? false)}
            wordBankTitle={gp?.core.wordBankTitle ?? 'Word Bank'}
            fontSize={
              scrambleFit?.fontSize ??
              Math.max(
                10,
                ptToPx(
                  (showSolution
                    ? gp?.typography.answerFontSize
                    : gp?.typography.puzzleFontSize) ?? 14
                ) * (scaleFactor || 1)
              )
            }
            fontFamily={
              showSolution
                ? (gp?.typography.answerFontFamily ?? gp?.typography.puzzleFontFamily ?? 'Arial')
                : (gp?.typography.puzzleFontFamily ?? 'Arial')
            }
            textColor={gp?.colors.gridColor ?? '#1f2937'}
            maxWidthPx={scrambleFit?.maxWidthPx ?? contentWidthPx}
            spaceBetweenWordsPx={
              scrambleFit?.spaceBetweenWordsPx ??
              ptToPx(gp?.typography.scrambleSpaceBetweenWords ?? 8)
            }
            spaceBetweenLettersEm={
              scrambleFit?.spaceBetweenLettersEm ??
              gp?.typography.scrambleSpaceBetweenLetters ??
              0.12
            }
            keepRowsOnOneLine={scrambleFit?.keepRowsOnOneLine ?? false}
          />
        );
      case 'trivia': {
        const triviaGames =
          showSolution && solutionPuzzles.length > 0
            ? (solutionPuzzles as import('@/lib/puzzles/types').TriviaPuzzle[])
            : [p as import('@/lib/puzzles/types').TriviaPuzzle];
        const startNum = gp?.core.puzzlesStartingNumber ?? 1;
        const solutionSections = showSolution
          ? triviaGames.map((game, gi) => ({
              label: formatTriviaSolutionHeading(game, gi, startNum),
              answers: (game.questions ?? []).map((q) => resolveTriviaAnswerLabel(q)),
            }))
          : undefined;
        return (
          <TriviaDisplay
            puzzle={p}
            showSolution={showSolution}
            layoutFormat={gp?.core.triviaLayoutFormat ?? 'single-column'}
            checkboxStyle={gp?.core.triviaCheckboxStyle ?? 'circle'}
            suggestionsColumns={gp?.core.triviaSuggestionsColumns ?? 'single'}
            fontSize={
              Math.max(
                10,
                ptToPx(
                  (showSolution
                    ? gp?.typography.answerFontSize
                    : gp?.typography.puzzleFontSize) ?? 14
                ) *
                  (scaleFactor || 1)
              )
            }
            fontFamily={
              showSolution
                ? (gp?.typography.answerFontFamily ??
                    gp?.typography.puzzleFontFamily ??
                    'Arial')
                : (gp?.typography.puzzleFontFamily ?? 'Arial')
            }
            textColor={gp?.colors.gridColor ?? '#1f2937'}
            maxWidthPx={contentWidthPx}
            questionGapPx={ptToPx(
              showSolution
                ? (gp?.typography.triviaSolutionSpaceBetween ?? 12)
                : (gp?.typography.triviaSpaceBetweenQuestions ?? 18)
            )}
            suggestionGapPx={ptToPx(gp?.typography.triviaSpaceBetweenSuggestions ?? 6)}
            afterQuestionGapPx={ptToPx(gp?.typography.triviaSpaceAfterQuestion ?? 8)}
            solutionColumns={gp?.core.triviaSolutionColumns ?? 3}
            answersPerColumn={gp?.core.solutionsPerPage ?? 20}
            solutionSections={solutionSections}
            puzzlesStartingNumber={startNum}
          />
        );
      }
      case 'word-match':
        return <WordMatchDisplay puzzle={p} showSolution={showSolution} />;
      case 'dot-to-dot':
        return <DotToDotDisplay puzzle={p} showSolution={showSolution} />;
      default:
        return <div className="text-gray-400">Preview not supported for {puzzleType}</div>;
    }
  };

  const resolveTitleForIndex = (idx: number, forSolution: boolean) => {
    if (gp) {
      const puzzleForTitle =
        puzzleType === 'sudoku'
          ? solutionPuzzles.find((p) => (p?.puzzleIndexInDocument ?? -1) === idx) ??
            (Array.isArray(puzzles)
              ? puzzles.find((p) => (p?.puzzleIndexInDocument ?? -1) === idx)
              : null) ??
            (puzzle?.puzzleIndexInDocument === idx || puzzleIndex === idx ? puzzle : null) ??
            puzzle
          : null;
      const gpTitle = resolveGenericPuzzleTitle({
        typography: gp.typography,
        puzzleIndex: idx,
        puzzlesStartingNumber: gp.core.puzzlesStartingNumber,
        fallback:
          titleWords.title ||
          getGenericModuleDefaultTitle(puzzleType as GenericPuzzleModuleType),
        difficulty:
          puzzleType === 'sudoku'
            ? (puzzleForTitle as { difficulty?: string } | null)?.difficulty
            : undefined,
        difficultyPlacement:
          puzzleType === 'sudoku' ? gp.core.sudokuDifficultyPlacement : undefined,
      });
      if (forSolution) {
        return resolveGenericSolutionTitle({
          typography: gp.typography,
          puzzleTitle: gpTitle,
          puzzleIndex: idx,
          puzzlesStartingNumber: gp.core.puzzlesStartingNumber,
        });
      }
      return gpTitle;
    }
    if (!cw) return titleWords.title || puzzleType.toUpperCase();
    const puzzleTitle = resolveCrosswordPuzzleTitle({
      typography: cw.typography,
      puzzleIndex: idx,
      puzzlesStartingNumber: cw.core.puzzlesStartingNumber,
      fallback: titleWords.title || 'Crossword',
    });
    if (forSolution) {
      return resolveCrosswordSolutionTitle({
        typography: cw.typography,
        puzzleTitle,
        puzzleIndex: idx,
        puzzlesStartingNumber: cw.core.puzzlesStartingNumber,
        fallbackTitle: titleWords.title || 'Crossword',
      });
    }
    return puzzleTitle;
  };

  const puzzleTitle = cw || gp
    ? resolveTitleForIndex(puzzleIndex, false)
    : titleWords.title || puzzleType.toUpperCase();

  const titleText = cw || gp
    ? multiSolution || isTriviaSolution
      ? null
      : showSolution
        ? resolveTitleForIndex(puzzleIndex, true)
        : puzzleTitle
    : puzzleTitle;

  const subtitleText = cw && !showSolution ? resolveCrosswordSubtitle(cw.typography, puzzleIndex, settings.typography) : null;

  // Crossword / generic solutions use Layout → Answer Page title styling (same as
  // Word Search solution titles) — never Header Assembly colors (often white).
  const isCwSolution = !!cw && showSolution;
  const isGpSolution = !!gp && showSolution;
  const isSolutionPage = isCwSolution || isGpSolution;
  const rawSolutionTitleColor =
    colors.answerPage.titleColor ||
    gp?.colors.titleColor ||
    cw?.colors.titleColor ||
    colors.puzzlePage.titleColor ||
    '#1f2937';
  // Header Assembly often uses light text on dark shapes — that color must not
  // carry onto white solution pages or titles vanish (esp. word scramble).
  const solutionTitleLooksLight = /^#(?:fff(?:fff)?|f5f5f5|fafafa|ffffff)$/i.test(
    rawSolutionTitleColor.trim()
  );
  const titleColor = isSolutionPage
    ? solutionTitleLooksLight
      ? '#1f2937'
      : rawSolutionTitleColor
    : cw?.colors.titleColor ?? gp?.colors.titleColor ?? colors.puzzlePage.titleColor ?? '#333333';
  const subtitleColor =
    colors.puzzlePage.subtitleColor ||
    cw?.colors.subtitleColor ||
    '#6b7280';
  const subtitleFontSizePt =
    settings.typography.subtitleFontSize ||
    cw?.typography.subtitleFontSize ||
    14;
  const subtitleFontFamily =
    settings.typography.subtitleFontFamily ||
    cw?.typography.subtitleFontFamily ||
    settings.typography.puzzleTitleFontFamily ||
    cw?.typography.puzzleTitleFontFamily ||
    'Arial';
  const subtitleToTitleGapPt =
    settings.typography.subtitleToTitleGap != null
      ? settings.typography.subtitleToTitleGap
      : cw?.typography.subtitleToTitleGap != null
        ? (cw.typography.subtitleToTitleGap <= 2 ? cw.typography.subtitleToTitleGap * 72 : cw.typography.subtitleToTitleGap)
        : 10;
  const subtitleToPuzzleGapPt =
    settings.typography.subtitleToPuzzleGap != null
      ? settings.typography.subtitleToPuzzleGap
      : cw?.typography.subtitleToPuzzleGap != null
        ? (cw.typography.subtitleToPuzzleGap <= 2 ? cw.typography.subtitleToPuzzleGap * 72 : cw.typography.subtitleToPuzzleGap)
        : 10.8;
  const subtitleBoxMarginPt =
    settings.typography.subtitleBoxMargin != null
      ? settings.typography.subtitleBoxMargin
      : cw?.typography.subtitleBoxMargin != null
        ? (cw.typography.subtitleBoxMargin <= 2 ? cw.typography.subtitleBoxMargin * 72 : cw.typography.subtitleBoxMargin)
        : 0;
  const subtitleMaxWidthPercent =
    settings.typography.subtitleMaxWidthPercent ??
    cw?.typography.subtitleMaxWidthPercent ??
    100;
  const titleFont = isSolutionPage
    ? colors.answerPage.answerTitleFontFamily ||
      gp?.typography.puzzleTitleFontFamily ||
      cw?.typography.puzzleTitleFontFamily ||
      typography.puzzleTitleFontFamily ||
      'Arial'
    : cw?.typography.puzzleTitleFontFamily ??
      gp?.typography.puzzleTitleFontFamily ??
      typography.puzzleTitleFontFamily ??
      'Roboto';
  const titleSize = isCwSolution
    ? Math.max(
        10,
        colors.answerPage.answerTitleFontSize ||
          cw?.typography.answerTitleFontSize ||
          20
      )
    : isGpSolution
      ? Math.max(10, gp!.typography.answerTitleFontSize || 18)
      : (cw?.typography.puzzleTitleFontSize ??
          gp?.typography.puzzleTitleFontSize ??
          typography.puzzleTitleFontSize ??
          24);
  const pageBg = resolveGenericPageSurfaceColors(
    settings,
    showSolution,
    cw?.colors.backgroundColor ?? gp?.colors.backgroundColor
  );
  const bgColor = omitBackground ? 'transparent' : pageBg.backgroundColor;
  const showPageBackgroundImage = !omitBackground && !!pageBg.backgroundImage;
  const titleStartAtPx = cw
    ? ptToPx(cw.typography.titleStartAt * 72)
    : gp
      ? ptToPx(gp.typography.titleStartAt * 72)
      : marginPx;
  const titleGapPx = cw
    ? showSolution
      ? cw.typography.titleToAnswerGapPx ??
        ptToPx((cw.typography.spaceBetweenTitleAndAnswer ?? 0.3) * 72)
      : ptToPx(
          cw.typography.includeFunFacts && subtitleText
            ? (settings.typography.subtitleToPuzzleGap ?? (cw.typography.subtitleToPuzzleGap <= 2 ? cw.typography.subtitleToPuzzleGap * 72 : cw.typography.subtitleToPuzzleGap))
            : (cw.typography.spaceBetweenTitleAndPuzzle ?? 0.3) * 72
        )
    : gp
      ? ptToPx((gp.typography.spaceBetweenTitleAndPuzzle ?? 0) * 72)
      : undefined;
  const subtitleToPuzzleGapPx =
    subtitleText && !showSolution
      ? ptToPx(subtitleToPuzzleGapPt)
      : undefined;

  // Match Word Search: no persistent blue “active” overlay — hover outline only.
  const showCrosswordHits =
    puzzleType === 'crossword' &&
    canvasEditEnabled &&
    !!onCrosswordEditTargetChange;
  const showGenericHits =
    puzzleType !== 'crossword' &&
    canvasEditEnabled &&
    !!onGenericPuzzleEditTargetChange;

  const titleAlign: 'left' | 'center' | 'right' = isSolutionPage
    ? colors.answerPage.answerTitleAlignment || 'center'
    : gp?.typography.puzzleTitleAlign === 'left'
      ? 'left'
      : 'center';

  // Full-page header only for single-puzzle pages; multi-per-page uses
  // Header Assembly on each puzzle title block instead.
  // Trivia solutions use in-content "Trivia #N" headings instead.
  // Crossword / generic solutions never use Header Assembly (Word Search style).
  const usePageHeaderAssembly =
    headerAssemblyEnabled && !multiSolution && !isTriviaSolution && !showSolution;

  const headerTitleParts =
    usePageHeaderAssembly && gp
      ? resolveGenericPuzzleTitleParts({
          typography: gp.typography,
          puzzleIndex,
          puzzlesStartingNumber: gp.core.puzzlesStartingNumber,
          fallback:
            titleWords.title ||
            getGenericModuleDefaultTitle(puzzleType as GenericPuzzleModuleType),
        })
      : usePageHeaderAssembly && cw
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
            // Only strip auto-added numbering — keep digits typed into custom titles
            // (e.g. "1. title" with Puzzle Numbering Style = None).
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
              combined,
            };
          })()
        : null;

  const headerAssembly = usePageHeaderAssembly
    ? buildGenericHeaderAssembly({
        settings,
        pageWidthPt,
        titleText: headerTitleParts
          ? headerTitleParts.titleText
          : titleText || puzzleTitle || '',
        numberText: headerTitleParts?.numberText || '',
        titleFontSizePt: titleSize,
        titleColor,
        subtitleText: subtitleText || '',
        subtitleFontSizePt,
        subtitleColor,
        subtitleFontFamily,
        subtitleToTitleGapPt,
        subtitleBoxMarginPt,
        subtitleMaxWidthPercent,
      })
    : null;

  const multiHeaderSettings =
    headerAssemblyEnabled && multiSolution && !showSolution
      ? getHeaderAssemblySettings(settings)
      : null;
  const multiHeaderTitleSizePt = Math.max(
    9,
    scrambleFit?.titleFontSizePt ?? titleSize * (answersPerPage >= 4 ? 0.55 : 0.7)
  );
  const multiHeaderWidthPt = Math.max(
    48,
    ((contentWidthPx - solutionGapPx * (Math.max(1, solutionLayout.columns) - 1)) /
      Math.max(1, solutionLayout.columns)) *
      (72 / 96)
  );

  const rawContentTopPx = headerAssembly
    ? ptToPx(headerAssembly.topPt + headerAssembly.heightPt) + (subtitleText ? ptToPx(subtitleToPuzzleGapPt) : (titleGapPx ?? ptToPx(12)))
    : isSolutionPage
      ? marginPx + ptToPx(6)
      : multiSolution && isTextPuzzleType
        ? marginPx + ptToPx(6)
        : Number.isFinite(titleStartAtPx)
          ? titleStartAtPx
          : marginPx;
  // If Header Assembly geometry lands off-page (bad units / huge offset), fall back
  // so text puzzles stay under the title instead of docking at the bottom.
  const midPagePx = heightPx * 0.5;
  const contentTopPx = Math.max(
    marginPx,
    Number.isFinite(rawContentTopPx) && rawContentTopPx < midPagePx
      ? rawContentTopPx
      : Number.isFinite(titleStartAtPx)
        ? titleStartAtPx
        : marginPx
  );

  const isTextPuzzle =
    puzzleType === 'word-scramble' ||
    puzzleType === 'cryptogram' ||
    puzzleType === 'trivia';

  // Maze / sudoku: always centre grids horizontally (1-up and multi-up).
  const isSudokuOrMaze = puzzleType === 'sudoku' || puzzleType === 'maze';
  // Maze / sudoku 1-up: title→grid gap packs under the title (0 = flush).
  const centerSingleGrid = !multiSolution && isSudokuOrMaze;
  const contentAreaHeightPx = Math.max(0, heightPx - contentTopPx - marginPx);
  const titleBlockBudgetPx =
    centerSingleGrid && !headerAssembly && titleText
      ? ptToPx(titleSize) * 1.25 + (titleGapPx ?? 0)
      : 0;
  const singleGridBudgetPx = centerSingleGrid
    ? Math.max(64, contentAreaHeightPx - titleBlockBudgetPx)
    : 0;

  const crosswordPuzzlePage = puzzleType === 'crossword' && !showSolution && !multiSolution;
  const crosswordPageNumberZoneTopPx = crosswordPuzzlePage
    ? ptToPx(resolveCrosswordPageNumberZoneTopPt(pageWidthPt, pageHeightPt, settings))
    : null;
  const crosswordGridCols = Math.max(1, puzzle?.grid?.[0]?.length ?? 0);
  const crosswordGridRows = Math.max(0, puzzle?.grid?.length ?? 0);
  const crosswordTitleBlockPx = crosswordPuzzlePage
    ? (!headerAssembly && titleText ? ptToPx(titleSize) * 1.2 + (titleGapPx ?? 0) : 0) +
      (!headerAssembly && subtitleText
        ? ptToPx(cw?.typography.subtitleFontSize ?? 12) * 1.3 + (subtitleToPuzzleGapPx ?? 0)
        : 0) +
      4
    : 0;
  const crosswordCellPx =
    crosswordPuzzlePage && crosswordGridRows > 0 && crosswordPageNumberZoneTopPx != null
      ? Math.min(
          cellSize,
          contentWidthPx / Math.max(1, crosswordGridCols),
          Math.max(8, crosswordPageNumberZoneTopPx - contentTopPx - crosswordTitleBlockPx) /
            crosswordGridRows
        )
      : cellSize;
  const crosswordGridHeightPx = crosswordPuzzlePage ? crosswordGridRows * crosswordCellPx : 0;

  return (
    <div
      className="relative shadow-2xl border border-gray-300 select-none transition-shadow duration-300 hover:shadow-3xl"
      style={{
        width: widthPx,
        height: heightPx,
        boxSizing: 'border-box',
        backgroundColor: bgColor,
        overflow: 'hidden',
      }}
    >
      {showPageBackgroundImage && pageBg.backgroundImage ? (
        <PageBackgroundImage
          src={pageBg.backgroundImage}
          opacity={pageBg.backgroundImageOpacity}
          fit={pageBg.backgroundImageFit}
        />
      ) : null}
      {!omitBackground ? (
        <PageFrameOverlay
          frame={pageFrame}
          pageBackgroundColor={bgColor === 'transparent' ? '#ffffff' : bgColor}
          hasBackgroundImage={showPageBackgroundImage}
        />
      ) : null}
      {showMargins && (
        <div
          className="absolute border border-dashed border-blue-400 pointer-events-none z-50 opacity-40"
          style={{
            left: marginPx,
            top: marginPx,
            right: marginPx,
            bottom: marginPx,
          }}
        />
      )}
      {showSafetyZone && (
        <div
          className="absolute border border-dashed border-black pointer-events-none z-50 opacity-40"
          style={{
            left: safetyMarginPx,
            top: safetyMarginPx,
            right: safetyMarginPx,
            bottom: safetyMarginPx,
          }}
        />
      )}

      {headerAssembly ? (
        <div
          style={{
            position: 'absolute',
            top: ptToPx(headerAssembly.topPt),
            left: ptToPx(headerAssembly.leftPt),
            width: ptToPx(headerAssembly.widthPt),
            maxWidth: ptToPx(headerAssembly.widthPt),
            overflow: 'hidden',
            zIndex: 2,
          }}
        >
          <HeaderAssemblyBar
            parts={headerAssembly.parts}
            settings={headerAssembly.settings}
            headerWidthPt={headerAssembly.widthPt}
            titleFontSizePt={headerAssembly.titleFontSizePt}
            subtitleFontSizePt={headerAssembly.subtitleFontSizePt}
            subtitleLines={headerAssembly.subtitleLines}
            titleColor={headerAssembly.titleColor}
            subtitleColor={headerAssembly.subtitleColor}
            fontFamily={headerAssembly.fontFamily}
            subtitleFontFamily={headerAssembly.subtitleFontFamily}
            subtitleTextWidthPt={headerAssembly.subtitleTextWidthPt}
            ptToPx={ptToPx}
          />
        </div>
      ) : null}

      <div
        className="absolute flex flex-col items-center"
        style={{
          left: marginPx,
          top: contentTopPx,
          right: marginPx,
          bottom:
            crosswordPageNumberZoneTopPx != null
              ? Math.max(0, heightPx - crosswordPageNumberZoneTopPx)
              : marginPx,
          zIndex: 20,
          // Maze/sudoku 1-up: centre the title+grid block on the page while
          // keeping title→grid gap (including 0 = flush).
          justifyContent: centerSingleGrid
            ? 'center'
            : cw || gp
              ? 'flex-start'
              : 'center',
          minHeight: 0,
          overflow: 'hidden',
        }}
      >
        {centerSingleGrid ? (
          <div
            className="flex flex-col items-center w-full min-h-0"
            style={{ maxHeight: '100%' }}
          >
            {!headerAssembly && titleText ? (
              <h2
                className="font-bold relative w-full shrink-0"
                style={{
                  fontSize: ptToPx(titleSize),
                  color: titleColor,
                  fontFamily: titleFont,
                  marginBottom: titleGapPx ?? 0,
                  textAlign: titleAlign,
                  lineHeight: 1.2,
                }}
              >
                {titleText}
              </h2>
            ) : null}
            {!headerAssembly && subtitleText ? (
              <p
                className="text-center shrink-0"
                style={{
                  fontSize: ptToPx(subtitleFontSizePt),
                  fontFamily: subtitleFontFamily,
                  color: subtitleColor,
                  marginTop: ptToPx(subtitleToTitleGapPt),
                  marginBottom: ptToPx(subtitleToPuzzleGapPt),
                  paddingLeft: ptToPx(subtitleBoxMarginPt),
                  paddingRight: ptToPx(subtitleBoxMarginPt),
                  maxWidth: `${subtitleMaxWidthPercent}%`,
                  lineHeight: 1.25,
                  whiteSpace: 'pre-wrap',
                }}
              >
                {subtitleText}
              </p>
            ) : null}
            <div
              className="w-full min-w-0 overflow-hidden"
              style={{
                height: singleGridBudgetPx,
                maxHeight: singleGridBudgetPx,
              }}
            >
              {puzzle ? (
                <FitToSafeArea originX="center" originY="top">
                  {renderSingleGrid(puzzle, { hideClues: showSolution })}
                </FitToSafeArea>
              ) : (
                <div className="text-slate-500 text-sm">Generate puzzles to preview.</div>
              )}
            </div>
          </div>
        ) : (
          <>
        {!headerAssembly && titleText ? (
        <h2
            className="font-bold relative w-full"
          style={{
              flexShrink: 0,
              minHeight: ptToPx(titleSize) * 1.2,
              fontSize: ptToPx(titleSize),
              color: titleColor,
              fontFamily: titleFont,
              marginBottom: titleGapPx ?? undefined,
              textAlign: titleAlign,
              fontWeight: 700,
              zIndex: 2,
          }}
        >
          {titleText}
        </h2>
        ) : null}
        {!headerAssembly && subtitleText ? (
          <p
            className="text-center shrink-0"
            style={{
              fontSize: ptToPx(subtitleFontSizePt),
              fontFamily: subtitleFontFamily,
              color: subtitleColor,
              marginTop: ptToPx(subtitleToTitleGapPt),
              marginBottom: ptToPx(subtitleToPuzzleGapPt),
              paddingLeft: ptToPx(subtitleBoxMarginPt),
              paddingRight: ptToPx(subtitleBoxMarginPt),
              maxWidth: `${subtitleMaxWidthPercent}%`,
              lineHeight: 1.25,
              whiteSpace: 'pre-wrap',
            }}
          >
            {subtitleText}
          </p>
        ) : null}

        {multiSolution ? (
          <div
            className="flex-1 w-full max-h-full overflow-hidden"
            style={{
              display: 'grid',
              gridTemplateColumns: `repeat(${solutionLayout.columns}, minmax(0, 1fr))`,
              gridTemplateRows: `repeat(${solutionLayout.rows}, minmax(0, 1fr))`,
              gap: solutionGapPx,
              padding: Math.max(
                0,
                (cw?.typography.solutionPageMarginPx ?? 40) - 40
              ),
              alignItems: isTextPuzzle ? 'stretch' : 'center',
              justifyItems: isTextPuzzle ? 'stretch' : 'center',
              boxSizing: 'border-box',
            }}
          >
            {solutionPuzzles.map((sp, i) => {
              const idx = sp.puzzleIndexInDocument ?? puzzleIndex + i;
              const blockTitle = resolveTitleForIndex(idx, showSolution);
              const blockTitleSizePt = isSolutionPage
                ? Math.max(11, isCwSolution ? titleSize : scrambleFit?.titleFontSizePt ?? titleSize)
                : scrambleFit?.titleFontSizePt ?? Math.max(10, titleSize * 0.75);
              const blockHeaderParts = multiHeaderSettings
                ? gp
                  ? resolveGenericPuzzleTitleParts({
                      typography: gp.typography,
                      puzzleIndex: idx,
                      puzzlesStartingNumber: gp.core.puzzlesStartingNumber,
                      fallback:
                        titleWords.title ||
                        getGenericModuleDefaultTitle(
                          puzzleType as GenericPuzzleModuleType
                        ),
                      difficulty:
                        puzzleType === 'sudoku'
                          ? (sp as { difficulty?: string })?.difficulty
                          : undefined,
                      difficultyPlacement:
                        puzzleType === 'sudoku'
                          ? gp.core.sudokuDifficultyPlacement
                          : undefined,
                    })
                  : cw
                    ? (() => {
                        const number = cw.core.puzzlesStartingNumber + idx;
                        const style = cw.typography.puzzleNumberingStyle;
                        const combined = resolveCrosswordPuzzleTitle({
                          typography: cw.typography,
                          puzzleIndex: idx,
                          puzzlesStartingNumber: cw.core.puzzlesStartingNumber,
                          fallback: titleWords.title || 'Crossword',
                        });
                        const numberText =
                          style === 'prefix'
                            ? String(number)
                            : style === 'suffix'
                              ? `#${number}`
                              : '';
                        // Keep custom title numbers when numbering style is None.
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
                          combined,
                        };
                      })()
                    : null
                : null;

              return (
                <div
                  key={`cw-sol-${idx}-${i}`}
                  className={
                    isTextPuzzle
                      ? 'flex flex-col items-center justify-start w-full h-full min-w-0 min-h-0 overflow-hidden px-1'
                      : 'flex flex-col items-center justify-start w-full h-full min-w-0 min-h-0 overflow-hidden'
                  }
                >
                  {multiHeaderSettings && blockHeaderParts ? (
                    <div
                      className="shrink-0 mb-1 w-full"
                      style={{
                        maxWidth: '100%',
                        alignSelf: titleAlign === 'left' ? 'stretch' : 'center',
                      }}
                    >
                      <HeaderAssemblyBar
                        parts={{
                          numberText: blockHeaderParts.numberText,
                          titleText: blockHeaderParts.titleText,
                          subtitleText: '',
                          showNumber: blockHeaderParts.showNumber,
                        }}
                        settings={multiHeaderSettings}
                        headerWidthPt={multiHeaderWidthPt}
                        titleFontSizePt={multiHeaderTitleSizePt}
                        subtitleFontSizePt={Math.max(8, multiHeaderTitleSizePt * 0.65)}
                        subtitleLines={[]}
                        titleColor={titleColor}
                        subtitleColor={subtitleColor}
                        fontFamily={titleFont}
                        subtitleFontFamily={titleFont}
                        subtitleTextWidthPt={multiHeaderWidthPt}
                        ptToPx={ptToPx}
                      />
                    </div>
                  ) : blockTitle ? (
                    <h3
                      className="font-bold mb-1 w-full"
                      style={{
                        flexShrink: 0,
                        minHeight: ptToPx(blockTitleSizePt) * 1.25,
                        fontSize: ptToPx(blockTitleSizePt),
                        color: titleColor,
                        fontFamily: titleFont,
                        lineHeight: 1.2,
                        textAlign: titleAlign,
                        fontWeight: 700,
                        position: 'relative',
                        zIndex: 2,
                      }}
                    >
                      {blockTitle}
                    </h3>
                  ) : null}
                  <div
                    className={
                      isTextPuzzle
                        ? 'flex-1 flex items-start justify-center w-full min-w-0 min-h-0 overflow-hidden'
                        : 'flex-1 flex items-center justify-center min-w-0 min-h-0 overflow-hidden w-full'
                    }
                  >
                    <FitToSafeArea
                      originX="center"
                      originY="top"
                      fillWidth={isTextPuzzle}
                    >
                      {renderSingleGrid(sp, { hideClues: true, cellSizeOverride: cellSize })}
                    </FitToSafeArea>
                  </div>
    </div>
  );
            })}
          </div>
        ) : puzzleType === 'crossword' && !showSolution && puzzle ? (
          <div
            className="flex flex-col w-full min-w-0 min-h-0 flex-1 overflow-hidden pt-1"
            style={{ width: '100%', alignSelf: 'stretch' }}
          >
            <div
              className="shrink-0 w-full flex justify-center overflow-hidden"
              style={{ height: crosswordGridHeightPx }}
            >
              {renderSingleGrid(puzzle, { hideClues: true, cellSizeOverride: crosswordCellPx })}
            </div>
            <div
              className="w-full min-w-0 min-h-0 flex-1 overflow-hidden"
              style={{
                marginTop: puzzleToCluesGapPx ?? 0,
              }}
            >
              <CrosswordClueLists
                puzzle={puzzle}
                crosswordSettings={cw}
                fillHeight
              />
            </div>
          </div>
        ) : (
          <div
            className="flex-1 flex items-start justify-center w-full min-w-0 min-h-0 overflow-hidden pt-1"
            style={{
              width: '100%',
              alignSelf: 'stretch',
            }}
          >
            {puzzle ? (
              <FitToSafeArea
                originX={
                  puzzleType === 'trivia' && showSolution ? 'left' : 'center'
                }
                originY="top"
                fillWidth={
                  puzzleType === 'word-scramble' ||
                  puzzleType === 'cryptogram' ||
                  puzzleType === 'trivia'
                }
              >
                {renderSingleGrid(puzzle, { hideClues: showSolution })}
              </FitToSafeArea>
            ) : (
              <div className="text-slate-500 text-sm">Generate puzzles to preview.</div>
            )}
          </div>
        )}
          </>
        )}
      </div>

      {showCrosswordHits ? (
        <>
          <CanvasHitZone
            active={false}
            hideGuides={canvasEditHideGuides}
            label="Background"
            onSelect={() => onCrosswordEditTargetChange?.('page-frame')}
            style={{ position: 'absolute', inset: 0, zIndex: 15 }}
          />
          <CanvasHitZone
            active={false}
            hideGuides={canvasEditHideGuides}
            label={showSolution ? 'Solutions' : 'Title'}
            onSelect={() =>
              onCrosswordEditTargetChange?.(showSolution ? 'solutions' : 'title')
            }
            style={{
              position: 'absolute',
              top: titleStartAtPx,
              left: marginPx,
              right: marginPx,
              height: ptToPx(titleSize) + 16,
              zIndex: 25,
            }}
          />
          <CanvasHitZone
            active={false}
            hideGuides={canvasEditHideGuides}
            label={showSolution ? 'Solution Grid' : 'Grid'}
            onSelect={() =>
              onCrosswordEditTargetChange?.(showSolution ? 'solutions' : 'numbering')
            }
            style={{
              position: 'absolute',
              top: titleStartAtPx + ptToPx(titleSize) + (titleGapPx ?? 12) + 24,
              left: marginPx,
              right: marginPx,
              height: crosswordPuzzlePage
                ? crosswordGridHeightPx
                : undefined,
              bottom: crosswordPuzzlePage
                ? undefined
                : showSolution
                  ? marginPx
                  : heightPx * 0.42,
              zIndex: 25,
            }}
          />
          {!showSolution ? (
            <CanvasHitZone
              active={false}
              hideGuides={canvasEditHideGuides}
              label="Clues"
              onSelect={() => onCrosswordEditTargetChange?.('clues')}
              style={{
                position: 'absolute',
                left: marginPx,
                right: marginPx,
                top: crosswordPuzzlePage
                  ? titleStartAtPx +
                    ptToPx(titleSize) +
                    (titleGapPx ?? 12) +
                    24 +
                    crosswordGridHeightPx +
                    (puzzleToCluesGapPx ?? 0)
                  : undefined,
                bottom:
                  crosswordPageNumberZoneTopPx != null
                    ? Math.max(0, heightPx - crosswordPageNumberZoneTopPx)
                    : marginPx,
                height: crosswordPuzzlePage ? undefined : heightPx * 0.38,
                zIndex: 25,
              }}
            />
          ) : null}
        </>
      ) : null}

      {showGenericHits ? (
        <>
          <CanvasHitZone
            active={false}
            hideGuides={canvasEditHideGuides}
            label="Background"
            onSelect={() => onGenericPuzzleEditTargetChange?.('page-frame')}
            style={{ position: 'absolute', inset: 0, zIndex: 15 }}
          />
          <CanvasHitZone
            active={false}
            hideGuides={canvasEditHideGuides}
            label="Title"
            onSelect={() => onGenericPuzzleEditTargetChange?.('title')}
            style={{
              position: 'absolute',
              top: headerAssembly ? ptToPx(headerAssembly.topPt) : titleStartAtPx,
              left: marginPx,
              right: marginPx,
              height: headerAssembly
                ? ptToPx(headerAssembly.heightPt)
                : ptToPx(titleSize) + 16,
              zIndex: 25,
            }}
          />
        </>
      ) : null}

      {typeof bookPageIndex === 'number' && !hidePageNumber ? (
        <PageNumberOverlay
          settings={settings}
          bookPageIndex={bookPageIndex}
          pageWidthPt={pageWidthPt}
          pageHeightPt={pageHeightPt}
          ptToPx={ptToPx}
        />
      ) : null}
    </div>
  );
}

function compiledSolutionPuzzles(
  page: CompiledPage
): { puzzleIndexInDocument?: number; id?: string }[] {
  if (!isCompiledSolutionKind(page.kind)) return [];
  if ('puzzles' in page && Array.isArray(page.puzzles)) {
    return page.puzzles as { puzzleIndexInDocument?: number; id?: string }[];
  }
  return [];
}

export function PreviewCanvas() {
  const {
    setPanelProps: setCanvasEditPanelProps,
    setCrosswordPanelProps,
    setGenericPuzzlePanelProps,
    selectedTextBlockId,
    textPageEditTarget,
    textPageBlockChromeVisible,
    selectTextBlock,
    changeTextPageEditTarget,
    hideTextBlockChrome,
    setTocEntries,
  } = useCanvasEditPanel();
  const {
    currentPuzzle,
    currentPuzzleType,
    showSolution,
    titleWords,
    wordSearchSettings,
    crosswordSettings,
    updateCrosswordSettings,
    genericPuzzleSettings,
    updateGenericPuzzleSettings,
    murdokuSettings,
    batchPuzzles,
    crosswordBatchPuzzles,
    genericBatchPuzzles,
    murdokuBatchPuzzles,
    currentBatchIndex,
    setCurrentBatchIndex,
    previewZoom,
    setPreviewZoom,
    puzzleGridScale,
    pageOverrides,
    setPageOverrides,
    applyMode,
    triggerStylingUpdate,
    pagePuzzleGridScales,
    setPagePuzzleGridScale,
    clearPagePuzzleGridScale,
    clearAllPagePuzzleGridScales,
    pageCrosswordOverrides,
    setPageCrosswordOverrides,
    pageGenericOverrides,
    setPageGenericOverrides,
    titleToAnswerGap,
    solutionToSolutionGap,
    pageMargin,
    validationError,
    clearValidationError,
    previewRangeMode,
    setPreviewRangeMode,
    activePreviewTab,
    setActivePreviewTab,
    documentPages,
    activeDocumentPageId,
    setActiveDocumentPageId,
    bookSettings,
    insertDocumentPage,
    insertSeparatorTitlePageAfter,
    removeCompiledBookPage,
    removeDocumentPage,
    duplicateDocumentPage,
    reorderDocumentPages,
    updateDocumentPage,
    puzzleGenerationVersion,
    updateWordSearchSettings,
    setTitleWords,
    setPuzzleGridScale,
    updatePageOverride,
    clearPageOverride,
    clearAllPageOverrides,
    setApplyMode,
    regeneratePuzzleAtIndex,
    persistPagePuzzleSettings,
    updateActiveTextModuleSettings,
    canUndo,
    canRedo,
    undo,
    redo,
    projectName,
  } = useApp();
  const { showBusy, updateBusy, hideBusy } = useOptionalAppBusy();

  const [showMargins, setShowMargins] = useState(true);
  const [previewShowBothPages, setPreviewShowBothPages] = useState(false);
  const [aiAppendOpen, setAiAppendOpen] = useState(false);
  const [aiInsertPosition, setAiInsertPosition] = useState<{
    side: 'before' | 'after';
    referenceId: string;
  }>({ side: 'after', referenceId: '' });
  const [showSafetyZone, setShowSafetyZone] = useState(true);
  const [canvasEditTabs, setCanvasEditTabs] = useState<CanvasEditTab[]>([]);
  const [activeCanvasEditTabId, setActiveCanvasEditTabId] = useState<string | null>(null);
  const [canvasEditSession, setCanvasEditSession] = useState<CanvasEditSession | null>(null);
  const [canvasEditUnsavedDialogOpen, setCanvasEditUnsavedDialogOpen] = useState(false);
  const [canvasEditRangeError, setCanvasEditRangeError] = useState<string | null>(null);
  const [applyToAllConfirmOpen, setApplyToAllConfirmOpen] = useState(false);
  const [preserveEditedPagesOnApply, setPreserveEditedPagesOnApply] = useState(false);
  const [textPageEditPanelOpen, setTextPageEditPanelOpen] = useState(true);
  const [crosswordEditTarget, setCrosswordEditTarget] = useState<CrosswordEditTarget | null>(null);
  const [crosswordEditPanelOpen, setCrosswordEditPanelOpen] = useState(false);
  const [crosswordDraft, setCrosswordDraft] = useState<CrosswordSettings | null>(null);
  const [crosswordDraftBaseline, setCrosswordDraftBaseline] = useState<CrosswordSettings | null>(
    null
  );
  const [crosswordRangeError, setCrosswordRangeError] = useState<string | null>(null);
  /** Which unsaved dialog flow is active when leaving with edits. */
  const [unsavedDialogKind, setUnsavedDialogKind] = useState<
    'word-search' | 'crossword' | 'generic'
  >('word-search');
  const pendingCanvasEditLeaveRef = useRef<(() => void) | null>(null);
  const crosswordUnsavedRef = useRef(false);
  const genericPuzzleUnsavedRef = useRef(false);
  const handleCrosswordCommitPageRef = useRef<() => void>(() => {});
  const handleCrosswordCommitAllRef = useRef<() => void>(() => {});
  const handleCrosswordEditCloseRef = useRef<() => void>(() => {});
  const handleGenericPuzzleCommitAllRef = useRef<() => void>(() => {});
  const handleGenericPuzzleEditCloseRef = useRef<() => void>(() => {});
  const pendingCanvasEditTabCloseIdRef = useRef<string | null>(null);
  const initializedTitlePageDocIdRef = useRef<string | null>(null);
  const applyToAllPendingLeaveRef = useRef(false);

  const isFlipbookPreview = previewRangeMode === 'flipbook';
  const isAllPagesPreview = previewRangeMode === 'all';
  const isLockedPreview = isFlipbookPreview || isAllPagesPreview;

  const [batchPageInputValue, setBatchPageInputValue] = useState('1');
  const [solutionPageInputValue, setSolutionPageInputValue] = useState('1');
  const [documentPageInputValue, setDocumentPageInputValue] = useState('1');
  const puzzlePageRefs = useRef<(HTMLDivElement | null)[]>([]);
  const solutionPageRefs = useRef<(HTMLDivElement | null)[]>([]);
  const compiledPageRefs = useRef<(HTMLDivElement | null)[]>([]);
  const previewViewportRef = useRef<HTMLDivElement | null>(null);
  const [spacePanActive, setSpacePanActive] = useState(false);
  const [handDragActive, setHandDragActive] = useState(false);
  const [handDragOrigin, setHandDragOrigin] = useState<{ x: number; y: number } | null>(null);
  const [handScrollOrigin, setHandScrollOrigin] = useState<{ left: number; top: number } | null>(null);

  // Calculate total puzzle count from all word-search pages
  const totalPuzzleCountFromPages = useMemo(() => {
    const wordSearchPages = documentPages.filter((page) => page.moduleType === 'word-search');
    let total = 0;
    for (const page of wordSearchPages) {
      const pageSettings = (page.settings as any)?.wordSearchSettings;
      if (pageSettings?.core?.numberOfPuzzles) {
        total += pageSettings.core.numberOfPuzzles;
      }
    }
    return total > 0 ? total : (wordSearchSettings?.core?.numberOfPuzzles || 1);
  }, [documentPages, wordSearchSettings]);

  const handleBatchPageNavigation = (value: string) => {
    const pageNum = Math.max(1, Math.min(batchPuzzles.length || 1, Number(value)));
    setCurrentBatchIndex(pageNum - 1);
    setBatchPageInputValue(pageNum.toString());
  };

  const handleSolutionPageNavigation = (value: string) => {
    const maxPages =
      activeDocIsBatchModule
        ? crosswordSolutionPageCount
        : solutionPages.length || 1;
    const pageNum = Math.max(1, Math.min(maxPages, Number(value)));
    setCurrentSolutionPageIndex(pageNum - 1);
    setSolutionPageInputValue(pageNum.toString());
  };

  const handleDocumentPageNavigation = (value: string) => {
    const pageNum = Math.max(1, Math.min(documentPages.length || 1, Number(value)));
    const target = documentPages[pageNum - 1];
    if (target) {
      setActiveDocumentPageId(target.id);
    }
    setDocumentPageInputValue(pageNum.toString());
  };

  // Compute dynamic canvas dimensions and conversion helper
  const { widthPx, heightPx, safetyMarginPx, includeBleed } = useCanvasDimensions(wordSearchSettings);
  const safetyMarginPt = includeBleed ? 27 : 18;
  const ptToPx = useMemo(() => (pt: number) => pt * (96 / 72), []);
  const activeDocumentPage = useMemo(
    () => documentPages.find((page) => page.id === activeDocumentPageId) ?? documentPages[0],
    [documentPages, activeDocumentPageId]
  );

  const documentPagesForBook = useMemo(() => {
    const isSampleMode = previewRangeMode === 'sample' && !previewShowBothPages;
    const activeWordSearchSettings = canvasEditSession?.draft ?? wordSearchSettings;

    if (isSampleMode && activeDocumentPage) {
      let activePageLive = activeDocumentPage;
      if (activeDocumentPage.moduleType === 'word-search') {
        activePageLive = {
          ...activeDocumentPage,
          settings: {
            ...(activeDocumentPage.settings as PuzzleModuleSettings),
            titleWords: canvasEditSession?.draftTitleWords ?? titleWords,
            wordSearchSettings: activeWordSearchSettings,
          },
        };
      } else if (activeDocumentPage.moduleType === 'crossword') {
        activePageLive = {
          ...activeDocumentPage,
          settings: {
            ...(activeDocumentPage.settings as PuzzleModuleSettings),
            titleWords,
            crosswordSettings,
          },
        };
      } else if (isGenericPuzzleModuleType(activeDocumentPage.moduleType)) {
        activePageLive = {
          ...activeDocumentPage,
          settings: {
            ...(activeDocumentPage.settings as PuzzleModuleSettings),
            titleWords,
            genericPuzzleSettings,
          },
        };
      } else if (activeDocumentPage.moduleType === 'murdoku') {
        activePageLive = {
          ...activeDocumentPage,
          settings: {
            ...(activeDocumentPage.settings as PuzzleModuleSettings),
            titleWords,
            murdokuSettings,
          },
        };
      }
      return [activePageLive];
    }

    const liveMerged = documentPages.map((page) => {
      if (page.id === activeDocumentPageId && page.moduleType === 'word-search') {
        const settings = page.settings as PuzzleModuleSettings;
        return {
          ...page,
          settings: {
            ...settings,
            titleWords: canvasEditSession?.draftTitleWords ?? titleWords,
            wordSearchSettings: activeWordSearchSettings,
          },
        };
      }
      if (page.id === activeDocumentPageId && page.moduleType === 'crossword') {
        const settings = page.settings as PuzzleModuleSettings;
        return {
          ...page,
          settings: {
            ...settings,
            titleWords,
            crosswordSettings,
          },
        };
      }
      if (
        page.id === activeDocumentPageId &&
        isGenericPuzzleModuleType(page.moduleType)
      ) {
        const settings = page.settings as PuzzleModuleSettings;
        return {
          ...page,
          settings: {
            ...settings,
            titleWords,
            genericPuzzleSettings,
          },
        };
      }
      if (page.id === activeDocumentPageId && page.moduleType === 'murdoku') {
        const settings = page.settings as PuzzleModuleSettings;
        return {
          ...page,
          settings: {
            ...settings,
            titleWords,
            murdokuSettings,
          },
        };
      }
      return page;
    });
    return overlayBookLayoutOnAllDocuments(liveMerged, wordSearchSettings);
  }, [
    documentPages,
    activeDocumentPageId,
    activeDocumentPage,
    previewRangeMode,
    previewShowBothPages,
    titleWords,
    wordSearchSettings,
    crosswordSettings,
    genericPuzzleSettings,
    murdokuSettings,
    canvasEditSession?.draft,
    canvasEditSession?.draftTitleWords,
  ]);

  const pageNumberSettingsForBook = useMemo(
    () => resolvePageNumberSettingsForBook(documentPagesForBook, wordSearchSettings),
    [documentPagesForBook, wordSearchSettings]
  );

  const compiledBook = useMemo(() => {
    if (documentPages.length === 0) return null;
    const isSampleMode = previewRangeMode === 'sample' && !previewShowBothPages;
    const docsToCompile = isSampleMode && activeDocumentPage
      ? [activeDocumentPage]
      : documentPagesForBook;
    const puzzleMap = groupPuzzlesByDocument(batchPuzzles, docsToCompile);
    const crosswordMap = groupCrosswordPuzzlesByDocument(
      crosswordBatchPuzzles,
      docsToCompile
    );
    const genericMap = groupGenericPuzzlesByDocument(
      genericBatchPuzzles,
      docsToCompile
    );
    const murdokuMap = groupMurdokuPuzzlesByDocument(
      murdokuBatchPuzzles,
      docsToCompile
    );
    return compileBook(docsToCompile, puzzleMap, {
      includeSolutions: true,
      pageNumberSettings: pageNumberSettingsForBook,
      crosswordPuzzlesByDocumentId: crosswordMap,
      crosswordPageOverrides: pageCrosswordOverrides,
      genericPuzzlesByDocumentId: genericMap,
      genericPageOverrides: pageGenericOverrides,
      murdokuPuzzlesByDocumentId: murdokuMap,
      mixPuzzles: isSampleMode ? false : Boolean(bookSettings.mixPuzzles),
      chapterTopics: bookSettings.chapterTopics,
    });
  }, [
    documentPages.length,
    documentPagesForBook,
    previewRangeMode,
    previewShowBothPages,
    activeDocumentPage,
    batchPuzzles,
    crosswordBatchPuzzles,
    genericBatchPuzzles,
    murdokuBatchPuzzles,
    pageCrosswordOverrides,
    pageGenericOverrides,
    pageNumberSettingsForBook,
    bookSettings.mixPuzzles,
    bookSettings.chapterTopics,
  ]);

  const compiledBookPagesForPreview = useMemo(() => {
    if (!compiledBook) return [];
    if (previewShowBothPages) return compiledBook.pages;
    if (activePreviewTab === 'solutions') {
      return compiledBook.pages.filter((page) => isCompiledSolutionKind(page.kind));
    }
    return compiledBook.pages.filter((page) => !isCompiledSolutionKind(page.kind));
  }, [compiledBook, activePreviewTab, previewShowBothPages]);

  const bookSolutionPreviewEntries = useMemo(() => {
    if (!compiledBook) return [];
    let pageIndex = 0;
    return compiledBook.pages
      .filter((page): page is CompiledSolutionPage => page.kind === 'solution')
      .map((page) => ({
        puzzles: page.puzzles,
        settings: page.wordSearchSettings,
        titleWords: getTitleWordsForDocument(documentPagesForBook, page.sourceDocumentId, titleWords),
        bookPageIndex: page.bookPageIndex,
        pageIndex: pageIndex++,
        sourceDocumentId: page.sourceDocumentId,
      }));
  }, [compiledBook, documentPagesForBook, titleWords]);

  const compiledSolutionPagesForActiveDoc = useMemo(
    () =>
      compiledBook
        ? (getCompiledSolutionPagesForDocument(
            compiledBook,
            activeDocumentPageId
          ).filter((page): page is CompiledSolutionPage => page.kind === 'solution'))
        : [],
    [compiledBook, activeDocumentPageId]
  );

  const activeDocCompiledSolutionPages = useMemo(
    () =>
      compiledBook?.pages.filter(
        (page) =>
          isCompiledSolutionKind(page.kind) && page.sourceDocumentId === activeDocumentPageId
      ) ?? [],
    [compiledBook, activeDocumentPageId]
  );

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.code !== 'Space') return;
      const target = event.target as HTMLElement | null;
      if (!target) return;
      const tag = target.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable) {
        return;
      }
      // Always set active and prevent default on every keydown (including repeats)
      setSpacePanActive(true);
      // Add body class so cursor updates immediately (no render delay)
      try {
        document.body.classList.add('gp-space-pan-active');
      } catch (e) {}
      event.preventDefault();
    };

    const onKeyUp = (event: KeyboardEvent) => {
      if (event.code !== 'Space') return;
      setSpacePanActive(false);
      // Remove body class added on keydown
      try {
        document.body.classList.remove('gp-space-pan-active');
      } catch (e) {}
      setHandDragActive(false);
      setHandDragOrigin(null);
      setHandScrollOrigin(null);
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, []);

  const handleViewportPointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (!spacePanActive || event.button !== 0) return;
      const viewport = previewViewportRef.current;
      if (!viewport) return;
      viewport.setPointerCapture(event.pointerId);
      setHandDragActive(true);
      setHandDragOrigin({ x: event.clientX, y: event.clientY });
      setHandScrollOrigin({ left: viewport.scrollLeft, top: viewport.scrollTop });
      event.preventDefault();
    },
    [spacePanActive]
  );

  const handleViewportPointerMove = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (!spacePanActive || !handDragActive || !handDragOrigin || !handScrollOrigin) return;
      const viewport = previewViewportRef.current;
      if (!viewport) return;
      const dx = event.clientX - handDragOrigin.x;
      const dy = event.clientY - handDragOrigin.y;
      viewport.scrollLeft = handScrollOrigin.left - dx;
      viewport.scrollTop = handScrollOrigin.top - dy;
    },
    [spacePanActive, handDragActive, handDragOrigin, handScrollOrigin]
  );

  const handleViewportPointerUp = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (!spacePanActive) return;
      const viewport = previewViewportRef.current;
      if (!viewport) return;
      viewport.releasePointerCapture(event.pointerId);
      setHandDragActive(false);
      setHandDragOrigin(null);
      setHandScrollOrigin(null);
    },
    [spacePanActive]
  );

  // Group solution puzzles into pages based on answersPerPage (or compiled book order)
  const solutionPages = useMemo(() => {
    if (compiledBook) {
      let entries = compiledBook.pages.filter(
        (page): page is CompiledSolutionPage => page.kind === 'solution'
      );
      if (previewRangeMode === 'sample' && activeDocumentPageId) {
        entries = entries.filter((page) => page.sourceDocumentId === activeDocumentPageId);
      }
      return entries.map((page) => page.puzzles);
    }
    const answersPerPage =
      (canvasEditSession?.draft ?? wordSearchSettings).bookCanvas.answersPerPage || 1;
    const pages: WordSearchPuzzle[][] = [];
    for (let i = 0; i < batchPuzzles.length; i += answersPerPage) {
      pages.push(batchPuzzles.slice(i, i + answersPerPage));
    }
    return pages;
  }, [
    compiledBook,
    previewRangeMode,
    activeDocumentPageId,
    batchPuzzles,
    wordSearchSettings.bookCanvas.answersPerPage,
    canvasEditSession?.draft?.bookCanvas.answersPerPage,
  ]);

  const bookHeaderTitleFontSizePt = useMemo(
    () =>
      computeBookHeaderTitleFontSizePt(
        batchPuzzles.map((puzzle, idx) => ({
          puzzle,
          settings: getEffectiveSettingsForPage(wordSearchSettings, pageOverrides, idx),
        })),
        titleWords
      ),
    [batchPuzzles, wordSearchSettings, pageOverrides, titleWords, triggerStylingUpdate]
  );

  const includeBlankAfterEachPuzzle =
    !!wordSearchSettings.bookCanvas.includePageBetweenPuzzleAndSolutions;

  const hasPuzzles =
    currentPuzzleType === 'word-search'
      ? batchPuzzles.length > 0
      : currentPuzzleType === 'crossword'
        ? crosswordBatchPuzzles.length > 0 || currentPuzzle?.type === 'crossword'
        : currentPuzzleType === 'murdoku'
          ? murdokuBatchPuzzles.length > 0 || currentPuzzle?.type === 'murdoku'
          : !!currentPuzzle;
  const hasPreviewPages = documentPages.length > 0;
  const activeDocumentIndex = documentPages.findIndex((page) => page.id === activeDocumentPageId);
  const activeDocumentPuzzleStartIndex = batchPuzzles.findIndex(
    (puzzle) => puzzle.pageId === activeDocumentPageId
  );
  const activeDocumentPuzzleCount = batchPuzzles.filter(
    (puzzle) => puzzle.pageId === activeDocumentPageId
  ).length;
  const activeCrosswordPuzzleCountRaw = crosswordBatchPuzzles.filter(
    (puzzle) => puzzle.pageId === activeDocumentPageId
  ).length;
  const activeCrosswordPuzzleStartIndex = crosswordBatchPuzzles.findIndex(
    (puzzle) => puzzle.pageId === activeDocumentPageId
  );
  const activeGenericPuzzleCount = genericBatchPuzzles.filter(
    (puzzle) => puzzle.pageId === activeDocumentPageId
  ).length;
  const activeMurdokuPuzzleCount = murdokuBatchPuzzles.filter(
    (puzzle) => puzzle.pageId === activeDocumentPageId
  ).length;
  const activeDocIsGenericModule =
    !!activeDocumentPage && isGenericPuzzleModuleType(activeDocumentPage.moduleType);
  const activeDocIsCrosswordModule = activeDocumentPage
    ? activeDocumentPage.moduleType === 'crossword'
    : false;
  const activeDocIsMurdokuModule = activeDocumentPage
    ? activeDocumentPage.moduleType === 'murdoku'
    : false;
  const activeDocIsBatchModule =
    activeDocIsCrosswordModule || activeDocIsGenericModule || activeDocIsMurdokuModule;
  // Unified per-document batch count: crossword and sudoku/maze docs paginate identically.
  const murdokuTwoPage = !!murdokuSettings?.core?.twoPagePuzzles;
  const activeCrosswordPuzzleCount = activeDocIsGenericModule
    ? activeGenericPuzzleCount
    : activeDocIsMurdokuModule
      ? activeMurdokuPuzzleCount * (murdokuTwoPage ? 2 : 1)
      : activeCrosswordPuzzleCountRaw;
  const genericPuzzlesPerPage = Math.max(
    1,
    activeDocIsGenericModule ? genericPuzzleSettings?.core?.puzzlesPerPage || 1 : 1
  );
  /** Puzzle-tab page count for generic modules (multi puzzles per page). */
  const genericPuzzlePageCount = Math.max(
    1,
    Math.ceil(Math.max(0, activeGenericPuzzleCount) / genericPuzzlesPerPage)
  );
  const batchPuzzlePageCount =
    activeDocIsGenericModule && genericPuzzlesPerPage > 1
      ? genericPuzzlePageCount
      : activeCrosswordPuzzleCount;
  const batchPuzzlePageNumber =
    activeDocIsGenericModule && genericPuzzlesPerPage > 1
      ? Math.floor(Math.max(0, currentBatchIndex) / genericPuzzlesPerPage) + 1
      : currentBatchIndex + 1;

  const crosswordSolutionPageCount = useMemo(() => {
    if (activeDocIsGenericModule && activeDocumentPage?.moduleType === 'trivia') {
      const answersPerPage = computeTriviaSolutionsPerPage({
        answersPerColumn: genericPuzzleSettings?.core?.solutionsPerPage || 20,
        solutionColumns: genericPuzzleSettings?.core?.triviaSolutionColumns || 3,
      });
      const pages = packTriviaGamesForSolutionPages(
        (genericBatchPuzzles as import('@/lib/puzzles/types').TriviaPuzzle[]) || [],
        answersPerPage
      );
      return Math.max(1, pages.length || 1);
    }
    const answersPerPage = activeDocIsGenericModule
      ? genericPuzzleSettings?.core?.solutionsPerPage || 1
      : activeDocIsMurdokuModule
        ? murdokuSettings?.bookCanvas?.answersPerPage || 1
        : crosswordSettings?.bookCanvas?.answersPerPage || 1;
    const count = activeDocIsMurdokuModule
      ? activeMurdokuPuzzleCount
      : activeDocIsBatchModule
        ? activeCrosswordPuzzleCount
        : crosswordBatchPuzzles.length;
    return Math.max(1, Math.ceil(Math.max(0, count) / Math.max(1, answersPerPage)));
  }, [
    crosswordSettings?.bookCanvas?.answersPerPage,
    murdokuSettings?.bookCanvas?.answersPerPage,
    genericPuzzleSettings?.core?.solutionsPerPage,
    genericPuzzleSettings?.core?.triviaSolutionColumns,
    genericPuzzleSettings?.core?.questionsPerPage,
    genericPuzzleSettings?.typography?.answerFontSize,
    genericPuzzleSettings?.typography?.puzzleFontSize,
    genericPuzzleSettings?.typography?.triviaSolutionSpaceBetween,
    activeDocIsGenericModule,
    activeDocumentPage?.moduleType,
    activeDocIsBatchModule,
    activeDocIsMurdokuModule,
    activeCrosswordPuzzleCount,
    activeMurdokuPuzzleCount,
    crosswordBatchPuzzles.length,
    genericBatchPuzzles,
    murdokuBatchPuzzles,
  ]);

  // Current solution page index navigation state
  const [currentSolutionPageIndex, setCurrentSolutionPageIndex] = useState(0);

  const activePuzzleLocalIndex = useMemo(() => {
    if (
      activeDocumentPage?.moduleType === 'word-search' &&
      activeDocumentPuzzleStartIndex >= 0
    ) {
      return Math.max(0, currentBatchIndex - activeDocumentPuzzleStartIndex);
    }
    if (activeDocIsMurdokuModule && murdokuTwoPage) {
      return Math.floor(Math.max(0, currentBatchIndex) / 2);
    }
    return Math.max(0, currentBatchIndex);
  }, [
    activeDocumentPage?.moduleType,
    activeDocumentPuzzleStartIndex,
    currentBatchIndex,
    activeDocIsMurdokuModule,
    murdokuTwoPage,
  ]);

  const solutionsPerPreviewPage = useMemo(() => {
    if (activeDocumentPage?.moduleType === 'word-search') {
      return Math.max(
        1,
        (canvasEditSession?.draft ?? wordSearchSettings).bookCanvas.answersPerPage || 1
      );
    }
    if (activeDocumentPage?.moduleType === 'trivia') {
      return Math.max(
        1,
        computeTriviaSolutionsPerPage({
          answersPerColumn: genericPuzzleSettings?.core?.solutionsPerPage || 20,
          solutionColumns: genericPuzzleSettings?.core?.triviaSolutionColumns || 3,
        })
      );
    }
    if (activeDocIsGenericModule) {
      return Math.max(1, genericPuzzleSettings?.core?.solutionsPerPage || 1);
    }
    if (activeDocIsMurdokuModule) {
      return Math.max(1, murdokuSettings?.bookCanvas?.answersPerPage || 1);
    }
    if (activeDocIsCrosswordModule) {
      return Math.max(1, crosswordSettings?.bookCanvas?.answersPerPage || 1);
    }
    return 1;
  }, [
    activeDocumentPage?.moduleType,
    canvasEditSession?.draft,
    wordSearchSettings,
    genericPuzzleSettings?.core?.solutionsPerPage,
    genericPuzzleSettings?.core?.triviaSolutionColumns,
    activeDocIsGenericModule,
    activeDocIsMurdokuModule,
    murdokuSettings?.bookCanvas?.answersPerPage,
    activeDocIsCrosswordModule,
    crosswordSettings?.bookCanvas?.answersPerPage,
  ]);

  const previewSolutionPageCount = useMemo(() => {
    if (activeDocIsBatchModule) return Math.max(1, crosswordSolutionPageCount);
    return Math.max(
      1,
      solutionPages.length || compiledSolutionPagesForActiveDoc.length || 1
    );
  }, [
    activeDocIsBatchModule,
    crosswordSolutionPageCount,
    solutionPages.length,
    compiledSolutionPagesForActiveDoc.length,
  ]);

  const matchingSolutionPageIndex = useMemo(() => {
    const max = Math.max(0, previewSolutionPageCount - 1);
    const currentPuzzleId =
      activeDocumentPage?.moduleType === 'word-search'
        ? batchPuzzles[currentBatchIndex]?.id
        : undefined;
    const compiledIdx = activeDocCompiledSolutionPages.findIndex((page) =>
      compiledSolutionPuzzles(page).some(
        (puzzle) =>
          puzzle.puzzleIndexInDocument === activePuzzleLocalIndex ||
          (!!currentPuzzleId && puzzle.id === currentPuzzleId)
      )
    );
    if (compiledIdx >= 0) return compiledIdx;
    const chunkIdx =
      activeDocCompiledSolutionPages.length > 0
        ? -1
        : solutionPages.findIndex((chunk) =>
            chunk.some(
              (puzzle) =>
                (puzzle.puzzleIndexInDocument ?? -1) === activePuzzleLocalIndex ||
                (!!currentPuzzleId && puzzle.id === currentPuzzleId)
            )
          );
    if (chunkIdx >= 0) return Math.min(max, chunkIdx);
    return Math.max(
      0,
      Math.min(max, Math.floor(activePuzzleLocalIndex / solutionsPerPreviewPage))
    );
  }, [
    previewSolutionPageCount,
    batchPuzzles,
    currentBatchIndex,
    activeDocumentPage?.moduleType,
    activeDocCompiledSolutionPages,
    activePuzzleLocalIndex,
    solutionPages,
    solutionsPerPreviewPage,
  ]);

  const matchingBatchIndexFromSolution = useMemo(() => {
    const compiledPage = activeDocCompiledSolutionPages[currentSolutionPageIndex];
    const compiledPuzzles = compiledPage ? compiledSolutionPuzzles(compiledPage) : [];
    const chunk =
      activeDocCompiledSolutionPages.length > 0
        ? []
        : solutionPages[currentSolutionPageIndex] ?? [];
    const onThisPage =
      compiledPuzzles.some(
        (puzzle) => puzzle.puzzleIndexInDocument === activePuzzleLocalIndex
      ) ||
      chunk.some(
        (puzzle) => (puzzle.puzzleIndexInDocument ?? -1) === activePuzzleLocalIndex
      );
    if (onThisPage) return currentBatchIndex;

    const firstLocal =
      compiledPuzzles[0]?.puzzleIndexInDocument ??
      chunk[0]?.puzzleIndexInDocument ??
      currentSolutionPageIndex * solutionsPerPreviewPage;

    if (
      activeDocumentPage?.moduleType === 'word-search' &&
      activeDocumentPuzzleStartIndex >= 0
    ) {
      const last =
        activeDocumentPuzzleStartIndex + Math.max(0, activeDocumentPuzzleCount - 1);
      return Math.max(
        activeDocumentPuzzleStartIndex,
        Math.min(last, activeDocumentPuzzleStartIndex + firstLocal)
      );
    }
    if (activeDocIsMurdokuModule && murdokuTwoPage) {
      const part = currentBatchIndex % 2;
      const visual = firstLocal * 2 + part;
      return Math.max(0, Math.min(Math.max(0, activeCrosswordPuzzleCount - 1), visual));
    }
    if (activeDocIsGenericModule && genericPuzzlesPerPage > 1) {
      const pageStart =
        Math.floor(firstLocal / genericPuzzlesPerPage) * genericPuzzlesPerPage;
      return Math.max(
        0,
        Math.min(Math.max(0, activeCrosswordPuzzleCount - 1), pageStart)
      );
    }
    const maxBatch = activeDocIsBatchModule
      ? activeCrosswordPuzzleCount
      : batchPuzzles.length;
    return Math.max(0, Math.min(Math.max(0, maxBatch - 1), firstLocal));
  }, [
    activeDocCompiledSolutionPages,
    currentSolutionPageIndex,
    solutionPages,
    activePuzzleLocalIndex,
    currentBatchIndex,
    solutionsPerPreviewPage,
    activeDocumentPage?.moduleType,
    activeDocumentPuzzleStartIndex,
    activeDocumentPuzzleCount,
    activeDocIsMurdokuModule,
    murdokuTwoPage,
    activeCrosswordPuzzleCount,
    activeDocIsGenericModule,
    genericPuzzlesPerPage,
    activeDocIsBatchModule,
    batchPuzzles.length,
  ]);

  useEffect(() => {
    if (!hasPreviewPages) return;
    if (activeDocumentPage?.moduleType === 'word-search') {
      if (activeDocumentPuzzleCount <= 0 || activeDocumentPuzzleStartIndex < 0) return;
      setCurrentBatchIndex((idx) => {
        const first = activeDocumentPuzzleStartIndex;
        const last = activeDocumentPuzzleStartIndex + activeDocumentPuzzleCount - 1;
        if (idx < first || idx > last) return first;
        return idx;
      });
      return;
    }
    if (activeDocIsBatchModule) {
      if (activeCrosswordPuzzleCount <= 0) return;
      setCurrentBatchIndex((idx) => {
        if (idx < 0 || idx >= activeCrosswordPuzzleCount) return 0;
        if (activeDocIsGenericModule && genericPuzzlesPerPage > 1) {
          return Math.floor(idx / genericPuzzlesPerPage) * genericPuzzlesPerPage;
        }
        return idx;
      });
    }
  }, [
    activeDocumentPageId,
    activeDocumentPuzzleStartIndex,
    activeDocumentPuzzleCount,
    activeCrosswordPuzzleCount,
    activeDocumentPage?.moduleType,
    hasPreviewPages,
    setCurrentBatchIndex,
    activeDocIsBatchModule,
    activeDocIsGenericModule,
    genericPuzzlesPerPage,
  ]);

  useEffect(() => {
    setCurrentSolutionPageIndex(0);
    // Per-page crossword overrides are cleared by generatePuzzle itself when the
    // user opts to drop customizations (clearPageCustomizations) — mirroring the
    // word-search flow — so a generation bump must NOT wipe them here.
  }, [puzzleGenerationVersion]);

  useEffect(() => {
    setCurrentSolutionPageIndex((idx) =>
      Math.min(idx, Math.max(0, crosswordSolutionPageCount - 1))
    );
  }, [crosswordSolutionPageCount, crosswordSettings?.bookCanvas?.answersPerPage]);

  // Keep the solution page aligned with the active puzzle (and vice versa).
  useEffect(() => {
    if (!previewShowBothPages && activePreviewTab !== 'puzzles') return;
    if (matchingSolutionPageIndex >= 0) {
      setCurrentSolutionPageIndex((prev) =>
        prev === matchingSolutionPageIndex ? prev : matchingSolutionPageIndex
      );
    }
  }, [matchingSolutionPageIndex, previewShowBothPages, activePreviewTab]);

  useEffect(() => {
    if (previewShowBothPages || activePreviewTab !== 'solutions') return;
    if (matchingBatchIndexFromSolution >= 0) {
      setCurrentBatchIndex((prev) =>
        prev === matchingBatchIndexFromSolution ? prev : matchingBatchIndexFromSolution
      );
    }
  }, [
    matchingBatchIndexFromSolution,
    previewShowBothPages,
    activePreviewTab,
    setCurrentBatchIndex,
  ]);

  // Keep input values in sync when navigation happens via buttons
  useEffect(() => {
    if (
      hasPreviewPages &&
      activeDocumentPage?.moduleType === 'word-search' &&
      activeDocumentPuzzleStartIndex >= 0
    ) {
      setBatchPageInputValue((currentBatchIndex - activeDocumentPuzzleStartIndex + 1).toString());
      return;
    }
    if (hasPreviewPages && activeDocIsBatchModule) {
      setBatchPageInputValue(String(batchPuzzlePageNumber));
      return;
    }
    setBatchPageInputValue((currentBatchIndex + 1).toString());
  }, [
    currentBatchIndex,
    hasPreviewPages,
    activeDocumentPage?.moduleType,
    activeDocumentPuzzleStartIndex,
    activeDocIsBatchModule,
    batchPuzzlePageNumber,
  ]);

  useEffect(() => {
    setSolutionPageInputValue((currentSolutionPageIndex + 1).toString());
  }, [currentSolutionPageIndex]);

  useEffect(() => {
    setDocumentPageInputValue((Math.max(0, activeDocumentIndex) + 1).toString());
  }, [activeDocumentIndex]);

  useEffect(() => {
    if (previewRangeMode === 'all' && activePreviewTab === 'puzzles') {
      const node = puzzlePageRefs.current[currentBatchIndex];
      if (node) node.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [currentBatchIndex, previewRangeMode, activePreviewTab]);

  useEffect(() => {
    if (previewRangeMode === 'all' && activePreviewTab === 'solutions') {
      const node = solutionPageRefs.current[currentSolutionPageIndex];
      if (node) node.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [currentSolutionPageIndex, previewRangeMode, activePreviewTab]);

  // Check KDP safety violations for printing warning alerts
  const hasKDPIssue = useMemo(() => {
    if (currentPuzzleType !== 'word-search') return false;

    if (activePreviewTab === 'puzzles') {
      const currentPuzzle = batchPuzzles[currentBatchIndex];
      if (!currentPuzzle) return false;
      const layout = computeWordSearchPageLayout(
        currentPuzzle,
        wordSearchSettings,
        titleWords,
        false,
        puzzleGridScale,
        10,
        bookHeaderTitleFontSizePt
      );
      return checkKDPSafety(layout, safetyMarginPt);
    } else {
      const firstPage = solutionPages[0];
      if (!firstPage || firstPage.length === 0) return false;
      const dims = getPageDimensionsInches(wordSearchSettings);
      const contentArea = computeSolutionPageContentArea(
        dims.width * 72,
        dims.height * 72,
        wordSearchSettings,
        pageMargin
      );
      return contentArea.leftPt < safetyMarginPt;
    }
  }, [batchPuzzles, currentBatchIndex, activePreviewTab, currentPuzzleType, wordSearchSettings, titleWords, puzzleGridScale, solutionPages, pageMargin, safetyMarginPt, bookHeaderTitleFontSizePt]);

  const showPaginationBar = hasPreviewPages || hasPuzzles;
  const previewUsesPuzzlePagination =
    previewShowBothPages || activePreviewTab === 'puzzles';
  const showPuzzleBatchPagination =
    previewUsesPuzzlePagination &&
    (hasPreviewPages
      ? (activeDocumentPage?.moduleType === 'word-search' && activeDocumentPuzzleCount > 0) ||
        (activeDocIsBatchModule && activeCrosswordPuzzleCount > 0)
      : hasPuzzles);
  const showDocumentPagination =
    hasPreviewPages && previewUsesPuzzlePagination && !showPuzzleBatchPagination;
  const canGoPrevDocument = activeDocumentIndex > 0;
  const canGoNextDocument = activeDocumentIndex >= 0 && activeDocumentIndex < documentPages.length - 1;
  const goToPrevDocument = () => {
    if (canGoPrevDocument) {
      setActiveDocumentPageId(documentPages[activeDocumentIndex - 1].id);
    }
  };
  const goToNextDocument = () => {
    if (canGoNextDocument) {
      setActiveDocumentPageId(documentPages[activeDocumentIndex + 1].id);
    }
  };
  const documentPagesToRender = useMemo(
    () => (previewRangeMode === 'sample' ? (activeDocumentPage ? [activeDocumentPage] : documentPages) : documentPages),
    [documentPages, activeDocumentPage, previewRangeMode]
  );

  const canvasEditEnabled =
    previewRangeMode === 'sample' &&
    !previewShowBothPages &&
    !showSolution &&
    (activePreviewTab === 'puzzles' || activePreviewTab === 'solutions') &&
    activeDocumentPage?.moduleType === 'word-search';

  const crosswordCanvasEditEnabled =
    previewRangeMode === 'sample' &&
    !previewShowBothPages &&
    (activePreviewTab === 'puzzles' || activePreviewTab === 'solutions') &&
    activeDocIsCrosswordModule;

  const activeTextSettings =
    activeDocumentPage &&
    isTextModuleType(activeDocumentPage.moduleType) &&
    isTextModuleSettings(activeDocumentPage.settings)
      ? normalizeTextModuleSettings(
          activeDocumentPage,
          activeDocumentPage.settings as TextModuleSettings
        )
      : null;

  const textPageEditEnabled =
    previewRangeMode === 'sample' &&
    !!activeTextSettings &&
    !!activeDocumentPage &&
    isTextModuleType(activeDocumentPage.moduleType);

  const showPuzzleSolutionTabs =
    previewRangeMode !== 'sample' ||
    (!!activeDocumentPage && isPuzzleModuleType(activeDocumentPage.moduleType));

  useEffect(() => {
    if (!showPuzzleSolutionTabs && activePreviewTab === 'solutions') {
      setActivePreviewTab('puzzles');
    }
    if (!showPuzzleSolutionTabs && previewShowBothPages) {
      setPreviewShowBothPages(false);
    }
  }, [showPuzzleSolutionTabs, activePreviewTab, previewShowBothPages, setActivePreviewTab]);

  const handleTextSettingsChange = useCallback(
    (
      updates:
        | Partial<TextModuleSettings>
        | ((prev: TextModuleSettings) => Partial<TextModuleSettings>),
      options?: { recordHistory?: boolean }
    ) => {
      updateActiveTextModuleSettings(updates, options);
    },
    [updateActiveTextModuleSettings]
  );

  const handleTextEditTargetChange = useCallback(
    (target: TextPageEditTarget) => {
      changeTextPageEditTarget(target);
      setTextPageEditPanelOpen(true);
    },
    [changeTextPageEditTarget]
  );

  const handleSelectTextBlock = useCallback(
    (blockId: string, options?: { showChrome?: boolean }) => {
      selectTextBlock(blockId, options);
      setTextPageEditPanelOpen(true);
    },
    [selectTextBlock]
  );

  const handleTocCanvasClick = useCallback(() => {
    setTextPageEditPanelOpen(true);
  }, []);

  const handleCanvasBackgroundClick = useCallback(() => {
    if (textPageBlockChromeVisible && selectedTextBlockId) {
      hideTextBlockChrome();
      return;
    }
    changeTextPageEditTarget('page-frame');
    setTextPageEditPanelOpen(true);
  }, [
    textPageBlockChromeVisible,
    selectedTextBlockId,
    hideTextBlockChrome,
    changeTextPageEditTarget,
  ]);

  const handleDeleteTextBlock = useCallback(
    (blockId: string) => {
      if (!activeDocumentPage || !activeTextSettings) return;

      const blocks = resolveTextPageBlocks(
        activeTextSettings,
        activeDocumentPage.name,
        wordSearchSettings
      );
      const block = blocks.find((entry) => entry.id === blockId);
      if (!block) return;

      updateActiveTextModuleSettings(
        removeTextPageBlock(
          activeTextSettings,
          blockId,
          activeDocumentPage.name,
          wordSearchSettings
        )
      );

      const remaining = blocks.filter((entry) => entry.id !== blockId);
      const nextId =
        remaining.find((entry) => entry.kind === 'title')?.id ?? remaining[0]?.id ?? null;
      selectTextBlock(nextId ?? '', { showChrome: false });
    },
    [
      activeDocumentPage,
      activeTextSettings,
      wordSearchSettings,
      updateActiveTextModuleSettings,
      selectTextBlock,
    ]
  );

  useEffect(() => {
    if (!textPageEditEnabled) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Delete' && event.key !== 'Backspace') return;

      const target = event.target as HTMLElement | null;
      const tag = target?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (target?.isContentEditable && target.closest('.text-page-block__text')) return;

      if (!selectedTextBlockId || !activeDocumentPage || !activeTextSettings) return;

      const blocks = resolveTextPageBlocks(
        activeTextSettings,
        activeDocumentPage.name,
        wordSearchSettings
      );
      const block = blocks.find((entry) => entry.id === selectedTextBlockId);
      if (!block) return;

      event.preventDefault();
      handleDeleteTextBlock(selectedTextBlockId);
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    textPageEditEnabled,
    selectedTextBlockId,
    activeDocumentPage,
    activeTextSettings,
    wordSearchSettings,
    handleDeleteTextBlock,
  ]);

  useEffect(() => {
    if (activeDocumentPage?.moduleType !== 'title-page') {
      initializedTitlePageDocIdRef.current = null;
    }
  }, [activeDocumentPage?.moduleType, activeDocumentPageId]);

  useEffect(() => {
    if (!textPageEditEnabled || activeDocumentPage?.moduleType !== 'title-page' || !activeTextSettings) {
      return;
    }

    const blocks = resolveTextPageBlocks(
      activeTextSettings,
      activeDocumentPage.name,
      wordSearchSettings
    );

    const isBlankSpecial = isSpecialBlankTitlePage(activeDocumentPage);
    const storedBlocks = activeTextSettings.blocks;
    const needsDefaultLayout =
      !isBlankSpecial &&
      (!Array.isArray(storedBlocks) || storedBlocks.length === 0) &&
      initializedTitlePageDocIdRef.current !== activeDocumentPageId;

    let nextBlocks = Array.isArray(storedBlocks) ? storedBlocks : blocks;
    if (isBlankSpecial && !Array.isArray(storedBlocks)) {
      nextBlocks = [];
    } else if (needsDefaultLayout) {
      nextBlocks = createDefaultTitlePageBlocks(
        activeDocumentPage.name,
        activeTextSettings,
        wordSearchSettings
      );
    }

    // Fix white-on-white text inherited from puzzle title color.
    const needsBlackPageColor =
      !activeTextSettings.textColor || isNearWhiteCssColor(activeTextSettings.textColor);
    const normalizedBlocks = nextBlocks.map((block) =>
      block.textColor && isNearWhiteCssColor(block.textColor)
        ? { ...block, textColor: '#000000' }
        : block
    );
    const persistLayout = isBlankSpecial
      ? !Array.isArray(storedBlocks)
      : needsDefaultLayout;
    const blocksNeedBlack = normalizedBlocks.some(
      (block, idx) => block !== nextBlocks[idx]
    );
    if (persistLayout || needsBlackPageColor || blocksNeedBlack) {
      updateActiveTextModuleSettings(
        {
          ...(persistLayout
            ? syncLegacyFieldsFromBlocks(normalizedBlocks)
            : blocksNeedBlack
              ? { blocks: normalizedBlocks }
              : {}),
          ...(needsBlackPageColor ? { textColor: '#000000' } : {}),
        },
        { recordHistory: false }
      );
    }

    setTextPageEditPanelOpen(true);

    if (initializedTitlePageDocIdRef.current === activeDocumentPageId) {
      return;
    }

    initializedTitlePageDocIdRef.current = activeDocumentPageId;

    const titleBlockId =
      normalizedBlocks.find((block) => block.kind === 'title')?.id ??
      normalizedBlocks[0]?.id ??
      null;
    selectTextBlock(titleBlockId ?? '', { showChrome: true });
  }, [
    activeDocumentPageId,
    activeDocumentPage?.moduleType,
    activeDocumentPage?.name,
    activeTextSettings?.blocks?.length,
    textPageEditEnabled,
    wordSearchSettings,
    updateActiveTextModuleSettings,
    selectTextBlock,
  ]);

  const getSettingsForBatchIndex = useCallback(
    (batchIndex: number) =>
      getEffectiveSettingsForPage(wordSearchSettings, pageOverrides, batchIndex),
    [wordSearchSettings, pageOverrides, triggerStylingUpdate]
  );

  const effectiveWordSearchSettings = useMemo(
    () => getSettingsForBatchIndex(currentBatchIndex),
    [getSettingsForBatchIndex, currentBatchIndex]
  );

  const activeCanvasEditTab = useMemo(
    () => canvasEditTabs.find((tab) => tab.id === activeCanvasEditTabId) ?? null,
    [canvasEditTabs, activeCanvasEditTabId]
  );
  const canvasEditTarget = activeCanvasEditTab?.target ?? null;
  const editSession = canvasEditSession;
  const hasCanvasEditPanelOpen = canvasEditTabs.length > 0;

  const updateCanvasEditSession = useCallback(
    (updater: (session: CanvasEditSession) => CanvasEditSession) => {
      setCanvasEditSession((prev) => (prev ? updater(prev) : prev));
    },
    []
  );

  const syncSessionAndTabSnapshots = useCallback((synced: CanvasEditSession) => {
    const snapshot = createSnapshotFromSession(synced);
    setCanvasEditSession(synced);
    setCanvasEditTabs((prev) => prev.map((tab) => ({ ...tab, snapshot })));
  }, []);

  const prevTrimDimsRef = useRef<{ width: number; height: number } | null>(null);

  useEffect(() => {
    const dims = resolveTrimDimensions(wordSearchSettings.bookCanvas);
    const prev = prevTrimDimsRef.current;
    prevTrimDimsRef.current = dims;

    if (!prev) return;

    const ratio = computeTrimScaleRatio(prev.width, prev.height, dims.width, dims.height);
    if (Math.abs(ratio - 1) < 0.001) return;

    setCanvasEditSession((session) => {
      if (!session) return session;
      const scaled = scaleCanvasEditSessionForTrim(session, ratio, wordSearchSettings.bookCanvas);
      const tabSnapshot = createSnapshotFromSession(scaled);
      setCanvasEditTabs((tabs) => tabs.map((tab) => ({ ...tab, snapshot: tabSnapshot })));
      return scaled;
    });
  }, [
    wordSearchSettings.bookCanvas.customWidth,
    wordSearchSettings.bookCanvas.customHeight,
    wordSearchSettings.bookCanvas.trimSizePreset,
    wordSearchSettings.bookCanvas.useCustomTrim,
  ]);

  const createSessionForCurrentPage = useCallback(() => {
    const merged = getSettingsForBatchIndex(currentBatchIndex);
    const puzzle = batchPuzzles[currentBatchIndex] ?? null;
    const pageGridScale = getPuzzleGridScaleForPage(
      currentBatchIndex,
      puzzleGridScale,
      pagePuzzleGridScales
    );
    return createCanvasEditSession(merged, titleWords, pageGridScale, puzzle);
  }, [
    getSettingsForBatchIndex,
    currentBatchIndex,
    batchPuzzles,
    puzzleGridScale,
    pagePuzzleGridScales,
          titleWords,
  ]);

  const canvasEditPanelTabs = useMemo(
    () =>
      canvasEditTabs.map((tab) => ({
        id: tab.id,
        label: formatCanvasEditTabLabel(tab.target),
      })),
    [canvasEditTabs]
  );

  const effectivePuzzleGridScale = useMemo(
    () => getPuzzleGridScaleForPage(currentBatchIndex, puzzleGridScale, pagePuzzleGridScales),
    [currentBatchIndex, puzzleGridScale, pagePuzzleGridScales, triggerStylingUpdate]
  );

  const previewWordSearchSettings = canvasEditSession?.draft ?? effectiveWordSearchSettings;
  const previewTitleWords = canvasEditSession?.draftTitleWords ?? titleWords;
  const previewPuzzleGridScale = canvasEditSession?.draftPuzzleGridScale ?? effectivePuzzleGridScale;

  const samplePageHeaderTitleFontSizePt = useMemo(() => {
    const puzzle = batchPuzzles[currentBatchIndex];
    if (!puzzle || showSolution) return null;
    if (!isHeaderAssemblyEnabled(previewWordSearchSettings)) return null;
    return resolvePageHeaderTitleFontSizePt(puzzle, previewWordSearchSettings, previewTitleWords);
  }, [
    batchPuzzles,
    currentBatchIndex,
    previewWordSearchSettings,
    previewTitleWords,
    showSolution,
  ]);

  const headerTitleFontSizeForSample =
    samplePageHeaderTitleFontSizePt ?? bookHeaderTitleFontSizePt;

  const canvasEditPageRef = useRef({
    batchIndex: currentBatchIndex,
    previewTab: activePreviewTab,
  });

  useEffect(() => {
    if (!hasCanvasEditPanelOpen) {
      canvasEditPageRef.current = {
        batchIndex: currentBatchIndex,
        previewTab: activePreviewTab,
      };
      return;
    }

    const prev = canvasEditPageRef.current;
    if (prev.batchIndex === currentBatchIndex && prev.previewTab === activePreviewTab) {
      return;
    }
    canvasEditPageRef.current = {
      batchIndex: currentBatchIndex,
      previewTab: activePreviewTab,
    };

    const fresh = createSessionForCurrentPage();
    const snapshot = createSnapshotFromSession(fresh);
    setCanvasEditSession(fresh);
    setCanvasEditTabs((tabs) => tabs.map((tab) => ({ ...tab, snapshot })));
  }, [
    currentBatchIndex,
    activePreviewTab,
    hasCanvasEditPanelOpen,
    createSessionForCurrentPage,
  ]);

  const closeCanvasEditPanel = useCallback(() => {
    setCanvasEditTabs([]);
    setActiveCanvasEditTabId(null);
    setCanvasEditSession(null);
    setCanvasEditRangeError(null);
  }, []);

  useEffect(() => {
    if (!canvasEditEnabled && hasCanvasEditPanelOpen) {
      closeCanvasEditPanel();
    }
  }, [canvasEditEnabled, hasCanvasEditPanelOpen, closeCanvasEditPanel]);

  useEffect(() => {
    if (activeDocumentPage?.moduleType !== 'word-search' && hasCanvasEditPanelOpen) {
      closeCanvasEditPanel();
    }
  }, [activeDocumentPage?.moduleType, activeDocumentPageId, hasCanvasEditPanelOpen, closeCanvasEditPanel]);

  const removeCanvasEditTab = useCallback((tabId: string) => {
    setCanvasEditTabs((prev) => {
      const nextTabs = prev.filter((tab) => tab.id !== tabId);
      if (nextTabs.length === 0) {
        setCanvasEditSession(null);
      }
      setActiveCanvasEditTabId((currentActiveId) => {
        if (currentActiveId !== tabId) return currentActiveId;
        return nextTabs[nextTabs.length - 1]?.id ?? null;
      });
      return nextTabs;
    });
  }, []);

  const runPendingCanvasEditLeave = useCallback(() => {
    const action = pendingCanvasEditLeaveRef.current;
    pendingCanvasEditLeaveRef.current = null;
    action?.();
  }, []);

  const guardCanvasEditLeave = useCallback(
    (action: () => void) => {
      const wsUnsaved =
        hasCanvasEditPanelOpen &&
        anyCanvasEditTabHasUnsavedEdits(canvasEditSession, canvasEditTabs);
      const cwUnsaved = crosswordUnsavedRef.current;
      const genericUnsaved = genericPuzzleUnsavedRef.current;

      if (!wsUnsaved && !cwUnsaved && !genericUnsaved) {
        action();
        return;
      }

      pendingCanvasEditLeaveRef.current = action;
      pendingCanvasEditTabCloseIdRef.current = null;
      setUnsavedDialogKind(wsUnsaved ? 'word-search' : cwUnsaved ? 'crossword' : 'generic');
      setCanvasEditUnsavedDialogOpen(true);
    },
    [hasCanvasEditPanelOpen, canvasEditSession, canvasEditTabs]
  );

  const guardCanvasEditTabClose = useCallback(
    (tabId: string, action: () => void) => {
      const tab = canvasEditTabs.find((entry) => entry.id === tabId);
      if (!tab || !canvasEditSession || !tabHasUnsavedEdits(canvasEditSession, tab)) {
        action();
        return;
      }
      pendingCanvasEditLeaveRef.current = action;
      pendingCanvasEditTabCloseIdRef.current = tabId;
      if (tabId !== activeCanvasEditTabId) {
        setActiveCanvasEditTabId(tabId);
      }
      setCanvasEditUnsavedDialogOpen(true);
    },
    [canvasEditTabs, activeCanvasEditTabId, canvasEditSession]
  );

  const handleCanvasEditCancel = useCallback(() => {
    guardCanvasEditLeave(() => {
      closeCanvasEditPanel();
    });
  }, [guardCanvasEditLeave, closeCanvasEditPanel]);

  const handleCanvasEditCommitPage = useCallback(async () => {
    if (
      !editSession ||
      canvasEditTabs.length === 0 ||
      !anyCanvasEditTabHasUnsavedEdits(editSession, canvasEditTabs)
    ) {
      return;
    }

    const commitPageIndex = currentBatchIndex;
    const puzzle = batchPuzzles[commitPageIndex] ?? null;
    const bookTextUpdates = buildGlobalBookTextUpdatesForPageCommit(
          wordSearchSettings,
      editSession.draft,
      puzzle
    );
    const answersPerPageUpdates = buildGlobalAnswersPerPageUpdate(
      wordSearchSettings,
      editSession.draft
    );
    let mergedGlobalSettings = wordSearchSettings;
    const globalUpdates = {
      ...(bookTextUpdates ?? {}),
      ...(answersPerPageUpdates ?? {}),
    };
    if (Object.keys(globalUpdates).length > 0) {
      mergedGlobalSettings = patchWordSearchSettings(wordSearchSettings, globalUpdates);
      updateWordSearchSettings(globalUpdates);
      if (activeDocumentPageId) {
        persistPagePuzzleSettings(
          activeDocumentPageId,
          editSession.draftTitleWords,
          mergedGlobalSettings
        );
      }
    }

    const delta = buildPageOverrideForOpenTabs(
      mergedGlobalSettings,
      editSession.draft,
      canvasEditTabs,
      editSession
    );
    if (Object.keys(delta).length > 0) {
      updatePageOverride(commitPageIndex, delta);
    }

    if (editSession.draftPuzzleGridScale !== puzzleGridScale) {
      setPagePuzzleGridScale(commitPageIndex, editSession.draftPuzzleGridScale);
    } else {
      clearPagePuzzleGridScale(commitPageIndex);
    }

    if (JSON.stringify(editSession.draftTitleWords) !== JSON.stringify(editSession.snapshot.titleWords)) {
      setTitleWords(editSession.draftTitleWords);
      if (activeDocumentPageId) {
        persistPagePuzzleSettings(
          activeDocumentPageId,
          editSession.draftTitleWords,
          mergedGlobalSettings
        );
      }
    }

    if (shouldRegeneratePuzzleOnPageCommit(editSession)) {
      const commitPuzzle = batchPuzzles[commitPageIndex];
      const wordsPerPuzzle = getEffectiveWordsPerPuzzle(editSession.draft.wordList);
      const words = getWordsForPuzzlePage(
        commitPuzzle,
        editSession.draftTitleWords,
        wordsPerPuzzle,
        'titleWords'
      );
      const regenerated = await regeneratePuzzleAtIndex(commitPageIndex, words, {
        lettersAcross: editSession.draft.core.lettersAcross,
        lettersDown: editSession.draft.core.lettersDown,
        settings: editSession.draft,
      });

      syncSessionAndTabSnapshots(
        syncEditSessionBaseline(
          editSession,
          regenerated ?? batchPuzzles[commitPageIndex] ?? null
        )
      );
      return;
    }

    syncSessionAndTabSnapshots(
      syncEditSessionBaseline(editSession, batchPuzzles[commitPageIndex] ?? null)
    );
  }, [
    editSession,
    canvasEditTabs,
    currentBatchIndex,
    batchPuzzles,
    wordSearchSettings,
          puzzleGridScale,
    updateWordSearchSettings,
    updatePageOverride,
    setPagePuzzleGridScale,
    clearPagePuzzleGridScale,
    setTitleWords,
    regeneratePuzzleAtIndex,
    activeDocumentPageId,
    persistPagePuzzleSettings,
    syncSessionAndTabSnapshots,
  ]);

  const handleCanvasEditCommitRange = useCallback(
    async (rangeInput: string) => {
      if (!editSession || canvasEditTabs.length === 0) {
        return;
      }

      if (activeDocumentPuzzleCount < 1 || activeDocumentPuzzleStartIndex < 0) {
        setCanvasEditRangeError('No puzzles available in this document.');
        return;
      }

      const documentPages = parsePageRangeSelection(rangeInput, activeDocumentPuzzleCount);
      if (!documentPages) {
        setCanvasEditRangeError(
          `Enter a valid range between 1 and ${activeDocumentPuzzleCount} (e.g. 1-4, 7-10, 12).`
        );
        return;
      }

      setCanvasEditRangeError(null);
      const batchIndices = documentPagesToBatchIndices(
        documentPages,
        activeDocumentPuzzleStartIndex
      );

      let mergedGlobalSettings = wordSearchSettings;
      // answersPerPage is book-wide — only change it via "Apply to all pages", not range.

      for (const batchIndex of batchIndices) {
        const puzzle = batchPuzzles[batchIndex] ?? null;
        const bookTextUpdates = buildGlobalBookTextUpdatesForPageCommit(
          mergedGlobalSettings,
          editSession.draft,
          puzzle
        );
        if (bookTextUpdates) {
          mergedGlobalSettings = patchWordSearchSettings(mergedGlobalSettings, bookTextUpdates);
        }

        const delta = buildPageOverrideForOpenTabs(
          mergedGlobalSettings,
          editSession.draft,
          canvasEditTabs,
          editSession,
          { includeAllOpenTabsWhenClean: true }
        );
        if (Object.keys(delta).length > 0) {
          updatePageOverride(batchIndex, delta);
        }

        if (editSession.draftPuzzleGridScale !== puzzleGridScale) {
          setPagePuzzleGridScale(batchIndex, editSession.draftPuzzleGridScale);
        } else {
          clearPagePuzzleGridScale(batchIndex);
        }
      }

      const bookTextChanged =
        JSON.stringify(mergedGlobalSettings.typography) !==
          JSON.stringify(wordSearchSettings.typography) ||
        mergedGlobalSettings.wordList.aiTheme !== wordSearchSettings.wordList.aiTheme;

      if (bookTextChanged) {
        updateWordSearchSettings({
          typography: mergedGlobalSettings.typography,
          wordList: {
            ...wordSearchSettings.wordList,
            aiTheme: mergedGlobalSettings.wordList.aiTheme,
          },
        });
        if (activeDocumentPageId) {
          persistPagePuzzleSettings(
            activeDocumentPageId,
            editSession.draftTitleWords,
            mergedGlobalSettings
          );
        }
      }

      if (
        JSON.stringify(editSession.draftTitleWords) !== JSON.stringify(editSession.snapshot.titleWords)
      ) {
        setTitleWords(editSession.draftTitleWords);
        if (activeDocumentPageId) {
          persistPagePuzzleSettings(
            activeDocumentPageId,
            editSession.draftTitleWords,
            mergedGlobalSettings
          );
        }
      }

      if (shouldRegeneratePuzzleOnPageCommit(editSession)) {
        let currentPuzzle: WordSearchPuzzle | null = batchPuzzles[currentBatchIndex] ?? null;
        const wordsPerPuzzle = getEffectiveWordsPerPuzzle(editSession.draft.wordList);

        for (const batchIndex of batchIndices) {
          const commitPuzzle = batchPuzzles[batchIndex];
          const words = getWordsForPuzzlePage(
            commitPuzzle,
            editSession.draftTitleWords,
            wordsPerPuzzle,
            'titleWords'
          );
          const regenerated = await regeneratePuzzleAtIndex(batchIndex, words, {
            lettersAcross: editSession.draft.core.lettersAcross,
            lettersDown: editSession.draft.core.lettersDown,
            settings: editSession.draft,
          });
          if (batchIndex === currentBatchIndex && regenerated) {
            currentPuzzle = regenerated;
          }
        }

        syncSessionAndTabSnapshots(
          syncEditSessionBaseline(editSession, currentPuzzle)
        );
        return;
      }

      syncSessionAndTabSnapshots(
        syncEditSessionBaseline(editSession, batchPuzzles[currentBatchIndex] ?? null)
      );
    },
    [
      editSession,
      canvasEditTabs,
      activeDocumentPuzzleCount,
      activeDocumentPuzzleStartIndex,
      batchPuzzles,
          wordSearchSettings,
          puzzleGridScale,
      currentBatchIndex,
      updateWordSearchSettings,
      updatePageOverride,
      setPagePuzzleGridScale,
      clearPagePuzzleGridScale,
      setTitleWords,
      regeneratePuzzleAtIndex,
      activeDocumentPageId,
      persistPagePuzzleSettings,
      syncSessionAndTabSnapshots,
    ]
  );

  const handleCanvasEditCommitAll = useCallback(
    async (preserveEditedPages = false) => {
      if (!editSession || !canvasEditTarget) return;

      const commitPageIndex = currentBatchIndex;

      const canApply = canApplyCanvasEditsToAllPages(
        editSession,
        wordSearchSettings,
        puzzleGridScale,
          pageOverrides,
        pagePuzzleGridScales
      );
      if (!canApply) return;

      const { settings: promotedSettings, gridScale: promotedGridScale } =
        resolveApplyToAllPromotionSource(editSession);

      const bookTextUpdates = buildGlobalBookTextUpdatesForAllCommit(
        wordSearchSettings,
        promotedSettings
      );
      const mergedGlobalSettings = bookTextUpdates
        ? patchWordSearchSettings(promotedSettings, bookTextUpdates)
        : promotedSettings;

      const promotionSession: CanvasEditSession = {
        ...editSession,
        draft: mergedGlobalSettings,
        draftPuzzleGridScale: promotedGridScale,
      };

      updateWordSearchSettings(mergedGlobalSettings);
      setTitleWords(editSession.draftTitleWords);
      if (activeDocumentPageId) {
        persistPagePuzzleSettings(
          activeDocumentPageId,
          editSession.draftTitleWords,
          mergedGlobalSettings
        );
      }
      setPuzzleGridScale(promotedGridScale);

      const keepEditedIndices = preserveEditedPages
        ? getOtherEditedPageIndices(
            wordSearchSettings,
            puzzleGridScale,
            pageOverrides,
            pagePuzzleGridScales,
            commitPageIndex
          )
        : [];
      const keepEdited = new Set(keepEditedIndices);

      if (preserveEditedPages) {
        const nextOverrides = new Map<number, Partial<WordSearchSettings>>();
        for (const pageIndex of keepEdited) {
          const override = pageOverrides.get(pageIndex);
          if (override) nextOverrides.set(pageIndex, override);
        }
        setPageOverrides(nextOverrides);
        for (const pageIndex of pagePuzzleGridScales.keys()) {
          if (!keepEdited.has(pageIndex)) {
            clearPagePuzzleGridScale(pageIndex);
          }
        }
        clearPageOverride(commitPageIndex);
        clearPagePuzzleGridScale(commitPageIndex);
      } else {
        clearAllPageOverrides();
        clearAllPagePuzzleGridScales();
      }

      setApplyMode(CANVAS_EDIT_TARGET_CATEGORY[canvasEditTarget], true);

      if (shouldRegeneratePuzzlesOnAllCommit(promotionSession)) {
        let currentPuzzle: WordSearchPuzzle | null = batchPuzzles[currentBatchIndex] ?? null;
        for (let i = 0; i < batchPuzzles.length; i++) {
          if (preserveEditedPages && keepEdited.has(i)) {
            continue;
          }
          const regenerated = await regeneratePuzzleAtIndex(i, undefined, {
            lettersAcross: mergedGlobalSettings.core.lettersAcross,
            lettersDown: mergedGlobalSettings.core.lettersDown,
            settings: mergedGlobalSettings,
          });
          if (i === currentBatchIndex && regenerated) {
            currentPuzzle = regenerated;
          }
        }

        const synced: CanvasEditSession = {
          ...editSession,
          draft: cloneWordSearchSettings(mergedGlobalSettings),
          draftPuzzleGridScale: promotedGridScale,
          draftTitleWords: editSession.draftTitleWords,
        };
        syncSessionAndTabSnapshots(syncEditSessionBaseline(synced, currentPuzzle));
        return;
      }

      const synced: CanvasEditSession = {
        ...editSession,
        draft: cloneWordSearchSettings(mergedGlobalSettings),
        draftPuzzleGridScale: promotedGridScale,
        draftTitleWords: editSession.draftTitleWords,
      };
      syncSessionAndTabSnapshots(
        syncEditSessionBaseline(synced, batchPuzzles[currentBatchIndex] ?? null)
      );
    },
    [
      editSession,
      canvasEditTarget,
      activeCanvasEditTab,
      currentBatchIndex,
      batchPuzzles,
      updateWordSearchSettings,
      setTitleWords,
      setPuzzleGridScale,
      setPageOverrides,
      clearPageOverride,
      clearPagePuzzleGridScale,
      clearAllPageOverrides,
      clearAllPagePuzzleGridScales,
      setApplyMode,
      regeneratePuzzleAtIndex,
      activeDocumentPageId,
      persistPagePuzzleSettings,
      wordSearchSettings,
      puzzleGridScale,
      pageOverrides,
      pagePuzzleGridScales,
      syncSessionAndTabSnapshots,
    ]
  );

  const requestCanvasEditCommitAll = useCallback(
    (afterLeave = false) => {
      if (!editSession || !canvasEditTarget) return;

      const otherEditedPages = getOtherEditedPageIndices(
        wordSearchSettings,
        puzzleGridScale,
        pageOverrides,
        pagePuzzleGridScales,
        currentBatchIndex
      );

      if (otherEditedPages.length > 0) {
        applyToAllPendingLeaveRef.current = afterLeave;
        setPreserveEditedPagesOnApply(false);
        setApplyToAllConfirmOpen(true);
        return;
      }

      handleCanvasEditCommitAll(false);
      if (afterLeave) {
        setCanvasEditUnsavedDialogOpen(false);
        runPendingCanvasEditLeave();
      }
    },
    [
      editSession,
      canvasEditTarget,
      wordSearchSettings,
      puzzleGridScale,
      pageOverrides,
      pagePuzzleGridScales,
      currentBatchIndex,
      handleCanvasEditCommitAll,
      runPendingCanvasEditLeave,
    ]
  );

  const handleApplyToAllConfirm = useCallback(() => {
    handleCanvasEditCommitAll(preserveEditedPagesOnApply);
    setApplyToAllConfirmOpen(false);
    if (applyToAllPendingLeaveRef.current) {
      applyToAllPendingLeaveRef.current = false;
      setCanvasEditUnsavedDialogOpen(false);
      runPendingCanvasEditLeave();
    }
  }, [
    handleCanvasEditCommitAll,
    preserveEditedPagesOnApply,
    runPendingCanvasEditLeave,
  ]);

  const handleCanvasEditUnsavedCommitPage = useCallback(() => {
    if (unsavedDialogKind === 'crossword') {
      handleCrosswordCommitPageRef.current();
      setCanvasEditUnsavedDialogOpen(false);
      handleCrosswordEditCloseRef.current();
      runPendingCanvasEditLeave();
      return;
    }
    if (unsavedDialogKind === 'generic') {
      handleGenericPuzzleCommitAllRef.current();
      setCanvasEditUnsavedDialogOpen(false);
      handleGenericPuzzleEditCloseRef.current();
      runPendingCanvasEditLeave();
      return;
    }
    handleCanvasEditCommitPage();
    setCanvasEditUnsavedDialogOpen(false);
    const tabCloseId = pendingCanvasEditTabCloseIdRef.current;
    pendingCanvasEditTabCloseIdRef.current = null;
    if (tabCloseId) {
      removeCanvasEditTab(tabCloseId);
      pendingCanvasEditLeaveRef.current = null;
      return;
    }
    runPendingCanvasEditLeave();
  }, [
    unsavedDialogKind,
    handleCanvasEditCommitPage,
    removeCanvasEditTab,
    runPendingCanvasEditLeave,
  ]);

  const handleCanvasEditUnsavedCommitAll = useCallback(() => {
    if (unsavedDialogKind === 'crossword') {
      handleCrosswordCommitAllRef.current();
      setCanvasEditUnsavedDialogOpen(false);
      handleCrosswordEditCloseRef.current();
      runPendingCanvasEditLeave();
      return;
    }
    if (unsavedDialogKind === 'generic') {
      handleGenericPuzzleCommitAllRef.current();
      setCanvasEditUnsavedDialogOpen(false);
      handleGenericPuzzleEditCloseRef.current();
      runPendingCanvasEditLeave();
      return;
    }
    requestCanvasEditCommitAll(true);
  }, [unsavedDialogKind, requestCanvasEditCommitAll, runPendingCanvasEditLeave]);

  const handleCanvasEditUnsavedDiscard = useCallback(() => {
    setCanvasEditUnsavedDialogOpen(false);
    pendingCanvasEditTabCloseIdRef.current = null;
    if (unsavedDialogKind === 'crossword') {
      handleCrosswordEditCloseRef.current();
    } else if (unsavedDialogKind === 'generic') {
      handleGenericPuzzleEditCloseRef.current();
    }
    runPendingCanvasEditLeave();
  }, [unsavedDialogKind, runPendingCanvasEditLeave]);

  const openAllCanvasEditTabs = useCallback(
    (previewTab: 'puzzles' | 'solutions', activeTarget?: CanvasEditTarget) => {
      const targets = CANVAS_EDIT_TARGETS_BY_PREVIEW_TAB[previewTab];
      const desiredActiveTarget = activeTarget ?? targets[0];
      const desiredActiveTabId = makeCanvasEditTabId(desiredActiveTarget, previewTab);

      // Single-target mode: only keep the clicked element’s controls open (no multi-tab bar).
      const existing = canvasEditTabs.find((tab) => tab.id === desiredActiveTabId);
      if (
        existing &&
        canvasEditTabs.length === 1 &&
        activeCanvasEditTabId === desiredActiveTabId
      ) {
        return;
      }

      const session = canvasEditSession ?? createSessionForCurrentPage();
      if (!canvasEditSession) {
        setCanvasEditSession(session);
      }
      const snapshot = createSnapshotFromSession(session);

      setCanvasEditTabs([
        {
          id: desiredActiveTabId,
          target: desiredActiveTarget,
          previewTab,
          snapshot,
        },
      ]);
      setActiveCanvasEditTabId(desiredActiveTabId);
    },
    [
      activeCanvasEditTabId,
      canvasEditTabs,
      canvasEditSession,
      createSessionForCurrentPage,
    ]
  );

  const handleCanvasEditTabSelect = useCallback((tabId: string) => {
    setActiveCanvasEditTabId(tabId);
  }, []);

  const handleCanvasEditTabClose = useCallback(
    (tabId: string) => {
      guardCanvasEditTabClose(tabId, () => removeCanvasEditTab(tabId));
    },
    [guardCanvasEditTabClose, removeCanvasEditTab]
  );

  const handleCanvasEditTargetChange = useCallback(
    (target: CanvasEditTarget | null) => {
      if (target === null) return;
      openAllCanvasEditTabs(activePreviewTab, target);
    },
    [activePreviewTab, openAllCanvasEditTabs]
  );

  const skippedInitialCanvasEditAutoOpenRef = useRef(false);
  const prevAutoOpenPreviewTabRef = useRef(activePreviewTab);
  const openAllCanvasEditTabsRef = useRef(openAllCanvasEditTabs);
  openAllCanvasEditTabsRef.current = openAllCanvasEditTabs;

  useEffect(() => {
    if (!canvasEditEnabled) return;
    if (!skippedInitialCanvasEditAutoOpenRef.current) {
      skippedInitialCanvasEditAutoOpenRef.current = true;
      prevAutoOpenPreviewTabRef.current = activePreviewTab;
      return;
    }
    if (prevAutoOpenPreviewTabRef.current === activePreviewTab) return;
    prevAutoOpenPreviewTabRef.current = activePreviewTab;
    // Do not auto-open multi-target tabs; keep panel closed until the user clicks an element.
  }, [canvasEditEnabled, activePreviewTab]);

  const handlePreviewRangeModeChange = useCallback(
    (mode: 'sample' | 'all' | 'flipbook') => {
      const apply = () => {
        const busyLabel =
          mode === 'all'
            ? 'Opening all pages preview…'
            : mode === 'flipbook'
              ? 'Opening 3D book preview…'
              : null;
        let stopSoft: (() => void) | null = null;
        if (busyLabel) {
          showBusy(busyLabel, 6);
          // Soft progress while React mounts the heavy preview tree.
          let value = 6;
          const id = window.setInterval(() => {
            value = Math.min(92, value + (mode === 'all' ? 5 : 8));
            updateBusy({ progress: value });
            if (value >= 92) window.clearInterval(id);
          }, 70);
          stopSoft = () => {
            window.clearInterval(id);
            updateBusy({ progress: 100 });
          };
        }
        // Let the overlay paint before the heavy all-pages / flipbook render.
        window.requestAnimationFrame(() => {
          window.setTimeout(() => {
            try {
              setPreviewRangeMode(mode);
              if (mode !== 'sample') {
                closeCanvasEditPanel();
              }
    } finally {
              if (busyLabel) {
                stopSoft?.();
                window.setTimeout(() => hideBusy(), mode === 'all' ? 450 : 280);
              }
            }
          }, 30);
        });
      };
      if (hasCanvasEditPanelOpen && mode !== 'sample') {
        guardCanvasEditLeave(apply);
      } else {
        apply();
      }
    },
    [
      hasCanvasEditPanelOpen,
      guardCanvasEditLeave,
      closeCanvasEditPanel,
      setPreviewRangeMode,
      showBusy,
      updateBusy,
      hideBusy,
    ]
  );

  const handleCanvasEditUnsavedDialogOpenChange = useCallback((open: boolean) => {
    setCanvasEditUnsavedDialogOpen(open);
    if (!open) {
      pendingCanvasEditLeaveRef.current = null;
      pendingCanvasEditTabCloseIdRef.current = null;
    }
  }, []);

  const guardedSetActivePreviewTab = useCallback(
    (tab: 'puzzles' | 'solutions') => {
      if (tab === activePreviewTab && !previewShowBothPages) return;
      guardCanvasEditLeave(() => {
        if (tab === 'solutions') {
          setCurrentSolutionPageIndex(matchingSolutionPageIndex);
        } else {
          setCurrentBatchIndex(matchingBatchIndexFromSolution);
        }
        setPreviewShowBothPages(false);
        setActivePreviewTab(tab);
        // Edit controls stay closed until the user clicks an element on the new page.
        closeCanvasEditPanel();
      });
    },
    [
      activePreviewTab,
      previewShowBothPages,
      matchingSolutionPageIndex,
      matchingBatchIndexFromSolution,
      guardCanvasEditLeave,
      setActivePreviewTab,
      setCurrentBatchIndex,
      closeCanvasEditPanel,
    ]
  );

  const handlePreviewShowBothChange = useCallback(
    (checked: boolean) => {
      guardCanvasEditLeave(() => {
        if (checked) {
          if (activePreviewTab === 'solutions') {
            setCurrentBatchIndex(matchingBatchIndexFromSolution);
          } else {
            setCurrentSolutionPageIndex(matchingSolutionPageIndex);
          }
          closeCanvasEditPanel();
        }
        setPreviewShowBothPages(checked);
      });
    },
    [
      guardCanvasEditLeave,
      closeCanvasEditPanel,
      activePreviewTab,
      matchingBatchIndexFromSolution,
      matchingSolutionPageIndex,
      setCurrentBatchIndex,
    ]
  );

  const guardedSetActiveDocumentPageId = useCallback(
    (id: string) => {
      if (id === activeDocumentPageId) return;
      const targetPage = documentPages.find((page) => page.id === id);
      guardCanvasEditLeave(() => {
        if (targetPage && targetPage.moduleType !== 'word-search') {
          closeCanvasEditPanel();
        }
        setActiveDocumentPageId(id);
      });
    },
    [
      activeDocumentPageId,
      documentPages,
      guardCanvasEditLeave,
      setActiveDocumentPageId,
      closeCanvasEditPanel,
    ]
  );

  const guardedSetCurrentBatchIndex = useCallback(
    (index: number) => {
      if (index === currentBatchIndex) return;
      guardCanvasEditLeave(() => setCurrentBatchIndex(index));
    },
    [currentBatchIndex, guardCanvasEditLeave, setCurrentBatchIndex]
  );

  const handleBatchPageNavigationGuarded = useCallback(
    (value: string) => {
      const pageNum = Math.max(1, Math.min(batchPuzzles.length || 1, Number(value)));
      guardedSetCurrentBatchIndex(pageNum - 1);
      setBatchPageInputValue(pageNum.toString());
    },
    [batchPuzzles.length, guardedSetCurrentBatchIndex]
  );

  const handleDocumentPageNavigationGuarded = useCallback(
    (value: string) => {
      const pageNum = Math.max(1, Math.min(documentPages.length || 1, Number(value)));
      const target = documentPages[pageNum - 1];
      if (target) {
        guardedSetActiveDocumentPageId(target.id);
      }
      setDocumentPageInputValue(pageNum.toString());
    },
    [documentPages, guardedSetActiveDocumentPageId]
  );

  const goToPrevDocumentGuarded = useCallback(() => {
    if (canGoPrevDocument) {
      guardedSetActiveDocumentPageId(documentPages[activeDocumentIndex - 1].id);
    }
  }, [canGoPrevDocument, guardedSetActiveDocumentPageId, documentPages, activeDocumentIndex]);

  const goToNextDocumentGuarded = useCallback(() => {
    if (canGoNextDocument) {
      guardedSetActiveDocumentPageId(documentPages[activeDocumentIndex + 1].id);
    }
  }, [canGoNextDocument, guardedSetActiveDocumentPageId, documentPages, activeDocumentIndex]);

  const handleCanvasEditDraftSettingsChange = useCallback(
    (updater: (prev: WordSearchSettings) => WordSearchSettings) => {
      updateCanvasEditSession((session) => ({
        ...session,
        draft: updater(session.draft),
      }));
    },
    [updateCanvasEditSession]
  );

  const handleCanvasEditDraftTitleWordsChange = useCallback(
    (nextTitleWords: TitleWordsSettings) => {
      updateCanvasEditSession((session) => ({
        ...session,
        draftTitleWords: nextTitleWords,
      }));
    },
    [updateCanvasEditSession]
  );

  const handleCanvasEditDraftGridScaleChange = useCallback(
    (scale: number) => {
      updateCanvasEditSession((session) => ({
        ...session,
        draftPuzzleGridScale: scale,
      }));
    },
    [updateCanvasEditSession]
  );

  const canvasEditHasUnsavedChanges =
    canvasEditSession && canvasEditTabs.length > 0
      ? anyCanvasEditTabHasUnsavedEdits(canvasEditSession, canvasEditTabs)
      : false;
  const canvasEditCanApplyToAllPages = editSession
    ? canApplyCanvasEditsToAllPages(
        editSession,
          wordSearchSettings,
          puzzleGridScale,
          pageOverrides,
        pagePuzzleGridScales
      )
    : false;

  const canApplyToSelectedPages = useCallback(
    (rangeInput: string) => {
      if (!rangeInput.trim() || !editSession || canvasEditTabs.length === 0) {
        return false;
      }
      if (anyCanvasEditTabHasUnsavedEdits(editSession, canvasEditTabs)) {
        return true;
      }
      if (activeDocumentPuzzleCount < 1 || activeDocumentPuzzleStartIndex < 0) {
        return false;
      }

      const documentPages = parsePageRangeSelection(rangeInput, activeDocumentPuzzleCount);
      if (!documentPages) {
        return true;
      }

      const batchIndices = documentPagesToBatchIndices(
        documentPages,
        activeDocumentPuzzleStartIndex
      );

      return !selectedRangePagesMatchDraftForRangeApply(
        batchIndices,
        wordSearchSettings,
        pageOverrides,
        pagePuzzleGridScales,
        puzzleGridScale,
        editSession,
        canvasEditTabs
      );
    },
    [
      editSession,
      canvasEditTabs,
      activeDocumentPuzzleCount,
      activeDocumentPuzzleStartIndex,
      wordSearchSettings,
      pageOverrides,
      pagePuzzleGridScales,
      puzzleGridScale,
    ]
  );

  // Host Edit controls in Document · This tab (sidebar) instead of floating over the canvas.
  useEffect(() => {
    if (canvasEditEnabled && hasCanvasEditPanelOpen && editSession && canvasEditTarget) {
      setCanvasEditPanelProps({
        target: canvasEditTarget,
        pageKind: activePreviewTab === 'solutions' ? 'solution' : 'puzzle',
        pageIndex: currentBatchIndex,
        currentPuzzle: batchPuzzles[currentBatchIndex] ?? null,
        draftSettings: editSession.draft,
        onDraftSettingsChange: handleCanvasEditDraftSettingsChange,
        draftPuzzleGridScale: editSession.draftPuzzleGridScale,
        onDraftPuzzleGridScaleChange: handleCanvasEditDraftGridScaleChange,
        draftTitleWords: editSession.draftTitleWords,
        onDraftTitleWordsChange: handleCanvasEditDraftTitleWordsChange,
        onCommitPage: handleCanvasEditCommitPage,
        onCommitAll: () => requestCanvasEditCommitAll(false),
        onCommitRange: handleCanvasEditCommitRange,
        onCancel: handleCanvasEditCancel,
        hasUnsavedChanges: !!canvasEditHasUnsavedChanges,
        canApplyToAllPages: canvasEditCanApplyToAllPages,
        documentPuzzleCount: activeDocumentPuzzleCount,
        rangeError: canvasEditRangeError,
        canApplyToSelectedPages,
        // Single-element mode: no multi-tab bar in the sidebar.
        editTabs: undefined,
        activeEditTabId: null,
        onEditTabSelect: undefined,
        onEditTabClose: undefined,
      });
      return;
    }
    setCanvasEditPanelProps(null);
  }, [
    canvasEditEnabled,
    hasCanvasEditPanelOpen,
    editSession,
    canvasEditTarget,
    activePreviewTab,
    currentBatchIndex,
    batchPuzzles,
    handleCanvasEditDraftSettingsChange,
    handleCanvasEditDraftGridScaleChange,
    handleCanvasEditDraftTitleWordsChange,
    handleCanvasEditCommitPage,
    requestCanvasEditCommitAll,
    handleCanvasEditCommitRange,
    handleCanvasEditCancel,
    canvasEditHasUnsavedChanges,
    canvasEditCanApplyToAllPages,
    activeDocumentPuzzleCount,
    canvasEditRangeError,
    canApplyToSelectedPages,
    canvasEditPanelTabs,
    activeCanvasEditTabId,
    handleCanvasEditTabSelect,
    handleCanvasEditTabClose,
    setCanvasEditPanelProps,
  ]);

  useEffect(() => {
    return () => setCanvasEditPanelProps(null);
  }, [setCanvasEditPanelProps]);

  const handleCrosswordEditTargetChange = useCallback((target: CrosswordEditTarget) => {
    setCrosswordEditTarget(target);
    setCrosswordEditPanelOpen(true);
    setCrosswordDraft((prev) => prev ?? normalizeCrosswordSettings(crosswordSettings));
    setCrosswordDraftBaseline((prev) => prev ?? normalizeCrosswordSettings(crosswordSettings));
  }, [crosswordSettings]);

  const handleCrosswordEditClose = useCallback(() => {
    setCrosswordEditPanelOpen(false);
    setCrosswordEditTarget(null);
    setCrosswordDraft(null);
    setCrosswordDraftBaseline(null);
    setCrosswordRangeError(null);
  }, []);
  handleCrosswordEditCloseRef.current = handleCrosswordEditClose;

  const handleCrosswordDraftSettingsChange = useCallback(
    (updates: Partial<CrosswordSettings>) => {
      setCrosswordDraft((prev) => {
        const base = prev ?? normalizeCrosswordSettings(crosswordSettings);
        return normalizeCrosswordSettings({
          ...base,
          ...updates,
          core: updates.core ? { ...base.core, ...updates.core } : base.core,
          typography: updates.typography
            ? { ...base.typography, ...updates.typography }
            : base.typography,
          colors: updates.colors ? { ...base.colors, ...updates.colors } : base.colors,
          bookCanvas: updates.bookCanvas
            ? { ...base.bookCanvas, ...updates.bookCanvas }
            : base.bookCanvas,
          pageFrameSettings: updates.pageFrameSettings
            ? { ...(base.pageFrameSettings ?? {}), ...updates.pageFrameSettings }
            : base.pageFrameSettings,
        });
      });
    },
    [crosswordSettings]
  );

  const crosswordHasUnsavedChanges = useMemo(() => {
    if (!crosswordDraft || !crosswordDraftBaseline) return false;
    return JSON.stringify(crosswordDraft) !== JSON.stringify(crosswordDraftBaseline);
  }, [crosswordDraft, crosswordDraftBaseline]);

  crosswordUnsavedRef.current = crosswordEditPanelOpen && crosswordHasUnsavedChanges;

  const handleCrosswordCommitPage = useCallback(() => {
    if (!crosswordDraft || !crosswordHasUnsavedChanges) return;
    const index = currentBatchIndex;
    setPageCrosswordOverrides((prev) => {
      const next = new Map(prev);
      next.set(index, crosswordDraft);
      return next;
    });
    setCrosswordDraftBaseline(crosswordDraft);
    setCrosswordRangeError(null);
  }, [crosswordDraft, crosswordHasUnsavedChanges, currentBatchIndex]);
  handleCrosswordCommitPageRef.current = handleCrosswordCommitPage;

  const handleCrosswordCommitAll = useCallback(() => {
    if (!crosswordDraft) return;
    updateCrosswordSettings(crosswordDraft);
    setPageCrosswordOverrides(new Map());
    setCrosswordDraftBaseline(crosswordDraft);
    setCrosswordRangeError(null);
  }, [crosswordDraft, updateCrosswordSettings]);
  handleCrosswordCommitAllRef.current = handleCrosswordCommitAll;

  const handleCrosswordCommitRange = useCallback(
    (rangeInput: string) => {
      if (!crosswordDraft) return;
      if (activeCrosswordPuzzleCount < 1) {
        setCrosswordRangeError('No puzzles available in this document.');
        return;
      }
      const pages = parsePageRangeSelection(rangeInput, activeCrosswordPuzzleCount);
      if (!pages) {
        setCrosswordRangeError(
          `Enter a valid range between 1 and ${activeCrosswordPuzzleCount} (e.g. 1-4, 7-10, 12).`
        );
        return;
      }
      setCrosswordRangeError(null);
      setPageCrosswordOverrides((prev) => {
        const next = new Map(prev);
        for (const page of pages) {
          next.set(page - 1, crosswordDraft);
        }
        return next;
      });
      setCrosswordDraftBaseline(crosswordDraft);
    },
    [crosswordDraft, activeCrosswordPuzzleCount]
  );

  const canApplyCrosswordToSelectedPages = useCallback(
    (rangeInput: string) => {
      if (!rangeInput.trim()) return false;
      if (crosswordHasUnsavedChanges) return true;
      if (activeCrosswordPuzzleCount < 1) return false;
      const pages = parsePageRangeSelection(rangeInput, activeCrosswordPuzzleCount);
      return pages !== null;
    },
    [crosswordHasUnsavedChanges, activeCrosswordPuzzleCount]
  );

  const previewCrosswordSettings = useMemo(() => {
    if (crosswordEditPanelOpen && crosswordDraft) {
      return crosswordDraft;
    }
    const base = normalizeCrosswordSettings(crosswordSettings);
    const override = pageCrosswordOverrides.get(currentBatchIndex);
    if (!override) return base;
    return normalizeCrosswordSettings({
      ...base,
      ...override,
      core: override.core ? { ...base.core, ...override.core } : base.core,
      typography: override.typography
        ? { ...base.typography, ...override.typography }
        : base.typography,
      colors: override.colors ? { ...base.colors, ...override.colors } : base.colors,
      bookCanvas: override.bookCanvas
        ? { ...base.bookCanvas, ...override.bookCanvas }
        : base.bookCanvas,
      pageFrameSettings: override.pageFrameSettings
        ? { ...(base.pageFrameSettings ?? {}), ...override.pageFrameSettings }
        : base.pageFrameSettings,
    });
  }, [
    crosswordEditPanelOpen,
    crosswordDraft,
    crosswordSettings,
    pageCrosswordOverrides,
    currentBatchIndex,
  ]);

  // Sudoku/maze: live settings + per-page override for the current page.
  const previewGenericSettings = useMemo(() => {
    const override = pageGenericOverrides.get(currentBatchIndex);
    if (!override) return genericPuzzleSettings;
    return {
      core: override.core
        ? { ...genericPuzzleSettings.core, ...override.core }
        : genericPuzzleSettings.core,
      typography: override.typography
        ? { ...genericPuzzleSettings.typography, ...override.typography }
        : genericPuzzleSettings.typography,
      colors: override.colors
        ? { ...genericPuzzleSettings.colors, ...override.colors }
        : genericPuzzleSettings.colors,
    };
  }, [genericPuzzleSettings, pageGenericOverrides, currentBatchIndex]);

  useEffect(() => {
    if (
      crosswordCanvasEditEnabled &&
      crosswordEditPanelOpen &&
      crosswordDraft
    ) {
      setCrosswordPanelProps({
        settings: crosswordDraft,
        activeTarget: crosswordEditTarget ?? 'title',
        onTargetChange: handleCrosswordEditTargetChange,
        onSettingsChange: handleCrosswordDraftSettingsChange,
        onClose: () => guardCanvasEditLeave(() => handleCrosswordEditClose()),
        onCommitPage: handleCrosswordCommitPage,
        onCommitAll: handleCrosswordCommitAll,
        onCommitRange: handleCrosswordCommitRange,
        hasUnsavedChanges: crosswordHasUnsavedChanges,
        canApplyToAllPages:
          crosswordHasUnsavedChanges || pageCrosswordOverrides.size > 0,
        documentPuzzleCount: activeCrosswordPuzzleCount,
        rangeError: crosswordRangeError,
        canApplyToSelectedPages: canApplyCrosswordToSelectedPages,
      });
      return;
    }
    setCrosswordPanelProps(null);
  }, [
    crosswordCanvasEditEnabled,
    crosswordEditPanelOpen,
    crosswordDraft,
    crosswordEditTarget,
    handleCrosswordEditTargetChange,
    handleCrosswordDraftSettingsChange,
    handleCrosswordEditClose,
    handleCrosswordCommitPage,
    handleCrosswordCommitAll,
    handleCrosswordCommitRange,
    crosswordHasUnsavedChanges,
    pageCrosswordOverrides.size,
    activeCrosswordPuzzleCount,
    crosswordRangeError,
    canApplyCrosswordToSelectedPages,
    setCrosswordPanelProps,
    guardCanvasEditLeave,
  ]);

  useEffect(() => {
    return () => setCrosswordPanelProps(null);
  }, [setCrosswordPanelProps]);

  // ---- Generic puzzle (sudoku, cryptogram, maze, …) canvas edit ----
  const [genericPuzzleEditOpen, setGenericPuzzleEditOpen] = useState(false);
  const [genericPuzzleEditTarget, setGenericPuzzleEditTarget] =
    useState<GenericPuzzleEditTarget | null>(null);
  const [genericTitleDraft, setGenericTitleDraft] = useState<string | null>(null);
  const [genericTitleBaseline, setGenericTitleBaseline] = useState<string | null>(null);

  const genericPuzzleEditEnabled =
    previewRangeMode === 'sample' &&
    !previewShowBothPages &&
    !!activeDocumentPage &&
    isPuzzleModuleType(activeDocumentPage.moduleType) &&
    activeDocumentPage.moduleType !== 'word-search' &&
    activeDocumentPage.moduleType !== 'crossword';

  const genericPuzzleHasUnsavedChanges = useMemo(() => {
    if (genericTitleDraft == null || genericTitleBaseline == null) return false;
    return genericTitleDraft !== genericTitleBaseline;
  }, [genericTitleDraft, genericTitleBaseline]);

  genericPuzzleUnsavedRef.current = genericPuzzleEditOpen && genericPuzzleHasUnsavedChanges;

  const handleGenericPuzzleEditClose = useCallback(() => {
    setGenericPuzzleEditOpen(false);
    setGenericPuzzleEditTarget(null);
    setGenericTitleDraft(null);
    setGenericTitleBaseline(null);
  }, []);
  handleGenericPuzzleEditCloseRef.current = handleGenericPuzzleEditClose;

  const handleGenericPuzzleCommitAll = useCallback(() => {
    if (genericTitleDraft == null) return;
    setTitleWords({ ...titleWords, title: genericTitleDraft });
    setGenericTitleBaseline(genericTitleDraft);
  }, [genericTitleDraft, setTitleWords, titleWords]);
  handleGenericPuzzleCommitAllRef.current = handleGenericPuzzleCommitAll;

  const handleGenericPuzzleEditTargetChange = useCallback(
    (target: GenericPuzzleEditTarget) => {
      setGenericPuzzleEditTarget(target);
      setGenericPuzzleEditOpen(true);
      setGenericTitleDraft((prev) => prev ?? (titleWords.title || ''));
      setGenericTitleBaseline((prev) => prev ?? (titleWords.title || ''));
    },
    [titleWords.title]
  );

  useEffect(() => {
    if (genericPuzzleEditEnabled && genericPuzzleEditOpen && genericTitleDraft != null) {
      const label =
        activeDocumentPage?.moduleType
          ?.split('-')
          .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
          .join(' ') ?? 'Puzzle';
      setGenericPuzzlePanelProps({
        puzzleTypeLabel: label,
        titleText: genericTitleDraft,
        onTitleTextChange: setGenericTitleDraft,
        activeTarget: genericPuzzleEditTarget ?? 'title',
        onTargetChange: handleGenericPuzzleEditTargetChange,
        onClose: () => guardCanvasEditLeave(() => handleGenericPuzzleEditClose()),
        onCommitPage: handleGenericPuzzleCommitAll,
        onCommitAll: handleGenericPuzzleCommitAll,
        hasUnsavedChanges: genericPuzzleHasUnsavedChanges,
        canApplyToAllPages: genericPuzzleHasUnsavedChanges,
        documentPuzzleCount: 1,
      });
      return;
    }
    setGenericPuzzlePanelProps(null);
  }, [
    genericPuzzleEditEnabled,
    genericPuzzleEditOpen,
    genericTitleDraft,
    genericPuzzleEditTarget,
    activeDocumentPage?.moduleType,
    handleGenericPuzzleEditTargetChange,
    handleGenericPuzzleEditClose,
    handleGenericPuzzleCommitAll,
    genericPuzzleHasUnsavedChanges,
    guardCanvasEditLeave,
    setGenericPuzzlePanelProps,
  ]);

  useEffect(() => {
    return () => setGenericPuzzlePanelProps(null);
  }, [setGenericPuzzlePanelProps]);

  useEffect(() => {
    if (!genericPuzzleEditEnabled && genericPuzzleEditOpen) {
      handleGenericPuzzleEditClose();
      setGenericPuzzlePanelProps(null);
    }
  }, [
    genericPuzzleEditEnabled,
    genericPuzzleEditOpen,
    handleGenericPuzzleEditClose,
    setGenericPuzzlePanelProps,
  ]);

  useEffect(() => {
    if (!crosswordCanvasEditEnabled && crosswordEditPanelOpen) {
      handleCrosswordEditClose();
      setCrosswordPanelProps(null);
    }
  }, [
    crosswordCanvasEditEnabled,
    crosswordEditPanelOpen,
    handleCrosswordEditClose,
    setCrosswordPanelProps,
  ]);

  useEffect(() => {
    if (activeDocumentPage?.moduleType !== 'table-of-contents') {
      setTocEntries([]);
      return;
    }
    setTocEntries(compiledBook?.tocEntries ?? []);
  }, [activeDocumentPage?.moduleType, compiledBook?.tocEntries, setTocEntries]);

  const guardedInsertDocumentPage = useCallback(
    (type: InsertableDocumentKind, position: 'before' | 'after', referenceId: string) => {
      guardCanvasEditLeave(() => insertDocumentPage(type, position, referenceId));
    },
    [guardCanvasEditLeave, insertDocumentPage]
  );

  const guardedInsertDocumentWithAi = useCallback(
    (position: 'before' | 'after', referenceId: string) => {
      guardCanvasEditLeave(() => {
        setAiInsertPosition({ side: position, referenceId });
        setAiAppendOpen(true);
      });
    },
    [guardCanvasEditLeave]
  );

  const suppressCanvasGuides =
    (canvasEditEnabled && hasCanvasEditPanelOpen) ||
    (crosswordCanvasEditEnabled && crosswordEditPanelOpen) ||
    (genericPuzzleEditEnabled && genericPuzzleEditOpen);
  const canvasEditHighlightTarget = hasCanvasEditPanelOpen ? null : canvasEditTarget;
  const canvasEditHideGuides = hasCanvasEditPanelOpen;
  const crosswordEditHideGuides = crosswordEditPanelOpen;
  const textEditHideGuides = textPageEditEnabled && textPageEditPanelOpen;
  const displayShowMargins = showMargins && !suppressCanvasGuides;
  const displayShowSafetyZone = showSafetyZone && !suppressCanvasGuides;

  const renderCompiledBookPage = useCallback(
    (index: number) => {
      const page = compiledBookPagesForPreview[index];
      if (!page) return null;

      const compiledSettings =
        page.kind === 'puzzle'
          ? getSettingsForBatchIndex(getBatchIndexForCompiledPuzzlePage(page, batchPuzzles))
          : wordSearchSettings;
      const batchIdx =
        page.kind === 'puzzle'
          ? getBatchIndexForCompiledPuzzlePage(page, batchPuzzles)
          : 0;
      const compiledGridScale =
        page.kind === 'puzzle'
          ? getPuzzleGridScaleForPage(batchIdx, puzzleGridScale, pagePuzzleGridScales)
          : puzzleGridScale;
      const compiledHeaderTitleFontSizePt =
        page.kind === 'puzzle' && isHeaderAssemblyEnabled(compiledSettings)
          ? resolvePageHeaderTitleFontSizePt(page.puzzle, compiledSettings, titleWords)
          : null;

      return (
        <CompiledBookPageCanvas
          compiledPage={page}
          compiledPages={compiledBook?.pages ?? compiledBookPagesForPreview}
          documentPages={documentPagesForBook}
          titleWords={titleWords}
          wordSearchSettings={compiledSettings}
          showMargins={displayShowMargins}
          showSafetyZone={displayShowSafetyZone}
          safetyMarginPx={safetyMarginPx}
          ptToPx={ptToPx}
          puzzleGridScale={compiledGridScale}
          titleToAnswerGap={titleToAnswerGap}
          solutionToSolutionGap={solutionToSolutionGap}
          pageMargin={pageMargin}
          bookHeaderTitleFontSizePt={compiledHeaderTitleFontSizePt}
        />
      );
    },
    [
      compiledBook,
      compiledBookPagesForPreview,
      documentPagesForBook,
          titleWords,
          wordSearchSettings,
      batchPuzzles,
      getSettingsForBatchIndex,
      pagePuzzleGridScales,
      displayShowMargins,
      displayShowSafetyZone,
      safetyMarginPx,
      ptToPx,
          puzzleGridScale,
          titleToAnswerGap,
          solutionToSolutionGap,
      pageMargin,
    ]
  );

  const handleEditCompiledPage = useCallback(
    (page: CompiledPage) => {
      const navigate = () => {
        setPreviewRangeMode('sample');
        setActiveDocumentPageId(page.sourceDocumentId);

        if (page.kind === 'solution') {
          setActivePreviewTab('solutions');
          const docSolutionIndex =
            compiledBook?.pages
              .filter(
                (entry): entry is CompiledSolutionPage =>
                  entry.kind === 'solution' && entry.sourceDocumentId === page.sourceDocumentId
              )
              .findIndex((entry) => entry.bookPageIndex === page.bookPageIndex) ?? -1;
          if (docSolutionIndex >= 0) {
            setCurrentSolutionPageIndex(docSolutionIndex);
          }
          return;
        }

        if (page.kind === 'puzzle') {
          setActivePreviewTab('puzzles');
          const docStart = batchPuzzles.findIndex(
            (puzzle) => puzzle.pageId === page.sourceDocumentId
          );
          if (docStart >= 0) {
            setCurrentBatchIndex(docStart + page.puzzleIndexInDocument);
          }
          return;
        }

        if (page.kind === 'blank') {
          setActivePreviewTab('puzzles');
          const precedingPuzzle = [...(compiledBook?.pages ?? [])]
            .slice(0, page.bookPageIndex)
            .reverse()
            .find(
              (entry): entry is Extract<CompiledPage, { kind: 'puzzle' }> =>
                entry.kind === 'puzzle' && entry.sourceDocumentId === page.sourceDocumentId
            );
          if (precedingPuzzle) {
            const docStart = batchPuzzles.findIndex(
              (puzzle) => puzzle.pageId === precedingPuzzle.sourceDocumentId
            );
            if (docStart >= 0) {
              setCurrentBatchIndex(docStart + precedingPuzzle.puzzleIndexInDocument);
            }
          }
          return;
        }

        setActivePreviewTab('puzzles');
      };

      guardCanvasEditLeave(navigate);
    },
    [
      batchPuzzles,
      compiledBook,
      guardCanvasEditLeave,
      setActiveDocumentPageId,
      setActivePreviewTab,
      setPreviewRangeMode,
      setCurrentBatchIndex,
      setCurrentSolutionPageIndex,
    ]
  );

  const handleInsertSeparatorAfter = useCallback(
    (page: CompiledPage) => {
      if (page.kind === 'solution') return;
      guardCanvasEditLeave(() => {
        insertSeparatorTitlePageAfter(page);
        setPreviewRangeMode('all');
        setActivePreviewTab('puzzles');
      });
    },
    [
      guardCanvasEditLeave,
      insertSeparatorTitlePageAfter,
      setPreviewRangeMode,
      setActivePreviewTab,
    ]
  );

  const [pagePendingRemove, setPagePendingRemove] = useState<CompiledPage | null>(null);

  const getCompiledPageLabel = useCallback(
    (page: CompiledPage): string => {
      if (page.kind === 'text') {
        const doc = documentPages.find((entry) => entry.id === page.sourceDocumentId);
        return doc?.name || page.sourceDocumentName || 'Page';
      }
      if (page.kind === 'puzzle') {
        return `Puzzle ${(page.puzzleIndexInDocument ?? 0) + 1}`;
      }
      return page.sourceDocumentName || 'Page';
    },
    [documentPages]
  );

  const handleRequestRemoveCompiledPage = useCallback((page: CompiledPage) => {
    if (page.kind === 'solution' || page.kind === 'blank') return;
    setPagePendingRemove(page);
  }, []);

  const handleConfirmRemoveCompiledPage = useCallback(() => {
    if (!pagePendingRemove) return;
    removeCompiledBookPage(pagePendingRemove);
    setPagePendingRemove(null);
  }, [pagePendingRemove, removeCompiledBookPage]);

  const renderSampleDocumentPageCanvas = (tab: 'puzzles' | 'solutions') =>
    activeDocumentPage ? (
      <DocumentPageCanvas
        page={activeDocumentPage}
        activeDocumentPageId={activeDocumentPageId}
        currentPuzzleType={currentPuzzleType}
        currentPuzzle={currentPuzzle}
        batchPuzzles={batchPuzzles}
        currentBatchIndex={currentBatchIndex}
        activePreviewTab={tab}
        previewRangeMode={previewRangeMode}
        wordSearchSettings={previewWordSearchSettings}
        titleWords={previewTitleWords}
        showSolution={showSolution}
        showMargins={displayShowMargins}
        showSafetyZone={displayShowSafetyZone}
        safetyMarginPx={safetyMarginPx}
        ptToPx={ptToPx}
        puzzleGridScale={previewPuzzleGridScale}
        titleToAnswerGap={titleToAnswerGap}
        solutionToSolutionGap={solutionToSolutionGap}
        pageMargin={pageMargin}
        bookHeaderTitleFontSizePt={headerTitleFontSizeForSample}
        currentSolutionPageIndex={currentSolutionPageIndex}
        compiledSolutionPages={compiledSolutionPagesForActiveDoc}
        canvasEditEnabled={canvasEditEnabled}
        canvasEditTarget={canvasEditTarget}
        canvasEditHighlightTarget={canvasEditHighlightTarget}
        canvasEditHideGuides={canvasEditHideGuides}
        onCanvasEditTargetChange={handleCanvasEditTargetChange}
        textEditEnabled={textPageEditEnabled}
        textEditTarget={textPageEditTarget}
        textEditHideGuides={textEditHideGuides}
        onTextEditTargetChange={handleTextEditTargetChange}
        onTextSettingsChange={handleTextSettingsChange}
        selectedTextBlockId={selectedTextBlockId}
        showTextBlockChrome={textPageBlockChromeVisible}
        onSelectTextBlock={handleSelectTextBlock}
        onCanvasBackgroundClick={handleCanvasBackgroundClick}
        onDeleteTextBlock={handleDeleteTextBlock}
        canvasScale={previewZoom / 100}
        compiledBook={compiledBook}
        onTocCanvasClick={handleTocCanvasClick}
        crosswordSettings={previewCrosswordSettings}
        crosswordBatchPuzzles={crosswordBatchPuzzles}
        genericPuzzleSettings={previewGenericSettings}
        genericBatchPuzzles={genericBatchPuzzles}
        murdokuSettings={murdokuSettings}
        murdokuBatchPuzzles={murdokuBatchPuzzles}
        crosswordCanvasEditEnabled={crosswordCanvasEditEnabled}
        crosswordEditTarget={crosswordEditTarget}
        crosswordEditHideGuides={crosswordEditHideGuides}
        onCrosswordEditTargetChange={handleCrosswordEditTargetChange}
        genericPuzzleCanvasEditEnabled={genericPuzzleEditEnabled}
        genericPuzzleEditHideGuides={genericPuzzleEditOpen}
        onGenericPuzzleEditTargetChange={handleGenericPuzzleEditTargetChange}
      />
    ) : null;

  const renderShowBothCheckbox = () => (
    <Checkbox
      compact
      label="Show both"
      checked={previewShowBothPages}
      onCheckedChange={handlePreviewShowBothChange}
    />
  );

  return (
    <div className="flex-1 flex flex-col h-full min-h-0 bg-slate-50 relative">
      <RemoveDocumentConfirmDialog
        open={pagePendingRemove !== null}
        onOpenChange={(open) => {
          if (!open) setPagePendingRemove(null);
        }}
        pageName={pagePendingRemove ? getCompiledPageLabel(pagePendingRemove) : ''}
        onConfirm={handleConfirmRemoveCompiledPage}
      />

      {/* Validation Error Display */}
      {validationError && (
        <div
          className={`px-4 py-3 border-b flex-shrink-0 shadow-sm z-10 ${
            validationError.type === 'error'
              ? 'bg-amber-50 border-amber-200 dark:bg-amber-950/40 dark:border-amber-800'
              : 'bg-[var(--gp-grey-100)] border-[var(--gp-grey-200)]'
          }`}
        >
          <div className="flex items-start gap-2">
            <AlertCircle
              className={`w-5 h-5 flex-shrink-0 mt-0.5 ${
                validationError.type === 'error' ? 'text-amber-600' : 'text-[var(--gp-blue)]'
              }`}
            />
            <p className="text-sm text-[var(--gp-black)] dark:text-slate-100 flex-1">
              {validationError.message}
            </p>
            <button
              type="button"
              className="text-xs font-semibold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
              onClick={() => clearValidationError()}
              aria-label="Dismiss"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* KDP Rejection Warning */}
      {hasPuzzles && hasKDPIssue && (
        <div className="mx-4 mt-3 p-3 bg-[var(--gp-grey-100)] border border-[var(--gp-grey-200)] rounded-xl flex items-start gap-2 shadow-sm z-10 animate-fade-in">
          <AlertCircle className="w-5 h-5 text-[var(--gp-blue)] flex-shrink-0 mt-0.5 animate-pulse" />
          <div>
            <h4 className="text-xs font-bold text-[var(--gp-black)]">KDP Print Safety Warning</h4>
            <p className="text-[11px] text-[var(--gp-grey-800)] mt-0.5 leading-relaxed">
              Some design layout elements exceed the boundary limit of the KDP Safe Zone ({includeBleed ? '0.375"' : '0.25"'} margin).
              This could trigger automated print rejection or cause characters to get chopped in final trim.
              <strong> Adjust margins or decrease puzzle grid scale</strong> in sidebar settings to resolve.
            </p>
          </div>
        </div>
      )}

      {/* Main Workspace Layout */}
      <div className="flex-1 flex flex-col md:flex-row gap-0 overflow-hidden min-h-0">

        {/* LEFT SIDE: Interactive Canvas Preview Area */}
        <div className={cn('preview-canvas-column flex-1 flex flex-col min-h-0 overflow-hidden', !isFlipbookPreview && 'bg-slate-100')}>

          {/* Document tabs — hidden in all-pages & flipbook preview */}
          {!isLockedPreview && (
            <CanvasDocumentTabsBar
              documentPages={documentPages}
              activeDocumentPageId={activeDocumentPageId}
              onSelect={guardedSetActiveDocumentPageId}
              onRemove={removeDocumentPage}
              onDuplicate={duplicateDocumentPage}
              onRename={(id, name) => updateDocumentPage(id, { name })}
              onReorder={reorderDocumentPages}
              onInsert={guardedInsertDocumentPage}
              onUseAi={guardedInsertDocumentWithAi}
              canUndo={canUndo}
              canRedo={canRedo}
              onUndo={undo}
              onRedo={redo}
            />
          )}

          {/* Top Canvas Toolbar */}
          {!isFlipbookPreview && (
          <div className={cn('preview-top-toolbar', hasPreviewPages ? 'bg-white' : 'bg-white/80 backdrop-blur-md', isAllPagesPreview && 'preview-top-toolbar--all-pages')}>
            <div className="preview-top-toolbar__primary">
              <div className="preview-top-toolbar__title">
                <Layout className="w-4 h-4 text-slate-500 shrink-0" />
                <span className="hidden sm:inline text-xs font-bold text-slate-700 uppercase tracking-wider truncate">
                  {isAllPagesPreview ? 'All Pages Preview' : 'Canvas Workspace'}
                </span>
                {isAllPagesPreview && (
                  <span className="sm:hidden text-xs font-bold text-slate-700 uppercase tracking-wider">
                    All Pages
                  </span>
                )}
              </div>

              {!isAllPagesPreview && (
              <div className="preview-top-toolbar__guides preview-top-toolbar__guides--mobile">
                <Checkbox compact label="Margins" checked={showMargins} onCheckedChange={setShowMargins} />
                <Checkbox
                  compact
                  label="KDP Safe"
                  checked={showSafetyZone}
                  onCheckedChange={setShowSafetyZone}
                />
              </div>
              )}

              {isAllPagesPreview && (
                    <button
                      type="button"
                  className="preview-all-pages-close"
                  title="Close all pages preview"
                  aria-label="Close all pages preview and return to single page"
                  onClick={() => handlePreviewRangeModeChange('sample')}
                >
                  <X className="h-4 w-4" strokeWidth={2.5} />
                  <span className="preview-all-pages-close__label">Close</span>
                </button>
              )}
            </div>

            <div className="preview-top-toolbar__controls">
              {showPuzzleSolutionTabs && (
              <div className="preview-puzzle-solution-controls">
              <div className="preview-segmented">
                    <button
                      type="button"
                  onClick={() => guardedSetActivePreviewTab('puzzles')}
                  className={cn(
                    'preview-segmented__btn',
                    !previewShowBothPages && activePreviewTab === 'puzzles'
                      ? 'preview-segmented__btn--active'
                      : 'preview-segmented__btn--inactive'
                  )}
                    >
                      Puzzles Page
                    </button>
                    <button
                      type="button"
                  onClick={() => guardedSetActivePreviewTab('solutions')}
                  className={cn(
                    'preview-segmented__btn',
                    !previewShowBothPages && activePreviewTab === 'solutions'
                      ? 'preview-segmented__btn--active'
                      : 'preview-segmented__btn--inactive'
                  )}
                    >
                      Solutions Page
                    </button>
                  </div>
                  {renderShowBothCheckbox()}
                  </div>
              )}

              <div className="preview-segmented">
                    <button
                      type="button"
                  onClick={() => handlePreviewRangeModeChange('sample')}
                  className={cn(
                    'preview-segmented__btn',
                    previewRangeMode === 'sample'
                      ? 'preview-segmented__btn--active'
                      : 'preview-segmented__btn--inactive'
                  )}
                    >
                      Sample
                    </button>
                    <button
                      type="button"
                  onClick={() => handlePreviewRangeModeChange('flipbook')}
                  className={cn(
                    'preview-segmented__btn preview-segmented__btn--icon',
                    isFlipbookPreview
                      ? 'preview-segmented__btn--active'
                      : 'preview-segmented__btn--inactive'
                  )}
                  title="3D Book Preview"
                  aria-label="3D Book Preview"
                >
                  <BookOpen className="h-3.5 w-3.5" />
                    </button>
              </div>
            </div>

            <div className="preview-top-toolbar__guides preview-top-toolbar__guides--desktop">
              {!isAllPagesPreview ? (
                <>
                  <Checkbox compact label="Margins" checked={showMargins} onCheckedChange={setShowMargins} />
                  <Checkbox compact label="KDP Bleed Safe Zone" checked={showSafetyZone} onCheckedChange={setShowSafetyZone} />
                </>
              ) : (
                <button
                  type="button"
                  className="preview-all-pages-close"
                  title="Close all pages preview"
                  aria-label="Close all pages preview and return to single page"
                  onClick={() => handlePreviewRangeModeChange('sample')}
                >
                  <X className="h-4 w-4" strokeWidth={2.5} />
                  <span className="preview-all-pages-close__label">Close</span>
                </button>
              )}
            </div>
          </div>
          )}

          {/* Compact controls for tablet / narrow layouts */}
          {!isFlipbookPreview && (
          <div className="preview-compact-toolbar">
            <div className="preview-compact-toolbar__grid">
              {showPuzzleSolutionTabs && (
              <div className="flex flex-col gap-1">
                <span className="preview-compact-toolbar__label">Active Tab</span>
                <div className="preview-puzzle-solution-controls">
                <div className="preview-segmented w-full">
                  <button
                    type="button"
                    onClick={() => guardedSetActivePreviewTab('puzzles')}
                    className={cn(
                      'preview-segmented__btn flex-1 text-center',
                      !previewShowBothPages && activePreviewTab === 'puzzles'
                        ? 'preview-segmented__btn--active'
                        : 'preview-segmented__btn--inactive'
                    )}
                  >
                    Puzzles
                  </button>
                  <button
                    type="button"
                    onClick={() => guardedSetActivePreviewTab('solutions')}
                    className={cn(
                      'preview-segmented__btn flex-1 text-center',
                      !previewShowBothPages && activePreviewTab === 'solutions'
                        ? 'preview-segmented__btn--active'
                        : 'preview-segmented__btn--inactive'
                    )}
                  >
                    Solutions
                  </button>
                </div>
                {renderShowBothCheckbox()}
                </div>
              </div>
              )}

              <div className="flex flex-col gap-1">
                <span className="preview-compact-toolbar__label">Layout Mode</span>
                <div className="preview-segmented w-full">
                  <button
                    type="button"
                    onClick={() => handlePreviewRangeModeChange('sample')}
                    className={cn(
                      'preview-segmented__btn flex-1 text-center',
                      previewRangeMode === 'sample'
                        ? 'preview-segmented__btn--active'
                        : 'preview-segmented__btn--inactive'
                    )}
                  >
                    Sample
                  </button>
                  <button
                    type="button"
                    onClick={() => handlePreviewRangeModeChange('all')}
                    className={cn(
                      'preview-segmented__btn preview-segmented__btn--icon flex-1 justify-center',
                      isAllPagesPreview
                        ? 'preview-segmented__btn--active'
                        : 'preview-segmented__btn--inactive'
                    )}
                    title="All Pages Preview"
                    aria-label="All Pages Preview"
                  >
                    <Files className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handlePreviewRangeModeChange('flipbook')}
                    className={cn(
                      'preview-segmented__btn preview-segmented__btn--icon flex-1 justify-center',
                      isFlipbookPreview
                        ? 'preview-segmented__btn--active'
                        : 'preview-segmented__btn--inactive'
                    )}
                    title="3D Book Preview"
                    aria-label="3D Book Preview"
                  >
                    <BookOpen className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </div>

            <div className="preview-compact-toolbar__zoom">
              <span className="preview-compact-toolbar__label">Zoom</span>
              <div className="preview-compact-toolbar__zoom-controls">
                <button
                  type="button"
                  onClick={() => setPreviewZoom(Math.max(25, previewZoom - 5))}
                  className="preview-zoom-btn"
                  aria-label="Zoom out"
                >
                  −
                </button>
                <span className="text-xs font-bold text-slate-700 min-w-[2.5rem] text-center">{previewZoom}%</span>
                <button
                  type="button"
                  onClick={() => setPreviewZoom(Math.min(150, previewZoom + 5))}
                  className="preview-zoom-btn"
                  aria-label="Zoom in"
                >
                  +
                </button>
              </div>
            </div>
          </div>
          )}

          {/* Interactive Page Viewport Container */}
          <div
            className={cn(
              'preview-viewport',
              isFlipbookPreview && 'preview-viewport--flipbook',
              isAllPagesPreview && 'preview-viewport--all-pages',
              textPageEditEnabled && 'preview-viewport--text-edit',
              spacePanActive && 'preview-viewport--hand-tool',
              handDragActive && 'preview-viewport--hand-tool--dragging'
            )}
            ref={previewViewportRef}
            onPointerDown={handleViewportPointerDown}
            onPointerMove={handleViewportPointerMove}
            onPointerUp={handleViewportPointerUp}
            onPointerCancel={handleViewportPointerUp}
          >
            {canvasEditEnabled && !hasCanvasEditPanelOpen && (
              <span className="canvas-edit-hint">
                {activePreviewTab === 'solutions'
                  ? 'Click an area to edit · drag panel header to move · minimize to preview'
                  : 'Click an area to edit · drag panel header to move · minimize to preview'}
              </span>
            )}
            {textPageEditEnabled && (
              <span className="canvas-edit-hint">
                {activeDocumentPage?.moduleType === 'table-of-contents'
                  ? 'Edit controls are open in Document · This tab'
                  : activeDocumentPage?.moduleType === 'title-page'
                    ? 'Drag elements to move · click text to edit · use Document · This tab'
                    : 'Edit this page in Document · This tab'}
              </span>
            )}
            {canvasEditEnabled && hasCanvasEditPanelOpen && (
              <span className="canvas-edit-hint">
                Edit controls are open in Document · This tab
              </span>
            )}
            {crosswordCanvasEditEnabled && crosswordEditPanelOpen && (
              <span className="canvas-edit-hint">
                Edit controls are open in Document · This tab
              </span>
            )}
            {crosswordCanvasEditEnabled && !crosswordEditPanelOpen && (
              <span className="canvas-edit-hint">
                Click title, grid, or clues to open edit controls
              </span>
            )}
            {hasPuzzles || hasPreviewPages ? (
              isFlipbookPreview ? (
                <BookFlipbookViewer
                  className="w-full h-full"
                  pageCount={Math.max(1, compiledBookPagesForPreview.length)}
                  pageWidthPx={widthPx}
                  pageHeightPx={heightPx}
                  renderPage={renderCompiledBookPage}
                  onClose={() => handlePreviewRangeModeChange('sample')}
                  onEditPage={(index) => {
                    const page = compiledBookPagesForPreview[index];
                    if (page) handleEditCompiledPage(page);
                  }}
                />
              ) : previewRangeMode === 'sample' && hasPreviewPages && activeDocumentPage ? (
                <div className="flex items-center justify-center w-full min-h-full py-4">
                  <div
                    className={cn(
                      'origin-top transition-transform duration-200 shrink-0 preview-canvas-scale',
                      previewShowBothPages && 'preview-both-pages-scale',
                      textPageEditEnabled && 'preview-canvas-scale--text-edit'
                    )}
                style={{
                  transform: `scale(${previewZoom / 100})`,
                  transformOrigin: 'top center',
                  width: previewShowBothPages ? undefined : widthPx,
                  overflow: 'visible',
                  ['--preview-page-width' as string]: `${widthPx}px`,
                }}
              >
                      {previewShowBothPages ? (
                        <div className="preview-both-pages">
                          <div className="preview-both-pages__pane">
                            <span className="preview-both-pages__label">Puzzle page</span>
                            {renderSampleDocumentPageCanvas('puzzles')}
                          </div>
                          <div className="preview-both-pages__pane">
                            <span className="preview-both-pages__label">Solution page</span>
                            {renderSampleDocumentPageCanvas('solutions')}
                          </div>
                        </div>
                      ) : (
                        renderSampleDocumentPageCanvas(activePreviewTab)
                      )}
                    </div>
                </div>
              ) : isAllPagesPreview ? (
                <AllPagesGridPreview
                  zoom={previewZoom}
                  pageWidthPx={widthPx}
                  pageHeightPx={heightPx}
                >
                  {hasPreviewPages && compiledBook
                    ? compiledBookPagesForPreview.map((compiledPage, idx) => (
                        <AllPagesGridPreview.Item
                          key={`compiled-preview-${compiledPage.bookPageIndex}-${compiledPage.sourceDocumentId}-${idx}`}
                          itemRef={(el) => {
                            if (el) compiledPageRefs.current[idx] = el;
                          }}
                          onEdit={() => handleEditCompiledPage(compiledPage)}
                          onRemove={
                            compiledPage.kind === 'text' || compiledPage.kind === 'puzzle'
                              ? () => handleRequestRemoveCompiledPage(compiledPage)
                              : undefined
                          }
                        >
                          {renderCompiledBookPage(idx)}
                        </AllPagesGridPreview.Item>
                      ))
                    : hasPreviewPages && activePreviewTab === 'solutions'
                      ? bookSolutionPreviewEntries.map((entry, idx) => {
                          const compiledSolution = compiledBook?.pages.find(
                            (page): page is CompiledSolutionPage =>
                              page.kind === 'solution' &&
                              page.bookPageIndex === entry.bookPageIndex &&
                              page.sourceDocumentId === entry.sourceDocumentId
                          );
                          return (
                            <AllPagesGridPreview.Item
                              key={`book-solution-${entry.bookPageIndex}-${entry.sourceDocumentId}`}
                              itemRef={(el) => {
                                if (el) solutionPageRefs.current[idx] = el;
                              }}
                              onEdit={
                                compiledSolution
                                  ? () => handleEditCompiledPage(compiledSolution)
                                  : () => {
                                      guardCanvasEditLeave(() => {
                                        setPreviewRangeMode('sample');
                                        setActiveDocumentPageId(entry.sourceDocumentId);
                                        setActivePreviewTab('solutions');
                                        const docSolutionIndex =
                                          compiledBook?.pages
                                            .filter(
                                              (p): p is CompiledSolutionPage =>
                                                p.kind === 'solution' &&
                                                p.sourceDocumentId === entry.sourceDocumentId
                                            )
                                            .findIndex(
                                              (p) => p.bookPageIndex === entry.bookPageIndex
                                            ) ?? -1;
                                        if (docSolutionIndex >= 0) {
                                          setCurrentSolutionPageIndex(docSolutionIndex);
                                        }
                                      });
                                    }
                              }
                            >
                              <SolutionsPageCanvas
                                puzzles={entry.puzzles}
                                settings={entry.settings}
                                titleWords={entry.titleWords}
                                pageIndex={entry.pageIndex}
                                bookPageIndex={entry.bookPageIndex}
                                showMargins={displayShowMargins}
                                showSafetyZone={displayShowSafetyZone}
                                safetyMarginPx={safetyMarginPx}
                                ptToPx={ptToPx}
                                titleToAnswerGap={titleToAnswerGap}
                                solutionToSolutionGap={solutionToSolutionGap}
                                pageMargin={pageMargin}
                              />
                            </AllPagesGridPreview.Item>
                          );
                        })
                      : hasPreviewPages
                        ? documentPagesToRender.map((page) => (
                            <AllPagesGridPreview.Item
                              key={page.id}
                              onEdit={() => {
                                guardCanvasEditLeave(() => {
                                  setPreviewRangeMode('sample');
                                  closeCanvasEditPanel();
                                  setActiveDocumentPageId(page.id);
                                });
                              }}
                            >
                              <DocumentPageCanvas
                                page={page}
                                activeDocumentPageId={activeDocumentPageId}
                                currentPuzzleType={currentPuzzleType}
                                currentPuzzle={currentPuzzle}
                                batchPuzzles={batchPuzzles}
                                currentBatchIndex={currentBatchIndex}
                                activePreviewTab={activePreviewTab}
                                previewRangeMode={previewRangeMode}
                                wordSearchSettings={wordSearchSettings}
                        titleWords={titleWords}
                        showSolution={showSolution}
                                showMargins={displayShowMargins}
                                showSafetyZone={displayShowSafetyZone}
                        safetyMarginPx={safetyMarginPx}
                        ptToPx={ptToPx}
                        puzzleGridScale={puzzleGridScale}
                                titleToAnswerGap={titleToAnswerGap}
                                solutionToSolutionGap={solutionToSolutionGap}
                                pageMargin={pageMargin}
                                bookHeaderTitleFontSizePt={headerTitleFontSizeForSample}
                                currentSolutionPageIndex={currentSolutionPageIndex}
                                compiledSolutionPages={compiledSolutionPagesForActiveDoc}
                                canvasEditEnabled={canvasEditEnabled}
                                canvasEditTarget={canvasEditTarget}
                                canvasEditHighlightTarget={canvasEditHighlightTarget}
                                canvasEditHideGuides={canvasEditHideGuides}
                                onCanvasEditTargetChange={handleCanvasEditTargetChange}
                                compiledBook={compiledBook}
                                crosswordSettings={crosswordSettings}
                                crosswordBatchPuzzles={crosswordBatchPuzzles}
                                genericPuzzleSettings={genericPuzzleSettings}
                                genericBatchPuzzles={genericBatchPuzzles}
                                murdokuSettings={murdokuSettings}
                                murdokuBatchPuzzles={murdokuBatchPuzzles}
                                crosswordCanvasEditEnabled={false}
                              />
                            </AllPagesGridPreview.Item>
                          ))
                        : activePreviewTab === 'puzzles'
                          ? batchPuzzles.map((puzzle, idx) => (
                              <AllPagesGridPreview.Item
                          key={puzzle.id || idx}
                                itemRef={(el) => {
                                  if (el) puzzlePageRefs.current[idx] = el;
                                }}
                                onEdit={() => {
                                  guardCanvasEditLeave(() => {
                                    setPreviewRangeMode('sample');
                                    setActivePreviewTab('puzzles');
                                    if (puzzle.pageId) {
                                      setActiveDocumentPageId(puzzle.pageId);
                                    }
                                    setCurrentBatchIndex(idx);
                                  });
                                }}
                        >
                          <PuzzlePageCanvas
                            puzzle={puzzle}
                            settings={wordSearchSettings}
                            titleWords={titleWords}
                            showSolution={showSolution}
                                  showMargins={displayShowMargins}
                                  showSafetyZone={displayShowSafetyZone}
                            safetyMarginPx={safetyMarginPx}
                            ptToPx={ptToPx}
                            puzzleGridScale={puzzleGridScale}
                                  bookHeaderTitleFontSizePt={headerTitleFontSizeForSample}
                                  bookPageIndex={computePuzzleBookPageIndex(
                                    idx,
                                    includeBlankAfterEachPuzzle
                                  )}
                                />
                              </AllPagesGridPreview.Item>
                            ))
                          : solutionPages.map((pagePuzzles, pageIdx) => (
                              <AllPagesGridPreview.Item
                                key={pageIdx}
                                itemRef={(el) => {
                                  if (el) solutionPageRefs.current[pageIdx] = el;
                                }}
                                onEdit={() => {
                                  guardCanvasEditLeave(() => {
                                    setPreviewRangeMode('sample');
                                    setActivePreviewTab('solutions');
                                    setCurrentSolutionPageIndex(pageIdx);
                                  });
                                }}
                              >
                      <SolutionsPageCanvas
                                  puzzles={pagePuzzles}
                        settings={wordSearchSettings}
                        titleWords={titleWords}
                                  pageIndex={pageIdx}
                                  bookPageIndex={computeSolutionBookPageIndex(
                                    batchPuzzles.length,
                                    pageIdx,
                                    includeBlankAfterEachPuzzle
                                  )}
                                  showMargins={displayShowMargins}
                                  showSafetyZone={displayShowSafetyZone}
                        safetyMarginPx={safetyMarginPx}
                        ptToPx={ptToPx}
                        titleToAnswerGap={titleToAnswerGap}
                        solutionToSolutionGap={solutionToSolutionGap}
                        pageMargin={pageMargin}
                      />
                              </AllPagesGridPreview.Item>
                            ))}
                </AllPagesGridPreview>
              ) : (
              <div
                className="origin-top transition-transform duration-200 flex flex-col items-center"
                style={{
                  transform: `scale(${previewZoom / 100})`,
                  transformOrigin: 'top center',
                  width: widthPx,
                }}
              >
                {hasPreviewPages ? (
                  documentPagesToRender.map((page) => (
                    <div key={page.id} className="w-full pb-10">
                      <DocumentPageCanvas
                        page={page}
                        activeDocumentPageId={activeDocumentPageId}
                        currentPuzzleType={currentPuzzleType}
                        currentPuzzle={currentPuzzle}
                        batchPuzzles={batchPuzzles}
                        currentBatchIndex={currentBatchIndex}
                        activePreviewTab={activePreviewTab}
                        previewRangeMode={previewRangeMode}
                        wordSearchSettings={wordSearchSettings}
                            titleWords={titleWords}
                        showSolution={showSolution}
                        showMargins={displayShowMargins}
                        showSafetyZone={displayShowSafetyZone}
                            safetyMarginPx={safetyMarginPx}
                            ptToPx={ptToPx}
                        puzzleGridScale={puzzleGridScale}
                            titleToAnswerGap={titleToAnswerGap}
                            solutionToSolutionGap={solutionToSolutionGap}
                            pageMargin={pageMargin}
                        bookHeaderTitleFontSizePt={headerTitleFontSizeForSample}
                        currentSolutionPageIndex={currentSolutionPageIndex}
                        compiledSolutionPages={compiledSolutionPagesForActiveDoc}
                        canvasEditEnabled={canvasEditEnabled}
                        canvasEditTarget={canvasEditTarget}
                        canvasEditHighlightTarget={canvasEditHighlightTarget}
                        canvasEditHideGuides={canvasEditHideGuides}
                        onCanvasEditTargetChange={handleCanvasEditTargetChange}
                        textEditEnabled={textPageEditEnabled}
                        textEditTarget={textPageEditTarget}
                        textEditHideGuides={textEditHideGuides}
                        onTextEditTargetChange={handleTextEditTargetChange}
                        onTextSettingsChange={handleTextSettingsChange}
                        selectedTextBlockId={selectedTextBlockId}
                        showTextBlockChrome={textPageBlockChromeVisible}
                        onSelectTextBlock={handleSelectTextBlock}
                        onCanvasBackgroundClick={handleCanvasBackgroundClick}
                        onDeleteTextBlock={handleDeleteTextBlock}
                        canvasScale={previewZoom / 100}
                        compiledBook={compiledBook}
                        onTocCanvasClick={handleTocCanvasClick}
                        crosswordSettings={previewCrosswordSettings}
                        crosswordBatchPuzzles={crosswordBatchPuzzles}
                        genericPuzzleSettings={previewGenericSettings}
                        genericBatchPuzzles={genericBatchPuzzles}
                        murdokuSettings={murdokuSettings}
                        murdokuBatchPuzzles={murdokuBatchPuzzles}
                        crosswordCanvasEditEnabled={crosswordCanvasEditEnabled}
                        crosswordEditTarget={crosswordEditTarget}
                        crosswordEditHideGuides={crosswordEditHideGuides}
                        onCrosswordEditTargetChange={handleCrosswordEditTargetChange}
                        genericPuzzleCanvasEditEnabled={genericPuzzleEditEnabled}
                        genericPuzzleEditHideGuides={genericPuzzleEditOpen}
                        onGenericPuzzleEditTargetChange={handleGenericPuzzleEditTargetChange}
                          />
                        </div>
                  ))
                ) : activePreviewTab === 'puzzles' ? (
                  batchPuzzles[currentBatchIndex] ? (
                    <PuzzlePageCanvas
                      puzzle={batchPuzzles[currentBatchIndex]}
                      settings={previewWordSearchSettings}
                      titleWords={previewTitleWords}
                      showSolution={showSolution}
                      showMargins={displayShowMargins}
                      showSafetyZone={displayShowSafetyZone}
                      safetyMarginPx={safetyMarginPx}
                      ptToPx={ptToPx}
                      puzzleGridScale={previewPuzzleGridScale}
                      bookHeaderTitleFontSizePt={headerTitleFontSizeForSample}
                      bookPageIndex={computePuzzleBookPageIndex(
                        currentBatchIndex,
                        includeBlankAfterEachPuzzle
                      )}
                      canvasEditEnabled={canvasEditEnabled}
                      canvasEditTarget={canvasEditTarget}
                      canvasEditHighlightTarget={canvasEditHighlightTarget}
                      canvasEditHideGuides={canvasEditHideGuides}
                      onCanvasEditTargetChange={handleCanvasEditTargetChange}
                    />
                  ) : null
                ) : solutionPages[currentSolutionPageIndex] ? (
                  <SolutionsPageCanvas
                    puzzles={solutionPages[currentSolutionPageIndex]}
                    settings={previewWordSearchSettings}
                    titleWords={previewTitleWords}
                    pageIndex={currentSolutionPageIndex}
                    bookPageIndex={computeSolutionBookPageIndex(
                      batchPuzzles.length,
                      currentSolutionPageIndex,
                      includeBlankAfterEachPuzzle
                    )}
                    showMargins={displayShowMargins}
                    showSafetyZone={displayShowSafetyZone}
                    safetyMarginPx={safetyMarginPx}
                    ptToPx={ptToPx}
                    titleToAnswerGap={titleToAnswerGap}
                    solutionToSolutionGap={solutionToSolutionGap}
                    pageMargin={pageMargin}
                    canvasEditEnabled={canvasEditEnabled}
                    canvasEditTarget={canvasEditTarget}
                    canvasEditHighlightTarget={canvasEditHighlightTarget}
                    canvasEditHideGuides={canvasEditHideGuides}
                    onCanvasEditTargetChange={handleCanvasEditTargetChange}
                  />
                ) : null}
              </div>
              )
            ) : (
              <div className="flex items-center justify-center h-full text-slate-400 flex-col gap-4 px-4 py-8 min-h-[300px]">
                <svg className="w-12 h-12 md:w-16 md:h-16 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2" />
                </svg>
                <div className="text-center max-w-sm">
                  <p className="text-base md:text-lg font-semibold mb-1 text-slate-600">
                    {hasPreviewPages ? 'No Puzzles Generated' : 'Add your first document'}
                  </p>
                  <p className="text-xs md:text-sm text-slate-500">
                    {hasPreviewPages
                      ? 'Add words and click "Generate Puzzles" to create puzzles'
                      : 'Click the + button in the Documents bar to add a Word Search section or front matter page.'}
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Bottom Pagination & Controls Bar */}
          {showPaginationBar && (
            <div className={cn('preview-pagination-bar', isFlipbookPreview && 'preview-pagination-bar--flipbook')}>
              <div className="preview-pagination-bar__row">
              {/* Layout Mode Toggle — Sample + All Pages (always visible, including in 3D flipbook) */}
              <div className="preview-pagination-bar__group preview-pagination-bar__layout-toggle">
                <Button
                  size="xs"
                  variant="outline"
                  onClick={() => handlePreviewRangeModeChange('sample')}
                  className={`p-0.5 transition-colors ${previewRangeMode === 'sample' ? 'bg-blue-50 text-blue-600 border-blue-300' : 'hover:bg-slate-100'}`}
                  title="Single Page Preview"
                >
                  <FileText className="w-3 h-3" />
                </Button>
                <Button
                  size="xs"
                  variant="outline"
                  onClick={() => handlePreviewRangeModeChange('all')}
                  className={`p-0.5 transition-colors ${previewRangeMode === 'all' ? 'bg-blue-50 text-blue-600 border-blue-300' : 'hover:bg-slate-100'}`}
                  title="All Pages Preview"
                >
                  <Files className="w-3 h-3" />
                </Button>
              </div>

              {isFlipbookPreview && showPuzzleSolutionTabs ? (
                <div className="preview-pagination-bar__group">
                  <div className="preview-puzzle-solution-controls">
                  <div className="preview-segmented">
                    <button
                      type="button"
                      onClick={() => guardedSetActivePreviewTab('puzzles')}
                      className={cn(
                        'preview-segmented__btn',
                        !previewShowBothPages && activePreviewTab === 'puzzles'
                          ? 'preview-segmented__btn--active'
                          : 'preview-segmented__btn--inactive'
                      )}
                    >
                      Puzzles
                    </button>
                    <button
                      type="button"
                      onClick={() => guardedSetActivePreviewTab('solutions')}
                      className={cn(
                        'preview-segmented__btn',
                        !previewShowBothPages && activePreviewTab === 'solutions'
                          ? 'preview-segmented__btn--active'
                          : 'preview-segmented__btn--inactive'
                      )}
                    >
                      Solutions
                    </button>
                  </div>
                  {renderShowBothCheckbox()}
                  </div>
                </div>
              ) : !previewShowBothPages && activePreviewTab === 'solutions' ? (
                <div className="preview-pagination-bar__group">
                  <Button
                    size="xs"
                    variant="outline"
                    onClick={() => setCurrentSolutionPageIndex(Math.max(0, currentSolutionPageIndex - 1))}
                    disabled={currentSolutionPageIndex === 0}
                    className="p-0.5 hover:bg-slate-100 transition-colors"
                    title="Previous Page"
                  >
                    <ChevronLeft className="w-3 h-3" />
                  </Button>
                  <input
                    type="number"
                    min={0}
                    max={
                      activeDocIsBatchModule
                        ? crosswordSolutionPageCount
                        : solutionPages.length || 1
                    }
                    value={solutionPageInputValue}
                    onChange={(e) => setSolutionPageInputValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        handleSolutionPageNavigation(e.currentTarget.value);
                      }
                    }}
                    onBlur={(e) => handleSolutionPageNavigation(e.currentTarget.value)}
                    className="w-10 text-center text-[10px] font-bold text-slate-600 bg-slate-50 px-1 py-0.5 rounded border border-slate-200"
                    title="Enter page number and press Enter"
                  />
                  <span className="text-[10px] font-bold text-slate-400">/</span>
                  <span className="text-[10px] font-bold text-slate-600 bg-slate-50 px-1.5 py-0.5 rounded border border-slate-200">
                    {activeDocIsBatchModule
                      ? crosswordSolutionPageCount
                      : solutionPages.length || 1}
                  </span>
                  <Button
                    size="xs"
                    variant="outline"
                    onClick={() =>
                      setCurrentSolutionPageIndex(
                        Math.min(
                          (activeDocIsBatchModule
                            ? crosswordSolutionPageCount
                            : solutionPages.length || 1) - 1,
                          currentSolutionPageIndex + 1
                        )
                      )
                    }
                    disabled={
                      currentSolutionPageIndex ===
                      (activeDocIsBatchModule
                        ? crosswordSolutionPageCount
                        : solutionPages.length || 1) -
                        1
                    }
                    className="p-0.5 hover:bg-slate-100 transition-colors"
                    title="Next Page"
                  >
                    <ChevronRight className="w-3 h-3" />
                  </Button>
                </div>
              ) : showPuzzleBatchPagination ? (
                <div className="preview-pagination-bar__group">
                  <Button
                    size="xs"
                    variant="outline"
                    onClick={() => {
                      if (
                        activeDocIsBatchModule &&
                        activeCrosswordPuzzleCount > 0
                      ) {
                        const step = activeDocIsGenericModule ? genericPuzzlesPerPage : 1;
                        guardedSetCurrentBatchIndex(Math.max(0, currentBatchIndex - step));
                        return;
                      }
                      if (hasPreviewPages && activeDocumentPuzzleStartIndex >= 0) {
                        guardedSetCurrentBatchIndex(
                          Math.max(activeDocumentPuzzleStartIndex, currentBatchIndex - 1)
                        );
                        return;
                      }
                      guardedSetCurrentBatchIndex(Math.max(0, currentBatchIndex - 1));
                    }}
                    disabled={
                      activeDocIsBatchModule &&
                      activeCrosswordPuzzleCount > 0
                        ? batchPuzzlePageNumber <= 1
                        : hasPreviewPages && activeDocumentPuzzleStartIndex >= 0
                        ? currentBatchIndex <= activeDocumentPuzzleStartIndex
                        : currentBatchIndex === 0
                    }
                    className="p-0.5 hover:bg-slate-100 transition-colors"
                    title="Previous Page"
                  >
                    <ChevronLeft className="w-3 h-3" />
                  </Button>
                  <input
                    type="number"
                    min={0}
                    max={
                      activeDocIsBatchModule &&
                      activeCrosswordPuzzleCount > 0
                        ? batchPuzzlePageCount
                        : hasPreviewPages && activeDocumentPuzzleCount > 0
                        ? activeDocumentPuzzleCount
                        : batchPuzzles.length || 1
                    }
                    value={batchPageInputValue}
                    onChange={(e) => setBatchPageInputValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        if (
                          activeDocIsBatchModule &&
                          activeCrosswordPuzzleCount > 0
                        ) {
                          const localPage = Math.max(
                            1,
                            Math.min(batchPuzzlePageCount, Number(e.currentTarget.value) || 1)
                          );
                          const step = activeDocIsGenericModule ? genericPuzzlesPerPage : 1;
                          guardedSetCurrentBatchIndex((localPage - 1) * step);
                          setBatchPageInputValue(localPage.toString());
                          return;
                        }
                        if (hasPreviewPages && activeDocumentPuzzleCount > 0 && activeDocumentPuzzleStartIndex >= 0) {
                          const localPage = Math.max(
                            1,
                            Math.min(activeDocumentPuzzleCount, Number(e.currentTarget.value))
                          );
                          guardedSetCurrentBatchIndex(activeDocumentPuzzleStartIndex + localPage - 1);
                          setBatchPageInputValue(localPage.toString());
                          return;
                        }
                        handleBatchPageNavigationGuarded(e.currentTarget.value);
                      }
                    }}
                    onBlur={(e) => {
                      if (
                        activeDocIsBatchModule &&
                        activeCrosswordPuzzleCount > 0
                      ) {
                        const localPage = Math.max(
                          1,
                          Math.min(batchPuzzlePageCount, Number(e.currentTarget.value) || 1)
                        );
                        const step = activeDocIsGenericModule ? genericPuzzlesPerPage : 1;
                        guardedSetCurrentBatchIndex((localPage - 1) * step);
                        setBatchPageInputValue(localPage.toString());
                        return;
                      }
                      if (hasPreviewPages && activeDocumentPuzzleCount > 0 && activeDocumentPuzzleStartIndex >= 0) {
                        const localPage = Math.max(
                          1,
                          Math.min(activeDocumentPuzzleCount, Number(e.currentTarget.value))
                        );
                        guardedSetCurrentBatchIndex(activeDocumentPuzzleStartIndex + localPage - 1);
                        setBatchPageInputValue(localPage.toString());
                        return;
                      }
                      handleBatchPageNavigationGuarded(e.currentTarget.value);
                    }}
                    className="w-10 text-center text-[10px] font-bold text-slate-600 bg-slate-50 px-1 py-0.5 rounded border border-slate-200"
                    title="Enter page number and press Enter"
                  />
                  <span className="text-[10px] font-bold text-slate-400">/</span>
                  <span className="text-[10px] font-bold text-slate-600 bg-slate-50 px-1.5 py-0.5 rounded border border-slate-200">
                    {activeDocIsBatchModule &&
                    activeCrosswordPuzzleCount > 0
                      ? batchPuzzlePageCount
                      : hasPreviewPages && activeDocumentPuzzleCount > 0
                      ? activeDocumentPuzzleCount
                      : batchPuzzles.length || 1}
                  </span>
                  {batchPuzzles[currentBatchIndex]?.pageName && (
                    <span className="preview-pagination-bar__doc-name text-[9px] font-semibold text-slate-500 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                      {batchPuzzles[currentBatchIndex].pageName}
                    </span>
                  )}
                  <Button
                    size="xs"
                    variant="outline"
                    onClick={() => {
                      if (
                        activeDocIsBatchModule &&
                        activeCrosswordPuzzleCount > 0
                      ) {
                        const step = activeDocIsGenericModule ? genericPuzzlesPerPage : 1;
                        guardedSetCurrentBatchIndex(
                          Math.min(
                            activeCrosswordPuzzleCount - 1,
                            currentBatchIndex + step
                          )
                        );
                        return;
                      }
                      if (hasPreviewPages && activeDocumentPuzzleStartIndex >= 0) {
                        const lastIndex = activeDocumentPuzzleStartIndex + activeDocumentPuzzleCount - 1;
                        guardedSetCurrentBatchIndex(Math.min(lastIndex, currentBatchIndex + 1));
                        return;
                      }
                      guardedSetCurrentBatchIndex(Math.min((batchPuzzles.length || 1) - 1, currentBatchIndex + 1));
                    }}
                    disabled={
                      activeDocIsBatchModule &&
                      activeCrosswordPuzzleCount > 0
                        ? batchPuzzlePageNumber >= batchPuzzlePageCount
                        : hasPreviewPages && activeDocumentPuzzleStartIndex >= 0
                        ? currentBatchIndex >= activeDocumentPuzzleStartIndex + activeDocumentPuzzleCount - 1
                        : currentBatchIndex === (batchPuzzles.length || 1) - 1
                    }
                    className="p-0.5 hover:bg-slate-100 transition-colors"
                    title="Next Page"
                  >
                    <ChevronRight className="w-3 h-3" />
                  </Button>
                </div>
              ) : showDocumentPagination ? (
                <div className="preview-pagination-bar__group">
                <Button
                  size="xs"
                  variant="outline"
                    onClick={goToPrevDocumentGuarded}
                    disabled={!canGoPrevDocument}
                  className="p-0.5 hover:bg-slate-100 transition-colors"
                    title="Previous Document"
                >
                    <ChevronLeft className="w-3 h-3" />
                </Button>
                  <input
                    type="number"
                    min={0}
                    max={documentPages.length || 1}
                    value={documentPageInputValue}
                    onChange={(e) => setDocumentPageInputValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        handleDocumentPageNavigationGuarded(e.currentTarget.value);
                      }
                    }}
                    onBlur={(e) => handleDocumentPageNavigationGuarded(e.currentTarget.value)}
                    className="w-10 text-center text-[10px] font-bold text-slate-600 bg-slate-50 px-1 py-0.5 rounded border border-slate-200"
                    title="Enter document number and press Enter"
                  />
                  <span className="text-[10px] font-bold text-slate-400">/</span>
                  <span className="text-[10px] font-bold text-slate-600 bg-slate-50 px-1.5 py-0.5 rounded border border-slate-200">
                    {documentPages.length || 1}
                </span>
                  {activeDocumentPage?.name && (
                    <span className="preview-pagination-bar__doc-name text-[9px] font-semibold text-slate-500 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                      {activeDocumentPage.name}
                    </span>
                  )}
                <Button
                  size="xs"
                  variant="outline"
                    onClick={goToNextDocumentGuarded}
                    disabled={!canGoNextDocument}
                  className="p-0.5 hover:bg-slate-100 transition-colors"
                    title="Next Document"
                >
                    <ChevronRight className="w-3 h-3" />
                </Button>
                </div>
              ) : null}

              {!isFlipbookPreview && (
                <>
              <div className="preview-pagination-bar__sep hidden sm:block" aria-hidden />

              <div className="preview-pagination-bar__group preview-pagination-bar__zoom">
                <span className="text-[10px] font-bold text-slate-600 bg-slate-50 px-1.5 py-0.5 rounded border border-slate-200 min-w-[32px] text-center">
                  {previewZoom}%
                </span>
                <input
                  type="range"
                  min={0}
                  max={150}
                  value={previewZoom}
                  onChange={(e) => setPreviewZoom(Number(e.target.value))}
                  className="preview-pagination-bar__zoom-slider w-20 sm:w-24 h-1 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                  title="Zoom Level"
                  aria-label="Zoom level"
                />
              </div>
                </>
          )}
        </div>
            </div>
          )}
            </div>
          </div>

      <CanvasEditUnsavedDialog
        open={canvasEditUnsavedDialogOpen}
        onOpenChange={handleCanvasEditUnsavedDialogOpenChange}
        onCommitPage={handleCanvasEditUnsavedCommitPage}
        onCommitAll={handleCanvasEditUnsavedCommitAll}
        onDiscard={handleCanvasEditUnsavedDiscard}
        hasUnsavedChanges={
          unsavedDialogKind === 'crossword'
            ? crosswordHasUnsavedChanges
            : unsavedDialogKind === 'generic'
              ? genericPuzzleHasUnsavedChanges
              : canvasEditHasUnsavedChanges
        }
        canApplyToAllPages={
          unsavedDialogKind === 'crossword'
            ? crosswordHasUnsavedChanges || pageCrosswordOverrides.size > 0
            : unsavedDialogKind === 'generic'
              ? genericPuzzleHasUnsavedChanges
              : canvasEditCanApplyToAllPages
        }
      />

      <CanvasApplyToAllConfirmDialog
        open={applyToAllConfirmOpen}
        onOpenChange={(open) => {
          setApplyToAllConfirmOpen(open);
          if (!open) applyToAllPendingLeaveRef.current = false;
        }}
        editedPageIndices={getOtherEditedPageIndices(
          wordSearchSettings,
          puzzleGridScale,
          pageOverrides,
          pagePuzzleGridScales,
          currentBatchIndex
        )}
        preserveEditedPages={preserveEditedPagesOnApply}
        onPreserveEditedPagesChange={setPreserveEditedPagesOnApply}
        onConfirm={handleApplyToAllConfirm}
      />
      <AiProjectWizard
        open={aiAppendOpen}
        onClose={() => setAiAppendOpen(false)}
        onComplete={() => setAiAppendOpen(false)}
        mode="append"
        insertPosition={aiInsertPosition}
        defaultTitle={projectName || 'Puzzle Book'}
      />
    </div>
  );
}
