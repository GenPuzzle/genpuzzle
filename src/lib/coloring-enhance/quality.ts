import type { PixelBuffer } from '@/lib/sprite-sheet-importer';
import type { ColoringQualityLabel, ColoringQualityReport } from './types';
import { analyzeSvgGeometry } from './bezier-fit';
import { findGapRuns } from './centerline';
import { extractInkMask } from './ink';
import { svgHasFillStroke } from './vectorize';

export function svgIsTrueVector(svg: string | undefined): boolean {
  if (!svg) return false;
  return /<path\b/i.test(svg) && !/<image\b/i.test(svg);
}

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function countInk(mask: Uint8Array): number {
  let n = 0;
  for (let i = 0; i < mask.length; i++) if (mask[i]) n += 1;
  return n;
}

function scaleBuffer(src: PixelBuffer, width: number, height: number): PixelBuffer {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    const sy = Math.min(src.height - 1, Math.round((y * src.height) / height));
    for (let x = 0; x < width; x++) {
      const sx = Math.min(src.width - 1, Math.round((x * src.width) / width));
      const si = (sy * src.width + sx) * 4;
      const di = (y * width + x) * 4;
      data[di] = src.data[si];
      data[di + 1] = src.data[si + 1];
      data[di + 2] = src.data[si + 2];
      data[di + 3] = src.data[si + 3];
    }
  }
  return { data, width, height };
}

function sameSizeMask(src: PixelBuffer, dest: PixelBuffer): { srcInk: Uint8Array; destInk: Uint8Array; width: number; height: number } {
  const longSide = Math.max(src.width, src.height);
  const scoredSrc = longSide > 900 ? scaleBuffer(src, Math.round((src.width * 900) / longSide), Math.round((src.height * 900) / longSide)) : src;
  const scoredDest =
    dest.width === scoredSrc.width && dest.height === scoredSrc.height
      ? dest
      : scaleBuffer(dest, scoredSrc.width, scoredSrc.height);
  return {
    srcInk: extractInkMask(scoredSrc),
    destInk: extractInkMask(scoredDest),
    width: scoredSrc.width,
    height: scoredSrc.height,
  };
}

function dilate(mask: Uint8Array, width: number, height: number, radius: number): Uint8Array {
  if (radius <= 0) return mask;
  const out = new Uint8Array(mask);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (!mask[y * width + x]) continue;
      for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
          out[ny * width + nx] = 1;
        }
      }
    }
  }
  return out;
}

function recallWithTolerance(src: Uint8Array, dest: Uint8Array, width: number, height: number, radius: number): number {
  const destPad = dilate(dest, width, height, radius);
  let need = 0;
  let hit = 0;
  for (let i = 0; i < src.length; i++) {
    if (!src[i]) continue;
    need += 1;
    if (destPad[i]) hit += 1;
  }
  return need ? hit / need : 1;
}

function extraInkRatio(src: Uint8Array, dest: Uint8Array, width: number, height: number, radius: number): number {
  const srcPad = dilate(src, width, height, radius);
  let destInk = 0;
  let extra = 0;
  for (let i = 0; i < dest.length; i++) {
    if (!dest[i]) continue;
    destInk += 1;
    if (!srcPad[i]) extra += 1;
  }
  return destInk ? extra / destInk : 0;
}

