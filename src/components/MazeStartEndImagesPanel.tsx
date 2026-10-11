'use client';

import React, { useEffect, useRef, useState } from 'react';
import JSZip from 'jszip';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { SliderField } from '@/components/ui/slider-field';
import { SettingsTextInput } from '@/components/ui/settings-text-input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { MazeStartEndDescriptionsEditor } from '@/components/MazeStartEndDescriptionsEditor';
import { SpriteSheetImporter } from '@/components/SpriteSheetImporter';
import { useApp } from '@/lib/app-context';
import { generateImage, onImageGenerated } from '@/lib/genpuzzle-extension-integration';
import {
  defaultMixedMazeLevelCounts,
  defaultMixedMazeShapeCounts,
  type GenericPuzzleSettings,
} from '@/lib/generic-puzzle-settings';
import { requestMazeImageDescriptions } from '@/lib/maze-start-end-ai';
import {
  buildMazeStartEndPrompt,
  buildMazeStartEndReferenceSheet,
  ensureMazeStartEndPairs,
  MAZE_IMAGE_SCALE_DEFAULT,
  MAZE_IMAGE_SCALE_MAX,
  MAZE_IMAGE_SCALE_MIN,
  MAZE_PAIRS_PER_SHEET,
  MAZE_START_END_STYLE_LABELS,
  mazeCountForUploadedSheets,
  mazeCountForReplacedSheets,
  mazeSheetIndexesForUploads,
  pairAddress,
  sheetCountForMazes,
  sheetSlots,
  slotIdFor,
  type MazeStartEndImagesSettings,
  type MazeStartEndMethod,
  type MazeStartEndPair,
  type MazeStartEndStyle,
} from '@/lib/maze-start-end-images';
import { downloadDataUrl } from '@/lib/murdoku-reference-sheet';
import { mazeImagePrintLongSidePx } from '@/lib/auto-enhance';
import { yieldToUi } from '@/lib/coloring-enhance';
import {
  DEFAULT_CROP_CONFIG,
  runSpriteSheetPipeline,
  type ExtractedAsset,
  type SpriteSheetCropConfig,
  type SpriteSheetItem,
} from '@/lib/sprite-sheet-importer';

type CorePatch = (patch: Partial<GenericPuzzleSettings['core']>) => void;

const ALL_SHEETS = 'all';

function downloadPng(dataUrl: string, filename: string) {
  const comma = dataUrl.indexOf(',');
  if (comma < 0) return;
  const binary = atob(dataUrl.slice(comma + 1));
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  const url = URL.createObjectURL(new Blob([bytes], { type: 'image/png' }));
  downloadDataUrl(url, filename);
  window.setTimeout(() => URL.revokeObjectURL(url), 4000);
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function srcToDataUrl(src: string): Promise<string> {
  if (src.startsWith('data:')) return Promise.resolve(src);
  return fetch(src)
    .then((response) => response.blob())
    .then(
      (blob) =>
        new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result || ''));
          reader.onerror = () => reject(reader.error);
          reader.readAsDataURL(blob);
        })
    );
}

function assignUploadedFiles(files: File[]): Array<{ index: number; file: File }> {
  const indexes = mazeSheetIndexesForUploads(files.map((file) => file.name));
  return files.map((file, index) => ({ index: indexes[index] ?? index, file }));
}

function compactRecord<T>(records: Record<number, T>, removed: number): Record<number, T> {
  const next: Record<number, T> = {};
  let write = 0;
  for (const key of Object.keys(records)
    .map(Number)
    .sort((a, b) => a - b)) {
    if (key === removed) continue;
    next[write] = records[key];
    write += 1;
  }
  return next;
}

function clearPairArt(pair: MazeStartEndPair): MazeStartEndPair {
  return {
    ...pair,
    startImage: '',
    endImage: '',
    startSourceImage: '',
    endSourceImage: '',
    startWidth: 0,
    startHeight: 0,
    endWidth: 0,
    endHeight: 0,
    startAutoEnhanced: false,
    endAutoEnhanced: false,
    startSvg: '',
    endSvg: '',
  };
}

function revokeBlobUrl(src: string | undefined) {
  if (src?.startsWith('blob:')) URL.revokeObjectURL(src);
}

function enhancedSlotIdsForSheet(pairs: MazeStartEndPair[], sheetIndex: number): string[] {
  const ids: string[] = [];
  pairs.forEach((pair, index) => {
    const address = pairAddress(index);
    if (address.sheetIndex !== sheetIndex) return;
    if (pair.startAutoEnhanced) ids.push(slotIdFor(address.row, address.startCol));
    if (pair.endAutoEnhanced) ids.push(slotIdFor(address.row, address.endCol));
  });
  return ids;
}

