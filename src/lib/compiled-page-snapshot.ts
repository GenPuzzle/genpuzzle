/**
 * Generic "render the page exactly like the UI canvas" fallback for PDF/PPT export.
 *
 * Any compiled book page the exporters cannot draw natively (vector) is rendered
 * offscreen with the SAME React component the preview canvas uses, then rasterized
 * to a JPEG and placed full-page. Because preview and export share one component,
 * they cannot drift — and new puzzle types only need a case in
 * buildCompiledPageElement() below to export correctly everywhere.
 *
 * Rasterization uses html2canvas-pro (not html2canvas): Tailwind v4 emits
 * oklch() colors, which html2canvas 1.4.1 cannot parse — it throws and produced
 * blank export pages.
 *
 * Crossword / sudoku / maze / trivia / scramble / cryptogram are drawn natively
 * (text + shapes) in PDF and PPT. This snapshot path is only a fallback for
 * page kinds that still lack a vector drawer.
 */

import type { CompiledPage } from './book-compiler';
import { getTitleWordsForDocument } from './book-compiler';
import type { DocumentPage } from './document-model';
import type { TitleWordsSettings, WordSearchSettings } from './puzzles/types';
import { getPageDimensionsInches } from './puzzle-layout';

const PT_TO_PX = 96 / 72;

export interface CompiledPageSnapshotContext {
  documentPages: DocumentPage[];
  /** Supplies page trim dimensions — same source the preview canvas uses. */
  layoutSettings: WordSearchSettings;
  /** Global fallback title words (per-document title words take precedence). */
  titleWords: TitleWordsSettings;
  /** Supersampling factor. 2 ≈ 192 DPI at a 96 DPI base (good print quality, much faster than 3). */
  scale?: number;
  /**
   * PPT hybrid export: omit Style background image/color fill so the slide can
   * keep a native (editable) background + page frame underneath the content raster.
   */
  omitBackground?: boolean;
  /** PPT hybrid export: draw page numbers as native PPT text instead. */
  hidePageNumber?: boolean;
}

export interface CompiledPageSnapshotResult {
  dataUrl: string;
  widthPt: number;
  heightPt: number;
}

/** Word-search / text / blank pages the classic exporters draw natively. */
export function isNativelyDrawnPageKind(kind: CompiledPage['kind']): boolean {
  return kind === 'text' || kind === 'blank' || kind === 'puzzle' || kind === 'solution';
}

/** Crossword / sudoku / maze / trivia / scramble — native text + shapes in PDF and PPT. */
export function isGenericOrCrosswordPageKind(kind: CompiledPage['kind']): boolean {
  return (
    kind === 'crossword' ||
    kind === 'crossword-solution' ||
    kind === 'generic-puzzle' ||
    kind === 'generic-puzzle-solution'
  );
}

function waitForPaint(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });
}

async function waitForImages(root: HTMLElement, timeoutMs = 1500): Promise<void> {
  const images = Array.from(root.querySelectorAll('img'));
  if (images.length === 0) return;

  await Promise.race([
    Promise.all(
      images.map(
        (img) =>
          new Promise<void>((resolve) => {
            if (img.complete && img.naturalWidth > 0) {
              resolve();
              return;
            }
            const done = () => resolve();
            img.addEventListener('load', done, { once: true });
            img.addEventListener('error', done, { once: true });
          })
      )
    ),
    new Promise<void>((resolve) => setTimeout(resolve, timeoutMs)),
  ]);
}

/**
 * Maps a compiled page to the React element the preview canvas renders for it.
 * Register new puzzle types here — both exporters pick them up automatically.
 */
