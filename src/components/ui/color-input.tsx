'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { HexAlphaColorPicker } from 'react-colorful';
import { Pipette } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import {
  formatRgbaHex,
  formatRgbHex,
  parseRgba,
  type RgbaColor,
} from '@/lib/color-utils';

function toPickerHex(color: RgbaColor): string {
  return `${formatRgbHex(color)}${color.a.toString(16).padStart(2, '0')}`.toLowerCase();
}

function ColorPickerPanel({
  value,
  onChange,
}: {
  value: string;
  onChange: (next: string) => void;
}) {
  const parsed = useMemo(() => parseRgba(value), [value]);
  const pickerHex = useMemo(() => toPickerHex(parsed), [parsed]);
  const [hexDraft, setHexDraft] = useState(() => formatRgbaHex(parsed));

  useEffect(() => {
    setHexDraft(formatRgbaHex(parseRgba(value)));
  }, [value]);

  const commit = (next: RgbaColor) => {
    const hex = formatRgbaHex(next);
    setHexDraft(hex);
    onChange(hex);
  };

  const setChannel = (key: 'r' | 'g' | 'b' | 'a', n: number) => {
    commit({ ...parsed, [key]: n });
  };

  const pickFromScreen = async () => {
    const EyeDropperCtor = (
      window as unknown as {
        EyeDropper?: new () => { open: () => Promise<{ sRGBHex: string }> };
      }
    ).EyeDropper;
    if (!EyeDropperCtor) return;
    try {
      const result = await new EyeDropperCtor().open();
      commit({ ...parseRgba(result.sRGBHex), a: parsed.a });
    } catch {
      // cancelled
    }
  };

  return (
    <div className="w-[240px] space-y-3 p-1">
      <div className="[&_.react-colorful]:!w-full [&_.react-colorful]:!h-[160px]">
        <HexAlphaColorPicker
          color={pickerHex}
          onChange={(hex) => commit(parseRgba(hex))}
        />
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => void pickFromScreen()}
          className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-input bg-background text-muted-foreground hover:bg-accent"
          title="Eyedropper"
          aria-label="Eyedropper"
        >
          <Pipette className="h-4 w-4" />
        </button>
        <div
          className="h-8 w-8 shrink-0 rounded-full border border-black/10"
          style={{
            backgroundImage:
              'linear-gradient(45deg, #ccc 25%, transparent 25%), linear-gradient(-45deg, #ccc 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #ccc 75%), linear-gradient(-45deg, transparent 75%, #ccc 75%)',
            backgroundSize: '8px 8px',
            backgroundPosition: '0 0, 0 4px, 4px -4px, -4px 0',
          }}
          aria-hidden
        >
          <div
            className="h-full w-full rounded-full"
            style={{
              backgroundColor: `rgba(${parsed.r},${parsed.g},${parsed.b},${parsed.a / 255})`,
            }}
          />
        </div>
        <Input
          value={hexDraft}
          onChange={(e) => {
            const v = e.target.value.trim();
            setHexDraft(v);
            if (/^#?[a-f\d]{6}([a-f\d]{2})?$/i.test(v) || /^#?[a-f\d]{3,4}$/i.test(v)) {
              onChange(formatRgbaHex(parseRgba(v)));
            }
          }}
          onBlur={() => {
            const normalized = formatRgbaHex(parseRgba(hexDraft, formatRgbHex(parsed)));
            setHexDraft(normalized);
            onChange(normalized);
          }}
          className="h-8 flex-1 font-mono text-xs uppercase"
          spellCheck={false}
        />
      </div>

      {/* R G B A — A after B */}
      <div className="flex items-end gap-1.5">
        {(['r', 'g', 'b', 'a'] as const).map((key) => (
          <div key={key} className="flex flex-1 flex-col items-center gap-0.5 min-w-0">
            <Input
              type="number"
              min={0}
              max={255}
              value={parsed[key]}
              onChange={(e) => {
                const n = Number(e.target.value);
                if (!Number.isFinite(n)) return;
                setChannel(key, Math.max(0, Math.min(255, Math.round(n))));
              }}
              className="h-8 px-1 text-center text-xs font-mono tabular-nums"
            />
            <span className="text-[10px] font-medium text-muted-foreground leading-none uppercase">
              {key}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export const ColorSwatchButton = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement> & { value: string }
>(function ColorSwatchButton({ value, className, style, ...props }, ref) {
  const c = parseRgba(value);
  return (
    <button
      ref={ref}
      type="button"
      className={cn(
        'relative overflow-hidden rounded-md border border-input shadow-sm disabled:opacity-50',
        className
      )}
      style={{
        backgroundImage:
          'linear-gradient(45deg, #ccc 25%, transparent 25%), linear-gradient(-45deg, #ccc 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #ccc 75%), linear-gradient(-45deg, transparent 75%, #ccc 75%)',
        backgroundSize: '8px 8px',
        backgroundPosition: '0 0, 0 4px, 4px -4px, -4px 0',
        ...style,
      }}
      {...props}
    >
      <span
        className="absolute inset-0"
        style={{ backgroundColor: `rgba(${c.r},${c.g},${c.b},${c.a / 255})` }}
      />
    </button>
  );
});
ColorSwatchButton.displayName = 'ColorSwatchButton';

function ColorField({
  label,
  value,
  onChange,
  disabled = false,
  layout = 'row',
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  /** `card` = sidebar Color Settings style; `row` = compact Highlight-fill style */
  layout?: 'card' | 'row';
}) {
  const fullHex = formatRgbaHex(parseRgba(value));

  const swatch = (
    <Popover>
      <PopoverTrigger asChild>
        <ColorSwatchButton
          value={fullHex}
          disabled={disabled}
          className={
            layout === 'card'
              ? 'h-10 w-14 shrink-0 border-2 border-blue-300 dark:border-slate-500 rounded-lg hover:shadow-lg transition-shadow'
              : 'h-7 w-10 cursor-pointer rounded border border-gray-200'
          }
          title={`${label} color`}
          aria-label={label}
        />
      </PopoverTrigger>
      <PopoverContent
        className="z-[200] w-auto p-3"
        align={layout === 'card' ? 'start' : 'end'}
        sideOffset={6}
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <ColorPickerPanel value={fullHex} onChange={onChange} />
      </PopoverContent>
    </Popover>
  );

  if (layout === 'card') {
    return (
      <div
        className={cn(
          'flex items-center gap-3 p-3 rounded-lg border transition-all duration-200',
          disabled && 'opacity-50 pointer-events-none'
        )}
        style={{ background: 'linear-gradient(to right, #F0F5F6, #F0F5F6)' }}
      >
        <div className="flex-1 min-w-0">
          <Label
            className={cn(
              'text-sm font-medium',
              disabled ? 'text-gray-400' : 'text-gray-700 dark:text-gray-200'
            )}
          >
            {label}
          </Label>
          <div className="mt-1 flex items-center gap-2">{swatch}</div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        'flex items-center justify-between gap-2',
        disabled && 'opacity-50 pointer-events-none'
      )}
    >
      <Label className="text-xs text-gray-500 shrink-0">{label}</Label>
      {swatch}
    </div>
  );
}

/** Sidebar Color Settings — same RGBA picker as Highlight fill. */
export function ColorInput({
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
    <ColorField
      label={label}
      value={value}
      onChange={onChange}
      disabled={disabled}
      layout="card"
    />
  );
}

/** Compact control (canvas edit / Highlight fill style). */
export function MiniColorInput({
  label,
  value,
  onChange,
  disabled = false,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  return (
    <ColorField
      label={label}
      value={value}
      onChange={onChange}
      disabled={disabled}
      layout="row"
    />
  );
}
