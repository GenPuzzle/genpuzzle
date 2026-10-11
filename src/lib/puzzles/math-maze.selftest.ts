import assert from 'node:assert/strict';
import {
  countMathMazeCorrectAnswerPaths,
  generateMathMaze,
  validateMathMaze,
} from './math-maze';
import { buildMathMazeElementParts } from '../resolved-layout/math-maze-elements';
import { getDefaultGenericPuzzleSettings } from '../generic-puzzle-settings';

function hasDiagonalStep(
  path: Array<{ row: number; col: number }>
): boolean {
  for (let i = 0; i < path.length - 1; i++) {
    const a = path[i]!;
    const b = path[i + 1]!;
    if (Math.abs(a.row - b.row) === 1 && Math.abs(a.col - b.col) === 1) return true;
  }
  return false;
}

function countDiagonalChannels(puzzle: ReturnType<typeof generateMathMaze>): number {
  let n = 0;
  for (const row of puzzle.equations) {
    for (const eq of row) {
      for (const ch of eq.channels) {
        if (
          Math.abs(eq.row - ch.toRow) === 1 &&
          Math.abs(eq.col - ch.toCol) === 1
        ) {
          n += 1;
        }
      }
    }
  }
  return n;
}

function assertNoCrossingDiagonals(puzzle: ReturnType<typeof generateMathMaze>): void {
  function undirected(
    r: number,
    c: number,
    tr: number,
    tc: number
  ): string {
    if (r < tr || (r === tr && c <= tc)) return `${r},${c}->${tr},${tc}`;
    return `${tr},${tc}->${r},${c}`;
  }
  const edges = new Set<string>();
  for (const row of puzzle.equations) {
    for (const eq of row) {
      for (const ch of eq.channels) {
        edges.add(undirected(eq.row, eq.col, ch.toRow, ch.toCol));
      }
    }
  }
  for (const key of edges) {
    const [left, right] = key.split('->');
    const [r, c] = left!.split(',').map(Number) as [number, number];
    const [tr, tc] = right!.split(',').map(Number) as [number, number];
    if (Math.abs(r - tr) !== 1 || Math.abs(c - tc) !== 1) continue;
    const dc = tc - c;
    const cross = undirected(r, c + dc, tr, tc - dc);
    assert.equal(edges.has(cross), false, `crossing diagonals ${key} x ${cross}`);
  }
}

function assertOrthogonalLinks(puzzle: ReturnType<typeof generateMathMaze>): void {
  for (let r = 0; r < puzzle.rows; r++) {
    for (let c = 0; c < puzzle.columns; c++) {
      if (r === puzzle.end.row && c === puzzle.end.col) continue;
      const eq = puzzle.equations[r]![c]!;
      for (const [dr, dc] of [
        [-1, 0],
        [1, 0],
        [0, -1],
        [0, 1],
      ] as const) {
        const rr = r + dr;
        const cc = c + dc;
        if (rr < 0 || cc < 0 || rr >= puzzle.rows || cc >= puzzle.columns) continue;
        assert.ok(
          eq.channels.some((ch) => ch.toRow === rr && ch.toCol === cc),
          `missing orthogonal ${r},${c} → ${rr},${cc}`
        );
      }
    }
  }
}

const puzzle = generateMathMaze({
  equationsAcross: 4,
  equationsDown: 5,
  operations: { add: true, sub: true, mul: false, div: false },
  seed: 42,
});
const check = validateMathMaze(puzzle);
assert.equal(check.ok, true, check.ok ? '' : check.reason);
assert.equal(countMathMazeCorrectAnswerPaths(puzzle, 3), 1, 'unique Start→End route');

const endEq = puzzle.equations[puzzle.end.row]![puzzle.end.col]!;
assert.equal(endEq.expression, '', 'End cell has no equation');
assert.equal(endEq.channels.length, 0, 'End cell has no outgoing channels');

const startEq = puzzle.equations[puzzle.start.row]![puzzle.start.col]!;
assert.ok(startEq.expression.trim().length > 0, 'Start cell has equation');

assert.ok(countDiagonalChannels(puzzle) > 0, 'maze includes diagonal channels');
assert.ok(hasDiagonalStep(puzzle.solutionPath), 'solution path includes a diagonal step');
assertOrthogonalLinks(puzzle);
assertNoCrossingDiagonals(puzzle);

const gp = getDefaultGenericPuzzleSettings('math-maze');
gp.typography.mathMazeEquationFontFamily = 'Georgia';
gp.typography.mathMazeEquationFontSize = 14;
gp.typography.mathMazeChannelFontFamily = 'Courier New';
gp.typography.mathMazeChannelFontSize = 10;
gp.typography.mathMazeStartEndFontFamily = 'Verdana';

const parts = buildMathMazeElementParts({
  puzzle,
  slot: { leftPt: 0, topPt: 0, widthPt: 400, heightPt: 520 },
  gp,
  showSolution: true,
  preferredCellPt: 40,
});
const texts = parts.elements.filter((el) => el.kind === 'text');
assert.ok(texts.some((t) => t.text === 'Start'), 'renders Start inside first box');
assert.ok(texts.some((t) => t.text === 'End'), 'renders End inside final box');
assert.ok(
  parts.elements.some((el) => el.kind === 'rect' && (el.radius ?? 0) > 0),
  'rounded equation boxes'
);
assert.ok(
  texts.some(
    (el) =>
      el.fontFamily === 'Georgia' &&
      (el.text.includes('+') || el.text.includes('-') || el.text.includes('×'))
  ),
  'equation font family applied'
);
assert.ok(
  texts.some((el) => el.fontFamily === 'Courier New' && /^\d+$/.test(el.text)),
  'channel number font family applied'
);
assert.ok(
  texts.some((el) => el.fontFamily === 'Verdana' && (el.text === 'Start' || el.text === 'End')),
  'start/end font family applied'
);
assert.ok(
  texts.some((el) => typeof el.rotationDeg === 'number' && el.rotationDeg !== 0),
  'rotated mid-path answer numbers'
);
assert.ok(
  parts.elements.filter((el) => el.kind === 'polygon').length >= 8,
  'continuous equation-to-equation path corridors'
);
assert.ok(
  parts.elements.some(
    (el) =>
      el.kind === 'polygon' &&
      (el.fill === gp.core.mathMazeSolutionCellFill || el.fill === '#e5e7eb')
  ),
  'solution fills path-number corridors grey'
);

console.log('math-maze.selftest: OK', {
  path: puzzle.solutionPath.length,
  diagonalChannels: countDiagonalChannels(puzzle),
  pathHasDiagonal: hasDiagonalStep(puzzle.solutionPath),
  start: puzzle.start,
  end: puzzle.end,
  elements: parts.elements.length,
});
