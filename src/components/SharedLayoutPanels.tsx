'use client';

/**
 * Book-wide Layout panels shared by every puzzle document sidebar.
 * Layout · Entire book — Trim / Style / Chapters.
 */

import React from 'react';
import { Save, Trash2, Upload } from 'lucide-react';
import { useApp } from '@/lib/app-context';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { ColorInput } from '@/components/ui/color-input';
import { SliderField } from '@/components/ui/slider-field';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { HeaderAssemblyEditor } from '@/components/header/HeaderAssemblyEditor';
import { PageNumberShapeEditor } from '@/components/page-number/PageNumberShapeEditor';
import { ChapterPagesBatchPanel } from '@/components/ChapterPagesBatchPanel';
import { PUBLISHING_FONTS } from '@/lib/publishing-fonts';
import { resolvePageFrameSettings, applyPageFrameSettingsPatch } from '@/lib/page-frame-settings';
import {
  normalizeHeaderAssemblySettings,
  type HeaderAssemblySettings,
} from '@/lib/header-assembly/types';
import { normalizePageNumberSettings } from '@/lib/page-number/settings';
import { TRIM_SIZE_PRESETS, type TrimSizePresetId } from '@/lib/trim-size-layout';
import type { PageNumberSettings } from '@/lib/puzzles/types';
import { useDebouncedCallback } from '@/hooks/useDebouncedCallback';

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
      if (Number.isNaN(num)) num = fallback;
      if (min !== undefined && num < min) num = min;
      setLocalValue(String(num));
      onChange(num);
      onCommit?.(num);
    },
    [min, onChange, onCommit]
  );

  const debouncedCommit = useDebouncedCallback(commitValue, 300);

  React.useEffect(() => {
    if (!isFocused.current) {
      setLocalValue(value?.toString() || '');
    }
  }, [value]);

  return (
    <Input
      type="text"
      inputMode="decimal"
      value={localValue}
      onFocus={() => {
        isFocused.current = true;
      }}
      onChange={(e) => {
        setLocalValue(e.target.value);
        debouncedCommit(e.target.value);
      }}
      onBlur={() => {
        isFocused.current = false;
        commitValue(localValue);
      }}
      placeholder={placeholder}
      className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
    />
  );
};

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
      if (typeof reader.result === 'string') onImageChange(reader.result);
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
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cover" className="text-xs">
                    Cover
                  </SelectItem>
                  <SelectItem value="contain" className="text-xs">
                    Contain
                  </SelectItem>
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

function useSharedLayoutDoc(onSave?: () => void) {
  const { wordSearchSettings, updateWordSearchSettings, applyTrimSizeLayoutChange } = useApp();
  const { bookCanvas, typography, colors } = wordSearchSettings;

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

  const updateTypography = React.useCallback(
    (updates: Partial<typeof typography>) => {
      updateWordSearchSettings({ typography: { ...typography, ...updates } });
    },
    [typography, updateWordSearchSettings]
  );

  const updateColors = React.useCallback(
    (updates: Partial<typeof colors>) => {
      updateWordSearchSettings({ colors: { ...colors, ...updates } });
    },
    [colors, updateWordSearchSettings]
  );

  const updatePuzzlePageColors = (updates: Partial<typeof colors.puzzlePage>) => {
    updateColors({ puzzlePage: { ...colors.puzzlePage, ...updates } });
  };

  const updateAnswerPageColors = (updates: Partial<typeof colors.answerPage>) => {
    updateColors({ answerPage: { ...colors.answerPage, ...updates } });
  };

  const headerAssembly = normalizeHeaderAssemblySettings(colors.puzzlePage.headerAssembly);
  const pageNumber = normalizePageNumberSettings(typography.pageNumber);
  const pageFrame = resolvePageFrameSettings(wordSearchSettings);

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

  const updatePageFrameSettings = (updates: Parameters<typeof applyPageFrameSettingsPatch>[1]) => {
    updateWordSearchSettings(applyPageFrameSettingsPatch(wordSearchSettings, updates));
  };

  return {
    onSave,
    bookCanvas,
    typography,
    colors,
    headerAssembly,
    pageNumber,
    pageFrame,
    updateBookCanvas,
    applyCustomTrimLayout,
    applyTrimSizeLayoutChange,
    updateColors,
    updatePuzzlePageColors,
    updateAnswerPageColors,
    updatePageNumber,
    updateHeaderAssembly,
    updatePageFrameSettings,
    updateWordSearchSettings,
    wordSearchSettings,
  };
}

