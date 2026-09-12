'use client';

import React, { useMemo } from 'react';
import { CryptogramPuzzle } from '@/lib/puzzles/types';

interface CryptogramDisplayProps {
  puzzle: CryptogramPuzzle;
  showSolution?: boolean;
  cipherFormat?: 'lines' | 'boxes';
  letterCase?: 'upper' | 'lower';
  showLetterHints?: boolean;
  /** Alphabet answer-key rows: 1, 2, or 3. */
  answerKeyLines?: 1 | 2 | 3;
  /** When true on solution pages, show only the decoded sentence. */
  solutionOnlyAnswers?: boolean;
  fontSize?: number;
  fontFamily?: string;
  answerFontSize?: number;
  answerFontFamily?: string;
  /** Answer-key glyph size in px (always 18pt from parent). */
  answerKeyFontSizePx?: number;
  answerKeyFontFamily?: string;
  /** Gap under the answer-key table before the puzzle (px). */
  answerKeyGapPx?: number;
  /** Gap between wrapped puzzle lines / word rows (px). */
  puzzleLineGapPx?: number;
  textColor?: string;
  maxWidthPx?: number;
}

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

function applyCase(value: string, letterCase: 'upper' | 'lower') {
  return letterCase === 'lower' ? value.toLowerCase() : value.toUpperCase();
}

/** Split leading/trailing punctuation from the letter/digit body of a token. */
function splitPunctuation(token: string): {
  leading: string;
  body: string;
  trailing: string;
} {
  const leadingMatch = token.match(/^[^A-Za-z0-9]*/);
  const trailingMatch = token.match(/[^A-Za-z0-9]*$/);
  const leading = leadingMatch?.[0] ?? '';
  const trailing =
    token.length > leading.length ? (trailingMatch?.[0] ?? '') : '';
  const body = token.slice(leading.length, token.length - trailing.length);
  return { leading, body, trailing };
}

function chunkAlphabet(lines: 1 | 2 | 3): string[][] {
  if (lines === 1) return [ALPHABET];
  if (lines === 2) return [ALPHABET.slice(0, 13), ALPHABET.slice(13)];
  return [ALPHABET.slice(0, 9), ALPHABET.slice(9, 18), ALPHABET.slice(18)];
}

