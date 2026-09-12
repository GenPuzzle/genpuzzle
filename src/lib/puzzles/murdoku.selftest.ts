import {
  enrichMurdokuElementsForScene,
  generateMurdokuPuzzle,
  labelForRoomShape,
  maxOccupiedCellsInRoom,
  minEmptyCellsInRoom,
  roomAreaMetrics,
  roomObjectOccupancy,
  solveMurdoku,
  validateMurdokuPuzzle,
  type MurdokuPuzzle,
} from './murdoku';
import {
  classifyRoomKind,
  elementFitsRoom,
  isClutterItem,
  sanitizeElementNames,
  syncRoomCatalog,
} from '../murdoku-room-catalog';
import { acceptRewrittenClue } from '../murdoku-ai';
import {
  autoSheetLayout,
  buildCharacterAiPrompt,
  buildElementAiPrompt,
  buildRoomAiPrompt,
} from '../murdoku-reference-sheet';
import {
  applyThemePreset,
  defaultMurdokuCharacters,
  getDefaultMurdokuSettings,
} from '../murdoku-settings';
import { aiMurdokuGridFromConfig, applyCustomThemeTitles } from '../ai/types';

function fail(message: string): never {
  throw new Error(message);
}

function assert(condition: unknown, message: string): void {
  if (!condition) fail(message);
}

function assertRoomsHaveEmptySquares(puzzle: MurdokuPuzzle, label: string) {
  for (const room of puzzle.rooms) {
    const occ = roomObjectOccupancy(puzzle.cellRoomIds, puzzle.objects, room.id);
    if (occ.size === 0) continue;
    assert(
      occ.empty >= minEmptyCellsInRoom(occ.size),
      `${label}: ${room.name} should keep empty squares (empty ${occ.empty}/${occ.size})`
    );
    assert(
      occ.occupied <= maxOccupiedCellsInRoom(occ.size),
      `${label}: ${room.name} should not fill every square (occupied ${occ.occupied}/${occ.size})`
    );
    assert(occ.empty >= 1, `${label}: ${room.name} must have at least one empty square`);
  }
}

function worldFrom(puzzle: MurdokuPuzzle, elements: ReturnType<typeof getDefaultMurdokuSettings>['elements']) {
  return {
    rows: puzzle.rows,
    cols: puzzle.cols,
    cellRoomIds: puzzle.cellRoomIds,
    objects: puzzle.objects,
    elements,
    characters: puzzle.characters,
    rooms: puzzle.rooms,
    victimId: puzzle.victimId,
    murderRule: 'alone-with-victim' as const,
  };
}

