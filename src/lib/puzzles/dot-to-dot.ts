import { DotToDotPuzzle, Position } from './types';

export function generateDotToDot(words: string[]): DotToDotPuzzle {
  const cleanWords = words
    .map(w => w.trim().toUpperCase().replace(/[^A-Z]/g, ''))
    .filter(w => w.length > 0)
    .slice(0, 26); // Max 26 for A-Z

  if (cleanWords.length === 0) {
    return { type: 'dot-to-dot', points: [], labels: [], connections: [] };
  }

  const points: Position[] = [];
  const labels: string[] = [];

  // Create a grid of positions for the dots
  const cols = Math.ceil(Math.sqrt(cleanWords.length * 1.5));
  const rows = Math.ceil(cleanWords.length / cols);

  for (let i = 0; i < cleanWords.length; i++) {
    const row = Math.floor(i / cols);
    const col = i % cols;

    // Add some randomness to positions
    const x = Math.floor((col + 0.5) * 10) + Math.floor(Math.random() * 3) - 1;
    const y = Math.floor((row + 0.5) * 10) + Math.floor(Math.random() * 3) - 1;

    points.push({ row: y, col: x });
    labels.push(cleanWords[i]);
  }

  // Create connections (each letter connects to next in sequence)
  const connections: number[][] = [];
  for (let i = 0; i < cleanWords.length - 1; i++) {
    connections.push([i, i + 1]);
  }

  return {
    type: 'dot-to-dot',
    points,
    labels,
    connections,
  };
}
