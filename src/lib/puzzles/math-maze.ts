/**
 * Math Maze generator: grid of equations; follow channels labeled with the correct answer from Start to End.
 */

import type { DocumentBatchPuzzleMeta } from './types';

export type MathMazeDifficulty = 'easy' | 'medium' | 'hard';

export type MathMazeOperator = '+' | '-' | '*' | '/';

export interface MathMazeChannel {
  id: string;
  toRow: number;
  toCol: number;
  value: number;
  isCorrect: boolean;
}

export interface MathMazeEquation {
  id: string;
  row: number;
  col: number;
  expression: string;
  answer: number;
  operands: number[];
  operators: MathMazeOperator[];
  channels: MathMazeChannel[];
  correctChannelId: string | null;
}

export interface MathMazePuzzle extends DocumentBatchPuzzleMeta {
  type: 'math-maze';
  id?: string;
  rows: number;
  columns: number;
  equations: MathMazeEquation[][];
  start: { row: number; col: number };
  end: { row: number; col: number };
  solutionPath: Array<{ row: number; col: number }>;
  startText: string;
  endText: string;
  difficulty?: MathMazeDifficulty;
  metadata?: {
    seed?: number;
    difficultyScore?: number;
    pathLength?: number;
    createdAt?: string;
  };
}

export interface MathMazeOperations {
  add: boolean;
  sub: boolean;
  mul: boolean;
  div: boolean;
}

export type MathMazeParenthesesMode = 'all' | 'random';

export interface MathMazeGenerateOptions {
  equationsAcross?: number;
  equationsDown?: number;
  maxDigits?: number;
  maxDividendDigits?: number;
  maxDivisorDigits?: number;
  maxAnswerDigits?: number;
  numbersPerEquation?: 2 | 3 | 4;
  operations?: Partial<MathMazeOperations>;
  allowNegative?: boolean;
  useParentheses?: boolean;
  parenthesesMode?: MathMazeParenthesesMode;
  difficulty?: MathMazeDifficulty;
  seed?: number;
  startText?: string;
  endText?: string;
  signal?: { cancelled?: boolean };
}

function mulberry32(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffleInPlace<T>(arr: T[], rand: () => number): void {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [arr[i], arr[j]] = [arr[j]!, arr[i]!];
  }
}

function clampInt(value: unknown, min: number, max: number, fallback: number): number {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.round(n)));
}

function cellKey(row: number, col: number): string {
  return `${row},${col}`;
}

/** 8-way adjacency (orthogonal + diagonal), matching the reference Math Maze. */
function kingNeighbors(
  row: number,
  col: number,
  rows: number,
  cols: number
): Array<{ row: number; col: number; diagonal: boolean }> {
  const out: Array<{ row: number; col: number; diagonal: boolean }> = [];
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      if (dr === 0 && dc === 0) continue;
      const rr = row + dr;
      const cc = col + dc;
      if (rr < 0 || cc < 0 || rr >= rows || cc >= cols) continue;
      out.push({ row: rr, col: cc, diagonal: dr !== 0 && dc !== 0 });
    }
  }
  return out;
}

function isKingAdjacent(
  a: { row: number; col: number },
  b: { row: number; col: number }
): boolean {
  const dr = Math.abs(a.row - b.row);
  const dc = Math.abs(a.col - b.col);
  return dr <= 1 && dc <= 1 && !(dr === 0 && dc === 0);
}

function undirectedEdgeKey(
  a: { row: number; col: number },
  b: { row: number; col: number }
): string {
  if (a.row < b.row || (a.row === b.row && a.col <= b.col)) {
    return `${a.row},${a.col}->${b.row},${b.col}`;
  }
  return `${b.row},${b.col}->${a.row},${a.col}`;
}

/** Partner diagonal that would form an X in the same 2×2 block. */
function crossingDiagonalEdgeKey(
  a: { row: number; col: number },
  b: { row: number; col: number }
): string | null {
  const dr = b.row - a.row;
  const dc = b.col - a.col;
  if (Math.abs(dr) !== 1 || Math.abs(dc) !== 1) return null;
  return undirectedEdgeKey(
    { row: a.row, col: a.col + dc },
    { row: b.row, col: b.col - dc }
  );
}

