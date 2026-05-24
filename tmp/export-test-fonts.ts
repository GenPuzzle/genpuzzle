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
      // Puzzle pages use Roboto
      puzzleGridFontFamily: 'Roboto',
      puzzleGridFontSize: 18,
      // Solution pages use Comic Sans MS
      answerGridFontFamily: 'Comic Sans MS',
      answerGridFontSize: 28,
      setFontForAnswerPages: true,
      setFontSizeForAnswerPages: true,
      // Word list uses Open Sans
      puzzleTitleFontFamily: 'Open Sans',
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
        // Answer title uses Montserrat
        answerTitleFontFamily: 'Montserrat',
      },
    },
    wordList: {
      ...defaultSettings.wordList,
      wordListFontFamily: 'Open Sans',
    },
  };

  const titleWords: TitleWordsSettings = {
    title: 'Word Search',
    fontFamily: 'Roboto',
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

  console.log('Generating PDF with embedded Google Fonts...');
  console.log('Fonts used:');
  console.log('  - Puzzle grid: Roboto');
  console.log('  - Solution grid: Comic Sans MS');
  console.log('  - Word list: Open Sans');
  console.log('  - Answer title: Montserrat');
  console.log('');

  try {
    const pdfData = await generatePuzzlePDF({
      bookSettings: bookSettings,
      titleWords: titleWords,
      wordSearchSettings: wordSearchSettings,
      puzzles: [puzzle],
      includeSolution: true,
    });

    const pdfPath = path.join(__dirname, 'export-test-fonts.pdf');
    fs.writeFileSync(pdfPath, pdfData);
    console.log(`✓ PDF with embedded fonts generated at ${pdfPath}`);
    console.log(`  File size: ${(pdfData.byteLength / 1024).toFixed(2)} KB`);

    console.log('\nGenerating PPT with embedded Google Fonts...');
    const fileName = await generatePuzzlePPT({
      bookSettings: bookSettings,
      titleWords: titleWords,
      wordSearchSettings: wordSearchSettings,
      puzzles: [puzzle],
      includeSolution: true,
    });
    console.log(`✓ PPT with embedded fonts generated`);
    if (fileName) {
      console.log(`  File: ${fileName}`);
    }

    console.log('\n✅ Export test completed successfully!');
  } catch (error) {
    console.error('❌ Error during export:', error);
    process.exit(1);
  }
}

main();
