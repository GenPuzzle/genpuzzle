'use client';

import React from 'react';
import {
  HEADER_SHAPES,
  normalizeHeaderAssemblySettings,
  type HeaderAssemblySettings,
  type HeaderEditorTarget,
  type HeaderNumberConfig,
  type HeaderShapeId,
  type HeaderSubtitleConfig,
  type HeaderTitleConfig,
} from '@/lib/header-assembly/types';
import { HeaderAssemblyBar } from '@/components/header/HeaderAssemblyBar';
import { HeaderShapePicker } from '@/components/header/HeaderShapePicker';
import { HeaderTargetPicker } from '@/components/header/HeaderTargetPicker';
import type { HeaderTextParts } from '@/lib/header-assembly/resolve-parts';
import { Label } from '@/components/ui/label';
import { SliderField } from '@/components/ui/slider-field';

const PREVIEW_PARTS: HeaderTextParts = {
  numberText: '1',
  titleText: 'Ocean Life',
  subtitleText: 'Did you know? The blue whale is the largest animal on Earth.',
  showNumber: true,
};

interface HeaderAssemblyEditorProps {
  value: HeaderAssemblySettings;
  onChange: (updates: Partial<HeaderAssemblySettings>) => void;
}

function MiniColorInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <Label className="text-xs text-gray-500 shrink-0">{label}</Label>
      <input
        type="color"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-7 w-10 cursor-pointer rounded border border-gray-200"
      />
    </div>
  );
}

const TARGET_LABELS: Record<HeaderEditorTarget, string> = {
  number: 'Number badge',
  title: 'Title bar',
  subtitle: 'Subtitle bar',
};

