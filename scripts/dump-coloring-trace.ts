import { mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { createCanvas, loadImage } from '@napi-rs/canvas';
import { convertPixels } from '@visioncortex/vtracer';
import { enhanceColoringPage } from '../src/lib/coloring-enhance/pipeline';
import { upscaleRgba } from '../src/lib/coloring-enhance/svg-raster';
import type { PixelBuffer } from '../src/lib/sprite-sheet-importer';

const out = join(process.cwd(), '.trace-debug');
mkdirSync(out, { recursive: true });

function writePng(name: string, buf: PixelBuffer): void {
  const canvas = createCanvas(buf.width, buf.height);
  const ctx = canvas.getContext('2d');
  const image = ctx.createImageData(buf.width, buf.height);
  image.data.set(buf.data);
  ctx.putImageData(image, 0, 0);
  writeFileSync(join(out, name), canvas.toBuffer('image/png'));
}

function flattenOntoWhite(src: PixelBuffer): PixelBuffer {
  const data = new Uint8ClampedArray(src.data);
  for (let i = 0; i < data.length; i += 4) {
    const a = data[i + 3] / 255;
    data[i] = Math.round(data[i] * a + 255 * (1 - a));
    data[i + 1] = Math.round(data[i + 1] * a + 255 * (1 - a));
    data[i + 2] = Math.round(data[i + 2] * a + 255 * (1 - a));
    data[i + 3] = 255;
  }
  return { data, width: src.width, height: src.height };
}

async function run(): Promise<void> {
  const file = process.argv[2];
  if (!file) throw new Error('Usage: npx tsx scripts/dump-coloring-trace.ts <image.png>');
  const image = await loadImage(file);
  const canvas = createCanvas(image.width, image.height);
  const ctx = canvas.getContext('2d');
  ctx.drawImage(image, 0, 0);
  const pixels = ctx.getImageData(0, 0, image.width, image.height);
  const original: PixelBuffer = { data: new Uint8ClampedArray(pixels.data), width: image.width, height: image.height };
  writePng('01_original.png', original);
  const flat = flattenOntoWhite(original);
  writePng('02_after_white_flatten.png', flat);
  const hi = upscaleRgba(flat, 2);
  writePng('03_after_2x_upscale.png', hi);
  const raw = convertPixels(new Uint8Array(flat.data.buffer, flat.data.byteOffset, flat.data.byteLength), flat.width, flat.height, {
    clustering: 'bw',
    mode: 'spline',
    optimize: 0,
    filterSpeckle: 0,
    binaryThreshold: 120,
  });
  writeFileSync(join(out, '06_BASELINE_RAW_TRACE.svg'), raw);
  writeFileSync(join(out, 'TRACE_BEFORE_OPTIMIZATION.svg'), raw);
  const result = enhanceColoringPage(original);
  writeFileSync(join(out, '09_final.svg'), result.svg);
  writePng('10_final_render.png', result.proof);
  console.log('wrote', out, 'best', result.quality.candidate, 'ready', result.quality.vectorReady);
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
