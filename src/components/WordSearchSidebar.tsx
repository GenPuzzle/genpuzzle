'use client';

import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { SliderField } from '@/components/ui/slider-field';
import { AlertCircle, CheckCircle, Save, Trash2, Upload, Zap, ChevronLeft, ChevronRight, RefreshCw, ArrowRight, ArrowLeft, ArrowDown, ArrowUp, ArrowDownRight, ArrowUpRight, ArrowUpLeft, ArrowDownLeft } from 'lucide-react';
import { useApp } from '@/lib/app-context';
import { TextModuleSettings, isTextModuleSettings } from '@/lib/document-model';
import { PUBLISHING_FONTS } from '@/lib/publishing-fonts';
import { cn } from '@/lib/utils';
import { useWordGeneration, queuePrompt, onPasteData, onPasteFunFacts, isExtensionAvailable } from '@/lib/genpuzzle-extension-integration';
import { resolvePageFrameSettings, applyPageFrameSettingsPatch } from '@/lib/page-frame-settings';
import {
  normalizeHeaderAssemblySettings,
  type HeaderAssemblySettings,
} from '@/lib/header-assembly/types';
import { HeaderAssemblyEditor } from '@/components/header/HeaderAssemblyEditor';
import { PageNumberShapeEditor } from '@/components/page-number/PageNumberShapeEditor';
import { normalizePageNumberSettings } from '@/lib/page-number/settings';
import { TRIM_SIZE_PRESETS, type TrimSizePresetId } from '@/lib/trim-size-layout';
import type { PageNumberSettings } from '@/lib/puzzles/types';
import { useDebouncedCallback } from '@/hooks/useDebouncedCallback';
import { usePersistedState } from '@/hooks/usePersistedState';
import { SETTINGS_TAB_STORAGE_KEY, SETTINGS_PANEL_STORAGE_KEY } from '@/lib/settings-persistence';
import { computeWordSearchGenerationFingerprint } from '@/lib/generation-fingerprint';
import { getEditedBatchIndicesForDocument } from '@/lib/canvas-edit-session';
import { CanvasApplyToAllConfirmDialog } from '@/components/CanvasApplyToAllConfirmDialog';
import { ChapterPagesBatchPanel } from '@/components/ChapterPagesBatchPanel';
import type { GeneratePuzzleOptions } from '@/lib/app-context';

const LAYOUT_TABS = ['book', 'colors', 'pages'] as const;
const DOCUMENT_TABS = ['puzzle', 'words', 'design'] as const;

function normalizeSettingsPanel(value: string): 'layout' | 'document' {
  if (value === 'document' || (DOCUMENT_TABS as readonly string[]).includes(value) || value === 'page') {
    return 'document';
  }
  return 'layout';
}

function normalizeSettingsTab(
  value: string,
  panel: 'layout' | 'document',
  isWordSearch: boolean
): string {
  if (panel === 'layout') {
    return (LAYOUT_TABS as readonly string[]).includes(value) ? value : 'book';
  }
  if (!isWordSearch) return 'page';
  if (value === 'book' || value === 'colors' || value === 'pages' || value === 'page') {
    return 'puzzle';
  }
  return (DOCUMENT_TABS as readonly string[]).includes(value) ? value : 'puzzle';
}

const LANGUAGES = ['English', 'Spanish', 'French', 'German', 'Italian', 'Portuguese', 'Arabic'];
const AGE_LEVELS = ['Children (6-8)', 'Children (9-12)', 'Teen', 'Adult', 'Senior'];

// Numeric inputs are provided as sliders for smoother UI control

