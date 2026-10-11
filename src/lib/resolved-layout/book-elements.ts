import type { CrosswordSettings } from '../crossword-settings';
import { computeCrosswordPuzzleBodyLayout } from '../crossword-puzzle-page-layout';
import type { GenericPuzzleSettings } from '../generic-puzzle-settings';
import type { RectPt } from '../generic-puzzle-page-layout';
import {
  crosswordCells,
  crosswordLetterFontPt,
  crosswordNumberFontPt,
  fitUniformGrid,
} from '../generic-puzzle-geometry';
import { cssPxToPoints } from '../puzzle-layout';
import type { CrosswordPuzzle, CryptogramPuzzle, TriviaPuzzle, WordScramblePuzzle } from '../puzzles/types';
import { computeTriviaSolutionColumns, formatTriviaSolutionHeading, resolveTriviaAnswerLetter } from '../puzzles/trivia';
import type { UnifiedWordListBlock } from '../word-search-page-layout';
import { getWordListRowTopOffsetPt } from '../word-search-page-layout';
import {
  applyLetterCase,
  graphemeCount,
  localeCompareText,
  localeUpperCase,
  normalizePuzzleText,
  resolveUnicodeFontFamily,
  segmentGraphemes,
} from '../unicode-text';
import type { ResolvedElement, ResolvedText } from './types';
import { wrapLines } from './wrap';

function textBox(
  x: number,
  y: number,
  w: number,
  h: number,
  value: string,
  fontSize: number,
  fontFamily: string,
  color: string,
  extra?: Partial<
    Pick<
      ResolvedText,
      'bold' | 'italic' | 'align' | 'valign' | 'lines' | 'lineHeight' | 'effect' | 'letterSpacingEm'
    >
  >
): ResolvedText {
  const lines = extra?.lines ?? [value];
  return {
    kind: 'text',
    x,
    y,
    w: Math.max(1, w),
    h: Math.max(1, h),
    text: lines.join('\n'),
    lines,
    fontFamily,
    fontSize,
    color,
    bold: extra?.bold,
    italic: extra?.italic,
    align: extra?.align ?? 'left',
    valign: extra?.valign ?? 'top',
    lineHeight: extra?.lineHeight ?? fontSize * 1.2,
    effect: extra?.effect,
    ...(extra?.letterSpacingEm != null && Number.isFinite(extra.letterSpacingEm)
      ? { letterSpacingEm: Math.max(0, extra.letterSpacingEm) }
      : {}),
  };
}

export function buildWordListElements(wl: UnifiedWordListBlock): ResolvedElement[] {
  const elements: ResolvedElement[] = [];
  const wordsPerCol = Math.max(1, wl.wordsPerColumn);
  for (let i = 0; i < wl.words.length; i++) {
    const col = Math.min(Math.floor(i / wordsPerCol), Math.max(0, wl.columns - 1));
    const row = i % wordsPerCol;
    const prev = wl.columnWidthsPt.slice(0, col).reduce((sum, width) => sum + width, 0);
    let x = wl.centeredLeftPt + prev + col * wl.columnGapPt;
    const y = wl.topPt + getWordListRowTopOffsetPt(row, wl.lineHeightPt);
    const colW = wl.columnWidthsPt[col] || 80;
    if (wl.addCheckboxes) {
      const cb = wl.checkboxSizePt;
      elements.push({
        kind: 'rect',
        x,
        y: y + Math.max(0, (wl.lineHeightPt - cb) / 2),
        w: cb,
        h: cb,
        stroke: wl.checkboxColor || '#666666',
        strokeWidth: 0.75,
      });
      x += cb + wl.checkboxGapPt;
    }
    elements.push(
      textBox(x, y, Math.max(8, colW - (wl.addCheckboxes ? wl.checkboxSizePt + wl.checkboxGapPt : 0)), wl.lineHeightPt, wl.words[i], wl.fontSizePt, wl.fontFamily, wl.color, {
        valign: 'middle',
        lineHeight: wl.lineHeightPt,
        effect: wl.textEffect,
      })
    );
  }
  return elements;
}

