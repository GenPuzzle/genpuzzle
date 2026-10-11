import { enhanceColoringPage } from './pipeline';
import { analyzeColoringSource, fileStem, svgHasTrueVectorPaths } from './analyze';
import { enhancedFileName } from './export';
import { scoreColoringResult, svgIsTrueVector } from './quality';
import { analyzeSvgGeometry } from './bezier-fit';
import { svgHasFillStroke } from './vectorize';
import { COLORING_PRINT_PPI, printPixelSize } from './export';
import { DEFAULT_COLORING_ENHANCE_SETTINGS } from './types';
import { settingsToThreshold, settingsToUpscale, settingsToVtracerOptions, settingsToWeightRadius } from './vtracer-engine';
import type { PixelBuffer } from '@/lib/sprite-sheet-importer';

function fail(message: string): never {
  throw new Error(message);
}

function assert(condition: unknown, message: string): void {
  if (!condition) fail(message);
}

function blank(width: number, height: number, fill = false): PixelBuffer {
  const buf = { data: new Uint8ClampedArray(width * height * 4), width, height };
  if (fill) {
    for (let i = 0; i < buf.data.length; i += 4) {
      buf.data[i] = 255;
      buf.data[i + 1] = 255;
      buf.data[i + 2] = 255;
      buf.data[i + 3] = 255;
    }
  }
  return buf;
}

function setPixel(buf: PixelBuffer, x: number, y: number, r: number, g: number, b: number, a: number): void {
  if (x < 0 || y < 0 || x >= buf.width || y >= buf.height) return;
  const i = (y * buf.width + x) * 4;
  buf.data[i] = r;
  buf.data[i + 1] = g;
  buf.data[i + 2] = b;
  buf.data[i + 3] = a;
}

function inkRect(buf: PixelBuffer, x0: number, y0: number, x1: number, y1: number): void {
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) setPixel(buf, x, y, 20, 20, 20, 255);
  }
}

function inkFrame(buf: PixelBuffer, x: number, y: number, w: number, h: number, t = 2): void {
  inkRect(buf, x, y, x + w, y + t);
  inkRect(buf, x, y + h - t, x + w, y + h);
  inkRect(buf, x, y, x + t, y + h);
  inkRect(buf, x + w - t, y, x + w, y + h);
}

