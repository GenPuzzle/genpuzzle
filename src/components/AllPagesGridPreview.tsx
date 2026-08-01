'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Pencil, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';

const GRID_GAP_PX = 24;
const VIEWPORT_HEIGHT_PAD_PX = 40;

export const ALL_PAGES_MIN_ZOOM = 25;
export const ALL_PAGES_MAX_ZOOM = 150;
export const ALL_PAGES_MIN_COLUMNS = 2;
export const ALL_PAGES_MAX_COLUMNS = 6;

/**
 * Map zoom → column count: 25% = 6 columns, 150% = 2 columns (linear between).
 */
export function computeAllPagesColumnCount(zoom: number, pageCount: number): number {
  if (pageCount <= 1) return 1;

  const z = Math.max(ALL_PAGES_MIN_ZOOM, Math.min(ALL_PAGES_MAX_ZOOM, zoom));
  const t = (z - ALL_PAGES_MIN_ZOOM) / (ALL_PAGES_MAX_ZOOM - ALL_PAGES_MIN_ZOOM);
  const columns = Math.round(
    ALL_PAGES_MAX_COLUMNS - t * (ALL_PAGES_MAX_COLUMNS - ALL_PAGES_MIN_COLUMNS)
  );

  return Math.max(ALL_PAGES_MIN_COLUMNS, Math.min(pageCount, columns));
}

/**
 * Scale pages to fit the grid while respecting zoom (capped so full pages stay visible).
 */
export function computeAllPagesRenderScale(
  zoom: number,
  columns: number,
  containerWidth: number,
  viewportHeight: number,
  pageWidthPx: number,
  pageHeightPx: number
): number {
  if (pageWidthPx <= 0 || pageHeightPx <= 0) return zoom / 100;

  const z = Math.max(ALL_PAGES_MIN_ZOOM, Math.min(ALL_PAGES_MAX_ZOOM, zoom));
  const zoomScale = z / 100;
  const gaps = Math.max(0, columns - 1) * GRID_GAP_PX;

  const widthFit =
    containerWidth > 0
      ? Math.max(0, containerWidth - gaps) / (columns * pageWidthPx)
      : zoomScale;

  const heightFit =
    viewportHeight > 0
      ? Math.max(0, viewportHeight - VIEWPORT_HEIGHT_PAD_PX) / pageHeightPx
      : Infinity;

  const fitScale = Math.min(widthFit, heightFit);
  return Math.max(0.05, Math.min(zoomScale, fitScale));
}

export interface AllPagesGridItemProps {
  children: React.ReactNode;
  onEdit?: () => void;
  /** Insert a blank title page after this page */
  onInsertAfter?: () => void;
  /** Remove this page from the book */
  onRemove?: () => void;
  itemRef?: (el: HTMLDivElement | null) => void;
  pageWidthPx?: number;
  pageHeightPx?: number;
  renderScale?: number;
}

function AllPagesGridItem({
  children,
  onEdit,
  onInsertAfter,
  onRemove,
  itemRef,
  pageWidthPx = 0,
  pageHeightPx = 0,
  renderScale = 1,
}: AllPagesGridItemProps) {
  const slotWidth = pageWidthPx * renderScale;
  const slotHeight = pageHeightPx * renderScale;

  return (
    <div ref={itemRef} className="all-pages-grid__item">
      <div
        className="all-pages-grid__page-slot"
        style={{
          width: slotWidth,
          height: slotHeight,
        }}
      >
        <div
          className="all-pages-grid__page-scale"
          style={{
            width: pageWidthPx,
            height: pageHeightPx,
            transform: `scale(${renderScale})`,
            transformOrigin: 'top left',
          }}
        >
          {children}
        </div>
        <div className="all-pages-grid__actions">
          {onEdit ? (
            <button type="button" className="all-pages-grid__edit-btn" onClick={onEdit}>
              <Pencil className="h-3.5 w-3.5" aria-hidden />
              Edit
            </button>
          ) : null}
          {onRemove ? (
            <button
              type="button"
              className="all-pages-grid__remove-btn"
              onClick={(e) => {
                e.stopPropagation();
                onRemove();
              }}
              title="Remove page"
              aria-label="Remove page"
            >
              <Trash2 className="h-3.5 w-3.5" aria-hidden />
            </button>
          ) : null}
        </div>
      </div>
      {onInsertAfter ? (
        <button
          type="button"
          className="all-pages-grid__insert-after"
          onClick={(e) => {
            e.stopPropagation();
            onInsertAfter();
          }}
          title="Add blank page after"
          aria-label="Add blank page after"
        >
          +
        </button>
      ) : null}
    </div>
  );
}

export interface AllPagesGridPreviewProps {
  zoom: number;
  pageWidthPx: number;
  pageHeightPx: number;
  children: React.ReactNode;
  className?: string;
}

export function AllPagesGridPreview({
  zoom,
  pageWidthPx,
  pageHeightPx,
  children,
  className,
}: AllPagesGridPreviewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(0);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const viewport = el.parentElement;

    const update = () => {
      setContainerWidth(el.clientWidth);
      setViewportHeight(viewport?.clientHeight ?? 0);
    };
    update();

    const observer = new ResizeObserver(update);
    observer.observe(el);
    if (viewport) observer.observe(viewport);
    return () => observer.disconnect();
  }, []);

  const childCount = React.Children.count(children);
  const columns = useMemo(
    () => computeAllPagesColumnCount(zoom, childCount),
    [zoom, childCount]
  );

  const renderScale = useMemo(
    () =>
      computeAllPagesRenderScale(
        zoom,
        columns,
        containerWidth || pageWidthPx,
        viewportHeight,
        pageWidthPx,
        pageHeightPx
      ),
    [zoom, columns, containerWidth, viewportHeight, pageWidthPx, pageHeightPx]
  );

  return (
    <div
      ref={containerRef}
      className={cn('all-pages-grid', className)}
      style={
        {
          '--grid-columns': columns,
          '--grid-gap': `${GRID_GAP_PX}px`,
        } as React.CSSProperties
      }
    >
      {React.Children.map(children, (child) => {
        if (!React.isValidElement<AllPagesGridItemProps>(child)) return child;
        return React.cloneElement(child, {
          pageWidthPx,
          pageHeightPx,
          renderScale,
        });
      })}
    </div>
  );
}

AllPagesGridPreview.Item = AllPagesGridItem;
