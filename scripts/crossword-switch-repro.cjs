/**
 * Full workflow: login → new project → WS words+puzzle → add Crossword → switch tabs.
 * Measures longtasks + CDP CPU profile on each switch.
 *
 *   node scripts/crossword-switch-repro.cjs
 */
const { chromium } = require('playwright');

const BASE = process.env.GP_BASE || 'http://localhost:3000';
const USER = process.env.GP_USER || 'admin';
const PASS = process.env.GP_PASS || 'bra071992';

const WORDS = [
  'APPLE', 'BANANA', 'CHERRY', 'DATES', 'ELDER',
  'FIG', 'GRAPE', 'HONEY', 'IRIS', 'JASMINE',
  'KIWI', 'LEMON', 'MANGO', 'NECTAR', 'OLIVE',
];

async function launchBrowser() {
  for (const opts of [
    { channel: 'chrome', headless: true },
    { channel: 'msedge', headless: true },
    { headless: true },
  ]) {
    try {
      const browser = await chromium.launch(opts);
      console.log('launched', opts.channel || 'chromium');
      return browser;
    } catch (e) {
      console.warn('launch fail', String(e.message || e));
    }
  }
  throw new Error('Could not launch browser');
}

function topProfileNodes(profile, limit = 20) {
  if (!profile || !profile.nodes) return [];
  const nodes = profile.nodes.map((n) => ({
    id: n.id,
    functionName: (n.callFrame && n.callFrame.functionName) || '(anonymous)',
    url: (n.callFrame && n.callFrame.url) || '',
    lineNumber: n.callFrame ? n.callFrame.lineNumber : -1,
    selfTime: 0,
  }));
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const samples = profile.samples || [];
  const deltas = profile.timeDeltas || [];
  for (let i = 0; i < samples.length; i++) {
    const n = byId.get(samples[i]);
    if (n) n.selfTime += deltas[i] || 0;
  }
  return [...byId.values()]
    .filter((n) => n.selfTime > 500) // >0.5ms
    .sort((a, b) => b.selfTime - a.selfTime)
    .slice(0, limit)
    .map((n) => ({
      fn: n.functionName,
      file: n.url.split('/').pop() || n.url,
      line: n.lineNumber + 1,
      selfMs: +(n.selfTime / 1000).toFixed(2),
    }));
}

