'use client';

import React, { useRef } from 'react';
import {
  Download,
  FileUp,
  Images,
  Loader2,
  Presentation,
  ScanSearch,
  Sparkles,
  SquareDashedMousePointer,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { IMAGE_TO_PPT_ACCEPT } from '@/lib/image-to-ppt/types';
import { useImageToPpt } from '@/lib/image-to-ppt-context';

export function ImageToPptToolbar() {
  const {
    pages,
    job,
    reviewMode,
    setReviewMode,
    uploadFiles,
    addMoreImages,
    detectContent,
    convertToEditable,
    downloadSvgZip,
    exportPptx,
  } = useImageToPpt();
  const uploadRef = useRef<HTMLInputElement>(null);
  const addRef = useRef<HTMLInputElement>(null);
  const busy = job.active;

  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 bg-white/90 px-3 py-2 dark:border-slate-700 dark:bg-slate-900/90">
      <input
        ref={uploadRef}
        type="file"
        accept={IMAGE_TO_PPT_ACCEPT}
        multiple
        className="hidden"
        onChange={(event) => {
          if (event.target.files?.length) void uploadFiles(event.target.files, true);
          event.target.value = '';
        }}
      />
      <input
        ref={addRef}
        type="file"
        accept={IMAGE_TO_PPT_ACCEPT}
        multiple
        className="hidden"
        onChange={(event) => {
          if (event.target.files?.length) void addMoreImages(event.target.files);
          event.target.value = '';
        }}
      />
      <Button type="button" size="sm" onClick={() => uploadRef.current?.click()} disabled={busy}>
        <FileUp className="h-3.5 w-3.5" />
        Upload Images
      </Button>
      <Button type="button" size="sm" variant="outline" onClick={() => addRef.current?.click()} disabled={busy}>
        <Images className="h-3.5 w-3.5" />
        Add More Images
      </Button>
      <Button type="button" size="sm" variant="outline" onClick={() => void detectContent()} disabled={busy || !pages.length}>
        <ScanSearch className="h-3.5 w-3.5" />
        Detect Content
      </Button>
      <Button
        type="button"
        size="sm"
        variant={reviewMode ? 'default' : 'outline'}
        onClick={() => setReviewMode(!reviewMode)}
        disabled={!pages.some((page) => page.detections.length)}
      >
        <SquareDashedMousePointer className="h-3.5 w-3.5" />
        Review Detection
      </Button>
      <Button type="button" size="sm" onClick={() => void convertToEditable()} disabled={busy || !pages.length}>
        <Sparkles className="h-3.5 w-3.5" />
        Convert to Editable
      </Button>
      <Button type="button" size="sm" variant="outline" onClick={() => void downloadSvgZip()} disabled={!pages.length}>
        <Download className="h-3.5 w-3.5" />
        Download SVG Assets
      </Button>
      <Button type="button" size="sm" variant="outline" onClick={() => void exportPptx()} disabled={!pages.length}>
        <Presentation className="h-3.5 w-3.5" />
        Export PPTX
      </Button>
      {busy && (
        <span className="ml-auto inline-flex items-center gap-2 text-xs font-semibold text-slate-600">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          {job.stageLabel}
        </span>
      )}
    </div>
  );
}
