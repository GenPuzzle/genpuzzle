'use client';

import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle } from 'lucide-react';
import { AlertDialogCloseButton } from '@/components/AlertDialogCloseButton';

interface CanvasEditUnsavedDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCommitPage: () => void;
  onCommitAll: () => void;
  onDiscard: () => void;
  hasUnsavedChanges: boolean;
  canApplyToAllPages: boolean;
}

export function CanvasEditUnsavedDialog({
  open,
  onOpenChange,
  onCommitPage,
  onCommitAll,
  onDiscard,
  hasUnsavedChanges,
  canApplyToAllPages,
}: CanvasEditUnsavedDialogProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onOpenChange(false);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, onOpenChange]);

  if (!mounted || !open) return null;

  return createPortal(
    <>
      <div
        className="fixed inset-0 z-[9998]"
        style={{ backgroundColor: 'rgba(15, 23, 42, 0.45)' }}
        aria-hidden
        onClick={() => onOpenChange(false)}
      />
      <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 pointer-events-none">
        <div
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="canvas-edit-unsaved-title"
          className="pointer-events-auto relative w-full max-w-[340px] overflow-hidden rounded-lg bg-white text-left shadow-xl"
          onClick={(e) => e.stopPropagation()}
        >
          <AlertDialogCloseButton onClick={() => onOpenChange(false)} label="Keep editing" />

          <div className="px-4 pb-4 pt-5">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[var(--gp-grey-100)]">
              <AlertTriangle className="h-7 w-7 text-[var(--gp-blue)]" />
            </div>
            <div className="mt-3 text-center">
              <h2
                id="canvas-edit-unsaved-title"
                className="text-base font-semibold text-[var(--gp-blue-dark)]"
              >
                Your changes may not be saved
              </h2>
              <p className="mt-2 text-sm leading-5 text-[#595b5f]">
                Save your canvas edits before leaving, or discard them to continue.
              </p>
            </div>
          </div>

          <div className="space-y-2 px-4 pb-4">
            <button
              type="button"
              onClick={onCommitPage}
              disabled={!hasUnsavedChanges}
              className="inline-flex w-full justify-center rounded-md bg-[var(--gp-blue)] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[var(--gp-blue-dark)] disabled:cursor-not-allowed disabled:opacity-50"
            >
              Update this page only
            </button>
            <button
              type="button"
              onClick={onCommitAll}
              disabled={!canApplyToAllPages}
              className="inline-flex w-full justify-center rounded-md bg-[#0f766e] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#0d655e] disabled:cursor-not-allowed disabled:opacity-50"
            >
              Apply to all pages
            </button>
            <button
              type="button"
              onClick={onDiscard}
              className="inline-flex w-full justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-[#242525] transition hover:bg-slate-50"
            >
              Don&apos;t save
            </button>
          </div>
        </div>
      </div>
    </>,
    document.body
  );
}
