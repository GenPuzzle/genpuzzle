'use client';

import React, { useRef } from 'react';
import {
  Download,
  FileUp,
  Image as ImageIcon,
  Minus,
  PenTool,
  Plus,
  Trash2,
  ZoomIn,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { COLORING_ENHANCE_ACCEPT } from '@/lib/coloring-enhance';
import { useColoringEnhance } from '@/lib/coloring-enhance-context';
import { ColoringEnhanceControls } from './ColoringEnhanceControls';
import { EnhanceProgressBar } from './EnhanceProgressBar';

export function ColoringEnhanceWorkspace() {
  const {
    items,
    selected,
    zoom,
    busy,
    progress,
    setZoom,
    selectItem,
    addFiles,
    removeItem,
    exportSelectedSvg,
    exportSelectedPng,
    exportSelectedPdf,
    exportZip,
  } = useColoringEnhance();
  const uploadRef = useRef<HTMLInputElement>(null);
  const showLoadingBar = busy;

  const onDrop = (event: React.DragEvent) => {
    event.preventDefault();
    if (event.dataTransfer.files?.length) void addFiles(event.dataTransfer.files);
  };

  return (
    <div className="gp-app-shell flex h-full min-h-0 flex-col bg-gradient-to-br from-[#F0F5F6] to-white dark:from-slate-950 dark:to-slate-900">
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 bg-white/90 px-3 py-2 dark:border-slate-700 dark:bg-slate-900/90">
        <input
          ref={uploadRef}
          type="file"
          accept={COLORING_ENHANCE_ACCEPT}
          multiple
          className="hidden"
          onChange={(event) => {
            if (event.target.files?.length) void addFiles(event.target.files);
            event.target.value = '';
          }}
        />
        <Button type="button" size="sm" variant="outline" onClick={() => uploadRef.current?.click()}>
          <FileUp className="h-3.5 w-3.5" />
          Upload images
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={exportSelectedSvg} disabled={!selected?.enhancedSvg}>
          <PenTool className="h-3.5 w-3.5" />
          SVG
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={() => void exportSelectedPng()} disabled={!selected?.enhancedSvg}>
          <ImageIcon className="h-3.5 w-3.5" />
          PNG
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => void exportSelectedPdf()}
          disabled={!selected?.enhancedSvg}
        >
          <Download className="h-3.5 w-3.5" />
          PDF
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={() => void exportZip()} disabled={!items.some((item) => item.enhancedSvg || item.enhancedPngUrl)}>
          <Download className="h-3.5 w-3.5" />
          Download all
        </Button>
        <span className="ml-auto text-xs text-slate-500">{items.length} image{items.length === 1 ? '' : 's'}</span>
      </div>
      {showLoadingBar ? (
        <EnhanceProgressBar
          label="Enhancing"
          current={progress?.current}
          total={progress?.total}
          busy={busy}
        />
      ) : null}

      <div className="flex min-h-0 flex-1">
        <aside className="flex w-[22rem] shrink-0 flex-col border-r border-slate-200 bg-white/90 dark:border-slate-800 dark:bg-slate-950/80">
          <div className="border-b border-slate-200 px-4 py-3">
            <div className="flex items-center gap-2">
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-700">
                <PenTool className="h-4 w-4" />
              </span>
              <div>
                <h1 className="text-sm font-bold text-slate-900 dark:text-white">Enhance Coloring Pages</h1>
                <p className="text-[11px] text-slate-500">Clean line art for print. Same drawing, smoother vectors.</p>
              </div>
            </div>
          </div>
          <ColoringEnhanceControls />
          <div className="min-h-0 flex-1 overflow-auto p-3">
            {items.length ? (
              <div className="grid grid-cols-2 gap-2">
                {items.map((item) => (
                  <div key={item.id} className="relative">
                    <button
                      type="button"
                      className={`gp-btn w-full cursor-pointer rounded-lg border p-1.5 text-left ${
                        selected?.id === item.id ? 'gp-btn-selected' : 'border-slate-200 bg-white'
                      }`}
                      onClick={() => selectItem(item.id)}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={item.originalUrl} alt={item.name} className="mx-auto h-20 w-full object-contain" />
                      <p className="mt-1 truncate text-[10px] font-semibold text-slate-700">{item.name}</p>
                      <p className="truncate text-[10px] text-slate-500">
                        {item.status === 'enhancing'
                          ? 'Enhancing…'
                          : item.quality
                            ? item.quality.label
                            : `${item.width}×${item.height}`}
                      </p>
                    </button>
                    <button
                      type="button"
                      className="gp-btn gp-icon-danger absolute right-1 top-1 flex h-5 w-5 cursor-pointer items-center justify-center"
                      aria-label={`Remove ${item.name}`}
                      onClick={() => removeItem(item.id)}
                    >
                      <Trash2 className="h-2.5 w-2.5" />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="px-1 text-xs leading-relaxed text-slate-500">
                Upload or drop PNG, JPG, WebP, or SVG coloring pages. Enhancement starts automatically.
              </p>
            )}
          </div>
        </aside>

        <section className="flex min-w-0 flex-1 flex-col" onDragOver={(event) => event.preventDefault()} onDrop={onDrop}>
          {!items.length ? (
            <button
              type="button"
              className="m-6 flex flex-1 cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-300 bg-white/70 px-6 text-center"
              onClick={() => uploadRef.current?.click()}
            >
              <PenTool className="h-10 w-10 text-slate-400" />
              <p className="mt-3 text-base font-semibold text-slate-800">Upload images</p>
              <p className="mt-1 max-w-md text-sm text-slate-500">
                Drop one image or a whole batch. GenPuzzle enhances them automatically and builds print-ready SVG and PNG files.
              </p>
            </button>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 bg-white/80 px-3 py-2">
                <p className="text-xs font-semibold text-slate-600">Drag the line to compare original and enhanced</p>
                <div className="ml-auto flex items-center gap-1">
                  <Button type="button" size="icon" variant="outline" className="h-8 w-8" onClick={() => setZoom(Math.max(0.5, zoom - 0.25))}>
                    <Minus className="h-3.5 w-3.5" />
                  </Button>
                  <span className="min-w-[3rem] text-center text-xs font-semibold text-slate-600">{Math.round(zoom * 100)}%</span>
                  <Button type="button" size="icon" variant="outline" className="h-8 w-8" onClick={() => setZoom(Math.min(6, zoom + 0.25))}>
                    <Plus className="h-3.5 w-3.5" />
                  </Button>
                  <Button type="button" size="xs" variant="outline" onClick={() => setZoom(1)}>
                    <ZoomIn className="h-3.5 w-3.5" />
                    Reset
                  </Button>
                </div>
              </div>

              <div className="min-h-0 flex-1 overflow-auto bg-slate-100 p-4">
                <PreviewPane />
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
}

function sizedSvg(svg: string, width: number, height: number, debug: boolean): string {
  const markup = debug ? svg.replace('</svg>', `${svgDebugMarks(svg)}</svg>`) : svg;
  if (/width=/.test(markup)) {
    return markup.replace(/\swidth="[^"]*"/, ` width="${width}"`).replace(/\sheight="[^"]*"/, ` height="${height}"`);
  }
  return markup.replace('<svg', `<svg width="${width}" height="${height}"`);
}

function svgDebugMarks(svg: string): string {
  const cubics = [...svg.matchAll(/C(-?[\d.]+) (-?[\d.]+) (-?[\d.]+) (-?[\d.]+) (-?[\d.]+) (-?[\d.]+)/g)];
  return cubics
    .map((match) => {
      const [, c1x, c1y, c2x, c2y, x, y] = match;
      return `<circle cx="${x}" cy="${y}" r="0.8" fill="#2563eb"/><circle cx="${c1x}" cy="${c1y}" r="0.5" fill="#d97706"/><circle cx="${c2x}" cy="${c2y}" r="0.5" fill="#d97706"/>`;
    })
    .join('');
}

function isVectorDebug(): boolean {
  return typeof window !== 'undefined' && /(?:\?|&)vectorDebug=1(?:&|$)/.test(window.location.search);
}

function VectorPreview({ svg, width, height, zoom }: { svg: string; width: number; height: number; zoom: number }) {
  const debug = isVectorDebug();
  const w = Math.max(1, width * zoom);
  const h = Math.max(1, height * zoom);
  return (
    <div>
      <div
        className="bg-white shadow [&_svg]:block [&_svg]:h-full [&_svg]:w-full"
        style={{ width: w, height: h }}
        dangerouslySetInnerHTML={{ __html: sizedSvg(svg, w, h, debug) }}
      />
      {debug ? (
        <p className="mt-2 text-[10px] font-semibold text-slate-500">
          Vector debug: blue = anchors, orange = Bézier handles. Green/red/blue difference and yellow gaps appear below.
        </p>
      ) : null}
    </div>
  );
}

function DebugRasterOverlays({
  originalUrl,
  enhancedUrl,
  width,
  height,
  zoom,
}: {
  originalUrl: string;
  enhancedUrl?: string;
  width: number;
  height: number;
  zoom: number;
}) {
  if (!isVectorDebug() || !enhancedUrl) return null;
  const w = Math.max(1, Math.round(width * zoom));
  const h = Math.max(1, Math.round(height * zoom));
  return (
    <div className="mt-4 flex flex-wrap gap-4">
      <DebugCanvas kind="difference" originalUrl={originalUrl} enhancedUrl={enhancedUrl} width={w} height={h} />
      <DebugCanvas kind="gaps" originalUrl={originalUrl} enhancedUrl={enhancedUrl} width={w} height={h} />
    </div>
  );
}

function DebugCanvas({
  kind,
  originalUrl,
  enhancedUrl,
  width,
  height,
}: {
  kind: 'difference' | 'gaps';
  originalUrl: string;
  enhancedUrl: string;
  width: number;
  height: number;
}) {
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  React.useEffect(() => {
    let cancelled = false;
    const load = (src: string) =>
      new Promise<HTMLImageElement>((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = reject;
        image.src = src;
      });
    void Promise.all([load(originalUrl), load(enhancedUrl)]).then(([original, enhanced]) => {
      if (cancelled || !canvasRef.current) return;
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      const sw = original.naturalWidth || original.width;
      const sh = original.naturalHeight || original.height;
      const src = document.createElement('canvas');
      src.width = sw;
      src.height = sh;
      const sctx = src.getContext('2d');
      if (!sctx) return;
      sctx.drawImage(original, 0, 0);
      const source = sctx.getImageData(0, 0, sw, sh);
      sctx.clearRect(0, 0, sw, sh);
      sctx.drawImage(enhanced, 0, 0, sw, sh);
      const dest = sctx.getImageData(0, 0, sw, sh);
      const out = ctx.createImageData(sw, sh);
      const lum = (data: Uint8ClampedArray, i: number) => 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
      for (let p = 0, i = 0; p < sw * sh; p++, i += 4) {
        const s = lum(source.data, i) < 168 && source.data[i + 3] > 16;
        const d = lum(dest.data, i) < 168 && dest.data[i + 3] > 16;
        if (kind === 'difference') {
          if (s && d) {
            out.data[i] = 34;
            out.data[i + 1] = 197;
            out.data[i + 2] = 94;
          } else if (d && !s) {
            out.data[i] = 239;
            out.data[i + 1] = 68;
            out.data[i + 2] = 68;
          } else if (s && !d) {
            out.data[i] = 37;
            out.data[i + 1] = 99;
            out.data[i + 2] = 235;
          } else {
            out.data[i] = 255;
            out.data[i + 1] = 255;
            out.data[i + 2] = 255;
          }
        } else {
          const x = p % sw;
          const y = (p / sw) | 0;
          const ink = (xx: number, yy: number) => {
            if (xx < 0 || yy < 0 || xx >= sw || yy >= sh) return false;
            const ii = (yy * sw + xx) * 4;
            return lum(source.data, ii) < 168 && source.data[ii + 3] > 16;
          };
          const gap = !s && ((ink(x - 1, y) && ink(x + 1, y)) || (ink(x, y - 1) && ink(x, y + 1)));
          if (gap) {
            out.data[i] = 250;
            out.data[i + 1] = 204;
            out.data[i + 2] = 21;
          } else if (s) {
            out.data[i] = 30;
            out.data[i + 1] = 30;
            out.data[i + 2] = 30;
          } else {
            out.data[i] = 255;
            out.data[i + 1] = 255;
            out.data[i + 2] = 255;
          }
        }
        out.data[i + 3] = 255;
      }
      canvas.width = sw;
      canvas.height = sh;
      ctx.putImageData(out, 0, 0);
    });
    return () => {
      cancelled = true;
    };
  }, [kind, originalUrl, enhancedUrl]);
  return (
    <figure>
      <canvas ref={canvasRef} className="bg-white shadow" style={{ width, height }} />
      <figcaption className="mt-1 text-center text-[10px] font-semibold text-slate-500">
        {kind === 'difference' ? 'Difference: green match, red extra ink, blue lost ink' : 'Protected white gaps (yellow)'}
      </figcaption>
    </figure>
  );
}

function CompareSlider({
  originalUrl,
  enhancedSvg,
  width,
  height,
  zoom,
}: {
  originalUrl: string;
  enhancedSvg?: string;
  width: number;
  height: number;
  zoom: number;
}) {
  const frameRef = React.useRef<HTMLDivElement>(null);
  const [split, setSplit] = React.useState(50);
  const draggingRef = React.useRef(false);
  const w = Math.max(1, width * zoom);
  const h = Math.max(1, height * zoom);

  const moveSplit = (clientX: number) => {
    const frame = frameRef.current;
    if (!frame) return;
    const rect = frame.getBoundingClientRect();
    const next = ((clientX - rect.left) / Math.max(1, rect.width)) * 100;
    setSplit(Math.max(0, Math.min(100, next)));
  };

  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    draggingRef.current = true;
    event.currentTarget.setPointerCapture(event.pointerId);
    moveSplit(event.clientX);
  };

  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!draggingRef.current) return;
    moveSplit(event.clientX);
  };

  const onPointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    draggingRef.current = false;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  return (
    <div
      ref={frameRef}
      className="relative select-none overflow-hidden bg-white shadow"
      style={{ width: w, height: h, touchAction: 'none' }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={originalUrl} alt="Original" className="absolute inset-0 h-full w-full" draggable={false} />
      {enhancedSvg ? (
        <div className="absolute inset-0" style={{ clipPath: `inset(0 0 0 ${split}%)` }}>
          <VectorPreview svg={enhancedSvg} width={width} height={height} zoom={zoom} />
        </div>
      ) : (
        <div className="absolute inset-0 flex items-center justify-center bg-white/80 text-xs text-slate-500">
          Waiting for enhance
        </div>
      )}
      <div className="pointer-events-none absolute inset-y-0 z-10 w-px bg-sky-500" style={{ left: `${split}%` }}>
        <span className="absolute left-1/2 top-1/2 flex h-8 w-8 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-sky-500 bg-white shadow">
          <span className="h-4 w-0.5 bg-sky-500" />
          <span className="ml-0.5 h-4 w-0.5 bg-sky-500" />
        </span>
      </div>
      <span className="pointer-events-none absolute left-2 top-2 rounded bg-black/55 px-1.5 py-0.5 text-[10px] font-semibold text-white">
        Original
      </span>
      <span className="pointer-events-none absolute right-2 top-2 rounded bg-black/55 px-1.5 py-0.5 text-[10px] font-semibold text-white">
        Enhanced
      </span>
    </div>
  );
}

function PreviewPane() {
  const { selected, zoom } = useColoringEnhance();
  if (!selected) return null;
  return (
    <div>
      <CompareSlider
        originalUrl={selected.originalUrl}
        enhancedSvg={selected.enhancedSvg}
        width={selected.width}
        height={selected.height}
        zoom={zoom}
      />
      <DebugRasterOverlays
        originalUrl={selected.originalUrl}
        enhancedUrl={selected.enhancedPngUrl}
        width={selected.width}
        height={selected.height}
        zoom={zoom}
      />
    </div>
  );
}
