/**
 * Per-document page overlays: text and image variables.
 * Built as ResolvedElement[] so canvas, PDF, and PPTX stay matching.
 */

import {
  canvasShapePoints,
  isCanvasShapeType,
  type CanvasShapeType,
} from './canvas-shapes';
import { wrapLines } from './resolved-layout/wrap';
import type { ResolvedElement } from './resolved-layout/types';
import { normalizeTextEffect, type TextEffectStyle } from './text-effects';
import {
  isTextVariableKey,
  resolveTextVariableTokens,
  tokenForVariableKey,
  type TextVariableKey,
  type TextVariableResolveContext,
} from './ai/text-variable-tokens';

export const PAGE_VARIABLE_KINDS = [
  'text',
  'image',
  'shape',
  'pagination',
  'puzzle-number',
] as const;

export type PageVariableKind = (typeof PAGE_VARIABLE_KINDS)[number];

export const PAGE_VARIABLE_TEXT_FORMS = [
  'text-hash-number',
  'number-dot-text',
  'text',
  'number',
] as const;

export type PageVariableTextForm = (typeof PAGE_VARIABLE_TEXT_FORMS)[number];

export const PAGE_VARIABLE_SCOPES = ['single', 'document'] as const;
export type PageVariableScope = (typeof PAGE_VARIABLE_SCOPES)[number];

export interface PageVariableField {
  id: string;
  kind: PageVariableKind;
  /** Top-left X as % of the page */
  xPercent: number;
  /** Top-left Y as % of the page */
  yPercent: number;
  widthPercent: number;
  heightPercent: number;
  rotationDeg?: number;
  flipH?: boolean;
  flipV?: boolean;
  fontFamily?: string;
  fontSize?: number;
  bold?: boolean;
  italic?: boolean;
  color?: string;
  align?: 'left' | 'center' | 'right';
  /** One line per printed puzzle page (line 1 → page 1). */
  textLines?: string[];
  /** How the line and the counting number are combined. */
  textForm?: PageVariableTextForm;
  /** First printed count. Page 1 uses this value, page 2 uses +1, and so on. */
  startNumber?: number;
  /** One image href per printed puzzle page (image 1 → page 1). */
  imageHrefs?: string[];
  imageFit?: 'contain' | 'cover' | 'stretch';
  shapeType?: CanvasShapeType;
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  /** Corner radius in CSS px for roundRect shapes (canvas / PDF / PPT). */
  cornerRadiusPx?: number;
  textEffect?: TextEffectStyle;
  /**
   * `single` = this puzzle page only.
   * `document` = every puzzle page (legacy default; uses textLines/imageHrefs by page).
   */
  scope?: PageVariableScope;
  /** Printed puzzle-page index when scope is `single`. */
  pageIndex?: number;
  /**
   * Optional binding to a shared Text Variable (fun fact, puzzle title, etc.).
   * When set, resolved values come from TextVariableResolveContext while the
   * element stays a normal editable Canvas Workspace text field.
   */
  variableKey?: TextVariableKey | 'none';
}

export function isPageVariableKind(value: unknown): value is PageVariableKind {
  return PAGE_VARIABLE_KINDS.includes(value as PageVariableKind);
}

