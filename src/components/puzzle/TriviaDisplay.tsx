'use client';

/**
 * Trivia page preview — matches printable quiz layout (questions + checkbox options).
 * Solution pages group answers under "Trivia #N" headings (numbers restart per game).
 */

import React from 'react';
import type { TriviaPuzzle } from '@/lib/puzzles/types';
import type {
  TriviaCheckboxStyle,
  TriviaLayoutFormat,
  TriviaSuggestionsColumns,
} from '@/lib/generic-puzzle-settings';
import {
  computeTriviaSolutionColumns,
  formatTriviaSolutionHeading,
  resolveTriviaAnswerLabel,
} from '@/lib/puzzles/trivia';

export interface TriviaSolutionSection {
  label: string;
  answers: string[];
}

interface TriviaDisplayProps {
  puzzle: TriviaPuzzle;
  showSolution?: boolean;
  layoutFormat?: TriviaLayoutFormat;
  checkboxStyle?: TriviaCheckboxStyle;
  suggestionsColumns?: TriviaSuggestionsColumns;
  fontSize?: number;
  fontFamily?: string;
  textColor?: string;
  maxWidthPx?: number;
  /** Vertical gap between question blocks (px). */
  questionGapPx?: number;
  /** Gap between suggestion rows (px). */
  suggestionGapPx?: number;
  /** Gap under question before suggestions (px). */
  afterQuestionGapPx?: number;
  /** Side-by-side answer columns on solution pages (1–4). */
  solutionColumns?: number;
  /** Max answers in each solution column (used when packing rows into columns). */
  answersPerColumn?: number;
  /**
   * Solution groups (Trivia #1, Trivia #2, …). When omitted, the current puzzle
   * is shown as a single group with numbers restarting at 1.
   */
  solutionSections?: TriviaSolutionSection[];
  /** Starting trivia number when building a single-section fallback label. */
  puzzlesStartingNumber?: number;
}

function CheckboxMark({
  style,
  checked,
  color,
  size,
}: {
  style: TriviaCheckboxStyle;
  checked: boolean;
  color: string;
  size: number;
}) {
  const radius = style === 'circle' ? '50%' : Math.max(2, size * 0.15);
  return (
    <span
      aria-hidden
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: size,
        height: size,
        flexShrink: 0,
        border: `1.5px solid ${checked ? color : '#9ca3af'}`,
        borderRadius: radius,
        background: checked ? color : '#f3f4f6',
        color: checked ? '#fff' : 'transparent',
        fontSize: size * 0.65,
        fontWeight: 700,
        lineHeight: 1,
        boxSizing: 'border-box',
        marginTop: 2,
      }}
    >
      {checked ? '✓' : ''}
    </span>
  );
}

function AnswerColumnList({
  rows,
  fontSize,
  optionFontSize,
  gap,
  numberColWidth,
}: {
  rows: Array<{ number: number; answer: string }>;
  fontSize: number;
  optionFontSize: number;
  gap: number;
  numberColWidth: number;
}) {
  return (
    <div style={{ width: '100%', minWidth: 0 }}>
      {rows.map((row) => (
        <div
          key={`sol-a-${row.number}`}
          style={{
            display: 'grid',
            gridTemplateColumns: `${numberColWidth}px minmax(0, 1fr)`,
            columnGap: Math.max(4, fontSize * 0.35),
            padding: `${Math.max(2, gap * 0.4)}px 0`,
            alignItems: 'start',
          }}
        >
          <span
            style={{
              fontWeight: 600,
              fontSize,
              lineHeight: 1.35,
              whiteSpace: 'nowrap',
            }}
          >
            {row.number}.
          </span>
          <span
            style={{
              fontWeight: 500,
              fontSize: optionFontSize,
              lineHeight: 1.35,
              wordBreak: 'break-word',
            }}
          >
            {row.answer}
          </span>
        </div>
      ))}
    </div>
  );
}

