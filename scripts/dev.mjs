/**
 * Stable local dev server for GenPuzzle.
 * - Always runs from genpuzzle/ (fixes wrong workspace root on Windows)
 * - Clears .next before start (prevents corrupted manifest 500 errors)
 * - Uses webpack dev by default (Turbopack is opt-in via --turbo)
 */
import { rmSync, existsSync } from 'node:fs';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const nextDir = path.join(projectRoot, '.next');

if (existsSync(nextDir)) {
  console.log('[dev] Clearing .next cache…');
  rmSync(nextDir, { recursive: true, force: true });
}

const useTurbo = process.argv.includes('--turbo');
const port = process.env.PORT || '3000';

if (useTurbo) {
  console.log('[dev] Using Turbopack (if you see 500 errors, run without --turbo)');
} else {
  console.log('[dev] Using webpack dev server (stable on Windows)');
}

console.log(`[dev] Starting on http://localhost:${port}`);

const nextBin = path.join(projectRoot, 'node_modules', 'next', 'dist', 'bin', 'next');
if (!existsSync(nextBin)) {
  console.error('[dev] Next.js not found. Run: npm install');
  process.exit(1);
}

const nodeArgs = [nextBin, 'dev', '-p', port];
if (useTurbo) {
  nodeArgs.push('--turbopack');
}

const child = spawn(process.execPath, nodeArgs, {
  cwd: projectRoot,
  stdio: 'inherit',
  env: { ...process.env, FORCE_COLOR: '1' },
  windowsHide: true,
});

child.on('exit', (code) => process.exit(code ?? 0));

process.on('SIGINT', () => child.kill('SIGINT'));
process.on('SIGTERM', () => child.kill('SIGTERM'));