function maxNum(digits: number): number {
  return 10 ** Math.max(1, digits) - 1;
}

function randInt(rand: () => number, lo: number, hi: number): number {
  if (hi < lo) return lo;
  return lo + Math.floor(rand() * (hi - lo + 1));
}

function evalLeftToRight(
  operands: number[],
  operators: MathMazeOperator[]
): number | null {
  if (operands.length !== operators.length + 1) return null;
  let value = operands[0]!;
  for (let i = 0; i < operators.length; i++) {
    const op = operators[i]!;
    const b = operands[i + 1]!;
    if (op === '+') value += b;
    else if (op === '-') value -= b;
    else if (op === '*') value *= b;
    else if (op === '/') {
      if (b === 0 || value % b !== 0) return null;
      value = value / b;
    }
  }
  if (!Number.isFinite(value) || !Number.isInteger(value)) return null;
  return value;
}

/** Standard precedence: × and ÷ left-to-right first, then + and − left-to-right. */
function evalWithPrecedence(
  operands: number[],
  operators: MathMazeOperator[]
): number | null {
  if (operands.length !== operators.length + 1) return null;
  const vals = operands.slice();
  const ops = operators.slice();
  let i = 0;
  while (i < ops.length) {
    const op = ops[i]!;
    if (op === '*' || op === '/') {
      const a = vals[i]!;
      const b = vals[i + 1]!;
      if (op === '/') {
        if (b === 0 || a % b !== 0) return null;
        vals.splice(i, 2, a / b);
      } else {
        vals.splice(i, 2, a * b);
      }
      ops.splice(i, 1);
    } else {
      i += 1;
    }
  }
  let acc = vals[0]!;
  for (let k = 0; k < ops.length; k++) {
    const b = vals[k + 1]!;
    if (ops[k] === '+') acc += b;
    else acc -= b;
  }
  if (!Number.isFinite(acc) || !Number.isInteger(acc)) return null;
  return acc;
}

/**
 * Evaluate an equation. With parentheses the first pair is grouped, then the
 * rest follows standard precedence — the same rule the printed text implies.
 */
function evalExpression(
  operands: number[],
  operators: MathMazeOperator[],
  withParens: boolean
): number | null {
  if (withParens && operands.length >= 3) {
    const inner = evalLeftToRight(operands.slice(0, 2), [operators[0]!]);
    if (inner == null) return null;
    return evalWithPrecedence([inner, ...operands.slice(2)], operators.slice(1));
  }
  return evalWithPrecedence(operands, operators);
}

function formatExpression(
  operands: number[],
  operators: MathMazeOperator[],
  withParens: boolean
): string {
  const sym = (op: MathMazeOperator) => (op === '*' ? '×' : op === '/' ? '÷' : op);
  let s: string;
  let startIdx: number;
  if (withParens && operands.length >= 3) {
    s = `(${operands[0]}${sym(operators[0]!)}${operands[1]})`;
    startIdx = 1;
  } else {
    s = String(operands[0]);
    startIdx = 0;
  }
  for (let i = startIdx; i < operators.length; i++) {
    s += `${sym(operators[i]!)}${operands[i + 1]}`;
  }
  return s;
}

export function evaluateMathMazeExpression(
  operands: number[],
  operators: MathMazeOperator[],
  withParentheses = false
): number {
  const v = evalExpression(operands, operators, withParentheses);
  if (v == null) throw new Error('invalid expression');
  return v;
}

function expressionUsesParens(expression: string): boolean {
  return expression.includes('(');
}