function skeletonize(mask: Uint8Array, width: number, height: number): Uint8Array {
  const work = new Uint8Array(mask);
  const isInk = (x: number, y: number) =>
    x >= 0 && y >= 0 && x < width && y < height && work[y * width + x] === 1;
  let changed = true;
  let guard = 0;
  while (changed && guard < 64) {
    changed = false;
    guard += 1;
    const remove: number[] = [];
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        if (!isInk(x, y)) continue;
        const p2 = isInk(x, y - 1) ? 1 : 0;
        const p3 = isInk(x + 1, y - 1) ? 1 : 0;
        const p4 = isInk(x + 1, y) ? 1 : 0;
        const p5 = isInk(x + 1, y + 1) ? 1 : 0;
        const p6 = isInk(x, y + 1) ? 1 : 0;
        const p7 = isInk(x - 1, y + 1) ? 1 : 0;
        const p8 = isInk(x - 1, y) ? 1 : 0;
        const p9 = isInk(x - 1, y - 1) ? 1 : 0;
        const neighbors = p2 + p3 + p4 + p5 + p6 + p7 + p8 + p9;
        if (neighbors < 2 || neighbors > 6) continue;
        const transitions =
          (p2 === 0 && p3 === 1 ? 1 : 0) +
          (p3 === 0 && p4 === 1 ? 1 : 0) +
          (p4 === 0 && p5 === 1 ? 1 : 0) +
          (p5 === 0 && p6 === 1 ? 1 : 0) +
          (p6 === 0 && p7 === 1 ? 1 : 0) +
          (p7 === 0 && p8 === 1 ? 1 : 0) +
          (p8 === 0 && p9 === 1 ? 1 : 0) +
          (p9 === 0 && p2 === 1 ? 1 : 0);
        if (transitions !== 1) continue;
        if (p2 && p4 && p6) continue;
        if (p4 && p6 && p8) continue;
        remove.push(y * width + x);
      }
    }
    if (remove.length) {
      changed = true;
      for (const p of remove) work[p] = 0;
    }
  }
  return work;
}

function edgeMask(ink: Uint8Array, width: number, height: number): Uint8Array {
  const edges = new Uint8Array(ink.length);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const p = y * width + x;
      if (!ink[p]) continue;
      if (
        x === 0 ||
        y === 0 ||
        x === width - 1 ||
        y === height - 1 ||
        !ink[p - 1] ||
        !ink[p + 1] ||
        !ink[p - width] ||
        !ink[p + width]
      ) {
        edges[p] = 1;
      }
    }
  }
  return edges;
}

export function measureJagginess(ink: Uint8Array, width: number, height: number): number {
  let border = 0;
  let stairs = 0;
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const p = y * width + x;
      if (!ink[p]) continue;
      const n = ink[p - width];
      const s = ink[p + width];
      const e = ink[p + 1];
      const w = ink[p - 1];
      if (n && s && e && w) continue;
      border += 1;
      const stair =
        (!n && !e && ink[p - width + 1]) ||
        (!n && !w && ink[p - width - 1]) ||
        (!s && !e && ink[p + width + 1]) ||
        (!s && !w && ink[p + width - 1]);
      if (stair) stairs += 1;
    }
  }
  return border ? stairs / border : 0;
}

function strokeWidthAt(ink: Uint8Array, width: number, height: number, x: number, y: number): number {
  const p = y * width + x;
  if (!ink[p]) return 0;
  let left = 0;
  while (x - left - 1 >= 0 && ink[p - left - 1]) left += 1;
  let right = 0;
  while (x + right + 1 < width && ink[p + right + 1]) right += 1;
  let up = 0;
  while (y - up - 1 >= 0 && ink[p - (up + 1) * width]) up += 1;
  let down = 0;
  while (y + down + 1 < height && ink[p + (down + 1) * width]) down += 1;
  return Math.min(left + right + 1, up + down + 1);
}

function medianStrokeWidth(ink: Uint8Array, width: number, height: number): number {
  const widths: number[] = [];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (!ink[y * width + x]) continue;
      widths.push(strokeWidthAt(ink, width, height, x, y));
    }
  }
  if (!widths.length) return 1;
  widths.sort((a, b) => a - b);
  return widths[(widths.length / 2) | 0];
}

function percentile(values: number[], p: number): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.round((sorted.length - 1) * p)));
  return sorted[index];
}