export function createPageVariableId(): string {
  return `pv-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function clampPercent(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, value));
}

function clampRotation(value: number | undefined): number {
  if (!Number.isFinite(value)) return 0;
  let deg = Number(value) % 360;
  if (deg < 0) deg += 360;
  return deg;
}

const DEFAULT_BOX: Record<PageVariableKind, { w: number; h: number }> = {
  text: { w: 42, h: 8 },
  image: { w: 22, h: 22 },
  shape: { w: 24, h: 18 },
  pagination: { w: 12, h: 6 },
  'puzzle-number': { w: 16, h: 6 },
};

export function createPageVariableField(
  kind: PageVariableKind,
  xPercent: number,
  yPercent: number,
  extras?: Partial<PageVariableField>
): PageVariableField {
  const box = DEFAULT_BOX[kind];
  const widthPercent = box.w;
  const heightPercent = box.h;
  return normalizePageVariableField({
    id: createPageVariableId(),
    kind,
    xPercent: clampPercent(xPercent - widthPercent / 2, 0, 100 - widthPercent),
    yPercent: clampPercent(yPercent - heightPercent / 2, 0, 100 - heightPercent),
    widthPercent,
    heightPercent,
    fontFamily: 'Arial',
    fontSize: kind === 'pagination' || kind === 'puzzle-number' ? 14 : 18,
    bold: kind !== 'text',
    color: '#111111',
    align: 'center',
    imageFit: 'contain',
    textLines: [],
    imageHrefs: [],
    textForm: 'text',
    startNumber: 1,
    shapeType: extras?.shapeType ?? 'roundRect',
    fill: extras?.fill ?? '#dbeafe',
    stroke: extras?.stroke ?? '#1d4ed8',
    strokeWidth: extras?.strokeWidth ?? 1.25,
    cornerRadiusPx: extras?.cornerRadiusPx ?? 12,
    textEffect: extras?.textEffect ?? 'none',
    scope: extras?.scope ?? 'document',
    pageIndex: extras?.pageIndex,
    ...extras,
  })!;
}

export function normalizePageVariableField(
  raw: Partial<PageVariableField> | null | undefined
): PageVariableField | null {
  if (!raw || !isPageVariableKind(raw.kind)) return null;
  const box = DEFAULT_BOX[raw.kind];
  const widthPercent = clampPercent(Number(raw.widthPercent ?? box.w), 2, 100);
  const heightPercent = clampPercent(Number(raw.heightPercent ?? box.h), 2, 100);
  const id =
    typeof raw.id === 'string' && raw.id.trim()
      ? raw.id.trim()
      : createPageVariableId();
  const align =
    raw.align === 'left' || raw.align === 'right' || raw.align === 'center'
      ? raw.align
      : 'center';
  const imageFit =
    raw.imageFit === 'cover' || raw.imageFit === 'stretch' || raw.imageFit === 'contain'
      ? raw.imageFit
      : 'contain';
  return {
    id,
    kind: raw.kind,
    xPercent: clampPercent(Number(raw.xPercent ?? 8), 0, 100),
    yPercent: clampPercent(Number(raw.yPercent ?? 8), 0, 100),
    widthPercent,
    heightPercent,
    rotationDeg: clampRotation(raw.rotationDeg),
    flipH: !!raw.flipH,
    flipV: !!raw.flipV,
    fontFamily: typeof raw.fontFamily === 'string' && raw.fontFamily.trim()
      ? raw.fontFamily.trim()
      : 'Arial',
    fontSize: clampPercent(Number(raw.fontSize ?? 16), 8, 96),
    bold: raw.bold !== false,
    italic: !!raw.italic,
    color: typeof raw.color === 'string' && raw.color.trim() ? raw.color.trim() : '#111111',
    align,
    textLines: Array.isArray(raw.textLines)
      ? raw.textLines.map((line) => String(line ?? ''))
      : [],
    textForm: isPageVariableTextForm(raw.textForm) ? raw.textForm : 'text',
    startNumber: Math.max(1, Math.round(Number(raw.startNumber ?? 1) || 1)),
    imageHrefs: Array.isArray(raw.imageHrefs)
      ? raw.imageHrefs.map((href) => String(href ?? ''))
      : [],
    imageFit,
    shapeType: isCanvasShapeType(raw.shapeType) ? raw.shapeType : 'roundRect',
    fill: typeof raw.fill === 'string' && raw.fill.trim() ? raw.fill.trim() : '#dbeafe',
    stroke: typeof raw.stroke === 'string' && raw.stroke.trim() ? raw.stroke.trim() : '#1d4ed8',
    strokeWidth: clampPercent(Number(raw.strokeWidth ?? 1.25), 0, 12),
    cornerRadiusPx: clampPercent(Number(raw.cornerRadiusPx ?? 12), 0, 80),
    textEffect: normalizeTextEffect(raw.textEffect),
    scope: raw.scope === 'single' ? 'single' : 'document',
    pageIndex: Math.max(0, Math.round(Number(raw.pageIndex ?? 0) || 0)),
    variableKey:
      raw.variableKey === 'none'
        ? 'none'
        : isTextVariableKey(raw.variableKey)
          ? raw.variableKey
          : undefined,
  };
}

export function isPageVariableTextForm(value: unknown): value is PageVariableTextForm {
  return PAGE_VARIABLE_TEXT_FORMS.includes(value as PageVariableTextForm);
}

export function pageVariableCountAt(field: PageVariableField, contentIndex: number): number {
  return Math.max(1, Math.round(field.startNumber ?? 1)) + Math.max(0, contentIndex);
}

export function formatPageVariableText(
  field: PageVariableField,
  contentIndex: number,
  placeholder = false,
  resolveContext?: TextVariableResolveContext
): string {
  const count = pageVariableCountAt(field, contentIndex);
  const ctx: TextVariableResolveContext = {
    ...resolveContext,
    contentIndex,
    puzzleNumber: resolveContext?.puzzleNumber ?? count,
    pageNumber: resolveContext?.pageNumber,
  };

  const binding =
    field.variableKey && field.variableKey !== 'none' ? field.variableKey : null;
  let line = pageVariableTextForIndex(field, contentIndex);
  if (binding && !line.trim()) {
    line = tokenForVariableKey(binding);
  }
  line = resolveTextVariableTokens(line, ctx).trim();

  const form = field.textForm ?? 'text';
  if (form === 'number') return String(count);
  if (form === 'text-hash-number') {
    if (line) return `${line} #${count}`;
    return placeholder ? `Text #${count}` : `#${count}`;
  }
  if (form === 'number-dot-text') {
    if (line) return `${count}. ${line}`;
    return placeholder ? `${count}. Text` : `${count}.`;
  }
  if (line) return line;
  if (binding && placeholder) return tokenForVariableKey(binding);
  return placeholder ? 'Text' : '';
}

