/**
 * Chapter title page layouts (4 presets) + shared style settings.
 * Style edits apply to every document marked isChapterPage.
 */

import {
  createDocumentPage,
  type TextPageBlock,
  type TextPageBlockFrameShape,
  type TextModuleSettings,
  type DocumentPage,
} from './document-model';
import { createBlockId, normalizeTextPageBlock } from './text-page-blocks';
import { isChapterTitlePage } from './insert-separator-page';
import { getDefaultWordSearchSettings, type WordSearchSettings } from './puzzles/types';

export type ChapterLayoutId =
  | 'title-sub-image'
  | 'title-image-sub'
  | 'image-title-sub';

/** Map legacy layout ids (pre–4-layout system) to the new set. */
const LEGACY_LAYOUT_ID_MAP: Record<string, ChapterLayoutId> = {
  'classic-center': 'title-sub-image',
  'banner-frame': 'title-sub-image',
  'stacked-cards': 'title-sub-image',
  'minimal-top': 'title-image-sub',
  'corner-accent': 'title-image-sub',
  'hero-top': 'image-title-sub',
  editorial: 'image-title-sub',
  'full-bleed-caption': 'image-title-sub',
  'image-caption': 'image-title-sub',
  'split-left': 'title-sub-image',
  'split-right': 'title-sub-image',
};

export interface ChapterLayoutPreset {
  id: ChapterLayoutId;
  /** Short label for layout picker buttons */
  name: string;
  description: string;
  title: { x: number; y: number; w: number; h: number };
  subtitle: { x: number; y: number; w: number; h: number };
  image: { x: number; y: number; w: number; h: number };
}

/**
 * Three vertical layouts with large image slots (no overlap).
 * Wide/tall image bands keep chapter photos high quality in preview and export.
 */
export const CHAPTER_LAYOUT_PRESETS: ChapterLayoutPreset[] = [
  {
    id: 'title-sub-image',
    name: 'Title top',
    description: 'Title, subtitle, then a large image',
    title: { x: 6, y: 3, w: 88, h: 12 },
    subtitle: { x: 10, y: 17, w: 80, h: 8 },
    image: { x: 4, y: 28, w: 92, h: 66 },
  },
  {
    id: 'title-image-sub',
    name: 'Mid image',
    description: 'Title, large image, then subtitle',
    title: { x: 6, y: 3, w: 88, h: 11 },
    subtitle: { x: 10, y: 85, w: 80, h: 8 },
    image: { x: 4, y: 16, w: 92, h: 67 },
  },
  {
    id: 'image-title-sub',
    name: 'Image top',
    description: 'Large image, then title, then subtitle',
    title: { x: 6, y: 74, w: 88, h: 12 },
    subtitle: { x: 10, y: 88, w: 80, h: 8 },
    image: { x: 4, y: 3, w: 92, h: 66 },
  },
];

export function getChapterLayoutPreset(id: ChapterLayoutId): ChapterLayoutPreset {
  return CHAPTER_LAYOUT_PRESETS.find((p) => p.id === id) ?? CHAPTER_LAYOUT_PRESETS[0];
}

export function resolveChapterLayoutId(id: string | null | undefined): ChapterLayoutId {
  if (id && CHAPTER_LAYOUT_PRESETS.some((p) => p.id === id)) {
    return id as ChapterLayoutId;
  }
  if (id && LEGACY_LAYOUT_ID_MAP[id]) {
    return LEGACY_LAYOUT_ID_MAP[id];
  }
  return DEFAULT_CHAPTER_PAGE_STYLE.layoutId;
}

export interface ChapterPageStyleSettings {
  layoutId: ChapterLayoutId;
  titleFontFamily: string;
  titleFontSize: number;
  titleColor: string;
  titleBold: boolean;
  titleAlignment: 'left' | 'center' | 'right';
  titleFrameEnabled: boolean;
  subtitleEnabled: boolean;
  /** Optional fallback subtitle when a chapter has no per-page subtitle. */
  subtitleText: string;
  subtitleFontFamily: string;
  subtitleFontSize: number;
  subtitleColor: string;
  subtitleFrameEnabled: boolean;
  frameShape: TextPageBlockFrameShape;
  frameFillColor: string;
  frameBorderColor: string;
  frameBorderThicknessPx: number;
  frameCornerRadiusPx: number;
  framePaddingPx: number;
  showImage: boolean;
  /** Fraction of the layout image slot (0.5–1). Never expands outside the slot. */
  imageSizeScale: number;
  imageFit: 'cover' | 'contain' | 'stretch';
  pageBackgroundColor: string;
}

