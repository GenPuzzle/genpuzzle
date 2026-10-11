/**
 * Font settings for native page text (title, grid, clues, word list).
 * The format bar writes these so Canvas Workspace edits stay in document settings.
 */

import type { CrosswordSettings } from './crossword-settings';
import { getHeaderAssemblySettings } from './generic-page-chrome';
import type { GenericPuzzleSettings } from './generic-puzzle-settings';
import { resolveHeaderNumberTextStyle } from './header-assembly/resolve-number-text';
import type { WordSearchSettings } from './puzzles/types';
import { normalizeTextEffect, type TextEffectStyle } from './text-effects';
import { mergeWordSearchSettingsUpdate } from './visual-settings-sync';

export type CanvasFormatTarget =
  | 'title'
  | 'subtitle'
  | 'header-number'
  | 'word-list'
  | 'grid'
  | 'maze-start'
  | 'maze-end'
  | 'clues'
  | 'clue-heading'
  | 'answer-key'
  | 'code-numbers'
  | 'code-letters'
  | 'math-equations'
  | 'math-path-numbers'
  | 'math-start-end'
  | 'suggestions'
  | 'page-number';

export interface NativeCanvasFont {
  fontFamily: string;
  fontSize: number;
  color: string;
  bold: boolean;
  italic: boolean;
  align: 'left' | 'center' | 'right';
  textEffect: TextEffectStyle;
}

export interface NativeCanvasPatch {
  fontFamily?: string;
  fontSize?: number;
  color?: string;
  bold?: boolean;
  italic?: boolean;
  align?: 'left' | 'center' | 'right';
  textEffect?: TextEffectStyle;
}

function headerNumberFont(
  wordSearch: WordSearchSettings,
  titleFontFamily: string,
  titleFontSize: number
): NativeCanvasFont {
  const style = resolveHeaderNumberTextStyle(
    getHeaderAssemblySettings(wordSearch).number,
    titleFontSize,
    titleFontFamily
  );
  return {
    fontFamily: style.fontFamily || titleFontFamily || 'Arial',
    fontSize: style.fontSizePt || titleFontSize || 24,
    color: style.textColor || '#111111',
    bold: true,
    italic: false,
    align: 'center',
    textEffect: 'none',
  };
}