function itemsForSheet(pairs: MazeStartEndPair[], sheetIndex: number): SpriteSheetItem[] {
  return sheetSlots(pairs, sheetIndex).map((slot) => ({
    slotId: slot.slotId,
    name: slot.description ? `${slot.subject}: ${slot.description}` : slot.subject,
  }));
}

function mazeQuantityPatch(
  count: number,
  core: GenericPuzzleSettings['core'],
  expandToOnePerPage: boolean
): Partial<GenericPuzzleSettings['core']> {
  const patch: Partial<GenericPuzzleSettings['core']> = { numberOfPuzzles: count };
  if (expandToOnePerPage) patch.puzzlesPerPage = 1;
  if (core.mazeSize === 'mixed') {
    const counts = defaultMixedMazeLevelCounts(count);
    patch.mazeMixedEasyCount = counts.easy;
    patch.mazeMixedMediumCount = counts.medium;
    patch.mazeMixedHardCount = counts.hard;
    patch.numberOfPuzzles = counts.easy + counts.medium + counts.hard;
  }
  if (core.mazeShape === 'mixed') {
    const shapes = defaultMixedMazeShapeCounts(patch.numberOfPuzzles ?? count);
    patch.mazeMixedShapeSquare = shapes.square;
    patch.mazeMixedShapeCircle = shapes.circle;
    patch.mazeMixedShapeDiamond = shapes.diamond;
    patch.mazeMixedShapeHexagon = shapes.hexagon;
    patch.mazeMixedShapeTriangle = shapes.triangle;
    patch.mazeMixedShapeCustomImage = shapes.custom_image;
    patch.numberOfPuzzles =
      shapes.square +
      shapes.circle +
      shapes.diamond +
      shapes.hexagon +
      shapes.triangle +
      shapes.custom_image;
  }
  return patch;
}

function assignCroppedPairs(
  source: MazeStartEndPair[],
  sheetIndex: number,
  assets: ExtractedAsset[]
): { pairs: MazeStartEndPair[]; missing: string[] } {
  const byId = new Map(assets.map((asset) => [asset.slotId, asset]));
  const missing: string[] = [];
  const pairs = source.map((pair, index) => {
    const address = pairAddress(index);
    if (address.sheetIndex !== sheetIndex) return pair;
    const startId = slotIdFor(address.row, address.startCol);
    const endId = slotIdFor(address.row, address.endCol);
    const start = byId.get(startId);
    const end = byId.get(endId);
    if (!start || start.blank) missing.push(startId);
    if (!end || end.blank) missing.push(endId);
    if (!start || !end || start.blank || end.blank) return pair;
    return {
      ...pair,
      startImage: start.dataUrl,
      endImage: end.dataUrl,
      startWidth: start.sourceWidth || start.width,
      startHeight: start.sourceHeight || start.height,
      endWidth: end.sourceWidth || end.width,
      endHeight: end.sourceHeight || end.height,
      startSourceImage: start.sourceDataUrl || start.dataUrl,
      endSourceImage: end.sourceDataUrl || end.dataUrl,
      startAutoEnhanced: start.autoEnhanced === true,
      endAutoEnhanced: end.autoEnhanced === true,
      startSvg: start.previewSvg || '',
      endSvg: end.previewSvg || '',
    };
  });
  return { pairs, missing };
}

async function requestGeneratedSheet(prompt: string): Promise<string> {
  return new Promise((resolve, reject) => {
    let settled = false;
    const timer = window.setTimeout(() => {
      if (settled) return;
      settled = true;
      stop();
      reject(new Error('Image generation timed out.'));
    }, 180000);
    const stop = onImageGenerated((message) => {
      if (settled || !message.imageData) return;
      settled = true;
      window.clearTimeout(timer);
      stop();
      const data = message.imageData;
      resolve(data.startsWith('data:') ? data : `data:image/png;base64,${data}`);
    });
    generateImage(prompt).catch((error: unknown) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      stop();
      reject(error instanceof Error ? error : new Error(String(error)));
    });
  });
}

