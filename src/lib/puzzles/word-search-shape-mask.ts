/**
 * Convert a PNG/JPEG silhouette into a boolean letter-mask for shape word search.
 * true = place a letter in that cell; false = outside the shape (empty).
 */

export type ShapeMaskFit = 'contain' | 'cover' | 'stretch';

export interface BuildWordSearchShapeMaskOptions {
  /** Alpha (0–255) above which a pixel counts as “inside” when the image has transparency. Default 40. */
  alphaThreshold?: number;
  /** How the image maps onto the grid. Default 'contain'. */
  fit?: ShapeMaskFit;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to load shape mask image'));
    img.src = src;
  });
}

function drawFitted(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  cols: number,
  rows: number,
  fit: ShapeMaskFit
): void {
  ctx.clearRect(0, 0, cols, rows);
  const rect = getShapeMaskImageDrawRect(
    img.naturalWidth || img.width,
    img.naturalHeight || img.height,
    cols,
    rows,
    fit
  );
  ctx.drawImage(img, rect.x, rect.y, rect.w, rect.h);
}

/** Pixel/PDF rect for drawing a shape image into a grid box with the given fit mode. */
export function getShapeMaskImageDrawRect(
  imageWidth: number,
  imageHeight: number,
  boxWidth: number,
  boxHeight: number,
  fit: ShapeMaskFit = 'contain'
): { x: number; y: number; w: number; h: number } {
  const imgW = Math.max(1, imageWidth);
  const imgH = Math.max(1, imageHeight);
  const boxW = Math.max(1, boxWidth);
  const boxH = Math.max(1, boxHeight);

  if (fit === 'stretch') {
    return { x: 0, y: 0, w: boxW, h: boxH };
  }

  const scale =
    fit === 'cover'
      ? Math.max(boxW / imgW, boxH / imgH)
      : Math.min(boxW / imgW, boxH / imgH);
  const drawW = imgW * scale;
  const drawH = imgH * scale;
  return {
    x: (boxW - drawW) / 2,
    y: (boxH - drawH) / 2,
    w: drawW,
    h: drawH,
  };
}

/**
 * Draw a shape silhouette image into a canvas context (CSS-pixel coordinates).
 */
export async function drawShapeMaskImageOnCanvas(
  ctx: CanvasRenderingContext2D,
  imageSrc: string,
  boxWidthPx: number,
  boxHeightPx: number,
  options?: {
    fit?: ShapeMaskFit;
    opacity?: number; // 0–1
  }
): Promise<void> {
  const fit = options?.fit ?? 'contain';
  const opacity = Math.max(0, Math.min(1, options?.opacity ?? 0.35));
  if (opacity <= 0) return;

  const img = await loadImage(imageSrc);
  const rect = getShapeMaskImageDrawRect(
    img.naturalWidth || img.width,
    img.naturalHeight || img.height,
    boxWidthPx,
    boxHeightPx,
    fit
  );

  ctx.save();
  ctx.globalAlpha = opacity;
  ctx.drawImage(img, rect.x, rect.y, rect.w, rect.h);
  ctx.restore();
}

/**
 * Build a rows×cols boolean mask from a silhouette image (data URL or URL).
 * Prefer alpha when the image has transparency; otherwise treat dark pixels as the shape.
 */
export async function buildWordSearchShapeMask(
  imageSrc: string,
  cols: number = 30,
  rows: number = 30,
  options?: BuildWordSearchShapeMaskOptions
): Promise<boolean[][]> {
  const width = Math.max(1, Math.floor(cols));
  const height = Math.max(1, Math.floor(rows));
  const alphaThreshold = options?.alphaThreshold ?? 40;
  const fit = options?.fit ?? 'contain';

  if (typeof document === 'undefined') {
    throw new Error('Shape mask generation requires a browser environment');
  }

  const img = await loadImage(imageSrc);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('Could not create canvas for shape mask');

  drawFitted(ctx, img, width, height, fit);
  const { data } = ctx.getImageData(0, 0, width, height);

  let transparentish = 0;
  let darkOpaque = 0;
  let opaque = 0;
  const total = width * height;

  for (let i = 0; i < data.length; i += 4) {
    const a = data[i + 3];
    if (a <= alphaThreshold) {
      transparentish += 1;
      continue;
    }
    opaque += 1;
    const lum = (data[i] + data[i + 1] + data[i + 2]) / 3;
    if (lum < 200) darkOpaque += 1;
  }

  const useAlpha = transparentish / total > 0.02;
  const useDarkOnLight = !useAlpha && opaque > 0 && darkOpaque / opaque < 0.92;

  const mask: boolean[][] = Array.from({ length: height }, () =>
    Array<boolean>(width).fill(false)
  );

  for (let row = 0; row < height; row++) {
    for (let col = 0; col < width; col++) {
      const i = (row * width + col) * 4;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const a = data[i + 3];
      const lum = (r + g + b) / 3;

      if (useAlpha) {
        mask[row][col] = a > alphaThreshold;
      } else if (useDarkOnLight) {
        mask[row][col] = a > alphaThreshold && lum < 200;
      } else {
        // Light-on-dark silhouette
        mask[row][col] = a > alphaThreshold && lum > 55;
      }
    }
  }

  const insideCount = mask.reduce(
    (sum, row) => sum + row.reduce((s, cell) => s + (cell ? 1 : 0), 0),
    0
  );
  if (insideCount < 8) {
    throw new Error(
      'Shape mask is too empty. Use a clearer silhouette PNG (opaque shape on transparent or white background).'
    );
  }

  return mask;
}

export function isWordSearchShapeCell(
  shapeMask: boolean[][] | undefined,
  row: number,
  col: number
): boolean {
  if (!shapeMask) return true;
  return Boolean(shapeMask[row]?.[col]);
}

/** Resolve which silhouette image to use for a given puzzle index. */
export function resolveShapeMaskImageSrc(
  core: {
    shapeMaskMode?: 'common' | 'per-puzzle';
    shapeMaskImage?: string;
    shapeMaskImages?: string[];
  },
  puzzleIndex: number
): string | undefined {
  const mode = core.shapeMaskMode ?? 'common';
  if (mode === 'per-puzzle') {
    const perPuzzle = core.shapeMaskImages?.[puzzleIndex];
    if (perPuzzle) return perPuzzle;
  }
  return core.shapeMaskImage || undefined;
}

export function readImageFilesAsDataUrls(files: FileList | File[]): Promise<string[]> {
  const list = Array.from(files).filter((file) => {
    if (file.type.startsWith('image/')) return true;
    // Windows / some browsers leave type empty or as octet-stream for PNGs.
    return /\.(png|jpe?g|gif|webp|bmp|svg)$/i.test(file.name || '');
  });
  return Promise.all(
    list.map(
      (file) =>
        new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => {
            if (typeof reader.result === 'string' && reader.result.startsWith('data:')) {
              resolve(reader.result);
            } else {
              reject(new Error(`Failed to read ${file.name || 'image'}`));
            }
          };
          reader.onerror = () => reject(new Error(`Failed to read ${file.name || 'image'}`));
          reader.readAsDataURL(file);
        })
    )
  );
}

/** Read a single image file as a data URL (accepts empty MIME when extension looks like an image). */
export function readImageFileAsDataUrl(file: File): Promise<string> {
  return readImageFilesAsDataUrls([file]).then((urls) => {
    if (!urls[0]) throw new Error(`Failed to read ${file.name || 'image'}`);
    return urls[0];
  });
}