function run(): void {
  const stairs = blank(64, 32);
  for (let x = 6; x < 58; x++) {
    const y = 14 + (x % 2);
    setPixel(stairs, x, y, 0, 0, 0, 255);
    setPixel(stairs, x, y + 1, 0, 0, 0, 255);
    setPixel(stairs, x, y + 2, 0, 0, 0, 255);
  }
  setPixel(stairs, 3, 3, 0, 0, 0, 255);

  const profile = analyzeColoringSource(stairs);
  assert(profile.background === 'transparent', 'transparent margins are detected');
  assert(profile.inkRatio > 0, 'ink is measured before enhance');

  const baseline = { smoothness: 50, softness: 50, detail: 75, gapPreservation: 70, lineWeight: 50 };
  const defaultOptions = settingsToVtracerOptions(baseline, 3);
  const highSmooth = settingsToVtracerOptions({ ...baseline, smoothness: 90 }, 3);
  const highSoft = settingsToVtracerOptions({ ...baseline, softness: 90 }, 3);
  const highDetail = settingsToVtracerOptions({ ...baseline, detail: 95 }, 3);
  const highGap = settingsToVtracerOptions({ ...baseline, gapPreservation: 95 }, 3);
  const lowGap = settingsToVtracerOptions({ ...baseline, gapPreservation: 20 }, 3);
  assert(DEFAULT_COLORING_ENHANCE_SETTINGS.smoothness === 80, 'default Smoothness is 80');
  assert(DEFAULT_COLORING_ENHANCE_SETTINGS.softness === 100, 'default Softness is 100');
  assert(DEFAULT_COLORING_ENHANCE_SETTINGS.detail === 50, 'default Detail Preservation is 50');
  assert(DEFAULT_COLORING_ENHANCE_SETTINGS.gapPreservation === 100, 'default Gap Preservation is 100');
  assert(DEFAULT_COLORING_ENHANCE_SETTINGS.lineWeight === 50, 'default Line Weight is 50');
  assert(COLORING_PRINT_PPI === 300, 'print exports are 300 PPI');
  assert(printPixelSize(72, 144).width === 300 && printPixelSize(72, 144).height === 600, '300 PPI maps 72pt to 300px');
  assert(settingsToWeightRadius({ ...baseline, lineWeight: 50 }) === 0, 'mid Line Weight does not change thickness');
  assert(settingsToWeightRadius({ ...baseline, lineWeight: 90 }, 4) > 0, 'high Line Weight thickens ink');
  assert(settingsToWeightRadius({ ...baseline, lineWeight: 10 }, 4) < 0, 'low Line Weight thins ink');
  const thinOptions = settingsToVtracerOptions({ ...baseline, lineWeight: 15 }, 3);
  const thickOptions = settingsToVtracerOptions({ ...baseline, lineWeight: 90 }, 3);
  assert(thinOptions.lengthThreshold === thickOptions.lengthThreshold, 'Line Weight does not change curve smoothing');
  assert(thinOptions.cornerThreshold === thickOptions.cornerThreshold, 'Line Weight does not change corner softness');
  assert(thinOptions.simplify === thickOptions.simplify, 'Line Weight does not change path simplification');
  assert(
    (highSmooth.lengthThreshold ?? 0) > (defaultOptions.lengthThreshold ?? 0),
    'Smoothness increases path simplification tolerance'
  );
  assert((highSmooth.simplify ?? 0) > (defaultOptions.simplify ?? 0), 'Smoothness enables curve simplification');
  assert((highSoft.cornerThreshold ?? 0) > (defaultOptions.cornerThreshold ?? 0), 'Softness relaxes corner detection');
  assert((highSoft.maxIterations ?? 0) > (defaultOptions.maxIterations ?? 0), 'Softness increases spline fitting iterations');
  assert(settingsToUpscale({ ...DEFAULT_COLORING_ENHANCE_SETTINGS, softness: 90 }) >= 5, 'Softness raises supersampling');
  assert((highDetail.filterSpeckle ?? 0) < (defaultOptions.filterSpeckle ?? 0), 'Detail Preservation keeps smaller speckles');
  assert((highDetail.lengthThreshold ?? 0) <= (defaultOptions.lengthThreshold ?? 0), 'Detail Preservation resists over-smoothing');
  assert(settingsToThreshold({ ...DEFAULT_COLORING_ENHANCE_SETTINGS, gapPreservation: 95 }) < 128, 'Gap Preservation uses a darker-only threshold');
  assert((highGap.binaryThreshold ?? 0) < (lowGap.binaryThreshold ?? 0), 'Gap Preservation lowers the ink threshold');
  assert(!('blur' in highSoft) && !('filter' in highSoft), 'Softness does not apply a raster blur');

  const result = enhanceColoringPage(stairs, { profile });
  assert(result.candidates.length >= 3, 'multiple conservative trace candidates are generated');
  assert(result.candidates.some((item) => item.name.startsWith('vtracer')), 'the VTracer engine is used');
  if (result.quality.vectorReady) {
    assert(svgIsTrueVector(result.svg), 'accepted output is a true SVG path, not a raster wrapper');
    assert(!result.svg.includes('<image'), 'SVG output does not embed a bitmap');
    assert(!svgHasFillStroke(result.svg), 'accepted SVG does not add a stroke on top of filled ink');
    assert(result.svg.includes('stroke="none"'), 'filled ink paths have stroke disabled');
    assert(result.svg.includes('C'), 'accepted SVG uses cubic Bézier curves, not only pixel polylines');
    assert((analyzeSvgGeometry(result.svg).cubicCount || 0) > 0, 'the path data contains cubic segments');
  }
  assert(result.quality.detailRetention >= 80, 'a simple line drawing keeps high detail retention');
  assert(result.quality.lineWidthFidelity >= 80, 'line width stays close to the source');

  const defaulted = enhanceColoringPage(stairs, { profile, settings: DEFAULT_COLORING_ENHANCE_SETTINGS });
  assert(defaulted.quality.candidate === 'vtracer-custom', 'default sliders drive a real VTracer pass');
  assert(!!defaulted.svg && defaulted.svg.includes('C'), 'default slider pass still emits cubic curves');

  const again = scoreColoringResult(stairs, result.image, result.svg || result.candidates[0]?.svg, result.quality.candidate);
  const twice = scoreColoringResult(stairs, result.image, result.svg || result.candidates[0]?.svg, result.quality.candidate);
  assert(again.overall === twice.overall, 'quality scoring is deterministic');
  assert(again.detailRetention === twice.detailRetention, 'repeat scoring matches the first pass');

  const vectorSvg = '<svg xmlns="http://www.w3.org/2000/svg"><path d="M2 2 L20 2 L20 20 Z"/></svg>';
  const rasterWrap = '<svg xmlns="http://www.w3.org/2000/svg"><image href="data:image/png;base64,xx"/></svg>';
  assert(svgHasTrueVectorPaths(vectorSvg), 'existing SVG paths are recognized');
  assert(!svgHasTrueVectorPaths(rasterWrap), 'an SVG that only wraps a bitmap is not treated as vector');

  const kept = enhanceColoringPage(stairs, { isSvg: true, svgText: vectorSvg, profile });
  assert(kept.candidates.some((item) => item.name === 'source-svg'), 'clean source SVG is scored as its own candidate');

  const rawCustom = enhanceColoringPage(stairs, {
    profile,
    settings: { smoothness: 8, softness: 8, detail: 95, gapPreservation: 90, lineWeight: 50 },
  });
  const polishedCustom = enhanceColoringPage(stairs, {
    profile,
    settings: { smoothness: 92, softness: 88, detail: 40, gapPreservation: 40, lineWeight: 50 },
  });
  assert(rawCustom.candidates.length === 1, 'custom sliders run a single tuned VTracer pass');
  assert(rawCustom.quality.candidate === 'vtracer-custom', 'custom pass is named vtracer-custom');
  assert(polishedCustom.quality.candidate === 'vtracer-custom', 'high-smooth custom pass is named vtracer-custom');
  assert(
    rawCustom.svg !== polishedCustom.svg,
    'changing Smoothness / Softness / Detail changes the actual SVG geometry'
  );
  const thinLine = enhanceColoringPage(stairs, {
    profile,
    settings: { ...DEFAULT_COLORING_ENHANCE_SETTINGS, lineWeight: 10 },
  });
  const thickLine = enhanceColoringPage(stairs, {
    profile,
    settings: { ...DEFAULT_COLORING_ENHANCE_SETTINGS, lineWeight: 90 },
  });
  assert(thinLine.svg !== thickLine.svg, 'Line Weight changes stroke thickness without using the smoothness sliders');

  assert(fileStem('rabbit.png') === 'rabbit', 'export names keep the original stem');
  assert(enhancedFileName('rabbit.png', 'svg') === 'rabbit_enhanced.svg', 'enhanced SVG names are predictable');
  assert(enhancedFileName('flower sketch.JPG', 'png') === 'flower sketch_enhanced.png', 'enhanced PNG names stay readable');

  const farm = blank(160, 100, true);
  inkFrame(farm, 8, 10, 36, 32, 2);
  inkRect(farm, 16, 18, 28, 20);
  inkFrame(farm, 56, 12, 40, 34, 2);
  inkRect(farm, 68, 20, 72, 22);
  inkRect(farm, 78, 26, 82, 28);
  inkFrame(farm, 112, 14, 36, 30, 2);
  inkRect(farm, 124, 22, 136, 24);
  inkFrame(farm, 20, 56, 30, 28, 2);
  inkRect(farm, 28, 64, 42, 66);
  inkFrame(farm, 70, 58, 34, 26, 2);
  inkRect(farm, 82, 66, 84, 76);
  const farmResult = enhanceColoringPage(farm);
  assert(farmResult.quality.detailRetention >= 88, 'a multi-object farm sheet keeps small interior lines');
  assert(farmResult.quality.lineWidthFidelity >= 86, 'farm-sheet line thickness stays close to the source');
  assert(farmResult.quality.inkCoverageDiff <= 20, 'black coverage does not jump the way a thickened trace would');
  if (farmResult.quality.vectorReady) {
    assert(!svgHasFillStroke(farmResult.svg), 'farm-sheet SVG is fill-only');
  }

  const thin = blank(80, 40, true);
  inkRect(thin, 10, 18, 70, 20);
  const thick = blank(80, 40, true);
  inkRect(thick, 10, 14, 70, 26);
  const thickScore = scoreColoringResult(thin, thick, '<svg><path d="M0 0H1V1H0Z" fill="#111" stroke="#111" stroke-width="4"/></svg>', 'thick-fail');
  assert(!thickScore.vectorReady, 'a much thicker result is not Vector Ready');
  assert(thickScore.passed === false, 'line-width drift is a hard failure');
  assert(
    thickScore.label === 'Failed' || thickScore.label === 'Needs reprocessing' || thickScore.label === 'Needs review',
    'catastrophic thickening is not reported as Excellent'
  );
  assert(thickScore.overall <= thickScore.detailRetention + 5, 'smoothness cannot hide a fidelity failure');

  const whiteSheet = blank(48, 48, true);
  for (let x = 10; x < 38; x++) {
    setPixel(whiteSheet, x, 24, 20, 20, 20, 255);
    setPixel(whiteSheet, x, 25, 20, 20, 20, 255);
  }
  const whiteResult = enhanceColoringPage(whiteSheet);
  assert(whiteResult.quality.detailRetention >= 85, 'white-background drawings keep the original stroke');
  if (whiteResult.svg) assert(!svgHasFillStroke(whiteResult.svg), 'white-background SVG stays fill-only');

  const disk = blank(64, 64, true);
  for (let y = 0; y < 64; y++) {
    for (let x = 0; x < 64; x++) {
      const d = Math.hypot(x - 32, y - 32);
      if (d < 16) setPixel(disk, x, y, 20, 20, 20, 255);
      else if (d < 17.2) {
        const t = (17.2 - d) / 1.2;
        const g = Math.round(20 + (235 * (1 - t)));
        setPixel(disk, x, y, g, g, g, 255);
      }
    }
  }
  const diskResult = enhanceColoringPage(disk);
  assert(analyzeSvgGeometry(diskResult.svg || diskResult.candidates[0]?.svg).cubicCount > 0, 'a circular shape is fitted with Bézier curves');
  assert(!(diskResult.svg || '').includes('<image'), 'the circular SVG is not a wrapped bitmap');

  const grass = blank(90, 90, true);
  inkRect(grass, 38, 72, 52, 78);
  inkBlade(grass, 40, 74, 18, 16, 2);
  inkBlade(grass, 44, 74, 44, 12, 2);
  inkBlade(grass, 48, 74, 72, 16, 2);
  const grassResult = enhanceColoringPage(grass);
  const grassProof = grassResult.candidates.find((item) => item.name.startsWith('vtracer'))?.proof ?? grassResult.image;
  const gapInk = countInkInBox(grassProof, 28, 28, 38, 55) + countInkInBox(grassProof, 50, 28, 60, 55);
  const srcGapInk = countInkInBox(grass, 28, 28, 38, 55) + countInkInBox(grass, 50, 28, 60, 55);
  assert(gapInk <= srcGapInk + 18, 'grass blades keep their white channels instead of merging into a black wedge');
  assert(grassResult.quality.gapPreservation >= 90 || grassResult.quality.negativeSpacePreservation >= 90, 'grass negative space is scored');
  const mergedGrass = blank(90, 90, true);
  inkRect(mergedGrass, 16, 12, 74, 78);
  const mergedScore = scoreColoringResult(grass, mergedGrass, '<svg><path d="M0 0H1V1H0Z" fill="#111" stroke="none"/></svg>', 'merged-grass');
  assert(!mergedScore.vectorReady, 'a merged grass wedge is not Vector Ready');
  assert(mergedScore.topologyPreservation === 0 || mergedScore.gapPreservation < 98, 'closed grass gaps fail topology or gap gates');

  console.log('coloring-enhance.selftest ok');
}

function inkBlade(buf: PixelBuffer, x0: number, y0: number, x1: number, y1: number, thickness: number): void {
  const steps = Math.max(1, Math.round(Math.hypot(x1 - x0, y1 - y0) * 2));
  const r = thickness / 2;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const cx = x0 + (x1 - x0) * t;
    const cy = y0 + (y1 - y0) * t;
    for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++) {
      for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) {
        if (Math.hypot(x - cx, y - cy) <= r + 0.15) setPixel(buf, x, y, 20, 20, 20, 255);
      }
    }
  }
}

function countInkInBox(buf: PixelBuffer, x0: number, y0: number, x1: number, y1: number): number {
  let n = 0;
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      if (x < 0 || y < 0 || x >= buf.width || y >= buf.height) continue;
      const i = (y * buf.width + x) * 4;
      if (buf.data[i + 3] > 16 && buf.data[i] < 80) n += 1;
    }
  }
  return n;
}

run();
