import assert from 'node:assert/strict';
import {
  findPlatformSetting,
  listPlatformSettings,
  normalizePlatformCategory,
  PLATFORM_CATEGORY_TAB,
} from './platform-settings-registry';
import {
  buildPlatformSettingUpdate,
  buildPlatformSettingsSnapshot,
  type PlatformSettingsSource,
} from './platform-settings';
import { getDefaultWordSearchSettings } from '@/lib/puzzles/types';
import { mergeWordSearchSettingsUpdate } from '@/lib/visual-settings-sync';

assert.equal(normalizePlatformCategory('grid'), 'puzzle');
assert.equal(normalizePlatformCategory('Trim'), 'trim');
assert.equal(PLATFORM_CATEGORY_TAB.puzzle.tab, 'puzzle');
assert.ok(listPlatformSettings(['puzzle']).some((d) => d.name === 'lettersAcross'));
assert.ok(findPlatformSetting('titles', 'puzzleTitleFontSize'));

const source: PlatformSettingsSource = {
  wordSearchSettings: getDefaultWordSearchSettings(),
  titleWords: { title: 'Test', fontFamily: 'Arial', fontSize: 24, words: ['SEA', 'OCEAN'] },
  bookSettings: {
    trimSize: '8.5x11',
    includeBleed: false,
    includeSolution: true,
    puzzlesPerPage: 1,
    mixPuzzles: false,
    chapterTopics: ['One', 'Two'],
  },
  pageMargin: 40,
  puzzleGridScale: 70,
};

const snap = buildPlatformSettingsSnapshot(source, ['puzzle', 'trim']);
assert.equal(typeof snap.puzzle.lettersAcross, 'number');
assert.ok(snap.trim.trimSizePreset);

const up = buildPlatformSettingUpdate(source, 'puzzle', 'lettersAcross', 22);
assert.equal(up.ok, true);
if (up.ok) {
  assert.equal(up.patch.wordSearch?.core?.lettersAcross, 22);
  assert.equal(up.patch.tab, 'puzzle');
  // Partial core patch — must not re-emit untouched fields from a stale snapshot.
  assert.equal(Object.keys(up.patch.wordSearch?.core ?? {}).length, 1);
}

const thin = buildPlatformSettingUpdate(source, 'puzzle', 'borderStrokeThickness', 1);
assert.equal(thin.ok, true);

const title = buildPlatformSettingUpdate(source, 'titles', 'puzzleTitleFontSize', 20);
assert.equal(title.ok, true);

const cols = buildPlatformSettingUpdate(source, 'words', 'wordListColumns', 3);
assert.equal(cols.ok, true);
if (cols.ok) {
  assert.equal(cols.patch.wordSearch?.wordList?.wordListColumns, 3);
}

const gridFont = buildPlatformSettingUpdate(source, 'titles', 'puzzleGridFontSize', 20);
assert.equal(gridFont.ok, true);
if (gridFont.ok) {
  assert.equal(gridFont.patch.wordSearch?.typography?.puzzleGridFontSize, 20);
}

const titleGap = buildPlatformSettingUpdate(source, 'titles', 'subtitleToTitleGap', 28);
assert.equal(titleGap.ok, true);

const bad = buildPlatformSettingUpdate(source, 'puzzle', 'notARealSetting', 1);
assert.equal(bad.ok, false);

// Sequential AI-style updates must compose without wiping earlier fields.
let live = source.wordSearchSettings;
const a = buildPlatformSettingUpdate({ ...source, wordSearchSettings: live }, 'puzzle', 'lettersAcross', 20);
assert.equal(a.ok, true);
if (a.ok && a.patch.wordSearch) {
  live = mergeWordSearchSettingsUpdate(live, a.patch.wordSearch);
}
const b = buildPlatformSettingUpdate({ ...source, wordSearchSettings: live }, 'puzzle', 'lettersDown', 20);
assert.equal(b.ok, true);
if (b.ok && b.patch.wordSearch) {
  live = mergeWordSearchSettingsUpdate(live, b.patch.wordSearch);
}
const c = buildPlatformSettingUpdate(
  { ...source, wordSearchSettings: live },
  'puzzle',
  'borderStrokeThickness',
  1
);
assert.equal(c.ok, true);
if (c.ok && c.patch.wordSearch) {
  live = mergeWordSearchSettingsUpdate(live, c.patch.wordSearch);
}
assert.equal(live.core.lettersAcross, 20);
assert.equal(live.core.lettersDown, 20);
assert.equal(live.core.borderStrokeThickness, 1);

console.log('platform-settings.selftest: OK', {
  puzzleKeys: Object.keys(snap.puzzle).length,
  catalog: listPlatformSettings().length,
});
