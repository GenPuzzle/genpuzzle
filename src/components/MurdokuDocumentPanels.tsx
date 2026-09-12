'use client';

import React, { useRef, useState } from 'react';
import { Loader2, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { useApp } from '@/lib/app-context';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { SliderField } from '@/components/ui/slider-field';
import { IntegerInput } from '@/components/ui/integer-input';
import { SettingsTextInput, SettingsTextarea } from '@/components/ui/settings-text-input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { MiniColorInput } from '@/components/ui/color-input';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { DivideListsIntoChaptersControl } from '@/components/DivideListsIntoChaptersControl';

import { pageFitApplyKey } from '@/lib/auto-page-fit';
import { difficultyLabelText, validateMurdokuPuzzle, autoFixMurdokuPuzzle, isStandOnPropName } from '@/lib/puzzles/murdoku';
import {
  MURDOKU_ART_STYLE_LABELS,
  MURDOKU_THEME_PRESETS,
  applyThemePreset,
  defaultMurdokuCharacters,
  defaultMurdokuRooms,
  defaultMixedMurdokuLevelCounts,
  getDefaultMurdokuSettings,
  joinMurdokuLines,
  murdokuCountPatchForTotal,
  murdokuLinesForCount,
  normalizeMurdokuSettings,
  randomMurdokuTheme,
  slotId,
  type MurdokuArtStyle,
  type MurdokuDifficultyMode,
  type MurdokuSettings,
} from '@/lib/murdoku-settings';
import { autoBalanceMurdokuSettings } from '@/lib/murdoku-page-layout';
import {
  autoSheetLayout,
  buildCharacterAiPrompt,
  buildElementAiPrompt,
  buildRoomAiPrompt,
  buildReferenceSheetPng,
  downloadDataUrl,
  sheetSettingsForItems,
} from '@/lib/murdoku-reference-sheet';
import {
  rememberUploadedSheet,
  recalledUploadedSheet,
  runSpriteSheetPipeline,
  type ExtractedAsset,
  type SpriteSheetCropConfig,
  type SpriteSheetKind,
} from '@/lib/sprite-sheet-importer';
import { requestMurdokuAi } from '@/lib/murdoku-ai';
import {
  MURDOKU_OBJECT_CATEGORIES,
  buildSharedElementPool,
  elementDefsFromNames,
  sanitizeElementNames,
  syncRoomsCatalog,
  themeConsistencyScore,
  type MurdokuObjectCategory,
} from '@/lib/murdoku-room-catalog';
import {
  MurdokuHeaderRow,
  MurdokuStatusPill,
  murdokuAiContext,
  runMurdokuAi,
} from '@/components/murdoku-panel-helpers';
import { SpriteSheetImporter } from '@/components/SpriteSheetImporter';

function useMurdokuDoc() {
  const app = useApp();
  const settings = normalizeMurdokuSettings(app.murdokuSettings ?? getDefaultMurdokuSettings());
  const pagePuzzles = app.murdokuBatchPuzzles.filter(
    (p) => p.pageId === app.activeDocumentPageId || !p.pageId
  );
  const current = pagePuzzles[0] ?? null;
  const patch = (updates: Partial<MurdokuSettings>) => app.updateMurdokuSettings(updates);
  return { app, settings, current, pagePuzzles, patch };
}

export function MurdokuPuzzleSettingsPanel({ onSave }: { onSave?: () => void }) {
  const { app, settings, current, patch } = useMurdokuDoc();
  const { core, grid } = settings;
  const fileRef = useRef<HTMLInputElement>(null);
  const [importerOpen, setImporterOpen] = useState(false);
  const [cropping, setCropping] = useState(false);
  const [cropStatus, setCropStatus] = useState('');
  const [importSrc, setImportSrc] = useState(
    () => recalledUploadedSheet('rooms') || settings.artwork.roomSheetSrc || ''
  );
  const patchCore = (next: Partial<MurdokuSettings['core']>) =>
    patch({ core: { ...core, ...next } });
  const patchGrid = (next: Partial<MurdokuSettings['grid']>) =>
    patch({ grid: { ...grid, ...next } });
  const patchArtwork = (artwork: Partial<MurdokuSettings['artwork']>) =>
    patch({ artwork: { ...settings.artwork, ...artwork } });
  const applyAuto = () => patch(autoBalanceMurdokuSettings(settings, app.wordSearchSettings, current));
  const roomItems = settings.rooms.map((room) => ({
    slotId: room.slotId,
    name: room.name,
    description: room.description,
  }));
  const roomLayout = autoSheetLayout(roomItems.length);

  const applyRoomAssets = (assets: ExtractedAsset[], crop?: SpriteSheetCropConfig) => {
    patch({
      rooms: settings.rooms.map((room) => ({
        ...room,
        imageSrc: assets.find((x) => x.slotId === room.slotId)?.dataUrl || room.imageSrc,
      })),
      artwork: {
        ...settings.artwork,
        roomStatus: 'imported',
        ...(crop ? { roomCrop: crop } : {}),
      },
    });
  };

  const downloadRoomSheet = () => {
    const packed = sheetSettingsForItems(settings.artwork.roomSheet, roomItems.length);
    const png = buildReferenceSheetPng(roomItems, packed, 'Rooms reference');
    downloadDataUrl(png, 'murdoku-rooms.png');
    patchArtwork({ roomStatus: 'sheet-ready', roomSheet: packed });
  };

  const copyRoomPrompt = async () => {
    const prompt = buildRoomAiPrompt({
      themeName: settings.theme.name,
      location: settings.theme.location,
      style: settings.artwork.artStyle,
      customStyle: settings.artwork.customStyle,
      suffix: settings.artwork.promptSuffix,
      rooms: settings.rooms,
      ...roomLayout,
    });
    patchArtwork({ roomPrompt: prompt });
    await navigator.clipboard.writeText(prompt);
    toast.success('Prompt copied');
  };

  const onUploadRooms = async (file: File) => {
    const url = storeUploadedSheet('rooms', file, setImportSrc);
    patchArtwork({ roomStatus: 'awaiting-art', roomCrop: undefined });
    setCropping(true);
    setCropStatus('Analyzing artwork...');
    try {
      const pipeline = await runSpriteSheetPipeline(
        url,
        roomItems,
        roomLayout.columns,
        roomLayout.rows,
        'rooms',
        {},
        (status) => setCropStatus(status)
      );
      applyRoomAssets(pipeline.assets, pipeline.config);
      toast.success('Rooms cropped');
    } catch (error) {
      console.error(error);
      toast.error('Could not crop the rooms sheet.');
    } finally {
      setCropping(false);
    }
  };

  return (
    <div className="space-y-4">
      <MurdokuHeaderRow title="Murdoku Settings" onSave={onSave} />
      <div className="flex flex-wrap gap-1.5">
        <MurdokuStatusPill
          label={current?.validation.status === 'unique' ? 'Unique solution' : current ? current.validation.status : 'Not generated'}
          ok={current?.validation.status === 'unique'}
        />
        {current ? (
          <MurdokuStatusPill
            label={difficultyLabelText(current.validation.difficultyScore, current.validation.difficultyLabel)}
            ok
          />
        ) : null}
      </div>
      <div className="rounded-lg border border-sky-200 bg-sky-50 px-3 py-2.5 dark:border-sky-800 dark:bg-sky-950/40 space-y-2">
        <Checkbox
          checked={core.twoPagePuzzles}
          onCheckedChange={(c) => patchCore({ twoPagePuzzles: c === true })}
          label={
            <span>
              Two-page puzzle
              <span className="block text-xs font-normal text-slate-500">
                Page 1: characters and clues. Page 2: larger crime-scene grid.
              </span>
            </span>
          }
        />
        <Checkbox
          checked={core.avoidRandomProps !== false}
          onCheckedChange={(c) => patchCore({ avoidRandomProps: c === true })}
          label="Avoid random props"
        />
        <Checkbox
          checked={core.useOnlyLargeFurniture === true}
          onCheckedChange={(c) => patchCore({ useOnlyLargeFurniture: c === true })}
          label="Use only large room-related furniture/decor"
        />
      </div>
      <Accordion type="multiple" defaultValue={['setup', 'grid', 'difficulty', 'rooms', 'actions']}>
        <AccordionItem value="setup">
          <AccordionTrigger>Puzzle Setup</AccordionTrigger>
          <AccordionContent className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-gray-500">Number of Puzzles</Label>
                <IntegerInput
                  value={core.numberOfPuzzles}
                  onChange={(v) =>
                    patchCore(murdokuCountPatchForTotal(v, core.difficulty === 'mixed'))
                  }
                  min={1}
                  max={100}
                />
              </div>
              <div>
                <Label className="text-xs text-gray-500">Starting Number</Label>
                <IntegerInput value={core.puzzlesStartingNumber} onChange={(v) => patchCore({ puzzlesStartingNumber: v })} min={0} />
              </div>
            </div>
            <DivideListsIntoChaptersControl
              numberOfPuzzles={core.numberOfPuzzles}
              puzzlesStartingNumber={core.puzzlesStartingNumber}
            />
            <div className="flex flex-wrap gap-2">
              {[1, 10, 25, 50, 100].map((n) => (
                <Button
                  key={n}
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => patchCore(murdokuCountPatchForTotal(n, core.difficulty === 'mixed'))}
                >
                  {n}
                </Button>
              ))}
            </div>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={core.sameThemeForAll} onCheckedChange={(c) => patchCore({ sameThemeForAll: c === true })} />
              Same theme for all puzzles
            </label>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={core.rotateThemes} onCheckedChange={(c) => patchCore({ rotateThemes: c === true })} />
              Rotate themes in bulk
            </label>
            {core.difficulty !== 'mixed' ? (
              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={core.progressiveDifficulty} onCheckedChange={(c) => patchCore({ progressiveDifficulty: c === true })} />
                Progressive difficulty
              </label>
            ) : null}
          </AccordionContent>
        </AccordionItem>
        <AccordionItem value="grid">
          <AccordionTrigger>Grid</AccordionTrigger>
          <AccordionContent className="space-y-3">
            <div className="flex justify-between text-sm">
              <Label>Grid Size</Label>
              <span>{core.rows} × {core.cols}</span>
            </div>
            <SliderField label="Grid rows" value={core.rows} onValueChange={(v) => patchCore({ rows: v })} min={4} max={16} />
            <SliderField label="Grid columns" value={core.cols} onValueChange={(v) => patchCore({ cols: v })} min={4} max={16} />
            <SliderField label="Cell size" value={grid.cellSize} onValueChange={(v) => patchGrid({ cellSize: v })} min={10} max={64} disabled={grid.autoCellSize} />
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={grid.autoCellSize} onCheckedChange={(c) => patchGrid({ autoCellSize: c === true })} />
              Automatic cell sizing
            </label>
            <SliderField label="Cell line thickness" value={grid.lineThickness} onValueChange={(v) => patchGrid({ lineThickness: v })} min={0.2} max={4} step={0.1} />
            <SliderField label="Outer border thickness" value={grid.outerBorderThickness} onValueChange={(v) => patchGrid({ outerBorderThickness: v })} min={0.5} max={16} step={0.25} />
            <SliderField label="Room border thickness" value={grid.roomBorderThickness} onValueChange={(v) => patchGrid({ roomBorderThickness: v })} min={1} max={16} step={0.25} />
            <Select value={grid.lineStyle} onValueChange={(v) => patchGrid({ lineStyle: v as MurdokuSettings['grid']['lineStyle'] })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="solid">Solid</SelectItem>
                <SelectItem value="dashed">Dashed</SelectItem>
                <SelectItem value="dotted">Dotted</SelectItem>
              </SelectContent>
            </Select>
            <SliderField label="Room background opacity" value={grid.roomBackgroundOpacity} onValueChange={(v) => patchGrid({ roomBackgroundOpacity: v })} min={0} max={100} format="%" />
            <SliderField label="Object size" value={grid.objectSize} onValueChange={(v) => patchGrid({ objectSize: v })} min={40} max={100} format="%" />
            <SliderField label="Character marker size" value={grid.characterMarkerSize} onValueChange={(v) => patchGrid({ characterMarkerSize: v })} min={40} max={100} format="%" />
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={Boolean(grid.locked)} onCheckedChange={(c) => patchGrid({ locked: c === true })} />
              Lock grid
            </label>
            <Button type="button" variant="outline" size="sm" onClick={() => patchGrid(getDefaultMurdokuSettings().grid)}>
              Reset grid
            </Button>
          </AccordionContent>
        </AccordionItem>
        <AccordionItem value="difficulty">
          <AccordionTrigger>Difficulty</AccordionTrigger>
          <AccordionContent className="space-y-3">
            <Select
              value={core.difficulty}
              onValueChange={(v) => {
                const difficulty = v as MurdokuDifficultyMode;
                if (difficulty === 'mixed') {
                  const counts = defaultMixedMurdokuLevelCounts(core.numberOfPuzzles);
                  patchCore({
                    difficulty,
                    mixedEasyCount: counts.easy,
                    mixedMediumCount: counts.medium,
                    mixedHardCount: counts.hard,
                    numberOfPuzzles: counts.easy + counts.medium + counts.hard,
                    progressiveDifficulty: false,
                  });
                  return;
                }
                patchCore({ difficulty });
              }}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="easy">Easy</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="hard">Hard</SelectItem>
                <SelectItem value="expert">Expert</SelectItem>
                <SelectItem value="custom">Custom</SelectItem>
                <SelectItem value="mixed">Mixed easy → hard</SelectItem>
              </SelectContent>
            </Select>
            {core.difficulty === 'custom' ? (
              <IntegerInput value={core.customClueCount} onChange={(v) => patchCore({ customClueCount: v })} min={4} max={40} />
            ) : null}
            {core.difficulty === 'mixed' ? (
              <div className="rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/40 p-3 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-medium text-slate-700 dark:text-slate-200">
                    Puzzles per level
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 text-[10px]"
                    onClick={() => {
                      const counts = defaultMixedMurdokuLevelCounts(core.numberOfPuzzles);
                      patchCore({
                        mixedEasyCount: counts.easy,
                        mixedMediumCount: counts.medium,
                        mixedHardCount: counts.hard,
                        numberOfPuzzles: counts.easy + counts.medium + counts.hard,
                      });
                    }}
                  >
                    Reset split
                  </Button>
                </div>
                <p className="text-[11px] text-gray-500">
                  Hard gets the largest share by default (~50%), then medium (~30%), then
                  easy (~20%). Edit freely — total becomes the number of puzzles.
                </p>
                {(
                  [
                    { key: 'mixedEasyCount' as const, label: 'Easy' },
                    { key: 'mixedMediumCount' as const, label: 'Medium' },
                    { key: 'mixedHardCount' as const, label: 'Hard' },
                  ] as const
                ).map((row) => (
                  <div key={row.key} className="grid grid-cols-[1fr_88px] items-center gap-2">
                    <p className="text-xs font-medium">{row.label}</p>
                    <IntegerInput
                      value={core[row.key]}
                      onChange={(v) => {
                        const next = {
                          mixedEasyCount: core.mixedEasyCount,
                          mixedMediumCount: core.mixedMediumCount,
                          mixedHardCount: core.mixedHardCount,
                          [row.key]: Math.max(0, v),
                        };
                        patchCore({
                          ...next,
                          numberOfPuzzles:
                            next.mixedEasyCount + next.mixedMediumCount + next.mixedHardCount,
                        });
                      }}
                      min={0}
                      max={100}
                    />
                  </div>
                ))}
                <p className="text-[11px] text-slate-600 dark:text-slate-300">
                  Total:{' '}
                  <span className="font-semibold">
                    {core.mixedEasyCount + core.mixedMediumCount + core.mixedHardCount}
                  </span>{' '}
                  puzzles
                </p>
              </div>
            ) : null}
          </AccordionContent>
        </AccordionItem>
        <AccordionItem value="rooms">
          <AccordionTrigger>Rooms</AccordionTrigger>
          <AccordionContent className="space-y-3">
            <MurdokuStatusPill
              label={(settings.artwork.roomStatus || 'names-ready').replace(/-/g, ' ')}
              ok={settings.artwork.roomStatus === 'imported'}
            />
            <SliderField
              label="Cell line thickness"
              value={grid.lineThickness}
              onValueChange={(v) => patchGrid({ lineThickness: v })}
              min={0.2}
              max={4}
              step={0.1}
            />
            <SliderField
              label="Room border thickness"
              value={grid.roomBorderThickness}
              onValueChange={(v) => patchGrid({ roomBorderThickness: v })}
              min={1}
              max={16}
              step={0.25}
            />
            <p className="text-[11px] text-slate-500">
              Thin black lines divide cells. Thick lines mark rooms and the outer edge. This does not change uploaded floor textures.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() =>
                  patch({
                    rooms: [
                      ...settings.rooms,
                      {
                        id: `room-${settings.rooms.length + 1}`,
                        slotId: slotId('R', settings.rooms.length),
                        name: `Room ${settings.rooms.length + 1}`,
                        color: '#e2e8f0',
                        labelVisible: true,
                        description: '',
                      },
                    ],
                  })
                }
              >
                Add room
              </Button>
              <Button type="button" size="sm" variant="outline" onClick={() => patch({ rooms: defaultMurdokuRooms(settings.theme.id) })}>
                Auto-generate rooms
              </Button>
            </div>
            {settings.rooms.map((room) => (
              <div key={room.id} className="flex items-center gap-2">
                {room.imageSrc ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={room.imageSrc} alt="" className="h-10 w-10 rounded border object-contain bg-white" />
                ) : null}
                <span className="text-[10px] font-mono text-slate-500">{room.slotId}</span>
                <SettingsTextInput
                  value={room.name}
                  onChange={(v) =>
                    patch({
                      rooms: syncRoomsCatalog(
                        settings.rooms.map((r) => (r.id === room.id ? { ...r, name: v } : r)),
                        settings.theme.name,
                        {
                          avoidRandomProps: core.avoidRandomProps !== false,
                          useOnlyLargeFurniture: core.useOnlyLargeFurniture === true,
                        }
                      ),
                    })
                  }
                />
                <MiniColorInput label="" value={room.color} onChange={(v) => patch({ rooms: settings.rooms.map((r) => (r.id === room.id ? { ...r, color: v } : r)) })} />
                <Button type="button" size="sm" variant="ghost" onClick={() => patch({ rooms: settings.rooms.filter((r) => r.id !== room.id) })}>Delete</Button>
              </div>
            ))}
            <div className="space-y-2 border-t pt-3">
              <p className="text-xs font-semibold text-slate-700">Room artwork</p>
              <Button type="button" size="sm" onClick={downloadRoomSheet}>
                Download Rooms Reference Sheet
              </Button>
              <Button type="button" size="sm" variant="outline" onClick={() => void copyRoomPrompt()}>
                Copy Rooms AI Prompt
              </Button>
              <Button type="button" size="sm" variant="outline" onClick={() => fileRef.current?.click()} disabled={cropping}>
                Upload Generated Rooms Sheet
              </Button>
              {importSrc || settings.artwork.roomStatus === 'awaiting-art' || settings.artwork.roomStatus === 'imported' ? (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={cropping}
                  onClick={() => {
                    const src = recalledUploadedSheet('rooms') || importSrc;
                    if (!src) {
                      toast.error('Upload the generated rooms sheet again to edit cropping.');
                      fileRef.current?.click();
                      return;
                    }
                    setImportSrc(src);
                    setImporterOpen(true);
                  }}
                >
                  Edit cropping
                </Button>
              ) : null}
              {cropping ? (
                <p className="flex items-center gap-2 text-xs text-slate-600">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  {cropStatus || 'Cropping...'}
                </p>
              ) : null}
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void onUploadRooms(file);
                  e.target.value = '';
                }}
              />
              <p className="text-xs text-slate-500">
                Download the labeled reference table, generate artwork from the copied prompt, then upload the sprite sheet.
                Rooms are cropped automatically. Use Edit cropping to adjust boxes and effects.
              </p>
              {settings.artwork.roomPrompt ? (
                <SettingsTextarea value={settings.artwork.roomPrompt} onChange={(v) => patchArtwork({ roomPrompt: v })} />
              ) : null}
            </div>
          </AccordionContent>
        </AccordionItem>
        <AccordionItem value="clues">
          <AccordionTrigger>Clues</AccordionTrigger>
          <AccordionContent className="space-y-2">
            {(current?.clues ?? []).map((clue) => (
              <div key={clue.id} className="rounded border p-2">
                <div className="text-[10px] font-semibold uppercase text-slate-500">{clue.type}</div>
                <p className="text-sm">
                  {core.useSimpleLogicWording ? clue.simpleText : clue.displayText || clue.simpleText}
                </p>
              </div>
            ))}
            {!current ? <p className="text-xs text-slate-500">Generate a puzzle to view clues.</p> : null}
          </AccordionContent>
        </AccordionItem>
        <AccordionItem value="validation">
          <AccordionTrigger>Validation</AccordionTrigger>
          <AccordionContent className="space-y-2">
            <p className="text-sm">{current ? (current.validation.status === 'unique' ? 'Unique solution' : current.validation.status === 'multiple' ? 'Multiple solutions' : current.validation.status === 'none' ? 'No solution' : current.validation.status) : 'Not generated'}</p>
            {current?.validation.redundantClueIds?.length ? (
              <p className="text-xs text-amber-700">Redundant clues: {current.validation.redundantClueIds.length}</p>
            ) : null}
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={!current}
                onClick={() => {
                  if (!current) return;
                  const validation = validateMurdokuPuzzle(current, settings.elements);
                  app.replaceMurdokuPuzzle({ ...current, validation });
                  toast.success(
                    validation.status === 'unique'
                      ? 'Unique solution'
                      : validation.status === 'multiple'
                        ? 'Multiple solutions — use Auto Fix'
                        : 'No solution — use Auto Fix'
                  );
                }}
              >
                Validate Puzzle
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={!current}
                onClick={() => {
                  if (!current) return;
                  const fixed = autoFixMurdokuPuzzle(current, settings.elements);
                  app.replaceMurdokuPuzzle(fixed);
                  toast.success(fixed.validation.status === 'unique' ? 'Puzzle auto-fixed' : 'Could not force a unique solution');
                }}
              >
                Auto Fix Puzzle
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={!current}
                onClick={() => {
                  if (!current) return;
                  const minimized = autoFixMurdokuPuzzle(current, settings.elements, current.seed + 31);
                  app.replaceMurdokuPuzzle(minimized);
                  toast.success(`Clues: ${minimized.clues.length}`);
                }}
              >
                Minimize Clues
              </Button>
            </div>
          </AccordionContent>
        </AccordionItem>
        <AccordionItem value="actions">
          <AccordionTrigger>Generate</AccordionTrigger>
          <AccordionContent className="flex flex-wrap gap-2">
            <Button type="button" size="sm" onClick={() => app.generatePuzzle()}>Generate Puzzle</Button>
            <Button type="button" size="sm" variant="outline" onClick={() => app.generatePuzzle()}>Generate Another</Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => {
                const next = !core.showSolution;
                patchCore({ showSolution: next });
                app.setShowSolution(next);
                app.setActivePreviewTab(next ? 'solutions' : 'puzzles');
              }}
            >
              {core.showSolution ? 'Hide Solution' : 'Show Solution'}
            </Button>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
      <SpriteSheetImporter
        open={importerOpen}
        onOpenChange={setImporterOpen}
        kind="rooms"
        items={roomItems}
        rows={roomLayout.rows}
        columns={roomLayout.columns}
        originalSrc={importSrc}
        savedCrop={settings.artwork.roomCrop}
        onImport={(assets, crop) => {
          applyRoomAssets(assets, crop);
          toast.success('Room crops updated');
        }}
      />
    </div>
  );
}