export function LayoutBookPanel({ onSave }: { onSave?: () => void }) {
  const {
    bookCanvas,
    updateBookCanvas,
    applyCustomTrimLayout,
    applyTrimSizeLayoutChange,
  } = useSharedLayoutDoc(onSave);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-sky-600 dark:text-sky-400">
            Layout · Entire book
          </p>
          <h3 className="font-semibold text-gray-900">Trim &amp; Page Size</h3>
        </div>
        {onSave && (
          <Button variant="outline" size="sm" onClick={onSave}>
            <Save className="w-4 h-4 mr-2" />
            Save
          </Button>
        )}
      </div>

      <div className="space-y-1">
        <Label className="text-sm font-medium">Measurement Units</Label>
        <Select
          value={bookCanvas.measurementUnits || 'INCHES'}
          onValueChange={(value) => updateBookCanvas({ measurementUnits: value as 'INCHES' | 'CENTIMETERS' })}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="INCHES">Inches</SelectItem>
            <SelectItem value="CENTIMETERS">Centimeters</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <div className="flex items-center space-x-2">
          <Checkbox
            id="shared-useCustomTrim"
            checked={bookCanvas.useCustomTrim}
            onCheckedChange={(checked) => updateBookCanvas({ useCustomTrim: checked === true })}
          />
          <Label htmlFor="shared-useCustomTrim" className="text-sm font-normal">
            Custom Trim Size
          </Label>
        </div>

        {bookCanvas.useCustomTrim && (
          <div className="pl-6 grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs text-gray-500">
                Width ({bookCanvas.measurementUnits === 'CENTIMETERS' ? 'cm' : 'in'})
              </Label>
              <DecimalInput
                value={
                  bookCanvas.measurementUnits === 'CENTIMETERS'
                    ? (bookCanvas.customWidth || 0) * 2.54
                    : bookCanvas.customWidth || 0
                }
                onChange={(val) => {
                  const inchesValue =
                    bookCanvas.measurementUnits === 'CENTIMETERS' ? val / 2.54 : val;
                  updateBookCanvas({ customWidth: inchesValue });
                }}
                onCommit={(val) => {
                  const inchesValue =
                    bookCanvas.measurementUnits === 'CENTIMETERS' ? val / 2.54 : val;
                  applyCustomTrimLayout(inchesValue, bookCanvas.customHeight || 11);
                }}
                placeholder={bookCanvas.measurementUnits === 'CENTIMETERS' ? '21.59' : '8.5'}
                min={0}
              />
            </div>
            <div>
              <Label className="text-xs text-gray-500">
                Length ({bookCanvas.measurementUnits === 'CENTIMETERS' ? 'cm' : 'in'})
              </Label>
              <DecimalInput
                value={
                  bookCanvas.measurementUnits === 'CENTIMETERS'
                    ? (bookCanvas.customHeight || 0) * 2.54
                    : bookCanvas.customHeight || 0
                }
                onChange={(val) => {
                  const inchesValue =
                    bookCanvas.measurementUnits === 'CENTIMETERS' ? val / 2.54 : val;
                  updateBookCanvas({ customHeight: inchesValue });
                }}
                onCommit={(val) => {
                  const inchesValue =
                    bookCanvas.measurementUnits === 'CENTIMETERS' ? val / 2.54 : val;
                  applyCustomTrimLayout(bookCanvas.customWidth || 8.5, inchesValue);
                }}
                placeholder={bookCanvas.measurementUnits === 'CENTIMETERS' ? '27.94' : '11'}
                min={0}
              />
            </div>
          </div>
        )}
      </div>

      {!bookCanvas.useCustomTrim && (
        <div className="space-y-2">
          <Label className="text-sm font-medium">Trim Size</Label>
          <Select
            value={bookCanvas.trimSizePreset || ''}
            onValueChange={(value) => {
              if (!value) return;
              const dims = TRIM_SIZE_PRESETS[value as TrimSizePresetId];
              if (dims) {
                applyTrimSizeLayoutChange(
                  { trimSizePreset: value as TrimSizePresetId, useCustomTrim: false },
                  dims
                );
              }
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select a trim size" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="5X8IN">
                {bookCanvas.measurementUnits === 'CENTIMETERS' ? '12.7 x 20.32' : '5 x 8'}{' '}
                {bookCanvas.measurementUnits === 'CENTIMETERS' ? 'cm' : 'in'}
              </SelectItem>
              <SelectItem value="5_25X8IN">
                {bookCanvas.measurementUnits === 'CENTIMETERS' ? '13.34 x 20.32' : '5.25 x 8'}{' '}
                {bookCanvas.measurementUnits === 'CENTIMETERS' ? 'cm' : 'in'}
              </SelectItem>
              <SelectItem value="5_5X8_5IN">
                {bookCanvas.measurementUnits === 'CENTIMETERS' ? '13.97 x 21.59' : '5.5 x 8.5'}{' '}
                {bookCanvas.measurementUnits === 'CENTIMETERS' ? 'cm' : 'in'}
              </SelectItem>
              <SelectItem value="6X9IN">
                {bookCanvas.measurementUnits === 'CENTIMETERS' ? '15.24 x 22.86' : '6 x 9'}{' '}
                {bookCanvas.measurementUnits === 'CENTIMETERS' ? 'cm' : 'in'}
              </SelectItem>
              <SelectItem value="5_06X7_81IN">
                {bookCanvas.measurementUnits === 'CENTIMETERS' ? '12.85 x 19.84' : '5.06 x 7.81'}{' '}
                {bookCanvas.measurementUnits === 'CENTIMETERS' ? 'cm' : 'in'}
              </SelectItem>
              <SelectItem value="6_14X9_21IN">
                {bookCanvas.measurementUnits === 'CENTIMETERS' ? '15.6 x 23.39' : '6.14 x 9.21'}{' '}
                {bookCanvas.measurementUnits === 'CENTIMETERS' ? 'cm' : 'in'}
              </SelectItem>
              <SelectItem value="6_69X9_61IN">
                {bookCanvas.measurementUnits === 'CENTIMETERS' ? '16.99 x 24.4' : '6.69 x 9.61'}{' '}
                {bookCanvas.measurementUnits === 'CENTIMETERS' ? 'cm' : 'in'}
              </SelectItem>
              <SelectItem value="7X10IN">
                {bookCanvas.measurementUnits === 'CENTIMETERS' ? '17.78 x 25.4' : '7 x 10'}{' '}
                {bookCanvas.measurementUnits === 'CENTIMETERS' ? 'cm' : 'in'}
              </SelectItem>
              <SelectItem value="7_44X9_69IN">
                {bookCanvas.measurementUnits === 'CENTIMETERS' ? '18.9 x 24.61' : '7.44 x 9.69'}{' '}
                {bookCanvas.measurementUnits === 'CENTIMETERS' ? 'cm' : 'in'}
              </SelectItem>
              <SelectItem value="7_5X9_25IN">
                {bookCanvas.measurementUnits === 'CENTIMETERS' ? '19.05 x 23.5' : '7.5 x 9.25'}{' '}
                {bookCanvas.measurementUnits === 'CENTIMETERS' ? 'cm' : 'in'}
              </SelectItem>
              <SelectItem value="8X10IN">
                {bookCanvas.measurementUnits === 'CENTIMETERS' ? '20.32 x 25.4' : '8 x 10'}{' '}
                {bookCanvas.measurementUnits === 'CENTIMETERS' ? 'cm' : 'in'}
              </SelectItem>
              <SelectItem value="8_5X11IN">
                {bookCanvas.measurementUnits === 'CENTIMETERS' ? '21.59 x 27.94' : '8.5 x 11'}{' '}
                {bookCanvas.measurementUnits === 'CENTIMETERS' ? 'cm' : 'in'}
              </SelectItem>
              <SelectItem value="8_27X11_69IN">
                {bookCanvas.measurementUnits === 'CENTIMETERS' ? '21 x 29.7' : '8.27 x 11.69'}{' '}
                {bookCanvas.measurementUnits === 'CENTIMETERS' ? 'cm' : 'in'}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}
    </div>
  );
}

export function LayoutColorsPanel({ onSave }: { onSave?: () => void }) {
  const {
    colors,
    typography,
    headerAssembly,
    pageNumber,
    pageFrame,
    updateColors,
    updatePuzzlePageColors,
    updateAnswerPageColors,
    updatePageNumber,
    updateHeaderAssembly,
    updatePageFrameSettings,
    updateWordSearchSettings,
    wordSearchSettings,
  } = useSharedLayoutDoc(onSave);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-sky-600 dark:text-sky-400">
            Layout · Entire book
          </p>
          <h3 className="font-semibold text-gray-900">Colors, Frame, Header &amp; Page #</h3>
        </div>
        {onSave && (
          <Button variant="outline" size="sm" onClick={onSave}>
            <Save className="w-4 h-4 mr-2" />
            Save
          </Button>
        )}
      </div>

      <div className="space-y-3">
        <Label className="text-sm font-medium">Page Number</Label>
        <div className="space-y-3 p-3 bg-gray-50 rounded-lg">
          <div className="flex items-center gap-2">
            <Checkbox
              id="shared-page-number-enabled"
              checked={pageNumber.enabled}
              onCheckedChange={(checked) => updatePageNumber({ enabled: !!checked })}
            />
            <Label
              htmlFor="shared-page-number-enabled"
              className="text-sm font-medium cursor-pointer select-none"
            >
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
                    min={0}
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
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
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
                fontOptions={[...PUBLISHING_FONTS]}
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

      <div className="space-y-3">
        <Label className="text-sm font-medium">Page Frame</Label>
        <div className="space-y-3 p-3 bg-gray-50 rounded-lg">
          <div className="flex items-center gap-2">
            <Checkbox
              id="shared-page-frame-enabled"
              checked={pageFrame.enabled}
              onCheckedChange={(checked) => updatePageFrameSettings({ enabled: !!checked })}
            />
            <Label
              htmlFor="shared-page-frame-enabled"
              className="text-xs font-medium cursor-pointer select-none"
            >
              Enable page container frame
            </Label>
          </div>
          {pageFrame.enabled && (
            <>
              <SliderField
                label="Frame Margin"
                value={pageFrame.marginSizeIn}
                onValueChange={(v) => updatePageFrameSettings({ marginSizeIn: v })}
                min={0}
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
                min={0}
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
                Outer boundary around the full puzzle/solution page. Grid border is configured
                separately under Puzzle → Grid Options.
              </p>
            </>
          )}
        </div>
      </div>

      <div className="space-y-3">
        <Label className="text-sm font-medium">Puzzle Page</Label>
        <div className="space-y-3 p-3 bg-gray-50 rounded-lg">
          <ColorInput
            label="Background"
            value={colors.puzzlePage.backgroundColor}
            onChange={(v) => updatePuzzlePageColors({ backgroundColor: v })}
          />
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

          <div className="space-y-3 pt-2 border-t border-gray-200 dark:border-slate-700">
            <Label className="text-sm font-medium">Header Assembly</Label>
            <div className="space-y-3 p-3 bg-gray-50 rounded-lg dark:bg-slate-900/40">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="shared-header-assembly-enabled"
                  checked={headerAssembly.enabled}
                  onCheckedChange={(checked) => updateHeaderAssembly({ enabled: !!checked })}
                />
                <Label
                  htmlFor="shared-header-assembly-enabled"
                  className="text-xs font-medium cursor-pointer select-none"
                >
                  Enable modular header (mix &amp; match shapes)
                </Label>
              </div>
              {headerAssembly.enabled ? (
                <HeaderAssemblyEditor
                  value={headerAssembly}
                  onChange={updateHeaderAssembly}
                  titleTextColor={colors.puzzlePage.titleColor || '#1f2937'}
                  subtitleTextColor={colors.puzzlePage.subtitleColor || '#6b7280'}
                  onTitleTextColorChange={(v) => updatePuzzlePageColors({ titleColor: v })}
                  onSubtitleTextColorChange={(v) => updatePuzzlePageColors({ subtitleColor: v })}
                />
              ) : (
                <div className="space-y-2">
                  <Label className="text-xs text-gray-500">Colors</Label>
                  <ColorInput
                    label="Title"
                    value={colors.puzzlePage.titleColor}
                    onChange={(v) => updatePuzzlePageColors({ titleColor: v })}
                  />
                  <ColorInput
                    label="Subtitle"
                    value={colors.puzzlePage.subtitleColor}
                    onChange={(v) => updatePuzzlePageColors({ subtitleColor: v })}
                    disabled={!typography.includeFunFacts}
                  />
                </div>
              )}
              <p className="text-[10px] text-gray-400 dark:text-gray-500 leading-tight">
                {headerAssembly.enabled
                  ? 'Title and subtitle text colors are under each element’s style (with Fill / Border).'
                  : 'Title and subtitle colors live here. Enable Header Assembly to edit them with each shape’s Fill / Border.'}{' '}
                Header sits inside the page frame margin + 0.25&quot; inner pad.
              </p>
            </div>
          </div>

          <ColorInput
            label="Box"
            value={colors.puzzlePage.boxColor}
            onChange={(v) => updatePuzzlePageColors({ boxColor: v })}
          />
          <ColorInput
            label="Puzzle Letters"
            value={colors.puzzlePage.puzzleColor}
            onChange={(v) => updatePuzzlePageColors({ puzzleColor: v })}
          />
          <ColorInput
            label="Word List"
            value={colors.puzzlePage.wordListColor}
            onChange={(v) => updatePuzzlePageColors({ wordListColor: v })}
          />
        </div>
      </div>

      <div className="space-y-3">
        <Label className="text-sm font-medium">Answer Page</Label>
        <div className="space-y-3 p-3 bg-gray-50 rounded-lg">
          <ColorInput
            label="Background"
            value={colors.answerPage.backgroundColor}
            onChange={(v) => updateAnswerPageColors({ backgroundColor: v })}
          />
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
          <ColorInput
            label="Title"
            value={colors.answerPage.titleColor}
            onChange={(v) => updateAnswerPageColors({ titleColor: v })}
          />
          <ColorInput
            label="Box"
            value={colors.answerPage.boxColor}
            onChange={(v) => updateAnswerPageColors({ boxColor: v })}
          />
        </div>
      </div>

      <Button
        variant="outline"
        onClick={() => {
          updateWordSearchSettings(
            applyPageFrameSettingsPatch(wordSearchSettings, {
              enabled: true,
              marginSizeIn: 0.56,
              cornerRadiusPx: 4,
              strokeThicknessPx: 2,
              borderColor: '#1f2937',
            })
          );
          updateColors({
            puzzlePage: {
              backgroundColor: '#ffffff',
              titleColor: '#1f2937',
              subtitleColor: '#6b7280',
              boxColor: '#1f2937',
              puzzleColor: '#1f2937',
              puzzleLetterStrokeColor: '#000000',
              puzzleLetterStrokeThickness: 0,
              wordListTitleColor: '#374151',
              wordListColor: '#4b5563',
              backgroundImage: undefined,
              backgroundImageOpacity: 100,
              backgroundImageFit: 'cover',
              backgroundImageFrameEnabled: true,
              backgroundImageFrameMargin: 0.56,
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
              solutionHighlightStrokeColor: '#000000',
              solutionHighlightStrokeThickness: 0,
              solutionFrameStyle: 'rounded',
              solutionFrameRadius: 6,
              solutionHighlightAlpha: 30,
              answerTitlePrefix: 'Solution',
              answerTitleFontFamily: 'Arial',
              answerTitleFontSize: 20,
              answerTitleAlignment: 'center',
              showAnswerNumber: true,
              backgroundImage: undefined,
              backgroundImageOpacity: 100,
              backgroundImageFit: 'cover',
              backgroundImageFrameEnabled: true,
              backgroundImageFrameMargin: 0.56,
            },
          });
        }}
        className="w-full hover:bg-gradient-to-r hover:from-gray-100 hover:to-gray-200 dark:hover:from-slate-700 dark:hover:to-slate-600 transition-all duration-200 border-gray-300 dark:border-slate-600"
      >
        Reset Colors
      </Button>
    </div>
  );
}

export function LayoutChaptersPanel({ onSave }: { onSave?: () => void }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-sky-600 dark:text-sky-400">
            Layout · Entire book
          </p>
          <h3 className="font-semibold text-gray-900 dark:text-white">Chapter title</h3>
        </div>
        {onSave && (
          <Button variant="outline" size="sm" onClick={onSave}>
            <Save className="w-4 h-4 mr-2" />
            Save
          </Button>
        )}
      </div>
      <ChapterPagesBatchPanel />
    </div>
  );
}
