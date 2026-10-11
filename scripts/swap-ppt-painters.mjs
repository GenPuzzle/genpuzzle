import fs from 'fs';

const p = 'src/lib/generic-puzzle-ppt-draw.ts';
let s = fs.readFileSync(p, 'utf8');

function replaceFn(name, nextName, body) {
  const start = s.indexOf('function ' + name + '(');
  const end = s.indexOf(nextName, start + 10);
  if (start < 0 || end < 0 || end < start) throw new Error(name + ' ' + start + ' ' + end);
  s = s.slice(0, start) + body + '\n\n' + s.slice(end);
}

const slotPt = `const slotPt: RectPt = {
    leftPt: slot.x * 72,
    topPt: slot.y * 72,
    widthPt: slot.w * 72,
    heightPt: slot.h * 72,
  };`;

replaceFn(
  'drawCrossword',
  'function scrambleWords(',
  `function drawCrossword(
  slide: PptSlide,
  puzzle: CrosswordPuzzle,
  slot: RectIn,
  cw: CrosswordSettings,
  showSolution: boolean,
  preferredCellPt: number,
  pageNumberZoneTopPt: number,
  clueGapPt: number
): void {
  ${slotPt}
  renderResolvedPpt(
    slide,
    buildCrosswordElements({
      puzzle,
      slot: slotPt,
      cw,
      showSolution,
      preferredCellPt,
      clueGapPt,
      hideClues: showSolution,
      pageNumberZoneTopPt,
    })
  );
}`
);

replaceFn(
  'drawWordScramble',
  'function drawTrivia(',
  `function drawWordScramble(
  slide: PptSlide,
  puzzle: WordScramblePuzzle,
  slot: RectIn,
  gp: GenericPuzzleSettings,
  showSolution: boolean,
  fontSizeOverridePt?: number,
  wordGapPt?: number,
  letterEm?: number
): void {
  ${slotPt}
  renderResolvedPpt(
    slide,
    buildScrambleElements({
      puzzle,
      slot: slotPt,
      gp,
      showSolution,
      fontSizePt: fontSizeOverridePt ?? gp.typography.puzzleFontSize ?? 14,
      wordGapPt: wordGapPt ?? gp.typography.scrambleSpaceBetweenWords ?? 8,
      letterEm: letterEm ?? gp.typography.scrambleSpaceBetweenLetters ?? 0.12,
    })
  );
}`
);

replaceFn(
  'drawTrivia',
  'function drawCryptogram(',
  `function drawTrivia(
  slide: PptSlide,
  puzzles: TriviaPuzzle[],
  slot: RectIn,
  gp: GenericPuzzleSettings,
  showSolution: boolean
): void {
  ${slotPt}
  renderResolvedPpt(slide, buildTriviaElements({ puzzles, slot: slotPt, gp, showSolution }));
}`
);

replaceFn(
  'drawCryptogram',
  'function drawPuzzleBody(',
  `function drawCryptogram(
  slide: PptSlide,
  puzzle: { encodedText: string; originalText: string; letterMapping?: Record<string, string> },
  slot: RectIn,
  gp: GenericPuzzleSettings,
  showSolution: boolean
): void {
  ${slotPt}
  renderResolvedPpt(slide, buildCryptogramElements({ puzzle, slot: slotPt, gp, showSolution }));
}`
);

fs.writeFileSync(p, s);
console.log('ppt painters now render shared elements');
