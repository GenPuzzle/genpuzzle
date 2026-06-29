'use client';

import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle } from 'lucide-react';
import { AlertDialogCloseButton } from '@/components/AlertDialogCloseButton';

interface UnsavedChangesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: () => void | Promise<void>;
  onDiscard: () => void;
  title?: string;
  description?: string;
}

export function UnsavedChangesDialog({
  open,
  onOpenChange,
  onSave,
  onDiscard,
  title = 'Save your work?',
  description = 'You have unsaved changes. Save before continuing?',
}: UnsavedChangesDialogProps) {
  const [mounted, setMounted] = useState(false);
  const [saving, setSaving] = useState(false);

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

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave();
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

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
          className="pointer-events-auto relative w-full max-w-[320px] overflow-hidden rounded-lg bg-white text-left shadow-xl"
          onClick={(e) => e.stopPropagation()}
        >
          <AlertDialogCloseButton onClick={() => onOpenChange(false)} />

          <div className="px-4 pb-4 pt-5">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[var(--gp-grey-100)]">
              <AlertTriangle className="h-7 w-7 text-[var(--gp-blue)]" />
            </div>
            <div className="mt-3 text-center">
              <h2 className="text-base font-semibold text-[var(--gp-blue-dark)]">{title}</h2>
              <p className="mt-2 text-sm leading-5 text-[#595b5f]">{description}</p>
            </div>
          </div>

          <div className="space-y-2 px-4 pb-4">
            <button
              type="button"
              disabled={saving}
              onClick={handleSave}
              className="inline-flex w-full justify-center rounded-md bg-[var(--gp-blue)] hover:bg-[var(--gp-blue-dark)]"
            >
              {saving ? 'Saving…' : 'Save project'}
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={() => {
                onDiscard();
                onOpenChange(false);
              }}
              className="inline-flex w-full justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-[#242525] transition hover:bg-slate-50 disabled:opacity-60"
            >
              Don&apos;t save
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={() => onOpenChange(false)}
              className="inline-flex w-full justify-center rounded-md px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
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
