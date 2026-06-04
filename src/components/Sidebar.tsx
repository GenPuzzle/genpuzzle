'use client';

import React, { useState } from 'react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { SliderField } from '@/components/ui/slider-field';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Book, Settings, Type, Palette, Grid3X3, RotateCw } from 'lucide-react';

import { useApp } from '@/lib/app-context';
import { TRIM_SIZES, TrimSize, Direction } from '@/lib/puzzles/types';
import { getCategories, getQuotesByCategory, getRandomQuote } from '@/lib/puzzles/cryptogram';
import { PUBLISHING_FONTS } from '@/lib/publishing-fonts';

const DIRECTION_OPTIONS: { value: Direction; label: string }[] = [
  { value: 'horizontal', label: '→' },
  { value: 'horizontal-reverse', label: '←' },
  { value: 'vertical', label: '↓' },
  { value: 'vertical-reverse', label: '↑' },
  { value: 'diagonal-down', label: '↘' },
  { value: 'diagonal-down-reverse', label: '↖' },
  { value: 'diagonal-up', label: '↗' },
  { value: 'diagonal-up-reverse', label: '↙' },
];

export function Sidebar() {
  const {
    bookSettings,
    setBookSettings,
    puzzleSettings,
    setPuzzleSettings,
    titleWords,
    setTitleWords,
    colorSettings,
    setColorSettings,
    currentPuzzleType,
    setCurrentPuzzleType,
    sudokuDifficulty,
    setSudokuDifficulty,
    mazeSize,
    setMazeSize,
    cryptogramText,
    setCryptogramText,
    generatePuzzle,
  } = useApp();

  const [quoteCategory, setQuoteCategory] = useState<string>('all');
  const [directionToggles, setDirectionToggles] = useState<Record<Direction, boolean>>({
    horizontal: true,
    'horizontal-reverse': false,
    vertical: true,
    'vertical-reverse': false,
    'diagonal-down': true,
    'diagonal-down-reverse': false,
    'diagonal-up': true,
    'diagonal-up-reverse': false,
  });

  const handleDirectionToggle = (dir: Direction) => {
    const newToggles = { ...directionToggles };
    newToggles[dir] = !newToggles[dir];
    setDirectionToggles(newToggles);

    const activeDirections = Object.entries(newToggles)
      .filter(([, active]) => active)
      .map(([dir]) => dir as Direction);

    if (activeDirections.length > 0) {
      setPuzzleSettings({ ...puzzleSettings, directions: activeDirections });
    }
  };

  const handleRandomQuote = () => {
    const quote = getRandomQuote();
    setCryptogramText(quote.text);
  };

  const handleWordsChange = (value: string) => {
    const words = value.split('\n').map(w => w.trim()).filter(w => w.length > 0);
    setTitleWords({ ...titleWords, words });
  };

  const handleGenerate = () => {
    generatePuzzle();
  };

  return (
    <div className="w-80 h-screen bg-gradient-to-b from-slate-50 to-white dark:from-slate-950 dark:to-slate-900 border-r border-gray-200 dark:border-slate-800 flex flex-col shadow-lg">
      <style>{`
        /* Smooth accordion animations */
        [data-state="open"] > [data-orientation="vertical"] {
          animation: slideDown 300ms ease-out;
        }
        
        [data-state="closed"] > [data-orientation="vertical"] {
          animation: slideUp 200ms ease-in;
        }
        
        /* Accordion trigger modern styling */
        [role="button"][data-state="open"] {
          background-color: rgba(99, 102, 241, 0.05);
        }
        
        [role="button"][data-state="open"]:hover {
          background-color: rgba(99, 102, 241, 0.1);
        }
      `}</style>

      {/* Scrollable Accordion Content */}
      <Accordion type="multiple" defaultValue={['book', 'puzzle', 'words', 'colors']} className="w-full flex-1 overflow-y-auto px-2 py-3 space-y-2">
        
        {/* Book Settings Section */}
        <AccordionItem value="book" className="border-0 rounded-lg bg-white dark:bg-slate-800 shadow-sm hover:shadow-md transition-shadow duration-200 border border-gray-200 dark:border-slate-700 overflow-hidden">
          <AccordionTrigger className="px-4 py-3 hover:bg-gradient-to-r hover:from-blue-50 hover:to-indigo-50 dark:hover:from-slate-700 dark:hover:to-slate-700 transition-all duration-200 [&[data-state=open]>svg]:rotate-180">
            <div className="flex items-center gap-3 text-left">
              <div className="p-2 bg-gradient-to-br from-blue-400 to-blue-500 rounded-lg">
                <Book className="w-4 h-4 text-white" />
              </div>
              <span className="font-semibold text-gray-900 dark:text-white">Book Settings</span>
            </div>
          </AccordionTrigger>
          <AccordionContent className="px-4 py-4 space-y-4 bg-gradient-to-b from-white to-gray-50 dark:from-slate-800 dark:to-slate-850 border-t border-gray-100 dark:border-slate-700">
            <div className="space-y-2 animate-fade-in">
              <Label className="text-sm font-medium text-gray-700 dark:text-gray-200">Trim Size</Label>
              <Select
                value={bookSettings.trimSize}
                onValueChange={(value) =>
                  setBookSettings({ ...bookSettings, trimSize: value as TrimSize })
                }
              >
                <SelectTrigger className="mt-1 border-gray-300 dark:border-slate-600 hover:border-indigo-400 transition-colors duration-200">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(TRIM_SIZES).map(([key, { label }]) => (
                    <SelectItem key={key} value={key}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center justify-between p-3 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-slate-700 dark:to-slate-600 rounded-lg hover:shadow-sm transition-shadow duration-200">
              <Label className="text-sm font-medium text-gray-700 dark:text-gray-200">Include Bleed (0.125")</Label>
              <Switch
                checked={bookSettings.includeBleed}
                onCheckedChange={(checked) =>
                  setBookSettings({ ...bookSettings, includeBleed: checked })
                }
                className="data-[state=checked]:bg-indigo-600"
              />
            </div>

            <div className="flex items-center justify-between p-3 bg-gradient-to-r from-green-50 to-emerald-50 dark:from-slate-700 dark:to-slate-600 rounded-lg hover:shadow-sm transition-shadow duration-200">
              <Label className="text-sm font-medium text-gray-700 dark:text-gray-200">Include Solution Page</Label>
              <Switch
                checked={bookSettings.includeSolution}
                onCheckedChange={(checked) =>
                  setBookSettings({ ...bookSettings, includeSolution: checked })
                }
                className="data-[state=checked]:bg-indigo-600"
              />
            </div>

            <SliderField
              label="Puzzles Per Page"
              value={bookSettings.puzzlesPerPage}
              onValueChange={(value) =>
                setBookSettings({ ...bookSettings, puzzlesPerPage: value })
              }
              min={1}
              max={4}
              step={1}
              labelClassName="text-sm font-medium text-gray-700 dark:text-gray-200"
            />
          </AccordionContent>
        </AccordionItem>

        {/* Puzzle Settings Section */}
        <AccordionItem value="puzzle" className="border-0 rounded-lg bg-white dark:bg-slate-800 shadow-sm hover:shadow-md transition-shadow duration-200 border border-gray-200 dark:border-slate-700 overflow-hidden">
          <AccordionTrigger className="px-4 py-3 hover:bg-gradient-to-r hover:from-purple-50 hover:to-pink-50 dark:hover:from-slate-700 dark:hover:to-slate-700 transition-all duration-200 [&[data-state=open]>svg]:rotate-180">
            <div className="flex items-center gap-3 text-left">
              <div className="p-2 bg-gradient-to-br from-purple-400 to-pink-500 rounded-lg">
                <Settings className="w-4 h-4 text-white" />
              </div>
              <span className="font-semibold text-gray-900 dark:text-white">Puzzle Settings</span>
            </div>
          </AccordionTrigger>
          <AccordionContent className="px-4 py-4 space-y-4 bg-gradient-to-b from-white to-gray-50 dark:from-slate-800 dark:to-slate-850 border-t border-gray-100 dark:border-slate-700 animate-fade-in">
            
            {/* Grid Size */}
            {['word-search', 'crossword'].includes(currentPuzzleType) && (
              <div>
                <SliderField
                  label="Grid Size"
                  value={puzzleSettings.gridSize}
                  onValueChange={(value) =>
                    setPuzzleSettings({ ...puzzleSettings, gridSize: value })
                  }
                  min={10}
                  max={25}
                  step={1}
                  formatValue={(v) => `${v}×${v}`}
                  labelClassName="text-sm font-medium text-gray-700 dark:text-gray-200"
                />
              </div>
            )}

            {/* Word Placement Directions */}
            {currentPuzzleType === 'word-search' && (
              <div className="space-y-3">
                <Label className="text-sm font-medium text-gray-700 dark:text-gray-200 block">Word Placement Directions</Label>
                <div className="grid grid-cols-4 gap-2">
                  {DIRECTION_OPTIONS.map((dir) => (
                    <button
                      key={dir.value}
                      onClick={() => handleDirectionToggle(dir.value)}
                      className={`w-10 h-10 rounded-lg border-2 text-lg flex items-center justify-center transition-all duration-200 transform hover:scale-110 font-semibold ${
                        directionToggles[dir.value]
                          ? 'bg-gradient-to-br from-indigo-500 to-indigo-600 text-white border-indigo-600 shadow-lg shadow-indigo-300/30'
                          : 'bg-white dark:bg-slate-700 text-gray-600 dark:text-gray-300 border-gray-300 dark:border-slate-600 hover:border-indigo-400 dark:hover:border-indigo-400'
                      }`}
                      title={dir.label}
                    >
                      {dir.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Sudoku Difficulty */}
            {currentPuzzleType === 'sudoku' && (
              <div className="space-y-3">
                <Label className="text-sm font-medium text-gray-700 dark:text-gray-200 block">Difficulty</Label>
                <div className="grid grid-cols-3 gap-2">
                  {(['easy', 'medium', 'hard'] as const).map((diff) => (
                    <Button
                      key={diff}
                      variant={sudokuDifficulty === diff ? 'default' : 'outline'}
                      onClick={() => setSudokuDifficulty(diff)}
                      className={`capitalize text-sm transition-all duration-200 ${
                        sudokuDifficulty === diff
                          ? 'bg-gradient-to-r from-indigo-500 to-indigo-600 hover:from-indigo-600 hover:to-indigo-700 shadow-lg shadow-indigo-300/30'
                          : 'hover:bg-gradient-to-r hover:from-indigo-50 hover:to-indigo-100 dark:hover:from-slate-700 dark:hover:to-slate-600'
                      }`}
                      size="sm"
                    >
                      {diff}
                    </Button>
                  ))}
                </div>
              </div>
            )}

            {/* Maze Size */}
            {currentPuzzleType === 'maze' && (
              <div className="space-y-2">
                <Label className="text-sm font-medium text-gray-700 dark:text-gray-200">Maze Size</Label>
                <Select value={mazeSize} onValueChange={(v: any) => setMazeSize(v)}>
                  <SelectTrigger className="mt-1 border-gray-300 dark:border-slate-600 hover:border-indigo-400 transition-colors duration-200">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="small">Small (10x10)</SelectItem>
                    <SelectItem value="medium">Medium (15x15)</SelectItem>
                    <SelectItem value="large">Large (20x20)</SelectItem>
                    <SelectItem value="xl">Extra Large (25x25)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Cryptogram Quote Selection */}
            {currentPuzzleType === 'cryptogram' && (
              <div className="space-y-3">
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-gray-700 dark:text-gray-200">Select a Quote</Label>
                  <Select value={quoteCategory} onValueChange={setQuoteCategory}>
                    <SelectTrigger className="mt-1 border-gray-300 dark:border-slate-600 hover:border-indigo-400 transition-colors duration-200">
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Categories</SelectItem>
                      {getCategories().map((cat) => (
                        <SelectItem key={cat} value={cat}>
                          {cat}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={handleRandomQuote} 
                  className="w-full hover:bg-gradient-to-r hover:from-indigo-50 hover:to-indigo-100 dark:hover:from-slate-700 dark:hover:to-slate-600 transition-all duration-200 border-gray-300 dark:border-slate-600"
                >
                  <RotateCw className="w-4 h-4 mr-2" />
                  Random Quote
                </Button>
              </div>
            )}
          </AccordionContent>
        </AccordionItem>

        {/* Title/Words Settings Section */}
        <AccordionItem value="words" className="border-0 rounded-lg bg-white dark:bg-slate-800 shadow-sm hover:shadow-md transition-shadow duration-200 border border-gray-200 dark:border-slate-700 overflow-hidden">
          <AccordionTrigger className="px-4 py-3 hover:bg-gradient-to-r hover:from-amber-50 hover:to-orange-50 dark:hover:from-slate-700 dark:hover:to-slate-700 transition-all duration-200 [&[data-state=open]>svg]:rotate-180">
            <div className="flex items-center gap-3 text-left">
              <div className="p-2 bg-gradient-to-br from-amber-400 to-orange-500 rounded-lg">
                <Type className="w-4 h-4 text-white" />
              </div>
              <span className="font-semibold text-gray-900 dark:text-white">Title & Words</span>
            </div>
          </AccordionTrigger>
          <AccordionContent className="px-4 py-4 space-y-4 bg-gradient-to-b from-white to-gray-50 dark:from-slate-800 dark:to-slate-850 border-t border-gray-100 dark:border-slate-700 animate-fade-in">
            <div className="space-y-2">
              <Label className="text-sm font-medium text-gray-700 dark:text-gray-200">Puzzle Title</Label>
              <Input
                value={titleWords.title}
                onChange={(e) => setTitleWords({ ...titleWords, title: e.target.value })}
                placeholder="Enter puzzle title"
                className="mt-1 border-gray-300 dark:border-slate-600 focus:border-indigo-400 focus:ring-indigo-400/20 hover:border-indigo-300 transition-colors duration-200"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium text-gray-700 dark:text-gray-200">Font Family</Label>
              <Select
                value={titleWords.fontFamily}
                onValueChange={(value) =>
                  setTitleWords({ ...titleWords, fontFamily: value })
                }
              >
                <SelectTrigger className="mt-1 border-gray-300 dark:border-slate-600 hover:border-indigo-400 transition-colors duration-200">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PUBLISHING_FONTS.map((font) => (
                    <SelectItem key={font} value={font} style={{ fontFamily: font }}>
                      {font}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <SliderField
              label="Font Size"
              value={titleWords.fontSize}
              onValueChange={(value) =>
                setTitleWords({ ...titleWords, fontSize: value })
              }
              min={12}
              max={48}
              step={2}
              format="px"
              labelClassName="text-sm font-medium text-gray-700 dark:text-gray-200"
            />

            {/* Word List */}
            <div className="space-y-2">
              <Label className="text-sm font-medium text-gray-700 dark:text-gray-200">
                {currentPuzzleType === 'cryptogram' ? 'Custom Text' : 'Word List'}
              </Label>
              {currentPuzzleType === 'cryptogram' ? (
                <Textarea
                  value={cryptogramText}
                  onChange={(e) => setCryptogramText(e.target.value)}
                  placeholder="Enter text to encode (or use Random Quote)"
                  className="mt-1 h-32 border-gray-300 dark:border-slate-600 focus:border-indigo-400 focus:ring-indigo-400/20 resize-none hover:border-indigo-300 transition-colors duration-200"
                />
              ) : (
                <Textarea
                  value={titleWords.words.join('\n')}
                  onChange={(e) => handleWordsChange(e.target.value)}
                  placeholder="Enter words (one per line)"
                  className="mt-1 h-32 border-gray-300 dark:border-slate-600 focus:border-indigo-400 focus:ring-indigo-400/20 resize-none hover:border-indigo-300 transition-colors duration-200"
                />
              )}
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mt-1">
                {currentPuzzleType === 'cryptogram'
                  ? 'Use letters only for best results'
                  : `${titleWords.words.length} words entered`}
              </p>
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* Color Settings Section */}
        <AccordionItem value="colors" className="border-0 rounded-lg bg-white dark:bg-slate-800 shadow-sm hover:shadow-md transition-shadow duration-200 border border-gray-200 dark:border-slate-700 overflow-hidden">
          <AccordionTrigger className="px-4 py-3 hover:bg-gradient-to-r hover:from-rose-50 hover:to-pink-50 dark:hover:from-slate-700 dark:hover:to-slate-700 transition-all duration-200 [&[data-state=open]>svg]:rotate-180">
            <div className="flex items-center gap-3 text-left">
              <div className="p-2 bg-gradient-to-br from-rose-400 to-pink-500 rounded-lg">
                <Palette className="w-4 h-4 text-white" />
              </div>
              <span className="font-semibold text-gray-900 dark:text-white">Colors</span>
            </div>
          </AccordionTrigger>
          <AccordionContent className="px-4 py-4 space-y-4 bg-gradient-to-b from-white to-gray-50 dark:from-slate-800 dark:to-slate-850 border-t border-gray-100 dark:border-slate-700 animate-fade-in">
            
            <div className="space-y-3 p-3 rounded-lg bg-blue-50 dark:bg-slate-700 border border-blue-200 dark:border-slate-600">
              <Label className="text-sm font-medium text-gray-700 dark:text-gray-200">Background Color</Label>
              <div className="flex items-center gap-3 mt-1">
                <Input
                  type="color"
                  value={colorSettings.puzzlePage.backgroundColor}
                  onChange={(e) =>
                    setColorSettings({
                      ...colorSettings,
                      puzzlePage: { ...colorSettings.puzzlePage, backgroundColor: e.target.value },
                    })
                  }
                  className="w-14 h-12 p-1 cursor-pointer border-2 border-blue-300 dark:border-slate-500 rounded-lg hover:shadow-lg transition-shadow duration-200"
                />
                <Input
                  value={colorSettings.puzzlePage.backgroundColor}
                  onChange={(e) =>
                    setColorSettings({
                      ...colorSettings,
                      puzzlePage: { ...colorSettings.puzzlePage, backgroundColor: e.target.value },
                    })
                  }
                  className="flex-1 font-mono text-sm border-gray-300 dark:border-slate-600 focus:border-blue-400 focus:ring-blue-400/20"
                />
              </div>
            </div>

            <div className="space-y-3 p-3 rounded-lg bg-purple-50 dark:bg-slate-700 border border-purple-200 dark:border-slate-600">
              <Label className="text-sm font-medium text-gray-700 dark:text-gray-200">Title Color</Label>
              <div className="flex items-center gap-3 mt-1">
                <Input
                  type="color"
                  value={colorSettings.puzzlePage.titleColor}
                  onChange={(e) =>
                    setColorSettings({
                      ...colorSettings,
                      puzzlePage: { ...colorSettings.puzzlePage, titleColor: e.target.value },
                    })
                  }
                  className="w-14 h-12 p-1 cursor-pointer border-2 border-purple-300 dark:border-slate-500 rounded-lg hover:shadow-lg transition-shadow duration-200"
                />
                <Input
                  value={colorSettings.puzzlePage.titleColor}
                  onChange={(e) =>
                    setColorSettings({
                      ...colorSettings,
                      puzzlePage: { ...colorSettings.puzzlePage, titleColor: e.target.value },
                    })
                  }
                  className="flex-1 font-mono text-sm border-gray-300 dark:border-slate-600 focus:border-purple-400 focus:ring-purple-400/20"
                />
              </div>
            </div>

            <div className="space-y-3 p-3 rounded-lg bg-green-50 dark:bg-slate-700 border border-green-200 dark:border-slate-600">
              <Label className="text-sm font-medium text-gray-700 dark:text-gray-200">Grid/Box Lines</Label>
              <div className="flex items-center gap-3 mt-1">
                <Input
                  type="color"
                  value={colorSettings.puzzlePage.boxColor}
                  onChange={(e) =>
                    setColorSettings({
                      ...colorSettings,
                      puzzlePage: { ...colorSettings.puzzlePage, boxColor: e.target.value },
                    })
                  }
                  className="w-14 h-12 p-1 cursor-pointer border-2 border-green-300 dark:border-slate-500 rounded-lg hover:shadow-lg transition-shadow duration-200"
                />
                <Input
                  value={colorSettings.puzzlePage.boxColor}
                  onChange={(e) =>
                    setColorSettings({
                      ...colorSettings,
                      puzzlePage: { ...colorSettings.puzzlePage, boxColor: e.target.value },
                    })
                  }
                  className="flex-1 font-mono text-sm border-gray-300 dark:border-slate-600 focus:border-green-400 focus:ring-green-400/20"
                />
              </div>
            </div>

            <div className="space-y-3 p-3 rounded-lg bg-orange-50 dark:bg-slate-700 border border-orange-200 dark:border-slate-600">
              <Label className="text-sm font-medium text-gray-700 dark:text-gray-200">Solution Highlight</Label>
              <div className="flex items-center gap-3 mt-1">
                <Input
                  type="color"
                  value={colorSettings.answerPage.solutionFrameColor}
                  onChange={(e) =>
                    setColorSettings({
                      ...colorSettings,
                      answerPage: { ...colorSettings.answerPage, solutionFrameColor: e.target.value },
                    })
                  }
                  className="w-14 h-12 p-1 cursor-pointer border-2 border-orange-300 dark:border-slate-500 rounded-lg hover:shadow-lg transition-shadow duration-200"
                />
                <Input
                  value={colorSettings.answerPage.solutionFrameColor}
                  onChange={(e) =>
                    setColorSettings({
                      ...colorSettings,
                      answerPage: { ...colorSettings.answerPage, solutionFrameColor: e.target.value },
                    })
                  }
                  className="flex-1 font-mono text-sm border-gray-300 dark:border-slate-600 focus:border-orange-400 focus:ring-orange-400/20"
                />
              </div>
            </div>

            <Button
              variant="outline"
              onClick={() =>
                setColorSettings({
                  puzzlePage: {
                    backgroundColor: '#ffffff',
                    titleColor: '#1f2937',
                    subtitleColor: '#6b7280',
                    boxColor: '#1f2937',
                    puzzleColor: '#1f2937',
                    wordListTitleColor: '#374151',
                    wordListColor: '#4b5563',
                  },
                  answerPage: {
                    backgroundColor: '#ffffff',
                    titleColor: '#1f2937',
                    boxColor: '#1f2937',
                    lettersInSolutionColor: '#22c55e',
                    lettersNotInSolutionColor: '#d1d5db',
                    solutionStrokeThickness: 12,
                    solutionStrokePadding: 2,
                    solutionFrameColor: '#22c55e',
                    solutionFrameStyle: 'rounded',
                    solutionFrameRadius: 6,
                    solutionHighlightAlpha: 30,
                    onlyHighlightWordListWords: false,
                    answerTitlePrefix: 'Solution',
                    answerTitleFontFamily: 'Inter',
                    answerTitleFontSize: 20,
                    answerTitleAlignment: 'center',
                    showAnswerNumber: true,
                  },
                })
              }
              className="w-full hover:bg-gradient-to-r hover:from-gray-100 hover:to-gray-200 dark:hover:from-slate-700 dark:hover:to-slate-600 transition-all duration-200 border-gray-300 dark:border-slate-600"
            >
              Reset to Defaults
            </Button>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
      
      {/* Fixed Generate Button at Bottom - Modern Style */}
      <div className="border-t border-gray-200 dark:border-slate-700 p-4 bg-gradient-to-r from-slate-50 to-white dark:from-slate-800 dark:to-slate-900 shadow-lg">
        <Button 
          onClick={handleGenerate} 
          className="w-full bg-gradient-to-r from-indigo-500 to-indigo-600 hover:from-indigo-600 hover:to-indigo-700 text-white font-semibold py-6 rounded-lg shadow-lg shadow-indigo-300/30 hover:shadow-xl hover:shadow-indigo-400/40 transition-all duration-200 transform hover:scale-105 active:scale-95"
        >
          <Grid3X3 className="w-5 h-5 mr-2" />
          Generate {currentPuzzleType === 'cryptogram' ? 'Cryptogram' : currentPuzzleType === 'sudoku' ? 'Sudoku' : 'Puzzle'}
        </Button>
      </div>
    </div>
  );
}
        </TabsContent>

        {/* Title/Words Settings */}
        <TabsContent value="words" className="p-4 space-y-4 bg-white transition-colors duration-200 rounded-md">
          <div>
            <Label className="text-sm font-medium">Puzzle Title</Label>
            <Input
              value={titleWords.title}
              onChange={(e) => setTitleWords({ ...titleWords, title: e.target.value })}
              placeholder="Enter puzzle title"
              className="mt-1"
            />
          </div>

          <div>
            <Label className="text-sm font-medium">Font Family</Label>
            <Select
              value={titleWords.fontFamily}
              onValueChange={(value) =>
                setTitleWords({ ...titleWords, fontFamily: value })
              }
            >
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PUBLISHING_FONTS.map((font) => (
                  <SelectItem key={font} value={font} style={{ fontFamily: font }}>
                    {font}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <SliderField
            label="Font Size"
            value={titleWords.fontSize}
            onValueChange={(value) =>
              setTitleWords({ ...titleWords, fontSize: value })
            }
            min={12}
            max={48}
            step={2}
            format="px"
            labelClassName="text-sm text-gray-900 font-medium"
          />

          {/* Word List */}
          <div>
            <Label className="text-sm font-medium">
              {currentPuzzleType === 'cryptogram' ? 'Custom Text' : 'Word List'}
            </Label>
            {currentPuzzleType === 'cryptogram' ? (
              <Textarea
                value={cryptogramText}
                onChange={(e) => setCryptogramText(e.target.value)}
                placeholder="Enter text to encode (or use Random Quote)"
                className="mt-1 h-32"
              />
            ) : (
              <Textarea
                value={titleWords.words.join('\n')}
                onChange={(e) => handleWordsChange(e.target.value)}
                placeholder="Enter words (one per line)"
                className="mt-1 h-32"
              />
            )}
            <p className="text-xs text-gray-500 mt-1">
              {currentPuzzleType === 'cryptogram'
                ? 'Use letters only for best results'
                : `${titleWords.words.length} words entered`}
            </p>
          </div>
        </TabsContent>

        {/* Color Settings */}
        <TabsContent value="colors" className="p-4 space-y-4 bg-white transition-colors duration-200 rounded-md">
          <div>
            <Label className="text-sm font-medium">Background Color</Label>
            <div className="flex items-center gap-2 mt-1">
              <Input
                type="color"
                value={colorSettings.puzzlePage.backgroundColor}
                onChange={(e) =>
                  setColorSettings({
                    ...colorSettings,
                    puzzlePage: { ...colorSettings.puzzlePage, backgroundColor: e.target.value },
                  })
                }
                className="w-12 h-10 p-1 cursor-pointer"
              />
              <Input
                value={colorSettings.puzzlePage.backgroundColor}
                onChange={(e) =>
                  setColorSettings({
                    ...colorSettings,
                    puzzlePage: { ...colorSettings.puzzlePage, backgroundColor: e.target.value },
                  })
                }
                className="flex-1 font-mono text-sm"
              />
            </div>
          </div>

          <div>
            <Label className="text-sm font-medium">Title Color</Label>
            <div className="flex items-center gap-2 mt-1">
              <Input
                type="color"
                value={colorSettings.puzzlePage.titleColor}
                onChange={(e) =>
                  setColorSettings({
                    ...colorSettings,
                    puzzlePage: { ...colorSettings.puzzlePage, titleColor: e.target.value },
                  })
                }
                className="w-12 h-10 p-1 cursor-pointer"
              />
              <Input
                value={colorSettings.puzzlePage.titleColor}
                onChange={(e) =>
                  setColorSettings({
                    ...colorSettings,
                    puzzlePage: { ...colorSettings.puzzlePage, titleColor: e.target.value },
                  })
                }
                className="flex-1 font-mono text-sm"
              />
            </div>
          </div>

          <div>
            <Label className="text-sm font-medium">Grid/Box Lines</Label>
            <div className="flex items-center gap-2 mt-1">
              <Input
                type="color"
                value={colorSettings.puzzlePage.boxColor}
                onChange={(e) =>
                  setColorSettings({
                    ...colorSettings,
                    puzzlePage: { ...colorSettings.puzzlePage, boxColor: e.target.value },
                  })
                }
                className="w-12 h-10 p-1 cursor-pointer"
              />
              <Input
                value={colorSettings.puzzlePage.boxColor}
                onChange={(e) =>
                  setColorSettings({
                    ...colorSettings,
                    puzzlePage: { ...colorSettings.puzzlePage, boxColor: e.target.value },
                  })
                }
                className="flex-1 font-mono text-sm"
              />
            </div>
          </div>

          <div>
            <Label className="text-sm font-medium">Solution Highlight</Label>
            <div className="flex items-center gap-2 mt-1">
              <Input
                type="color"
                value={colorSettings.answerPage.solutionFrameColor}
                onChange={(e) =>
                  setColorSettings({
                    ...colorSettings,
                    answerPage: { ...colorSettings.answerPage, solutionFrameColor: e.target.value },
                  })
                }
                className="w-12 h-10 p-1 cursor-pointer"
              />
              <Input
                value={colorSettings.answerPage.solutionFrameColor}
                onChange={(e) =>
                  setColorSettings({
                    ...colorSettings,
                    answerPage: { ...colorSettings.answerPage, solutionFrameColor: e.target.value },
                  })
                }
                className="flex-1 font-mono text-sm"
              />
            </div>
          </div>

          <Button
            variant="outline"
            onClick={() =>
              setColorSettings({
                puzzlePage: {
                  backgroundColor: '#ffffff',
                  titleColor: '#1f2937',
                  subtitleColor: '#6b7280',
                  boxColor: '#1f2937',
                  puzzleColor: '#1f2937',
                  wordListTitleColor: '#374151',
                  wordListColor: '#4b5563',
                },
                answerPage: {
                  backgroundColor: '#ffffff',
                  titleColor: '#1f2937',
                  boxColor: '#1f2937',
                  lettersInSolutionColor: '#22c55e',
                  lettersNotInSolutionColor: '#d1d5db',
                  solutionStrokeThickness: 12,
                  solutionStrokePadding: 2,
                  solutionFrameColor: '#22c55e',
                  solutionFrameStyle: 'rounded',
                  solutionFrameRadius: 6,
                  solutionHighlightAlpha: 30,
                  onlyHighlightWordListWords: false,
                  answerTitlePrefix: 'Solution',
                  answerTitleFontFamily: 'Inter',
                  answerTitleFontSize: 20,
                  answerTitleAlignment: 'center',
                  showAnswerNumber: true,
                },
              })
            }
            className="w-full"
          >
            Reset to Defaults
          </Button>
        </TabsContent>
      </Tabs>
      
      {/* Fixed Generate Button at Bottom */}
      <div className="border-t border-gray-200 p-4 bg-white">
        <Button onClick={handleGenerate} className="w-full">
          <Grid3X3 className="w-4 h-4 mr-2" />
          Generate {currentPuzzleType === 'cryptogram' ? 'Cryptogram' : currentPuzzleType === 'sudoku' ? 'Sudoku' : 'Puzzle'}
        </Button>
      </div>
    </div>
  );
}
