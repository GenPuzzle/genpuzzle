import type { TextModuleSettings, TextPageBlock, DocumentModuleType } from './document-model';
import type { WordSearchSettings } from './puzzles/types';
import { addHeaderShapeToSlide } from './header-assembly-ppt-draw';
import { cssPxToPoints, getPageMarginInches } from './puzzle-layout';
import { resolveTextPageBlocks, resolveOwnershipNameLineType, ownershipNameLineIsVisible } from './text-page-blocks';
import {
  getFrameCornerRadiusPx,
  getOwnershipCanvasLayout,
  getTextPageBlockRectPt,
  getTextPageContentAreaPt,
  ptToIn,
  resolveTextPageFrameShapeId,
} from './text-page-export-layout';
import { renderImageBlockToDataUrl } from './text-page-image-export';
import {
  measureOwnershipBlockLayoutFromDom,
  measureTextBlockLayoutFromDom,
} from './text-page-dom-layout';
import { toPptColorHex } from './text-page-export-color';
import {
  layoutRichTextLines,
  measureRunWidthPt,
  parseRichTextRuns,
} from './text-page-rich-text-export';
import {
  resolveTextPageBackground,
  resolveTextPageFrameSettings,
  resolveTextPageTextColor,
} from './text-page-settings';
import { buildLegacyCenteredTextLayout, wrapPreWrapLinesPt } from './text-page-legacy-layout';
import {
  FlattenedBackgroundPptCache,
  applyFlattenedBackgroundToSlide,
  puzzlePageBackgroundConfig,
} from './unified-background';
import { resolvePageFrameSettings } from './page-frame-settings';
import { addPageNumberToSlide } from './page-number-ppt-draw';
import type { ResolvedTocEntry } from './book-compiler';
import {
  buildTocExportLayout,
  isTocModuleSettings,
  parseTocEntriesFromContent,
} from './toc-export-draw';
import { measureTextWidthPt } from './header-assembly/fit-title';
import { normalizeTocSettings } from './toc-settings';

const PPT_ZERO_MARGIN = [0, 0, 0, 0] as const;

function pptFontSize(sizePt: number, min = 1): number {
  if (!Number.isFinite(sizePt) || sizePt <= 0) return min;
  return Math.max(min, Math.round(sizePt * 100) / 100);
}

/**
 * CSS `line-height` as PowerPoint "Exactly" (points).
 * `lineSpacingMultiple` is 120% of the font's built-in spacing — not CSS 1.2 —
 * and overflows short boxes so PowerPoint shrinks the glyphs.
 */
function pptExactLineSpacing(lineHeightPt: number): number {
  return pptFontSize(lineHeightPt, 0.5);
}

function pptCanvasTextOpts(opts: {
  wrap?: boolean;
  valign?: 'top' | 'middle';
  charSpacingPt?: number;
  lineHeightPt: number;
}): Record<string, unknown> {
  return {
    valign: opts.valign ?? 'top',
    margin: [...PPT_ZERO_MARGIN],
    wrap: opts.wrap ?? false,
    fit: 'none',
    paraSpaceBefore: 0,
    paraSpaceAfter: 0,
    lineSpacing: pptExactLineSpacing(opts.lineHeightPt),
    isTextBox: true,
    ...(opts.charSpacingPt && Number.isFinite(opts.charSpacingPt) && opts.charSpacingPt !== 0
      ? { charSpacing: opts.charSpacingPt }
      : {}),
  };
}

