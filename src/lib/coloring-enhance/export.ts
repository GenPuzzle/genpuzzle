import JSZip from 'jszip';
import { PDFDocument } from 'pdf-lib';
import { bufferToDataUrl } from '@/lib/sprite-sheet-importer';
import type { PixelBuffer } from '@/lib/sprite-sheet-importer';
import { fileStem } from './analyze';

export function enhancedFileName(originalName: string, extension: 'svg' | 'png' | 'pdf'): string {
  return `${fileStem(originalName)}_enhanced.${extension}`;
}

export function downloadTextFile(filename: string, contents: string, mime: string): void {
  const blob = new Blob([contents], { type: mime });
  downloadBlob(filename, blob);
}

export function downloadDataUrl(filename: string, dataUrl: string): void {
  const anchor = document.createElement('a');
  anchor.href = dataUrl;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
}

export function downloadBlob(filename: string, blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export function bufferToPngDataUrl(image: PixelBuffer): string {
  return bufferToDataUrl(image);
}

export const COLORING_PRINT_PPI = 300;

export function printPixelSize(width: number, height: number, ppi = COLORING_PRINT_PPI): { width: number; height: number } {
  return {
    width: Math.max(1, Math.round((width / 72) * ppi)),
    height: Math.max(1, Math.round((height / 72) * ppi)),
  };
}

function dataUrlToBytes(dataUrl: string): Uint8Array {
  const comma = dataUrl.indexOf(',');
  const binary = atob(dataUrl.slice(Math.max(0, comma + 1)));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i += 1) {
    crc ^= bytes[i];
    for (let bit = 0; bit < 8; bit += 1) {
      crc = crc & 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1;
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type: string, data: Uint8Array): Uint8Array {
  const chunk = new Uint8Array(12 + data.length);
  const view = new DataView(chunk.buffer);
  view.setUint32(0, data.length);
  chunk[4] = type.charCodeAt(0);
  chunk[5] = type.charCodeAt(1);
  chunk[6] = type.charCodeAt(2);
  chunk[7] = type.charCodeAt(3);
  chunk.set(data, 8);
  view.setUint32(8 + data.length, crc32(chunk.subarray(4, 8 + data.length)));
  return chunk;
}

export function setPngPpi(png: Uint8Array, ppi = COLORING_PRINT_PPI): Uint8Array {
  if (png.length < 33 || png[0] !== 0x89 || png[1] !== 0x50) return png;
  const ppm = Math.max(1, Math.round(ppi / 0.0254));
  const phys = new Uint8Array(9);
  const view = new DataView(phys.buffer);
  view.setUint32(0, ppm);
  view.setUint32(4, ppm);
  phys[8] = 1;
  const physChunk = pngChunk('pHYs', phys);
  let offset = 8;
  const header = new DataView(png.buffer, png.byteOffset, png.byteLength);
  const ihdrLength = header.getUint32(offset);
  const insertAt = offset + 12 + ihdrLength;
  if (insertAt > png.length) return png;
  const nextType = String.fromCharCode(png[insertAt + 4], png[insertAt + 5], png[insertAt + 6], png[insertAt + 7]);
  if (nextType === 'pHYs') {
    const existingLength = header.getUint32(insertAt);
    const without = new Uint8Array(png.length - (12 + existingLength));
    without.set(png.subarray(0, insertAt));
    without.set(png.subarray(insertAt + 12 + existingLength), insertAt);
    const merged = new Uint8Array(without.length + physChunk.length);
    merged.set(without.subarray(0, insertAt));
    merged.set(physChunk, insertAt);
    merged.set(without.subarray(insertAt), insertAt + physChunk.length);
    return merged;
  }
  const merged = new Uint8Array(png.length + physChunk.length);
  merged.set(png.subarray(0, insertAt));
  merged.set(physChunk, insertAt);
  merged.set(png.subarray(insertAt), insertAt + physChunk.length);
  return merged;
}

function svgForPrintRaster(svg: string, width: number, height: number): string {
  const sized = /<svg\b[^>]*\bwidth=/.test(svg)
    ? svg.replace(/\swidth="[^"]*"/, ` width="${width}"`).replace(/\sheight="[^"]*"/, ` height="${height}"`)
    : svg.replace('<svg', `<svg width="${width}" height="${height}"`);
  return sized.includes('xmlns=') ? sized : sized.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"');
}

function loadSvgImage(svg: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Could not rasterize the SVG.'));
    };
    image.src = url;
  });
}

