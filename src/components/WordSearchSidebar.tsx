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
import { AlertCircle, CheckCircle, Save } from 'lucide-react';
import { useApp } from '@/lib/app-context';
import { PUBLISHING_FONTS } from '@/lib/publishing-fonts';
import { cn } from '@/lib/utils';

const LANGUAGES = ['English', 'Spanish', 'French', 'German', 'Italian', 'Portuguese', 'Arabic'];
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
  disabled = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  return (
    <div className={cn('flex items-center gap-3 p-3 rounded-lg dark:from-slate-700 dark:to-slate-600 dark:border-slate-600 transition-all duration-200 border', disabled && 'opacity-50 pointer-events-none')} style={{background: `linear-gradient(to right, #F0F5F6, #F0F5F6)`, borderColor: `rgba(34, 118, 180, 0.2)`}}>
      <div className="flex-1">
        <Label className={cn('text-sm font-medium', disabled ? 'text-gray-400 dark:text-gray-500' : 'text-gray-700 dark:text-gray-200')}>{label}</Label>
        <div className="flex items-center gap-2 mt-1">
          <Input
            type="color"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="w-14 h-10 p-1 cursor-pointer border-2 border-blue-300 dark:border-slate-500 rounded-lg hover:shadow-lg transition-shadow duration-200"
            disabled={disabled}
          />
          <Input
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="flex-1 font-mono text-sm border-gray-300 dark:border-slate-600 focus:border-blue-400 focus:ring-blue-400/20 hover:border-blue-300 transition-colors duration-200"
            placeholder="#000000"
            disabled={disabled}
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

/** Bulletproof Word List Textarea: Handles Space and Enter keys even with global event listeners */
function WordListTextarea({ 
  value, 
  onChange 
}: { 
  value: string; 
  onChange: (value: string) => void;
}) {
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);
  const [displayValue, setDisplayValue] = React.useState(value);

  React.useEffect(() => {
    setDisplayValue(value);
    if (textareaRef.current && document.activeElement !== textareaRef.current) {
      // Only update textarea value if it's not currently being edited
      textareaRef.current.value = value;
    }
  }, [value]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      // CRITICAL: stop propagation to prevent global event listeners from interfering
      e.stopPropagation();
      // NOTE: Do NOT call preventDefault() - we want the browser to insert the character
      
      const textarea = textareaRef.current;
      if (!textarea) return;

      // Also prevent the event from bubbling to parent containers
      e.nativeEvent.stopImmediatePropagation?.();
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    setDisplayValue(newValue);
    onChange(newValue);
  };

  return (
    <div className="space-y-2">
      <Label className="text-sm font-medium">Your Words</Label>
      <Textarea
        ref={textareaRef}
        value={displayValue}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder="Enter one word per line..."
        className="h-28"
      />
    </div>
  );
}

