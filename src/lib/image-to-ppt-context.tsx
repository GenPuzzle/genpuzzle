'use client';

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useApp } from '@/lib/app-context';
import type { DocumentPage, TextModuleSettings } from '@/lib/document-model';
import type {
  DetectionKind,
  ImageToPptDetection,
  ImageToPptJobProgress,
  ImageToPptPage,
} from '@/lib/image-to-ppt/types';
import { IMAGE_TO_PPT_MAX_PROCESS_EDGE } from '@/lib/image-to-ppt/types';
import { createLocalId, fileStem, isSupportedImageFile, yieldToUi } from '@/lib/image-to-ppt/geometry';
import { canvasFromBlob, decodeImageFile, canvasToDataUrl, imageDataToCanvas } from '@/lib/image-to-ppt/image-decode';
import { analyzeBackground } from '@/lib/image-to-ppt/background';
import { detectPageContent, materializeDetections, mergeGraphicDetections, prepareCleanedArtwork, splitGraphicDetection } from '@/lib/image-to-ppt/pipeline';
import {
  applyReconstructionToPage,
  createBlankConversionPage,
  makeFullPageImageBlock,
} from '@/lib/image-to-ppt/reconstruct';
import { exportImageToPptx } from '@/lib/image-to-ppt/export-pptx';
import { downloadSvgAssetsZip } from '@/lib/image-to-ppt/export-svg-zip';
import { copyBlob, deletePageBlobs, getBlob, putBlob } from '@/lib/image-to-ppt/storage';

interface ImageToPptContextValue {
  pages: ImageToPptPage[];
  documentPages: DocumentPage[];
  activePageId: string | null;
  activePage: ImageToPptPage | null;
  activeDocumentPage: DocumentPage | null;
  selectedBlockId: string | null;
  selectedDetectionIds: string[];
  reviewMode: boolean;
  showMargins: boolean;
  showSafetyZone: boolean;
  previewZoom: number;
  job: ImageToPptJobProgress;
  setPreviewZoom: (value: number) => void;
  setShowMargins: (value: boolean) => void;
  setShowSafetyZone: (value: boolean) => void;
  setActivePageId: (id: string) => void;
  selectBlock: (id: string | null) => void;
  selectDetection: (id: string, additive?: boolean) => void;
  setReviewMode: (value: boolean) => void;
  uploadFiles: (files: FileList | File[], replace?: boolean) => Promise<void>;
  addMoreImages: (files: FileList | File[]) => Promise<void>;
  reorderPages: (from: number, to: number) => void;
  deletePage: (id: string) => void;
  duplicatePage: (id: string) => Promise<void>;
  resetPage: (id: string) => Promise<void>;
  detectContent: () => Promise<void>;
  convertToEditable: () => Promise<void>;
  updateDetection: (id: string, patch: Partial<ImageToPptDetection>) => void;
  setDetectionKind: (id: string, kind: DetectionKind) => void;
  mergeSelectedGraphics: () => void;
  splitSelectedGraphic: () => void;
  updateActiveTextSettings: (
    updates:
      | Partial<TextModuleSettings>
      | ((prev: TextModuleSettings) => Partial<TextModuleSettings>)
  ) => void;
  deleteActiveBlock: (blockId: string) => void;
  toggleKeepBackground: (id: string, value: boolean) => void;
  exportPptx: () => Promise<void>;
  downloadSvgZip: () => Promise<void>;
}

const ImageToPptContext = createContext<ImageToPptContextValue | null>(null);

function revokeUrl(url?: string) {
  if (url && url.startsWith('blob:')) URL.revokeObjectURL(url);
}

function pageWithOriginalImage(
  name: string,
  previewUrl: string,
  width: number,
  height: number
): DocumentPage {
  const page = createBlankConversionPage(name);
  const settings = page.settings as TextModuleSettings;
  settings.blocks = [makeFullPageImageBlock(previewUrl, width, height)];
  return page;
}