function makeEquation(
  rand: () => number,
  opts: {
    numbersPerEquation: 2 | 3 | 4;
    maxDigits: number;
    maxDividendDigits: number;
    maxDivisorDigits: number;
    maxAnswerDigits: number;
    ops: MathMazeOperations;
    allowNegative: boolean;
    useParentheses: boolean;
    parenthesesMode: MathMazeParenthesesMode;
  }
): { expression: string; answer: number; operands: number[]; operators: MathMazeOperator[] } | null {
  const enabled: MathMazeOperator[] = [];
  if (opts.ops.add) enabled.push('+');
  if (opts.ops.sub) enabled.push('-');
  if (opts.ops.mul) enabled.push('*');
  if (opts.ops.div) enabled.push('/');
  if (enabled.length === 0) enabled.push('+');

  const nCount = opts.numbersPerEquation;
  const maxA = maxNum(opts.maxAnswerDigits);

  const maxOperand = maxNum(opts.maxDigits);
  // Pick the operand that follows a × so the running product stays within the
  // answer limit (otherwise "× only" with 3–4 numbers can never succeed).
  const pickMultiplicand = (runningProduct: number): number => {
    const cap = Math.max(1, Math.floor(maxA / Math.max(1, Math.abs(runningProduct))));
    return randInt(rand, 1, Math.max(1, Math.min(maxOperand, cap)));
  };

  for (let attempt = 0; attempt < 160; attempt++) {
    const operators: MathMazeOperator[] = [];
    for (let i = 0; i < nCount - 1; i++) {
      operators.push(enabled[Math.floor(rand() * enabled.length)]!);
    }

    let operands: number[] = [];
    if (operators.includes('/')) {
      const divisor = randInt(rand, 1, maxNum(opts.maxDivisorDigits));
      const quotient = randInt(rand, 1, Math.max(1, Math.floor(maxNum(opts.maxDividendDigits) / divisor)));
      const dividend = divisor * quotient;
      operands = [dividend, divisor];
      operators[0] = '/';
      for (let i = 1; i < operators.length; i++) {
        const nonDiv = enabled.filter((o) => o !== '/');
        operators[i] = nonDiv[Math.floor(rand() * nonDiv.length)] ?? '+';
      }
      let running = quotient;
      while (operands.length < nCount) {
        const op = operators[operands.length - 1]!;
        const v = op === '*' ? pickMultiplicand(running) : randInt(rand, 1, maxOperand);
        running = op === '*' ? running * v : v;
        operands.push(v);
      }
    } else {
      let running = 1;
      for (let i = 0; i < nCount; i++) {
        const op = i > 0 ? operators[i - 1]! : null;
        const v = op === '*' ? pickMultiplicand(running) : randInt(rand, 1, maxOperand);
        running = op === '*' ? running * v : v;
        operands.push(v);
      }
    }

    if (!opts.allowNegative) {
      for (let i = 0; i < operators.length; i++) {
        if (operators[i] === '-' && operands[i]! < operands[i + 1]!) {
          [operands[i], operands[i + 1]] = [operands[i + 1]!, operands[i]!];
        }
      }
    }

    const withParens =
      opts.useParentheses &&
      nCount >= 3 &&
      (opts.parenthesesMode === 'all' || rand() < 0.5);

    const answer = evalExpression(operands, operators, withParens);
    if (answer == null) continue;
    if (!opts.allowNegative && answer < 0) continue;
    if (Math.abs(answer) > maxA) continue;

    return {
      expression: formatExpression(operands, operators, withParens),
      answer,
      operands,
      operators,
    };
  }
  return null;
}

function equationAnswer(eq: MathMazeEquation): number {
  const withParens = expressionUsesParens(eq.expression);
  return evaluateMathMazeExpression(eq.operands, eq.operators, withParens);
}

function plausibleWrongAnswer(
  answer: number,
  rand: () => number,
  used: Set<number>,
  allowNegative = true
): number {
  const ok = (v: number) =>
    v !== answer && !used.has(v) && Number.isInteger(v) && (allowNegative || v >= 0);
  const candidates = [answer + 1, answer - 1, answer + 2, answer + 10, answer - 2, answer + 3];
  shuffleInPlace(candidates, rand);
  for (const v of candidates) {
    if (ok(v)) return v;
  }
  let v = answer + 3;
  while (!ok(v)) v += 1;
  return v;
}

