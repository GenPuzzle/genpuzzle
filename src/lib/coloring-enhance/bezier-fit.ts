export interface Point {
  x: number;
  y: number;
}

export interface Cubic {
  p0: Point;
  c1: Point;
  c2: Point;
  p3: Point;
}

export interface SvgGeometryStats {
  lineCount: number;
  cubicCount: number;
  nodeCount: number;
  roughness: number;
  hasImage: boolean;
  hasPath: boolean;
}

function hypot(a: Point, b: Point): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

function sub(a: Point, b: Point): Point {
  return { x: a.x - b.x, y: a.y - b.y };
}

function add(a: Point, b: Point): Point {
  return { x: a.x + b.x, y: a.y + b.y };
}

function mul(a: Point, s: number): Point {
  return { x: a.x * s, y: a.y * s };
}

function unit(a: Point): Point {
  const len = Math.hypot(a.x, a.y) || 1;
  return { x: a.x / len, y: a.y / len };
}

function dot(a: Point, b: Point): number {
  return a.x * b.x + a.y * b.y;
}

function turningAngle(a: Point, b: Point, c: Point): number {
  const u = unit(sub(b, a));
  const v = unit(sub(c, b));
  return (Math.acos(Math.max(-1, Math.min(1, dot(u, v)))) * 180) / Math.PI;
}

export function collapseRasterStairs(ring: number[]): Point[] {
  const pts: Point[] = [];
  for (let i = 0; i < ring.length; i += 2) pts.push({ x: ring[i], y: ring[i + 1] });
  if (pts.length < 4) return pts;
  const out: Point[] = [pts[0]];
  for (let i = 1; i < pts.length - 1; i++) {
    const prev = out[out.length - 1];
    const cur = pts[i];
    const next = pts[i + 1];
    const ab = hypot(prev, cur);
    const bc = hypot(cur, next);
    const angle = turningAngle(prev, cur, next);
    const stair = ab < 1.35 && bc < 1.35 && angle > 70 && angle < 110;
    if (stair) continue;
    if (ab < 0.2) continue;
    out.push(cur);
  }
  out.push(pts[pts.length - 1]);
  if (out.length >= 3 && hypot(out[0], out[out.length - 1]) < 0.4) out.pop();
  return out;
}

function findCorners(pts: Point[]): number[] {
  const corners: number[] = [];
  const n = pts.length;
  if (n < 4) return corners;
  for (let i = 0; i < n; i++) {
    const prev = pts[(i + n - 1) % n];
    const cur = pts[i];
    const next = pts[(i + 1) % n];
    const back = hypot(prev, cur);
    const forward = hypot(cur, next);
    if (back < 1.6 || forward < 1.6) continue;
    const angle = turningAngle(prev, cur, next);
    if (angle >= 36) corners.push(i);
  }
  return corners;
}

function chordParams(pts: Point[]): number[] {
  const u = [0];
  let total = 0;
  for (let i = 1; i < pts.length; i++) {
    total += hypot(pts[i], pts[i - 1]);
    u.push(total);
  }
  if (!total) return pts.map((_, index) => (pts.length === 1 ? 0 : index / (pts.length - 1)));
  return u.map((value) => value / total);
}

function bezierAt(cubic: Cubic, t: number): Point {
  const mt = 1 - t;
  const a = mt * mt * mt;
  const b = 3 * mt * mt * t;
  const c = 3 * mt * t * t;
  const d = t * t * t;
  return {
    x: a * cubic.p0.x + b * cubic.c1.x + c * cubic.c2.x + d * cubic.p3.x,
    y: a * cubic.p0.y + b * cubic.c1.y + c * cubic.c2.y + d * cubic.p3.y,
  };
}

