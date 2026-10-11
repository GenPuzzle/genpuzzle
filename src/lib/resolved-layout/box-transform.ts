/** Shared CSS / PDF / PPTX transform for optional rotate + flip on text and images. */

export interface BoxTransform {
  rotationDeg?: number;
  flipH?: boolean;
  flipV?: boolean;
}

export function hasBoxTransform(el: BoxTransform | undefined): boolean {
  if (!el) return false;
  return !!(el.rotationDeg || el.flipH || el.flipV);
}

export function cssBoxTransform(el: BoxTransform): {
  transform: string;
  transformOrigin: string;
} | undefined {
  const parts: string[] = [];
  if (el.flipH) parts.push('scaleX(-1)');
  if (el.flipV) parts.push('scaleY(-1)');
  if (el.rotationDeg) parts.push(`rotate(${el.rotationDeg}deg)`);
  if (parts.length === 0) return undefined;
  return { transform: parts.join(' '), transformOrigin: 'center center' };
}
