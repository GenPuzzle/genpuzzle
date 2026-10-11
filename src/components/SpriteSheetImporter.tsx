'use client';

import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown, ImageUp, Loader2, Minus, Plus, Redo2, SlidersHorizontal, Sparkles, Trash2, Undo2, X } from 'lucide-react';
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
  loadImageBuffer,
  replaceSlotImage,
  runSpriteSheetPipeline,
  sheetPreviewSrc,
  type ExtractedAsset,
  type PixelBuffer,
  type SlotCropBox,
  type SpriteSheetCropConfig,
  type SpriteSheetItem,
  type SpriteSheetKind,
} from '@/lib/sprite-sheet-importer';
import { autoEnhanceLineArt } from '@/lib/auto-enhance';
import {
  COLORING_ENHANCE_INPUT_MAX_SIDE,
  COLORING_ENHANCE_PRESETS,
  DEFAULT_COLORING_ENHANCE_SETTINGS,
  normalizeColoringSettings,
  punchWhiteBackground,
  requestColoringEnhanceFromBuffer,
  svgPreviewUrl,
  type ColoringEnhanceSettings,
} from '@/lib/coloring-enhance';
import { EnhanceProgressBar } from '@/components/coloring-enhance/EnhanceProgressBar';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';

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

function closestSlot(px: number, py: number, boxes: SlotCropBox[]): string | null {
  if (!boxes.length) return null;
  let best = boxes[0];
  let bestDist = Infinity;
  for (const box of boxes) {
    const dist = Math.hypot(px - (box.x + box.w / 2), py - (box.y + box.h / 2));
    if (dist < bestDist) {
      bestDist = dist;
      best = box;
    }
  }
  return best.slotId;
}

function cloneCropBoxes(boxes: SlotCropBox[]): SlotCropBox[] {
  return boxes.map((box) => ({
    ...box,
    outline: box.outline?.slice(),
    extraOutlines: box.extraOutlines?.map((polygon) => polygon.slice()),
    includePolygons: box.includePolygons?.map((polygon) => polygon.slice()),
    excludePolygons: box.excludePolygons?.map((polygon) => polygon.slice()),
  }));
}