export function HeaderAssemblyEditor({ value, onChange }: HeaderAssemblyEditorProps) {
  const settings = normalizeHeaderAssemblySettings(value);
  const target = settings.editorTarget;

  const setTarget = (editorTarget: HeaderEditorTarget) => onChange({ editorTarget });

  const updateNumber = (patch: Partial<HeaderNumberConfig>) =>
    onChange({ number: { ...settings.number, ...patch } });
  const updateTitle = (patch: Partial<HeaderTitleConfig>) =>
    onChange({ title: { ...settings.title, ...patch } });
  const updateSubtitle = (patch: Partial<HeaderSubtitleConfig>) =>
    onChange({ subtitle: { ...settings.subtitle, ...patch } });

  const activeShapeId =
    target === 'number'
      ? settings.number.shapeId
      : target === 'title'
        ? settings.title.shapeId
        : settings.subtitle.shapeId;

  const onShapeSelect = (shapeId: HeaderShapeId) => {
    if (target === 'number') updateNumber({ shapeId });
    else if (target === 'title') updateTitle({ shapeId });
    else updateSubtitle({ shapeId });
  };

  const shapeDef = HEADER_SHAPES.find((s) => s.id === activeShapeId);
  const shapePickerVariant = target === 'number' ? 'number' : 'title-subtitle';

  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-gray-200 dark:border-slate-600 overflow-hidden bg-white mb-1">
        <div className="p-2 pointer-events-none" style={{ transform: 'scale(0.95)', transformOrigin: 'top center' }}>
          <HeaderAssemblyBar
            parts={PREVIEW_PARTS}
            settings={settings}
            headerWidthPt={170}
            titleFontSizePt={11}
            subtitleFontSizePt={7}
            subtitleLines={['Did you know? The blue whale…']}
            titleColor="#000000"
            subtitleColor="#6b7280"
            fontFamily="Arial"
            subtitleTextWidthPt={170}
            ptToPx={(pt) => pt * 0.52}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label className="text-xs text-gray-500">Edit element</Label>
        <HeaderTargetPicker selected={target} onSelect={setTarget} />
      </div>

      <div className="space-y-2">
        <Label className="text-xs text-gray-500">{TARGET_LABELS[target]} shape</Label>
        <HeaderShapePicker
          variant={shapePickerVariant}
          selected={activeShapeId}
          onSelect={onShapeSelect}
        />
        {shapeDef && (
          <p className="text-[10px] text-gray-400 leading-tight text-center">{shapeDef.description}</p>
        )}
      </div>

      {target === 'number' && (
        <div className="space-y-2 p-2 rounded-lg bg-white dark:bg-slate-800/50 border border-gray-100 dark:border-slate-700">
          <Label className="text-xs font-medium text-gray-600 dark:text-gray-300">Number style</Label>
          <div className="grid grid-cols-2 gap-2">
            <MiniColorInput label="Fill" value={settings.number.fillColor} onChange={(v) => updateNumber({ fillColor: v })} />
            <MiniColorInput label="Border" value={settings.number.borderColor} onChange={(v) => updateNumber({ borderColor: v })} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <MiniColorInput label="Text" value={settings.number.textColor} onChange={(v) => updateNumber({ textColor: v })} />
          </div>
          <SliderField label="Border Thickness" value={settings.number.borderThicknessPx} onValueChange={(v) => updateNumber({ borderThicknessPx: v })} min={0} max={8} step={1} format="px" />
          {activeShapeId === 'polygon' && (
            <SliderField
              label="Polygon Sides"
              value={settings.number.polygonSides}
              onValueChange={(v) => updateNumber({ polygonSides: v })}
              min={3}
              max={12}
              step={1}
            />
          )}
        </div>
      )}

      {target === 'title' && (
        <div className="space-y-2 p-2 rounded-lg bg-white dark:bg-slate-800/50 border border-gray-100 dark:border-slate-700">
          <Label className="text-xs font-medium text-gray-600 dark:text-gray-300">Title style</Label>
          <div className="grid grid-cols-2 gap-2">
            <MiniColorInput label="Fill" value={settings.title.fillColor} onChange={(v) => updateTitle({ fillColor: v })} />
            <MiniColorInput label="Border" value={settings.title.borderColor} onChange={(v) => updateTitle({ borderColor: v })} />
          </div>
          <SliderField label="Border Thickness" value={settings.title.borderThicknessPx} onValueChange={(v) => updateTitle({ borderThicknessPx: v })} min={0} max={8} step={1} format="px" />
          {activeShapeId === 'rounded-rect' && (
            <SliderField
              label="Rounded Corners"
              value={settings.title.borderRadiusPx}
              onValueChange={(v) => updateTitle({ borderRadiusPx: v })}
              min={0}
              max={40}
              step={1}
              format="px"
            />
          )}
        </div>
      )}

      {target === 'subtitle' && (
        <div className="space-y-2 p-2 rounded-lg bg-white dark:bg-slate-800/50 border border-gray-100 dark:border-slate-700">
          <Label className="text-xs font-medium text-gray-600 dark:text-gray-300">Subtitle style</Label>
          <div className="grid grid-cols-2 gap-2">
            <MiniColorInput label="Fill" value={settings.subtitle.fillColor} onChange={(v) => updateSubtitle({ fillColor: v })} />
            <MiniColorInput label="Border" value={settings.subtitle.borderColor} onChange={(v) => updateSubtitle({ borderColor: v })} />
          </div>
          <SliderField label="Border Thickness" value={settings.subtitle.borderThicknessPx} onValueChange={(v) => updateSubtitle({ borderThicknessPx: v })} min={0} max={8} step={1} format="px" />
          {activeShapeId === 'rounded-rect' && (
            <SliderField
              label="Rounded Corners"
              value={settings.subtitle.borderRadiusPx}
              onValueChange={(v) => updateSubtitle({ borderRadiusPx: v })}
              min={0}
              max={40}
              step={1}
              format="px"
            />
          )}
          <SliderField
            label="Border Opacity"
            value={settings.subtitle.borderOpacity}
            onValueChange={(v) => updateSubtitle({ borderOpacity: v })}
            min={0}
            max={100}
            step={5}
            format="%"
          />
        </div>
      )}
    </div>
  );
}