export function buildCrosswordElements(args: {
  puzzle: CrosswordPuzzle;
  slot: RectPt;
  cw: CrosswordSettings;
  showSolution: boolean;
  preferredCellPt: number;
  clueGapPt: number;
  hideClues: boolean;
  pageNumberZoneTopPt: number;
}): ResolvedElement[] {
  const { puzzle, slot, cw, showSolution, preferredCellPt, clueGapPt, hideClues, pageNumberZoneTopPt } = args;
  const rows = puzzle.grid.length;
  const cols = puzzle.grid[0]?.length ?? 0;
  const showClues = !showSolution && !hideClues;
  const showAnswerKey = showSolution && cw.typography.showAnswerKey !== false;
  const fontFamily = cw.typography.clueFontFamily || 'Arial';
  const headingFamily = cw.typography.acrossDownFontFamily || fontFamily;
  const body = showClues
    ? computeCrosswordPuzzleBodyLayout({
        puzzle,
        cw,
        slot,
        preferredCellPt,
        clueGapPt,
        pageNumberZoneTopPt,
        measureLineCount: (text, fontSize, colWidth) => Math.max(1, wrapLines(text, fontSize, colWidth).length),
      })
    : null;
  const gridSlot: RectPt = showClues
    ? slot
    : {
        leftPt: slot.leftPt,
        topPt: slot.topPt,
        widthPt: slot.widthPt,
        heightPt: slot.heightPt * (showAnswerKey ? 0.78 : 1),
      };
  const grid = body ? body.grid : fitUniformGrid(cols, rows, preferredCellPt, gridSlot);
  const cells = crosswordCells(puzzle, grid, cw, showSolution);
  const linePt = Math.max(0.4, cssPxToPoints(cw.colors.lineThicknessPx || 1));
  const lineColor = cw.colors.lineColor || '#cccccc';
  const letterColor = (showSolution ? cw.colors.answersColor : cw.colors.hintLettersColor) || '#333333';
  const numberColor = cw.colors.numbersColor || '#333333';
  const letterPt = crosswordLetterFontPt(cw, grid.cellPt);
  const numberPt = crosswordNumberFontPt(cw, grid.cellPt, showSolution);
  const elements: ResolvedElement[] = [];

  for (const cell of cells) {
    if (cell.fill) {
      elements.push({
        kind: 'rect',
        x: cell.leftPt,
        y: cell.topPt,
        w: cell.sizePt,
        h: cell.sizePt,
        fill: cell.fill,
        stroke: lineColor,
        strokeWidth: linePt,
      });
    } else if (!cell.isBlack) {
      elements.push({
        kind: 'rect',
        x: cell.leftPt,
        y: cell.topPt,
        w: cell.sizePt,
        h: cell.sizePt,
        fill: '#ffffff',
        stroke: lineColor,
        strokeWidth: linePt,
      });
    }
    if (cell.clueNumber != null) {
      elements.push(
        textBox(
          cell.leftPt + cell.sizePt * 0.06,
          cell.topPt + cell.sizePt * 0.04,
          cell.sizePt * 0.5,
          cell.sizePt * 0.32,
          String(cell.clueNumber),
          numberPt,
          fontFamily,
          numberColor,
          { bold: true, valign: 'top' }
        )
      );
    }
    if (cell.letter) {
      elements.push(
        textBox(cell.leftPt, cell.topPt + cell.sizePt * 0.12, cell.sizePt, cell.sizePt * 0.82, cell.letter, letterPt, fontFamily, letterColor, {
          align: 'center',
          valign: 'middle',
          bold: true,
          effect: cw.typography.gridTextEffect,
        })
      );
    }
  }

  const restTop = grid.topPt + grid.heightPt + Math.max(6, clueGapPt * 0.5);
  const restH = Math.max(16, slot.topPt + slot.heightPt - restTop);
  const rest = body?.cluesRect ?? { leftPt: slot.leftPt, topPt: restTop, widthPt: slot.widthPt, heightPt: restH };
  const clueColor = cw.colors.cluesColor || '#333333';

  if (showClues) {
    const columns = body?.columns ?? (cw.typography.clueLayout === 'single' ? 1 : 2);
    const gap = body?.spacing.columnGap ?? cssPxToPoints(cw.typography.clueSpaceHorizontal ?? 24);
    const colW = (rest.widthPt - (columns === 2 ? gap : 0)) / columns;
    const headingPt = body?.headingFontSize ?? cssPxToPoints(cw.typography.acrossDownFontSize || cw.typography.clueFontSize + 2);
    const cluePt = body?.clueFontSize ?? cssPxToPoints(cw.typography.clueFontSize || 12);
    const vGap = body?.spacing.itemGap ?? cssPxToPoints(cw.typography.clueSpaceVertical ?? 4);
    const lineFactor = body?.spacing.lineHeightFactor ?? 1.25;
    const headingAfter = body?.spacing.headingAfter ?? cssPxToPoints(8);
    const sectionGap = body?.spacing.sectionGap ?? cssPxToPoints(14);
    const groups = [
      { title: 'ACROSS', clues: puzzle.acrossClues },
      { title: 'DOWN', clues: puzzle.downClues },
    ];
    let stackedY = rest.topPt;
    groups.forEach((group, gi) => {
      const colIndex = columns === 2 ? gi : 0;
      let yTop = columns === 2 ? rest.topPt : gi === 0 ? rest.topPt : stackedY + sectionGap;
      const x = rest.leftPt + colIndex * (colW + (columns === 2 ? gap : 0));
      const w = columns === 1 ? rest.widthPt : colW;
      elements.push(
        textBox(x, yTop, w, headingPt * 1.35, group.title, headingPt, headingFamily, clueColor, {
          bold: true,
          effect: cw.typography.clueTextEffect,
        })
      );
      yTop += headingPt * 1.35 + headingAfter;
      for (const clue of group.clues) {
        const line = `${clue.number}. ${clue.clue}`;
        const lines = wrapLines(line, cluePt, w);
        const blockH = Math.max(1, lines.length) * cluePt * lineFactor;
        if (yTop + blockH > rest.topPt + rest.heightPt) return;
        elements.push(
          textBox(x, yTop, w, blockH, line, cluePt, fontFamily, clueColor, {
            lines,
            lineHeight: cluePt * lineFactor,
            effect: cw.typography.clueTextEffect,
          })
        );
        yTop += blockH + vGap;
      }
      if (columns === 1) stackedY = yTop;
    });
    return elements;
  }

  if (showAnswerKey) {
    const formatAnswer = (answer: string) => {
      if (cw.core.answerCase === 'original') return normalizePuzzleText(answer);
      return applyLetterCase(answer, cw.core.answerCase === 'lower' ? 'lower' : 'upper', cw.core.language);
    };
    const keyPt = cssPxToPoints(cw.typography.answerKeyFontSize ?? 11);
    const across = puzzle.acrossClues.map((c) => `${c.number}.${formatAnswer(c.answer)}`).join('  ');
    const down = puzzle.downClues.map((c) => `${c.number}.${formatAnswer(c.answer)}`).join('  ');
    elements.push(
      textBox(grid.leftPt, rest.topPt, grid.widthPt, restH * 0.45, `Across  ${across}`, keyPt, fontFamily, clueColor, {
        lines: wrapLines(`Across  ${across}`, keyPt, grid.widthPt),
      })
    );
    elements.push(
      textBox(grid.leftPt, rest.topPt + restH * 0.48, grid.widthPt, restH * 0.45, `Down  ${down}`, keyPt, fontFamily, clueColor, {
        lines: wrapLines(`Down  ${down}`, keyPt, grid.widthPt),
      })
    );
  }
  return elements;
}

