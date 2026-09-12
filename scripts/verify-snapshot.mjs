/**
 * Verifies the export rasterization fix: html2canvas 1.4.1 fails on the app's
 * Tailwind v4 oklch() colors (→ blank PDF/PPT pages), html2canvas-pro succeeds.
 * Runs against the live dev server so the app's real stylesheet is in effect.
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const APP_URL = 'http://localhost:3000/app';
const OUT_DIR = path.resolve('scripts', 'snapshot-test-out');

const browser = await chromium
  .launch({ channel: 'chrome' })
  .catch(() => chromium.launch({ channel: 'msedge' }))
  .catch(() => chromium.launch());
const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });
await page.goto(APP_URL, { waitUntil: 'networkidle', timeout: 60000 });

// Inject a mini crossword-page lookalike using the exact Tailwind classes
// GenericPuzzlePageCanvas / CrosswordGrid use (shadow-2xl, border-gray-300, …).
await page.evaluate(() => {
  const el = document.createElement('div');
  el.id = 'snap-test';
  el.className = 'relative shadow-2xl border border-gray-300 select-none';
  el.style.cssText =
    'width:408px;height:528px;background-color:#ffffff;position:fixed;left:0;top:0;z-index:99999;overflow:hidden;padding:16px;';
  const cells = Array.from({ length: 25 }, (_, i) => {
    const black = [0, 6, 12, 18, 24].includes(i);
    return `<div class="flex items-center justify-center relative" style="width:28px;height:28px;border:1px solid #cccccc;background:${black ? '#000' : '#fff'}">${black ? '' : '<span class="font-bold" style="color:#333">A</span>'}</div>`;
  }).join('');
  el.innerHTML = `
    <h2 class="font-bold text-center relative" style="font-size:32px;color:#333333;font-family:Roboto">Crossword 1</h2>
    <div class="inline-block self-center rounded-lg" style="background-color:#ffffff">
      <div class="grid gap-0" style="grid-template-columns:repeat(5,28px)">${cells}</div>
    </div>
    <div class="grid w-full max-w-2xl mx-auto" style="grid-template-columns:1fr 1fr;gap:12px">
      <div><h3 class="font-bold mb-2 uppercase tracking-wide" style="color:#333">Across</h3><p style="font-size:20px;color:#333">1. First clue text</p></div>
      <div><h3 class="font-bold mb-2 uppercase tracking-wide" style="color:#333">Down</h3><p style="font-size:20px;color:#333">2. Second clue text</p></div>
    </div>`;
  document.body.appendChild(el);
});

async function capture(scriptPath) {
  await page.addScriptTag({ path: scriptPath });
  return page.evaluate(async () => {
    const el = document.getElementById('snap-test');
    try {
      const canvas = await window.html2canvas(el, {
        scale: 2,
        backgroundColor: '#ffffff',
        logging: false,
      });
      const ctx = canvas.getContext('2d');
      const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
      let nonWhite = 0;
      const totalPx = data.length / 4;
      for (let i = 0; i < data.length; i += 4) {
        if (data[i] < 245 || data[i + 1] < 245 || data[i + 2] < 245) nonWhite++;
      }
      return {
        ok: true,
        nonWhiteRatio: nonWhite / totalPx,
        dataUrl: canvas.toDataURL('image/png'),
      };
    } catch (e) {
      return { ok: false, error: String(e && e.message ? e.message : e) };
    }
  });
}

fs.mkdirSync(OUT_DIR, { recursive: true });

const oldResult = await capture('node_modules/html2canvas/dist/html2canvas.js');
console.log('[old html2canvas]', oldResult.ok ? `captured, non-white pixel ratio: ${oldResult.nonWhiteRatio.toFixed(4)}` : `FAILED: ${oldResult.error}`);

const proResult = await capture('node_modules/html2canvas-pro/dist/html2canvas-pro.js');
console.log('[html2canvas-pro]', proResult.ok ? `captured, non-white pixel ratio: ${proResult.nonWhiteRatio.toFixed(4)}` : `FAILED: ${proResult.error}`);

if (proResult.ok) {
  const b64 = proResult.dataUrl.split(',')[1];
  fs.writeFileSync(path.join(OUT_DIR, 'pro-capture.png'), Buffer.from(b64, 'base64'));
  console.log('saved', path.join(OUT_DIR, 'pro-capture.png'));
}
if (oldResult.ok) {
  const b64 = oldResult.dataUrl.split(',')[1];
  fs.writeFileSync(path.join(OUT_DIR, 'old-capture.png'), Buffer.from(b64, 'base64'));
}

await browser.close();

const proBlank = !proResult.ok || proResult.nonWhiteRatio < 0.005;
if (proBlank) {
  console.error('RESULT: html2canvas-pro capture is blank or failed — fix NOT verified');
  process.exit(1);
}
console.log('RESULT: html2canvas-pro renders real content — export fix verified');