export function nativeCanvasFont(
  target: CanvasFormatTarget,
  moduleType: string,
  wordSearch: WordSearchSettings,
  crossword: CrosswordSettings | null,
  generic: GenericPuzzleSettings | null,
  options?: { solutionPage?: boolean }
): NativeCanvasFont {
  const titleFamily =
    (moduleType === 'crossword' && crossword
      ? crossword.typography.puzzleTitleFontFamily
      : generic && moduleType !== 'word-search'
        ? generic.typography.puzzleTitleFontFamily
        : wordSearch.typography.puzzleTitleFontFamily) || 'Arial';
  const titleSize =
    (moduleType === 'crossword' && crossword
      ? crossword.typography.puzzleTitleFontSize
      : generic && moduleType !== 'word-search'
        ? generic.typography.puzzleTitleFontSize
        : wordSearch.typography.puzzleTitleFontSize) || 24;

  if (target === 'header-number') {
    return headerNumberFont(wordSearch, titleFamily, titleSize);
  }

  if (moduleType === 'crossword' && crossword) {
    if (target === 'title') {
      return {
        fontFamily: crossword.typography.puzzleTitleFontFamily || 'Arial',
        fontSize: crossword.typography.puzzleTitleFontSize || 24,
        color: crossword.colors.titleColor || '#111111',
        bold: true,
        italic: !!crossword.typography.puzzleTitleItalic,
        align: 'center' as const,
        textEffect: normalizeTextEffect(crossword.typography.titleTextEffect),
      };
    }
    if (target === 'subtitle') {
      return {
        fontFamily: crossword.typography.subtitleFontFamily || 'Arial',
        fontSize: crossword.typography.subtitleFontSize || 14,
        color: crossword.colors.subtitleColor || '#666666',
        bold: false,
        italic: false,
        align: 'center',
        textEffect: normalizeTextEffect(crossword.typography.subtitleTextEffect),
      };
    }
    if (target === 'clue-heading') {
      return {
        fontFamily:
          crossword.typography.acrossDownFontFamily ||
          crossword.typography.clueFontFamily ||
          'Arial',
        fontSize:
          crossword.typography.acrossDownFontSize ||
          (crossword.typography.clueFontSize || 12) + 2,
        color: crossword.colors.cluesColor || '#111111',
        bold: true,
        italic: false,
        align: 'left',
        textEffect: normalizeTextEffect(crossword.typography.clueTextEffect),
      };
    }
    if (target === 'clues') {
      return {
        fontFamily: crossword.typography.clueFontFamily || 'Arial',
        fontSize: crossword.typography.clueFontSize || 12,
        color: crossword.colors.cluesColor || '#111111',
        bold: false,
        italic: false,
        align: 'left',
        textEffect: normalizeTextEffect(crossword.typography.clueTextEffect),
      };
    }
    if (target === 'grid') {
      return {
        fontFamily: crossword.typography.numberFontFamily || 'Arial',
        fontSize: crossword.typography.gridLetterFontSize || 16,
        color: crossword.colors.hintLettersColor || '#111111',
        bold: true,
        italic: false,
        align: 'center',
        textEffect: normalizeTextEffect(crossword.typography.gridTextEffect),
      };
    }
  }

  if (generic && moduleType !== 'word-search' && moduleType !== 'crossword') {
    if (target === 'title') {
      const onSol = options?.solutionPage === true;
      const align = onSol
        ? generic.typography.answerTitleAlign
        : generic.typography.puzzleTitleAlign;
      return {
        fontFamily: onSol
          ? generic.typography.answerTitleFontFamily ||
            generic.typography.puzzleTitleFontFamily ||
            'Arial'
          : generic.typography.puzzleTitleFontFamily || 'Arial',
        fontSize: onSol
          ? generic.typography.answerTitleFontSize || 18
          : generic.typography.puzzleTitleFontSize || 24,
        color: onSol
          ? generic.colors.answerTitleColor || generic.colors.titleColor || '#1f2937'
          : generic.colors.titleColor || '#111111',
        bold: generic.typography.puzzleTitleBold !== false,
        italic: !!generic.typography.puzzleTitleItalic,
        align: align === 'left' || align === 'right' ? align : 'center',
        textEffect: normalizeTextEffect(generic.typography.titleTextEffect),
      };
    }
    if (target === 'subtitle') {
      return {
        fontFamily: wordSearch.typography.subtitleFontFamily || 'Arial',
        fontSize: wordSearch.typography.subtitleFontSize || 14,
        color: wordSearch.colors.puzzlePage.subtitleColor || '#666666',
        bold: false,
        italic: false,
        align: 'center',
        textEffect: normalizeTextEffect(wordSearch.typography.subtitleTextEffect),
      };
    }
    if (target === 'answer-key') {
      return {
        fontFamily: generic.typography.answerKeyFontFamily || 'Arial',
        fontSize: generic.typography.answerKeyFontSize ?? 18,
        color: generic.colors.gridColor || '#111111',
        bold: generic.typography.answerKeyBold !== false,
        italic: generic.typography.answerKeyItalic === true,
        align: 'center',
        textEffect: normalizeTextEffect(generic.typography.puzzleTextEffect),
      };
    }
    if (target === 'word-list') {
      // Fill-In / Word Snake entry list under the grid.
      return {
        fontFamily:
          generic.typography.wordListFontFamily || generic.typography.puzzleFontFamily || 'Arial',
        fontSize: generic.typography.wordListFontSize ?? 16,
        color: generic.colors.wordListColor || generic.colors.gridColor || '#111111',
        bold: generic.typography.wordListBold === true,
        italic: generic.typography.wordListItalic === true,
        align: 'left',
        textEffect: 'none',
      };
    }
    if (target === 'code-numbers') {
      return {
        fontFamily:
          generic.typography.codewordsNumberFontFamily ||
          generic.typography.puzzleFontFamily ||
          'Arial',
        fontSize: generic.typography.codewordsNumberFontSize ?? 9,
        color: generic.core.codewordsNumberColor || '#000000',
        bold: generic.typography.codewordsNumberBold === true,
        italic: generic.typography.codewordsNumberItalic === true,
        align: 'left',
        textEffect: 'none',
      };
    }
    if (target === 'code-letters') {
      return {
        fontFamily:
          generic.typography.codewordsLetterFontFamily ||
          generic.typography.puzzleFontFamily ||
          'Arial',
        fontSize: generic.typography.codewordsLetterFontSize ?? 14,
        color: generic.core.codewordsLetterColor || '#000000',
        bold: generic.typography.codewordsLetterBold !== false,
        italic: generic.typography.codewordsLetterItalic === true,
        align: 'center',
        textEffect: 'none',
      };
    }
    if (target === 'suggestions') {
      return {
        fontFamily:
          generic.typography.suggestionFontFamily ||
          generic.typography.puzzleFontFamily ||
          'Arial',
        fontSize:
          generic.typography.suggestionFontSize ||
          Math.max(10, Math.round((generic.typography.puzzleFontSize || 14) * 0.95)),
        color: generic.colors.gridColor || '#111111',
        bold: false,
        italic: generic.typography.suggestionItalic === true,
        align: 'left',
        textEffect: normalizeTextEffect(
          generic.typography.suggestionTextEffect ?? generic.typography.puzzleTextEffect
        ),
      };
    }
    if (target === 'grid' && moduleType === 'binairo') {
      return {
        fontFamily: generic.typography.puzzleFontFamily || 'Arial',
        fontSize: generic.typography.puzzleFontSize || 14,
        color: generic.core.binairoSymbolColor || generic.colors.gridColor || '#111111',
        bold: generic.typography.puzzleBold === true,
        italic: generic.typography.puzzleItalic === true,
        align: 'center',
        textEffect: normalizeTextEffect(generic.typography.puzzleTextEffect),
      };
    }
    if (target === 'math-equations') {
      const onSol = options?.solutionPage === true;
      return {
        fontFamily:
          generic.typography.mathMazeEquationFontFamily ||
          generic.typography.puzzleFontFamily ||
          'Arial',
        fontSize: onSol
          ? generic.typography.mathMazeAnswerEquationFontSize ?? 11
          : generic.typography.mathMazeEquationFontSize ?? 11,
        color: generic.colors.gridColor || '#111111',
        bold: true,
        italic: false,
        align: 'center',
        textEffect: 'none',
      };
    }
    if (target === 'math-path-numbers') {
      const onSol = options?.solutionPage === true;
      return {
        fontFamily:
          generic.typography.mathMazeChannelFontFamily ||
          generic.typography.puzzleFontFamily ||
          'Arial',
        fontSize: onSol
          ? generic.typography.mathMazeAnswerChannelFontSize ?? 9
          : generic.typography.mathMazeChannelFontSize ?? 9,
        color: generic.colors.gridColor || '#111111',
        bold: true,
        italic: false,
        align: 'center',
        textEffect: 'none',
      };
    }
    if (target === 'math-start-end') {
      const onSol = options?.solutionPage === true;
      return {
        fontFamily: generic.typography.mathMazeStartEndFontFamily || 'Arial',
        fontSize: onSol
          ? generic.typography.mathMazeAnswerStartFontSize ?? 11
          : generic.typography.mathMazeStartFontSize ?? 11,
        color: generic.colors.gridColor || '#111111',
        bold: true,
        italic: false,
        align: 'center',
        textEffect: 'none',
      };
    }
    if (target === 'clues' && moduleType === 'kakuro') {
      return {
        fontFamily:
          generic.typography.kakuroClueFontFamily ||
          generic.typography.puzzleFontFamily ||
          'Arial',
        fontSize: generic.typography.kakuroClueFontSize ?? 7,
        color: generic.core.kakuroClueTextColor || '#ffffff',
        bold: generic.typography.kakuroClueBold !== false,
        italic: false,
        align: 'center',
        textEffect: 'none',
      };
    }
    if (target === 'grid' && moduleType === 'kakuro') {
      return {
        fontFamily: generic.typography.puzzleFontFamily || 'Arial',
        fontSize: generic.typography.puzzleFontSize || 14,
        color: generic.core.kakuroDigitColor || generic.colors.gridColor || '#111111',
        bold: generic.typography.puzzleBold === true,
        italic: generic.typography.puzzleItalic === true,
        align: 'center',
        textEffect: normalizeTextEffect(generic.typography.puzzleTextEffect),
      };
    }
    if (target === 'grid' && moduleType === 'sudoku' && !options?.solutionPage) {
      return {
        fontFamily: generic.typography.puzzleFontFamily || 'Arial',
        fontSize: generic.typography.puzzleFontSize || 14,
        color: generic.colors.gridColor || '#111111',
        bold: true,
        italic: generic.typography.puzzleItalic === true,
        align: 'center',
        textEffect: normalizeTextEffect(generic.typography.puzzleTextEffect),
      };
    }
    if (
      target === 'grid' &&
      options?.solutionPage &&
      (moduleType === 'sudoku' ||
        moduleType === 'cryptogram' ||
        moduleType === 'word-fill' ||
        moduleType === 'number-fill' ||
        moduleType === 'snake' ||
        moduleType === 'binairo' ||
        moduleType === 'kakuro' ||
        moduleType === 'codewords')
    ) {
      // Solution pages use the Solution font for grid letters / decoded text.
      const pathInk =
        moduleType === 'snake'
          ? generic.core.snakeSolutionPathColor || generic.colors.gridColor || '#111111'
          : moduleType === 'binairo'
            ? generic.core.binairoSymbolColor || generic.colors.gridColor || '#111111'
            : moduleType === 'kakuro'
              ? generic.core.kakuroDigitColor || generic.colors.gridColor || '#111111'
              : moduleType === 'codewords'
                ? generic.core.codewordsLetterColor || generic.colors.gridColor || '#111111'
                : generic.colors.gridColor || '#111111';
      return {
        fontFamily:
          generic.typography.answerFontFamily || generic.typography.puzzleFontFamily || 'Arial',
        fontSize: generic.typography.answerFontSize || generic.typography.puzzleFontSize || 14,
        color: pathInk,
        bold:
          moduleType === 'sudoku' || moduleType === 'codewords'
            ? true
            : generic.typography.puzzleBold === true,
        italic: generic.typography.puzzleItalic === true,
        align: 'center',
        textEffect: normalizeTextEffect(generic.typography.puzzleTextEffect),
      };
    }
    if (target === 'grid' && moduleType === 'math-maze') {
      return {
        fontFamily:
          generic.typography.mathMazeEquationFontFamily ||
          generic.typography.puzzleFontFamily ||
          'Arial',
        fontSize: generic.typography.mathMazeEquationFontSize ?? 11,
        color: generic.colors.gridColor || '#111111',
        bold: true,
        italic: false,
        align: 'center',
        textEffect: 'none',
      };
    }
    return {
      fontFamily: generic.typography.puzzleFontFamily || 'Arial',
      fontSize: generic.typography.puzzleFontSize || 14,
      color: generic.colors.gridColor || '#111111',
      bold: generic.typography.puzzleBold === true,
      italic: generic.typography.puzzleItalic === true,
      align: 'left',
      textEffect: normalizeTextEffect(generic.typography.puzzleTextEffect),
    };
  }

  if (target === 'title') {
    return {
      fontFamily: wordSearch.typography.puzzleTitleFontFamily || 'Arial',
      fontSize: wordSearch.typography.puzzleTitleFontSize || 24,
      color: wordSearch.colors.puzzlePage.titleColor || '#111111',
      bold: true,
      italic: !!wordSearch.typography.puzzleTitleItalic,
      align: 'center',
      textEffect: normalizeTextEffect(wordSearch.typography.titleTextEffect),
    };
  }
  if (target === 'subtitle') {
    return {
      fontFamily: wordSearch.typography.subtitleFontFamily || 'Arial',
      fontSize: wordSearch.typography.subtitleFontSize || 14,
      color: wordSearch.colors.puzzlePage.subtitleColor || '#666666',
      bold: false,
      italic: false,
      align: 'center',
      textEffect: normalizeTextEffect(wordSearch.typography.subtitleTextEffect),
    };
  }
  if (target === 'word-list') {
    return {
      fontFamily: wordSearch.wordList.wordListFontFamily || 'Arial',
      fontSize: wordSearch.wordList.wordListFontSize || 12,
      color: wordSearch.colors.puzzlePage.wordListColor || '#4b5563',
      bold: false,
      italic: false,
      align: 'left',
      textEffect: normalizeTextEffect(wordSearch.typography.wordListTextEffect),
    };
  }
  if (target === 'grid') {
    return {
      fontFamily: wordSearch.typography.puzzleGridFontFamily || 'Arial',
      fontSize: wordSearch.typography.puzzleGridFontSize || 18,
      color: wordSearch.colors.puzzlePage.puzzleColor || '#111111',
      bold: false,
      italic: !!wordSearch.typography.puzzleGridItalic,
      align: 'center',
      textEffect: normalizeTextEffect(wordSearch.typography.gridTextEffect),
    };
  }
  return {
    fontFamily: wordSearch.typography.pageNumber.fontFamily || 'Arial',
    fontSize: wordSearch.typography.pageNumber.fontSize || 12,
    color: wordSearch.typography.pageNumber.textColor || '#111111',
    bold: false,
    italic: false,
    align: 'center',
    textEffect: normalizeTextEffect(wordSearch.typography.pageNumber.textEffect),
  };
}