export const DEFAULT_CHAPTER_PAGE_STYLE: ChapterPageStyleSettings = {
  layoutId: 'title-sub-image',
  titleFontFamily: 'Georgia',
  titleFontSize: 36,
  titleColor: '#111827',
  titleBold: true,
  titleAlignment: 'center',
  titleFrameEnabled: false,
  subtitleEnabled: true,
  subtitleText: '',
  subtitleFontFamily: 'Arial',
  subtitleFontSize: 16,
  subtitleColor: '#4b5563',
  subtitleFrameEnabled: false,
  frameShape: 'rounded',
  frameFillColor: '#ffffff',
  frameBorderColor: '#1f2937',
  frameBorderThicknessPx: 2,
  frameCornerRadiusPx: 12,
  framePaddingPx: 14,
  showImage: true,
  imageSizeScale: 1,
  /** Contain keeps the full image sharp in the large slot */
  imageFit: 'contain',
  pageBackgroundColor: '#ffffff',
};

export const CHAPTER_PAGE_STYLE_STORAGE_KEY = 'puzzle-book-maker-chapter-page-style';

export function normalizeChapterPageStyle(
  partial?: Partial<ChapterPageStyleSettings> | null
): ChapterPageStyleSettings {
  const base = { ...DEFAULT_CHAPTER_PAGE_STYLE, ...(partial ?? {}) };
  base.layoutId = resolveChapterLayoutId(base.layoutId);
  base.titleFontSize = Math.max(12, Math.min(72, Math.round(base.titleFontSize) || 36));
  base.subtitleFontSize = Math.max(10, Math.min(48, Math.round(base.subtitleFontSize) || 16));
  base.imageSizeScale = Math.max(0.5, Math.min(1, Number(base.imageSizeScale) || 1));
  base.frameBorderThicknessPx = Math.max(
    1,
    Math.min(12, Math.round(base.frameBorderThicknessPx) || 2)
  );
  base.frameCornerRadiusPx = Math.max(0, Math.min(40, Math.round(base.frameCornerRadiusPx) || 0));
  return base;
}

/** Scale image inside its layout slot only (never expands into title/subtitle zones). */
function scaleInSlot(
  rect: { x: number; y: number; w: number; h: number },
  scale: number
): { x: number; y: number; w: number; h: number } {
  const s = Math.max(0.5, Math.min(1, scale));
  const w = rect.w * s;
  const h = rect.h * s;
  const x = rect.x + (rect.w - w) / 2;
  const y = rect.y + (rect.h - h) / 2;
  return { x, y, w, h };
}

function applyFrameProps(
  block: TextPageBlock,
  enabled: boolean,
  style: ChapterPageStyleSettings
): TextPageBlock {
  if (!enabled) {
    return {
      ...block,
      frameEnabled: false,
    };
  }
  return {
    ...block,
    frameEnabled: true,
    frameShape: style.frameShape,
    frameFillColor: style.frameFillColor,
    frameBorderColor: style.frameBorderColor,
    frameBorderThicknessPx: style.frameBorderThicknessPx,
    frameCornerRadiusPx: style.frameCornerRadiusPx,
    framePaddingPx: style.framePaddingPx,
  };
}

export interface ChapterBlockContent {
  title: string;
  subtitle?: string;
  imageSrc?: string;
}

/** Build title / subtitle / image blocks for one chapter page from shared style. */
export function buildChapterBlocksFromStyle(
  content: ChapterBlockContent,
  styleInput: Partial<ChapterPageStyleSettings> | null | undefined,
  _layoutSettings?: WordSearchSettings,
  existingBlocks?: TextPageBlock[]
): TextPageBlock[] {
  const style = normalizeChapterPageStyle(styleInput);
  const preset = getChapterLayoutPreset(style.layoutId);
  const blocks: TextPageBlock[] = [];
  const prevTitle = existingBlocks?.find((b) => b.kind === 'title');
  const prevSubtitle = existingBlocks?.find((b) => b.kind === 'subtitle');
  const prevImage = existingBlocks?.find((b) => b.kind === 'image');

  const titleRect = preset.title;
  let titleBlock = normalizeTextPageBlock({
    id: prevTitle?.id ?? createBlockId('chapter-title'),
    kind: 'title',
    text: content.title,
    xPercent: titleRect.x,
    yPercent: titleRect.y,
    widthPercent: titleRect.w,
    heightPercent: titleRect.h,
    fontFamily: style.titleFontFamily,
    fontSize: style.titleFontSize,
    bold: style.titleBold,
    italic: false,
    underline: false,
    alignment: style.titleAlignment,
    textColor: style.titleColor,
    lineHeight: 1.2,
    boxPaddingPx: 10,
  });
  titleBlock = applyFrameProps(titleBlock, style.titleFrameEnabled, style);
  blocks.push(titleBlock);

  if (style.subtitleEnabled) {
    const subRect = preset.subtitle;
    const subtitleText = (content.subtitle ?? style.subtitleText).trim();
    if (subtitleText) {
      let subtitleBlock = normalizeTextPageBlock({
        id: prevSubtitle?.id ?? createBlockId('chapter-subtitle'),
        kind: 'subtitle',
        text: subtitleText,
        xPercent: subRect.x,
        yPercent: subRect.y,
        widthPercent: subRect.w,
        heightPercent: subRect.h,
        fontFamily: style.subtitleFontFamily,
        fontSize: style.subtitleFontSize,
        bold: false,
        italic: false,
        underline: false,
        alignment: style.titleAlignment,
        textColor: style.subtitleColor,
        lineHeight: 1.3,
        boxPaddingPx: 8,
      });
      subtitleBlock = applyFrameProps(subtitleBlock, style.subtitleFrameEnabled, style);
      blocks.push(subtitleBlock);
    }
  }

  if (style.showImage && content.imageSrc) {
    const imgRect = scaleInSlot(preset.image, style.imageSizeScale);
    const imageBlock = normalizeTextPageBlock({
      id: prevImage?.id ?? createBlockId('chapter-image'),
      kind: 'image',
      text: '',
      xPercent: imgRect.x,
      yPercent: imgRect.y,
      widthPercent: imgRect.w,
      heightPercent: imgRect.h,
      fontFamily: style.titleFontFamily,
      fontSize: 14,
      bold: false,
      alignment: 'center',
      imageSrc: content.imageSrc,
      imageFit: style.imageFit,
      imageOpacity: 100,
      imageEffect: 'none',
    });
    blocks.push(imageBlock);
  }

  return blocks;
}

