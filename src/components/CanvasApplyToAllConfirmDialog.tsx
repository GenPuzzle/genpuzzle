'use client';

import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle } from 'lucide-react';
import { AlertDialogCloseButton } from '@/components/AlertDialogCloseButton';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { formatPageNumberList } from '@/lib/canvas-edit-session';

interface CanvasApplyToAllConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editedPageIndices: number[];
  preserveEditedPages: boolean;
  onPreserveEditedPagesChange: (preserve: boolean) => void;
  onConfirm: () => void;
  confirmLabel?: string;
}

export function CanvasApplyToAllConfirmDialog({
  open,
  onOpenChange,
  editedPageIndices,
  preserveEditedPages,
  onPreserveEditedPagesChange,
  onConfirm,
  confirmLabel = 'Apply to all pages',
}: CanvasApplyToAllConfirmDialogProps) {
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

  const pageList = formatPageNumberList(editedPageIndices);

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
          aria-labelledby="canvas-apply-all-title"
          className="pointer-events-auto relative w-full max-w-[400px] overflow-hidden rounded-lg bg-white text-left shadow-xl dark:bg-slate-900"
          onClick={(e) => e.stopPropagation()}
        >
          <AlertDialogCloseButton onClick={() => onOpenChange(false)} label="Cancel" />

          <div className="px-4 pb-3 pt-5">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[var(--gp-grey-100)] dark:bg-slate-800">
              <AlertTriangle className="h-7 w-7 text-[var(--gp-blue)]" />
            </div>
            <div className="mt-3 text-center">
              <h2
                id="canvas-apply-all-title"
                className="text-base font-semibold text-[var(--gp-blue-dark)] dark:text-slate-100"
              >
                Apply to all pages?
              </h2>
              <p className="mt-2 text-sm leading-5 text-[#595b5f] dark:text-slate-300">
                Applying to all could lose custom edits made on page{editedPageIndices.length === 1 ? '' : 's'}{' '}
                <span className="font-semibold text-[var(--gp-blue-dark)] dark:text-slate-100">{pageList}</span>.
              </p>
            </div>
          </div>

          <div className="px-4 pb-2">
            <div className="flex items-start gap-2 rounded-md border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800/60">
              <Checkbox
                id="canvas-apply-all-preserve"
                checked={preserveEditedPages}
                onCheckedChange={(checked) => onPreserveEditedPagesChange(checked === true)}
              />
              <Label
                htmlFor="canvas-apply-all-preserve"
                className="text-xs font-normal leading-snug cursor-pointer text-slate-700 dark:text-slate-200"
              >
                Keep custom styling on already edited pages (page{editedPageIndices.length === 1 ? '' : 's'}{' '}
                {pageList})
              </Label>
            </div>
          </div>

          <div className="space-y-2 px-4 pb-4 pt-2">
            <button
              type="button"
              onClick={onConfirm}
              className="inline-flex w-full justify-center rounded-md bg-[#0f766e] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#0d655e]"
            >
              {confirmLabel}
            </button>
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="inline-flex w-full justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-[#242525] transition hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </>,
    document.body
  );
}
