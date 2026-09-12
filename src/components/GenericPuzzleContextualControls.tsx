'use client';

import React from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import './canvas-contextual-controls.css';

export type GenericPuzzleEditTarget = 'title' | 'page-frame';

export type GenericPuzzleContextualControlsProps = {
  puzzleTypeLabel: string;
  titleText: string;
  onTitleTextChange: (value: string) => void;
  activeTarget: GenericPuzzleEditTarget;
  onTargetChange: (target: GenericPuzzleEditTarget) => void;
  onClose: () => void;
  onCommitPage?: () => void;
  onCommitAll?: () => void;
  onCommitRange?: (range: string) => void;
  hasUnsavedChanges?: boolean;
  canApplyToAllPages?: boolean;
  documentPuzzleCount?: number;
  rangeError?: string | null;
  canApplyToSelectedPages?: (range: string) => boolean;
  variant?: 'floating' | 'sidebar';
};

/**
 * Lightweight canvas edit panel for non–word-search / non-crossword puzzle modules.
 * Same apply / cancel footer pattern as Word Search & Crossword.
 */
export function GenericPuzzleContextualControls({
  puzzleTypeLabel,
  titleText,
  onTitleTextChange,
  activeTarget,
  onClose,
  onCommitPage,
  onCommitAll,
  onCommitRange,
  hasUnsavedChanges = false,
  canApplyToAllPages = false,
  documentPuzzleCount = 0,
  rangeError = null,
  canApplyToSelectedPages,
  variant = 'sidebar',
}: GenericPuzzleContextualControlsProps) {
  const [rangeInput, setRangeInput] = React.useState('');
  const showRangeSelect = documentPuzzleCount > 1 && !!onCommitRange;
  const rangeApplyEnabled =
    rangeInput.trim().length > 0 &&
    (canApplyToSelectedPages ? canApplyToSelectedPages(rangeInput) : true);

  const body = (
    <div className="space-y-3 p-1">
      <div className="canvas-context-panel__section space-y-2">
        <Label className="canvas-context-panel__section-label">
          {activeTarget === 'title' ? 'Title' : 'Page'}
        </Label>
        <div className="canvas-context-panel__card space-y-3">
          {activeTarget === 'title' ? (
            <div className="space-y-1">
              <Label className="text-xs text-slate-500">Title Text</Label>
              <Input
                className="h-8 text-xs"
                value={titleText}
                onChange={(e) => onTitleTextChange(e.target.value)}
              />
            </div>
          ) : (
            <p className="text-xs text-slate-500">
              Page frame and layout controls for {puzzleTypeLabel} will expand here.
              Use Apply below to save canvas edits.
            </p>
          )}
        </div>
      </div>
    </div>
  );

  const footer = (
    <div className="canvas-context-panel__footer">
      {onCommitPage && (
        <Button
          type="button"
          size="sm"
          className="canvas-context-panel__footer-btn canvas-context-panel__footer-btn--page"
          onClick={onCommitPage}
          disabled={!hasUnsavedChanges}
        >
          Update this page only
        </Button>
      )}
      {showRangeSelect && (
        <div className="canvas-context-panel__footer-range">
          <Label htmlFor="generic-edit-range" className="canvas-context-panel__footer-range-label">
            Range select
          </Label>
          <Input
            id="generic-edit-range"
            value={rangeInput}
            onChange={(e) => setRangeInput(e.target.value)}
            placeholder="e.g. 1-4, 7-10, 12"
            className="canvas-context-panel__footer-range-input"
          />
          {rangeError && (
            <p className="canvas-context-panel__footer-range-error">{rangeError}</p>
          )}
          <Button
            type="button"
            size="sm"
            className="canvas-context-panel__footer-btn canvas-context-panel__footer-btn--range"
            onClick={() => onCommitRange?.(rangeInput)}
            disabled={!rangeApplyEnabled}
          >
            Apply to range pages
          </Button>
        </div>
      )}
      {onCommitAll && (
        <Button
          type="button"
          size="sm"
          className="canvas-context-panel__footer-btn canvas-context-panel__footer-btn--all"
          onClick={onCommitAll}
          disabled={!canApplyToAllPages}
        >
          Apply to all pages
        </Button>
      )}
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="canvas-context-panel__footer-btn canvas-context-panel__footer-btn--cancel"
        onClick={onClose}
      >
        Cancel
      </Button>
    </div>
  );

  if (variant === 'sidebar') {
    return (
      <div
        className="canvas-context-panel canvas-context-panel--sidebar"
        role="region"
        aria-label={`${puzzleTypeLabel} edit controls`}
      >
        <div className="canvas-context-panel__header canvas-context-panel__header--sidebar">
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-sky-600 dark:text-sky-400">
              Document · This tab
            </p>
            <span className="canvas-context-panel__title">Edit controls</span>
            <p className="canvas-context-panel__select-hint">
              Select what element to adjust on the canvas, then edit it here.
            </p>
          </div>
          <button
            type="button"
            className="canvas-context-panel__close"
            onClick={onClose}
            aria-label="Close"
            title="Close"
          >
            <X className="h-3.5 w-3.5" strokeWidth={2.5} />
          </button>
        </div>
        <div className="canvas-context-panel__body">
          <p className="canvas-context-panel__active-target">
            {activeTarget === 'title' ? 'Title' : 'Page'}
          </p>
          {body}
        </div>
        {footer}
      </div>
    );
  }

  return (
    <div className="canvas-context-panel" role="region">
      <div className="canvas-context-panel__body">{body}</div>
      {footer}
    </div>
  );
}