function scrambleWords(puzzle: WordScramblePuzzle): Array<{ original: string; scrambled: string }> {
  const raw = puzzle.words ?? [];
  const out: Array<{ original: string; scrambled: string }> = [];
  for (const entry of raw) {
    const original = String(entry?.original || '').trim();
    const scrambled = String(entry?.scrambled || original).trim();
    if (original.length >= 2) out.push({ original, scrambled: scrambled || original });
  }
  return out;
}

/**
 * Average glyph width / fontSize. Bold / black faces run wider than regular
 * Arial — underestimating here makes "=" overlap the last scramble letter.
 */
function scrambleCharEm(fontFamily: string, bold: boolean): number {
  const heavy = bold || /black|heavy|extra|impact|cooper|rockwell|georgia/i.test(fontFamily);
  return heavy ? 0.82 : 0.7;
}

/**
 * Word Scramble rows — same geometry for canvas, PDF, and PPTX.
 * Numbered prefix, scramble + letter-spacing, optional "=", then blanks/answer.
 */
export function buildScrambleElements(args: {
  puzzle: WordScramblePuzzle;
  slot: RectPt;
  gp: GenericPuzzleSettings;
  showSolution: boolean;
  fontSizePt: number;
  wordGapPt: number;
  letterEm: number;
}): ResolvedElement[] {
  const { puzzle, slot, gp, showSolution, fontSizePt, wordGapPt, letterEm } = args;
  const words = scrambleWords(puzzle);
  const color = gp.colors.gridColor || '#1f2937';
  const bodyFamily = resolveUnicodeFontFamily(
    (showSolution
      ? gp.typography.answerFontFamily || gp.typography.puzzleFontFamily
      : gp.typography.puzzleFontFamily) || 'Arial',
    words.map((w) => `${w.original}${w.scrambled}`).join('')
  );
  const textFx = {
    effect: gp.typography.puzzleTextEffect,
    bold: gp.typography.puzzleBold === true,
    italic: gp.typography.puzzleItalic === true,
  };
  const charEm = scrambleCharEm(bodyFamily, textFx.bold);
  const letterCase = gp.core.letterCase === 'lower' ? 'lower' : 'upper';
  const applyCase = (v: string) => applyLetterCase(v, letterCase);
  const style = gp.core.answerBlankStyle ?? 'underline';
  const rowH = fontSizePt * (style === 'boxes' ? 1.5 : 1.32);
  const lineH = rowH + wordGapPt;
  const elements: ResolvedElement[] = [];
  // Canvas: columnGap = max(4px, fontSize * 0.28) between flex items.
  const itemGap = Math.max(6, fontSizePt * 0.35);
  /**
   * CSS letter-spacing is applied after every character. Pad so wide glyphs
   * (M/W/B, bold/black faces) never spill into the following "=" / blanks.
   */
  const spacedWidth = (count: number, spacingEm: number) =>
    Math.max(0, count) * fontSizePt * (charEm + Math.max(0, spacingEm)) + fontSizePt * 0.2;

  words.forEach((word, i) => {
    const yTop = slot.topPt + i * lineH;
    if (yTop + fontSizePt > slot.topPt + slot.heightPt + 2) return;
    const scrambled = applyCase(word.scrambled);
    const original = applyCase(word.original);
    let x = slot.leftPt;

    // Number prefix — canvas minWidth 1.4em, then column gap.
    const prefix = `${i + 1}.`;
    const prefixW = Math.max(
      fontSizePt * 1.4,
      graphemeCount(prefix) * fontSizePt * charEm + fontSizePt * 0.25
    );
    elements.push(
      textBox(x, yTop, prefixW, rowH, prefix, fontSizePt, bodyFamily, color, {
        ...textFx,
        valign: 'middle',
        lineHeight: rowH,
      })
    );
    x += prefixW + itemGap;

    // Scramble letters use the same puzzle/answer font as numbering (canvas + sidebar).
    const scrambleCount = graphemeCount(scrambled);
    const scrambleW = Math.max(fontSizePt, spacedWidth(scrambleCount, letterEm));
    elements.push(
      textBox(x, yTop, scrambleW, rowH, scrambled, fontSizePt, bodyFamily, color, {
        ...textFx,
        valign: 'middle',
        lineHeight: rowH,
        letterSpacingEm: letterEm,
      })
    );
    x += scrambleW + itemGap;

    if ((gp.core.afterScrambled ?? 'equal') === 'equal') {
      const eqW = fontSizePt * 0.75;
      elements.push(
        textBox(x, yTop, eqW, rowH, '=', fontSizePt, bodyFamily, color, {
          ...textFx,
          valign: 'middle',
          lineHeight: rowH,
        })
      );
      x += eqW + itemGap;
    }

    if (showSolution) {
      const answerCount = graphemeCount(original);
      const answerW = Math.max(fontSizePt, spacedWidth(answerCount, letterEm * 0.5));
      elements.push(
        textBox(x, yTop, answerW, rowH, original, fontSizePt, bodyFamily, color, {
          ...textFx,
          bold: true,
          valign: 'middle',
          lineHeight: rowH,
          letterSpacingEm: letterEm * 0.5,
        })
      );
      return;
    }

    const letters = segmentGraphemes(word.original.replace(/[\s-]/g, ''));
    const blankCount = Math.max(4, letters.length);
    if (style === 'boxes') {
      const box = Math.max(8, fontSizePt * 1.1);
      const gap = Math.max(1, letterEm * fontSizePt);
      for (let li = 0; li < blankCount; li++) {
        elements.push({
          kind: 'rect',
          x: x + li * (box + gap),
          y: yTop + Math.max(0, (rowH - box) / 2),
          w: box,
          h: box,
          stroke: color,
          strokeWidth: 1.1,
        });
      }
      return;
    }
    if (style === 'blank') return;
    const blank =
      style === 'dash'
        ? Array.from({ length: blankCount }, () => '-').join(' ')
        : '_'.repeat(blankCount);
    const blankW = Math.max(
      fontSizePt * 2,
      style === 'dash'
        ? spacedWidth(blankCount * 2 - 1, letterEm * 0.25)
        : spacedWidth(blankCount, letterEm)
    );
    elements.push(
      textBox(x, yTop, blankW, rowH, blank, fontSizePt, bodyFamily, color, {
        ...textFx,
        valign: 'middle',
        lineHeight: rowH,
        letterSpacingEm: letterEm,
      })
    );
  });

  if (!showSolution && gp.core.includeWordBank) {
    const bank = words.map((w) => applyCase(w.original)).sort((a, b) => localeCompareText(a, b));
    const bankTop = slot.topPt + words.length * lineH + Math.max(8, wordGapPt * 1.5);
    const title = gp.core.wordBankTitle || 'Word Bank';
    elements.push(
      textBox(slot.leftPt, bankTop, slot.widthPt, fontSizePt, title, Math.max(8, fontSizePt * 0.9), bodyFamily, color, {
        align: 'center',
        bold: true,
        ...textFx,
      })
    );
    const colW = slot.widthPt / 3;
    bank.forEach((w, i) => {
      const col = i % 3;
      const row = Math.floor(i / 3);
      elements.push(
        textBox(
          slot.leftPt + col * colW,
          bankTop + fontSizePt * 1.2 + row * fontSizePt * 1.15,
          colW,
          fontSizePt,
          w,
          Math.max(7, fontSizePt * 0.75),
          bodyFamily,
          color,
          { align: 'center' }
        )
      );
    });
  }
  return elements;
}