function run() {
  const settings = getDefaultMurdokuSettings();
  const themed = applyThemePreset(settings.theme);
  const characters = defaultMurdokuCharacters(9);

  const puzzle = generateMurdokuPuzzle({
    seed: 20260814,
    rows: 9,
    cols: 9,
    difficulty: 'medium',
    characters,
    rooms: themed.rooms,
    elements: themed.elements,
    theme: themed.theme,
    useSimpleWording: true,
  });

  assert(puzzle.type === 'murdoku', 'type');
  assert(puzzle.characters.length === 9, 'nine characters');
  assert(puzzle.rows === 9 && puzzle.cols === 9, '9x9 grid');
  assert(puzzle.validation.status === 'unique', 'unique status');
  assert(puzzle.validation.solutionCount === 1, 'one solution');
  assert(puzzle.victimId !== puzzle.murdererId, 'victim is not murderer');
  assert(puzzle.solution.placements[puzzle.victimId], 'victim placed');
  assert(puzzle.solution.placements[puzzle.murdererId], 'murderer placed');

  const rows = new Set(Object.values(puzzle.solution.placements).map((p) => p.row));
  const cols = new Set(Object.values(puzzle.solution.placements).map((p) => p.col));
  assert(rows.size === 9, 'one character per row');
  assert(cols.size === 9, 'one character per column');

  const v = puzzle.solution.placements[puzzle.victimId];
  const m = puzzle.solution.placements[puzzle.murdererId];
  const crimeRoom = puzzle.cellRoomIds[v.row][v.col];
  assert(puzzle.cellRoomIds[m.row][m.col] === crimeRoom, 'murderer shares victim room');
  const occupants = Object.entries(puzzle.solution.placements).filter(
    ([, pos]) => puzzle.cellRoomIds[pos.row][pos.col] === crimeRoom
  );
  assert(occupants.length === 2, 'exactly two people in victim room');

  const solved = solveMurdoku(worldFrom(puzzle, themed.elements), puzzle.clues, 3);
  assert(solved.count === 1, 'solver confirms uniqueness');

  const validation = validateMurdokuPuzzle(puzzle, themed.elements);
  assert(validation.status === 'unique', 'validator unique');

  assert(puzzle.objects.length >= 6, 'scene objects placed');
  const roomSizes = new Map<string, number>();
  for (const row of puzzle.cellRoomIds) {
    for (const id of row) {
      if (!id) continue;
      roomSizes.set(id, (roomSizes.get(id) ?? 0) + 1);
    }
  }
  assert(
    [...roomSizes.values()].every((size) => size >= 3),
    'every room covers at least 3 squares'
  );
  assert(minEmptyCellsInRoom(3) === 1 && maxOccupiedCellsInRoom(3) === 2, '3-square rooms keep one empty cell');
  assert(minEmptyCellsInRoom(8) >= 3, 'larger rooms keep a share of empty floor');
  assertRoomsHaveEmptySquares(puzzle, 'default puzzle');
  const plantEl = puzzle.elements.find((el) => /\bplant\b/i.test(el.name));
  if (plantEl) {
    const plantRooms = new Set(
      puzzle.objects
        .filter((obj) => obj.elementId === plantEl.id)
        .map((obj) => puzzle.cellRoomIds[obj.row]?.[obj.col])
        .filter(Boolean)
    );
    assert(plantRooms.size <= 2, 'common plants stay in a few rooms');
  }
  const sceneTypes = new Set([
    'IN_ROOM',
    'ON_KIND',
    'ON_OBJECT',
    'BESIDE_KIND',
    'BESIDE_OBJECT',
    'BESIDE_KIND_OR',
    'ONLY_PERSON_ON_KIND',
    'ALONE_IN_ROOM',
    'ALONE_WITH_MURDERER',
  ]);
  assert(
    puzzle.clues.some((c) => sceneTypes.has(c.type)),
    'has a scene clue'
  );
  const gridOnly = puzzle.clues.filter((c) => c.enabled && c.subjectId).every(
    (c) => c.type === 'IN_COLUMN' || c.type === 'IN_ROW'
  );
  assert(!gridOnly, 'clues are not only row/column');
  assert(
    puzzle.characters.every((c) => c.clueText.trim().length > 0),
    'every character card has a clue'
  );
  assert(
    puzzle.characters.some((c) => /beside|sitting|in the |only person|alone with/i.test(c.clueText)),
    'character cards use scene wording'
  );
  assert(
    !puzzle.characters.some((c) => /in column \d|in row \d/i.test(c.clueText)),
    'character cards do not say row/column N'
  );
  assert(
    !puzzle.clues.some((c) => /in column \d|in row \d/i.test(c.simpleText)),
    'published clues do not say row/column N'
  );

  const second = generateMurdokuPuzzle({
    seed: 99,
    rows: 9,
    cols: 9,
    difficulty: 'easy',
    characters,
    rooms: themed.rooms,
    elements: themed.elements,
    theme: themed.theme,
  });
  assert(second.validation.status === 'unique', 'second puzzle unique');
  assert(second.seed !== puzzle.seed, 'different seeds');
  assertRoomsHaveEmptySquares(second, 'second puzzle');

  assert(
    acceptRewrittenClue('Aria was beside a punching bag.', 'Aria stood next to a punching bag.'),
    'faithful beside rewrite accepted'
  );
  assert(
    !acceptRewrittenClue('Aria was beside a punching bag.', 'Aria was on the punching bag.'),
    'on-the-bag rewrite rejected'
  );

  const bagElements = enrichMurdokuElementsForScene(
    themed.elements.map((el, index) =>
      index === 0 ? { ...el, name: 'Punching bag', canStandOn: true } : el
    )
  );
  const bagPuzzle = generateMurdokuPuzzle({
    seed: 777001,
    rows: 9,
    cols: 9,
    difficulty: 'easy',
    characters,
    rooms: themed.rooms,
    elements: bagElements,
    theme: themed.theme,
  });
  const bagText = [
    ...bagPuzzle.clues.map((c) => `${c.simpleText} ${c.displayText}`),
    ...bagPuzzle.characters.map((c) => c.clueText),
  ].join('\n');
  assert(
    !/on the punching bag|sitting (?:on|in) (?:the |a )?punching/i.test(bagText),
    'no sitting on a punching bag'
  );
  assert(
    !bagPuzzle.clues.some(
      (c) =>
        (c.type === 'ON_KIND' || c.type === 'ON_OBJECT' || c.type === 'ONLY_PERSON_ON_KIND') &&
        /punching/i.test(c.simpleText)
    ),
    'no ON clue for punching bag'
  );

  const typeSignatures = [puzzle, second, bagPuzzle].map((item) =>
    item.clues
      .filter((c) => c.enabled && c.subjectId)
      .map((c) => c.type)
      .join('|')
  );
  assert(new Set(typeSignatures).size > 1, 'clue type mix varies across puzzles');

  const assertGrid = (rows: number, cols: number, seed: number) => {
    const sized = generateMurdokuPuzzle({
      seed,
      rows,
      cols,
      difficulty: 'easy',
      characters,
      rooms: themed.rooms,
      elements: themed.elements,
      theme: themed.theme,
      useSimpleWording: true,
    });
    const people = Math.max(3, Math.min(rows, cols, characters.length));
    assert(sized.rows === rows && sized.cols === cols, `${rows}x${cols} size`);
    assert(sized.characters.length === people, `${rows}x${cols} uses ${people} people`);
    assert(Object.keys(sized.solution.placements).length === people, `${rows}x${cols} placements`);
    assert(sized.validation.status === 'unique', `${rows}x${cols} unique`);
    const rowSet = new Set(Object.values(sized.solution.placements).map((p) => p.row));
    const colSet = new Set(Object.values(sized.solution.placements).map((p) => p.col));
    assert(rowSet.size === people, `${rows}x${cols} unique rows`);
    assert(colSet.size === people, `${rows}x${cols} unique cols`);
    const solvedSized = solveMurdoku(worldFrom(sized, themed.elements), sized.clues, 3);
    assert(solvedSized.count === 1, `${rows}x${cols} solver unique`);
    assertRoomsHaveEmptySquares(sized, `${rows}x${cols}`);
  };

  assertGrid(4, 4, 404404);
  assertGrid(6, 6, 606606);
  assertGrid(8, 5, 805805);

  const grid = aiMurdokuGridFromConfig({ murdokuRows: 6, murdokuCols: 6, charactersPerPuzzle: 9 });
  assert(grid.rows === 6 && grid.cols === 6 && grid.people === 6, 'AI murdoku people capped to grid');
  const titled = applyCustomThemeTitles(
    [
      {
        type: 'murdoku',
        title: 'Old',
        difficulty: 'easy',
        caseTitle: 'Old',
        theme: 'Old',
      },
    ],
    { type: 'murdoku', count: 1, difficultyStrategy: 'easy', useCustomThemeTitles: true, themeTitles: 'Harbor warehouse' },
    0
  );
  assert(titled[0]?.title === 'Harbor warehouse', 'murdoku theme title applied');
  assert(titled[0] && titled[0].type === 'murdoku' && titled[0].caseTitle === 'Harbor warehouse', 'murdoku case title applied');

  const portraitPrompt = buildCharacterAiPrompt({
    themeName: 'Bookstore',
    location: 'Main Street',
    style: 'flat-vector',
    characters: defaultMurdokuCharacters(4),
    rows: 2,
    columns: 2,
  });
  assert(/head-and-shoulders portrait/i.test(portraitPrompt), 'character prompt is a portrait');
  assert(/do not include any items/i.test(portraitPrompt), 'character prompt forbids items');
  assert(!/holding|with a book|punching bag/i.test(portraitPrompt), 'character prompt has no prop list');
  assert(/2 rows and 2 columns \(4 images\)/i.test(portraitPrompt), 'complete sheet prompt includes image count');

  const sixLayout = autoSheetLayout(6);
  assert(sixLayout.rows === 2 && sixLayout.columns === 3, '6 items layout is 2x3');
  const sevenLayout = autoSheetLayout(7);
  assert(sevenLayout.rows === 3 && sevenLayout.columns === 3, '7 items layout is packed 3x3');

  const sixPrompt = buildElementAiPrompt({
    themeName: 'Bookstore',
    location: 'Main Street',
    style: 'flat-vector',
    elements: themed.elements.slice(0, 6),
    rows: sixLayout.rows,
    columns: sixLayout.columns,
  });
  assert(/2 rows and 3 columns \(6 images\)/i.test(sixPrompt), '6-item prompt matches 2x3 sheet');
  assert(!/3 rows and 3 columns/i.test(sixPrompt), '6-item prompt does not say 3x3');

  const sevenPrompt = buildRoomAiPrompt({
    themeName: 'Bookstore',
    location: 'Main Street',
    style: 'flat-vector',
    rooms: themed.rooms.slice(0, 7),
    rows: sevenLayout.rows,
    columns: sevenLayout.columns,
  });
  assert(!/Keep exactly 3 rows and 3 columns/i.test(sevenPrompt), '7-box prompt does not force grid size');
  assert(/7 labeled boxes/i.test(sevenPrompt), '7-box prompt names the boxes');
  assert(/Fill every labeled box with the related/i.test(sevenPrompt), '7-box prompt fills labeled boxes');

  assert(labelForRoomShape('Bedroom', { elongated: true }, []) === 'Hallway', 'long bedroom becomes hallway');
  assert(labelForRoomShape('Bedroom', { elongated: false }, []) === 'Bedroom', 'compact bedroom keeps name');
  assert(labelForRoomShape('Hallway', { elongated: true }, []) === 'Hallway', 'hallway keeps long-area name');
  assert(roomAreaMetrics([{ row: 0, col: 0 }, { row: 0, col: 1 }, { row: 0, col: 2 }]).elongated, '1x3 area is elongated');
  assert(!roomAreaMetrics([{ row: 0, col: 0 }, { row: 0, col: 1 }, { row: 1, col: 0 }, { row: 1, col: 1 }]).elongated, '2x2 area is compact');

  assert(classifyRoomKind('Library') === 'library', 'library kind');
  assert(classifyRoomKind("Principal's Office") === 'office', 'office kind');
  assert(classifyRoomKind('Gymnasium') === 'gym', 'gym kind');
  assert(isClutterItem('Phone') && isClutterItem('Coffee cup') && isClutterItem('Laptop'), 'handheld clutter detected');
  assert(!isClutterItem('Bookshelf') && !isClutterItem('Desk'), 'furniture is not clutter');
  const library = syncRoomCatalog({
    id: 'room-1',
    slotId: 'R01',
    name: 'Library',
    color: '#fff',
    labelVisible: true,
  });
  assert(elementFitsRoom('Bookshelf', library), 'bookshelf belongs in library');
  assert(!elementFitsRoom('Exercise bike', library), 'exercise bike does not belong in library');
  assert(!elementFitsRoom('Phone', library, { avoidRandomProps: true }), 'phone blocked by avoid-random');
  const cleaned = sanitizeElementNames(
    ['Phone', 'Coffee', 'Laptop', 'Bookshelf', 'Chair', 'Table'],
    [library],
    { avoidRandomProps: true }
  );
  assert(!cleaned.some((name) => isClutterItem(name)), 'sanitize drops random props');
  assert(cleaned.some((name) => /shelf|chair|table/i.test(name)), 'sanitize keeps room furniture');

  for (const obj of puzzle.objects) {
    const el = puzzle.elements?.find((item) => item.id === obj.elementId);
    const roomId = puzzle.cellRoomIds[obj.row]?.[obj.col];
    const room = puzzle.rooms.find((item) => item.id === roomId);
    if (!el || !room) continue;
    assert(!isClutterItem(el.name), `${el.name} should not be random clutter`);
    assert(elementFitsRoom(el.name, room, { avoidRandomProps: true }), `${el.name} should belong in ${room.name}`);
  }

  console.log('murdoku.selftest: ok');
}

run();
