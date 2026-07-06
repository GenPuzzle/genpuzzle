import type { TextModuleSettings, TextPageBlock, TextPageBlockKind } from './document-model';
import type { WordSearchSettings } from './puzzles/types';
import { resolveTextPageTextColor } from './text-page-settings';

export type TitlePagePositionPreset =
  | 'top'
  | 'upper-center'
  | 'center'
  | 'lower-center'
  | 'bottom';

export const SINGLE_INSTANCE_BLOCK_KINDS: TextPageBlockKind[] = [
  'title',
  'subtitle',
  'ownership',
  'copyright',
];

export function createBlockId(prefix = 'block'): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export function normalizeBlockKind(kind: TextPageBlockKind): TextPageBlockKind {
  return kind === 'body' ? 'subtitle' : kind;
}

export function normalizeTextPageBlock(block: TextPageBlock): TextPageBlock {
  return {
    ...block,
    kind: normalizeBlockKind(block.kind),
    lineHeight: block.lineHeight ?? 1.35,
  };
}

function baseBlockFromSettings(
  settings: TextModuleSettings,
  globalSettings: WordSearchSettings,
  overrides: Partial<TextPageBlock> &
    Pick<TextPageBlock, 'kind' | 'text' | 'xPercent' | 'yPercent'>
): TextPageBlock {
  const kind = normalizeBlockKind(overrides.kind);
  return normalizeTextPageBlock({
    id: overrides.id ?? createBlockId(kind),
    widthPercent: 80,
    fontFamily: settings.fontFamily || 'Arial',
    fontSize: settings.fontSize || 18,
    textColor: resolveTextPageTextColor(settings, globalSettings),
    alignment: settings.alignment || 'center',
    bold: kind === 'title',
    lineHeight: 1.35,
    ...overrides,
    kind,
  });
}

export function createDefaultTitlePageBlocks(
  pageTitle: string,
  settings: TextModuleSettings,
  globalSettings: WordSearchSettings
): TextPageBlock[] {
  const titleSize = settings.titleFontSize ?? settings.fontSize * 1.6;
  return [
    baseBlockFromSettings(settings, globalSettings, {
      id: 'block-title',
      kind: 'title',
      text: settings.title || pageTitle,
      xPercent: 10,
      yPercent: 6,
      widthPercent: 80,
      fontSize: titleSize,
      bold: true,
    }),
    baseBlockFromSettings(settings, globalSettings, {
      id: 'block-subtitle',
      kind: 'subtitle',
      text: settings.content || 'Subtitle',
      xPercent: 10,
      yPercent: 16,
      widthPercent: 75,
      fontSize: Math.max(14, settings.fontSize),
      bold: false,
    }),
    baseBlockFromSettings(settings, globalSettings, {
      id: 'block-copyright',
      kind: 'copyright',
      text: `© ${new Date().getFullYear()} Your Name. All rights reserved.`,
      xPercent: 10,
      yPercent: 88,
      widthPercent: 80,
      fontSize: 9,
      bold: false,
    }),
  ];
}

export function createSubtitleBlock(
  settings: TextModuleSettings,
  globalSettings: WordSearchSettings
): TextPageBlock {
  return baseBlockFromSettings(settings, globalSettings, {
    kind: 'subtitle',
    text: 'Subtitle',
    xPercent: 10,
    yPercent: 16,
    widthPercent: 75,
    fontSize: Math.max(14, settings.fontSize),
    bold: false,
  });
}

export function createAdditionalTextBlock(
  settings: TextModuleSettings,
  globalSettings: WordSearchSettings
): TextPageBlock {
  return baseBlockFromSettings(settings, globalSettings, {
    kind: 'text',
    text: 'Additional text',
    xPercent: 10,
    yPercent: 42,
    widthPercent: 70,
    fontSize: settings.fontSize,
    bold: false,
  });
}

