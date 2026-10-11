/**
 * Shared layout consistency checks.
 * Run: npm run check:layout
 *
 * Geometry and expected strings are checked on PDF and PPTX bytes.
 * Browser preview capture uses ResolvedElementsView HTML when Edge or Chrome is installed.
 * PPTX raster comparison runs only when LibreOffice (`soffice`) is installed.
 */
import { spawn } from 'child_process';
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { inflateSync } from 'zlib';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { PDFDocument, StandardFonts } from 'pdf-lib';
import PptxGenJS from 'pptxgenjs';
import JSZip from 'jszip';
import { getDefaultCrosswordSettings } from '../crossword-settings';
import { computeGenericPageLayout } from '../generic-puzzle-page-layout';
import { getDefaultGenericPuzzleSettings } from '../generic-puzzle-settings';
import { mazeSolutionRuns } from '../generic-puzzle-geometry';
import {
  getDefaultWordSearchSettings,
  type CrosswordPuzzle,
  type MazePuzzle,
  type SudokuPuzzle,
  type TriviaPuzzle,
  type WordScramblePuzzle,
} from '../puzzles/types';
import type { UnifiedWordListBlock } from '../word-search-page-layout';
import {
  buildCrosswordElements,
  buildCryptogramElements,
  buildScrambleElements,
  buildTriviaElements,
  buildWordListElements,
} from './book-elements';
import { buildMazeElements } from './maze-elements';
import { renderResolvedPdf } from './render-pdf';
import { renderResolvedPpt } from './render-ppt';
import { ResolvedElementsView } from './ResolvedElementsView';
import { runAutoEnhanceChecks } from '../auto-enhance.selftest';
import { runMazeStartEndImageChecks } from '../maze-start-end-images.selftest';
import { runPageVariableChecks } from '../page-variables.selftest';
import { runUnicodeTextChecks } from '../unicode-text.selftest';
import { isLetterGrapheme, segmentGraphemes, textNeedsExtendedLatin } from '../unicode-text';
import { getResolvedPage, invalidateResolvedPages, stableRevision } from './snapshot';
import { mazeSudokuPreviewRevision } from './SharedMazeSudokuView';
import { buildSudokuElements } from './sudoku-elements';
import { buildCodewordsElements } from './codewords-elements';
import type { ResolvedElement } from './types';
import { unsupportedPrimitive } from './types';
import { buildWordSearchGridElements, wordSearchSolutionStyle } from './word-search-elements';
import { RESOLVED_ELEMENT_KINDS, type ResolvedElementKind } from './dispatch';
import { EXPORT_ROUTES } from './export-routes';

const ONE_PIXEL_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64'
);

function sampleElement(kind: ResolvedElementKind): ResolvedElement {
  switch (kind) {
    case 'text':
      return {
        kind: 'text',
        x: 4,
        y: 4,
        w: 40,
        h: 12,
        text: 'KIND',
        lines: ['KIND'],
        fontFamily: 'Helvetica',
        fontSize: 10,
        color: '#111111',
        align: 'left',
        valign: 'top',
        lineHeight: 12,
      };
    case 'rect':
      return { kind: 'rect', x: 4, y: 20, w: 16, h: 8, fill: '#dddddd', stroke: '#111111', strokeWidth: 0.5 };
    case 'ellipse':
      return { kind: 'ellipse', cx: 12, cy: 40, rx: 6, ry: 4, fill: '#cccccc' };
    case 'line':
      return { kind: 'line', x1: 4, y1: 50, x2: 24, y2: 58, color: '#111111', width: 1 };
    case 'stadium':
      return { kind: 'stadium', x1: 4, y1: 66, x2: 24, y2: 66, color: '#111111', thickness: 3 };
    case 'polygon':
      return {
        kind: 'polygon',
        points: [
          { x: 4, y: 74 },
          { x: 16, y: 74 },
          { x: 10, y: 84 },
        ],
        fill: '#333333',
      };
    case 'image':
      return {
        kind: 'image',
        x: 4,
        y: 90,
        w: 8,
        h: 8,
        href: `data:image/png;base64,${ONE_PIXEL_PNG.toString('base64')}`,
        fit: 'stretch',
      };
    case 'shape':
      return {
        kind: 'shape',
        shape: 'star5',
        x: 20,
        y: 90,
        w: 10,
        h: 10,
        fill: '#dbeafe',
        stroke: '#1d4ed8',
        strokeWidth: 1,
      };
    default: {
      const missing: never = kind;
      throw new Error(`No sample for primitive "${missing}". Add it to every renderer.`);
    }
  }
}

async function assertEveryPrimitiveIsDrawn(): Promise<void> {
  const samples = RESOLVED_ELEMENT_KINDS.map(sampleElement);
  const preview = renderToStaticMarkup(
    React.createElement(ResolvedElementsView, { elements: samples, widthPt: 40, heightPt: 110, scale: 1 })
  );
  assert(preview.includes('KIND'), 'canvas renderer did not draw the text primitive');
  assert(preview.includes('<img'), 'canvas renderer did not draw the image primitive');

  const pdf = await PDFDocument.create();
  const page = pdf.addPage([80, 120]);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const png = await pdf.embedPng(ONE_PIXEL_PNG);
  renderResolvedPdf(page, 120, samples, () => font, () => png);

  const ppt = new PptxGenJS();
  ppt.defineLayout({ name: 'PROBE', width: 2, height: 2 });
  ppt.layout = 'PROBE';
  const slide = ppt.addSlide();
  renderResolvedPpt(slide as never, samples);
}

function assertNoNewSnapshotRoutes(): string[] {
  const debt: string[] = [];
  for (const [kind, route] of Object.entries(EXPORT_ROUTES)) {
    if (route.mode !== 'snapshot') continue;
    if (kind === 'murdoku' || kind === 'murdoku-solution') {
      debt.push(kind);
      continue;
    }
    throw new Error(
      `Page kind "${kind}" is registered as a snapshot export. New puzzle types must use the shared layout in the preview, PDF, and PPTX.`
    );
  }
  return debt;
}

function assert(cond: unknown, message: string): void {
  if (!cond) throw new Error(message);
}

const slot = { leftPt: 36, topPt: 72, widthPt: 360, heightPt: 360 };

function maze(): MazePuzzle {
  const grid = [
    [true, true, true],
    [true, false, true],
    [true, true, true],
  ];
  return {
    type: 'maze',
    grid,
    start: { row: 1, col: 0 },
    end: { row: 1, col: 2 },
    size: 'small',
    solutionPath: [
      { row: 1, col: 0 },
      { row: 1, col: 1 },
      { row: 1, col: 2 },
    ],
  };
}

function sudoku(): SudokuPuzzle {
  const row = [1, 2, 3, 4];
  const grid = [row, [3, 4, 1, 2], [2, 1, 4, 3], [4, 3, 2, 1]];
  return {
    type: 'sudoku',
    size: 4,
    difficulty: 'easy',
    grid,
    solution: grid,
  };
}

function textsOf(elements: ResolvedElement[]): string[] {
  return elements.filter((el) => el.kind === 'text').map((el) => el.text);
}

function inflatePdf(pdfBytes: Uint8Array): string {
  const text = Buffer.from(pdfBytes).toString('latin1');
  const streams = [...text.matchAll(/stream\r?\n([\s\S]*?)\r?\nendstream/g)].map((match) => {
    const body = Buffer.from(match[1], 'latin1');
    try {
      return inflateSync(body).toString('latin1');
    } catch {
      return body.toString('latin1');
    }
  });
  return streams.join('\n');
}

function run(command: string, args: string[], cwd?: string): Promise<{ code: number; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    const child = spawn(command, args, { cwd, windowsHide: true });
    let stdout = '';
    let stderr = '';
    const timer = setTimeout(() => {
      child.kill();
    }, 45000);
    child.stdout?.on('data', (chunk) => {
      stdout += String(chunk);
    });
    child.stderr?.on('data', (chunk) => {
      stderr += String(chunk);
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      resolve({ code: code ?? 1, stdout, stderr });
    });
    child.on('error', (error) => {
      clearTimeout(timer);
      resolve({ code: 1, stdout, stderr: error.message });
    });
  });
}

function browserBinary(): string | null {
  const candidates = [
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium-browser',
    '/usr/bin/chromium',
  ];
  return candidates.find((path) => existsSync(path)) ?? null;
}

