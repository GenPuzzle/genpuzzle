import type { MurdokuCharacter, MurdokuElementDef, MurdokuRoom } from './puzzles/murdoku';
import type { MurdokuArtStyle, MurdokuReferenceSheetSettings } from './murdoku-settings';
import { autoSheetLayout, MURDOKU_ART_STYLE_LABELS } from './murdoku-settings';
import { roomCatalogPromptBlock } from './murdoku-room-catalog';

export { autoSheetLayout };

export function isCompleteSheetGrid(itemCount: number, rows: number, columns: number): boolean {
  return itemCount > 0 && itemCount === rows * columns;
}

/** Prompt lines that match the downloaded sheet: full rectangle vs leftover boxes. */
export function sheetLayoutPromptLines(opts: {
  itemCount: number;
  rows: number;
  columns: number;
  fillNoun: string;
}): string[] {
  const count = Math.max(0, opts.itemCount);
  if (isCompleteSheetGrid(count, opts.rows, opts.columns)) {
    return [
      `Keep exactly ${opts.rows} rows and ${opts.columns} columns (${count} images).`,
      `Put exactly one ${opts.fillNoun} in every cell, in the same order.`,
    ];
  }
  return [
    `The attached reference sheet has ${count} labeled boxes.`,
    `Fill every labeled box with the related ${opts.fillNoun}, in the same order.`,
    `Do not add extra images to fill empty gaps. Follow the boxes on the sheet instead of forcing a full rectangle.`,
  ];
}

export function sheetSettingsForItems(
  sheet: MurdokuReferenceSheetSettings,
  itemCount: number
): MurdokuReferenceSheetSettings {
  const layout = autoSheetLayout(itemCount);
  const maxSide = Math.max(sheet.canvasWidth || 1800, sheet.canvasHeight || 1800, 1200);
  const cell = Math.max(1, Math.floor(maxSide / Math.max(layout.rows, layout.columns)));
  return {
    ...sheet,
    ...layout,
    cellWidth: cell,
    cellHeight: cell,
    canvasWidth: layout.columns * cell,
    canvasHeight: layout.rows * cell,
  };
}

export interface ReferenceSheetItem {
  slotId: string;
  name: string;
  description?: string;
}

export function buildReferenceSheetPng(
  items: ReferenceSheetItem[],
  settings: MurdokuReferenceSheetSettings,
  title: string
): string {
  if (typeof document === 'undefined') return '';
  const { rows, columns } = settings.rows && settings.columns
    ? { rows: settings.rows, columns: settings.columns }
    : autoSheetLayout(items.length);
  const width = settings.canvasWidth || columns * (settings.cellWidth || 360);
  const height = settings.canvasHeight || rows * (settings.cellHeight || 360);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';
  ctx.fillStyle = settings.whiteBackground ? '#ffffff' : 'rgba(255,255,255,0)';
  ctx.fillRect(0, 0, width, height);
  const pad = settings.padding ?? 16;
  const cellW = (width - pad * 2) / columns;
  const cellH = (height - pad * 2) / rows;
  ctx.strokeStyle = '#111827';
  ctx.lineWidth = settings.borderThickness || 3;
  ctx.font = `bold ${settings.slotIdFontSize || 22}px ${settings.labelFont || 'Arial'}`;
  items.forEach((item, i) => {
    const col = i % columns;
    const row = Math.floor(i / columns);
    const x = pad + col * cellW;
    const y = pad + row * cellH;
    ctx.strokeRect(x, y, cellW, cellH);
    ctx.fillStyle = '#111827';
    ctx.textAlign = 'center';
    ctx.font = `bold ${settings.slotIdFontSize || 22}px ${settings.labelFont || 'Arial'}`;
    if (settings.includeSlotIds !== false) {
      ctx.fillText(item.slotId, x + cellW / 2, y + 32);
    }
    ctx.font = `bold ${settings.labelFontSize || 28}px ${settings.labelFont || 'Arial'}`;
    ctx.fillText(item.name.toUpperCase(), x + cellW / 2, y + cellH / 2);
    if (settings.includeDescriptions && item.description) {
      ctx.font = `16px ${settings.labelFont || 'Arial'}`;
      ctx.fillStyle = '#4b5563';
      wrapText(ctx, item.description, x + 12, y + cellH / 2 + 28, cellW - 24, 18);
      ctx.fillStyle = '#111827';
    }
  });
  ctx.font = 'bold 22px Arial';
  ctx.fillStyle = '#111827';
  ctx.textAlign = 'left';
  ctx.fillText(title, pad, height - 10);
  return canvas.toDataURL('image/png');
}

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number
) {
  const words = text.split(/\s+/);
  let line = '';
  let yy = y;
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      ctx.fillText(line, x + maxWidth / 2, yy);
      line = word;
      yy += lineHeight;
    } else {
      line = test;
    }
  }
  if (line) ctx.fillText(line, x + maxWidth / 2, yy);
}

