import type { PageNumberPosition, PageNumberSettings } from '../puzzles/types';
import { DEFAULT_PAGE_NUMBER_SETTINGS } from '../puzzles/types';
import { DEFAULT_HEADER_ASSEMBLY, normalizeNumberShapeId } from '../header-assembly/types';

const POSITIONS: PageNumberPosition[] = [
  'bottom-center',
  'bottom-left',
  'bottom-right',
  'alternating',
];

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

export function normalizePageNumberSettings(
  raw?: Partial<PageNumberSettings> | null
): PageNumberSettings {
  const base = { ...DEFAULT_PAGE_NUMBER_SETTINGS, ...raw };
  const shape = { ...DEFAULT_HEADER_ASSEMBLY.number, ...base.shape };

  return {
    enabled: !!base.enabled,
    startNumberingFrom: Math.max(0, Math.round(Number(base.startNumberingFrom) || 1)),
    startAtPage: Math.max(1, Math.round(Number(base.startAtPage) || 1)),
    position: POSITIONS.includes(base.position as PageNumberPosition)
      ? (base.position as PageNumberPosition)
      : 'bottom-center',
    shape: {
      shapeId: normalizeNumberShapeId(shape.shapeId),
      fillColor: shape.fillColor || DEFAULT_PAGE_NUMBER_SETTINGS.shape.fillColor,
      borderColor: shape.borderColor || DEFAULT_PAGE_NUMBER_SETTINGS.shape.borderColor,
      borderThicknessPx: clamp(Number(shape.borderThicknessPx) || 0, 0, 12),
      polygonSides: clamp(Math.round(Number(shape.polygonSides) || 6), 3, 12),
    },
    textColor: base.textColor || DEFAULT_PAGE_NUMBER_SETTINGS.textColor,
    fontFamily: base.fontFamily || DEFAULT_PAGE_NUMBER_SETTINGS.fontFamily,
    fontSize: clamp(Number(base.fontSize) || 14, 8, 48),
    bottomOffsetPx: clamp(Number(base.bottomOffsetPx) || 0, 0, 120),
    sideOffsetPx: clamp(Number(base.sideOffsetPx) || 0, 0, 120),
  };
}

/** Resolve the printed page number for a 0-based book page index, or null if hidden. */
export function resolveBookPageNumberText(
  bookPageIndex: number,
  settings: PageNumberSettings
): string | null {
  if (!settings.enabled) return null;

  const physicalPage = bookPageIndex + 1;
  if (physicalPage < settings.startAtPage) return null;

  const value = settings.startNumberingFrom + (physicalPage - settings.startAtPage);
  return String(value);
}

/** 0-based book page index for a puzzle at `puzzleIndex` (accounts for blank separator pages). */
export function computePuzzleBookPageIndex(
  puzzleIndex: number,
  includeBlankAfterEachPuzzle: boolean
): number {
  return includeBlankAfterEachPuzzle ? puzzleIndex * 2 : puzzleIndex;
}

/** 0-based book page index for a solution page at `solutionPageIndex`. */
export function computeSolutionBookPageIndex(
  puzzleCount: number,
  solutionPageIndex: number,
  includeBlankAfterEachPuzzle: boolean
): number {
  const puzzleSectionPages = puzzleCount * (includeBlankAfterEachPuzzle ? 2 : 1);
  return puzzleSectionPages + solutionPageIndex;
}
