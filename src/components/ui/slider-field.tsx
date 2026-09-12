'use client';

import * as React from 'react';
import { ChevronDown, Minus, Plus, SlidersVertical } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

export type SliderValueFormat = 'number' | 'px' | 'pt' | 'percent' | 'inches';

/**
 * - slider: classic horizontal slider (opt-in only)
 * - input: numeric entry (font sizes, Letters Across/Down, counts)
 * - popover: full-width adjust button → vertical slider
 * - auto: pick input vs popover from the label (app default)
 */
export type SliderFieldControl = 'slider' | 'input' | 'popover' | 'auto';

function formatSliderValue(value: number, format: SliderValueFormat): string {
  switch (format) {
    case 'px':
      return `${value}px`;
    case 'pt':
      return `${value}pt`;
    case 'percent':
      return `${value}%`;
    case 'inches':
      return `${Number(value).toFixed(2)}"`;
    default:
      return String(value);
  }
}

function formatUnitSuffix(format: SliderValueFormat): string | null {
  switch (format) {
    case 'px':
      return 'px';
    case 'pt':
      return 'pt';
    case 'percent':
      return '%';
    case 'inches':
      return 'in';
    default:
      return null;
  }
}

/** Short display names for crowded control panels. */
const LABEL_SHORTCUTS: Record<string, string> = {
  'spaces between words horizontally': 'Space Horizontal',
  'spaces between words vertically': 'Space Vertical',
  'space horizontal': 'Space Horizontal',
  'space vertical': 'Space Vertical',
  'border stroke thickness': 'Border Thickness',
  'border corner radius': 'Corner Radius',
  'border padding': 'Border Padding',
  'border thickness': 'Border Thickness',
  'corner radius': 'Corner Radius',
  'rounded corners': 'Corners',
  'border opacity': 'Border Opacity',
  'subtitle box margin': 'Subtitle Margin',
  'title start at': 'Title Start',
  'title to subtitle': 'Title to Subtitle',
  'title to puzzle': 'Title to Puzzle',
  'puzzle to word list': 'Puzzle to Words',
  'bottom offset': 'Bottom Offset',
  'side offset': 'Side Offset',
  'frame margin': 'Frame Margin',
  'stroke thickness': 'Stroke',
  'stroke': 'Stroke',
  transparency: 'Opacity',
  'title to answer': 'Title to Answer',
  'solution to solution': 'Solution Gap',
  'solution page margin': 'Page Margin',
  'puzzle grid scale': 'Grid Scale',
  'puzzle font size': 'Puzzle Font',
  'solution font size': 'Solution Font',
  'grid font size': 'Grid Font',
  'font size': 'Font Size',
  'title size': 'Title Size',
  'subtitle size': 'Subtitle Size',
  'number size': 'Number Size',
  'letters across': 'Letters Across',
  'letters down': 'Letters Down',
  'max length': 'Max Length',
  'image size': 'Image Size',
  'polygon sides': 'Sides',
};

function displayLabel(label: string): string {
  const key = label.trim().toLowerCase();
  if (LABEL_SHORTCUTS[key]) return LABEL_SHORTCUTS[key];
  return label;
}