function generatePath(
  rows: number,
  cols: number,
  rand: () => number
): { path: Array<{ row: number; col: number }>; start: { row: number; col: number }; end: { row: number; col: number } } | null {
  const start = { row: 0, col: 0 };
  const end = { row: rows - 1, col: cols - 1 };
  const visited = new Set<string>();
  const path: Array<{ row: number; col: number }> = [];
  const pathEdges = new Set<string>();
  // A wandering walk on a large grid can wall itself in; without a cap the
  // backtracking below is exponential. Abort and let the caller retry instead.
  const maxExpansions = Math.max(4000, rows * cols * 60);
  let expansions = 0;

  function dfs(r: number, c: number, usedDiagonal: boolean, requireDiagonal: boolean): boolean {
    if (expansions++ > maxExpansions) return false;
    const key = cellKey(r, c);
    if (visited.has(key)) return false;
    visited.add(key);
    const prevCell = path[path.length - 1];
    const edgeKey = prevCell ? undirectedEdgeKey(prevCell, { row: r, col: c }) : null;
    if (edgeKey) pathEdges.add(edgeKey);
    path.push({ row: r, col: c });
    if (r === end.row && c === end.col) {
      if (requireDiagonal && !usedDiagonal) {
        path.pop();
        if (edgeKey) pathEdges.delete(edgeKey);
        visited.delete(key);
        return false;
      }
      return true;
    }
    const nbrs = kingNeighbors(r, c, rows, cols);
    // Prefer progress + occasional diagonals; skip diagonals that would X an existing path edge
    const jitter = new Map<string, number>();
    for (const n of nbrs) jitter.set(cellKey(n.row, n.col), rand());
    nbrs.sort((a, b) => {
      const da = Math.abs(a.row - end.row) + Math.abs(a.col - end.col);
      const db = Math.abs(b.row - end.row) + Math.abs(b.col - end.col);
      const diagBoostA = a.diagonal ? -0.45 : 0;
      const diagBoostB = b.diagonal ? -0.45 : 0;
      return (
        da + diagBoostA - (db + diagBoostB) ||
        jitter.get(cellKey(a.row, a.col))! - jitter.get(cellKey(b.row, b.col))!
      );
    });
    if (rand() < 0.35) shuffleInPlace(nbrs, rand);
    for (const n of nbrs) {
      if (n.diagonal) {
        const cross = crossingDiagonalEdgeKey({ row: r, col: c }, n);
        if (cross && pathEdges.has(cross)) continue;
      }
      if (dfs(n.row, n.col, usedDiagonal || n.diagonal, requireDiagonal)) return true;
      if (expansions > maxExpansions) break;
    }
    path.pop();
    if (edgeKey) pathEdges.delete(edgeKey);
    visited.delete(key);
    return false;
  }

  const reset = () => {
    visited.clear();
    path.length = 0;
    pathEdges.clear();
    expansions = 0;
  };

  // First try to include at least one diagonal (reference look); fall back if needed.
  const wantDiagonal = rows * cols >= 6;
  if (!dfs(start.row, start.col, false, wantDiagonal)) {
    reset();
    if (!dfs(start.row, start.col, false, false) || path.length < 2) return null;
  }
  if (path.length < 2) return null;
  for (let i = 1; i < path.length; i++) {
    if (!isKingAdjacent(path[i - 1]!, path[i]!)) return null;
  }
  return { path, start, end };
}

function equationAt(equations: MathMazeEquation[][], row: number, col: number): MathMazeEquation | null {
  return equations[row]?.[col] ?? null;
}

export function countMathMazeCorrectAnswerPaths(
  puzzle: MathMazePuzzle,
  limit = 2
): number {
  const { rows, columns, equations, start, end } = puzzle;
  let count = 0;

  function dfs(row: number, col: number, seen: Set<string>): void {
    if (count >= limit) return;
    if (row === end.row && col === end.col) {
      count += 1;
      return;
    }
    const eq = equationAt(equations, row, col);
    if (!eq) return;
    for (const ch of eq.channels) {
      if (ch.value !== eq.answer) continue;
      if (ch.toRow < 0 || ch.toRow >= rows || ch.toCol < 0 || ch.toCol >= columns) continue;
      const k = cellKey(ch.toRow, ch.toCol);
      if (seen.has(k)) continue;
      seen.add(k);
      dfs(ch.toRow, ch.toCol, seen);
      seen.delete(k);
      if (count >= limit) return;
    }
  }

  dfs(start.row, start.col, new Set([cellKey(start.row, start.col)]));
  return count;
}

