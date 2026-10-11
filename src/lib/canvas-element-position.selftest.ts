import assert from 'node:assert/strict';
import {
  centerCanvasOffsetHorizontal,
  centerCanvasOffsetVertical,
  formatTargetToOffsetKey,
  nudgeCanvasOffset,
  patchCanvasOffset,
  readCanvasOffset,
} from './canvas-element-position';

assert.equal(formatTargetToOffsetKey('grid'), 'grid');
assert.equal(formatTargetToOffsetKey('word-list'), 'word-list');
assert.equal(formatTargetToOffsetKey('title'), 'title');
assert.equal(formatTargetToOffsetKey('clues'), 'clues');

let offsets = nudgeCanvasOffset({}, 'grid', 12, -8);
assert.equal(readCanvasOffset(offsets, 'grid').offsetXPt, 12);
assert.equal(readCanvasOffset(offsets, 'grid').offsetYPt, -8);

offsets = centerCanvasOffsetHorizontal(offsets, 'grid');
assert.equal(readCanvasOffset(offsets, 'grid').offsetXPt, 0);
assert.equal(readCanvasOffset(offsets, 'grid').offsetYPt, -8);

offsets = centerCanvasOffsetVertical(offsets, 'grid', {
  naturalTopPt: 100,
  heightPt: 200,
  pageHeightPt: 792,
  marginPt: 40,
});
const centered = readCanvasOffset(offsets, 'grid');
// usable = 792 - 80 = 712; centeredTop = 40 + (712-200)/2 = 296; offsetY = 296 - 100 = 196
assert.equal(centered.offsetYPt, 196);

offsets = patchCanvasOffset(offsets, 'grid', { offsetXPt: 0, offsetYPt: 0 });
assert.equal(offsets.grid, undefined);

console.log('canvas-element-position.selftest: OK');
