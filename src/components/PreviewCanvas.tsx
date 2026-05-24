'use client';

import React, { useRef, useMemo } from 'react';
import { useApp } from '@/lib/app-context';
import { getMergedSettingsForPage } from '@/lib/page-settings';
import {
  WordSearchGrid,
  WordSearchPagePreview,
  SudokuGrid,
  CrosswordGrid,
  CryptogramDisplay,
  WordScrambleDisplay,
  MazeDisplay,
  WordMatchDisplay,
  DotToDotDisplay,
} from './puzzle';
import { Eye, EyeOff, ZoomIn, ZoomOut, Save, Download, RotateCw, ChevronLeft, ChevronRight, FileText } from 'lucide-react';
import { Button } from './ui/button';
import { generatePuzzlePDF, downloadPDF } from '@/lib/pdf-export';
// PPT export is dynamically imported to avoid bundling pptxgenjs (which uses node:fs)
import { WordSearchPuzzle } from '@/lib/puzzles/types';
import {
  calculateLayout,
  calculateHighlights,
  formatWords,
  getPageDimensionsInches,
  getSolutionGridFontSize,
  LayoutResult,
} from '@/lib/puzzle-layout';
import { layoutPtToCss } from '@/lib/word-search-page-layout';

export function PreviewCanvas() {
  const {
    currentPuzzle,
    currentPuzzleType,
    showSolution,
    setShowSolution,
    titleWords,
    wordSearchSettings,
    batchPuzzles,
    currentBatchIndex,
    setCurrentBatchIndex,
    generatePuzzle,
    savePuzzle,
    bookSettings,
    previewZoom,
    setPreviewZoom,
    puzzleGridScale,
    triggerStylingUpdate,
    pageOverrides,
    applyMode,
    titleToAnswerGap,
    pageMargin,
  } = useApp();

  const canvasRef = useRef<HTMLDivElement>(null);

  // Enable WordSearchGrid debug logging in browser devtools to trace opacity
  React.useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        (window as any).__WORDSEARCH_DEBUG_OPACITY__ = true;
      } catch (e) {
        // ignore
      }
    }
  }, []);

  const handleZoomIn = () => setPreviewZoom(Math.min(previewZoom + 25, 200));
  const handleZoomOut = () => setPreviewZoom(Math.max(previewZoom - 25, 50));

  const handleSave = () => {
    const name = `${titleWords.title || currentPuzzleType} - ${new Date().toLocaleDateString()}`;
    savePuzzle(name);
  };

  const handleExportPDF = async () => {
    console.log('Starting PDF export...');
    console.log('Batch puzzles:', batchPuzzles.length);
    console.log('Book settings:', bookSettings);
    console.log('Include solution:', bookSettings.includeSolution);

    if (currentPuzzleType === 'word-search' && batchPuzzles.length > 0) {
      try {
        console.log('Generating PDF with batch puzzles...');
        console.log('Solution highlight alpha (settings):', wordSearchSettings?.colors?.answerPage?.solutionHighlightAlpha);
        const pdfData = await generatePuzzlePDF({
          bookSettings: {
            ...bookSettings,
            ...wordSearchSettings.bookCanvas,
          },
          titleWords,
          wordSearchSettings,
          puzzles: batchPuzzles,
          includeSolution: bookSettings.includeSolution,
          puzzleGridScale,
          titleToAnswerGap,
          pageMargin,
          pageOverrides,
          applyMode,
        });
        console.log('PDF generated, downloading...');
        const filename = `${titleWords.title || 'word-search'}-${Date.now()}.pdf`;
        downloadPDF(pdfData, filename);
        console.log('PDF download initiated');
      } catch (error) {
        console.error('PDF export failed:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        const errorStack = error instanceof Error ? error.stack : '';
        alert(`Failed to export PDF: ${errorMessage}\n\n${errorStack}`);
      }
    } else if (currentPuzzle) {
      try {
        console.log('Generating PDF with single puzzle...');
        const pdfData = await generatePuzzlePDF({
          bookSettings: {
            ...bookSettings,
            ...wordSearchSettings.bookCanvas,
          },
          titleWords,
          wordSearchSettings,
          puzzles: [currentPuzzle as WordSearchPuzzle],
          includeSolution: bookSettings.includeSolution,
          puzzleGridScale,
          titleToAnswerGap,
          pageMargin,
          pageOverrides,
          applyMode,
        });
        console.log('PDF generated, downloading...');
        const filename = `${titleWords.title || 'puzzle'}-${Date.now()}.pdf`;
        downloadPDF(pdfData, filename);
      } catch (error) {
        console.error('PDF export failed:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        const errorStack = error instanceof Error ? error.stack : '';
        alert(`Failed to export PDF: ${errorMessage}\n\n${errorStack}`);
      }
    } else {
      alert('No puzzles to export. Please generate puzzles first.');
    }
  };

  const handleExportPPT = async () => {
    console.log('Starting PPT export...');
    // Dynamic import to avoid bundling pptxgenjs (uses node:fs) on the client
    const { generatePuzzlePPT } = await import('@/lib/ppt-export');
    if (currentPuzzleType === 'word-search' && batchPuzzles.length > 0) {
      try {
        await generatePuzzlePPT({
          bookSettings: {
            ...bookSettings,
            ...wordSearchSettings.bookCanvas,
          },
          titleWords,
          wordSearchSettings,
          puzzles: batchPuzzles,
          includeSolution: bookSettings.includeSolution,
          pageOverrides,
          applyMode,
        });
      } catch (error) {
        console.error('PPT export failed:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        alert(`Failed to export PowerPoint: ${errorMessage}`);
      }
    } else if (currentPuzzle) {
      try {
        await generatePuzzlePPT({
          bookSettings: {
            ...bookSettings,
            ...wordSearchSettings.bookCanvas,
          },
          titleWords,
          wordSearchSettings,
          puzzles: [currentPuzzle as WordSearchPuzzle],
          includeSolution: bookSettings.includeSolution,
          pageOverrides,
          applyMode,
        });
      } catch (error) {
        console.error('PPT export failed:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        alert(`Failed to export PowerPoint: ${errorMessage}`);
      }
    } else {
      alert('No puzzles to export. Please generate puzzles first.');
    }
  };

  const handlePrevPage = () => {
    if (showSolution) {
      setCurrentBatchIndex(Math.max(0, currentBatchIndex - answersPerPage));
    } else if (currentBatchIndex > 0) {
      setCurrentBatchIndex(currentBatchIndex - 1);
    }
  };

  const handleNextPage = () => {
    if (showSolution) {
      setCurrentBatchIndex(Math.min(batchPuzzles.length - 1, currentBatchIndex + answersPerPage));
    } else if (currentBatchIndex < batchPuzzles.length - 1) {
      setCurrentBatchIndex(currentBatchIndex + 1);
    }
  };

  // Get current puzzle based on type
  const isWordSearch = currentPuzzleType === 'word-search';
  const globalWordSearchSettings = isWordSearch ? wordSearchSettings : null;

  const answersPerPage = globalWordSearchSettings?.bookCanvas.answersPerPage || 1;
  const solutionPageIndex = Math.floor(currentBatchIndex / answersPerPage);
  const pageIndex = showSolution ? solutionPageIndex : currentBatchIndex;
  const settings = isWordSearch
    ? getMergedSettingsForPage(wordSearchSettings, pageOverrides, applyMode, pageIndex)
    : null;

  const solutionPageCount = isWordSearch && batchPuzzles.length > 0 ? Math.ceil(batchPuzzles.length / answersPerPage) : 1;
  const solutionPageStartIndex = solutionPageIndex * answersPerPage;
  const solutionPagePuzzles = isWordSearch ? batchPuzzles.slice(solutionPageStartIndex, solutionPageStartIndex + answersPerPage) : [];
  const currentWsPuzzle = isWordSearch && batchPuzzles.length > 0 ? batchPuzzles[currentBatchIndex] : null;

  const previewSolutionLayout = useMemo(() => {
    if (answersPerPage === 4) return { columns: 2, rows: 2 };
    if (answersPerPage === 2) return { columns: 1, rows: 2 };
    return { columns: 1, rows: 1 };
  }, [answersPerPage]);

  const getSolutionCardCellSize = (puzzle: WordSearchPuzzle) => {
    const previewPageWidthInches = settings?.bookCanvas.useCustomTrim ? settings.bookCanvas.customWidth : 8.5;
    const previewPageHeightInches = settings?.bookCanvas.useCustomTrim ? settings.bookCanvas.customHeight : 11;
    const previewPageWidthPx = previewPageWidthInches * 96;
    const previewPageHeightPx = previewPageHeightInches * 96;
    const pagePaddingPx = 48; // 0.5in padding
    const gapPx = 16;
    const cardWidth = (previewPageWidthPx - pagePaddingPx * 2 - gapPx * (previewSolutionLayout.columns - 1)) / previewSolutionLayout.columns;
    const cardHeight = (previewPageHeightPx - pagePaddingPx * 2 - gapPx * (previewSolutionLayout.rows - 1)) / previewSolutionLayout.rows;
    const innerPaddingPx = 16;
    const titleHeight = 28;
    const availableWidth = cardWidth - innerPaddingPx * 2;
    const availableHeight = cardHeight - innerPaddingPx * 2 - titleHeight;
    return Math.max(10, Math.floor(Math.min(availableWidth / puzzle.grid[0].length, availableHeight / puzzle.grid.length, 22)));
  };

  // Shared layout engine (same inputs as PDF export)
  const layout = useMemo((): LayoutResult | null => {
    if (!settings || !currentWsPuzzle) return null;
    const pageDims = getPageDimensionsInches(settings);
    return calculateLayout(
      currentWsPuzzle,
      settings,
      titleWords,
      pageDims.width,
      pageDims.height,
      showSolution,
      puzzleGridScale
    );
  }, [settings, currentWsPuzzle, titleWords, showSolution, puzzleGridScale, triggerStylingUpdate]);

  // Generate display title based on settings
  const displayTitle = useMemo(() => {
    if (!settings) return titleWords.title || 'Word Search';
    if (showSolution) return '';

    const { selectTitleOption, titleText } = settings.typography;

    if (selectTitleOption === 'none') return '';
    if (selectTitleOption === 'custom') {
      const lines = (titleText || '')
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean);
      const puzzleNum = currentWsPuzzle?.puzzleNumber || 1;
      return lines.length > 0 ? (lines[puzzleNum - 1] ?? lines[lines.length - 1]) : '';
    }
    if (selectTitleOption === 'puzzle-number') {
      const puzzleNum = currentWsPuzzle?.puzzleNumber || 1;
      return `${titleText} #${puzzleNum}`;
    }
    return titleWords.title || 'Word Search';
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings?.typography.selectTitleOption, settings?.typography.titleText, titleWords.title, currentWsPuzzle?.puzzleNumber, triggerStylingUpdate, showSolution]);

  // Get subtitle
  const displaySubtitle = useMemo(() => {
    if (!settings || !settings.typography.includeSubtitle) return '';
    return settings.typography.subtitleText;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings?.typography.includeSubtitle, settings?.typography.subtitleText, triggerStylingUpdate]);

  type PreviewColors = {
    backgroundColor: string;
    titleColor: string;
    subtitleColor: string;
    boxColor: string;
    puzzleColor: string;
  };

  // Get colors based on mode (puzzle vs answer)
  const currentColors = useMemo<PreviewColors>(() => {
    if (!settings) {
      return {
        backgroundColor: '#ffffff',
        titleColor: '#1f2937',
        subtitleColor: '#6b7280',
        boxColor: '#1f2937',
        puzzleColor: '#1f2937',
      };
    }

    if (showSolution) {
      return {
        backgroundColor: settings.colors.answerPage.backgroundColor,
        titleColor: settings.colors.answerPage.titleColor,
        subtitleColor: settings.colors.puzzlePage.subtitleColor,
        boxColor: settings.colors.answerPage.boxColor,
        puzzleColor: settings.colors.answerPage.lettersInSolutionColor,
      };
    }

    return {
      backgroundColor: settings.colors.puzzlePage.backgroundColor,
      titleColor: settings.colors.puzzlePage.titleColor,
      subtitleColor: settings.colors.puzzlePage.subtitleColor,
      boxColor: settings.colors.puzzlePage.boxColor,
      puzzleColor: settings.colors.puzzlePage.puzzleColor,
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings?.colors, showSolution, triggerStylingUpdate]);

  // Format words for current puzzle based on settings
  const formattedWords = useMemo(() => {
    if (!settings || !currentWsPuzzle) return titleWords.words;
    return formatWords(currentWsPuzzle.words, settings.wordList);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings?.wordList, currentWsPuzzle?.words, triggerStylingUpdate]);

  // Calculate highlight positions for solution
  const highlights = useMemo(() => {
    if (!layout || !currentWsPuzzle || !showSolution) return [];
    return calculateHighlights(currentWsPuzzle, layout, 0); // Use 0 padding for tighter frames
  }, [layout, currentWsPuzzle, showSolution]);

  const renderPuzzle = () => {
    if (currentPuzzleType === 'word-search') {
      if (batchPuzzles.length === 0) {
        return (
          <div className="flex flex-col items-center justify-center h-64 text-gray-400 gap-4">
            <FileText className="w-12 h-12" />
            <p className="text-center">
              Enter words in the Word List tab<br />
              and click "Generate" to create puzzles
            </p>
          </div>
        );
      }

      const ws = settings;
      if (!ws) return null;

      if (showSolution) {
        return (
          <div className="flex flex-col items-center gap-6 w-full">
            <div
              className="grid w-full"
              style={{
                gridTemplateColumns: `repeat(${previewSolutionLayout.columns}, minmax(0, 1fr))`,
                gap: '16px',
                padding: `${pageMargin * 0.75}px`,
              }}
            >
              {solutionPagePuzzles.map((puzzle, index) => {
                const cardCellSize = getSolutionCardCellSize(puzzle);
                const titleText = `${ws.colors.answerPage.answerTitlePrefix || 'Solution'}${ws.colors.answerPage.showAnswerNumber ? ` ${puzzle.puzzleNumber || solutionPageStartIndex + index + 1}` : ''}`;

                return (
                  <div
                    key={`solution-${puzzle.puzzleNumber || index}`}
                    className="border border-gray-200 rounded-3xl bg-white p-4"
                    style={{ minHeight: '100%' }}
                  >
                    <div
                      className="text-center font-semibold"
                      style={{
                        color: ws.colors.answerPage.titleColor || '#1f2937',
                        fontFamily: ws.colors.answerPage.answerTitleFontFamily || 'Inter',
                        fontSize: `${ws.colors.answerPage.answerTitleFontSize || 20}px`,
                        marginBottom: `${titleToAnswerGap}px`,
                      }}
                    >
                      {titleText}
                    </div>
                    <div className="flex items-center justify-center">
                      <WordSearchGrid
                        puzzle={puzzle}
                        showSolution={showSolution}
                        cellSize={cardCellSize}
                        noBoxAroundPuzzle={ws.core.noBoxAroundPuzzle || false}
                        borderStrokeThickness={layoutPtToCss(ws.core.borderStrokeThickness || 2)}
                        puzzleColor="#000000"
                        boxColor={currentColors.boxColor || '#1f2937'}
                        innerGridOpacity={ws.core.innerGridOpacity ?? 0}
                        gridLinesStrokeThickness={layoutPtToCss(ws.core.gridLinesStrokeThickness || 1)}
                        uiOffsetX={ws.typography.uiOffsetX ?? 0}
                        uiOffsetY={ws.typography.uiOffsetY ?? 0}
                        solutionStrokeColor={ws.colors.answerPage.solutionFrameColor || '#000000'}
                        solutionStrokeThickness={ws.colors.answerPage.solutionStrokeThickness || 12}
                        solutionStrokePadding={ws.colors.answerPage.solutionStrokePadding || 0}
                        solutionFrameStyle={ws.colors.answerPage.solutionFrameStyle || 'rounded'}
                        solutionFrameRadius={ws.colors.answerPage.solutionFrameRadius || 6}
                        solutionHighlightAlpha={ws.colors.answerPage.solutionHighlightAlpha ?? 30}
                        onlyHighlightWordListWords={false}
                        wordList={formattedWords}
                        	puzzleGridFontSize={ws.typography.puzzleGridFontSize || 18}
                        	puzzleGridFontFamily={ws.typography.puzzleGridFontFamily || 'Inter'}
                        	answerGridFontSize={getSolutionGridFontSize(ws.typography)}
                        	answerGridFontFamily={
                            ws.typography.setFontForAnswerPages
                              ? ws.typography.answerGridFontFamily
                              : undefined
                          }
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      }

      return null;
    }

    // Non-word-search puzzles
    if (!currentPuzzle) {
      return (
        <div className="flex items-center justify-center h-64 text-gray-400">
          Click "Generate Puzzle" to create a puzzle
        </div>
      );
    }

    const baseCellSize = Math.round(28 * (previewZoom / 100));
    const gridProps = { showSolution, cellSize: baseCellSize };

    switch (currentPuzzle.type) {
      case 'sudoku':
        return <SudokuGrid puzzle={currentPuzzle} {...gridProps} />;
      case 'crossword':
        return <CrosswordGrid puzzle={currentPuzzle} {...gridProps} />;
      case 'cryptogram':
        return <CryptogramDisplay puzzle={currentPuzzle} showSolution={showSolution} />;
      case 'word-scramble':
        return <WordScrambleDisplay puzzle={currentPuzzle} showSolution={showSolution} />;
      case 'maze':
        return <MazeDisplay puzzle={currentPuzzle} {...gridProps} />;
      case 'word-match':
        return <WordMatchDisplay puzzle={currentPuzzle} showSolution={showSolution} />;
      case 'dot-to-dot':
        return <DotToDotDisplay puzzle={currentPuzzle} showSolution={showSolution} />;
      default:
        return <div>Unknown puzzle type</div>;
    }
  };

  const pageWidth = settings?.bookCanvas.useCustomTrim
    ? settings.bookCanvas.customWidth ?? 8.5
    : 8.5;
  const pageHeight = settings?.bookCanvas.useCustomTrim
    ? settings.bookCanvas.customHeight ?? 11
    : 11;

  const hasMultiplePuzzles = currentPuzzleType === 'word-search' && batchPuzzles.length > 1;
  const useUnifiedPagePreview =
    currentPuzzleType === 'word-search' &&
    !!settings &&
    !!currentWsPuzzle &&
    !(showSolution && answersPerPage > 1);

  return (
    <div className="flex-1 flex flex-col h-full bg-gray-50 relative">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-3 bg-white border-b border-gray-200">
        <div className="flex items-center gap-4">
          <h2 className="font-semibold text-gray-900">
            {displayTitle || 'Puzzle Preview'}
            {hasMultiplePuzzles && (
            <span className="ml-2 text-sm font-normal text-gray-500">
              ({showSolution ? solutionPageIndex + 1 : currentBatchIndex + 1} of {showSolution ? solutionPageCount : batchPuzzles.length})
            </span>
          )}
          </h2>

          {/* Pagination for batch puzzles */}
          {hasMultiplePuzzles && (
            <div className="flex items-center gap-1 border border-gray-200 rounded-md">
              <Button
                variant="ghost"
                size="sm"
                onClick={handlePrevPage}
                disabled={currentBatchIndex === 0}
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <span className="px-2 text-sm font-medium min-w-[80px] text-center">
                {showSolution ? solutionPageIndex + 1 : currentBatchIndex + 1} / {showSolution ? solutionPageCount : batchPuzzles.length}
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleNextPage}
                disabled={showSolution ? currentBatchIndex + answersPerPage >= batchPuzzles.length : currentBatchIndex === batchPuzzles.length - 1}
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Zoom Controls */}
          <div className="flex items-center gap-1 border border-gray-200 rounded-md">
            <Button variant="ghost" size="sm" onClick={handleZoomOut}>
              <ZoomOut className="w-4 h-4" />
            </Button>
            <span className="px-2 text-sm font-medium min-w-[50px] text-center">
              {previewZoom}%
            </span>
            <Button variant="ghost" size="sm" onClick={handleZoomIn}>
              <ZoomIn className="w-4 h-4" />
            </Button>
          </div>

          {/* Toggle Solution */}
          <Button
            variant={showSolution ? 'default' : 'outline'}
            size="sm"
            onClick={() => setShowSolution(!showSolution)}
          >
            {showSolution ? <EyeOff className="w-4 h-4 mr-1" /> : <Eye className="w-4 h-4 mr-1" />}
            {showSolution ? 'Hide Solution' : 'Show Solution'}
          </Button>

          {/* Export */}
          <Button size="sm" onClick={handleExportPDF}>
            <Download className="w-4 h-4 mr-1" />
            Export PDF
          </Button>
          <Button size="sm" onClick={handleExportPPT}>
            <FileText className="w-4 h-4 mr-1" />
            Export PPT
          </Button>
        </div>
      </div>

      {/* Preview Area — fixed paper aspect ratio, scaled uniformly (WYSIWYG) */}
      <div className="flex-1 overflow-auto p-8 flex justify-center items-start">
        <div
          ref={canvasRef}
          style={{
            transform: `scale(${previewZoom / 100})`,
            transformOrigin: 'top center',
          }}
        >
          {useUnifiedPagePreview ? (
            <WordSearchPagePreview
              puzzle={currentWsPuzzle as WordSearchPuzzle}
              settings={settings!}
              titleWords={titleWords}
              showSolution={showSolution}
              puzzleGridScale={puzzleGridScale}
              className="shadow-xl ring-1 ring-gray-200/80 rounded-sm"
            />
          ) : currentPuzzleType === 'word-search' && settings ? (
            <div
              className="bg-white shadow-xl ring-1 ring-gray-200/80 rounded-sm"
              style={{
                width: `${pageWidth}in`,
                minHeight: `${pageHeight}in`,
                padding: '0.5in',
              }}
            >
              {renderPuzzle()}
            </div>
          ) : (
            <div
              className="bg-white shadow-xl ring-1 ring-gray-200/80 rounded-sm p-8"
              style={{
                width: `${pageWidth}in`,
                minHeight: `${pageHeight}in`,
              }}
            >
              {renderPuzzle()}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
