'use client';

import React, { useCallback, useEffect, useRef } from 'react';
import {
  buildPageVariableElements,
  formatPageVariableText,
  isShapePageVariable,
  isSinglePageVariable,
  pageVariableDisplayIndex,
  pageVariableTextForIndex,
  pageVariableVisibleOnPage,
  rotatePageVariable,
  setPageVariableTextAt,
  shapePageVariableHasText,
  type PageVariableField,
  type PageVariableKind,
  type PageVariableScope,
} from '@/lib/page-variables';
import { tokenForVariableKey } from '@/lib/ai/text-variable-tokens';
import { ResolvedElementsView } from '@/lib/resolved-layout/ResolvedElementsView';
import { cn } from '@/lib/utils';
import { CanvasObjectChrome } from '@/components/CanvasObjectChrome';
import './canvas-format-bar.css';
import './canvas-contextual-controls.css';

type ResizeHandle = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';

const HANDLES: Array<{ id: ResizeHandle; className: string }> = [
  { id: 'nw', className: 'canvas-object__handle--nw' },
  { id: 'n', className: 'canvas-object__handle--n' },
  { id: 'ne', className: 'canvas-object__handle--ne' },
  { id: 'e', className: 'canvas-object__handle--e' },
  { id: 'se', className: 'canvas-object__handle--se' },
  { id: 's', className: 'canvas-object__handle--s' },
  { id: 'sw', className: 'canvas-object__handle--sw' },
  { id: 'w', className: 'canvas-object__handle--w' },
];

export interface PageVariableEditorState {
  fields: PageVariableField[];
  selectedId: string | null;
  placingKind: PageVariableKind | null;
  placingScope?: PageVariableScope;
  /** When set, the selected empty shape accepts inline text (user chose Add text on it). */
  shapeTextActiveId?: string | null;
  interactive: boolean;
  onSelect: (id: string | null) => void;
  onMove: (id: string, xPercent: number, yPercent: number) => void;
  onResize: (
    id: string,
    box: { xPercent: number; yPercent: number; widthPercent: number; heightPercent: number }
  ) => void;
  onPlace: (xPercent: number, yPercent: number, contentIndex: number) => void;
  onEditContent?: (id: string) => void;
  onPatchField?: (id: string, patch: Partial<PageVariableField>) => void;
  onDelete?: (id: string) => void;
  onReorder?: (id: string, delta: 1 | -1) => void;
}

export interface PageVariablePageContext {
  contentIndex: number;
  bookPageNumber: number;
  puzzleNumber: number;
  pageWidthPt: number;
  pageHeightPt: number;
  ptToPx: (pt: number) => number;
  /** Shared Text Variable values (fun facts, titles, …) from project data. */
  resolveContext?: import('@/lib/ai/text-variable-tokens').TextVariableResolveContext;
}

function LiveOverlayText({
  fieldId,
  text,
  onChange,
}: {
  fieldId: string;
  text: string;
  onChange: (text: string) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ref.current) return;
    if (document.activeElement === ref.current) return;
    if (ref.current.textContent !== text) ref.current.textContent = text;
  }, [text]);

  return (
    <div
      ref={ref}
      data-canvas-text-editor={fieldId}
      className="canvas-object__editor"
      contentEditable
      suppressContentEditableWarning
      onPointerDown={(event) => event.stopPropagation()}
      onInput={() => onChange(ref.current?.textContent ?? '')}
    />
  );
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function resizedBox(
  handle: ResizeHandle,
  orig: { x: number; y: number; w: number; h: number },
  dx: number,
  dy: number
) {
  let { x, y, w, h } = orig;
  if (handle.includes('e')) w = orig.w + dx;
  if (handle.includes('s')) h = orig.h + dy;
  if (handle.includes('w')) {
    x = orig.x + dx;
    w = orig.w - dx;
  }
  if (handle.includes('n')) {
    y = orig.y + dy;
    h = orig.h - dy;
  }
  w = clamp(w, 2, 100);
  h = clamp(h, 2, 100);
  x = clamp(x, 0, 100 - w);
  y = clamp(y, 0, 100 - h);
  return { xPercent: x, yPercent: y, widthPercent: w, heightPercent: h };
}