export function patchedWordSearchSettings(
  current: WordSearchSettings,
  target: CanvasFormatTarget,
  patch: NativeCanvasPatch
): WordSearchSettings {
  if (target === 'header-number') {
    const assembly = getHeaderAssemblySettings(current);
    const number = { ...assembly.number };
    if (patch.fontFamily) number.fontFamily = patch.fontFamily;
    if (patch.fontSize != null) number.fontSizePt = patch.fontSize;
    if (patch.color) number.textColor = patch.color;
    return mergeWordSearchSettingsUpdate(current, {
      colors: {
        ...current.colors,
        puzzlePage: {
          ...current.colors.puzzlePage,
          headerAssembly: { ...assembly, number },
        },
      },
    });
  }
  if (target === 'title') {
    return mergeWordSearchSettingsUpdate(current, {
      typography: {
        ...current.typography,
        ...(patch.fontFamily ? { puzzleTitleFontFamily: patch.fontFamily } : {}),
        ...(patch.fontSize != null ? { puzzleTitleFontSize: patch.fontSize } : {}),
        ...(patch.italic != null ? { puzzleTitleItalic: patch.italic } : {}),
        ...(patch.textEffect ? { titleTextEffect: patch.textEffect } : {}),
      },
      colors: patch.color
        ? {
            ...current.colors,
            puzzlePage: { ...current.colors.puzzlePage, titleColor: patch.color },
          }
        : undefined,
    });
  }
  if (target === 'subtitle') {
    return mergeWordSearchSettingsUpdate(current, {
      typography: {
        ...current.typography,
        ...(patch.fontFamily ? { subtitleFontFamily: patch.fontFamily } : {}),
        ...(patch.fontSize != null ? { subtitleFontSize: patch.fontSize } : {}),
        ...(patch.textEffect ? { subtitleTextEffect: patch.textEffect } : {}),
      },
      colors: patch.color
        ? {
            ...current.colors,
            puzzlePage: { ...current.colors.puzzlePage, subtitleColor: patch.color },
          }
        : undefined,
    });
  }
  if (target === 'word-list') {
    return mergeWordSearchSettingsUpdate(current, {
      typography: {
        ...current.typography,
        ...(patch.textEffect ? { wordListTextEffect: patch.textEffect } : {}),
      },
      wordList: {
        ...current.wordList,
        ...(patch.fontFamily ? { wordListFontFamily: patch.fontFamily } : {}),
        ...(patch.fontSize != null ? { wordListFontSize: patch.fontSize } : {}),
      },
      colors: patch.color
        ? {
            ...current.colors,
            puzzlePage: { ...current.colors.puzzlePage, wordListColor: patch.color },
          }
        : undefined,
    });
  }
  if (target === 'grid') {
    return mergeWordSearchSettingsUpdate(current, {
      typography: {
        ...current.typography,
        ...(patch.fontFamily ? { puzzleGridFontFamily: patch.fontFamily } : {}),
        ...(patch.fontSize != null ? { puzzleGridFontSize: patch.fontSize } : {}),
        ...(patch.italic != null ? { puzzleGridItalic: patch.italic } : {}),
        ...(patch.textEffect ? { gridTextEffect: patch.textEffect } : {}),
      },
      colors: patch.color
        ? {
            ...current.colors,
            puzzlePage: { ...current.colors.puzzlePage, puzzleColor: patch.color },
          }
        : undefined,
    });
  }
  return mergeWordSearchSettingsUpdate(current, {
    typography: {
      ...current.typography,
      pageNumber: {
        ...current.typography.pageNumber,
        ...(patch.fontFamily ? { fontFamily: patch.fontFamily } : {}),
        ...(patch.fontSize != null ? { fontSize: patch.fontSize } : {}),
        ...(patch.color ? { textColor: patch.color } : {}),
        ...(patch.textEffect ? { textEffect: patch.textEffect } : {}),
      },
    },
  });
}

