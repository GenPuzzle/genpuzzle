import type { CanvasFormatTarget } from '../canvas-native-format';
import type { GenericPuzzleSettings } from '../generic-puzzle-settings';
import type { RectPt } from '../generic-puzzle-page-layout';
import type { MathMazePuzzle } from '../puzzles/math-maze';
import type { ResolvedElement } from './types';

function finitePositive(value: unknown, fallback: number): number {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

export type MathMazeFontHit = {
  target: Extract<
    CanvasFormatTarget,
    'math-equations' | 'math-path-numbers' | 'math-start-end'
  >;
  x: number;
  y: number;
  w: number;
  h: number;
};

export type MathMazeElementParts = {
  elements: ResolvedElement[];
  gridBox: { x: number; y: number; w: number; h: number };
  fontHits: MathMazeFontHit[];
};

type Box = { x: number; y: number; w: number; h: number };
type Pt = { x: number; y: number };

function edgeKey(r: number, c: number, tr: number, tc: number): string {
  if (r < tr || (r === tr && c <= tc)) return `${r},${c}->${tr},${tc}`;
  return `${tr},${tc}->${r},${c}`;
}

/** Crossing diagonal partner in the same 2×2 (if any). */
function crossingDiagonalKey(r: number, c: number, tr: number, tc: number): string | null {
  const dr = tr - r;
  const dc = tc - c;
  if (Math.abs(dr) !== 1 || Math.abs(dc) !== 1) return null;
  return edgeKey(r, c + dc, tr, tc - dc);
}

function channelAttach(box: Box, dr: number, dc: number): Pt {
  const inset = Math.min(box.w, box.h) * 0.16;
  const cx = box.x + box.w / 2;
  const cy = box.y + box.h / 2;
  if (dr === 0 && dc !== 0) {
    return { x: dc > 0 ? box.x + box.w : box.x, y: cy };
  }
  if (dc === 0 && dr !== 0) {
    return { x: cx, y: dr > 0 ? box.y + box.h : box.y };
  }
  return {
    x: dc > 0 ? box.x + box.w - inset : box.x + inset,
    y: dr > 0 ? box.y + box.h - inset : box.y + inset,
  };
}

function aabbFromPoints(points: Pt[]): Box {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of points) {
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
  }
  return { x: minX, y: minY, w: Math.max(1, maxX - minX), h: Math.max(1, maxY - minY) };
}

/**
 * One continuous bordered corridor from equation box to equation box,
 * with the path number centered inside (no separate stub rails).
 */
function pushChannelCorridor(
  elements: ResolvedElement[],
  fontHits: MathMazeFontHit[],
  from: Box,
  to: Box,
  fromCell: { row: number; col: number },
  toCell: { row: number; col: number },
  value: number,
  opts: {
    color: string;
    lineW: number;
    railGap: number;
    fontFamily: string;
    fontSize: number;
    textColor: string;
    highlight: boolean;
    labelT: number;
    solutionFill: string;
  }
): void {
  const dr = Math.sign(toCell.row - fromCell.row);
  const dc = Math.sign(toCell.col - fromCell.col);
  const p1 = channelAttach(from, dr, dc);
  const p2 = channelAttach(to, -dr, -dc);
  let dx = p2.x - p1.x;
  let dy = p2.y - p1.y;
  const len = Math.hypot(dx, dy);
  if (len < 2) return;
  dx /= len;
  dy /= len;
  const nx = -dy;
  const ny = dx;

  const label = String(value);
  const textW = Math.max(
    opts.fontSize * 1.15,
    opts.fontSize * (label.length * 0.78 + 0.65)
  );
  const textH = opts.fontSize * 1.15;
  // Corridor width fits the number with comfortable padding on both sides
  const half = Math.max(
    opts.railGap / 2,
    textH * 0.55 + Math.max(2.2, opts.fontSize * 0.28),
    textW * 0.08
  );

  const t = Math.max(0.28, Math.min(0.72, opts.labelT));
  const midX = p1.x + dx * (len * t);
  const midY = p1.y + dy * (len * t);

  const corners = [
    { x: p1.x - nx * half, y: p1.y - ny * half },
    { x: p1.x + nx * half, y: p1.y + ny * half },
    { x: p2.x + nx * half, y: p2.y + ny * half },
    { x: p2.x - nx * half, y: p2.y - ny * half },
  ];

  const color = opts.highlight ? opts.color : '#111111';
  const width = opts.highlight ? opts.lineW * 1.35 : opts.lineW;
  const fill = opts.highlight ? opts.solutionFill : '#ffffff';

  elements.push({
    kind: 'polygon',
    points: corners,
    fill,
    stroke: color,
    strokeWidth: width,
  });

  const hit = aabbFromPoints(corners);
  fontHits.push({
    target: 'math-path-numbers',
    x: hit.x,
    y: hit.y,
    w: hit.w,
    h: hit.h,
  });

  let rotationDeg = (Math.atan2(dy, dx) * 180) / Math.PI;
  if (rotationDeg > 90 || rotationDeg < -90) rotationDeg += 180;

  elements.push({
    kind: 'text',
    x: midX - textW / 2,
    y: midY - textH / 2,
    w: textW,
    h: textH,
    text: label,
    lines: [label],
    fontFamily: opts.fontFamily,
    fontSize: opts.fontSize,
    color: opts.highlight ? opts.color : opts.textColor,
    bold: true,
    align: 'center',
    valign: 'middle',
    lineHeight: textH,
    rotationDeg,
  });
}

