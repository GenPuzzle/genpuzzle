import { mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { createCanvas, loadImage } from '@napi-rs/canvas';
import { enhanceColoringPage } from '../src/lib/coloring-enhance/pipeline';
import type { PixelBuffer } from '../src/lib/sprite-sheet-importer';

const OUT = join(process.cwd(), '.trace-debug');
mkdirSync(OUT, { recursive: true });

function fromImage(image: Awaited<ReturnType<typeof loadImage>>, x: number, y: number, w: number, h: number): PixelBuffer {
  const canvas = createCanvas(w, h);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(image, x, y, w, h, 0, 0, w, h);
  const pixels = ctx.getImageData(0, 0, w, h);
  return { data: new Uint8ClampedArray(pixels.data), width: w, height: h };
}

function writePng(name: string, buf: PixelBuffer): void {
  const canvas = createCanvas(buf.width, buf.height);
  const ctx = canvas.getContext('2d');
  const image = ctx.createImageData(buf.width, buf.height);
  image.data.set(buf.data);
  ctx.putImageData(image, 0, 0);
  writeFileSync(join(OUT, name), canvas.toBuffer('image/png'));
}

function drawLabel(ctx: ReturnType<ReturnType<typeof createCanvas>['getContext']>, text: string, x: number, y: number): void {
  ctx.fillStyle = '#111111';
  ctx.font = 'bold 18px sans-serif';
  ctx.fillText(text, x, y);
}

async function run(): Promise<void> {
  const originalShot =
    'C:/Users/GAMETECH/.cursor/projects/c-Users-GAMETECH-Documents-Puzzle-book-maker-tool-Copie-Copie-4/assets/c__Users_GAMETECH_AppData_Roaming_Cursor_User_workspaceStorage_fad3a4a52362c0090bb51f6779fa33da_images_image-cdfcdeb2-9493-4014-912f-a780e95f1fa4.png';
  const adobeShot =
    'C:/Users/GAMETECH/.cursor/projects/c-Users-GAMETECH-Documents-Puzzle-book-maker-tool-Copie-Copie-4/assets/c__Users_GAMETECH_AppData_Roaming_Cursor_User_workspaceStorage_fad3a4a52362c0090bb51f6779fa33da_images_image-301f0d65-38c7-485d-b979-2f86ab354720.png';
  const sourceImage = await loadImage(originalShot);
  const adobeImage = await loadImage(adobeShot);
  const grass = fromImage(sourceImage, 220, 250, 420, 200);
  writePng('compare_original_grass.png', grass);
  const result = enhanceColoringPage(grass);
  const proof = result.candidates.find((item) => item.name === result.quality.candidate)?.proof ?? result.image;
  writePng('compare_enhanced_grass.png', proof);
  writeFileSync(join(OUT, 'compare_enhanced_grass.svg'), result.svg);
  const adobeGrass = fromImage(adobeImage, 40, 80, 520, 420);
  writePng('compare_adobe_grass.png', adobeGrass);
  const board = createCanvas(grass.width * 3 + 48, Math.max(grass.height, proof.height, adobeGrass.height) + 48);
  const ctx = board.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, board.width, board.height);
  const put = (buf: PixelBuffer, x: number) => {
    const c = createCanvas(buf.width, buf.height);
    const g = c.getContext('2d');
    const image = g.createImageData(buf.width, buf.height);
    image.data.set(buf.data);
    g.putImageData(image, 0, 0);
    ctx.drawImage(c, x, 32);
  };
  put(grass, 8);
  put(proof, grass.width + 16);
  put(adobeGrass, grass.width + proof.width + 24);
  drawLabel(ctx, 'Original', 8, 22);
  drawLabel(ctx, `GenPuzzle ${result.quality.candidate}`, grass.width + 16, 22);
  drawLabel(ctx, 'Adobe Image Trace target', grass.width + proof.width + 24, 22);
  writeFileSync(join(OUT, 'compare_board.png'), board.toBuffer('image/png'));
  console.log({
    best: result.quality.candidate,
    ready: result.quality.vectorReady,
    width: result.quality.lineWidthFidelity,
    drift: result.quality.inkCoverageDiff,
    pinholes: result.quality.newPinholeCount,
    gap: result.quality.gapPreservation,
    detail: result.quality.detailRetention,
    cubics: result.quality.cubicCount,
    rows: result.candidates.map((item) => ({
      name: item.name,
      width: item.quality.lineWidthFidelity,
      drift: item.quality.inkCoverageDiff,
      gap: item.quality.gapPreservation,
      pinholes: item.quality.newPinholeCount,
    })),
  });
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