export function patchedCrosswordSettings(
  current: CrosswordSettings,
  target: CanvasFormatTarget,
  patch: NativeCanvasPatch
): Pick<CrosswordSettings, 'typography' | 'colors'> {
  const typography = { ...current.typography };
  const colors = { ...current.colors };
  if (target === 'title') {
    if (patch.fontFamily) typography.puzzleTitleFontFamily = patch.fontFamily;
    if (patch.fontSize != null) typography.puzzleTitleFontSize = patch.fontSize;
    if (patch.italic != null) typography.puzzleTitleItalic = patch.italic;
    if (patch.textEffect) typography.titleTextEffect = patch.textEffect;
    if (patch.color) colors.titleColor = patch.color;
  } else if (target === 'subtitle') {
    if (patch.fontFamily) typography.subtitleFontFamily = patch.fontFamily;
    if (patch.fontSize != null) typography.subtitleFontSize = patch.fontSize;
    if (patch.textEffect) typography.subtitleTextEffect = patch.textEffect;
    if (patch.color) colors.subtitleColor = patch.color;
  } else if (target === 'clue-heading') {
    if (patch.fontFamily) typography.acrossDownFontFamily = patch.fontFamily;
    if (patch.fontSize != null) typography.acrossDownFontSize = patch.fontSize;
    if (patch.textEffect) typography.clueTextEffect = patch.textEffect;
    if (patch.color) colors.cluesColor = patch.color;
  } else if (target === 'clues') {
    if (patch.fontFamily) typography.clueFontFamily = patch.fontFamily;
    if (patch.fontSize != null) typography.clueFontSize = patch.fontSize;
    if (patch.textEffect) typography.clueTextEffect = patch.textEffect;
    if (patch.color) colors.cluesColor = patch.color;
  } else if (target === 'grid') {
    if (patch.fontFamily) typography.numberFontFamily = patch.fontFamily;
    if (patch.fontSize != null) typography.gridLetterFontSize = patch.fontSize;
    if (patch.textEffect) typography.gridTextEffect = patch.textEffect;
    if (patch.color) colors.hintLettersColor = patch.color;
  }
  return { typography, colors };
}

