import type { PixelRect, RgbColor } from './types';
import { expandRect, overlapArea } from './geometry';
import { isInkPixel } from './background';
import { componentTouchesText, labelConnectedComponents } from './components';

function dilateMask(mask: Uint8Array, width: number, height: number, radius: number): Uint8Array {
  if (radius <= 0) return mask;
  const out = new Uint8Array(mask.length);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let on = 0;
      for (let dy = -radius; dy <= radius && !on; dy++) {
        const yy = y + dy;
        if (yy < 0 || yy >= height) continue;
        for (let dx = -radius; dx <= radius; dx++) {
          const xx = x + dx;
          if (xx < 0 || xx >= width) continue;
          if (mask[yy * width + xx]) {
            on = 1;
            break;
          }
        }
      }
      out[y * width + x] = on;
    }
  }
  return out;
}

export function buildTextMask(
  width: number,
  height: number,
  textBoxes: PixelRect[],
  imageData: ImageData,
  background: RgbColor
): Uint8Array {
  const mask = new Uint8Array(width * height);
  const { data } = imageData;
  for (const box of textBoxes) {
    const pad = Math.max(4, Math.round(Math.max(box.height * 0.45, box.width * 0.12)));
    const padded = expandRect(box, pad, width, height);
    for (let y = padded.y; y < padded.y + padded.height; y++) {
      for (let x = padded.x; x < padded.x + padded.width; x++) {
        const i = (y * width + x) * 4;
        if (isInkPixel(data[i], data[i + 1], data[i + 2], data[i + 3], background, 34)) {
          mask[y * width + x] = 1;
        }
      }
    }
  }
  return dilateMask(mask, width, height, 2);
}

export function protectGraphicInk(
  imageData: ImageData,
  textMask: Uint8Array,
  textBoxes: PixelRect[],
  background: RgbColor
): Uint8Array {
  const { data, width, height } = imageData;
  const ink = new Uint8Array(width * height);
  for (let i = 0; i < width * height; i++) {
    const p = i * 4;
    ink[i] = isInkPixel(data[p], data[p + 1], data[p + 2], data[p + 3], background, 36) ? 1 : 0;
  }
  const { labels, components } = labelConnectedComponents(ink, width, height);
  const protectedMask = new Uint8Array(textMask);
  for (const component of components) {
    const boxArea = Math.max(1, component.bbox.width * component.bbox.height);
    const mostlyInsideText = textBoxes.some((text) => {
      const overlap = overlapArea(component.bbox, text);
      return overlap / boxArea > 0.7;
    });
    if (mostlyInsideText) continue;
    const maxTextH = Math.max(12, ...textBoxes.map((text) => text.height), 1);
    if (component.bbox.height <= maxTextH * 1.35 && component.area < Math.max(900, boxArea * 0.5)) continue;

    if (componentTouchesText(component.bbox, textBoxes, 0.62)) continue;
    const area = component.area;
    let inside = 0;
    const { x, y, width: w, height: h } = component.bbox;
    for (let yy = y; yy < y + h; yy++) {
      for (let xx = x; xx < x + w; xx++) {
        const i = yy * width + xx;
        if (labels[i] === component.id && textMask[i]) inside += 1;
      }
    }
    if (inside / Math.max(1, area) < 0.45) {
      for (let yy = y; yy < y + h; yy++) {
        for (let xx = x; xx < x + w; xx++) {
          const i = yy * width + xx;
          if (labels[i] === component.id) protectedMask[i] = 0;
        }
      }
    }
  }
  return protectedMask;
}

export function eraseInkInsideTextBoxes(
  imageData: ImageData,
  textBoxes: PixelRect[],
  background: RgbColor,
  keepBorderPx = 0
): ImageData {
  const { data, width, height } = imageData;
  const out = new ImageData(new Uint8ClampedArray(data), width, height);
  const dest = out.data;
  for (const box of textBoxes) {
    const padX = Math.max(4, Math.round(box.width * 0.2));
    const padY = Math.max(6, Math.round(box.height * 0.55));
    const padded = expandRect(box, Math.max(padX, padY), width, height);
    const x0 = padded.x + keepBorderPx;
    const y0 = padded.y + keepBorderPx;
    const x1 = padded.x + padded.width - keepBorderPx;
    const y1 = padded.y + padded.height - keepBorderPx;
    for (let y = y0; y < y1; y++) {
      for (let x = x0; x < x1; x++) {
        const p = (y * width + x) * 4;
        if (!isInkPixel(dest[p], dest[p + 1], dest[p + 2], dest[p + 3], background, 28)) continue;
        dest[p] = background.r;
        dest[p + 1] = background.g;
        dest[p + 2] = background.b;
        dest[p + 3] = 255;
      }
    }
  }
  return out;
}

