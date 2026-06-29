'use client';

import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle } from 'lucide-react';
import { AlertDialogCloseButton } from '@/components/AlertDialogCloseButton';

export const LEAVE_PAGE_MESSAGE = 'Your changes may not be saved.';

export const SIGN_OUT_TITLE = 'Sign out?';
export const SIGN_OUT_MESSAGE = 'Unsaved changes will be lost.';

export interface LeavePageConfirmCopy {
  title: string;
  message: string;
  stayLabel: string;
  confirmLabel: string;
}

export const LEAVE_PAGE_COPY: LeavePageConfirmCopy = {
  title: 'Leave this page?',
  message: LEAVE_PAGE_MESSAGE,
  stayLabel: 'Stay',
  confirmLabel: 'Leave',
};

export const SIGN_OUT_COPY: LeavePageConfirmCopy = {
  title: SIGN_OUT_TITLE,
  message: SIGN_OUT_MESSAGE,
  stayLabel: 'Cancel',
  confirmLabel: 'Sign out',
};

interface LeavePageConfirmDialogProps {
  open: boolean;
  copy?: LeavePageConfirmCopy;
  onStay: () => void;
  onLeave: () => void;
}

export function LeavePageConfirmDialog({
  open,
  copy = LEAVE_PAGE_COPY,
  onStay,
  onLeave,
}: LeavePageConfirmDialogProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onStay();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, onStay]);

  if (!mounted || !open) return null;

  return createPortal(
    <>
      <div
        className="fixed inset-0 z-[10000]"
        style={{ backgroundColor: 'rgba(15, 23, 42, 0.45)' }}
        aria-hidden
        onClick={onStay}
      />
      <div className="fixed inset-0 z-[10001] flex items-center justify-center p-4 pointer-events-none">
        <div
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="leave-page-title"
          aria-describedby="leave-page-description"
          className="pointer-events-auto relative w-full max-w-[340px] overflow-hidden rounded-lg bg-white text-left shadow-xl"
          onClick={(e) => e.stopPropagation()}
        >
          <AlertDialogCloseButton onClick={onStay} />

          <div className="px-5 pb-5 pt-5">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[var(--gp-grey-100)]">
              <AlertTriangle className="h-7 w-7 text-[var(--gp-blue)]" />
            </div>
            <div className="mt-3 text-center">
              <h2 id="leave-page-title" className="text-base font-semibold text-[var(--gp-blue-dark)]">
                {copy.title}
              </h2>
              <p id="leave-page-description" className="mt-2 text-sm leading-5 text-[#595b5f]">
                {copy.message}
              </p>
            </div>
          </div>

          <div className="flex gap-2 px-5 pb-5">
            <button
              type="button"
              onClick={onStay}
              className="inline-flex flex-1 justify-center rounded-md bg-[var(--gp-blue)] hover:bg-[var(--gp-blue-dark)]"
            >
              {copy.stayLabel}
            </button>
            <button
              type="button"
              onClick={onLeave}
              className="inline-flex flex-1 justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-[#242525] transition hover:bg-slate-50"
            >
              {copy.confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </>,
    document.body
  );
}
