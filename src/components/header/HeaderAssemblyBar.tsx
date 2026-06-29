'use client';

import React from 'react';
import {
  normalizeHeaderAssemblySettings,
  type HeaderAssemblySettings,
} from '@/lib/header-assembly/types';
import type { HeaderTextParts } from '@/lib/header-assembly/resolve-parts';
import { computeHeaderRowMetrics } from '@/lib/header-assembly/compute-row';
import { resolveHeaderNumberTextStyle } from '@/lib/header-assembly/resolve-number-text';
import { ShapeContainer } from '@/components/header/ShapeContainer';

export interface HeaderAssemblyBarProps {
  parts: HeaderTextParts;
  settings: HeaderAssemblySettings;
  headerWidthPt: number;
  titleFontSizePt: number;
  subtitleFontSizePt: number;
  subtitleLines: string[];
  titleColor: string;
  subtitleColor: string;
  fontFamily: string;
  subtitleFontFamily?: string;
  subtitleTextWidthPt: number;
  ptToPx: (pt: number) => number;
}

/**
 * Assembles three independent shape containers into a cohesive horizontal header:
 * Row 1: [Number shape] + [Title shape flex-1]
 * Row 2: [Subtitle shape centered]
 */
export function HeaderAssemblyBar({
  parts,
  settings: rawSettings,
  headerWidthPt,
  titleFontSizePt,
  subtitleFontSizePt,
  subtitleLines,
  titleColor,
  subtitleColor,
  fontFamily,
  subtitleFontFamily: subtitleFontFamilyProp,
  subtitleTextWidthPt,
  ptToPx,
}: HeaderAssemblyBarProps) {
  const settings = normalizeHeaderAssemblySettings(rawSettings);
  const { number, title, subtitle } = settings;
  const subtitleFontFamily = subtitleFontFamilyProp ?? fontFamily;
  const titleFontPx = ptToPx(titleFontSizePt);
  const subtitleFontPx = ptToPx(subtitleFontSizePt);
  const numberTextStyle = resolveHeaderNumberTextStyle(number, titleFontSizePt, fontFamily);
  const numberFontPx = ptToPx(numberTextStyle.fontSizePt);
  const rowMetrics = computeHeaderRowMetrics(headerWidthPt, titleFontSizePt, parts);
  const rowH = ptToPx(rowMetrics.rowHPt);
  const gap = ptToPx(rowMetrics.gapPt);
  const numberW = ptToPx(rowMetrics.numberWPt);

  const subtitleContent =
    subtitleLines.length > 0 ? subtitleLines : parts.subtitleText ? [parts.subtitleText] : [];

  if (!parts.titleText && !parts.showNumber && subtitleContent.length === 0) {
    return null;
  }

  return (
    <div style={{ width: '100%', maxWidth: '100%', fontFamily, boxSizing: 'border-box', overflow: 'hidden' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'stretch',
          gap,
          width: '100%',
          maxWidth: '100%',
          overflow: 'hidden',
        }}
      >
        {parts.showNumber && (
          <ShapeContainer
            shapeId={number.shapeId}
            fillColor={number.fillColor}
            borderColor={number.borderColor}
            borderThicknessPx={number.borderThicknessPx}
            polygonSides={number.polygonSides}
            width={numberW}
            height={rowH}
            textColor={numberTextStyle.textColor}
            fontFamily={numberTextStyle.fontFamily}
            fontSize={numberFontPx}
            fontWeight={700}
          >
            {parts.numberText}
          </ShapeContainer>
        )}
        {parts.titleText && (
          <ShapeContainer
            shapeId={title.shapeId}
            fillColor={title.fillColor}
            borderColor={title.borderColor}
            borderThicknessPx={title.borderThicknessPx}
            borderRadiusPx={title.borderRadiusPx}
            flex={1}
            height={rowH}
            textColor={titleColor}
            fontFamily={fontFamily}
            fontSize={titleFontPx}
            fontWeight={700}
          >
            {parts.titleText}
          </ShapeContainer>
        )}
      </div>

      {subtitleContent.length > 0 && (
        <div
          style={{
            marginTop: gap,
            display: 'flex',
            justifyContent: 'center',
            width: '100%',
            maxWidth: '100%',
            overflow: 'hidden',
          }}
        >
          <ShapeContainer
            shapeId={subtitle.shapeId}
            fillColor={subtitle.fillColor}
            borderColor={subtitle.borderColor}
            borderThicknessPx={subtitle.borderThicknessPx}
            borderRadiusPx={subtitle.borderRadiusPx}
            borderOpacity={subtitle.borderOpacity}
            width={ptToPx(subtitleTextWidthPt)}
            height={Math.max(
              rowH * 0.85,
              subtitleContent.length * subtitleFontPx * 1.3 + ptToPx(10) + 12
            )}
            textColor={subtitleColor}
            fontFamily={subtitleFontFamily}
            fontSize={subtitleFontPx}
            fontWeight={400}
          >
            <div style={{ whiteSpace: 'normal', lineHeight: 1.3 }}>
              {subtitleContent.map((line, i) => (
                <div key={i}>{line}</div>
              ))}
            </div>
          </ShapeContainer>
        </div>
      )}
    </div>
  );
}