function clampNumber(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function parseSteppedNumber(
  raw: string,
  step: number,
  min: number,
  max: number,
  fallback: number
): number {
  const trimmed = raw.trim();
  if (trimmed === '') return fallback;
  const parsed = step < 1 ? parseFloat(trimmed) : parseInt(trimmed, 10);
  if (Number.isNaN(parsed)) return fallback;
  const clamped = clampNumber(parsed, min, max);
  if (step >= 1) return Math.round(clamped);
  const decimals = String(step).includes('.') ? String(step).split('.')[1].length : 0;
  const stepped = Math.round(clamped / step) * step;
  return Number(stepped.toFixed(decimals));
}

function stepValue(value: number, step: number, min: number, max: number, direction: 1 | -1): number {
  const next = value + direction * step;
  const clamped = clampNumber(next, min, max);
  if (step >= 1) return Math.round(clamped);
  const decimals = String(step).includes('.') ? String(step).split('.')[1].length : 0;
  return Number(clamped.toFixed(decimals));
}

/** Labels that should be typed as numbers instead of adjusted with a slider. */
function isNumericEntryLabel(label: string): boolean {
  const t = label.trim().toLowerCase();
  return (
    /font\s*size/.test(t) ||
    /title\s*size/.test(t) ||
    /subtitle\s*size/.test(t) ||
    /number\s*size/.test(t) ||
    /letters\s*across/.test(t) ||
    /letters\s*down/.test(t) ||
    /grid\s*size/.test(t) ||
    /max\s*length/.test(t) ||
    /polygon\s*sides/.test(t) ||
    /^size$/.test(t) ||
    /answers?\s*per\s*page/.test(t)
  );
}

function resolveControl(
  label: string,
  control: SliderFieldControl | undefined
): Exclude<SliderFieldControl, 'auto'> {
  if (control && control !== 'auto') return control;
  return isNumericEntryLabel(label) ? 'input' : 'popover';
}

export interface SliderFieldProps {
  label: string;
  value: number;
  onValueChange: (value: number) => void;
  min: number;
  max: number;
  step?: number;
  format?: SliderValueFormat;
  formatValue?: (value: number) => string;
  className?: string;
  labelClassName?: string;
  disabled?: boolean;
  control?: SliderFieldControl;
}

export function SliderField({
  label,
  value,
  onValueChange,
  min,
  max,
  step = 1,
  format = 'number',
  formatValue,
  className,
  labelClassName,
  disabled = false,
  control = 'auto',
}: SliderFieldProps) {
  const resolved = resolveControl(label, control);
  const shownLabel = displayLabel(label);
  const displayValue = formatValue ? formatValue(value) : formatSliderValue(value, format);
  const unit = formatUnitSuffix(format);
  const [draft, setDraft] = React.useState(String(value));
  const [open, setOpen] = React.useState(false);
  const focusedRef = React.useRef(false);
  const draftRef = React.useRef(draft);
  const valueRef = React.useRef(value);
  draftRef.current = draft;
  valueRef.current = value;

  React.useEffect(() => {
    if (!focusedRef.current) {
      setDraft(step < 1 ? String(value) : String(Math.round(value)));
    }
  }, [value, step]);

  const commitRaw = React.useCallback(
    (raw: string) => {
      const next = parseSteppedNumber(raw, step, min, max, valueRef.current);
      setDraft(step < 1 ? String(next) : String(Math.round(next)));
      if (next !== valueRef.current) onValueChange(next);
    },
    [step, min, max, onValueChange]
  );

  // Flush in-progress draft on unmount so tab/panel switches do not drop typed values.
  React.useEffect(() => {
    return () => {
      if (!focusedRef.current) return;
      const next = parseSteppedNumber(
        draftRef.current,
        step,
        min,
        max,
        valueRef.current
      );
      if (next !== valueRef.current) onValueChange(next);
    };
  }, [step, min, max, onValueChange]);

  if (resolved === 'input') {
    return (
      <div
        className={cn(
          'gp-slider-field gp-slider-field--input space-y-1.5',
          disabled && 'opacity-50 pointer-events-none',
          className
        )}
      >
        <Label
          className={cn(
            'text-xs font-medium text-slate-600 dark:text-slate-300',
            disabled && 'text-gray-400',
            labelClassName
          )}
        >
          {shownLabel}
        </Label>
        <div className="flex items-center gap-2">
          <Input
            type="text"
            inputMode="decimal"
            value={draft}
            disabled={disabled}
            onFocus={() => {
              focusedRef.current = true;
            }}
            onBlur={(e) => {
              focusedRef.current = false;
              commitRaw(e.target.value);
            }}
            onChange={(e) => {
              // Keep draft free while typing; clamp only on blur/Enter.
              // Avoid type="number" + min so the browser does not block entry.
              setDraft(e.target.value);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                focusedRef.current = false;
                commitRaw((e.target as HTMLInputElement).value);
                e.currentTarget.blur();
              }
            }}
            className={cn(
              'h-10 min-w-0 flex-1 rounded-xl border-slate-200 bg-white text-sm font-semibold tabular-nums shadow-sm',
              'focus-visible:border-sky-400 focus-visible:ring-sky-200/60',
              'dark:border-slate-600 dark:bg-slate-900'
            )}
            aria-label={shownLabel}
          />
          {unit && (
            <span className="shrink-0 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              {unit}
            </span>
          )}
        </div>
      </div>
    );
  }

  if (resolved === 'popover') {
    return (
      <div
        className={cn(
          'gp-slider-field gp-slider-field--adjust w-full min-w-0 space-y-1.5',
          disabled && 'opacity-50 pointer-events-none',
          className
        )}
      >
        <Label
          className={cn(
            'text-xs font-medium text-slate-600 dark:text-slate-300',
            disabled && 'text-gray-400',
            labelClassName
          )}
        >
          {shownLabel}
        </Label>
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              disabled={disabled}
              aria-label={`Adjust ${shownLabel}`}
              aria-expanded={open}
              className={cn(
                'gp-adjust-btn group flex h-9 w-full min-w-0 items-center justify-between gap-2 rounded-lg border px-2.5',
                'border-slate-200 bg-white shadow-sm',
                'hover:border-sky-300 hover:bg-sky-50/50',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300/70',
                'dark:border-slate-600 dark:bg-slate-900 dark:hover:border-sky-500',
                open && 'border-sky-400 ring-2 ring-sky-200/60 dark:border-sky-500 dark:ring-sky-800/50'
              )}
            >
              <span className="flex items-center gap-2 min-w-0">
                <span
                  className={cn(
                    'flex h-6 w-6 shrink-0 items-center justify-center rounded-md',
                    'bg-[#1a5a8c] text-white',
                    'group-hover:bg-[#144a75]'
                  )}
                  aria-hidden
                >
                  <SlidersVertical className="h-3 w-3" strokeWidth={2.5} />
                </span>
                <span className="text-sm font-bold tabular-nums text-slate-800 dark:text-slate-100">
                  {displayValue}
                </span>
              </span>
              <ChevronDown
                className={cn(
                  'h-3.5 w-3.5 shrink-0 text-slate-400 transition-transform',
                  open && 'rotate-180 text-sky-600'
                )}
                strokeWidth={2.25}
              />
            </button>
          </PopoverTrigger>

          <PopoverContent
            side="right"
            align="start"
            sideOffset={8}
            collisionPadding={12}
            className="w-[7.5rem] rounded-xl border border-slate-200 p-0 shadow-xl dark:border-slate-600 dark:bg-slate-900"
            onOpenAutoFocus={(e) => e.preventDefault()}
          >
            <div className="flex flex-col items-center gap-2 px-2.5 py-3">
              <p
                className="text-base font-bold tabular-nums text-slate-900 dark:text-white"
                aria-live="polite"
              >
                {displayValue}
              </p>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  aria-label={`Decrease ${shownLabel}`}
                  disabled={disabled || value <= min}
                  onClick={() => onValueChange(stepValue(value, step, min, max, -1))}
                  className="gp-adjust-step flex h-7 w-7 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 shadow-sm hover:border-sky-300 hover:bg-sky-50 disabled:pointer-events-none disabled:opacity-40 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
                >
                  <Minus className="h-3 w-3" strokeWidth={2.5} />
                </button>
                <div className="flex h-28 items-center justify-center px-0.5">
                  <Slider
                    orientation="vertical"
                    value={[value]}
                    onValueChange={(v) => onValueChange(v[0])}
                    min={min}
                    max={max}
                    step={step}
                    disabled={disabled}
                    className="h-28"
                  />
                </div>
                <button
                  type="button"
                  aria-label={`Increase ${shownLabel}`}
                  disabled={disabled || value >= max}
                  onClick={() => onValueChange(stepValue(value, step, min, max, 1))}
                  className="gp-adjust-step flex h-7 w-7 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 shadow-sm hover:border-sky-300 hover:bg-sky-50 disabled:pointer-events-none disabled:opacity-40 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
                >
                  <Plus className="h-3 w-3" strokeWidth={2.5} />
                </button>
              </div>

              <p className="text-[9px] tabular-nums text-slate-400">
                {min}
                {unit ?? ''}–{max}
                {unit ?? ''}
              </p>
            </div>
          </PopoverContent>
        </Popover>
      </div>
    );
  }

  return (
    <div className={cn('space-y-1.5', disabled && 'opacity-50 pointer-events-none', className)}>
      <div className="flex items-center justify-between gap-2">
        <Label
          className={cn(
            'text-xs font-normal',
            disabled ? 'text-gray-400' : 'text-gray-500',
            labelClassName
          )}
        >
          {shownLabel}
        </Label>
        <span className="shrink-0 rounded-md bg-muted px-2 py-0.5 text-xs font-medium tabular-nums text-muted-foreground">
          {displayValue}
        </span>
      </div>
      <Slider
        value={[value]}
        onValueChange={(v) => onValueChange(v[0])}
        min={min}
        max={max}
        step={step}
        disabled={disabled}
      />
    </div>
  );
}