export function WordSearchSidebar() {

  const {
    wordSearchSettings,
    updateWordSearchSettings,
    titleWords,
    setTitleWords,
    generatePuzzle,
    savePuzzle,
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

  const handleSave = () => {
    const name = `${titleWords.title || 'word-search'} - ${new Date().toLocaleDateString()}`;
    savePuzzle(name);
  };

  const requiredWords = core.numberOfPuzzles * wordList.wordsPerPuzzle;
  const wordCount = titleWords.words.length;

  return (
    <div className="w-96 h-screen bg-gradient-to-b from-slate-50 to-white dark:from-slate-950 dark:to-slate-900 border-r border-gray-200 dark:border-slate-800 flex flex-col shadow-lg overflow-y-auto">
      <style>{`
        /* Modern tab styling */
        [role="tablist"] {
          display: flex;
          flex-wrap: wrap;
          gap: 4px;
          padding: 12px 8px;
          background: linear-gradient(135deg, rgba(241, 245, 249, 0.5) 0%, rgba(226, 232, 240, 0.5) 100%);
          border-bottom: 2px solid rgba(226, 232, 240, 0.8);
        }
        
        button[role="tab"] {
          flex: 1;
          min-width: 60px;
          padding: 10px 12px;
          border-radius: 8px;
          font-weight: 500;
          transition: all 300ms ease-out;
          border: 2px solid transparent;
          background: white;
          color: #64748b;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
        }
        
        button[role="tab"]:hover {
          background: linear-gradient(135deg, #eef2ff 0%, #dbeafe 100%);
          color: #4f46e5;
          box-shadow: 0 4px 12px rgba(79, 70, 229, 0.15);
          transform: translateY(-1px);
        }
        
        button[role="tab"][data-state="active"] {
          background: linear-gradient(135deg, #7D8183 0%, #5a5f61 100%);
          color: white;
          border-color: #4f46e5;
          box-shadow: 0 8px 16px rgba(79, 70, 229, 0.3);
        }
        
        [role="tabpanel"] {
          padding: 20px;
          background: transparent;
          animation: slideDown 300ms ease-out;
        }
        
        @keyframes slideDown {
          from {
            opacity: 0;
            transform: translateY(-10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>

      <Tabs defaultValue="book" className="w-full flex-1">
        <TabsList className="w-full grid grid-cols-5 bg-transparent">
          <TabsTrigger value="book" title="Book" className="transition-all duration-200">
            <Book className="w-4 h-4" />
          </TabsTrigger>
          <TabsTrigger value="words" title="Words" className="transition-all duration-200">
            <List className="w-4 h-4" />
          </TabsTrigger>
          <TabsTrigger value="design" title="Design" className="transition-all duration-200">
            <Type className="w-4 h-4" />
          </TabsTrigger>
          <TabsTrigger value="colors" title="Colors" className="transition-all duration-200">
            <Palette className="w-4 h-4" />
          </TabsTrigger>
          <TabsTrigger value="puzzle" title="Puzzle" className="transition-all duration-200">
            <Grid3X3 className="w-4 h-4" />
          </TabsTrigger>
        </TabsList>

        {/* ==================== PUZZLE SETTINGS ==================== */}
        <TabsContent value="puzzle" className="p-4 space-y-6 bg-gradient-to-b from-white to-gray-50 dark:from-slate-800 dark:to-slate-850 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700 m-2">
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <h3 className="font-semibold text-gray-900 dark:text-white">Puzzle Settings</h3>
              <Button variant="outline" size="sm" onClick={handleSave} className="transition-all duration-200 border-gray-300 dark:border-slate-600" style={{borderColor: `#7D8183`}}>
                <Save className="w-4 h-4 mr-2" />Save
              </Button>
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
        <TabsContent value="design" className="p-4 space-y-6 bg-gradient-to-b from-white to-gray-50 dark:from-slate-800 dark:to-slate-850 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700 m-2">
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <h3 className="font-semibold text-gray-900">Design Settings</h3>
              <Button variant="outline" size="sm" onClick={handleSave}>
                <Save className="w-4 h-4 mr-2" />Save
              </Button>
            </div>

            {/* Title Options */}
            <div className="space-y-3">
              <Label className="text-sm font-medium">Title</Label>
              <Select 
                value={typography.selectTitleOption} 
                onValueChange={(value) => {
                  const updates: any = { selectTitleOption: value as any };
                  
                  // When switching to "one-custom-title", extract only the first line
                  if (value === 'one-custom-title' && typography.titleText) {
                    const firstLine = typography.titleText.split('\n')[0] || 'Word Search';
                    updates.titleText = firstLine;
                  }
                  
                  // When switching to "custom", keep multiline text as-is
                  // When switching to "none", clear the title text
                  if (value === 'none') {
                    updates.titleText = '';
                  }
                  
                  updateTypography(updates);
                }}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="one-custom-title">One Custom Title</SelectItem>
                  <SelectItem value="custom">Custom Title Per Puzzle</SelectItem>
                  <SelectItem value="none">No Title</SelectItem>
                </SelectContent>
              </Select>

              {typography.selectTitleOption === 'one-custom-title' && (
                <div className="space-y-2">
                  <Input
                    value={typography.titleText}
                    onChange={(e) => updateTypography({ titleText: e.target.value })}
                    placeholder="Enter the master title for all puzzles..."
                  />
                  <p className="text-xs text-gray-500">This title will be used for all puzzle pages.</p>
                </div>
              )}

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

              {typography.selectTitleOption !== 'none' && (
                <div className="space-y-2 pt-2 border-t">
                  <Label className="text-sm font-medium">Puzzle Numbering Style</Label>
                  <Select value={typography.puzzleNumberingStyle} onValueChange={(value) => updateTypography({ puzzleNumberingStyle: value as any })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      <SelectItem value="prefix">Prefix (1. Title)</SelectItem>
                      <SelectItem value="suffix">Suffix (Title #1)</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-gray-500">Choose how to display puzzle numbers with titles.</p>
                </div>
              )}

              {/* Fun Facts / Quotes Section */}
              <div className="space-y-2 pt-2 border-t">
                <div className="flex items-center space-x-2">
                  <Checkbox id="includeFunFacts" checked={typography.includeFunFacts} onCheckedChange={(checked) => updateTypography({ includeFunFacts: checked === true })} />
                  <Label htmlFor="includeFunFacts" className="text-sm font-medium">Add Fun Facts / Quotes</Label>
                </div>

                {typography.includeFunFacts && (
                  <>
                    <Textarea
                      value={typography.funFactsText}
                      onChange={(e) => updateTypography({ funFactsText: e.target.value })}
                      placeholder="Enter one fun fact or quote per line..."
                      className="h-28"
                    />
                    <p className="text-xs text-gray-500">Enter one fun fact or quote per line. Each line appears under the corresponding puzzle (Line 1 under Puzzle 1, Line 2 under Puzzle 2, etc.)</p>
                  </>
                )}
              </div>
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
                <SliderField
                  label="Subtitle Size"
                  value={typography.subtitleFontSize}
                  onValueChange={(v) => updateTypography({ subtitleFontSize: v })}
                  min={10}
                  max={24}
                  step={1}
                  format="px"
                  disabled={!typography.includeFunFacts}
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
                  label="Title to Subtitle"
                  value={typography.subtitleToTitleGap}
                  onValueChange={(v) => updateTypography({ subtitleToTitleGap: v })}
                  min={0}
                  max={100}
                  step={1}
                  format="px"
                  disabled={!typography.includeFunFacts}
                />
                <SliderField
                  label="Title to Puzzle"
                  value={typography.spaceBetweenTitleAndPuzzle}
                  onValueChange={(v) => updateTypography({ spaceBetweenTitleAndPuzzle: v })}
                  min={0}
                  max={100}
                  step={1}
                  format="px"
                  disabled={typography.includeFunFacts}
                />
                <SliderField
                  label="Subtitle to Puzzle"
                  value={typography.subtitleToPuzzleGap}
                  onValueChange={(v) => updateTypography({ subtitleToPuzzleGap: v })}
                  min={0}
                  max={100}
                  step={1}
                  format="px"
                  disabled={!typography.includeFunFacts}
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

              </div>
            </div>

            {/* Layout Margins */}
            <div className="space-y-3">
              <Label className="text-sm font-medium">Page Layout</Label>
              <div className="grid grid-cols-2 gap-3">
                <SliderField
                  label="Title to Answer"
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

                {/* Solution Title Style */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Solution Title Style</Label>
                  <Select value={typography.solutionTitleStyle} onValueChange={(value) => {
                    // When switching to "same_as_puzzle", reset solutionNumberingStyle since it won't be used
                    if (value === 'same_as_puzzle') {
                      updateTypography({ solutionTitleStyle: value as any, solutionNumberingStyle: 'none' });
                    } else {
                      updateTypography({ solutionTitleStyle: value as any });
                    }
                  }}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="same_as_puzzle">Same as Puzzle</SelectItem>
                      <SelectItem value="custom">Custom Title</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Custom Solution Title Input */}
                {typography.solutionTitleStyle === 'custom' && (
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Custom Solution Title</Label>
                    <Input
                      value={typography.customSolutionTitle}
                      onChange={(e) => updateTypography({ customSolutionTitle: e.target.value })}
                      placeholder="Enter solution title..."
                    />
                  </div>
                )}

                {/* Solution Numbering Style - Only visible when using custom title */}
                {typography.solutionTitleStyle === 'custom' && (
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Solution Numbering Style</Label>
                    <Select value={typography.solutionNumberingStyle} onValueChange={(value) => updateTypography({ solutionNumberingStyle: value as any })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">None</SelectItem>
                        <SelectItem value="prefix">Prefix (1. Title)</SelectItem>
                        <SelectItem value="suffix">Suffix (Title #1)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
            </div>
          </div>
        </TabsContent>

        {/* ==================== WORD LIST SETTINGS ==================== */}
        <TabsContent 
          value="words" 
          className="p-4 space-y-6 bg-gradient-to-b from-white to-gray-50 dark:from-slate-800 dark:to-slate-850 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700 m-2"
          onKeyDown={(e) => {
            // Allow Enter key to work in textareas without triggering tab navigation
            if (e.key === 'Enter' && (e.target as HTMLElement)?.tagName === 'TEXTAREA') {
              e.stopPropagation();
            }
          }}
        >
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <h3 className="font-semibold text-gray-900">Word List Settings</h3>
              <Button variant="outline" size="sm" onClick={handleSave}>
                <Save className="w-4 h-4 mr-2" />Save
              </Button>
            </div>

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
                  <div className="space-y-3 p-3 rounded-lg border" style={{background: `rgba(34, 118, 180, 0.08)`, borderColor: `rgba(34, 118, 180, 0.2)`}}>
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-4 h-4" style={{color: `#2276B4`}} />
                      <Label className="text-sm font-medium" style={{color: `#2276B4`}}>AI Word Generation</Label>
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
                  <>
                    <WordListTextarea 
                      value={titleWords.words.join('\n')} 
                      onChange={(value) => {
                        const words = value.split('\n').map(w => w.trim()).filter(w => w);
                        setTitleWords({ ...titleWords, words });
                      }}
                    />
                    <div className="flex items-center justify-between">
                      <p className="text-xs text-gray-500">
                        Enter one word per line. {wordCount} words {wordCount >= requiredWords ? (
                          <span className="text-green-600 flex items-center gap-1 inline"><CheckCircle className="w-3 h-3" /> Ready</span>
                        ) : (
                          <span className="text-red-500 flex items-center gap-1 inline"><AlertCircle className="w-3 h-3" /> Need {requiredWords - wordCount} more</span>
                        )}
                      </p>
                    </div>
                  </>
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
                  </div>
                </div>
              </>
            )}
          </div>
        </TabsContent>

        {/* ==================== COLOR SETTINGS ==================== */}
        <TabsContent value="colors" className="p-4 space-y-6 bg-gradient-to-b from-white to-gray-50 dark:from-slate-800 dark:to-slate-850 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700 m-2">
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <h3 className="font-semibold text-gray-900">Color Settings</h3>
              <Button variant="outline" size="sm" onClick={handleSave}>
                <Save className="w-4 h-4 mr-2" />Save
              </Button>
            </div>

            {/* Puzzle Page Colors */}
            <div className="space-y-3">
              <Label className="text-sm font-medium">Puzzle Page</Label>
              <div className="space-y-3 p-3 bg-gray-50 rounded-lg">
                <ColorInput label="Background" value={colors.puzzlePage.backgroundColor} onChange={(v) => updatePuzzlePageColors({ backgroundColor: v })} />
                <ColorInput label="Title" value={colors.puzzlePage.titleColor} onChange={(v) => updatePuzzlePageColors({ titleColor: v })} />
                <ColorInput label="Subtitle" value={colors.puzzlePage.subtitleColor} onChange={(v) => updatePuzzlePageColors({ subtitleColor: v })} disabled={!typography.includeFunFacts} />
                <ColorInput label="Box" value={colors.puzzlePage.boxColor} onChange={(v) => updatePuzzlePageColors({ boxColor: v })} />
                <ColorInput label="Puzzle Letters" value={colors.puzzlePage.puzzleColor} onChange={(v) => updatePuzzlePageColors({ puzzleColor: v })} />
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
            })} className="w-full hover:bg-gradient-to-r hover:from-gray-100 hover:to-gray-200 dark:hover:from-slate-700 dark:hover:to-slate-600 transition-all duration-200 border-gray-300 dark:border-slate-600">
              Reset Colors
            </Button>
          </div>
        </TabsContent>

        {/* ==================== BOOK SETTINGS ==================== */}
        <TabsContent value="book" className="p-4 space-y-6 bg-gradient-to-b from-white to-gray-50 dark:from-slate-800 dark:to-slate-850 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700 m-2">
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <h3 className="font-semibold text-gray-900">Book Settings</h3>
              <Button variant="outline" size="sm" onClick={handleSave}>
                <Save className="w-4 h-4 mr-2" />Save
              </Button>
            </div>

            {/* Quantity */}
            <div className="space-y-3">
              <Label className="text-sm font-medium">Quantity</Label>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs text-gray-500">Number of Puzzles</Label>
                  <IntegerInput
                    value={core.numberOfPuzzles}
                    onChange={(value) => updateCore({ numberOfPuzzles: value })}
                    min={1}
                    max={1000}
                  />
                </div>
                <div>
                  <Label className="text-xs text-gray-500">Starting Number</Label>
                  <IntegerInput
                    value={core.puzzlesStartingNumber}
                    onChange={(value) => updateCore({ puzzlesStartingNumber: value })}
                    min={1}
                  />
                </div>
              </div>
            </div>

            {/* Measurement Units */}
            <div className="space-y-1">
              <Label className="text-sm font-medium">Measurement Units</Label>
              <Select value={bookCanvas.measurementUnits || 'INCHES'} onValueChange={(value) => updateBookCanvas({ measurementUnits: value as any })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="INCHES">Inches</SelectItem>
                  <SelectItem value="CENTIMETERS">Centimeters</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Custom Trim Size */}
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <Checkbox id="useCustomTrim" checked={bookCanvas.useCustomTrim} onCheckedChange={(checked) => updateBookCanvas({ useCustomTrim: checked === true })} />
                <Label htmlFor="useCustomTrim" className="text-sm font-normal">Custom Trim Size</Label>
              </div>

              {bookCanvas.useCustomTrim && (
                <div className="pl-6 grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs text-gray-500">Width ({bookCanvas.measurementUnits === 'CENTIMETERS' ? 'cm' : 'in'})</Label>
                    <DecimalInput 
                      value={bookCanvas.measurementUnits === 'CENTIMETERS' ? (bookCanvas.customWidth || 0) * 2.54 : (bookCanvas.customWidth || 0)} 
                      onChange={(val) => {
                        const inchesValue = bookCanvas.measurementUnits === 'CENTIMETERS' ? val / 2.54 : val;
                        updateBookCanvas({ customWidth: inchesValue });
                      }} 
                      placeholder={bookCanvas.measurementUnits === 'CENTIMETERS' ? '21.59' : '8.5'} 
                      min={0} 
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-gray-500">Length ({bookCanvas.measurementUnits === 'CENTIMETERS' ? 'cm' : 'in'})</Label>
                    <DecimalInput 
                      value={bookCanvas.measurementUnits === 'CENTIMETERS' ? (bookCanvas.customHeight || 0) * 2.54 : (bookCanvas.customHeight || 0)} 
                      onChange={(val) => {
                        const inchesValue = bookCanvas.measurementUnits === 'CENTIMETERS' ? val / 2.54 : val;
                        updateBookCanvas({ customHeight: inchesValue });
                      }} 
                      placeholder={bookCanvas.measurementUnits === 'CENTIMETERS' ? '27.94' : '11'} 
                      min={0} 
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Trim Size */}
            {!bookCanvas.useCustomTrim && (
              <div className="space-y-2">
                <Label className="text-sm font-medium">Trim Size</Label>
                <Select value={bookCanvas.trimSizePreset || ''} onValueChange={(value) => {
                  if (value) {
                    // Set dimensions based on preset (in inches)
                    const presets: { [key: string]: { width: number; height: number } } = {
                      '5X8IN': { width: 5, height: 8 },
                      '5_25X8IN': { width: 5.25, height: 8 },
                      '5_5X8_5IN': { width: 5.5, height: 8.5 },
                      '6X9IN': { width: 6, height: 9 },
                      '5_06X7_81IN': { width: 5.06, height: 7.81 },
                      '6_14X9_21IN': { width: 6.14, height: 9.21 },
                      '6_69X9_61IN': { width: 6.69, height: 9.61 },
                      '7X10IN': { width: 7, height: 10 },
                      '7_44X9_69IN': { width: 7.44, height: 9.69 },
                      '7_5X9_25IN': { width: 7.5, height: 9.25 },
                      '8X10IN': { width: 8, height: 10 },
                      '8_5X11IN': { width: 8.5, height: 11 },
                      '8_27X11_69IN': { width: 8.27, height: 11.69 },
                      '8_25X6IN': { width: 8.25, height: 6 },
                      '8_25X8_25IN': { width: 8.25, height: 8.25 },
                      '8_5X8_5IN': { width: 8.5, height: 8.5 },
                    };
                    const dims = presets[value];
                    if (dims) {
                      updateBookCanvas({ trimSizePreset: value, customWidth: dims.width, customHeight: dims.height });
                    }
                  }
                }}>
                  <SelectTrigger><SelectValue placeholder="Select a trim size" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="5X8IN">{bookCanvas.measurementUnits === 'CENTIMETERS' ? '12.7 x 20.32' : '5 x 8'} {bookCanvas.measurementUnits === 'CENTIMETERS' ? 'cm' : 'in'}</SelectItem>
                    <SelectItem value="5_25X8IN">{bookCanvas.measurementUnits === 'CENTIMETERS' ? '13.34 x 20.32' : '5.25 x 8'} {bookCanvas.measurementUnits === 'CENTIMETERS' ? 'cm' : 'in'}</SelectItem>
                    <SelectItem value="5_5X8_5IN">{bookCanvas.measurementUnits === 'CENTIMETERS' ? '13.97 x 21.59' : '5.5 x 8.5'} {bookCanvas.measurementUnits === 'CENTIMETERS' ? 'cm' : 'in'}</SelectItem>
                    <SelectItem value="6X9IN">{bookCanvas.measurementUnits === 'CENTIMETERS' ? '15.24 x 22.86' : '6 x 9'} {bookCanvas.measurementUnits === 'CENTIMETERS' ? 'cm' : 'in'}</SelectItem>
                    <SelectItem value="5_06X7_81IN">{bookCanvas.measurementUnits === 'CENTIMETERS' ? '12.85 x 19.84' : '5.06 x 7.81'} {bookCanvas.measurementUnits === 'CENTIMETERS' ? 'cm' : 'in'}</SelectItem>
                    <SelectItem value="6_14X9_21IN">{bookCanvas.measurementUnits === 'CENTIMETERS' ? '15.6 x 23.39' : '6.14 x 9.21'} {bookCanvas.measurementUnits === 'CENTIMETERS' ? 'cm' : 'in'}</SelectItem>
                    <SelectItem value="6_69X9_61IN">{bookCanvas.measurementUnits === 'CENTIMETERS' ? '16.99 x 24.4' : '6.69 x 9.61'} {bookCanvas.measurementUnits === 'CENTIMETERS' ? 'cm' : 'in'}</SelectItem>
                    <SelectItem value="7X10IN">{bookCanvas.measurementUnits === 'CENTIMETERS' ? '17.78 x 25.4' : '7 x 10'} {bookCanvas.measurementUnits === 'CENTIMETERS' ? 'cm' : 'in'}</SelectItem>
                    <SelectItem value="7_44X9_69IN">{bookCanvas.measurementUnits === 'CENTIMETERS' ? '18.9 x 24.61' : '7.44 x 9.69'} {bookCanvas.measurementUnits === 'CENTIMETERS' ? 'cm' : 'in'}</SelectItem>
                    <SelectItem value="7_5X9_25IN">{bookCanvas.measurementUnits === 'CENTIMETERS' ? '19.05 x 23.5' : '7.5 x 9.25'} {bookCanvas.measurementUnits === 'CENTIMETERS' ? 'cm' : 'in'}</SelectItem>
                    <SelectItem value="8X10IN">{bookCanvas.measurementUnits === 'CENTIMETERS' ? '20.32 x 25.4' : '8 x 10'} {bookCanvas.measurementUnits === 'CENTIMETERS' ? 'cm' : 'in'}</SelectItem>
                    <SelectItem value="8_5X11IN">{bookCanvas.measurementUnits === 'CENTIMETERS' ? '21.59 x 27.94' : '8.5 x 11'} {bookCanvas.measurementUnits === 'CENTIMETERS' ? 'cm' : 'in'}</SelectItem>
                    <SelectItem value="8_27X11_69IN">{bookCanvas.measurementUnits === 'CENTIMETERS' ? '21 x 29.7' : '8.27 x 11.69'} {bookCanvas.measurementUnits === 'CENTIMETERS' ? 'cm' : 'in'}</SelectItem>
                    <SelectItem value="8_25X6IN">{bookCanvas.measurementUnits === 'CENTIMETERS' ? '20.96 x 15.24' : '8.25 x 6'} {bookCanvas.measurementUnits === 'CENTIMETERS' ? 'cm' : 'in'}</SelectItem>
                    <SelectItem value="8_25X8_25IN">{bookCanvas.measurementUnits === 'CENTIMETERS' ? '20.96 x 20.96' : '8.25 x 8.25'} {bookCanvas.measurementUnits === 'CENTIMETERS' ? 'cm' : 'in'}</SelectItem>
                    <SelectItem value="8_5X8_5IN">{bookCanvas.measurementUnits === 'CENTIMETERS' ? '21.59 x 21.59' : '8.5 x 8.5'} {bookCanvas.measurementUnits === 'CENTIMETERS' ? 'cm' : 'in'}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

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
      className={`px-2 py-1.5 text-xs font-semibold rounded-lg border-2 transition-all duration-200 transform hover:scale-110 active:scale-95 ${checked ? 'text-white' : 'bg-white dark:bg-slate-700 text-gray-600 dark:text-gray-300 border-gray-300 dark:border-slate-600 dark:hover:bg-slate-600'}`}
      style={checked ? {background: `linear-gradient(to right, #2276B4, #1a5a8c)`, borderColor: `#2276B4`, boxShadow: `0 0 12px rgba(34, 118, 180, 0.3)`} : {borderColor: `#7D8183`}}
    >
      {label}
    </button>
  );
}
