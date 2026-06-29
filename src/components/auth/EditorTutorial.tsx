'use client';

import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import {
  BookOpen,
  ChevronLeft,
  ChevronRight,
  FileText,
  LayoutTemplate,
  MousePointerClick,
  PanelLeft,
  Plus,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AlertDialogCloseButton } from '@/components/AlertDialogCloseButton';
import { useApp } from '@/lib/app-context';

const STEPS = [
  {
    title: 'Welcome to GenPuzzle',
    icon: BookOpen,
    body: 'You are starting with a blank project. This short guide shows where the main tools live so you can build your first puzzle book.',
  },
  {
    title: 'Settings sidebar',
    icon: PanelLeft,
    body: 'Use the left sidebar to set trim size, word lists, typography, colors, and puzzle options. Changes can apply to one page or the whole book.',
  },
  {
    title: 'Add documents',
    icon: Plus,
    body: 'Click the + in the Documents bar above the canvas to add a Word Search section or front matter pages (title page, instructions, etc.).',
  },
  {
    title: 'Canvas preview',
    icon: MousePointerClick,
    body: 'The canvas shows your page layout. After you generate puzzles, click title, grid, word list, or background elements to edit them directly on the page.',
  },
  {
    title: 'Save & export',
    icon: FileText,
    body: 'Use File in the top bar to save your project, open an existing file, export PDF/PPT, or share a link when you are ready.',
  },
  {
    title: 'Templates (coming soon)',
    icon: LayoutTemplate,
    body: 'Ready-made book layouts will appear on the home screen later. For now, start with New project and add your own documents.',
  },
] as const;

export function EditorTutorial() {
  const { showEditorTutorial, dismissEditorTutorial } = useApp();
  const [step, setStep] = useState(0);
  const [mounted, setMounted] = useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  React.useEffect(() => {
    if (showEditorTutorial) {
      setStep(0);
    }
  }, [showEditorTutorial]);

  if (!mounted || !showEditorTutorial) return null;

  const current = STEPS[step];
  const Icon = current.icon;
  const isFirst = step === 0;
  const isLast = step === STEPS.length - 1;

  return createPortal(
    <>
      <div
        className="fixed inset-0 z-[9990] bg-transparent"
        aria-hidden
        onClick={dismissEditorTutorial}
      />
      <div className="fixed inset-0 z-[9991] flex items-center justify-center p-4 pointer-events-none">
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="editor-tutorial-title"
          className="pointer-events-auto w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          <div
            className="relative px-6 pb-5 pt-6 text-white"
            style={{ background: 'linear-gradient(to right, #1a5a8c 0%, #2276b4 100%)' }}
          >
            <AlertDialogCloseButton
              variant="onDark"
              onClick={dismissEditorTutorial}
              label="Close tutorial"
            />
            <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-white/15">
              <Icon className="h-6 w-6" />
            </div>
            <p className="text-xs font-semibold uppercase tracking-wider text-blue-100">
              Step {step + 1} of {STEPS.length}
            </p>
            <h2 id="editor-tutorial-title" className="mt-1 text-xl font-bold">
              {current.title}
            </h2>
          </div>

          <div className="px-6 py-5">
            <p className="text-sm leading-relaxed text-slate-600">{current.body}</p>

            <div className="mt-5 flex justify-center gap-1.5">
              {STEPS.map((_, index) => (
                <span
                  key={index}
                  className={`h-1.5 rounded-full transition-all ${
                    index === step ? 'w-6 bg-[var(--gp-blue)]' : 'w-1.5 bg-slate-200'
                  }`}
                />
              ))}
            </div>

            <div className="mt-6 flex items-center justify-between gap-3">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={dismissEditorTutorial}
                className="text-slate-500"
              >
                Skip tutorial
              </Button>
              <div className="flex gap-2">
                {!isFirst && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setStep((s) => s - 1)}
                  >
                    <ChevronLeft className="mr-1 h-4 w-4" />
                    Back
                  </Button>
                )}
                {isLast ? (
                  <Button type="button" size="sm" onClick={dismissEditorTutorial}>
                    Get started
                  </Button>
                ) : (
                  <Button type="button" size="sm" onClick={() => setStep((s) => s + 1)}>
                    Next
                    <ChevronRight className="ml-1 h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>,
    document.body
  );
}