export function validateMathMaze(
  puzzle: MathMazePuzzle
): { ok: true } | { ok: false; reason: string } {
  const { rows, columns, equations, start, end, solutionPath } = puzzle;
  if (equations.length !== rows) return { ok: false, reason: 'equations row count mismatch' };
  for (let r = 0; r < rows; r++) {
    if ((equations[r]?.length ?? 0) !== columns) {
      return { ok: false, reason: 'equations column count mismatch' };
    }
  }
  if (start.row < 0 || start.row >= rows || start.col < 0 || start.col >= columns) {
    return { ok: false, reason: 'invalid start' };
  }
  if (end.row < 0 || end.row >= rows || end.col < 0 || end.col >= columns) {
    return { ok: false, reason: 'invalid end' };
  }
  if (solutionPath.length < 2) return { ok: false, reason: 'solution path too short' };
  const first = solutionPath[0]!;
  const last = solutionPath[solutionPath.length - 1]!;
  if (first.row !== start.row || first.col !== start.col) {
    return { ok: false, reason: 'path must start at start cell' };
  }
  if (last.row !== end.row || last.col !== end.col) {
    return { ok: false, reason: 'path must end at end cell' };
  }

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < columns; c++) {
      const eq = equations[r]![c]!;
      const isEndCell = r === end.row && c === end.col;
      if (isEndCell) {
        if (eq.expression.trim() !== '') {
          return { ok: false, reason: 'end cell must not contain an equation' };
        }
        if (eq.channels.some((ch) => ch.isCorrect)) {
          return { ok: false, reason: 'end cell must not have outgoing correct channel' };
        }
        continue;
      }
      if (!eq.expression.trim()) {
        return { ok: false, reason: `missing expression at ${r},${c}` };
      }
      const expectedNbrs = kingNeighbors(r, c, rows, columns);
      for (const n of expectedNbrs) {
        if (n.diagonal) continue;
        if (!eq.channels.some((ch) => ch.toRow === n.row && ch.toCol === n.col)) {
          return { ok: false, reason: `missing orthogonal link ${r},${c} → ${n.row},${n.col}` };
        }
      }
      for (const ch of eq.channels) {
        const cross = crossingDiagonalEdgeKey(
          { row: r, col: c },
          { row: ch.toRow, col: ch.toCol }
        );
        if (!cross) continue;
        const [a, b] = cross.split('->');
        const [cr, cc] = a!.split(',').map(Number) as [number, number];
        const [tr, tc] = b!.split(',').map(Number) as [number, number];
        const hasCross =
          !!equationAt(equations, cr, cc)?.channels.some(
            (x) => x.toRow === tr && x.toCol === tc
          ) ||
          !!equationAt(equations, tr, tc)?.channels.some(
            (x) => x.toRow === cr && x.toCol === cc
          );
        if (hasCross) {
          return { ok: false, reason: `crossing diagonals at ${r},${c}` };
        }
      }
      let evalAnswer: number;
      try {
        evalAnswer = equationAnswer(eq);
      } catch {
        return { ok: false, reason: `bad expression at ${r},${c}` };
      }
      if (evalAnswer !== eq.answer) {
        return { ok: false, reason: `answer mismatch at ${r},${c}` };
      }
      for (const ch of eq.channels) {
        if (!isKingAdjacent({ row: r, col: c }, { row: ch.toRow, col: ch.toCol })) {
          return { ok: false, reason: `non-adjacent channel at ${r},${c}` };
        }
        if (ch.isCorrect && ch.value !== eq.answer) {
          return { ok: false, reason: `correct channel wrong value at ${r},${c}` };
        }
        if (!ch.isCorrect && ch.value === eq.answer) {
          return { ok: false, reason: `distractor equals answer at ${r},${c}` };
        }
        // The corridor is printed once, so the reverse channel must agree.
        const back = equationAt(equations, ch.toRow, ch.toCol)?.channels.find(
          (x) => x.toRow === r && x.toCol === c
        );
        if (back && back.value !== ch.value) {
          return { ok: false, reason: `corridor value mismatch ${r},${c} ↔ ${ch.toRow},${ch.toCol}` };
        }
      }
      const correctCount = eq.channels.filter((ch) => ch.isCorrect).length;
      if (correctCount > 1) return { ok: false, reason: `multiple correct channels at ${r},${c}` };
      if (eq.correctChannelId) {
        const cc = eq.channels.find((x) => x.id === eq.correctChannelId);
        if (!cc?.isCorrect) return { ok: false, reason: `correctChannelId invalid at ${r},${c}` };
      }
    }
  }

  for (let i = 0; i < solutionPath.length - 1; i++) {
    const a = solutionPath[i]!;
    const b = solutionPath[i + 1]!;
    if (!isKingAdjacent(a, b)) {
      return { ok: false, reason: `path step ${i} is not adjacent (incl. diagonal)` };
    }
    const eq = equationAt(equations, a.row, a.col)!;
    const ch = eq.channels.find((c) => c.toRow === b.row && c.toCol === b.col);
    if (!ch?.isCorrect || ch.value !== eq.answer) {
      return { ok: false, reason: `path step ${i} missing correct channel` };
    }
    if (eq.correctChannelId !== ch.id) {
      return { ok: false, reason: `correctChannelId mismatch at ${a.row},${a.col}` };
    }
  }
  const endEq = equationAt(equations, end.row, end.col);
  if (endEq?.correctChannelId != null) {
    return { ok: false, reason: 'end cell must not have outgoing correct channel' };
  }

  const pathCount = countMathMazeCorrectAnswerPaths(puzzle, 2);
  if (pathCount === 0) return { ok: false, reason: 'no correct-answer path from start to end' };
  if (pathCount > 1) return { ok: false, reason: 'multiple correct-answer paths to end' };

  return { ok: true };
}