export function buildTriviaElements(args: {
  puzzles: TriviaPuzzle[];
  slot: RectPt;
  gp: GenericPuzzleSettings;
  showSolution: boolean;
}): ResolvedElement[] {
  const { puzzles, slot, gp, showSolution } = args;
  const fontPt = showSolution ? gp.typography.answerFontSize ?? 12 : gp.typography.puzzleFontSize ?? 12;
  const color = gp.colors.gridColor || '#1f2937';
  const fontFamily = gp.typography.puzzleFontFamily || 'Arial';
  const suggestionFamily = gp.typography.suggestionFontFamily || fontFamily;
  const textFx = { effect: gp.typography.puzzleTextEffect };
  const suggestionFx = { effect: gp.typography.suggestionTextEffect ?? gp.typography.puzzleTextEffect };
  const elements: ResolvedElement[] = [];
  const optionPt = Math.max(
    8,
    gp.typography.suggestionFontSize ?? fontPt * 0.95
  );

  if (showSolution) {
    const cols = computeTriviaSolutionColumns(gp.core.triviaSolutionColumns);
    const columnGap = Math.max(0, gp.typography.triviaSolutionColumnSpaceBetween ?? 24);
    const colW = (slot.widthPt - columnGap * (cols - 1)) / cols;
    const answerGap = Math.max(0, gp.typography.triviaSolutionSpaceBetween ?? 12);
    const sectionsPerColumn = Math.ceil(puzzles.length / cols);
    for (let c = 0; c < cols; c++) {
      let y = slot.topPt;
      const columnPuzzles = puzzles.slice(c * sectionsPerColumn, (c + 1) * sectionsPerColumn);
      columnPuzzles.forEach((p, localIndex) => {
        const pi = c * sectionsPerColumn + localIndex;
        const heading = formatTriviaSolutionHeading(p, pi, gp.core.puzzlesStartingNumber);
        const answers = (p.questions ?? []).map((q, qi) => `Q${qi + 1} - Answer: ${resolveTriviaAnswerLetter(q)}`);
        const x = slot.leftPt + c * (colW + columnGap);
        elements.push(textBox(x, y, colW - 8, fontPt * 1.2, heading, fontPt, fontFamily, color, { bold: true, ...textFx }));
        y += fontPt * 1.3;
        answers.forEach((line, ri) => {
          elements.push(textBox(x, y + ri * (fontPt * 1.2 + answerGap), colW - 8, fontPt * 1.2, line, fontPt, fontFamily, color, textFx));
        });
        y += answers.length * (fontPt * 1.2 + answerGap) + Math.max(12, fontPt * 1.2);
      });
    }
    return elements;
  }

  const puzzle = puzzles[0];
  const questions = puzzle?.questions ?? [];
  const twoCol = gp.core.triviaLayoutFormat === 'two-column';
  const colCount = twoCol ? 2 : 1;
  const colW = slot.widthPt / colCount;
  const sGap = gp.typography.triviaSpaceBetweenSuggestions ?? 6;
  const afterQ = gp.typography.triviaSpaceAfterQuestion ?? 8;
  const box = Math.max(8, fontPt * 0.85);
  questions.forEach((q, qi) => {
    const col = twoCol ? qi % 2 : 0;
    const row = twoCol ? Math.floor(qi / 2) : qi;
    const blockH = slot.heightPt / Math.max(1, Math.ceil(questions.length / colCount));
    const x = slot.leftPt + col * colW;
    let ty = slot.topPt + row * blockH;
    const prompt = `${qi + 1}. ${q.prompt}`;
    const promptLines = wrapLines(prompt, fontPt, colW - 8);
    elements.push(
      textBox(x, ty, colW - 8, promptLines.length * fontPt * 1.25, prompt, fontPt, fontFamily, color, {
        bold: true,
        lines: promptLines,
        lineHeight: fontPt * 1.25,
      })
    );
    ty += promptLines.length * fontPt * 1.25 + afterQ * 0.75;
    (q.suggestions ?? []).forEach((sug) => {
      if (gp.core.triviaCheckboxStyle === 'circle') {
        elements.push({ kind: 'ellipse', cx: x + box / 2, cy: ty + box / 2, rx: box / 2, ry: box / 2, stroke: '#9ca3af', strokeWidth: 1.1 });
      } else {
        elements.push({ kind: 'rect', x, y: ty, w: box, h: box, stroke: '#9ca3af', strokeWidth: 1.1 });
      }
      elements.push(
        textBox(x + box + 6, ty, colW - box - 14, optionPt * 1.25, sug, optionPt, suggestionFamily, color, {
          ...suggestionFx,
          italic: gp.typography.suggestionItalic === true,
        })
      );
      ty += optionPt * 1.25 + sGap * 0.75;
    });
  });
  return elements;
}

