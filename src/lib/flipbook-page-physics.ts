export type FlipPageSide = 'left' | 'right';

export interface LeafVisuals {
  transform: string;
  foldOpacity: number;
  foldStop: number;
  curlWidth: number;
  shadowOpacity: number;
  shadowBlur: number;
  shadowOffsetX: number;
  specularOpacity: number;
  liftPx: number;
  edgeOpacity: number;
  thicknessOpacity: number;
}

/** Natural page release: ease-in, swift middle, cushioned landing. */
export function easePageTurn(t: number): number {
  const x = Math.max(0, Math.min(1, t));
  return x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2;
}

export function turnProgressFromAngle(angleDeg: number): number {
  return Math.abs(angleDeg) / 180;
}

/**
 * Hinge-locked page turn — rotateY only so the gutter edge stays fixed on the spine.
 * No translateZ: lifting mid-turn reads as horizontal slide toward the binding.
 */
export function computeLeafVisuals(angleDeg: number, side: FlipPageSide): LeafVisuals {
  const rad = (angleDeg * Math.PI) / 180;
  const absRad = Math.abs(rad);
  const sinA = Math.sin(absRad);
  const cosA = Math.cos(absRad);

  const liftPx = 0;
  const transform = `rotateY(${angleDeg}deg)`;

  const foldOpacity = Math.min(0.75, 0.1 + sinA * 0.65);
  const foldStop = 14 + sinA * 46;
  const curlWidth = 20 + sinA * 36;

  const shadowOpacity = 0.06 + sinA * 0.32;
  const shadowBlur = 6 + sinA * 22;
  const shadowOffsetX = 0;

  const specularOpacity = sinA * cosA * 0.5;
  const edgeOpacity = Math.min(1, sinA * 1.1);
  const thicknessOpacity = sinA * 0.9;

  return {
    transform,
    foldOpacity,
    foldStop,
    curlWidth,
    shadowOpacity,
    shadowBlur,
    shadowOffsetX,
    specularOpacity,
    liftPx,
    edgeOpacity,
    thicknessOpacity,
  };
}
