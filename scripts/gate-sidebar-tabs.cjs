const fs = require('fs');
const path = 'src/components/WordSearchSidebar.tsx';
let s = fs.readFileSync(path, 'utf8');

if (!s.includes('const isSettingsTabActive')) {
  const needle = "SETTINGS_TAB_STORAGE_KEY,\n    'book',\n    { debounceMs: 300 }\n  );";
  const alt = "SETTINGS_TAB_STORAGE_KEY,\r\n    'book',\r\n    { debounceMs: 300 }\r\n  );";
  if (s.includes(needle)) {
    s = s.replace(
      needle,
      needle + '\n  const isSettingsTabActive = (tab: string) => activeTab === tab;'
    );
  } else if (s.includes(alt)) {
    s = s.replace(
      alt,
      alt + '\r\n  const isSettingsTabActive = (tab: string) => activeTab === tab;'
    );
  } else {
    // fallback: after activeTab declaration block
    s = s.replace(
      /usePersistedState<string>\(\s*SETTINGS_TAB_STORAGE_KEY,\s*'book',\s*\{ debounceMs: 300 \}\s*\);/,
      (m) => `${m}\n  const isSettingsTabActive = (tab: string) => activeTab === tab;`
    );
  }
}

const values = ['puzzle', 'design', 'words', 'elements', 'colors', 'book', 'pages'];
for (const value of values) {
  const marker = `data-gp-tab-gate="${value}"`;
  if (s.includes(marker)) {
    console.log('already', value);
    continue;
  }
  const reMulti = new RegExp(`(<TabsContent\\b[\\s\\S]*?\\bvalue="${value}"[\\s\\S]*?>)`, 'm');
  const match = s.match(reMulti);
  if (!match) {
    console.log('skip missing', value);
    continue;
  }
  const open = match[1];
  const openIdx = s.indexOf(open);
  const afterOpen = openIdx + open.length;
  const closeIdx = s.indexOf('</TabsContent>', afterOpen);
  if (closeIdx < 0) {
    console.log('no close', value);
    continue;
  }
  const inner = s.slice(afterOpen, closeIdx);
  if (inner.includes(`isSettingsTabActive('${value}')`)) {
    console.log('already-inner', value);
    continue;
  }
  const wrapped =
    open.replace(/>$/, ` ${marker}>`) +
    `\n          {isSettingsTabActive('${value}') ? (\n` +
    inner +
    `\n          ) : null}\n        `;
  s = s.slice(0, openIdx) + wrapped + s.slice(closeIdx);
  console.log('wrapped', value, 'innerChars', inner.length);
}

// Also gate the front-matter / text page TabsContent if present (value may vary)
const textMatch = s.match(/<TabsContent\b[\s\S]*?\bvalue="text"[\s\S]*?>/);
if (textMatch && !s.includes('data-gp-tab-gate="text"')) {
  const open = textMatch[0];
  const openIdx = s.indexOf(open);
  const afterOpen = openIdx + open.length;
  const closeIdx = s.indexOf('</TabsContent>', afterOpen);
  const inner = s.slice(afterOpen, closeIdx);
  const wrapped =
    open.replace(/>$/, ' data-gp-tab-gate="text">') +
    `\n          {isSettingsTabActive('text') ? (\n` +
    inner +
    `\n          ) : null}\n        `;
  s = s.slice(0, openIdx) + wrapped + s.slice(closeIdx);
  console.log('wrapped text', inner.length);
}

fs.writeFileSync(path, s);
console.log('done, isSettingsTabActive=', s.includes('isSettingsTabActive'));