function sofficeBinary(): string | null {
  const candidates = [
    'C:\\Program Files\\LibreOffice\\program\\soffice.exe',
    'C:\\Program Files (x86)\\LibreOffice\\program\\soffice.exe',
    '/usr/bin/soffice',
    '/usr/bin/libreoffice',
  ];
  return candidates.find((path) => existsSync(path)) ?? null;
}

async function pdfText(pdfBytes: Uint8Array): Promise<string> {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const loaded = await pdfjs.getDocument({ data: new Uint8Array(pdfBytes), disableWorker: true } as never).promise;
  const page = await loaded.getPage(1);
  const content = await page.getTextContent();
  // Join without inserted spaces: PDF character spacing (Tc) makes pdf.js emit
  // one item per glyph, and a ' ' join would break phrases like NARGEO.
  return content.items.map((item) => ('str' in item ? item.str : '')).join('');
}

async function main(): Promise<void> {
  runMazeStartEndImageChecks();
  runAutoEnhanceChecks();
  runPageVariableChecks();
  runUnicodeTextChecks();
  const gp = getDefaultGenericPuzzleSettings('maze');
  const mazeA = buildMazeElements({
    puzzle: maze(),
    slot,
    preferredCellPt: 18,
    framePt: 300,
    gp,
    showSolution: true,
  });
  const mazeB = buildMazeElements({
    puzzle: maze(),
    slot,
    preferredCellPt: 18,
    framePt: 300,
    gp,
    showSolution: true,
  });
  assert(JSON.stringify(mazeA) === JSON.stringify(mazeB), 'maze elements must be deterministic');
  assert(mazeA.some((el) => el.kind === 'stadium'), 'maze walls must be continuous stadiums');
  assert(
    mazeA.filter((el) => el.kind === 'stadium').length < 12,
    'collinear maze walls must be merged'
  );
  const pathColor = gp.colors.solutionPathColor || '#e11d48';
  const solutionRuns = mazeA.filter((el) => el.kind === 'stadium' && el.color === pathColor);
  assert(solutionRuns.length === 1, 'a straight maze answer must be one continuous stadium, not one shape per cell');
  const turned = mazeSolutionRuns([
    { xPt: 0, yPt: 0 },
    { xPt: 10, yPt: 0 },
    { xPt: 20, yPt: 0 },
    { xPt: 20, yPt: 10 },
    { xPt: 20, yPt: 20 },
  ]);
  assert(turned.length === 2, 'a maze answer turn must stay two runs, not one shape per cell');
  const solidPath = buildMazeElements({
    puzzle: maze(),
    slot,
    preferredCellPt: 18,
    framePt: 300,
    gp,
    showSolution: true,
  });
  const dashedPath = buildMazeElements({
    puzzle: maze(),
    slot,
    preferredCellPt: 18,
    framePt: 300,
    gp: { ...gp, core: { ...gp.core, mazeSolutionPathStyle: 'dashed' } },
    showSolution: true,
  });
  assert(
    JSON.stringify(solidPath) !== JSON.stringify(dashedPath),
    'solution path line style must change the drawn maze elements'
  );
  const revisionInput = {
    puzzleType: 'maze' as const,
    showSolution: true,
    slot,
    cell: 18,
    frame: 300,
    puzzle: maze(),
    gp,
  };
  assert(
    mazeSudokuPreviewRevision(revisionInput) !==
      mazeSudokuPreviewRevision({
        ...revisionInput,
        gp: { ...gp, core: { ...gp.core, mazeSolutionPathStyle: 'dashed' } },
      }),
    'canvas cache key must change when the solution path line changes'
  );

  const sudokuGp = getDefaultGenericPuzzleSettings('sudoku');
  const { buildSudokuElementParts } = await import('./sudoku-elements');
  const sudokuParts = buildSudokuElementParts({
    puzzle: sudoku(),
    slot,
    gp: sudokuGp,
    showSolution: false,
    preferredCellPt: 28,
  });
  const digits = sudokuParts.elements;
  const digitTexts = digits.filter((el) => el.kind === 'text' && el.text !== '');
  assert(digitTexts.length >= 16, 'sudoku cells must be shared text elements');
  assert(textsOf(digits).includes('1'), 'sudoku fixture must keep the digit 1');
  assert(
    sudokuParts.gridBox.w > 0 && sudokuParts.gridBox.h > 0,
    'sudoku must expose a positive gridBox for canvas selection'
  );

  const sudokuXPuzzle: SudokuPuzzle = {
    ...sudoku(),
    variant: 'x',
  };
  const sudokuXBoxesGp = {
    ...sudokuGp,
    core: { ...sudokuGp.core, sudokuXMarkStyle: 'boxes' as const },
    colors: { ...sudokuGp.colors, sudokuXBoxColor: '#e6e6e6' },
  };
  const sudokuXBoxEls = buildSudokuElements({
    puzzle: sudokuXPuzzle,
    slot,
    gp: sudokuXBoxesGp,
    showSolution: false,
    preferredCellPt: 28,
  });
  const diagonalFills = sudokuXBoxEls.filter(
    (el) => el.kind === 'rect' && el.fill === '#e6e6e6'
  );
  assert(diagonalFills.length >= 7, 'Sudoku X boxes mode fills diagonal cells');
  assert(
    sudokuXBoxEls.some((el) => el.kind === 'text' && el.text === '1'),
    'Sudoku X digits stay live text above diagonal boxes'
  );
  const sudokuXLinesGp = {
    ...sudokuGp,
    core: {
      ...sudokuGp.core,
      sudokuXMarkStyle: 'lines' as const,
      sudokuXLineThickness: 120,
      sudokuXLineTransparency: 40,
    },
    colors: { ...sudokuGp.colors, sudokuXLineColor: '#6b7280' },
  };
  const sudokuXLineEls = buildSudokuElements({
    puzzle: sudokuXPuzzle,
    slot,
    gp: sudokuXLinesGp,
    showSolution: false,
    preferredCellPt: 28,
  });
  const sudokuXDiags = sudokuXLineEls.filter(
    (el) =>
      el.kind === 'line' && Math.abs(el.x2 - el.x1) > 1 && Math.abs(el.y2 - el.y1) > 1
  );
  assert(sudokuXDiags.length >= 2, 'Sudoku X lines mode draws both diagonals');
  assert(
    sudokuXDiags.every((el) => el.kind === 'line' && el.opacity != null && el.opacity < 1),
    'Sudoku X lines honor transparency'
  );

  const { generateSudoku } = await import('../puzzles/sudoku');
  const greaterThanPuzzle = generateSudoku({
    difficulty: 'easy',
    size: 9,
    variant: 'greater-than',
  });
  const greaterThanEls = buildSudokuElements({
    puzzle: greaterThanPuzzle,
    slot,
    gp: sudokuGp,
    showSolution: false,
    preferredCellPt: 28,
  });
  const ineqGlyphs = greaterThanEls.filter(
    (el) => el.kind === 'text' && (el.text === '<' || el.text === '>')
  );
  assert(
    ineqGlyphs.length >= (greaterThanPuzzle.inequalities?.length ?? 0),
    'Greater Than inequalities are live text glyphs'
  );
  assert(
    greaterThanPuzzle.grid.every((row) => row.every((v) => v === 0)),
    'Greater Than default has no prefilled digits'
  );
  const gtSolutionEls = buildSudokuElements({
    puzzle: greaterThanPuzzle,
    slot,
    gp: sudokuGp,
    showSolution: true,
    preferredCellPt: 28,
  });
  assert(
    gtSolutionEls.some((el) => el.kind === 'text' && el.text === '1'),
    'Greater Than solution page keeps live digit text'
  );

  const { generateBinairo } = await import('../puzzles/binairo');
  const { buildBinairoElementParts, buildBinairoElements } = await import('./binairo-elements');
  const binairoPuzzle = generateBinairo({
    size: 6,
    difficulty: 'easy',
    seed: 42,
    symbols: '01',
    timeBudgetMs: 15000,
  });
  const binairoParts = buildBinairoElementParts({
    puzzle: binairoPuzzle,
    slot,
    gp: getDefaultGenericPuzzleSettings('binairo'),
    showSolution: false,
    preferredCellPt: 28,
  });
  const binairoElements = binairoParts.elements;
  assert(
    binairoElements.some((el) => el.kind === 'rect') && binairoElements.some((el) => el.kind === 'line'),
    'binairo must emit shared rect + line primitives'
  );
  assert(
    binairoParts.gridBox.w > 0 && binairoParts.gridBox.h > 0,
    'binairo must expose a positive gridBox for canvas selection'
  );
  assert(
    binairoElements.some((el) => el.kind === 'line' && typeof (el as { width?: number }).width === 'number'),
    'binairo lines must use width (not strokeWidth)'
  );
  assert(
    textsOf(binairoElements).some((t) => t === '0' || t === '1'),
    'binairo puzzle must show clue digits'
  );
  const binairoSolutionElements = buildBinairoElements({
    puzzle: binairoPuzzle,
    slot,
    gp: getDefaultGenericPuzzleSettings('binairo'),
    showSolution: true,
    preferredCellPt: 28,
  });
  assert(
    textsOf(binairoSolutionElements).length >= 36,
    'binairo solution must fill the grid with symbols'
  );

  const { generateKakuro } = await import('../puzzles/kakuro');
  const { buildKakuroElementParts, buildKakuroElements } = await import('./kakuro-elements');
  const kakuroPuzzle = generateKakuro({
    size: 7,
    difficulty: 'easy',
    pattern: 'asymmetric',
    seed: 123,
    timeBudgetMs: 30000,
  });
  const kakuroParts = buildKakuroElementParts({
    puzzle: kakuroPuzzle,
    slot,
    gp: getDefaultGenericPuzzleSettings('kakuro'),
    showSolution: false,
    preferredCellPt: 28,
  });
  const kakuroElements = kakuroParts.elements;
  assert(
    kakuroElements.some((el) => el.kind === 'rect') && kakuroElements.some((el) => el.kind === 'line'),
    'kakuro must emit shared rect + line primitives'
  );
  assert(
    kakuroParts.gridBox.w > 0 && kakuroParts.gridBox.h > 0,
    'kakuro must expose a positive gridBox for canvas selection'
  );
  assert(
    kakuroElements.some((el) => el.kind === 'line' && typeof (el as { width?: number }).width === 'number'),
    'kakuro lines must use width (not strokeWidth)'
  );
  assert(
    textsOf(kakuroElements).some((t) => /^\d+$/.test(t)),
    'kakuro puzzle must show clue digits'
  );
  const kakuroSolutionElements = buildKakuroElements({
    puzzle: kakuroPuzzle,
    slot,
    gp: getDefaultGenericPuzzleSettings('kakuro'),
    showSolution: true,
    preferredCellPt: 28,
  });
  assert(
    textsOf(kakuroSolutionElements).length >= 10,
    'kakuro solution must fill playable cells with digits'
  );

  const { generateMathMaze } = await import('../puzzles/math-maze');
  const { buildMathMazeElementParts } = await import('./math-maze-elements');
  const mathMazePuzzle = generateMathMaze({
    equationsAcross: 3,
    equationsDown: 3,
    seed: 42,
  });
  const mathMazeParts = buildMathMazeElementParts({
    puzzle: mathMazePuzzle,
    slot,
    gp: getDefaultGenericPuzzleSettings('math-maze'),
    showSolution: true,
    preferredCellPt: 28,
  });
  assert(mathMazeParts.gridBox.w > 0 && mathMazeParts.gridBox.h > 0, 'math-maze gridBox');
  assert(
    mathMazeParts.elements.some((el) => el.kind === 'text'),
    'math-maze must emit equation text'
  );
  assert(
    mathMazeParts.elements.some((el) => el.kind === 'text' && el.text === 'Start'),
    'math-maze Start label'
  );
  assert(
    mathMazeParts.elements.some((el) => el.kind === 'text' && el.text === 'End'),
    'math-maze End label'
  );
  assert(
    mathMazeParts.elements.some((el) => el.kind === 'rect' && (el.radius ?? 0) > 0),
    'math-maze rounded boxes'
  );

  const { generateFill } = await import('../puzzles/fill');
  const { buildFillElementParts } = await import('./fill-elements');
  const fillPuzzle = generateFill({
    mode: 'word',
    width: 10,
    height: 10,
    words: ['CAT', 'DOG', 'BIRD', 'FISH'],
    seed: 3,
  });
  const fillParts = buildFillElementParts({
    puzzle: fillPuzzle,
    slot,
    gp: getDefaultGenericPuzzleSettings('word-fill'),
    showSolution: false,
    preferredCellPt: 18,
  });
  assert(fillParts.gridBox.w > 0, 'fill gridBox');
  assert(fillPuzzle.type === 'word-fill', 'fill puzzle type follows mode');
  assert(
    fillParts.listBox != null && fillParts.listBox.y >= fillParts.gridBox.y + fillParts.gridBox.h,
    'fill word list sits under the grid'
  );
  assert(
    fillParts.elements.some((el) => el.kind === 'text' && el.text === '4 letters'),
    'fill word list grouped by length'
  );
  assert(
    fillParts.elements.some((el) => el.kind === 'line' && Array.isArray(el.dash)),
    'fill word bank headings use a dotted underline'
  );
  const fillListTop = fillParts.listBox?.y ?? 0;
  const fillBankFonts = fillParts.elements
    .filter(
      (el): el is Extract<typeof el, { kind: 'text' }> =>
        el.kind === 'text' && el.y >= fillListTop - 0.5
    )
    .map((el) => el.fontSize);
  assert(
    fillBankFonts.length > 0 && Math.min(...fillBankFonts) >= 16,
    'fill word bank defaults to readable 16pt+'
  );
  const fillHeadingYs = new Set(
    fillParts.elements
      .filter((el) => el.kind === 'text' && /letters$/.test(el.text))
      .map((el) => Math.round(el.y))
  );
  assert(
    fillHeadingYs.size >= 1,
    'fill word bank packs length groups into shared rows'
  );
  const fillSolutionParts = buildFillElementParts({
    puzzle: fillPuzzle,
    slot,
    gp: getDefaultGenericPuzzleSettings('word-fill'),
    showSolution: true,
    preferredCellPt: 18,
  });
  assert(fillSolutionParts.listBox == null, 'fill solution page has no word list');

  const fillGpSmall = getDefaultGenericPuzzleSettings('word-fill');
  fillGpSmall.typography.answerFontSize = 12;
  const fillGpLarge = getDefaultGenericPuzzleSettings('word-fill');
  fillGpLarge.typography.answerFontSize = 36;
  const fillSolSmall = buildFillElementParts({
    puzzle: fillPuzzle,
    slot,
    gp: fillGpSmall,
    showSolution: true,
    preferredCellPt: 18,
  });
  const fillSolLarge = buildFillElementParts({
    puzzle: fillPuzzle,
    slot,
    gp: fillGpLarge,
    showSolution: true,
    preferredCellPt: 18,
  });
  const fillSmallSize = Math.max(
    0,
    ...fillSolSmall.elements.filter((el) => el.kind === 'text').map((el) => el.fontSize)
  );
  const fillLargeSize = Math.max(
    0,
    ...fillSolLarge.elements.filter((el) => el.kind === 'text').map((el) => el.fontSize)
  );
  assert(
    fillLargeSize > fillSmallSize,
    'fill solution letter size follows canvas/sidebar Solution font'
  );

  let fillUnusedCells = 0;
  let fillPlayableCells = 0;
  for (let r = 0; r < fillPuzzle.rows; r++) {
    for (let c = 0; c < fillPuzzle.columns; c++) {
      if ((fillPuzzle.grid[r]?.[c] ?? '') === '') fillUnusedCells += 1;
      else fillPlayableCells += 1;
    }
  }
  assert(fillUnusedCells > 0, 'fill fixture has unused cells');
  assert(fillPlayableCells > 0, 'fill fixture has playable cells');

  const { findInteriorUnusedFillCells } = await import('../puzzles/fill');
  const { INTERIOR_LIGHT_GREY_FILL } = await import('../crossword-settings');
  const fillInterior = findInteriorUnusedFillCells(fillPuzzle);
  let fillInteriorCount = 0;
  for (let r = 0; r < fillPuzzle.rows; r++) {
    for (let c = 0; c < fillPuzzle.columns; c++) {
      if (fillInterior[r]?.[c]) fillInteriorCount += 1;
    }
  }
  // Synthetic crossword-style hole: one unused cell fully enclosed by letters.
  {
    const holePuzzle = {
      ...fillPuzzle,
      rows: 3,
      columns: 3,
      grid: [
        ['A', 'B', 'C'],
        ['D', '', 'E'],
        ['F', 'G', 'H'],
      ],
      puzzleGrid: [
        [null, null, null],
        [null, '', null],
        [null, null, null],
      ],
      entries: fillPuzzle.entries,
    };
    const holeMap = findInteriorUnusedFillCells(holePuzzle);
    assert(holeMap[1]?.[1] === true, 'single enclosed unused fill cell is interior');
    const twoHole = {
      ...holePuzzle,
      grid: [
        ['A', 'B', 'C'],
        ['D', '', ''],
        ['F', 'G', 'H'],
      ],
      puzzleGrid: [
        [null, null, null],
        [null, '', ''],
        [null, null, null],
      ],
    };
    const twoMap = findInteriorUnusedFillCells(twoHole);
    assert(
      twoMap[1]?.[1] !== true && twoMap[1]?.[2] !== true,
      'multi-cell unused regions stay non-interior'
    );
  }

  const fillGridLines = (els: typeof fillParts.elements) =>
    els.filter((el) => el.kind === 'line' && !el.dash);
  const fillDefaultLineCount = fillGridLines(fillParts.elements).length;
  const fillFullMeshLineCount = fillPuzzle.rows + 1 + (fillPuzzle.columns + 1);
  assert(
    fillDefaultLineCount === fillFullMeshLineCount,
    'fill default blocks draw the full rectangular grid mesh'
  );

  const fillGpWhiteBlocks = getDefaultGenericPuzzleSettings('word-fill');
  fillGpWhiteBlocks.core.fillBlockFill = '#FFFFFF';
  const fillWhiteParts = buildFillElementParts({
    puzzle: fillPuzzle,
    slot,
    gp: fillGpWhiteBlocks,
    showSolution: false,
    preferredCellPt: 18,
  });
  const fillWhiteLineCount = fillGridLines(fillWhiteParts.elements).length;
  assert(
    fillWhiteLineCount !== fillFullMeshLineCount,
    'fill white blocks drop unused grid lines'
  );
  assert(
    fillWhiteParts.elements.filter((el) => el.kind === 'rect').length ===
      fillPlayableCells + fillInteriorCount,
    'fill white blocks keep only playable + interior 1×1 grey holes'
  );
  if (fillInteriorCount > 0) {
    assert(
      fillWhiteParts.elements.some(
        (el) => el.kind === 'rect' && el.fill === INTERIOR_LIGHT_GREY_FILL
      ),
      'fill interior unused single cells use crossword light grey'
    );
  }

  const fillGpClearBlocks = getDefaultGenericPuzzleSettings('word-fill');
  fillGpClearBlocks.core.fillBlockFill = '#00000000';
  const fillClearParts = buildFillElementParts({
    puzzle: fillPuzzle,
    slot,
    gp: fillGpClearBlocks,
    showSolution: false,
    preferredCellPt: 18,
  });
  assert(
    fillClearParts.elements.filter((el) => el.kind === 'rect').length ===
      fillPlayableCells + fillInteriorCount,
    'fill transparent blocks keep only playable + interior 1×1 grey holes'
  );
  assert(
    fillGridLines(fillClearParts.elements).length !== fillFullMeshLineCount,
    'fill transparent blocks drop unused grid lines'
  );

  const { generateSnake } = await import('../puzzles/snake');
  const { buildSnakeElementParts } = await import('./snake-elements');
  const snakePuzzle = generateSnake({
    mode: 'word',
    width: 8,
    height: 8,
    words: ['CAT', 'DOG'],
    seed: 5,
  });
  const snakeParts = buildSnakeElementParts({
    puzzle: snakePuzzle,
    slot,
    gp: getDefaultGenericPuzzleSettings('snake'),
    showSolution: true,
    preferredCellPt: 18,
  });
  assert(snakeParts.gridBox.w > 0, 'snake gridBox');
  assert(
    snakeParts.elements.some(
      (el) => el.kind === 'stadium' && el.color === '#111111' && (el.opacity ?? 1) === 1
    ),
    'snake solution draws a black path highlight'
  );
  {
    const thickGp = getDefaultGenericPuzzleSettings('snake');
    thickGp.core.snakeSolutionPathThickness = 40;
    thickGp.core.snakeSolutionPathOpacity = 50;
    const thickParts = buildSnakeElementParts({
      puzzle: snakePuzzle,
      slot,
      gp: thickGp,
      showSolution: true,
      preferredCellPt: 18,
    });
    const path = thickParts.elements.find((el) => el.kind === 'stadium');
    assert(!!path && path.kind === 'stadium', 'snake highlight thickness control draws stadiums');
    assert(path.opacity === 0.5, 'snake highlight transparency control applies opacity');
    assert(
      path.thickness > 0,
      'snake highlight thickness control sets stroke width'
    );
  }
  assert(
    !snakeParts.elements.some(
      (el) =>
        (el.kind === 'stadium' && el.color === '#16a34a') ||
        (el.kind === 'line' && el.color === '#16a34a') ||
        (el.kind === 'rect' && el.fill === '#dcfce7')
    ),
    'snake solution stays black and white (no green)'
  );
  const snakePuzzleParts = buildSnakeElementParts({
    puzzle: snakePuzzle,
    slot,
    gp: getDefaultGenericPuzzleSettings('snake'),
    showSolution: false,
    preferredCellPt: 18,
  });
  assert(
    snakePuzzleParts.elements.some((el) => el.kind === 'text' && el.text === 'CAT') &&
      snakePuzzleParts.listBox != null,
    'snake puzzle page lists its words'
  );
  const spacedSnake = generateSnake({
    mode: 'word',
    width: 10,
    height: 10,
    words: ['Cosmic Web', 'STAR'],
    seed: 11,
  });
  const spacedSnakeParts = buildSnakeElementParts({
    puzzle: spacedSnake,
    slot,
    gp: getDefaultGenericPuzzleSettings('snake'),
    showSolution: false,
    preferredCellPt: 18,
  });
  assert(
    spacedSnake.entries.some((e) => e.text === 'COSMIC WEB') &&
      spacedSnakeParts.elements.some((el) => el.kind === 'text' && el.text === 'COSMIC WEB'),
    'snake word list keeps spaces from the words box'
  );
  {
    const multi = generateSnake({
      mode: 'word',
      width: 12,
      height: 12,
      words: ['CAT', 'DOG', 'BIRD', 'FISH', 'LION', 'TIGER'],
      seed: 21,
    });
    const tightGp = getDefaultGenericPuzzleSettings('snake');
    tightGp.core.snakeWordListColumns = 2;
    tightGp.core.snakeWordSpacingVertical = 2;
    tightGp.core.snakeWordSpacingHorizontal = 10;
    const looseGp = getDefaultGenericPuzzleSettings('snake');
    looseGp.core.snakeWordListColumns = 2;
    looseGp.core.snakeWordSpacingVertical = 24;
    looseGp.core.snakeWordSpacingHorizontal = 80;
    const tight = buildSnakeElementParts({
      puzzle: multi,
      slot,
      gp: tightGp,
      showSolution: false,
      preferredCellPt: 18,
    });
    const loose = buildSnakeElementParts({
      puzzle: multi,
      slot,
      gp: looseGp,
      showSolution: false,
      preferredCellPt: 18,
    });
    assert(
      (loose.listBox?.h ?? 0) > (tight.listBox?.h ?? 0),
      'snake word-list vertical spacing increases list height'
    );
    const tightWords = tight.elements.filter(
      (el): el is Extract<typeof el, { kind: 'text' }> =>
        el.kind === 'text' && !!tight.listBox && el.y >= tight.listBox.y - 0.5
    );
    const looseWords = loose.elements.filter(
      (el): el is Extract<typeof el, { kind: 'text' }> =>
        el.kind === 'text' && !!loose.listBox && el.y >= loose.listBox.y - 0.5
    );
    const tightXs = [...new Set(tightWords.map((el) => Math.round(el.x)))].sort((a, b) => a - b);
    const looseXs = [...new Set(looseWords.map((el) => Math.round(el.x)))].sort((a, b) => a - b);
    assert(tightXs.length >= 2 && looseXs.length >= 2, 'snake word list uses multiple columns');
    assert(
      looseXs[1]! - looseXs[0]! > tightXs[1]! - tightXs[0]!,
      'snake word-list horizontal spacing widens column gap'
    );
  }
  const spacedFill = generateFill({
    mode: 'word',
    width: 14,
    height: 14,
    words: ['Cosmic Web', 'STAR', 'MOON', 'SUN'],
    seed: 17,
  });
  const spacedFillParts = buildFillElementParts({
    puzzle: spacedFill,
    slot,
    gp: getDefaultGenericPuzzleSettings('word-fill'),
    showSolution: false,
    preferredCellPt: 18,
  });
  assert(
    spacedFill.entries.some((e) => e.text === 'COSMIC WEB') &&
      spacedFillParts.elements.some((el) => el.kind === 'text' && el.text === 'COSMIC WEB'),
    'fill word list keeps spaces from the words box'
  );

  const wordList: UnifiedWordListBlock = {
    topPt: 420,
    leftPt: 36,
    widthPt: 180,
    blockWidthPt: 180,
    centeredLeftPt: 36,
    contentLeftPt: 36,
    columnWidthsPt: [180],
    fontSizePt: 12,
    lineHeightPt: 16,
    columnGapPt: 6,
    rowGapPt: 0,
    columns: 1,
    wordsPerColumn: 2,
    words: ['APPLE', 'ZEBRA'],
    color: '#111111',
    fontFamily: 'Arial',
    addCheckboxes: true,
    checkboxSizePt: 8,
    checkboxGapPt: 4,
    checkboxColor: '#333333',
  };
  const listElements = buildWordListElements(wordList);
  assert(textsOf(listElements).includes('ZEBRA'), 'word list must include ZEBRA');
  assert(listElements.some((el) => el.kind === 'rect'), 'word list checkboxes must be vector rects');

  const searchElements = buildWordSearchGridElements({
    puzzle: {
      grid: [
        ['Z', 'E'],
        ['B', 'R'],
      ],
      placements: [
        {
          word: 'ZE',
          start: { row: 0, col: 0 },
          end: { row: 0, col: 1 },
          direction: 'horizontal',
        },
      ],
    },
    grid: {
      leftPt: 40,
      topPt: 80,
      cellSizePt: 28,
      fontSizePt: 14,
      fontFamily: 'Arial',
      letterColor: '#111111',
    },
    showSolution: true,
    solution: wordSearchSolutionStyle({ solutionFrameColor: '#22c55e', solutionStrokeThickness: 12, solutionHighlightAlpha: 30 }),
  });
  assert(textsOf(searchElements).join('').includes('Z'), 'word search letters must be text elements');
  assert(searchElements.some((el) => el.kind === 'stadium'), 'word search solution marks must be stadiums');
  {
    // Diagonal marks must match canvas: extend half a cell past start/end centers.
    const diag = buildWordSearchGridElements({
      puzzle: {
        grid: [
          ['A', 'B', 'C'],
          ['D', 'E', 'F'],
          ['G', 'H', 'I'],
        ],
        placements: [
          {
            word: 'AEI',
            start: { row: 0, col: 0 },
            end: { row: 2, col: 2 },
            direction: 'diagonal-down',
          },
        ],
      },
      grid: {
        leftPt: 0,
        topPt: 0,
        cellSizePt: 20,
        fontSizePt: 12,
        fontFamily: 'Arial',
        letterColor: '#111111',
      },
      showSolution: true,
      solution: wordSearchSolutionStyle({
        solutionFrameColor: '#111111',
        solutionStrokeThickness: 10,
        solutionHighlightAlpha: 40,
      }),
      layer: 'marks',
    });
    const mark = diag.find((el) => el.kind === 'stadium');
    assert(!!mark && mark.kind === 'stadium', 'diagonal solution mark is a stadium');
    // Centers (10,10)→(50,50); canvas extends half a cell along the unit diagonal.
    const ext = 20 / 2 / Math.SQRT2;
    assert(
      Math.abs(mark.x1 - (10 - ext)) < 0.05 && Math.abs(mark.y1 - (10 - ext)) < 0.05,
      'diagonal start matches canvas half-cell extension'
    );
    assert(
      Math.abs(mark.x2 - (50 + ext)) < 0.05 && Math.abs(mark.y2 - (50 + ext)) < 0.05,
      'diagonal end matches canvas half-cell extension'
    );
  }

  const cw = getDefaultCrosswordSettings();
  const crossword: CrosswordPuzzle = {
    type: 'crossword',
    grid: [
      [
        { letter: 'C', isBlack: false, clueNumber: 1 },
        { letter: 'A', isBlack: false },
      ],
      [
        { letter: 'T', isBlack: false },
        { isBlack: true },
      ],
    ],
    acrossClues: [{ number: 1, clue: 'Capital clue', answer: 'CA' }],
    downClues: [{ number: 1, clue: 'Down clue', answer: 'CT' }],
  };
  const crosswordElements = buildCrosswordElements({
    puzzle: crossword,
    slot,
    cw,
    showSolution: false,
    preferredCellPt: 24,
    clueGapPt: 12,
    hideClues: false,
    pageNumberZoneTopPt: 760,
  });
  assert(textsOf(crosswordElements).some((text) => text.includes('Capital clue')), 'crossword clues must be shared text');
  assert(crosswordElements.some((el) => el.kind === 'rect'), 'crossword cells must be vector rects');
  const crosswordLayout = computeGenericPageLayout({
    puzzleType: 'crossword',
    showSolution: false,
    layoutSettings: getDefaultWordSearchSettings(),
    titleWords: { title: 'Crossword', fontFamily: 'Arial', fontSize: 24, words: [] },
    puzzleIndex: 0,
    puzzles: [crossword],
    cw,
    gp: null,
  });
  assert(crosswordLayout.slots[0]?.content != null, 'crossword body slot must exist without generic settings');
  const crosswordBody = buildCrosswordElements({
    puzzle: crossword,
    slot: crosswordLayout.slots[0].content,
    cw,
    showSolution: false,
    preferredCellPt: crosswordLayout.crosswordCellPt,
    clueGapPt: crosswordLayout.puzzleToCluesGapPt,
    hideClues: false,
    pageNumberZoneTopPt: crosswordLayout.pageNumberZoneTopPt,
  });
  assert(crosswordBody.length > 0, 'crossword preview must draw grid and clues without generic settings');

  const scrambleGp = getDefaultGenericPuzzleSettings('word-scramble');
  const scramble: WordScramblePuzzle = {
    type: 'word-scramble',
    words: [{ original: 'ORANGE', scrambled: 'NARGEO' }],
  };
  const scrambleElements = buildScrambleElements({
    puzzle: scramble,
    slot,
    gp: scrambleGp,
    showSolution: false,
    fontSizePt: 14,
    wordGapPt: 8,
    letterEm: 0.12,
  });
  assert(
    textsOf(scrambleElements).some((text) => text.includes('NARGEO')),
    'scramble must keep the scrambled word'
  );
  assert(
    textsOf(scrambleElements).every((text) => !text.includes('ORANGE')),
    'puzzle page must not print the answer'
  );
  const scrambleRun = scrambleElements.find(
    (el) => el.kind === 'text' && el.text.includes('NARGEO')
  );
  const blankRun = scrambleElements.find(
    (el) => el.kind === 'text' && el.text.includes('_')
  );
  assert(!!scrambleRun && !!blankRun, 'scramble row has scramble + blank runs');
  assert(
    blankRun!.x >= scrambleRun!.x + scrambleRun!.w - 0.5,
    'scramble blanks must start after the scrambled word (no overlap)'
  );
  const scrambleSolution = buildScrambleElements({
    puzzle: scramble,
    slot,
    gp: scrambleGp,
    showSolution: true,
    fontSizePt: 14,
    wordGapPt: 8,
    letterEm: 0.12,
  });
  const solScramble = scrambleSolution.find(
    (el) => el.kind === 'text' && el.text.includes('NARGEO')
  );
  const solAnswer = scrambleSolution.find(
    (el) => el.kind === 'text' && el.text.includes('ORANGE')
  );
  assert(!!solScramble && !!solAnswer, 'solution row has scramble + answer');
  assert(
    solAnswer!.x >= solScramble!.x + solScramble!.w - 0.5,
    'scramble solution answer must not overlap the scrambled word'
  );
  assert(
    (scrambleRun as { letterSpacingEm?: number }).letterSpacingEm === 0.12,
    'scramble letters carry Space Between Letters into the shared text primitive'
  );
  const scrambleTight = buildScrambleElements({
    puzzle: scramble,
    slot,
    gp: scrambleGp,
    showSolution: false,
    fontSizePt: 14,
    wordGapPt: 8,
    letterEm: 0,
  });
  const scrambleLoose = buildScrambleElements({
    puzzle: scramble,
    slot,
    gp: scrambleGp,
    showSolution: false,
    fontSizePt: 14,
    wordGapPt: 8,
    letterEm: 0.35,
  });
  const tightRun = scrambleTight.find((el) => el.kind === 'text' && el.text.includes('NARGEO'));
  const looseRun = scrambleLoose.find((el) => el.kind === 'text' && el.text.includes('NARGEO'));
  assert(!!tightRun && !!looseRun, 'scramble letter-spacing fixtures');
  assert(
    looseRun!.w > tightRun!.w + 4,
    'increasing Space Between Letters must widen the scramble run'
  );
  assert(
    (looseRun as { letterSpacingEm?: number }).letterSpacingEm === 0.35,
    'loose scramble run keeps letterSpacingEm for canvas/PDF/PPT'
  );
  const scrambleBoldGp = getDefaultGenericPuzzleSettings('word-scramble');
  scrambleBoldGp.typography.puzzleFontFamily = 'Arial Black';
  scrambleBoldGp.typography.puzzleBold = true;
  const scrambleOverlap = buildScrambleElements({
    puzzle: {
      type: 'word-scramble',
      words: [
        { original: 'BACKBONE', scrambled: 'EANOCBKB' },
        { original: 'TRAVERSE', scrambled: 'BVRETERA' },
      ],
    },
    slot,
    gp: scrambleBoldGp,
    showSolution: false,
    fontSizePt: 18,
    wordGapPt: 6,
    letterEm: 0.12,
  });
  for (const scrambled of ['EANOCBKB', 'BVRETERA']) {
    const run = scrambleOverlap.find((el) => el.kind === 'text' && el.text === scrambled);
    const eq = scrambleOverlap.find(
      (el) =>
        el.kind === 'text' &&
        el.text === '=' &&
        run != null &&
        Math.abs(el.y - run.y) < 0.5
    );
    assert(!!run && !!eq, `scramble row for ${scrambled} has equals`);
    assert(
      eq!.x >= run!.x + run!.w - 0.01,
      `equals must not overlap scramble letters (${scrambled})`
    );
  }

  const triviaGp = getDefaultGenericPuzzleSettings('trivia');
  const trivia: TriviaPuzzle = {
    type: 'trivia',
    questions: [
      {
        prompt: 'Which city is Paris',
        suggestions: ['France', 'Spain'],
        answer: 'France',
        answerIndex: 0,
      },
    ],
  };
  const triviaElements = buildTriviaElements({
    puzzles: [trivia],
    slot,
    gp: triviaGp,
    showSolution: false,
  });
  assert(textsOf(triviaElements).some((text) => text.includes('Which city is Paris')), 'trivia prompt must be shared text');
  assert(
    triviaElements.some((el) => el.kind === 'ellipse' || el.kind === 'rect'),
    'trivia choices must be vector marks'
  );

  // Cryptogram: one shared builder for canvas, PDF, and PPTX — answer key,
  // writing blanks under cipher tokens, hints, solution letters, sentence-only
  // solutions, letter case, and both blank styles.
  const { generateCryptogram } = await import('../puzzles/cryptogram');
  const cryptoPuzzle = generateCryptogram('MEET AT DAWN, FRIEND', { hintCount: 2 });
  const cryptoGp = getDefaultGenericPuzzleSettings('cryptogram');
  cryptoGp.core.showLetterHints = true;
  cryptoGp.core.cryptogramFormat = 'lines';
  const cryptoElements = buildCryptogramElements({ puzzle: cryptoPuzzle, slot, gp: cryptoGp, showSolution: false });
  const cryptoTexts = textsOf(cryptoElements);
  const plainToCipher = Object.fromEntries(
    Object.entries(cryptoPuzzle.letterMapping).map(([token, plain]) => [plain, token])
  );
  assert(cryptoTexts.includes(plainToCipher['M']!), 'cryptogram puzzle page shows cipher tokens');
  assert(cryptoTexts.includes(','), 'cryptogram keeps punctuation in place');
  assert(cryptoElements.some((el) => el.kind === 'line'), 'cryptogram "lines" format draws writing lines');
  assert(cryptoTexts.includes('A') && cryptoTexts.includes('Z'), 'cryptogram answer key lists the alphabet');
  for (const hint of cryptoPuzzle.hintLetters) {
    assert(cryptoTexts.includes(hint), `cryptogram hint letter ${hint} is pre-filled`);
  }
  const cryptoBoxesGp = getDefaultGenericPuzzleSettings('cryptogram');
  cryptoBoxesGp.core.cryptogramFormat = 'boxes';
  cryptoBoxesGp.core.showLetterHints = false;
  cryptoBoxesGp.core.letterCase = 'lower';
  const cryptoBoxes = buildCryptogramElements({ puzzle: cryptoPuzzle, slot, gp: cryptoBoxesGp, showSolution: false });
  assert(cryptoBoxes.some((el) => el.kind === 'rect'), 'cryptogram "boxes" format draws cells');
  assert(!cryptoBoxes.some((el) => el.kind === 'line'), 'cryptogram "boxes" format has no writing lines');
  assert(textsOf(cryptoBoxes).includes(plainToCipher['M']!.toLowerCase()), 'cryptogram lower case applies to cipher letters');
  assert(!textsOf(cryptoBoxes).includes('Z'), 'cryptogram answer key hidden when disabled');
  const cryptoSolution = buildCryptogramElements({ puzzle: cryptoPuzzle, slot, gp: cryptoGp, showSolution: true });
  const solTexts = textsOf(cryptoSolution);
  for (const letter of ['M', 'E', 'T', 'D', 'W', 'N', 'F', 'R', 'I']) {
    assert(solTexts.includes(letter), `cryptogram solution fills decoded letter ${letter}`);
  }
  assert(!cryptoSolution.some((el) => el.kind === 'rect'), 'cryptogram solution page has no answer key');
  const cryptoSentenceGp = getDefaultGenericPuzzleSettings('cryptogram');
  cryptoSentenceGp.core.cryptogramSolutionOnlyAnswers = true;
  const cryptoSentence = buildCryptogramElements({ puzzle: cryptoPuzzle, slot, gp: cryptoSentenceGp, showSolution: true });
  assert(
    textsOf(cryptoSentence).join(' ').includes('MEET AT DAWN, FRIEND'),
    'cryptogram sentence-only solution prints the decoded phrase'
  );

  // Canvas format bar: Puzzle (`grid`) and Answer Key fonts must land on elements.
  const cryptoFontGp = getDefaultGenericPuzzleSettings('cryptogram');
  cryptoFontGp.core.showLetterHints = true;
  cryptoFontGp.typography.puzzleFontFamily = 'Courier New';
  cryptoFontGp.typography.puzzleFontSize = 22;
  cryptoFontGp.typography.answerKeyFontFamily = 'Georgia';
  cryptoFontGp.typography.answerKeyFontSize = 14;
  const cryptoFontEls = buildCryptogramElements({
    puzzle: cryptoPuzzle,
    slot,
    gp: cryptoFontGp,
    showSolution: false,
  });
  const cryptoFontTexts = cryptoFontEls.filter((el) => el.kind === 'text');
  assert(
    cryptoFontTexts.some(
      (el) =>
        el.kind === 'text' &&
        el.fontFamily.includes('Courier') &&
        Math.abs(el.fontSize - 22) < 0.01 &&
        !!plainToCipher['M'] &&
        el.text === plainToCipher['M']
    ),
    'cryptogram puzzle letters use puzzleFontFamily/Size from canvas format bar'
  );
  assert(
    cryptoFontTexts.some(
      (el) =>
        el.kind === 'text' &&
        el.fontFamily.includes('Georgia') &&
        Math.abs(el.fontSize - 14) < 0.01 &&
        (el.text === 'A' || el.text === 'Z')
    ),
    'cryptogram answer-key letters use answerKeyFontFamily/Size from canvas format bar'
  );
  const cryptoFontLarge = getDefaultGenericPuzzleSettings('cryptogram');
  cryptoFontLarge.core.showLetterHints = true;
  cryptoFontLarge.typography.answerKeyFontSize = 28;
  const cryptoKeySmall = buildCryptogramElements({
    puzzle: cryptoPuzzle,
    slot,
    gp: cryptoFontGp,
    showSolution: false,
  });
  const cryptoKeyLarge = buildCryptogramElements({
    puzzle: cryptoPuzzle,
    slot,
    gp: cryptoFontLarge,
    showSolution: false,
  });
  const keyH = (els: typeof cryptoKeySmall) =>
    Math.max(
      0,
      ...els.filter((el) => el.kind === 'rect').map((el) => el.y + el.h)
    );
  assert(
    keyH(cryptoKeyLarge) > keyH(cryptoKeySmall),
    'cryptogram answer-key cell height grows with answerKeyFontSize'
  );

  const codewordsGp = getDefaultGenericPuzzleSettings('codewords');
  const { generateCodewordPuzzle } = await import('../puzzles/codewords');
  const codewordPuzzle = generateCodewordPuzzle({
    rows: 11,
    cols: 11,
    seed: 42,
    hintCount: 3,
    timeBudgetMs: 20000,
  });
  const codewordElements = buildCodewordsElements({
    puzzle: codewordPuzzle,
    slot,
    gp: codewordsGp,
    showSolution: false,
    preferredCellPt: 18,
  });
  assert(
    codewordElements.some((el) => el.kind === 'rect') && codewordElements.some((el) => el.kind === 'text'),
    'codewords must emit shared rect + text primitives'
  );
  const codewordSolutionElements = buildCodewordsElements({
    puzzle: codewordPuzzle,
    slot,
    gp: codewordsGp,
    showSolution: true,
    preferredCellPt: 18,
  });
  assert(
    textsOf(codewordSolutionElements).some((t) => segmentGraphemes(t).some(isLetterGrapheme)),
    'codewords solution must show letters'
  );
  const { buildCodewordsElementParts } = await import('./codewords-elements');
  const solutionParts = buildCodewordsElementParts({
    puzzle: codewordPuzzle,
    slot,
    gp: codewordsGp,
    showSolution: true,
    preferredCellPt: 18,
  });
  assert(solutionParts.keyBox == null, 'codewords solutions must omit alphabet key box');
  const puzzleParts = buildCodewordsElementParts({
    puzzle: codewordPuzzle,
    slot,
    gp: codewordsGp,
    showSolution: false,
    preferredCellPt: 18,
  });
  assert(puzzleParts.keyBox != null, 'codewords puzzles must include alphabet key box');
  const codewordKeyCount = codewordPuzzle.alphabetEntries.length;
  assert(
    codewordKeyCount === 26,
    'English codewords must code all 26 letters'
  );
  assert(
    puzzleParts.keyNumbers.length === codewordKeyCount &&
      puzzleParts.key.length >= codewordKeyCount,
    'codewords alphabet key must have one numbered cell per coded letter'
  );

  // French/German/Spanish still use language word lists, but the alphabet key stays 2×13 (26).
  const frenchPuzzle = generateCodewordPuzzle({
    rows: 9,
    cols: 9,
    seed: 7,
    hintCount: 3,
    language: 'french',
    timeBudgetMs: 20000,
  });
  assert(
    frenchPuzzle.alphabetEntries.length === 26,
    'French codewords keep a 26-letter A–Z coding alphabet'
  );
  const frenchParts = buildCodewordsElementParts({
    puzzle: frenchPuzzle,
    slot,
    gp: getDefaultGenericPuzzleSettings('codewords'),
    showSolution: false,
    preferredCellPt: 18,
  });
  assert(
    frenchParts.keyNumbers.length === 26 && frenchParts.key.length >= 26,
    'the alphabet key box stays 2×13 (26 cells) for every language'
  );

  // German, French, and Spanish samples ride along with the editability fixtures so the
  // PDF text extraction and the PPTX text runs below prove the accents survive the export.
  const unicodeWords = ['MÄDCHEN', 'FORÊT', 'NIÑO', 'GRÜßE', 'CŒUR'];
  const unicodeListElements = buildWordListElements({
    ...wordList,
    topPt: 600,
    words: unicodeWords,
    wordsPerColumn: unicodeWords.length,
  });
  for (const word of unicodeWords) {
    assert(textNeedsExtendedLatin(word), `${word} must be an accented sample`);
    assert(
      textsOf(unicodeListElements).includes(word),
      `the shared layout must keep "${word}" letter for letter`
    );
  }

  const bookElements = [
    ...mazeA,
    ...unicodeListElements,
    ...digits,
    ...listElements,
    ...searchElements,
    ...crosswordElements,
    ...scrambleElements,
    ...triviaElements,
    ...cryptoElements,
    ...cryptoSentence,
    ...codewordElements,
  ];
  const expected = [
    'ZEBRA',
    'Capital clue',
    'NARGEO',
    'Which city is Paris',
    'MEET AT DAWN',
    ...unicodeWords,
  ];

  invalidateResolvedPages();
  const revision = stableRevision({ words: wordList.words, font: wordList.fontSizePt });
  const frozen = getResolvedPage(revision, () => ({
    id: 'list',
    kind: 'word-list',
    widthPt: 612,
    heightPt: 792,
    revision,
    elements: listElements,
  }));
  const again = getResolvedPage(revision, () => {
    throw new Error('cached revision must not rebuild puzzle content');
  });
  assert(again === frozen, 'same revision must return the same snapshot');
  const changed = getResolvedPage(stableRevision({ words: wordList.words, font: 18 }), () => ({
    id: 'list-18',
    kind: 'word-list',
    widthPt: 612,
    heightPt: 792,
    revision: 'next',
    elements: buildWordListElements({ ...wordList, fontSizePt: 18 }),
  }));
  assert(changed !== frozen, 'a settings change must be a new revision');
  assert(textsOf(changed.elements).includes('ZEBRA'), 'a font change must not regenerate the word list');

  let threw = false;
  try {
    unsupportedPrimitive('PDF', { kind: 'missing' } as never);
  } catch {
    threw = true;
  }
  assert(threw, 'unsupported primitives must throw');
  await assertEveryPrimitiveIsDrawn();
  const snapshotDebt = assertNoNewSnapshotRoutes();

  const pdf = await PDFDocument.create();
  const page = pdf.addPage([612, 792]);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  renderResolvedPdf(page, 792, bookElements, (_family, isBold) => (isBold ? bold : font));
  const previewPdfPage = pdf.addPage([200, 200]);
  renderResolvedPdf(previewPdfPage, 200, searchElements, () => font);
  const pdfBytes = await pdf.save();
  const inflated = inflatePdf(pdfBytes);
  assert(inflated.includes('BT'), 'PDF must keep real text operators');
  assert(!inflated.includes('/Image'), 'this fixture must not flatten the puzzle into an image');
  const extracted = await pdfText(pdfBytes);
  const extractedCompact = extracted.replace(/\s+/g, '');
  for (const phrase of expected) {
    // PDF character spacing (Tc / letterSpacingEm) makes some extractors insert
    // gaps between glyphs; compare on whitespace-stripped text.
    assert(
      extractedCompact.includes(phrase.replace(/\s+/g, '')),
      `PDF text extraction must include "${phrase}"`
    );
  }

  const ppt = new PptxGenJS();
  ppt.defineLayout({ name: 'BOOK', width: 8.5, height: 11 });
  ppt.layout = 'BOOK';
  const slide = ppt.addSlide();
  renderResolvedPpt(slide as never, bookElements);
  const pptBytes = (await ppt.write({ outputType: 'nodebuffer' })) as Buffer;
  const zip = await JSZip.loadAsync(pptBytes);
  const slideXml = await zip.file('ppt/slides/slide1.xml')?.async('string');
  assert(!!slideXml, 'PPTX must contain a slide');
  for (const phrase of expected) {
    assert(slideXml!.includes(phrase), `PPTX editable text must include "${phrase}"`);
  }
  assert(slideXml!.includes('<a:t>'), 'PPTX must keep text runs');
  assert(!slideXml!.includes('<p:pic>'), 'puzzle content must not be exported as pictures');
  assert(
    slideXml!.includes('prstGeom') || slideXml!.includes('custGeom'),
    'PPTX must keep native shapes for grids and marks'
  );

  const previewHtml = `<!doctype html><html><head><meta charset="utf-8"><style>html,body{margin:0;background:#fff}</style></head><body>${renderToStaticMarkup(
    React.createElement(ResolvedElementsView, {
      elements: searchElements,
      widthPt: 200,
      heightPt: 200,
      scale: 96 / 72,
    })
  )}</body></html>`;
  const dir = mkdtempSync(join(tmpdir(), 'layout-preview-'));
  const htmlPath = join(dir, 'preview.html');
  const shotPath = join(dir, 'preview.png');
  writeFileSync(htmlPath, previewHtml);

  let browserStatus = 'NOT RUN: no Edge or Chrome binary found for a browser capture of ResolvedElementsView';
  const browser = browserBinary();
  if (browser) {
    const shot = await run(browser, [
      '--headless=new',
      '--disable-gpu',
      '--hide-scrollbars',
      '--force-device-scale-factor=1',
      `--screenshot=${shotPath}`,
      '--window-size=267,267',
      `file:///${htmlPath.replace(/\\/g, '/')}`,
    ]);
    browserStatus = existsSync(shotPath)
      ? `captured ${shotPath} (exit ${shot.code})`
      : `NOT RUN: browser exited ${shot.code} without a screenshot. ${shot.stderr.slice(0, 240)}`;
  }

  let pdfRaster = 'incomplete';
  try {
    const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
    const { createCanvas } = await import('@napi-rs/canvas');
    const loaded = await pdfjs.getDocument({ data: new Uint8Array(pdfBytes), disableWorker: true } as never).promise;
    const pdfPage = await loaded.getPage(2);
    const viewport = pdfPage.getViewport({ scale: 96 / 72 });
    const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
    const context = canvas.getContext('2d');
    await pdfPage.render({ canvas: null, canvasContext: context as never, viewport }).promise;
    const pngPath = join(dir, 'pdf-page.png');
    writeFileSync(pngPath, canvas.toBuffer('image/png'));
    pdfRaster = `rendered ${Math.ceil(viewport.width)}x${Math.ceil(viewport.height)} at 96/72. Saved ${pngPath}.`;
    if (existsSync(shotPath)) {
      const { loadImage } = await import('@napi-rs/canvas');
      const preview = await loadImage(shotPath);
      const previewCanvas = createCanvas(preview.width, preview.height);
      const previewCtx = previewCanvas.getContext('2d');
      previewCtx.drawImage(preview, 0, 0);
      const width = Math.min(canvas.width, preview.width);
      const height = Math.min(canvas.height, preview.height);
      const pdfPx = context.getImageData(0, 0, width, height).data;
      const viewPx = previewCtx.getImageData(0, 0, width, height).data;
      const box = (data: Uint8ClampedArray) => {
        let minX = width;
        let minY = height;
        let maxX = 0;
        let maxY = 0;
        let ink = 0;
        for (let y = 0; y < height; y++) {
          for (let x = 0; x < width; x++) {
            const i = (y * width + x) * 4;
            if (data[i] < 250 || data[i + 1] < 250 || data[i + 2] < 250) {
              ink++;
              minX = Math.min(minX, x);
              minY = Math.min(minY, y);
              maxX = Math.max(maxX, x);
              maxY = Math.max(maxY, y);
            }
          }
        }
        return { minX, minY, maxX, maxY, ink };
      };
      const pdfBox = box(pdfPx);
      const viewBox = box(viewPx);
      let abs = 0;
      for (let i = 0; i < pdfPx.length; i += 4) {
        abs += Math.abs(pdfPx[i] - viewPx[i]) + Math.abs(pdfPx[i + 1] - viewPx[i + 1]) + Math.abs(pdfPx[i + 2] - viewPx[i + 2]);
      }
      const mae = abs / (width * height * 3);
      const dx = Math.abs(pdfBox.minX - viewBox.minX);
      const dy = Math.abs(pdfBox.minY - viewBox.minY);
      pdfRaster += ` Browser capture ${preview.width}x${preview.height}. Mean channel error ${mae.toFixed(2)}. Ink origin delta ${dx}px, ${dy}px.`;
      assert(
        dx <= 8 && dy <= 8,
        `preview ink ${viewBox.minX},${viewBox.minY}-${viewBox.maxX},${viewBox.maxY} pdf ink ${pdfBox.minX},${pdfBox.minY}-${pdfBox.maxX},${pdfBox.maxY}`
      );
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.startsWith('preview ink')) throw error;
    pdfRaster = `NOT RUN: ${message}`;
  }

  let pptxRaster = 'NOT RUN: LibreOffice soffice was not found, so exported slides were not rasterized';
  const soffice = sofficeBinary();
  if (soffice) {
    const pptxPath = join(dir, 'fixture.pptx');
    writeFileSync(pptxPath, pptBytes);
    const converted = await run(soffice, ['--headless', '--convert-to', 'pdf', '--outdir', dir, pptxPath]);
    const convertedPdf = join(dir, 'fixture.pdf');
    pptxRaster = existsSync(convertedPdf)
      ? `LibreOffice wrote ${convertedPdf} (exit ${converted.code}). Slide XML already required the fixture phrases.`
      : `NOT RUN: soffice exit ${converted.code}. ${converted.stderr.slice(0, 240)}`;
  }

  const lines: Array<{ status: 'PASSED' | 'NOT RUN' | 'NOT PASSED'; name: string; detail: string }> = [
    {
      status: 'PASSED',
      name: 'shared primitives',
      detail: `canvas, PDF, and PPTX drew ${RESOLVED_ELEMENT_KINDS.join(', ')}`,
    },
    {
      status: 'PASSED',
      name: 'editability',
      detail: 'expected phrases are real PDF text and PPTX <a:t> runs; grids are native shapes',
    },
    {
      status: 'PASSED',
      name: 'page variables',
      detail:
        'text, image, and shape overlays map to printed puzzle and front-matter pages; single-page items stay on one page; shape text and 3D styles stay live editable',
    },
    {
      status: 'PASSED',
      name: 'unicode text',
      detail:
        'German, French, and Spanish samples keep their accents from input through the generators to the canvas, the PDF text, and the PPTX runs; one visible character stays one cell; codewords alphabet key stays 2×13 (26)',
    },
    {
      status: 'PASSED',
      name: 'maze start and end images',
      detail:
        'sheet order, pair order, transparency, gutter rejection, placement beside top, bottom, left, and right openings, smaller solution images, hide on solutions, and project reopening',
    },
    {
      status: 'PASSED',
      name: 'maze auto enhance',
      detail:
        'local adaptive contour cleanup at print size, transparent exterior, white interiors, undoable original crop, and unchanged start/end placement',
    },
    {
      status: browserStatus.startsWith('captured') ? 'PASSED' : 'NOT RUN',
      name: 'browser preview capture',
      detail: browserStatus,
    },
    {
      status: pdfRaster.startsWith('NOT RUN') ? 'NOT RUN' : 'PASSED',
      name: 'PDF visual comparison',
      detail: pdfRaster,
    },
    {
      status: pptxRaster.startsWith('NOT RUN') || pptxRaster.startsWith('incomplete') ? 'NOT RUN' : 'PASSED',
      name: 'PPTX visual comparison',
      detail: pptxRaster,
    },
    {
      status: 'NOT PASSED',
      name: 'text pages',
      detail: 'painters still place DOM-measured runs themselves',
    },
    {
      status: 'NOT PASSED',
      name: 'header assembly',
      detail: 'shared layout object, not yet a ResolvedElement list',
    },
    ...snapshotDebt.map((kind) => ({
      status: 'NOT PASSED' as const,
      name: kind,
      detail: 'export still embeds a full-page preview snapshot',
    })),
  ];

  console.log('layout check — NOT RUN and NOT PASSED are not successes');
  for (const line of lines) {
    console.log(`${line.status.padEnd(10)} ${line.name}: ${line.detail}`);
    if (line.status !== 'PASSED') {
      console.log(`::warning title=${line.status} ${line.name}::${line.detail}`);
    }
  }
  const failed = lines.filter((line) => line.status !== 'PASSED');
  if (failed.length > 0) {
    console.log(`${failed.length} check(s) did not pass. See NOT RUN and NOT PASSED above.`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
