'use client';

import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, Loader2, X } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { SliderField } from '@/components/ui/slider-field';
import {
  applySheetEffects,
  boxesOverlap,
  bufferToDataUrl,
  clampBox,
  DEFAULT_CROP_CONFIG,
  defaultNormalizeMode,
  extractSlotAssets,
  keepBoxClearOfOthers,
  runSpriteSheetPipeline,
  type ExtractedAsset,
  type PixelBuffer,
  type SlotCropBox,
  type SpriteSheetCropConfig,
  type SpriteSheetItem,
  type SpriteSheetKind,
} from '@/lib/sprite-sheet-importer';

function pickSlotAt(px: number, py: number, boxes: SlotCropBox[]): string | null {
  if (!boxes.length) return null;
  let inside: SlotCropBox | null = null;
  let nearest = boxes[0];
  let nearestDist = Infinity;
  for (const box of boxes) {
    const dx = Math.max(box.x - px, 0, px - (box.x + box.w));
    const dy = Math.max(box.y - py, 0, py - (box.y + box.h));
    const dist = Math.hypot(dx, dy);
    if (dist === 0) inside = box;
    if (dist < nearestDist) {
      nearestDist = dist;
      nearest = box;
    }
  }
  if (inside) return inside.slotId;
  const reach = Math.max(24, Math.min(nearest.w, nearest.h) * 0.35);
  return nearestDist <= reach ? nearest.slotId : null;
}

type Handle = 'n' | 's' | 'e' | 'w' | 'nw' | 'ne' | 'sw' | 'se' | 'move';

function cursorFor(handle: Handle): string {
  if (handle === 'move') return 'move';
  if (handle === 'n' || handle === 's') return 'ns-resize';
  if (handle === 'e' || handle === 'w') return 'ew-resize';
  if (handle === 'nw' || handle === 'se') return 'nwse-resize';
  return 'nesw-resize';
}

function resizeBox(start: SlotCropBox, handle: Handle, dx: number, dy: number, fw: number, fh: number): SlotCropBox {
  let { x, y, w, h } = start;
  const right = x + w;
  const bottom = y + h;
  if (handle === 'move') {
    x += dx;
    y += dy;
  } else {
    if (handle.includes('w')) x = start.x + dx;
    if (handle.includes('e')) w = start.w + dx;
    if (handle.includes('n')) y = start.y + dy;
    if (handle.includes('s')) h = start.h + dy;
    if (handle.includes('w')) w = right - x;
    if (handle.includes('n')) h = bottom - y;
  }
  return { slotId: start.slotId, ...clampBox({ x, y, w, h }, fw, fh) };
}