/** Create a single chapter title page using shared style settings. */
export function createStyledChapterDocumentPage(
  title = 'Chapter',
  styleInput?: Partial<ChapterPageStyleSettings> | null,
  imageSrc?: string
): DocumentPage {
  const style = normalizeChapterPageStyle(styleInput);
  const page = createDocumentPage('title-page');
  const cleanTitle = title.trim() || 'Chapter';
  page.name = cleanTitle;
  const settings = page.settings as TextModuleSettings;
  settings.title = cleanTitle;
  settings.isChapterPage = true;
  settings.chapterLayoutId = style.layoutId;
  settings.chapterImageSrc = imageSrc;
  settings.textColor = style.titleColor;
  settings.fontFamily = style.titleFontFamily;
  settings.fontSize = style.subtitleFontSize;
  settings.titleFontSize = style.titleFontSize;
  settings.useCustomBackground = true;
  settings.backgroundColor = style.pageBackgroundColor;
  settings.blocks = buildChapterBlocksFromStyle(
    { title: cleanTitle, subtitle: style.subtitleText, imageSrc },
    style
  );
  return page;
}

function extractChapterContent(settings: TextModuleSettings): ChapterBlockContent {
  const blocks = settings.blocks ?? [];
  const titleBlock = blocks.find((b) => b.kind === 'title');
  const subtitleBlock = blocks.find((b) => b.kind === 'subtitle');
  const imageBlock = blocks.find((b) => b.kind === 'image');
  return {
    title: titleBlock?.text?.trim() || settings.title || 'Chapter',
    subtitle: subtitleBlock?.text,
    imageSrc: imageBlock?.imageSrc || settings.chapterImageSrc,
  };
}

/** Rebuild blocks on every chapter page using shared style; preserves per-page titles/images. */
export function applyChapterStyleToAllDocuments(
  documents: DocumentPage[],
  styleInput: Partial<ChapterPageStyleSettings> | null | undefined,
  options?: {
    forceSharedSubtitle?: boolean;
    layoutSettings?: WordSearchSettings;
  }
): DocumentPage[] {
  const style = normalizeChapterPageStyle(styleInput);
  const layout = options?.layoutSettings ?? getDefaultWordSearchSettings();

  return documents.map((doc) => {
    if (!isChapterTitlePage(doc)) return doc;
    const settings = doc.settings as TextModuleSettings;
    const content = extractChapterContent(settings);
    if (options?.forceSharedSubtitle === true) {
      content.subtitle = style.subtitleText;
    }
    const blocks = buildChapterBlocksFromStyle(content, style, layout, settings.blocks);
    return {
      ...doc,
      name: content.title,
      settings: {
        ...settings,
        title: content.title,
        isChapterPage: true,
        textColor: style.titleColor,
        fontFamily: style.titleFontFamily,
        fontSize: style.subtitleFontSize,
        titleFontSize: style.titleFontSize,
        useCustomBackground: true,
        backgroundColor: style.pageBackgroundColor,
        blocks,
        chapterLayoutId: style.layoutId,
        chapterImageSrc: content.imageSrc,
      } as TextModuleSettings,
    };
  });
}

/** Count chapter title pages in the document list. */
export function countChapterTitlePages(documents: DocumentPage[]): number {
  return documents.filter((doc) => isChapterTitlePage(doc)).length;
}