function storeUploadedSheet(kind: SpriteSheetKind, file: File, setImportSrc: (src: string) => void) {
  const url = rememberUploadedSheet(kind, file);
  setImportSrc(url);
  return url;
}

export function MurdokuCharactersSettingsPanel({ onSave }: { onSave?: () => void }) {
  const { settings, patch } = useMurdokuDoc();
  const fileRef = useRef<HTMLInputElement>(null);
  const [importerOpen, setImporterOpen] = useState(false);
  const [cropping, setCropping] = useState(false);
  const [cropStatus, setCropStatus] = useState('');
  const [importSrc, setImportSrc] = useState(
    () => recalledUploadedSheet('characters') || settings.artwork.characterSheetSrc || ''
  );
  const patchArtwork = (artwork: Partial<MurdokuSettings['artwork']>) =>
    patch({ artwork: { ...settings.artwork, ...artwork } });
  const items = settings.characters.map((c) => ({ slotId: c.slotId, name: c.name, description: c.description }));
  const layout = autoSheetLayout(items.length);

  const applyCharacterAssets = (assets: ExtractedAsset[], crop?: SpriteSheetCropConfig) => {
    patch({
      characters: settings.characters.map((c) => ({
        ...c,
        imageSrc: assets.find((x) => x.slotId === c.slotId)?.dataUrl || c.imageSrc,
      })),
      artwork: {
        ...settings.artwork,
        characterStatus: 'imported',
        ...(crop ? { characterCrop: crop } : {}),
      },
    });
  };

  const downloadSheet = () => {
    const packed = sheetSettingsForItems(settings.artwork.characterSheet, items.length);
    const png = buildReferenceSheetPng(items, packed, 'Character reference');
    downloadDataUrl(png, 'murdoku-characters.png');
    patchArtwork({ characterStatus: 'sheet-ready', characterSheet: packed });
  };

  const copyPrompt = async () => {
    const prompt = buildCharacterAiPrompt({
      themeName: settings.theme.name,
      location: settings.theme.location,
      style: settings.artwork.artStyle,
      customStyle: settings.artwork.customStyle,
      suffix: settings.artwork.promptSuffix,
      characters: settings.characters,
      ...layout,
    });
    patchArtwork({ characterPrompt: prompt });
    await navigator.clipboard.writeText(prompt);
    toast.success('Prompt copied');
  };

  const onUpload = async (file: File) => {
    const url = storeUploadedSheet('characters', file, setImportSrc);
    patchArtwork({ characterStatus: 'awaiting-art', characterCrop: undefined });
    setCropping(true);
    setCropStatus('Analyzing artwork...');
    try {
      const pipeline = await runSpriteSheetPipeline(
        url,
        items,
        layout.columns,
        layout.rows,
        'characters',
        {},
        (status) => setCropStatus(status)
      );
      applyCharacterAssets(pipeline.assets, pipeline.config);
      toast.success('Characters cropped');
    } catch (error) {
      console.error(error);
      toast.error('Could not crop the character sheet.');
    } finally {
      setCropping(false);
    }
  };

  return (
    <div className="space-y-4">
      <MurdokuHeaderRow title="Characters" onSave={onSave} />
      <MurdokuStatusPill
        label={settings.artwork.characterStatus.replace(/-/g, ' ')}
        ok={settings.artwork.characterStatus === 'imported'}
      />
      <Accordion type="multiple" defaultValue={['characters', 'char-art']}>
        <AccordionItem value="characters">
          <AccordionTrigger>Characters</AccordionTrigger>
          <AccordionContent className="space-y-3">
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() =>
                  patch({
                    characters: [
                      ...settings.characters,
                      {
                        id: `char-${settings.characters.length + 1}`,
                        slotId: slotId('C', settings.characters.length),
                        name: `Suspect ${settings.characters.length + 1}`,
                        enabled: true,
                        occupation: '',
                        description: '',
                        clothingNotes: '',
                        clueText: '',
                        isVictim: false,
                        isMurderer: false,
                      },
                    ],
                  })
                }
              >
                Add character
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => patch({ characters: defaultMurdokuCharacters(settings.characters.length || 9) })}
              >
                Randomize names
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() =>
                  runMurdokuAi('Character names generated', async () => {
                    const data = await requestMurdokuAi({ task: 'character-names', settings: murdokuAiContext(settings) });
                    const names = Array.isArray(data.names) ? (data.names as string[]) : [];
                    patch({ characters: settings.characters.map((c, i) => ({ ...c, name: names[i] || c.name })) });
                  })
                }
              >
                <Sparkles className="h-3.5 w-3.5 mr-1" />
                Generate names with AI
              </Button>
            </div>
            {settings.characters.map((char) => (
              <div key={char.id} className="rounded border p-2 space-y-2">
                <div className="flex items-center gap-2">
                  {char.imageSrc ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={char.imageSrc} alt="" className="h-10 w-10 rounded border object-contain bg-white" />
                  ) : null}
                  <span className="text-[10px] font-mono text-slate-500">{char.slotId}</span>
                  <SettingsTextInput
                    value={char.name}
                    onChange={(v) =>
                      patch({ characters: settings.characters.map((c) => (c.id === char.id ? { ...c, name: v } : c)) })
                    }
                  />
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => patch({ characters: settings.characters.filter((c) => c.id !== char.id) })}
                  >
                    Remove
                  </Button>
                </div>
                <SettingsTextInput
                  value={char.occupation}
                  onChange={(v) =>
                    patch({ characters: settings.characters.map((c) => (c.id === char.id ? { ...c, occupation: v } : c)) })
                  }
                />
                <SettingsTextarea
                  value={char.description}
                  onChange={(v) =>
                    patch({ characters: settings.characters.map((c) => (c.id === char.id ? { ...c, description: v } : c)) })
                  }
                />
                <label className="flex items-center gap-2 text-xs">
                  <Checkbox
                    checked={char.enabled}
                    onCheckedChange={(c) =>
                      patch({
                        characters: settings.characters.map((x) => (x.id === char.id ? { ...x, enabled: c === true } : x)),
                      })
                    }
                  />
                  Enabled
                </label>
              </div>
            ))}
          </AccordionContent>
        </AccordionItem>
        <AccordionItem value="char-art">
          <AccordionTrigger>Character Artwork</AccordionTrigger>
          <AccordionContent className="space-y-2">
            <Select value={settings.artwork.artStyle} onValueChange={(v) => patchArtwork({ artStyle: v as MurdokuArtStyle })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(MURDOKU_ART_STYLE_LABELS) as MurdokuArtStyle[]).map((key) => (
                  <SelectItem key={key} value={key}>
                    {MURDOKU_ART_STYLE_LABELS[key]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <SettingsTextInput value={settings.artwork.promptSuffix} onChange={(v) => patchArtwork({ promptSuffix: v })} />
            <Button type="button" size="sm" onClick={downloadSheet}>
              Download Character Reference Sheet
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={copyPrompt}>
              Copy Character AI Prompt
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={() => fileRef.current?.click()} disabled={cropping}>
              Upload Generated Character Sheet
            </Button>
            {importSrc || settings.artwork.characterStatus === 'awaiting-art' || settings.artwork.characterStatus === 'imported' ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={cropping}
                onClick={() => {
                  const src = recalledUploadedSheet('characters') || importSrc;
                  if (!src) {
                    toast.error('Upload the generated character sheet again to edit cropping.');
                    fileRef.current?.click();
                    return;
                  }
                  setImportSrc(src);
                  setImporterOpen(true);
                }}
              >
                Edit cropping
              </Button>
            ) : null}
            {cropping ? (
              <p className="flex items-center gap-2 text-xs text-slate-600">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                {cropStatus || 'Cropping...'}
              </p>
            ) : null}
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void onUpload(file);
                e.target.value = '';
              }}
            />
            <p className="text-xs text-slate-500">
              Download the labeled reference table, generate artwork from the copied prompt, then upload the sprite sheet.
              Characters are cropped automatically. Use Edit cropping to place the lines by hand.
            </p>
            {(settings.artwork.characterStatus === 'awaiting-art' ||
              settings.artwork.characterStatus === 'imported' ||
              importSrc) &&
            !cropping ? (
              <p className="text-xs text-slate-500">
                Character sheet uploaded. Cropping is applied automatically. Open Edit cropping to adjust the lines.
              </p>
            ) : null}
            {settings.artwork.characterPrompt ? (
              <SettingsTextarea value={settings.artwork.characterPrompt} onChange={(v) => patchArtwork({ characterPrompt: v })} />
            ) : null}
          </AccordionContent>
        </AccordionItem>
        <AccordionItem value="packs">
          <AccordionTrigger>Asset Library</AccordionTrigger>
          <AccordionContent className="space-y-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => {
                const pack = {
                  id: `pack-${Date.now()}`,
                  name: settings.theme.name,
                  themeId: settings.theme.id,
                  characterImages: Object.fromEntries(settings.characters.map((c) => [c.id, c.imageSrc || ''])),
                  elementImages: Object.fromEntries(settings.elements.map((e) => [e.id, e.imageSrc || ''])),
                };
                patch({ assetPacks: [...settings.assetPacks, pack] });
                toast.success(`Saved ${pack.name} asset pack`);
              }}
            >
              Save current asset pack
            </Button>
            {settings.assetPacks.map((pack) => (
              <div key={pack.id} className="flex items-center gap-2">
                <span className="text-sm flex-1 truncate">{pack.name}</span>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    patch({
                      characters: settings.characters.map((c) => ({
                        ...c,
                        imageSrc: pack.characterImages[c.id] || c.imageSrc,
                      })),
                      elements: settings.elements.map((e) => ({
                        ...e,
                        imageSrc: pack.elementImages[e.id] || e.imageSrc,
                      })),
                      artwork: {
                        ...settings.artwork,
                        characterStatus: 'imported',
                        elementStatus: 'imported',
                      },
                    });
                    toast.success(`Loaded ${pack.name}`);
                  }}
                >
                  Load
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    patch({
                      assetPacks: [...settings.assetPacks, { ...pack, id: `pack-${Date.now()}`, name: `${pack.name} copy` }],
                    })
                  }
                >
                  Duplicate
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => patch({ assetPacks: settings.assetPacks.filter((p) => p.id !== pack.id) })}
                >
                  Delete
                </Button>
              </div>
            ))}
          </AccordionContent>
        </AccordionItem>
      </Accordion>
      <SpriteSheetImporter
        open={importerOpen}
        onOpenChange={setImporterOpen}
        kind="characters"
        items={items}
        rows={layout.rows}
        columns={layout.columns}
        originalSrc={importSrc}
        savedCrop={settings.artwork.characterCrop}
        onImport={(assets, crop) => {
          applyCharacterAssets(assets, crop);
          toast.success('Character crops updated');
        }}
      />
    </div>
  );
}

