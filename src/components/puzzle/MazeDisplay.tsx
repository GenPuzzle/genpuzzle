'use client';

import React from 'react';
import {
  MazeMarkerStyle,
  MazePuzzle,
  MazeSolutionPathStyle,
  Position,
} from '@/lib/puzzles/types';
import { solveMazePath } from '@/lib/puzzles/maze';

type ArrowDir = 'up' | 'down' | 'left' | 'right';

interface MazeDisplayProps {
  puzzle: MazePuzzle;
  showSolution?: boolean;
  cellSize?: number;
  wallColor?: string;
  solutionPathColor?: string;
  /** Solution path thickness as a percent of cell size (default ~34). */
  solutionPathThickness?: number;
  /** Solid / dashed / dotted solution stroke. */
  solutionPathStyle?: MazeSolutionPathStyle;
  /** Always thin lines (legacy 'blocks' ignored). */
  wallStyle?: 'blocks' | 'lines';
  /** Wall thickness as a percent of the cell size. */
  wallThickness?: number;
  markerStyle?: MazeMarkerStyle;
  startImage?: string;
  endImage?: string;
  shapeImageSrc?: string;
  showShapeImage?: boolean;
  shapeImageFit?: 'contain' | 'cover' | 'stretch';
  shapeImageOpacity?: number;
  /**
   * Fixed outer box (px). Maze is auto-scaled to fit inside and centered so
   * multi-solution pages can share identical Width × Height frames.
   */
  frameSize?: number;
  frameWidth?: number;
  frameHeight?: number;
  /** Hide the start/end legend row (book pages draw markers instead). */
  showLegend?: boolean;
}

function directionFromTo(from: Position, to: Position): ArrowDir {
  const dr = to.row - from.row;
  const dc = to.col - from.col;
  if (Math.abs(dr) >= Math.abs(dc)) return dr > 0 ? 'down' : 'up';
  return dc > 0 ? 'right' : 'left';
}

/** Arrow tip points along the open path to follow (into the maze). */
function arrowPolygon(cx: number, cy: number, size: number, dir: ArrowDir): string {
  const s = Math.max(8, size * 1.35);
  switch (dir) {
    case 'up':
      return `${cx},${cy - s * 0.55} ${cx - s * 0.45},${cy + s * 0.35} ${cx + s * 0.45},${cy + s * 0.35}`;
    case 'left':
      return `${cx - s * 0.55},${cy} ${cx + s * 0.35},${cy - s * 0.45} ${cx + s * 0.35},${cy + s * 0.45}`;
    case 'right':
      return `${cx + s * 0.55},${cy} ${cx - s * 0.35},${cy - s * 0.45} ${cx - s * 0.35},${cy + s * 0.45}`;
    case 'down':
    default:
      return `${cx},${cy + s * 0.55} ${cx - s * 0.45},${cy - s * 0.35} ${cx + s * 0.45},${cy - s * 0.35}`;
  }
}

function Marker({
  kind,
  cx,
  cy,
  size,
  imageSrc,
  isStart,
  arrowDir,
}: {
  kind: MazeMarkerStyle;
  cx: number;
  cy: number;
  size: number;
  imageSrc?: string;
  isStart: boolean;
  arrowDir: ArrowDir;
}) {
  if (kind === 'image' && imageSrc) {
    const s = Math.max(10, size * 1.6);
    return (
      <image
        href={imageSrc}
        x={cx - s / 2}
        y={cy - s / 2}
        width={s}
        height={s}
        preserveAspectRatio="xMidYMid meet"
      />
    );
  }

  if (kind === 'arrow' || (kind === 'image' && !imageSrc)) {
    // Start uses directional arrow; end is always a point (caller passes kind=point).
    if (!isStart) {
      return (
        <circle cx={cx} cy={cy} r={Math.max(3, size * 0.32)} fill="#111111" />
      );
    }
    return <polygon points={arrowPolygon(cx, cy, size, arrowDir)} fill="#111111" />;
  }

  return (
    <circle cx={cx} cy={cy} r={Math.max(3, size * 0.32)} fill="#111111" />
  );
}

