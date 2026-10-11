/**
 * Selftest: parse Ancient Kemet-style Excel + plain TXT content packs.
 * Run: npx tsx src/lib/ai/content-pack.selftest.ts
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import * as XLSX from 'xlsx';
import {
  contentPackForAiContext,
  formatContentPackSummary,
  parseContentPackFile,
  resolveContentPackApplyMode,
  summarizeContentPack,
  type ContentPack,
} from './content-pack';
import { planContentPackApply } from './apply-content-pack';
import { createDocumentPage } from '@/lib/document-model';

async function fileFromPath(filePath: string, mime: string): Promise<File> {
  const buf = fs.readFileSync(filePath);
  const name = path.basename(filePath);
  return new File([buf], name, { type: mime });
}

/** Build an in-memory workbook matching the sample sheet layout. */
function buildSampleWorkbookBuffer(): ArrayBuffer {
  const wb = XLSX.utils.book_new();
  const chapters = [
    ['Chapter', 'Chapter titles', 'Focus', 'Puzzles'],
    [1, 'Foundations of Kemet', 'Pyramids and Nile', 6],
    [2, 'The Neteru', 'Divine names', 6],
  ];
  const crosswords = [
    ['Themes', 'Clues', 'Answers'],
    ['C01-CW01: The Pyramid Workshop', 'Four sided royal monument', 'PYRAMID'],
    ['C01-CW01: The Pyramid Workshop', 'Stone used in casing', 'LIMESTONE'],
    ['C02-CW01: Sacred Names', 'Sun disk deity', 'RA'],
  ];
  const wordSearch = [
    ['Themes', 'Words'],
    ['C01-WS01: Stone Horizons', 'Step Form'],
    ['C01-WS01: Stone Horizons', 'Stone Face'],
    ['C01-WS01: Stone Horizons', 'Base Edge'],
    ['C02-WS01: Night Sky', 'Star'],
    ['C02-WS01: Night Sky', 'Orbit'],
  ];
  const mazes = [
    ['Themes', 'Start image', 'End image'],
    ['C01-MZ01: The Builder Route', 'Mason with plumb line', 'Finished pyramid'],
  ];
  const scrambles = [
    ['Themes', 'Words'],
    ['C01-SC01: Echoes of the Desert', 'Desert'],
    ['C01-SC01: Echoes of the Desert', 'Dune'],
  ];
  const fillins = [
    ['Themes', 'Words'],
    ['C01-FI01: The Royal Building Site', 'Sandstone'],
    ['C01-FI01: The Royal Building Site', 'Basalt'],
  ];
  const cryptograms = [
    ['Themes', 'Fun facts'],
    [
      'C01-CR01: The Limestone Casing',
      'The Great Pyramid once had smooth limestone casing.',
    ],
  ];

  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(chapters), 'Chapters');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(crosswords), 'Crosswords');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(wordSearch), 'Word Search');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(mazes), 'Mazes');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(scrambles), 'Word Scrambles');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(fillins), 'Fill-ins');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(cryptograms), 'Cryptograms');

  const out = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
  return out.buffer.slice(out.byteOffset, out.byteOffset + out.byteLength);
}

