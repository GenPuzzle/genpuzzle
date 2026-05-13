'use client';

import React, { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Book, Settings, Type, Palette, Grid3X3, RotateCw } from 'lucide-react';
import { useApp } from '@/lib/app-context';
import { TRIM_SIZES, TrimSize, Direction } from '@/lib/puzzles/types';
import { getCategories, getQuotesByCategory, getRandomQuote } from '@/lib/puzzles/cryptogram';

const GOOGLE_FONTS = [
  'Inter',
  'Merriweather',
  'Playfair Display',
  'Montserrat',
  'Lora',
  'Roboto',
  'Open Sans',
  'Poppins',
];

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
    horizontal_reverse: false,
    vertical: true,
    vertical_reverse: false,
    diagonal_down: true,
    diagonal_down_reverse: false,
    diagonal_up: true,
    diagonal_up_reverse: false,
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
    <div className="w-80 h-screen bg-white border-r border-gray-200 overflow-y-auto">
      <Tabs defaultValue="book" className="w-full">
        <TabsList className="w-full grid grid-cols-4">
          <TabsTrigger value="book" title="Book Settings">
            <Book className="w-4 h-4" />
          </TabsTrigger>
          <TabsTrigger value="puzzle" title="Puzzle Settings">
            <Settings className="w-4 h-4" />
          </TabsTrigger>
          <TabsTrigger value="words" title="Title & Words">
            <Type className="w-4 h-4" />
          </TabsTrigger>
          <TabsTrigger value="colors" title="Colors">
            <Palette className="w-4 h-4" />
          </TabsTrigger>
        </TabsList>

        {/* Book Settings */}
        <TabsContent value="book" className="p-4 space-y-4">
          <div>
            <Label className="text-sm font-medium">Trim Size</Label>
            <Select
              value={bookSettings.trimSize}
              onValueChange={(value) =>
                setBookSettings({ ...bookSettings, trimSize: value as TrimSize })
              }
            >
              <SelectTrigger className="mt-1">
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

          <div className="flex items-center justify-between">
            <Label className="text-sm font-medium">Include Bleed (0.125")</Label>
            <Switch
              checked={bookSettings.includeBleed}
              onCheckedChange={(checked) =>
                setBookSettings({ ...bookSettings, includeBleed: checked })
              }
            />
          </div>

          <div className="flex items-center justify-between">
            <Label className="text-sm font-medium">Include Solution Page</Label>
            <Switch
              checked={bookSettings.includeSolution}
              onCheckedChange={(checked) =>
                setBookSettings({ ...bookSettings, includeSolution: checked })
              }
            />
          </div>

          <div>
            <Label className="text-sm font-medium">Puzzles Per Page: {bookSettings.puzzlesPerPage}</Label>
            <Slider
              value={[bookSettings.puzzlesPerPage]}
              min={1}
              max={4}
              step={1}
              onValueChange={([value]) =>
                setBookSettings({ ...bookSettings, puzzlesPerPage: value })
              }
              className="mt-2"
            />
          </div>
        </TabsContent>

        {/* Puzzle Settings */}
        <TabsContent value="puzzle" className="p-4 space-y-4">
          {/* Grid Size (for applicable puzzles) */}
          {['word-search', 'crossword'].includes(currentPuzzleType) && (
            <div>
              <Label className="text-sm font-medium">Grid Size: {puzzleSettings.gridSize}x{puzzleSettings.gridSize}</Label>
              <Slider
                value={[puzzleSettings.gridSize]}
                min={10}
                max={25}
                step={1}
                onValueChange={([value]) =>
                  setPuzzleSettings({ ...puzzleSettings, gridSize: value })
                }
                className="mt-2"
              />
            </div>
          )}

          {/* Word Placement Directions */}
          {currentPuzzleType === 'word-search' && (
            <div>
              <Label className="text-sm font-medium mb-2 block">Word Placement Directions</Label>
              <div className="grid grid-cols-4 gap-2">
                {DIRECTION_OPTIONS.map((dir) => (
                  <button
                    key={dir.value}
                    onClick={() => handleDirectionToggle(dir.value)}
                    className={`w-10 h-10 rounded border-2 text-lg flex items-center justify-center transition-colors ${
                      directionToggles[dir.value]
                        ? 'bg-indigo-500 text-white border-indigo-500'
                        : 'bg-white text-gray-600 border-gray-300 hover:border-indigo-300'
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
            <div>
              <Label className="text-sm font-medium mb-2 block">Difficulty</Label>
              <div className="grid grid-cols-3 gap-2">
                {(['easy', 'medium', 'hard'] as const).map((diff) => (
                  <Button
                    key={diff}
                    variant={sudokuDifficulty === diff ? 'default' : 'outline'}
                    onClick={() => setSudokuDifficulty(diff)}
                    className="capitalize"
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
            <div>
              <Label className="text-sm font-medium mb-2 block">Maze Size</Label>
              <Select value={mazeSize} onValueChange={(v: any) => setMazeSize(v)}>
                <SelectTrigger>
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
              <div>
                <Label className="text-sm font-medium">Select a Quote</Label>
                <Select value={quoteCategory} onValueChange={setQuoteCategory}>
                  <SelectTrigger className="mt-1">
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
              <Button variant="outline" size="sm" onClick={handleRandomQuote} className="w-full">
                <RotateCw className="w-4 h-4 mr-2" />
                Random Quote
              </Button>
            </div>
          )}

          <Button onClick={handleGenerate} className="w-full mt-4">
            <Grid3X3 className="w-4 h-4 mr-2" />
            Generate Puzzle
          </Button>
        </TabsContent>

        {/* Title/Words Settings */}
        <TabsContent value="words" className="p-4 space-y-4">
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
                {GOOGLE_FONTS.map((font) => (
                  <SelectItem key={font} value={font}>
                    {font}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-sm font-medium">Font Size: {titleWords.fontSize}px</Label>
            <Slider
              value={[titleWords.fontSize]}
              min={12}
              max={48}
              step={2}
              onValueChange={([value]) =>
                setTitleWords({ ...titleWords, fontSize: value })
              }
              className="mt-2"
            />
          </div>

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
        <TabsContent value="colors" className="p-4 space-y-4">
          <div>
            <Label className="text-sm font-medium">Background Color</Label>
            <div className="flex items-center gap-2 mt-1">
              <Input
                type="color"
                value={colorSettings.background}
                onChange={(e) =>
                  setColorSettings({ ...colorSettings, background: e.target.value })
                }
                className="w-12 h-10 p-1 cursor-pointer"
              />
              <Input
                value={colorSettings.background}
                onChange={(e) =>
                  setColorSettings({ ...colorSettings, background: e.target.value })
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
                value={colorSettings.title}
                onChange={(e) =>
                  setColorSettings({ ...colorSettings, title: e.target.value })
                }
                className="w-12 h-10 p-1 cursor-pointer"
              />
              <Input
                value={colorSettings.title}
                onChange={(e) =>
                  setColorSettings({ ...colorSettings, title: e.target.value })
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
                value={colorSettings.gridLines}
                onChange={(e) =>
                  setColorSettings({ ...colorSettings, gridLines: e.target.value })
                }
                className="w-12 h-10 p-1 cursor-pointer"
              />
              <Input
                value={colorSettings.gridLines}
                onChange={(e) =>
                  setColorSettings({ ...colorSettings, gridLines: e.target.value })
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
                value={colorSettings.solution}
                onChange={(e) =>
                  setColorSettings({ ...colorSettings, solution: e.target.value })
                }
                className="w-12 h-10 p-1 cursor-pointer"
              />
              <Input
                value={colorSettings.solution}
                onChange={(e) =>
                  setColorSettings({ ...colorSettings, solution: e.target.value })
                }
                className="flex-1 font-mono text-sm"
              />
            </div>
          </div>

          <Button
            variant="outline"
            onClick={() =>
              setColorSettings({
                background: '#ffffff',
                title: '#1f2937',
                gridLines: '#1f2937',
                answer: '#059669',
                solution: '#22c55e',
              })
            }
            className="w-full"
          >
            Reset to Defaults
          </Button>
        </TabsContent>
      </Tabs>
    </div>
  );
}
