import { NextRequest, NextResponse } from 'next/server';
import { enhanceColoringPage } from '@/lib/coloring-enhance/pipeline';
import type { ColoringEnhanceSettings } from '@/lib/coloring-enhance/types';
import type { PixelBuffer } from '@/lib/sprite-sheet-importer';

export const runtime = 'nodejs';
export const maxDuration = 60;

async function loadCanvas() {
  return import('@napi-rs/canvas');
}

async function pngDataUrlToBuffer(pngDataUrl: string): Promise<PixelBuffer> {
  const { createCanvas, loadImage } = await loadCanvas();
  const comma = pngDataUrl.indexOf(',');
  const bytes = Buffer.from(pngDataUrl.slice(Math.max(0, comma + 1)), 'base64');
  const image = await loadImage(bytes);
  const canvas = createCanvas(image.width, image.height);
  const ctx = canvas.getContext('2d');
  ctx.drawImage(image, 0, 0);
  const pixels = ctx.getImageData(0, 0, image.width, image.height);
  return { data: new Uint8ClampedArray(pixels.data), width: image.width, height: image.height };
}

async function bufferToPngDataUrl(buf: PixelBuffer): Promise<string> {
  const { createCanvas } = await loadCanvas();
  const canvas = createCanvas(buf.width, buf.height);
  const ctx = canvas.getContext('2d');
  const image = ctx.createImageData(buf.width, buf.height);
  image.data.set(buf.data);
  ctx.putImageData(image, 0, 0);
  return `data:image/png;base64,${canvas.toBuffer('image/png').toString('base64')}`;
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      pngDataUrl?: string;
      isSvg?: boolean;
      svgText?: string;
      settings?: Partial<ColoringEnhanceSettings>;
    };
    if (!body.pngDataUrl) {
      return NextResponse.json({ error: 'Missing image.' }, { status: 400 });
    }
    const source = await pngDataUrlToBuffer(body.pngDataUrl);
    const result = enhanceColoringPage(source, {
      isSvg: body.isSvg,
      svgText: body.svgText,
      settings: body.settings,
    });
    return NextResponse.json({
      svg: result.svg,
      imagePng: await bufferToPngDataUrl(result.image),
      quality: result.quality,
      profile: result.profile,
    });
  } catch (error) {
    console.error('[coloring-enhance]', error);
    return NextResponse.json({ error: 'Could not enhance this image.' }, { status: 500 });
  }
}
