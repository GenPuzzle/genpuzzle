/**
 * Regression: Welcome Open and File → Open share one import path;
 * session records restore puzzles/tabs without regenerating.
 */
import assert from 'node:assert/strict';
import {
  parseGpProjectJson,
  serializeGpProject,
  type GpProjectFile,
} from './project-file';
import { openProjectFromFile } from './open-project';
import {
  createSessionRecord,
  projectFromSessionRecord,
} from './session-persistence';

function sampleProject(): GpProjectFile {
  return {
    format: 'genpuzzle-project',
    formatVersion: 1,
    savedAt: '2026-01-01T00:00:00.000Z',
    projectName: 'Recovery Book',
    settings: {
      version: 1,
      currentPuzzleType: 'word-search',
      documentPages: [
        {
          id: 'doc-1',
          name: 'Word Search 1',
          moduleType: 'word-search',
          settings: {},
        },
      ],
      activeDocumentPageId: 'doc-1',
    } as GpProjectFile['settings'],
    batchPuzzles: [
      {
        type: 'word-search',
        grid: [
          ['C', 'A', 'T'],
          ['D', 'O', 'G'],
          ['B', 'A', 'T'],
        ],
        placements: [],
        words: ['CAT'],
        displayWords: ['CAT'],
        solution: {},
        pageName: 'Puzzle 1',
        pageId: 'doc-1',
      } as unknown as GpProjectFile['batchPuzzles'][number],
    ],
    crosswordBatchPuzzles: [],
    genericBatchPuzzles: [
      {
        id: 'sudoku-1',
        type: 'sudoku',
        grid: [
          [1, 2],
          [3, 4],
        ],
        solution: [
          [1, 2],
          [3, 4],
        ],
      } as unknown as NonNullable<GpProjectFile['genericBatchPuzzles']>[number],
    ],
    murdokuBatchPuzzles: [],
    currentPuzzle: null,
    currentBatchIndex: 0,
  };
}

async function testSharedOpenPathAppliesSnapshot(): Promise<void> {
  const project = sampleProject();
  const file = new File([serializeGpProject(project)], 'recovery.gp', {
    type: 'application/x-genpuzzle+json',
  });

  let applied: GpProjectFile | null = null;
  const loaded = await openProjectFromFile(file, (snapshot) => {
    applied = snapshot;
  });

  assert.equal(loaded.projectName, 'Recovery Book');
  assert.ok(applied, 'loadProjectSnapshot must be called');
  assert.equal(applied!.batchPuzzles.length, 1);
  assert.equal(applied!.genericBatchPuzzles?.length, 1);
  assert.equal(applied!.settings.documentPages?.length, 1);
  assert.equal(applied!.batchPuzzles[0].pageName, 'Puzzle 1');
}

function testSessionRoundTripRestoresPuzzlesWithoutRegenerate(): void {
  const project = sampleProject();
  const record = createSessionRecord(project, '2026-03-01T12:00:00.000Z');
  const restored = projectFromSessionRecord(record);
  assert.ok(restored, 'session record must decode');
  assert.equal(restored!.projectName, 'Recovery Book');
  assert.equal(restored!.batchPuzzles.length, 1);
  assert.equal(restored!.genericBatchPuzzles?.length, 1);
  assert.deepEqual(restored!.batchPuzzles[0].grid, [
    ['C', 'A', 'T'],
    ['D', 'O', 'G'],
    ['B', 'A', 'T'],
  ]);
  assert.equal(restored!.settings.activeDocumentPageId, 'doc-1');
  assert.equal(restored!.settings.documentPages?.[0]?.name, 'Word Search 1');
}

function testInvalidSessionRejected(): void {
  assert.equal(projectFromSessionRecord(null), null);
  assert.equal(projectFromSessionRecord({ version: 1, project: { format: 'nope' } }), null);
}

function testParseSerializeKeepsBatches(): void {
  const project = sampleProject();
  const again = parseGpProjectJson(serializeGpProject(project));
  assert.equal(again.batchPuzzles.length, 1);
  assert.equal(again.genericBatchPuzzles?.length, 1);
  assert.equal(again.settings.documentPages?.length, 1);
}

async function main() {
  await testSharedOpenPathAppliesSnapshot();
  testSessionRoundTripRestoresPuzzlesWithoutRegenerate();
  testInvalidSessionRejected();
  testParseSerializeKeepsBatches();
  console.log('open-project.selftest: OK');
}

void main();