export function normalizePageVariables(raw: unknown): PageVariableField[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => normalizePageVariableField(item as Partial<PageVariableField>))
    .filter((field): field is PageVariableField => !!field);
}

/** Printed puzzle-page index: line 1 / image 1 → first puzzle page. */
export function pageVariableContentIndex(
  puzzleIndexInDocument: number,
  puzzlesPerPage = 1
): number {
  return Math.floor(Math.max(0, puzzleIndexInDocument) / Math.max(1, puzzlesPerPage));
}

export function pageVariableTextForIndex(field: PageVariableField, contentIndex: number): string {
  if (field.kind === 'pagination' || field.kind === 'puzzle-number') return '';
  return field.textLines?.[contentIndex] ?? '';
}

export function setPageVariableTextAt(
  field: PageVariableField,
  contentIndex: number,
  text: string
): string[] {
  const index = Math.max(0, Math.round(contentIndex));
  const lines = [...(field.textLines ?? [])];
  while (lines.length <= index) lines.push('');
  lines[index] = text;
  return lines;
}

export function pageVariableImageForIndex(
  field: PageVariableField,
  contentIndex: number
): string {
  return field.imageHrefs?.[contentIndex] ?? '';
}

export function isTextPageVariable(kind: PageVariableKind): boolean {
  return kind === 'text' || kind === 'pagination' || kind === 'puzzle-number';
}

export function isImagePageVariable(kind: PageVariableKind): boolean {
  return kind === 'image';
}

export function isShapePageVariable(kind: PageVariableKind): boolean {
  return kind === 'shape';
}

/** True when a shape already has (or should show) editable text content. */
export function shapePageVariableHasText(
  field: PageVariableField,
  contentIndex: number
): boolean {
  if (!isShapePageVariable(field.kind)) return false;
  const form = field.textForm ?? 'text';
  if (form === 'number' || form === 'text-hash-number' || form === 'number-dot-text') {
    return true;
  }
  return pageVariableTextForIndex(field, pageVariableDisplayIndex(field, contentIndex)).trim().length > 0;
}

