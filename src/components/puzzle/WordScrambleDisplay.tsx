'use client';

import React from 'react';
import { WordScramblePuzzle } from '@/lib/puzzles/types';
import type { ScrambleAnswerStyle } from '@/lib/generic-puzzle-settings';

interface WordScrambleDisplayProps {
  puzzle: WordScramblePuzzle;
  showSolution?: boolean;
  letterCase?: 'upper' | 'lower';
  afterScrambled?: 'equal' | 'blank';
  answerBlankStyle?: ScrambleAnswerStyle;
  includeWordBank?: boolean;
  wordBankTitle?: string;
  fontSize?: number;
  fontFamily?: string;
  textColor?: string;
  maxWidthPx?: number;
  /** Vertical gap between word rows (px). */
  spaceBetweenWordsPx?: number;
  /** Letter-spacing for scrambled letters and blanks (em). */
  spaceBetweenLettersEm?: number;
  /** Keep each scramble row on a single line (used for 4-up). */
  keepRowsOnOneLine?: boolean;
}

type ScrambleWord = { original: string; scrambled: string };

function applyCase(value: string, letterCase: 'upper' | 'lower') {
  return letterCase === 'lower' ? value.toLowerCase() : value.toUpperCase();
}

function letterCount(word: string) {
  return Math.max(4, word.replace(/[\s-]/g, '').length);
}

function blankFor(word: string, style: Exclude<ScrambleAnswerStyle, 'boxes'>) {
  const len = letterCount(word);
  if (style === 'blank') return '\u00A0'.repeat(len);
  if (style === 'underline') return '_'.repeat(len);
  return Array.from({ length: len }, () => '-').join(' ');
}

function BoxesRow({
  word,
  showLetters,
  letterCase,
  letterSpacingEm,
  color,
  fontSize,
}: {
  word: string;
  showLetters: boolean;
  letterCase: 'upper' | 'lower';
  letterSpacingEm: number;
  color: string;
  fontSize: number;
}) {
  const letters = word.replace(/[\s-]/g, '').split('');
  const boxSize = Math.max(12, fontSize * 1.1);
  return (
    <span
      className="inline-flex items-center"
      style={{ gap: `${Math.max(1, letterSpacingEm * fontSize)}px`, flexShrink: 0 }}
    >
      {letters.map((ch, i) => (
        <span
          key={`${i}-${ch}`}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: boxSize,
            height: boxSize,
            border: `1.5px solid ${color}`,
            borderRadius: 2,
            boxSizing: 'border-box',
            fontWeight: showLetters ? 600 : 400,
            lineHeight: 1,
            flexShrink: 0,
          }}
        >
          {showLetters ? applyCase(ch, letterCase) : '\u00A0'}
        </span>
      ))}
    </span>
  );
}

function normalizeWords(raw: unknown): ScrambleWord[] {
  if (!Array.isArray(raw)) return [];
  const out: ScrambleWord[] = [];
  for (const entry of raw) {
    if (typeof entry === 'string') {
      const original = entry.trim();
      if (original.length >= 2) out.push({ original, scrambled: original });
      continue;
    }
    if (!entry || typeof entry !== 'object') continue;
    const original = String((entry as ScrambleWord).original || '').trim();
    const scrambled = String(
      (entry as ScrambleWord).scrambled || (entry as ScrambleWord).original || ''
    ).trim();
    if (original.length >= 2) {
      out.push({ original, scrambled: scrambled || original });
    }
  }
  return out;
}

