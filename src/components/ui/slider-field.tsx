'use client';

import * as React from 'react';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { cn } from '@/lib/utils';

export type SliderValueFormat = 'number' | 'px' | 'percent';

function formatSliderValue(value: number, format: SliderValueFormat): string {
  switch (format) {
    case 'px':
      return `${value}px`;
    case 'percent':
      return `${value}%`;
    default:
      return String(value);
  }
}

export interface SliderFieldProps {
  label: string;
  value: number;
  onValueChange: (value: number) => void;
  min: number;
  max: number;
  step?: number;
  format?: SliderValueFormat;
  /** Override badge text (e.g. grid size as "15×15"). */
  formatValue?: (value: number) => string;
  className?: string;
  labelClassName?: string;
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
}: SliderFieldProps) {
  const displayValue = formatValue ? formatValue(value) : formatSliderValue(value, format);

  return (
    <div className={cn('space-y-1.5', className)}>
      <div className="flex items-center justify-between gap-2">
        <Label className={cn('text-xs text-gray-500 font-normal', labelClassName)}>{label}</Label>
        <span
          className="shrink-0 rounded-md bg-muted px-2 py-0.5 text-xs font-medium tabular-nums text-muted-foreground"
          aria-live="polite"
        >
          {displayValue}
        </span>
      </div>
      <Slider
        value={[value]}
        onValueChange={(v) => onValueChange(v[0])}
        min={min}
        max={max}
        step={step}
      />
    </div>
  );
}
