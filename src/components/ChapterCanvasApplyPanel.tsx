'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';

/**
 * Chapter title apply actions — same footer buttons as puzzle canvas settings.
 * Edits always stay on the current chapter until the user clicks Apply to all pages.
 */
export function ChapterCanvasApplyPanel({
  chapterCount,
  onApplyToAll,
}: {
  chapterCount: number;
  onApplyToAll: () => void;
}) {
  const [message, setMessage] = useState<string | null>(null);
  const canApplyToAll = chapterCount > 1;

  return (
    <div className="canvas-context-panel__footer border-t border-slate-200 mt-3 pt-3">
      <Button
        type="button"
        size="sm"
        className="canvas-context-panel__footer-btn canvas-context-panel__footer-btn--page"
        onClick={() => setMessage('Saved on this chapter title page only.')}
      >
        Update this page only
      </Button>
      <Button
        type="button"
        size="sm"
        className="canvas-context-panel__footer-btn canvas-context-panel__footer-btn--all"
        onClick={() => {
          onApplyToAll();
          setMessage(
            `Applied layout to all ${chapterCount} chapter title page${chapterCount === 1 ? '' : 's'}.`
          );
        }}
        disabled={!canApplyToAll}
      >
        Apply to all pages
      </Button>
      {!canApplyToAll && (
        <p className="text-[10px] text-amber-700 leading-snug w-full">
          Add more chapter pages to enable Apply to all pages.
        </p>
      )}
      {message && (
        <p className="text-[11px] text-emerald-700 text-center w-full">{message}</p>
      )}
    </div>
  );
}