export function MurdokuElementsSettingsPanel({ onSave }: { onSave?: () => void }) {
  const { settings, patch } = useMurdokuDoc();
  const fileRef = useRef<HTMLInputElement>(null);
  const [importerOpen, setImporterOpen] = useState(false);
  const [cropping, setCropping] = useState(false);
  const [cropStatus, setCropStatus] = useState('');
  const [importSrc, setImportSrc] = useState(
    () => recalledUploadedSheet('elements') || settings.artwork.elementSheetSrc || ''
  );
  const [allowedCategories, setAllowedCategories] = useState<MurdokuObjectCategory[]>([...MURDOKU_OBJECT_CATEGORIES]);
  const patchArtwork = (artwork: Partial<MurdokuSettings['artwork']>) =>
    patch({ artwork: { ...settings.artwork, ...artwork } });
  const items = settings.elements.map((e) => ({ slotId: e.slotId, name: e.name, description: e.description }));
  const layout = autoSheetLayout(items.length);
  const sceneStyle = {
    avoidRandomProps: settings.core.avoidRandomProps !== false,
    useOnlyLargeFurniture: settings.core.useOnlyLargeFurniture === true,
    allowedCategories,
  };
  const consistency = themeConsistencyScore(settings.rooms, settings.elements, sceneStyle, settings.theme.name);

  const applyElementNames = (names: string[]) => {
    const rooms = syncRoomsCatalog(settings.rooms, settings.theme.name, sceneStyle);
    const cleaned = sanitizeElementNames(names, rooms, sceneStyle, settings.theme.name);
    const defs = elementDefsFromNames(cleaned).map((el) => {
      const prev = settings.elements.find((e) => e.name.toLowerCase() === el.name.toLowerCase());
      return { ...el, imageSrc: prev?.imageSrc, id: prev?.id || el.id, slotId: prev?.slotId || el.slotId };
    });
    patch({ rooms, elements: defs });
  };

  const applyElementAssets = (assets: ExtractedAsset[], crop?: SpriteSheetCropConfig) => {
    patch({
      elements: settings.elements.map((e) => ({
        ...e,
        imageSrc: assets.find((x) => x.slotId === e.slotId)?.dataUrl || e.imageSrc,
      })),
      artwork: {
        ...settings.artwork,
        elementStatus: 'imported',
        ...(crop ? { elementCrop: crop } : {}),
      },
    });
  };

  const downloadSheet = () => {
    const packed = sheetSettingsForItems(settings.artwork.elementSheet, items.length);
    const png = buildReferenceSheetPng(items, packed, 'Elements reference');
    downloadDataUrl(png, 'murdoku-elements.png');
    patchArtwork({ elementStatus: 'sheet-ready', elementSheet: packed });
  };

  const copyPrompt = async () => {
    const prompt = buildElementAiPrompt({
      themeName: settings.theme.name,
      location: settings.theme.location,
      style: settings.artwork.artStyle,
      customStyle: settings.artwork.customStyle,
      suffix: settings.artwork.promptSuffix,
      elements: settings.elements,
      rooms: settings.rooms,
      ...layout,
    });
    patchArtwork({ elementPrompt: prompt });
    await navigator.clipboard.writeText(prompt);
    toast.success('Prompt copied');
  };

  const onUpload = async (file: File) => {
    const url = storeUploadedSheet('elements', file, setImportSrc);
    patchArtwork({ elementStatus: 'awaiting-art', elementCrop: undefined });
    setCropping(true);
    setCropStatus('Analyzing artwork...');
    try {
      const pipeline = await runSpriteSheetPipeline(
        url,
        items,
        layout.columns,
        layout.rows,
        'elements',
        {},
        (status) => setCropStatus(status)
      );
      applyElementAssets(pipeline.assets, pipeline.config);
      toast.success('Elements cropped');
    } catch (error) {
      console.error(error);
      toast.error('Could not crop the elements sheet.');
    } finally {
      setCropping(false);
    }
  };

  return (
    <div className="space-y-4">
      <MurdokuHeaderRow title="Elements" onSave={onSave} />
      <MurdokuStatusPill
        label={settings.artwork.elementStatus.replace(/-/g, ' ')}
        ok={settings.artwork.elementStatus === 'imported'}
      />
      <Accordion type="multiple" defaultValue={['elements', 'el-art']}>
        <AccordionItem value="elements">
          <AccordionTrigger>Elements</AccordionTrigger>
          <AccordionContent className="space-y-3">
            <Checkbox
              checked={settings.core.avoidRandomProps !== false}
              onCheckedChange={(c) => patch({ core: { ...settings.core, avoidRandomProps: c === true } })}
              label="Avoid random props"
            />
            <Checkbox
              checked={settings.core.useOnlyLargeFurniture === true}
              onCheckedChange={(c) => patch({ core: { ...settings.core, useOnlyLargeFurniture: c === true } })}
              label="Use only large room-related furniture/decor"
            />
            <div>
              <p className="text-[11px] font-semibold text-slate-600 mb-1">Allowed object categories</p>
              <div className="flex flex-wrap gap-x-3 gap-y-1">
                {MURDOKU_OBJECT_CATEGORIES.map((category) => (
                  <Checkbox
                    key={category}
                    compact
                    checked={allowedCategories.includes(category)}
                    onCheckedChange={(checked) =>
                      setAllowedCategories((prev) =>
                        checked === true
                          ? [...new Set([...prev, category])]
                          : prev.filter((item) => item !== category)
                      )
                    }
                    label={category}
                  />
                ))}
              </div>
              <p className="mt-1 text-[11px] text-slate-500">
                Excluded random items: phone, book, coffee, laptop, screwdriver, pencil, scissors, stapler, ruler
              </p>
            </div>
            <div className="rounded border px-2 py-1.5 text-xs">
              <p className="font-semibold">
                Theme consistency score: {consistency.score} · {consistency.label}
              </p>
              <p className="text-slate-500">{consistency.notes[0]}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() =>
                  patch({
                    elements: [
                      ...settings.elements,
                      {
                        id: `el-${settings.elements.length + 1}`,
                        slotId: slotId('E', settings.elements.length),
                        name: 'Object',
                        internalName: 'object',
                        description: '',
                        quantity: 1,
                        occupiesCell: true,
                        canStandOn: false,
                        canBeBeside: true,
                        blocksPlacement: false,
                        widthCells: 1,
                        heightCells: 1,
                        rotation: 0,
                        defaultScale: 1,
                      },
                    ],
                  })
                }
              >
                Add element
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={() =>
                  runMurdokuAi('Elements generated by room', async () => {
                    let names: string[] = [];
                    try {
                      const data = await requestMurdokuAi({
                        task: 'element-list',
                        settings: murdokuAiContext(settings),
                      });
                      names = Array.isArray(data.elements) ? (data.elements as string[]) : [];
                    } catch {
                      names = [];
                    }
                    if (!names.length) {
                      names = buildSharedElementPool(
                        settings.rooms,
                        sceneStyle,
                        settings.theme.name,
                        12
                      );
                    }
                    applyElementNames(names);
                  })
                }
              >
                <Sparkles className="h-3.5 w-3.5 mr-1" />
                Generate Elements by Room
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() =>
                  applyElementNames(
                    buildSharedElementPool(settings.rooms, sceneStyle, settings.theme.name, 12)
                  )
                }
              >
                Fill from room catalogs
              </Button>
            </div>
            <div className="space-y-2">
              <p className="text-[11px] font-semibold text-slate-600">Room-based object filtering</p>
              {settings.rooms.map((room) => (
                <div key={room.id} className="rounded border px-2 py-1.5 text-[11px] text-slate-600">
                  <p className="font-semibold text-slate-800">
                    {room.name}
                    <span className="ml-1 font-normal text-slate-500">· {room.roomKind || 'room'}</span>
                  </p>
                  <p>Furniture: {(room.allowedFurniture || []).join(', ') || '—'}</p>
                  <p>Decor: {(room.allowedDecor || []).join(', ') || '—'}</p>
                  <p>Objects: {(room.allowedObjects || []).join(', ') || '—'}</p>
                </div>
              ))}
            </div>
            {settings.elements.map((el) => (
              <div key={el.id} className="rounded border p-2 space-y-2">
                <div className="flex gap-2">
                  {el.imageSrc ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={el.imageSrc} alt="" className="h-10 w-10 rounded border object-contain bg-white" />
                  ) : null}
                  <SettingsTextInput
                    value={el.name}
                    onChange={(v) =>
                      patch({
                        elements: settings.elements.map((e) =>
                          e.id === el.id ? { ...e, name: v, canStandOn: isStandOnPropName(v) } : e
                        ),
                      })
                    }
                  />
                  <IntegerInput
                    value={el.quantity}
                    onChange={(v) =>
                      patch({ elements: settings.elements.map((e) => (e.id === el.id ? { ...e, quantity: v } : e)) })
                    }
                    min={1}
                    max={8}
                  />
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => patch({ elements: settings.elements.filter((e) => e.id !== el.id) })}
                  >
                    Delete
                  </Button>
                </div>
              </div>
            ))}
          </AccordionContent>
        </AccordionItem>
        <AccordionItem value="el-art">
          <AccordionTrigger>Element Artwork</AccordionTrigger>
          <AccordionContent className="space-y-2">
            <Select value={settings.artwork.artStyle} onValueChange={(v) => patchArtwork({ artStyle: v as MurdokuArtStyle })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(MURDOKU_ART_STYLE_LABELS) as MurdokuArtStyle[]).map((key) => (
                  <SelectItem key={key} value={key}>
                    {MURDOKU_ART_STYLE_LABELS[key]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <SettingsTextInput value={settings.artwork.promptSuffix} onChange={(v) => patchArtwork({ promptSuffix: v })} />
            <Button type="button" size="sm" onClick={downloadSheet}>
              Download Elements Reference Sheet
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={copyPrompt}>
              Copy Elements AI Prompt
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={() => fileRef.current?.click()} disabled={cropping}>
              Upload Generated Elements Sheet
            </Button>
            {importSrc || settings.artwork.elementStatus === 'awaiting-art' || settings.artwork.elementStatus === 'imported' ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={cropping}
                onClick={() => {
                  const src = recalledUploadedSheet('elements') || importSrc;
                  if (!src) {
                    toast.error('Upload the generated elements sheet again to edit cropping.');
                    fileRef.current?.click();
                    return;
                  }
                  setImportSrc(src);
                  setImporterOpen(true);
                }}
              >
                Edit cropping
              </Button>
            ) : null}
            {cropping ? (
              <p className="flex items-center gap-2 text-xs text-slate-600">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                {cropStatus || 'Cropping...'}
              </p>
            ) : null}
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void onUpload(file);
                e.target.value = '';
              }}
            />
            <p className="text-xs text-slate-500">
              Download the labeled reference table, generate artwork from the copied prompt, then upload the sprite sheet.
              Elements are cropped automatically. Use Edit cropping to place the lines by hand.
            </p>
            {(settings.artwork.elementStatus === 'awaiting-art' ||
              settings.artwork.elementStatus === 'imported' ||
              importSrc) &&
            !cropping ? (
              <p className="text-xs text-slate-500">
                Elements sheet uploaded. Cropping is applied automatically. Open Edit cropping to adjust the lines.
              </p>
            ) : null}
            {settings.artwork.elementPrompt ? (
              <SettingsTextarea value={settings.artwork.elementPrompt} onChange={(v) => patchArtwork({ elementPrompt: v })} />
            ) : null}
          </AccordionContent>
        </AccordionItem>
      </Accordion>
      <SpriteSheetImporter
        open={importerOpen}
        onOpenChange={setImporterOpen}
        kind="elements"
        items={items}
        rows={layout.rows}
        columns={layout.columns}
        originalSrc={importSrc}
        savedCrop={settings.artwork.elementCrop}
        onImport={(assets, crop) => {
          applyElementAssets(assets, crop);
          toast.success('Element crops updated');
        }}
      />
    </div>
  );
}