/** Topmost visible field under a page-percent point (last in list wins). */
export function findPageVariableAtPercent(
  fields: PageVariableField[],
  xPercent: number,
  yPercent: number,
  contentIndex: number,
  kind?: PageVariableKind
): PageVariableField | null {
  for (let i = fields.length - 1; i >= 0; i--) {
    const field = fields[i];
    if (!pageVariableVisibleOnPage(field, contentIndex)) continue;
    if (kind && field.kind !== kind) continue;
    if (
      xPercent >= field.xPercent &&
      xPercent <= field.xPercent + field.widthPercent &&
      yPercent >= field.yPercent &&
      yPercent <= field.yPercent + field.heightPercent
    ) {
      return field;
    }
  }
  return null;
}

export function isSinglePageVariable(field: Pick<PageVariableField, 'scope'>): boolean {
  return field.scope === 'single';
}

export function pageVariableVisibleOnPage(
  field: Pick<PageVariableField, 'scope' | 'pageIndex'>,
  contentIndex: number
): boolean {
  if (!isSinglePageVariable(field)) return true;
  return Math.max(0, Math.round(field.pageIndex ?? 0)) === Math.max(0, contentIndex);
}

export function pageVariableDisplayIndex(
  field: Pick<PageVariableField, 'scope'>,
  contentIndex: number
): number {
  return isSinglePageVariable(field) ? 0 : contentIndex;
}

export interface BuildPageVariableElementsInput {
  fields: PageVariableField[];
  pageWidthPt: number;
  pageHeightPt: number;
  contentIndex: number;
  bookPageNumber: number;
  puzzleNumber: number;
  /** Preview-only placeholder when a text variable has no line yet. */
  placeholder?: boolean;
  /** Hide this field's text primitive while the canvas editor is live-typing it. */
  skipTextFieldId?: string | null;
  /** Shared variable values for [fun fact], [puzzle title], etc. */
  resolveContext?: TextVariableResolveContext;
}

function fieldBox(field: PageVariableField, pageWidthPt: number, pageHeightPt: number) {
  const w = (field.widthPercent / 100) * pageWidthPt;
  const h = (field.heightPercent / 100) * pageHeightPt;
  const x = (field.xPercent / 100) * pageWidthPt;
  const y = (field.yPercent / 100) * pageHeightPt;
  return { x, y, w: Math.max(4, w), h: Math.max(4, h) };
}

function displayedText(
  field: PageVariableField,
  input: BuildPageVariableElementsInput
): string {
  const ctx: TextVariableResolveContext = {
    ...input.resolveContext,
    contentIndex: input.contentIndex,
    puzzleNumber: input.puzzleNumber,
    pageNumber: input.bookPageNumber,
  };
  if (field.kind === 'pagination') {
    return String(Math.max(1, Math.round(input.bookPageNumber)));
  }
  if (field.kind === 'puzzle-number') {
    return String(Math.max(1, Math.round(input.puzzleNumber)));
  }
  // Empty shapes stay blank — never show the "Text" placeholder on a bare shape.
  if (field.kind === 'shape') {
    return formatPageVariableText(field, input.contentIndex, false, ctx);
  }
  return formatPageVariableText(field, input.contentIndex, !!input.placeholder, ctx);
}