export function mathMazeSignature(puzzle: MathMazePuzzle): string {
  const eqPart = puzzle.equations
    .map((row) =>
      row
        .map((eq) => {
          const ch = eq.channels
            .map((c) => `${c.toRow}${c.toCol}${c.value}${c.isCorrect ? 'C' : 'D'}`)
            .join(';');
          return `${eq.expression}=${eq.answer}[${ch}]`;
        })
        .join('|')
    )
    .join('/');
  const path = puzzle.solutionPath.map((p) => `${p.row},${p.col}`).join('>');
  return `mm${puzzle.rows}x${puzzle.columns}:S${puzzle.start.row},${puzzle.start.col}E${puzzle.end.row},${puzzle.end.col}:${path}:${eqPart}`;
}

export function estimateMathMazeDifficulty(puzzle: MathMazePuzzle): number {
  const cells = puzzle.rows * puzzle.columns;
  const pathLen = puzzle.solutionPath.length;
  let maxOps = 0;
  let divCount = 0;
  for (const row of puzzle.equations) {
    for (const eq of row) {
      maxOps = Math.max(maxOps, eq.operators.length);
      divCount += eq.operators.filter((o) => o === '/').length;
    }
  }
  return Math.round(pathLen * 1.2 + cells * 0.4 + maxOps * 3 + divCount * 2);
}

function sanitizeNonPathChannels(
  equations: MathMazeEquation[][],
  nextOnPath: Map<string, { row: number; col: number }>,
  rand: () => number,
  allowNegative: boolean
): void {
  for (let r = 0; r < equations.length; r++) {
    for (let c = 0; c < equations[r]!.length; c++) {
      const eq = equations[r]![c]!;
      const next = nextOnPath.get(cellKey(r, c));
      const used = new Set<number>([eq.answer]);
      for (const ch of eq.channels) {
        const isPathEdge =
          !!next && ch.toRow === next.row && ch.toCol === next.col && ch.isCorrect;
        if (isPathEdge) continue;
        if (ch.value === eq.answer) {
          ch.value = plausibleWrongAnswer(eq.answer, rand, used, allowNegative);
          ch.isCorrect = false;
        }
        used.add(ch.value);
      }
    }
  }
}

/**
 * One printed number per corridor: both directions of an edge must carry the
 * same value, and that value may only equal an endpoint's answer when the
 * channel leaving that endpoint is the solution step. Returns false when the
 * two endpoint equations share the same answer across a path edge (retry).
 */
