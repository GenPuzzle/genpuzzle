import fs from 'fs';

const p = 'src/lib/generic-puzzle-pdf-draw.ts';
let s = fs.readFileSync(p, 'utf8');

function replaceFn(name, nextName, body) {
  const start = s.indexOf('function ' + name + '(');
  const end = nextName ? s.indexOf(nextName, start + 10) : s.length;
  if (start < 0 || end < 0 || end < start) throw new Error(name + ' ' + start + ' ' + end);
  s = s.slice(0, start) + body + '\n\n' + s.slice(end);
}

replaceFn(
  'drawCrosswordPdf',
  'function scrambleWords(',
  `function drawCrosswordPdf(
  page: PDFPage,
  pageHeightPt: number,
  puzzle: CrosswordPuzzle,
  slot: RectPt,
  cw: CrosswordSettings,
  showSolution: boolean,
  preferredCellPt: number,
  clueGapPt: number,
  hideClues: boolean,
  letterFont: PDFFont,
  clueFont: PDFFont,
  _numberFont: PDFFont,
  pageNumberZoneTopPt: number
): void {
  renderResolvedPdf(
    page,
    pageHeightPt,
    buildCrosswordElements({
      puzzle,
      slot,
      cw,
      showSolution,
      preferredCellPt,
      clueGapPt,
      hideClues,
      pageNumberZoneTopPt,
    }),
    (_family, bold) => (bold ? letterFont : clueFont)
  );
}`
);

replaceFn(
  'drawScramblePdf',
  'function drawTriviaPdf(',
  `function drawScramblePdf(
  page: PDFPage,
  pageHeightPt: number,
  puzzle: WordScramblePuzzle,
  slot: RectPt,
  gp: GenericPuzzleSettings,
  showSolution: boolean,
  font: PDFFont,
  fontSizePt: number,
  wordGapPt: number,
  letterEm: number
): void {
  renderResolvedPdf(
    page,
    pageHeightPt,
    buildScrambleElements({ puzzle, slot, gp, showSolution, fontSizePt, wordGapPt, letterEm }),
    () => font
  );
}`
);

replaceFn(
  'drawTriviaPdf',
  'function drawCryptogramPdf(',
  `function drawTriviaPdf(
  page: PDFPage,
  pageHeightPt: number,
  puzzles: TriviaPuzzle[],
  slot: RectPt,
  gp: GenericPuzzleSettings,
  showSolution: boolean,
  font: PDFFont,
  boldFont: PDFFont
): void {
  renderResolvedPdf(
    page,
    pageHeightPt,
    buildTriviaElements({ puzzles, slot, gp, showSolution }),
    (_family, bold) => (bold ? boldFont : font)
  );
}`
);

replaceFn(
  'drawCryptogramPdf',
  'export async function addNativeGenericOrCrosswordPdfPage(',
  `function drawCryptogramPdf(
  page: PDFPage,
  pageHeightPt: number,
  puzzle: { encodedText?: string; originalText?: string },
  slot: RectPt,
  gp: GenericPuzzleSettings,
  showSolution: boolean,
  font: PDFFont
): void {
  renderResolvedPdf(
    page,
    pageHeightPt,
    buildCryptogramElements({ puzzle, slot, gp, showSolution }),
    () => font
  );
}`
);

fs.writeFileSync(p, s);
console.log('pdf painters now render shared elements');
