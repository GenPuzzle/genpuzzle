'use client';

import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Trash2 } from 'lucide-react';
import { AlertDialogCloseButton } from '@/components/AlertDialogCloseButton';

interface RemoveDocumentConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pageName: string;
  onConfirm: () => void;
}

export function RemoveDocumentConfirmDialog({
  open,
  onOpenChange,
  pageName,
  onConfirm,
}: RemoveDocumentConfirmDialogProps) {
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
    return () => {
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open, onOpenChange]);

  if (!mounted || !open) return null;

  const handleConfirm = () => {
    onConfirm();
    onOpenChange(false);
  };

  return createPortal(
    <>
      {/* Dimmed overlay — explicit rgba so UI stays visible underneath */}
      <div
        className="fixed inset-0 z-[9998]"
        style={{ backgroundColor: 'rgba(15, 23, 42, 0.45)' }}
        aria-hidden
        onClick={() => onOpenChange(false)}
      />

      {/* Card layer — wrapper is transparent; only the card is opaque white */}
      <div
        className="fixed inset-0 z-[9999] flex items-center justify-center p-4 pointer-events-none"
        role="presentation"
      >
        <div
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="remove-document-title"
          aria-describedby="remove-document-description"
          className="pointer-events-auto relative w-full max-w-[290px] overflow-hidden rounded-lg bg-white text-left shadow-[0_20px_25px_-5px_rgba(0,0,0,0.15),0_10px_10px_-5px_rgba(0,0,0,0.08)]"
          onClick={(e) => e.stopPropagation()}
        >
          <AlertDialogCloseButton onClick={() => onOpenChange(false)} />

          <div className="px-4 pb-4 pt-5">
            <div className="mx-auto flex h-12 w-12 shrink-0 animate-remove-dialog-pulse items-center justify-center rounded-full bg-[var(--gp-grey-100)]">
              <Trash2 className="h-8 w-8 text-[var(--gp-blue)]" strokeWidth={1.75} />
            </div>

            <div className="mt-3 text-center">
              <h2 id="remove-document-title" className="text-base font-semibold leading-6 text-[var(--gp-blue-dark)]">
                Remove pages?
              </h2>
              <p id="remove-document-description" className="mt-2 text-sm leading-5 text-[#595b5f]">
                Are you sure you want to remove those pages?
                {pageName ? (
                  <>
                    <br />
                    <span className="font-medium text-slate-700">&ldquo;{pageName}&rdquo;</span> will be
                    removed from your book.
                  </>
                ) : null}
              </p>
            </div>
          </div>

          <div className="space-y-3 px-4 pb-4">
            <button
              type="button"
              onClick={handleConfirm}
              className="inline-flex w-full justify-center rounded-md border-none bg-[var(--gp-blue)] hover:bg-[var(--gp-blue-dark)]"
            >
              Yes, remove
            </button>
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="inline-flex w-full justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-base font-medium leading-6 text-[#242525] shadow-sm transition hover:bg-slate-50"
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