export function downloadDataUrl(dataUrl: string, filename: string) {
  const link = document.createElement('a');
  link.href = dataUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export interface CroppedSprite {
  slotId: string;
  name: string;
  dataUrl: string;
  blank: boolean;
}

export function cropSpriteSheet(
  image: HTMLImageElement,
  items: ReferenceSheetItem[],
  settings: MurdokuReferenceSheetSettings
): CroppedSprite[] {
  const { rows, columns } = settings;
  const pad = settings.padding ?? 0;
  const cellW = (image.naturalWidth - pad * 2) / columns;
  const cellH = (image.naturalHeight - pad * 2) / rows;
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) return [];
  return items.map((item, i) => {
    const col = i % columns;
    const row = Math.floor(i / columns);
    canvas.width = Math.max(1, Math.floor(cellW));
    canvas.height = Math.max(1, Math.floor(cellH));
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(
      image,
      pad + col * cellW,
      pad + row * cellH,
      cellW,
      cellH,
      0,
      0,
      canvas.width,
      canvas.height
    );
    const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    let ink = 0;
    for (let p = 0; p < data.length; p += 16) {
      const r = data[p];
      const g = data[p + 1];
      const b = data[p + 2];
      const a = data[p + 3];
      if (a > 12 && (r < 245 || g < 245 || b < 245)) ink += 1;
    }
    return {
      slotId: item.slotId,
      name: item.name,
      dataUrl: canvas.toDataURL('image/png'),
      blank: ink < 8,
    };
  });
}

export function buildCharacterAiPrompt(opts: {
  themeName: string;
  location: string;
  style: MurdokuArtStyle;
  customStyle?: string;
  suffix?: string;
  characters: MurdokuCharacter[];
  rows: number;
  columns: number;
}): string {
  const style =
    opts.style === 'custom' ? opts.customStyle || 'custom illustration' : MURDOKU_ART_STYLE_LABELS[opts.style];
  const names = opts.characters.map((c) => {
    const who = [c.name, c.occupation, c.gender].filter(Boolean).join(', ');
    return `${c.slotId} = ${who}`;
  });
  return [
    `Create a character sprite sheet for a printable murder-mystery puzzle set in a ${opts.themeName} (${opts.location}).`,
    `Use the attached reference table only as a layout and identity guide.`,
    ...sheetLayoutPromptLines({
      itemCount: opts.characters.length,
      rows: opts.rows,
      columns: opts.columns,
      fillNoun: 'head-and-shoulders portrait',
    }),
    `Each portrait shows only the person: face and upper torso, looking toward the camera, with consistent portrait framing.`,
    `Do not include any items, props, objects, furniture, weapons, tools, books, bags, drinks, food, or anything held in the hands.`,
    `No accessories that read as objects. No scenery, rooms, or background elements.`,
    `Remove the table: do not draw grid lines, cell borders, the table frame, or any table background.`,
    `Remove the numbers and slot references from the table: do not draw slot IDs (C01, C02, …), numbers, names, or any other labels on the artwork.`,
    `Preserve the order. Do not merge cells. Do not add extra characters.`,
    `Keep each portrait isolated, centered, and fully inside its assigned cell, on a plain white or transparent background.`,
    `Do not create backgrounds that cross cell boundaries.`,
    `Keep a consistent ${style} illustration style, consistent line thickness, and consistent framing.`,
    `Make each character visually distinct.`,
    `Character order (for your reference only — do not write these IDs or names on the image):`,
    ...names,
    opts.suffix ? `Additional instructions: ${opts.suffix}` : '',
  ]
    .filter(Boolean)
    .join('\n');
}

