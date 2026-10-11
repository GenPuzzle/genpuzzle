/**
 * Browser reproduction for Crossword tab freeze (seeded word list + all-pages).
 * Run with: npm run dev, then:
 *   node scripts/crossword-freeze-repro.cjs
 */

const { chromium } = require('playwright');

async function launchBrowser() {
  const launchErrors = [];
  for (const opts of [
    { channel: 'chrome', headless: true },
    { channel: 'msedge', headless: true },
    { headless: true },
  ]) {
    try {
      const browser = await chromium.launch(opts);
      console.log('launched', opts);
      return browser;
    } catch (e) {
      launchErrors.push(String(e && e.message ? e.message : e));
    }
  }
  console.error('Could not launch a browser', launchErrors.join('\n'));
  process.exit(2);
}

async function main() {
  const base = process.env.GP_BASE || 'http://localhost:3000';
  const browser = await launchBrowser();
  const page = await browser.newPage();
  const longTasks = [];
  await page.exposeFunction('__gpReportLongTask', (entry) => longTasks.push(entry));
  page.on('console', (msg) => {
    const t = msg.text();
    if (t.includes('[gp-diag]')) console.log('CONSOLE', t);
  });

  await page.goto(`${base}/app?gpDiag=1`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => !!window.__GP_TEST__, null, { timeout: 180000 });
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
    } catch {}
  });

  // Clear prior long tasks from page load by recording a marker time.
  const marker = await page.evaluate(() => performance.now());
  longTasks.length = 0;

  await page.evaluate(() => {
    window.__GP_TEST__.seedWsPuzzles(40, 20);
    window.__GP_TEST__.setPreviewMode('all');
  });
  await page.waitForTimeout(1500);
  longTasks.length = 0;

  const tInsert = Date.now();
  const insertStartPerf = await page.evaluate(() => {
    const t0 = performance.now();
    window.__GP_TEST__.insert('crossword');
    return t0;
  });
  await page.waitForTimeout(4000);
  const insertWallMs = Date.now() - tInsert;

  const after = await page.evaluate(() => ({
    module: window.__GP_TEST__.getActiveModule(),
    answerChars: window.__GP_TEST__.getCrosswordAnswerChars(),
    diag: window.__GP_TEST__.dumpDiag(),
  }));

  const tClick = Date.now();
  await page.mouse.click(40, 40);
  const afterClickMs = Date.now() - tClick;

  let typeMs = null;
  const textarea = page.locator('textarea').first();
  if ((await textarea.count()) > 0) {
    const tType = Date.now();
    try {
      await textarea.click({ timeout: 5000 });
      await textarea.type('ALPHA', { delay: 30 });
      typeMs = Date.now() - tType;
    } catch (e) {
      typeMs = -1;
      console.log('type failed', e.message);
    }
  }

  const postInsertLongTasks = longTasks
    .filter((t) => t.startTime >= insertStartPerf - 50)
    .sort((a, b) => b.duration - a.duration)
    .slice(0, 25);

  const report = {
    marker,
    insertWallMs,
    afterClickMs,
    typeMs,
    activeModuleAfter: after.module,
    crosswordAnswerChars: after.answerChars,
    diag: after.diag.filter((d) =>
      /insert|hydrate|clone|compiledBook|syncAutoToc|JSON/.test(d.label)
    ),
    postInsertLongTasks,
  };
  console.log(JSON.stringify(report, null, 2));
  await browser.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
