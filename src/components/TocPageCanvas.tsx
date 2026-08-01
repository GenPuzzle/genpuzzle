'use client';

import React, { useEffect, useRef } from 'react';
import type { DocumentPage, TextModuleSettings } from '@/lib/document-model';
import type { WordSearchSettings, PageFrameSettings } from '@/lib/puzzles/types';
import type { ResolvedTocEntry } from '@/lib/book-compiler';
import { getPageDimensionsInches, getPageMarginInches } from '@/lib/puzzle-layout';
import {
  resolveTextPageBackground,
  resolveTextPageFrameSettings,
  resolveTextPageTextColor,
} from '@/lib/text-page-settings';
import { normalizeTocSettings } from '@/lib/toc-settings';
import {
  splitEntriesIntoColumns,
  tocEntryOverrideKey,
  shouldUseTwoColumns,
  resolveTocLayoutMetricsForEntries,
} from '@/lib/toc-layout';

function PageFrameOverlay({
  frame,
  pageBackgroundColor,
  hasBackgroundImage,
}: {
  frame: PageFrameSettings;
  pageBackgroundColor: string;
  hasBackgroundImage: boolean;
}) {
  if (!frame.enabled) return null;
  const marginPx = frame.marginSizeIn * 96;
  const cornerRadiusPx = frame.cornerRadiusPx;
  const inset = { left: marginPx, top: marginPx, right: marginPx, bottom: marginPx };
  return (
    <>
      {hasBackgroundImage && (
        <div
          className="absolute pointer-events-none z-[1]"
          style={{
            ...inset,
            borderRadius: cornerRadiusPx,
            backgroundColor: pageBackgroundColor || '#ffffff',
          }}
        />
      )}
      <div
        className="absolute pointer-events-none z-[40]"
        style={{
          ...inset,
          borderRadius: cornerRadiusPx,
          border: `${frame.strokeThicknessPx}px solid ${frame.borderColor}`,
          backgroundColor: 'transparent',
          boxSizing: 'border-box',
        }}
      />
    </>
  );
}

function TocEntryRow({
  entry,
  tocSettings,
  entryColor,
  entryFontPx,
  rowPad,
  isEditing,
  onTitleChange,
  onPageNumberChange,
}: {
  entry: ResolvedTocEntry;
  tocSettings: ReturnType<typeof normalizeTocSettings>;
  entryColor: string;
  entryFontPx: number;
  rowPad: number;
  isEditing: boolean;
  onTitleChange?: (entry: ResolvedTocEntry, title: string) => void;
  onPageNumberChange?: (entry: ResolvedTocEntry, pageNumber: string) => void;
}) {
  const titleRef = useRef<HTMLSpanElement>(null);
  const pageRef = useRef<HTMLSpanElement>(null);
  const indent =
    tocSettings.tableFormat === 'indented' && entry.level === 2
      ? `${tocSettings.entryIndentPx ?? 24}px`
      : '0';
  const pageNum = tocSettings.showPageNumbers && entry.pageNumber ? entry.pageNumber : '';
  const simple = tocSettings.tableFormat === 'simple' || tocSettings.leaderStyle === 'none';
  const leaderStyle = tocSettings.leaderStyle;
  const showLeaderLine =
    !simple && leaderStyle !== 'none' && leaderStyle !== 'spaces';

  useEffect(() => {
    if (titleRef.current && document.activeElement !== titleRef.current) {
      titleRef.current.textContent = entry.title;
    }
  }, [entry.title]);

  useEffect(() => {
    if (pageRef.current && document.activeElement !== pageRef.current) {
      pageRef.current.textContent = pageNum;
    }
  }, [pageNum]);

  const rowStyle = {
    paddingTop: rowPad,
    paddingBottom: rowPad,
    paddingLeft: indent,
    fontSize: entryFontPx,
    lineHeight: 1.2,
    color: entryColor,
    gap: tocSettings.entryHorizontalGapPx ?? 8,
    letterSpacing: tocSettings.entryLetterSpacingPx
      ? `${tocSettings.entryLetterSpacingPx}px`
      : undefined,
    fontFamily: tocSettings.entryFontFamily || undefined,
    fontWeight: tocSettings.entryFontWeight ? 700 : 400,
    whiteSpace: 'nowrap' as const,
  };

  const titleSpan = (
    <span
      ref={titleRef}
      className="outline-none"
      style={{
        flex: '0 1 auto',
        minWidth: 0,
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
      }}
      contentEditable={isEditing}
      suppressContentEditableWarning
      onInput={() => {
        if (titleRef.current && onTitleChange) {
          onTitleChange(entry, titleRef.current.textContent ?? '');
        }
      }}
      onClick={(e) => e.stopPropagation()}
    />
  );

  const pageSpan = pageNum || isEditing ? (
    <span
      ref={pageRef}
      className="shrink-0 tabular-nums whitespace-nowrap outline-none"
      style={{
        flex: '0 0 auto',
        marginLeft: simple ? 'auto' : undefined,
        paddingLeft: simple ? 8 : undefined,
        minWidth: isEditing ? 24 : undefined,
      }}
      contentEditable={isEditing && tocSettings.showPageNumbers}
      suppressContentEditableWarning
      onInput={() => {
        if (pageRef.current && onPageNumberChange) {
          onPageNumberChange(entry, pageRef.current.textContent ?? '');
        }
      }}
      onClick={(e) => e.stopPropagation()}
    />
  ) : null;

  if (simple) {
    return (
      <div className="flex w-full items-baseline" style={rowStyle}>
        {titleSpan}
        {pageSpan}
      </div>
    );
  }

  return (
    <div className="flex w-full items-baseline" style={rowStyle}>
      {titleSpan}
      <span
        className="pointer-events-none"
        style={{
          flex: '1 1 12px',
          minWidth: 12,
          marginBottom: '0.15em',
          borderBottom: showLeaderLine
            ? `1px ${leaderStyle === 'dashes' ? 'dashed' : 'dotted'} currentColor`
            : 'none',
          opacity: showLeaderLine ? 0.45 : 1,
        }}
        aria-hidden
      />
      {pageSpan}
    </div>
  );
}

