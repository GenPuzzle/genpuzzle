'use client';

import React, { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { AlertCircle, CheckCircle } from 'lucide-react';
import { useApp } from '@/lib/app-context';

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

const LANGUAGES = ['English', 'Spanish', 'French', 'German', 'Italian', 'Portuguese'];
const AGE_LEVELS = ['Children (6-8)', 'Children (9-12)', 'Teen', 'Adult', 'Senior'];

// Helper for number inputs - text input, no React control during typing
const NumberInput = ({
  value,
  onChange,
  placeholder,
  min,
  max,
}: {
  value: number;
  onChange: (val: number) => void;
  placeholder?: string;
  min?: number;
  max?: number;
}) => {
  const inputRef = React.useRef<HTMLInputElement>(null);

  // Update display only when not focused
  React.useEffect(() => {
    if (inputRef.current && document.activeElement !== inputRef.current) {
      inputRef.current.value = String(value);
    }
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Let user type freely - update on blur only
  };

  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    const val = e.target.value.trim();
    if (val === '') {
      e.target.value = String(min ?? 0);
      onChange(min ?? 0);
      return;
    }
    let num = parseInt(val, 10);
    if (isNaN(num)) {
      num = min ?? 0;
    }
    if (min !== undefined && num < min) num = min;
    if (max !== undefined && num > max) num = max;
    e.target.value = String(num);
    onChange(num);
  };

  return (
    <input
      ref={inputRef}
      type="text"
      inputMode="numeric"
      defaultValue={value}
      onChange={handleChange}
      onBlur={handleBlur}
      placeholder={placeholder}
      className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
    />
  );
};

// Helper for decimal number inputs (for trim size) - text input, no React control during typing
const DecimalInput = ({
  value,
  onChange,
  placeholder,
  min,
}: {
  value: number;
  onChange: (val: number) => void;
  placeholder?: string;
  min?: number;
}) => {
  const [localValue, setLocalValue] = React.useState(String(value ?? ''));
  const inputRef = React.useRef<HTMLInputElement>(null);
  const isFocused = React.useRef(false);

  // Update local value when external value changes (only when not focused)
  React.useEffect(() => {
    if (!isFocused.current) {
      setLocalValue(value?.toString() || '');
    }
  }, [value]);

  const handleFocus = () => {
    isFocused.current = true;
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Let user type freely - only update local state
    setLocalValue(e.target.value);
  };

  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    isFocused.current = false;
    const val = e.target.value.trim();
    if (val === '') {
      setLocalValue(String(min ?? 0));
      onChange(min ?? 0);
      return;
    }
    let num = parseFloat(val);
    if (isNaN(num)) {
      num = min ?? 0;
    }
    if (min !== undefined && num < min) num = min;
    setLocalValue(String(num));
    onChange(num);
  };

  return (
    <input
      ref={inputRef}
      type="text"
      inputMode="decimal"
      value={localValue}
      onFocus={handleFocus}
      onChange={handleChange}
      onBlur={handleBlur}
      placeholder={placeholder}
      className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
    />
  );
};

function ColorInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1">
        <Label className="text-xs text-gray-500">{label}</Label>
        <div className="flex items-center gap-2">
          <Input
            type="color"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="w-10 h-8 p-1 cursor-pointer"
          />
          <Input
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="flex-1 font-mono text-sm"
            placeholder="#000000"
          />
        </div>
      </div>
    </div>
  );
}

// Icon components
function Book({ className }: { className?: string }) {
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>;
}
function Grid3X3({ className }: { className?: string }) {
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>;
}
function Type({ className }: { className?: string }) {
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="4,7 4,4 20,4 20,7"/><line x1="9" y1="20" x2="15" y2="20"/><line x1="12" y1="4" x2="12" y2="20"/></svg>;
}
function List({ className }: { className?: string }) {
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>;
}
function Palette({ className }: { className?: string }) {
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="13.5" cy="6.5" r=".5"/><circle cx="17.5" cy="10.5" r=".5"/><circle cx="8.5" cy="7.5" r=".5"/><circle cx="6.5" cy="12.5" r=".5"/><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.555C21.965 6.012 17.461 2 12 2z"/></svg>;
}
function Sparkles({ className }: { className?: string }) {
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/></svg>;
}