function hex6(hex: string | undefined, fallback = '000000'): string {
  if (!hex) return fallback;
  const clean = hex.replace(/^#/, '');
  return clean.length === 6 ? clean.toUpperCase() : fallback;
}

function safeIn(v: number, fallback = 0.01): number {
  return Number.isFinite(v) && v > 0 ? v : fallback;
}

const PPT_BG_OPTIONS = { bakeInnerFrameFill: false } as const;

/**
 * Page-container frame geometry (inches). Inset by half stroke so the outer
 * edge matches CSS border-box (canvas) — PPT strokes are path-centered.
 */
function getPageContainerFrameGeom(
  pageWIn: number,
  pageHIn: number,
  frame: ReturnType<typeof resolvePageFrameSettings>
) {
  const m = frame.marginSizeIn;
  const strokePt = Math.max(0.5, cssPxToPoints(frame.strokeThicknessPx));
  const strokeIn = strokePt / 72;
  const halfIn = strokeIn / 2;
  const x = m + halfIn;
  const y = m + halfIn;
  const w = Math.max(0.01, pageWIn - m * 2 - strokeIn);
  const h = Math.max(0.01, pageHIn - m * 2 - strokeIn);
  const rectRadiusIn = Math.max(
    0,
    Math.min(frame.cornerRadiusPx / 96, Math.min(w, h) / 2)
  );
  const shapeType = rectRadiusIn > 0 ? 'roundRect' : 'rect';
  const roundProps = rectRadiusIn > 0 ? { rectRadius: rectRadiusIn } : {};
  return { x, y, w, h, shapeType, roundProps, strokePt };
}

function addPageContainerFrame(
  slide: { addShape: (shape: string, opts: Record<string, unknown>) => void },
  pageWIn: number,
  pageHIn: number,
  frame: ReturnType<typeof resolvePageFrameSettings>,
  pageBackgroundColor: string | undefined,
  hasBackgroundImage: boolean
): void {
  if (!frame.enabled) return;

  const { x, y, w, h, shapeType, roundProps, strokePt } = getPageContainerFrameGeom(
    pageWIn,
    pageHIn,
    frame
  );

  if (hasBackgroundImage && pageBackgroundColor) {
    slide.addShape(shapeType, {
      x,
      y,
      w,
      h,
      fill: { color: hex6(pageBackgroundColor, 'FFFFFF') },
      line: { color: hex6(frame.borderColor), width: strokePt },
      ...roundProps,
    });
    return;
  }

  slide.addShape(shapeType, {
    x,
    y,
    w,
    h,
    line: { color: hex6(frame.borderColor), width: strokePt },
    ...roundProps,
  });
}

function alignOffsetX(
  alignment: TextPageBlock['alignment'],
  lineWidthPt: number,
  boxWidthPt: number
): number {
  if (alignment === 'center') return Math.max(0, (boxWidthPt - lineWidthPt) / 2);
  if (alignment === 'right') return Math.max(0, boxWidthPt - lineWidthPt);
  return 0;
}

function addOwnershipBlockToSlide(
  slide: {
    addText: (text: unknown, opts: Record<string, unknown>) => void;
    addShape: (shape: string, opts: Record<string, unknown>) => void;
  },
  block: TextPageBlock,
  rect: ReturnType<typeof getTextPageBlockRectPt>,
  fallbackColor: string
) {
  const layout = getOwnershipCanvasLayout(block, rect);
  const pptAlign =
    block.alignment === 'left' ? 'left' : block.alignment === 'right' ? 'right' : 'center';
  const label = block.text || '';
  const nameLineType = resolveOwnershipNameLineType(block);
  const measured = measureOwnershipBlockLayoutFromDom(
    block,
    rect.innerWidth,
    rect.innerHeight,
    fallbackColor,
    nameLineType
  );
  const wrapped = label
    ? wrapPreWrapLinesPt(
        label,
        rect.innerWidth,
        layout.fontSizePt,
        block.fontFamily || 'Arial',
        !!block.bold
      )
    : [];
  const lineCount = Math.max(1, measured?.textLines.length || wrapped.length || 1);
  const firstLineTop =
    measured?.textLines[0] != null
      ? rect.innerTopFromPageTop + measured.textLines[0].lineTopPt
      : layout.textTopPt;
  const maxLabelBottom = layout.nameLine.lineTopFromPageTop;
  const labelHeightPt = Math.max(
    1,
    Math.min(layout.labelBoxHeightPt * lineCount, Math.max(1, maxLabelBottom - firstLineTop))
  );
  const letterSpacingPt = cssPxToPoints(block.letterSpacingPx ?? 0);

  if (label) {
    slide.addText(wrapped.length > 0 ? wrapped.join('\n') : label, {
      x: ptToIn(rect.innerLeft),
      y: ptToIn(firstLineTop),
      w: safeIn(ptToIn(rect.innerWidth)),
      h: safeIn(ptToIn(labelHeightPt + 0.75)),
      fontSize: pptFontSize(layout.fontSizePt),
      fontFace: block.fontFamily || 'Arial',
      color: toPptColorHex(block.textColor ?? fallbackColor, '1F2937'),
      bold: !!block.bold,
      italic: !!block.italic,
      underline: block.underline ? { style: 'sng' as const } : undefined,
      align: pptAlign,
      ...pptCanvasTextOpts({
        wrap: false,
        valign: 'top',
        lineHeightPt: layout.lineHeightPt,
        charSpacingPt: letterSpacingPt,
      }),
      ...(block.rotationDeg ? { rotate: block.rotationDeg } : {}),
    });
  }

  if (ownershipNameLineIsVisible(nameLineType)) {
    const lineFromTop =
      measured != null
        ? rect.innerTopFromPageTop + measured.nameLineBottomPt
        : layout.nameLine.lineBottomFromPageTop;
    slide.addShape('line', {
      x: ptToIn(rect.innerLeft),
      y: ptToIn(lineFromTop),
      w: safeIn(ptToIn(rect.innerWidth)),
      h: 0,
      line: {
        color: toPptColorHex(block.frameBorderColor ?? block.textColor, '1F2937'),
        width: cssPxToPoints(1),
        ...(nameLineType === 'dashed'
          ? { dashType: 'dash' }
          : nameLineType === 'dotted'
            ? { dashType: 'sysDot' }
            : {}),
      },
    });
  }
}

async function addTextBlockToSlide(
  slide: {
    addText: (text: unknown, opts: Record<string, unknown>) => void;
    addShape: (shape: string, opts: Record<string, unknown>) => void;
  },
  block: TextPageBlock,
  layoutSettings: WordSearchSettings,
  rect: ReturnType<typeof getTextPageBlockRectPt>
) {
  const fallbackColor = resolveTextPageTextColor(
    { textColor: block.textColor } as TextModuleSettings,
    layoutSettings
  );
  const spacing = {
    wordSpacingPx: block.wordSpacingPx ?? 0,
    letterSpacingPx: block.letterSpacingPx ?? 0,
  };

  if (block.kind === 'ownership') {
    addOwnershipBlockToSlide(slide, block, rect, fallbackColor);
    return;
  }

  const domLines = measureTextBlockLayoutFromDom(block, rect.innerWidth, fallbackColor);
  if (domLines && domLines.length > 0) {
    for (const line of domLines) {
      for (const run of line.runs) {
        if (!run.text || run.text === '\n') continue;
        const runWidthPt = measureRunWidthPt(run, spacing);
        slide.addText(run.text, {
          x: ptToIn(rect.innerLeft + run.xPt),
          y: ptToIn(rect.innerTopFromPageTop + line.lineTopPt),
          w: safeIn(ptToIn(Math.max(runWidthPt, 0.05))),
          h: safeIn(ptToIn(line.lineHeightPt)),
          fontSize: pptFontSize(run.fontSize),
          fontFace: run.fontFamily || 'Arial',
          color: toPptColorHex(run.color, '1F2937'),
          bold: run.bold,
          italic: run.italic,
          underline: run.underline ? { style: 'sng' as const } : undefined,
          align: 'left',
          valign: 'top',
            margin: [...PPT_ZERO_MARGIN],
            wrap: false,
            fit: 'none',
            paraSpaceBefore: 0,
            paraSpaceAfter: 0,
            lineSpacing: pptExactLineSpacing(line.lineHeightPt),
            isTextBox: true,
          rotate: block.rotationDeg ?? 0,
        });
      }
    }
  } else {
    const runs = parseRichTextRuns(block, fallbackColor);
    const lines = layoutRichTextLines(
      runs,
      rect.innerWidth,
      block.lineHeight ?? 1.35,
      spacing
    );

    let cursorTopPt = rect.innerTopFromPageTop;
    for (const line of lines) {
      for (const run of line.runs) {
        if (!run.text || run.text === '\n') continue;
        const runWidthPt = measureRunWidthPt(run, spacing);
        const lineWidthPt = line.runs.reduce((sum, r) => sum + measureRunWidthPt(r, spacing), 0);
        const alignShiftPt = alignOffsetX(block.alignment, lineWidthPt, rect.innerWidth);
        slide.addText(run.text, {
          x: ptToIn(rect.innerLeft + alignShiftPt + run.xPt),
          y: ptToIn(cursorTopPt),
          w: safeIn(ptToIn(Math.max(runWidthPt, 0.05))),
          h: safeIn(ptToIn(line.lineHeightPt)),
          fontSize: pptFontSize(run.fontSize),
          fontFace: run.fontFamily || 'Arial',
          color: toPptColorHex(run.color, '1F2937'),
          bold: run.bold,
          italic: run.italic,
          underline: run.underline ? { style: 'sng' as const } : undefined,
          align: 'left',
          valign: 'top',
            margin: [...PPT_ZERO_MARGIN],
            wrap: false,
            fit: 'none',
            paraSpaceBefore: 0,
            paraSpaceAfter: 0,
            lineSpacing: pptExactLineSpacing(line.lineHeightPt),
            isTextBox: true,
          rotate: block.rotationDeg ?? 0,
        });
      }
      cursorTopPt += line.lineHeightPt;
    }
  }
}

async function addImageBlockToSlide(
  slide: {
    addImage: (opts: Record<string, unknown>) => void;
    addShape: (shape: string, opts: Record<string, unknown>) => void;
  },
  block: TextPageBlock,
  rect: ReturnType<typeof getTextPageBlockRectPt>
) {
  if (block.frameEnabled) {
    addHeaderShapeToSlide(
      slide,
      resolveTextPageFrameShapeId(block),
      ptToIn(rect.left),
      ptToIn(rect.topFromPageTop),
      safeIn(ptToIn(rect.width)),
      safeIn(ptToIn(rect.height)),
      block.frameFillColor ?? '#ffffff',
      block.frameBorderColor ?? '#1f2937',
      block.frameBorderThicknessPx ?? 2,
      {
        borderRadiusPx: getFrameCornerRadiusPx(
          block,
          rect.width * (96 / 72),
          rect.height * (96 / 72)
        ),
      }
    );
  }

  const svgSrc =
    block.imageSrc && block.imageSrc.startsWith('data:image/svg+xml') ? block.imageSrc : null;
  const dataUrl =
    svgSrc ??
    (await renderImageBlockToDataUrl(block, rect.innerWidth, rect.innerHeight));
  if (!dataUrl) return;

  slide.addImage({
    data: dataUrl,
    x: ptToIn(rect.innerLeft),
    y: ptToIn(rect.innerTopFromPageTop),
    w: safeIn(ptToIn(rect.innerWidth)),
    h: safeIn(ptToIn(rect.innerHeight)),
    rotate: block.rotationDeg ?? 0,
  });
}

async function addBlockToSlide(
  slide: {
    addText: (text: unknown, opts: Record<string, unknown>) => void;
    addImage: (opts: Record<string, unknown>) => void;
    addShape: (shape: string, opts: Record<string, unknown>) => void;
  },
  block: TextPageBlock,
  settings: TextModuleSettings,
  layoutSettings: WordSearchSettings,
  pageWidthPt: number,
  pageHeightPt: number,
  marginPt: number
) {
  const area = getTextPageContentAreaPt(pageWidthPt, pageHeightPt, marginPt);
  const rect = getTextPageBlockRectPt(block, pageHeightPt, area);

  if (block.kind === 'image') {
    await addImageBlockToSlide(slide, block, rect);
    return;
  }

  if (block.frameEnabled) {
    const borderPx = block.frameBorderThicknessPx ?? 2;
    const strokePt = cssPxToPoints(borderPx);
    const half = strokePt / 2;
    addHeaderShapeToSlide(
      slide,
      resolveTextPageFrameShapeId(block),
      ptToIn(rect.left + half),
      ptToIn(rect.topFromPageTop + half),
      safeIn(ptToIn(Math.max(1, rect.width - strokePt))),
      safeIn(ptToIn(Math.max(1, rect.height - strokePt))),
      block.frameFillColor ?? '#ffffff',
      block.frameBorderColor ?? '#1f2937',
      borderPx,
      {
        borderRadiusPx: Math.max(
          0,
          getFrameCornerRadiusPx(
            block,
            rect.width * (96 / 72),
            rect.height * (96 / 72)
          ) -
            borderPx / 2
        ),
      }
    );
  }

  await addTextBlockToSlide(slide, block, layoutSettings, rect);
}

type SlideLike = {
  addText: (text: unknown, opts: Record<string, unknown>) => void;
  addImage: (opts: Record<string, unknown>) => void;
  addShape: (shape: string, opts: Record<string, unknown>) => void;
};

function addTocModuleToSlide(
  slide: SlideLike,
  settings: TextModuleSettings,
  layoutSettings: WordSearchSettings,
  _pageWidthPt: number,
  _pageHeightPt: number,
  entries: ResolvedTocEntry[],
  pageTitle: string
): void {
  const toc = normalizeTocSettings(settings.tocSettings);
  const layout = buildTocExportLayout(
    settings,
    layoutSettings,
    entries,
    pageTitle,
    settings.tocTotalEntryCount
  );
  const titleColor = toPptColorHex(layout.titleColor);
  const entryColor = toPptColorHex(layout.entryColor);
  const contentWidthPt = Math.max(
    40,
    layout.columns.reduce((w, c) => Math.max(w, c.xPt + c.widthPt), layout.titleXPt) -
      layout.titleXPt
  );

  const titleFontSize = pptFontSize(layout.titleFontSizePt);
  const titleLineH = layout.titleFontSizePt * 1.2;
  slide.addText(layout.titleText, {
    x: ptToIn(layout.titleXPt),
    y: ptToIn(layout.titleYFromTopPt),
    w: safeIn(ptToIn(contentWidthPt)),
    h: safeIn(ptToIn(titleLineH + 0.75)),
    fontSize: titleFontSize,
    fontFace: layout.titleFontFamily,
    color: titleColor,
    bold: layout.titleBold,
    align: layout.titleAlign,
    ...pptCanvasTextOpts({
      wrap: false,
      valign: 'top',
      lineHeightPt: titleLineH,
    }),
  });

  const entryFontSize = pptFontSize(layout.entryFontSizePt);
  const rowH = layout.rowHeightPt;
  const charSpacing =
    layout.entryLetterSpacingPt > 0 ? layout.entryLetterSpacingPt : undefined;

  for (const column of layout.columns) {
    for (const row of column.rows) {
      const rowLeft = column.xPt + row.indentPt;
      const rowWidth = Math.max(20, column.widthPt - row.indentPt);
      const pageNum = toc.showPageNumbers ? row.pageNumber : '';
      const simplePagePadPt = row.simple ? cssPxToPoints(8) : 0;
      const yIn = ptToIn(row.yFromTopPt);
      const hIn = safeIn(ptToIn(rowH + 0.5));

      const pageNumWidthPt = pageNum
        ? measureTextWidthPt(pageNum, layout.entryFontSizePt, layout.entryFontFamily, layout.entryBold)
        : 0;
      const titleWidthPt = measureTextWidthPt(
        row.title,
        layout.entryFontSizePt,
        layout.entryFontFamily,
        layout.entryBold
      );
      const pageBoxW = Math.max(pageNumWidthPt, 8);
      const titlePageGap = layout.entryGapPt + simplePagePadPt;
      const titleBoxW = Math.max(
        12,
        pageNum ? rowWidth - pageBoxW - titlePageGap : rowWidth
      );

      slide.addText(row.title, {
        x: ptToIn(rowLeft),
        y: yIn,
        w: safeIn(ptToIn(titleBoxW)),
        h: hIn,
        fontSize: entryFontSize,
        fontFace: layout.entryFontFamily,
        color: entryColor,
        bold: layout.entryBold,
        align: 'left',
        ...pptCanvasTextOpts({
          wrap: false,
          valign: 'middle',
          lineHeightPt: layout.entryLineHeightPt,
          charSpacingPt: charSpacing,
        }),
      });

      if (pageNum) {
        if (row.showLeader) {
          const leaderStart = rowLeft + Math.min(titleWidthPt, titleBoxW) + layout.entryGapPt;
          const leaderEnd = column.xPt + column.widthPt - pageBoxW - layout.entryGapPt;
          const leaderW = leaderEnd - leaderStart;
          if (leaderW > 4) {
            slide.addShape('line', {
              x: ptToIn(leaderStart),
              y: ptToIn(row.yFromTopPt + layout.rowPadPt + layout.entryLineHeightPt * 0.72),
              w: safeIn(ptToIn(leaderW)),
              h: 0,
              line: {
                color: entryColor,
                width: cssPxToPoints(1),
                transparency: 55,
                dashType:
                  row.leaderStyle === 'dashes'
                    ? 'dash'
                    : row.leaderStyle === 'dots'
                      ? 'sysDot'
                      : undefined,
              },
            });
          }
        }

        slide.addText(pageNum, {
          x: ptToIn(column.xPt + column.widthPt - pageBoxW),
          y: yIn,
          w: safeIn(ptToIn(pageBoxW)),
          h: hIn,
          fontSize: entryFontSize,
          fontFace: layout.entryFontFamily,
          color: entryColor,
          bold: layout.entryBold,
          align: 'right',
          ...pptCanvasTextOpts({
            wrap: false,
            valign: 'middle',
            lineHeightPt: layout.entryLineHeightPt,
            charSpacingPt: charSpacing,
          }),
        });
      }
    }
  }
}

export async function addTextModuleSlide(
  prs: { addSlide: () => SlideLike },
  settings: TextModuleSettings,
  layoutSettings: WordSearchSettings,
  bookPageIndex: number,
  backgroundCache: FlattenedBackgroundPptCache,
  pageTitle = 'Text Page',
  resolvedToc?: ResolvedTocEntry[],
  suppressPageNumber = false,
  moduleType?: DocumentModuleType | string
): Promise<void> {
  const slide = prs.addSlide();
  const pageWidthPt = (layoutSettings.bookCanvas.customWidth || 8.5) * 72;
  const pageHeightPt = (layoutSettings.bookCanvas.customHeight || 11) * 72;
  const pageW = ptToIn(pageWidthPt);
  const pageH = ptToIn(pageHeightPt);
  const pageBackground = resolveTextPageBackground(settings, layoutSettings);
  const pageFrame = resolveTextPageFrameSettings(settings, layoutSettings);

  const bgConfig = puzzlePageBackgroundConfig(
    pageWidthPt,
    pageHeightPt,
    pageBackground,
    pageFrame.cornerRadiusPx,
    PPT_BG_OPTIONS
  );
  await applyFlattenedBackgroundToSlide(slide, bgConfig, backgroundCache, hex6);
  addPageContainerFrame(
    slide,
    pageW,
    pageH,
    pageFrame,
    pageBackground.backgroundColor,
    !!pageBackground.backgroundImage
  );

  const marginPt = getPageMarginInches(layoutSettings) * 72;

  if (isTocModuleSettings(settings)) {
    const toc = normalizeTocSettings(settings.tocSettings);
    const entries =
      resolvedToc && resolvedToc.length > 0
        ? resolvedToc
        : parseTocEntriesFromContent(settings.content || '', toc.tableFormat);
    addTocModuleToSlide(
      slide,
      settings,
      layoutSettings,
      pageWidthPt,
      pageHeightPt,
      entries,
      pageTitle
    );
  } else {
    const blocks = resolveTextPageBlocks(settings, pageTitle, layoutSettings, moduleType);

    if (blocks.length > 0) {
      for (const block of blocks) {
        await addBlockToSlide(
          slide,
          block,
          settings,
          layoutSettings,
          pageWidthPt,
          pageHeightPt,
          marginPt
        );
      }
    } else if (!Array.isArray(settings.blocks)) {
      const layout = buildLegacyCenteredTextLayout(
        settings,
        layoutSettings,
        pageWidthPt,
        pageHeightPt,
        pageTitle
      );
      const pptAlign =
        layout.alignment === 'left' ? 'left' : layout.alignment === 'right' ? 'right' : 'center';
      const textColor = hex6(layout.color, '1F2937');
      for (const line of layout.lines) {
        slide.addText(line.text, {
          x: ptToIn(layout.boxLeftPt),
          y: ptToIn(line.topPt),
          w: safeIn(ptToIn(layout.boxWidthPt)),
          h: safeIn(ptToIn(line.lineHeightPt)),
          fontSize: pptFontSize(line.fontSizePt),
          fontFace: layout.fontFamily,
          color: textColor,
          bold: line.bold,
          align: pptAlign,
          valign: 'middle',
            margin: [...PPT_ZERO_MARGIN],
            wrap: false,
            fit: 'none',
            paraSpaceBefore: 0,
            paraSpaceAfter: 0,
            lineSpacing: pptExactLineSpacing(line.lineHeightPt),
            isTextBox: true,
        });
      }
    }
  }

  if (
    !suppressPageNumber &&
    settings.tocMode !== 'auto' &&
    settings.tocMode !== 'manual'
  ) {
    addPageNumberToSlide(slide, pageWidthPt, pageHeightPt, layoutSettings, bookPageIndex);
  }
}