export function createOwnershipBlock(
  settings: TextModuleSettings,
  globalSettings: WordSearchSettings
): TextPageBlock {
  return normalizeTextPageBlock({
    ...baseBlockFromSettings(settings, globalSettings, {
      kind: 'ownership',
      text: 'This book belongs to:',
      xPercent: 20,
      yPercent: 68,
      widthPercent: 60,
      fontSize: Math.max(12, settings.fontSize - 2),
      bold: false,
      alignment: 'center',
    }),
    frameEnabled: true,
    frameShape: 'rounded',
    frameFillColor: '#ffffff',
    frameBorderColor: '#1f2937',
    frameBorderThicknessPx: 2,
    frameCornerRadiusPx: 10,
    framePaddingPx: 16,
    showNameLine: true,
  });
}

export function createCopyrightBlock(
  settings: TextModuleSettings,
  globalSettings: WordSearchSettings
): TextPageBlock {
  return baseBlockFromSettings(settings, globalSettings, {
    kind: 'copyright',
    text: `© ${new Date().getFullYear()} Your Name. All rights reserved.`,
    xPercent: 10,
    yPercent: 88,
    widthPercent: 80,
    fontSize: 9,
    bold: false,
  });
}

export function createImageBlock(
  settings: TextModuleSettings,
  globalSettings: WordSearchSettings
): TextPageBlock {
  return normalizeTextPageBlock({
    ...baseBlockFromSettings(settings, globalSettings, {
      kind: 'image',
      text: '',
      xPercent: 22.5,
      yPercent: 32,
      widthPercent: 55,
      fontSize: settings.fontSize,
      bold: false,
      alignment: 'center',
    }),
    heightPercent: 28,
    imageFit: 'contain',
    imageOpacity: 100,
  });
}

/** @deprecated use createAdditionalTextBlock */
export function createTextBlock(
  settings: TextModuleSettings,
  globalSettings: WordSearchSettings
): TextPageBlock {
  return createAdditionalTextBlock(settings, globalSettings);
}

export function resolveTextPageBlocks(
  settings: TextModuleSettings,
  pageTitle: string,
  globalSettings: WordSearchSettings
): TextPageBlock[] {
  if (settings.blocks && settings.blocks.length > 0) {
    return settings.blocks.map(normalizeTextPageBlock);
  }
  return createDefaultTitlePageBlocks(pageTitle, settings, globalSettings);
}

export function syncLegacyFieldsFromBlocks(blocks: TextPageBlock[]): Partial<TextModuleSettings> {
  const normalized = blocks.map(normalizeTextPageBlock);
  const titleBlock = normalized.find((block) => block.kind === 'title');
  const subtitleBlock = normalized.find((block) => block.kind === 'subtitle');
  const extraText = normalized
    .filter((block) => block.kind === 'text')
    .map((block) => block.text)
    .filter(Boolean)
    .join('\n');

  const contentParts = [subtitleBlock?.text, extraText].filter((part) => part && part.trim());
  return {
    blocks: normalized,
    title: titleBlock?.text ?? '',
    content: contentParts.join('\n'),
    fontFamily: titleBlock?.fontFamily ?? subtitleBlock?.fontFamily,
    fontSize: subtitleBlock?.fontSize ?? titleBlock?.fontSize,
    titleFontSize: titleBlock?.fontSize,
    textColor: titleBlock?.textColor ?? subtitleBlock?.textColor,
    alignment: titleBlock?.alignment ?? subtitleBlock?.alignment,
  };
}

export function getMutableTextPageBlocks(
  settings: TextModuleSettings,
  pageTitle: string,
  globalSettings: WordSearchSettings
): TextPageBlock[] {
  return resolveTextPageBlocks(settings, pageTitle, globalSettings).map(normalizeTextPageBlock);
}

export function updateTextPageBlock(
  settings: TextModuleSettings,
  blockId: string,
  patch: Partial<TextPageBlock>,
  pageTitle: string,
  globalSettings: WordSearchSettings
): Partial<TextModuleSettings> {
  const blocks = getMutableTextPageBlocks(settings, pageTitle, globalSettings).map((block) =>
    block.id === blockId ? normalizeTextPageBlock({ ...block, ...patch }) : block
  );
  return syncLegacyFieldsFromBlocks(blocks);
}

