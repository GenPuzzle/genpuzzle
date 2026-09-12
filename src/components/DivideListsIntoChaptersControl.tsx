'use client';

import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { BookOpen, RefreshCw, CheckCircle2, AlertCircle, Sparkles } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { IntegerInput } from '@/components/ui/integer-input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { useApp } from '@/lib/app-context';
import {
  CHAPTER_TITLES_DRAFT_EVENT,
  DIVIDE_LISTS_PREFERENCE_EVENT,
  readDivideListsPreference,
  writeChapterTitlesDraft,
  writeDivideListsPreference,
  type DivideListsPreference,
} from '@/lib/chapter-titles-draft';
import {
  evenChapterPuzzleCounts,
  chapterStartingNumbers,
  resolveChapterSplitSource,
} from '@/lib/split-puzzle-document-by-chapters';

export function DivideListsIntoChaptersControl({
  numberOfPuzzles,
  puzzlesStartingNumber = 1,
}: {
  numberOfPuzzles: number;
  puzzlesStartingNumber?: number;
}) {
  const { documentPages } = useApp();
  const [pref, setPref] = useState(readDivideListsPreference);
  const [titlesRevision, setTitlesRevision] = useState(0);

  // Listen to preference changes dispatched from other tabs/controls
  useEffect(() => {
    const onPref = (event: Event) => {
      const detail = (event as CustomEvent<DivideListsPreference>).detail;
      if (!detail) return;
      setPref((prev) => {
        const isSame =
          prev.enabled === (detail.enabled === true) &&
          prev.chapterCount === detail.chapterCount &&
          JSON.stringify(prev.customPuzzleCounts ?? []) === JSON.stringify(detail.customPuzzleCounts ?? []);
        if (isSame) return prev;
        return {
          enabled: detail.enabled === true,
          chapterCount: Math.max(2, detail.chapterCount || 2),
          customPuzzleCounts: detail.customPuzzleCounts,
        };
      });
    };
    const onTitles = () => setTitlesRevision((n) => n + 1);
    window.addEventListener(DIVIDE_LISTS_PREFERENCE_EVENT, onPref as EventListener);
    window.addEventListener(CHAPTER_TITLES_DRAFT_EVENT, onTitles);
    return () => {
      window.removeEventListener(DIVIDE_LISTS_PREFERENCE_EVENT, onPref as EventListener);
      window.removeEventListener(CHAPTER_TITLES_DRAFT_EVENT, onTitles);
    };
  }, []);

  const source = useMemo(
    () => resolveChapterSplitSource(documentPages, pref),
    [documentPages, pref.chapterCount, titlesRevision]
  );

  const totalPuzzles = Math.max(1, Math.round(numberOfPuzzles) || 1);
  const maxPossibleChapters = Math.max(2, totalPuzzles);
  const chapterCount = Math.max(2, Math.min(maxPossibleChapters, Math.round(pref.chapterCount) || 2));

  // Determine current puzzle counts per chapter
  const currentCounts = useMemo(() => {
    if (
      pref.customPuzzleCounts &&
      pref.customPuzzleCounts.length === chapterCount &&
      pref.customPuzzleCounts.every((c) => c >= 1)
    ) {
      return pref.customPuzzleCounts;
    }
    return evenChapterPuzzleCounts(totalPuzzles, chapterCount);
  }, [pref.customPuzzleCounts, chapterCount, totalPuzzles]);

  const starts = useMemo(() => {
    return chapterStartingNumbers(currentCounts, puzzlesStartingNumber || 1);
  }, [currentCounts, puzzlesStartingNumber]);

  const allocatedSum = currentCounts.reduce((a, b) => a + b, 0);
  const isSumBalanced = allocatedSum === totalPuzzles;

  // Update pref in state AND localStorage on explicit user actions
  const updatePreference = useCallback((next: DivideListsPreference) => {
    setPref(next);
    writeDivideListsPreference(next);
  }, []);

  const setChapterCount = (nextCount: number) => {
    const count = Math.max(2, Math.min(maxPossibleChapters, Math.round(nextCount) || 2));
    const newCounts = evenChapterPuzzleCounts(totalPuzzles, count);
    const updated: DivideListsPreference = {
      ...pref,
      chapterCount: count,
      customPuzzleCounts: newCounts,
    };
    updatePreference(updated);
    writeChapterTitlesDraft({
      titles: Array.from({ length: count }, (_, i) => source.chapterTitles[i] || `Chapter ${i + 1}: `),
      touched: true,
    });
  };

  const setChapterPuzzleCount = (chapterIndex: number, newCount: number) => {
    const val = Math.max(1, Math.round(newCount) || 1);
    const updatedCounts = [...currentCounts];
    updatedCounts[chapterIndex] = val;
    const updated: DivideListsPreference = {
      ...pref,
      customPuzzleCounts: updatedCounts,
    };
    updatePreference(updated);
  };

  const handleAutoEqualSplit = () => {
    const balanced = evenChapterPuzzleCounts(totalPuzzles, chapterCount);
    const updated: DivideListsPreference = {
      ...pref,
      customPuzzleCounts: balanced,
    };
    updatePreference(updated);
  };

  const handleCheckboxChange = (checked: boolean | string) => {
    const enabled = checked === true;
    const initialCounts = currentCounts.length === chapterCount ? currentCounts : evenChapterPuzzleCounts(totalPuzzles, chapterCount);
    const updated: DivideListsPreference = {
      enabled,
      chapterCount,
      customPuzzleCounts: initialCounts,
    };
    updatePreference(updated);
    if (enabled) {
      writeChapterTitlesDraft({
        titles: Array.from({ length: chapterCount }, (_, i) => source.chapterTitles[i] || `Chapter ${i + 1}: `),
        touched: true,
      });
    }
  };

  return (
    <div className="space-y-3 pt-1">
      {/* Checkbox row */}
      <div className="rounded-lg border border-slate-200 bg-white p-2.5 shadow-xs dark:border-slate-700 dark:bg-slate-900">
        <label className="flex items-center gap-2.5 cursor-pointer select-none">
          <Checkbox
            checked={pref.enabled}
            onCheckedChange={handleCheckboxChange}
          />
          <span className="text-sm font-medium text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
            Divide into chapters
          </span>
        </label>
      </div>

      {/* Controls displayed when enabled */}
      {pref.enabled && (
        <div className="rounded-xl border border-sky-200/80 bg-sky-50/40 p-3.5 space-y-3.5 dark:border-sky-900/60 dark:bg-sky-950/20 animate-in fade-in slide-in-from-top-1 duration-150">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-sky-900 dark:text-sky-200">
              <BookOpen className="w-4 h-4 text-sky-600 dark:text-sky-400" />
              <span>Chapter Settings</span>
            </div>
            <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
              Total: {totalPuzzles} puzzle{totalPuzzles === 1 ? '' : 's'}
            </span>
          </div>

          {/* 1. Number of Chapters Input */}
          <div className="space-y-1.5 bg-white dark:bg-slate-900 p-2.5 rounded-lg border border-slate-200/80 dark:border-slate-800">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-medium text-slate-700 dark:text-slate-300">
                Number of Chapters
              </Label>
              <span className="text-[11px] text-slate-400">
                (2 to {maxPossibleChapters})
              </span>
            </div>
            <div className="flex items-center gap-2.5">
              <IntegerInput
                value={chapterCount}
                onChange={setChapterCount}
                min={2}
                max={maxPossibleChapters}
                className="h-8 w-20 text-center font-semibold"
              />
              <span className="text-xs text-slate-600 dark:text-slate-400 font-medium">chapters</span>
            </div>
          </div>

          {/* 2. Puzzles on each chapter */}
          <div className="space-y-2 bg-white dark:bg-slate-900 p-2.5 rounded-lg border border-slate-200/80 dark:border-slate-800">
            <div className="flex items-center justify-between pb-1 border-b border-slate-100 dark:border-slate-800">
              <Label className="text-xs font-medium text-slate-700 dark:text-slate-300">
                Puzzles on each chapter
              </Label>
              <button
                type="button"
                onClick={handleAutoEqualSplit}
                className="text-[11px] text-sky-600 hover:text-sky-700 dark:text-sky-400 flex items-center gap-1 hover:underline cursor-pointer"
                title="Reset to equal distribution"
              >
                <RefreshCw className="w-3 h-3" />
                <span>Split evenly</span>
              </button>
            </div>

            {/* List of chapters with puzzle count inputs */}
            <div className="space-y-1.5 max-h-[220px] overflow-y-auto pr-1">
              {currentCounts.map((count, i) => {
                const startNum = starts[i] || 1;
                const endNum = startNum + count - 1;
                return (
                  <div
                    key={i}
                    className="flex items-center justify-between gap-2 p-1.5 rounded-md bg-slate-50 dark:bg-slate-800/60 text-xs border border-slate-100 dark:border-slate-800"
                  >
                    <div className="min-w-0 flex-1">
                      <span className="font-semibold text-slate-700 dark:text-slate-200">
                        Chapter {i + 1}
                      </span>
                      <span className="text-[11px] text-slate-400 dark:text-slate-500 ml-1.5">
                        (#{startNum}–{endNum})
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <IntegerInput
                        value={count}
                        onChange={(val) => setChapterPuzzleCount(i, val)}
                        min={1}
                        max={totalPuzzles}
                        className="h-7 w-16 text-center font-medium"
                      />
                      <span className="text-[11px] text-slate-500 dark:text-slate-400">puzzles</span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Allocation Status */}
            <div className="flex items-center justify-between pt-1 text-[11px]">
              <div className="flex items-center gap-1.5">
                {isSumBalanced ? (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                    <span className="text-emerald-700 dark:text-emerald-400 font-medium">
                      All {totalPuzzles} puzzles allocated
                    </span>
                  </>
                ) : (
                  <>
                    <AlertCircle className="w-3.5 h-3.5 text-amber-500" />
                    <span className="text-amber-700 dark:text-amber-400 font-medium">
                      Allocated: {allocatedSum} / {totalPuzzles} puzzles
                    </span>
                  </>
                )}
              </div>
              {!isSumBalanced && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleAutoEqualSplit}
                  className="h-6 px-2 text-[10px] text-amber-700 border-amber-300 hover:bg-amber-50 dark:text-amber-400 dark:border-amber-700"
                >
                  Auto-balance
                </Button>
              )}
            </div>
          </div>

          {/* 3. Link/Info with Layout tab */}
          <div className="rounded-lg border border-sky-200/90 bg-sky-100/50 p-2.5 text-[11px] space-y-1 text-sky-900 dark:border-sky-800 dark:bg-sky-950/50 dark:text-sky-200">
            <p className="font-semibold flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400 shrink-0" />
              Related to Layout · Entire book Chapter title
            </p>
            <p className="leading-relaxed text-sky-800 dark:text-sky-300 text-[10.5px]">
              Chapter title names, subtitles, and cover layouts are managed under{' '}
              <strong>Layout · Entire book · Chapter title</strong> tab controls. They automatically stay in sync with your settings here.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