function unifyEdgeValues(
  equations: MathMazeEquation[][],
  rand: () => number,
  allowNegative: boolean
): boolean {
  const rows = equations.length;
  const cols = equations[0]?.length ?? 0;
  const usedBy = new Map<string, Set<number>>();
  const usedSet = (eq: MathMazeEquation) => {
    const key = cellKey(eq.row, eq.col);
    let s = usedBy.get(key);
    if (!s) {
      s = new Set<number>([eq.answer]);
      usedBy.set(key, s);
    }
    return s;
  };
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const a = equations[r]![c]!;
      for (const chA of a.channels) {
        const b = equations[chA.toRow]?.[chA.toCol];
        if (!b) continue;
        // Only handle each undirected edge once (from the lower key side)
        if (b.row < a.row || (b.row === a.row && b.col < a.col)) continue;
        const chB = b.channels.find((x) => x.toRow === a.row && x.toCol === a.col) ?? null;
        const bHasEquation = b.expression.trim() !== '';
        if (chA.isCorrect) {
          if (bHasEquation && b.answer === a.answer) return false;
          if (chB) {
            chB.value = a.answer;
            chB.isCorrect = false;
          }
          usedSet(a).add(a.answer);
          if (bHasEquation) usedSet(b).add(a.answer);
          continue;
        }
        if (chB?.isCorrect) {
          if (a.answer === b.answer) return false;
          chA.value = b.answer;
          chA.isCorrect = false;
          usedSet(a).add(b.answer);
          usedSet(b).add(b.answer);
          continue;
        }
        // Distractor on both sides: pick one value foreign to both answers
        const used = new Set<number>([...usedSet(a), ...(bHasEquation ? usedSet(b) : [])]);
        used.add(a.answer);
        if (bHasEquation) used.add(b.answer);
        let v = chA.value;
        if (!Number.isInteger(v) || v === a.answer || (bHasEquation && v === b.answer) ||
            (!allowNegative && v < 0)) {
          v = plausibleWrongAnswer(a.answer, rand, used, allowNegative);
        }
        chA.value = v;
        chA.isCorrect = false;
        if (chB) {
          chB.value = v;
          chB.isCorrect = false;
        }
        usedSet(a).add(v);
        if (bHasEquation) usedSet(b).add(v);
      }
    }
  }
  return true;
}

