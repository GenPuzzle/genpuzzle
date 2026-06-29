'use client';

import React from 'react';
import { WordSearchPuzzle } from '@/lib/puzzles/types';
import { calculateLayout, calculateHighlights } from '@/lib/puzzle-layout';

interface WordSearchSolutionPageProps {
  puzzle: WordSearchPuzzle;
  cellSize?: number;
  pageWidth?: number; // in inches
  pageHeight?: number; // in inches
  margin?: number; // in inches
  backgroundColor?: string;
  titleColor?: string;
  boxColor?: string;
  puzzleColor?: string;
  solutionFrameColor?: string;
  solutionStrokeThickness?: number;
  solutionHighlightAlpha?: number;
  titleText?: string;
  titleSize?: number;
  showTitle?: boolean;
}

export function WordSearchSolutionPage({
  puzzle,
  cellSize = 28,
  pageWidth = 8.5, // Standard letter size
  pageHeight = 11,
  margin = 0.5,
  backgroundColor = '#ffffff',
  titleColor = '#000000',
  boxColor = '#000000',
  puzzleColor = '#000000',
  solutionFrameColor = '#000000',
  solutionStrokeThickness = 12,
  solutionHighlightAlpha = 30,
  titleText = 'Solution',
  titleSize = 24,
  showTitle = true,
}: WordSearchSolutionPageProps) {
  // Fixed configuration (not user-editable)
  const solutionHighlightMode = 'box-frame'; // Always use box-frame
  const solutionLineCap = 'round'; // Always use rounded ends
  // Create mock settings for layout calculation
  const mockSettings = {
    bookCanvas: {
      includeBleed: false,
      useCustomTrim: false,
      customWidth: 8.5,
      customHeight: 11,
      puzzleType: 'word-search' as const,
      answersPerPage: 4,
      includePageBetweenPuzzleAndSolutions: false,
    },
    core: {
      numberOfPuzzles: 1,
      puzzlesStartingNumber: 1,
      lettersAcross: puzzle.grid[0]?.length || 15,
      lettersDown: puzzle.grid.length || 15,
      allowUp: true,
      allowDown: true,
      allowLeft: true,
      allowRight: true,
      allowDiagonalUp: true,
      allowDiagonalDown: true,
      allowDiagonalUpReverse: true,
      allowDiagonalDownReverse: true,
      noBoxAroundPuzzle: false,
      addGridLines: false,
      borderStrokeThickness: 2,
      gridLinesStrokeThickness: 1,
      innerGridOpacity: 0,
      // customLetters removed
    },
    typography: {
      selectTitleOption: 'custom' as const,
      titleText,
      includeSubtitle: false,
      subtitleText: '',
      puzzleTitleFontFamily: 'Arial',
      puzzleTitleFontSize: titleSize,
      answerTitleFontSize: titleSize,
      titleStartAt: 20,
      spaceBetweenTitleAndPuzzle: 20,
      spaceBetweenTitleAndAnswer: 10,
      puzzleGridCase: 'upper' as const,
      puzzleGridFontFamily: 'Arial',
      puzzleGridFontSize: 18,
      uiOffsetX: 0,
      uiOffsetY: 0,
      pdfOffsetX: 0,
      pdfOffsetY: 0,
      setFontForAnswerPages: false,
      answerGridFontFamily: 'Arial',
      setFontSizeForAnswerPages: false,
      answerGridFontSize: 14,
      spaceBetweenPuzzleAndWordList: 0,
    },
    wordList: {
      wordsPerPuzzle: 1,
      hideWordList: true,
      selectWordListOption: 'manual' as const,
      aiTheme: '',
      aiLanguage: 'English',
      aiAgeLevel: 'adult',
      aiMaxWordLength: 12,
      wordListFontFamily: 'Arial',
      wordListFontSize: 12,
      wordListCase: 'upper' as const,
      wordListDirection: 'vertical' as const,
      wordListColumns: 1,
      dontAlphabetize: false,
      addCheckboxes: false,
      addSpaceForGraphics: false,
      includeTitleAboveList: false,
    },
    colors: {
      puzzlePage: {
        backgroundColor,
        titleColor,
        boxColor,
        puzzleColor,
        wordListColor: puzzleColor,
        subtitleColor: '#666666',
        wordListTitleColor: '#000000',
      },
      answerPage: {
        backgroundColor,
        titleColor,
        boxColor,
        lettersInSolutionColor: puzzleColor,
        lettersNotInSolutionColor: '#d1d5db',
        solutionHighlightAlpha: 30,
        solutionStrokeThickness,
        solutionStrokePadding: 0,
        solutionFrameColor,
        solutionFrameStyle: 'rounded' as const,
        solutionFrameRadius: 6,
        answerTitlePrefix: titleText,
        answerTitleFontFamily: 'Arial',
        answerTitleFontSize: titleSize,
        answerTitleAlignment: 'center' as const,
        showAnswerNumber: false,
      },
    },
  };

  const mockTitleWords = {
    title: 'Word Search',
    subtitle: '',
    fontFamily: 'Arial',
    fontSize: 24,
    words: puzzle.words,
  };

  // Calculate layout
  const layout = calculateLayout(
    puzzle,
    mockSettings,
    mockTitleWords,
    pageWidth,
    pageHeight,
    true // showSolution = true
  );

  // Calculate highlights
  const highlights = calculateHighlights(puzzle, layout, cellSize * 0.12);

  // Convert points to pixels (assuming 96 DPI for web display)
  const scaleFactor = 96 / 72; // Convert from PDF points to web pixels
  const scaledLayout = {
    ...layout,
    pageWidth: layout.pageWidth * scaleFactor,
    pageHeight: layout.pageHeight * scaleFactor,
    margin: layout.margin * scaleFactor,
    gridStartX: layout.gridStartX * scaleFactor,
    gridStartY: layout.gridStartY * scaleFactor,
    cellSize: layout.cellSize * scaleFactor,
    gridWidth: layout.gridWidth * scaleFactor,
    gridHeight: layout.gridHeight * scaleFactor,
    titleSize: layout.titleSize * scaleFactor,
    titleY: layout.titleY * scaleFactor,
  };

  const scaledHighlights = highlights.map(h => ({
    ...h,
    x: h.x * scaleFactor,
    y: h.y * scaleFactor,
    width: h.width * scaleFactor,
    height: h.height * scaleFactor,
    startX: h.startX ? h.startX * scaleFactor : undefined,
    startY: h.startY ? h.startY * scaleFactor : undefined,
    endX: h.endX ? h.endX * scaleFactor : undefined,
    endY: h.endY ? h.endY * scaleFactor : undefined,
  }));

  return (
    <div
      className="relative overflow-hidden"
      style={{
        width: scaledLayout.pageWidth,
        height: scaledLayout.pageHeight,
        backgroundColor,
      }}
    >
      {/* Title */}
      {showTitle && layout.titleText && (
        <div
          className="absolute font-bold"
          style={{
            left: scaledLayout.margin,
            top: scaledLayout.pageHeight - scaledLayout.titleY - scaledLayout.titleSize,
            fontSize: scaledLayout.titleSize,
            color: titleColor,
            textAlign: 'center',
            width: scaledLayout.pageWidth - scaledLayout.margin * 2,
          }}
        >
          {layout.titleText}
        </div>
      )}

      {/* Grid Container */}
      <div className="absolute">
        {/* Outer box around puzzle */}
        <div
          className="absolute border"
          style={{
            left: scaledLayout.gridStartX - 4 * scaleFactor,
            top: scaledLayout.pageHeight - scaledLayout.gridStartY - scaledLayout.gridHeight - 4 * scaleFactor,
            width: scaledLayout.gridWidth + 8 * scaleFactor,
            height: scaledLayout.gridHeight + 8 * scaleFactor,
            borderColor: boxColor,
            borderWidth: 1.5 * scaleFactor,
          }}
        />

        {/* Grid cells */}
        <div
          className="grid gap-0 absolute"
          style={{
            left: scaledLayout.gridStartX,
            top: scaledLayout.pageHeight - scaledLayout.gridStartY - scaledLayout.gridHeight,
            gridTemplateColumns: `repeat(${puzzle.grid[0].length}, ${scaledLayout.cellSize}px)`,
          }}
        >
          {puzzle.grid.map((row, rowIndex) =>
            row.map((letter, colIndex) => (
              <div
                key={`${rowIndex}-${colIndex}`}
                className="flex items-center justify-center font-bold border-r border-b"
                style={{
                  width: scaledLayout.cellSize,
                  height: scaledLayout.cellSize,
                  backgroundColor: '#ffffff',
                  color: puzzleColor,
                  borderColor: boxColor,
                  borderRightWidth: 0.5 * scaleFactor,
                  borderBottomWidth: 0.5 * scaleFactor,
                  fontSize: scaledLayout.cellSize * 0.5,
                  fontFamily: 'monospace',
                }}
              >
                {letter}
              </div>
            ))
          )}
        </div>

        {/* Solution highlights */}
        <svg
          className="absolute pointer-events-none"
          style={{
            left: 0,
            top: 0,
            width: scaledLayout.pageWidth,
            height: scaledLayout.pageHeight,
            overflow: 'visible',
            zIndex: 10,
          }}
        >
          <defs>
            <filter id="shadow" x="-50%" y="-50%" width="200%" height="200%">
              <feDropShadow dx="0" dy="0" stdDeviation="1" floodOpacity="0.1" />
            </filter>
          </defs>

          {scaledHighlights.map((highlight, idx) => {
            const normalizedOpacity = Math.max(0, Math.min(100, solutionHighlightAlpha)) / 100;
            // Fixed: always use box-frame with rounded ends
            const fill = solutionFrameColor;
            const fillOpacity = normalizedOpacity;
            const radius = solutionStrokeThickness / 2; // Always rounded ends
            const filter = 'url(#shadow)';
            const padding = Math.min(scaledLayout.cellSize * 0.08, 3);

            if (highlight.startX !== undefined && highlight.startY !== undefined && highlight.endX !== undefined && highlight.endY !== undefined) {
              const dx = highlight.endX - highlight.startX;
              const dy = highlight.endY - highlight.startY;
              const distance = Math.sqrt(dx * dx + dy * dy);
              const centerX = (highlight.startX + highlight.endX) / 2;
              const centerY = (highlight.startY + highlight.endY) / 2;
              const angle = Math.atan2(dy, dx) * (180 / Math.PI);
              const width = distance + padding * 2;
              const height = solutionStrokeThickness;

              return (
                <g key={idx} filter={filter}>
                  <rect
                    x={centerX - width / 2}
                    y={centerY - height / 2}
                    width={width}
                    height={height}
                    rx={radius}
                    ry={radius}
                    fill={fill}
                    fillOpacity={fillOpacity}
                    strokeLinejoin="round"
                    transform={`rotate(${angle} ${centerX} ${centerY})`}
                  />
                </g>
              );
            }

            const effectiveRadius = Math.min(highlight.height / 2, 6);

            return (
              <rect
                key={idx}
                x={highlight.x}
                y={highlight.y}
                width={highlight.width}
                height={highlight.height}
                rx={effectiveRadius}
                ry={effectiveRadius}
                fill={fill}
                fillOpacity={fillOpacity}
                strokeLinejoin="round"
                filter={filter}
              />
            );
          })}
        </svg>
      </div>
    </div>
  );
}