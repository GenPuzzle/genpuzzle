'use client';

import React from 'react';
import { CanvasSelectable } from '@/components/CanvasSelectable';
import type { CanvasFormatTarget } from '@/lib/canvas-native-format';
import type { GenericPuzzleSettings } from '@/lib/generic-puzzle-settings';
import {
  clampImageScalePercent,
  MAZE_IMAGE_SCALE_MAX,
  MAZE_IMAGE_SCALE_MIN,
} from '@/lib/maze-start-end-images';
import { PT_TO_CSS_PX } from '@/lib/puzzle-layout';
import type { TitleWordsSettings, WordSearchSettings } from '@/lib/puzzles/types';
import {
  computeMazeCanvasLayers,
  SharedMazeSudokuView,
} from '@/lib/resolved-layout/SharedMazeSudokuView';
import { previewImageHref } from '@/lib/resolved-layout/preview-image';
import { ResolvedElementsView } from '@/lib/resolved-layout/ResolvedElementsView';
import type { ResolvedImage } from '@/lib/resolved-layout/types';

function MazeImageSelectable({
  target,
  label,
  image,
  scale,
  active,
  onSelect,
  scalePercent,
  onScaleChange,
}: {
  target: CanvasFormatTarget;
  label: string;
  image: ResolvedImage;
  scale: number;
  active: boolean;
  onSelect?: (target: CanvasFormatTarget) => void;
  scalePercent?: number;
  onScaleChange?: (scale: number) => void;
}) {
  return (
    <CanvasSelectable
      target={target}
      label={label}
      active={active}
      onSelect={onSelect}
      scalePercent={onScaleChange ? scalePercent : undefined}
      onScaleChange={onScaleChange}
      scaleMin={MAZE_IMAGE_SCALE_MIN}
      scaleMax={MAZE_IMAGE_SCALE_MAX}
      style={{
        position: 'absolute',
        left: image.x * scale,
        top: image.y * scale,
        width: image.w * scale,
        height: image.h * scale,
        zIndex: 4,
        lineHeight: 0,
      }}
    >
      <img
        alt=""
        src={previewImageHref(image)}
        style={{
          display: 'block',
          width: '100%',
          height: '100%',
          objectFit: image.fit === 'stretch' ? 'fill' : image.fit ?? 'contain',
          pointerEvents: 'none',
        }}
      />
    </CanvasSelectable>
  );
}

/** Interactive maze canvas: maze, start image, and end image are separate selections. */
export function SelectableMazeView({
  puzzle,
  puzzles,
  settings,
  titleWords,
  showSolution,
  gp,
  puzzleIndex,
  selectedTarget = null,
  onSelectTarget,
  gridScalePercent,
  onGridScaleChange,
  startEndScalePercent,
  onStartEndScaleChange,
}: {
  puzzle: any;
  puzzles: any[];
  settings: WordSearchSettings;
  titleWords: TitleWordsSettings;
  showSolution: boolean;
  gp: GenericPuzzleSettings;
  puzzleIndex: number;
  selectedTarget?: CanvasFormatTarget | null;
  onSelectTarget?: (target: CanvasFormatTarget) => void;
  gridScalePercent?: number;
  onGridScaleChange?: (scale: number) => void;
  startEndScalePercent?: number;
  onStartEndScaleChange?: (scale: number) => void;
}) {
  const layers = React.useMemo(
    () =>
      computeMazeCanvasLayers({
        puzzle,
        puzzles,
        settings,
        titleWords,
        showSolution,
        gp,
        puzzleIndex,
      }),
    [gp, puzzle, puzzleIndex, puzzles, settings, showSolution, titleWords]
  );

  if (!onSelectTarget) {
    return (
      <SharedMazeSudokuView
        puzzleType="maze"
        puzzle={puzzle}
        puzzles={puzzles}
        settings={settings}
        titleWords={titleWords}
        showSolution={showSolution}
        gp={gp}
        puzzleIndex={puzzleIndex}
      />
    );
  }

  if (!layers) return null;

  const scale = PT_TO_CSS_PX;
  const imageScale = clampImageScalePercent(
    startEndScalePercent ?? gp.core.mazeStartEndImages.imageScalePercent
  );

  return (
    <div
      style={{
        position: 'relative',
        width: layers.widthPt * scale,
        height: layers.heightPt * scale,
      }}
    >
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
        <ResolvedElementsView
          elements={layers.maze}
          widthPt={layers.widthPt}
          heightPt={layers.heightPt}
        />
      </div>
      <CanvasSelectable
        target="grid"
        label="Maze"
        active={selectedTarget === 'grid'}
        onSelect={onSelectTarget}
        scalePercent={onGridScaleChange ? gridScalePercent : undefined}
        onScaleChange={onGridScaleChange}
        scaleMin={30}
        scaleMax={250}
        style={{
          position: 'absolute',
          left: layers.mazeBox.x * scale,
          top: layers.mazeBox.y * scale,
          width: layers.mazeBox.w * scale,
          height: layers.mazeBox.h * scale,
          zIndex: 2,
        }}
      >
        <div style={{ width: '100%', height: '100%' }} />
      </CanvasSelectable>
      {layers.startImage ? (
        <MazeImageSelectable
          target="maze-start"
          label="Start image"
          image={layers.startImage}
          scale={scale}
          active={selectedTarget === 'maze-start'}
          onSelect={onSelectTarget}
          scalePercent={imageScale}
          onScaleChange={onStartEndScaleChange}
        />
      ) : null}
      {layers.endImage ? (
        <MazeImageSelectable
          target="maze-end"
          label="End image"
          image={layers.endImage}
          scale={scale}
          active={selectedTarget === 'maze-end'}
          onSelect={onSelectTarget}
          scalePercent={imageScale}
          onScaleChange={onStartEndScaleChange}
        />
      ) : null}
    </div>
  );
}
