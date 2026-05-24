'use client';

import React, { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { SliderField } from '@/components/ui/slider-field';
import { AlertCircle, CheckCircle } from 'lucide-react';
import { useApp } from '@/lib/app-context';
import { PUBLISHING_FONTS } from '@/lib/publishing-fonts';

const LANGUAGES = ['English', 'Spanish', 'French', 'German', 'Italian', 'Portuguese'];
const AGE_LEVELS = ['Children (6-8)', 'Children (9-12)', 'Teen', 'Adult', 'Senior'];

// Numeric inputs are provided as sliders for smoother UI control

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

/** Integer input — defers min/max clamping until blur so values like "10" can be typed. */
const IntegerInput = ({
  value,
  onChange,
  min,
  max,
  className,
}: {
  value: number;
  onChange: (val: number) => void;
  min?: number;
  max?: number;
  className?: string;
}) => {
  const [localValue, setLocalValue] = React.useState(String(value ?? ''));
  const isFocused = React.useRef(false);

  React.useEffect(() => {
    if (!isFocused.current) {
      setLocalValue(String(value ?? ''));
    }
  }, [value]);

  const commitValue = (raw: string) => {
    const trimmed = raw.trim();
    const fallback = min ?? 0;
    if (trimmed === '') {
      const next = fallback;
      setLocalValue(String(next));
      onChange(next);
      return;
    }
    let num = parseInt(trimmed, 10);
    if (Number.isNaN(num)) {
      num = fallback;
    }
    if (min !== undefined && num < min) num = min;
    if (max !== undefined && num > max) num = max;
    setLocalValue(String(num));
    onChange(num);
  };

  return (
    <Input
      type="text"
      inputMode="numeric"
      value={localValue}
      className={className}
      onFocus={() => {
        isFocused.current = true;
      }}
      onChange={(e) => {
        const next = e.target.value;
        if (next === '' || /^\d+$/.test(next)) {
          setLocalValue(next);
        }
      }}
      onBlur={(e) => {
        isFocused.current = false;
        commitValue(e.target.value);
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          isFocused.current = false;
          commitValue((e.target as HTMLInputElement).value);
          (e.target as HTMLInputElement).blur();
        }
      }}
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
    puzzleGridScale,
    setPuzzleGridScale,
    titleToAnswerGap,
    setTitleToAnswerGap,
    pageMargin,
    setPageMargin,
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
                  <Input
                    type="number"
                    value={String(core.numberOfPuzzles)}
                    onChange={(e) => updateCore({ numberOfPuzzles: Math.max(1, parseInt(e.target.value || '1')) })}
                    min={1}
                    max={100}
                  />
                </div>
                <div>
                  <Label className="text-xs text-gray-500">Starting Number</Label>
                  <Input
                    type="number"
                    value={String(core.puzzlesStartingNumber)}
                    onChange={(e) => updateCore({ puzzlesStartingNumber: Math.max(1, parseInt(e.target.value || '1')) })}
                    min={1}
                  />
                </div>
              </div>
            </div>

            {/* Grid Size */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium">Grid Size</Label>
                <span className="text-sm text-gray-600">{core.lettersAcross} x {core.lettersDown}</span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <SliderField
                  label="Letters Across"
                  value={core.lettersAcross}
                  onValueChange={(v) => updateCore({ lettersAcross: v })}
                  min={8}
                  max={30}
                  step={1}
                />
                <SliderField
                  label="Letters Down"
                  value={core.lettersDown}
                  onValueChange={(v) => updateCore({ lettersDown: v })}
                  min={8}
                  max={30}
                  step={1}
                />
              </div>
              {/* Puzzle Grid Scale Controls */}
              <div className="border-t pt-3">
                <Label className="text-xs text-gray-500 mb-2 block">Puzzle Grid Scale</Label>
                <div className="flex items-center gap-1 border border-gray-200 rounded-md">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setPuzzleGridScale(Math.max(puzzleGridScale - 10, 50))}
                    title="Shrink Grid"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4"><circle cx="11" cy="11" r="8"></circle><line x1="21" x2="16.65" y1="21" y2="16.65"></line><line x1="8" x2="14" y1="11" y2="11"></line></svg>
                  </Button>
                  <span className="px-2 text-sm font-medium min-w-[70px] text-center" title="Puzzle Grid Scale">
                    Grid: {puzzleGridScale}%
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setPuzzleGridScale(Math.min(puzzleGridScale + 10, 200))}
                    title="Enlarge Grid"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4"><circle cx="11" cy="11" r="8"></circle><line x1="21" x2="16.65" y1="21" y2="16.65"></line><line x1="11" x2="11" y1="8" y2="14"></line><line x1="8" x2="14" y1="11" y2="11"></line></svg>
                  </Button>
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
                <SliderField
                  label="Border Stroke Thickness"
                  value={core.borderStrokeThickness}
                  onValueChange={(v) => updateCore({ borderStrokeThickness: v })}
                  min={1}
                  max={10}
                  step={1}
                  format="px"
                />
                <SliderField
                  label="Inner Grid Transparency"
                  value={core.innerGridOpacity ?? 0}
                  onValueChange={(v) => updateCore({ innerGridOpacity: v })}
                  min={0}
                  max={100}
                  step={1}
                  format="percent"
                />
              </div>
            </div>

            {/* Grid Letters */}
            <div className="space-y-3">
              <Label className="text-sm font-medium">Grid Letters</Label>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label className="text-xs text-gray-500">Font</Label>
                  <Select value={typography.puzzleGridFontFamily} onValueChange={(value) => updateTypography({ puzzleGridFontFamily: value })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {PUBLISHING_FONTS.map((font) => <SelectItem key={font} value={font} style={{ fontFamily: font }}>{font}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <SliderField
                  label="Puzzle Font Size"
                  value={typography.puzzleGridFontSize}
                  onValueChange={(v) => updateTypography({ puzzleGridFontSize: v })}
                  min={8}
                  max={50}
                  step={1}
                  format="px"
                />
                <SliderField
                  label="Solution Font Size"
                  value={typography.answerGridFontSize}
                  onValueChange={(v) => updateTypography({ answerGridFontSize: v, setFontSizeForAnswerPages: true })}
                  min={8}
                  max={50}
                  step={1}
                  format="px"
                />
              </div>
            </div>

            {/* Custom Letters removed per request */}

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

            {/* Solution Marking Style */}
            <div className="space-y-3">
              <Label className="text-sm font-medium">Solution Marking</Label>
              <div className="space-y-3 p-3 bg-gray-50 rounded-lg">
                <ColorInput label="Highlight Color" value={colors.answerPage.solutionFrameColor} onChange={(v) => updateAnswerPageColors({ solutionFrameColor: v })} />
                <div className="grid grid-cols-2 gap-3">
                  <SliderField
                    label="Thickness"
                    value={colors.answerPage.solutionStrokeThickness}
                    onValueChange={(v) => updateAnswerPageColors({ solutionStrokeThickness: v })}
                    min={1}
                    max={15}
                    step={1}
                    format="px"
                  />
                  <SliderField
                    label="Transparency"
                    value={colors.answerPage.solutionHighlightAlpha ?? 30}
                    onValueChange={(v) => updateAnswerPageColors({ solutionHighlightAlpha: v })}
                    min={0}
                    max={100}
                    step={1}
                    format="percent"
                  />
                </div>
              </div>
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
                <div className="space-y-2">
                  <Textarea
                    value={typography.titleText}
                    onChange={(e) => updateTypography({ titleText: e.target.value })}
                    placeholder="Enter one title per line..."
                    className="h-28"
                  />
                  <p className="text-xs text-gray-500">Enter one title per line. The first line is for Puzzle 1, the second for Puzzle 2, etc.</p>
                </div>
              )}

              <div className="flex items-center space-x-2">
                <Checkbox id="includeSubtitle" checked={typography.includeSubtitle} onCheckedChange={(checked) => updateTypography({ includeSubtitle: checked === true })} />
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
                    {PUBLISHING_FONTS.map((font) => <SelectItem key={font} value={font} style={{ fontFamily: font }}>{font}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Font Sizes */}
            <div className="space-y-3">
              <Label className="text-sm font-medium">Font Sizes</Label>
              <div className="grid grid-cols-2 gap-3">
                <SliderField
                  label="Title Size"
                  value={typography.puzzleTitleFontSize}
                  onValueChange={(v) => updateTypography({ puzzleTitleFontSize: v })}
                  min={8}
                  max={50}
                  step={1}
                  format="px"
                />
                
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
                <SliderField
                  label="Title Start At"
                  value={typography.titleStartAt}
                  onValueChange={(v) => updateTypography({ titleStartAt: v })}
                  min={0}
                  max={200}
                  step={1}
                  format="px"
                />
                <SliderField
                  label="Title to Puzzle"
                  value={typography.spaceBetweenTitleAndPuzzle}
                  onValueChange={(v) => updateTypography({ spaceBetweenTitleAndPuzzle: v })}
                  min={0}
                  max={100}
                  step={1}
                  format="px"
                />
                <SliderField
                  label="Puzzle to Word List"
                  value={typography.spaceBetweenPuzzleAndWordList}
                  onValueChange={(v) => updateTypography({ spaceBetweenPuzzleAndWordList: v })}
                  min={0}
                  max={100}
                  step={1}
                  format="px"
                />
                <SliderField
                  label="Title to Answer"
                  value={typography.spaceBetweenTitleAndAnswer}
                  onValueChange={(v) => updateTypography({ spaceBetweenTitleAndAnswer: v })}
                  min={0}
                  max={100}
                  step={1}
                  format="px"
                />
              </div>
            </div>

            {/* Layout Margins */}
            <div className="space-y-3">
              <Label className="text-sm font-medium">Page Layout</Label>
              <div className="grid grid-cols-2 gap-3">
                <SliderField
                  label="Title to Answer Gap"
                  value={titleToAnswerGap}
                  onValueChange={setTitleToAnswerGap}
                  min={0}
                  max={100}
                  step={1}
                  format="px"
                />
                <SliderField
                  label="Page Margin"
                  value={pageMargin}
                  onValueChange={setPageMargin}
                  min={10}
                  max={100}
                  step={5}
                  format="px"
                />
              </div>
              <p className="text-xs text-gray-500">Page Margin controls distance from page edges (KDP safe zone).</p>
            </div>

            {/* Answer Page Fonts */}
            <div className="space-y-3">
              <Label className="text-sm font-medium">Answer Page Fonts</Label>
              <div className="flex items-center space-x-2">
                <Checkbox id="setAnswerFont" checked={typography.setFontForAnswerPages} onCheckedChange={(checked) => updateTypography({ setFontForAnswerPages: checked === true })} />
                <Label htmlFor="setAnswerFont" className="text-sm font-normal">Custom Font</Label>
              </div>
              {typography.setFontForAnswerPages && (
                <Select value={typography.answerGridFontFamily} onValueChange={(value) => updateTypography({ answerGridFontFamily: value })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PUBLISHING_FONTS.map((font) => <SelectItem key={font} value={font} style={{ fontFamily: font }}>{font}</SelectItem>)}
                  </SelectContent>
                </Select>
              )}
            </div>

            {/* Answer Page Title */}
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
                        {PUBLISHING_FONTS.map((font) => <SelectItem key={font} value={font} style={{ fontFamily: font }}>{font}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <SliderField
                    label="Size"
                    value={colors.answerPage.answerTitleFontSize}
                    onValueChange={(v) => updateAnswerPageColors({ answerTitleFontSize: v })}
                    min={8}
                    max={50}
                    step={1}
                    format="px"
                  />
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
          </div>
        </TabsContent>

        {/* ==================== WORD LIST SETTINGS ==================== */}
        <TabsContent value="words" className="p-4 space-y-6">
          <div className="space-y-4">
            <h3 className="font-semibold text-gray-900">Word List Settings</h3>

            {/* Words Per Puzzle */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Words Per Puzzle</Label>
              <IntegerInput
                value={wordList.wordsPerPuzzle}
                onChange={(v) => updateWordListSettings({ wordsPerPuzzle: v })}
                min={3}
                max={50}
              />
              <p className="text-xs text-gray-500">
                Total needed: {requiredWords} ({core.numberOfPuzzles} x {wordList.wordsPerPuzzle})
              </p>
            </div>

            {/* Visibility */}
            <div className="flex items-center space-x-2">
              <Checkbox id="hideWordList" checked={wordList.hideWordList} onCheckedChange={(checked) => updateWordListSettings({ hideWordList: checked === true })} />
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
                      <SliderField
                        label="Max Length"
                        value={wordList.aiMaxWordLength}
                        onValueChange={(v) => updateWordListSettings({ aiMaxWordLength: v })}
                        min={3}
                        max={15}
                        step={1}
                      />
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
                          {PUBLISHING_FONTS.map((font) => <SelectItem key={font} value={font} style={{ fontFamily: font }}>{font}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <SliderField
                      label="Font Size"
                      value={wordList.wordListFontSize}
                      onValueChange={(v) => updateWordListSettings({ wordListFontSize: v })}
                      min={8}
                      max={50}
                      step={1}
                      format="px"
                    />
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
                    <SliderField
                      label="Spaces Between Words Horizontally"
                      value={wordList.wordSpacingHorizontal ?? wordList.wordListGap ?? 50}
                      onValueChange={(v) => updateWordListSettings({ wordSpacingHorizontal: v })}
                      min={0}
                      max={100}
                      step={1}
                      format="px"
                    />
                    <SliderField
                      label="Spaces Between Words Vertically"
                      value={wordList.wordSpacingVertical ?? wordList.wordListGap ?? 8}
                      onValueChange={(v) => updateWordListSettings({ wordSpacingVertical: v })}
                      min={0}
                      max={40}
                      step={1}
                      format="px"
                    />
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

            <Button variant="outline" onClick={() => updateColors({
              puzzlePage: { backgroundColor: '#ffffff', titleColor: '#1f2937', subtitleColor: '#6b7280', boxColor: '#1f2937', puzzleColor: '#1f2937', wordListTitleColor: '#374151', wordListColor: '#4b5563' },
              answerPage: { backgroundColor: '#ffffff', titleColor: '#1f2937', boxColor: '#1f2937', lettersInSolutionColor: '#22c55e', lettersNotInSolutionColor: '#d1d5db', solutionStrokeThickness: 12, solutionStrokePadding: 2, solutionFrameColor: '#22c55e', solutionFrameStyle: 'rounded', solutionFrameRadius: 6, solutionHighlightAlpha: 30, onlyHighlightWordListWords: false, answerTitlePrefix: 'Solution', answerTitleFontFamily: 'Inter', answerTitleFontSize: 20, answerTitleAlignment: 'center', showAnswerNumber: true }
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
                <Checkbox id="useCustomTrim" checked={bookCanvas.useCustomTrim} onCheckedChange={(checked) => updateBookCanvas({ useCustomTrim: checked === true })} />
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

            {/* Page Structure */}
            <div className="flex items-center space-x-2">
              <Checkbox id="includePageBetween" checked={bookCanvas.includePageBetweenPuzzleAndSolutions} onCheckedChange={(checked) => updateBookCanvas({ includePageBetweenPuzzleAndSolutions: checked === true })} />
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