export function MurdokuTitlesSettingsPanel({ onSave }: { onSave?: () => void }) {
  const { app, settings, current, pagePuzzles, patch } = useMurdokuDoc();
  const patchStory = (story: Partial<MurdokuSettings['story']>) =>
    patch({ story: { ...settings.story, ...story } });
  const patchCore = (core: Partial<MurdokuSettings['core']>) =>
    patch({ core: { ...settings.core, ...core } });
  const applyAuto = () =>
    patch(autoBalanceMurdokuSettings(settings, app.wordSearchSettings, current));

  const puzzleCount = Math.max(settings.core.numberOfPuzzles || 1, pagePuzzles.length, 1);
  const markEdited =
    settings.story.source === 'empty'
      ? 'manual'
      : settings.story.source === 'ai'
        ? 'edited'
        : settings.story.source;

  return (
    <div className="space-y-4">
      <MurdokuHeaderRow title="Theme, Story & Layout" onSave={onSave} />


      <div className="flex items-center gap-2">
        <Select
          value={settings.theme.id}
          onValueChange={(id) => {
            const preset = MURDOKU_THEME_PRESETS.find((t) => t.id === id);
            if (preset) patch(applyThemePreset(preset));
          }}
        >
          <SelectTrigger className="flex-1">
            <SelectValue placeholder="Theme" />
          </SelectTrigger>
          <SelectContent>
            {MURDOKU_THEME_PRESETS.map((t) => (
              <SelectItem key={t.id} value={t.id}>
                {t.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => patch(applyThemePreset(randomMurdokuTheme()))}
        >
          Random
        </Button>
      </div>

      <div className="space-y-2">
        <Label className="text-sm font-medium">Case titles</Label>
        <SettingsTextarea
          className="h-28"
          value={settings.story.caseTitle}
          onChange={(v) => patchStory({ caseTitle: v, source: markEdited })}
          placeholder="Enter one title per line..."
        />
        <p className="text-xs text-gray-500">
          Enter one title per line. The first line is for Puzzle 1, the second for Puzzle 2, etc.
        </p>
      </div>

      <div className="space-y-2 pt-2 border-t">
        <div className="flex items-center justify-between gap-2">
          <Label className="text-sm font-medium">Story / instructions</Label>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() =>
              runMurdokuAi('Story generated', async () => {
                const data = await requestMurdokuAi({
                  task: 'story',
                  instruction: `Write ${puzzleCount} different one-sentence intros, one per puzzle. Return them as a newline-separated intro string.`,
                  settings: murdokuAiContext(settings),
                });
                const fromList = Array.isArray(data.intros)
                  ? (data.intros as unknown[]).map((line) => String(line || '').trim())
                  : [];
                const fromText = String(data.intro || '')
                  .split(/\r?\n/)
                  .map((line) => line.trim())
                  .filter(Boolean);
                const stories = murdokuLinesForCount(
                  joinMurdokuLines(fromList.length ? fromList : fromText),
                  puzzleCount
                );
                const titles = murdokuLinesForCount(
                  String(data.caseTitle || settings.story.caseTitle),
                  puzzleCount
                );
                const joined = joinMurdokuLines(stories);
                patchStory({
                  caseTitle: joinMurdokuLines(titles),
                  intro: joined,
                  instruction: joined,
                  source: 'ai',
                });
              })
            }
          >
            <Sparkles className="h-3.5 w-3.5 mr-1" />
            AI
          </Button>
        </div>
        <SettingsTextarea
          className="h-28"
          value={settings.story.intro}
          onChange={(v) => patchStory({ intro: v, instruction: v, source: markEdited })}
          placeholder="Enter one fun fact or quote per line..."
        />
        <p className="text-xs text-gray-500">
          Enter one sentence per line. Each line appears under the corresponding puzzle (Line 1
          under Puzzle 1, Line 2 under Puzzle 2, etc.)
        </p>
      </div>

      <label className="flex items-center gap-2 text-sm">
        <Checkbox
          checked={settings.deductionGrid.visible}
          onCheckedChange={(c) =>
            patch({ deductionGrid: { ...settings.deductionGrid, visible: c === true } })
          }
        />
        Show deduction grid
      </label>
    </div>
  );
}
