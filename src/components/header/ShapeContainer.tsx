'use client';

import React, { useLayoutEffect, useRef, useState } from 'react';
import type { HeaderShapeId } from '@/lib/header-assembly/types';
import { shapeSvgPathData, hexToRgba } from '@/lib/header-assembly/shape-path';

export interface ShapeContainerProps {
  shapeId: HeaderShapeId;
  fillColor: string;
  borderColor: string;
  borderThicknessPx: number;
  borderRadiusPx?: number;
  polygonSides?: number;
  borderOpacity?: number;
  width?: number | string;
  height: number;
  minWidth?: number;
  flex?: number;
  children: React.ReactNode;
  textColor?: string;
  fontFamily?: string;
  fontSize?: number;
  fontWeight?: number;
}

function renderShapeSvg(
  shapeId: HeaderShapeId,
  w: number,
  h: number,
  fillColor: string,
  borderRgba: string,
  borderThicknessPx: number,
  borderRadiusPx: number,
  polygonSides: number
): React.ReactNode {
  const t = Math.max(0, borderThicknessPx);
  const half = t / 2;
  const iw = Math.max(0, w - t);
  const ih = Math.max(0, h - t);
  const strokeProps =
    t > 0
      ? { stroke: borderRgba, strokeWidth: t, strokeLinejoin: 'round' as const }
      : { stroke: 'none', strokeWidth: 0 };

  switch (shapeId) {
    case 'rectangle':
      return (
        <rect x={half} y={half} width={iw} height={ih} fill={fillColor} {...strokeProps} />
      );
    case 'rounded-rect': {
      const r = Math.min(Math.max(0, borderRadiusPx - half), iw / 2, ih / 2);
      return (
        <rect
          x={half}
          y={half}
          width={iw}
          height={ih}
          rx={r}
          ry={r}
          fill={fillColor}
          {...strokeProps}
        />
      );
    }
    case 'pill': {
      const r = ih / 2;
      return (
        <rect
          x={half}
          y={half}
          width={iw}
          height={ih}
          rx={r}
          ry={r}
          fill={fillColor}
          {...strokeProps}
        />
      );
    }
    case 'circle':
      return (
        <ellipse
          cx={w / 2}
          cy={h / 2}
          rx={Math.max(0, w / 2 - half)}
          ry={Math.max(0, h / 2 - half)}
          fill={fillColor}
          {...strokeProps}
        />
      );
    default: {
      const pathD = shapeSvgPathData(iw, ih, {
        shapeId,
        width: iw,
        height: ih,
        borderRadiusPx,
        polygonSides,
      });
      return (
        <g transform={`translate(${half} ${half})`}>
          <path d={pathD} fill={fillColor} {...strokeProps} strokeLinecap="round" />
        </g>
      );
    }
  }
}

export function ShapeContainer({
  shapeId,
  fillColor,
  borderColor,
  borderThicknessPx,
  borderRadiusPx = 0,
  polygonSides = 6,
  borderOpacity = 100,
  width,
  height,
  minWidth,
  flex,
  children,
  textColor = '#000000',
  fontFamily = 'Arial',
  fontSize = 14,
  fontWeight = 700,
}: ShapeContainerProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [dims, setDims] = useState({ w: 0, h: height });

  useLayoutEffect(() => {
    const el = rootRef.current;
    if (!el) return;

    const update = () => {
      const w = el.clientWidth;
      const h = el.clientHeight || height;
      if (w > 0 && h > 0) setDims({ w, h });
    };

    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [height]);

  const borderRgba = hexToRgba(borderColor, borderOpacity / 100);

  return (
    <div
      ref={rootRef}
      style={{
        position: 'relative',
        width: width ?? (flex ? undefined : 'auto'),
        minWidth: flex ? 0 : minWidth,
        flex: flex ?? undefined,
        height,
        flexShrink: flex ? 1 : 0,
        boxSizing: 'border-box',
        overflow: 'visible',
      }}
    >
      {dims.w > 0 && (
        <svg
          aria-hidden
          style={{
            position: 'absolute',
            inset: 0,
            display: 'block',
            pointerEvents: 'none',
            overflow: 'visible',
          }}
          width={dims.w}
          height={dims.h}
          viewBox={`0 0 ${dims.w} ${dims.h}`}
        >
          {renderShapeSvg(
            shapeId,
            dims.w,
            dims.h,
            fillColor,
            borderRgba,
            borderThicknessPx,
            borderRadiusPx,
            polygonSides
          )}
        </svg>
      )}
      <div
        style={{
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '100%',
          height: '100%',
          padding: '0 10px',
          color: textColor,
          fontFamily,
          fontSize,
          fontWeight,
          textAlign: 'center',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: typeof children === 'string' ? 'nowrap' : 'normal',
          boxSizing: 'border-box',
          zIndex: 1,
        }}
      >
        {children}
      </div>
    </div>
  );
}