export function PageVariableOverlay({
  editor,
  context,
}: {
  editor: PageVariableEditorState;
  context: PageVariablePageContext;
}) {
  const dragRef = useRef<{
    id: string;
    mode: 'move' | ResizeHandle;
    startX: number;
    startY: number;
    origX: number;
    origY: number;
    origW: number;
    origH: number;
  } | null>(null);
  const focusedRef = useRef<string | null>(null);

  const visibleFields = editor.fields.filter((field) =>
    pageVariableVisibleOnPage(field, context.contentIndex)
  );

  useEffect(() => {
    if (!editor.selectedId) {
      focusedRef.current = null;
      return;
    }
    if (focusedRef.current === editor.selectedId) return;
    const node = document.querySelector(
      `[data-canvas-text-editor="${editor.selectedId}"]`
    ) as HTMLElement | null;
    if (!node) return;
    node.focus();
    const selection = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(node);
    range.collapse(false);
    selection?.removeAllRanges();
    selection?.addRange(range);
    focusedRef.current = editor.selectedId;
  }, [editor.selectedId]);

  const elements = buildPageVariableElements({
    fields: editor.fields,
    pageWidthPt: context.pageWidthPt,
    pageHeightPt: context.pageHeightPt,
    contentIndex: context.contentIndex,
    bookPageNumber: context.bookPageNumber,
    puzzleNumber: context.puzzleNumber,
    placeholder: true,
    skipTextFieldId: editor.selectedId,
    resolveContext: {
      ...context.resolveContext,
      contentIndex: context.contentIndex,
      puzzleNumber: context.puzzleNumber,
      pageNumber: context.bookPageNumber,
    },
  });

  const toPercent = useCallback(
    (clientX: number, clientY: number, target: HTMLElement) => {
      const rect = target.getBoundingClientRect();
      const x = ((clientX - rect.left) / Math.max(1, rect.width)) * 100;
      const y = ((clientY - rect.top) / Math.max(1, rect.height)) * 100;
      return { x, y };
    },
    []
  );

  const handlePagePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!editor.interactive) return;
    if (editor.placingKind) {
      event.stopPropagation();
      const { x, y } = toPercent(event.clientX, event.clientY, event.currentTarget);
      editor.onPlace(x, y, context.contentIndex);
      return;
    }
    if (event.target === event.currentTarget) {
      editor.onSelect(null);
    }
  };

  const startDrag = (
    event: React.PointerEvent<HTMLElement>,
    field: PageVariableField,
    mode: 'move' | ResizeHandle
  ) => {
    if (!editor.interactive || editor.placingKind) return;
    event.stopPropagation();
    editor.onSelect(field.id);
    dragRef.current = {
      id: field.id,
      mode,
      startX: event.clientX,
      startY: event.clientY,
      origX: field.xPercent,
      origY: field.yPercent,
      origW: field.widthPercent,
      origH: field.heightPercent,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handleFieldPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag) return;
    const page = event.currentTarget.closest('[data-page-variable-layer]') as HTMLElement | null;
    if (!page) return;
    const rect = page.getBoundingClientRect();
    const dx = ((event.clientX - drag.startX) / Math.max(1, rect.width)) * 100;
    const dy = ((event.clientY - drag.startY) / Math.max(1, rect.height)) * 100;
    if (drag.mode === 'move') {
      editor.onMove(drag.id, drag.origX + dx, drag.origY + dy);
      return;
    }
    editor.onResize(
      drag.id,
      resizedBox(drag.mode, { x: drag.origX, y: drag.origY, w: drag.origW, h: drag.origH }, dx, dy)
    );
  };

  const handleFieldPointerUp = () => {
    dragRef.current = null;
  };

  const placingLabel = editor.placingKind
    ? editor.placingKind === 'shape'
      ? 'shape'
      : editor.placingScope === 'single'
        ? editor.placingKind === 'image'
          ? 'image on this page'
          : 'text on this page'
        : editor.placingKind === 'image'
          ? 'image variable on every page'
          : 'text variable on every page'
    : '';

  return (
    <div
      data-page-variable-layer
      className={cn(
        'absolute inset-0 z-[40]',
        editor.placingKind ? 'cursor-crosshair' : 'cursor-default'
      )}
      style={{
        pointerEvents: editor.interactive && editor.placingKind ? 'auto' : 'none',
      }}
      onPointerDown={handlePagePointerDown}
    >
      <div className="absolute inset-0 pointer-events-none">
        <ResolvedElementsView
          elements={elements}
          widthPt={context.pageWidthPt}
          heightPt={context.pageHeightPt}
          scale={context.ptToPx(1)}
        />
      </div>
      {editor.interactive
        ? visibleFields.map((field) => {
            const selected = field.id === editor.selectedId;
            const fieldIndex = editor.fields.findIndex((item) => item.id === field.id);
            const canBringForward = fieldIndex >= 0 && fieldIndex < editor.fields.length - 1;
            const canSendBackward = fieldIndex > 0;
            const displayIndex = pageVariableDisplayIndex(field, context.contentIndex);
            const shapeTyping =
              isShapePageVariable(field.kind) &&
              (editor.shapeTextActiveId === field.id ||
                shapePageVariableHasText(field, context.contentIndex));
            const canType =
              field.kind === 'text' || (isShapePageVariable(field.kind) && shapeTyping);
            // Keep the editable source (token / raw line), not the resolved preview value.
            const liveText = canType
              ? (() => {
                  const raw = pageVariableTextForIndex(field, displayIndex);
                  if (raw) return raw;
                  if (field.variableKey && field.variableKey !== 'none') {
                    return tokenForVariableKey(field.variableKey);
                  }
                  return formatPageVariableText(field, displayIndex, false);
                })()
              : '';
            return (
              <div
                key={field.id}
                role="button"
                tabIndex={0}
                aria-label={`${field.kind} ${isSinglePageVariable(field) ? 'on this page' : 'variable'}`}
                className={cn('canvas-object', selected && 'canvas-object--selected')}
                style={{
                  left: `${field.xPercent}%`,
                  top: `${field.yPercent}%`,
                  width: `${field.widthPercent}%`,
                  height: `${field.heightPercent}%`,
                  transform: [
                    field.flipH ? 'scaleX(-1)' : '',
                    field.flipV ? 'scaleY(-1)' : '',
                    field.rotationDeg ? `rotate(${field.rotationDeg}deg)` : '',
                  ]
                    .filter(Boolean)
                    .join(' ') || undefined,
                  transformOrigin: 'center center',
                  cursor: editor.placingKind ? 'crosshair' : 'move',
                  pointerEvents: 'auto',
                  textAlign: field.align ?? 'center',
                  fontFamily: field.fontFamily || 'Arial',
                  fontSize: `${Math.max(10, field.fontSize ?? 16)}pt`,
                  fontWeight: field.bold ? 700 : 400,
                  fontStyle: field.italic ? 'italic' : 'normal',
                  color: field.color || '#111111',
                }}
                onPointerDown={(event) => {
                  const target = event.target as HTMLElement;
                  if (target.closest('[data-canvas-text-editor]')) {
                    event.stopPropagation();
                    editor.onSelect(field.id);
                    return;
                  }
                  startDrag(event, field, 'move');
                }}
                onPointerMove={handleFieldPointerMove}
                onPointerUp={handleFieldPointerUp}
                onDoubleClick={(event) => {
                  event.stopPropagation();
                  if (isSinglePageVariable(field) && canType) return;
                  if (isShapePageVariable(field.kind) && isSinglePageVariable(field)) {
                    editor.onEditContent?.(field.id);
                    return;
                  }
                  editor.onEditContent?.(field.id);
                }}
              >
                {selected && canType ? (
                  <LiveOverlayText
                    fieldId={field.id}
                    text={liveText}
                    onChange={(next) => {
                      editor.onPatchField?.(field.id, {
                        textLines: setPageVariableTextAt(field, displayIndex, next),
                      });
                    }}
                  />
                ) : null}
                {selected ? (
                  <>
                    <span className="canvas-object__selection-outline" aria-hidden />
                    <CanvasObjectChrome
                      actions={{
                        onMovePointerDown: (event) => startDrag(event, field, 'move'),
                        onBringForward: () => editor.onReorder?.(field.id, 1),
                        onSendBackward: () => editor.onReorder?.(field.id, -1),
                        canBringForward,
                        canSendBackward,
                        onFlipH: () =>
                          editor.onPatchField?.(field.id, { flipH: !field.flipH }),
                        onFlipV: () =>
                          editor.onPatchField?.(field.id, { flipV: !field.flipV }),
                        flipH: field.flipH,
                        flipV: field.flipV,
                        onRotate: () => {
                          const rotated = rotatePageVariable(field, 15);
                          editor.onPatchField?.(field.id, { rotationDeg: rotated.rotationDeg });
                        },
                        onDelete: editor.onDelete
                          ? () => editor.onDelete?.(field.id)
                          : undefined,
                      }}
                    />
                    {HANDLES.map((handle) => (
                      <span
                        key={handle.id}
                        className={cn('canvas-object__handle', handle.className)}
                        onPointerDown={(event) => startDrag(event, field, handle.id)}
                      />
                    ))}
                  </>
                ) : null}
              </div>
            );
          })
        : null}
      {editor.placingKind ? (
        <div className="absolute left-2 top-2 rounded bg-slate-900/85 px-2.5 py-1.5 text-[11px] font-medium text-white pointer-events-none shadow-lg">
          Click to place {placingLabel}
        </div>
      ) : null}
    </div>
  );
}
