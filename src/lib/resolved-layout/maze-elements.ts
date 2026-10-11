import type { GenericPuzzleSettings } from '../generic-puzzle-settings';
import {
  layoutMaze,
  mazeArrowPoints,
  mazeDashArray,
  mazePathPoints,
  mazePathThicknessPt,
  mazeSolutionRuns,
  mazeStartDir,
  mazeWallRuns,
  mazeWallThicknessPt,
  type LineSeg,
} from '../generic-puzzle-geometry';
import type { RectPt } from '../generic-puzzle-page-layout';
import {
  assignedPair,
  mazeStartEndImageScale,
  placeMazeStartEndImages,
  shouldDrawMazeStartEndImages,
} from '../maze-start-end-images';
import type { MazePuzzle } from '../puzzles/types';
import type { ResolvedElement, ResolvedLine, ResolvedStadium } from './types';

export interface MazeElementInput {
  puzzle: MazePuzzle;
  slot: RectPt;
  preferredCellPt: number;
  framePt: number | null;
  gp: Pick<GenericPuzzleSettings, 'core' | 'colors'>;
  showSolution: boolean;
}

function stadium(seg: LineSeg, color: string, thickness: number): ResolvedStadium {
  return {
    kind: 'stadium',
    x1: seg.x1,
    y1: seg.y1,
    x2: seg.x2,
    y2: seg.y2,
    color,
    thickness,
  };
}

function dashed(seg: LineSeg, color: string, width: number, dash: number[]): ResolvedLine {
  return {
    kind: 'line',
    x1: seg.x1,
    y1: seg.y1,
    x2: seg.x2,
    y2: seg.y2,
    color,
    width,
    dash,
  };
}

/** Maze walls, solution path, and markers. Both exporters and the canvas use this list. */
export function buildMazeElementParts(input: MazeElementInput): {
  maze: ResolvedElement[];
  startImage: ResolvedElement | null;
  endImage: ResolvedElement | null;
  /** Maze grid box in the same coordinate space as the returned elements (slot-absolute before shift). */
  mazeBox: { x: number; y: number; w: number; h: number };
} {
  const { puzzle, slot, gp, showSolution } = input;
  const images = gp.core.mazeStartEndImages;
  const pair = shouldDrawMazeStartEndImages(images, showSolution)
    ? assignedPair(images, puzzle)
    : null;
  const placed = pair
    ? placeMazeStartEndImages({
        puzzle,
        slot,
        preferredCellPt: input.preferredCellPt,
        framePt: input.framePt,
        startAspect: pair.startWidth > 0 && pair.startHeight > 0 ? pair.startWidth / pair.startHeight : 1,
        endAspect: pair.endWidth > 0 && pair.endHeight > 0 ? pair.endWidth / pair.endHeight : 1,
        imageScale: mazeStartEndImageScale(images, showSolution),
      })
    : null;
  const layout = placed?.layout ?? layoutMaze(puzzle, slot, input.preferredCellPt, input.framePt);
  const wallColor = gp.colors.gridColor || '#1f2937';
  const pathColor = gp.colors.solutionPathColor || '#e11d48';
  const wallPt = mazeWallThicknessPt(layout, gp.core.mazeWallThickness ?? 45);
  const pathPt = mazePathThicknessPt(layout, gp.core.mazeSolutionPathThickness ?? 34);
  const maze: ResolvedElement[] = [];

  for (const seg of mazeWallRuns(puzzle, layout)) {
    maze.push(stadium(seg, wallColor, wallPt));
  }

  if (showSolution) {
    const pts = mazePathPoints(puzzle, layout, true);
    const dash = mazeDashArray(gp.core.mazeSolutionPathStyle, pathPt);
    for (const seg of mazeSolutionRuns(pts)) {
      maze.push(dash ? dashed(seg, pathColor, pathPt, dash) : stadium(seg, pathColor, pathPt));
    }
    if (!dash) {
      const radius = pathPt / 2;
      for (let i = 1; i < pts.length - 1; i++) {
        const prev = pts[i - 1];
        const point = pts[i];
        const next = pts[i + 1];
        const cross =
          (point.xPt - prev.xPt) * (next.yPt - point.yPt) -
          (point.yPt - prev.yPt) * (next.xPt - point.xPt);
        if (Math.abs(cross) < 0.01) continue;
        maze.push({
          kind: 'ellipse',
          cx: point.xPt,
          cy: point.yPt,
          rx: radius,
          ry: radius,
          fill: pathColor,
        });
      }
    }
  }

  const cell = Math.min(layout.cellWPt, layout.cellHPt);
  const startX = layout.leftPt + layout.offsetXPt + (puzzle.start.col + 0.5) * layout.cellWPt;
  const startY = layout.topPt + layout.offsetYPt + (puzzle.start.row + 0.5) * layout.cellHPt;
  const endX = layout.leftPt + layout.offsetXPt + (puzzle.end.col + 0.5) * layout.cellWPt;
  const endY = layout.topPt + layout.offsetYPt + (puzzle.end.row + 0.5) * layout.cellHPt;
  const marker = gp.core.mazeMarkerStyle ?? 'arrow';
  const radius = Math.max(2, cell * 0.32);

  let startImage: ResolvedElement | null = null;
  let endImage: ResolvedElement | null = null;
  if (pair && placed?.start && placed.end) {
    startImage = {
      kind: 'image',
      x: placed.start.x,
      y: placed.start.y,
      w: placed.start.w,
      h: placed.start.h,
      href: pair.startImage,
      svg: pair.startSvg || undefined,
      fit: 'contain',
    };
    endImage = {
      kind: 'image',
      x: placed.end.x,
      y: placed.end.y,
      w: placed.end.w,
      h: placed.end.h,
      href: pair.endImage,
      svg: pair.endSvg || undefined,
      fit: 'contain',
    };
  }

  if (marker === 'point') {
    maze.push({ kind: 'ellipse', cx: startX, cy: startY, rx: radius, ry: radius, fill: '#111111' });
  } else if (!(marker === 'image' && gp.core.mazeStartImage)) {
    maze.push({
      kind: 'polygon',
      points: mazeArrowPoints(startX, startY, cell, mazeStartDir(puzzle)),
      fill: '#111111',
    });
  } else {
    const s = radius * 2.4;
    maze.push({
      kind: 'image',
      x: startX - s / 2,
      y: startY - s / 2,
      w: s,
      h: s,
      href: gp.core.mazeStartImage,
      fit: 'contain',
    });
  }

  if (marker === 'image' && gp.core.mazeEndImage) {
    const s = radius * 2.4;
    maze.push({
      kind: 'image',
      x: endX - s / 2,
      y: endY - s / 2,
      w: s,
      h: s,
      href: gp.core.mazeEndImage,
      fit: 'contain',
    });
  } else {
    maze.push({ kind: 'ellipse', cx: endX, cy: endY, rx: radius, ry: radius, fill: '#111111' });
  }

  return {
    maze,
    startImage,
    endImage,
    mazeBox: {
      x: layout.leftPt,
      y: layout.topPt,
      w: layout.widthPt,
      h: layout.heightPt,
    },
  };
}

/** Flat list for PDF/PPTX — same drawing as the canvas layers composed together. */
export function buildMazeElements(input: MazeElementInput): ResolvedElement[] {
  const parts = buildMazeElementParts(input);
  return [
    ...parts.maze,
    ...(parts.startImage ? [parts.startImage] : []),
    ...(parts.endImage ? [parts.endImage] : []),
  ];
}
