'use client';

import React, { useMemo } from 'react';
import type { WordSearchSettings } from '@/lib/puzzles/types';
import { ShapeContainer } from '@/components/header/ShapeContainer';
import { CanvasSelectable } from '@/components/CanvasSelectable';
import type { CanvasFormatTarget } from '@/lib/canvas-native-format';
import { computePageNumberLayout } from '@/lib/page-number/layout';
import { normalizePageNumberSettings } from '@/lib/page-number/settings';
import { ptToCssPx } from '@/lib/header-assembly/compute-row';

export function PageNumberOverlay({
  settings,
  bookPageIndex,
  pageWidthPt,
  pageHeightPt,
  ptToPx,
  selected = false,
  onSelect,
}: {
  settings: WordSearchSettings;
  bookPageIndex: number;
  pageWidthPt: number;
  pageHeightPt: number;
  ptToPx: (pt: number) => number;
  selected?: boolean;
  onSelect?: (target: CanvasFormatTarget) => void;
}) {
  const pageNumberSettings = normalizePageNumberSettings(settings.typography.pageNumber);
  const layout = useMemo(
    () =>
      computePageNumberLayout(
        pageWidthPt,
        pageHeightPt,
        settings,
        bookPageIndex,
        pageNumberSettings
      ),
    [pageWidthPt, pageHeightPt, settings, bookPageIndex, pageNumberSettings]
  );

  if (!layout) return null;

  const shape = layout.shape;

  return (
    <CanvasSelectable
      target="page-number"
      label="Page #"
      active={selected}
      onSelect={onSelect}
      style={{
        position: 'absolute',
        left: ptToPx(layout.leftPt),
        top: ptToPx(layout.topPt),
        width: ptToPx(layout.widthPt),
        height: ptToPx(layout.heightPt),
        zIndex: 45,
        pointerEvents: onSelect ? 'auto' : 'none',
      }}
    >
      <ShapeContainer
        shapeId={shape.shapeId}
        fillColor={shape.fillColor}
        borderColor={shape.borderColor}
        borderThicknessPx={shape.borderThicknessPx}
        polygonSides={shape.polygonSides}
        height={ptToPx(layout.heightPt)}
        textColor={layout.textColor}
        fontFamily={layout.fontFamily}
        fontSize={ptToCssPx(layout.fontSizePt)}
        fontWeight={700}
      >
        {layout.text}
      </ShapeContainer>
    </CanvasSelectable>
  );
}