export function WordSearchSidebar() {
  const {
    wordSearchSettings,
    updateWordSearchSettings,
    titleWords,
    setTitleWords,
    generatePuzzle,
    validationError,
  } = useApp();

  const { bookCanvas, core, typography, wordList, colors } = wordSearchSettings;

  const updateBookCanvas = (updates: Partial<typeof bookCanvas>) => {
    updateWordSearchSettings({ bookCanvas: { ...bookCanvas, ...updates } });
  };

  const updateCore = (updates: Partial<typeof core>) => {
    updateWordSearchSettings({ core: { ...core, ...updates } });
  };

  const updateTypography = (updates: Partial<typeof typography>) => {
    updateWordSearchSettings({ typography: { ...typography, ...updates } });
  };

  const updateWordListSettings = (updates: Partial<typeof wordList>) => {
    updateWordSearchSettings({ wordList: { ...wordList, ...updates } });
  };

  const updateColors = (updates: Partial<typeof colors>) => {
    updateWordSearchSettings({ colors: { ...colors, ...updates } });
  };

  const updatePuzzlePageColors = (updates: Partial<typeof colors.puzzlePage>) => {
    updateColors({
      puzzlePage: { ...colors.puzzlePage, ...updates },
    });
  };

  const updateAnswerPageColors = (updates: Partial<typeof colors.answerPage>) => {
    updateColors({
      answerPage: { ...colors.answerPage, ...updates },
    });
  };

  const requiredWords = core.numberOfPuzzles * wordList.wordsPerPuzzle;
  const wordCount = titleWords.words.length;

  return (
    <div className="w-96 h-screen bg-white border-r border-gray-200 overflow-y-auto">
      <Tabs defaultValue="puzzle" className="w-full">
        <TabsList className="w-full grid grid-cols-5">
          <TabsTrigger value="puzzle" title="Puzzle">
            <Grid3X3 className="w-4 h-4" />
          </TabsTrigger>
          <TabsTrigger value="design" title="Design">
            <Type className="w-4 h-4" />
          </TabsTrigger>
          <TabsTrigger value="words" title="Words">
            <List className="w-4 h-4" />
          </TabsTrigger>
          <TabsTrigger value="colors" title="Colors">
            <Palette className="w-4 h-4" />
          </TabsTrigger>
          <TabsTrigger value="book" title="Book">
            <Book className="w-4 h-4" />
          </TabsTrigger>
        </TabsList>

        {/* ==================== PUZZLE SETTINGS ==================== */}
        <TabsContent value="puzzle" className="p-4 space-y-6">
          <div className="space-y-4">
            <h3 className="font-semibold text-gray-900">Puzzle Settings</h3>

            {/* Quantity */}
            <div className="space-y-3">
              <Label className="text-sm font-medium">Quantity</Label>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs text-gray-500">Number of Puzzles</Label>
                  <NumberInput
                    value={core.numberOfPuzzles}
                    onChange={(val) => updateCore({ numberOfPuzzles: val })}
                    min={1}
                    max={100}
                  />
                </div>
                <div>
                  <Label className="text-xs text-gray-500">Starting Number</Label>
                  <NumberInput
                    value={core.puzzlesStartingNumber}
                    onChange={(val) => updateCore({ puzzlesStartingNumber: val })}
                    min={1}
                  />
                </div>
              </div>
            </div>

            {/* Grid Structure */}
            <div className="space-y-3">
              <Label className="text-sm font-medium">Grid Size</Label>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs text-gray-500">Letters Across</Label>
                  <NumberInput
                    value={core.lettersAcross}
                    onChange={(val) => updateCore({ lettersAcross: val })}
                    min={10}
                    max={30}
                  />
                </div>
                <div>
                  <Label className="text-xs text-gray-500">Letters Down</Label>
                  <NumberInput
                    value={core.lettersDown}
                    onChange={(val) => updateCore({ lettersDown: val })}
                    min={10}
                    max={30}
                  />
                </div>
              </div>
            </div>

            {/* Allowed Directions */}
            <div className="space-y-3">
              <Label className="text-sm font-medium">Word Directions</Label>
              <div className="grid grid-cols-4 gap-2">
                <DirectionCheckbox label="Right" checked={core.allowRight} onCheckedChange={(v) => updateCore({ allowRight: v })} />
                <DirectionCheckbox label="Left" checked={core.allowLeft} onCheckedChange={(v) => updateCore({ allowLeft: v })} />
                <DirectionCheckbox label="Down" checked={core.allowDown} onCheckedChange={(v) => updateCore({ allowDown: v })} />
                <DirectionCheckbox label="Up" checked={core.allowUp} onCheckedChange={(v) => updateCore({ allowUp: v })} />
                <DirectionCheckbox label="Diag Down" checked={core.allowDiagonalDown} onCheckedChange={(v) => updateCore({ allowDiagonalDown: v })} />
                <DirectionCheckbox label="Diag Up" checked={core.allowDiagonalUp} onCheckedChange={(v) => updateCore({ allowDiagonalUp: v })} />
                <DirectionCheckbox label="Diag Down Rev" checked={core.allowDiagonalDownReverse} onCheckedChange={(v) => updateCore({ allowDiagonalDownReverse: v })} />
                <DirectionCheckbox label="Diag Up Rev" checked={core.allowDiagonalUpReverse} onCheckedChange={(v) => updateCore({ allowDiagonalUpReverse: v })} />
              </div>
            </div>

            {/* Grid Options */}
            <div className="space-y-3">
              <Label className="text-sm font-medium">Grid Options</Label>
              <div className="space-y-2">
                <CheckboxItem label="No Box Around Puzzle" checked={core.noBoxAroundPuzzle} onCheckedChange={(v) => updateCore({ noBoxAroundPuzzle: v })} />
                <CheckboxItem label="Add Grid Lines" checked={core.addGridLines} onCheckedChange={(v) => updateCore({ addGridLines: v })} />
                <CheckboxItem label="Allow Numbers in Grid" checked={core.allowNumbersInGrid} onCheckedChange={(v) => updateCore({ allowNumbersInGrid: v })} />
                <CheckboxItem label="Two Page Puzzles" checked={core.twoPagePuzzles} onCheckedChange={(v) => updateCore({ twoPagePuzzles: v })} />
              </div>
            </div>

            {/* Custom Letters */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Custom Letters</Label>
              <Input value={core.customLetters} onChange={(e) => updateCore({ customLetters: e.target.value })} placeholder="Additional letters..." />
              <p className="text-xs text-gray-500">Force these letters to appear in the grid</p>
            </div>
          </div>
        </TabsContent>

        {/* ==================== DESIGN SETTINGS ==================== */}
        <TabsContent value="design" className="p-4 space-y-6">
          <div className="space-y-4">
            <h3 className="font-semibold text-gray-900">Design Settings</h3>

            {/* Title Options */}
            <div className="space-y-3">
              <Label className="text-sm font-medium">Title</Label>
              <Select value={typography.selectTitleOption} onValueChange={(value) => updateTypography({ selectTitleOption: value as any })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="puzzle-number">Use Puzzle Number</SelectItem>
                  <SelectItem value="custom">Custom Title</SelectItem>
                  <SelectItem value="none">No Title</SelectItem>
                </SelectContent>
              </Select>

              {typography.selectTitleOption === 'custom' && (
                <Input value={typography.titleText} onChange={(e) => updateTypography({ titleText: e.target.value })} placeholder="Enter custom title..." />
              )}

              <div className="flex items-center space-x-2">
                <Checkbox id="includeSubtitle" checked={typography.includeSubtitle} onCheckedChange={(checked) => updateTypography({ includeSubtitle: checked })} />
                <Label htmlFor="includeSubtitle" className="text-sm font-normal">Include Subtitle</Label>
              </div>

              {typography.includeSubtitle && (
                <Input value={typography.subtitleText} onChange={(e) => updateTypography({ subtitleText: e.target.value })} placeholder="Enter subtitle..." />
              )}
            </div>

            {/* Fonts */}
            <div className="space-y-3">
              <Label className="text-sm font-medium">Fonts</Label>
              <div>
                <Label className="text-xs text-gray-500">Title Font</Label>
                <Select value={typography.puzzleTitleFontFamily} onValueChange={(value) => updateTypography({ puzzleTitleFontFamily: value })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {GOOGLE_FONTS.map((font) => <SelectItem key={font} value={font}>{font}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs text-gray-500">Grid Font</Label>
                <Select value={typography.puzzleGridFontFamily} onValueChange={(value) => updateTypography({ puzzleGridFontFamily: value })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {GOOGLE_FONTS.map((font) => <SelectItem key={font} value={font}>{font}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Font Sizes */}
            <div className="space-y-3">
              <Label className="text-sm font-medium">Font Sizes</Label>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs text-gray-500">Title Size (px)</Label>
                  <NumberInput value={typography.puzzleTitleFontSize} onChange={(val) => updateTypography({ puzzleTitleFontSize: val })} min={10} max={72} />
                </div>
                <div>
                  <Label className="text-xs text-gray-500">Grid Size (px)</Label>
                  <NumberInput value={typography.puzzleGridFontSize} onChange={(val) => updateTypography({ puzzleGridFontSize: val })} min={8} max={24} />
                </div>
                <div>
                  <Label className="text-xs text-gray-500">Answer Title Size (px)</Label>
                  <NumberInput value={typography.answerTitleFontSize} onChange={(val) => updateTypography({ answerTitleFontSize: val })} min={10} max={72} />
                </div>
                <div>
                  <Label className="text-xs text-gray-500">Answer Grid Size (px)</Label>
                  <NumberInput value={typography.answerGridFontSize} onChange={(val) => updateTypography({ answerGridFontSize: val })} min={8} max={24} />
                </div>
              </div>
            </div>

            {/* Grid Text */}
            <div className="space-y-3">
              <Label className="text-sm font-medium">Grid Text Style</Label>
              <Select value={typography.puzzleGridCase} onValueChange={(value) => updateTypography({ puzzleGridCase: value as any })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="upper">UPPERCASE</SelectItem>
                  <SelectItem value="lower">lowercase</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Spacing */}
            <div className="space-y-3">
              <Label className="text-sm font-medium">Spacing</Label>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs text-gray-500">Title Start At (px)</Label>
                  <NumberInput value={typography.titleStartAt} onChange={(val) => updateTypography({ titleStartAt: val })} min={0} max={200} />
                </div>
                <div>
                  <Label className="text-xs text-gray-500">Title to Puzzle (px)</Label>
                  <NumberInput value={typography.spaceBetweenTitleAndPuzzle} onChange={(val) => updateTypography({ spaceBetweenTitleAndPuzzle: val })} min={0} max={100} />
                </div>
                <div>
                  <Label className="text-xs text-gray-500">Puzzle to Word List (px)</Label>
                  <NumberInput value={typography.spaceBetweenPuzzleAndWordList} onChange={(val) => updateTypography({ spaceBetweenPuzzleAndWordList: val })} min={0} max={100} />
                </div>
                <div>
                  <Label className="text-xs text-gray-500">Title to Answer (px)</Label>
                  <NumberInput value={typography.spaceBetweenTitleAndAnswer} onChange={(val) => updateTypography({ spaceBetweenTitleAndAnswer: val })} min={0} max={100} />
                </div>
              </div>
            </div>

            {/* Answer Page Fonts */}
            <div className="space-y-3">
              <Label className="text-sm font-medium">Answer Page Fonts</Label>
              <div className="flex items-center space-x-2">
                <Checkbox id="setAnswerFont" checked={typography.setFontForAnswerPages} onCheckedChange={(checked) => updateTypography({ setFontForAnswerPages: checked })} />
                <Label htmlFor="setAnswerFont" className="text-sm font-normal">Custom Font</Label>
              </div>
              {typography.setFontForAnswerPages && (
                <Select value={typography.answerGridFontFamily} onValueChange={(value) => updateTypography({ answerGridFontFamily: value })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {GOOGLE_FONTS.map((font) => <SelectItem key={font} value={font}>{font}</SelectItem>)}
                  </SelectContent>
                </Select>
              )}
            </div>
          </div>
        </TabsContent>

        {/* ==================== WORD LIST SETTINGS ==================== */}
        <TabsContent value="words" className="p-4 space-y-6">
          <div className="space-y-4">
            <h3 className="font-semibold text-gray-900">Word List Settings</h3>

            {/* Words Per Puzzle */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Words Per Puzzle</Label>
              <NumberInput value={wordList.wordsPerPuzzle} onChange={(val) => updateWordListSettings({ wordsPerPuzzle: val })} min={3} max={50} />
              <p className="text-xs text-gray-500">
                Total needed: {requiredWords} ({core.numberOfPuzzles} x {wordList.wordsPerPuzzle})
              </p>
            </div>

            {/* Visibility */}
            <div className="flex items-center space-x-2">
              <Checkbox id="hideWordList" checked={wordList.hideWordList} onCheckedChange={(checked) => updateWordListSettings({ hideWordList: checked })} />
              <Label htmlFor="hideWordList" className="text-sm font-normal">Hide Word List</Label>
            </div>

            {!wordList.hideWordList && (
              <>
                {/* Word Source */}
                <div className="space-y-3">
                  <Label className="text-sm font-medium">Word Source</Label>
                  <Select value={wordList.selectWordListOption} onValueChange={(value) => updateWordListSettings({ selectWordListOption: value as any })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="manual">Enter Words Manually</SelectItem>
                      <SelectItem value="ai">Use AI to Generate</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* AI Generation */}
                {wordList.selectWordListOption === 'ai' && (
                  <div className="space-y-3 p-3 bg-purple-50 rounded-lg border border-purple-200">
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-purple-600" />
                      <Label className="text-sm font-medium text-purple-700">AI Word Generation</Label>
                    </div>
                    <div>
                      <Label className="text-xs text-gray-500">Theme</Label>
                      <Textarea value={wordList.aiTheme} onChange={(e) => updateWordListSettings({ aiTheme: e.target.value })} placeholder="Animals, Space, Food..." className="h-20" />
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <Label className="text-xs text-gray-500">Language</Label>
                        <Select value={wordList.aiLanguage} onValueChange={(value) => updateWordListSettings({ aiLanguage: value })}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {LANGUAGES.map((lang) => <SelectItem key={lang} value={lang}>{lang}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className="text-xs text-gray-500">Age Level</Label>
                        <Select value={wordList.aiAgeLevel} onValueChange={(value) => updateWordListSettings({ aiAgeLevel: value })}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {AGE_LEVELS.map((age) => <SelectItem key={age} value={age}>{age}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className="text-xs text-gray-500">Max Length</Label>
                        <NumberInput value={wordList.aiMaxWordLength} onChange={(val) => updateWordListSettings({ aiMaxWordLength: val })} min={3} max={15} />
                      </div>
                    </div>
                  </div>
                )}

                {/* Manual Word Input */}
                {wordList.selectWordListOption === 'manual' && (
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Your Words</Label>
                    <Textarea
                      value={titleWords.words.join('\n')}
                      onChange={(e) => {
                        const words = e.target.value.split('\n').map(w => w.trim()).filter(w => w);
                        setTitleWords({ ...titleWords, words });
                      }}
                      placeholder="Enter words (one per line)..."
                      className="h-32"
                    />
                    <div className="flex items-center justify-between">
                      <p className="text-xs text-gray-500">
                        {wordCount} words {wordCount >= requiredWords ? (
                          <span className="text-green-600 flex items-center gap-1"><CheckCircle className="w-3 h-3" /> Ready</span>
                        ) : (
                          <span className="text-red-500 flex items-center gap-1"><AlertCircle className="w-3 h-3" /> Need {requiredWords - wordCount} more</span>
                        )}
                      </p>
                    </div>
                  </div>
                )}

                {/* List Formatting */}
                <div className="space-y-3">
                  <Label className="text-sm font-medium">Word List Formatting</Label>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <Label className="text-xs text-gray-500">Font</Label>
                      <Select value={wordList.wordListFontFamily} onValueChange={(value) => updateWordListSettings({ wordListFontFamily: value })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {GOOGLE_FONTS.map((font) => <SelectItem key={font} value={font}>{font}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-xs text-gray-500">Font Size</Label>
                      <NumberInput value={wordList.wordListFontSize} onChange={(val) => updateWordListSettings({ wordListFontSize: val })} min={8} max={24} />
                    </div>
                    <div>
                      <Label className="text-xs text-gray-500">Case</Label>
                      <Select value={wordList.wordListCase} onValueChange={(value) => updateWordListSettings({ wordListCase: value as any })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="upper">UPPERCASE</SelectItem>
                          <SelectItem value="lower">lowercase</SelectItem>
                          <SelectItem value="title">Title Case</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>

                {/* Layout */}
                <div className="space-y-3">
                  <Label className="text-sm font-medium">Layout</Label>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs text-gray-500">Direction</Label>
                      <Select value={wordList.wordListDirection} onValueChange={(value) => updateWordListSettings({ wordListDirection: value as any })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="vertical">Vertical</SelectItem>
                          <SelectItem value="horizontal">Horizontal</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-xs text-gray-500">Columns</Label>
                      <Select value={wordList.wordListColumns.toString()} onValueChange={(value) => updateWordListSettings({ wordListColumns: parseInt(value) })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {[1, 2, 3, 4].map((n) => <SelectItem key={n} value={n.toString()}>{n} Column{n > 1 ? 's' : ''}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>

                {/* Modifiers */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Options</Label>
                  <div className="space-y-2">
                    <CheckboxItem label="Don't Alphabetize" checked={wordList.dontAlphabetize} onCheckedChange={(v) => updateWordListSettings({ dontAlphabetize: v })} />
                    <CheckboxItem label="Add Checkboxes" checked={wordList.addCheckboxes} onCheckedChange={(v) => updateWordListSettings({ addCheckboxes: v })} />
                    <CheckboxItem label="Add Space for Graphics" checked={wordList.addSpaceForGraphics} onCheckedChange={(v) => updateWordListSettings({ addSpaceForGraphics: v })} />
                    <CheckboxItem label="Include Title Above List" checked={wordList.includeTitleAboveList} onCheckedChange={(v) => updateWordListSettings({ includeTitleAboveList: v })} />
                  </div>
                </div>
              </>
            )}

            {/* Generate Button */}
            <div className="pt-4 border-t">
              {validationError && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
                  <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-red-700">{validationError.message}</p>
                </div>
              )}
              <Button onClick={() => generatePuzzle()} className="w-full" size="lg">
                Generate {core.numberOfPuzzles} Puzzle{core.numberOfPuzzles > 1 ? 's' : ''}
              </Button>
            </div>
          </div>
        </TabsContent>

        {/* ==================== COLOR SETTINGS ==================== */}
        <TabsContent value="colors" className="p-4 space-y-6">
          <div className="space-y-4">
            <h3 className="font-semibold text-gray-900">Color Settings</h3>

            {/* Puzzle Page Colors */}
            <div className="space-y-3">
              <Label className="text-sm font-medium">Puzzle Page</Label>
              <div className="space-y-3 p-3 bg-gray-50 rounded-lg">
                <ColorInput label="Background" value={colors.puzzlePage.backgroundColor} onChange={(v) => updatePuzzlePageColors({ backgroundColor: v })} />
                <ColorInput label="Title" value={colors.puzzlePage.titleColor} onChange={(v) => updatePuzzlePageColors({ titleColor: v })} />
                <ColorInput label="Subtitle" value={colors.puzzlePage.subtitleColor} onChange={(v) => updatePuzzlePageColors({ subtitleColor: v })} />
                <ColorInput label="Box" value={colors.puzzlePage.boxColor} onChange={(v) => updatePuzzlePageColors({ boxColor: v })} />
                <ColorInput label="Puzzle Letters" value={colors.puzzlePage.puzzleColor} onChange={(v) => updatePuzzlePageColors({ puzzleColor: v })} />
                <ColorInput label="Word List Title" value={colors.puzzlePage.wordListTitleColor} onChange={(v) => updatePuzzlePageColors({ wordListTitleColor: v })} />
                <ColorInput label="Word List" value={colors.puzzlePage.wordListColor} onChange={(v) => updatePuzzlePageColors({ wordListColor: v })} />
              </div>
            </div>

            {/* Answer Page Colors */}
            <div className="space-y-3">
              <Label className="text-sm font-medium">Answer Page</Label>
              <div className="space-y-3 p-3 bg-gray-50 rounded-lg">
                <ColorInput label="Background" value={colors.answerPage.backgroundColor} onChange={(v) => updateAnswerPageColors({ backgroundColor: v })} />
                <ColorInput label="Title" value={colors.answerPage.titleColor} onChange={(v) => updateAnswerPageColors({ titleColor: v })} />
                <ColorInput label="Box" value={colors.answerPage.boxColor} onChange={(v) => updateAnswerPageColors({ boxColor: v })} />
              </div>
            </div>

            {/* Solution Highlight Settings */}
            <div className="space-y-3">
              <Label className="text-sm font-medium">Solution Highlight</Label>
              <div className="space-y-3 p-3 bg-gray-50 rounded-lg">
                <ColorInput label="Stroke Color" value={colors.answerPage.lettersInSolutionColor} onChange={(v) => updateAnswerPageColors({ lettersInSolutionColor: v })} />
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs text-gray-500">Stroke Thickness (px)</Label>
                    <NumberInput value={colors.answerPage.solutionStrokeThickness} onChange={(val) => updateAnswerPageColors({ solutionStrokeThickness: val })} min={1} max={5} />
                  </div>
                  <div>
                    <Label className="text-xs text-gray-500">Stroke Padding (px)</Label>
                    <NumberInput value={colors.answerPage.solutionStrokePadding} onChange={(val) => updateAnswerPageColors({ solutionStrokePadding: val })} min={0} max={5} />
                  </div>
                </div>
              </div>
            </div>

            {/* Answer Page Title Settings */}
            <div className="space-y-3">
              <Label className="text-sm font-medium">Answer Page Title</Label>
              <div className="space-y-3 p-3 bg-gray-50 rounded-lg">
                <div>
                  <Label className="text-xs text-gray-500">Title Prefix</Label>
                  <Input value={colors.answerPage.answerTitlePrefix} onChange={(e) => updateAnswerPageColors({ answerTitlePrefix: e.target.value })} placeholder="Solution" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs text-gray-500">Font</Label>
                    <Select value={colors.answerPage.answerTitleFontFamily} onValueChange={(value) => updateAnswerPageColors({ answerTitleFontFamily: value })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {GOOGLE_FONTS.map((font) => <SelectItem key={font} value={font}>{font}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs text-gray-500">Size (px)</Label>
                    <NumberInput value={colors.answerPage.answerTitleFontSize} onChange={(val) => updateAnswerPageColors({ answerTitleFontSize: val })} min={10} max={48} />
                  </div>
                </div>
                <div>
                  <Label className="text-xs text-gray-500">Alignment</Label>
                  <Select value={colors.answerPage.answerTitleAlignment} onValueChange={(value) => updateAnswerPageColors({ answerTitleAlignment: value as any })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="left">Left</SelectItem>
                      <SelectItem value="center">Center</SelectItem>
                      <SelectItem value="right">Right</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <CheckboxItem label="Show Puzzle Number" checked={colors.answerPage.showAnswerNumber} onCheckedChange={(v) => updateAnswerPageColors({ showAnswerNumber: v })} />
              </div>
            </div>

            <Button variant="outline" onClick={() => updateColors({
              puzzlePage: { backgroundColor: '#ffffff', titleColor: '#1f2937', subtitleColor: '#6b7280', boxColor: '#1f2937', puzzleColor: '#1f2937', wordListTitleColor: '#374151', wordListColor: '#4b5563' },
              answerPage: { backgroundColor: '#ffffff', titleColor: '#1f2937', boxColor: '#1f2937', lettersInSolutionColor: '#22c55e', lettersNotInSolutionColor: '#d1d5db', solutionStrokeThickness: 2, solutionStrokePadding: 2, answerTitlePrefix: 'Solution', answerTitleFontFamily: 'Inter', answerTitleFontSize: 20, answerTitleAlignment: 'center', showAnswerNumber: true },
            })} className="w-full">
              Reset Colors
            </Button>
          </div>
        </TabsContent>

        {/* ==================== BOOK SETTINGS ==================== */}
        <TabsContent value="book" className="p-4 space-y-6">
          <div className="space-y-4">
            <h3 className="font-semibold text-gray-900">Book Settings</h3>

            {/* Custom Trim Size */}
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <Checkbox id="useCustomTrim" checked={bookCanvas.useCustomTrim} onCheckedChange={(checked) => updateBookCanvas({ useCustomTrim: checked })} />
                <Label htmlFor="useCustomTrim" className="text-sm font-normal">Custom Trim Size</Label>
              </div>

              {bookCanvas.useCustomTrim && (
                <div className="pl-6 grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs text-gray-500">Width (inches)</Label>
                    <DecimalInput value={bookCanvas.customWidth || 0} onChange={(val) => updateBookCanvas({ customWidth: val })} placeholder="8.5" min={0} />
                  </div>
                  <div>
                    <Label className="text-xs text-gray-500">Length (inches)</Label>
                    <DecimalInput value={bookCanvas.customHeight || 0} onChange={(val) => updateBookCanvas({ customHeight: val })} placeholder="11" min={0} />
                  </div>
                </div>
              )}
            </div>

            {/* Puzzle Type */}
            <div className="space-y-1">
              <Label className="text-sm font-medium">Puzzle Type</Label>
              <Select value={bookCanvas.puzzleType} onValueChange={(value) => updateBookCanvas({ puzzleType: value as any })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="word-search">Word Search</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Answers Per Page */}
            <div className="space-y-1">
              <Label className="text-sm font-medium">Answers Per Page</Label>
              <Select value={bookCanvas.answersPerPage.toString()} onValueChange={(value) => updateBookCanvas({ answersPerPage: parseInt(value) })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {[1, 2, 4].map((n) => <SelectItem key={n} value={n.toString()}>{n} Solution{n > 1 ? 's' : ''}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            {/* Page Structure */}
            <div className="flex items-center space-x-2">
              <Checkbox id="includePageBetween" checked={bookCanvas.includePageBetweenPuzzleAndSolutions} onCheckedChange={(checked) => updateBookCanvas({ includePageBetweenPuzzleAndSolutions: checked })} />
              <Label htmlFor="includePageBetween" className="text-sm font-normal">Blank page between puzzle and solutions</Label>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

// Helper components
function CheckboxItem({
  label,
  checked,
  onCheckedChange,
}: {
  label: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-center space-x-2">
      <Checkbox id={label} checked={checked} onCheckedChange={onCheckedChange} />
      <Label htmlFor={label} className="text-sm font-normal cursor-pointer">{label}</Label>
    </div>
  );
}

function DirectionCheckbox({
  label,
  checked,
  onCheckedChange,
}: {
  label: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <button
      onClick={() => onCheckedChange(!checked)}
      className={`px-2 py-1 text-xs rounded border transition-colors ${checked ? 'bg-indigo-500 text-white border-indigo-500' : 'bg-white text-gray-600 border-gray-300 hover:border-indigo-300'}`}
    >
      {label}
    </button>
  );
}
