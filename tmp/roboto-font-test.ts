import fs from 'fs';
import path from 'path';
import { generatePuzzlePDF } from '../src/lib/pdf-export';
import { getDefaultWordSearchSettings, TitleWordsSettings } from '../src/lib/puzzles/types';
import { generateWordSearch } from '../src/lib/puzzles/word-search';

async function main() {
  const words = ['ROBOTO','FONT','EMBEDDED','PDF','GOOGLE','FONTS'];
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
  
  console.log('=== Roboto Font CDN Test ===\n');
  console.log('Creating PDF with Roboto font (downloaded from Google Fonts CDN)...');
  console.log('');

  const wordSearchSettings = {
    ...defaultSettings,
    typography: {
      ...defaultSettings.typography,
      puzzleGridFontFamily: 'Roboto',
      puzzleGridFontSize: 18,
      answerGridFontFamily: 'Roboto',
      answerGridFontSize: 28,
      setFontForAnswerPages: true,
      setFontSizeForAnswerPages: true,
      puzzleTitleFontFamily: 'Roboto',
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
        answerTitleFontFamily: 'Roboto',
      },
    },
    wordList: {
      ...defaultSettings.wordList,
      wordListFontFamily: 'Roboto',
    },
  };

  const titleWords: TitleWordsSettings = {
    title: 'Roboto Font Test',
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

  try {
    console.log('Downloading Roboto font from Google Fonts...');
    const pdfData = await generatePuzzlePDF({
      bookSettings: bookSettings,
      titleWords: titleWords,
      wordSearchSettings: wordSearchSettings,
      puzzles: [puzzle],
      includeSolution: true,
    });

    const pdfPath = path.join(__dirname, 'roboto-font-test.pdf');
    fs.writeFileSync(pdfPath, pdfData);
    
    const fileSize = (pdfData.byteLength / 1024).toFixed(2);
    console.log(`✓ PDF generated: ${pdfPath}`);
    console.log(`  File size: ${fileSize} KB`);
    console.log('');
    console.log('✅ Roboto font has been downloaded and embedded!');

  } catch (error) {
    console.error('❌ Error during export:', error);
    process.exit(1);
  }
}

main();