function localWidthDeviations(src: Uint8Array, dest: Uint8Array, width: number, height: number): number[] {
  const tile = 24;
  const deviations: number[] = [];
  for (let y0 = 0; y0 < height; y0 += tile) {
    for (let x0 = 0; x0 < width; x0 += tile) {
      const srcW: number[] = [];
      const destW: number[] = [];
      const y1 = Math.min(height, y0 + tile);
      const x1 = Math.min(width, x0 + tile);
      for (let y = y0; y < y1; y++) {
        for (let x = x0; x < x1; x++) {
          if (src[y * width + x]) srcW.push(strokeWidthAt(src, width, height, x, y));
          if (dest[y * width + x]) destW.push(strokeWidthAt(dest, width, height, x, y));
        }
      }
      if (srcW.length < 8 || destW.length < 8) continue;
      srcW.sort((a, b) => a - b);
      destW.sort((a, b) => a - b);
      const a = srcW[(srcW.length / 2) | 0];
      const b = destW[(destW.length / 2) | 0];
      deviations.push(Math.abs(b - a) / Math.max(0.75, a));
    }
  }
  return deviations;
}

function gapPreservationScore(src: Uint8Array, dest: Uint8Array, width: number, height: number): { score: number; closed: number; total: number } {
  const gaps = findGapRuns(src, width, height);
  if (!gaps.length) return { score: 1, closed: 0, total: 0 };
  let closed = 0;
  let narrowed = 0;
  for (const gap of gaps) {
    let white = 0;
    if (gap.axis === 'h') {
      for (let x = gap.a; x <= gap.b; x++) if (!dest[gap.pos * width + x]) white += 1;
    } else {
      for (let y = gap.a; y <= gap.b; y++) if (!dest[y * width + gap.pos]) white += 1;
    }
    if (white === 0) closed += 1;
    else if (white < gap.width * 0.4) narrowed += 1;
  }
  const score = 1 - (closed + narrowed * 0.5) / gaps.length;
  return { score: Math.max(0, score), closed, total: gaps.length };
}

function floodExterior(ink: Uint8Array, width: number, height: number): Uint8Array {
  const seen = new Uint8Array(ink.length);
  const stack = new Int32Array(ink.length);
  let sp = 0;
  const push = (p: number) => {
    if (ink[p] || seen[p]) return;
    seen[p] = 1;
    stack[sp++] = p;
  };
  for (let x = 0; x < width; x++) {
    push(x);
    push((height - 1) * width + x);
  }
  for (let y = 0; y < height; y++) {
    push(y * width);
    push(y * width + width - 1);
  }
  while (sp > 0) {
    const p = stack[--sp];
    const x = p % width;
    const y = (p / width) | 0;
    if (x > 0) push(p - 1);
    if (x + 1 < width) push(p + 1);
    if (y > 0) push(p - width);
    if (y + 1 < height) push(p + width);
  }
  return seen;
}

function newPinholeCount(src: Uint8Array, dest: Uint8Array, width: number, height: number): number {
  const destExt = floodExterior(dest, width, height);
  const seen = new Uint8Array(dest.length);
  let count = 0;
  const stack = new Int32Array(dest.length);
  for (let start = 0; start < dest.length; start++) {
    if (dest[start] || destExt[start] || seen[start]) continue;
    let sp = 0;
    let area = 0;
    let srcInk = 0;
    stack[sp++] = start;
    seen[start] = 1;
    while (sp > 0) {
      const p = stack[--sp];
      area += 1;
      if (src[p]) srcInk += 1;
      const x = p % width;
      const y = (p / width) | 0;
      const tryPush = (np: number) => {
        if (dest[np] || destExt[np] || seen[np]) return;
        seen[np] = 1;
        stack[sp++] = np;
      };
      if (x > 0) tryPush(p - 1);
      if (x + 1 < width) tryPush(p + 1);
      if (y > 0) tryPush(p - width);
      if (y + 1 < height) tryPush(p + width);
    }
    if (area >= 1 && area <= 12 && srcInk >= area * 0.7) count += 1;
  }
  return count;
}

