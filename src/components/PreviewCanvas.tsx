'use client';

import React, { useRef, useMemo } from 'react';
import { useApp } from '@/lib/app-context';
import {
  WordSearchGrid,
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
import { WordSearchPuzzle } from '@/lib/puzzles/types';
import { calculateLayout, calculateHighlights, formatWords, LayoutResult } from '@/lib/puzzle-layout';

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
    triggerStylingUpdate,
  } = useApp();

  const canvasRef = useRef<HTMLDivElement>(null);

  const handleZoomIn = () => setPreviewZoom((z) => Math.min(z + 25, 200));
  const handleZoomOut = () => setPreviewZoom((z) => Math.max(z - 25, 50));

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
        const pdfData = await generatePuzzlePDF({
          bookSettings,
          titleWords,
          wordSearchSettings,
          puzzles: batchPuzzles,
          includeSolution: bookSettings.includeSolution,
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
          bookSettings,
          titleWords,
          wordSearchSettings,
          puzzles: [currentPuzzle as WordSearchPuzzle],
          includeSolution: bookSettings.includeSolution,
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

  const handlePrevPage = () => {
    if (currentBatchIndex > 0) {
      setCurrentBatchIndex(currentBatchIndex - 1);
    }
  };

  const handleNextPage = () => {
    if (currentBatchIndex < batchPuzzles.length - 1) {
      setCurrentBatchIndex(currentBatchIndex + 1);
    }
  };

  // Get current puzzle based on type
  const currentWsPuzzle = currentPuzzleType === 'word-search' && batchPuzzles.length > 0
    ? batchPuzzles[currentBatchIndex]
    : null;

  const settings = currentPuzzleType === 'word-search' ? wordSearchSettings : null;

  // Calculate shared layout for canvas and PDF consistency
  const layout = useMemo((): LayoutResult | null => {
    if (!settings || !currentWsPuzzle) return null;

    // Use standard page size for preview (8.5 x 11 inches)
    return calculateLayout(
      currentWsPuzzle,
      settings,
      titleWords,
      8.5, // pageWidthInches
      11,  // pageHeightInches
      showSolution
    );
  }, [settings, currentWsPuzzle, titleWords, showSolution, triggerStylingUpdate]);

  // Generate display title based on settings
  const displayTitle = useMemo(() => {
    if (!settings) return titleWords.title || 'Puzzle';

    const { selectTitleOption, titleText } = settings.typography;

    if (selectTitleOption === 'none') return '';
    if (selectTitleOption === 'custom') return titleText;
    if (selectTitleOption === 'puzzle-number') {
      const puzzleNum = currentWsPuzzle?.puzzleNumber || 1;
      return `${titleText} #${puzzleNum}`;
    }
    return titleWords.title || 'Word Search';
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings?.typography.selectTitleOption, settings?.typography.titleText, titleWords.title, currentWsPuzzle?.puzzleNumber, triggerStylingUpdate]);

  // Get subtitle
  const displaySubtitle = useMemo(() => {
    if (!settings || !settings.typography.includeSubtitle) return '';
    return settings.typography.subtitleText;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings?.typography.includeSubtitle, settings?.typography.subtitleText, triggerStylingUpdate]);

  // Get colors based on mode (puzzle vs answer)
  const currentColors = useMemo(() => {
    if (!settings) {
      return {
        background: '#ffffff',
        title: '#1f2937',
        grid: '#1f2937',
      };
    }
    return showSolution ? settings.colors.answerPage : settings.colors.puzzlePage;
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

  // Calculate cell size for canvas (scaled from PDF points to pixels)
  const canvasCellSize = useMemo(() => {
    if (!layout) return 28;
    // Convert PDF points to pixels (72 points = 1 inch, and 1 inch = 96 CSS pixels)
    // But we need to scale based on the canvas display
    const pdfCellSize = layout.cellSize;
    const pdfPageWidth = layout.pageWidth;
    const canvasPageWidth = 8.5 * 96; // 8.5 inches * 96 pixels per inch
    const scale = canvasPageWidth / pdfPageWidth;
    return Math.round(pdfCellSize * scale);
  }, [layout]);

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
      const wsPuzzle = currentWsPuzzle as WordSearchPuzzle;
      if (!wsPuzzle) return null;

      return (
        <div className="flex flex-col items-center gap-6">
          {/* Puzzle Grid with box */}
          <div
            className={`${ws?.core.noBoxAroundPuzzle ? '' : 'border-2'}`}
            style={{
              borderColor: currentColors.boxColor,
              borderRadius: '8px',
              padding: ws?.core.noBoxAroundPuzzle ? 0 : 8,
              position: 'relative',
              backgroundColor: '#fafafa',
              boxShadow: showSolution ? '0 4px 12px rgba(0, 0, 0, 0.08)' : 'none',
            }}
          >
            <WordSearchGrid
              puzzle={wsPuzzle}
              showSolution={showSolution}
              cellSize={canvasCellSize}
              gridLines={ws?.core.addGridLines || false}
              puzzleColor={showSolution ? currentColors.puzzleColor : currentColors.puzzleColor || '#1f2937'}
              boxColor={currentColors.boxColor || '#1f2937'}
              solutionStrokeColor={settings?.colors.answerPage.solutionFrameColor || '#000000'}
              solutionStrokeThickness={settings?.colors.answerPage.solutionStrokeThickness || 1}
              solutionStrokePadding={settings?.colors.answerPage.solutionStrokePadding || 0}
              solutionFrameStyle={settings?.colors.answerPage.solutionFrameStyle || 'rounded'}
              solutionFrameRadius={settings?.colors.answerPage.solutionFrameRadius || 6}
              onlyHighlightWordListWords={showSolution ? false : (settings?.colors.answerPage.onlyHighlightWordListWords ?? true)}
              wordList={formattedWords}
            />
          </div>

          {/* Word List - hidden in solution mode */}
          {!showSolution && !settings?.wordList.hideWordList && formattedWords.length > 0 && (
            <div
              className="mt-4"
              style={{
                fontFamily: settings?.wordList.wordListFontFamily || 'Inter',
                fontSize: settings?.wordList.wordListFontSize || 12,
                color: currentColors.wordListColor || '#4b5563',
                columnCount: settings?.wordList.wordListColumns || 2,
                columnGap: '1rem',
                columnRule: settings?.wordList.wordListColumns > 1 ? '1px solid #e5e7eb' : 'none',
                paddingLeft: settings?.wordList.wordListColumns > 1 ? '1rem' : 0,
              }}
            >
              {formattedWords.map((word, idx) => (
                <div key={idx} className="flex items-center gap-1 mb-1">
                  {settings?.wordList.addCheckboxes && (
                    <span className="w-4 h-4 border border-gray-400 rounded flex-shrink-0" />
                  )}
                  <span>{word}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      );
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

  // Get page dimensions
  const pageWidth = settings?.bookCanvas.useCustomTrim
    ? settings.bookCanvas.customWidth
    : currentPuzzleType === 'word-search'
    ? 8.5
    : 8.5;
  const pageHeight = settings?.bookCanvas.useCustomTrim
    ? settings.bookCanvas.customHeight
    : currentPuzzleType === 'word-search'
    ? 11
    : 11;

  const isWordSearch = currentPuzzleType === 'word-search';
  const hasMultiplePuzzles = isWordSearch && batchPuzzles.length > 1;

  // Title style based on layout
  const titleStyle = showSolution ? {
    color: settings?.colors.answerPage.titleColor || '#000000',
    fontFamily: settings?.colors.answerPage.answerTitleFontFamily || 'Inter',
    fontSize: `${settings?.colors.answerPage.answerTitleFontSize || 20}px`,
    marginTop: settings?.typography.titleStartAt || 0,
    textAlign: settings?.colors.answerPage.answerTitleAlignment || 'center',
  } : {
    color: currentColors.titleColor,
    fontFamily: settings?.typography.puzzleTitleFontFamily || 'Inter',
    fontSize: `${settings?.typography.puzzleTitleFontSize || 24}px`,
    marginTop: settings?.typography.titleStartAt || 0,
    textAlign: 'center' as const,
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-gray-50">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-3 bg-white border-b border-gray-200">
        <div className="flex items-center gap-4">
          <h2 className="font-semibold text-gray-900">
            {displayTitle || 'Puzzle Preview'}
            {hasMultiplePuzzles && (
              <span className="ml-2 text-sm font-normal text-gray-500">
                ({currentBatchIndex + 1} of {batchPuzzles.length})
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
                {currentBatchIndex + 1} / {batchPuzzles.length}
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleNextPage}
                disabled={currentBatchIndex === batchPuzzles.length - 1}
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
        </div>
      </div>

      {/* Preview Area */}
      <div className="flex-1 overflow-auto p-8 flex justify-center items-start">
        <div
          ref={canvasRef}
          className="bg-white shadow-lg overflow-hidden"
          style={{
            transform: `scale(${previewZoom / 100})`,
            transformOrigin: 'top center',
            backgroundColor: layout?.backgroundColor || currentColors.backgroundColor || '#ffffff',
            width: `${pageWidth}in`,
            minHeight: `${pageHeight}in`,
            padding: '0.5in',
            fontFamily: settings?.typography.puzzleTitleFontFamily || 'Inter',
          }}
        >
      {/* Title */}
          {showSolution ? (
            settings?.colors.answerPage.answerTitlePrefix && (
              <div className="text-center mb-6">
                <h1 className="font-bold" style={titleStyle}>
                  {settings.colors.answerPage.answerTitlePrefix}
                  {settings.colors.answerPage.showAnswerNumber && currentWsPuzzle && ` ${currentWsPuzzle.puzzleNumber || 1}`}
                </h1>
                {settings?.colors.answerPage.answerSubtitle && (
                  <p
                    className="text-sm mt-2"
                    style={{
                      color: settings?.colors.answerPage.subtitleColor || '#6b7280',
                    }}
                  >
                    {settings.colors.answerPage.answerSubtitle}
                  </p>
                )}
              </div>
            )
          ) : (
            displayTitle && (
              <h1 className="mb-2 font-bold" style={titleStyle}>
                {displayTitle}
              </h1>
            )
          )}

          {/* Subtitle (only on puzzle page) */}
          {!showSolution && displaySubtitle && (
            <p
              className="text-center mb-4"
              style={{
                color: currentColors.subtitleColor || '#6b7280',
                fontSize: `${(settings?.typography.puzzleTitleFontSize || 24) - 6}px`,
              }}
            >
              {displaySubtitle}
            </p>
          )}

          {/* Space between title and puzzle */}
          <div style={{ height: settings?.typography.spaceBetweenTitleAndPuzzle || 20 }} />

          {/* Puzzle Content */}
          <div className="flex items-center justify-center">
            {renderPuzzle()}
          </div>
        </div>
      </div>
    </div>
  );
}
