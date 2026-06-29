'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import {
  NUMBER_HEADER_SHAPES,
  TITLE_SUBTITLE_HEADER_SHAPES,
  type HeaderShapeDefinition,
  type HeaderShapeId,
} from '@/lib/header-assembly/types';

const SHAPE_ICON_PROPS = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

function HeaderShapeIcon({ shapeId }: { shapeId: HeaderShapeId }) {
  switch (shapeId) {
    case 'rounded-rect':
      return (
        <svg {...SHAPE_ICON_PROPS}>
          <rect x="4" y="6" width="16" height="12" rx="3" />
        </svg>
      );
    case 'pill':
      return (
        <svg {...SHAPE_ICON_PROPS}>
          <rect x="3" y="8" width="18" height="8" rx="4" />
        </svg>
      );
    case 'circle':
      return (
        <svg {...SHAPE_ICON_PROPS}>
          <circle cx="12" cy="12" r="7" />
        </svg>
      );
    case 'polygon':
      return (
        <svg {...SHAPE_ICON_PROPS}>
          <polygon points="12,4 19,9 16,19 8,19 5,9" />
        </svg>
      );
    case 'hexagon':
      return (
        <svg {...SHAPE_ICON_PROPS}>
          <polygon points="12,4 18,7.5 18,16.5 12,20 6,16.5 6,7.5" />
        </svg>
      );
    case 'trapezoid':
      return (
        <svg {...SHAPE_ICON_PROPS}>
          <polygon points="7,6 17,6 20,18 4,18" />
        </svg>
      );
    case 'parallelogram':
      return (
        <svg {...SHAPE_ICON_PROPS}>
          <polygon points="8,6 20,6 16,18 4,18" />
        </svg>
      );
    case 'chevron':
      return (
        <svg {...SHAPE_ICON_PROPS}>
          <polygon points="6,6 18,6 20,12 18,18 6,18 4,12" />
        </svg>
      );
    case 'ribbon-notch':
      return (
        <svg {...SHAPE_ICON_PROPS}>
          <polygon points="4,6 20,6 20,15 12,19 4,15" />
        </svg>
      );
    case 'rectangle':
    default:
      return (
        <svg {...SHAPE_ICON_PROPS}>
          <rect x="4" y="6" width="16" height="12" />
        </svg>
      );
  }
}

export type HeaderShapePickerVariant = 'number' | 'title-subtitle';

function shapesForVariant(variant: HeaderShapePickerVariant): HeaderShapeDefinition[] {
  return variant === 'number' ? NUMBER_HEADER_SHAPES : TITLE_SUBTITLE_HEADER_SHAPES;
}

function gridColsClass(count: number): string {
  if (count <= 4) return 'grid-cols-4';
  if (count <= 6) return 'grid-cols-3 sm:grid-cols-6';
  return 'grid-cols-4';
}

export function HeaderShapePicker({
  variant,
  selected,
  onSelect,
}: {
  variant: HeaderShapePickerVariant;
  selected: HeaderShapeId;
  onSelect: (id: HeaderShapeId) => void;
}) {
  const shapes = shapesForVariant(variant);

  return (
    <div className={cn('grid gap-2', gridColsClass(shapes.length))}>
      {shapes.map((shape) => {
        const active = selected === shape.id;
        return (
          <button
            key={shape.id}
            type="button"
            aria-label={shape.label}
            aria-pressed={active}
            title={shape.label}
            onClick={() => onSelect(shape.id)}
            className={cn('gp-icon-toggle', active && 'gp-icon-toggle--active')}
          >
            <HeaderShapeIcon shapeId={shape.id} />
          </button>
        );
      })}
    </div>
  );
}