function regionalCoverageRatios(src: Uint8Array, dest: Uint8Array, width: number, height: number): number[] {
  const cols = 3;
  const rows = 3;
  const ratios: number[] = [];
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const x0 = Math.floor((col * width) / cols);
      const x1 = Math.floor(((col + 1) * width) / cols);
      const y0 = Math.floor((row * height) / rows);
      const y1 = Math.floor(((row + 1) * height) / rows);
      let srcInk = 0;
      let destInk = 0;
      for (let y = y0; y < y1; y++) {
        for (let x = x0; x < x1; x++) {
          const p = y * width + x;
          if (src[p]) srcInk += 1;
          if (dest[p]) destInk += 1;
        }
      }
      if (srcInk < 16) continue;
      ratios.push(destInk / srcInk);
    }
  }
  return ratios;
}

function majorComponents(ink: Uint8Array, width: number, height: number, minArea = 10): Array<{ area: number; x: number; y: number; w: number; h: number }> {
  const seen = new Uint8Array(ink.length);
  const parts: Array<{ area: number; x: number; y: number; w: number; h: number }> = [];
  const stack = new Int32Array(ink.length);
  for (let start = 0; start < ink.length; start++) {
    if (!ink[start] || seen[start]) continue;
    let sp = 0;
    let area = 0;
    let minX = width;
    let minY = height;
    let maxX = 0;
    let maxY = 0;
    stack[sp++] = start;
    seen[start] = 1;
    while (sp > 0) {
      const p = stack[--sp];
      area += 1;
      const x = p % width;
      const y = (p / width) | 0;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (!dx && !dy) continue;
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
          const np = ny * width + nx;
          if (!ink[np] || seen[np]) continue;
          seen[np] = 1;
          stack[sp++] = np;
        }
      }
    }
    if (area >= minArea) parts.push({ area, x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 });
  }
  return parts;
}

function componentPreservation(src: Uint8Array, dest: Uint8Array, width: number, height: number): number {
  const parts = majorComponents(src, width, height, 10);
  if (!parts.length) return 1;
  let kept = 0;
  for (const part of parts) {
    let overlap = 0;
    for (let y = part.y; y < part.y + part.h; y++) {
      for (let x = part.x; x < part.x + part.w; x++) {
        const p = y * width + x;
        if (src[p] && dest[p]) overlap += 1;
      }
    }
    if (overlap >= Math.max(4, part.area * 0.35)) kept += 1;
  }
  return kept / parts.length;
}

function regionalRecall(src: Uint8Array, dest: Uint8Array, width: number, height: number): number {
  const cols = 3;
  const rows = 3;
  let worst = 1;
  let used = 0;
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const x0 = Math.floor((col * width) / cols);
      const x1 = Math.floor(((col + 1) * width) / cols);
      const y0 = Math.floor((row * height) / rows);
      const y1 = Math.floor(((row + 1) * height) / rows);
      let need = 0;
      let hit = 0;
      for (let y = y0; y < y1; y++) {
        for (let x = x0; x < x1; x++) {
          const p = y * width + x;
          if (!src[p]) continue;
          need += 1;
          if (dest[p]) hit += 1;
        }
      }
      if (need < 12) continue;
      used += 1;
      worst = Math.min(worst, hit / need);
    }
  }
  return used ? worst : 1;
}

function pathComplexityScore(svg: string | undefined): number {
  if (!svgIsTrueVector(svg)) return 0;
  if (svgHasFillStroke(svg)) return 20;
  const numbers = svg!.match(/-?\d+\.?\d*/g) ?? [];
  const nodes = numbers.length / 2;
  return nodes > 8 ? 90 : 60;
}

function qualityLabel(overall: number, passed: boolean, detail: number, smoothness: number, topologyFailed: boolean): ColoringQualityLabel {
  if (topologyFailed) return 'Needs review';
  if (!passed && detail < 80) return 'Failed';
  if (!passed) return 'Needs reprocessing';
  if (smoothness < 72) return 'Fair';
  if (overall >= 92 && smoothness >= 86) return 'Excellent';
  if (overall >= 80) return 'Good';
  return 'Fair';
}

