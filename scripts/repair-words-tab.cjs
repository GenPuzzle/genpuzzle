const fs = require('fs');
const path = 'src/components/WordSearchSidebar.tsx';
let s = fs.readFileSync(path, 'utf8');

const marker = '{/* ==================== WORD LIST SETTINGS ==================== */}';
const start = s.indexOf(marker);
const wsBody = s.indexOf(') : moduleIsWordSearch ? (\n          <div className="space-y-4">\n            <div className="flex items-center justify-between gap-3">');
// Prefer the SECOND occurrence if stub created a first placeholder
let bodyAt = s.indexOf(
  '<h3 className="font-semibold text-gray-900">Word List Settings</h3>'
);
if (bodyAt < 0) {
  console.error('cannot find Word List Settings heading');
  process.exit(1);
}
// rewind to the moduleIsWordSearch branch that owns this heading
const branch = s.lastIndexOf(') : moduleIsWordSearch ? (', bodyAt);
if (branch < 0 || start < 0) {
  console.error('markers', { start, bodyAt, branch });
  process.exit(1);
}

// Find end of words TabsContent: after Word List Settings body, before elements TabsContent
const elements = s.indexOf('<TabsContent\n          value="elements"', bodyAt);
const elementsAlt = s.indexOf('value="elements"', bodyAt);
const elementsPos = elements >= 0 ? elements : s.lastIndexOf('<TabsContent', elementsAlt);
if (elementsPos < 0) {
  console.error('no elements tab');
  process.exit(1);
}

// Extract the WS body div starting at moduleIsWordSearch branch through end of that ternary
// Simpler: from Word List Settings heading's parent div through the closing of words tab content before elements

// Rebuild words section using crossword/murdoku panels + existing WS body from heading's container
const wsDivStart = s.lastIndexOf('<div className="space-y-4">', bodyAt);
// Find matching close of words panel: look for `) : null}\n        </TabsContent>` or similar before elements
let sliceEnd = elementsPos;
// include nothing of elements opening

const wsThroughEnd = s.slice(wsDivStart, sliceEnd);
// Trim trailing gate/close leftovers from previous corruption
let wsCore = wsThroughEnd;
// Remove trailing `) : null}` / `</TabsContent>` if present before elements
wsCore = wsCore.replace(/\s*\) : null\}\s*<\/TabsContent>\s*$/,'');
wsCore = wsCore.replace(/\s*<\/TabsContent>\s*$/,'');
// Also remove trailing `) : (` coming soon branches close — keep through the wordsearch ternary end
// Expect wsCore ends with `)}`  or `) : (Coming soon)}`

const rebuilt = `${marker}
        <TabsContent
          value="words"
          style={{ height: 'calc(100vh - 100px)', overflowY: 'auto' }}
          className={cn('flex-1 min-h-0 p-4 space-y-6 bg-gradient-to-b from-white to-gray-50 dark:from-slate-800 dark:to-slate-850 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700 m-2', (collapsed || canvasEditOpen) && 'hidden')}
          data-gp-tab-gate="words"
          onKeyDown={(e) => {
            // Allow Enter key to work in textareas without triggering tab navigation
            if (e.key === 'Enter' && (e.target as HTMLElement)?.tagName === 'TEXTAREA') {
              e.stopPropagation();
            }
          }}
        >
          {isSettingsTabActive('words') ? (
          <>
          {moduleIsCrossword ? (
            <CrosswordWordsSettingsPanel onSave={handleSave} />
          ) : moduleIsMurdoku ? (
            <MurdokuCharactersSettingsPanel onSave={handleSave} />
          ) : moduleIsTrivia ? (
            <TriviaWordsSettingsPanel onSave={handleSave} />
          ) : moduleIsGeneric ? (
            <p className="text-sm text-slate-500">
              {genericModuleType === 'sudoku'
                ? 'Sudoku'
                : genericModuleType === 'maze'
                  ? 'Maze'
                  : genericModuleType === 'cryptogram'
                    ? 'Cryptogram'
                    : genericModuleType === 'codewords'
                      ? 'Codewords'
                      : genericModuleType === 'binairo'
                        ? 'Binairo'
                        : genericModuleType === 'kakuro'
                          ? 'Kakuro'
                          : genericModuleType === 'math-maze'
                            ? 'Math Maze'
                            : genericModuleType === 'fill'
                              ? 'Fill'
                              : genericModuleType === 'snake'
                                ? 'Snake'
                                : 'Word Scramble'}{' '}
              puzzles are generated from the Puzzle tab settings
              {genericModuleType === 'cryptogram' ||
              genericModuleType === 'word-scramble' ||
              genericModuleType === 'fill' ||
              genericModuleType === 'snake'
                ? ' (phrases / words live there too)'
                : ''}
              — no separate word list is needed. Configure them in Puzzle and Titles, then click
              Generate.
            </p>
          ) : moduleIsWordSearch ? (
          ${wsCore}
          ) : (
            <p className="text-sm text-slate-500">Word list settings for this document type are coming soon.</p>
          )}
          </>
          ) : null}
        </TabsContent>

        `;

s = s.slice(0, start) + rebuilt + s.slice(sliceEnd);
fs.writeFileSync(path, s);
console.log('rebuilt words; wsCore chars', wsCore.length);