export function MazeStartEndImagesPanel({
  images,
  mazeCount,
  patchCore,
}: {
  images: MazeStartEndImagesSettings;
  mazeCount: number;
  patchCore: CorePatch;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const addSheetRef = useRef<HTMLInputElement>(null);
  const imagesRef = useRef(images);
  const { generatePuzzle, genericBatchPuzzles, activeDocumentPageId, genericPuzzleSettings, setPreviewRangeMode } = useApp();
  const expandPreviewTo = useRef<number | null>(null);
  const placedWaitRef = useRef<{ target: number; resolve: () => void } | null>(null);
  const [sheetChoice, setSheetChoice] = useState(ALL_SHEETS);
  const [cropSheet, setCropSheet] = useState(0);
  const [busy, setBusy] = useState('');
  const [progress, setProgress] = useState<number | null>(null);
  const [importerOpen, setImporterOpen] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const themeDraft = useRef(images.theme);
  const [sheetSrcs, setSheetSrcs] = useState<Record<number, string>>(() => images.sheetSources ?? {});
  const sheetSrcsRef = useRef<Record<number, string>>(images.sheetSources ?? {});
  const [sheetCrops, setSheetCrops] = useState<Record<number, SpriteSheetCropConfig>>(
    () => images.sheetCrops ?? {}
  );
  const sheetCropsRef = useRef<Record<number, SpriteSheetCropConfig>>(images.sheetCrops ?? {});
  const cropSheetRef = useRef(0);
  const sheetAssetsRef = useRef<Record<number, ExtractedAsset[]>>({});
  cropSheetRef.current = cropSheet;
  const uploadedSheetCount = Object.keys(sheetSrcs).reduce((max, key) => Math.max(max, Number(key) + 1), 0);
  const sheetCount = Math.max(
    sheetCountForMazes(images.enabled ? Math.max(images.pairs.length, mazeCount) : mazeCount),
    uploadedSheetCount
  );
  const allSheets = sheetChoice === ALL_SHEETS;
  const selectedSheet = Math.min(
    Math.max(0, allSheets ? 0 : Number(sheetChoice) || 0),
    Math.max(0, sheetCount - 1)
  );
  const cropItems = sheetSlots(images.pairs, cropSheet).map((slot) => ({
    slotId: slot.slotId,
    name: slot.description ? `${slot.subject}: ${slot.description}` : slot.subject,
  }));

  const patchImages = (next: MazeStartEndImagesSettings) => {
    patchCore({ mazeStartEndImages: next });
  };

  useEffect(() => {
    imagesRef.current = images;
  }, [images]);

  useEffect(() => {
    sheetSrcsRef.current = sheetSrcs;
  }, [sheetSrcs]);

  useEffect(() => {
    if (importerOpen) return;
    const sources = images.sheetSources ?? {};
    setSheetSrcs((current) => {
      const same =
        Object.keys(sources).length === Object.keys(current).length &&
        Object.keys(sources).every((key) => current[Number(key)] === sources[Number(key)]);
      if (same) return current;
      for (const src of Object.values(current)) {
        if (src.startsWith('blob:') && !Object.values(sources).includes(src)) revokeBlobUrl(src);
      }
      return { ...sources };
    });
    const crops = images.sheetCrops ?? {};
    sheetCropsRef.current = crops;
    setSheetCrops(crops);
  }, [images.sheetCrops, images.sheetSources, importerOpen]);

  useEffect(() => {
    themeDraft.current = images.theme;
  }, [images.theme]);

  useEffect(() => {
    if (!images.enabled) return;
    const next = ensureMazeStartEndPairs(images.pairs, images.theme, mazeCount);
    if (next !== images.pairs) patchImages({ ...images, pairs: next });
    // patchImages is stable enough for this settings object; the guard prevents a loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [images.enabled, images.pairs, images.theme, mazeCount]);

  useEffect(() => {
    const target = placedWaitRef.current?.target ?? expandPreviewTo.current;
    if (target == null || mazeCount < target) return;
    const existing = genericBatchPuzzles.filter(
      (puzzle) => puzzle.pageId === activeDocumentPageId && puzzle.type === 'maze'
    ).length;
    if (existing < target) {
      if (expandPreviewTo.current != null) {
        expandPreviewTo.current = null;
        void generatePuzzle();
      }
      return;
    }
    expandPreviewTo.current = null;
    placedWaitRef.current?.resolve();
    placedWaitRef.current = null;
  }, [mazeCount, genericBatchPuzzles, activeDocumentPageId, generatePuzzle]);

  const persistCropSettings = (sources?: Record<number, string>) => {
    const nextImages = {
      ...imagesRef.current,
      sheetCrops: { ...sheetCropsRef.current },
      sheetSources: sources ?? {
        ...(imagesRef.current.sheetSources ?? {}),
        ...sheetSrcsRef.current,
      },
    };
    imagesRef.current = nextImages;
    patchImages(nextImages);
  };

  const rememberSheets = (assigned: Array<{ index: number; file: File }>, mode: 'replace' | 'append' = 'append') => {
    if (assigned.length === 0) return;
    void (async () => {
      setBusy(mode === 'replace' ? 'Opening uploaded images…' : 'Adding sheets…');
      try {
        const persisted: Record<number, string> =
          mode === 'replace' ? {} : { ...(imagesRef.current.sheetSources ?? {}) };
        const srcs: Record<number, string> = {};
        for (const item of assigned) {
          const dataUrl = await fileToDataUrl(item.file);
          srcs[item.index] = dataUrl;
          persisted[item.index] = dataUrl;
        }
        setSheetSrcs((current) => {
          if (mode === 'replace') {
            for (const src of Object.values(current)) revokeBlobUrl(src);
            return { ...srcs };
          }
          const next = { ...current };
          for (const item of assigned) {
            revokeBlobUrl(next[item.index]);
            next[item.index] = srcs[item.index];
          }
          return next;
        });
        setSheetCrops((current) => {
          if (mode === 'replace') {
            sheetAssetsRef.current = {};
            sheetCropsRef.current = {};
            return {};
          }
          const next = { ...current };
          for (const item of assigned) {
            delete next[item.index];
            delete sheetAssetsRef.current[item.index];
          }
          sheetCropsRef.current = next;
          return next;
        });
        const names = assigned.map((item) => item.file.name);
        const puzzleCount =
          mode === 'replace' ? mazeCountForReplacedSheets(names) : mazeCountForUploadedSheets(names, mazeCount);
        const basePairs =
          mode === 'replace'
            ? ensureMazeStartEndPairs(imagesRef.current.pairs, imagesRef.current.theme, puzzleCount).map(clearPairArt)
            : ensureMazeStartEndPairs(imagesRef.current.pairs, imagesRef.current.theme, puzzleCount);
        const nextImages = {
          ...imagesRef.current,
          enabled: true,
          pairs: basePairs,
          sheetSources: persisted,
          sheetCrops: mode === 'replace' ? {} : { ...sheetCropsRef.current },
        };
        imagesRef.current = nextImages;
        const quantity = mazeQuantityPatch(basePairs.length, genericPuzzleSettings.core, puzzleCount > mazeCount);
        expandPreviewTo.current = quantity.numberOfPuzzles ?? basePairs.length;
        if (puzzleCount > mazeCount) setPreviewRangeMode('all');
        patchCore({
          ...quantity,
          mazeStartEndImages: nextImages,
        });
        setCropSheet(assigned[0].index);
        cropSheetRef.current = assigned[0].index;
        setImporterOpen(true);
        const pages =
          mode === 'replace'
            ? mazeCountForReplacedSheets(names)
            : mazeCountForUploadedSheets(names, mazeCount);
        toast.success(
          mode === 'replace'
            ? assigned.length === 1
              ? 'Sheet uploaded. Crop the images, then apply.'
              : `${assigned.length} sheets uploaded. Crop the images, then apply.`
            : assigned.length === 1
              ? `Sheet ${assigned[0].index + 1} uploaded. Crop the images, then apply.`
              : `${assigned.length} sheets uploaded. The preview will show ${pages} maze pages.`
        );
      } catch (error) {
        console.error(error);
        toast.error('Could not open the uploaded images.');
      } finally {
        setBusy('');
      }
    })();
  };

  const appendSheetFiles = (files: File[]) => {
    if (!files.length) return;
    const start = Object.keys(sheetSrcs).reduce((max, key) => Math.max(max, Number(key) + 1), 0);
    rememberSheets(
      files.map((file, index) => ({ index: start + index, file })),
      'append'
    );
  };

  const removeSheet = (index: number) => {
    if (!sheetSrcs[index]) return;
    revokeBlobUrl(sheetSrcs[index]);
    const nextSrcs = compactRecord(sheetSrcs, index);
    const nextCrops = compactRecord(sheetCropsRef.current, index);
    const nextAssets: Record<number, ExtractedAsset[]> = {};
    let write = 0;
    for (const key of Object.keys(sheetAssetsRef.current)
      .map(Number)
      .sort((a, b) => a - b)) {
      if (key === index) continue;
      nextAssets[write] = sheetAssetsRef.current[key];
      write += 1;
    }
    sheetAssetsRef.current = nextAssets;
    sheetCropsRef.current = nextCrops;
    setSheetSrcs(nextSrcs);
    setSheetCrops(nextCrops);
    const keptPairs = imagesRef.current.pairs.filter((_, pairIndex) => pairAddress(pairIndex).sheetIndex !== index);
    const puzzleCount = Math.max(Object.keys(nextSrcs).length * MAZE_PAIRS_PER_SHEET, keptPairs.length);
    const pairs = ensureMazeStartEndPairs(keptPairs, imagesRef.current.theme, puzzleCount);
    const nextImages = {
      ...imagesRef.current,
      pairs,
      sheetSources: compactRecord(imagesRef.current.sheetSources ?? {}, index),
      sheetCrops: nextCrops,
    };
    imagesRef.current = nextImages;
    const quantity = mazeQuantityPatch(pairs.length, genericPuzzleSettings.core, false);
    patchCore({
      ...quantity,
      mazeStartEndImages: nextImages,
    });
    const remaining = Object.keys(nextSrcs)
      .map(Number)
      .sort((a, b) => a - b);
    if (!remaining.length) {
      setImporterOpen(false);
      toast.success('Sheet removed');
      return;
    }
    const nextActive = Math.min(index, remaining.length - 1);
    cropSheetRef.current = nextActive;
    setCropSheet(nextActive);
    toast.success('Sheet removed');
  };

  const applyTheme = async () => {
    const theme = themeDraft.current.trim();
    if (!theme) {
      toast.error('Enter a theme, then click Apply.');
      return;
    }
    const base = ensureMazeStartEndPairs(images.pairs, theme, mazeCount);
    let next = base.map((pair) => ({ ...pair }));
    const avoid: string[] = [];
    setBusy('Writing image descriptions...');
    setProgress(0);
    try {
      for (let index = 0; index < sheetCount; index++) {
        setBusy(`Writing descriptions for sheet ${index + 1} of ${sheetCount}...`);
        setProgress(Math.round((index / sheetCount) * 100));
        const targets = next
          .slice(index * 10, index * 10 + 10)
          .map((pair, localIndex) => ({ pair, localIndex }))
          .filter(({ pair }) => !pair.startImage && !pair.endImage);
        if (targets.length === 0) continue;
        const described = await requestMazeImageDescriptions({
          theme,
          style: images.style,
          sheetIndex: index,
          sheetCount,
          count: targets.length,
          avoid,
        });
        targets.forEach(({ localIndex }, resultIndex) => {
          const row = described[resultIndex];
          const mazeIndex = index * 10 + localIndex;
          const current = next[mazeIndex];
          if (!current || !row) return;
          next[mazeIndex] = {
            ...current,
            startSubject: row.startSubject,
            endSubject: row.endSubject,
            startDescription: row.startDescription,
            endDescription: row.endDescription,
          };
          avoid.push(row.startSubject, row.endSubject);
        });
      }
      setProgress(100);
      patchImages({ ...images, theme, pairs: next, issues: [] });
      toast.success('Image descriptions are ready for every sheet');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not write the image descriptions.');
    } finally {
      setBusy('');
      setProgress(null);
    }
  };

  const downloadSheet = async () => {
    const indexes = allSheets ? Array.from({ length: sheetCount }, (_, index) => index) : [selectedSheet];
    if (indexes.length > 2) {
      const zip = new JSZip();
      let added = 0;
      for (const index of indexes) {
        const png = buildMazeStartEndReferenceSheet(images.pairs, index, sheetCount);
        const comma = png.indexOf(',');
        if (!png || comma < 0) continue;
        zip.file(`maze-start-end-sheet-${index + 1}.png`, png.slice(comma + 1), { base64: true });
        added += 1;
      }
      if (!added) {
        toast.error('Could not build the reference sheets.');
        return;
      }
      const blob = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(blob);
      downloadDataUrl(url, 'maze-start-end-reference-sheets.zip');
      window.setTimeout(() => URL.revokeObjectURL(url), 4000);
      toast.success(`Downloaded all ${added} reference sheets`);
      return;
    }
    let added = 0;
    for (const index of indexes) {
      const png = buildMazeStartEndReferenceSheet(images.pairs, index, sheetCount);
      if (!png) continue;
      downloadPng(png, `maze-start-end-sheet-${index + 1}.png`);
      added += 1;
    }
    if (!added) {
      toast.error(indexes.length > 1 ? 'Could not build the reference sheets.' : 'Could not build the reference sheet.');
      return;
    }
    if (added > 1) toast.success(`Downloaded all ${added} reference sheets`);
  };

  const copyPrompt = async () => {
    const indexes = allSheets ? Array.from({ length: sheetCount }, (_, index) => index) : [selectedSheet];
    const text = indexes
      .map((index) => {
        const prompt = buildMazeStartEndPrompt({
          theme: images.theme,
          style: images.style,
          sheetIndex: index,
          sheetCount,
          pairs: images.pairs,
        });
        return indexes.length > 1 ? `Sheet ${index + 1} of ${sheetCount}\n${prompt}` : prompt;
      })
      .join('\n\n');
    await navigator.clipboard.writeText(text);
    toast.success(indexes.length > 1 ? 'Prompts for all sheets copied' : 'Prompt copied');
  };

  const generateWithAi = async () => {
    setBusy('Generating sheet 1...');
    try {
      const generated: Record<number, string> = {};
      for (let index = 0; index < sheetCount; index++) {
        setBusy(`Generating sheet ${index + 1} of ${sheetCount}...`);
        const prompt = buildMazeStartEndPrompt({
          theme: images.theme,
          style: images.style,
          sheetIndex: index,
          sheetCount,
          pairs: images.pairs,
        });
        const src = await requestGeneratedSheet(prompt);
        generated[index] = src;
        setSheetSrcs((current) => ({ ...current, [index]: src }));
      }
      const nextImages = {
        ...imagesRef.current,
        enabled: true,
        sheetSources: { ...(imagesRef.current.sheetSources ?? {}), ...generated },
      };
      imagesRef.current = nextImages;
      patchImages(nextImages);
      setSheetCrops({});
      sheetCropsRef.current = {};
      sheetAssetsRef.current = {};
      setCropSheet(0);
      cropSheetRef.current = 0;
      setImporterOpen(true);
      toast.success('Sheets are ready. Adjust the crop boxes, then apply them.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not generate the sheet.');
    } finally {
      setBusy('');
    }
  };

  const descriptionsReady =
    images.pairs.length >= mazeCount &&
    images.pairs.slice(0, mazeCount).every((pair) => pair.startDescription.trim() && pair.endDescription.trim());
  const sheetActionsReady = descriptionsReady && progress == null;
  const availableSheets = { ...(images.sheetSources ?? {}), ...sheetSrcs };
  const canEditCrops = Object.keys(availableSheets).some((key) => Boolean(availableSheets[Number(key)]));

  const openCropEditor = () => {
    const sources = { ...(images.sheetSources ?? {}), ...sheetSrcs };
    if (!Object.keys(sources).length) return;
    setSheetSrcs(sources);
    const index = allSheets
      ? Number(Object.keys(sources).sort((a, b) => Number(a) - Number(b))[0])
      : sources[selectedSheet]
        ? selectedSheet
        : Number(Object.keys(sources).sort((a, b) => Number(a) - Number(b))[0]);
    const merged = { ...(images.sheetCrops ?? {}), ...sheetCropsRef.current };
    sheetCropsRef.current = merged;
    setSheetCrops(merged);
    cropSheetRef.current = index;
    setCropSheet(index);
    setImporterOpen(true);
  };

  return (
    <div className="space-y-3 rounded-md border border-slate-200 p-3">
      <label className="flex items-center gap-2 text-sm font-medium">
        <Checkbox
          checked={images.enabled}
          onCheckedChange={(checked) => {
            const enabled = checked === true;
            const pairs = enabled ? ensureMazeStartEndPairs(images.pairs, images.theme, mazeCount) : images.pairs;
            patchImages({ ...images, enabled, pairs });
          }}
        />
        Add Start & End Images
      </label>
      {images.enabled ? (
        <>
          <div className="space-y-2 rounded-md border border-slate-200 bg-slate-50 p-2">
            <div className="flex flex-wrap items-center gap-2">
              <Button type="button" size="sm" onClick={() => fileRef.current?.click()} disabled={!!busy}>
                Upload all images
              </Button>
              {canEditCrops ? (
                <Button type="button" size="sm" variant="outline" onClick={openCropEditor} disabled={!!busy}>
                  Edit cropping
                </Button>
              ) : null}
            </div>
            <p className="text-[11px] text-slate-500">
              10 pairs per sheet. Uploading opens Edit cropping. Use Enhance images in that window, then Apply to place them on the maze pages.
            </p>
          </div>
          <div className="space-y-1">
            <Label className="text-sm font-medium">Theme</Label>
            <div className="flex gap-2">
              <SettingsTextInput
                value={images.theme}
                onChange={(theme) => {
                  themeDraft.current = theme;
                  patchImages({ ...images, theme });
                }}
                placeholder="forest animals"
              />
              <Button type="button" size="sm" onClick={() => void applyTheme()} disabled={!!busy}>
                Apply
              </Button>
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-sm font-medium">Drawing style</Label>
            <Select
              value={images.style}
              onValueChange={(value) => patchImages({ ...images, style: value as MazeStartEndStyle })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(MAZE_START_END_STYLE_LABELS) as MazeStartEndStyle[]).map((style) => (
                  <SelectItem key={style} value={style}>
                    {MAZE_START_END_STYLE_LABELS[style]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-sm font-medium">Creation method</Label>
            <Select
              value={images.method}
              onValueChange={(value) => patchImages({ ...images, method: value as MazeStartEndMethod })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="manual">Manual / External AI</SelectItem>
                <SelectItem value="ai">Generate with AI</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <SliderField
            label="Image size"
            value={images.imageScalePercent ?? MAZE_IMAGE_SCALE_DEFAULT}
            onValueChange={(value) => patchImages({ ...images, imageScalePercent: value })}
            min={MAZE_IMAGE_SCALE_MIN}
            max={MAZE_IMAGE_SCALE_MAX}
            format="percent"
          />
          <label className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={images.hideOnSolutions === true}
              onCheckedChange={(checked) => patchImages({ ...images, hideOnSolutions: checked === true })}
            />
            Hide images on solutions
          </label>
          <p className="text-[11px] text-slate-500">
            Solution pages use smaller start and end images. Turn this on to hide them there.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <Label className="text-xs text-slate-500">Sheet</Label>
            <Select value={allSheets ? ALL_SHEETS : String(selectedSheet)} onValueChange={setSheetChoice}>
              <SelectTrigger className="h-8 w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_SHEETS}>All sheets</SelectItem>
                {Array.from({ length: sheetCount }, (_, index) => (
                  <SelectItem key={index} value={String(index)}>
                    {index + 1} of {sheetCount}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <span className="text-[11px] text-slate-500">{mazeCount} mazes, 10 pairs per sheet</span>
          </div>
          {!sheetActionsReady && progress == null ? (
            <p className="text-[11px] text-slate-500">
              Click Apply to write a description for every image. Download and copy stay hidden until that finishes. Upload all images is always available.
            </p>
          ) : null}
          {progress != null ? (
            <div className="space-y-1">
              <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}>
                <div className="h-full rounded-full bg-sky-600 transition-all" style={{ width: `${progress}%` }} />
              </div>
              <p className="flex items-center gap-2 text-xs text-slate-600">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                {busy} {progress}%
              </p>
            </div>
          ) : null}
          {sheetActionsReady ? (
            <Button type="button" size="sm" variant="outline" onClick={() => setEditorOpen(true)}>
              Edit description
            </Button>
          ) : null}
          {sheetActionsReady && images.method === 'manual' ? (
            <div className="flex flex-wrap gap-2">
              <Button type="button" size="sm" onClick={() => void downloadSheet()} disabled={progress != null}>
                Download Reference Sheets
              </Button>
              <Button type="button" size="sm" variant="outline" onClick={() => void copyPrompt()} disabled={progress != null}>
                Copy AI Prompt
              </Button>
            </div>
          ) : null}
          {sheetActionsReady && images.method === 'ai' ? (
            <div className="flex flex-wrap gap-2">
              <Button type="button" size="sm" onClick={() => void generateWithAi()} disabled={progress != null || !!busy}>
                Generate with AI
              </Button>
            </div>
          ) : null}
          {busy && progress == null ? (
            <p className="flex items-center gap-2 text-xs text-slate-600">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              {busy}
            </p>
          ) : null}
          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/webp,image/jpeg"
            multiple
            className="hidden"
            onChange={(event) => {
              const files = Array.from(event.target.files ?? []);
              event.target.value = '';
              if (!files.length) return;
              rememberSheets(assignUploadedFiles(files), 'replace');
            }}
          />
          <input
            ref={addSheetRef}
            type="file"
            accept="image/png,image/webp,image/jpeg"
            multiple
            className="hidden"
            onChange={(event) => {
              const files = Array.from(event.target.files ?? []);
              event.target.value = '';
              if (!files.length) return;
              appendSheetFiles(files);
            }}
          />
          <p className="text-[11px] text-slate-500">
            Upload all images replaces previous sheets and opens Edit cropping. Each sheet is 4 columns by 5 rows and adds 10 maze pages. Columns 1–2 and 3–4 are start/end pairs.
          </p>
        </>
      ) : null}
      <MazeStartEndDescriptionsEditor
        open={editorOpen}
        onOpenChange={setEditorOpen}
        pairs={images.pairs}
        initialSheet={allSheets ? 0 : selectedSheet}
        onSave={(pairs) => {
          patchImages({ ...images, pairs });
          toast.success('Descriptions updated');
        }}
      />
      <SpriteSheetImporter
        open={importerOpen && !!sheetSrcs[cropSheet]}
        onOpenChange={(open) => {
          setImporterOpen(open);
          if (!open) persistCropSettings();
        }}
        kind="maze"
        items={cropItems}
        rows={5}
        columns={4}
        originalSrc={sheetSrcs[cropSheet] || ''}
        savedCrop={sheetCrops[cropSheet]}
        sheets={Array.from({ length: sheetCount }, (_, index) => index)
          .filter((index) => sheetSrcs[index])
          .map((index) => ({ index, label: `Sheet ${index + 1}` }))}
        activeSheet={cropSheet}
        closeOnApply={true}
        printLongSide={mazeImagePrintLongSidePx(images.imageScalePercent ?? MAZE_IMAGE_SCALE_DEFAULT)}
        initialEnhancedSlotIds={enhancedSlotIdsForSheet(images.pairs, cropSheet)}
        onAddSheets={() => addSheetRef.current?.click()}
        onRemoveSheet={removeSheet}
        onSheetSourceChange={(dataUrl) => {
          const from = cropSheetRef.current;
          setSheetSrcs((current) => ({ ...current, [from]: dataUrl }));
          const nextImages = {
            ...imagesRef.current,
            sheetSources: { ...(imagesRef.current.sheetSources ?? {}), [from]: dataUrl },
          };
          imagesRef.current = nextImages;
          patchImages(nextImages);
        }}
        onCropDraft={(crop, sheetAssets) => {
          const from = cropSheetRef.current;
          sheetCropsRef.current = { ...sheetCropsRef.current, [from]: crop };
          if (sheetAssets.length) sheetAssetsRef.current[from] = sheetAssets;
        }}
        onActiveSheetChange={(index, crop, sheetAssets) => {
          const from = cropSheetRef.current;
          if (crop) {
            sheetCropsRef.current = { ...sheetCropsRef.current, [from]: crop };
            if (sheetAssets.length) sheetAssetsRef.current[from] = sheetAssets;
            setSheetCrops(sheetCropsRef.current);
          }
          cropSheetRef.current = index;
          setCropSheet(index);
        }}
        onImport={async (assets, crop, reportProgress) => {
          const from = cropSheetRef.current;
          sheetCropsRef.current = { ...sheetCropsRef.current, [from]: crop };
          sheetAssetsRef.current[from] = assets;
          const ready = { ...sheetAssetsRef.current };
          const crops: Record<number, SpriteSheetCropConfig> = { ...sheetCropsRef.current };
          const indexes = Object.keys(sheetSrcs)
            .map(Number)
            .filter((index) => Boolean(sheetSrcs[index]))
            .sort((a, b) => a - b);
          const covered = indexes.length ? Math.max(...indexes) + 1 : 1;
          const puzzleCount = Math.max(mazeCount, covered * MAZE_PAIRS_PER_SHEET);
          let pairs = ensureMazeStartEndPairs(imagesRef.current.pairs, imagesRef.current.theme, puzzleCount);
          for (let step = 0; step < indexes.length; step += 1) {
            const index = indexes[step];
            reportProgress?.({ label: 'Preparing sheets', current: step + 1, total: Math.max(1, indexes.length + 1) });
            if (ready[index]?.length) continue;
            const src = sheetSrcs[index];
            if (!src) continue;
            const pipeline = await runSpriteSheetPipeline(
              src,
              itemsForSheet(pairs, index),
              4,
              5,
              'maze',
              { ...DEFAULT_CROP_CONFIG, ...(crops[index] ?? {}) }
            );
            ready[index] = pipeline.assets;
            crops[index] = pipeline.config;
          }
          sheetAssetsRef.current = ready;
          sheetCropsRef.current = crops;
          setSheetCrops(crops);
          const missingNotes: string[] = [];
          for (const index of indexes) {
            if (!ready[index]) continue;
            const assigned = assignCroppedPairs(pairs, index, ready[index]);
            pairs = assigned.pairs;
            if (assigned.missing.length) missingNotes.push(`Sheet ${index + 1}: ${assigned.missing.join(', ')}`);
          }
          pairs = ensureMazeStartEndPairs(pairs, imagesRef.current.theme, puzzleCount);
          const sheetSources: Record<number, string> = {};
          for (const index of indexes) {
            const src = sheetSrcs[index] || imagesRef.current.sheetSources?.[index];
            if (!src) continue;
            sheetSources[index] = await srcToDataUrl(src);
          }
          setSheetSrcs((current) => {
            const next: Record<number, string> = {};
            for (const index of indexes) next[index] = current[index] || sheetSources[index];
            return next;
          });
          const nextImages = {
            ...imagesRef.current,
            enabled: true,
            pairs,
            issues: [],
            sheetCrops: crops,
            sheetSources,
          };
          const quantity = mazeQuantityPatch(pairs.length, genericPuzzleSettings.core, puzzleCount > mazeCount);
          const needed = quantity.numberOfPuzzles ?? pairs.length;
          imagesRef.current = nextImages;
          expandPreviewTo.current = needed;
          if (puzzleCount > mazeCount) setPreviewRangeMode('all');
          reportProgress?.({ label: 'Placing images', current: indexes.length + 1, total: Math.max(1, indexes.length + 1) });
          patchCore({
            ...quantity,
            mazeStartEndImages: nextImages,
          });
          if (missingNotes.length) {
            toast.error(missingNotes.join(' · '));
            throw new Error('missing-crops');
          }
          const existing = genericBatchPuzzles.filter(
            (puzzle) => puzzle.pageId === activeDocumentPageId && puzzle.type === 'maze'
          ).length;
          if (mazeCount < needed || existing < needed) {
            await new Promise<void>((resolve) => {
              placedWaitRef.current = { target: needed, resolve };
              window.setTimeout(() => {
                if (placedWaitRef.current?.resolve === resolve) {
                  placedWaitRef.current = null;
                  resolve();
                }
              }, 90000);
            });
          } else {
            await yieldToUi();
          }
          toast.success(
            indexes.length > 1
              ? `Start and end images are on the maze pages for ${indexes.length} sheets.`
              : 'Start and end images are on the maze pages.'
          );
        }}
      />
    </div>
  );
}
