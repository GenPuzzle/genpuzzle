/**
 * Cleanly gate WordSearchSidebar TabsContent bodies so inactive tabs' JSX
 * is not evaluated on every render.
 */
const fs = require('fs');
const path = 'src/components/WordSearchSidebar.tsx';
let s = fs.readFileSync(path, 'utf8');

if (!s.includes('const isSettingsTabActive')) {
  s = s.replace(
    /usePersistedState<string>\(\s*SETTINGS_TAB_STORAGE_KEY,\s*'book',\s*\{ debounceMs: 300 \}\s*\);/,
    (m) => `${m}\n  const isSettingsTabActive = (tab: string) => activeTab === tab;`
  );
}

function findTabsContentOpenEnd(src, fromIdx) {
  // Start at '<TabsContent' and find the matching closing '>' of the opening tag,
  // ignoring '>' inside => arrow functions and strings.
  let i = src.indexOf('<TabsContent', fromIdx);
  if (i < 0) return -1;
  let inS = false;
  let inD = false;
  let brace = 0;
  for (let j = i; j < src.length; j++) {
    const ch = src[j];
    const prev = src[j - 1];
    if (!inD && ch === "'" && prev !== '\\') inS = !inS;
    else if (!inS && ch === '"' && prev !== '\\') inD = !inD;
    else if (!inS && !inD) {
      if (ch === '{') brace++;
      else if (ch === '}') brace = Math.max(0, brace - 1);
      else if (ch === '>' && brace === 0) return j;
    }
  }
  return -1;
}

const values = ['puzzle', 'design', 'words', 'elements', 'colors', 'book', 'pages', 'page'];
for (const value of values) {
  if (s.includes(`data-gp-tab-gate="${value}"`)) {
    console.log('skip', value);
    continue;
  }
  const valueNeedle = `value="${value}"`;
  let searchFrom = 0;
  let found = false;
  while (true) {
    const vIdx = s.indexOf(valueNeedle, searchFrom);
    if (vIdx < 0) break;
    const openStart = s.lastIndexOf('<TabsContent', vIdx);
    if (openStart < 0 || openStart < searchFrom) {
      searchFrom = vIdx + 1;
      continue;
    }
    // ensure this value belongs to this TabsContent
    const openEnd = findTabsContentOpenEnd(s, openStart);
    if (openEnd < 0 || openEnd < vIdx) {
      searchFrom = vIdx + 1;
      continue;
    }
    const openTag = s.slice(openStart, openEnd + 1);
    if (!openTag.includes(valueNeedle)) {
      searchFrom = vIdx + 1;
      continue;
    }
    const closeIdx = s.indexOf('</TabsContent>', openEnd + 1);
    if (closeIdx < 0) {
      console.log('no close', value);
      break;
    }
    const inner = s.slice(openEnd + 1, closeIdx);
    const newOpen = openTag.slice(0, -1) + ` data-gp-tab-gate="${value}">`;
    const wrapped =
      newOpen +
      `\n          {isSettingsTabActive('${value}') ? (\n            <>\n` +
      inner +
      `\n            </>\n          ) : null}\n        `;
    s = s.slice(0, openStart) + wrapped + s.slice(closeIdx);
    console.log('wrapped', value, 'inner', inner.length);
    found = true;
    break;
  }
  if (!found) console.log('missing', value);
}

fs.writeFileSync(path, s);
console.log('helper', s.includes('isSettingsTabActive'));