export function eraseFrameInteriors(
  imageData: ImageData,
  frames: PixelRect[],
  background: RgbColor
): ImageData {
  const { data, width, height } = imageData;
  const out = new ImageData(new Uint8ClampedArray(data), width, height);
  const dest = out.data;
  for (const frame of frames) {
    const insetX = Math.max(4, Math.round(frame.width * 0.08));
    const insetY = Math.max(4, Math.round(frame.height * 0.12));
    const x0 = Math.floor(frame.x + insetX);
    const y0 = Math.floor(frame.y + insetY);
    const x1 = Math.ceil(frame.x + frame.width - insetX);
    const y1 = Math.ceil(frame.y + frame.height - insetY);
    for (let y = y0; y < y1; y++) {
      for (let x = x0; x < x1; x++) {
        if (x < 0 || y < 0 || x >= width || y >= height) continue;
        const p = (y * width + x) * 4;
        dest[p] = background.r;
        dest[p + 1] = background.g;
        dest[p + 2] = background.b;
        dest[p + 3] = 255;
      }
    }
  }
  return out;
}

export function inpaintMaskedPixels(imageData: ImageData, mask: Uint8Array, background: RgbColor): ImageData {
  const { data, width, height } = imageData;
  const out = new ImageData(new Uint8ClampedArray(data), width, height);
  const dest = out.data;
  const radius = 3;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      if (!mask[i]) continue;
      let r = 0;
      let g = 0;
      let b = 0;
      let count = 0;
      for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
          if (dx === 0 && dy === 0) continue;
          const xx = x + dx;
          const yy = y + dy;
          if (xx < 0 || yy < 0 || xx >= width || yy >= height) continue;
          const ni = yy * width + xx;
          if (mask[ni]) continue;
          const p = ni * 4;
          r += dest[p];
          g += dest[p + 1];
          b += dest[p + 2];
          count += 1;
        }
      }
      const p = i * 4;
      if (count > 0) {
        dest[p] = Math.round(r / count);
        dest[p + 1] = Math.round(g / count);
        dest[p + 2] = Math.round(b / count);
        dest[p + 3] = 255;
      } else {
        dest[p] = background.r;
        dest[p + 1] = background.g;
        dest[p + 2] = background.b;
        dest[p + 3] = 255;
      }
    }
  }
  return out;
}

export function eraseLeftoverGlyphs(
  imageData: ImageData,
  textBoxes: PixelRect[],
  background: RgbColor
): ImageData {
  if (!textBoxes.length) return imageData;
  const { data, width, height } = imageData;
  const ink = new Uint8Array(width * height);
  for (let i = 0; i < width * height; i++) {
    const p = i * 4;
    ink[i] = isInkPixel(data[p], data[p + 1], data[p + 2], data[p + 3], background, 42) ? 1 : 0;
  }
  const { labels, components } = labelConnectedComponents(ink, width, height);
  const expanded = textBoxes.map((box) =>
    expandRect(box, Math.max(8, Math.round(box.height * 0.7)), width, height)
  );
  const erase = new Set<number>();
  for (const component of components) {
    const boxArea = Math.max(1, component.bbox.width * component.bbox.height);
    const glyphSized =
      component.bbox.height < height * 0.09 &&
      component.bbox.width < width * 0.45 &&
      component.area < width * height * 0.02;
    if (!glyphSized) continue;
    const hitsText = expanded.some((box) => overlapArea(component.bbox, box) / boxArea > 0.28);
    if (hitsText) erase.add(component.id);
  }
  if (!erase.size) return imageData;
  const out = new ImageData(new Uint8ClampedArray(data), width, height);
  const dest = out.data;
  for (let i = 0; i < labels.length; i++) {
    if (!erase.has(labels[i])) continue;
    const p = i * 4;
    dest[p] = background.r;
    dest[p + 1] = background.g;
    dest[p + 2] = background.b;
    dest[p + 3] = 255;
  }
  return out;
}

export function removeDetectedText(
  imageData: ImageData,
  textBoxes: PixelRect[],
  background: RgbColor
): ImageData {
  const rawMask = buildTextMask(imageData.width, imageData.height, textBoxes, imageData, background);
  const mask = protectGraphicInk(imageData, rawMask, textBoxes, background);
  const inpainted = inpaintMaskedPixels(imageData, mask, background);
  const erased = eraseInkInsideTextBoxes(inpainted, textBoxes, background, 0);
  return eraseLeftoverGlyphs(erased, textBoxes, background);
}