async function buildCompiledPageElement(
  page: CompiledPage,
  ctx: CompiledPageSnapshotContext
): Promise<React.ReactElement | null> {
  const React = await import('react');
  const exportChrome = {
    omitBackground: !!ctx.omitBackground,
    hidePageNumber: !!ctx.hidePageNumber,
  };

  switch (page.kind) {
    case 'crossword':
    case 'crossword-solution': {
      const { GenericPuzzlePageCanvas } = await import('@/components/PreviewCanvas');
      const isSolution = page.kind === 'crossword-solution';
      const puzzles = isSolution ? page.puzzles : [page.puzzle];
      if (puzzles.length === 0) return null;

      return React.createElement(GenericPuzzlePageCanvas, {
        puzzleType: 'crossword',
        puzzle: puzzles[0],
        puzzles: isSolution ? puzzles : undefined,
        settings: ctx.layoutSettings,
        titleWords: getTitleWordsForDocument(
          ctx.documentPages,
          page.sourceDocumentId,
          ctx.titleWords
        ),
        showSolution: isSolution,
        showMargins: false,
        showSafetyZone: false,
        safetyMarginPx: 0,
        ptToPx: (pt: number) => pt * PT_TO_PX,
        crosswordSettings: page.crosswordSettings,
        puzzleIndex: isSolution
          ? (puzzles[0]?.puzzleIndexInDocument ?? 0)
          : page.puzzleIndexInDocument,
        bookPageIndex: page.bookPageIndex,
        canvasEditEnabled: false,
        ...exportChrome,
      });
    }
    case 'generic-puzzle':
    case 'generic-puzzle-solution': {
      const { GenericPuzzlePageCanvas } = await import('@/components/PreviewCanvas');
      const isSolution = page.kind === 'generic-puzzle-solution';
      const puzzles = page.puzzles;
      if (puzzles.length === 0) return null;

      return React.createElement(GenericPuzzlePageCanvas, {
        puzzleType: page.puzzleType,
        puzzle: puzzles[0],
        puzzles: puzzles.length > 1 || isSolution ? puzzles : undefined,
        settings: ctx.layoutSettings,
        titleWords: getTitleWordsForDocument(
          ctx.documentPages,
          page.sourceDocumentId,
          ctx.titleWords
        ),
        showSolution: isSolution,
        showMargins: false,
        showSafetyZone: false,
        safetyMarginPx: 0,
        ptToPx: (pt: number) => pt * PT_TO_PX,
        genericSettings: page.genericSettings,
        puzzleIndex: isSolution
          ? (puzzles[0]?.puzzleIndexInDocument ?? 0)
          : page.puzzleIndexInDocument,
        bookPageIndex: page.bookPageIndex,
        canvasEditEnabled: false,
        ...exportChrome,
      });
    }
    case 'murdoku':
    case 'murdoku-solution': {
      const { MurdokuPageCanvas } = await import('@/components/puzzle/MurdokuPagePreview');
      const isSolution = page.kind === 'murdoku-solution';
      const puzzle = isSolution ? page.puzzles[0] : page.puzzle;
      if (!puzzle) return null;

      return React.createElement(MurdokuPageCanvas, {
        puzzle,
        settings: page.murdokuSettings,
        layoutSettings: ctx.layoutSettings,
        showSolution: isSolution,
        showMargins: false,
        showSafetyZone: false,
        safetyMarginPx: 0,
        bookPageIndex: page.bookPageIndex,
        pagePart: isSolution
          ? page.murdokuSettings.core.twoPagePuzzles
            ? 'scene'
            : 'single'
          : page.kind === 'murdoku'
            ? page.pagePart
            : 'single',
        ...exportChrome,
      });
    }
    default:
      return null;
  }
}

export async function captureCompiledPageSnapshot(
  page: CompiledPage,
  ctx: CompiledPageSnapshotContext
): Promise<CompiledPageSnapshotResult | null> {
  if (typeof document === 'undefined') return null;

  const dims = getPageDimensionsInches(ctx.layoutSettings);
  const widthPt = dims.width * 72;
  const heightPt = dims.height * 72;
  const widthPx = Math.ceil(widthPt * PT_TO_PX);
  const heightPx = Math.ceil(heightPt * PT_TO_PX);

  const container = document.createElement('div');
  // Keep off-screen without opacity:0 — parent opacity breaks child opacity
  // compositing in html2canvas (background image opacity then mismatches PDF).
  container.style.cssText =
    'position:fixed;left:-10000px;top:0;pointer-events:none;z-index:-9999;overflow:hidden;';
  container.style.width = `${widthPx}px`;
  container.style.height = `${heightPx}px`;
  document.body.appendChild(container);

  let root: { render: (el: unknown) => void; unmount: () => void } | null = null;

  try {
    const element = await buildCompiledPageElement(page, ctx);
    if (!element) {
      console.warn(
        `[captureCompiledPageSnapshot] no element factory for page kind "${page.kind}"`
      );
      return null;
    }

    const { createRoot } = await import('react-dom/client');
    const { default: html2canvas } = await import('html2canvas-pro');

    root = createRoot(container);
    root.render(element);

    await waitForPaint();
    const el = (container.firstElementChild as HTMLElement) ?? container;
    await waitForImages(el);
    // Fonts/layout settle before capture.
    await new Promise((r) => setTimeout(r, 40));

    const canvas = await html2canvas(el, {
      scale: ctx.scale ?? 2,
      // null keeps transparent pixels so PPT can keep a native slide background
      // underneath hybrid content rasters.
      backgroundColor: ctx.omitBackground ? null : '#ffffff',
      width: widthPx,
      height: heightPx,
      windowWidth: widthPx,
      windowHeight: heightPx,
      logging: false,
      useCORS: true,
      allowTaint: true,
    });

    return {
      // PNG when omitting background (needs alpha); JPEG otherwise for speed.
      dataUrl: ctx.omitBackground
        ? canvas.toDataURL('image/png')
        : canvas.toDataURL('image/jpeg', 0.92),
      widthPt,
      heightPt,
    };
  } catch (e) {
    console.error(`[captureCompiledPageSnapshot] failed for kind "${page.kind}"`, e);
    return null;
  } finally {
    root?.unmount();
    container.remove();
  }
}