export function buildElementAiPrompt(opts: {
  themeName: string;
  location: string;
  style: MurdokuArtStyle;
  customStyle?: string;
  suffix?: string;
  elements: MurdokuElementDef[];
  rooms?: MurdokuRoom[];
  rows: number;
  columns: number;
}): string {
  const style =
    opts.style === 'custom' ? opts.customStyle || 'custom illustration' : MURDOKU_ART_STYLE_LABELS[opts.style];
  const names = opts.elements.map((e) => `${e.slotId} = ${e.name}${e.description ? ` (${e.description})` : ''}`);
  return [
    `Create a scene-object sprite sheet for a printable murder-mystery puzzle set in a ${opts.themeName} (${opts.location}).`,
    `These objects are furniture, decor, fixtures, and large inanimate room pieces — not handheld clutter.`,
    `Each object should look like it belongs in a real ${opts.themeName}.`,
    `Use the attached reference table only as a layout and identity guide.`,
    ...sheetLayoutPromptLines({
      itemCount: opts.elements.length,
      rows: opts.rows,
      columns: opts.columns,
      fillNoun: 'scene object',
    }),
    `Remove the table: do not draw grid lines, cell borders, the table frame, or any table background.`,
    `Remove the numbers and slot references from the table: do not draw slot IDs (E01, E02, …), numbers, names, or any other labels on the artwork.`,
    `Keep exactly one isolated object per box. Do not combine, omit, or add extra objects.`,
    `Keep objects centered, fully visible, and inside their boxes, on a plain white or transparent background.`,
    `Draw medium and large furniture-scale pieces. Do not add tiny extras such as phones, books, coffee cups, laptops, pencils, or tools unless that is the named object.`,
    `Use the same 3/4 perspective for all assets.`,
    `Use a consistent ${style} visual style.`,
    `Do not allow artwork to overlap cell boundaries.`,
    opts.rooms?.length ? roomCatalogPromptBlock(opts.rooms, undefined, opts.themeName) : '',
    `Objects (for your reference only — do not write these IDs or names on the image):`,
    ...names,
    opts.suffix ? `Additional instructions: ${opts.suffix}` : '',
  ]
    .filter(Boolean)
    .join('\n');
}

export function buildRoomAiPrompt(opts: {
  themeName: string;
  location: string;
  style: MurdokuArtStyle;
  customStyle?: string;
  suffix?: string;
  rooms: Array<{ slotId: string; name: string; description?: string }>;
  rows: number;
  columns: number;
}): string {
  const style =
    opts.style === 'custom' ? opts.customStyle || 'custom illustration' : MURDOKU_ART_STYLE_LABELS[opts.style];
  const names = opts.rooms.map((r) => `${r.slotId} = ${r.name}${r.description ? ` (${r.description})` : ''}`);
  return [
    `Create a top-down floor-texture sprite sheet for a printable murder-mystery puzzle set in a ${opts.themeName} (${opts.location}).`,
    `Use the attached reference table only as a layout and identity guide.`,
    ...sheetLayoutPromptLines({
      itemCount: opts.rooms.length,
      rows: opts.rows,
      columns: opts.columns,
      fillNoun: 'room floor texture',
    }),
    `Each filled box must contain only a flat top-down ground / floor texture. Nothing else.`,
    `Do not include furniture, objects, icons, walls, labels, borders, shadows, people, props, or any other elements.`,
    `The texture must fully cover the entire box edge-to-edge, with no white margin, no empty background, and no fading at the edges.`,
    `Give each room its own floor. Vary color and pattern (wooden planks, square tiles, diamond tiles, herringbone, checkerboard, stone, carpet, linoleum, and similar).`,
    `Make every texture seamless and continuous, so if multiple adjacent cells used the same floor they would connect naturally and look like one consistent surface.`,
    `Keep the style clean, map-like, and uniform. Consistent ${style} look, even lighting, no perspective, no 3D shading.`,
    `Do not draw room names, captions, slot IDs (R01, R02, …), numbers, or any text.`,
    `Do not draw dividing lines, grid lines, cell frames, or a table. Thick black room borders will be added by the puzzle layout, not by the artwork.`,
    `Preserve the order. Do not merge boxes. Do not add extra rooms.`,
    `Room order (for your reference only — do not write these IDs or names on the image):`,
    ...names,
    opts.suffix ? `Additional instructions: ${opts.suffix}` : '',
  ]
    .filter(Boolean)
    .join('\n');
}
