import type { TextModuleSettings, TextPageBlock } from './document-model';
import type { WordSearchSettings } from './puzzles/types';
import { addHeaderShapeToSlide } from './header-assembly-ppt-draw';
import { cssPxToPoints, getPageMarginInches } from './puzzle-layout';
import { resolveTextPageBlocks, resolveOwnershipNameLineType, ownershipNameLineIsVisible } from './text-page-blocks';
import {
  getFrameCornerRadiusPx,
  getOwnershipNameLineRect,
  getTextPageBlockRectPt,
  getTextPageContentAreaPt,
  ptToIn,
  resolveTextPageFrameShapeId,
} from './text-page-export-layout';
import { renderImageBlockToDataUrl } from './text-page-image-export';
import { measureTextBlockLayoutFromDom, measureOwnershipBlockLayoutFromDom } from './text-page-dom-layout';
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
  tocLeaderDashPattern,
} from './toc-export-draw';
import { normalizeTocSettings } from './toc-settings';

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
    const nameLineType = resolveOwnershipNameLineType(block);
    const ownershipLayout = measureOwnershipBlockLayoutFromDom(
      block,
      rect.innerWidth,
      rect.innerHeight,
      fallbackColor,
      nameLineType
    );

    if (ownershipLayout) {
      for (const line of ownershipLayout.textLines) {
        for (const run of line.runs) {
          if (!run.text || run.text === '\n') continue;
          const runWidthPt = measureRunWidthPt(run, spacing);
          slide.addText(run.text, {
            x: ptToIn(rect.innerLeft + run.xPt),
            y: ptToIn(rect.innerTopFromPageTop + line.lineTopPt),
            w: safeIn(ptToIn(Math.max(runWidthPt, 0.05))),
            h: safeIn(ptToIn(line.lineHeightPt)),
            fontSize: Math.round(run.fontSize),
            fontFace: run.fontFamily || 'Arial',
            color: toPptColorHex(run.color, '1F2937'),
            bold: run.bold,
            italic: run.italic,
            underline: run.underline ? { style: 'sng' as const } : undefined,
            align: 'left',
            valign: 'top',
            margin: 0,
            wrap: false,
            isTextBox: true,
            rotate: block.rotationDeg ?? 0,
          });
        }
      }

      if (ownershipNameLineIsVisible(nameLineType)) {
        const nameLine = getOwnershipNameLineRect(
          rect,
          block,
          ownershipLayout.nameLineBottomPt
        );
        slide.addShape('line', {
          x: ptToIn(rect.innerLeft),
          y: ptToIn(nameLine.lineBottomFromPageTop),
          w: safeIn(ptToIn(rect.innerWidth)),
          h: 0,
          line: {
            color: toPptColorHex(block.frameBorderColor ?? block.textColor, '1F2937'),
            width: 1,
            ...(nameLineType === 'dashed'
              ? { dashType: 'dash' }
              : nameLineType === 'dotted'
                ? { dashType: 'sysDot' }
                : {}),
          },
        });
      }
      return;
    }
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
          fontSize: Math.round(run.fontSize),
          fontFace: run.fontFamily || 'Arial',
          color: toPptColorHex(run.color, '1F2937'),
          bold: run.bold,
          italic: run.italic,
          underline: run.underline ? { style: 'sng' as const } : undefined,
          align: 'left',
          valign: 'top',
          margin: 0,
          wrap: false,
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
          fontSize: Math.round(run.fontSize),
          fontFace: run.fontFamily || 'Arial',
          color: toPptColorHex(run.color, '1F2937'),
          bold: run.bold,
          italic: run.italic,
          underline: run.underline ? { style: 'sng' as const } : undefined,
          align: 'left',
          valign: 'top',
          margin: 0,
          wrap: false,
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

  const dataUrl = await renderImageBlockToDataUrl(
    block,
    rect.innerWidth,
    rect.innerHeight
  );
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
  pageWidthPt: number,
  pageHeightPt: number,
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

  slide.addText(layout.titleText, {
    x: ptToIn(layout.titleXPt),
    y: ptToIn(layout.titleYFromTopPt),
    w: safeIn(ptToIn(contentWidthPt)),
    h: safeIn(ptToIn(layout.titleFontSizePt * 1.25)),
    fontSize: Math.max(8, Math.round(layout.titleFontSizePt)),
    fontFace: layout.titleFontFamily,
    color: titleColor,
    bold: layout.titleBold,
    align: layout.titleAlign,
    valign: 'top',
    margin: 0,
    isTextBox: true,
  });

  for (const column of layout.columns) {
    for (const row of column.rows) {
      const rowLeft = column.xPt + row.indentPt;
      const rowWidth = Math.max(20, column.widthPt - row.indentPt);
      const pageNum = toc.showPageNumbers ? row.pageNumber : '';
      const yIn = ptToIn(row.yFromTopPt);
      const hIn = safeIn(ptToIn(layout.entryFontSizePt * 1.25));
      const fontSize = Math.max(7, Math.round(layout.entryFontSizePt));

      if (row.simple || !pageNum) {
        const parts: Array<{ text: string; options?: Record<string, unknown> }> = [
          { text: row.title },
        ];
        if (pageNum) {
          parts.push({ text: `  ${pageNum}` });
        }
        slide.addText(parts, {
          x: ptToIn(rowLeft),
          y: yIn,
          w: safeIn(ptToIn(rowWidth)),
          h: hIn,
          fontSize,
          fontFace: layout.entryFontFamily,
          color: entryColor,
          bold: layout.entryBold,
          align: 'left',
          valign: 'top',
          margin: 0,
          isTextBox: true,
        });
        continue;
      }

      // Title (left) + page number (right); leader via underline on a spacer text box.
      const pageBoxW = Math.min(rowWidth * 0.2, 36);
      const titleBoxW = Math.max(20, rowWidth - pageBoxW - layout.entryGapPt);

      slide.addText(row.title, {
        x: ptToIn(rowLeft),
        y: yIn,
        w: safeIn(ptToIn(titleBoxW)),
        h: hIn,
        fontSize,
        fontFace: layout.entryFontFamily,
        color: entryColor,
        bold: layout.entryBold,
        align: 'left',
        valign: 'top',
        margin: 0,
        isTextBox: true,
      });

      if (row.showLeader) {
        const dash = tocLeaderDashPattern(row.leaderStyle);
        const leaderY = row.yFromTopPt + layout.entryFontSizePt * 0.85;
        // Approximate leader with a thin line shape.
        slide.addShape('line', {
          x: ptToIn(rowLeft + Math.min(titleBoxW * 0.55, titleBoxW - 8)),
          y: ptToIn(leaderY),
          w: safeIn(ptToIn(Math.max(8, pageBoxW + titleBoxW * 0.35))),
          h: 0,
          line: {
            color: entryColor,
            width: 0.75,
            transparency: 55,
            dashType: row.leaderStyle === 'dashes' ? 'dash' : 'sysDot',
          },
        });
        void dash;
      }

      slide.addText(pageNum, {
        x: ptToIn(column.xPt + column.widthPt - pageBoxW),
        y: yIn,
        w: safeIn(ptToIn(pageBoxW)),
        h: hIn,
        fontSize,
        fontFace: layout.entryFontFamily,
        color: entryColor,
        bold: layout.entryBold,
        align: 'right',
        valign: 'top',
        margin: 0,
        isTextBox: true,
      });
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
  suppressPageNumber = false
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
    const blocks = resolveTextPageBlocks(settings, pageTitle, layoutSettings);

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
      // Explicit empty blocks (title/separator pages) stay blank — match canvas.
      const marginIn = ptToIn(marginPt);
      const contentWIn = ptToIn(pageWidthPt - marginPt * 2);
      const titleSize = settings.fontSize;
      const bodySize = settings.fontSize;
      const titleLine = (settings.title || '').trim();
      const bodyText = (settings.content || '').trim();
      const alignment = settings.alignment || 'center';
      const textColor = hex6(resolveTextPageTextColor(settings, layoutSettings), '1F2937');
      const fontFace = settings.fontFamily || 'Arial';
      const pptAlign = alignment === 'left' ? 'left' : alignment === 'right' ? 'right' : 'center';
      const titleLines = titleLine ? [titleLine] : [];
      const bodyLines = bodyText ? bodyText.split('\n') : [];
      const lineHeightIn = ptToIn(bodySize * 1.35);
      const titleLineHeightIn = ptToIn(titleSize * 1.2);
      const gapAfterTitleIn =
        titleLines.length > 0 && bodyLines.length > 0 ? lineHeightIn * 0.5 : 0;
      const totalHeightIn =
        titleLines.length * titleLineHeightIn +
        gapAfterTitleIn +
        bodyLines.length * lineHeightIn;
      let cursorYIn = Math.max(marginIn, (pageH - totalHeightIn) / 2);

      for (const line of titleLines) {
        slide.addText(line, {
          x: marginIn,
          y: cursorYIn,
          w: contentWIn,
          h: titleLineHeightIn,
          fontSize: Math.round(titleSize),
          fontFace,
          color: textColor,
          bold: true,
          align: pptAlign,
          valign: 'top',
          margin: 0,
          isTextBox: true,
        });
        cursorYIn += titleLineHeightIn;
      }
      if (gapAfterTitleIn > 0) cursorYIn += gapAfterTitleIn;
      for (const line of bodyLines) {
        slide.addText(line, {
          x: marginIn,
          y: cursorYIn,
          w: contentWIn,
          h: lineHeightIn,
          fontSize: Math.round(bodySize),
          fontFace,
          color: textColor,
          align: pptAlign,
          valign: 'top',
          margin: 0,
          isTextBox: true,
        });
        cursorYIn += lineHeightIn;
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
