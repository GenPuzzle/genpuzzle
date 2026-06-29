'use client';

import React from 'react';
import { DotToDotPuzzle } from '@/lib/puzzles/types';

interface DotToDotDisplayProps {
  puzzle: DotToDotPuzzle;
  showSolution?: boolean;
}

export function DotToDotDisplay({ puzzle, showSolution = false }: DotToDotDisplayProps) {
  const svgWidth = 400;
  const svgHeight = 300;

  // Convert grid positions to SVG coordinates
  const toSvgCoords = (col: number, row: number) => ({
    x: (col / 15) * svgWidth,
    y: (row / 10) * svgHeight,
  });

  return (
    <div className="inline-block p-4 bg-white rounded-lg">
      <svg width={svgWidth} height={svgHeight} className="border border-gray-300 rounded">
        {/* Draw connections if showing solution */}
        {showSolution &&
          puzzle.connections.map((conn, index) => {
            const [from, to] = conn;
            const start = toSvgCoords(puzzle.points[from].col, puzzle.points[from].row);
            const end = toSvgCoords(puzzle.points[to].col, puzzle.points[to].row);
            return (
              <line
                key={index}
                x1={start.x}
                y1={start.y}
                x2={end.x}
                y2={end.y}
                stroke="#22c55e"
                strokeWidth="2"
                strokeDasharray={index === 0 ? '0' : '4,4'}
              />
            );
          })}

        {/* Draw points and labels */}
        {puzzle.points.map((point, index) => {
          const coords = toSvgCoords(point.col, point.row);
          return (
            <g key={index}>
              <circle
                cx={coords.x}
                cy={coords.y}
                r={6}
                fill="#404040"
                stroke="#5a5f61"
                strokeWidth={2}
              />
              <text
                x={coords.x}
                y={coords.y + 20}
                textAnchor="middle"
                className="text-xs font-medium fill-gray-700"
              >
                {puzzle.labels[index]}
              </text>
            </g>
          );
        })}
      </svg>

      <p className="mt-2 text-sm text-gray-500 text-center">
        Connect the dots in order from A to Z
      </p>
    </div>
  );
}