function CropToolButton({
  selected,
  disabled,
  title,
  onClick,
  children,
  iconOnly,
}: {
  selected?: boolean;
  disabled?: boolean;
  title?: string;
  onClick?: () => void;
  children: React.ReactNode;
  iconOnly?: boolean;
}) {
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      aria-pressed={selected}
      className={`gp-btn inline-flex h-8 shrink-0 cursor-pointer items-center justify-center gap-1 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-50 ${
        iconOnly ? 'w-8 px-0' : 'px-2.5'
      } ${selected ? 'gp-btn-selected' : ''}`}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

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
  sheets,
  activeSheet,
  onActiveSheetChange,
  onCropDraft,
  closeOnApply = true,
  printLongSide,
  initialEnhancedSlotIds,
  onAddSheets,
  onRemoveSheet,
  onSheetSourceChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  kind: SpriteSheetKind;
  items: SpriteSheetItem[];
  rows: number;
  columns: number;
  originalSrc: string;
  savedCrop?: SpriteSheetCropConfig | null;
  onImport: (
    assets: ExtractedAsset[],
    crop: SpriteSheetCropConfig,
    reportProgress?: (progress: { label: string; current: number; total: number }) => void
  ) => void | Promise<void>;
  sheets?: Array<{ index: number; label: string }>;
  activeSheet?: number;
  onActiveSheetChange?: (
    index: number,
    crop: SpriteSheetCropConfig | null,
    assets: ExtractedAsset[]
  ) => void;
  onCropDraft?: (crop: SpriteSheetCropConfig, assets: ExtractedAsset[]) => void;
  closeOnApply?: boolean;
  printLongSide?: number;
  initialEnhancedSlotIds?: string[];
  onAddSheets?: () => void;
  onRemoveSheet?: (index: number) => void;
  onSheetSourceChange?: (dataUrl: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [sheetReady, setSheetReady] = useState(false);
  const [status, setStatus] = useState('Analyzing artwork...');
  const [config, setConfig] = useState<SpriteSheetCropConfig>({
    ...DEFAULT_CROP_CONFIG,
    ...savedCrop,
    boxes: savedCrop?.boxes ?? [],
    normalizeMode: savedCrop?.normalizeMode ?? defaultNormalizeMode(kind),
  });
  const [assets, setAssets] = useState<ExtractedAsset[]>([]);
  const assetsRef = useRef<ExtractedAsset[]>([]);
  assetsRef.current = assets;
  const [drag, setDrag] = useState<{ slotId: string; handle: Handle } | null>(null);
  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null);
  const [lassoPoints, setLassoPoints] = useState<number[]>([]);
  const [lassoMode, setLassoMode] = useState<'select' | 'add' | 'subtract'>('select');
  const lassoOn = kind === 'maze' && (lassoMode === 'add' || lassoMode === 'subtract');
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const pastRef = useRef<SlotCropBox[][]>([]);
  const futureRef = useRef<SlotCropBox[][]>([]);
  const replacedSlotsRef = useRef<Record<string, ExtractedAsset>>({});
  const changeImageRef = useRef<HTMLInputElement>(null);
  const selectedSlotRef = useRef<string | null>(null);
  selectedSlotRef.current = selectedSlotId;
  const [previewSrc, setPreviewSrc] = useState(originalSrc);
  const [sheetSize, setSheetSize] = useState({ width: 1, height: 1 });

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
    recorded?: boolean;
  } | null>(null);
  const configRef = useRef(config);
  const closingRef = useRef(false);
  const runId = useRef(0);
  const effectsTimer = useRef(0);
  const loadedSrcRef = useRef('');
  const draftsRef = useRef<
    Record<number, { src: string; crop: SpriteSheetCropConfig; assets: ExtractedAsset[] }>
  >({});
  const onCropDraftRef = useRef(onCropDraft);
  onCropDraftRef.current = onCropDraft;
  const onSheetSourceChangeRef = useRef(onSheetSourceChange);
  onSheetSourceChangeRef.current = onSheetSourceChange;
  configRef.current = config;

  const sheetKey = activeSheet ?? 0;

  const persistDraft = useCallback(
    (nextCrop: SpriteSheetCropConfig, nextAssets: ExtractedAsset[]) => {
      const src = loadedSrcRef.current || originalSrc;
      if (!src) return;
      draftsRef.current[sheetKey] = { src, crop: nextCrop, assets: nextAssets };
      onCropDraftRef.current?.(nextCrop, nextAssets);
    },
    [originalSrc, sheetKey]
  );

  const enhancedSlotsRef = useRef<Set<string>>(new Set(initialEnhancedSlotIds ?? []));
  const enhanceGen = useRef(0);
  const [enhancingSlotId, setEnhancingSlotId] = useState<string | null>(null);
  const [jobProgress, setJobProgress] = useState<{ label: string; current: number; total: number } | null>(null);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [enhanceSettings, setEnhanceSettings] = useState<ColoringEnhanceSettings>(DEFAULT_COLORING_ENHANCE_SETTINGS);
  const enhanceSettingsRef = useRef(enhanceSettings);
  enhanceSettingsRef.current = enhanceSettings;
  const printLongSideRef = useRef(printLongSide);
  printLongSideRef.current = printLongSide;

  useEffect(() => {
    enhancedSlotsRef.current = new Set(initialEnhancedSlotIds ?? []);
    // Only restore saved enhance flags when the sheet image changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [originalSrc, sheetKey]);

  const enhanceAsset = useCallback(async (asset: ExtractedAsset, gen: number): Promise<ExtractedAsset | null> => {
    if (asset.blank) return asset;
    const source = asset.sourceDataUrl || asset.dataUrl;
    try {
      const buf = await loadImageBuffer(source, kind === 'maze' ? COLORING_ENHANCE_INPUT_MAX_SIDE : 0);
      if (gen !== enhanceGen.current) return null;
      if (kind !== 'maze') {
        const result = autoEnhanceLineArt(buf, { printLongSide: printLongSideRef.current });
        if (gen !== enhanceGen.current) return null;
        if (!result.applied) {
          toast.message(result.message || 'This image was left unchanged.');
          enhancedSlotsRef.current.delete(asset.slotId);
          return {
            ...asset,
            sourceDataUrl: source,
            sourceWidth: asset.sourceWidth || asset.width,
            sourceHeight: asset.sourceHeight || asset.height,
            dataUrl: source,
            autoEnhanced: false,
            previewSvg: undefined,
          };
        }
        const next = {
          ...asset,
          sourceDataUrl: source,
          sourceWidth: asset.sourceWidth || buf.width,
          sourceHeight: asset.sourceHeight || buf.height,
          dataUrl: bufferToDataUrl(result.image),
          width: result.image.width,
          height: result.image.height,
          autoEnhanced: true,
          previewSvg: result.svg,
        };
        replacedSlotsRef.current[asset.slotId] = next;
        return next;
      }
      const result = await requestColoringEnhanceFromBuffer(buf, enhanceSettingsRef.current);
      if (gen !== enhanceGen.current) return null;
      const enhanced = punchWhiteBackground(await loadImageBuffer(result.imagePng, 0));
      enhancedSlotsRef.current.add(asset.slotId);
      const next = {
        ...asset,
        sourceDataUrl: source,
        sourceWidth: asset.sourceWidth || buf.width,
        sourceHeight: asset.sourceHeight || buf.height,
        dataUrl: bufferToDataUrl(enhanced),
        width: enhanced.width,
        height: enhanced.height,
        autoEnhanced: true,
        previewSvg: result.svg || undefined,
      };
      replacedSlotsRef.current[asset.slotId] = next;
      return next;
    } catch (error) {
      console.error(error);
      if (gen !== enhanceGen.current) return null;
      toast.error(kind === 'maze' ? 'Could not enhance this maze image.' : 'Could not enhance this image.');
      return {
        ...asset,
        sourceDataUrl: source,
        autoEnhanced: false,
        previewSvg: undefined,
      };
    }
  }, [kind]);

  const reapplyEnhancements = useCallback(
    async (list: ExtractedAsset[], crop: SpriteSheetCropConfig, slotIds?: string[]) => {
      const wanted = slotIds ? new Set(slotIds) : null;
      const targets = list.filter((asset) => {
        if (asset.blank) return false;
        return wanted ? wanted.has(asset.slotId) : enhancedSlotsRef.current.has(asset.slotId);
      });
      const gen = ++enhanceGen.current;
      let next = list;
      setJobProgress({ label: 'Enhancing', current: 0, total: targets.length });
      try {
        for (let index = 0; index < targets.length; index += 1) {
          const asset = targets[index];
          setEnhancingSlotId(asset.slotId);
          setJobProgress({ label: 'Enhancing', current: index + 1, total: targets.length });
          setStatus(`Enhancing ${index + 1} / ${targets.length}`);
          const updated = await enhanceAsset(asset, gen);
          if (!updated || gen !== enhanceGen.current) return;
          next = next.map((item) => (item.slotId === updated.slotId ? updated : item));
          setAssets(next);
          persistDraft(crop, next);
        }
        if (gen === enhanceGen.current) setStatus('Ready');
      } finally {
        if (gen === enhanceGen.current) {
          setEnhancingSlotId(null);
          setJobProgress(null);
        }
      }
    },
    [enhanceAsset, persistDraft]
  );

  const enhanceAllImages = useCallback(() => {
    const list = assetsRef.current;
    const ids = list.filter((asset) => !asset.blank).map((asset) => asset.slotId);
    if (!ids.length) {
      toast.error('There are no images to enhance.');
      return;
    }
    ids.forEach((id) => enhancedSlotsRef.current.add(id));
    void reapplyEnhancements(list, configRef.current, ids);
  }, [reapplyEnhancements]);

  const applyLabel =
    kind === 'characters'
      ? 'Apply character crops'
      : kind === 'elements'
        ? 'Apply element crops'
        : kind === 'maze'
          ? 'Apply start and end crops'
          : 'Apply room crops';

  const rebuildAssets = useCallback(
    (nextConfig: SpriteSheetCropConfig) => {
      const working = workingRef.current;
      if (!working || !nextConfig.boxes.length) return;
      const nextAssets = extractSlotAssets(
        working,
        items,
        nextConfig.gridCols || columns,
        nextConfig.gridRows || rows,
        nextConfig.xs,
        nextConfig.ys,
        nextConfig,
        kind
      ).map((asset) => {
        const replaced = replacedSlotsRef.current[asset.slotId];
        return replaced ? { ...replaced, slotId: asset.slotId, name: asset.name } : asset;
      });
      setAssets(nextAssets);
      persistDraft(nextConfig, nextAssets);
      return nextAssets;
    },
    [columns, items, kind, persistDraft, rows]
  );

  const syncHistoryButtons = useCallback(() => {
    setCanUndo(pastRef.current.length > 0);
    setCanRedo(futureRef.current.length > 0);
  }, []);

  const clearSelectionHistory = useCallback(() => {
    pastRef.current = [];
    futureRef.current = [];
    setCanUndo(false);
    setCanRedo(false);
  }, []);

  const pushSelectionHistory = useCallback(() => {
    pastRef.current.push(cloneCropBoxes(configRef.current.boxes ?? []));
    if (pastRef.current.length > 80) pastRef.current.shift();
    futureRef.current = [];
    syncHistoryButtons();
  }, [syncHistoryButtons]);

  const applyCropBoxes = useCallback(
    (boxes: SlotCropBox[]) => {
      setConfig((prev) => {
        const next = { ...prev, boxes };
        configRef.current = next;
        rebuildAssets(next);
        return next;
      });
    },
    [rebuildAssets]
  );

  const undoSelection = useCallback(() => {
    if (lassoPoints.length) {
      setLassoPoints([]);
      return;
    }
    const previous = pastRef.current.pop();
    if (!previous) return;
    futureRef.current.push(cloneCropBoxes(configRef.current.boxes ?? []));
    applyCropBoxes(previous);
    syncHistoryButtons();
  }, [applyCropBoxes, lassoPoints.length, syncHistoryButtons]);

  const redoSelection = useCallback(() => {
    const next = futureRef.current.pop();
    if (!next) return;
    pastRef.current.push(cloneCropBoxes(configRef.current.boxes ?? []));
    setLassoPoints([]);
    applyCropBoxes(next);
    syncHistoryButtons();
  }, [applyCropBoxes, syncHistoryButtons]);

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
        setPreviewSrc(sheetPreviewSrc(originalSrc, original, working));
        rebuildAssets(nextConfig);
      }, 80);
    },
    [originalSrc, rebuildAssets]
  );

  const runPipeline = useCallback(
    async (seed?: SpriteSheetCropConfig | null) => {
      if (!originalSrc) return;
      const draft = draftsRef.current[sheetKey];
      const cropOptions =
        seed ?? (draft && draft.src === originalSrc ? draft.crop : null) ?? savedCrop ?? undefined;
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
            ...cropOptions,
            normalizeMode: cropOptions?.normalizeMode ?? defaultNormalizeMode(kind),
          },
          (next) => {
            if (id === runId.current) setStatus(next);
          }
        );
        if (id !== runId.current) return;
        originalRef.current = pipeline.original;
        workingRef.current = pipeline.working;
        sizeRef.current = { width: pipeline.working.width, height: pipeline.working.height };
        setSheetSize({ width: pipeline.working.width, height: pipeline.working.height });
        loadedSrcRef.current = originalSrc;
        setSheetReady(true);
        setConfig(pipeline.config);
        configRef.current = pipeline.config;
        setAssets(pipeline.assets);
        setPreviewSrc(pipeline.workingSrc);
        setSelectedSlotId(null);
        setLassoPoints([]);
        setLassoMode('select');
        replacedSlotsRef.current = {};
        clearSelectionHistory();
        persistDraft(pipeline.config, pipeline.assets);
      } catch (error) {
        console.error(error);
        toast.error('Could not open the crop editor.');
        setStatus('Ready');
      } finally {
        if (id === runId.current) setBusy(false);
      }
    },
    [clearSelectionHistory, columns, items, kind, originalSrc, persistDraft, rows, savedCrop, sheetKey]
  );

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
    if (loadedSrcRef.current === originalSrc && workingRef.current) return;
    setSheetReady(false);
    loadedSrcRef.current = '';
    const draft = draftsRef.current[sheetKey];
    const seed = draft && draft.src === originalSrc ? draft.crop : savedCrop ?? null;
    const timer = window.setTimeout(() => {
      void runPipeline(seed);
    }, 40);
    return () => {
      window.clearTimeout(timer);
      runId.current += 1;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, originalSrc, sheetKey]);

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

  const sheetPoint = (event: { clientX: number; clientY: number }) => {
    const svg = stageRef.current;
    const size = sizeRef.current;
    if (!svg) return null;
    const rect = svg.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / Math.max(1, rect.width)) * size.width,
      y: ((event.clientY - rect.top) / Math.max(1, rect.height)) * size.height,
    };
  };

  const commitLasso = (points: number[], slotId: string) => {
    setLassoPoints([]);
    if (points.length < 6 || !slotId) return;
    pushSelectionHistory();
    delete replacedSlotsRef.current[slotId];
    if (lassoMode === 'subtract') {
      setConfig((prev) => {
        const boxes = prev.boxes.map((box) =>
          box.slotId === slotId
            ? { ...box, excludePolygons: [...(box.excludePolygons ?? []), points] }
            : box
        );
        const next = { ...prev, boxes };
        configRef.current = next;
        rebuildAssets(next);
        return next;
      });
      return;
    }
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (let index = 0; index < points.length; index += 2) {
      minX = Math.min(minX, points[index]);
      maxX = Math.max(maxX, points[index]);
      minY = Math.min(minY, points[index + 1]);
      maxY = Math.max(maxY, points[index + 1]);
    }
    const width = sizeRef.current.width;
    const height = sizeRef.current.height;
    setConfig((prev) => {
      const boxes = prev.boxes.map((box) => {
        if (box.slotId !== slotId) return box;
        const x = Math.min(box.x, minX);
        const y = Math.min(box.y, minY);
        const right = Math.max(box.x + box.w, maxX);
        const bottom = Math.max(box.y + box.h, maxY);
        const padded = clampBox({ x: x - 2, y: y - 2, w: right - x + 4, h: bottom - y + 4 }, width, height);
        return {
          ...box,
          ...padded,
          includePolygons: [...(box.includePolygons ?? []), points],
          extraOutlines: [...(box.extraOutlines ?? []), points],
        };
      });
      const next = { ...prev, boxes };
      configRef.current = next;
      rebuildAssets(next);
      return next;
    });
  };

  const onSheetPointerDown = (event: React.PointerEvent<SVGSVGElement>) => {
    if (busy || dragRef.current) return;
    const point = sheetPoint(event);
    if (!point) return;
    if (lassoOn) {
      event.preventDefault();
      const closeDistance = Math.max(12, sizeRef.current.width / 70);
      if (
        lassoPoints.length >= 6 &&
        Math.hypot(point.x - lassoPoints[0], point.y - lassoPoints[1]) <= closeDistance
      ) {
        const slotId = selectedSlotRef.current;
        if (!slotId) {
          toast.error(
            lassoMode === 'subtract'
              ? 'Select an image below, then draw around the part to remove.'
              : 'Select an image below, then draw around the part to add.'
          );
          setLassoPoints([]);
          return;
        }
        commitLasso(lassoPoints, slotId);
        return;
      }
      if (!lassoPoints.length) {
        const boxes = configRef.current.boxes ?? [];
        const slotId = selectedSlotRef.current ?? pickSlotAt(point.x, point.y, boxes) ?? closestSlot(point.x, point.y, boxes);
        if (!slotId) {
          toast.error(
            lassoMode === 'subtract'
              ? 'Select an image below, then draw around the part to remove.'
              : 'Select an image below, then draw around the part to add.'
          );
          return;
        }
        selectedSlotRef.current = slotId;
        setSelectedSlotId(slotId);
      }
      setLassoPoints((current) => [...current, point.x, point.y]);
      return;
    }
    const slotId = pickSlotAt(point.x, point.y, configRef.current.boxes ?? []);
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
      const others = configRef.current.boxes ?? [];
      const overlaps = (box: SlotCropBox) =>
        others.some((other) => other.slotId !== box.slotId && boxesOverlap(box, other));
      let nextBox = resized;
      if (current.handle === 'move') {
        const cleared = keepBoxClearOfOthers(resized, others, fw, fh);
        if (!overlaps(cleared)) nextBox = cleared;
        else if (!overlaps(current.start)) nextBox = current.start;
      }
      if (!current.recorded) {
        pushSelectionHistory();
        current.recorded = true;
        delete replacedSlotsRef.current[current.slotId];
      }
      setConfig((prev) => {
        const boxes = prev.boxes.map((b) =>
          b.slotId === current.slotId
            ? {
                ...b,
                ...nextBox,
                outline: undefined,
                extraOutlines: undefined,
                includePolygons: undefined,
                excludePolygons: undefined,
              }
            : b
        );
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
  }, [drag, endDrag, pushSelectionHistory]);

  const handleChangeSlotImage = async (file: File) => {
    const slotId = selectedSlotRef.current;
    const box = configRef.current.boxes.find((item) => item.slotId === slotId);
    const original = originalRef.current;
    if (!slotId || !box || !original) {
      toast.error('Select an image, then click the update icon.');
      return;
    }
    try {
      const dataUrl = await fileToDataUrl(file);
      const buf = await loadImageBuffer(dataUrl, 0);
      const { sheet: nextOriginal, box: placed } = replaceSlotImage(
        original,
        buf,
        slotId,
        items,
        configRef.current.gridCols || columns,
        configRef.current.gridRows || rows,
        box
      );
      const newBox: SlotCropBox = {
        ...placed,
        outline: undefined,
        extraOutlines: undefined,
        includePolygons: undefined,
        excludePolygons: undefined,
      };
      const nextConfig = {
        ...configRef.current,
        boxes: (configRef.current.boxes ?? []).map((item) => (item.slotId === slotId ? newBox : item)),
      };
      configRef.current = nextConfig;
      setConfig(nextConfig);
      setLassoPoints([]);
      originalRef.current = nextOriginal;
      const working = applySheetEffects(nextOriginal, nextConfig);
      workingRef.current = working;
      const sheetUrl = bufferToDataUrl(nextOriginal);
      loadedSrcRef.current = sheetUrl;
      setPreviewSrc(working === nextOriginal ? sheetUrl : bufferToDataUrl(working));
      delete replacedSlotsRef.current[slotId];
      rebuildAssets(nextConfig);
      onSheetSourceChangeRef.current?.(sheetUrl);
      toast.success('The image was updated on the sheet.');
    } catch (error) {
      console.error(error);
      toast.error('Could not update this image.');
    }
  };

  const handleApply = async () => {
    if (!assets.length || busy || !sheetReady || enhancingSlotId) return;
    persistDraft(configRef.current, assetsRef.current);
    setBusy(true);
    setStatus('Applying start and end crops…');
    setJobProgress({ label: 'Placing images', current: 0, total: 1 });
    try {
      await onImport(assetsRef.current, configRef.current, (progress) => {
        setJobProgress(progress);
        setStatus(`${progress.label} ${progress.current} / ${progress.total}`);
      });
      if (closeOnApply) onOpenChange(false);
    } catch (error) {
      if (!(error instanceof Error && error.message === 'missing-crops')) {
        console.error(error);
        toast.error('Could not apply the crops.');
      }
    } finally {
      setBusy(false);
      setJobProgress(null);
      setStatus('Ready');
    }
  };

  const close = () => {
    if (closingRef.current) return;
    closingRef.current = true;
    enhanceGen.current += 1;
    runId.current += 1;
    const dialog = dialogRef.current;
    if (dialog?.open) dialog.close();
    onOpenChange(false);
  };

  useEffect(() => {
    if (!open || kind !== 'maze') return;
    const onKey = (event: KeyboardEvent) => {
      const mod = event.ctrlKey || event.metaKey;
      if (!mod) return;
      const key = event.key.toLowerCase();
      if (key === 'z' && !event.shiftKey) {
        event.preventDefault();
        undoSelection();
        return;
      }
      if (key === 'y' || (key === 'z' && event.shiftKey)) {
        event.preventDefault();
        redoSelection();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [kind, open, redoSelection, undoSelection]);

  const fw = sheetSize.width || sizeRef.current.width;
  const fh = sheetSize.height || sizeRef.current.height;
  const handleSize = Math.max(12, fw / 70);
  const selectedBox = config.boxes.find((box) => box.slotId === selectedSlotId) ?? null;

  if (!open || typeof document === 'undefined') return null;

  return createPortal(
    <dialog
      ref={dialogRef}
      className="z-[30000] overflow-hidden rounded-xl border border-slate-200 bg-white p-0 text-slate-900 shadow-2xl backdrop:bg-slate-950/75 open:flex open:flex-col [&_button]:cursor-pointer [&_button:disabled]:pointer-events-auto [&_button:disabled]:cursor-not-allowed [&_label]:cursor-pointer [&_label.custom-checkbox-container--disabled]:cursor-not-allowed"
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
        if (lassoPoints.length) {
          setLassoPoints([]);
          return;
        }
        if (lassoMode !== 'select') {
          setLassoMode('select');
          return;
        }
        close();
      }}
    >
      <div className="flex items-start justify-between gap-3 border-b px-4 py-3">
        <div>
          <h2 id="edit-cropping-title" className="text-base font-semibold">
            Edit cropping
          </h2>
          <p className="mt-0.5 text-xs text-slate-500">
              {kind === 'maze'
              ? 'Click Enhance images to clean every start and end drawing. Advanced enhance shows the sliders. Apply closes this window and places the images on the maze pages.'
              : 'Click an image to show its crop box. Boxes stay on their own image and do not overlap.'}
          </p>
        </div>
        <button
          type="button"
          className="cursor-pointer rounded-md p-1 text-slate-500 hover:bg-slate-100"
          aria-label="Close"
          onClick={close}
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {kind === 'maze' || (sheets && sheets.length > 1) ? (
        <div className="flex items-center gap-1.5 overflow-x-auto border-b px-4 py-2">
          {(sheets ?? []).map((sheet) => {
            const selected = sheet.index === activeSheet;
            return (
              <div
                key={sheet.index}
                className="inline-flex h-8 shrink-0 items-center rounded-lg"
              >
                <button
                  type="button"
                  className={`gp-btn cursor-pointer px-2.5 text-xs font-semibold ${selected ? 'gp-btn-selected' : ''}`}
                  onClick={() => {
                    if (sheet.index === activeSheet) return;
                    if (loadedSrcRef.current === originalSrc) {
                      persistDraft(configRef.current, assetsRef.current);
                      onActiveSheetChange?.(sheet.index, configRef.current, assetsRef.current);
                      return;
                    }
                    onActiveSheetChange?.(sheet.index, null, []);
                  }}
                >
                  {sheet.label}
                </button>
                {onRemoveSheet ? (
                  <button
                    type="button"
                    className="gp-btn gp-icon-danger ml-0.5 flex h-5 w-5 cursor-pointer items-center justify-center"
                    aria-label={`Remove ${sheet.label}`}
                    title="Remove this sheet"
                    onClick={(event) => {
                      event.stopPropagation();
                      if (loadedSrcRef.current === originalSrc) {
                        persistDraft(configRef.current, assetsRef.current);
                      }
                      onRemoveSheet(sheet.index);
                    }}
                  >
                    <Trash2 className="h-2.5 w-2.5" />
                  </button>
                ) : null}
              </div>
            );
          })}
          {onAddSheets ? (
            <CropToolButton title="Add another sheet" iconOnly onClick={onAddSheets}>
              <Plus className="h-3.5 w-3.5" />
            </CropToolButton>
          ) : null}
        </div>
      ) : null}

      <div className="flex items-center gap-2 px-4 py-2 text-xs text-slate-600">
        {busy || enhancingSlotId ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
        {busy || enhancingSlotId || jobProgress
          ? status
          : lassoOn
            ? lassoMode === 'subtract'
              ? 'Draw around the part to remove, then click the first point'
              : 'Draw around the part to add, then click the first point. The crop keeps exactly the area inside that line'
            : drag
              ? 'Adjusting crop box'
              : selectedSlotId
                ? 'Drag this box to crop the image'
                : 'Click an image to edit its crop'}
        <span className="ml-auto text-slate-400">
          {config.boxes?.length ?? items.length} crop boxes · {config.gridCols || columns} × {config.gridRows || rows}
        </span>
      </div>
      {kind === 'maze' && jobProgress ? (
        <EnhanceProgressBar
          label={jobProgress.label}
          current={jobProgress.current}
          total={jobProgress.total}
          busy={busy || !!enhancingSlotId}
        />
      ) : null}

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b px-4 py-2">
        <Checkbox
          className="cursor-pointer disabled:cursor-not-allowed"
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
          className="cursor-pointer disabled:cursor-not-allowed"
          checked={config.grayscale}
          disabled={busy}
          onCheckedChange={(checked) => applyEffectsAndRebuild({ ...configRef.current, grayscale: checked })}
          label="Black and white"
        />
        {kind === 'maze' ? (
          <div className="flex flex-wrap items-center gap-2">
            <CropToolButton
              disabled={busy || !sheetReady || !!enhancingSlotId || !assets.some((asset) => !asset.blank)}
              title="Enhance all start and end images with the coloring-page settings"
              onClick={enhanceAllImages}
            >
              {enhancingSlotId ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
              Enhance images
            </CropToolButton>
            <CropToolButton
              selected={advancedOpen}
              disabled={busy}
              title="Show advanced enhance controls"
              onClick={() => setAdvancedOpen((open) => !open)}
            >
              <SlidersHorizontal className="h-3.5 w-3.5" />
              Advanced enhance
              <ChevronDown className={`h-3.5 w-3.5 transition-transform ${advancedOpen ? 'rotate-180' : ''}`} />
            </CropToolButton>
          </div>
        ) : null}
        {kind === 'maze' ? (
          <div className="flex flex-wrap items-center gap-2">
            <CropToolButton
              selected={lassoMode === 'add'}
              disabled={busy || !sheetReady}
              title="Add a part to the selected image"
              onClick={() => {
                setLassoPoints([]);
                setLassoMode((current) => (current === 'add' ? 'select' : 'add'));
              }}
            >
              <Plus className="h-3.5 w-3.5" />
              Add
            </CropToolButton>
            <CropToolButton
              selected={lassoMode === 'subtract'}
              disabled={busy || !sheetReady}
              title="Remove a part from the selected image"
              onClick={() => {
                setLassoPoints([]);
                setLassoMode((current) => (current === 'subtract' ? 'select' : 'subtract'));
              }}
            >
              <Minus className="h-3.5 w-3.5" />
              Remove
            </CropToolButton>
            <CropToolButton disabled={!canUndo} title="Undo selection" onClick={undoSelection}>
              <Undo2 className="h-3.5 w-3.5" />
              Undo
            </CropToolButton>
            <CropToolButton disabled={!canRedo} title="Redo selection" onClick={redoSelection}>
              <Redo2 className="h-3.5 w-3.5" />
              Redo
            </CropToolButton>
            {selectedSlotId ? (
              <CropToolButton
                disabled={busy || !sheetReady}
                title="Update this image"
                iconOnly
                onClick={() => changeImageRef.current?.click()}
              >
                <ImageUp className="h-3.5 w-3.5" />
              </CropToolButton>
            ) : null}
            <input
              ref={changeImageRef}
              type="file"
              accept="image/png,image/webp,image/jpeg"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.target.value = '';
                if (file) void handleChangeSlotImage(file);
              }}
            />
          </div>
        ) : null}
      </div>

      {kind === 'maze' && advancedOpen ? (
        <div className="space-y-2 border-b px-4 py-3">
          <p className="text-[11px] text-slate-500">
            These settings match the Enhance Coloring Pages tool. Click Enhance images or Apply Settings to process every image.
          </p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {(
              [
                ['smoothness', 'Smoothness'],
                ['softness', 'Softness'],
                ['detail', 'Detail Preservation'],
                ['gapPreservation', 'Gap Preservation'],
                ['lineWeight', 'Line Weight'],
              ] as Array<[keyof ColoringEnhanceSettings, string]>
            ).map(([key, label]) => (
              <div key={key} className="space-y-1">
                <Label className="text-xs font-medium text-slate-600">{label}</Label>
                <div className="flex items-center gap-2">
                  <Slider
                    className="min-w-0 flex-1"
                    value={[enhanceSettings[key]]}
                    onValueChange={(next) =>
                      setEnhanceSettings((current) => normalizeColoringSettings({ ...current, [key]: next[0] }))
                    }
                    min={0}
                    max={100}
                    step={1}
                    disabled={busy || !!enhancingSlotId}
                  />
                  <Input
                    className="h-8 w-14 px-1.5 text-center text-xs font-semibold tabular-nums"
                    value={enhanceSettings[key]}
                    disabled={busy || !!enhancingSlotId}
                    onChange={(event) => {
                      const parsed = Number.parseInt(event.target.value, 10);
                      if (Number.isNaN(parsed)) return;
                      setEnhanceSettings((current) =>
                        normalizeColoringSettings({ ...current, [key]: parsed })
                      );
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {Object.entries(COLORING_ENHANCE_PRESETS).map(([id, preset]) => (
              <Button
                key={id}
                type="button"
                size="xs"
                variant="outline"
                disabled={busy || !!enhancingSlotId}
                onClick={() => setEnhanceSettings(normalizeColoringSettings(preset))}
              >
                {id === 'highDetail' ? 'High Detail' : id[0].toUpperCase() + id.slice(1)}
              </Button>
            ))}
            <Button
              type="button"
              size="xs"
              disabled={busy || !!enhancingSlotId || !assets.some((asset) => !asset.blank)}
              onClick={enhanceAllImages}
            >
              Apply Settings
            </Button>
          </div>
        </div>
      ) : null}

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
              className={`absolute inset-0 h-full w-full touch-none ${lassoOn ? 'cursor-crosshair' : 'cursor-pointer'}`}
              viewBox={`0 0 ${fw} ${fh}`}
              preserveAspectRatio="none"
              onPointerDown={onSheetPointerDown}
            >
              {(config.boxes ?? []).map((box) =>
                box.outline && box.outline.length >= 4 ? (
                  <polygon
                    key={`${box.slotId}-outline`}
                    points={Array.from({ length: box.outline.length / 2 }, (_, index) => `${box.outline![index * 2]},${box.outline![index * 2 + 1]}`).join(' ')}
                    fill={selectedSlotId === box.slotId ? 'rgba(5,150,105,0.08)' : 'none'}
                    stroke={selectedSlotId === box.slotId ? '#059669' : 'rgba(5,150,105,0.55)'}
                    strokeWidth={lassoOn && selectedSlotId === box.slotId ? Math.max(2.5, fw / 380) : Math.max(1.5, fw / 700)}
                    className="pointer-events-none"
                  />
                ) : null
              )}
              {(config.boxes ?? []).flatMap((box) =>
                (box.extraOutlines ?? []).map((outline, index) =>
                  outline.length >= 4 ? (
                    <polygon
                      key={`${box.slotId}-extra-${index}`}
                      points={Array.from({ length: outline.length / 2 }, (_, point) => `${outline[point * 2]},${outline[point * 2 + 1]}`).join(' ')}
                      fill={selectedSlotId === box.slotId ? 'rgba(37,99,235,0.12)' : 'none'}
                      stroke="#2563eb"
                      strokeWidth={Math.max(1.5, fw / 700)}
                      className="pointer-events-none"
                    />
                  ) : null
                )
              )}
              {(config.boxes ?? []).flatMap((box) =>
                (box.excludePolygons ?? []).map((outline, index) =>
                  outline.length >= 4 ? (
                    <polygon
                      key={`${box.slotId}-exclude-${index}`}
                      points={Array.from({ length: outline.length / 2 }, (_, point) => `${outline[point * 2]},${outline[point * 2 + 1]}`).join(' ')}
                      fill={selectedSlotId === box.slotId ? 'rgba(220,38,38,0.14)' : 'rgba(220,38,38,0.06)'}
                      stroke="#dc2626"
                      strokeWidth={Math.max(1.5, fw / 700)}
                      className="pointer-events-none"
                    />
                  ) : null
                )
              )}
              {lassoPoints.length >= 2 ? (
                <polyline
                  points={Array.from({ length: lassoPoints.length / 2 }, (_, index) => `${lassoPoints[index * 2]},${lassoPoints[index * 2 + 1]}`).join(' ')}
                  fill="none"
                  stroke={lassoMode === 'subtract' ? '#dc2626' : '#2563eb'}
                  strokeWidth={Math.max(1.5, fw / 700)}
                  strokeDasharray={`${Math.max(4, fw / 160)} ${Math.max(3, fw / 220)}`}
                  className="pointer-events-none"
                />
              ) : null}
              {lassoPoints.length >= 2
                ? Array.from({ length: lassoPoints.length / 2 }, (_, index) => (
                    <circle
                      key={`lasso-point-${index}`}
                      cx={lassoPoints[index * 2]}
                      cy={lassoPoints[index * 2 + 1]}
                      r={Math.max(3, fw / 280)}
                      fill={index === 0 ? (lassoMode === 'subtract' ? '#b91c1c' : '#1d4ed8') : '#fff'}
                      stroke={lassoMode === 'subtract' ? '#b91c1c' : '#1d4ed8'}
                      strokeWidth={Math.max(1, fw / 800)}
                      className="pointer-events-none"
                    />
                  ))
                : null}
              {selectedBox && !lassoOn
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
                          fill="transparent"
                          stroke={color}
                          strokeWidth={Math.max(1, fw / 900)}
                          strokeDasharray={`${Math.max(4, fw / 160)} ${Math.max(3, fw / 220)}`}
                          className="cursor-move"
                          onPointerDown={(event) => onHandlePointerDown(event, box.slotId, 'move')}
                        />
                        {box.outline && box.outline.length >= 4 ? (
                          <polygon
                            points={Array.from({ length: box.outline.length / 2 }, (_, index) => `${box.outline![index * 2]},${box.outline![index * 2 + 1]}`).join(' ')}
                            fill={active ? 'rgba(14,165,233,0.18)' : 'rgba(5,150,105,0.16)'}
                            stroke={color}
                            strokeWidth={Math.max(2, fw / 480)}
                            className="pointer-events-none"
                          />
                        ) : null}
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
              className={`cursor-pointer rounded p-1 text-left ${selectedSlotId === asset.slotId ? 'gp-btn-selected' : ''}`}
              onClick={() => setSelectedSlotId(asset.slotId)}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={asset.previewSvg ? svgPreviewUrl(asset.previewSvg) : asset.dataUrl}
                alt={asset.name}
                className="mx-auto h-14 w-full object-contain"
              />
              <p className="mt-1 truncate text-center text-[10px] text-slate-600">
                {asset.autoEnhanced ? 'Enhanced · ' : ''}
                {asset.name}
              </p>
            </button>
          ))}
        </div>
      </div>

      <div className="flex justify-end gap-2 border-t px-4 py-3">
        <Button type="button" variant="outline" className="cursor-pointer" onClick={close}>
          Cancel
        </Button>
        <Button type="button" className="cursor-pointer disabled:cursor-not-allowed" onClick={handleApply} disabled={!assets.length || busy || !sheetReady || !!enhancingSlotId}>
          <Check className="h-4 w-4" />
          {applyLabel}
        </Button>
      </div>
    </dialog>,
    document.body
  );
}
