'use client';

import React from 'react';
import { CanvasSelectable } from '@/components/CanvasSelectable';
import type { CanvasFormatTarget } from '@/lib/canvas-native-format';
import type { GenericPuzzleSettings } from '@/lib/generic-puzzle-settings';
import { computeGenericPageLayout } from '@/lib/generic-puzzle-page-layout';
import { PT_TO_CSS_PX } from '@/lib/puzzle-layout';
import type { CryptogramPuzzle, TitleWordsSettings, WordSearchSettings } from '@/lib/puzzles/types';
import { buildCryptogramElementParts } from '@/lib/resolved-layout/book-elements';
import { ResolvedElementsView } from '@/lib/resolved-layout/ResolvedElementsView';
import { shiftElements } from '@/lib/resolved-layout/shift';
import { getResolvedPage, settingsRevision, stableRevision } from '@/lib/resolved-layout/snapshot';

/**
 * Cryptogram preview drawn from the same ResolvedElements as the PDF and PPTX.
 * Click the answer key or the cipher body to format with the shared text bar.
 */
export function SelectableCryptogramView({
  puzzle,
  puzzles,
  settings,
  titleWords,
  showSolution,
  gp,
  puzzleIndex,
  selectedTarget = null,
  onSelectTarget,
}: {
  puzzle: CryptogramPuzzle;
  puzzles: any[];
  settings: WordSearchSettings;
  titleWords: TitleWordsSettings;
  showSolution: boolean;
  gp: GenericPuzzleSettings;
  puzzleIndex: number;
  selectedTarget?: CanvasFormatTarget | null;
  onSelectTarget?: (target: CanvasFormatTarget) => void;
}) {
  const layers = React.useMemo(() => {
    const layout = computeGenericPageLayout({
      puzzleType: 'cryptogram',
      showSolution,
      layoutSettings: settings,
      titleWords,
      puzzleIndex,
      puzzles,
      cw: null,
      gp,
    });
    const slotIndex = Math.max(
      0,
      layout.slots.findIndex((slot) => slot.index === puzzles.indexOf(puzzle))
    );
    const slot = layout.slots[slotIndex]?.content ?? layout.slots[0]?.content;
    if (!slot) return null;

    const revision = stableRevision({
      puzzleType: 'cryptogram',
      showSolution,
      slot,
      gp: settingsRevision(gp),
      original: puzzle.originalText,
      encoded: puzzle.encodedText,
      mapping: puzzle.letterMapping,
      hints: puzzle.hintLetters,
      cipher: puzzle.cipherType,
    });
    const parts = buildCryptogramElementParts({ puzzle, slot, gp, showSolution });
    const dx = slot.leftPt;
    const dy = slot.topPt;
    const elements = shiftElements(parts.elements, dx, dy);
    const keyBox = parts.keyBox
      ? { x: parts.keyBox.x - dx, y: parts.keyBox.y - dy, w: parts.keyBox.w, h: parts.keyBox.h }
      : null;
    const bodyBox = {
      x: parts.bodyBox.x - dx,
      y: parts.bodyBox.y - dy,
      w: parts.bodyBox.w,
      h: parts.bodyBox.h,
    };
    // Grow with font size so FitToSafeArea can scale the whole block instead of
    // clipping when Puzzle / Answer Key fonts are larger than the slot budget.
    const contentH = Math.max(
      slot.heightPt,
      bodyBox.y + bodyBox.h,
      keyBox ? keyBox.y + keyBox.h : 0
    );
    getResolvedPage(revision, () => ({
      id: revision,
      kind: 'cryptogram',
      widthPt: slot.widthPt,
      heightPt: contentH,
      revision,
      elements,
    }));
    return {
      widthPt: slot.widthPt,
      heightPt: contentH,
      elements,
      keyBox,
      bodyBox,
    };
  }, [gp, puzzle, puzzleIndex, puzzles, settings, showSolution, titleWords]);

  if (!layers) return null;
  const scale = PT_TO_CSS_PX;

  return (
    <div
      className="relative mx-auto"
      style={{ width: layers.widthPt * scale, height: layers.heightPt * scale }}
    >
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
        <ResolvedElementsView
          elements={layers.elements}
          widthPt={layers.widthPt}
          heightPt={layers.heightPt}
        />
      </div>
      {layers.keyBox ? (
        <CanvasSelectable
          target="answer-key"
          label="Answer Key"
          active={selectedTarget === 'answer-key'}
          onSelect={onSelectTarget}
          style={{
            position: 'absolute',
            left: layers.keyBox.x * scale,
            top: layers.keyBox.y * scale,
            width: layers.keyBox.w * scale,
            height: layers.keyBox.h * scale,
            zIndex: 2,
          }}
        >
          <div style={{ width: '100%', height: '100%' }} />
        </CanvasSelectable>
      ) : null}
      <CanvasSelectable
        target="grid"
        label={showSolution ? 'Solution' : 'Puzzle'}
        active={selectedTarget === 'grid'}
        onSelect={onSelectTarget}
        style={{
          position: 'absolute',
          left: layers.bodyBox.x * scale,
          top: layers.bodyBox.y * scale,
          width: layers.bodyBox.w * scale,
          height: layers.bodyBox.h * scale,
          zIndex: 2,
        }}
      >
        <div style={{ width: '100%', height: '100%' }} />
      </CanvasSelectable>
    </div>
  );
}
