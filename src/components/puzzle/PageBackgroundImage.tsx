'use client';

/**
 * Full-page background image layer.
 *
 * Uses an <img> (not CSS background-image + opacity). html2canvas / export
 * snapshots mishandle opacity on background-image layers, so PDF opacity
 * drifted from the live preview.
 */

import React from 'react';
import { normalizeBackgroundOpacity01 } from '@/lib/unified-background';

export type PageBackgroundImageFit = 'cover' | 'contain' | 'stretch';

export { normalizeBackgroundOpacity01 };

function objectFitFor(
  fit: PageBackgroundImageFit | undefined
): React.CSSProperties['objectFit'] {
  if (fit === 'contain') return 'contain';
  if (fit === 'stretch') return 'fill';
  return 'cover';
}

export function PageBackgroundImage({
  src,
  opacity,
  fit = 'cover',
}: {
  src: string;
  opacity?: number;
  fit?: PageBackgroundImageFit;
}) {
  const alpha = normalizeBackgroundOpacity01(opacity);
  if (alpha <= 0) return null;

  return (
    // eslint-disable-next-line @next/next/no-img-element -- data-URL page backgrounds; not Next Image
    <img
      src={src}
      alt=""
      aria-hidden
      draggable={false}
      className="absolute inset-0 pointer-events-none z-0"
      style={{
        width: '100%',
        height: '100%',
        objectFit: objectFitFor(fit),
        objectPosition: 'center',
        opacity: alpha,
      }}
    />
  );
}