export function WordScrambleDisplay({
  puzzle,
  showSolution = false,
  letterCase = 'upper',
  afterScrambled = 'equal',
  answerBlankStyle = 'underline',
  includeWordBank = false,
  wordBankTitle = 'Word Bank',
  fontSize = 16,
  fontFamily = 'Arial',
  textColor = '#1f2937',
  maxWidthPx,
  spaceBetweenWordsPx,
  spaceBetweenLettersEm = 0.12,
  keepRowsOnOneLine = false,
}: WordScrambleDisplayProps) {
  const words = normalizeWords(puzzle?.words);
  const bankWords = includeWordBank
    ? [...words.map((w) => w.original)].sort((a, b) => a.localeCompare(b))
    : [];

  const safeFontSize = Number.isFinite(fontSize) && fontSize > 0 ? fontSize : 16;
  const wordGap =
    Number.isFinite(spaceBetweenWordsPx) && (spaceBetweenWordsPx as number) >= 0
      ? (spaceBetweenWordsPx as number)
      : Math.max(4, safeFontSize * 0.4);
  const letterEm =
    Number.isFinite(spaceBetweenLettersEm) && spaceBetweenLettersEm >= 0
      ? spaceBetweenLettersEm
      : 0.12;
  // Compact fixed gap between scramble and blank (control removed from UI).
  const scrambleBlankGap = Math.max(4, safeFontSize * 0.28);

  if (words.length === 0) {
    return (
      <div
        className="text-center text-slate-500"
        style={{
          fontSize: Math.max(12, safeFontSize * 0.9),
          maxWidth: maxWidthPx,
          width: '100%',
          padding: '12px 8px',
        }}
      >
        No scramble words to display. Click Generate to create puzzles.
      </div>
    );
  }

  return (
    <div
      className="block max-w-full"
      style={{
        color: textColor || '#1f2937',
        fontSize: safeFontSize,
        fontFamily: fontFamily || 'Arial',
        maxWidth: maxWidthPx,
        width: '100%',
      }}
    >
      <div
        style={{
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          gap: wordGap,
        }}
      >
        {words.map((word, index) => {
          const scrambled = applyCase(word.scrambled || word.original, letterCase);
          const original = applyCase(word.original, letterCase);
          const separator = afterScrambled === 'equal' ? '=' : '';

          return (
            <div
              key={`${index}-${word.original}`}
              className={keepRowsOnOneLine ? 'flex items-center' : 'flex items-center flex-wrap'}
              style={{
                lineHeight: 1.3,
                columnGap: scrambleBlankGap,
                rowGap: Math.max(2, wordGap * 0.3),
                whiteSpace: keepRowsOnOneLine ? 'nowrap' : undefined,
                minWidth: 0,
              }}
            >
              <span style={{ opacity: 0.55, minWidth: '1.4em', flexShrink: 0 }}>
                {index + 1}.
              </span>
              <span
                className="font-mono"
                style={{
                  letterSpacing: `${letterEm}em`,
                  whiteSpace: 'nowrap',
                  flexShrink: 0,
                }}
              >
                {scrambled}
              </span>
              {separator ? (
                <span style={{ flexShrink: 0, opacity: 0.85 }}>{separator}</span>
              ) : null}
              {answerBlankStyle === 'boxes' ? (
                <BoxesRow
                  word={word.original || 'WORD'}
                  showLetters={showSolution}
                  letterCase={letterCase}
                  letterSpacingEm={letterEm}
                  color={textColor || '#1f2937'}
                  fontSize={safeFontSize}
                />
              ) : (
                <span
                  style={{
                    letterSpacing: showSolution ? `${letterEm * 0.5}em` : `${letterEm}em`,
                    fontWeight: showSolution ? 600 : 400,
                    whiteSpace: 'nowrap',
                    flexShrink: 0,
                  }}
                >
                  {showSolution
                    ? original
                    : blankFor(
                        word.original || 'WORD',
                        answerBlankStyle === 'dash' ||
                          answerBlankStyle === 'underline' ||
                          answerBlankStyle === 'blank'
                          ? answerBlankStyle
                          : 'underline'
                      )}
                </span>
              )}
            </div>
          );
        })}
      </div>

      {includeWordBank && !showSolution && bankWords.length > 0 ? (
        <div
          className="pt-3"
          style={{
            marginTop: Math.max(10, wordGap * 1.5),
            borderTop: `1px solid ${textColor}33`,
          }}
        >
          <div
            className="font-bold mb-2 text-center"
            style={{ fontSize: Math.max(10, safeFontSize * 0.9) }}
          >
            {wordBankTitle}
          </div>
          <div
            className="grid gap-x-3 gap-y-1"
            style={{
              gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
              fontSize: Math.max(9, safeFontSize * 0.75),
              letterSpacing: `${letterEm * 0.5}em`,
            }}
          >
            {bankWords.map((w) => (
              <span key={w} className="text-center truncate">
                {applyCase(w, letterCase)}
              </span>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
