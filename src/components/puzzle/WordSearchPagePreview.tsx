'use client';

import React, { useMemo } from 'react';
import { WordSearchPuzzle, WordSearchSettings, TitleWordsSettings } from '@/lib/puzzles/types';
import {
  computeWordSearchPageLayout,
  distributeWordsIntoColumns,
  getWordListRowTopOffsetPt,
  layoutPtToCss,
  UnifiedPageLayout,
} from '@/lib/word-search-page-layout';
import { WordSearchGrid } from './WordSearchGrid';

interface WordSearchPagePreviewProps {
  puzzle: WordSearchPuzzle;
  settings: WordSearchSettings;
  titleWords: TitleWordsSettings;
  showSolution: boolean;
  className?: string;
  puzzleGridScale?: number;
  titleToAnswerGap?: number;
}

function WordListPreview({ layout }: { layout: UnifiedPageLayout }) {
  const wl = layout.wordList;
  if (!wl) return null;

  const columns = distributeWordsIntoColumns(wl.words, wl.columns);
  const leftPx = layoutPtToCss(wl.contentLeftPt);

  return (
    <div
      style={{
        position: 'absolute',
        top: layoutPtToCss(wl.topPt - layout.page.marginPt),
        left: leftPx,
        minWidth: layoutPtToCss(wl.blockWidthPt),
        fontFamily: wl.fontFamily,
        fontSize: layoutPtToCss(wl.fontSizePt),
        fontWeight: 400,
        color: wl.color,
        display: 'flex',
        flexDirection: 'row',
        gap: layoutPtToCss(wl.columnGapPt),
        textAlign: 'left',
        overflow: 'visible',
        flexWrap: 'nowrap',
      }}
    >
      {columns.map((col, colIdx) => (
        <div
          key={colIdx}
          style={{
            position: 'relative',
            minWidth: layoutPtToCss(wl.columnWidthsPt[colIdx]),
            width: 'auto',
            flex: '0 0 auto',
            height: layoutPtToCss(col.length * wl.lineHeightPt),
            overflow: 'visible',
          }}
        >
          {col.map((word, rowIdx) => (
            <div
              key={`${colIdx}-${rowIdx}`}
              className="flex items-center"
              style={{
                position: 'absolute',
                top: layoutPtToCss(getWordListRowTopOffsetPt(rowIdx, wl.lineHeightPt)),
                left: 0,
                height: layoutPtToCss(wl.lineHeightPt),
                lineHeight: `${layoutPtToCss(wl.fontSizePt)}px`,
                fontWeight: 400,
                gap: layoutPtToCss(wl.checkboxGapPt),
              }}
            >
              {wl.addCheckboxes && (
                <span
                  className="border border-current shrink-0"
                  style={{
                    width: layoutPtToCss(wl.checkboxSizePt),
                    height: layoutPtToCss(wl.checkboxSizePt),
                    borderColor: wl.checkboxColor,
                  }}
                />
              )}
              <span
                style={{
                  whiteSpace: 'nowrap',
                  display: 'inline-flex',
                  flexShrink: 0,
                  wordBreak: 'normal',
                  overflowWrap: 'normal',
                }}
              >
                {word}
              </span>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

export function WordSearchPagePreview({
  puzzle,
  settings,
  titleWords,
  showSolution,
  className,
  puzzleGridScale = 100,
  titleToAnswerGap,
}: WordSearchPagePreviewProps) {
  const layout = useMemo(
    () => computeWordSearchPageLayout(puzzle, settings, titleWords, showSolution, puzzleGridScale, titleToAnswerGap),
    [puzzle, settings, titleWords, showSolution, puzzleGridScale, titleToAnswerGap]
  );

  const { page, title, subtitle, grid, wordList } = layout;

  return (
    <div
      className={className}
      style={{
        position: 'relative',
        width: `${page.widthIn}in`,
        height: `${page.heightIn}in`,
        aspectRatio: `${page.widthIn} / ${page.heightIn}`,
        backgroundColor: page.backgroundColor,
        boxSizing: 'border-box',
        overflow: 'hidden',
      }}
    >
      {/* Inner printable area (margin) */}
      <div
        style={{
          position: 'absolute',
          inset: `${page.marginIn}in`,
          boxSizing: 'border-box',
        }}
      >
        {title && (
          <div
            style={{
              position: 'absolute',
              top: layoutPtToCss(title.topPt - page.marginPt),
              left: 0,
              right: 0,
              textAlign: title.align,
              fontFamily: title.fontFamily,
              fontSize: layoutPtToCss(title.fontSizePt),
              fontWeight: 700,
              color: title.color,
              lineHeight: 1.1,
              margin: 0,
              padding: 0,
            }}
          >
            {title.text}
          </div>
        )}

        {subtitle && (
          <div
            style={{
              position: 'absolute',
              top: layoutPtToCss(subtitle.topPt - page.marginPt),
              left: layoutPtToCss(page.marginPt),
              right: layoutPtToCss(page.marginPt),
              textAlign: 'center',
              fontFamily: subtitle.fontFamily,
              fontSize: layoutPtToCss(subtitle.fontSizePt),
              color: subtitle.color,
              lineHeight: 1.3,
              wordWrap: 'break-word',
              overflowWrap: 'break-word',
              wordBreak: 'break-word',
              whiteSpace: 'normal',
              maxWidth: '100%',
            }}
          >
            {subtitle.text}
          </div>
        )}

        <div
          style={{
            position: 'absolute',
            top: layoutPtToCss(grid.topPt - page.marginPt - (grid.framePaddingPt || 0)),
            left: layoutPtToCss(grid.leftPt - page.marginPt - (grid.framePaddingPt || 0)),
            width: layoutPtToCss(grid.widthPt + (grid.framePaddingPt || 0) * 2),
            height: layoutPtToCss(grid.heightPt + (grid.framePaddingPt || 0) * 2),
          }}
        >
          <WordSearchGrid
            puzzle={puzzle}
            showSolution={showSolution}
            cellSize={layoutPtToCss(grid.cellSizePt)}
            noBoxAroundPuzzle={grid.noBox}
            borderStrokeThickness={layoutPtToCss(grid.borderThicknessPt)}
            gridBorderPadding={layoutPtToCss(grid.framePaddingPt || 0)}
            borderRadius={settings.core.borderCornerRadius ?? 4}
            puzzleColor={grid.letterColor}
            boxColor={grid.boxColor}
            puzzleGridFontSize={layoutPtToCss(grid.fontSizePt)}
            puzzleGridFontFamily={grid.fontFamily}
            answerGridFontSize={showSolution ? layoutPtToCss(grid.fontSizePt) : undefined}
            answerGridFontFamily={showSolution ? grid.fontFamily : undefined}
            wordList={[]}
          />
        </div>

        {!showSolution && wordList && <WordListPreview layout={layout} />}
      </div>
    </div>
  );
}
