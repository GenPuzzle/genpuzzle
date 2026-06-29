'use client';

import React from 'react';
import {
  HEADER_SHAPES,
  type HeaderNumberConfig,
  type HeaderShapeId,
} from '@/lib/header-assembly/types';
import { HeaderShapePicker } from '@/components/header/HeaderShapePicker';
import { Label } from '@/components/ui/label';
import { SliderField } from '@/components/ui/slider-field';

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

export function PageNumberShapeEditor({
  shape,
  textColor,
  fontFamily,
  fontSize,
  fontOptions,
  onShapeChange,
  onTextColorChange,
  onFontFamilyChange,
  onFontSizeChange,
}: {
  shape: HeaderNumberConfig;
  textColor: string;
  fontFamily: string;
  fontSize: number;
  fontOptions: string[];
  onShapeChange: (patch: Partial<HeaderNumberConfig>) => void;
  onTextColorChange: (v: string) => void;
  onFontFamilyChange: (v: string) => void;
  onFontSizeChange: (v: number) => void;
}) {
  const shapeDef = HEADER_SHAPES.find((s) => s.id === shape.shapeId);

  return (
    <div className="space-y-3 p-3 rounded-lg bg-white dark:bg-slate-800/50 border border-gray-100 dark:border-slate-700">
      <div className="space-y-2">
        <Label className="text-xs text-gray-500">Number badge shape</Label>
        <HeaderShapePicker
          variant="number"
          selected={shape.shapeId}
          onSelect={(shapeId: HeaderShapeId) => onShapeChange({ shapeId })}
        />
        {shapeDef && (
          <p className="text-[10px] text-gray-400 leading-tight text-center">{shapeDef.description}</p>
        )}
      </div>

      <div className="space-y-2 pt-1 border-t border-gray-100 dark:border-slate-700">
        <Label className="text-xs font-medium text-gray-600 dark:text-gray-300">Badge style</Label>
        <div className="grid grid-cols-2 gap-2">
          <MiniColorInput
            label="Fill"
            value={shape.fillColor}
            onChange={(v) => onShapeChange({ fillColor: v })}
          />
          <MiniColorInput
            label="Border"
            value={shape.borderColor}
            onChange={(v) => onShapeChange({ borderColor: v })}
          />
        </div>
        <SliderField
          label="Border Thickness"
          value={shape.borderThicknessPx}
          onValueChange={(v) => onShapeChange({ borderThicknessPx: v })}
          min={0}
          max={8}
          step={1}
          format="px"
        />
        {shape.shapeId === 'polygon' && (
          <SliderField
            label="Polygon Sides"
            value={shape.polygonSides}
            onValueChange={(v) => onShapeChange({ polygonSides: v })}
            min={3}
            max={12}
            step={1}
          />
        )}
      </div>

      <div className="pt-2 border-t border-gray-100 dark:border-slate-700 space-y-2">
        <Label className="text-xs font-medium text-gray-600 dark:text-gray-300">Number text</Label>
        <MiniColorInput label="Text Color" value={textColor} onChange={onTextColorChange} />
        <div>
          <Label className="text-xs text-gray-500">Font</Label>
          <select
            value={fontFamily}
            onChange={(e) => onFontFamilyChange(e.target.value)}
            className="mt-1 w-full h-9 rounded-md border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm px-2"
          >
            {fontOptions.map((font) => (
              <option key={font} value={font} style={{ fontFamily: font }}>
                {font}
              </option>
            ))}
          </select>
        </div>
        <SliderField
          label="Font Size"
          value={fontSize}
          onValueChange={onFontSizeChange}
          min={8}
          max={48}
          step={1}
          format="px"
        />
      </div>
    </div>
  );
}