export function SpriteSheetImporter({
  open,
  onOpenChange,
  kind,
  items,
  rows,
  columns,
  originalSrc,
  savedCrop,
  onImport,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  kind: SpriteSheetKind;
  items: SpriteSheetItem[];
  rows: number;
  columns: number;
  originalSrc: string;
  savedCrop?: SpriteSheetCropConfig | null;
  onImport: (assets: ExtractedAsset[], crop: SpriteSheetCropConfig) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('Analyzing artwork...');
  const [config, setConfig] = useState<SpriteSheetCropConfig>({
    ...DEFAULT_CROP_CONFIG,
    ...savedCrop,
    boxes: savedCrop?.boxes ?? [],
    normalizeMode: savedCrop?.normalizeMode ?? defaultNormalizeMode(kind),
  });
  const [assets, setAssets] = useState<ExtractedAsset[]>([]);
  const [drag, setDrag] = useState<{ slotId: string; handle: Handle } | null>(null);
  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null);
  const [previewSrc, setPreviewSrc] = useState(originalSrc);

  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const stageRef = useRef<SVGSVGElement | null>(null);
  const originalRef = useRef<PixelBuffer | null>(null);
  const workingRef = useRef<PixelBuffer | null>(null);
  const sizeRef = useRef({ width: 1, height: 1 });
  const dragRef = useRef<{
    slotId: string;
    handle: Handle;
    start: SlotCropBox;
    originX: number;
    originY: number;
  } | null>(null);
  const configRef = useRef(config);
  const closingRef = useRef(false);
  const runId = useRef(0);
  const effectsTimer = useRef(0);
  configRef.current = config;

  const applyLabel =
    kind === 'characters' ? 'Apply character crops' : kind === 'elements' ? 'Apply element crops' : 'Apply room crops';

  const rebuildAssets = useCallback(
    (nextConfig: SpriteSheetCropConfig) => {
      const working = workingRef.current;
      if (!working || !nextConfig.boxes.length) return;
      setAssets(
        extractSlotAssets(
          working,
          items,
          nextConfig.gridCols || columns,
          nextConfig.gridRows || rows,
          nextConfig.xs,
          nextConfig.ys,
          nextConfig,
          kind
        )
      );
    },
    [columns, items, kind, rows]
  );

  const applyEffectsAndRebuild = useCallback(
    (nextConfig: SpriteSheetCropConfig) => {
      setConfig(nextConfig);
      configRef.current = nextConfig;
      window.clearTimeout(effectsTimer.current);
      effectsTimer.current = window.setTimeout(() => {
        const original = originalRef.current;
        if (!original) return;
        const working = applySheetEffects(original, nextConfig);
        workingRef.current = working;
        setPreviewSrc(working === original ? originalSrc : bufferToDataUrl(working));
        rebuildAssets(nextConfig);
      }, 80);
    },
    [originalSrc, rebuildAssets]
  );

  const runPipeline = useCallback(async () => {
    if (!originalSrc) return;
    const id = ++runId.current;
    setBusy(true);
    try {
      const pipeline = await runSpriteSheetPipeline(
        originalSrc,
        items,
        columns,
        rows,
        kind,
        {
          ...DEFAULT_CROP_CONFIG,
          ...savedCrop,
          normalizeMode: savedCrop?.normalizeMode ?? defaultNormalizeMode(kind),
        },
        (next) => {
          if (id === runId.current) setStatus(next);
        }
      );
      if (id !== runId.current) return;
      originalRef.current = pipeline.original;
      workingRef.current = pipeline.working;
      sizeRef.current = { width: pipeline.working.width, height: pipeline.working.height };
      setConfig(pipeline.config);
      setAssets(pipeline.assets);
      setPreviewSrc(pipeline.workingSrc);
      setSelectedSlotId(null);
    } catch (error) {
      console.error(error);
      toast.error('Could not open the crop editor.');
      setStatus('Ready');
    } finally {
      if (id === runId.current) setBusy(false);
    }
  }, [columns, items, kind, originalSrc, rows, savedCrop]);

  useLayoutEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open) {
      closingRef.current = false;
      if (!dialog.open) dialog.showModal();
    } else if (dialog.open) {
      dialog.close();
    }
  }, [open]);

  useEffect(() => {
    if (!open || !originalSrc) return;
    const timer = window.setTimeout(() => {
      void runPipeline();
    }, 40);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, originalSrc]);

  const beginDrag = (event: React.PointerEvent, slotId: string, handle: Handle) => {
    const box = configRef.current.boxes.find((b) => b.slotId === slotId);
    if (!box) return;
    dragRef.current = {
      slotId,
      handle,
      start: { ...box },
      originX: event.clientX,
      originY: event.clientY,
    };
    setDrag({ slotId, handle });
  };

  const onHandlePointerDown = (
    event: React.PointerEvent,
    slotId: string,
    handle: Handle
  ) => {
    event.preventDefault();
    event.stopPropagation();
    setSelectedSlotId(slotId);
    beginDrag(event, slotId, handle);
  };

  const onSheetPointerDown = (event: React.PointerEvent<SVGSVGElement>) => {
    if (busy || dragRef.current) return;
    const svg = stageRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const size = sizeRef.current;
    const px = ((event.clientX - rect.left) / Math.max(1, rect.width)) * size.width;
    const py = ((event.clientY - rect.top) / Math.max(1, rect.height)) * size.height;
    const slotId = pickSlotAt(px, py, configRef.current.boxes ?? []);
    setSelectedSlotId(slotId);
    if (slotId && slotId === selectedSlotId) {
      event.preventDefault();
      beginDrag(event, slotId, 'move');
    }
  };

  const endDrag = useCallback(() => {
    if (!dragRef.current) return;
    dragRef.current = null;
    setDrag(null);
    rebuildAssets(configRef.current);
  }, [rebuildAssets]);

  useEffect(() => {
    if (!drag) return;
    const onMove = (event: PointerEvent) => {
      const current = dragRef.current;
      const svg = stageRef.current;
      if (!current || !svg) return;
      const rect = svg.getBoundingClientRect();
      const fw = sizeRef.current.width;
      const fh = sizeRef.current.height;
      const scaleX = fw / Math.max(1, rect.width);
      const scaleY = fh / Math.max(1, rect.height);
      const dx = (event.clientX - current.originX) * scaleX;
      const dy = (event.clientY - current.originY) * scaleY;
      const resized = resizeBox(current.start, current.handle, dx, dy, fw, fh);
      let nextBox = keepBoxClearOfOthers(resized, configRef.current.boxes ?? [], fw, fh);
      if ((configRef.current.boxes ?? []).some((other) => other.slotId !== nextBox.slotId && boxesOverlap(nextBox, other))) {
        nextBox = current.start;
      }
      setConfig((prev) => {
        const boxes = prev.boxes.map((b) => (b.slotId === current.slotId ? { ...b, ...nextBox } : b));
        const next = { ...prev, boxes };
        configRef.current = next;
        return next;
      });
    };
    const onUp = () => endDrag();
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
  }, [drag, endDrag]);

  const handleApply = () => {
    if (!assets.length || busy) return;
    onImport(assets, configRef.current);
    onOpenChange(false);
  };

  const close = () => {
    if (closingRef.current) return;
    closingRef.current = true;
    runId.current += 1;
    const dialog = dialogRef.current;
    if (dialog?.open) dialog.close();
    onOpenChange(false);
  };

  const fw = sizeRef.current.width;
  const fh = sizeRef.current.height;
  const handleSize = Math.max(12, fw / 70);
  const selectedBox = config.boxes.find((box) => box.slotId === selectedSlotId) ?? null;

  if (!open || typeof document === 'undefined') return null;

  return createPortal(
    <dialog
      ref={dialogRef}
      className="z-[30000] overflow-hidden rounded-xl border border-slate-200 bg-white p-0 text-slate-900 shadow-2xl backdrop:bg-slate-950/75 open:flex open:flex-col"
      style={{
        width: 'min(860px, 94vw)',
        height: 'min(90vh, 860px)',
        maxWidth: '94vw',
        margin: 'auto',
        padding: 0,
      }}
      aria-labelledby="edit-cropping-title"
      onClose={close}
      onCancel={(event) => {
        event.preventDefault();
        close();
      }}
    >
      <div className="flex items-start justify-between gap-3 border-b px-4 py-3">
        <div>
          <h2 id="edit-cropping-title" className="text-base font-semibold">
            Edit cropping
          </h2>
          <p className="mt-0.5 text-xs text-slate-500">
            Click an image to show its crop box. Boxes stay on their own image and do not overlap.
          </p>
        </div>
        <button
          type="button"
          className="rounded-md p-1 text-slate-500 hover:bg-slate-100"
          aria-label="Close"
          onClick={close}
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="flex items-center gap-2 px-4 py-2 text-xs text-slate-600">
        {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
        {busy ? status : drag ? 'Adjusting crop box' : selectedSlotId ? 'Drag this box to crop the image' : 'Click an image to edit its crop'}
        <span className="ml-auto text-slate-400">
          {config.boxes?.length ?? items.length} crop boxes · {config.gridCols || columns} × {config.gridRows || rows}
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b px-4 py-2">
        <Checkbox
          checked={config.removeBackground}
          disabled={busy}
          onCheckedChange={(checked) =>
            applyEffectsAndRebuild({ ...configRef.current, removeBackground: checked })
          }
          label="Remove background"
        />
        {config.removeBackground ? (
          <div className="min-w-[200px] flex-1">
            <SliderField
              label="Background tolerance"
              value={config.bgTolerancePercent}
              onValueChange={(value) =>
                applyEffectsAndRebuild({ ...configRef.current, bgTolerancePercent: value })
              }
              min={5}
              max={90}
              control="slider"
              disabled={busy}
            />
          </div>
        ) : null}
        <Checkbox
          checked={config.grayscale}
          disabled={busy}
          onCheckedChange={(checked) => applyEffectsAndRebuild({ ...configRef.current, grayscale: checked })}
          label="Black and white"
        />
      </div>

      <div className="min-h-0 flex-1 overflow-auto bg-slate-100 px-4 pb-3">
        {previewSrc || originalSrc ? (
          <div
            className="relative mx-auto w-full"
            style={
              config.removeBackground
                ? {
                    backgroundColor: '#ffffff',
                    backgroundImage:
                      'linear-gradient(45deg, #cbd5e1 25%, transparent 25%), linear-gradient(-45deg, #cbd5e1 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #cbd5e1 75%), linear-gradient(-45deg, transparent 75%, #cbd5e1 75%)',
                    backgroundSize: '16px 16px',
                    backgroundPosition: '0 0, 0 8px, 8px -8px, -8px 0px',
                  }
                : undefined
            }
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={previewSrc || originalSrc} alt="Sprite sheet" className="block w-full h-auto select-none" draggable={false} />
            <svg
              ref={stageRef}
              className="absolute inset-0 h-full w-full touch-none cursor-pointer"
              viewBox={`0 0 ${fw} ${fh}`}
              preserveAspectRatio="none"
              onPointerDown={onSheetPointerDown}
            >
              {selectedBox
                ? (() => {
                    const box = selectedBox;
                    const active = drag?.slotId === box.slotId;
                    const color = active ? '#0369a1' : '#059669';
                    const handles: Array<{ handle: Handle; x: number; y: number }> = [
                      { handle: 'nw', x: box.x, y: box.y },
                      { handle: 'n', x: box.x + box.w / 2, y: box.y },
                      { handle: 'ne', x: box.x + box.w, y: box.y },
                      { handle: 'e', x: box.x + box.w, y: box.y + box.h / 2 },
                      { handle: 'se', x: box.x + box.w, y: box.y + box.h },
                      { handle: 's', x: box.x + box.w / 2, y: box.y + box.h },
                      { handle: 'sw', x: box.x, y: box.y + box.h },
                      { handle: 'w', x: box.x, y: box.y + box.h / 2 },
                    ];
                    return (
                      <g key={box.slotId}>
                        <rect
                          x={box.x}
                          y={box.y}
                          width={box.w}
                          height={box.h}
                          fill={active ? 'rgba(14,165,233,0.12)' : 'rgba(5,150,105,0.08)'}
                          stroke={color}
                          strokeWidth={Math.max(2, fw / 500)}
                          className="cursor-move"
                          onPointerDown={(event) => onHandlePointerDown(event, box.slotId, 'move')}
                        />
                        <text
                          x={box.x + 8}
                          y={box.y + Math.max(16, fh / 40)}
                          fill={color}
                          fontSize={Math.max(12, fw / 48)}
                          fontWeight={700}
                          className="pointer-events-none"
                        >
                          {box.slotId}
                        </text>
                        {handles.map(({ handle, x, y }) => (
                          <rect
                            key={handle}
                            x={x - handleSize / 2}
                            y={y - handleSize / 2}
                            width={handleSize}
                            height={handleSize}
                            fill="#fff"
                            stroke={color}
                            strokeWidth={Math.max(1, fw / 700)}
                            style={{ cursor: cursorFor(handle) }}
                            onPointerDown={(event) => onHandlePointerDown(event, box.slotId, handle)}
                          />
                        ))}
                      </g>
                    );
                  })()
                : null}
            </svg>
          </div>
        ) : null}
      </div>

      <div className="border-t bg-white px-4 py-3">
        <p className="mb-2 text-xs font-semibold text-slate-700">All images</p>
        <div className="grid max-h-40 grid-cols-4 gap-2 overflow-auto sm:grid-cols-6">
          {assets.map((asset) => (
            <button
              key={asset.slotId}
              type="button"
              className={`rounded border bg-slate-50 p-1 text-left ${
                selectedSlotId === asset.slotId ? 'border-emerald-600 ring-2 ring-emerald-500/40' : 'border-slate-200'
              }`}
              onClick={() => setSelectedSlotId(asset.slotId)}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={asset.dataUrl} alt={asset.name} className="mx-auto h-14 w-full object-contain" />
              <p className="mt-1 truncate text-center text-[10px] text-slate-600">{asset.name}</p>
            </button>
          ))}
        </div>
      </div>

      <div className="flex justify-end gap-2 border-t px-4 py-3">
        <Button type="button" variant="outline" onClick={close}>
          Cancel
        </Button>
        <Button type="button" onClick={handleApply} disabled={!assets.length || busy}>
          <Check className="h-4 w-4" />
          {applyLabel}
        </Button>
      </div>
    </dialog>,
    document.body
  );
}
