import fs from 'fs';
import path from 'path';
import { generatePuzzlePDF } from '../src/lib/pdf-export';
import { generatePuzzlePPT } from '../src/lib/ppt-export';
import { getDefaultWordSearchSettings, TitleWordsSettings } from '../src/lib/puzzles/types';
import { generateWordSearch } from '../src/lib/puzzles/word-search';

async function main() {
  const words = ['APPLE','BANANA','CAT','DOG','FISH','BIRD','TREE','HOUSE','MOON','STAR'];
  const puzzle = generateWordSearch(words, 15, [
    'horizontal',
    'vertical',
    'diagonal-down',
    'diagonal-up',
    'horizontal-reverse',
    'vertical-reverse',
    'diagonal-down-reverse',
    'diagonal-up-reverse',
  ]);

  const defaultSettings = getDefaultWordSearchSettings();
  const wordSearchSettings = {
    ...defaultSettings,
    typography: {
      ...defaultSettings.typography,
      answerGridFontFamily: 'Inter',
      answerGridFontSize: 28,
      setFontForAnswerPages: true,
      setFontSizeForAnswerPages: true,
    },
    bookCanvas: {
      ...defaultSettings.bookCanvas,
      answersPerPage: 1,
      includePageBetweenPuzzleAndSolutions: false,
    },
    colors: {
      ...defaultSettings.colors,
      answerPage: {
        ...defaultSettings.colors.answerPage,
        showAnswerNumber: false,
      },
    },
  };

  const titleWords: TitleWordsSettings = {
    title: 'Word Search',
    fontFamily: 'Inter',
    fontSize: 24,
    words,
  };

  const bookSettings = {
    includeBleed: false,
    customWidth: 8.5,
    customHeight: 11,
    useCustomTrim: false,
    answersPerPage: 1,
    includePageBetweenPuzzleAndSolutions: false,
  };

  const outputDir = path.resolve(process.cwd(), 'tmp');
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

  const pdfData = await generatePuzzlePDF({
    bookSettings,
    titleWords,
    wordSearchSettings,
    puzzles: [puzzle],
    includeSolution: true,
  });
  const pdfPath = path.join(outputDir, 'export-test.pdf');
  fs.writeFileSync(pdfPath, pdfData);
  console.log('PDF generated at', pdfPath);

  await generatePuzzlePPT({
    bookSettings,
    titleWords,
    wordSearchSettings,
    puzzles: [puzzle],
    includeSolution: true,
  });
  console.log('PPT generated.');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});