function solutionStrokeProps(
  style: MazeSolutionPathStyle,
  strokeWidth: number
): {
  strokeDasharray?: string;
  strokeLinecap: 'round' | 'butt' | 'square';
} {
  if (style === 'dashed') {
    const dash = Math.max(4, strokeWidth * 2.4);
    const gap = Math.max(3, strokeWidth * 1.6);
    return { strokeDasharray: `${dash} ${gap}`, strokeLinecap: 'round' };
  }
  if (style === 'dotted') {
    // Round caps + short dashes read as a dotted path.
    const gap = Math.max(3, strokeWidth * 1.85);
    return { strokeDasharray: `0.01 ${gap}`, strokeLinecap: 'round' };
  }
  return { strokeLinecap: 'round' };
}

export function MazeDisplay({
  puzzle,
  showSolution = false,
  cellSize = 16,
  wallColor = '#1f2937',
  solutionPathColor = '#e11d48',
  solutionPathThickness = 34,
  solutionPathStyle = 'solid',
  wallThickness = 45,
  markerStyle = 'arrow',
  startImage,
  endImage,
  shapeImageSrc,
  showShapeImage = false,
  shapeImageFit = 'contain',
  shapeImageOpacity = 0.35,
  frameSize,
  frameWidth,
  frameHeight,
  showLegend = false,
}: MazeDisplayProps) {
  const rows = puzzle.grid.length;
  const cols = puzzle.grid[0]?.length ?? 0;

  const boxW = frameWidth ?? frameSize;
  const boxH = frameHeight ?? frameSize;
  const fittedCell =
    boxW && boxH && rows > 0 && cols > 0
      ? Math.max(2, Math.floor(Math.min(boxW / cols, boxH / rows) * 1000) / 1000)
      : cellSize;
  const mazeW = cols * fittedCell;
  const mazeH = rows * fittedCell;
  const width = boxW ?? mazeW;
  const height = boxH ?? mazeH;
  const offsetX = (width - mazeW) / 2;
  const offsetY = (height - mazeH) / 2;

  // Always resolve a guide path so the start arrow points into the open route.
  const guidePath = React.useMemo(() => {
    if (puzzle.solutionPath && puzzle.solutionPath.length > 0) return puzzle.solutionPath;
    return solveMazePath(puzzle.grid, puzzle.start, puzzle.end);
  }, [puzzle]);

  const path = showSolution ? guidePath : [];

  const startDir: ArrowDir = React.useMemo(() => {
    if (guidePath.length >= 2) {
      return directionFromTo(guidePath[0], guidePath[1]);
    }
    // Fallback: prefer an open interior neighbor (not the outer entrance gap).
    const { start, grid } = puzzle;
    const candidates: Array<{ dir: ArrowDir; r: number; c: number; score: number }> = [
      { dir: 'down', r: start.row + 1, c: start.col, score: 0 },
      { dir: 'right', r: start.row, c: start.col + 1, score: 0 },
      { dir: 'left', r: start.row, c: start.col - 1, score: 0 },
      { dir: 'up', r: start.row - 1, c: start.col, score: 0 },
    ];
    for (const c of candidates) {
      if (c.r < 0 || c.c < 0 || c.r >= rows || c.c >= cols) continue;
      if (grid[c.r][c.c]) continue;
      // Prefer cells deeper inside the maze (odd,odd passages score higher).
      c.score = (c.r % 2 === 1 && c.c % 2 === 1 ? 2 : 1) + c.r * 0.01 + c.c * 0.001;
    }
    const open = candidates.filter((c) => c.score > 0).sort((a, b) => b.score - a.score);
    return open[0]?.dir ?? 'down';
  }, [guidePath, puzzle, rows, cols]);

  const center = (n: number) => n * fittedCell + fittedCell / 2;
  const pathPoints = path
    .map((p) => `${offsetX + center(p.col)},${offsetY + center(p.row)}`)
    .join(' ');
  const isOutside = (r: number, c: number) => puzzle.outside?.[r]?.[c] === true;
  const isWallCell = (r: number, c: number) =>
    r >= 0 && r < rows && c >= 0 && c < cols && puzzle.grid[r][c] && !isOutside(r, c);
  const lineWidth = Math.max(1, (fittedCell * Math.max(10, Math.min(100, wallThickness))) / 100);
  const pathStrokeWidth = Math.max(
    1,
    (fittedCell * Math.max(5, Math.min(100, solutionPathThickness))) / 100
  );
  const pathStroke = solutionStrokeProps(solutionPathStyle, pathStrokeWidth);

  const wallSegments: Array<{ x1: number; y1: number; x2: number; y2: number }> = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (!isWallCell(r, c)) continue;
      if (isWallCell(r, c + 1)) {
        wallSegments.push({
          x1: offsetX + center(c),
          y1: offsetY + center(r),
          x2: offsetX + center(c + 1),
          y2: offsetY + center(r),
        });
      }
      if (isWallCell(r + 1, c)) {
        wallSegments.push({
          x1: offsetX + center(c),
          y1: offsetY + center(r),
          x2: offsetX + center(c),
          y2: offsetY + center(r + 1),
        });
      }
      if (
        !isWallCell(r, c + 1) &&
        !isWallCell(r + 1, c) &&
        !isWallCell(r, c - 1) &&
        !isWallCell(r - 1, c)
      ) {
        wallSegments.push({
          x1: offsetX + center(c),
          y1: offsetY + center(r),
          x2: offsetX + center(c),
          y2: offsetY + center(r),
        });
      }
    }
  }

  return (
    <div className="inline-block bg-white" style={{ width, height }}>
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        style={{ display: 'block' }}
      >
        {showShapeImage && shapeImageSrc ? (
          <image
            href={shapeImageSrc}
            x={offsetX}
            y={offsetY}
            width={mazeW}
            height={mazeH}
            preserveAspectRatio={
              shapeImageFit === 'cover'
                ? 'xMidYMid slice'
                : shapeImageFit === 'stretch'
                ? 'none'
                : 'xMidYMid meet'
            }
            opacity={shapeImageOpacity}
          />
        ) : null}
        {wallSegments.map((seg, i) => (
          <line
            key={`seg-${i}`}
            x1={seg.x1}
            y1={seg.y1}
            x2={seg.x2}
            y2={seg.y2}
            stroke={wallColor}
            strokeWidth={lineWidth}
            strokeLinecap="round"
          />
        ))}

        {showSolution && path.length > 1 ? (
          <polyline
            points={pathPoints}
            fill="none"
            stroke={solutionPathColor}
            strokeWidth={pathStrokeWidth}
            strokeLinecap={pathStroke.strokeLinecap}
            strokeLinejoin="round"
            strokeDasharray={pathStroke.strokeDasharray}
            opacity={0.9}
          />
        ) : null}

        <Marker
          kind={markerStyle}
          cx={offsetX + center(puzzle.start.col)}
          cy={offsetY + center(puzzle.start.row)}
          size={fittedCell}
          imageSrc={startImage}
          isStart
          arrowDir={startDir}
        />
        <Marker
          kind={markerStyle === 'image' ? 'image' : 'point'}
          cx={offsetX + center(puzzle.end.col)}
          cy={offsetY + center(puzzle.end.row)}
          size={fittedCell}
          imageSrc={endImage}
          isStart={false}
          arrowDir="up"
        />
      </svg>

      {showLegend ? (
        <div className="mt-3 flex gap-4 text-sm">
          <div className="flex items-center gap-2">
            <div
              className="w-4 h-4 bg-black"
              style={{ clipPath: 'polygon(50% 100%, 0 0, 100% 0)' }}
            />
            <span>Start</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-black" />
            <span>End</span>
          </div>
        </div>
      ) : null}
    </div>
  );
}
