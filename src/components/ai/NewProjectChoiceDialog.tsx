'use client';

import React from 'react';
import { FilePlus2, Sparkles, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface NewProjectChoiceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onChooseManual: () => void;
  onChooseAi: () => void;
}

/** Simple fixed overlay (avoids Radix portal issues on the home screen). */
export function NewProjectChoiceDialog({
  open,
  onOpenChange,
  onChooseManual,
  onChooseAi,
}: NewProjectChoiceDialogProps) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="new-project-choice-title"
      onClick={() => onOpenChange(false)}
    >
      <div
        className="relative w-full max-w-2xl rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-1 flex items-start justify-between gap-3">
          <div>
            <h2
              id="new-project-choice-title"
              className="text-lg font-semibold text-slate-900"
            >
              Create a new project
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Choose how you want to build your puzzle book. You can always edit everything later.
            </p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0"
            onClick={() => onOpenChange(false)}
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => {
              onOpenChange(false);
              onChooseManual();
            }}
            className="group flex flex-col items-start rounded-2xl border border-slate-200 bg-white p-5 text-left shadow-sm transition hover:border-[var(--gp-blue)] hover:shadow-md"
          >
            <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-teal-50 text-teal-700 transition group-hover:bg-teal-600 group-hover:text-white">
              <FilePlus2 className="h-5 w-5" />
            </div>
            <h3 className="text-base font-semibold text-slate-900">Create Puzzles Manually</h3>
            <p className="mt-2 text-sm leading-relaxed text-slate-500">
              Start a blank project and add words, clues, and puzzles yourself — same workflow as
              before.
            </p>
          </button>

          <button
            type="button"
            onClick={() => {
              onOpenChange(false);
              onChooseAi();
            }}
            className="group flex flex-col items-start rounded-2xl border border-slate-200 bg-white p-5 text-left shadow-sm transition hover:border-violet-400 hover:shadow-md"
          >
            <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-violet-50 text-violet-700 transition group-hover:bg-violet-600 group-hover:text-white">
              <Sparkles className="h-5 w-5" />
            </div>
            <h3 className="text-base font-semibold text-slate-900">Create Puzzles with AI</h3>
            <p className="mt-2 text-sm leading-relaxed text-slate-500">
              Describe your book, pick puzzle types, and generate editable content with AI.
            </p>
          </button>
        </div>
      </div>
    </div>
  );
}
