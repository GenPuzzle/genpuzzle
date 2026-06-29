import type { CoreSettings } from './puzzles/types';

export interface GridBorderSettings {
  strokeThicknessPx: number;
  cornerRadiusPx: number;
  paddingPx: number;
}

export function resolvePuzzleGridBorder(core: CoreSettings): GridBorderSettings {
  return {
    strokeThicknessPx: core.borderStrokeThickness ?? 2,
    cornerRadiusPx: core.borderCornerRadius ?? 4,
    paddingPx: core.gridBorderPadding ?? 0,
  };
}

export function resolveSolutionGridBorder(core: CoreSettings): GridBorderSettings {
  return {
    strokeThicknessPx:
      core.solutionBorderStrokeThickness ?? core.borderStrokeThickness ?? 2,
    cornerRadiusPx:
      core.solutionBorderCornerRadius ?? core.borderCornerRadius ?? 4,
    paddingPx: core.solutionGridBorderPadding ?? core.gridBorderPadding ?? 0,
  };
}
