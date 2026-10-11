/**
 * Browser reproduction for Crossword tab freeze.
 * Uses system Chrome/Edge if Playwright browsers are not installed.
 *
 * Run (with npm run dev already up):
 *   node scripts/crossword-freeze-repro.mjs
 */

const { chromium } = require('playwright');

async function main() {
  const base = process.env.GP_BASE || 'http://localhost:3000';
  let browser;
  const launchErrors = [];
  for (const opts of [
    { channel: 'chrome', headless: true },
    { channel: 'msedge', headless: true },
    { headless: true },
  ]) {
    try {
      browser = await chromium.launch(opts);
      console.log('launched', opts);
      break;
    } catch (e) {
      launchErrors.push(String(e && e.message ? e.message : e));
    }
  }
  if (!browser) {
    console.error('Could not launch a browser. Tried chrome/msedge/chromium.');
    console.error(launchErrors.join('\n'));
    console.error(
      'NO_BROWSER_ACCESS: Cannot capture a DevTools Performance trace automatically.'
    );
    process.exit(2);
  }

  const page = await browser.newPage();
  const longTasks = [];
  await page.exposeFunction('__gpReportLongTask', (entry) => {
    longTasks.push(entry);
  });

  page.on('console', (msg) => {
    const t = msg.text();
    if (t.includes('[gp-diag]')) console.log('CONSOLE', t);
  });

  console.log('goto', `${base}/app?gpDiag=1`);
  await page.goto(`${base}/app?gpDiag=1`, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.waitForFunction(() => !!window.__GP_TEST__, null, { timeout: 120000 });
  await page.evaluate(() => {
    window.__GP_TEST__.enableDiag();
    const po = new PerformanceObserver((list) => {
      for (const e of list.getEntries()) {
        window.__gpReportLongTask({
          name: e.name,
          duration: e.duration,
          startTime: e.startTime,
        });
      }
    });
    try {
      po.observe({ type: 'longtask', buffered: true });
    } catch {
      /* Safari / some chromium builds */
    }
  });

  // Baseline interaction: click body should stay responsive
  const tClick0 = Date.now();
  await page.mouse.click(10, 10);
  const baselineClickMs = Date.now() - tClick0;

  const before = await page.evaluate(() => ({
    module: window.__GP_TEST__.getActiveModule(),
    diag: window.__GP_TEST__.dumpDiag(),
  }));

  console.log('before', before.module, 'baselineClickMs', baselineClickMs);

  const tInsert = Date.now();
  await page.evaluate(() => window.__GP_TEST__.insert('crossword'));
  // Wait for React to settle
  await page.waitForTimeout(2500);
  const insertWallMs = Date.now() - tInsert;

  const after = await page.evaluate(() => ({
    module: window.__GP_TEST__.getActiveModule(),
    diag: window.__GP_TEST__.dumpDiag(),
    busy: document.body.innerText.includes('Generating') || false,
  }));

  // Post-insert interaction responsiveness
  const tClick1 = Date.now();
  await page.mouse.click(20, 20);
  const afterClickMs = Date.now() - tClick1;

  // Try typing into a crossword textarea if present
  let typeMs = null;
  const textarea = page.locator('textarea').first();
  if (await textarea.count()) {
    const tType = Date.now();
    try {
      await textarea.click({ timeout: 3000 });
      await textarea.type('TESTWORD', { delay: 20 });
      typeMs = Date.now() - tType;
    } catch (e) {
      typeMs = -1;
      console.log('type failed', e.message);
    }
  }

  const report = {
    insertWallMs,
    baselineClickMs,
    afterClickMs,
    typeMs,
    activeModuleAfter: after.module,
    diag: after.diag,
    longTasks: longTasks
      .filter((t) => t.duration >= 50)
      .sort((a, b) => b.duration - a.duration)
      .slice(0, 20),
  };
  console.log(JSON.stringify(report, null, 2));

  await browser.close();
  if (insertWallMs > 2000 || (report.longTasks[0] && report.longTasks[0].duration > 200)) {
    console.log('FREEZE_SIGNAL: slow insert or long tasks detected');
    process.exit(0);
  }
  console.log('NO_FREEZE_SIGNAL in this automated empty-project run');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