export function scoreColoringResult(
  source: PixelBuffer,
  enhanced: PixelBuffer,
  svg: string | undefined,
  candidate: string
): ColoringQualityReport {
  const { srcInk, destInk, width, height } = sameSizeMask(source, enhanced);
  const srcEdges = edgeMask(srcInk, width, height);
  const destEdges = edgeMask(destInk, width, height);
  const srcSkeleton = skeletonize(srcInk, width, height);
  const skeletonRecall = clampScore(recallWithTolerance(srcSkeleton, destInk, width, height, 1) * 100);
  const edgeRecall = clampScore(recallWithTolerance(srcEdges, destEdges, width, height, 1) * 100);
  const components = clampScore(componentPreservation(srcInk, destInk, width, height) * 100);
  const regional = regionalRecall(srcInk, destInk, width, height);
  const extra = extraInkRatio(srcInk, destInk, width, height, 1);
  const srcCov = countInk(srcInk) / Math.max(1, srcInk.length);
  const destCov = countInk(destInk) / Math.max(1, destInk.length);
  const coverageRatio = srcCov > 0 ? destCov / srcCov : 1;
  const inkCoverageDiff = clampScore(Math.abs(coverageRatio - 1) * 100);
  const srcWidth = medianStrokeWidth(srcInk, width, height);
  const destWidth = medianStrokeWidth(destInk, width, height);
  const widthDrift = Math.abs(destWidth - srcWidth) / Math.max(0.75, srcWidth);
  const localDev = localWidthDeviations(srcInk, destInk, width, height);
  const localP90 = localDev.length ? percentile(localDev, 0.9) : widthDrift;
  const localWidthFidelity = clampScore((1 - Math.min(1, localP90)) * 100);
  const lineWidthFidelity = clampScore((1 - Math.min(1, Math.max(widthDrift, localP90 * 0.85))) * 100);
  const gaps = gapPreservationScore(srcInk, destInk, width, height);
  const gapPreservation = clampScore(gaps.score * 100);
  const destOnGaps = extraInkInGaps(srcInk, destInk, width, height);
  const negativeSpacePreservation = clampScore((1 - destOnGaps) * 100);
  const pinholes = newPinholeCount(srcInk, destInk, width, height);
  const coverageTiles = regionalCoverageRatios(srcInk, destInk, width, height);
  const worstAbs = coverageTiles.length ? coverageTiles.reduce((worst, ratio) => (Math.abs(ratio - 1) > Math.abs(worst - 1) ? ratio : worst), 1) : coverageRatio;
  const worstRegionCoverage = clampScore((1 - Math.min(1, Math.abs(worstAbs - 1))) * 100);
  const closedRatio = gaps.total ? gaps.closed / gaps.total : 0;
  const topologyFailed = closedRatio >= 0.08 || destOnGaps > 0.15 || Math.abs(worstAbs - 1) > 0.42;
  const topologyPreservation = clampScore((gaps.score * 0.6 + (1 - destOnGaps) * 0.4) * (topologyFailed ? 0 : 100));
  const detailRetention = clampScore(skeletonRecall * 0.4 + edgeRecall * 0.3 + components * 0.2 + regional * 100 * 0.1);
  const geo = analyzeSvgGeometry(svg);
  const rasterJagged = measureJagginess(destInk, width, height);
  const stairPenalty = geo.cubicCount === 0 && geo.lineCount > 24 ? 0.55 : geo.roughness;
  const curveRoughness = Math.max(rasterJagged, stairPenalty);
  const curveSmoothness = clampScore((1 - curveRoughness) * 100);
  const lineContinuity = clampScore(recallWithTolerance(srcInk, destInk, width, height, 1) * 100);
  const printSafety = clampScore(destWidth >= 1 ? 90 : 70);
  const artifactLevel = clampScore((1 - extra) * 100);
  const pathComplexity = clampScore(pathComplexityScore(svg));
  const failedHard =
    topologyFailed ||
    gapPreservation < 98 && gaps.total > 0 ||
    pinholes > 2 ||
    detailRetention < 80 ||
    skeletonRecall < 80 ||
    lineWidthFidelity < 82 ||
    localWidthFidelity < 82 ||
    worstRegionCoverage < 62 ||
    coverageRatio > 1.28 ||
    coverageRatio < 0.72 ||
    extra > 0.28 ||
    Boolean(svg && svgHasFillStroke(svg));
  const needsRetry =
    failedHard ||
    detailRetention < 90 ||
    lineWidthFidelity < 88 ||
    localWidthFidelity < 88 ||
    components < 90 ||
    (gaps.total > 0 && gapPreservation < 98) ||
    (geo.hasPath && geo.cubicCount === 0 && geo.lineCount > 40);
  const passed = !needsRetry && svgIsTrueVector(svg);
  const rawOverall = clampScore(
    topologyPreservation * 0.2 +
      negativeSpacePreservation * 0.15 +
      detailRetention * 0.25 +
      lineWidthFidelity * 0.2 +
      curveSmoothness * 0.1 +
      components * 0.07 +
      artifactLevel * 0.03
  );
  const overall = failedHard ? Math.min(rawOverall, detailRetention, lineWidthFidelity, topologyFailed ? 40 : 100) : rawOverall;
  return {
    overall,
    detailRetention,
    skeletonRecall,
    edgeRecall,
    componentPreservation: components,
    lineWidthFidelity,
    localWidthFidelity,
    negativeSpacePreservation,
    topologyPreservation,
    gapPreservation,
    worstRegionCoverage,
    newPinholeCount: pinholes,
    inkCoverageDiff,
    curveSmoothness,
    curveRoughness: clampScore(curveRoughness * 100),
    cubicCount: geo.cubicCount,
    lineCount: geo.lineCount,
    lineContinuity,
    printSafety,
    artifactLevel,
    pathComplexity,
    label: qualityLabel(overall, passed, detailRetention, curveSmoothness, topologyFailed),
    candidate,
    passed,
    vectorReady: passed && !topologyFailed,
  };
}