export function TocPageCanvas({
  page,
  settings,
  wordSearchSettings,
  entries,
  totalEntryCount,
  bookPageIndex,
  tocPageIndex = 0,
  tocPageCount = 1,
  showMargins,
  showSafetyZone,
  safetyMarginPx,
  ptToPx,
  textEditEnabled = false,
  onSettingsChange,
  onCanvasClick,
}: {
  page: DocumentPage;
  settings: TextModuleSettings;
  wordSearchSettings: WordSearchSettings;
  entries: ResolvedTocEntry[];
  /** Total TOC entries across all TOC pages (for auto-fit sizing). */
  totalEntryCount?: number;
  bookPageIndex: number | null;
  tocPageIndex?: number;
  tocPageCount?: number;
  showMargins: boolean;
  showSafetyZone: boolean;
  safetyMarginPx: number;
  ptToPx: (pt: number) => number;
  textEditEnabled?: boolean;
  onSettingsChange?: (updates: Partial<TextModuleSettings>) => void;
  onCanvasClick?: () => void;
}) {
  const titleRef = useRef<HTMLDivElement>(null);
  const tocSettings = normalizeTocSettings(settings.tocSettings);
  const dims = getPageDimensionsInches(wordSearchSettings);
  const pageWidthPt = dims.width * 72;
  const pageHeightPt = dims.height * 72;
  const widthPx = ptToPx(pageWidthPt);
  const heightPx = ptToPx(pageHeightPt);
  const marginPx = ptToPx(getPageMarginInches(wordSearchSettings) * 72);

  const alignment = settings.alignment || 'left';
  const textAlign =
    alignment === 'left' ? 'left' : alignment === 'right' ? 'right' : 'center';
  const alignItems =
    alignment === 'left' ? 'flex-start' : alignment === 'right' ? 'flex-end' : 'center';

  const defaultTextColor = resolveTextPageTextColor(settings, wordSearchSettings);
  const titleColor = tocSettings.titleTextColor || defaultTextColor;
  const entryColor = tocSettings.entryTextColor || defaultTextColor;
  const fitMetrics = resolveTocLayoutMetricsForEntries(
    totalEntryCount ?? entries.length,
    settings,
    wordSearchSettings,
    ptToPx
  );
  const titleFontPx = fitMetrics.titleFontPx;
  const entryFontPx = fitMetrics.entryFontPx;
  const heading =
    tocPageIndex > 0
      ? `${settings.title || page.name} (${tocPageIndex + 1})`
      : settings.title || page.name;
  const pageBackground = resolveTextPageBackground(settings, wordSearchSettings);
  const pageFrame = resolveTextPageFrameSettings(settings, wordSearchSettings);
  const frameInsetPx = pageFrame.enabled ? pageFrame.marginSizeIn * 96 : 0;
  const lineSpacing = fitMetrics.lineSpacingPx;
  const rowPad = fitMetrics.rowPaddingPx;
  const isEditing = textEditEnabled && !!onSettingsChange;

  const useTwoColumns = shouldUseTwoColumns(entries, settings);
  const { left, right } = splitEntriesIntoColumns(entries, useTwoColumns);

  useEffect(() => {
    if (titleRef.current && document.activeElement !== titleRef.current) {
      titleRef.current.textContent = heading;
    }
  }, [heading]);

  const handleHeadingInput = () => {
    if (!titleRef.current || !onSettingsChange || tocPageIndex > 0) return;
    onSettingsChange({ title: titleRef.current.textContent ?? '' });
  };

  const handleEntryTitleChange = (entry: ResolvedTocEntry, title: string) => {
    if (!onSettingsChange) return;
    const key = tocEntryOverrideKey(entry);
    onSettingsChange({
      tocEntryOverrides: {
        ...(settings.tocEntryOverrides ?? {}),
        [key]: title,
      },
    });
  };

  const handleEntryPageNumberChange = (entry: ResolvedTocEntry, pageNumber: string) => {
    if (!onSettingsChange) return;
    const key = tocEntryOverrideKey(entry);
    const next = { ...(settings.tocPageNumberOverrides ?? {}) };
    if (!pageNumber.trim()) {
      delete next[key];
    } else {
      next[key] = pageNumber.trim();
    }
    onSettingsChange({ tocPageNumberOverrides: next });
  };

  const renderColumn = (columnEntries: ResolvedTocEntry[], colOffset: number) => (
    <div className="flex-1 min-w-0">
      {columnEntries.map((entry, idx) => (
        <TocEntryRow
          key={`${entry.documentId}-${entry.bookPageIndex}-${entry.level}-${colOffset + idx}`}
          entry={entry}
          tocSettings={tocSettings}
          entryColor={entryColor}
          entryFontPx={entryFontPx}
          rowPad={rowPad}
          isEditing={isEditing}
          onTitleChange={handleEntryTitleChange}
          onPageNumberChange={handleEntryPageNumberChange}
        />
      ))}
    </div>
  );

  return (
    <div
      className="relative shadow-2xl border border-gray-300 transition-shadow duration-300 hover:shadow-3xl"
      style={{
        width: widthPx,
        height: heightPx,
        boxSizing: 'border-box',
        backgroundColor: pageBackground.backgroundColor || '#ffffff',
        overflow: 'hidden',
      }}
      onClick={() => {
        if (textEditEnabled) onCanvasClick?.();
      }}
    >
      {pageBackground.backgroundImage && (
        <div
          className="absolute inset-0 pointer-events-none z-0"
          style={{
            backgroundImage: `url(${pageBackground.backgroundImage})`,
            backgroundSize: pageBackground.backgroundImageFit || 'cover',
            backgroundRepeat: 'no-repeat',
            backgroundPosition: 'center',
            opacity: (pageBackground.backgroundImageOpacity ?? 100) / 100,
          }}
        />
      )}

      <PageFrameOverlay
        frame={pageFrame}
        pageBackgroundColor={pageBackground.backgroundColor || '#ffffff'}
        hasBackgroundImage={!!pageBackground.backgroundImage}
      />

      {showMargins && (
        <div
          className="absolute border border-dashed border-blue-400 pointer-events-none z-50 opacity-40"
          style={{ left: marginPx, top: marginPx, right: marginPx, bottom: marginPx }}
        />
      )}

      {showSafetyZone && (
        <div
          className="absolute border border-dashed border-black pointer-events-none z-50 opacity-40"
          style={{
            left: safetyMarginPx,
            top: safetyMarginPx,
            right: safetyMarginPx,
            bottom: safetyMarginPx,
          }}
        />
      )}

      <div
        style={{
          position: 'absolute',
          left: marginPx + frameInsetPx,
          top: marginPx + frameInsetPx,
          right: marginPx + frameInsetPx,
          bottom: marginPx + frameInsetPx,
          display: 'flex',
          flexDirection: 'column',
          alignItems: alignItems,
          textAlign,
          padding: ptToPx(12),
          boxSizing: 'border-box',
          zIndex: 10,
          fontFamily: tocSettings.titleFontFamily || settings.fontFamily || 'Arial',
          overflow: 'hidden',
          minHeight: 0,
          pointerEvents: isEditing ? 'auto' : 'none',
        }}
      >
        <div
          ref={titleRef}
          className="w-full outline-none shrink-0 whitespace-nowrap overflow-hidden text-ellipsis"
          style={{
            fontSize: titleFontPx,
            lineHeight: 1.2,
            color: titleColor,
            marginBottom: tocSettings.titleBottomGapPx ?? 16,
            fontFamily: tocSettings.titleFontFamily || settings.fontFamily || 'Arial',
            fontWeight: tocSettings.titleFontWeight === false ? 400 : 700,
          }}
          contentEditable={isEditing && tocPageIndex === 0}
          suppressContentEditableWarning
          onInput={handleHeadingInput}
          onClick={(e) => e.stopPropagation()}
        />

        {entries.length === 0 ? (
          <p className="italic opacity-60 text-sm" style={{ fontSize: entryFontPx, color: entryColor }}>
            {tocSettings.entryScope === 'chapters'
              ? 'Add title or separator pages after the Table of Contents to create chapters.'
              : 'Add documents after the Table of Contents — titles will appear here automatically.'}
          </p>
        ) : (
          <div
            className="w-full flex flex-1 min-h-0"
            style={{
              fontSize: entryFontPx,
              color: entryColor,
              gap: tocSettings.columnGapPx ?? 24,
              marginTop: tocSettings.entriesTopGapPx ?? 0,
              fontFamily: tocSettings.entryFontFamily || settings.fontFamily || 'Arial',
              fontWeight: tocSettings.entryFontWeight ? 700 : 400,
              letterSpacing: tocSettings.entryLetterSpacingPx
                ? `${tocSettings.entryLetterSpacingPx}px`
                : undefined,
            }}
          >
            {renderColumn(left, 0)}
            {right.length > 0 && renderColumn(right, left.length)}
          </div>
        )}
      </div>
    </div>
  );
}