const CRYPTO_BASE_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

/**
 * The key lists the letters this puzzle actually ciphers, so a French or German
 * phrase gets a row cell for É or Ä instead of silently dropping it.
 */
export function cryptogramKeyAlphabet(puzzle: {
  letterMapping?: Record<string, string>;
}): string[] {
  const plain = new Set(CRYPTO_BASE_ALPHABET);
  for (const original of Object.values(puzzle.letterMapping ?? {})) {
    const letter = localeUpperCase(original);
    if (letter) plain.add(letter);
  }
  return [...plain].sort((a, b) => localeCompareText(a, b));
}

/** Split the alphabet into the requested number of rows, balanced to the last cell. */
export function chunkCryptogramAlphabet(alphabet: string[], lines: 1 | 2 | 3): string[][] {
  const rows = Math.max(1, Math.min(3, lines));
  if (rows === 1) return [alphabet];
  const perRow = Math.ceil(alphabet.length / rows);
  const out: string[][] = [];
  for (let i = 0; i < alphabet.length; i += perRow) out.push(alphabet.slice(i, i + perRow));
  while (out.length < rows) out.push([]);
  return out.filter((row) => row.length > 0);
}

function buildCryptogramAnswerKeyElements(
  puzzle: CryptogramPuzzle,
  gp: GenericPuzzleSettings,
  slot: RectPt,
  topPt: number
): { elements: ResolvedElement[]; heightPt: number } {
  // Canvas format bar target `answer-key` writes answerKeyFont* — honor those sizes
  // so letter/number glyphs and cell height grow together (no silent clip).
  const keyPt = Math.max(6, gp.typography.answerKeyFontSize ?? 18);
  const color = gp.colors.gridColor || '#1f2937';
  const bold = gp.typography.answerKeyBold !== false;
  const italic = gp.typography.answerKeyItalic === true;
  const letterCase = gp.core.letterCase ?? 'upper';
  const applyCase = (value: string) => applyLetterCase(value, letterCase);
  const hintSet = new Set((puzzle.hintLetters ?? []).map((l) => localeUpperCase(l)));
  const plainToCipher: Record<string, string> = {};
  for (const [token, original] of Object.entries(puzzle.letterMapping ?? {})) {
    plainToCipher[localeUpperCase(original)] = token;
  }
  const rows = chunkCryptogramAlphabet(
    cryptogramKeyAlphabet(puzzle),
    gp.core.cryptogramAnswerKeyLines ?? 2
  );
  const fontFamily = resolveUnicodeFontFamily(
    gp.typography.answerKeyFontFamily || 'Arial',
    rows.flat().join('')
  );
  const maxCols = Math.max(...rows.map((r) => r.length));
  const cellW = slot.widthPt / maxCols;
  const cellH = Math.max(keyPt * 1.55, Math.min(cellW, keyPt * 2.4));
  const rowGap = Math.max(4, cellH * 0.18);
  const stroke = 0.75;
  const elements: ResolvedElement[] = [];
  let y = topPt;
  rows.forEach((letters) => {
    const rowCellW = letters.length === maxCols ? cellW : slot.widthPt / letters.length;
    letters.forEach((letter, col) => {
      const x = slot.leftPt + col * rowCellW;
      elements.push({
        kind: 'rect',
        x,
        y,
        w: rowCellW,
        h: cellH,
        stroke: color,
        strokeWidth: stroke,
      });
      elements.push(
        textBox(x, y, rowCellW, cellH, applyCase(letter), keyPt, fontFamily, color, {
          align: 'center',
          valign: 'middle',
          bold,
          italic,
        })
      );
      const cipher = plainToCipher[letter] ?? '';
      const bottom = hintSet.has(letter) ? applyCase(cipher) : '';
      const botY = y + cellH;
      elements.push({
        kind: 'rect',
        x,
        y: botY,
        w: rowCellW,
        h: cellH,
        stroke: color,
        strokeWidth: stroke,
      });
      if (bottom) {
        // Number ciphers (and any multi-glyph token) stay readable inside the cell.
        const botPt =
          graphemeCount(cipher) > 1 ? Math.max(6, Math.min(keyPt, keyPt * 0.78)) : keyPt;
        elements.push(
          textBox(x, botY, rowCellW, cellH, bottom, botPt, fontFamily, color, {
            align: 'center',
            valign: 'middle',
            bold,
            italic,
          })
        );
      }
    });
    y += cellH * 2 + rowGap;
  });
  return { elements, heightPt: y - topPt };
}