export function addTextPageBlock(
  settings: TextModuleSettings,
  block: TextPageBlock,
  pageTitle: string,
  globalSettings: WordSearchSettings
): Partial<TextModuleSettings> {
  const blocks = [
    ...getMutableTextPageBlocks(settings, pageTitle, globalSettings),
    normalizeTextPageBlock(block),
  ];
  return syncLegacyFieldsFromBlocks(blocks);
}

export function removeTextPageBlock(
  settings: TextModuleSettings,
  blockId: string,
  pageTitle: string,
  globalSettings: WordSearchSettings
): Partial<TextModuleSettings> {
  const blocks = getMutableTextPageBlocks(settings, pageTitle, globalSettings).filter(
    (block) => block.id !== blockId
  );
  return syncLegacyFieldsFromBlocks(blocks);
}

export function blockDisplayLabel(block: TextPageBlock): string {
  const kind = normalizeBlockKind(block.kind);
  switch (kind) {
    case 'title':
      return 'Title';
    case 'subtitle':
      return 'Subtitle';
    case 'text':
      return block.text.trim().slice(0, 18) || 'Additional text';
    case 'ownership':
      return 'This book belongs to';
    case 'copyright':
      return 'Copyright';
    case 'image':
      return 'Image';
    default:
      return 'Element';
  }
}

export function blockKindLabel(kind: TextPageBlockKind): string {
  return blockDisplayLabel({ kind: normalizeBlockKind(kind) } as TextPageBlock);
}

/** @deprecated */
export function blockTabLabel(block: TextPageBlock): string {
  return blockDisplayLabel(block);
}

export function canAddBlockKind(blocks: TextPageBlock[], kind: TextPageBlockKind): boolean {
  const normalized = normalizeBlockKind(kind);
  if (SINGLE_INSTANCE_BLOCK_KINDS.includes(normalized)) {
    return !blocks.some((block) => normalizeBlockKind(block.kind) === normalized);
  }
  return true;
}

export function applyPositionPreset(
  block: TextPageBlock,
  preset: TitlePagePositionPreset
): Partial<TextPageBlock> {
  switch (preset) {
    case 'top':
      return { xPercent: 10, yPercent: 6, widthPercent: block.widthPercent };
    case 'upper-center':
      return { xPercent: 10, yPercent: 18, widthPercent: block.widthPercent };
    case 'center':
      if (block.kind === 'image') {
        return { xPercent: 22.5, yPercent: 32, widthPercent: 55, heightPercent: 28 };
      }
      return { xPercent: 10, yPercent: 40, widthPercent: block.widthPercent };
    case 'lower-center':
      return { xPercent: 10, yPercent: 62, widthPercent: block.widthPercent };
    case 'bottom':
      return { xPercent: 10, yPercent: 86, widthPercent: block.widthPercent };
    default:
      return {};
  }
}

export function clampPercent(value: number, min = 0, max = 95): number {
  return Math.min(max, Math.max(min, value));
}

export function createBlockForKind(
  kind: TextPageBlockKind,
  settings: TextModuleSettings,
  globalSettings: WordSearchSettings
): TextPageBlock {
  switch (normalizeBlockKind(kind)) {
    case 'title':
      return createDefaultTitlePageBlocks('Title', settings, globalSettings)[0];
    case 'subtitle':
      return createSubtitleBlock(settings, globalSettings);
    case 'text':
      return createAdditionalTextBlock(settings, globalSettings);
    case 'ownership':
      return createOwnershipBlock(settings, globalSettings);
    case 'copyright':
      return createCopyrightBlock(settings, globalSettings);
    case 'image':
      return createImageBlock(settings, globalSettings);
    default:
      return createAdditionalTextBlock(settings, globalSettings);
  }
}