function generateBezier(pts: Point[], u: number[], tan1: Point, tan2: Point): Cubic {
  const p0 = pts[0];
  const p3 = pts[pts.length - 1];
  let c11 = 0;
  let c12 = 0;
  let c22 = 0;
  let x1 = 0;
  let x2 = 0;
  for (let i = 0; i < pts.length; i++) {
    const t = u[i];
    const b0 = (1 - t) ** 3;
    const b1 = 3 * (1 - t) ** 2 * t;
    const b2 = 3 * (1 - t) * t ** 2;
    const b3 = t ** 3;
    const a1 = mul(tan1, b1);
    const a2 = mul(tan2, b2);
    c11 += dot(a1, a1);
    c12 += dot(a1, a2);
    c22 += dot(a2, a2);
    const tmp = sub(pts[i], add(mul(p0, b0 + b1), mul(p3, b2 + b3)));
    x1 += dot(tmp, a1);
    x2 += dot(tmp, a2);
  }
  const den = c11 * c22 - c12 * c12;
  let alpha1 = Math.abs(den) < 1e-8 ? 0 : (c22 * x1 - c12 * x2) / den;
  let alpha2 = Math.abs(den) < 1e-8 ? 0 : (c11 * x2 - c12 * x1) / den;
  const dist = hypot(p0, p3);
  const minAlpha = dist * 1e-3;
  if (alpha1 < minAlpha || alpha2 < minAlpha || !Number.isFinite(alpha1) || !Number.isFinite(alpha2)) {
    const d = dist / 3;
    return { p0, c1: add(p0, mul(tan1, d)), c2: add(p3, mul(tan2, d)), p3 };
  }
  alpha1 = Math.min(alpha1, dist);
  alpha2 = Math.min(alpha2, dist);
  return { p0, c1: add(p0, mul(tan1, alpha1)), c2: add(p3, mul(tan2, alpha2)), p3 };
}

function maxError(pts: Point[], cubic: Cubic, u: number[]): { dist: number; index: number } {
  let dist = 0;
  let index = Math.floor(pts.length / 2);
  for (let i = 1; i < pts.length - 1; i++) {
    const d = hypot(pts[i], bezierAt(cubic, u[i]));
    if (d > dist) {
      dist = d;
      index = i;
    }
  }
  return { dist, index };
}

function fitSpan(pts: Point[], tan1: Point, tan2: Point, error: number, depth = 0): Cubic[] {
  if (pts.length < 2 || depth > 10) return [];
  if (pts.length === 2 || pts.length === 3) {
    const d = hypot(pts[0], pts[pts.length - 1]) / 3;
    return [{ p0: pts[0], c1: add(pts[0], mul(tan1, d)), c2: add(pts[pts.length - 1], mul(tan2, d)), p3: pts[pts.length - 1] }];
  }
  let u = chordParams(pts);
  let cubic = generateBezier(pts, u, tan1, tan2);
  let err = maxError(pts, cubic, u);
  if (err.dist <= error) return [cubic];
  if (err.dist <= error * 3.5) {
    for (let i = 0; i < 5; i++) {
      u = chordParams(pts.map((point, index) => (index === 0 || index === pts.length - 1 ? point : bezierAt(cubic, u[index]))));
      u = chordParams(pts);
      cubic = generateBezier(pts, u, tan1, tan2);
      err = maxError(pts, cubic, u);
      if (err.dist <= error) return [cubic];
    }
  }
  const split = Math.max(1, Math.min(pts.length - 2, err.index));
  const center = unit(sub(pts[Math.min(pts.length - 1, split + 1)], pts[Math.max(0, split - 1)]));
  return [
    ...fitSpan(pts.slice(0, split + 1), tan1, center, error, depth + 1),
    ...fitSpan(pts.slice(split), mul(center, -1), tan2, error, depth + 1),
  ];
}

function tangentAt(pts: Point[], index: number, dir: 1 | -1): Point {
  const n = pts.length;
  const a = pts[(index + n) % n];
  const b = pts[(index + dir + n) % n];
  return unit(sub(b, a));
}

export function fitOpenPolyline(points: Point[], error = 0.7): Cubic[] {
  const pts = points.filter((point, index) => index === 0 || hypot(point, points[index - 1]) > 0.15);
  if (pts.length < 2) return [];
  const corners = [0];
  for (let i = 1; i < pts.length - 1; i++) {
    const back = hypot(pts[i - 1], pts[i]);
    const forward = hypot(pts[i], pts[i + 1]);
    if (back >= 1.4 && forward >= 1.4 && turningAngle(pts[i - 1], pts[i], pts[i + 1]) >= 34) corners.push(i);
  }
  corners.push(pts.length - 1);
  const unique = [...new Set(corners)].sort((a, b) => a - b);
  const cubics: Cubic[] = [];
  for (let i = 0; i < unique.length - 1; i++) {
    const span = pts.slice(unique[i], unique[i + 1] + 1);
    if (span.length < 2) continue;
    const tan1 = unit(sub(span[1], span[0]));
    const tan2 = unit(sub(span[span.length - 2], span[span.length - 1]));
    cubics.push(...fitSpan(span, tan1, tan2, error));
  }
  return cubics;
}