interface CryptogramCell {
  /** Cipher token (letter or number string); punctuation passes through as-is. */
  cipher: string;
  /** Plain letter under the token ('' for punctuation). */
  plain: string;
  isLetter: boolean;
}

/**
 * Words of the phrase as cipher cells. Derived from the original text and the
 * mapping, so letters and numbers ciphers share one path and punctuation keeps
 * its place.
 */
function cryptogramWords(puzzle: CryptogramPuzzle): CryptogramCell[][] {
  const plainToCipher: Record<string, string> = {};
  for (const [token, original] of Object.entries(puzzle.letterMapping ?? {})) {
    plainToCipher[localeUpperCase(original)] = token;
  }
  const words: CryptogramCell[][] = [];
  let current: CryptogramCell[] = [];
  for (const g of segmentGraphemes(puzzle.originalText ?? '')) {
    if (/\s/.test(g)) {
      if (current.length) words.push(current);
      current = [];
      continue;
    }
    const cipher = plainToCipher[localeUpperCase(g)];
    if (cipher !== undefined) {
      current.push({ cipher, plain: g, isLetter: true });
    } else {
      current.push({ cipher: g, plain: '', isLetter: false });
    }
  }
  if (current.length) words.push(current);
  return words;
}

export interface CryptogramElementParts {
  elements: ResolvedElement[];
  /** Alphabet answer-key table (puzzle pages with the key enabled). */
  keyBox: { x: number; y: number; w: number; h: number } | null;
  /** Cipher body (tokens with blanks, or the decoded sentence). */
  bodyBox: { x: number; y: number; w: number; h: number };
}

