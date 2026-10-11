'use client';

import { useEffect } from 'react';
import { ensureGpIsolationRuntime, readGpIsolationFlags } from '@/lib/gp-isolation';

const NO_ANIM_STYLE_ID = 'gp-iso-no-anim';

/**
 * Isolation test hooks for Crossword freeze diagnosis.
 * Does not change production behavior unless ?gpIso=… is present.
 */
export default function GpIsolationEffects() {
  useEffect(() => {
    ensureGpIsolationRuntime();
    const flags = readGpIsolationFlags();
    const existing = document.getElementById(NO_ANIM_STYLE_ID);

    if (flags.has('noAnim')) {
      if (!existing) {
        const style = document.createElement('style');
        style.id = NO_ANIM_STYLE_ID;
        style.textContent = `
          .preview-canvas-scale,
          .preview-canvas-scale *,
          .all-pages-grid,
          .all-pages-grid *,
          [data-preview-root],
          [data-preview-root] * {
            transition: none !important;
            animation: none !important;
            animation-duration: 0s !important;
            transition-duration: 0s !important;
            will-change: auto !important;
          }
        `;
        document.head.appendChild(style);
      }
      console.info('[gp-iso] noAnim: transitions/animations disabled on preview subtree');
    } else if (existing) {
      existing.remove();
    }

    if (flags.has('cwPlaceholder')) {
      console.info('[gp-iso] cwPlaceholder: Crossword preview replaced with static placeholder');
    }
    if (flags.has('skipHistory')) {
      console.info('[gp-iso] skipHistory: edit-history clone skipped on insert');
    }
  }, []);

  return null;
}