export function fitClosedRing(ring: number[], error = 0.9): Cubic[] {
  const pts = collapseRasterStairs(ring);
  if (pts.length < 4) return [];
  const corners = findCorners(pts);
  const splits = corners.length >= 2 ? corners : [0, Math.floor(pts.length / 3), Math.floor((pts.length * 2) / 3)];
  const unique = [...new Set(splits)].sort((a, b) => a - b);
  const cubics: Cubic[] = [];
  for (let i = 0; i < unique.length; i++) {
    const start = unique[i];
    const end = unique[(i + 1) % unique.length];
    const span: Point[] = [];
    if (end > start) {
      for (let p = start; p <= end; p++) span.push(pts[p]);
    } else {
      for (let p = start; p < pts.length; p++) span.push(pts[p]);
      for (let p = 0; p <= end; p++) span.push(pts[p]);
    }
    if (span.length < 2) continue;
    const tan1 = tangentAt(pts, start, 1);
    const tan2 = tangentAt(pts, end, -1);
    cubics.push(...fitSpan(span, tan1, tan2, error));
  }
  return cubics;
}

export function flattenCubics(cubics: Cubic[], steps = 8): number[] {
  const ring: number[] = [];
  for (const cubic of cubics) {
    for (let i = 0; i < steps; i++) {
      const p = bezierAt(cubic, i / steps);
      ring.push(p.x, p.y);
    }
  }
  return ring;
}

export function cubicsToPath(cubics: Cubic[]): string {
  if (!cubics.length) return '';
  let d = `M${cubics[0].p0.x.toFixed(2)} ${cubics[0].p0.y.toFixed(2)}`;
  for (const cubic of cubics) {
    d += `C${cubic.c1.x.toFixed(2)} ${cubic.c1.y.toFixed(2)} ${cubic.c2.x.toFixed(2)} ${cubic.c2.y.toFixed(2)} ${cubic.p3.x.toFixed(2)} ${cubic.p3.y.toFixed(2)}`;
  }
  return `${d}Z`;
}

export function analyzeSvgGeometry(svg: string | undefined): SvgGeometryStats {
  if (!svg) return { lineCount: 0, cubicCount: 0, nodeCount: 0, roughness: 1, hasImage: false, hasPath: false };
  const hasImage = /<image\b/i.test(svg);
  const hasPath = /<path\b/i.test(svg);
  const lineCount = (svg.match(/L/g) ?? []).length;
  const cubicCount = (svg.match(/C/g) ?? []).length;
  const nodeCount = (svg.match(/-?\d+\.?\d*/g) ?? []).length / 2;
  const commands = svg.match(/[MLC][^MLCZ]*/g) ?? [];
  let turns = 0;
  let stairs = 0;
  let last: Point | null = null;
  let prevVec: Point | null = null;
  for (const command of commands) {
    const kind = command[0];
    const nums = (command.slice(1).match(/-?\d+\.?\d*/g) ?? []).map(Number);
    if (kind === 'M' && nums.length >= 2) {
      last = { x: nums[0], y: nums[1] };
      prevVec = null;
    } else if (kind === 'L' && nums.length >= 2 && last) {
      const next = { x: nums[0], y: nums[1] };
      const vec = sub(next, last);
      const len = Math.hypot(vec.x, vec.y);
      if (prevVec && len > 0 && len < 2.4) {
        const angle = (Math.acos(Math.max(-1, Math.min(1, dot(unit(prevVec), unit(vec))))) * 180) / Math.PI;
        turns += 1;
        if (angle > 70 && angle < 110) stairs += 1;
      }
      prevVec = vec;
      last = next;
    } else if (kind === 'C' && nums.length >= 6) {
      last = { x: nums[4], y: nums[5] };
      prevVec = null;
    }
  }
  const roughness = cubicCount > lineCount * 2 ? Math.min(0.2, stairs / Math.max(1, turns)) : turns ? stairs / turns : lineCount > 20 ? 0.7 : 0.3;
  return { lineCount, cubicCount, nodeCount, roughness, hasImage, hasPath };
}

export function svgWithDebugOverlay(svg: string): string {
  const cubics = [...svg.matchAll(/C(-?[\d.]+) (-?[\d.]+) (-?[\d.]+) (-?[\d.]+) (-?[\d.]+) (-?[\d.]+)/g)];
  const marks = cubics
    .map((match) => {
      const [, c1x, c1y, c2x, c2y, x, y] = match;
      return `<circle cx="${x}" cy="${y}" r="0.7" fill="#2563eb"/><circle cx="${c1x}" cy="${c1y}" r="0.45" fill="#f59e0b"/><circle cx="${c2x}" cy="${c2y}" r="0.45" fill="#f59e0b"/>`;
    })
    .join('');
  return svg.replace('</svg>', `${marks}</svg>`);
}
