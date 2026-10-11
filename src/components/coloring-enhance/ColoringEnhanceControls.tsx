'use client';

import React, { useEffect, useState } from 'react';
import { ChevronDown, RotateCcw, SlidersHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { COLORING_ENHANCE_PRESETS, coloringSettingsAreDefault } from '@/lib/coloring-enhance';
import type { ColoringEnhanceSettings } from '@/lib/coloring-enhance';
import { useColoringEnhance } from '@/lib/coloring-enhance-context';

const PRESETS: Array<{ id: keyof typeof COLORING_ENHANCE_PRESETS; label: string }> = [
  { id: 'balanced', label: 'Balanced' },
  { id: 'smooth', label: 'Smooth' },
  { id: 'soft', label: 'Soft' },
  { id: 'highDetail', label: 'High Detail' },
];

function ControlSlider({
  label,
  value,
  onValueChange,
  disabled,
}: {
  label: string;
  value: number;
  onValueChange: (value: number) => void;
  disabled?: boolean;
}) {
  const [draft, setDraft] = useState(String(value));

  useEffect(() => {
    setDraft(String(value));
  }, [value]);

  const commit = (raw: string) => {
    const parsed = Number.parseInt(raw.replace(/[^\d-]/g, ''), 10);
    if (Number.isNaN(parsed)) {
      setDraft(String(value));
      return;
    }
    const next = Math.max(0, Math.min(100, parsed));
    setDraft(String(next));
    if (next !== value) onValueChange(next);
  };

  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium text-slate-600 dark:text-slate-300">{label}</Label>
      <div className="flex items-center gap-2">
        <Slider
          className="min-w-0 flex-1"
          value={[value]}
          onValueChange={(next) => onValueChange(next[0])}
          min={0}
          max={100}
          step={1}
          disabled={disabled}
        />
        <Input
          type="text"
          inputMode="numeric"
          aria-label={`${label} value`}
          disabled={disabled}
          value={draft}
          onChange={(event) => {
            setDraft(event.target.value);
            const trimmed = event.target.value.trim();
            if (!/^\d{1,3}$/.test(trimmed)) return;
            const parsed = Number.parseInt(trimmed, 10);
            if (parsed >= 0 && parsed <= 100) onValueChange(parsed);
          }}
          onBlur={() => commit(draft)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              commit(draft);
              event.currentTarget.blur();
            }
          }}
          className="h-8 w-14 shrink-0 px-1.5 text-center text-xs font-semibold tabular-nums"
        />
      </div>
    </div>
  );
}

export function ColoringEnhanceControls() {
  const { settings, settingsDirty, setSetting, applyPreset, resetSettings, applySettings, busy, items } =
    useColoringEnhance();
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const usingDefault = coloringSettingsAreDefault(settings);

  return (
    <div className="border-b border-slate-200 dark:border-slate-800">
      <button
        type="button"
        className="flex w-full items-center justify-between px-3 py-2.5 text-left"
        onClick={() => setAdvancedOpen((open) => !open)}
      >
        <span className="flex items-center gap-2">
          <SlidersHorizontal className="h-3.5 w-3.5 text-slate-500" />
          <span className="text-xs font-bold uppercase tracking-wide text-slate-700 dark:text-slate-200">
            Advanced settings
          </span>
        </span>
        <ChevronDown className={`h-3.5 w-3.5 text-slate-500 transition-transform ${advancedOpen ? 'rotate-180' : ''}`} />
      </button>
      {advancedOpen ? (
        <div className="space-y-3 px-3 pb-3">
          <p className="text-[11px] leading-relaxed text-slate-500">
            Adjust the values, then click Apply Settings to reprocess the images.
          </p>

          <ControlSlider
            label="Smoothness"
            value={settings.smoothness}
            onValueChange={(value) => setSetting('smoothness', value)}
            disabled={busy}
          />
          <ControlSlider
            label="Softness"
            value={settings.softness}
            onValueChange={(value) => setSetting('softness', value)}
            disabled={busy}
          />
          <ControlSlider
            label="Detail Preservation"
            value={settings.detail}
            onValueChange={(value) => setSetting('detail', value)}
            disabled={busy}
          />
          <ControlSlider
            label="Gap Preservation"
            value={settings.gapPreservation}
            onValueChange={(value) => setSetting('gapPreservation', value)}
            disabled={busy}
          />
          <ControlSlider
            label="Line Weight"
            value={settings.lineWeight}
            onValueChange={(value) => setSetting('lineWeight', value)}
            disabled={busy}
          />

          <div className="flex flex-wrap gap-1">
            {PRESETS.map((preset) => (
              <Button
                key={preset.id}
                type="button"
                size="xs"
                variant={isPresetActive(settings, preset.id) ? 'default' : 'outline'}
                disabled={busy}
                onClick={() => applyPreset(preset.id)}
              >
                {preset.label}
              </Button>
            ))}
          </div>

          <div className="flex flex-wrap gap-1.5">
            <Button type="button" size="xs" variant="outline" disabled={busy || usingDefault} onClick={resetSettings}>
              <RotateCcw className="h-3 w-3" />
              Reset to Default
            </Button>
            <Button type="button" size="xs" disabled={busy || !items.length} onClick={() => void applySettings()}>
              Apply Settings
            </Button>
          </div>
          {settingsDirty && items.some((item) => item.status === 'done') ? (
            <p className="text-[11px] font-medium text-amber-700">Settings changed. Click Apply Settings to update the preview.</p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function isPresetActive(settings: ColoringEnhanceSettings, id: keyof typeof COLORING_ENHANCE_PRESETS): boolean {
  const preset = COLORING_ENHANCE_PRESETS[id];
  return (
    settings.smoothness === preset.smoothness &&
    settings.softness === preset.softness &&
    settings.detail === preset.detail &&
    settings.gapPreservation === preset.gapPreservation &&
    settings.lineWeight === preset.lineWeight
  );
}
