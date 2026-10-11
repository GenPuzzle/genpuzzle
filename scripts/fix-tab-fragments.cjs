const fs = require('fs');
const p = 'src/components/WordSearchSidebar.tsx';
let s = fs.readFileSync(p, 'utf8');

for (const tab of ['puzzle', 'design', 'colors', 'book']) {
  const open = `{isSettingsTabActive('${tab}') ? (`;
  // Insert fragment after open if missing
  const reOpen = new RegExp(
    `\\{isSettingsTabActive\\('${tab}'\\) \\? \\(\\s*\\n\\s*\\{`,
    'm'
  );
  if (reOpen.test(s) && !s.includes(`{isSettingsTabActive('${tab}') ? (\n          <>\n`)) {
    s = s.replace(
      reOpen,
      `{isSettingsTabActive('${tab}') ? (\n          <>\n          {`
    );
    console.log('opened fragment', tab);
  }

  // Ensure closing </> before ) : null} for this tab's TabsContent block
  const gate = `data-gp-tab-gate="${tab}"`;
  const gateIdx = s.indexOf(gate);
  if (gateIdx < 0) {
    console.log('no gate', tab);
    continue;
  }
  const closeIdx = s.indexOf(') : null}', gateIdx);
  const tabsClose = s.indexOf('</TabsContent>', gateIdx);
  if (closeIdx < 0 || closeIdx > tabsClose) {
    console.log('no close pattern', tab, { closeIdx, tabsClose });
    continue;
  }
  const before = s.slice(gateIdx, closeIdx);
  if (before.includes('</>')) {
    console.log('already closed', tab);
    continue;
  }
  s = s.slice(0, closeIdx) + '</>\n          ' + s.slice(closeIdx);
  console.log('closed fragment', tab);
}

fs.writeFileSync(p, s);
console.log('done');