function SolutionSectionBlock({
  section,
  columns,
  fontSize,
  optionFontSize,
  gap,
  textColor,
  numberColWidth,
  sectionGapPx,
}: {
  section: TriviaSolutionSection;
  columns: number;
  fontSize: number;
  optionFontSize: number;
  gap: number;
  textColor: string;
  numberColWidth: number;
  sectionGapPx: number;
}) {
  const allRows = section.answers.map((answer, i) => ({
    number: i + 1,
    answer,
  }));
  const columnChunks: Array<Array<{ number: number; answer: string }>> = [];
  const colCount = Math.max(1, columns);
  // Spread this trivia game's answers evenly across columns (all answers shown).
  const rowsPerCol = Math.max(1, Math.ceil(allRows.length / colCount));

  for (let c = 0; c < colCount; c++) {
    const start = c * rowsPerCol;
    const chunk = allRows.slice(start, start + rowsPerCol);
    if (chunk.length > 0) columnChunks.push(chunk);
  }
  if (columnChunks.length === 0) columnChunks.push([]);

  return (
    <div
      style={{
        width: '100%',
        breakInside: 'avoid',
        marginBottom: sectionGapPx,
      }}
    >
      <p
        style={{
          margin: `0 0 ${Math.max(4, fontSize * 0.45)}px`,
          fontSize: Math.max(fontSize, optionFontSize * 1.05),
          fontWeight: 700,
          lineHeight: 1.3,
          color: textColor,
        }}
      >
        {section.label}
      </p>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${columnChunks.length}, minmax(0, 1fr))`,
          columnGap: Math.max(10, fontSize * (colCount >= 3 ? 0.7 : 1.1)),
          alignItems: 'start',
        }}
      >
        {columnChunks.map((rows, ci) => (
          <AnswerColumnList
            key={`sol-col-${section.label}-${ci}`}
            rows={rows}
            fontSize={fontSize}
            optionFontSize={optionFontSize}
            gap={gap}
            numberColWidth={numberColWidth}
          />
        ))}
      </div>
    </div>
  );
}

export function TriviaDisplay({
  puzzle,
  showSolution = false,
  layoutFormat = 'single-column',
  checkboxStyle = 'circle',
  suggestionsColumns = 'single',
  fontSize = 14,
  fontFamily = 'Arial',
  textColor = '#1f2937',
  maxWidthPx,
  questionGapPx,
  suggestionGapPx,
  afterQuestionGapPx,
  solutionColumns,
  answersPerColumn,
  solutionSections,
  puzzlesStartingNumber = 1,
}: TriviaDisplayProps) {
  const questions = puzzle.questions ?? [];
  // Each trivia game page numbers questions from 1.
  const startNumber = 1;
  const gap =
    questionGapPx ??
    (layoutFormat === 'compact' ? fontSize * 1.1 : fontSize * 1.85);
  const optionFontSize = Math.max(10, fontSize * 0.95);
  const boxSize = Math.max(14, fontSize * 1.05);
  const isTwoCol = !showSolution && layoutFormat === 'two-column';
  const suggestionsTwoCol = !showSolution && suggestionsColumns === 'two';

  const optionGap =
    suggestionGapPx ??
    (layoutFormat === 'compact' ? fontSize * 0.28 : fontSize * 0.42);
  const questionBlockGap =
    layoutFormat === 'compact' ? Math.min(gap, fontSize * 0.9) : gap;
  const afterQuestionGap =
    afterQuestionGapPx ??
    (layoutFormat === 'compact' ? fontSize * 0.35 : fontSize * 0.55);

  if (showSolution) {
    const columns = computeTriviaSolutionColumns(solutionColumns);
    const sections: TriviaSolutionSection[] =
      solutionSections && solutionSections.length > 0
        ? solutionSections
        : [
            {
              label: formatTriviaSolutionHeading(puzzle, 0, puzzlesStartingNumber),
              answers: questions.map((q) => resolveTriviaAnswerLabel(q)),
            },
          ];
    const numberColWidth = Math.max(22, fontSize * (columns >= 3 ? 1.55 : 1.9));
    const sectionGapPx = Math.max(gap, fontSize * 1.1);

    return (
      <div
        style={{
          width: '100%',
          maxWidth: maxWidthPx,
          fontFamily,
          color: textColor,
          boxSizing: 'border-box',
        }}
      >
        {sections.map((section, si) => {
          return (
            <SolutionSectionBlock
              key={`trivia-sol-${si}-${section.label}`}
              section={section}
              columns={columns}
              fontSize={fontSize}
              optionFontSize={optionFontSize}
              gap={gap}
              textColor={textColor}
              numberColWidth={numberColWidth}
              sectionGapPx={si === sections.length - 1 ? 0 : sectionGapPx}
            />
          );
        })}
      </div>
    );
  }

  return (
    <div
      style={{
        width: '100%',
        maxWidth: maxWidthPx,
        fontFamily,
        color: textColor,
        display: isTwoCol ? 'grid' : 'flex',
        flexDirection: 'column',
        gridTemplateColumns: isTwoCol ? '1fr 1fr' : undefined,
        rowGap: isTwoCol ? questionBlockGap * 0.85 : questionBlockGap,
        columnGap: isTwoCol ? fontSize * 1.5 : undefined,
        alignContent: 'start',
      }}
    >
      {questions.map((q, qi) => {
        const number = startNumber + qi;
        return (
          <div
            key={`q-${number}`}
            style={{
              display: 'flex',
              flexDirection: 'column',
              rowGap: afterQuestionGap,
              breakInside: 'avoid',
            }}
          >
            <p
              style={{
                margin: 0,
                fontSize,
                fontWeight: 600,
                lineHeight: 1.35,
                textAlign: 'left',
              }}
            >
              {number}. {q.prompt}
            </p>
            <div
              style={{
                display: suggestionsTwoCol ? 'grid' : 'flex',
                flexDirection: suggestionsTwoCol ? undefined : 'column',
                gridTemplateColumns: suggestionsTwoCol ? '1fr 1fr' : undefined,
                rowGap: optionGap,
                columnGap: suggestionsTwoCol ? fontSize * 1.1 : undefined,
                paddingLeft: fontSize * 0.15,
              }}
            >
              {(q.suggestions ?? []).map((suggestion, si) => (
                <div
                  key={`q-${number}-s-${si}`}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: fontSize * 0.55,
                    minWidth: 0,
                  }}
                >
                  <CheckboxMark
                    style={checkboxStyle}
                    checked={false}
                    color={textColor}
                    size={boxSize}
                  />
                  <span
                    style={{
                      fontSize: optionFontSize,
                      fontWeight: 400,
                      lineHeight: 1.35,
                      textAlign: 'left',
                    }}
                  >
                    {suggestion}
                  </span>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
