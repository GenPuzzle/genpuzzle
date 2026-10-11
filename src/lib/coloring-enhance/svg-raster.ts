import type { PixelBuffer } from '@/lib/sprite-sheet-importer';

function fillHexLuminance(fill: string): number {
  const hex = fill.trim().toLowerCase();
  const rgb = hex.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/);
  if (rgb) {
    let h = rgb[1];
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    const r = parseInt(h.slice(0, 2), 16);
    const g = parseInt(h.slice(2, 4), 16);
    const b = parseInt(h.slice(4, 6), 16);
    return 0.299 * r + 0.587 * g + 0.114 * b;
  }
  const tuple = hex.match(/rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)/);
  if (tuple) return 0.299 * Number(tuple[1]) + 0.587 * Number(tuple[2]) + 0.114 * Number(tuple[3]);
  if (hex === 'black') return 0;
  if (hex === 'white') return 255;
  return 255;
}

function bezierPoint(p0: number[], p1: number[], p2: number[], p3: number[], t: number): [number, number] {
  const mt = 1 - t;
  const a = mt * mt * mt;
  const b = 3 * mt * mt * t;
  const c = 3 * mt * t * t;
  const d = t * t * t;
  return [a * p0[0] + b * p1[0] + c * p2[0] + d * p3[0], a * p0[1] + b * p1[1] + c * p2[1] + d * p3[1]];
}

function quadPoint(p0: number[], p1: number[], p2: number[], t: number): [number, number] {
  const mt = 1 - t;
  return [
    mt * mt * p0[0] + 2 * mt * t * p1[0] + t * t * p2[0],
    mt * mt * p0[1] + 2 * mt * t * p1[1] + t * t * p2[1],
  ];
}

function flattenPath(d: string, scale: number): number[][] {
  const tokens = d.match(/[a-zA-Z]|-?\d*\.?\d+(?:e[-+]?\d+)?/g) ?? [];
  const rings: number[][] = [];
  let ring: number[] = [];
  let i = 0;
  let cmd = '';
  let x = 0;
  let y = 0;
  let sx = 0;
  let sy = 0;
  let pcx = x;
  let pcy = y;
  const read = () => Number(tokens[i++]);
  const push = (nx: number, ny: number) => {
    x = nx;
    y = ny;
    ring.push(nx * scale, ny * scale);
  };
  const close = () => {
    if (ring.length >= 6) rings.push(ring);
    ring = [];
    x = sx;
    y = sy;
  };
  while (i < tokens.length) {
    const token = tokens[i];
    if (/[a-zA-Z]/.test(token)) {
      cmd = token;
      i += 1;
    }
    if (!cmd) break;
    const rel = cmd === cmd.toLowerCase();
    const kind = cmd.toUpperCase();
    if (kind === 'M') {
      close();
      const nx = rel ? x + read() : read();
      const ny = rel ? y + read() : read();
      sx = nx;
      sy = ny;
      push(nx, ny);
      cmd = rel ? 'l' : 'L';
    } else if (kind === 'L') {
      push(rel ? x + read() : read(), rel ? y + read() : read());
    } else if (kind === 'H') {
      push(rel ? x + read() : read(), y);
    } else if (kind === 'V') {
      push(x, rel ? y + read() : read());
    } else if (kind === 'C') {
      const x1 = rel ? x + read() : read();
      const y1 = rel ? y + read() : read();
      const x2 = rel ? x + read() : read();
      const y2 = rel ? y + read() : read();
      const x3 = rel ? x + read() : read();
      const y3 = rel ? y + read() : read();
      const p0 = [x, y];
      const p1 = [x1, y1];
      const p2 = [x2, y2];
      const p3 = [x3, y3];
      for (let t = 1; t <= 8; t++) push(...bezierPoint(p0, p1, p2, p3, t / 8));
      pcx = x2;
      pcy = y2;
    } else if (kind === 'S') {
      const x2 = rel ? x + read() : read();
      const y2 = rel ? y + read() : read();
      const x3 = rel ? x + read() : read();
      const y3 = rel ? y + read() : read();
      const x1 = x * 2 - pcx;
      const y1 = y * 2 - pcy;
      const p0 = [x, y];
      const p1 = [x1, y1];
      const p2 = [x2, y2];
      const p3 = [x3, y3];
      for (let t = 1; t <= 8; t++) push(...bezierPoint(p0, p1, p2, p3, t / 8));
      pcx = x2;
      pcy = y2;
    } else if (kind === 'Q') {
      const x1 = rel ? x + read() : read();
      const y1 = rel ? y + read() : read();
      const x2 = rel ? x + read() : read();
      const y2 = rel ? y + read() : read();
      const p0 = [x, y];
      const p1 = [x1, y1];
      const p2 = [x2, y2];
      for (let t = 1; t <= 6; t++) push(...quadPoint(p0, p1, p2, t / 6));
      pcx = x1;
      pcy = y1;
    } else if (kind === 'T') {
      const x1 = x * 2 - pcx;
      const y1 = y * 2 - pcy;
      const x2 = rel ? x + read() : read();
      const y2 = rel ? y + read() : read();
      const p0 = [x, y];
      const p1 = [x1, y1];
      const p2 = [x2, y2];
      for (let t = 1; t <= 6; t++) push(...quadPoint(p0, p1, p2, t / 6));
      pcx = x1;
      pcy = y1;
    } else if (kind === 'Z') {
      close();
      ring = [sx * scale, sy * scale];
      pcx = x;
      pcy = y;
    } else {
      break;
    }
    if (kind !== 'C' && kind !== 'S' && kind !== 'Q' && kind !== 'T') {
      pcx = x;
      pcy = y;
    }
  }
  close();
  return rings;
}

