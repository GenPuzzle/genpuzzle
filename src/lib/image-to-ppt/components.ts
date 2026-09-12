import type { PixelRect } from './types';
import { createLocalId, horizontalOverlapRatio, rectsOverlap, unionRects } from './geometry';
import type { GraphicPart } from './types';

export interface LabeledComponent {
  id: number;
  bbox: PixelRect;
  area: number;
  partId: string;
}

export function labelConnectedComponents(
  mask: Uint8Array,
  width: number,
  height: number
): { labels: Int32Array; components: LabeledComponent[] } {
  const labels = new Int32Array(width * height);
  const parent: number[] = [0];

  const find = (n: number): number => {
    while (parent[n] !== n) {
      parent[n] = parent[parent[n]];
      n = parent[n];
    }
    return n;
  };
  const union = (a: number, b: number) => {
    const pa = find(a);
    const pb = find(b);
    if (pa !== pb) parent[pb] = pa;
  };

  let next = 1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      if (!mask[i]) continue;
      const neighbors: number[] = [];
      if (x > 0 && labels[i - 1]) neighbors.push(labels[i - 1]);
      if (y > 0 && labels[i - width]) neighbors.push(labels[i - width]);
      if (x > 0 && y > 0 && labels[i - width - 1]) neighbors.push(labels[i - width - 1]);
      if (x + 1 < width && y > 0 && labels[i - width + 1]) neighbors.push(labels[i - width + 1]);
      if (neighbors.length === 0) {
        parent[next] = next;
        labels[i] = next;
        next += 1;
      } else {
        const first = neighbors[0];
        labels[i] = first;
        for (let n = 1; n < neighbors.length; n++) union(first, neighbors[n]);
      }
    }
  }

  const remap = new Map<number, number>();
  let compact = 1;
  const boxes = new Map<number, { x1: number; y1: number; x2: number; y2: number; area: number }>();
  for (let i = 0; i < labels.length; i++) {
    if (!labels[i]) continue;
    const root = find(labels[i]);
    let id = remap.get(root);
    if (!id) {
      id = compact++;
      remap.set(root, id);
    }
    labels[i] = id;
    const x = i % width;
    const y = Math.floor(i / width);
    const box = boxes.get(id);
    if (!box) {
      boxes.set(id, { x1: x, y1: y, x2: x, y2: y, area: 1 });
    } else {
      box.x1 = Math.min(box.x1, x);
      box.y1 = Math.min(box.y1, y);
      box.x2 = Math.max(box.x2, x);
      box.y2 = Math.max(box.y2, y);
      box.area += 1;
    }
  }

  const minArea = Math.max(18, Math.round((width * height) / 180000));
  const components: LabeledComponent[] = [];
  for (const [id, box] of boxes) {
    if (box.area < minArea) {
      for (let i = 0; i < labels.length; i++) {
        if (labels[i] === id) labels[i] = 0;
      }
      continue;
    }
    components.push({
      id,
      partId: createLocalId('part'),
      area: box.area,
      bbox: {
        x: box.x1,
        y: box.y1,
        width: box.x2 - box.x1 + 1,
        height: box.y2 - box.y1 + 1,
      },
    });
  }

  return { labels, components };
}

export function groupNearbyComponents(
  components: LabeledComponent[],
  pageWidth: number,
  pageHeight: number,
  mergeGapRatio = 0.006
): Array<{ bbox: PixelRect; parts: GraphicPart[]; area: number }> {
  const mergeGap = Math.max(2, Math.round(Math.min(pageWidth, pageHeight) * mergeGapRatio));
  const used = new Set<number>();
  const groups: Array<{ bbox: PixelRect; parts: GraphicPart[]; area: number }> = [];

  const sorted = [...components].sort((a, b) => a.bbox.y - b.bbox.y || a.bbox.x - b.bbox.x);
  for (let i = 0; i < sorted.length; i++) {
    if (used.has(sorted[i].id)) continue;
    const cluster = [sorted[i]];
    used.add(sorted[i].id);
    let grew = true;
    while (grew) {
      grew = false;
      const clusterBox = unionRects(cluster.map((item) => item.bbox));
      const clusterArea = cluster.reduce((sum, item) => sum + item.area, 0);
      for (let j = i + 1; j < sorted.length; j++) {
        const candidate = sorted[j];
        if (used.has(candidate.id)) continue;
        if (!rectsOverlap(clusterBox, candidate.bbox, mergeGap)) continue;
        const combined = clusterArea + candidate.area;
        const union = unionRects([clusterBox, candidate.bbox]);
        const unionArea = union.width * union.height;
        if (unionArea > combined * 5.5) continue;

        const vGap = candidate.bbox.y - (clusterBox.y + clusterBox.height);
        const stackedRows =
          vGap > 3 &&
          horizontalOverlapRatio(clusterBox, candidate.bbox) > 0.72 &&
          Math.min(clusterBox.width, candidate.bbox.width) > pageWidth * 0.1;
        if (stackedRows) continue;

        cluster.push(candidate);
        used.add(candidate.id);
        grew = true;
      }
    }
    groups.push({
      bbox: unionRects(cluster.map((item) => item.bbox)),
      area: cluster.reduce((sum, item) => sum + item.area, 0),
      parts: cluster.map((item) => ({ id: item.partId, bbox: item.bbox, area: item.area })),
    });
  }

  return splitOversizedGroups(groups, pageWidth, pageHeight, mergeGapRatio);
}

function splitOversizedGroups(
  groups: Array<{ bbox: PixelRect; parts: GraphicPart[]; area: number }>,
  pageWidth: number,
  pageHeight: number,
  mergeGapRatio: number
): Array<{ bbox: PixelRect; parts: GraphicPart[]; area: number }> {
  if (mergeGapRatio <= 0.003) return groups;
  const pageArea = pageWidth * pageHeight;
  const out: Array<{ bbox: PixelRect; parts: GraphicPart[]; area: number }> = [];
  for (const group of groups) {
    const boxArea = group.bbox.width * group.bbox.height;
    const huge = boxArea > pageArea * 0.42;
    const sparse = boxArea > group.area * 8;
    if (group.parts.length < 3 || (!huge && !sparse)) {
      out.push(group);
      continue;
    }
    const asComponents: LabeledComponent[] = group.parts.map((part, index) => ({
      id: index + 1,
      partId: part.id,
      bbox: part.bbox,
      area: part.area,
    }));
    const tighter = groupNearbyComponents(asComponents, pageWidth, pageHeight, Math.max(0.002, mergeGapRatio * 0.45));
    if (tighter.length > 1) out.push(...tighter);
    else out.push(group);
  }
  return out;
}

export function componentTouchesText(
  bbox: PixelRect,
  textBoxes: PixelRect[],
  overlapRatio = 0.55
): boolean {
  const area = Math.max(1, bbox.width * bbox.height);
  for (const text of textBoxes) {
    const x1 = Math.max(bbox.x, text.x);
    const y1 = Math.max(bbox.y, text.y);
    const x2 = Math.min(bbox.x + bbox.width, text.x + text.width);
    const y2 = Math.min(bbox.y + bbox.height, text.y + text.height);
    if (x2 <= x1 || y2 <= y1) continue;
    const overlap = (x2 - x1) * (y2 - y1);
    if (overlap / area >= overlapRatio) return true;
  }
  return false;
}
