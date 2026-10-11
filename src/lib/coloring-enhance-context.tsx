'use client';

import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { loadImageBuffer } from '@/lib/sprite-sheet-importer';
import type { PixelBuffer } from '@/lib/sprite-sheet-importer';
import {
  analyzeColoringSource,
  coloringPagePdfFromSvg,
  downloadBlob,
  downloadColoringZip,
  downloadTextFile,
  enhancedFileName,
  rasterizeSvgToPrintPngBytes,
  requestColoringEnhanceFromBuffer,
  fileStem,
  isColoringImageFile,
  yieldToUi,
} from '@/lib/coloring-enhance';
import type { ColoringEnhanceSettings } from '@/lib/coloring-enhance';
import {
  COLORING_ENHANCE_PRESETS,
  DEFAULT_COLORING_ENHANCE_SETTINGS,
  normalizeColoringSettings,
} from '@/lib/coloring-enhance';
import type { ColoringJobItem, ColoringPreviewMode } from '@/lib/coloring-enhance';

interface OriginalRecord {
  buffer: PixelBuffer;
  svgText?: string;
}

interface ColoringEnhanceContextValue {
  items: ColoringJobItem[];
  selectedId: string | null;
  selected: ColoringJobItem | null;
  previewMode: ColoringPreviewMode;
  zoom: number;
  busy: boolean;
  progress: { current: number; total: number } | null;
  showReport: boolean;
  setPreviewMode: (mode: ColoringPreviewMode) => void;
  setZoom: (zoom: number) => void;
  setShowReport: (open: boolean) => void;
  selectItem: (id: string) => void;
  addFiles: (files: FileList | File[]) => Promise<void>;
  removeItem: (id: string) => void;
  enhanceAll: (force?: boolean) => Promise<void>;
  applySettings: () => Promise<void>;
  settings: ColoringEnhanceSettings;
  settingsDirty: boolean;
  previewUpdating: boolean;
  setSetting: (key: keyof ColoringEnhanceSettings, value: number) => void;
  applyPreset: (name: keyof typeof COLORING_ENHANCE_PRESETS) => void;
  resetSettings: () => void;
  exportSelectedSvg: () => void;
  exportSelectedPng: () => Promise<void>;
  exportSelectedPdf: () => Promise<void>;
  exportZip: () => Promise<void>;
}

const ColoringEnhanceContext = createContext<ColoringEnhanceContextValue | null>(null);