export function ImageToPptProvider({ children }: { children: React.ReactNode }) {
  const { wordSearchSettings } = useApp();
  const [pages, setPages] = useState<ImageToPptPage[]>([]);
  const [documentPages, setDocumentPages] = useState<DocumentPage[]>([]);
  const [activePageId, setActivePageId] = useState<string | null>(null);
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  const [selectedDetectionIds, setSelectedDetectionIds] = useState<string[]>([]);
  const [reviewMode, setReviewMode] = useState(false);
  const [showMargins, setShowMargins] = useState(true);
  const [showSafetyZone, setShowSafetyZone] = useState(true);
  const [previewZoom, setPreviewZoom] = useState(80);
  const [job, setJob] = useState<ImageToPptJobProgress>({
    active: false,
    current: 0,
    total: 0,
    pageName: '',
    stageLabel: '',
    failedPageIds: [],
  });
  const pagesRef = useRef(pages);
  pagesRef.current = pages;

  const activePage = pages.find((page) => page.id === activePageId) ?? null;
  const activeDocumentPage = documentPages.find((page) => page.id === activePageId) ?? null;

  useEffect(() => {
    return () => {
      pages.forEach((page) => {
        revokeUrl(page.thumbnailUrl);
        revokeUrl(page.previewUrl);
      });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const ingestFiles = useCallback(async (files: FileList | File[]) => {
    const list = Array.from(files).filter(isSupportedImageFile);
    const createdPages: ImageToPptPage[] = [];
    const createdDocs: DocumentPage[] = [];
    for (const file of list) {
      const decoded = await decodeImageFile(file);
      const id = createLocalId('page');
      const name = fileStem(file.name);
      try {
        await putBlob('originals', id, decoded.originalBlob);
        await putBlob('previews', id, decoded.previewBlob);
        await putBlob('thumbnails', id, decoded.thumbnailBlob);
      } catch {
        /* private mode fallback: object URLs still work from the blobs in memory */
      }
      const thumbnailUrl = URL.createObjectURL(decoded.thumbnailBlob);
      const previewUrl = URL.createObjectURL(decoded.previewBlob);
      const doc = pageWithOriginalImage(name, previewUrl, decoded.width, decoded.height);
      doc.id = id;
      createdPages.push({
        id,
        name,
        fileName: file.name,
        createdAt: Date.now(),
        status: 'uploaded',
        stage: 'idle',
        stageLabel: 'Uploaded',
        sourceWidth: decoded.width,
        sourceHeight: decoded.height,
        thumbnailUrl,
        previewUrl,
        detections: [],
        keepRasterBackground: false,
      });
      createdDocs.push(doc);
      await yieldToUi();
    }
    return { createdPages, createdDocs };
  }, []);

  const uploadFiles = useCallback(
    async (files: FileList | File[], replace = true) => {
      const { createdPages, createdDocs } = await ingestFiles(files);
      if (!createdPages.length) return;
      setPages((prev) => {
        if (replace) prev.forEach((page) => {
          revokeUrl(page.thumbnailUrl);
          revokeUrl(page.previewUrl);
        });
        return replace ? createdPages : [...prev, ...createdPages];
      });
      setDocumentPages((prev) => (replace ? createdDocs : [...prev, ...createdDocs]));
      setActivePageId((current) => {
        if (replace || !current) return createdPages[0]?.id ?? null;
        return current;
      });
      setSelectedBlockId(null);
    },
    [ingestFiles]
  );

  const addMoreImages = useCallback(
    async (files: FileList | File[]) => {
      await uploadFiles(files, false);
    },
    [uploadFiles]
  );

  const reorderPages = useCallback((from: number, to: number) => {
    setPages((prev) => {
      const next = [...prev];
      const [item] = next.splice(from, 1);
      next.splice(to, 0, item);
      return next;
    });
    setDocumentPages((prev) => {
      const next = [...prev];
      const [item] = next.splice(from, 1);
      next.splice(to, 0, item);
      return next;
    });
  }, []);

  const deletePage = useCallback((id: string) => {
    setPages((prev) => {
      const target = prev.find((page) => page.id === id);
      if (target) {
        revokeUrl(target.thumbnailUrl);
        revokeUrl(target.previewUrl);
      }
      const remaining = prev.filter((page) => page.id !== id);
      setActivePageId((current) => {
        if (current !== id) return current;
        const index = prev.findIndex((page) => page.id === id);
        return remaining[Math.min(index, remaining.length - 1)]?.id ?? null;
      });
      return remaining;
    });
    setDocumentPages((prev) => prev.filter((page) => page.id !== id));
    void deletePageBlobs(id);
  }, []);

  const duplicatePage = useCallback(async (id: string) => {
    const page = pages.find((item) => item.id === id);
    const doc = documentPages.find((item) => item.id === id);
    if (!page || !doc) return;
    const newId = createLocalId('page');
    await copyBlob('originals', id, newId);
    await copyBlob('previews', id, newId);
    await copyBlob('thumbnails', id, newId);
    const previewBlob = await getBlob('previews', id);
    const thumbBlob = await getBlob('thumbnails', id);
    const thumbnailUrl = thumbBlob ? URL.createObjectURL(thumbBlob) : page.thumbnailUrl;
    const previewUrl = previewBlob ? URL.createObjectURL(previewBlob) : page.previewUrl;
    const clonedPage: ImageToPptPage = {
      ...page,
      id: newId,
      name: `${page.name} copy`,
      createdAt: Date.now(),
      thumbnailUrl,
      previewUrl,
      detections: page.detections.map((item) => ({ ...item, id: createLocalId('det') })),
    };
    const clonedDoc: DocumentPage = {
      ...JSON.parse(JSON.stringify(doc)),
      id: newId,
      name: clonedPage.name,
      createdAt: Date.now(),
    };
    setPages((prev) => {
      const index = prev.findIndex((item) => item.id === id);
      const next = [...prev];
      next.splice(index + 1, 0, clonedPage);
      return next;
    });
    setDocumentPages((prev) => {
      const index = prev.findIndex((item) => item.id === id);
      const next = [...prev];
      next.splice(index + 1, 0, clonedDoc);
      return next;
    });
  }, [pages, documentPages]);

  const resetPage = useCallback(async (id: string) => {
    const page = pages.find((item) => item.id === id);
    if (!page) return;
    const doc = pageWithOriginalImage(page.name, page.previewUrl, page.sourceWidth, page.sourceHeight);
    doc.id = id;
    setDocumentPages((prev) => prev.map((item) => (item.id === id ? doc : item)));
    setPages((prev) =>
      prev.map((item) =>
        item.id === id
          ? { ...item, status: item.detections.length ? 'review' : 'uploaded', error: undefined, stage: 'idle', stageLabel: 'Original restored' }
          : item
      )
    );
  }, [pages]);

  const patchPage = useCallback((id: string, patch: Partial<ImageToPptPage>) => {
    setPages((prev) => prev.map((page) => (page.id === id ? { ...page, ...patch } : page)));
  }, []);

  const runOnPages = useCallback(
    async (
      ids: string[],
      stageLabel: string,
      work: (page: ImageToPptPage, report: (label: string) => void) => Promise<void>
    ) => {
      const failed: string[] = [];
      setJob({ active: true, current: 0, total: ids.length, pageName: '', stageLabel, failedPageIds: [] });
      for (let i = 0; i < ids.length; i++) {
        const page = pagesRef.current.find((item) => item.id === ids[i]);
        if (!page) continue;
        setJob((prev) => ({
          ...prev,
          current: i + 1,
          pageName: page.name,
          stageLabel,
        }));
        try {
          await work(page, (label) => {
            setJob((prev) => ({ ...prev, stageLabel: label }));
            patchPage(page.id, { stageLabel: label });
          });
        } catch (error) {
          failed.push(page.id);
          patchPage(page.id, {
            status: 'error',
            error: error instanceof Error ? error.message : 'Processing failed',
            stageLabel: 'Needs attention',
          });
        }
        await yieldToUi();
      }
      setJob({
        active: false,
        current: ids.length,
        total: ids.length,
        pageName: '',
        stageLabel: failed.length ? `Finished with ${failed.length} page(s) needing attention` : 'Done',
        failedPageIds: failed,
      });
    },
    [patchPage]
  );

  const detectContent = useCallback(async () => {
    const ids = pages.map((page) => page.id);
    await runOnPages(ids, 'Detecting content...', async (page, report) => {
      patchPage(page.id, { status: 'detecting', stage: 'detecting-text', stageLabel: 'Detecting text...' });
      const original = (await getBlob('originals', page.id)) ?? (await getBlob('previews', page.id));
      if (!original) throw new Error('Original image is missing');
      const canvas = await canvasFromBlob(original, IMAGE_TO_PPT_MAX_PROCESS_EDGE);
      const result = await detectPageContent(canvas, report);
      patchPage(page.id, {
        status: 'review',
        stage: 'idle',
        stageLabel: 'Review detections',
        detections: result.detections,
        background: result.background,
        keepRasterBackground: result.background.keepRasterBackground,
        processedWidth: result.processedWidth,
        processedHeight: result.processedHeight,
        error: undefined,
      });
    });
    setReviewMode(true);
  }, [pages, patchPage, runOnPages]);

  const convertToEditable = useCallback(async () => {
    const ids = pages.map((page) => page.id);
    await runOnPages(ids, 'Converting to editable...', async (page, report) => {
      const latest = pagesRef.current.find((item) => item.id === page.id);
      if (latest) {
        page = {
          ...page,
          detections: latest.detections.length ? latest.detections : page.detections,
          keepRasterBackground: latest.keepRasterBackground,
          background: latest.background ?? page.background,
        };
      }
      if (!page.detections.length) {
        report('Detecting content...');
        const original = (await getBlob('originals', page.id)) ?? (await getBlob('previews', page.id));
        if (!original) throw new Error('Original image is missing');
        const canvas = await canvasFromBlob(original, IMAGE_TO_PPT_MAX_PROCESS_EDGE);
        const result = await detectPageContent(canvas, report);
        page = {
          ...page,
          detections: result.detections,
          background: result.background,
          processedWidth: result.processedWidth,
          processedHeight: result.processedHeight,
          keepRasterBackground: result.background.keepRasterBackground,
        };
      }
      patchPage(page.id, { status: 'converting', stage: 'reconstructing', stageLabel: 'Reconstructing page...' });
      report('Reconstructing page...');
      const original = (await getBlob('originals', page.id)) ?? (await getBlob('previews', page.id));
      if (!original) throw new Error('Original image is missing');
      const canvas = await canvasFromBlob(original, IMAGE_TO_PPT_MAX_PROCESS_EDGE);
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) throw new Error('Canvas is not available');
      const source = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const bg = page.background ?? analyzeBackground(source);
      const textBoxes = page.detections.filter((item) => item.kind === 'text').map((item) => item.bbox);
      report('Removing original text...');
      const cleaned = prepareCleanedArtwork(source, textBoxes, bg.color);
      report('Vectorizing graphics...');
      const materialized = materializeDetections(cleaned, page.detections, bg);
      let backgroundImage: string | undefined;
      if (page.keepRasterBackground) {
        backgroundImage = canvasToDataUrl(imageDataToCanvas(cleaned), 'image/jpeg', 0.82);
      }
      setDocumentPages((prev) =>
        prev.map((doc) => {
          if (doc.id !== page.id) return doc;
          return applyReconstructionToPage(doc, materialized, canvas.width, canvas.height, wordSearchSettings, {
            backgroundColor: bg.isNearWhite ? '#ffffff' : bg.hex,
            backgroundImage,
            keepRasterBackground: page.keepRasterBackground,
          });
        })
      );
      patchPage(page.id, {
        status: 'ready',
        stage: 'idle',
        stageLabel: 'Editable page ready',
        detections: materialized,
        background: bg,
        error: undefined,
      });
    });
    setReviewMode(false);
  }, [pages, patchPage, runOnPages, wordSearchSettings]);

  const updateDetection = useCallback((id: string, patch: Partial<ImageToPptDetection>) => {
    if (!activePageId) return;
    setPages((prev) =>
      prev.map((page) =>
        page.id === activePageId
          ? { ...page, detections: page.detections.map((item) => (item.id === id ? { ...item, ...patch } : item)) }
          : page
      )
    );
  }, [activePageId]);

  const setDetectionKind = useCallback((id: string, kind: DetectionKind) => {
    updateDetection(id, { kind });
  }, [updateDetection]);

  const mergeSelectedGraphics = useCallback(() => {
    if (!activePageId || selectedDetectionIds.length < 2) return;
    setPages((prev) =>
      prev.map((page) =>
        page.id === activePageId
          ? { ...page, detections: mergeGraphicDetections(page.detections, selectedDetectionIds) }
          : page
      )
    );
    setSelectedDetectionIds([]);
  }, [activePageId, selectedDetectionIds]);

  const splitSelectedGraphic = useCallback(() => {
    if (!activePageId || selectedDetectionIds.length !== 1) return;
    setPages((prev) =>
      prev.map((page) =>
        page.id === activePageId
          ? { ...page, detections: splitGraphicDetection(page.detections, selectedDetectionIds[0]) }
          : page
      )
    );
    setSelectedDetectionIds([]);
  }, [activePageId, selectedDetectionIds]);

  const updateActiveTextSettings = useCallback(
    (
      updates:
        | Partial<TextModuleSettings>
        | ((prev: TextModuleSettings) => Partial<TextModuleSettings>)
    ) => {
      if (!activePageId) return;
      setDocumentPages((prev) =>
        prev.map((page) => {
          if (page.id !== activePageId) return page;
          const current = page.settings as TextModuleSettings;
          const patch = typeof updates === 'function' ? updates(current) : updates;
          return { ...page, settings: { ...current, ...patch } };
        })
      );
    },
    [activePageId]
  );

  const deleteActiveBlock = useCallback((blockId: string) => {
    updateActiveTextSettings((prev) => ({
      blocks: (prev.blocks ?? []).filter((block) => block.id !== blockId),
    }));
    setSelectedBlockId(null);
  }, [updateActiveTextSettings]);

  const toggleKeepBackground = useCallback((id: string, value: boolean) => {
    patchPage(id, { keepRasterBackground: value });
  }, [patchPage]);

  const exportPptx = useCallback(async () => {
    if (!documentPages.length) return;
    setJob({
      active: true,
      current: 0,
      total: documentPages.length,
      pageName: '',
      stageLabel: 'Exporting PPTX...',
      failedPageIds: [],
    });
    try {
      await exportImageToPptx(documentPages, wordSearchSettings, 'image-to-editable.pptx');
      setJob((prev) => ({ ...prev, active: false, stageLabel: 'PPTX downloaded' }));
    } catch (error) {
      setJob((prev) => ({
        ...prev,
        active: false,
        stageLabel: error instanceof Error ? error.message : 'PPTX export failed',
      }));
    }
  }, [documentPages, wordSearchSettings]);

  const downloadSvgZip = useCallback(async () => {
    const detectionsByPageId = Object.fromEntries(pages.map((page) => [page.id, page.detections]));
    await downloadSvgAssetsZip(documentPages, detectionsByPageId);
  }, [documentPages, pages]);

  const selectDetection = useCallback((id: string, additive = false) => {
    setSelectedDetectionIds((prev) => {
      if (!additive) return [id];
      return prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id];
    });
  }, []);

  const value = useMemo<ImageToPptContextValue>(
    () => ({
      pages,
      documentPages,
      activePageId,
      activePage,
      activeDocumentPage,
      selectedBlockId,
      selectedDetectionIds,
      reviewMode,
      showMargins,
      showSafetyZone,
      previewZoom,
      job,
      setPreviewZoom,
      setShowMargins,
      setShowSafetyZone,
      setActivePageId: (id) => {
        setActivePageId(id);
        setSelectedBlockId(null);
        setSelectedDetectionIds([]);
      },
      selectBlock: setSelectedBlockId,
      selectDetection,
      setReviewMode,
      uploadFiles,
      addMoreImages,
      reorderPages,
      deletePage,
      duplicatePage,
      resetPage,
      detectContent,
      convertToEditable,
      updateDetection,
      setDetectionKind,
      mergeSelectedGraphics,
      splitSelectedGraphic,
      updateActiveTextSettings,
      deleteActiveBlock,
      toggleKeepBackground,
      exportPptx,
      downloadSvgZip,
    }),
    [
      pages,
      documentPages,
      activePageId,
      activePage,
      activeDocumentPage,
      selectedBlockId,
      selectedDetectionIds,
      reviewMode,
      showMargins,
      showSafetyZone,
      previewZoom,
      job,
      selectDetection,
      uploadFiles,
      addMoreImages,
      reorderPages,
      deletePage,
      duplicatePage,
      resetPage,
      detectContent,
      convertToEditable,
      updateDetection,
      setDetectionKind,
      mergeSelectedGraphics,
      splitSelectedGraphic,
      updateActiveTextSettings,
      deleteActiveBlock,
      toggleKeepBackground,
      exportPptx,
      downloadSvgZip,
    ]
  );

  return <ImageToPptContext.Provider value={value}>{children}</ImageToPptContext.Provider>;
}

export function useImageToPpt() {
  const ctx = useContext(ImageToPptContext);
  if (!ctx) throw new Error('useImageToPpt must be used inside ImageToPptProvider');
  return ctx;
}
