/**
 * Layout / puzzle consistency self-tests (used by npm run check:layout).
 */
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const tests = [
  'src/lib/resolved-layout/consistency.selftest.ts',
  'src/lib/unicode-text.selftest.ts',
  'src/lib/puzzles/codewords.selftest.ts',
  'src/lib/puzzles/binairo.selftest.ts',
  'src/lib/puzzles/kakuro.selftest.ts',
  'src/lib/puzzles/math-maze.selftest.ts',
  'src/lib/puzzles/fill-snake.selftest.ts',
  'src/lib/puzzles/sudoku-x.selftest.ts',
  'src/lib/puzzles/sudoku-greater-than.selftest.ts',
  'src/lib/page-variables.selftest.ts',
  'src/lib/ai/ai-agent.selftest.ts',
  'src/lib/ai/ai-copilot-structure.selftest.ts',
  'src/lib/ai/platform-settings.selftest.ts',
  'src/lib/ai/content-pack.selftest.ts',
  'src/lib/open-project.selftest.ts',
];

for (const rel of tests) {
  const result = spawnSync('npx', ['tsx', rel], {
    cwd: root,
    stdio: 'inherit',
    shell: true,
  });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

console.log('check:layout OK');