function extraInkInGaps(src: Uint8Array, dest: Uint8Array, width: number, height: number): number {
  const gaps = findGapRuns(src, width, height);
  if (!gaps.length) return 0;
  let need = 0;
  let extra = 0;
  for (const gap of gaps) {
    if (gap.axis === 'h') {
      for (let x = gap.a; x <= gap.b; x++) {
        need += 1;
        if (dest[gap.pos * width + x]) extra += 1;
      }
    } else {
      for (let y = gap.a; y <= gap.b; y++) {
        need += 1;
        if (dest[y * width + gap.pos]) extra += 1;
      }
    }
  }
  return need ? extra / need : 0;
}

export function compareQuality(a: ColoringQualityReport, b: ColoringQualityReport): number {
  if (a.passed !== b.passed) return a.passed ? -1 : 1;
  if (a.topologyPreservation !== b.topologyPreservation) return b.topologyPreservation - a.topologyPreservation;
  if (a.negativeSpacePreservation !== b.negativeSpacePreservation) return b.negativeSpacePreservation - a.negativeSpacePreservation;
  if (a.detailRetention !== b.detailRetention) return b.detailRetention - a.detailRetention;
  if (a.lineWidthFidelity !== b.lineWidthFidelity) return b.lineWidthFidelity - a.lineWidthFidelity;
  if (a.curveSmoothness !== b.curveSmoothness) return b.curveSmoothness - a.curveSmoothness;
  return b.overall - a.overall;
}

export function qualityLabelFromReport(report: ColoringQualityReport): ColoringQualityLabel {
  return report.label;
}
