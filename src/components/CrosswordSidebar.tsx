'use client';

import React, { useState } from 'react';
import { BookOpen, Settings2, Sparkles, Zap } from 'lucide-react';
import { useApp } from '@/lib/app-context';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { SliderField } from '@/components/ui/slider-field';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { CrosswordAnswerCase, CrosswordSettings } from '@/lib/crossword-settings';
import { getDefaultCrosswordSettings } from '@/lib/crossword-settings';
import type { PuzzleModuleSettings } from '@/lib/document-model';
import { ChapterPagesBatchPanel } from '@/components/ChapterPagesBatchPanel';
import { cn } from '@/lib/utils';

/**
 * Left pane — crossword generation / structural controls.
 */
export function CrosswordSidebar() {
  const {
    activeDocumentPage,
    crosswordSettings,
    updateCrosswordSettings,
    generatePuzzle,
    titleWords,
    setTitleWords,
  } = useApp();

  const settings = crosswordSettings ?? getDefaultCrosswordSettings();
  const { core } = settings;
  const [activeTab, setActiveTab] = useState('general');
  const [collapsed, setCollapsed] = useState(false);

  if (activeDocumentPage?.moduleType !== 'crossword') {
    return null;
  }

  const patchCore = (patch: Partial<CrosswordSettings['core']>) => {
    updateCrosswordSettings({ core: { ...core, ...patch } });
  };

  const handleGenerate = () => {
    generatePuzzle();
  };

  return (
    <div
      className={cn(
        'h-full flex bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-700 shadow-xl transition-all duration-300',
        collapsed ? 'w-24' : 'w-80'
      )}
    >
      <Tabs
        value={activeTab}
        onValueChange={(v) => {
          setActiveTab(v);
          setCollapsed(false);
        }}
        orientation="vertical"
        className="flex h-full w-full"
      >
        <TabsList className="flex h-auto flex-col w-24 gap-3 bg-transparent shrink-0 py-4 px-2">
          <TabsTrigger
            value="general"
            className="flex flex-col gap-1 h-auto py-3 data-[state=active]:bg-blue-50 data-[state=active]:text-blue-700"
            onPointerDown={(e) => {
              if (activeTab === 'general') {
                e.preventDefault();
                setCollapsed((c) => !c);
              }
            }}
          >
            <Settings2 className="h-4 w-4" />
            <span className="text-[10px] font-semibold">General</span>
          </TabsTrigger>
          <TabsTrigger
            value="content"
            className="flex flex-col gap-1 h-auto py-3 data-[state=active]:bg-blue-50 data-[state=active]:text-blue-700"
            onPointerDown={(e) => {
              if (activeTab === 'content') {
                e.preventDefault();
                setCollapsed((c) => !c);
              }
            }}
          >
            <Sparkles className="h-4 w-4" />
            <span className="text-[10px] font-semibold">AI</span>
          </TabsTrigger>
          <TabsTrigger
            value="book"
            className="flex flex-col gap-1 h-auto py-3 data-[state=active]:bg-blue-50 data-[state=active]:text-blue-700"
            onPointerDown={(e) => {
              if (activeTab === 'book') {
                e.preventDefault();
                setCollapsed((c) => !c);
              }
            }}
          >
            <BookOpen className="h-4 w-4" />
            <span className="text-[10px] font-semibold">Book</span>
          </TabsTrigger>
          <div className="mt-auto px-1">
            <Button
              type="button"
              size="sm"
              className="w-full h-auto flex flex-col gap-1 py-2.5"
              onClick={handleGenerate}
              title="Generate crossword puzzles"
            >
              <Zap className="h-4 w-4" />
              <span className="text-[9px] font-bold leading-tight">Generate</span>
            </Button>
          </div>
        </TabsList>

        {!collapsed && (
          <div className="flex-1 overflow-y-auto border-l border-slate-100 dark:border-slate-800 p-4 space-y-4">
            <TabsContent value="general" className="mt-0 space-y-4">
              <div>
                <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 mb-1">
                  Crossword — General
                </h3>
                <p className="text-[11px] text-slate-500 mb-3">
                  Structural parameters for puzzle generation.
                </p>
              </div>

              <SliderField
                label="Number of Puzzles"
                value={core.numberOfPuzzles}
                onValueChange={(v) => patchCore({ numberOfPuzzles: v })}
                min={1}
                max={400}
                step={1}
              />
              <SliderField
                label="Puzzles Starting Number"
                value={core.puzzlesStartingNumber}
                onValueChange={(v) => patchCore({ puzzlesStartingNumber: v })}
                min={1}
                max={1000000}
                step={1}
              />
              <SliderField
                label="Clues per Puzzle"
                value={core.cluesPerPuzzle}
                onValueChange={(v) => patchCore({ cluesPerPuzzle: v })}
                min={0}
                max={50}
                step={1}
              />

              <div className="space-y-2 pt-2 border-t border-slate-100">
                <Label className="text-xs font-semibold text-slate-600">Grid Dimensions</Label>
                <SliderField
                  label="Letters Across"
                  value={core.lettersAcross}
                  onValueChange={(v) => patchCore({ lettersAcross: v })}
                  min={3}
                  max={50}
                  step={1}
                />
                <SliderField
                  label="Letters Down"
                  value={core.lettersDown}
                  onValueChange={(v) => patchCore({ lettersDown: v })}
                  min={3}
                  max={50}
                  step={1}
                />
                <SliderField
                  label="Puzzle Size (% of Page)"
                  value={core.puzzleSizePercent}
                  onValueChange={(v) => patchCore({ puzzleSizePercent: v })}
                  min={20}
                  max={80}
                  step={1}
                  format="%"
                />
              </div>

              <div className="space-y-2 pt-2 border-t border-slate-100">
                <Label className="text-xs font-semibold text-slate-600">Answer Formatting</Label>
                <div className="space-y-1">
                  <Label className="text-xs text-slate-500">Select Case</Label>
                  <Select
                    value={core.answerCase}
                    onValueChange={(v) => patchCore({ answerCase: v as CrosswordAnswerCase })}
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="upper">UPPER</SelectItem>
                      <SelectItem value="lower">lower</SelectItem>
                      <SelectItem value="original">Original</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <label className="flex items-center gap-2 text-xs cursor-pointer">
                  <Checkbox
                    checked={core.twoPagePuzzles}
                    onCheckedChange={(c) => patchCore({ twoPagePuzzles: c === true })}
                  />
                  Two Page Puzzles
                </label>
                <label className="flex items-center gap-2 text-xs cursor-pointer">
                  <Checkbox
                    checked={core.allowNumbersInAnswers}
                    onCheckedChange={(c) => patchCore({ allowNumbersInAnswers: c === true })}
                  />
                  Allow Numbers in Answers
                </label>
                <label className="flex items-center gap-2 text-xs cursor-pointer">
                  <Checkbox
                    checked={core.kidsMode}
                    onCheckedChange={(c) => patchCore({ kidsMode: c === true })}
                  />
                  Kids Mode
                </label>
              </div>
            </TabsContent>

            <TabsContent value="content" className="mt-0 space-y-4">
              <div>
                <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 mb-1">
                  AI & Content
                </h3>
              </div>
              <label className="flex items-center gap-2 text-xs cursor-pointer">
                <Checkbox
                  checked={core.useAiClues}
                  onCheckedChange={(c) => patchCore({ useAiClues: c === true })}
                />
                Use AI to Generate Clues/Answers
              </label>
              <div className="space-y-1">
                <Label className="text-xs text-slate-500">Themes (one per line)</Label>
                <textarea
                  className="w-full min-h-[88px] rounded-md border border-slate-200 bg-white px-2 py-1.5 text-xs"
                  value={core.themes}
                  onChange={(e) => patchCore({ themes: e.target.value })}
                  placeholder="Cruise ships&#10;Tropical islands"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-slate-500">Language</Label>
                <Input
                  className="h-8 text-xs"
                  value={core.language}
                  onChange={(e) => patchCore({ language: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-slate-500">Age Level</Label>
                <Input
                  className="h-8 text-xs"
                  value={core.ageLevel}
                  onChange={(e) => patchCore({ ageLevel: e.target.value })}
                />
              </div>
              <SliderField
                label="Max Clue Characters"
                value={core.maxClueCharacters}
                onValueChange={(v) => patchCore({ maxClueCharacters: v })}
                min={3}
                max={60}
                step={1}
              />
              <SliderField
                label="Max Answer Length"
                value={core.maxAnswerLength}
                onValueChange={(v) => patchCore({ maxAnswerLength: v })}
                min={2}
                max={30}
                step={1}
              />
              <div className="space-y-1 pt-2 border-t border-slate-100">
                <Label className="text-xs text-slate-500">Answer words (one per line)</Label>
                <textarea
                  className="w-full min-h-[100px] rounded-md border border-slate-200 bg-white px-2 py-1.5 text-xs"
                  value={titleWords.words.join('\n')}
                  onChange={(e) =>
                    setTitleWords({
                      ...titleWords,
                      words: e.target.value
                        .split('\n')
                        .map((w) => w.trim())
                        .filter(Boolean),
                    })
                  }
                  placeholder="BOARDING&#10;PASSPORT&#10;CABIN"
                />
              </div>
            </TabsContent>

            <TabsContent value="book" className="mt-0 space-y-4">
              <div>
                <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 mb-1">Book</h3>
                <p className="text-[11px] text-slate-500">
                  Trim and solution options follow your Word Search book canvas when exporting.
                </p>
              </div>
              <label className="flex items-center gap-2 text-xs cursor-pointer">
                <Checkbox
                  checked={settings.bookCanvas.includeBleed}
                  onCheckedChange={(c) =>
                    updateCrosswordSettings({
                      bookCanvas: { ...settings.bookCanvas, includeBleed: c === true },
                    })
                  }
                />
                Include Bleed
              </label>
              <SliderField
                label="Answers Per Page"
                value={settings.bookCanvas.answersPerPage}
                onValueChange={(v) =>
                  updateCrosswordSettings({
                    bookCanvas: { ...settings.bookCanvas, answersPerPage: v },
                  })
                }
                min={1}
                max={6}
                step={1}
              />
              <div className="pt-3 border-t border-slate-200 dark:border-slate-700">
                <ChapterPagesBatchPanel />
              </div>
            </TabsContent>
          </div>
        )}
      </Tabs>
    </div>
  );
}

/** Persist helper used by app-context when leaving a crossword document. */
export function readCrosswordSettingsFromDocument(
  settings: PuzzleModuleSettings | undefined
): CrosswordSettings {
  return settings?.crosswordSettings ?? getDefaultCrosswordSettings();
}