function CryptogramAnswerKeyTable({
  puzzle,
  letterCase,
  answerKeyLines,
  textColor,
  maxWidthPx,
  fontSizePx,
  fontFamily,
  gapBelowPx,
}: {
  puzzle: CryptogramPuzzle;
  letterCase: 'upper' | 'lower';
  answerKeyLines: 1 | 2 | 3;
  textColor: string;
  maxWidthPx?: number;
  fontSizePx: number;
  fontFamily: string;
  gapBelowPx: number;
}) {
  const hintSet = useMemo(
    () => new Set((puzzle.hintLetters ?? []).map((l) => l.toUpperCase())),
    [puzzle.hintLetters]
  );

  /** plaintext letter → cipher token (letter or number string) */
  const plainToCipher = useMemo(() => {
    const map: Record<string, string> = {};
    for (const [token, original] of Object.entries(puzzle.letterMapping)) {
      map[original.toUpperCase()] = token;
    }
    return map;
  }, [puzzle.letterMapping]);

  const rows = chunkAlphabet(answerKeyLines);
  const availableWidth = Math.max(120, maxWidthPx ?? 520);
  const maxCols = Math.max(...rows.map((r) => r.length));
  // Stretch across the full safe/content width.
  const cellSize = Math.max(8, Math.floor(availableWidth / maxCols));
  const fontPx = fontSizePx;
  const thinBorder = `1px solid ${textColor}`;
  const rowGap = Math.max(6, Math.round(cellSize * 0.22));

  return (
    <div
      className="w-full"
      style={{
        maxWidth: maxWidthPx,
        width: '100%',
        color: textColor,
        marginBottom: gapBelowPx,
        fontFamily,
      }}
    >
      <div className="flex flex-col w-full" style={{ gap: rowGap }}>
        {rows.map((letters, rowIdx) => {
          const rowCell =
            letters.length === maxCols
              ? cellSize
              : Math.max(8, Math.floor(availableWidth / letters.length));
          return (
            <div
              key={rowIdx}
              style={{
                display: 'grid',
                gridTemplateColumns: `repeat(${letters.length}, minmax(0, 1fr))`,
                gridTemplateRows: `${rowCell}px ${rowCell}px`,
                borderTop: thinBorder,
                borderLeft: thinBorder,
                width: '100%',
                boxSizing: 'border-box',
              }}
            >
              {letters.map((letter) => (
                <span
                  key={`top-${letter}`}
                  style={{
                    boxSizing: 'border-box',
                    borderRight: thinBorder,
                    borderBottom: thinBorder,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: fontPx,
                    fontWeight: 600,
                    lineHeight: 1,
                    fontFamily,
                  }}
                >
                  {applyCase(letter, letterCase)}
                </span>
              ))}
              {letters.map((letter) => {
                const showHint = hintSet.has(letter);
                const cipher = plainToCipher[letter] ?? '';
                const bottom = showHint ? applyCase(cipher, letterCase) : '';
                return (
                  <span
                    key={`bot-${letter}`}
                    style={{
                      boxSizing: 'border-box',
                      borderRight: thinBorder,
                      borderBottom: thinBorder,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize:
                        cipher.length > 1 ? Math.max(8, fontPx * 0.72) : fontPx,
                      fontWeight: 600,
                      lineHeight: 1,
                      fontFamily,
                    }}
                  >
                    {bottom}
                  </span>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function CryptogramDisplay({
  puzzle,
  showSolution = false,
  cipherFormat = 'lines',
  letterCase = 'upper',
  showLetterHints = true,
  answerKeyLines = 2,
  solutionOnlyAnswers = false,
  fontSize = 16,
  fontFamily = 'Arial',
  answerFontSize,
  answerFontFamily,
  answerKeyFontSizePx,
  answerKeyFontFamily = 'Arial',
  answerKeyGapPx = 16,
  puzzleLineGapPx = 10,
  textColor = '#1f2937',
  maxWidthPx,
}: CryptogramDisplayProps) {
  const cipherType = puzzle.cipherType ?? 'letters';
  const hintSet = new Set((puzzle.hintLetters ?? []).map((l) => l.toUpperCase()));
  const useLetterBoxes = cipherFormat === 'boxes' && cipherType === 'letters';
  const solutionFontSize = answerFontSize ?? fontSize;
  const solutionFontFamily = answerFontFamily ?? fontFamily;
  const keyFontPx = answerKeyFontSizePx ?? Math.round(fontSize * 1.125);

  const words =
    cipherType === 'numbers'
      ? puzzle.encodedText.split(/\s+/).filter(Boolean)
      : puzzle.encodedText.split(' ').filter((w) => w.length > 0);
  const originalWords = puzzle.originalText.split(' ').filter((w) => w.length > 0);

  const cellSize = Math.max(18, Math.round(fontSize * 1.35));
  const thinBorder = `1px solid ${textColor}`;
  const lineGap = Math.max(0, puzzleLineGapPx);
  const wordGap = Math.max(8, Math.round(lineGap * 1.1));

  const tokenStyle = (isLetter: boolean): React.CSSProperties => {
    if (!isLetter) return {};
    if (cipherFormat === 'boxes') {
      return {
        border: `1.5px solid ${textColor}`,
        borderRadius: 2,
        minWidth: '1.1em',
        minHeight: '1.35em',
        padding: '0 2px',
        margin: '0 1px',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily,
      };
    }
    return {
      minWidth: '0.95em',
      display: 'inline-flex',
      flexDirection: 'column',
      alignItems: 'center',
      fontFamily,
    };
  };

  /** Lines format: blank writing line above, cipher glyph below. */
  const renderLineToken = (
    cipherText: string,
    answerText: string,
    key: string | number,
    isCipherToken: boolean
  ) => {
    if (!isCipherToken) {
      return (
        <span key={key} style={{ alignSelf: 'flex-end', paddingBottom: 2, fontFamily }}>
          {cipherText}
        </span>
      );
    }
    const topLineH = Math.max(16, Math.round(fontSize * 1.15));
    return (
      <span key={key} style={tokenStyle(true)}>
        <span
          style={{
            width: '100%',
            minWidth: cipherText.length > 1 ? `${cipherText.length * 0.65}em` : '0.95em',
            height: topLineH,
            borderBottom: `2px solid ${textColor}`,
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'center',
            fontSize: Math.max(10, fontSize * 0.9),
            fontWeight: 600,
            lineHeight: 1,
            paddingBottom: 1,
            boxSizing: 'border-box',
          }}
        >
          {answerText}
        </span>
        <span
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: Math.max(14, Math.round(fontSize * 1.05)),
            fontSize,
            fontWeight: 600,
            lineHeight: 1.1,
            paddingTop: 2,
          }}
        >
          {cipherText}
        </span>
      </span>
    );
  };

  const renderLetterBoxWord = (encodedWord: string, originalWord: string, key: number) => {
    const enc = splitPunctuation(encodedWord);
    const orig = splitPunctuation(originalWord);
    const cols = enc.body.length;
    if (cols === 0) {
      return (
        <span key={key} className="inline-flex items-end" style={{ gap: 2 }}>
          {enc.leading || enc.trailing ? (
            <span style={{ lineHeight: `${cellSize}px`, fontSize, fontFamily }}>
              {enc.leading + enc.trailing}
            </span>
          ) : null}
        </span>
      );
    }

    const cells = Array.from({ length: cols }, (_, j) => {
      const cipherChar = enc.body[j] ?? '';
      const originalChar = orig.body[j] ?? '';
      const isLetter = /[A-Z0-9]/i.test(cipherChar);
      const revealed = isLetter && hintSet.has(originalChar.toUpperCase());
      let topText = '';
      if (showSolution && isLetter) {
        topText = applyCase(originalChar || puzzle.letterMapping[cipherChar] || '', letterCase);
      } else if (revealed) {
        topText = applyCase(originalChar, letterCase);
      }
      return {
        topText,
        bottomText: isLetter ? applyCase(cipherChar, letterCase) : cipherChar,
      };
    });

    return (
      <span
        key={key}
        className="inline-flex items-end"
        style={{ gap: Math.max(2, Math.round(fontSize * 0.15)) }}
      >
        {enc.leading ? (
          <span
            style={{
              lineHeight: `${cellSize}px`,
              fontSize,
              fontFamily,
              alignSelf: 'flex-end',
            }}
          >
            {enc.leading}
          </span>
        ) : null}
        <span
          style={{
            display: 'grid',
            gridTemplateColumns: `repeat(${cols}, ${cellSize}px)`,
            gridTemplateRows: `${cellSize}px ${cellSize}px`,
            borderTop: thinBorder,
            borderLeft: thinBorder,
            boxSizing: 'border-box',
          }}
        >
          {cells.map((cell, j) => (
            <span
              key={`t-${j}`}
              style={{
                boxSizing: 'border-box',
                borderRight: thinBorder,
                borderBottom: thinBorder,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: Math.max(10, fontSize * 0.92),
                fontWeight: 600,
                lineHeight: 1,
                fontFamily,
              }}
            >
              {cell.topText}
            </span>
          ))}
          {cells.map((cell, j) => (
            <span
              key={`b-${j}`}
              style={{
                boxSizing: 'border-box',
                borderRight: thinBorder,
                borderBottom: thinBorder,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: Math.max(10, fontSize * 0.92),
                fontWeight: 600,
                lineHeight: 1,
                fontFamily,
              }}
            >
              {cell.bottomText}
            </span>
          ))}
        </span>
        {enc.trailing ? (
          <span
            style={{
              lineHeight: `${cellSize}px`,
              fontSize,
              fontFamily,
              alignSelf: 'flex-end',
              paddingBottom: 1,
            }}
          >
            {enc.trailing}
          </span>
        ) : null}
      </span>
    );
  };

  if (showSolution && solutionOnlyAnswers) {
    return (
      <div
        className="inline-block max-w-full w-full"
        style={{
          color: textColor,
          fontSize: solutionFontSize,
          fontFamily: solutionFontFamily,
          maxWidth: maxWidthPx,
          width: '100%',
        }}
      >
        <p
          className="text-center font-medium leading-relaxed"
          style={{
            fontSize: solutionFontSize,
            fontFamily: solutionFontFamily,
            margin: 0,
          }}
        >
          {applyCase(puzzle.originalText, letterCase)}
        </p>
      </div>
    );
  }

  return (
    <div
      className="inline-block max-w-full w-full"
      style={{
        color: textColor,
        fontSize,
        fontFamily,
        maxWidth: maxWidthPx,
        width: '100%',
      }}
    >
      {showLetterHints && !showSolution ? (
        <CryptogramAnswerKeyTable
          puzzle={puzzle}
          letterCase={letterCase}
          answerKeyLines={answerKeyLines}
          textColor={textColor}
          maxWidthPx={maxWidthPx}
          fontSizePx={keyFontPx}
          fontFamily={answerKeyFontFamily}
          gapBelowPx={answerKeyGapPx}
        />
      ) : null}

      {useLetterBoxes ? (
        <div
          className="flex flex-wrap justify-start"
          style={{
            columnGap: wordGap,
            rowGap: lineGap,
            alignItems: 'flex-end',
          }}
        >
          {words.map((word, i) =>
            renderLetterBoxWord(word, originalWords[i] ?? '', i)
          )}
        </div>
      ) : (
        <div
          className="flex flex-wrap justify-center"
          style={{ columnGap: wordGap, rowGap: lineGap, alignItems: 'flex-end' }}
        >
          {words.map((word, i) => {
            if (cipherType === 'numbers') {
              const isNum = /^\d+$/.test(word);
              const answer = showSolution
                ? applyCase(puzzle.letterMapping[word] ?? '', letterCase)
                : '';
              return renderLineToken(
                isNum ? word : word,
                answer,
                i,
                isNum
              );
            }

            const enc = splitPunctuation(word);
            const orig = splitPunctuation(originalWords[i] ?? '');
            return (
              <span
                key={i}
                className="inline-flex items-end"
                style={{ gap: Math.max(2, Math.round(fontSize * 0.12)), fontFamily }}
              >
                {enc.leading
                  ? renderLineToken(enc.leading, '', `L-${i}`, false)
                  : null}
                {enc.body.split('').map((char, j) => {
                  const isLetter = /[A-Z0-9]/i.test(char);
                  const originalChar = orig.body[j] ?? '';
                  const revealed = isLetter && hintSet.has(originalChar.toUpperCase());
                  let answerText = '';
                  if (showSolution && isLetter) {
                    answerText = applyCase(
                      originalChar || puzzle.letterMapping[char] || '',
                      letterCase
                    );
                  } else if (revealed) {
                    answerText = applyCase(originalChar, letterCase);
                  }
                  return renderLineToken(
                    isLetter ? applyCase(char, letterCase) : char,
                    answerText,
                    `${i}-${j}`,
                    isLetter
                  );
                })}
                {enc.trailing
                  ? renderLineToken(enc.trailing, '', `T-${i}`, false)
                  : null}
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}
