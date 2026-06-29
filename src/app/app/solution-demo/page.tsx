'use client';

import React from 'react';
import { WordSearchSolutionPage } from '@/components/puzzle';
import { generateWordSearch } from '@/lib/puzzles/word-search';

export default function SolutionDemoPage() {
  const words = ['HELLO', 'WORLD', 'PUZZLE', 'SEARCH', 'WORD', 'FIND', 'GAME'];
  const puzzle = generateWordSearch(words, 12, 12);

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-center mb-8">Word Search Solution Page Demo</h1>

        <div className="bg-white rounded-lg shadow-lg p-6">
          <div className="flex justify-center">
            <WordSearchSolutionPage
              puzzle={puzzle}
              cellSize={24}
              pageWidth={8.5}
              pageHeight={11}
              margin={0.5}
              backgroundColor="#ffffff"
              titleColor="#000000"
              boxColor="#000000"
              puzzleColor="#000000"
              solutionFrameColor="#000000"
              solutionStrokeThickness={1}
              titleText="Solution"
              titleSize={20}
              showTitle={true}
            />
          </div>
        </div>

        <div className="mt-8 text-center">
          <p className="text-gray-600">
            This demonstrates the Word Search Solution Page component with rounded rectangle highlights
            around each hidden word, matching the PDF export style exactly.
          </p>
        </div>
      </div>
    </div>
  );
}