async function main() {
  // 1) Synthetic workbook (always available)
  const synthetic = new File([buildSampleWorkbookBuffer()], 'sample-kemet.xlsx', {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const pack = await parseContentPackFile(synthetic);
  assert.equal(pack.sourceKind, 'xlsx');
  assert.equal(pack.chapters.length, 2);
  assert.equal(pack.chapters[0]?.title, 'Foundations of Kemet');
  assert.ok(pack.byType['word-search']?.length);
  assert.ok(pack.byType.crossword?.length);
  assert.ok(pack.byType.maze?.length);
  assert.ok(pack.byType['word-scramble']?.length);
  assert.ok(pack.byType['word-fill']?.length);
  assert.ok(pack.byType.cryptogram?.length);

  const ws = pack.byType['word-search']!;
  const stone = ws.find((p) => /Stone Horizons/i.test(p.title));
  assert.ok(stone);
  assert.equal(stone!.chapterIndex, 1);
  assert.deepEqual(stone!.words, ['Step Form', 'Stone Face', 'Base Edge']);

  const cw = pack.byType.crossword!.find((p) => /Pyramid Workshop/i.test(p.title));
  assert.ok(cw);
  assert.equal(cw!.answers?.[0], 'PYRAMID');
  assert.equal(cw!.clues?.[0], 'Four sided royal monument');

  const crypto = pack.byType.cryptogram![0]!;
  assert.match(crypto.phrase || '', /Great Pyramid/);

  const summary = summarizeContentPack(pack);
  assert.equal(summary.chapterCount, 2);
  assert.ok(summary.types.some((t) => t.type === 'word-search' && t.puzzleCount >= 2));

  const formatted = formatContentPackSummary(pack);
  assert.match(formatted, /How should I apply/);
  assert.match(formatted, /word-search/i);

  const ctx = contentPackForAiContext(pack);
  assert.ok(ctx.byType);

  assert.deepEqual(resolveContentPackApplyMode('1'), { mode: 'active', types: undefined });
  assert.equal(resolveContentPackApplyMode('2 word-search')?.mode, 'matching');
  assert.ok(resolveContentPackApplyMode('2 word-search')?.types?.includes('word-search'));
  assert.equal(resolveContentPackApplyMode('3 rebuild')?.mode, 'rebuild');
  assert.equal(resolveContentPackApplyMode('hello'), null);

  // Apply active
  const wsPage = createDocumentPage('word-search');
  const activePlan = planContentPackApply({
    pack,
    mode: 'active',
    pages: [wsPage],
    activeDocumentId: wsPage.id,
  });
  assert.equal(activePlan.ok, true);
  const appliedWs = activePlan.pages?.find((p) => p.id === wsPage.id);
  assert.ok(appliedWs);
  const wsSettings = appliedWs!.settings as {
    titleWords?: { words?: string[] };
    wordSearchSettings?: { core?: { numberOfPuzzles?: number } };
  };
  assert.ok((wsSettings.titleWords?.words?.length || 0) >= 3);
  assert.ok((wsSettings.wordSearchSettings?.core?.numberOfPuzzles || 0) >= 1);

  // Apply rebuild
  const rebuild = planContentPackApply({
    pack,
    mode: 'rebuild',
    pages: [],
    bookTitle: 'Ancient Kemet',
  });
  assert.equal(rebuild.ok, true);
  assert.ok((rebuild.pages?.length || 0) > 5);
  assert.ok(rebuild.chapterTitles?.includes('Foundations of Kemet'));
  const rebuiltWs = rebuild.pages?.filter((p) => p.moduleType === 'word-search') || [];
  assert.ok(rebuiltWs.length >= 2);

  // Plain TXT word list
  const txt = new File(['Pyramid\nNile\nObelisk\n'], 'words.txt', { type: 'text/plain' });
  const txtPack = await parseContentPackFile(txt);
  assert.equal(txtPack.byType['word-search']?.[0]?.words?.length, 3);

  // Optional: real sample file if present on disk
  const samplePath =
    'd:\\Fiverr\\Order 64 selfmade313\\Ancient_Kemet_Cosmic_Puzzle_Content.xlsx';
  if (fs.existsSync(samplePath)) {
    const real = await fileFromPath(
      samplePath,
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    const realPack: ContentPack = await parseContentPackFile(real);
    assert.ok(realPack.chapters.length >= 3);
    assert.ok((realPack.byType['word-search']?.length || 0) >= 10);
    assert.ok((realPack.byType.crossword?.length || 0) >= 10);
    assert.ok((realPack.byType.cryptogram?.length || 0) >= 1);
    console.log(
      'Real sample OK:',
      summarizeContentPack(realPack).types.map((t) => `${t.type}:${t.puzzleCount}`).join(', ')
    );
  } else {
    console.log('Real sample path not found — skipped (synthetic pack passed).');
  }

  console.log('content-pack.selftest: PASSED');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
