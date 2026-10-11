'use client';

import React, { useEffect, useRef, useState } from 'react';
import {
  Bold,
  FlipHorizontal,
  FlipVertical,
  ImagePlus,
  Italic,
  RotateCcw,
  RotateCw,
  Shapes,
  Trash2,
  Type,
} from 'lucide-react';
import { MiniColorInput } from '@/components/ui/color-input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  CANVAS_SHAPE_LABELS,
  CANVAS_SHAPE_TYPES,
  type CanvasShapeType,
} from '@/lib/canvas-shapes';
import type { CanvasFormatTarget, NativeCanvasFont, NativeCanvasPatch } from '@/lib/canvas-native-format';
import {
  NUMBER_HEADER_SHAPES,
  TITLE_SUBTITLE_HEADER_SHAPES,
  type HeaderShapeId,
} from '@/lib/header-assembly/types';
import {
  isImagePageVariable,
  isShapePageVariable,
  isSinglePageVariable,
  isTextPageVariable,
  type PageVariableField,
  type PageVariableKind,
  type PageVariableScope,
} from '@/lib/page-variables';
import { PUBLISHING_FONTS, selectPublishingFont } from '@/lib/publishing-fonts';
import { TEXT_EFFECT_LABELS, TEXT_EFFECT_STYLES, type TextEffectStyle } from '@/lib/text-effects';
import { cn } from '@/lib/utils';
import './canvas-format-bar.css';

const TEXT_INSERT_OPTIONS: Array<{
  kind: PageVariableKind;
  scope: PageVariableScope;
  label: string;
  hint: string;
}> = [
  { kind: 'text', scope: 'single', label: 'Add text', hint: 'This page only' },
  { kind: 'text', scope: 'document', label: 'Variable text', hint: 'Every puzzle page' },
];

const IMAGE_INSERT_OPTIONS: Array<{
  kind: PageVariableKind;
  scope: PageVariableScope;
  label: string;
  hint: string;
}> = [
  { kind: 'image', scope: 'single', label: 'Single image', hint: 'This page only' },
  { kind: 'image', scope: 'document', label: 'Image variables', hint: 'Every puzzle page' },
];

export type HeaderCanvasShapeSelection = {
  variant: 'number' | 'title-subtitle';
  shapeId: HeaderShapeId;
  fillColor: string;
  borderColor: string;
  borderThicknessPx: number;
  borderRadiusPx?: number;
  polygonSides?: number;
};

export type HeaderCanvasShapePatch = {
  shapeId?: HeaderShapeId;
  fillColor?: string;
  borderColor?: string;
  borderThicknessPx?: number;
  borderRadiusPx?: number;
  polygonSides?: number;
};

export type CanvasBarSelection =
  | { source: 'variable'; field: PageVariableField }
  | {
      source: 'native';
      target: CanvasFormatTarget;
      font: NativeCanvasFont;
      headerShape?: HeaderCanvasShapeSelection | null;
    }
  | { source: 'front-matter'; label: string; font: NativeCanvasFont };