export function generateMathMaze(options: MathMazeGenerateOptions = {}): MathMazePuzzle {
  const columns = clampInt(options.equationsAcross, 2, 12, 4);
  const rows = clampInt(options.equationsDown, 2, 15, 5);
  const seed = (options.seed ?? Date.now()) >>> 0;
  const operations: MathMazeOperations = {
    add: options.operations?.add !== false,
    sub: options.operations?.sub !== false,
    mul: options.operations?.mul !== false,
    div: options.operations?.div !== false,
  };
  const eqOpts = {
    numbersPerEquation: (clampInt(options.numbersPerEquation, 2, 4, 2) as 2 | 3 | 4) || 2,
    maxDigits: clampInt(options.maxDigits, 1, 4, 2),
    maxDividendDigits: clampInt(options.maxDividendDigits, 1, 6, 3),
    maxDivisorDigits: clampInt(options.maxDivisorDigits, 1, 4, 1),
    maxAnswerDigits: clampInt(options.maxAnswerDigits, 1, 6, 3),
    ops: operations,
    allowNegative: options.allowNegative === true,
    useParentheses: options.useParentheses === true,
    parenthesesMode: (options.parenthesesMode === 'all' ? 'all' : 'random') as MathMazeParenthesesMode,
  };
  const startText = options.startText?.trim() || 'Start';
  const endText = options.endText?.trim() || 'End';
  const difficulty = options.difficulty;

  let lastReason = 'unknown';
  for (let attempt = 0; attempt < 64; attempt++) {
    if (options.signal?.cancelled) throw new Error('Math Maze generation cancelled.');
    const rand = mulberry32((seed + attempt * 104729) >>> 0);
    const pathResult = generatePath(rows, columns, rand);
    if (!pathResult) {
      lastReason = 'path generation failed';
      continue;
    }
    const { path, start, end } = pathResult;
    const nextOnPath = new Map<string, { row: number; col: number }>();
    const prevOnPath = new Map<string, { row: number; col: number }>();
    const occupiedEdges = new Set<string>();
    for (let i = 0; i < path.length - 1; i++) {
      nextOnPath.set(cellKey(path[i]!.row, path[i]!.col), path[i + 1]!);
      prevOnPath.set(cellKey(path[i + 1]!.row, path[i + 1]!.col), path[i]!);
      occupiedEdges.add(undirectedEdgeKey(path[i]!, path[i + 1]!));
    }

    const equations: MathMazeEquation[][] = [];
    let failed = false;
    for (let r = 0; r < rows; r++) {
      const row: MathMazeEquation[] = [];
      for (let c = 0; c < columns; c++) {
        const id = `eq-${r}-${c}`;
        const isEndCell = r === end.row && c === end.col;

        if (isEndCell) {
          row.push({
            id,
            row: r,
            col: c,
            expression: '',
            answer: 0,
            operands: [],
            operators: [],
            channels: [],
            correctChannelId: null,
          });
          continue;
        }

        const next = nextOnPath.get(cellKey(r, c));
        const prev = prevOnPath.get(cellKey(r, c));
        // A route step is printed once per corridor, so the two equations it
        // joins must not share an answer (otherwise the step would read as
        // correct from both sides).
        const forbidden = new Set<number>();
        const prevEq = prev ? equations[prev.row]?.[prev.col] : undefined;
        if (prevEq && prevEq.expression) forbidden.add(prevEq.answer);
        const nextEq = next ? equations[next.row]?.[next.col] : undefined;
        if (nextEq && nextEq.expression) forbidden.add(nextEq.answer);
        let made: ReturnType<typeof makeEquation> = null;
        for (let t = 0; t < 24; t++) {
          const candidate = makeEquation(rand, eqOpts);
          if (!candidate) break;
          made = candidate;
          if (!forbidden.has(candidate.answer)) break;
          made = null;
        }
        if (!made) {
          failed = true;
          break;
        }
        const nbrs = kingNeighbors(r, c, rows, columns);
        const channels: MathMazeChannel[] = [];
        let correctChannelId: string | null = null;
        const used = new Set<number>([made.answer]);

        // Orthogonal neighbors always; diagonals only when they do not form an X
        // with another diagonal already chosen (one clean diagonal per 2×2).
        for (const n of nbrs) {
          const isNext = !!next && n.row === next.row && n.col === next.col;
          const key = undirectedEdgeKey({ row: r, col: c }, n);
          if (n.diagonal && !isNext) {
            const cross = crossingDiagonalEdgeKey({ row: r, col: c }, n);
            if (cross && occupiedEdges.has(cross)) continue;
          }
          const chId = `ch-${r}-${c}-to-${n.row}-${n.col}`;
          if (isNext) {
            channels.push({
              id: chId,
              toRow: n.row,
              toCol: n.col,
              value: made.answer,
              isCorrect: true,
            });
            correctChannelId = chId;
            occupiedEdges.add(key);
            continue;
          }
          const wrong = plausibleWrongAnswer(made.answer, rand, used, eqOpts.allowNegative);
          used.add(wrong);
          occupiedEdges.add(key);
          channels.push({
            id: chId,
            toRow: n.row,
            toCol: n.col,
            value: wrong,
            isCorrect: false,
          });
        }

        shuffleInPlace(channels, rand);
        row.push({
          id,
          row: r,
          col: c,
          expression: made.expression,
          answer: made.answer,
          operands: made.operands,
          operators: made.operators,
          channels,
          correctChannelId,
        });
      }
      if (failed) break;
      equations.push(row);
    }
    if (failed) {
      lastReason = 'equation generation failed';
      continue;
    }

    sanitizeNonPathChannels(equations, nextOnPath, rand, eqOpts.allowNegative);
    if (!unifyEdgeValues(equations, rand, eqOpts.allowNegative)) {
      lastReason = 'adjacent equations share an answer on the route';
      continue;
    }

    const puzzle: MathMazePuzzle = {
      type: 'math-maze',
      id: `math-maze-${seed}-${attempt}`,
      rows,
      columns,
      equations,
      start,
      end,
      solutionPath: path,
      startText,
      endText,
      difficulty,
      puzzleNumber: 1,
      metadata: {
        seed: seed + attempt,
        pathLength: path.length,
        createdAt: new Date().toISOString(),
      },
    };
    puzzle.metadata!.difficultyScore = estimateMathMazeDifficulty(puzzle);

    const check = validateMathMaze(puzzle);
    if (!check.ok) {
      lastReason = check.reason;
      continue;
    }
    return puzzle;
  }

  throw new Error(
    `Unable to generate a valid ${rows}×${columns} Math Maze puzzle (${lastReason}).`
  );
}
