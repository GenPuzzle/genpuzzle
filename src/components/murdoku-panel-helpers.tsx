'use client';

import React from 'react';
import { Save } from 'lucide-react';
import { toast } from 'sonner';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { SliderField } from '@/components/ui/slider-field';
import { Button } from '@/components/ui/button';
import { MiniColorInput } from '@/components/ui/color-input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PUBLISHING_FONTS } from '@/lib/publishing-fonts';
import type { MurdokuSettings, MurdokuTextKey } from '@/lib/murdoku-settings';

export function MurdokuHeaderRow({ title, onSave }: { title: string; onSave?: () => void }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-wide text-sky-600 dark:text-sky-400">
          Document · This tab
        </p>
        <h3 className="font-semibold text-gray-900 dark:text-white">{title}</h3>
      </div>
      {onSave ? (
        <Button variant="outline" size="sm" onClick={onSave}>
          <Save className="w-4 h-4 mr-2" />Save
        </Button>
      ) : null}
    </div>
  );
}

export function MurdokuStatusPill({ label, ok }: { label: string; ok: boolean }) {
  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${
        ok ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
      }`}
    >
      {label}
    </span>
  );
}

export async function runMurdokuAi(label: string, fn: () => Promise<void>) {
  try {
    await fn();
    toast.success(label);
  } catch (error) {
    toast.error(error instanceof Error ? error.message : 'AI request failed');
  }
}

export function MurdokuTextStyleEditor({
  label,
  style,
  onChange,
}: {
  label: string;
  style: MurdokuSettings['textStyles'][MurdokuTextKey];
  onChange: (next: MurdokuSettings['textStyles'][MurdokuTextKey]) => void;
}) {
  return (
    <div className="rounded border p-2 space-y-2">
      <div className="flex items-center justify-between">
        <Label className="text-xs font-semibold capitalize">
          {label.replace(/[A-Z]/g, (m) => ` ${m}`)}
        </Label>
        <label className="flex items-center gap-1 text-[10px]">
          <Checkbox
            checked={style.visible}
            onCheckedChange={(c) => onChange({ ...style, visible: c === true })}
          />
          Show
        </label>
      </div>
      <Select value={style.fontFamily} onValueChange={(v) => onChange({ ...style, fontFamily: v })}>
        <SelectTrigger className="h-8">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {PUBLISHING_FONTS.map((font) => (
            <SelectItem key={font} value={font} style={{ fontFamily: font }}>
              {font}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <SliderField
        label="Font size"
        value={style.fontSize}
        onValueChange={(v) => onChange({ ...style, fontSize: v })}
        min={style.minFontSize || 8}
        max={48}
      />
      <SliderField
        label="Minimum font size"
        value={style.minFontSize}
        onValueChange={(v) => onChange({ ...style, minFontSize: v })}
        min={6}
        max={24}
      />
      <div className="flex gap-2 text-xs">
        <label className="flex items-center gap-1">
          <Checkbox checked={style.bold} onCheckedChange={(c) => onChange({ ...style, bold: c === true })} />
          Bold
        </label>
        <label className="flex items-center gap-1">
          <Checkbox checked={style.italic} onCheckedChange={(c) => onChange({ ...style, italic: c === true })} />
          Italic
        </label>
        <label className="flex items-center gap-1">
          <Checkbox
            checked={style.underline}
            onCheckedChange={(c) => onChange({ ...style, underline: c === true })}
          />
          Underline
        </label>
      </div>
      <MiniColorInput label="Text color" value={style.color} onChange={(v) => onChange({ ...style, color: v })} />
      <Select
        value={style.align}
        onValueChange={(v) => onChange({ ...style, align: v as typeof style.align })}
      >
        <SelectTrigger className="h-8">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="left">Left</SelectItem>
          <SelectItem value="center">Center</SelectItem>
          <SelectItem value="right">Right</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}

export function murdokuAiContext(settings: MurdokuSettings) {
  return {
    theme: settings.theme,
    story: settings.story,
    characters: settings.characters.map((c) => ({
      name: c.name,
      occupation: c.occupation,
      description: c.description,
    })),
    rooms: settings.rooms.map((r) => ({
      name: r.name,
      kind: r.roomKind,
      furniture: r.allowedFurniture,
      decor: r.allowedDecor,
      objects: r.allowedObjects,
      excluded: r.excludedItems,
    })),
    elements: settings.elements.map((e) => ({ name: e.name })),
    difficulty: settings.core.difficulty,
    avoidRandomProps: settings.core.avoidRandomProps !== false,
    useOnlyLargeFurniture: settings.core.useOnlyLargeFurniture === true,
  };
}