export function CanvasFormatBar({
  selection,
  onPatchVariable,
  onPatchNative,
  onPatchHeaderShape,
  onDeleteSelected,
  onChooseInsert,
  onChooseShape,
  onEditContent,
  disabled,
}: {
  selection: CanvasBarSelection | null;
  onPatchVariable: (patch: Partial<PageVariableField>) => void;
  onPatchNative: (patch: NativeCanvasPatch) => void;
  onPatchHeaderShape?: (patch: HeaderCanvasShapePatch) => void;
  onDeleteSelected: () => void;
  onChooseInsert: (kind: PageVariableKind, scope: PageVariableScope) => void;
  onChooseShape: (shape: CanvasShapeType) => void;
  onEditContent?: () => void;
  disabled?: boolean;
}) {
  const [textOpen, setTextOpen] = useState(false);
  const [imageOpen, setImageOpen] = useState(false);
  const [shapesOpen, setShapesOpen] = useState(false);
  const textRef = useRef<HTMLDivElement | null>(null);
  const imageRef = useRef<HTMLDivElement | null>(null);
  const shapesRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const onDoc = (event: MouseEvent) => {
      if (!textRef.current?.contains(event.target as Node)) setTextOpen(false);
      if (!imageRef.current?.contains(event.target as Node)) setImageOpen(false);
      if (!shapesRef.current?.contains(event.target as Node)) setShapesOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const field = selection?.source === 'variable' ? selection.field : null;
  const native =
    selection?.source === 'native' || selection?.source === 'front-matter'
      ? selection.font
      : null;
  const headerShape =
    selection?.source === 'native' ? selection.headerShape ?? null : null;
  const showText =
    (!!(field && (isTextPageVariable(field.kind) || isShapePageVariable(field.kind))) ||
      !!native) &&
    !(
      selection?.source === 'native' &&
      (selection.target === 'maze-start' || selection.target === 'maze-end')
    );
  const showImage = !!(field && isImagePageVariable(field.kind));
  const showShape = !!(field && isShapePageVariable(field.kind));
  const showHeaderShape = !!headerShape && !!onPatchHeaderShape;
  const headerShapeOptions =
    headerShape?.variant === 'number' ? NUMBER_HEADER_SHAPES : TITLE_SUBTITLE_HEADER_SHAPES;
  const fontFamily = field?.fontFamily ?? native?.fontFamily ?? 'Arial';
  const fontSize = field?.fontSize ?? native?.fontSize ?? 16;
  const fontColor = field?.color ?? native?.color ?? '#111111';
  const fontBold = field ? !!field.bold : !!native?.bold;
  const fontItalic = field ? !!field.italic : !!native?.italic;
  const fontAlign = field?.align ?? native?.align ?? 'center';
  const fontEffect = field?.textEffect ?? native?.textEffect ?? 'none';
  const textMenuOptions =
    field && isShapePageVariable(field.kind)
      ? [
          {
            kind: 'text' as const,
            scope: 'single' as const,
            label: 'Single text on shape',
            hint: 'Type on this shape',
          },
          {
            kind: 'text' as const,
            scope: 'document' as const,
            label: 'Variable text on shape',
            hint: 'Different text per page',
          },
        ]
      : TEXT_INSERT_OPTIONS;

  const patchFont = (patch: NativeCanvasPatch) => {
    if (field) {
      onPatchVariable(patch);
      return;
    }
    onPatchNative(patch);
  };

  return (
    <div className="canvas-format-bar">
      <div className="canvas-format-bar__menu" ref={textRef}>
        <button
          type="button"
          className={cn('canvas-format-bar__btn', textOpen && 'canvas-format-bar__btn--active')}
          disabled={disabled}
          onClick={() => {
            setTextOpen((open) => !open);
            setImageOpen(false);
            setShapesOpen(false);
          }}
        >
          <Type className="h-3.5 w-3.5" />
          Text
        </button>
        {textOpen ? (
          <div className="canvas-format-bar__menu-list" role="menu">
            {textMenuOptions.map((option) => (
              <button
                key={`${option.kind}-${option.scope}`}
                type="button"
                className="canvas-format-bar__menu-item"
                role="menuitem"
                onClick={() => {
                  setTextOpen(false);
                  onChooseInsert(option.kind, option.scope);
                }}
              >
                <span className="canvas-format-bar__menu-item-title">{option.label}</span>
                <span className="canvas-format-bar__menu-item-hint">{option.hint}</span>
              </button>
            ))}
          </div>
        ) : null}
      </div>

      <div className="canvas-format-bar__menu" ref={imageRef}>
        <button
          type="button"
          className={cn('canvas-format-bar__btn', imageOpen && 'canvas-format-bar__btn--active')}
          disabled={disabled}
          onClick={() => {
            setImageOpen((open) => !open);
            setTextOpen(false);
            setShapesOpen(false);
          }}
        >
          <ImagePlus className="h-3.5 w-3.5" />
          Image
        </button>
        {imageOpen ? (
          <div className="canvas-format-bar__menu-list" role="menu">
            {IMAGE_INSERT_OPTIONS.map((option) => (
              <button
                key={`${option.kind}-${option.scope}`}
                type="button"
                className="canvas-format-bar__menu-item"
                role="menuitem"
                onClick={() => {
                  setImageOpen(false);
                  onChooseInsert(option.kind, option.scope);
                }}
              >
                <span className="canvas-format-bar__menu-item-title">{option.label}</span>
                <span className="canvas-format-bar__menu-item-hint">{option.hint}</span>
              </button>
            ))}
          </div>
        ) : null}
      </div>

      <div className="canvas-format-bar__menu" ref={shapesRef}>
        <button
          type="button"
          className={cn('canvas-format-bar__btn', shapesOpen && 'canvas-format-bar__btn--active')}
          disabled={disabled}
          onClick={() => {
            setShapesOpen((open) => !open);
            setTextOpen(false);
            setImageOpen(false);
          }}
        >
          <Shapes className="h-3.5 w-3.5" />
          Shapes
        </button>
        {shapesOpen ? (
          <div className="canvas-format-bar__menu-list canvas-format-bar__menu-list--wide" role="menu">
            {CANVAS_SHAPE_TYPES.map((shape) => (
              <button
                key={shape}
                type="button"
                className="canvas-format-bar__menu-item"
                role="menuitem"
                onClick={() => {
                  setShapesOpen(false);
                  onChooseShape(shape);
                }}
              >
                {CANVAS_SHAPE_LABELS[shape]}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      {!selection ? (
        <span className="canvas-format-bar__hint">
          Click text, a grid, an image, or a shape — or insert one
        </span>
      ) : selection.source === 'native' ? (
        <span className="canvas-format-bar__hint">
          {selection.target.replace(/-/g, ' ')} selected
        </span>
      ) : selection.source === 'front-matter' ? (
        <span className="canvas-format-bar__hint">{selection.label} selected</span>
      ) : field ? (
        <span className="canvas-format-bar__hint">
          {isSinglePageVariable(field) ? 'This page' : 'Every page'}
        </span>
      ) : null}

      {showText ? (
        <div className="canvas-format-bar__group">
          <Type className="h-3.5 w-3.5 text-slate-500" />
          <span className="canvas-format-bar__label">Font</span>
          <Select
            value={selectPublishingFont(fontFamily)}
            onValueChange={(next) => patchFont({ fontFamily: next })}
          >
            <SelectTrigger className="h-7 w-[8.5rem] text-[11px]">
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
          <input
            type="number"
            min={8}
            max={96}
            value={Math.round(fontSize)}
            onChange={(event) => patchFont({ fontSize: Number(event.target.value) })}
            aria-label="Font size"
          />
          <button
            type="button"
            className={cn('canvas-format-bar__btn', fontBold && 'canvas-format-bar__btn--active')}
            onClick={() => patchFont({ bold: !fontBold })}
            aria-label="Bold"
          >
            <Bold className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            className={cn('canvas-format-bar__btn', fontItalic && 'canvas-format-bar__btn--active')}
            onClick={() => patchFont({ italic: !fontItalic })}
            aria-label="Italic"
          >
            <Italic className="h-3.5 w-3.5" />
          </button>
          <MiniColorInput
            label="Color"
            value={fontColor}
            onChange={(color) => patchFont({ color })}
          />
          <Select
            value={fontAlign}
            onValueChange={(align) =>
              patchFont({ align: align as NativeCanvasFont['align'] })
            }
          >
            <SelectTrigger className="h-7 w-[5.5rem] text-[11px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="left">Left</SelectItem>
              <SelectItem value="center">Center</SelectItem>
              <SelectItem value="right">Right</SelectItem>
            </SelectContent>
          </Select>
          <Select
            value={fontEffect}
            onValueChange={(style) =>
              patchFont({ textEffect: style as TextEffectStyle })
            }
          >
            <SelectTrigger className="h-7 w-[8.5rem] text-[11px]">
              <SelectValue placeholder="3D style" />
            </SelectTrigger>
            <SelectContent>
              {TEXT_EFFECT_STYLES.map((style) => (
                <SelectItem key={style} value={style}>
                  {TEXT_EFFECT_LABELS[style]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ) : null}

      {(showShape || showHeaderShape) ? (
        <div className="canvas-format-bar__group">
          <span className="canvas-format-bar__label">Shape</span>
          {showShape ? (
            <>
              <Select
                value={field?.shapeType ?? 'roundRect'}
                onValueChange={(shapeType) =>
                  onPatchVariable({ shapeType: shapeType as CanvasShapeType })
                }
              >
                <SelectTrigger className="h-7 w-[9rem] text-[11px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CANVAS_SHAPE_TYPES.map((shape) => (
                    <SelectItem key={shape} value={shape}>
                      {CANVAS_SHAPE_LABELS[shape]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <MiniColorInput
                label="Fill"
                value={field?.fill ?? '#dbeafe'}
                onChange={(fill) => onPatchVariable({ fill })}
              />
              <MiniColorInput
                label="Line"
                value={field?.stroke ?? '#1d4ed8'}
                onChange={(stroke) => onPatchVariable({ stroke })}
              />
              <span className="canvas-format-bar__hint">Wt</span>
              <input
                type="number"
                min={0}
                max={12}
                step={0.25}
                value={field?.strokeWidth ?? 1.25}
                onChange={(event) =>
                  onPatchVariable({ strokeWidth: Number(event.target.value) })
                }
                aria-label="Line weight"
              />
              {(field?.shapeType ?? 'roundRect') === 'roundRect' ? (
                <>
                  <span className="canvas-format-bar__hint">Radius</span>
                  <input
                    type="number"
                    min={0}
                    max={80}
                    step={1}
                    value={field?.cornerRadiusPx ?? 12}
                    onChange={(event) =>
                      onPatchVariable({ cornerRadiusPx: Number(event.target.value) })
                    }
                    aria-label="Corner radius"
                  />
                </>
              ) : null}
            </>
          ) : null}
          {showHeaderShape && headerShape ? (
            <>
              <Select
                value={headerShape.shapeId}
                onValueChange={(shapeId) =>
                  onPatchHeaderShape?.({ shapeId: shapeId as HeaderShapeId })
                }
              >
                <SelectTrigger className="h-7 w-[9rem] text-[11px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {headerShapeOptions.map((shape) => (
                    <SelectItem key={shape.id} value={shape.id}>
                      {shape.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <MiniColorInput
                label="Fill"
                value={headerShape.fillColor}
                onChange={(fillColor) => onPatchHeaderShape?.({ fillColor })}
              />
              <MiniColorInput
                label="Line"
                value={headerShape.borderColor}
                onChange={(borderColor) => onPatchHeaderShape?.({ borderColor })}
              />
              <span className="canvas-format-bar__hint">Wt</span>
              <input
                type="number"
                min={0}
                max={8}
                step={1}
                value={headerShape.borderThicknessPx}
                onChange={(event) =>
                  onPatchHeaderShape?.({ borderThicknessPx: Number(event.target.value) })
                }
                aria-label="Line weight"
              />
              {headerShape.variant === 'title-subtitle' &&
              headerShape.shapeId === 'rounded-rect' ? (
                <>
                  <span className="canvas-format-bar__hint">Radius</span>
                  <input
                    type="number"
                    min={0}
                    max={40}
                    step={1}
                    value={headerShape.borderRadiusPx ?? 8}
                    onChange={(event) =>
                      onPatchHeaderShape?.({ borderRadiusPx: Number(event.target.value) })
                    }
                    aria-label="Corner radius"
                  />
                </>
              ) : null}
              {headerShape.variant === 'number' && headerShape.shapeId === 'polygon' ? (
                <>
                  <span className="canvas-format-bar__hint">Sides</span>
                  <input
                    type="number"
                    min={3}
                    max={12}
                    step={1}
                    value={headerShape.polygonSides ?? 6}
                    onChange={(event) =>
                      onPatchHeaderShape?.({ polygonSides: Number(event.target.value) })
                    }
                    aria-label="Polygon sides"
                  />
                </>
              ) : null}
            </>
          ) : null}
        </div>
      ) : null}

      {showImage || showShape ? (
        <div className="canvas-format-bar__group">
          <span className="canvas-format-bar__label">{showImage ? 'Image' : 'Size'}</span>
          <span className="canvas-format-bar__hint">W</span>
          <input
            type="number"
            min={2}
            max={100}
            value={Math.round(field?.widthPercent ?? 20)}
            onChange={(event) =>
              onPatchVariable({ widthPercent: Number(event.target.value) })
            }
            aria-label="Width percent"
          />
          <span className="canvas-format-bar__hint">H</span>
          <input
            type="number"
            min={2}
            max={100}
            value={Math.round(field?.heightPercent ?? 16)}
            onChange={(event) =>
              onPatchVariable({ heightPercent: Number(event.target.value) })
            }
            aria-label="Height percent"
          />
          <button
            type="button"
            className="canvas-format-bar__btn"
            onClick={() =>
              onPatchVariable({ rotationDeg: (field?.rotationDeg ?? 0) - 90 })
            }
            aria-label="Rotate left"
          >
            <RotateCcw className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            className="canvas-format-bar__btn"
            onClick={() =>
              onPatchVariable({ rotationDeg: (field?.rotationDeg ?? 0) + 90 })
            }
            aria-label="Rotate right"
          >
            <RotateCw className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            className={cn(
              'canvas-format-bar__btn',
              field?.flipH && 'canvas-format-bar__btn--active'
            )}
            onClick={() => onPatchVariable({ flipH: !field?.flipH })}
            aria-label="Flip horizontal"
          >
            <FlipHorizontal className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            className={cn(
              'canvas-format-bar__btn',
              field?.flipV && 'canvas-format-bar__btn--active'
            )}
            onClick={() => onPatchVariable({ flipV: !field?.flipV })}
            aria-label="Flip vertical"
          >
            <FlipVertical className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : null}

      {field && onEditContent && !isShapePageVariable(field.kind) ? (
        <button type="button" className="canvas-format-bar__btn" onClick={onEditContent}>
          {isImagePageVariable(field.kind)
            ? isSinglePageVariable(field)
              ? 'Replace image'
              : 'Edit images'
            : isSinglePageVariable(field)
              ? 'Edit text'
              : 'Edit texts'}
        </button>
      ) : null}
      {field && isShapePageVariable(field.kind) && onEditContent && !isSinglePageVariable(field) ? (
        <button type="button" className="canvas-format-bar__btn" onClick={onEditContent}>
          Edit shape texts
        </button>
      ) : null}

      {field ? (
        <button
          type="button"
          className="canvas-format-bar__btn"
          onClick={onDeleteSelected}
          aria-label="Delete"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      ) : null}
    </div>
  );
}
