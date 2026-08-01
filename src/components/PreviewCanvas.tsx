'use client';

import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { useApp } from '@/lib/app-context';
import { Eye, EyeOff, ChevronLeft, ChevronRight, AlertCircle, Layout, FileText, Files, BookOpen } from 'lucide-react';
import { Button } from './ui/button';
import { resolvePageFrameSettings } from '@/lib/page-frame-settings';
import type { PageFrameSettings } from '@/lib/puzzles/types';
import {
  computeSolutionPageContentArea,
  computeSolutionPageLayout,
} from '@/lib/solution-page-layout';
import { WordSearchPuzzle, WordSearchSettings, TitleWordsSettings } from '@/lib/puzzles/types';
import { DocumentPage, TextModuleSettings, PuzzleModuleSettings, isTextModuleType, isPuzzleModuleType, isTextModuleSettings, getDefaultTextModuleSettings } from '@/lib/document-model';
import {
  resolveTextPageBackground,
  resolveTextPageFrameSettings,
  resolveTextPageTextColor,
  resolveTextPageTitleFontSize,
  isNearWhiteCssColor,
} from '@/lib/text-page-settings';
import {
  TextPageContextualControls,
  type TextPageEditTarget,
} from '@/components/TextPageContextualControls';
import {
  CrosswordContextualControls,
  type CrosswordEditTarget,
} from '@/components/CrosswordContextualControls';
import { getDefaultCrosswordSettings, type CrosswordSettings } from '@/lib/crossword-settings';
import { TextPageBlockCanvas } from '@/components/TextPageBlockCanvas';
import {
  resolveTextPageBlocks,
  removeTextPageBlock,
  syncLegacyFieldsFromBlocks,
} from '@/lib/text-page-blocks';
import {
  compileBook,
  groupPuzzlesByDocument,
  getTitleWordsForDocument,
  findBookPageIndexForDocument,
  shouldDrawBookPageNumber,
  type CompiledPage,
  type CompiledSolutionPage,
  type CompiledTextPage,
  type CompiledBook,
} from '@/lib/book-compiler';
import { TocPageCanvas } from '@/components/TocPageCanvas';
import { TocContextualControls } from '@/components/TocContextualControls';
import { resolvePageNumberSettingsForBook } from '@/lib/text-page-pdf-draw';
import { BookFlipbookViewer } from '@/components/BookFlipbookViewer';
import { AllPagesGridPreview } from '@/components/AllPagesGridPreview';
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
  CanvasContextualControls,
  type CanvasEditTarget,
} from '@/components/CanvasContextualControls';
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
import { getWordsForPuzzlePage } from '@/lib/puzzle-word-list';
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
import { SudokuGrid } from './puzzle/SudokuGrid';
import { CrosswordGrid } from './puzzle/CrosswordGrid';
import { MazeDisplay } from './puzzle/MazeDisplay';
import { CryptogramDisplay } from './puzzle/CryptogramDisplay';
import { WordScrambleDisplay } from './puzzle/WordScrambleDisplay';
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
            minWidth: ptToPx(safeNumber(wl.columnWidthsPt?.[colIdx], blockWidthPt / wl.columns || 40)),
            width: 'auto',
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
  bookPageIndex = 0,
  canvasEditEnabled = false,
  canvasEditTarget = null,
  canvasEditHighlightTarget = null,
  canvasEditHideGuides = false,
  onCanvasEditTargetChange,
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
}) {
  const editHighlight = canvasEditHighlightTarget ?? canvasEditTarget;

  const layout = useMemo(() => {
    return computeWordSearchPageLayout(
      puzzle,
      settings,
      titleWords,
      showSolution,
      puzzleGridScale,
      10,
      bookHeaderTitleFontSizePt
    );
  }, [puzzle, settings, titleWords, showSolution, puzzleGridScale, bookHeaderTitleFontSizePt]);

  const { page, title, subtitle, headerAssembly, grid, wordList } = layout;

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
    const pageNumberLayout = pageNumberSettings.enabled
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
        <div
          className="absolute inset-0 pointer-events-none z-0"
          style={{
            backgroundImage: `url(${settings.colors.puzzlePage.backgroundImage})`,
            backgroundSize: settings.colors.puzzlePage.backgroundImageFit || 'cover',
            backgroundRepeat: 'no-repeat',
            backgroundPosition: 'center',
            opacity: (settings.colors.puzzlePage.backgroundImageOpacity ?? 100) / 100,
          }}
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
        {headerAssembly && (
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
        {!headerAssembly && title && (
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
        {!headerAssembly && subtitle && (
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

        {/* Puzzle grid — letter cells anchored at grid.leftPt / grid.topPt */}
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
            boxColor={grid.boxColor}
            solutionStrokeColor={settings.colors.answerPage.solutionFrameColor}
            solutionStrokeThickness={ptToPx(settings.colors.answerPage.solutionStrokeThickness || 12)}
            solutionStrokePadding={ptToPx(settings.colors.answerPage.solutionStrokePadding || 0)}
            solutionFrameStyle={settings.colors.answerPage.solutionFrameStyle}
            solutionFrameRadius={ptToPx(settings.colors.answerPage.solutionFrameRadius || 4)}
            solutionHighlightAlpha={settings.colors.answerPage.solutionHighlightAlpha ?? 30}
            puzzleGridFontSize={ptToPx(grid.fontSizePt)}
            puzzleGridFontFamily={grid.fontFamily}
            answerGridFontSize={showSolution ? ptToPx(grid.fontSizePt) : undefined}
            answerGridFontFamily={showSolution ? grid.fontFamily : undefined}
            gridBorderPadding={gridBorderPaddingCssPx}
          />
        </div>

        {/* Word List */}
        {!showSolution && wordList && (
          <WordListPreview layout={layout} ptToPx={ptToPx} />
        )}

        <PageNumberOverlay
          settings={settings}
          bookPageIndex={bookPageIndex}
          pageWidthPt={page.widthPt}
          pageHeightPt={page.heightPt}
          ptToPx={ptToPx}
        />

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
        <div
          className="absolute inset-0 pointer-events-none z-0"
          style={{
            backgroundImage: `url(${pageBackground.backgroundImage})`,
            backgroundSize: pageBackground.backgroundImageFit || 'cover',
            backgroundRepeat: 'no-repeat',
            backgroundPosition: 'center',
            opacity: (pageBackground.backgroundImageOpacity ?? 100) / 100,
          }}
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
    const resolvedBookPageIndex =
      (compiledBook && findBookPageIndexForDocument(compiledBook, page.id, puzzleIndexInDoc)) ??
      computePuzzleBookPageIndex(Math.max(0, pageStartIndex) + puzzleIndexInDoc, includeBlankAfterEachPuzzle);

    if (activePreviewTab === 'puzzles') {
      if (previewRangeMode === 'sample') {
        return activePagePuzzle ? (
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
          />
        ) : (
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

      return (
        <div className="flex flex-col gap-10 items-center w-full pb-16">
          {pagePuzzles.length > 0 ? (
            pagePuzzles.map((puzzle, idx) => (
              <div key={`${page.id}-${puzzle.puzzleNumber || idx}`} className="w-full">
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
                  bookPageIndex={
                    (compiledBook && findBookPageIndexForDocument(compiledBook, page.id, idx)) ??
                    computePuzzleBookPageIndex(
                      Math.max(0, pageStartIndex) + idx,
                      includeBlankAfterEachPuzzle
                    )
                  }
                />
              </div>
            ))
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
    const solutionChunkIndex = Math.min(
      Math.max(0, currentSolutionPageIndex),
      Math.max(0, (compiledSolutionPages?.length ?? pageSolutionChunks.length) - 1)
    );
    const compiledSolutionPage = compiledSolutionPages?.[solutionChunkIndex];
    const solutionChunk = compiledSolutionPage?.puzzles ?? pageSolutionChunks[solutionChunkIndex] ?? [];
    const solutionBookPageIndexForChunk = compiledSolutionPage?.bookPageIndex ?? computeSolutionBookPageIndex(
      batchPuzzles.length,
      Math.max(0, Math.floor(pageStartIndex / answersPerPage) + solutionChunkIndex),
      includeBlankAfterEachPuzzle
    );

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
              bookPageIndex={computeSolutionBookPageIndex(
                batchPuzzles.length,
                Math.max(0, Math.floor(pageStartIndex / answersPerPage) + chunkIdx),
                includeBlankAfterEachPuzzle
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
              settings={compiledTocPage.settings ?? normalized}
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
  const isActiveGeneratedPuzzle =
    page.id === activeDocumentPageId &&
    currentPuzzle &&
    currentPuzzleType === page.moduleType;

    if (isActiveGeneratedPuzzle) {
      const pageCw =
        page.moduleType === 'crossword'
          ? page.id === activeDocumentPageId
            ? crosswordSettings
            : (moduleSettings.crosswordSettings ?? crosswordSettings)
          : null;
      return (
    <GenericPuzzlePageCanvas
      puzzleType={page.moduleType}
      puzzle={currentPuzzle}
      settings={wordSearchSettings}
          titleWords={moduleSettings.titleWords ?? titleWords}
      showSolution={showSolution}
      showMargins={showMargins}
      showSafetyZone={showSafetyZone}
      safetyMarginPx={safetyMarginPx}
      ptToPx={ptToPx}
      crosswordSettings={pageCw}
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
          settings={tocPage.settings}
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
  bookPageIndex: number;
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
        <div
          className="absolute inset-0 pointer-events-none z-0"
          style={{
            backgroundImage: `url(${colors.answerPage.backgroundImage})`,
            backgroundSize: colors.answerPage.backgroundImageFit || 'cover',
            backgroundRepeat: 'no-repeat',
            backgroundPosition: 'center',
            opacity: (colors.answerPage.backgroundImageOpacity ?? 100) / 100,
          }}
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

      <PageNumberOverlay
        settings={settings}
        bookPageIndex={bookPageIndex}
        pageWidthPt={pageWidthPt}
        pageHeightPt={pageHeightPt}
        ptToPx={ptToPx}
      />

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

/** Fallback canvas page for non-word-search puzzle categories */
function GenericPuzzlePageCanvas({
  puzzleType,
  puzzle,
  settings,
  titleWords,
  showSolution,
  showMargins,
  showSafetyZone,
  safetyMarginPx,
  ptToPx,
  crosswordSettings,
}: {
  puzzleType: string;
  puzzle: any;
  settings: WordSearchSettings;
  titleWords: TitleWordsSettings;
  showSolution: boolean;
  showMargins: boolean;
  showSafetyZone: boolean;
  safetyMarginPx: number;
  ptToPx: (pt: number) => number;
  crosswordSettings?: CrosswordSettings | null;
}) {
  const { colors, typography } = settings;
  const cw = puzzleType === 'crossword' ? crosswordSettings ?? getDefaultCrosswordSettings() : null;
  const dims = getPageDimensionsInches(settings);
  const pageWidthPt = dims.width * 72;
  const pageHeightPt = dims.height * 72;
  const widthPx = ptToPx(pageWidthPt);
  const heightPx = ptToPx(pageHeightPt);
  const marginIn = cw?.pageFrameSettings?.enabled
    ? cw.pageFrameSettings.marginSizeIn
    : getPageMarginInches(settings);
  const marginPx = ptToPx(marginIn * 72);
  const cellSize = cw ? Math.round(28 * (cw.core.puzzleSizePercent / 60)) : 30;

  const renderGrid = () => {
    switch (puzzleType) {
      case 'sudoku':
        return <SudokuGrid puzzle={puzzle} showSolution={showSolution} cellSize={40} />;
      case 'crossword':
        return (
          <CrosswordGrid
            puzzle={puzzle}
            showSolution={showSolution}
            cellSize={cellSize}
            crosswordSettings={cw}
          />
        );
      case 'maze':
        return <MazeDisplay puzzle={puzzle} showSolution={showSolution} cellSize={16} />;
      case 'cryptogram':
        return <CryptogramDisplay puzzle={puzzle} showSolution={showSolution} />;
      case 'word-scramble':
        return <WordScrambleDisplay puzzle={puzzle} showSolution={showSolution} />;
      case 'word-match':
        return <WordMatchDisplay puzzle={puzzle} showSolution={showSolution} />;
      case 'dot-to-dot':
        return <DotToDotDisplay puzzle={puzzle} showSolution={showSolution} />;
      default:
        return <div className="text-gray-400">Preview not supported for {puzzleType}</div>;
    }
  };

  const titleText = cw
    ? cw.typography.selectTitleOption === 'different-titles'
      ? (cw.typography.differentTitles.split('\n').map((t) => t.trim()).filter(Boolean)[0] ||
          cw.typography.titleText ||
          titleWords.title ||
          'Crossword')
      : cw.typography.titleText || titleWords.title || 'Crossword'
    : titleWords.title || puzzleType.toUpperCase();

  const titleColor = cw?.colors.titleColor ?? colors.puzzlePage.titleColor ?? '#333333';
  const titleFont = cw?.typography.puzzleTitleFontFamily ?? typography.puzzleTitleFontFamily ?? 'Roboto';
  const titleSize = cw?.typography.puzzleTitleFontSize ?? typography.puzzleTitleFontSize ?? 24;
  const bgColor = cw?.colors.backgroundColor ?? colors.puzzlePage.backgroundColor ?? '#ffffff';
  const titleStartAtPx = cw ? ptToPx(cw.typography.titleStartAt * 72) : marginPx;
  const titleGapPx = cw ? ptToPx(cw.typography.spaceBetweenTitleAndPuzzle * 72) : undefined;

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
      {/* Background Image Layer */}
      {!cw && colors.puzzlePage.backgroundImage && (
        <div
          className="absolute inset-0 pointer-events-none z-0"
          style={{
            backgroundImage: `url(${colors.puzzlePage.backgroundImage})`,
            backgroundSize: colors.puzzlePage.backgroundImageFit || 'cover',
            backgroundRepeat: 'no-repeat',
            backgroundPosition: 'center',
            opacity: (colors.puzzlePage.backgroundImageOpacity ?? 100) / 100,
          }}
        />
      )}
      {/* Page container frame */}
      {cw?.pageFrameSettings ? (
        <PageFrameOverlay
          frame={cw.pageFrameSettings}
          pageBackgroundColor={bgColor}
          hasBackgroundImage={false}
        />
      ) : (
        <PageFrameOverlay
          frame={resolvePageFrameSettings(settings)}
          pageBackgroundColor={colors.puzzlePage.backgroundColor || '#ffffff'}
          hasBackgroundImage={!!colors.puzzlePage.backgroundImage}
        />
      )}
      {/* Margins */}
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

      {/* KDP Safe Zone */}
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

      {/* Content */}
      <div
        className="absolute flex flex-col items-center"
        style={{
          left: marginPx,
          top: titleStartAtPx,
          right: marginPx,
          bottom: marginPx,
          zIndex: 2,
          justifyContent: cw ? 'flex-start' : 'center',
        }}
      >
        <h2
          className="font-bold text-center"
          style={{
            fontSize: ptToPx(titleSize),
            color: titleColor,
            fontFamily: titleFont,
            marginBottom: titleGapPx ?? undefined,
          }}
        >
          {titleText}
        </h2>
        <div className="flex-1 flex items-center justify-center overflow-auto max-w-full max-h-full">
          {renderGrid()}
        </div>
      </div>
    </div>
  );
}

export function PreviewCanvas() {
  const {
    currentPuzzle,
    currentPuzzleType,
    showSolution,
    titleWords,
    wordSearchSettings,
    crosswordSettings,
    updateCrosswordSettings,
    batchPuzzles,
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
    insertDocumentPage,
    insertSeparatorTitlePageAfter,
    removeCompiledBookPage,
    removeDocumentPage,
    reorderDocumentPages,
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
    applyTextSettingsToDocumentPages,
    canUndo,
    canRedo,
    undo,
    redo,
  } = useApp();

  const [showMargins, setShowMargins] = useState(true);
  const [showSafetyZone, setShowSafetyZone] = useState(true);
  const [canvasEditTabs, setCanvasEditTabs] = useState<CanvasEditTab[]>([]);
  const [activeCanvasEditTabId, setActiveCanvasEditTabId] = useState<string | null>(null);
  const [canvasEditSession, setCanvasEditSession] = useState<CanvasEditSession | null>(null);
  const [canvasEditUnsavedDialogOpen, setCanvasEditUnsavedDialogOpen] = useState(false);
  const [canvasEditRangeError, setCanvasEditRangeError] = useState<string | null>(null);
  const [applyToAllConfirmOpen, setApplyToAllConfirmOpen] = useState(false);
  const [preserveEditedPagesOnApply, setPreserveEditedPagesOnApply] = useState(false);
  const [textPageEditTarget, setTextPageEditTarget] = useState<TextPageEditTarget>('page-elements');
  const [textPageEditPanelOpen, setTextPageEditPanelOpen] = useState(true);
  const [selectedTextBlockId, setSelectedTextBlockId] = useState<string | null>(null);
  const [textPageBlockChromeVisible, setTextPageBlockChromeVisible] = useState(true);
  const [crosswordEditTarget, setCrosswordEditTarget] = useState<CrosswordEditTarget>('title');
  const [crosswordEditPanelOpen, setCrosswordEditPanelOpen] = useState(true);
  const pendingCanvasEditLeaveRef = useRef<(() => void) | null>(null);
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
    const pageNum = Math.max(1, Math.min(solutionPages.length || 1, Number(value)));
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

  const documentPagesForBook = useMemo(() => {
    const activeWordSearchSettings = canvasEditSession?.draft ?? wordSearchSettings;
    return documentPages.map((page) => {
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
      return page;
    });
  }, [
    documentPages,
    activeDocumentPageId,
    titleWords,
    wordSearchSettings,
    canvasEditSession?.draft,
    canvasEditSession?.draftTitleWords,
  ]);

  const pageNumberSettingsForBook = useMemo(
    () => resolvePageNumberSettingsForBook(documentPagesForBook, wordSearchSettings),
    [documentPagesForBook, wordSearchSettings]
  );

  const compiledBook = useMemo(() => {
    if (documentPages.length === 0) return null;
    const puzzleMap = groupPuzzlesByDocument(batchPuzzles, documentPagesForBook);
    return compileBook(documentPagesForBook, puzzleMap, {
      includeSolutions: true,
      pageNumberSettings: pageNumberSettingsForBook,
    });
  }, [documentPages.length, documentPagesForBook, batchPuzzles, pageNumberSettingsForBook]);

  const compiledBookPagesForPreview = useMemo(() => {
    if (!compiledBook) return [];
    if (activePreviewTab === 'solutions') {
      return compiledBook.pages.filter((page) => page.kind === 'solution');
    }
    return compiledBook.pages.filter((page) => page.kind !== 'solution');
  }, [compiledBook, activePreviewTab]);

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
      compiledBook?.pages.filter(
        (page): page is CompiledSolutionPage =>
          page.kind === 'solution' && page.sourceDocumentId === activeDocumentPageId
      ) ?? [],
    [compiledBook, activeDocumentPageId]
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

  const hasPuzzles = currentPuzzleType === 'word-search' ? batchPuzzles.length > 0 : !!currentPuzzle;
  const hasPreviewPages = documentPages.length > 0;
  const activeDocumentPage = documentPages.find((page) => page.id === activeDocumentPageId) ?? documentPages[0];
  const activeDocumentIndex = documentPages.findIndex((page) => page.id === activeDocumentPageId);
  const activeDocumentPuzzleStartIndex = batchPuzzles.findIndex(
    (puzzle) => puzzle.pageId === activeDocumentPageId
  );
  const activeDocumentPuzzleCount = batchPuzzles.filter(
    (puzzle) => puzzle.pageId === activeDocumentPageId
  ).length;

  // Current solution page index navigation state
  const [currentSolutionPageIndex, setCurrentSolutionPageIndex] = useState(0);

  useEffect(() => {
    if (!hasPreviewPages || activeDocumentPage?.moduleType !== 'word-search') return;
    if (activeDocumentPuzzleCount <= 0 || activeDocumentPuzzleStartIndex < 0) return;

    setCurrentBatchIndex((idx) => {
      const first = activeDocumentPuzzleStartIndex;
      const last = activeDocumentPuzzleStartIndex + activeDocumentPuzzleCount - 1;
      if (idx < first || idx > last) return first;
      return idx;
    });
  }, [
    activeDocumentPageId,
    activeDocumentPuzzleStartIndex,
    activeDocumentPuzzleCount,
    activeDocumentPage?.moduleType,
    hasPreviewPages,
    setCurrentBatchIndex,
  ]);

  useEffect(() => {
    setCurrentSolutionPageIndex(0);
  }, [puzzleGenerationVersion]);

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
    setBatchPageInputValue((currentBatchIndex + 1).toString());
  }, [currentBatchIndex, hasPreviewPages, activeDocumentPage?.moduleType, activeDocumentPuzzleStartIndex]);

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
  const showPuzzleBatchPagination =
    activePreviewTab === 'puzzles' &&
    (hasPreviewPages
      ? activeDocumentPage?.moduleType === 'word-search' && activeDocumentPuzzleCount > 0
      : hasPuzzles);
  const showDocumentPagination =
    hasPreviewPages && activePreviewTab === 'puzzles' && !showPuzzleBatchPagination;
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
    !showSolution &&
    (activePreviewTab === 'puzzles' || activePreviewTab === 'solutions') &&
    activeDocumentPage?.moduleType === 'word-search';

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
  }, [showPuzzleSolutionTabs, activePreviewTab, setActivePreviewTab]);

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

  const handleTextEditTargetChange = useCallback((target: TextPageEditTarget) => {
    setTextPageEditTarget(target);
    setTextPageEditPanelOpen(true);
    setTextPageBlockChromeVisible(false);
  }, []);

  const handleSelectTextBlock = useCallback((blockId: string, options?: { showChrome?: boolean }) => {
    setSelectedTextBlockId(blockId);
    setTextPageBlockChromeVisible(options?.showChrome !== false);
    setTextPageEditTarget('page-elements');
    setTextPageEditPanelOpen(true);
  }, []);

  const handleHideTextBlockChrome = useCallback(() => {
    setTextPageBlockChromeVisible(false);
  }, []);

  const handleTocCanvasClick = useCallback(() => {
    setTextPageEditPanelOpen(true);
  }, []);

  const handleCanvasBackgroundClick = useCallback(() => {
    if (textPageBlockChromeVisible && selectedTextBlockId) {
      setTextPageBlockChromeVisible(false);
      setTextPageEditTarget('page-elements');
      return;
    }
    setTextPageEditTarget('page-frame');
    setTextPageEditPanelOpen(true);
  }, [textPageBlockChromeVisible, selectedTextBlockId]);

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
      setSelectedTextBlockId(nextId);
    },
    [
      activeDocumentPage,
      activeTextSettings,
      wordSearchSettings,
      updateActiveTextModuleSettings,
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

    // Persist an explicit empty blocks array so the page stays clean (no auto title/subtitle boxes).
    if (!Array.isArray(activeTextSettings.blocks)) {
      updateActiveTextModuleSettings({ blocks: [] }, { recordHistory: false });
    }

    // Fix white-on-white text inherited from puzzle title color.
    const needsBlackPageColor =
      !activeTextSettings.textColor || isNearWhiteCssColor(activeTextSettings.textColor);
    const normalizedBlocks = (activeTextSettings.blocks ?? []).map((block) =>
      block.textColor && isNearWhiteCssColor(block.textColor)
        ? { ...block, textColor: '#000000' }
        : block
    );
    const blocksNeedBlack = normalizedBlocks.some(
      (block, idx) => block !== (activeTextSettings.blocks ?? [])[idx]
    );
    if (needsBlackPageColor || blocksNeedBlack) {
      updateActiveTextModuleSettings(
        {
          ...(needsBlackPageColor ? { textColor: '#000000' } : {}),
          ...(blocksNeedBlack ? { blocks: normalizedBlocks } : {}),
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
      blocks.find((block) => block.kind === 'title')?.id ?? blocks[0]?.id ?? null;
    setTextPageEditTarget('page-elements');
    setSelectedTextBlockId(titleBlockId);
  }, [
    activeDocumentPageId,
    activeDocumentPage?.moduleType,
    activeDocumentPage?.name,
    activeTextSettings?.blocks?.length,
    textPageEditEnabled,
    wordSearchSettings,
    updateActiveTextModuleSettings,
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
      if (!hasCanvasEditPanelOpen) {
        action();
        return;
      }
      if (!anyCanvasEditTabHasUnsavedEdits(canvasEditSession, canvasEditTabs)) {
        action();
        return;
      }
      pendingCanvasEditLeaveRef.current = action;
      pendingCanvasEditTabCloseIdRef.current = null;
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

  const handleCanvasEditCommitPage = useCallback(() => {
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
      const wordsPerPuzzle = Math.max(1, editSession.draft.wordList.wordsPerPuzzle);
      const words = getWordsForPuzzlePage(
        commitPuzzle,
        editSession.draftTitleWords,
        wordsPerPuzzle,
        'titleWords'
      );
      const regenerated = regeneratePuzzleAtIndex(commitPageIndex, words, {
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
    (rangeInput: string) => {
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
      const answersPerPageUpdates = buildGlobalAnswersPerPageUpdate(
        wordSearchSettings,
        editSession.draft
      );
      if (answersPerPageUpdates) {
        mergedGlobalSettings = patchWordSearchSettings(wordSearchSettings, answersPerPageUpdates);
      }

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
      const answersPerPageChanged =
        mergedGlobalSettings.bookCanvas.answersPerPage !==
        wordSearchSettings.bookCanvas.answersPerPage;

      if (bookTextChanged || answersPerPageChanged) {
        updateWordSearchSettings({
          ...(bookTextChanged
            ? {
                typography: mergedGlobalSettings.typography,
                wordList: {
                  ...wordSearchSettings.wordList,
                  aiTheme: mergedGlobalSettings.wordList.aiTheme,
                },
              }
            : {}),
          ...(answersPerPageChanged
            ? { bookCanvas: mergedGlobalSettings.bookCanvas }
            : {}),
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
        const wordsPerPuzzle = Math.max(1, editSession.draft.wordList.wordsPerPuzzle);

        for (const batchIndex of batchIndices) {
          const commitPuzzle = batchPuzzles[batchIndex];
          const words = getWordsForPuzzlePage(
            commitPuzzle,
            editSession.draftTitleWords,
            wordsPerPuzzle,
            'titleWords'
          );
          const regenerated = regeneratePuzzleAtIndex(batchIndex, words, {
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
    (preserveEditedPages = false) => {
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
          const regenerated = regeneratePuzzleAtIndex(i, undefined, {
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
  }, [handleCanvasEditCommitPage, removeCanvasEditTab, runPendingCanvasEditLeave]);

  const handleCanvasEditUnsavedCommitAll = useCallback(() => {
    requestCanvasEditCommitAll(true);
  }, [requestCanvasEditCommitAll]);

  const handleCanvasEditUnsavedDiscard = useCallback(() => {
    setCanvasEditUnsavedDialogOpen(false);
    pendingCanvasEditTabCloseIdRef.current = null;
    runPendingCanvasEditLeave();
  }, [runPendingCanvasEditLeave]);

  const openAllCanvasEditTabs = useCallback(
    (previewTab: 'puzzles' | 'solutions', activeTarget?: CanvasEditTarget) => {
      const targets = CANVAS_EDIT_TARGETS_BY_PREVIEW_TAB[previewTab];
      const desiredActiveTarget = activeTarget ?? targets[0];
      const desiredActiveTabId = makeCanvasEditTabId(desiredActiveTarget, previewTab);

      const allTabsPresent =
        targets.length === canvasEditTabs.length &&
        canvasEditTabs.every((tab) => tab.previewTab === previewTab) &&
        targets.every((target) =>
          canvasEditTabs.some((tab) => tab.id === makeCanvasEditTabId(target, previewTab))
        );

      if (allTabsPresent) {
        if (activeCanvasEditTabId !== desiredActiveTabId) {
          setActiveCanvasEditTabId(desiredActiveTabId);
        }
        return;
      }

      const session = canvasEditSession ?? createSessionForCurrentPage();
      if (!canvasEditSession) {
        setCanvasEditSession(session);
      }
      const snapshot = createSnapshotFromSession(session);

      setCanvasEditTabs(
        targets.map((target) => ({
          id: makeCanvasEditTabId(target, previewTab),
          target,
          previewTab,
          snapshot,
        }))
      );
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
    openAllCanvasEditTabsRef.current(activePreviewTab);
  }, [canvasEditEnabled, activePreviewTab]);

  const handlePreviewRangeModeChange = useCallback(
    (mode: 'sample' | 'all' | 'flipbook') => {
      const apply = () => {
        setPreviewRangeMode(mode);
        if (mode !== 'sample') {
          closeCanvasEditPanel();
        }
      };
      if (hasCanvasEditPanelOpen && mode !== 'sample') {
        guardCanvasEditLeave(apply);
      } else {
        apply();
      }
    },
    [hasCanvasEditPanelOpen, guardCanvasEditLeave, closeCanvasEditPanel, setPreviewRangeMode]
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
      if (tab === activePreviewTab) return;
      guardCanvasEditLeave(() => {
        setActivePreviewTab(tab);
        openAllCanvasEditTabs(tab);
      });
    },
    [activePreviewTab, guardCanvasEditLeave, setActivePreviewTab, openAllCanvasEditTabs]
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

  const guardedInsertDocumentPage = useCallback(
    (type: InsertableDocumentKind, position: 'before' | 'after', referenceId: string) => {
      guardCanvasEditLeave(() => insertDocumentPage(type, position, referenceId));
    },
    [guardCanvasEditLeave, insertDocumentPage]
  );

  const suppressCanvasGuides = canvasEditEnabled && hasCanvasEditPanelOpen;
  const canvasEditHighlightTarget = hasCanvasEditPanelOpen ? null : canvasEditTarget;
  const canvasEditHideGuides = hasCanvasEditPanelOpen;
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

  const sampleInsertAnchor = useMemo((): CompiledPage | null => {
    if (!compiledBook || !activeDocumentPage || activePreviewTab === 'solutions') return null;

    if (activeDocumentPage.moduleType === 'word-search') {
      const docStart = batchPuzzles.findIndex((puzzle) => puzzle.pageId === activeDocumentPageId);
      if (docStart < 0) return null;
      const puzzleIndexInDocument = currentBatchIndex - docStart;
      return (
        compiledBook.pages.find(
          (page): page is Extract<CompiledPage, { kind: 'puzzle' }> =>
            page.kind === 'puzzle' &&
            page.sourceDocumentId === activeDocumentPageId &&
            page.puzzleIndexInDocument === puzzleIndexInDocument
        ) ?? null
      );
    }

    return (
      compiledBook.pages.find(
        (page) => page.kind === 'text' && page.sourceDocumentId === activeDocumentPageId
      ) ?? null
    );
  }, [
    compiledBook,
    activeDocumentPage,
    activePreviewTab,
    batchPuzzles,
    activeDocumentPageId,
    currentBatchIndex,
  ]);

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

          {/* Document tabs — thin bar above canvas toolbar */}
          {!isFlipbookPreview && (
            <CanvasDocumentTabsBar
              documentPages={documentPages}
              activeDocumentPageId={activeDocumentPageId}
              onSelect={guardedSetActiveDocumentPageId}
              onRemove={removeDocumentPage}
              onReorder={reorderDocumentPages}
              onInsert={guardedInsertDocumentPage}
              canUndo={canUndo}
              canRedo={canRedo}
              onUndo={undo}
              onRedo={redo}
            />
          )}

          {/* Top Canvas Toolbar */}
          {!isFlipbookPreview && (
          <div className={cn('preview-top-toolbar', hasPreviewPages ? 'bg-white' : 'bg-white/80 backdrop-blur-md')}>
            <div className="preview-top-toolbar__primary">
              <div className="preview-top-toolbar__title">
                <Layout className="w-4 h-4 text-slate-500 shrink-0" />
                <span className="hidden sm:inline text-xs font-bold text-slate-700 uppercase tracking-wider truncate">
                  Canvas Workspace
                </span>
              </div>

              <div className="preview-top-toolbar__guides preview-top-toolbar__guides--mobile">
                <Checkbox compact label="Margins" checked={showMargins} onCheckedChange={setShowMargins} />
                <Checkbox
                  compact
                  label="KDP Safe"
                  checked={showSafetyZone}
                  onCheckedChange={setShowSafetyZone}
                />
              </div>
            </div>

            <div className="preview-top-toolbar__controls">
              {showPuzzleSolutionTabs && (
              <div className="preview-segmented">
                    <button
                      type="button"
                  onClick={() => guardedSetActivePreviewTab('puzzles')}
                  className={cn(
                    'preview-segmented__btn',
                    activePreviewTab === 'puzzles'
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
                    activePreviewTab === 'solutions'
                      ? 'preview-segmented__btn--active'
                      : 'preview-segmented__btn--inactive'
                  )}
                    >
                      Solutions Page
                    </button>
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
              <Checkbox compact label="Margins" checked={showMargins} onCheckedChange={setShowMargins} />
              <Checkbox compact label="KDP Bleed Safe Zone" checked={showSafetyZone} onCheckedChange={setShowSafetyZone} />
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
                <div className="preview-segmented w-full">
                  <button
                    type="button"
                    onClick={() => guardedSetActivePreviewTab('puzzles')}
                    className={cn(
                      'preview-segmented__btn flex-1 text-center',
                      activePreviewTab === 'puzzles'
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
                      activePreviewTab === 'solutions'
                        ? 'preview-segmented__btn--active'
                        : 'preview-segmented__btn--inactive'
                    )}
                  >
                    Solutions
                  </button>
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
              textPageEditEnabled && 'preview-viewport--text-edit'
            )}
          >
            {canvasEditEnabled && !hasCanvasEditPanelOpen && (
              <span className="canvas-edit-hint">
                {activePreviewTab === 'solutions'
                  ? 'Click an area to edit · drag panel header to move · minimize to preview'
                  : 'Click an area to edit · drag panel header to move · minimize to preview'}
              </span>
            )}
            {textPageEditEnabled &&
              textPageEditPanelOpen &&
              activeTextSettings &&
              activeDocumentPage &&
              activeDocumentPage.moduleType === 'table-of-contents' && (
              <TocContextualControls
                pageName={activeDocumentPage.name}
                settings={activeTextSettings}
                globalSettings={wordSearchSettings}
                documentPages={documentPages}
                tocEntries={compiledBook?.tocEntries ?? []}
                onSettingsChange={handleTextSettingsChange}
                onClose={() => setTextPageEditPanelOpen(false)}
              />
            )}
            {textPageEditEnabled &&
              textPageEditPanelOpen &&
              activeTextSettings &&
              activeDocumentPage &&
              activeDocumentPage.moduleType !== 'table-of-contents' && (
              <TextPageContextualControls
                pageName={activeDocumentPage.name}
                settings={activeTextSettings}
                globalSettings={wordSearchSettings}
                activeTarget={textPageEditTarget}
                selectedBlockId={selectedTextBlockId}
                onTargetChange={handleTextEditTargetChange}
                onSelectBlock={(blockId, options) =>
                  handleSelectTextBlock(blockId, { showChrome: options?.showChrome ?? false })
                }
                onSettingsChange={handleTextSettingsChange}
                documentPages={documentPages}
                activePageId={activeDocumentPage.id}
                onApplySeparatorLayouts={applyTextSettingsToDocumentPages}
                onClose={() => setTextPageEditPanelOpen(false)}
                onHideBlockChrome={handleHideTextBlockChrome}
              />
            )}
            {textPageEditEnabled && !textPageEditPanelOpen && (
              <span className="canvas-edit-hint">
                {activeDocumentPage?.moduleType === 'table-of-contents'
                  ? 'Click the table of contents to open styling controls · click any text to edit'
                  : 'Drag elements to move · click text to edit · use panel to add more'}
              </span>
            )}
            {canvasEditEnabled && hasCanvasEditPanelOpen && editSession && canvasEditTarget && (
              <CanvasContextualControls
                target={canvasEditTarget}
                pageKind={activePreviewTab === 'solutions' ? 'solution' : 'puzzle'}
                pageIndex={currentBatchIndex}
                currentPuzzle={batchPuzzles[currentBatchIndex] ?? null}
                draftSettings={editSession.draft}
                onDraftSettingsChange={handleCanvasEditDraftSettingsChange}
                draftPuzzleGridScale={editSession.draftPuzzleGridScale}
                onDraftPuzzleGridScaleChange={handleCanvasEditDraftGridScaleChange}
                draftTitleWords={editSession.draftTitleWords}
                onDraftTitleWordsChange={handleCanvasEditDraftTitleWordsChange}
                onCommitPage={handleCanvasEditCommitPage}
                onCommitAll={() => requestCanvasEditCommitAll(false)}
                onCommitRange={handleCanvasEditCommitRange}
                onCancel={handleCanvasEditCancel}
                hasUnsavedChanges={canvasEditHasUnsavedChanges}
                canApplyToAllPages={canvasEditCanApplyToAllPages}
                documentPuzzleCount={activeDocumentPuzzleCount}
                rangeError={canvasEditRangeError}
                canApplyToSelectedPages={canApplyToSelectedPages}
                editTabs={canvasEditPanelTabs}
                activeEditTabId={activeCanvasEditTabId}
                onEditTabSelect={handleCanvasEditTabSelect}
                onEditTabClose={handleCanvasEditTabClose}
              />
            )}
            {activeDocumentPage?.moduleType === 'crossword' &&
              crosswordEditPanelOpen &&
              crosswordSettings && (
              <CrosswordContextualControls
                settings={crosswordSettings}
                activeTarget={crosswordEditTarget}
                onTargetChange={setCrosswordEditTarget}
                onSettingsChange={updateCrosswordSettings}
                onClose={() => setCrosswordEditPanelOpen(false)}
              />
            )}
            {activeDocumentPage?.moduleType === 'crossword' && !crosswordEditPanelOpen && (
              <button
                type="button"
                className="canvas-edit-hint"
                onClick={() => setCrosswordEditPanelOpen(true)}
              >
                Open crossword canvas controls
              </button>
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
                      textPageEditEnabled && 'preview-canvas-scale--text-edit'
                    )}
                style={{
                  transform: `scale(${previewZoom / 100})`,
                  transformOrigin: 'top center',
                  width: widthPx,
                  overflow: 'visible',
                }}
              >
                      <DocumentPageCanvas
                      page={activeDocumentPage}
                        activeDocumentPageId={activeDocumentPageId}
                        currentPuzzleType={currentPuzzleType}
                        currentPuzzle={currentPuzzle}
                        batchPuzzles={batchPuzzles}
                        currentBatchIndex={currentBatchIndex}
                        activePreviewTab={activePreviewTab}
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
                      crosswordSettings={crosswordSettings}
                      />
                    </div>
                  {sampleInsertAnchor && (
                    <button
                      type="button"
                      className="preview-sample-insert-after"
                      title="Add blank page after"
                      aria-label="Add blank page after"
                      onClick={() => handleInsertSeparatorAfter(sampleInsertAnchor)}
                      style={{ transform: `scale(${Math.max(0.85, previewZoom / 100)})` }}
                    >
                      +
                    </button>
                  )}
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
                          onInsertAfter={
                            compiledPage.kind !== 'solution'
                              ? () => handleInsertSeparatorAfter(compiledPage)
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
                        crosswordSettings={crosswordSettings}
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
                  <div className="preview-segmented">
                    <button
                      type="button"
                      onClick={() => guardedSetActivePreviewTab('puzzles')}
                      className={cn(
                        'preview-segmented__btn',
                        activePreviewTab === 'puzzles'
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
                        activePreviewTab === 'solutions'
                          ? 'preview-segmented__btn--active'
                          : 'preview-segmented__btn--inactive'
                      )}
                    >
                      Solutions
                    </button>
                  </div>
                </div>
              ) : activePreviewTab === 'solutions' ? (
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
                    min={1}
                    max={solutionPages.length || 1}
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
                    {solutionPages.length || 1}
                  </span>
                  <Button
                    size="xs"
                    variant="outline"
                    onClick={() => setCurrentSolutionPageIndex(Math.min((solutionPages.length || 1) - 1, currentSolutionPageIndex + 1))}
                    disabled={currentSolutionPageIndex === (solutionPages.length || 1) - 1}
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
                      if (hasPreviewPages && activeDocumentPuzzleStartIndex >= 0) {
                        guardedSetCurrentBatchIndex(
                          Math.max(activeDocumentPuzzleStartIndex, currentBatchIndex - 1)
                        );
                        return;
                      }
                      guardedSetCurrentBatchIndex(Math.max(0, currentBatchIndex - 1));
                    }}
                    disabled={
                      hasPreviewPages && activeDocumentPuzzleStartIndex >= 0
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
                    min={1}
                    max={
                      hasPreviewPages && activeDocumentPuzzleCount > 0
                        ? activeDocumentPuzzleCount
                        : batchPuzzles.length || 1
                    }
                    value={batchPageInputValue}
                    onChange={(e) => setBatchPageInputValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
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
                    {hasPreviewPages && activeDocumentPuzzleCount > 0
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
                      if (hasPreviewPages && activeDocumentPuzzleStartIndex >= 0) {
                        const lastIndex = activeDocumentPuzzleStartIndex + activeDocumentPuzzleCount - 1;
                        guardedSetCurrentBatchIndex(Math.min(lastIndex, currentBatchIndex + 1));
                        return;
                      }
                      guardedSetCurrentBatchIndex(Math.min((batchPuzzles.length || 1) - 1, currentBatchIndex + 1));
                    }}
                    disabled={
                      hasPreviewPages && activeDocumentPuzzleStartIndex >= 0
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
                    min={1}
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
                  min={25}
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
        hasUnsavedChanges={canvasEditHasUnsavedChanges}
        canApplyToAllPages={canvasEditCanApplyToAllPages}
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
    </div>
  );
}