function createId(): string {
  return `ce-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function settingsKey(settings: ColoringEnhanceSettings): string {
  return `${settings.smoothness}-${settings.softness}-${settings.detail}-${settings.gapPreservation}-${settings.lineWeight}`;
}

export function ColoringEnhanceProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<ColoringJobItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [previewMode, setPreviewMode] = useState<ColoringPreviewMode>('side-by-side');
  const [zoom, setZoom] = useState(1);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<{ current: number; total: number } | null>(null);
  const [showReport, setShowReport] = useState(false);
  const [settings, setSettings] = useState<ColoringEnhanceSettings>(DEFAULT_COLORING_ENHANCE_SETTINGS);
  const [appliedSettings, setAppliedSettings] = useState<ColoringEnhanceSettings>(DEFAULT_COLORING_ENHANCE_SETTINGS);
  const [previewUpdating, setPreviewUpdating] = useState(false);
  const originalsRef = useRef(new Map<string, OriginalRecord>());
  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const itemsRef = useRef(items);
  itemsRef.current = items;
  const selectedRef = useRef<ColoringJobItem | null>(null);
  const busyRef = useRef(false);
  const liveGenRef = useRef(0);
  const liveTimerRef = useRef<number | null>(null);
  const appliedByItemRef = useRef(new Map<string, string>());

  const selected = useMemo(
    () => items.find((item) => item.id === selectedId) ?? items[0] ?? null,
    [items, selectedId]
  );
  selectedRef.current = selected;
  const enhanceAllRef = useRef<(force?: boolean) => Promise<void>>(async () => undefined);
  const autoEnhanceQueuedRef = useRef(false);

  const addFiles = useCallback(async (list: FileList | File[]) => {
    const files = Array.from(list).filter(isColoringImageFile);
    if (!files.length) {
      toast.error('Use PNG, JPG, WebP, or SVG files.');
      return;
    }
    const nextItems: ColoringJobItem[] = [];
    for (const file of files) {
      const isSvg = file.type.includes('svg') || file.name.toLowerCase().endsWith('.svg');
      const svgText = isSvg ? await file.text() : undefined;
      const url = URL.createObjectURL(file);
      try {
        const buffer = await loadImageBuffer(url, 2200);
        const profile = analyzeColoringSource(buffer, { isSvg, svgText });
        const id = createId();
        originalsRef.current.set(id, { buffer, svgText });
        nextItems.push({
          id,
          name: file.name,
          stem: fileStem(file.name),
          originalUrl: url,
          width: buffer.width,
          height: buffer.height,
          profile,
          status: 'ready',
        });
      } catch (error) {
        console.error(error);
        URL.revokeObjectURL(url);
        toast.error(`Could not read ${file.name}.`);
      }
    }
    if (!nextItems.length) return;
    setItems((current) => {
      const merged = [...current, ...nextItems];
      itemsRef.current = merged;
      return merged;
    });
    setSelectedId((current) => current ?? nextItems[0].id);
    await enhanceAllRef.current();
  }, []);

  const removeItem = useCallback((id: string) => {
    setItems((current) => {
      const found = current.find((item) => item.id === id);
      if (found) {
        URL.revokeObjectURL(found.originalUrl);
        if (found.enhancedPngUrl) URL.revokeObjectURL(found.enhancedPngUrl);
      }
      originalsRef.current.delete(id);
      appliedByItemRef.current.delete(id);
      const remaining = current.filter((item) => item.id !== id);
      setSelectedId((selectedNow) => {
        if (selectedNow !== id) return selectedNow;
        return remaining[0]?.id ?? null;
      });
      return remaining;
    });
  }, []);

  const setSetting = useCallback((key: keyof ColoringEnhanceSettings, value: number) => {
    setSettings((current) => normalizeColoringSettings({ ...current, [key]: value }));
  }, []);

  const applyPreset = useCallback((name: keyof typeof COLORING_ENHANCE_PRESETS) => {
    setSettings(normalizeColoringSettings(COLORING_ENHANCE_PRESETS[name]));
  }, []);

  const resetSettings = useCallback(() => {
    setSettings(DEFAULT_COLORING_ENHANCE_SETTINGS);
  }, []);

  const enhanceOne = useCallback(async (itemId: string, silent = false): Promise<boolean> => {
    const item = itemsRef.current.find((entry) => entry.id === itemId);
    if (!item) return false;
    const generation = ++liveGenRef.current;
    const usedSettings = settingsRef.current;
    setItems((current) =>
      current.map((entry) => (entry.id === item.id ? { ...entry, status: 'enhancing', error: undefined } : entry))
    );
    await yieldToUi();
    const original = originalsRef.current.get(item.id);
    if (!original) {
      setItems((current) =>
        current.map((entry) =>
          entry.id === item.id ? { ...entry, status: 'error', error: 'The original image is no longer available.' } : entry
        )
      );
      return false;
    }
    try {
      const result = await requestColoringEnhanceFromBuffer(original.buffer, usedSettings, {
        isSvg: item.profile?.isSvg,
        svgText: original.svgText,
      });
      if (generation !== liveGenRef.current && silent) return false;
      const pngUrl = result.imagePng;
      setItems((current) =>
        current.map((entry) => {
          if (entry.id !== item.id) return entry;
          if (entry.enhancedPngUrl && entry.enhancedPngUrl !== pngUrl) URL.revokeObjectURL(entry.enhancedPngUrl);
          return {
            ...entry,
            status: 'done',
            error: result.quality?.vectorReady === false
              ? 'The vector is not ready: topology, gaps, or line width still differ from the original.'
              : undefined,
            enhancedSvg: result.svg || undefined,
            enhancedPngUrl: pngUrl,
            quality: result.quality,
          };
        })
      );
      appliedByItemRef.current.set(item.id, settingsKey(usedSettings));
      setAppliedSettings(usedSettings);
      return true;
    } catch (error) {
      console.error(error);
      if (generation !== liveGenRef.current && silent) return false;
      setItems((current) =>
        current.map((entry) =>
          entry.id === item.id ? { ...entry, status: 'error', error: 'Could not enhance this image.' } : entry
        )
      );
      return false;
    }
  }, []);

  const enhanceAll = useCallback(async (force = false) => {
    if (busyRef.current) {
      autoEnhanceQueuedRef.current = true;
      return;
    }
    if (liveTimerRef.current) {
      window.clearTimeout(liveTimerRef.current);
      liveTimerRef.current = null;
    }
    const currentItems = itemsRef.current;
    let pending = force
      ? currentItems.filter((item) => item.status !== 'enhancing')
      : currentItems.filter((item) => item.status === 'ready' || item.status === 'error');
    if (!pending.length && !force && currentItems.some((item) => item.status === 'done')) {
      pending = currentItems.filter((item) => item.status !== 'enhancing');
    }
    if (!pending.length) {
      toast.message(currentItems.length ? 'All images are already enhanced.' : 'Add images first.');
      return;
    }
    busyRef.current = true;
    setBusy(true);
    setPreviewUpdating(false);
    setProgress({ current: 0, total: pending.length });
    try {
      for (let index = 0; index < pending.length; index += 1) {
        setProgress({ current: index + 1, total: pending.length });
        await enhanceOne(pending[index].id, false);
        await yieldToUi();
      }
      toast.success('Enhancement finished.');
    } finally {
      busyRef.current = false;
      setBusy(false);
      setProgress(null);
      if (autoEnhanceQueuedRef.current) {
        autoEnhanceQueuedRef.current = false;
        void enhanceAllRef.current();
      }
    }
  }, [enhanceOne]);
  enhanceAllRef.current = enhanceAll;

  const applySettings = useCallback(async () => {
    if (!items.length) {
      toast.message('Add images first.');
      return;
    }
    await enhanceAll(true);
  }, [enhanceAll, items.length]);

  const exportSelectedSvg = useCallback(() => {
    if (!selected?.enhancedSvg) return;
    downloadTextFile(enhancedFileName(selected.name, 'svg'), selected.enhancedSvg, 'image/svg+xml');
  }, [selected]);

  const exportSelectedPng = useCallback(async () => {
    if (!selected?.enhancedSvg) return;
    try {
      const bytes = await rasterizeSvgToPrintPngBytes(selected.enhancedSvg, selected.width, selected.height);
      downloadBlob(enhancedFileName(selected.name, 'png'), new Blob([bytes], { type: 'image/png' }));
    } catch (error) {
      console.error(error);
      toast.error('Could not export a 300 PPI PNG from the SVG.');
    }
  }, [selected]);

  const exportSelectedPdf = useCallback(async () => {
    if (!selected?.enhancedSvg) return;
    try {
      const bytes = await coloringPagePdfFromSvg(selected.enhancedSvg, selected.width, selected.height);
      downloadBlob(enhancedFileName(selected.name, 'pdf'), new Blob([bytes], { type: 'application/pdf' }));
    } catch (error) {
      console.error(error);
      toast.error('Could not export a 300 PPI PDF from the SVG.');
    }
  }, [selected]);

  const exportZip = useCallback(async () => {
    const ready = items.filter((item) => item.enhancedSvg || item.enhancedPngUrl);
    if (!ready.length) {
      toast.error('Enhance the images first.');
      return;
    }
    await downloadColoringZip(
      ready.map((item) => ({
        stem: item.stem,
        svg: item.enhancedSvg,
        pngDataUrl: item.enhancedPngUrl,
        width: item.width,
        height: item.height,
      }))
    );
  }, [items]);

  const value = useMemo<ColoringEnhanceContextValue>(
    () => ({
      items,
      selectedId: selected?.id ?? null,
      selected,
      previewMode,
      zoom,
      busy,
      progress,
      showReport,
      setPreviewMode,
      setZoom,
      setShowReport,
      selectItem: setSelectedId,
      addFiles,
      removeItem,
      enhanceAll,
      applySettings,
      settings,
      previewUpdating,
      settingsDirty:
        settings.smoothness !== appliedSettings.smoothness ||
        settings.softness !== appliedSettings.softness ||
        settings.detail !== appliedSettings.detail ||
        settings.gapPreservation !== appliedSettings.gapPreservation ||
        settings.lineWeight !== appliedSettings.lineWeight,
      setSetting,
      applyPreset,
      resetSettings,
      exportSelectedSvg,
      exportSelectedPng,
      exportSelectedPdf,
      exportZip,
    }),
    [
      addFiles,
      appliedSettings,
      applyPreset,
      applySettings,
      busy,
      enhanceAll,
      exportSelectedPdf,
      exportSelectedPng,
      exportSelectedSvg,
      exportZip,
      items,
      previewMode,
      previewUpdating,
      progress,
      removeItem,
      resetSettings,
      selected,
      setSetting,
      settings,
      showReport,
      zoom,
    ]
  );

  return <ColoringEnhanceContext.Provider value={value}>{children}</ColoringEnhanceContext.Provider>;
}

export function useColoringEnhance(): ColoringEnhanceContextValue {
  const value = useContext(ColoringEnhanceContext);
  if (!value) throw new Error('useColoringEnhance must be used inside ColoringEnhanceProvider');
  return value;
}
