import fs from 'fs';
import path from 'path';
import { generatePuzzlePDF } from '../src/lib/pdf-export';
import { getDefaultWordSearchSettings, TitleWordsSettings } from '../src/lib/puzzles/types';
import { generateWordSearch } from '../src/lib/puzzles/word-search';

async function main() {
  const words = ['FONT','EMBED','INTER','ROBOTO','CUSTOM','HELVETICA'];
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
  
  console.log('=== PDF Font Embedding Test ===\n');
  console.log('Creating PDF with INTER font...');
  console.log('Expected: Inter font will be embedded from typeface-inter package');
  console.log('');

  const wordSearchSettings = {
    ...defaultSettings,
    typography: {
      ...defaultSettings.typography,
      // Use Inter for puzzle grid (should be embedded)
      puzzleGridFontFamily: 'Inter',
      puzzleGridFontSize: 18,
      // Use Inter for solution grid
      answerGridFontFamily: 'Inter',
      answerGridFontSize: 28,
      setFontForAnswerPages: true,
      setFontSizeForAnswerPages: true,
      // Use Inter for title
      puzzleTitleFontFamily: 'Inter',
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
        answerTitleFontFamily: 'Inter',
      },
    },
    wordList: {
      ...defaultSettings.wordList,
      wordListFontFamily: 'Inter',
    },
  };

  const titleWords: TitleWordsSettings = {
    title: 'Font Embedding Test',
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

  try {
    const pdfData = await generatePuzzlePDF({
      bookSettings: bookSettings,
      titleWords: titleWords,
      wordSearchSettings: wordSearchSettings,
      puzzles: [puzzle],
      includeSolution: true,
    });

    const pdfPath = path.join(__dirname, 'inter-font-test.pdf');
    fs.writeFileSync(pdfPath, pdfData);
    
    const fileSize = (pdfData.byteLength / 1024).toFixed(2);
    console.log(`✓ PDF generated: ${pdfPath}`);
    console.log(`  File size: ${fileSize} KB`);
    console.log('');
    console.log('PDF Information:');
    console.log('  - Puzzle Grid Font: Inter');
    console.log('  - Solution Grid Font: Inter');
    console.log('  - Title Font: Inter');
    console.log('  - Word List Font: Inter');
    console.log('');
    console.log('To verify fonts are embedded:');
    console.log('1. Open the PDF in a text editor or PDF analyzer');
    console.log('2. Look for "/FontName" entries');
    console.log('3. Should contain "Inter" font references');
    console.log('4. File size will be larger if fonts are embedded');

  } catch (error) {
    console.error('❌ Error during export:', error);
    process.exit(1);
  }
}

main();
