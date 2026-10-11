'use client';

import React from 'react';
import { canvasShapePoints } from '../canvas-shapes';
import { PT_TO_CSS_PX } from '../puzzle-layout';
import { cssTextEffect } from '../text-effects';
import { resolveUnicodeFontFamily } from '../unicode-text';
import { cssBoxTransform } from './box-transform';
import { dispatchResolved } from './dispatch';
import { previewImageHref } from './preview-image';
import type { ResolvedElement } from './types';

function ElementView({ el, scale }: { el: ResolvedElement; scale: number }) {
  const px = (pt: number) => pt * scale;
  return dispatchResolved('Canvas', el, {
    rect: (el) => (
        <div
          style={{
            position: 'absolute',
            left: px(el.x),
            top: px(el.y),
            width: px(el.w),
            height: px(el.h),
            background: el.fill,
            border: el.stroke ? `${px(el.strokeWidth ?? 1)}px solid ${el.stroke}` : undefined,
            borderRadius: el.radius ? px(el.radius) : undefined,
            boxSizing: 'border-box',
            opacity: el.opacity ?? 1,
          }}
        />
      ),
    ellipse: (el) => (
        <div
          style={{
            position: 'absolute',
            left: px(el.cx - el.rx),
            top: px(el.cy - el.ry),
            width: px(el.rx * 2),
            height: px(el.ry * 2),
            background: el.fill,
            borderRadius: '50%',
          }}
        />
      ),
    line: (el) => {
      const strokeW = Number.isFinite(el.width) && el.width > 0 ? el.width : 1;
      return (
      <svg style={{ position: 'absolute', inset: 0, overflow: 'visible', pointerEvents: 'none' }} width="100%" height="100%">
        <line
          x1={px(el.x1)}
          y1={px(el.y1)}
          x2={px(el.x2)}
          y2={px(el.y2)}
          stroke={el.color}
          strokeWidth={px(strokeW)}
          strokeLinecap="round"
          strokeOpacity={el.opacity ?? 1}
          strokeDasharray={el.dash ? el.dash.map((d) => px(d)).join(' ') : undefined}
        />
      </svg>
      );
    },
    stadium: (el) => (
      <svg style={{ position: 'absolute', inset: 0, overflow: 'visible', pointerEvents: 'none' }} width="100%" height="100%">
        <line
          x1={px(el.x1)}
          y1={px(el.y1)}
          x2={px(el.x2)}
          y2={px(el.y2)}
          stroke={el.color}
          strokeWidth={px(el.thickness)}
          strokeLinecap="round"
          strokeOpacity={el.opacity ?? 1}
        />
      </svg>
    ),
    polygon: (el) => (
      <svg style={{ position: 'absolute', inset: 0, overflow: 'visible' }} width="100%" height="100%">
        <polygon
          points={el.points.map((p) => `${px(p.x)},${px(p.y)}`).join(' ')}
          fill={el.fill}
          stroke={el.stroke}
          strokeWidth={el.strokeWidth ? px(el.strokeWidth) : undefined}
        />
      </svg>
    ),
    shape: (el) => {
      if (el.shape === 'roundRect' || el.shape === 'rect') {
        const radius =
          el.shape === 'roundRect'
            ? Math.min(el.cornerRadius ?? Math.min(el.w, el.h) * 0.12, el.w / 2, el.h / 2)
            : 0;
        return (
          <div
            style={{
              position: 'absolute',
              left: px(el.x),
              top: px(el.y),
              width: px(el.w),
              height: px(el.h),
              background: el.fill || 'transparent',
              border: el.stroke
                ? `${px(el.strokeWidth ?? 1)}px solid ${el.stroke}`
                : undefined,
              borderRadius: radius ? px(radius) : undefined,
              boxSizing: 'border-box',
              ...cssBoxTransform(el),
            }}
          />
        );
      }
      const points = canvasShapePoints(el.shape, el.x, el.y, el.w, el.h);
      return (
        <svg
          style={{
            position: 'absolute',
            inset: 0,
            overflow: 'visible',
            ...cssBoxTransform(el),
          }}
          width="100%"
          height="100%"
        >
          <polygon
            points={points.map((p) => `${px(p.x)},${px(p.y)}`).join(' ')}
            fill={el.fill || 'none'}
            stroke={el.stroke || 'none'}
            strokeWidth={el.strokeWidth ? px(el.strokeWidth) : 0}
          />
        </svg>
      );
    },
    text: (el) => (
      <div
        style={{
          position: 'absolute',
          left: px(el.x),
          top: px(el.y),
          width: px(el.w),
          height: px(el.h),
          color: el.color,
          fontFamily: resolveUnicodeFontFamily(el.fontFamily, el.text || (el.lines ?? []).join('')),
          fontSize: px(el.fontSize),
          fontWeight: el.bold ? 700 : 400,
          fontStyle: el.italic ? 'italic' : undefined,
          lineHeight: `${px(el.lineHeight)}px`,
          letterSpacing:
            el.letterSpacingEm != null && el.letterSpacingEm > 0
              ? `${el.letterSpacingEm}em`
              : undefined,
          textAlign: el.align,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: el.valign === 'top' ? 'flex-start' : el.valign === 'bottom' ? 'flex-end' : 'center',
          whiteSpace: 'pre',
          // Letter-spaced runs (word scramble) must not clip tracking.
          overflow:
            el.letterSpacingEm != null && el.letterSpacingEm > 0 ? 'visible' : 'hidden',
          ...cssTextEffect(el.effect, el.color),
          ...cssBoxTransform(el),
        }}
      >
        {(el.lines ?? [el.text]).map((line, i) => (
          <div key={i}>{line}</div>
        ))}
      </div>
    ),
    image: (el) => (
      <img
        alt=""
        src={previewImageHref(el)}
        style={{
          position: 'absolute',
          left: px(el.x),
          top: px(el.y),
          width: px(el.w),
          height: px(el.h),
          objectFit: el.fit === 'stretch' ? 'fill' : el.fit,
          opacity: el.opacity ?? 1,
          ...cssBoxTransform(el),
        }}
      />
    ),
  });
}

/** Display-only scale. Zoom must wrap this view; it must not change element points. */
export function ResolvedElementsView({
  elements,
  widthPt,
  heightPt,
  scale = PT_TO_CSS_PX,
}: {
  elements: ResolvedElement[];
  widthPt: number;
  heightPt: number;
  scale?: number;
}) {
  return (
    <div
      style={{
        position: 'relative',
        width: widthPt * scale,
        height: heightPt * scale,
        overflow: 'hidden',
      }}
    >
      {elements.map((el, i) => (
        <ElementView key={i} el={el} scale={scale} />
      ))}
    </div>
  );
}
