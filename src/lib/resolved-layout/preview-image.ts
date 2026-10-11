import type { ResolvedImage } from './types';

function svgPreviewUrl(svg: string): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

export function previewImageHref(el: Pick<ResolvedImage, 'href' | 'svg'>): string {
  return el.svg ? svgPreviewUrl(el.svg) : el.href;
}
