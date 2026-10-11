import assert from 'node:assert/strict';
import {
  buildPageVariableElements,
  createPageVariableField,
  movePageVariable,
  normalizePageVariables,
  pageVariableContentIndex,
  resizePageVariable,
  setPageVariableTextAt,
} from './page-variables';

export function runPageVariableChecks(): void {
  assert.equal(pageVariableContentIndex(0, 1), 0);
  assert.equal(pageVariableContentIndex(3, 2), 1);

  const text = createPageVariableField('text', 50, 20);
  text.textLines = ['Hello page 1', 'Hello page 2'];
  const image = createPageVariableField('image', 20, 70);
  image.imageHrefs = ['data:image/png;base64,aaa', 'data:image/png;base64,bbb'];
  const pageNo = createPageVariableField('pagination', 50, 94);
  const puzzleNo = createPageVariableField('puzzle-number', 10, 10);

  const normalized = normalizePageVariables([text, image, pageNo, puzzleNo, { kind: 'nope' }]);
  assert.equal(normalized.length, 4);

  const page1 = buildPageVariableElements({
    fields: normalized,
    pageWidthPt: 612,
    pageHeightPt: 792,
    contentIndex: 0,
    bookPageNumber: 3,
    puzzleNumber: 7,
  });
  const texts = page1.filter((el) => el.kind === 'text');
  const images = page1.filter((el) => el.kind === 'image');
  assert.ok(texts.some((el) => el.kind === 'text' && el.text === 'Hello page 1'));
  assert.ok(texts.some((el) => el.kind === 'text' && el.text === '3'));
  assert.ok(texts.some((el) => el.kind === 'text' && el.text === '7'));
  assert.equal(images.length, 1);
  assert.equal(images[0].kind === 'image' ? images[0].href : '', 'data:image/png;base64,aaa');

  const page2 = buildPageVariableElements({
    fields: normalized,
    pageWidthPt: 612,
    pageHeightPt: 792,
    contentIndex: 1,
    bookPageNumber: 4,
    puzzleNumber: 8,
  });
  assert.ok(page2.some((el) => el.kind === 'text' && el.text === 'Hello page 2'));
  assert.ok(page2.some((el) => el.kind === 'image' && el.href === 'data:image/png;base64,bbb'));

  const empty = buildPageVariableElements({
    fields: [{ ...text, textLines: [] }],
    pageWidthPt: 612,
    pageHeightPt: 792,
    contentIndex: 0,
    bookPageNumber: 1,
    puzzleNumber: 1,
  });
  assert.equal(empty.filter((el) => el.kind === 'text').length, 0);

  const placeholder = buildPageVariableElements({
    fields: [{ ...text, textLines: [] }],
    pageWidthPt: 612,
    pageHeightPt: 792,
    contentIndex: 0,
    bookPageNumber: 1,
    puzzleNumber: 1,
    placeholder: true,
  });
  assert.ok(placeholder.some((el) => el.kind === 'text' && el.text === 'Text'));

  const moved = movePageVariable(text, 80, 80);
  assert.ok(moved.xPercent <= 100 - moved.widthPercent);
  const resized = resizePageVariable(text, 8, 6);
  assert.equal(resized.widthPercent, 8);

  const flipped = buildPageVariableElements({
    fields: [{ ...image, rotationDeg: 90, flipH: true }],
    pageWidthPt: 612,
    pageHeightPt: 792,
    contentIndex: 0,
    bookPageNumber: 1,
    puzzleNumber: 1,
  });
  const drawn = flipped.find((el) => el.kind === 'image');
  assert.ok(drawn && drawn.kind === 'image');
  assert.equal(drawn.rotationDeg, 90);
  assert.equal(drawn.flipH, true);

  const numbered = buildPageVariableElements({
    fields: [
      {
        ...text,
        textLines: ['Forest', 'Ocean'],
        textForm: 'text-hash-number',
        startNumber: 5,
      },
    ],
    pageWidthPt: 612,
    pageHeightPt: 792,
    contentIndex: 1,
    bookPageNumber: 2,
    puzzleNumber: 2,
  });
  assert.ok(numbered.some((el) => el.kind === 'text' && el.text === 'Ocean #6'));

  const prefix = buildPageVariableElements({
    fields: [{ ...text, textLines: ['Forest'], textForm: 'number-dot-text', startNumber: 1 }],
    pageWidthPt: 612,
    pageHeightPt: 792,
    contentIndex: 0,
    bookPageNumber: 1,
    puzzleNumber: 1,
  });
  assert.ok(prefix.some((el) => el.kind === 'text' && el.text === '1. Forest'));

  const numberOnly = buildPageVariableElements({
    fields: [{ ...text, textLines: [], textForm: 'number', startNumber: 3 }],
    pageWidthPt: 612,
    pageHeightPt: 792,
    contentIndex: 2,
    bookPageNumber: 1,
    puzzleNumber: 1,
  });
  assert.ok(numberOnly.some((el) => el.kind === 'text' && el.text === '5'));

  const shape = createPageVariableField('shape', 40, 40, {
    shapeType: 'hexagon',
    fill: '#fef3c7',
    stroke: '#b45309',
    strokeWidth: 2,
    textLines: ['On shape'],
    textEffect: 'extrude',
  });
  const shaped = buildPageVariableElements({
    fields: [shape],
    pageWidthPt: 612,
    pageHeightPt: 792,
    contentIndex: 0,
    bookPageNumber: 1,
    puzzleNumber: 1,
  });
  const drawnShape = shaped.find((el) => el.kind === 'shape');
  assert.ok(drawnShape && drawnShape.kind === 'shape');
  assert.equal(drawnShape.shape, 'hexagon');
  assert.equal(drawnShape.fill, '#fef3c7');
  const shapeText = shaped.find((el) => el.kind === 'text');
  assert.ok(shapeText && shapeText.kind === 'text');
  assert.equal(shapeText.text, 'On shape');
  assert.equal(shapeText.effect, 'extrude');

  const emptyShape = createPageVariableField('shape', 40, 40, { shapeType: 'roundRect' });
  const emptyShaped = buildPageVariableElements({
    fields: [emptyShape],
    pageWidthPt: 612,
    pageHeightPt: 792,
    contentIndex: 0,
    bookPageNumber: 1,
    puzzleNumber: 1,
    placeholder: true,
  });
  assert.ok(emptyShaped.some((el) => el.kind === 'shape'));
  assert.equal(
    emptyShaped.filter((el) => el.kind === 'text').length,
    0,
    'empty shapes must not show placeholder Text'
  );

  const onlyHere = createPageVariableField('text', 50, 50, {
    scope: 'single',
    pageIndex: 1,
    textLines: ['Only page 2'],
  });
  const onPage1 = buildPageVariableElements({
    fields: [onlyHere],
    pageWidthPt: 612,
    pageHeightPt: 792,
    contentIndex: 0,
    bookPageNumber: 1,
    puzzleNumber: 1,
  });
  assert.equal(onPage1.length, 0);
  const onPage2 = buildPageVariableElements({
    fields: [onlyHere],
    pageWidthPt: 612,
    pageHeightPt: 792,
    contentIndex: 1,
    bookPageNumber: 2,
    puzzleNumber: 2,
  });
  assert.ok(onPage2.some((el) => el.kind === 'text' && el.text === 'Only page 2'));

  const live = createPageVariableField('text', 40, 40, {
    scope: 'single',
    pageIndex: 0,
    textLines: ['Typing'],
  });
  const hidden = buildPageVariableElements({
    fields: [live],
    pageWidthPt: 612,
    pageHeightPt: 792,
    contentIndex: 0,
    bookPageNumber: 1,
    puzzleNumber: 1,
    skipTextFieldId: live.id,
  });
  assert.equal(hidden.filter((el) => el.kind === 'text').length, 0);
  const lines = setPageVariableTextAt(live, 0, 'Hello');
  assert.equal(lines[0], 'Hello');
}

runPageVariableChecks();
console.log('page-variables.selftest: OK');