export function patchedGenericSettings(
  current: GenericPuzzleSettings,
  target: CanvasFormatTarget,
  patch: NativeCanvasPatch,
  options?: { solutionPage?: boolean; moduleType?: string }
): Pick<GenericPuzzleSettings, 'typography' | 'colors'> {
  const typography = { ...current.typography };
  const colors = { ...current.colors };
  const onSol = options?.solutionPage === true;
  if (
    target === 'grid' &&
    onSol &&
    (options?.moduleType === 'sudoku' ||
      options?.moduleType === 'cryptogram' ||
      options?.moduleType === 'word-fill' ||
      options?.moduleType === 'number-fill' ||
      options?.moduleType === 'snake' ||
      options?.moduleType === 'binairo' ||
      options?.moduleType === 'kakuro' ||
      options?.moduleType === 'codewords')
  ) {
    // Solution pages: canvas font bar edits the Solution font (and snake path ink).
    if (patch.fontFamily) typography.answerFontFamily = patch.fontFamily;
    if (patch.fontSize != null) typography.answerFontSize = patch.fontSize;
    if (patch.bold != null) typography.puzzleBold = patch.bold;
    if (patch.italic != null) typography.puzzleItalic = patch.italic;
    if (patch.textEffect) typography.puzzleTextEffect = patch.textEffect;
    if (patch.color) colors.gridColor = patch.color;
    return { typography, colors };
  }
  if (target === 'title') {
    if (onSol) {
      // Solutions tab: canvas font bar edits the Solution title fields.
      if (patch.fontFamily) typography.answerTitleFontFamily = patch.fontFamily;
      if (patch.fontSize != null) typography.answerTitleFontSize = patch.fontSize;
      if (patch.italic != null) typography.puzzleTitleItalic = patch.italic;
      if (patch.bold != null) typography.puzzleTitleBold = patch.bold;
      if (patch.align) {
        typography.answerTitleAlign =
          patch.align === 'left' || patch.align === 'right' ? patch.align : 'center';
      }
      if (patch.textEffect) typography.titleTextEffect = patch.textEffect;
      if (patch.color) colors.answerTitleColor = patch.color;
    } else {
      if (patch.fontFamily) typography.puzzleTitleFontFamily = patch.fontFamily;
      if (patch.fontSize != null) typography.puzzleTitleFontSize = patch.fontSize;
      if (patch.italic != null) typography.puzzleTitleItalic = patch.italic;
      if (patch.bold != null) typography.puzzleTitleBold = patch.bold;
      if (patch.align) {
        typography.puzzleTitleAlign =
          patch.align === 'left' || patch.align === 'right' ? patch.align : 'center';
      }
      if (patch.textEffect) typography.titleTextEffect = patch.textEffect;
      if (patch.color) colors.titleColor = patch.color;
    }
  } else if (target === 'answer-key') {
    if (patch.fontFamily) typography.answerKeyFontFamily = patch.fontFamily;
    if (patch.fontSize != null) typography.answerKeyFontSize = patch.fontSize;
    if (patch.bold != null) typography.answerKeyBold = patch.bold;
    if (patch.italic != null) typography.answerKeyItalic = patch.italic;
    if (patch.color) colors.gridColor = patch.color;
    if (patch.textEffect) typography.puzzleTextEffect = patch.textEffect;
  } else if (target === 'code-numbers') {
    if (patch.fontFamily) typography.codewordsNumberFontFamily = patch.fontFamily;
    if (patch.fontSize != null) typography.codewordsNumberFontSize = patch.fontSize;
    if (patch.bold != null) typography.codewordsNumberBold = patch.bold;
    if (patch.italic != null) typography.codewordsNumberItalic = patch.italic;
  } else if (target === 'code-letters') {
    if (patch.fontFamily) typography.codewordsLetterFontFamily = patch.fontFamily;
    if (patch.fontSize != null) typography.codewordsLetterFontSize = patch.fontSize;
    if (patch.bold != null) typography.codewordsLetterBold = patch.bold;
    if (patch.italic != null) typography.codewordsLetterItalic = patch.italic;
  } else if (target === 'math-equations') {
    if (patch.fontFamily) typography.mathMazeEquationFontFamily = patch.fontFamily;
    if (patch.fontSize != null) {
      if (onSol) typography.mathMazeAnswerEquationFontSize = patch.fontSize;
      else typography.mathMazeEquationFontSize = patch.fontSize;
    }
    if (patch.color) colors.gridColor = patch.color;
  } else if (target === 'math-path-numbers') {
    if (patch.fontFamily) typography.mathMazeChannelFontFamily = patch.fontFamily;
    if (patch.fontSize != null) {
      if (onSol) typography.mathMazeAnswerChannelFontSize = patch.fontSize;
      else typography.mathMazeChannelFontSize = patch.fontSize;
    }
    if (patch.color) colors.gridColor = patch.color;
  } else if (target === 'math-start-end') {
    if (patch.fontFamily) typography.mathMazeStartEndFontFamily = patch.fontFamily;
    if (patch.fontSize != null) {
      if (onSol) {
        typography.mathMazeAnswerStartFontSize = patch.fontSize;
        typography.mathMazeAnswerEndFontSize = patch.fontSize;
      } else {
        typography.mathMazeStartFontSize = patch.fontSize;
        typography.mathMazeEndFontSize = patch.fontSize;
      }
    }
    if (patch.color) colors.gridColor = patch.color;
  } else if (target === 'clues') {
    // Kakuro clue triangle numbers (generic modules only; crossword uses its own patcher).
    if (patch.fontFamily) typography.kakuroClueFontFamily = patch.fontFamily;
    if (patch.fontSize != null) typography.kakuroClueFontSize = patch.fontSize;
    if (patch.bold != null) typography.kakuroClueBold = patch.bold;
  } else if (target === 'suggestions') {
    if (patch.fontFamily) typography.suggestionFontFamily = patch.fontFamily;
    if (patch.fontSize != null) typography.suggestionFontSize = patch.fontSize;
    if (patch.italic != null) typography.suggestionItalic = patch.italic;
    if (patch.textEffect) typography.suggestionTextEffect = patch.textEffect;
    if (patch.color) colors.gridColor = patch.color;
  } else if (target === 'word-list') {
    // Fill-In / Word Snake entry list.
    if (patch.fontFamily) typography.wordListFontFamily = patch.fontFamily;
    if (patch.fontSize != null) typography.wordListFontSize = patch.fontSize;
    if (patch.bold != null) typography.wordListBold = patch.bold;
    if (patch.italic != null) typography.wordListItalic = patch.italic;
    if (patch.color) colors.wordListColor = patch.color;
  } else if (target === 'subtitle') {
    /* Subtitle / fun facts live on the shared Style (word-search) typography. */
  } else {
    if (patch.fontFamily) typography.puzzleFontFamily = patch.fontFamily;
    if (patch.fontSize != null) typography.puzzleFontSize = patch.fontSize;
    if (patch.bold != null) typography.puzzleBold = patch.bold;
    if (patch.italic != null) typography.puzzleItalic = patch.italic;
    if (patch.textEffect) typography.puzzleTextEffect = patch.textEffect;
    if (patch.color) colors.gridColor = patch.color;
  }
  return { typography, colors };
}