/**
 * Compact reference-style Math Maze: rounded equation boxes, continuous H/V/diagonal
 * answer corridors, Start/End inside boxes, answer numbers centered on each path.
 */
export function buildMathMazeElementParts(args: {
  puzzle: MathMazePuzzle;
  slot: RectPt;
  gp: GenericPuzzleSettings;
  showSolution: boolean;
  preferredCellPt: number;
}): MathMazeElementParts {
  const { puzzle, slot, gp, showSolution } = args;
  const rows = Math.max(1, puzzle.rows);
  const cols = Math.max(1, puzzle.columns);
  const preferred = finitePositive(args.preferredCellPt, 36);

  const channelPct = Math.max(
    20,
    Math.min(100, Number(gp.core.mathMazeChannelSizePercent) || 60)
  );
  const roundPct = Math.max(
    0,
    Math.min(50, Number(gp.core.mathMazeCornerRoundingPercent) || 22)
  );
  const pathColor =
    gp.core.mathMazeSolutionPathColor || gp.colors.solutionPathColor || '#6b7280';
  const solutionCellFill = gp.core.mathMazeSolutionCellFill || '#e5e7eb';
  const ink = gp.colors.gridColor || '#111111';

  const equationFamily =
    gp.typography.mathMazeEquationFontFamily ||
    gp.typography.puzzleFontFamily ||
    'Arial';
  const channelFamily =
    gp.typography.mathMazeChannelFontFamily ||
    gp.typography.puzzleFontFamily ||
    'Arial';
  const startEndFamily =
    gp.typography.mathMazeStartEndFontFamily ||
    gp.typography.puzzleFontFamily ||
    'Arial';

  const eqFont = finitePositive(
    showSolution
      ? gp.typography.mathMazeAnswerEquationFontSize ?? gp.typography.answerFontSize
      : gp.typography.mathMazeEquationFontSize ?? gp.typography.puzzleFontSize,
    11
  );
  const chFont = finitePositive(
    showSolution
      ? gp.typography.mathMazeAnswerChannelFontSize ?? gp.typography.answerFontSize
      : gp.typography.mathMazeChannelFontSize ?? 9,
    9
  );
  const startFont = finitePositive(
    showSolution
      ? gp.typography.mathMazeAnswerStartFontSize ?? gp.typography.mathMazeStartFontSize
      : gp.typography.mathMazeStartFontSize,
    11
  );
  const endFont = finitePositive(
    showSolution
      ? gp.typography.mathMazeAnswerEndFontSize ?? gp.typography.mathMazeEndFontSize
      : gp.typography.mathMazeEndFontSize,
    12
  );

  const gapRatio = 0.45 + (channelPct / 100) * 0.28;
  const node = preferred;
  const pitch = node * (1 + gapRatio);
  const gridW = cols * node + (cols - 1) * (pitch - node);
  const gridH = rows * node + (rows - 1) * (pitch - node);
  const scale = Math.min(
    slot.widthPt / Math.max(1, gridW),
    slot.heightPt / Math.max(1, gridH),
    1.25
  );
  const n = node * scale;
  const p = pitch * scale;
  const totalW = cols * n + (cols - 1) * (p - n);
  const totalH = rows * n + (rows - 1) * (p - n);
  const originX = slot.leftPt + (slot.widthPt - totalW) / 2;
  const originY = slot.topPt + (slot.heightPt - totalH) / 2;
  const radius = (n * roundPct) / 100;
  const gutter = p - n;
  const railGap = Math.max(3.2, Math.min(gutter * 0.28, n * 0.14));
  const lineW = Math.max(0.85, Math.min(2, n * 0.032));

  const nodeAt = (r: number, c: number): Box => ({
    x: originX + c * p,
    y: originY + r * p,
    w: n,
    h: n,
  });

  const pathEdgeSet = new Set<string>();
  for (let i = 0; i < puzzle.solutionPath.length - 1; i++) {
    const a = puzzle.solutionPath[i]!;
    const b = puzzle.solutionPath[i + 1]!;
    pathEdgeSet.add(edgeKey(a.row, a.col, b.row, b.col));
  }

  type EdgeCand = {
    key: string;
    fromR: number;
    fromC: number;
    toR: number;
    toC: number;
    value: number;
    isCorrect: boolean;
    onPath: boolean;
  };
  const bestByEdge = new Map<string, EdgeCand>();
  const rank = (c: EdgeCand) => (c.onPath ? 4 : 0) + (c.isCorrect ? 2 : 0);
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const eq = puzzle.equations[r]?.[c];
      if (!eq) continue;
      for (const ch of eq.channels) {
        const key = edgeKey(r, c, ch.toRow, ch.toCol);
        const onPath = pathEdgeSet.has(key) && ch.isCorrect;
        const cand: EdgeCand = {
          key,
          fromR: r,
          fromC: c,
          toR: ch.toRow,
          toC: ch.toCol,
          value: ch.value,
          isCorrect: ch.isCorrect,
          onPath,
        };
        const prev = bestByEdge.get(key);
        if (!prev || rank(cand) > rank(prev)) bestByEdge.set(key, cand);
      }
    }
  }

  // Never draw both diagonals of a 2×2 (drop the lower-ranked crossing partner)
  for (const item of [...bestByEdge.values()]) {
    const cross = crossingDiagonalKey(item.fromR, item.fromC, item.toR, item.toC);
    if (!cross) continue;
    const other = bestByEdge.get(cross);
    if (!other) continue;
    if (rank(item) > rank(other)) bestByEdge.delete(cross);
    else if (rank(other) > rank(item)) bestByEdge.delete(item.key);
    else if (item.key < cross) bestByEdge.delete(cross);
    else bestByEdge.delete(item.key);
  }

  const elements: ResolvedElement[] = [];
  const fontHits: MathMazeFontHit[] = [];
  const drawnKeys = new Set(bestByEdge.keys());

  for (const item of bestByEdge.values()) {
    const from = nodeAt(item.fromR, item.fromC);
    const to = nodeAt(item.toR, item.toC);
    const cross = crossingDiagonalKey(item.fromR, item.fromC, item.toR, item.toC);
    let labelT = 0.5;
    if (cross && drawnKeys.has(cross)) {
      const mainDiag =
        (item.toR - item.fromR) * (item.toC - item.fromC) > 0;
      labelT = mainDiag ? 0.38 : 0.62;
    }
    const channelFontSize = Math.min(chFont, gutter * 0.55, n * 0.32);
    pushChannelCorridor(
      elements,
      fontHits,
      from,
      to,
      { row: item.fromR, col: item.fromC },
      { row: item.toR, col: item.toC },
      item.value,
      {
        color: pathColor,
        lineW,
        railGap,
        fontFamily: channelFamily,
        fontSize: channelFontSize,
        textColor: ink,
        highlight: showSolution && item.onPath,
        labelT,
        solutionFill: solutionCellFill,
      }
    );
  }

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const eq = puzzle.equations[r]?.[c];
      if (!eq) continue;
      const box = nodeAt(r, c);
      const isStart = r === puzzle.start.row && c === puzzle.start.col;
      const isEnd = r === puzzle.end.row && c === puzzle.end.col;
      const highlight =
        showSolution && puzzle.solutionPath.some((pt) => pt.row === r && pt.col === c);

      elements.push({
        kind: 'rect',
        x: box.x,
        y: box.y,
        w: box.w,
        h: box.h,
        fill: highlight ? solutionCellFill : '#ffffff',
        stroke: highlight ? pathColor : ink,
        strokeWidth: highlight ? lineW * 1.45 : lineW * 1.2,
        radius: Math.max(2, radius),
      });

      if (isEnd) {
        const label = (gp.core.mathMazeEndText ?? '').trim() || puzzle.endText || 'End';
        const fs = Math.min(endFont, box.h * 0.42);
        elements.push({
          kind: 'text',
          x: box.x,
          y: box.y,
          w: box.w,
          h: box.h,
          text: label,
          lines: [label],
          fontFamily: startEndFamily,
          fontSize: fs,
          color: ink,
          bold: true,
          align: 'center',
          valign: 'middle',
          lineHeight: fs,
        });
        fontHits.push({
          target: 'math-start-end',
          x: box.x,
          y: box.y,
          w: box.w,
          h: box.h,
        });
        continue;
      }

      if (isStart) {
        const startLabel =
          (gp.core.mathMazeStartText ?? '').trim() || puzzle.startText || 'Start';
        const sf = Math.min(startFont, box.h * 0.26);
        const ef = Math.min(eqFont, box.h * 0.32);
        const startBox = {
          x: box.x + box.w * 0.06,
          y: box.y + box.h * 0.06,
          w: box.w * 0.88,
          h: box.h * 0.4,
        };
        const eqBox = {
          x: box.x + box.w * 0.06,
          y: box.y + box.h * 0.46,
          w: box.w * 0.88,
          h: box.h * 0.44,
        };
        elements.push({
          kind: 'text',
          ...startBox,
          text: startLabel,
          lines: [startLabel],
          fontFamily: startEndFamily,
          fontSize: sf,
          color: ink,
          bold: true,
          align: 'center',
          valign: 'middle',
          lineHeight: sf,
        });
        elements.push({
          kind: 'text',
          ...eqBox,
          text: eq.expression,
          lines: [eq.expression],
          fontFamily: equationFamily,
          fontSize: ef,
          color: ink,
          bold: true,
          align: 'center',
          valign: 'middle',
          lineHeight: ef,
        });
        fontHits.push({ target: 'math-start-end', ...startBox });
        fontHits.push({ target: 'math-equations', ...eqBox });
        continue;
      }

      const fs = Math.min(eqFont, box.h * 0.38);
      const eqBox = {
        x: box.x + box.w * 0.06,
        y: box.y,
        w: box.w * 0.88,
        h: box.h,
      };
      elements.push({
        kind: 'text',
        ...eqBox,
        text: eq.expression,
        lines: [eq.expression],
        fontFamily: equationFamily,
        fontSize: fs,
        color: ink,
        bold: true,
        align: 'center',
        valign: 'middle',
        lineHeight: fs,
      });
      fontHits.push({ target: 'math-equations', ...eqBox });
    }
  }

  return {
    elements,
    gridBox: { x: originX, y: originY, w: totalW, h: totalH },
    fontHits,
  };
}

export function buildMathMazeElements(args: {
  puzzle: MathMazePuzzle;
  slot: RectPt;
  gp: GenericPuzzleSettings;
  showSolution: boolean;
  preferredCellPt: number;
}): ResolvedElement[] {
  return buildMathMazeElementParts(args).elements;
}