// Helper for decimal number inputs (for trim size) - text input, no React control during typing
const DecimalInput = ({
  value,
  onChange,
  onCommit,
  placeholder,
  min,
}: {
  value: number;
  onChange: (val: number) => void;
  onCommit?: (val: number) => void;
  placeholder?: string;
  min?: number;
}) => {
  const [localValue, setLocalValue] = React.useState(String(value ?? ''));
  const inputRef = React.useRef<HTMLInputElement>(null);
  const isFocused = React.useRef(false);

  const commitValue = React.useCallback(
    (raw: string) => {
      const trimmed = raw.trim();
      const fallback = min ?? 0;
      if (trimmed === '') {
        const next = fallback;
        setLocalValue(String(next));
        onChange(next);
        return;
      }
      let num = parseFloat(trimmed);
      if (Number.isNaN(num)) {
        num = fallback;
      }
      if (min !== undefined && num < min) num = min;
      setLocalValue(String(num));
      onChange(num);
      onCommit?.(num);
    },
    [min, onChange, onCommit]
  );

  const debouncedCommit = useDebouncedCallback(commitValue, 300);

  // Update local value when external value changes (only when not focused)
  React.useEffect(() => {
    if (!isFocused.current) {
      setLocalValue(value?.toString() || '');
    }
  }, [value]);

  React.useEffect(() => () => debouncedCommit.flush(), [debouncedCommit]);

  const handleFocus = () => {
    isFocused.current = true;
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const next = e.target.value;
    setLocalValue(next);
    debouncedCommit(next);
  };

  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    isFocused.current = false;
    debouncedCommit.cancel();
    commitValue(e.target.value);
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

  const commitValue = React.useCallback(
    (raw: string) => {
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
    },
    [min, max, onChange]
  );

  const debouncedCommit = useDebouncedCallback(commitValue, 300);

  React.useEffect(() => {
    if (!isFocused.current) {
      setLocalValue(String(value ?? ''));
    }
  }, [value]);

  React.useEffect(() => () => debouncedCommit.flush(), [debouncedCommit]);

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
          debouncedCommit(next);
        }
      }}
      onBlur={(e) => {
        isFocused.current = false;
        debouncedCommit.cancel();
        commitValue(e.target.value);
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          isFocused.current = false;
          debouncedCommit.cancel();
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
    <div className={cn('flex items-center gap-3 p-3 rounded-lg dark:from-slate-700 dark:to-slate-600 dark:border-slate-600 transition-all duration-200 border', disabled && 'opacity-50 pointer-events-none')} style={{ background: `linear-gradient(to right, #F0F5F6, #F0F5F6)` }}>
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

function BackgroundImageControl({
  label,
  image,
  opacity,
  fit,
  onImageChange,
  onOpacityChange,
  onFitChange,
  onRemove,
}: {
  label: string;
  image?: string;
  opacity?: number;
  fit?: 'cover' | 'contain' | 'stretch';
  onImageChange: (base64: string) => void;
  onOpacityChange: (value: number) => void;
  onFitChange: (value: 'cover' | 'contain' | 'stretch') => void;
  onRemove: () => void;
}) {
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === 'string') {
        onImageChange(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="p-3 bg-white dark:bg-slate-700/50 rounded-lg border border-gray-200 dark:border-slate-700 space-y-3">
      <div className="flex items-center justify-between">
        <Label className="text-xs font-semibold text-gray-700 dark:text-gray-200">{label} Image</Label>
        {image && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onRemove}
            className="h-8 px-2 text-[var(--gp-grey-800)] hover:text-[var(--gp-black)] hover:bg-[var(--gp-grey-100)] transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5 mr-1" />
            Remove
          </Button>
        )}
      </div>

      {!image ? (
        <div>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept="image/png, image/jpeg, image/jpg"
            className="hidden"
          />
          <Button
            type="button"
            variant="outline"
            onClick={() => fileInputRef.current?.click()}
            className="w-full h-16 border-dashed border-2 border-gray-300 dark:border-slate-600 hover:border-blue-400 hover:bg-blue-50/10 transition-all flex flex-col items-center justify-center gap-1 text-gray-500 hover:text-blue-500"
          >
            <Upload className="w-5 h-5" />
            <span className="text-xs font-medium">Upload Background Image</span>
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <div 
              className="w-12 h-12 rounded border border-gray-200 dark:border-slate-600 bg-gray-100 dark:bg-slate-800 bg-center bg-no-repeat bg-contain"
              style={{ backgroundImage: `url(${image})` }}
            />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-gray-500 truncate">Background Image Active</p>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-[10px] bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-gray-300 px-1.5 py-0.5 rounded">
                  {fit === 'stretch' || !fit ? 'Cover' : fit.charAt(0).toUpperCase() + fit.slice(1)}
                </span>
                <span className="text-[10px] bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-gray-300 px-1.5 py-0.5 rounded">
                  {opacity ?? 100}% Opacity
                </span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 pt-1">
            <div className="space-y-1">
              <Label className="text-[11px] text-gray-500">Image Fit</Label>
              <Select 
                value={fit === 'stretch' || !fit ? 'cover' : fit}
                onValueChange={(val) => onFitChange(val as 'cover' | 'contain')}
              >
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="cover" className="text-xs">Cover</SelectItem>
                  <SelectItem value="contain" className="text-xs">Contain</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <SliderField
                label="Opacity"
                value={opacity ?? 100}
                onValueChange={onOpacityChange}
                min={0}
                max={100}
                step={1}
                format="percent"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Icon components (modern, animated, two-tone)
function Book({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path className="icon-base" d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      <path className="icon-base" d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      <g className="icon-accent">
        <rect x="5" y="6" width="6" height="2" rx="0.8" fill="#0EA5E9" opacity="0.95" />
      </g>
    </svg>
  );
}
function Grid3X3({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="3" y="3" width="7" height="7" stroke="currentColor" strokeWidth="1.6" rx="1" />
      <rect x="14" y="3" width="7" height="7" stroke="currentColor" strokeWidth="1.6" rx="1" />
      <rect x="14" y="14" width="7" height="7" stroke="currentColor" strokeWidth="1.6" rx="1" />
      <rect x="3" y="14" width="7" height="7" stroke="currentColor" strokeWidth="1.6" rx="1" />
      <circle className="icon-accent" cx="12" cy="12" r="2" fill="#0EA5E9" opacity="0.95" />
    </svg>
  );
}
function Type({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M4 7V4H20V7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M9 20H15" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M12 4V20" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      <g className="icon-accent">
        <circle cx="12" cy="6" r="1.4" fill="#0EA5E9" opacity="0.95" />
      </g>
    </svg>
  );
}
function List({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M8 6H21" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M8 12H21" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M8 18H21" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <g className="icon-accent">
        <circle cx="3" cy="6" r="1.6" fill="#0EA5E9" />
        <circle cx="3" cy="12" r="1.6" fill="#0EA5E9" />
        <circle cx="3" cy="18" r="1.6" fill="#0EA5E9" />
      </g>
    </svg>
  );
}
function Palette({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.555C21.965 6.012 17.461 2 12 2z" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      <g className="icon-accent">
        <circle cx="8.5" cy="7.5" r="1.2" fill="#0EA5E9" />
        <circle cx="13.5" cy="6.5" r="1.2" fill="#0EA5E9" />
        <circle cx="17.5" cy="10.5" r="1.2" fill="#0EA5E9" />
      </g>
    </svg>
  );
}
function Sparkles({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      <g className="icon-accent">
        <path d="M6 4 L7.2 6.8 L10 8 L7.2 9.2 L6 12 L4.8 9.2 L2 8 L4.8 6.8 Z" fill="#0EA5E9" opacity="0.95" />
      </g>
    </svg>
  );
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
    batchPuzzles,
    activeDocumentPageId,
    puzzleGenerationVersion,
    puzzleGridScale,
    pageOverrides,
    pagePuzzleGridScales,
    setPuzzleGridScale,
    titleToAnswerGap,
    setTitleToAnswerGap,
    solutionToSolutionGap,
    setSolutionToSolutionGap,
    pageMargin,
    setPageMargin,
    bookSettings,
    activeDocumentPage,
    updateActiveTextModuleSettings,
    applyTrimSizeLayoutChange,
  } = useApp();

  const moduleIsWordSearch = activeDocumentPage?.moduleType === 'word-search';
  const activeTextSettings =
    activeDocumentPage && !moduleIsWordSearch && isTextModuleSettings(activeDocumentPage.settings)
      ? (activeDocumentPage.settings as TextModuleSettings)
      : null;

  // Local state for AI word generation loading
  const [isGeneratingWordsFromExtension, setIsGeneratingWordsFromExtension] = React.useState(false);
  const [isGeneratingPuzzles, setIsGeneratingPuzzles] = React.useState(false);
  const [generateConfirmOpen, setGenerateConfirmOpen] = React.useState(false);
  const [preserveEditedPagesOnGenerate, setPreserveEditedPagesOnGenerate] = React.useState(true);

  // Collapsed/expanded sidebar state
  const [collapsed, setCollapsed] = React.useState(false);
  const [settingsPanel, setSettingsPanel] = usePersistedState<'layout' | 'document'>(
    SETTINGS_PANEL_STORAGE_KEY,
    'layout',
    { debounceMs: 300 }
  );
  // Persist active settings tab across tab switches and page refresh
  const [activeTab, setActiveTab] = usePersistedState<string>(
    SETTINGS_TAB_STORAGE_KEY,
    'book',
    { debounceMs: 300 }
  );

  React.useEffect(() => {
    const panel = normalizeSettingsPanel(settingsPanel);
    const tab = normalizeSettingsTab(activeTab, panel, moduleIsWordSearch);
    if (panel !== settingsPanel) setSettingsPanel(panel);
    if (tab !== activeTab) setActiveTab(tab);
    // One-time normalize of persisted legacy tab ids + when switching doc types
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [moduleIsWordSearch]);

  // Chrome Extension Integration for AI Word Generation
  const { generateWords: generateWordsFromExtension, isLoading: isGeneratingWords, data: generatedWordsData, error: generationError } = useWordGeneration();

  const handlePanelChange = (panel: 'layout' | 'document') => {
    setSettingsPanel(panel);
    setActiveTab(normalizeSettingsTab(activeTab, panel, moduleIsWordSearch));
    setCollapsed(false);
  };

  const handleTabChange = (value: string) => {
    setActiveTab(value);
    setSettingsPanel(normalizeSettingsPanel(value));
    setCollapsed(false);
  };

  const handleTriggerClick = (value: string) => {
    // If user clicks the already-active tab, toggle collapse/expand
    if (activeTab === value) {
      setCollapsed((prev) => !prev);
    }
    // Otherwise do nothing here; onValueChange will fire and open the panel
  };

  const handleTriggerPointerDown = (e: React.PointerEvent, value: string) => {
    // pointerdown fires before Radix's onValueChange; use it to detect clicks on the
    // currently-active tab and toggle collapse without letting Radix re-select.
    if (activeTab === value) {
      e.preventDefault();
      setCollapsed((prev) => !prev);
    }
  };

  // Handle generated words - update the word list when words are received from extension
  React.useEffect(() => {
    if (generatedWordsData && generatedWordsData.words) {
      // Extract all words from the structured response
      const allWords: string[] = [];
      generatedWordsData.words.forEach((item: any) => {
        if (item.words && Array.isArray(item.words)) {
          allWords.push(...item.words);
        }
      });
      
      if (allWords.length > 0) {
        console.log('[WordSearchSidebar] Updated word list with', allWords.length, 'words');
        setTitleWords({ ...titleWords, words: allWords });
      }
    }
  }, [generatedWordsData, titleWords, setTitleWords]);

  const { bookCanvas, core, typography, wordList, colors } = wordSearchSettings;

  const updateBookCanvas = React.useCallback(
    (updates: Partial<typeof bookCanvas>) => {
      updateWordSearchSettings({ bookCanvas: { ...bookCanvas, ...updates } });
    },
    [bookCanvas, updateWordSearchSettings]
  );

  const applyCustomTrimLayout = React.useCallback(
    (width: number, height: number) => {
      applyTrimSizeLayoutChange(
        { useCustomTrim: true, customWidth: width, customHeight: height },
        { width, height }
      );
    },
    [applyTrimSizeLayoutChange]
  );

  const updateCore = React.useCallback(
    (updates: Partial<typeof core>) => {
      updateWordSearchSettings({ core: { ...core, ...updates } });
    },
    [core, updateWordSearchSettings]
  );

  const updateTypography = React.useCallback(
    (updates: Partial<typeof typography>) => {
      updateWordSearchSettings({ typography: { ...typography, ...updates } });
    },
    [typography, updateWordSearchSettings]
  );

  const updateWordListSettings = React.useCallback(
    (updates: Partial<typeof wordList>) => {
      updateWordSearchSettings({ wordList: { ...wordList, ...updates } });
    },
    [wordList, updateWordSearchSettings]
  );

  const customTitleLines = React.useMemo(() => {
    if (typography.selectTitleOption !== 'custom') return 0;
    return typography.titleText
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0).length;
  }, [typography.selectTitleOption, typography.titleText]);

  const missingCustomTitles = Math.max(0, (core.numberOfPuzzles || 0) - customTitleLines);

  const gridMaxWordLength = Math.max(core.lettersAcross || 0, core.lettersDown || 0, 3);

  React.useEffect(() => {
    if (wordList.aiMaxWordLength > gridMaxWordLength) {
      updateWordListSettings({ aiMaxWordLength: gridMaxWordLength });
    }
  }, [core.lettersAcross, core.lettersDown, gridMaxWordLength, updateWordListSettings, wordList.aiMaxWordLength]);

  const updateColors = React.useCallback(
    (updates: Partial<typeof colors>) => {
      updateWordSearchSettings({ colors: { ...colors, ...updates } });
    },
    [colors, updateWordSearchSettings]
  );

  const defaultsInitialized = React.useRef(false);

  React.useEffect(() => {
    if (defaultsInitialized.current) return;

    const trimDefaults = bookCanvas.trimSizePreset === '8_5X11IN' && bookCanvas.useCustomTrim === false;
    const titleDefaults = typography.selectTitleOption === 'custom';
    const numberingDefaults = typography.puzzleNumberingStyle === 'prefix';

    if (!trimDefaults) {
      updateBookCanvas({ trimSizePreset: '8_5X11IN', customWidth: 8.5, customHeight: 11, useCustomTrim: false });
    }

    if (!titleDefaults) {
      updateTypography({ selectTitleOption: 'custom' });
    }

    if (!numberingDefaults) {
      updateTypography({ puzzleNumberingStyle: 'prefix' });
    }

    defaultsInitialized.current = true;
  }, [bookCanvas.trimSizePreset, bookCanvas.useCustomTrim, typography.selectTitleOption, typography.puzzleNumberingStyle, updateBookCanvas, updateTypography]);

  // If the AI-generated theme changes, update the titleText only when the
  // current mode is already `custom`. This preserves explicit user choices
  // for `one-custom-title` and `none`.
  React.useEffect(() => {
    if (!wordList.aiTheme) return;
    if (typography.selectTitleOption === 'custom' && typography.titleText !== wordList.aiTheme) {
      updateTypography({ titleText: wordList.aiTheme });
    }
  }, [wordList.aiTheme, typography.selectTitleOption, typography.titleText, updateTypography]);

  const updatePuzzlePageColors = (updates: Partial<typeof colors.puzzlePage>) => {
    updateColors({
      puzzlePage: { ...colors.puzzlePage, ...updates },
    });
  };

  const headerAssembly = normalizeHeaderAssemblySettings(colors.puzzlePage.headerAssembly);

  const pageNumber = normalizePageNumberSettings(typography.pageNumber);

  const updatePageNumber = (updates: Partial<PageNumberSettings>) => {
    updateTypography({
      pageNumber: normalizePageNumberSettings({ ...pageNumber, ...updates }),
    });
  };

  const updateHeaderAssembly = (updates: Partial<HeaderAssemblySettings>) => {
    updatePuzzlePageColors({
      headerAssembly: normalizeHeaderAssemblySettings({ ...headerAssembly, ...updates }),
    });
  };

  const updateAnswerPageColors = (updates: Partial<typeof colors.answerPage>) => {
    updateColors({
      answerPage: { ...colors.answerPage, ...updates },
    });
  };

  const pageFrame = resolvePageFrameSettings(wordSearchSettings);

  const updatePageFrameSettings = (updates: Parameters<typeof applyPageFrameSettingsPatch>[1]) => {
    updateWordSearchSettings(applyPageFrameSettingsPatch(wordSearchSettings, updates));
  };

  // Handle PASTE_DATA from extension - switch mode and inject formatted text
  React.useEffect(() => {
    const unsubscribe = onPasteData((formattedText: string) => {
      console.log('[WordSearchSidebar] Received PASTE_DATA with', formattedText.split('\n').length, 'lines');
      
      // Step 1: Switch to manual mode
      console.log('[WordSearchSidebar] Switching to manual word entry mode');
      updateWordListSettings({ selectWordListOption: 'manual' });
      
      // Step 2: Convert vertical format back to word array
      const words = formattedText
        .split('\n')
        .map(w => w.trim())
        .filter(w => w.length > 0);
      
      if (words.length > 0) {
        console.log('[WordSearchSidebar] Injecting', words.length, 'words into word list');
        
        // Step 3: Update titleWords with the pasted words
        setTitleWords({
          ...titleWords,
          words: words
        });
      }
    });

    return unsubscribe;
  }, [titleWords, setTitleWords, updateWordListSettings]);

  // Handle PASTE_FUN_FACTS from extension - inject fun facts into typography
  React.useEffect(() => {
    const unsubscribe = onPasteFunFacts((funFactsText: string) => {
      console.log('[WordSearchSidebar] Received PASTE_FUN_FACTS with', funFactsText.split('\n').length, 'facts');
      
      if (funFactsText && funFactsText.length > 0) {
        console.log('[WordSearchSidebar] Injecting fun facts into funFactsText');
        
        updateTypography({
          includeFunFacts: true,
          funFactsText: funFactsText
        });
      }
    });

    return unsubscribe;
  }, [updateTypography]);

  const handleSave = () => {
    const name = `${titleWords.title || 'word-search'} - ${new Date().toLocaleDateString()}`;
    savePuzzle(name);
  };

  // Handler for AI word generation from extension
  // Track if a generation is already in progress to prevent double calls
  const isGenerationInProgress = React.useRef(false);
  
  // SPEC 1: State for inline theme validation error messages
  const [themeError, setThemeError] = useState("");
  const [showExtensionMissingPrompt, setShowExtensionMissingPrompt] = useState(false);

  // SPEC 1: computeThemeValidation remains for informational purposes only (do not auto-apply error state)
  const computeThemeValidation = React.useMemo(() => {
    if (!wordList.aiTheme.trim()) {
      return { enteredThemesCount: 0, requiredPuzzles: 0, isDisabled: true, errorMsg: "" };
    }

    const enteredThemesCount = wordList.aiTheme
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0).length;
    
    const requiredPuzzles = (core && core.numberOfPuzzles) ? core.numberOfPuzzles : 0;
    
    const isDisabled = enteredThemesCount < requiredPuzzles;
    const errorMsg = isDisabled 
      ? `Need ${requiredPuzzles - enteredThemesCount} more theme(s)` 
      : "";
    
    return { enteredThemesCount, requiredPuzzles, isDisabled, errorMsg };
  }, [wordList.aiTheme, core]);

  // Restore live themeError from computeThemeValidation so the alert appears under the button
  React.useEffect(() => {
    if (themeError === "Ready" && !computeThemeValidation.errorMsg) {
      return;
    }
    setThemeError(computeThemeValidation.errorMsg);
  }, [computeThemeValidation.errorMsg, themeError]);

  // Poll for extension availability and hide missing prompt when installed
  React.useEffect(() => {
    let mounted = true;
    let interval = setInterval(async () => {
      try {
        const available = await isExtensionAvailable();
        if (mounted && available) {
          setShowExtensionMissingPrompt(false);
          clearInterval(interval);
        }
      } catch (e) {
        // ignore
      }
    }, 2000);

    // also check immediately once
    (async () => {
      try {
        const available = await isExtensionAvailable();
        if (mounted && available) {
          setShowExtensionMissingPrompt(false);
          clearInterval(interval);
        }
      } catch {}
    })();

    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  React.useEffect(() => {
    const handleSuccess = () => {
      setThemeError("Ready");
      setIsGeneratingWordsFromExtension(false);
      isGenerationInProgress.current = false;
      console.log('[WordSearchSidebar] EXTENSION_GENERATION_SUCCESS received; local state reset.');
    };

    window.addEventListener("EXTENSION_GENERATION_SUCCESS", handleSuccess);
    return () => window.removeEventListener("EXTENSION_GENERATION_SUCCESS", handleSuccess);
  }, []);

  /**
   * REQUIREMENT 4: Parse words from both horizontal and vertical formats
   * Detects format automatically:
   * - Horizontal: "Word, word, word, word..."
   * - Vertical: "Word\nWord\nWord..."
   */
  const parseWordListFromBothFormats = (value: string): string[] => {
    if (!value || value.trim().length === 0) return [];
    
    // Check if content contains commas (horizontal format indicator)
    if (value.includes(',')) {
      // Horizontal format: split by commas
      const words = value
        .split(',')
        .map(w => w.trim())
        .filter(w => w.length > 0);
      console.log('[WordSearchSidebar] Parsed horizontal format:', words.length, 'words');
      return words;
    } else {
      // Vertical format: split by newlines
      const words = value
        .split('\n')
        .map(w => w.trim())
        .filter(w => w.length > 0);
      console.log('[WordSearchSidebar] Parsed vertical format:', words.length, 'words');
      return words;
    }
  };

  // Theme history management - tracks submitted themes to prevent repetition
  const getThemeHistory = (): string[] => {
    if (typeof window === 'undefined') return [];
    try {
      const stored = localStorage.getItem('genpuzzle_theme_history');
      return stored ? JSON.parse(stored) : [];
    } catch (e) {
      console.warn('[WordSearchSidebar] Failed to load theme history:', e);
      return [];
    }
  };

  const addThemesToHistory = (themes: string[]): void => {
    if (typeof window === 'undefined' || themes.length === 0) return;
    try {
      const existing = getThemeHistory();
      const combined = [...themes, ...existing];
      // Keep only unique themes, limited to 500
      const unique = Array.from(new Set(combined)).slice(0, 500);
      localStorage.setItem('genpuzzle_theme_history', JSON.stringify(unique));
    } catch (e) {
      console.warn('[WordSearchSidebar] Failed to save theme history:', e);
    }
  };

  const getSubmittedThemesExamples = (numberOfPuzzles: number): string => {
    const history = getThemeHistory();
    const toInclude = Math.min(numberOfPuzzles, history.length);
    
    if (toInclude === 0) return '';
    
    const examples = history.slice(0, toInclude);
    return `\n### PREVIOUSLY SUBMITTED THEMES (DO NOT REPEAT - Use only as reference for niche/style):
${examples.map((t, i) => `- ${t}`).join('\n')}`;
  };

  const handleGenerateWordsFromAI = async () => {
    // STRICT DOM-BASED PRE-SUBMISSION VALIDATION (run immediately at handler start)
    // Extract values directly from DOM elements to ensure accurate submission criteria
    console.log('[WordSearchSidebar] Starting DOM-based pre-submission validation...');

    // Pre-check: if GenPuzzle extension is not available, show download prompt
    try {
      const available = await isExtensionAvailable();
      if (!available) {
        console.warn('[WordSearchSidebar] GenPuzzle extension not available - showing download prompt');
        setShowExtensionMissingPrompt(true);
        setIsGeneratingWordsFromExtension(false);
        isGenerationInProgress.current = false;
        return;
      }
      // Hide prompt if it was previously shown
      if (showExtensionMissingPrompt) setShowExtensionMissingPrompt(false);
    } catch (e) {
      console.warn('[WordSearchSidebar] Error checking extension availability', e);
    }

    // Step 1: Use the current app state instead of DOM selectors
    const requiredPuzzles = core?.numberOfPuzzles || 0;
    console.log('[WordSearchSidebar] Required puzzles from state:', requiredPuzzles);

    // Step 2: Parse themes array count from current theme textarea state
    const enteredThemesCount = wordList.aiTheme
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0).length;
    console.log('[WordSearchSidebar] Entered themes count from state:', enteredThemesCount);

    // Rule Matrix: If insufficient themes, set error and ABORT immediately (do not modify other state)
    if (enteredThemesCount < requiredPuzzles) {
      const missingCount = requiredPuzzles - enteredThemesCount;
      console.error('[WordSearchSidebar] ❌ VALIDATION FAILED: Insufficient themes');
      setThemeError('Need ' + missingCount + ' more themes');
      return; // STRICT ABORT — do not proceed further
    }

    // Passed validation — clear any previous error
    setThemeError('');

    // Guard against double-calls from rapid clicks or React re-renders
    if (isGenerationInProgress.current) {
      console.warn('[WordSearchSidebar] Generation already in progress, ignoring duplicate call');
      return;
    }

    // CRITICAL: Ensure all required state objects are initialized before proceeding
    if (!wordSearchSettings || !wordList || !core) {
      console.error('[WordSearchSidebar] INITIALIZATION ERROR: State objects not ready', { 
        hasWordSearchSettings: !!wordSearchSettings,
        hasWordList: !!wordList,
        hasCore: !!core 
      });
      alert('Settings not yet loaded. Please wait a moment and try again.');
      return;
    }

    if (!wordList.aiTheme || !wordList.aiTheme.trim()) {
      alert('Please enter a theme for word generation');
      return;
    }

    try {
      // Mark generation as in progress BEFORE any async operations
      isGenerationInProgress.current = true;
      setIsGeneratingWordsFromExtension(true);
      
      // REQUIREMENT 1: Immediately switch Word Source from 'ai' to 'manual'
      // This happens before the extension navigates to Gemini
      console.log('[WordSearchSidebar] Switching Word Source to manual mode');
      updateWordListSettings({ selectWordListOption: 'manual' });
      
      // Enable "Add Fun Facts / Quotes" checkbox so fun facts will be populated automatically
      console.log('[WordSearchSidebar] Enabling Add Fun Facts / Quotes');
      updateTypography({ includeFunFacts: true });

      // Grab all live state variables right at click time with defensive null checks and fallbacks
      // This prevents undefined values from appearing in the prompt sent to Gemini
      const numberOfPuzzles = (core && core.numberOfPuzzles) ? Math.max(1, core.numberOfPuzzles) : 10;
      const wordsPerPuzzle = (wordList && wordList.wordsPerPuzzle) ? Math.max(1, wordList.wordsPerPuzzle) : 10;
      const maxLength = (wordList && wordList.aiMaxWordLength) ? Math.max(1, wordList.aiMaxWordLength) : 15;
      const caseValue = (wordList && wordList.wordListCase) ? wordList.wordListCase : 'mixed';
      const charCase = caseValue === 'upper' ? 'UPPERCASE' : caseValue === 'lower' ? 'lowercase' : 'mixed case';
      const ageLevel = (wordList && wordList.aiAgeLevel) ? wordList.aiAgeLevel : 'Adult';
      const language = (wordList && wordList.aiLanguage) ? wordList.aiLanguage : 'English';
      const theme = (wordList && wordList.aiTheme) ? wordList.aiTheme.trim() : 'General Theme';

      // STRICT VALIDATION: Ensure no variable is undefined, null, empty, or the string "undefined"
      // This is critical to prevent "undefined" from being injected into Gemini
      const validationErrors: string[] = [];
      
      if (!numberOfPuzzles || numberOfPuzzles <= 0) {
        validationErrors.push('numberOfPuzzles must be a positive number');
      }
      if (!wordsPerPuzzle || wordsPerPuzzle <= 0) {
        validationErrors.push('wordsPerPuzzle must be a positive number');
      }
      if (!maxLength || maxLength <= 0) {
        validationErrors.push('maxLength must be a positive number');
      }
      if (!charCase || charCase === 'undefined') {
        validationErrors.push('charCase is invalid');
      }
      if (!ageLevel || ageLevel === 'undefined') {
        validationErrors.push('ageLevel is invalid');
      }
      if (!language || language === 'undefined') {
        validationErrors.push('language is invalid');
      }
      if (!theme || theme === 'undefined') {
        validationErrors.push('theme is invalid or empty');
      }
      
      if (validationErrors.length > 0) {
        throw new Error('Validation failed: ' + validationErrors.join(', '));
      }

      // AUTO-LIMIT: Extract only the first N themes (where N = numberOfPuzzles)
      // If user submitted 100 themes but selected 50 puzzles, use only the first 50
      const allThemes = theme
        .split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0);
      
      const limitedThemes = allThemes.slice(0, numberOfPuzzles);
      const finalTheme = limitedThemes.join('\n');
      
      console.log('[WordSearchSidebar] Theme limiting: extracted', allThemes.length, 'themes, using first', limitedThemes.length, 'for', numberOfPuzzles, 'puzzles');

      // Build strict, anti-hallucination prompt with explicit rules
      // Ensure all variables are stringified and checked for "undefined"
      const dynamicPrompt = `Generate ${String(numberOfPuzzles)} word lists for the themes below. Each list must contain exactly ${String(wordsPerPuzzle)} words. Write one fun fact per theme (90–95 characters each).

    Word Constraints: Max ${String(maxLength)} letters, ${String(charCase)}. Unique, non-duplicated words. No numbers allowed in the word lists (words must not contain digits).
    Target Audience: ${String(ageLevel)}.
    Language: ${String(language)}.
    Multi-word Rule: Make sure to add space between words when we have 2 words based.

    ### ALPHABETICAL SORTING (REQUIRED):
    - Sort every word list A to Z before you output it.
    - Use standard alphabetical order (A, B, C … Z). For multi-word entries, sort by the first word.
    - Do NOT leave words in random or theme-logic order — the final list must read alphabetically from first word to last.
    - Keep the 1., 2., 3. numbering in the output, but the words themselves must follow A–Z order (word #1 is the first alphabetically, word #2 is the second, and so on).

    ### THEMES TO GENERATE:
    ${finalTheme}

    ### CRITICAL RULES:
    1. Do NOT reuse, copy, or repeat any words or titles shown in previously submitted themes or example format section below.
    2. Every single puzzle must have a completely unique, new title and a brand new list of words based strictly on the themes listed in "THEMES TO GENERATE" section above.
    3. Output ONLY the raw puzzle data. No chat, no markdown formatting like ** or bolding, and no part numbers.
    4. No numbers allowed in the words lists — words must contain only alphabetic characters (remove any entries that include digits).
    5. Every word list MUST be sorted alphabetically (A–Z) before output. Double-check the order before submitting.

    Follow these constraints:

    No Duplicates: Keep a running list of ALL words used across all previous puzzle themes in this session. You are strictly forbidden from reusing any word that has already appeared in a previous puzzle.

    Contextual Uniqueness: For each theme listed in THEMES TO GENERATE above, select ${String(wordsPerPuzzle)} words that represent that theme AND have never been used in any other puzzle.

    Verification: Before outputting the final list, verify the new words against the 'Used Words List'. If a conflict is found, generate a fresh word that fits the theme. Then re-sort the list A–Z.

    Output: Provide the alphabetically sorted list of words for the current theme, and update the internal 'Used Words List' for future puzzles.

    ### EXCLUSIVE OUTPUT FORMAT (Follow this structure exactly):
    -Theme 1 Title

    1.word, 2.word, 3.word, 4.word, 5.word, ...  (words in A–Z order)

    -Fun fact: write fun fact here

    -Theme 2 Title

    1.word, 2.word, 3.word, 4.word, 5.word, ...  (words in A–Z order)

    -Fun fact: write fun fact here

    -Theme 3 Title

    1.word, 2.word, 3.word, 4.word, 5.word, ...  (words in A–Z order)

    -Fun fact: write fun fact here`
    ;
    

      // Final safeguard: verify the prompt does not contain the string "undefined"
      if (dynamicPrompt.includes('undefined')) {
        throw new Error('CRITICAL: Prompt contains the string "undefined" - this will break Gemini injection. Check state variables.');
      }

      console.log('[WordSearchSidebar] Queueing prompt in extension...', { numberOfPuzzles, wordsPerPuzzle, maxLength, charCase, ageLevel, language, finalTheme });

      // Step 1: Queue the prompt in the extension FIRST
      const queueResponse = await queuePrompt({
        prompt: dynamicPrompt,
        provider: 'gemini',
      });

      if (!queueResponse.success) {
        throw new Error(queueResponse.error || 'Failed to queue prompt');
      }

      console.log('[WordSearchSidebar] Prompt queued successfully, requestId:', queueResponse.requestId);

      // Step 2: Set up listener for this specific request ID BEFORE opening tab
      // This ensures we catch the response when it comes back from the extension
      let responseReceived = false;
      const responseListener = (message: any) => {
        if (
          !responseReceived &&
          message?.type === "RESPONSE_RECEIVED" &&
          message?.requestId === queueResponse.requestId &&
          (message?.action === "GENERATE_WORDS" || message?.action === "GENERATE_CONTENT") &&
          message?.dataType === "text"
        ) {
          responseReceived = true;
          console.log('[WordSearchSidebar] Received response for requestId:', queueResponse.requestId, message);
          
          // Extract words and update state
          if (message.words && message.words.length > 0) {
            const allWords: string[] = [];
            const submittedThemes: string[] = [];
            
            message.words.forEach((item: any) => {
              if (item.words && Array.isArray(item.words)) {
                allWords.push(...item.words);
              }
              // Track the theme for history
              if (item.theme) {
                submittedThemes.push(item.theme);
              }
            });
            
            // Save submitted themes to history for future prompts
            if (submittedThemes.length > 0) {
              addThemesToHistory(submittedThemes);
              console.log('[WordSearchSidebar] Added', submittedThemes.length, 'themes to history');
            }
            
            if (allWords.length > 0) {
              console.log('[WordSearchSidebar] Updated word list with', allWords.length, 'words');
              setTitleWords({ ...titleWords, words: allWords });
            }
          }
          
          // Clean up listener and reset generation guard
          if (typeof chrome !== 'undefined' && chrome?.runtime?.onMessage) {
            chrome.runtime.onMessage.removeListener(responseListener);
          }
          
          setIsGeneratingWordsFromExtension(false);
          isGenerationInProgress.current = false; // IMPORTANT: Reset guard after response
          
          // Clear the "Ready" message after 2 seconds so user can generate again
          setTimeout(() => {
            setThemeError('');
          }, 2000);
        }
      };

      // Add listener using chrome API if available
      if (typeof chrome !== 'undefined' && chrome?.runtime?.onMessage) {
        chrome.runtime.onMessage.addListener(responseListener);
      }

      // Step 3: Tab is already opened via queuePrompt -> chrome.tabs.create()
      // Do NOT call window.open() - that would create duplicate tabs
      // The tab is automatically created and waits for content.js injection
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      console.error('[WordSearchSidebar] Failed to generate words:', errorMessage);
      alert(`Failed to generate words: ${errorMessage}`);
      setIsGeneratingWordsFromExtension(false);
      isGenerationInProgress.current = false; // IMPORTANT: Reset guard on error
    }
  };

  const requiredWords = core.numberOfPuzzles * wordList.wordsPerPuzzle;
  const wordCount = titleWords.words.length;
  const activeDocumentPuzzleCount = core.numberOfPuzzles || 1;
  const activeDocumentHasPuzzles = batchPuzzles.some(
    (puzzle) => puzzle.pageId === activeDocumentPageId
  );
  const hasWordList = wordCount > 0;
  const generationFingerprint = useMemo(
    () => computeWordSearchGenerationFingerprint(wordSearchSettings, titleWords),
    [wordSearchSettings, titleWords]
  );

  const [syncedFingerprintsByDoc, setSyncedFingerprintsByDoc] = useState<Record<string, string>>({});
  const generationSnapshotRef = useRef({
    pageId: activeDocumentPageId,
    fingerprint: generationFingerprint,
  });
  generationSnapshotRef.current = {
    pageId: activeDocumentPageId,
    fingerprint: generationFingerprint,
  };

  useEffect(() => {
    if (!activeDocumentHasPuzzles) return;
    setSyncedFingerprintsByDoc((prev) => {
      if (prev[activeDocumentPageId]) return prev;
      return { ...prev, [activeDocumentPageId]: generationFingerprint };
    });
  }, [activeDocumentPageId, activeDocumentHasPuzzles, generationFingerprint]);

  useEffect(() => {
    const { pageId, fingerprint } = generationSnapshotRef.current;
    setSyncedFingerprintsByDoc((prev) => ({
      ...prev,
      [pageId]: fingerprint,
    }));
  }, [puzzleGenerationVersion]);

  const syncedFingerprint = syncedFingerprintsByDoc[activeDocumentPageId];
  const needsRegeneration =
    activeDocumentHasPuzzles &&
    syncedFingerprint !== undefined &&
    syncedFingerprint !== generationFingerprint;

  // First generate: need a word list. Update: only after grid size / word list / directions change.
  const isGenerateLocked = activeDocumentHasPuzzles
    ? !needsRegeneration
    : !hasWordList;

  const shouldPulseGenerate =
    !isGenerateLocked &&
    !isGeneratingPuzzles &&
    ((!activeDocumentHasPuzzles && hasWordList) || needsRegeneration);

  const generatePuzzlesLabel = activeDocumentHasPuzzles
    ? `Update the ${activeDocumentPuzzleCount} ${activeDocumentPuzzleCount === 1 ? 'puzzle' : 'puzzles'}`
    : `Generate the ${activeDocumentPuzzleCount} ${activeDocumentPuzzleCount === 1 ? 'puzzle' : 'puzzles'}`;

  const generateButtonTitle = isGeneratingPuzzles
    ? 'Generating…'
    : isGenerateLocked
      ? activeDocumentHasPuzzles
        ? 'Change grid size, word list, or directions to enable update'
        : 'Add a word list to enable puzzle generation'
      : generatePuzzlesLabel;

  const editedPageIndicesInDocument = useMemo(
    () =>
      getEditedBatchIndicesForDocument(
        wordSearchSettings,
        puzzleGridScale,
        pageOverrides,
        pagePuzzleGridScales,
        batchPuzzles,
        activeDocumentPageId
      ),
    [
      wordSearchSettings,
      puzzleGridScale,
      pageOverrides,
      pagePuzzleGridScales,
      batchPuzzles,
      activeDocumentPageId,
    ]
  );

  const runGeneratePuzzles = async (options?: GeneratePuzzleOptions) => {
    setIsGeneratingPuzzles(true);
    await new Promise((resolve) => setTimeout(resolve, 400));
    try {
      generatePuzzle(options);
    } finally {
      setIsGeneratingPuzzles(false);
    }
  };

  const handleGeneratePuzzles = async () => {
    if (isGenerateLocked || isGeneratingPuzzles) return;
    if (activeDocumentHasPuzzles && editedPageIndicesInDocument.length > 0) {
      setPreserveEditedPagesOnGenerate(true);
      setGenerateConfirmOpen(true);
      return;
    }
    await runGeneratePuzzles();
  };

  const handleGenerateConfirm = async () => {
    setGenerateConfirmOpen(false);
    const options: GeneratePuzzleOptions = preserveEditedPagesOnGenerate
      ? { preserveEditedPageIndices: editedPageIndicesInDocument }
      : { clearPageCustomizations: true };
    await runGeneratePuzzles(options);
  };

  return (
    <div className={`word-search-sidebar relative transition-all duration-300 h-full bg-gradient-to-b from-slate-50 to-white dark:from-slate-950 dark:to-slate-900 border-r border-gray-200 dark:border-slate-800 flex flex-col shadow-lg overflow-visible max-lg:w-full ${
      collapsed ? 'w-28' : 'w-96'
    }`}>
      {/* Edge-centre minimal collapse arrow — explicit inline SVG to avoid style overrides */}
      <button
        aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        onClick={() => setCollapsed((c) => !c)}
        className="absolute top-1/2 -right-2 z-50 flex items-center justify-center p-0 m-0 rounded-sm opacity-20 transition duration-100 hover:opacity-80 hover:scale-110"
        style={{
          transform: 'translateY(-50%)',
          width: 20,
          height: 22,
          background: '#e8ecf0',
          border: '1px solid #9ca3af',
          boxShadow: '0 0 0 1px rgba(0,0,0,0.12)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 0,
        }}
      >
        <div
          style={{
            width: 0,
            height: 0,
            borderTop: '4px solid transparent',
            borderBottom: '4px solid transparent',
            borderLeft: collapsed ? '8px solid #000' : '0 solid transparent',
            borderRight: collapsed ? '0 solid transparent' : '8px solid #000',
          }}
        />
      </button>
      <style>{`
        /* Modern tab styling — scoped to sidebar only */
        .word-search-sidebar [role="tablist"] {
          display: flex;
          flex-direction: column;
          justify-content: flex-start;
          gap: 2rem;
          padding: 8px;
          background: transparent;
          border-right: 2px solid rgba(226, 232, 240, 0.8);
        }
        
        .word-search-sidebar button[role="tab"] {
          flex: 0;
          width: 4.25rem;
          min-height: 4.25rem;
          height: auto;
          min-width: auto;
          padding: 0.5rem 0;
          border-radius: 0; /* square corners */
          font-weight: 500;
          transition: all 200ms ease-out;
          border: 2px solid transparent;
          background: white;
          color: #64748b;
          box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
          display: inline-flex;
          align-items: center;
          justify-content: center;
          flex-direction: column;
        }
        
        .word-search-sidebar button[role="tab"]:hover {
          background: var(--gp-grey-100);
          color: var(--gp-blue);
          box-shadow: 0 4px 12px rgba(26, 90, 140, 0.12);
          transform: translateY(-1px);
        }
        
        .word-search-sidebar button[role="tab"][data-state="active"] {
          background: var(--gp-white);
          color: var(--gp-blue);
          border-color: var(--gp-grey-200);
          box-shadow: 0 4px 12px rgba(26, 90, 140, 0.15);
        }

        /* Icon and accent animations */
        .word-search-sidebar button[role="tab"] svg { transition: transform 260ms cubic-bezier(.2,.9,.2,1), opacity 180ms ease; transform-origin: center center; display: block; margin: 0 auto; }
        .word-search-sidebar button[role="tab"]:hover svg { transform: scale(1.03); }
        .word-search-sidebar button[role="tab"][data-state="active"] svg { transform: scale(1.08); }

        .word-search-sidebar button[role="tab"] svg .icon-accent { opacity: 0; transform-origin: center; transition: opacity 240ms ease, transform 320ms cubic-bezier(.2,.9,.2,1); }
        .word-search-sidebar button[role="tab"][data-state="active"] svg .icon-accent { opacity: 1; transform: scale(1.06); animation: gp-pulse 1.6s ease-in-out infinite; }

        @keyframes gp-pulse {
          0% { transform: scale(1); }
          50% { transform: scale(1.08); }
          100% { transform: scale(1); }
        }

        .word-search-sidebar [role="tabpanel"] {
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

        .word-search-sidebar .sidebar-generate-wrap {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 0.3rem;
          flex-shrink: 0;
          width: 3.5rem;
        }

        .word-search-sidebar .sidebar-generate-btn {
          flex: 0;
          width: 3.5rem;
          min-height: 3.5rem;
          height: auto;
          min-width: auto;
          padding: 0.4rem 0;
          border-radius: 0.5rem;
          font-weight: 500;
          transition: all 200ms ease-out;
          border: 2px solid var(--gp-blue, #1a5a8c);
          background: var(--gp-blue, #1a5a8c);
          color: #ffffff;
          box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
          display: inline-flex;
          align-items: center;
          justify-content: center;
          flex-direction: column;
          cursor: pointer;
        }

        .word-search-sidebar .sidebar-generate-btn svg {
          display: block;
          margin: 0 auto;
          color: #ffffff;
          stroke: #ffffff;
          transition: transform 260ms cubic-bezier(.2,.9,.2,1), opacity 180ms ease;
          transform-origin: center center;
        }

        .word-search-sidebar .sidebar-generate-btn:hover:not(:disabled) svg {
          transform: scale(1.03);
        }

        .word-search-sidebar .sidebar-generate-btn:hover:not(:disabled) {
          background: var(--gp-blue-dark, #144a75);
          border-color: var(--gp-blue-dark, #144a75);
          box-shadow: 0 4px 12px rgba(26, 90, 140, 0.25);
          transform: translateY(-1px);
        }

        .word-search-sidebar .sidebar-generate-btn:disabled {
          opacity: 0.45;
          cursor: not-allowed;
          background: #94a3b8;
          border-color: #94a3b8;
        }

        .word-search-sidebar .sidebar-generate-btn--pulse {
          animation: sidebar-generate-pulse 1.4s ease-in-out infinite;
        }

        @keyframes sidebar-generate-pulse {
          0%, 100% {
            transform: scale(1);
            box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
          }
          50% {
            transform: scale(1.1);
            box-shadow: 0 6px 16px rgba(26, 90, 140, 0.35);
          }
        }

        .word-search-sidebar .sidebar-generate-caption {
          margin: 0;
          padding: 0;
          font-size: 13px;
          font-weight: 600;
          line-height: 1.35;
          letter-spacing: 0;
          text-align: center;
          color: #64748b;
          max-width: 4rem;
        }

        .word-search-sidebar .direction-toggle {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 100%;
          height: 2.5rem;
          min-height: 2.5rem !important;
          min-width: 0 !important;
          padding: 0 !important;
          border-radius: 0.5rem;
          border: 2px solid #e2e8f0;
          background: #ffffff !important;
          color: #0f172a !important;
          box-shadow: 0 1px 2px rgba(15, 23, 42, 0.06);
          transition: all 200ms ease-out;
          cursor: pointer;
        }

        .word-search-sidebar .direction-toggle:hover:not(.direction-toggle--active) {
          border-color: #cbd5e1;
          background: #f8fafc !important;
        }

        .word-search-sidebar .direction-toggle--active {
          border-color: var(--gp-blue, #1a5a8c) !important;
          background: linear-gradient(
            180deg,
            var(--gp-blue-light, #2276b4) 0%,
            var(--gp-blue, #1a5a8c) 100%
          ) !important;
          color: #ffffff !important;
          box-shadow:
            0 0 0 2px rgba(34, 118, 180, 0.2),
            0 0 16px rgba(34, 118, 180, 0.55),
            0 2px 6px rgba(26, 90, 140, 0.35);
        }

        .word-search-sidebar .direction-toggle--active:hover {
          box-shadow:
            0 0 0 2px rgba(34, 118, 180, 0.3),
            0 0 20px rgba(34, 118, 180, 0.65),
            0 2px 8px rgba(26, 90, 140, 0.4);
        }

        .word-search-sidebar .direction-toggle svg {
          width: 1.25rem;
          height: 1.25rem;
          stroke-width: 2.25;
        }

        .word-search-sidebar .direction-toggle--active svg {
          color: #ffffff;
          stroke: #ffffff;
          filter: drop-shadow(0 0 2px rgba(255, 255, 255, 0.35));
        }

        .word-search-sidebar .direction-toggle:not(.direction-toggle--active) svg {
          color: #0f172a;
          stroke: #0f172a;
        }
      `}</style>

      <Tabs value={activeTab} orientation="vertical" className="w-full flex-1 flex min-h-0" onValueChange={handleTabChange}>
        <TabsList className="flex h-auto flex-col w-[6.5rem] gap-2 bg-transparent shrink-0 px-1">
          {/* ── Panel A: book-wide layout ── */}
          <div className="w-full space-y-1.5 pb-2 border-b border-gray-200 dark:border-slate-700">
            <button
              type="button"
              onClick={() => handlePanelChange('layout')}
              className={cn(
                'w-full rounded-lg px-1.5 py-1.5 text-left transition-colors',
                settingsPanel === 'layout'
                  ? 'bg-sky-50 dark:bg-sky-950/40 ring-1 ring-sky-300/60 dark:ring-sky-700/50'
                  : 'hover:bg-gray-50 dark:hover:bg-slate-800/60'
              )}
              title="Page layout for all document tabs"
            >
              <p className="text-[10px] font-bold uppercase tracking-wide text-sky-700 dark:text-sky-300 leading-tight">
                Layout
              </p>
              <p className="text-[9px] text-muted-foreground leading-tight mt-0.5">
                All tabs
              </p>
            </button>
            <div
              className={cn(
                'flex flex-col gap-1.5 transition-opacity',
                settingsPanel !== 'layout' && 'opacity-40'
              )}
            >
              <TabsTrigger
                value="book"
                title="Trim size & page layout"
                className="transition-all duration-200 w-full"
                onPointerDown={(e) => {
                  setSettingsPanel('layout');
                  handleTriggerPointerDown(e, 'book');
                }}
              >
                <Book className="w-5 h-5" />
              </TabsTrigger>
              <TabsTrigger
                value="colors"
                title="Colors, background, frame, header & page numbers"
                className="transition-all duration-200 w-full"
                onPointerDown={(e) => {
                  setSettingsPanel('layout');
                  handleTriggerPointerDown(e, 'colors');
                }}
              >
                <Palette className="w-5 h-5" />
              </TabsTrigger>
              <TabsTrigger
                value="pages"
                title="Chapter pages for all puzzle documents"
                className="transition-all duration-200 w-full"
                onPointerDown={(e) => {
                  setSettingsPanel('layout');
                  handleTriggerPointerDown(e, 'pages');
                }}
              >
                <Sparkles className="w-5 h-5" />
              </TabsTrigger>
            </div>
          </div>

          {/* ── Panel B: current document ── */}
          <div className="w-full space-y-1.5 pt-1">
            <button
              type="button"
              onClick={() => handlePanelChange('document')}
              className={cn(
                'w-full rounded-lg px-1.5 py-1.5 text-left transition-colors',
                settingsPanel === 'document'
                  ? 'bg-sky-50 dark:bg-sky-950/40 ring-1 ring-sky-300/60 dark:ring-sky-700/50'
                  : 'hover:bg-gray-50 dark:hover:bg-slate-800/60'
              )}
              title="Settings for the current document tab"
            >
              <p className="text-[10px] font-bold uppercase tracking-wide text-sky-700 dark:text-sky-300 leading-tight">
                Document
              </p>
              <p className="text-[9px] text-muted-foreground leading-tight mt-0.5">
                This tab
              </p>
            </button>
            <div
              className={cn(
                'flex flex-col gap-1.5 transition-opacity',
                settingsPanel !== 'document' && 'opacity-40'
              )}
            >
              {moduleIsWordSearch ? (
                <>
              <TabsTrigger
                value="puzzle"
                title="Puzzle settings"
                className="transition-all duration-200 w-full"
                onPointerDown={(e) => {
                  setSettingsPanel('document');
                  handleTriggerPointerDown(e, 'puzzle');
                }}
              >
                <Grid3X3 className="w-5 h-5" />
              </TabsTrigger>
              <TabsTrigger
                value="words"
                title="Word list"
                className="transition-all duration-200 w-full"
                onPointerDown={(e) => {
                  setSettingsPanel('document');
                  handleTriggerPointerDown(e, 'words');
                }}
              >
                <List className="w-5 h-5" />
              </TabsTrigger>
              <TabsTrigger
                value="design"
                title="Puzzle titles"
                className="transition-all duration-200 w-full"
                onPointerDown={(e) => {
                  setSettingsPanel('document');
                  handleTriggerPointerDown(e, 'design');
                }}
              >
                <Type className="w-5 h-5" />
              </TabsTrigger>
                </>
              ) : (
              <TabsTrigger
                value="page"
                title="This page settings"
                className="transition-all duration-200 w-full"
                onPointerDown={(e) => {
                  setSettingsPanel('document');
                  handleTriggerPointerDown(e, 'page');
                }}
              >
                <Type className="w-5 h-5" />
              </TabsTrigger>
              )}
            </div>
          </div>

          {moduleIsWordSearch && (
          <div className="sidebar-generate-wrap mt-2">
            <button
              type="button"
              className={cn(
                'sidebar-generate-btn',
                shouldPulseGenerate && 'sidebar-generate-btn--pulse'
              )}
              onClick={handleGeneratePuzzles}
              disabled={isGenerateLocked || isGeneratingPuzzles}
              title={generateButtonTitle}
              aria-label={generateButtonTitle}
            >
              {activeDocumentHasPuzzles ? (
                <RefreshCw className={cn('w-5 h-5', isGeneratingPuzzles && 'animate-spin')} />
              ) : (
                <Zap className="w-5 h-5" />
              )}
            </button>
            <p className="sidebar-generate-caption">{generatePuzzlesLabel}</p>
          </div>
          )}
        </TabsList>

        {/* ==================== PUZZLE SETTINGS ==================== */}
        <TabsContent value="puzzle" style={{ height: 'calc(100vh - 100px)', overflowY: 'auto' }} className={cn('flex-1 min-h-0 p-4 space-y-6 bg-gradient-to-b from-white to-gray-50 dark:from-slate-800 dark:to-slate-850 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700 m-2', collapsed && 'hidden')}>
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-sky-600 dark:text-sky-400">
                  Document · This tab
                </p>
                <h3 className="font-semibold text-gray-900 dark:text-white">Puzzle Settings</h3>
              </div>
              <Button variant="outline" size="sm" onClick={handleSave} className="transition-all duration-200 border-gray-300 dark:border-slate-600">
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
                <DirectionToggle label="Right" icon={ArrowRight} checked={core.allowRight} onCheckedChange={(v) => updateCore({ allowRight: v })} />
                <DirectionToggle label="Left" icon={ArrowLeft} checked={core.allowLeft} onCheckedChange={(v) => updateCore({ allowLeft: v })} />
                <DirectionToggle label="Down" icon={ArrowDown} checked={core.allowDown} onCheckedChange={(v) => updateCore({ allowDown: v })} />
                <DirectionToggle label="Up" icon={ArrowUp} checked={core.allowUp} onCheckedChange={(v) => updateCore({ allowUp: v })} />
                <DirectionToggle label="Diagonal down" icon={ArrowDownRight} checked={core.allowDiagonalDown} onCheckedChange={(v) => updateCore({ allowDiagonalDown: v })} />
                <DirectionToggle label="Diagonal up" icon={ArrowUpRight} checked={core.allowDiagonalUp} onCheckedChange={(v) => updateCore({ allowDiagonalUp: v })} />
                <DirectionToggle label="Diagonal down reverse" icon={ArrowUpLeft} checked={core.allowDiagonalDownReverse} onCheckedChange={(v) => updateCore({ allowDiagonalDownReverse: v })} />
                <DirectionToggle label="Diagonal up reverse" icon={ArrowDownLeft} checked={core.allowDiagonalUpReverse} onCheckedChange={(v) => updateCore({ allowDiagonalUpReverse: v })} />
              </div>
            </div>

            {/* Puzzle Grid Border */}
            <div className="space-y-3">
              <Label className="text-sm font-medium">Puzzle Grid Border</Label>
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
                  label="Border Corner Radius"
                  value={core.borderCornerRadius}
                  onValueChange={(v) => updateCore({ borderCornerRadius: v })}
                  min={0}
                  max={40}
                  step={1}
                  format="px"
                />
                <SliderField
                  label="Border Padding"
                  value={core.gridBorderPadding}
                  onValueChange={(v) => updateCore({ gridBorderPadding: v })}
                  min={0}
                  max={40}
                  step={1}
                  format="px"
                />
              </div>
            </div>

            {/* Solution Grid Border */}
            <div className="space-y-3">
              <Label className="text-sm font-medium">Solution Grid Border</Label>
              <div className="space-y-2">
                <SliderField
                  label="Border Stroke Thickness"
                  value={core.solutionBorderStrokeThickness ?? core.borderStrokeThickness}
                  onValueChange={(v) => updateCore({ solutionBorderStrokeThickness: v })}
                  min={1}
                  max={10}
                  step={1}
                  format="px"
                />
                <SliderField
                  label="Border Corner Radius"
                  value={core.solutionBorderCornerRadius ?? core.borderCornerRadius}
                  onValueChange={(v) => updateCore({ solutionBorderCornerRadius: v })}
                  min={0}
                  max={40}
                  step={1}
                  format="px"
                />
                <SliderField
                  label="Border Padding"
                  value={core.solutionGridBorderPadding}
                  onValueChange={(v) => updateCore({ solutionGridBorderPadding: v })}
                  min={0}
                  max={40}
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
                  format="pt"
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
        <TabsContent value="design" style={{ height: 'calc(100vh - 100px)', overflowY: 'auto' }} className={cn('flex-1 min-h-0 p-4 space-y-6 bg-gradient-to-b from-white to-gray-50 dark:from-slate-800 dark:to-slate-850 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700 m-2', collapsed && 'hidden')}>
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-sky-600 dark:text-sky-400">
                  Document · This tab
                </p>
                <h3 className="font-semibold text-gray-900">Titles</h3>
              </div>
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
                    onChange={(e) => {
                      const inputValue = e.target.value;
                      updateTypography({ titleText: inputValue });
                      if (wordList.aiTheme !== inputValue) {
                        updateWordListSettings({ aiTheme: inputValue });
                      }
                    }}
                    placeholder="Enter the master title for all puzzles..."
                  />
                  <p className="text-xs text-gray-500">This title will be used for all puzzle pages.</p>
                </div>
              )}

              {typography.selectTitleOption === 'custom' && (
                <div className="space-y-2">
                  <Textarea
                    value={typography.titleText}
                    onChange={(e) => {
                      const inputValue = e.target.value;
                      updateTypography({ titleText: inputValue });
                      if (wordList.aiTheme !== inputValue) {
                        updateWordListSettings({ aiTheme: inputValue });
                      }
                    }}
                    placeholder="Enter one title per line..."
                    className="h-28"
                  />
                  <p className="text-xs text-gray-500">Enter one title per line. The first line is for Puzzle 1, the second for Puzzle 2, etc.</p>
                  {missingCustomTitles > 0 && (
                    <p className="text-sm font-medium text-rose-700">
                      {missingCustomTitles} more needed
                    </p>
                  )}
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
                <SliderField
                  label="Subtitle Box Margin"
                  value={typography.subtitleBoxMargin}
                  onValueChange={(v) => updateTypography({ subtitleBoxMargin: v })}
                  min={0}
                  max={100}
                  step={1}
                  format="pt"
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
          style={{ height: 'calc(100vh - 100px)', overflowY: 'auto' }}
          className={cn('flex-1 min-h-0 p-4 space-y-6 bg-gradient-to-b from-white to-gray-50 dark:from-slate-800 dark:to-slate-850 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700 m-2', collapsed && 'hidden')}
          onKeyDown={(e) => {
            // Allow Enter key to work in textareas without triggering tab navigation
            if (e.key === 'Enter' && (e.target as HTMLElement)?.tagName === 'TEXTAREA') {
              e.stopPropagation();
            }
          }}
        >
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-sky-600 dark:text-sky-400">
                  Document · This tab
                </p>
                <h3 className="font-semibold text-gray-900">Word List Settings</h3>
              </div>
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
                  <div className="space-y-3 p-3 rounded-lg border" style={{ background: `rgba(34, 118, 180, 0.08)` }}>
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-4 h-4" style={{ color: `#404040` }} />
                      <Label className="text-sm font-medium" style={{ color: `#404040` }}>AI Word Generation</Label>
                    </div>
                    <div>
                      <Label className="text-xs text-gray-500">Themes (one per line)</Label>
                      <Textarea
                        value={wordList.aiTheme}
                        onChange={(e) => {
                          const inputValue = e.target.value;
                          updateWordListSettings({ aiTheme: inputValue });
                          if (typography.titleText !== inputValue || typography.selectTitleOption !== 'custom') {
                            updateTypography({ selectTitleOption: 'custom', titleText: inputValue });
                          }
                        }}
                        placeholder="Animals\nSpace\nFood..."
                        className="h-20"
                      />
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
                        max={gridMaxWordLength}
                        step={1}
                      />
                    </div>

                    {/* Generate Words Button */}
                    <Button
                      onClick={handleGenerateWordsFromAI}
                      disabled={computeThemeValidation.isDisabled}
                      className="w-full cursor-pointer inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2 w-full"
                      style={{
                        background: computeThemeValidation.isDisabled ? '#d1d5db' : '#2276b4',
                        color: 'white',
                      }}
                    >
                      <Zap className="w-4 h-4 mr-2" />
                      Generate Words with AI
                    </Button>

                    {/* SPEC 1: Inline theme validation error display directly under the button */}
                    {themeError && (
                      <p style={{ color: themeError === "Ready" ? "green" : "red", fontSize: "12px", marginTop: "4px" }}>
                        {themeError}
                      </p>
                    )}

                    {/* Error message: show download prompt when Chrome extension API is missing */}
                    {showExtensionMissingPrompt && (
                      (() => {
                        const genPuzzleExtensionUrl = 'https://chromewebstore.google.com/detail/genpuzzle/pkokhbpdkolfhcbbghmopfcfbiamioie';
                        return (
                          <div className="p-2 bg-yellow-50 border border-yellow-200 rounded text-xs text-yellow-800">
                            <div>GenPuzzle Chrome extension not detected. Install the extension to use AI word generation.</div>
                            <div className="mt-2">
                              <Button onClick={() => window.open(genPuzzleExtensionUrl, '_blank')} variant="outline">
                                Download GenPuzzle Extension
                              </Button>
                            </div>
                          </div>
                        );
                      })()
                    )}
                    {generationError && (
                      (() => {
                        const missingExtension = typeof generationError === 'string' && generationError.includes('Chrome extension API not available');
                        const genPuzzleExtensionUrl = 'https://chromewebstore.google.com/detail/genpuzzle/pkokhbpdkolfhcbbghmopfcfbiamioie';

                        if (missingExtension) {
                          return (
                            <div className="p-2 bg-yellow-50 border border-yellow-200 rounded text-xs text-yellow-800">
                              <div>Failed to generate words: Chrome extension API not available. Make sure the extension is installed.</div>
                              <div className="mt-2">
                                <Button onClick={() => window.open(genPuzzleExtensionUrl, '_blank')} variant="outline">
                                  Download GenPuzzle Extension
                                </Button>
                              </div>
                            </div>
                          );
                        }

                        return (
                          <div className="p-2 bg-[var(--gp-grey-100)] border border-[var(--gp-grey-200)] rounded text-xs text-[var(--gp-black)]">
                            <strong>Error:</strong> {generationError}
                          </div>
                        );
                      })()
                    )}

                    {/* Success message */}
                    {generatedWordsData && generatedWordsData.words && (
                      <div className="p-2 bg-green-50 border border-green-200 rounded text-xs text-green-700">
                        <strong>✓ Success!</strong> Generated {generatedWordsData.words.reduce((total: number, item: any) => total + (item.words?.length || 0), 0)} words
                      </div>
                    )}
                  </div>
                )}

                {/* Manual Word Input */}
                {wordList.selectWordListOption === 'manual' && (
                  <>
                    <WordListTextarea
                      value={titleWords.words.join('\n')}
                      onChange={(value) => {
                        // REQUIREMENT 4: Parse both horizontal and vertical formats
                        const words = parseWordListFromBothFormats(value);
                        setTitleWords({ ...titleWords, words });
                      }}
                    />
                    <div className="flex items-center justify-between">
                      <p className="text-xs text-gray-500">
                        Enter one word per line. {wordCount} words {wordCount >= requiredWords ? (
                          <span className="text-green-600 flex items-center gap-1 inline"><CheckCircle className="w-3 h-3" /> Ready</span>
                        ) : (
                          <span className="text-[var(--gp-blue)] flex items-center gap-1 inline"><AlertCircle className="w-3 h-3" /> Need {requiredWords - wordCount} more</span>
                        )}
                      </p>
                    </div>

                    {/* Fun Facts / Quotes Section 1 */}
                    <div className="space-y-2 pt-2 border-t">
                      <div className="flex items-center space-x-2">
                        <Checkbox id="includeFunFacts1" checked={typography.includeFunFacts} onCheckedChange={(checked) => updateTypography({ includeFunFacts: checked === true })} />
                        <Label htmlFor="includeFunFacts1" className="text-sm font-medium">Add Fun Facts / Quotes</Label>
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
          </div>
        </TabsContent>

        {/* ==================== COLOR SETTINGS ==================== */}
        <TabsContent value="colors" style={{ height: 'calc(100vh - 100px)', overflowY: 'auto' }} className={cn('flex-1 min-h-0 p-4 space-y-6 bg-gradient-to-b from-white to-gray-50 dark:from-slate-800 dark:to-slate-850 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700 m-2', collapsed && 'hidden')}>
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-sky-600 dark:text-sky-400">
                  Layout · All documents
                </p>
                <h3 className="font-semibold text-gray-900">Colors, Frame, Header &amp; Page #</h3>
              </div>
              <Button variant="outline" size="sm" onClick={handleSave}>
                <Save className="w-4 h-4 mr-2" />Save
              </Button>
            </div>

            {/* Global Page Frame (puzzle + solution pages) */}
            <div className="space-y-3">
              <Label className="text-sm font-medium">Page Number</Label>
              <div className="space-y-3 p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="page-number-enabled"
                    checked={pageNumber.enabled}
                    onCheckedChange={(checked) => updatePageNumber({ enabled: !!checked })}
                  />
                  <Label htmlFor="page-number-enabled" className="text-sm font-medium cursor-pointer select-none">
                    Show page numbers on all pages
                  </Label>
                </div>

                {pageNumber.enabled && (
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label className="text-xs text-gray-500">Start numbering from</Label>
                        <Input
                          type="number"
                          min={0}
                          value={pageNumber.startNumberingFrom}
                          onChange={(e) =>
                            updatePageNumber({ startNumberingFrom: Number(e.target.value) || 1 })
                          }
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs text-gray-500">Start at page</Label>
                        <Input
                          type="number"
                          min={1}
                          value={pageNumber.startAtPage}
                          onChange={(e) =>
                            updatePageNumber({ startAtPage: Number(e.target.value) || 1 })
                          }
                        />
                      </div>
                    </div>

                    <div className="space-y-1">
                      <Label className="text-xs text-gray-500">Position</Label>
                      <Select
                        value={pageNumber.position}
                        onValueChange={(value) =>
                          updatePageNumber({ position: value as PageNumberSettings['position'] })
                        }
                      >
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="bottom-center">Bottom centre</SelectItem>
                          <SelectItem value="bottom-left">Bottom left</SelectItem>
                          <SelectItem value="bottom-right">Bottom right</SelectItem>
                          <SelectItem value="alternating">Alternating (even left, odd right)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <SliderField
                        label="Bottom offset"
                        value={pageNumber.bottomOffsetPx}
                        onValueChange={(v) => updatePageNumber({ bottomOffsetPx: v })}
                        min={0}
                        max={80}
                        step={1}
                        format="px"
                      />
                      <SliderField
                        label="Side offset"
                        value={pageNumber.sideOffsetPx}
                        onValueChange={(v) => updatePageNumber({ sideOffsetPx: v })}
                        min={0}
                        max={80}
                        step={1}
                        format="px"
                        disabled={pageNumber.position === 'bottom-center'}
                      />
                    </div>

                    <PageNumberShapeEditor
                      shape={pageNumber.shape}
                      textColor={pageNumber.textColor}
                      fontFamily={pageNumber.fontFamily}
                      fontSize={pageNumber.fontSize}
                      fontOptions={PUBLISHING_FONTS}
                      onShapeChange={(patch) =>
                        updatePageNumber({ shape: { ...pageNumber.shape, ...patch } })
                      }
                      onTextColorChange={(v) => updatePageNumber({ textColor: v })}
                      onFontFamilyChange={(v) => updatePageNumber({ fontFamily: v })}
                      onFontSizeChange={(v) => updatePageNumber({ fontSize: v })}
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Global Page Frame (puzzle + solution pages) */}
            <div className="space-y-3">
              <Label className="text-sm font-medium">Page Frame</Label>
              <div className="space-y-3 p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="page-frame-enabled"
                    checked={pageFrame.enabled}
                    onCheckedChange={(checked) => updatePageFrameSettings({ enabled: !!checked })}
                  />
                  <Label htmlFor="page-frame-enabled" className="text-xs font-medium cursor-pointer select-none">
                    Enable page container frame
                  </Label>
                </div>
                {pageFrame.enabled && (
                  <>
                    <SliderField
                      label="Frame Margin"
                      value={pageFrame.marginSizeIn}
                      onValueChange={(v) => updatePageFrameSettings({ marginSizeIn: v })}
                      min={0.5}
                      max={1}
                      step={0.0625}
                      format="inches"
                    />
                    <SliderField
                      label="Corner Radius"
                      value={pageFrame.cornerRadiusPx}
                      onValueChange={(v) => updatePageFrameSettings({ cornerRadiusPx: v })}
                      min={0}
                      max={40}
                      step={1}
                      format="px"
                    />
                    <SliderField
                      label="Stroke Thickness"
                      value={pageFrame.strokeThicknessPx}
                      onValueChange={(v) => updatePageFrameSettings({ strokeThicknessPx: v })}
                      min={1}
                      max={10}
                      step={1}
                      format="px"
                    />
                    <ColorInput
                      label="Frame Border Color"
                      value={pageFrame.borderColor}
                      onChange={(v) => updatePageFrameSettings({ borderColor: v })}
                    />
                    <p className="text-[10px] text-gray-400 dark:text-gray-500 leading-tight">
                      Outer boundary around the full puzzle/solution page. Grid border is configured separately under Puzzle → Grid Options.
                    </p>
                  </>
                )}
              </div>
            </div>

            {/* Puzzle Page Colors */}
            <div className="space-y-3">
              <Label className="text-sm font-medium">Puzzle Page</Label>
              <div className="space-y-3 p-3 bg-gray-50 rounded-lg">
                <ColorInput label="Background" value={colors.puzzlePage.backgroundColor} onChange={(v) => updatePuzzlePageColors({ backgroundColor: v })} />
                <BackgroundImageControl
                  label="Puzzle Page"
                  image={colors.puzzlePage.backgroundImage}
                  opacity={colors.puzzlePage.backgroundImageOpacity}
                  fit={colors.puzzlePage.backgroundImageFit}
                  onImageChange={(base64) => updatePuzzlePageColors({ backgroundImage: base64 })}
                  onOpacityChange={(v) => updatePuzzlePageColors({ backgroundImageOpacity: v })}
                  onFitChange={(v) => updatePuzzlePageColors({ backgroundImageFit: v })}
                  onRemove={() => updatePuzzlePageColors({ backgroundImage: undefined })}
                />
                <ColorInput label="Title" value={colors.puzzlePage.titleColor} onChange={(v) => updatePuzzlePageColors({ titleColor: v })} />
                <ColorInput label="Subtitle" value={colors.puzzlePage.subtitleColor} onChange={(v) => updatePuzzlePageColors({ subtitleColor: v })} disabled={!typography.includeFunFacts} />

                <div className="space-y-3 pt-2 border-t border-gray-200 dark:border-slate-700">
                  <Label className="text-sm font-medium">Header Assembly</Label>
                  <div className="space-y-3 p-3 bg-gray-50 rounded-lg dark:bg-slate-900/40">
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="header-assembly-enabled"
                        checked={headerAssembly.enabled}
                        onCheckedChange={(checked) => updateHeaderAssembly({ enabled: !!checked })}
                      />
                      <Label htmlFor="header-assembly-enabled" className="text-xs font-medium cursor-pointer select-none">
                        Enable modular header (mix &amp; match shapes)
                      </Label>
                    </div>
                    {headerAssembly.enabled && (
                      <HeaderAssemblyEditor
                        value={headerAssembly}
                        onChange={updateHeaderAssembly}
                      />
                    )}
                    <p className="text-[10px] text-gray-400 dark:text-gray-500 leading-tight">
                      Pick shapes independently for Number, Title, and Subtitle. Text colors use Title/Subtitle above.
                      Header sits inside the page frame margin + 0.25&quot; inner pad.
                    </p>
                  </div>
                </div>

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
                <BackgroundImageControl
                  label="Answer Page"
                  image={colors.answerPage.backgroundImage}
                  opacity={colors.answerPage.backgroundImageOpacity}
                  fit={colors.answerPage.backgroundImageFit}
                  onImageChange={(base64) => updateAnswerPageColors({ backgroundImage: base64 })}
                  onOpacityChange={(v) => updateAnswerPageColors({ backgroundImageOpacity: v })}
                  onFitChange={(v) => updateAnswerPageColors({ backgroundImageFit: v })}
                  onRemove={() => updateAnswerPageColors({ backgroundImage: undefined })}
                />
                <ColorInput label="Title" value={colors.answerPage.titleColor} onChange={(v) => updateAnswerPageColors({ titleColor: v })} />
                <ColorInput label="Box" value={colors.answerPage.boxColor} onChange={(v) => updateAnswerPageColors({ boxColor: v })} />
              </div>
            </div>

            <Button variant="outline" onClick={() => {
              updateWordSearchSettings(applyPageFrameSettingsPatch(wordSearchSettings, {
                enabled: true,
                marginSizeIn: 0.56,
                cornerRadiusPx: 4,
                strokeThicknessPx: 2,
                borderColor: '#1f2937',
              }));
              updateColors({
              puzzlePage: { backgroundColor: '#ffffff', titleColor: '#1f2937', subtitleColor: '#6b7280', boxColor: '#1f2937', puzzleColor: '#1f2937', wordListTitleColor: '#374151', wordListColor: '#4b5563', backgroundImage: undefined, backgroundImageOpacity: 100, backgroundImageFit: 'cover', backgroundImageFrameEnabled: true, backgroundImageFrameMargin: 0.56 },
              answerPage: { backgroundColor: '#ffffff', titleColor: '#1f2937', boxColor: '#1f2937', lettersInSolutionColor: '#22c55e', lettersNotInSolutionColor: '#d1d5db', solutionStrokeThickness: 12, solutionStrokePadding: 2, solutionFrameColor: '#22c55e', solutionFrameStyle: 'rounded', solutionFrameRadius: 6, solutionHighlightAlpha: 30, answerTitlePrefix: 'Solution', answerTitleFontFamily: 'Arial', answerTitleFontSize: 20, answerTitleAlignment: 'center', showAnswerNumber: true, backgroundImage: undefined, backgroundImageOpacity: 100, backgroundImageFit: 'cover', backgroundImageFrameEnabled: true, backgroundImageFrameMargin: 0.56 }
            });
            }} className="w-full hover:bg-gradient-to-r hover:from-gray-100 hover:to-gray-200 dark:hover:from-slate-700 dark:hover:to-slate-600 transition-all duration-200 border-gray-300 dark:border-slate-600">
              Reset Colors
            </Button>
          </div>
        </TabsContent>

        {/* ==================== BOOK SETTINGS ==================== */}
        <TabsContent value="book" style={{ height: 'calc(100vh - 100px)', overflowY: 'auto' }} className={cn('flex-1 min-h-0 p-4 space-y-6 bg-gradient-to-b from-white to-gray-50 dark:from-slate-800 dark:to-slate-850 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700 m-2', collapsed && 'hidden')}>
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-sky-600 dark:text-sky-400">
                  Layout · All documents
                </p>
                <h3 className="font-semibold text-gray-900">Trim &amp; Page Size</h3>
              </div>
              <Button variant="outline" size="sm" onClick={handleSave}>
                <Save className="w-4 h-4 mr-2" />Save
              </Button>
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
                      onCommit={(val) => {
                        const inchesValue = bookCanvas.measurementUnits === 'CENTIMETERS' ? val / 2.54 : val;
                        applyCustomTrimLayout(inchesValue, bookCanvas.customHeight || 11);
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
                      onCommit={(val) => {
                        const inchesValue = bookCanvas.measurementUnits === 'CENTIMETERS' ? val / 2.54 : val;
                        applyCustomTrimLayout(bookCanvas.customWidth || 8.5, inchesValue);
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
                    const dims = TRIM_SIZE_PRESETS[value as TrimSizePresetId];
                    if (dims) {
                      applyTrimSizeLayoutChange(
                        { trimSizePreset: value as TrimSizePresetId, useCustomTrim: false },
                        dims
                      );
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

            {/* Page Layout gaps (book-wide) */}
            <div className="space-y-3 pt-2 border-t">
              <Label className="text-sm font-medium">Page Layout Spacing</Label>
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
                  label="Solution to Solution"
                  value={solutionToSolutionGap}
                  onValueChange={setSolutionToSolutionGap}
                  min={6}
                  max={80}
                  step={1}
                  format="px"
                />
                <SliderField
                  label="Solution Page Margin"
                  value={pageMargin}
                  onValueChange={setPageMargin}
                  min={70}
                  max={200}
                  step={5}
                  format="px"
                />
              </div>
              <p className="text-xs text-gray-500">Solution Page Margin controls distance from solution page edges only (KDP safe zone).</p>
            </div>

          </div>
        </TabsContent>

        {/* ==================== CHAPTER PAGES (Layout · All documents) ==================== */}
        <TabsContent
          value="pages"
          style={{ height: 'calc(100vh - 100px)', overflowY: 'auto' }}
          className={cn(
            'flex-1 min-h-0 p-4 space-y-6 bg-gradient-to-b from-white to-gray-50 dark:from-slate-800 dark:to-slate-850 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700 m-2',
            collapsed && 'hidden'
          )}
        >
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-sky-600 dark:text-sky-400">
                  Layout · All documents
                </p>
                <h3 className="font-semibold text-gray-900 dark:text-white">Chapter title</h3>
              </div>
              <Button variant="outline" size="sm" onClick={handleSave}>
                <Save className="w-4 h-4 mr-2" />Save
              </Button>
            </div>
            <ChapterPagesBatchPanel />
          </div>
        </TabsContent>

        {!moduleIsWordSearch && (
        <TabsContent
          value="page"
          style={{ height: 'calc(100vh - 100px)', overflowY: 'auto' }}
          className={cn(
            'flex-1 min-h-0 p-4 space-y-4 bg-gradient-to-b from-white to-gray-50 dark:from-slate-800 dark:to-slate-850 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700 m-2',
            collapsed && 'hidden'
          )}
        >
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-sky-600 dark:text-sky-400">
              Document · This tab
            </p>
            <h3 className="font-semibold text-gray-900 dark:text-white">{activeDocumentPage?.name ?? 'Text Page'}</h3>
          </div>
          {activeTextSettings && (
            <>
              <div className="space-y-2">
                <Label>Page Title</Label>
                <Input
                  value={activeTextSettings.title}
                  onChange={(e) => updateActiveTextModuleSettings({ title: e.target.value })}
                />
              </div>
              {activeDocumentPage?.moduleType === 'table-of-contents' && (
                <div className="space-y-2">
                  <Label>TOC Mode</Label>
                  <Select
                    value={activeTextSettings.tocMode ?? 'auto'}
                    onValueChange={(value) =>
                      updateActiveTextModuleSettings({ tocMode: value as 'auto' | 'manual' })
                    }
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="auto">Auto (from document tabs)</SelectItem>
                      <SelectItem value="manual">Manual</SelectItem>
                    </SelectContent>
                  </Select>
                  {(activeTextSettings.tocMode ?? 'auto') === 'auto' && (
                    <p className="text-xs text-muted-foreground">
                      Titles and page numbers update automatically from your document tab order.
                      Use the floating panel on the canvas to style the table.
                    </p>
                  )}
                </div>
              )}
              <div className="space-y-2">
                <Label>Font</Label>
                <Select
                  value={activeTextSettings.fontFamily}
                  onValueChange={(value) => updateActiveTextModuleSettings({ fontFamily: value })}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PUBLISHING_FONTS.map((font) => (
                      <SelectItem key={font} value={font}>{font}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <SliderField
                label="Font Size"
                value={activeTextSettings.fontSize}
                onValueChange={(v) => updateActiveTextModuleSettings({ fontSize: v })}
                min={10}
                max={48}
                step={1}
              />
              <div className="space-y-2">
                <Label>Text Color</Label>
                <input
                  type="color"
                  value={activeTextSettings.textColor ?? '#000000'}
                  onChange={(e) => updateActiveTextModuleSettings({ textColor: e.target.value })}
                  className="h-8 w-full cursor-pointer rounded border border-gray-200"
                />
              </div>
              <div className="space-y-2">
                <Label>Alignment</Label>
                <Select
                  value={activeTextSettings.alignment}
                  onValueChange={(value) =>
                    updateActiveTextModuleSettings({ alignment: value as 'left' | 'center' | 'right' })
                  }
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="left">Left</SelectItem>
                    <SelectItem value="center">Center</SelectItem>
                    <SelectItem value="right">Right</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Content</Label>
                {(activeDocumentPage?.moduleType === 'table-of-contents' &&
                  (activeTextSettings.tocMode ?? 'auto') === 'auto') ? (
                  <Textarea
                    value={activeTextSettings.content}
                    readOnly
                    rows={12}
                    className="bg-muted/40"
                    placeholder="Auto-generated from your documents…"
                  />
                ) : (
                  <Textarea
                    value={activeTextSettings.content}
                    onChange={(e) => updateActiveTextModuleSettings({ content: e.target.value })}
                    rows={12}
                    placeholder="Enter page content..."
                  />
                )}
              </div>
            </>
          )}
        </TabsContent>
        )}
      </Tabs>
      <CanvasApplyToAllConfirmDialog
        open={generateConfirmOpen}
        onOpenChange={setGenerateConfirmOpen}
        editedPageIndices={editedPageIndicesInDocument}
        preserveEditedPages={preserveEditedPagesOnGenerate}
        onPreserveEditedPagesChange={setPreserveEditedPagesOnGenerate}
        onConfirm={handleGenerateConfirm}
        confirmLabel={generatePuzzlesLabel}
      />
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
    <Checkbox label={label} checked={checked} onCheckedChange={onCheckedChange} />
  );
}

function DirectionToggle({
  label,
  icon: Icon,
  checked,
  onCheckedChange,
}: {
  label: string;
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={checked}
      title={checked ? `${label} (enabled)` : `${label} (disabled)`}
      onClick={() => onCheckedChange(!checked)}
      className={cn(
        'direction-toggle',
        checked ? 'direction-toggle--active' : 'direction-toggle--inactive'
      )}
    >
      <Icon strokeWidth={2.25} />
    </button>
  );
}