export async function rasterizeSvgToPrintPngBytes(
  svg: string,
  width: number,
  height: number,
  ppi = COLORING_PRINT_PPI,
  options?: { background?: 'white' | 'transparent'; punchWhite?: boolean }
): Promise<Uint8Array> {
  const pixels = printPixelSize(width, height, ppi);
  const image = await loadSvgImage(svgForPrintRaster(svg, width, height));
  const canvas = document.createElement('canvas');
  canvas.width = pixels.width;
  canvas.height = pixels.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not create a print canvas.');
  if (options?.background !== 'transparent') {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, pixels.width, pixels.height);
  } else {
    ctx.clearRect(0, 0, pixels.width, pixels.height);
  }
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(image, 0, 0, pixels.width, pixels.height);
  if (options?.punchWhite) {
    const pixelsData = ctx.getImageData(0, 0, pixels.width, pixels.height);
    const data = pixelsData.data;
    for (let i = 0; i < data.length; i += 4) {
      if (0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2] >= 246) data[i + 3] = 0;
    }
    ctx.putImageData(pixelsData, 0, 0);
  }
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((next) => (next ? resolve(next) : reject(new Error('Could not encode the PNG.'))), 'image/png');
  });
  return setPngPpi(new Uint8Array(await blob.arrayBuffer()), ppi);
}

export async function rasterizeSvgToPrintPngDataUrl(
  svg: string,
  width: number,
  height: number,
  ppi = COLORING_PRINT_PPI,
  options?: { background?: 'white' | 'transparent'; punchWhite?: boolean }
): Promise<string> {
  const bytes = await rasterizeSvgToPrintPngBytes(svg, width, height, ppi, options);
  let binary = '';
  for (let i = 0; i < bytes.length; i += 1) binary += String.fromCharCode(bytes[i]);
  return `data:image/png;base64,${btoa(binary)}`;
}

export async function coloringPagePdfBytes(pngDataUrl: string, width: number, height: number): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const png = await pdf.embedPng(dataUrlToBytes(pngDataUrl));
  const page = pdf.addPage([Math.max(72, width), Math.max(72, height)]);
  page.drawImage(png, { x: 0, y: 0, width: page.getWidth(), height: page.getHeight() });
  return pdf.save();
}

export async function coloringPagePdfFromSvg(svg: string, width: number, height: number): Promise<Uint8Array> {
  const pngBytes = await rasterizeSvgToPrintPngBytes(svg, width, height);
  const pdf = await PDFDocument.create();
  const png = await pdf.embedPng(pngBytes);
  const page = pdf.addPage([Math.max(72, width), Math.max(72, height)]);
  page.drawImage(png, { x: 0, y: 0, width: page.getWidth(), height: page.getHeight() });
  return pdf.save();
}

export async function downloadColoringZip(
  files: Array<{ stem: string; svg?: string; pngDataUrl?: string; width: number; height: number }>
): Promise<void> {
  const zip = new JSZip();
  for (const file of files) {
    if (file.svg) zip.file(`${file.stem}_enhanced.svg`, file.svg);
    if (file.svg) {
      zip.file(`${file.stem}_enhanced.png`, await rasterizeSvgToPrintPngBytes(file.svg, file.width, file.height));
    } else if (file.pngDataUrl) {
      const comma = file.pngDataUrl.indexOf(',');
      zip.file(`${file.stem}_enhanced.png`, file.pngDataUrl.slice(comma + 1), { base64: true });
    }
  }
  const blob = await zip.generateAsync({ type: 'blob' });
  downloadBlob('coloring-pages-enhanced.zip', blob);
}