export function buildPageVariableElements(
  input: BuildPageVariableElementsInput
): ResolvedElement[] {
  const fields = normalizePageVariables(input.fields);
  const elements: ResolvedElement[] = [];

  for (const field of fields) {
    if (!pageVariableVisibleOnPage(field, input.contentIndex)) continue;
    const displayIndex = pageVariableDisplayIndex(field, input.contentIndex);
    const box = fieldBox(field, input.pageWidthPt, input.pageHeightPt);
    const hideLiveText = !!input.skipTextFieldId && field.id === input.skipTextFieldId;
    if (field.kind === 'shape') {
      const shapeType = isCanvasShapeType(field.shapeType) ? field.shapeType : 'roundRect';
      const cornerRadiusPt =
        shapeType === 'roundRect'
          ? ((field.cornerRadiusPx ?? 12) * 72) / 96
          : undefined;
      elements.push({
        kind: 'shape',
        shape: shapeType,
        x: box.x,
        y: box.y,
        w: box.w,
        h: box.h,
        fill: field.fill,
        stroke: field.stroke,
        strokeWidth: field.strokeWidth,
        cornerRadius: cornerRadiusPt,
        rotationDeg: field.rotationDeg,
        flipH: field.flipH,
        flipV: field.flipV,
      });
      const shapeText = hideLiveText
        ? ''
        : displayedText(field, { ...input, contentIndex: displayIndex });
      if (shapeText) {
        const fontSize = field.fontSize ?? 16;
        const lineHeight = fontSize * 1.2;
        const inset = Math.max(6, box.w * 0.08);
        const lines = wrapLines(shapeText, fontSize, Math.max(8, box.w - inset * 2));
        elements.push({
          kind: 'text',
          x: box.x + inset / 2,
          y: box.y + inset / 2,
          w: Math.max(8, box.w - inset),
          h: Math.max(8, box.h - inset),
          text: shapeText,
          lines: lines.length > 0 ? lines : [shapeText],
          fontFamily: field.fontFamily ?? 'Arial',
          fontSize,
          bold: field.bold,
          italic: field.italic,
          color: field.color ?? '#111111',
          align: field.align ?? 'center',
          valign: 'middle',
          lineHeight,
          rotationDeg: field.rotationDeg,
          flipH: field.flipH,
          flipV: field.flipV,
          effect: field.textEffect,
        });
      }
      continue;
    }
    if (field.kind === 'image') {
      const href = pageVariableImageForIndex(field, displayIndex);
      if (!href && !input.placeholder) continue;
      if (!href && input.placeholder) {
        elements.push({
          kind: 'rect',
          x: box.x,
          y: box.y,
          w: box.w,
          h: box.h,
          fill: '#f1f5f9',
          stroke: '#94a3b8',
          strokeWidth: 1,
        });
        continue;
      }
      elements.push({
        kind: 'image',
        x: box.x,
        y: box.y,
        w: box.w,
        h: box.h,
        href,
        fit: field.imageFit ?? 'contain',
        rotationDeg: field.rotationDeg,
        flipH: field.flipH,
        flipV: field.flipV,
      });
      continue;
    }

    if (hideLiveText) continue;
    const text = displayedText(field, { ...input, contentIndex: displayIndex });
    if (!text) continue;
    const fontSize = field.fontSize ?? 16;
    const lineHeight = fontSize * 1.2;
    const lines = wrapLines(text, fontSize, box.w);
    elements.push({
      kind: 'text',
      x: box.x,
      y: box.y,
      w: box.w,
      h: box.h,
      text,
      lines: lines.length > 0 ? lines : [text],
      fontFamily: field.fontFamily ?? 'Arial',
      fontSize,
      bold: field.bold,
      italic: field.italic,
      color: field.color ?? '#111111',
      align: field.align ?? 'center',
      valign: 'middle',
      lineHeight,
      rotationDeg: field.rotationDeg,
      flipH: field.flipH,
      flipV: field.flipV,
      effect: field.textEffect,
    });
  }

  return elements;
}

export function movePageVariable(
  field: PageVariableField,
  xPercent: number,
  yPercent: number
): PageVariableField {
  return {
    ...field,
    xPercent: clampPercent(xPercent, 0, 100 - field.widthPercent),
    yPercent: clampPercent(yPercent, 0, 100 - field.heightPercent),
  };
}

export function resizePageVariable(
  field: PageVariableField,
  widthPercent: number,
  heightPercent: number
): PageVariableField {
  const width = clampPercent(widthPercent, 2, 100);
  const height = clampPercent(heightPercent, 2, 100);
  return {
    ...field,
    widthPercent: width,
    heightPercent: height,
    xPercent: clampPercent(field.xPercent, 0, 100 - width),
    yPercent: clampPercent(field.yPercent, 0, 100 - height),
  };
}

export function rotatePageVariable(field: PageVariableField, deltaDeg: number): PageVariableField {
  return {
    ...field,
    rotationDeg: clampRotation((field.rotationDeg ?? 0) + deltaDeg),
  };
}