/**
 * Cryptogram body shared by canvas, PDF, and PPTX: optional answer key, then
 * the phrase word by word with a writing blank (line or box) above each cipher
 * token. Hint letters are pre-filled; solution pages fill every blank, or show
 * only the decoded sentence when `cryptogramSolutionOnlyAnswers` is set.
 */
export function buildCryptogramElementParts(args: {
  puzzle: CryptogramPuzzle | { encodedText?: string; originalText?: string };
  slot: RectPt;
  gp: GenericPuzzleSettings;
  showSolution: boolean;
}): CryptogramElementParts {
  const { slot, gp, showSolution } = args;
  const puzzle = args.puzzle as CryptogramPuzzle;
  const color = gp.colors.gridColor || '#1f2937';
  const letterCase = gp.core.letterCase === 'lower' ? 'lower' : 'upper';
  const applyCase = (v: string) => applyLetterCase(v, letterCase);
  const glyphSample = `${puzzle.originalText ?? ''}${puzzle.encodedText ?? ''}`;
  const puzzleFamily = resolveUnicodeFontFamily(gp.typography.puzzleFontFamily || 'Arial', glyphSample);
  const answerFamily = resolveUnicodeFontFamily(
    gp.typography.answerFontFamily || gp.typography.puzzleFontFamily || 'Arial',
    glyphSample
  );
  const bodyFamily = showSolution ? answerFamily : puzzleFamily;
  const basePtRequested = showSolution
    ? gp.typography.answerFontSize ?? gp.typography.puzzleFontSize ?? 14
    : gp.typography.puzzleFontSize ?? 14;
  const textFx = {
    effect: gp.typography.puzzleTextEffect,
    bold: gp.typography.puzzleBold === true,
    italic: gp.typography.puzzleItalic === true,
  };
  const lineGap = Math.max(0, gp.typography.spaceBetweenPuzzleLines ?? 10);
  const elements: ResolvedElement[] = [];
  let bodyTop = slot.topPt;
  let keyBox: CryptogramElementParts['keyBox'] = null;

  if (
    !showSolution &&
    gp.core.showLetterHints !== false &&
    puzzle.letterMapping &&
    Object.keys(puzzle.letterMapping).length > 0
  ) {
    const keyBlock = buildCryptogramAnswerKeyElements(puzzle, gp, slot, bodyTop);
    elements.push(...keyBlock.elements);
    keyBox = { x: slot.leftPt, y: bodyTop, w: slot.widthPt, h: keyBlock.heightPt };
    bodyTop += keyBlock.heightPt + (gp.typography.spaceBetweenAnswerKeyAndPuzzle ?? 0.25) * 72;
  }
  // Solution pages: decoded sentence only.
  // Honor the Solution font size from the canvas format bar — do not auto-shrink.
  if (showSolution && gp.core.cryptogramSolutionOnlyAnswers) {
    const sentence = applyCase(puzzle.originalText || '');
    const pt = Math.max(6, basePtRequested);
    const lines = wrapLines(sentence, pt, slot.widthPt);
    const h = lines.length * pt * 1.5;
    elements.push(
      textBox(slot.leftPt, bodyTop, slot.widthPt, h, sentence, pt, answerFamily, color, {
        ...textFx,
        align: 'center',
        lines,
        lineHeight: pt * 1.5,
      })
    );
    return { elements, keyBox, bodyBox: { x: slot.leftPt, y: bodyTop, w: slot.widthPt, h } };
  }

  const words = cryptogramWords(puzzle);
  const cipherType = puzzle.cipherType ?? 'letters';
  const useBoxes = gp.core.cryptogramFormat === 'boxes' && cipherType === 'letters';
  const hintSet = new Set((puzzle.hintLetters ?? []).map((l) => localeUpperCase(l)));
  const topTextFor = (cell: CryptogramCell): string => {
    if (!cell.isLetter) return '';
    if (showSolution || hintSet.has(localeUpperCase(cell.plain))) return applyCase(cell.plain);
    return '';
  };

  type Metrics = {
    pt: number;
    cellW: (cell: CryptogramCell) => number;
    cellGap: number;
    wordGap: number;
    topH: number;
    bottomH: number;
    rowH: number;
  };
  const metricsFor = (pt: number): Metrics => {
    if (useBoxes) {
      const cell = Math.max(13, pt * 1.35);
      return {
        pt,
        cellW: (c) => (c.isLetter ? cell : Math.max(pt * 0.4, graphemeCount(c.cipher) * pt * 0.5)),
        cellGap: 0,
        wordGap: Math.max(6, lineGap * 1.1),
        topH: cell,
        bottomH: cell,
        rowH: cell * 2,
      };
    }
    return {
      pt,
      cellW: (c) =>
        c.isLetter
          ? Math.max(pt * 0.95, graphemeCount(c.cipher) * pt * 0.65)
          : Math.max(pt * 0.35, graphemeCount(c.cipher) * pt * 0.5),
      cellGap: Math.max(1.5, pt * 0.12),
      wordGap: Math.max(6, lineGap * 1.1),
      topH: Math.max(12, pt * 1.15),
      bottomH: Math.max(10, pt * 1.05),
      rowH: Math.max(12, pt * 1.15) + Math.max(10, pt * 1.05),
    };
  };
  const wordWidth = (word: CryptogramCell[], m: Metrics): number =>
    word.reduce((sum, c) => sum + m.cellW(c), 0) + Math.max(0, word.length - 1) * m.cellGap;
  const layoutRows = (m: Metrics): CryptogramCell[][][] => {
    const rows: CryptogramCell[][][] = [];
    let row: CryptogramCell[][] = [];
    let used = 0;
    for (const word of words) {
      const w = wordWidth(word, m);
      const next = row.length ? used + m.wordGap + w : w;
      if (row.length && next > slot.widthPt) {
        rows.push(row);
        row = [word];
        used = w;
      } else {
        row.push(word);
        used = next;
      }
    }
    if (row.length) rows.push(row);
    return rows;
  };

  // Honor Puzzle / Solution font from the canvas format bar. Cell metrics track the
  // requested size so family/size/bold edits are visible on canvas, PDF, and PPTX.
  // (Canvas FitToSafeArea may scale the whole block; do not silently rewrite fontSize.)
  const metrics = metricsFor(Math.max(6, basePtRequested));
  const rows = layoutRows(metrics);

  const stroke = Math.max(0.6, metrics.pt * 0.06);
  const cipherPt = useBoxes ? Math.max(6, metrics.pt * 0.92) : metrics.pt;
  const answerPt = useBoxes ? Math.max(6, metrics.pt * 0.92) : Math.max(6, metrics.pt * 0.9);
  // Hint letters on the puzzle page use the Puzzle font; solution fills use Solution font.
  const topFamily = bodyFamily;
  let y = bodyTop;
  rows.forEach((row) => {
    const rowW = row.reduce((sum, word) => sum + wordWidth(word, metrics), 0) + Math.max(0, row.length - 1) * metrics.wordGap;
    let x = slot.leftPt + Math.max(0, (slot.widthPt - rowW) / 2);
    row.forEach((word) => {
      word.forEach((cell, ci) => {
        const w = metrics.cellW(cell);
        const top = topTextFor(cell);
        if (!cell.isLetter) {
          // Punctuation sits on the cipher baseline row.
          elements.push(
            textBox(x, y + metrics.topH, w, metrics.bottomH, cell.cipher, cipherPt, bodyFamily, color, {
              ...textFx,
              align: 'center',
              valign: 'middle',
            })
          );
        } else if (useBoxes) {
          elements.push({ kind: 'rect', x, y, w, h: metrics.topH, stroke: color, strokeWidth: stroke });
          elements.push({ kind: 'rect', x, y: y + metrics.topH, w, h: metrics.bottomH, stroke: color, strokeWidth: stroke });
          if (top) {
            elements.push(
              textBox(x, y, w, metrics.topH, top, answerPt, topFamily, color, { ...textFx, align: 'center', valign: 'middle' })
            );
          }
          elements.push(
            textBox(x, y + metrics.topH, w, metrics.bottomH, applyCase(cell.cipher), cipherPt, bodyFamily, color, {
              ...textFx,
              align: 'center',
              valign: 'middle',
            })
          );
        } else {
          // Writing line under the answer slot, cipher token beneath it.
          const lineY = y + metrics.topH - stroke / 2;
          elements.push({ kind: 'line', x1: x, y1: lineY, x2: x + w, y2: lineY, color, width: Math.max(1, stroke * 1.4) });
          if (top) {
            elements.push(
              textBox(x, y, w, metrics.topH - stroke, top, answerPt, topFamily, color, {
                ...textFx,
                align: 'center',
                valign: 'bottom',
              })
            );
          }
          elements.push(
            textBox(x, y + metrics.topH, w, metrics.bottomH, applyCase(cell.cipher), cipherPt, bodyFamily, color, {
              ...textFx,
              align: 'center',
              valign: 'middle',
            })
          );
        }
        x += w + (ci < word.length - 1 ? metrics.cellGap : 0);
      });
      x += metrics.wordGap;
    });
    y += metrics.rowH + lineGap;
  });
  const bodyH = Math.max(metrics.rowH, y - lineGap - bodyTop);
  return { elements, keyBox, bodyBox: { x: slot.leftPt, y: bodyTop, w: slot.widthPt, h: bodyH } };
}

export function buildCryptogramElements(args: {
  puzzle: CryptogramPuzzle | { encodedText?: string; originalText?: string };
  slot: RectPt;
  gp: GenericPuzzleSettings;
  showSolution: boolean;
}): ResolvedElement[] {
  return buildCryptogramElementParts(args).elements;
}