function fillEvenOdd(mask: Uint8Array, width: number, height: number, rings: number[][]): void {
  const valid = rings.filter((ring) => ring.length >= 6);
  if (!valid.length) return;
  let minY = height;
  let maxY = 0;
  for (const ring of valid) {
    for (let i = 1; i < ring.length; i += 2) {
      minY = Math.min(minY, ring[i]);
      maxY = Math.max(maxY, ring[i]);
    }
  }
  for (let y = Math.max(0, Math.floor(minY)); y <= Math.min(height - 1, Math.ceil(maxY)); y++) {
    const scan = y + 0.5;
    const hits: number[] = [];
    for (const ring of valid) {
      const n = ring.length / 2;
      for (let i = 0; i < n; i++) {
        const j = (i + 1) % n;
        const y1 = ring[i * 2 + 1];
        const y2 = ring[j * 2 + 1];
        if ((y1 <= scan && y2 > scan) || (y2 <= scan && y1 > scan)) {
          const t = (scan - y1) / (y2 - y1 || 1e-9);
          hits.push(ring[i * 2] + t * (ring[j * 2] - ring[i * 2]));
        }
      }
    }
    hits.sort((a, b) => a - b);
    const row = y * width;
    for (let i = 0; i + 1 < hits.length; i += 2) {
      const from = Math.max(0, Math.ceil(hits[i] - 0.001));
      const to = Math.min(width, Math.floor(hits[i + 1] + 0.001));
      for (let x = from; x < to; x++) mask[row + x] = 1;
    }
  }
}

export function sanitizeTracedSvg(svg: string, width: number, height: number, coordScale = 1): string {
  const paths = [...svg.matchAll(/<path\b([^>]*)>/gi)];
  const kept: string[] = [];
  for (const match of paths) {
    const attrs = match[1];
    const fill = attrs.match(/fill="([^"]+)"/i)?.[1] ?? '#000000';
    if (fill === 'none' || fillHexLuminance(fill) > 80) continue;
    const d = attrs.match(/\bd="([^"]+)"/i)?.[1];
    if (!d) continue;
    kept.push(`<path d="${d}" fill="#000000" fill-rule="evenodd" stroke="none"/>`);
  }
  const group = coordScale !== 1 ? `<g transform="scale(${1 / coordScale})">${kept.join('')}</g>` : kept.join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}">${group}</svg>`;
}

export function rasterizeTracedSvg(svg: string, width: number, height: number, coordScale = 1): PixelBuffer {
  const mask = new Uint8Array(width * height);
  const paths = [...svg.matchAll(/<path\b([^>]*)>/gi)];
  for (const match of paths) {
    const attrs = match[1];
    const fill = attrs.match(/fill="([^"]+)"/i)?.[1] ?? '#000000';
    if (fill === 'none' || fillHexLuminance(fill) > 80) continue;
    const d = attrs.match(/\bd="([^"]+)"/i)?.[1];
    if (!d) continue;
    fillEvenOdd(mask, width, height, flattenPath(d, 1 / coordScale));
  }
  const data = new Uint8ClampedArray(width * height * 4);
  for (let p = 0, i = 0; p < mask.length; p++, i += 4) {
    const v = mask[p] ? 17 : 255;
    data[i] = v;
    data[i + 1] = v;
    data[i + 2] = v;
    data[i + 3] = 255;
  }
  return { data, width, height };
}

export function upscaleRgba(src: PixelBuffer, scale: number): PixelBuffer {
  if (scale <= 1) return src;
  const width = src.width * scale;
  const height = src.height * scale;
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    const fy = (y + 0.5) / scale - 0.5;
    const y0 = Math.max(0, Math.floor(fy));
    const y1 = Math.min(src.height - 1, y0 + 1);
    const ty = Math.max(0, Math.min(1, fy - y0));
    for (let x = 0; x < width; x++) {
      const fx = (x + 0.5) / scale - 0.5;
      const x0 = Math.max(0, Math.floor(fx));
      const x1 = Math.min(src.width - 1, x0 + 1);
      const tx = Math.max(0, Math.min(1, fx - x0));
      const sample = (sx: number, sy: number, channel: number) => src.data[(sy * src.width + sx) * 4 + channel];
      const i = (y * width + x) * 4;
      for (let c = 0; c < 4; c++) {
        const a = sample(x0, y0, c);
        const b = sample(x1, y0, c);
        const d = sample(x0, y1, c);
        const e = sample(x1, y1, c);
        data[i + c] = a * (1 - tx) * (1 - ty) + b * tx * (1 - ty) + d * (1 - tx) * ty + e * tx * ty;
      }
    }
  }
  return { data, width, height };
}