async function main() {
  const browser = await launchBrowser();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const longTasks = [];
  await page.exposeFunction('__gpReportLongTask', (e) => longTasks.push(e));
  page.on('console', (msg) => {
    const t = msg.text();
    if (t.includes('[gp-diag]')) console.log('DIAG', t);
  });

  console.log('goto login');
  await page.goto(`${BASE}/app?gpDiag=1`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.evaluate(() => {
    try {
      // Avoid stale settings-tab persistence skewing mounts during repro.
      localStorage.removeItem('gp-settings-tab');
      localStorage.removeItem('gp-settings-panel');
    } catch {}
  });

  // Login
  await page.waitForSelector('#login-username', { timeout: 60000 });
  await page.fill('#login-username', USER);
  await page.fill('#login-password', PASS);
  await page.click('button.auth-page__submit');
  await page.waitForSelector('text=Create Manually', { timeout: 60000 });
  console.log('logged in');

  await page.getByRole('button', { name: /create manually/i }).click();
  await page.waitForFunction(() => !!window.__GP_TEST__, null, { timeout: 180000 });
  console.log('editor ready');

  // Dismiss tutorial overlay if present
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const skip = btns.find((b) => /skip|got it|start|close|dismiss/i.test(b.textContent || ''));
    if (skip) skip.click();
  });
  await page.waitForTimeout(500);

  await page.evaluate(() => {
    window.__GP_TEST__.enableDiag();
    try {
      const po = new PerformanceObserver((list) => {
        for (const e of list.getEntries()) {
          window.__gpReportLongTask({
            duration: e.duration,
            startTime: e.startTime,
            name: e.name,
          });
        }
      });
      po.observe({ type: 'longtask', buffered: true });
    } catch {}
  });

  console.log('create word-search tab + 15 words + 1 puzzle');
  await page.evaluate(() => {
    window.__GP_TEST__.insert('word-search');
  });
  await page.waitForFunction(
    () => window.__GP_TEST__.getActiveModule() === 'word-search',
    null,
    { timeout: 30000 }
  );
  await page.evaluate((words) => {
    window.__GP_TEST__.setWsWords(words);
    window.__GP_TEST__.seedWsPuzzles(1, 12);
  }, WORDS);
  await page.waitForTimeout(1500);
  console.log('docs', await page.evaluate(() => window.__GP_TEST__.getDocSummary()));

  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Profiler.enable');
  longTasks.length = 0;

  console.log('insert crossword');
  await cdp.send('Profiler.start', { samplingInterval: 100 });
  const insertStart = await page.evaluate(() => {
    window.__GP_ISO__?.resetMeasure?.();
    const t0 = performance.now();
    window.__GP_TEST__.insert('crossword');
    return t0;
  });
  await page.waitForFunction(
    () => window.__GP_TEST__.getActiveModule() === 'crossword',
    null,
    { timeout: 30000 }
  );
  await page.waitForTimeout(1500);
  const insertProfile = await cdp.send('Profiler.stop');
  const afterInsert = await page.evaluate(() => ({
    module: window.__GP_TEST__.getActiveModule(),
    docs: window.__GP_TEST__.getDocSummary(),
    diag: window.__GP_TEST__.dumpDiag().slice(-30),
    measure: window.__GP_ISO__
      ? { calls: window.__GP_ISO__.measureCalls, sets: window.__GP_ISO__.measureSetStateCount }
      : null,
  }));
  const insertLong = longTasks
    .filter((t) => t.startTime >= insertStart - 20)
    .sort((a, b) => b.duration - a.duration);

  console.log('switch loop');
  const switches = [];
  const sequence = ['word-search', 'crossword', 'word-search', 'crossword', 'word-search', 'crossword'];
  for (const target of sequence) {
    longTasks.length = 0;
    await page.evaluate(() => window.__GP_ISO__?.resetMeasure?.());
    await cdp.send('Profiler.start', { samplingInterval: 100 });
    const tWall0 = Date.now();
    const perfStart = await page.evaluate((mod) => {
      const t0 = performance.now();
      const ok = window.__GP_TEST__.switchTo(mod);
      return { t0, ok, immediately: window.__GP_TEST__.getActiveModule() };
    }, target);
    // If main thread is busy, give it time but also snapshot mid-wait
    let resolved = false;
    for (let attempt = 0; attempt < 30; attempt++) {
      const mod = await page.evaluate(() => window.__GP_TEST__?.getActiveModule?.() ?? null);
      if (mod === target) {
        resolved = true;
        break;
      }
      await page.waitForTimeout(500);
    }
    if (!resolved) {
      const snap = await page.evaluate(() => ({
        module: window.__GP_TEST__?.getActiveModule?.() ?? null,
        docs: window.__GP_TEST__?.getDocSummary?.() ?? null,
        diag: window.__GP_TEST__?.dumpDiag?.()?.slice?.(-20) ?? null,
      }));
      console.log('SWITCH_TIMEOUT_SNAP', JSON.stringify({ target, perfStart, snap }, null, 2));
      throw new Error(`switch to ${target} timed out`);
    }
    // responsiveness probes
    const tClick0 = Date.now();
    await page.mouse.click(40, 80);
    const clickMs = Date.now() - tClick0;
    let typeMs = -1;
    try {
      const ta = page.locator('textarea').first();
      if (await ta.count()) {
        const t0 = Date.now();
        await ta.click({ timeout: 2500 });
        await page.keyboard.type('Z', { delay: 0 });
        typeMs = Date.now() - t0;
      }
    } catch {
      typeMs = -2;
    }
    await page.waitForTimeout(700);
    const profile = await cdp.send('Profiler.stop');
    const wallMs = Date.now() - tWall0;
    const postLong = longTasks
      .filter((t) => t.startTime >= (perfStart.t0 || perfStart) - 20)
      .sort((a, b) => b.duration - a.duration)
      .slice(0, 8);
    const snap = await page.evaluate(() => ({
      module: window.__GP_TEST__.getActiveModule(),
      diag: window.__GP_TEST__.dumpDiag().slice(-15),
      measure: window.__GP_ISO__
        ? { calls: window.__GP_ISO__.measureCalls, sets: window.__GP_ISO__.measureSetStateCount }
        : null,
    }));
    switches.push({
      target,
      wallMs,
      clickMs,
      typeMs,
      postLong,
      measure: snap.measure,
      topStack: topProfileNodes(profile.profile, 15),
      diagHot: (snap.diag || []).filter((d) => d.ms >= 8),
    });
    console.log(
      JSON.stringify({
        target,
        wallMs,
        clickMs,
        typeMs,
        longMax: postLong[0]?.duration,
        hot: (snap.diag || []).filter((d) => d.ms >= 8).map((d) => `${d.label}:${d.ms.toFixed(1)}`),
      })
    );
  }

  const report = {
    afterInsert,
    insertLongTop: insertLong.slice(0, 10),
    insertTopStack: topProfileNodes(insertProfile.profile, 15),
    switches,
  };
  console.log('REPORT_JSON_START');
  console.log(JSON.stringify(report, null, 2));
  console.log('REPORT_JSON_END');
  await page.screenshot({ path: 'scripts/crossword-switch-repro.png' });
  await browser.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
