/**
 * Murdoku — deterministic murder-mystery deduction engine.
 *
 * Architecture (AI is never the source of truth):
 *   Puzzle Logic → Verified Hidden Solution → Structured Clues
 *     → Story / Display Text → Visual Assets → Page Renderer
 */

import {
  elementFitsRoom,
  isClutterItem,
  itemPassesStyle,
  normalizeSceneStyle,
  syncRoomsCatalog,
  type MurdokuObjectCategory,
  type MurdokuSceneStyleOptions,
} from '../murdoku-room-catalog';

export const MURDOKU_CLUE_TYPES = [
  'IN_ROOM',
  'NOT_IN_ROOM',
  'IN_ROW',
  'IN_COLUMN',
  'NORTH_OF',
  'SOUTH_OF',
  'EAST_OF',
  'WEST_OF',
  'EXACTLY_N_ROWS_NORTH_OF',
  'EXACTLY_N_ROWS_SOUTH_OF',
  'EXACTLY_N_COLUMNS_EAST_OF',
  'EXACTLY_N_COLUMNS_WEST_OF',
  'BESIDE_PERSON',
  'NOT_BESIDE_PERSON',
  'BESIDE_OBJECT',
  'NOT_BESIDE_OBJECT',
  'BESIDE_KIND',
  'ON_OBJECT',
  'ON_KIND',
  'ONLY_PERSON_ON_KIND',
  'BESIDE_KIND_OR',
  'NOT_ON_OBJECT',
  'SAME_ROOM_AS',
  'NOT_SAME_ROOM_AS',
  'ROOM_CONTAINS_OBJECT',
  'ROOM_CONTAINS_N_PEOPLE',
  'ALONE_IN_ROOM',
  'ALONE_WITH_MURDERER',
  'BETWEEN',
  'ADJACENT_ORTHOGONALLY',
  'CUSTOM',
] as const;

export type MurdokuClueType = (typeof MURDOKU_CLUE_TYPES)[number];

export type MurdokuDifficulty = 'easy' | 'medium' | 'hard' | 'expert' | 'custom';

export type MurdokuMurderRule = 'alone-with-victim';

export type MurdokuLogicStatus =
  | 'not-generated'
  | 'generated'
  | 'validating'
  | 'unique'
  | 'multiple'
  | 'none'
  | 'needs-correction';

export type MurdokuStorySource = 'empty' | 'manual' | 'ai' | 'edited';

export interface MurdokuPosition {
  row: number;
  col: number;
}

export interface MurdokuCharacter {
  id: string;
  slotId: string;
  name: string;
  enabled: boolean;
  gender?: string;
  ageRange?: string;
  occupation: string;
  description: string;
  clothingNotes: string;
  imageSrc?: string;
  clueText: string;
  isVictim: boolean;
  isMurderer: boolean;
}

export interface MurdokuRoom {
  id: string;
  slotId: string;
  name: string;
  color: string;
  labelVisible: boolean;
  description?: string;
  imageSrc?: string;
  roomKind?: string;
  allowedFurniture?: string[];
  allowedDecor?: string[];
  allowedObjects?: string[];
  excludedItems?: string[];
}

export interface MurdokuElementDef {
  id: string;
  slotId: string;
  name: string;
  internalName: string;
  description: string;
  quantity: number;
  occupiesCell: boolean;
  canStandOn: boolean;
  canBeBeside: boolean;
  blocksPlacement: boolean;
  widthCells: number;
  heightCells: number;
  rotation: number;
  imageSrc?: string;
  defaultScale: number;
}

export interface MurdokuPlacedObject {
  id: string;
  elementId: string;
  row: number;
  col: number;
  widthCells: number;
  heightCells: number;
  rotation: number;
  scale: number;
  locked: boolean;
  zIndex: number;
}

export interface MurdokuClue {
  id: string;
  type: MurdokuClueType;
  subjectId?: string;
  targetId?: string;
  roomId?: string;
  objectId?: string;
  /** Catalog kind for ON_KIND / BESIDE_KIND / ONLY_PERSON_ON_KIND. */
  elementId?: string;
  /** Second catalog kind for BESIDE_KIND_OR. */
  altElementId?: string;
  n?: number;
  displayText: string;
  simpleText: string;
  enabled: boolean;
}

export interface MurdokuStory {
  caseTitle: string;
  intro: string;
  crimeDescription: string;
  victimName: string;
  victimDescription: string;
  crimeLocation: string;
  whatHappened: string;
  timeOfIncident: string;
  background: string;
  instruction: string;
  flavorText: string;
  solutionExplanation: string;
  source: MurdokuStorySource;
}

export interface MurdokuTheme {
  id: string;
  name: string;
  location: string;
  caseType: string;
  description: string;
}

export interface MurdokuValidation {
  status: MurdokuLogicStatus;
  solutionCount: number;
  redundantClueIds: string[];
  difficultyScore: number;
  difficultyLabel: MurdokuDifficulty;
  deductionSteps: number;
}

export interface MurdokuPuzzle {
  type: 'murdoku';
  pageId?: string;
  pageName?: string;
  puzzleIndexInDocument?: number;
  puzzleNumber?: number;
  /** 0-based thematic chapter when generated as mixed-per-chapter. */
  chapterIndex?: number;
  seed: number;
  rows: number;
  cols: number;
  theme: MurdokuTheme;
  story: MurdokuStory;
  rooms: MurdokuRoom[];
  cellRoomIds: string[][];
  objects: MurdokuPlacedObject[];
  /** Scene props used while generating this puzzle (furniture, plants, etc.). */
  elements?: MurdokuElementDef[];
  characters: MurdokuCharacter[];
  clues: MurdokuClue[];
  victimId: string;
  murdererId: string;
  murdererReason: string;
  solution: {
    placements: Record<string, MurdokuPosition>;
  };
  validation: MurdokuValidation;
}

export interface MurdokuGenerateOptions {
  seed?: number;
  rows: number;
  cols: number;
  difficulty: MurdokuDifficulty;
  customClueCount?: number;
  murderRule?: MurdokuMurderRule;
  characters: MurdokuCharacter[];
  rooms: MurdokuRoom[];
  elements: MurdokuElementDef[];
  theme: MurdokuTheme;
  story?: Partial<MurdokuStory>;
  useSimpleWording?: boolean;
  avoidRandomProps?: boolean;
  useOnlyLargeFurniture?: boolean;
  allowedObjectCategories?: MurdokuObjectCategory[];
  maxAttempts?: number;
  deadlineMs?: number;
  onProgress?: (message: string) => void;
}

type Rng = () => number;

function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function randInt(rng: Rng, min: number, max: number): number {
  if (max <= min) return min;
  return min + Math.floor(rng() * (max - min + 1));
}

function pick<T>(rng: Rng, items: T[]): T {
  return items[Math.floor(rng() * items.length) % items.length];
}

function shuffle<T>(rng: Rng, items: T[]): T[] {
  const next = [...items];
  for (let i = next.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [next[i], next[j]] = [next[j], next[i]];
  }
  return next;
}

function uid(prefix: string, rng: Rng): string {
  return `${prefix}-${Math.floor(rng() * 1e9).toString(36)}`;
}

function inBounds(row: number, col: number, rows: number, cols: number): boolean {
  return row >= 0 && col >= 0 && row < rows && col < cols;
}

function orthoNeighbors(row: number, col: number): MurdokuPosition[] {
  return [
    { row: row - 1, col },
    { row: row + 1, col },
    { row, col: col - 1 },
    { row, col: col + 1 },
  ];
}

function nameOf(characters: MurdokuCharacter[], id: string): string {
  return characters.find((c) => c.id === id)?.name ?? id;
}

function roomNameOf(rooms: MurdokuRoom[], id: string): string {
  return rooms.find((r) => r.id === id)?.name ?? id;
}

function objectNameOf(
  objects: MurdokuPlacedObject[],
  elements: MurdokuElementDef[],
  objectId: string
): string {
  const placed = objects.find((o) => o.id === objectId);
  if (!placed) return 'object';
  return elements.find((e) => e.id === placed.elementId)?.name ?? 'object';
}

function elementNameOf(elements: MurdokuElementDef[], elementId?: string): string {
  if (!elementId) return 'object';
  return elements.find((e) => e.id === elementId)?.name ?? 'object';
}

function kindCount(objects: MurdokuPlacedObject[], elementId?: string): number {
  if (!elementId) return 0;
  return objects.filter((o) => o.elementId === elementId).length;
}

export function isStandOnPropName(name: string): boolean {
  return /\b(chair|armchair|sofa|couch|bench|bed|carpet|rug|lounge)\b/i.test(name);
}

function suggestedSceneQuantity(name: string): number {
  const n = name.toLowerCase();
  if (/\b(chair|armchair|bench)\b/.test(n)) return 3;
  if (/\b(sofa|couch|carpet|rug|table|desk|box|plant|shrub|bush)\b/.test(n)) return 2;
  return 1;
}

function withArticle(name: string): string {
  const n = name.trim().toLowerCase();
  if (!n) return 'an object';
  return /^[aeiou]/.test(n) ? `an ${n}` : `a ${n}`;
}

function refNoun(name: string, count: number): string {
  const n = name.trim().toLowerCase() || 'object';
  if (count === 1) return `the ${n}`;
  return withArticle(n);
}

function isChairLike(name: string): boolean {
  return /\b(chair|armchair)\b/i.test(name);
}

function isCarpetLike(name: string): boolean {
  return /\b(carpet|rug)\b/i.test(name);
}

function isPlantLike(name: string): boolean {
  return /\b(plant|shrub|bush|tree)\b/i.test(name);
}

function onObjectPhrase(name: string, count: number): string {
  const item = refNoun(name, count);
  if (isChairLike(name)) return `sitting in ${item}`;
  if (/\b(sofa|couch|bench|lounge)\b/i.test(name)) return `sitting on ${item}`;
  if (/\bbed\b/i.test(name)) return `on ${item}`;
  if (isCarpetLike(name)) return `on ${item}`;
  return `beside ${item}`;
}

function besideObjectPhrase(name: string, count: number): string {
  return `beside ${refNoun(name, count)}`;
}

const KNOWN_FEMALE_NAMES = new Set([
  'aria', 'everly', 'ivy', 'bella', 'carol', 'dalia', 'evangeline', 'anna', 'emma', 'olivia',
  'ava', 'mia', 'sophia', 'amelia', 'harper', 'evelyn', 'luna', 'camila', 'ella', 'nora',
]);
const KNOWN_MALE_NAMES = new Set([
  'bruce', 'calvin', 'don', 'henry', 'alexander', 'viraj', 'liam', 'noah', 'oliver', 'james',
  'elijah', 'lucas', 'mason', 'ethan', 'logan', 'jack', 'owen', 'leo', 'theo',
]);

export function characterPronoun(char?: Pick<MurdokuCharacter, 'name' | 'gender'>): {
  subject: string;
  was: string;
} {
  const gender = (char?.gender || '').toLowerCase();
  if (gender === 'female' || gender === 'f' || gender === 'woman') return { subject: 'She', was: 'was' };
  if (gender === 'male' || gender === 'm' || gender === 'man') return { subject: 'He', was: 'was' };
  const first = (char?.name || '').trim().split(/\s+/)[0]?.toLowerCase() || '';
  if (KNOWN_FEMALE_NAMES.has(first)) return { subject: 'She', was: 'was' };
  if (KNOWN_MALE_NAMES.has(first)) return { subject: 'He', was: 'was' };
  return { subject: char?.name || 'They', was: 'was' };
}

export function personalizeClueText(
  text: string,
  char?: Pick<MurdokuCharacter, 'name' | 'gender'>
): string {
  if (!char?.name || !text) return text;
  const { subject } = characterPronoun(char);
  if (subject === char.name) return text;
  return text.replace(new RegExp(`^${char.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`), subject);
}

export function enrichMurdokuElementsForScene(
  elements: MurdokuElementDef[],
  rooms: MurdokuRoom[] = [],
  options?: MurdokuSceneStyleOptions
): MurdokuElementDef[] {
  const style = normalizeSceneStyle(options);
  const source = elements.length ? elements : [];
  const annotated = rooms.length ? syncRoomsCatalog(rooms, '', style) : [];
  const filtered = source.filter((el) => {
    if (!itemPassesStyle(el.name, style)) return false;
    if (annotated.length && !annotated.some((room) => elementFitsRoom(el.name, room, style))) return false;
    return true;
  });
  const boost = filtered.length === 0 || filtered.every((e) => (e.quantity ?? 1) <= 1);
  const next = (filtered.length ? filtered : source.filter((el) => itemPassesStyle(el.name, style))).map((el) => ({
    ...el,
    quantity: boost ? Math.max(el.quantity || 1, suggestedSceneQuantity(el.name)) : Math.max(1, el.quantity || 1),
    canStandOn: isStandOnPropName(el.name),
    canBeBeside: el.canBeBeside !== false,
  }));
  const names = new Set(next.map((e) => e.name.toLowerCase()));
  const fitsSomeRoom = (name: string) =>
    !annotated.length || annotated.some((room) => elementFitsRoom(name, room, style));
  const needed: Array<{ name: string; quantity: number; standOn: boolean }> = [];
  if (![...names].some((n) => isStandOnPropName(n)) && fitsSomeRoom('Chair')) {
    needed.push({ name: 'Chair', quantity: 3, standOn: true });
  }
  if (![...names].some((n) => /\b(table|desk|counter)\b/.test(n)) && fitsSomeRoom('Table')) {
    needed.push({ name: 'Table', quantity: 2, standOn: false });
  }
  if (![...names].some((n) => isCarpetLike(n)) && fitsSomeRoom('Carpet') && !style.useOnlyLargeFurniture) {
    needed.push({ name: 'Carpet', quantity: 2, standOn: true });
  }
  if (![...names].some((n) => isPlantLike(n)) && fitsSomeRoom('Plant')) {
    needed.push({ name: 'Plant', quantity: 2, standOn: false });
  }
  if (![...names].some((n) => /\b(box|trunk|crate|bag)\b/.test(n)) && fitsSomeRoom('Box')) {
    needed.push({ name: 'Box', quantity: 2, standOn: false });
  }
  for (const spec of needed) {
    if (isClutterItem(spec.name) && style.avoidRandomProps) continue;
    const index = next.length;
    next.push({
      id: `el-scene-${spec.name.toLowerCase()}`,
      slotId: `E${String(index + 1).padStart(2, '0')}`,
      name: spec.name,
      internalName: spec.name.toLowerCase().replace(/\s+/g, '_'),
      description: '',
      quantity: spec.quantity,
      occupiesCell: true,
      canStandOn: spec.standOn,
      canBeBeside: true,
      blocksPlacement: false,
      widthCells: 1,
      heightCells: 1,
      rotation: 0,
      defaultScale: 1,
    });
  }
  return next;
}

export function simpleClueText(
  clue: Omit<MurdokuClue, 'id' | 'displayText' | 'simpleText' | 'enabled'>,
  characters: MurdokuCharacter[],
  rooms: MurdokuRoom[],
  objects: MurdokuPlacedObject[],
  elements: MurdokuElementDef[]
): string {
  const subj = clue.subjectId ? nameOf(characters, clue.subjectId) : '';
  const tgt = clue.targetId ? nameOf(characters, clue.targetId) : '';
  const room = clue.roomId ? roomNameOf(rooms, clue.roomId) : '';
  const obj = clue.objectId ? objectNameOf(objects, elements, clue.objectId) : '';
  const kind = elementNameOf(elements, clue.elementId);
  const altKind = elementNameOf(elements, clue.altElementId);
  const kindN = kindCount(objects, clue.elementId);
  const altN = kindCount(objects, clue.altElementId);
  switch (clue.type) {
    case 'IN_ROOM':
      return `${subj} was in the ${room}.`;
    case 'NOT_IN_ROOM':
      return `${subj} was not in the ${room}.`;
    case 'IN_ROW':
      return `${subj} was in row ${clue.n}.`;
    case 'IN_COLUMN':
      return `${subj} was in column ${clue.n}.`;
    case 'NORTH_OF':
      return `${subj} was north of ${tgt}.`;
    case 'SOUTH_OF':
      return `${subj} was south of ${tgt}.`;
    case 'EAST_OF':
      return `${subj} was east of ${tgt}.`;
    case 'WEST_OF':
      return `${subj} was west of ${tgt}.`;
    case 'EXACTLY_N_ROWS_NORTH_OF':
      return `${subj} was exactly ${clue.n} space${clue.n === 1 ? '' : 's'} north of ${tgt}.`;
    case 'EXACTLY_N_ROWS_SOUTH_OF':
      return `${subj} was exactly ${clue.n} space${clue.n === 1 ? '' : 's'} south of ${tgt}.`;
    case 'EXACTLY_N_COLUMNS_EAST_OF':
      return `${subj} was exactly ${clue.n} space${clue.n === 1 ? '' : 's'} east of ${tgt}.`;
    case 'EXACTLY_N_COLUMNS_WEST_OF':
      return `${subj} was exactly ${clue.n} space${clue.n === 1 ? '' : 's'} west of ${tgt}.`;
    case 'BESIDE_PERSON':
      return `${subj} was beside ${tgt}.`;
    case 'NOT_BESIDE_PERSON':
      return `${subj} was not beside ${tgt}.`;
    case 'BESIDE_OBJECT':
      return `${subj} was ${besideObjectPhrase(obj, 1)}.`;
    case 'NOT_BESIDE_OBJECT':
      return `${subj} was not ${besideObjectPhrase(obj, 1)}.`;
    case 'BESIDE_KIND':
      return `${subj} was ${besideObjectPhrase(kind, kindN)}.`;
    case 'ON_OBJECT':
      return `${subj} was ${onObjectPhrase(obj, 1)}.`;
    case 'ON_KIND':
      return `${subj} was ${onObjectPhrase(kind, kindN)}.`;
    case 'ONLY_PERSON_ON_KIND':
      return `${subj} was the only person ${onObjectPhrase(kind, kindN)}.`;
    case 'BESIDE_KIND_OR':
      return `${subj} was either ${besideObjectPhrase(kind, kindN)} or ${refNoun(altKind, altN)}.`;
    case 'NOT_ON_OBJECT':
      return `${subj} was not on an object.`;
    case 'SAME_ROOM_AS':
      return `${subj} was in the same area as ${tgt}.`;
    case 'NOT_SAME_ROOM_AS':
      return `${subj} was not in the same area as ${tgt}.`;
    case 'ROOM_CONTAINS_OBJECT':
      return `The ${room} contained ${withArticle(obj)}.`;
    case 'ROOM_CONTAINS_N_PEOPLE':
      return `The ${room} contained ${clue.n} ${clue.n === 1 ? 'person' : 'people'}.`;
    case 'ALONE_IN_ROOM':
      return `${subj} was alone in ${room ? `the ${room}` : 'their area'}.`;
    case 'ALONE_WITH_MURDERER': {
      const victim = characters.find((c) => c.id === clue.subjectId);
      return `The Victim. ${characterPronoun(victim).subject} was alone with the murderer.`;
    }
    case 'BETWEEN':
      return `${subj} was between ${tgt} and ${nameOf(characters, clue.objectId || '')}.`;
    case 'ADJACENT_ORTHOGONALLY':
      return `${subj} was next to ${tgt}.`;
    case 'CUSTOM':
      return clue.subjectId || 'Custom clue.';
    default:
      return 'Clue.';
  }
}

function objectCells(obj: MurdokuPlacedObject): MurdokuPosition[] {
  const cells: MurdokuPosition[] = [];
  for (let r = 0; r < Math.max(1, obj.heightCells); r++) {
    for (let c = 0; c < Math.max(1, obj.widthCells); c++) {
      cells.push({ row: obj.row + r, col: obj.col + c });
    }
  }
  return cells;
}

function objectAtCell(
  objects: MurdokuPlacedObject[],
  row: number,
  col: number
): MurdokuPlacedObject | undefined {
  return objects.find((obj) =>
    objectCells(obj).some((cell) => cell.row === row && cell.col === col)
  );
}

function besideObject(objects: MurdokuPlacedObject[], row: number, col: number, objectId: string): boolean {
  const obj = objects.find((o) => o.id === objectId);
  if (!obj) return false;
  const cells = objectCells(obj);
  return orthoNeighbors(row, col).some((n) =>
    cells.some((cell) => cell.row === n.row && cell.col === n.col)
  );
}

function besideKind(
  objects: MurdokuPlacedObject[],
  row: number,
  col: number,
  elementId?: string
): boolean {
  if (!elementId) return false;
  return objects.some((o) => o.elementId === elementId && besideObject(objects, row, col, o.id));
}

function onKind(
  objects: MurdokuPlacedObject[],
  row: number,
  col: number,
  elementId?: string
): boolean {
  if (!elementId) return false;
  return objectAtCell(objects, row, col)?.elementId === elementId;
}

function peopleOnKind(assignment: Assignment, objects: MurdokuPlacedObject[], elementId?: string): string[] {
  if (!elementId) return [];
  return Object.entries(assignment)
    .filter(([, pos]) => onKind(objects, pos.row, pos.col, elementId))
    .map(([id]) => id);
}

type Assignment = Record<string, MurdokuPosition>;

interface World {
  rows: number;
  cols: number;
  cellRoomIds: string[][];
  objects: MurdokuPlacedObject[];
  elements: MurdokuElementDef[];
  characters: MurdokuCharacter[];
  rooms: MurdokuRoom[];
  victimId: string;
  murderRule: MurdokuMurderRule;
}

function roomOf(world: World, pos: MurdokuPosition): string {
  return world.cellRoomIds[pos.row]?.[pos.col] ?? '';
}

function peopleInRoom(world: World, assignment: Assignment, roomId: string): string[] {
  return Object.entries(assignment)
    .filter(([, pos]) => roomOf(world, pos) === roomId)
    .map(([id]) => id);
}

function clueHolds(clue: MurdokuClue, assignment: Assignment, world: World): boolean | null {
  if (!clue.enabled) return true;
  const need = [clue.subjectId, clue.targetId].filter(Boolean) as string[];
  for (const id of need) {
    if (id && !assignment[id] && clue.type !== 'ROOM_CONTAINS_OBJECT' && clue.type !== 'ROOM_CONTAINS_N_PEOPLE') {
      if (clue.type === 'BETWEEN' && id === clue.objectId) continue;
      if (!assignment[id]) return null;
    }
  }

  const subj = clue.subjectId ? assignment[clue.subjectId] : undefined;
  const tgt = clue.targetId ? assignment[clue.targetId] : undefined;

  switch (clue.type) {
    case 'IN_ROOM':
      if (!subj) return null;
      return roomOf(world, subj) === clue.roomId;
    case 'NOT_IN_ROOM':
      if (!subj) return null;
      return roomOf(world, subj) !== clue.roomId;
    case 'IN_ROW':
      if (!subj) return null;
      return subj.row + 1 === clue.n;
    case 'IN_COLUMN':
      if (!subj) return null;
      return subj.col + 1 === clue.n;
    case 'NORTH_OF':
      if (!subj || !tgt) return null;
      return subj.col === tgt.col && subj.row < tgt.row;
    case 'SOUTH_OF':
      if (!subj || !tgt) return null;
      return subj.col === tgt.col && subj.row > tgt.row;
    case 'EAST_OF':
      if (!subj || !tgt) return null;
      return subj.row === tgt.row && subj.col > tgt.col;
    case 'WEST_OF':
      if (!subj || !tgt) return null;
      return subj.row === tgt.row && subj.col < tgt.col;
    case 'EXACTLY_N_ROWS_NORTH_OF':
      if (!subj || !tgt) return null;
      return subj.col === tgt.col && tgt.row - subj.row === (clue.n ?? 0);
    case 'EXACTLY_N_ROWS_SOUTH_OF':
      if (!subj || !tgt) return null;
      return subj.col === tgt.col && subj.row - tgt.row === (clue.n ?? 0);
    case 'EXACTLY_N_COLUMNS_EAST_OF':
      if (!subj || !tgt) return null;
      return subj.row === tgt.row && subj.col - tgt.col === (clue.n ?? 0);
    case 'EXACTLY_N_COLUMNS_WEST_OF':
      if (!subj || !tgt) return null;
      return subj.row === tgt.row && tgt.col - subj.col === (clue.n ?? 0);
    case 'BESIDE_PERSON':
    case 'ADJACENT_ORTHOGONALLY':
      if (!subj || !tgt) return null;
      return Math.abs(subj.row - tgt.row) + Math.abs(subj.col - tgt.col) === 1;
    case 'NOT_BESIDE_PERSON':
      if (!subj || !tgt) return null;
      return Math.abs(subj.row - tgt.row) + Math.abs(subj.col - tgt.col) !== 1;
    case 'BESIDE_OBJECT':
      if (!subj || !clue.objectId) return null;
      return besideObject(world.objects, subj.row, subj.col, clue.objectId);
    case 'NOT_BESIDE_OBJECT':
      if (!subj || !clue.objectId) return null;
      return !besideObject(world.objects, subj.row, subj.col, clue.objectId);
    case 'BESIDE_KIND':
      if (!subj || !clue.elementId) return null;
      return besideKind(world.objects, subj.row, subj.col, clue.elementId);
    case 'ON_OBJECT':
      if (!subj || !clue.objectId) return null;
      return objectAtCell(world.objects, subj.row, subj.col)?.id === clue.objectId;
    case 'ON_KIND':
      if (!subj || !clue.elementId) return null;
      return onKind(world.objects, subj.row, subj.col, clue.elementId);
    case 'ONLY_PERSON_ON_KIND': {
      if (!subj || !clue.elementId) return null;
      const assigned = Object.keys(assignment).length;
      if (assigned < world.characters.filter((c) => c.enabled).length) return null;
      const onIt = peopleOnKind(assignment, world.objects, clue.elementId);
      return onIt.length === 1 && onIt[0] === clue.subjectId;
    }
    case 'BESIDE_KIND_OR':
      if (!subj || !clue.elementId) return null;
      return (
        besideKind(world.objects, subj.row, subj.col, clue.elementId) ||
        besideKind(world.objects, subj.row, subj.col, clue.altElementId)
      );
    case 'NOT_ON_OBJECT':
      if (!subj) return null;
      return !objectAtCell(world.objects, subj.row, subj.col);
    case 'SAME_ROOM_AS':
      if (!subj || !tgt) return null;
      return roomOf(world, subj) === roomOf(world, tgt);
    case 'NOT_SAME_ROOM_AS':
      if (!subj || !tgt) return null;
      return roomOf(world, subj) !== roomOf(world, tgt);
    case 'ROOM_CONTAINS_OBJECT': {
      if (!clue.roomId || !clue.objectId) return true;
      const obj = world.objects.find((o) => o.id === clue.objectId);
      if (!obj) return false;
      return objectCells(obj).some((cell) => world.cellRoomIds[cell.row]?.[cell.col] === clue.roomId);
    }
    case 'ROOM_CONTAINS_N_PEOPLE': {
      const assigned = Object.keys(assignment).length;
      if (assigned < world.characters.filter((c) => c.enabled).length) return null;
      return peopleInRoom(world, assignment, clue.roomId || '').length === (clue.n ?? 0);
    }
    case 'ALONE_IN_ROOM': {
      if (!subj) return null;
      const assigned = Object.keys(assignment).length;
      if (assigned < world.characters.filter((c) => c.enabled).length) return null;
      const rid = clue.roomId || roomOf(world, subj);
      return peopleInRoom(world, assignment, rid).length === 1;
    }
    case 'ALONE_WITH_MURDERER':
      if (!clue.subjectId || clue.subjectId !== world.victimId) return false;
      return murderRuleHolds(assignment, world);
    case 'BETWEEN': {
      if (!subj || !tgt || !clue.objectId) return null;
      const other = assignment[clue.objectId];
      if (!other) return null;
      const sameRow = subj.row === tgt.row && subj.row === other.row;
      const sameCol = subj.col === tgt.col && subj.col === other.col;
      if (sameRow) {
        const cols = [tgt.col, other.col].sort((a, b) => a - b);
        return subj.col > cols[0] && subj.col < cols[1];
      }
      if (sameCol) {
        const rows = [tgt.row, other.row].sort((a, b) => a - b);
        return subj.row > rows[0] && subj.row < rows[1];
      }
      return false;
    }
    case 'CUSTOM':
      return true;
    default:
      return true;
  }
}

function murderRuleHolds(assignment: Assignment, world: World): boolean | null {
  const victim = assignment[world.victimId];
  if (!victim) return null;
  const enabled = world.characters.filter((c) => c.enabled);
  if (Object.keys(assignment).length < enabled.length) return null;
  const occupants = peopleInRoom(world, assignment, roomOf(world, victim));
  return occupants.length === 2 && occupants.includes(world.victimId);
}

export interface SolveResult {
  count: number;
  solutions: Assignment[];
  deductionSteps: number;
  truncated?: boolean;
}

const SOLVE_NODE_CAP = 40_000;

function solveNodeCap(world: World): number {
  const n = Math.max(1, world.characters.filter((c) => c.enabled).length);
  const cells = Math.max(1, world.rows * world.cols);
  if (n <= 9 && world.rows <= 9 && world.cols <= 9) return SOLVE_NODE_CAP;
  return Math.min(220_000, SOLVE_NODE_CAP + n * cells * 20);
}

function cellIndex(row: number, col: number, cols: number): number {
  return row * cols + col;
}

function cellFromIndex(index: number, cols: number): MurdokuPosition {
  return { row: Math.floor(index / cols), col: index % cols };
}

function initialDomain(world: World, clues: MurdokuClue[], charId: string): Set<number> {
  const domain = new Set<number>();
  const roomCells = new Map<string, number[]>();
  for (let row = 0; row < world.rows; row++) {
    for (let col = 0; col < world.cols; col++) {
      const rid = world.cellRoomIds[row][col];
      const list = roomCells.get(rid) ?? [];
      list.push(cellIndex(row, col, world.cols));
      roomCells.set(rid, list);
      domain.add(cellIndex(row, col, world.cols));
    }
  }
  for (const clue of clues) {
    if (!clue.enabled || clue.subjectId !== charId) continue;
    if (clue.type === 'IN_ROW' && clue.n) {
      for (const idx of [...domain]) {
        if (cellFromIndex(idx, world.cols).row + 1 !== clue.n) domain.delete(idx);
      }
    }
    if (clue.type === 'IN_COLUMN' && clue.n) {
      for (const idx of [...domain]) {
        if (cellFromIndex(idx, world.cols).col + 1 !== clue.n) domain.delete(idx);
      }
    }
    if (clue.type === 'IN_ROOM' && clue.roomId) {
      const allowed = new Set(roomCells.get(clue.roomId) ?? []);
      for (const idx of [...domain]) {
        if (!allowed.has(idx)) domain.delete(idx);
      }
    }
    if (clue.type === 'NOT_IN_ROOM' && clue.roomId) {
      const blocked = new Set(roomCells.get(clue.roomId) ?? []);
      for (const idx of [...domain]) {
        if (blocked.has(idx)) domain.delete(idx);
      }
    }
    if ((clue.type === 'ON_KIND' || clue.type === 'ONLY_PERSON_ON_KIND') && clue.elementId) {
      const allowed = new Set<number>();
      for (const obj of world.objects) {
        if (obj.elementId !== clue.elementId) continue;
        for (const cell of objectCells(obj)) {
          allowed.add(cellIndex(cell.row, cell.col, world.cols));
        }
      }
      for (const idx of [...domain]) {
        if (!allowed.has(idx)) domain.delete(idx);
      }
    }
    if (clue.type === 'BESIDE_KIND' && clue.elementId) {
      const allowed = new Set<number>();
      for (let row = 0; row < world.rows; row++) {
        for (let col = 0; col < world.cols; col++) {
          if (besideKind(world.objects, row, col, clue.elementId)) {
            allowed.add(cellIndex(row, col, world.cols));
          }
        }
      }
      for (const idx of [...domain]) {
        if (!allowed.has(idx)) domain.delete(idx);
      }
    }
    if (clue.type === 'BESIDE_KIND_OR' && clue.elementId) {
      const allowed = new Set<number>();
      for (let row = 0; row < world.rows; row++) {
        for (let col = 0; col < world.cols; col++) {
          if (
            besideKind(world.objects, row, col, clue.elementId) ||
            besideKind(world.objects, row, col, clue.altElementId)
          ) {
            allowed.add(cellIndex(row, col, world.cols));
          }
        }
      }
      for (const idx of [...domain]) {
        if (!allowed.has(idx)) domain.delete(idx);
      }
    }
  }
  return domain;
}

export function solveMurdoku(
  world: World,
  clues: MurdokuClue[],
  limit = 2
): SolveResult {
  const chars = world.characters.filter((c) => c.enabled).sort((a, b) => a.id.localeCompare(b.id));
  const n = chars.length;
  const ids = chars.map((c) => c.id);
  const domains = ids.map((id) => initialDomain(world, clues, id));
  const assignment: Assignment = {};
  const solutions: Assignment[] = [];
  let rowMask = 0;
  let colMask = 0;
  let nodes = 0;
  let deductionSteps = 0;
  const nodeCap = solveNodeCap(world);

  const cluesOk = (): boolean => {
    for (const clue of clues) {
      if (clueHolds(clue, assignment, world) === false) return false;
    }
    return murderRuleHolds(assignment, world) !== false;
  };

  const search = () => {
    if (solutions.length >= limit || nodes > nodeCap) return;
    if (!cluesOk()) return;
    if (Object.keys(assignment).length >= n) {
      solutions.push({ ...assignment });
      return;
    }

    let pick = -1;
    let best = 1e9;
    for (let i = 0; i < n; i++) {
      if (assignment[ids[i]]) continue;
      const size = domains[i].size;
      if (size < best) {
        best = size;
        pick = i;
      }
    }
    if (pick < 0 || best === 0) return;
    if (best > 1) deductionSteps += 1;

    const options = [...domains[pick]];
    for (const idx of options) {
      const pos = cellFromIndex(idx, world.cols);
      const rBit = 1 << pos.row;
      const cBit = 1 << pos.col;
      if (rowMask & rBit || colMask & cBit) continue;
      nodes += 1;
      if (nodes > nodeCap) return;
      assignment[ids[pick]] = pos;
      rowMask |= rBit;
      colMask |= cBit;
      const removed: Array<{ i: number; idx: number }> = [];
      for (let j = 0; j < n; j++) {
        if (j === pick || assignment[ids[j]]) continue;
        for (const other of [...domains[j]]) {
          const op = cellFromIndex(other, world.cols);
          if (op.row === pos.row || op.col === pos.col) {
            domains[j].delete(other);
            removed.push({ i: j, idx: other });
          }
        }
      }
      search();
      for (const rec of removed) domains[rec.i].add(rec.idx);
      delete assignment[ids[pick]];
      rowMask &= ~rBit;
      colMask &= ~cBit;
      if (solutions.length >= limit) return;
    }
  };

  search();
  const truncated = nodes > nodeCap && solutions.length < limit;
  return {
    count: truncated && solutions.length === 0 ? 2 : solutions.length,
    solutions,
    deductionSteps,
    truncated,
  };
}

function makeClue(
  rng: Rng,
  partial: Omit<MurdokuClue, 'id' | 'displayText' | 'simpleText' | 'enabled'>,
  world: World,
  useSimple: boolean
): MurdokuClue {
  const simple = simpleClueText(partial, world.characters, world.rooms, world.objects, world.elements);
  return {
    ...partial,
    id: uid('clue', rng),
    simpleText: simple,
    displayText: useSimple ? simple : simple,
    enabled: true,
  };
}

function enumerateTrueClues(rng: Rng, world: World, solution: Assignment, useSimple: boolean): MurdokuClue[] {
  const chars = world.characters.filter((c) => c.enabled);
  const clues: MurdokuClue[] = [];
  const push = (partial: Omit<MurdokuClue, 'id' | 'displayText' | 'simpleText' | 'enabled'>) => {
    clues.push(makeClue(rng, partial, world, useSimple));
  };

  const plantKinds = world.elements.filter((el) => isPlantLike(el.name) && world.objects.some((o) => o.elementId === el.id));

  for (const char of chars) {
    const pos = solution[char.id];
    if (!pos) continue;
    const roomId = roomOf(world, pos);
    push({ type: 'IN_ROOM', subjectId: char.id, roomId });
    const occupants = peopleInRoom(world, solution, roomId);
    if (occupants.length === 1) {
      push({ type: 'ALONE_IN_ROOM', subjectId: char.id, roomId });
    }
    const onObj = objectAtCell(world.objects, pos.row, pos.col);
    const onEl = onObj ? world.elements.find((e) => e.id === onObj.elementId) : undefined;
    if (onObj && onEl && isStandOnPropName(onEl.name)) {
      push({ type: 'ON_OBJECT', subjectId: char.id, objectId: onObj.id });
      push({ type: 'ON_KIND', subjectId: char.id, elementId: onObj.elementId });
      const onlyOn = peopleOnKind(solution, world.objects, onObj.elementId);
      if (onlyOn.length === 1 && onlyOn[0] === char.id) {
        push({ type: 'ONLY_PERSON_ON_KIND', subjectId: char.id, elementId: onObj.elementId });
      }
    }
    const besideKinds = new Set<string>();
    for (const obj of world.objects) {
      if (besideObject(world.objects, pos.row, pos.col, obj.id)) {
        push({ type: 'BESIDE_OBJECT', subjectId: char.id, objectId: obj.id });
        besideKinds.add(obj.elementId);
      }
    }
    for (const elementId of besideKinds) {
      push({ type: 'BESIDE_KIND', subjectId: char.id, elementId });
    }
    if (plantKinds.length >= 2) {
      const besidePlants = plantKinds.filter((el) => besideKind(world.objects, pos.row, pos.col, el.id));
      if (besidePlants.length > 0) {
        const other = plantKinds.find((el) => el.id !== besidePlants[0].id) ?? plantKinds[1];
        push({
          type: 'BESIDE_KIND_OR',
          subjectId: char.id,
          elementId: besidePlants[0].id,
          altElementId: other.id,
        });
      }
    }
    for (const other of chars) {
      if (other.id === char.id) continue;
      const op = solution[other.id];
      if (!op) continue;
      if (pos.col === op.col && pos.row < op.row) {
        push({ type: 'NORTH_OF', subjectId: char.id, targetId: other.id });
        push({
          type: 'EXACTLY_N_ROWS_NORTH_OF',
          subjectId: char.id,
          targetId: other.id,
          n: op.row - pos.row,
        });
      }
      if (pos.col === op.col && pos.row > op.row) {
        push({ type: 'SOUTH_OF', subjectId: char.id, targetId: other.id });
        push({
          type: 'EXACTLY_N_ROWS_SOUTH_OF',
          subjectId: char.id,
          targetId: other.id,
          n: pos.row - op.row,
        });
      }
      if (pos.row === op.row && pos.col > op.col) {
        push({ type: 'EAST_OF', subjectId: char.id, targetId: other.id });
        push({
          type: 'EXACTLY_N_COLUMNS_EAST_OF',
          subjectId: char.id,
          targetId: other.id,
          n: pos.col - op.col,
        });
      }
      if (pos.row === op.row && pos.col < op.col) {
        push({ type: 'WEST_OF', subjectId: char.id, targetId: other.id });
        push({
          type: 'EXACTLY_N_COLUMNS_WEST_OF',
          subjectId: char.id,
          targetId: other.id,
          n: op.col - pos.col,
        });
      }
      if (Math.abs(pos.row - op.row) + Math.abs(pos.col - op.col) === 1) {
        push({ type: 'BESIDE_PERSON', subjectId: char.id, targetId: other.id });
        push({ type: 'ADJACENT_ORTHOGONALLY', subjectId: char.id, targetId: other.id });
      } else {
        push({ type: 'NOT_BESIDE_PERSON', subjectId: char.id, targetId: other.id });
      }
      if (roomOf(world, pos) === roomOf(world, op)) {
        push({ type: 'SAME_ROOM_AS', subjectId: char.id, targetId: other.id });
      } else {
        push({ type: 'NOT_SAME_ROOM_AS', subjectId: char.id, targetId: other.id });
      }
    }
  }

  for (const room of world.rooms) {
    const count = peopleInRoom(world, solution, room.id).length;
    push({ type: 'ROOM_CONTAINS_N_PEOPLE', roomId: room.id, n: count });
    for (const obj of world.objects) {
      if (objectCells(obj).some((cell) => world.cellRoomIds[cell.row]?.[cell.col] === room.id)) {
        push({ type: 'ROOM_CONTAINS_OBJECT', roomId: room.id, objectId: obj.id });
      }
    }
  }

  return clues;
}

const DIRECT_TYPES = new Set<MurdokuClueType>([
  'IN_ROOM',
  'ON_OBJECT',
  'ON_KIND',
  'ONLY_PERSON_ON_KIND',
  'BESIDE_KIND',
]);
const GRID_TYPES = new Set<MurdokuClueType>(['IN_ROW', 'IN_COLUMN']);
const SCENE_CARD_TYPES = new Set<MurdokuClueType>([
  'ONLY_PERSON_ON_KIND',
  'ON_KIND',
  'ON_OBJECT',
  'BESIDE_KIND_OR',
  'BESIDE_KIND',
  'BESIDE_OBJECT',
  'ALONE_IN_ROOM',
  'IN_ROOM',
  'ALONE_WITH_MURDERER',
]);
const RELATIVE_TYPES = new Set<MurdokuClueType>([
  'NORTH_OF',
  'SOUTH_OF',
  'EAST_OF',
  'WEST_OF',
  'BESIDE_PERSON',
  'SAME_ROOM_AS',
  'BESIDE_OBJECT',
  'BESIDE_KIND_OR',
  'EXACTLY_N_ROWS_NORTH_OF',
  'EXACTLY_N_ROWS_SOUTH_OF',
  'EXACTLY_N_COLUMNS_EAST_OF',
  'EXACTLY_N_COLUMNS_WEST_OF',
]);
const NEGATIVE_TYPES = new Set<MurdokuClueType>([
  'NOT_IN_ROOM',
  'NOT_BESIDE_PERSON',
  'NOT_BESIDE_OBJECT',
  'NOT_ON_OBJECT',
  'NOT_SAME_ROOM_AS',
]);

function difficultyProfile(d: MurdokuDifficulty): {
  direct: number;
  relative: number;
  negative: number;
  room: number;
} {
  switch (d) {
    case 'easy':
      return { direct: 8, relative: 3, negative: 1, room: 2 };
    case 'medium':
      return { direct: 5, relative: 5, negative: 2, room: 2 };
    case 'hard':
      return { direct: 3, relative: 6, negative: 3, room: 3 };
    case 'expert':
      return { direct: 2, relative: 7, negative: 4, room: 3 };
    default:
      return { direct: 3, relative: 5, negative: 2, room: 2 };
  }
}

const ON_SCENE_TYPES = new Set<MurdokuClueType>(['ON_KIND', 'ON_OBJECT', 'ONLY_PERSON_ON_KIND']);

const CLUE_STYLE_PALETTES: MurdokuClueType[][] = [
  ['IN_ROOM', 'BESIDE_KIND', 'ALONE_IN_ROOM', 'SAME_ROOM_AS', 'BESIDE_KIND_OR', 'NORTH_OF'],
  ['BESIDE_PERSON', 'NOT_IN_ROOM', 'EAST_OF', 'IN_ROOM', 'BESIDE_OBJECT', 'ALONE_IN_ROOM'],
  ['ALONE_IN_ROOM', 'BESIDE_KIND_OR', 'WEST_OF', 'NOT_SAME_ROOM_AS', 'IN_ROOM', 'BESIDE_KIND'],
  ['SAME_ROOM_AS', 'SOUTH_OF', 'BESIDE_OBJECT', 'ROOM_CONTAINS_N_PEOPLE', 'NOT_BESIDE_PERSON', 'IN_ROOM'],
  ['NORTH_OF', 'IN_ROOM', 'BESIDE_KIND', 'NOT_IN_ROOM', 'ALONE_IN_ROOM', 'ON_KIND'],
  ['BESIDE_KIND', 'EAST_OF', 'SAME_ROOM_AS', 'ONLY_PERSON_ON_KIND', 'NOT_BESIDE_OBJECT', 'IN_ROOM'],
  ['ROOM_CONTAINS_N_PEOPLE', 'WEST_OF', 'BESIDE_PERSON', 'IN_ROOM', 'BESIDE_KIND_OR', 'ALONE_IN_ROOM'],
  ['NOT_SAME_ROOM_AS', 'SOUTH_OF', 'BESIDE_KIND', 'IN_ROOM', 'NOT_IN_ROOM', 'BESIDE_OBJECT'],
];

function pickInitialClues(
  rng: Rng,
  all: MurdokuClue[],
  difficulty: MurdokuDifficulty,
  customCount?: number
): MurdokuClue[] {
  const profile = difficultyProfile(difficulty);
  const used = new Set<string>();
  const selected: MurdokuClue[] = [];
  const take = (pred: (c: MurdokuClue) => boolean, n: number) => {
    const extras = shuffle(
      rng,
      all.filter((c) => pred(c) && !used.has(c.simpleText) && !GRID_TYPES.has(c.type))
    ).slice(0, Math.max(0, n));
    for (const clue of extras) {
      used.add(clue.simpleText);
      selected.push(clue);
    }
  };

  const palette = CLUE_STYLE_PALETTES[Math.floor(rng() * CLUE_STYLE_PALETTES.length)]!;
  const subjects = [...new Set(all.map((c) => c.subjectId).filter(Boolean))] as string[];
  let onUsed = 0;
  shuffle(rng, subjects).forEach((subjectId, index) => {
    const order = [...palette.slice(index % palette.length), ...palette.slice(0, index % palette.length)];
    const personal = order
      .map(
        (type) =>
          shuffle(
            rng,
            all.filter(
              (c) =>
                c.subjectId === subjectId &&
                c.type === type &&
                c.type !== 'ALONE_WITH_MURDERER' &&
                !used.has(c.simpleText)
            )
          )[0]
      )
      .find((c) => {
        if (!c) return false;
        if (ON_SCENE_TYPES.has(c.type) && onUsed >= 1) return false;
        return true;
      });
    if (personal) {
      if (ON_SCENE_TYPES.has(personal.type)) onUsed += 1;
      used.add(personal.simpleText);
      selected.push(personal);
    }
  });

  take((c) => DIRECT_TYPES.has(c.type), profile.direct);
  take((c) => RELATIVE_TYPES.has(c.type), profile.relative);
  take((c) => NEGATIVE_TYPES.has(c.type), profile.negative);
  take(
    (c) =>
      c.type === 'ROOM_CONTAINS_N_PEOPLE' ||
      c.type === 'ALONE_IN_ROOM' ||
      c.type === 'ROOM_CONTAINS_OBJECT',
    profile.room
  );
  const unique = new Map<string, MurdokuClue>();
  for (const clue of selected) unique.set(clue.simpleText, clue);
  let clues = [...unique.values()];
  if (difficulty === 'custom' && customCount) {
    clues = shuffle(
      rng,
      all.filter((c) => !GRID_TYPES.has(c.type))
    ).slice(0, Math.max(4, customCount));
  }
  return clues;
}

function clueTrueFor(clue: MurdokuClue, assignment: Assignment, world: World): boolean {
  return clueHolds(clue, assignment, world) === true;
}

function assignmentsEqual(a: Assignment, b: Assignment): boolean {
  const keys = Object.keys(a);
  if (keys.length !== Object.keys(b).length) return false;
  return keys.every((k) => a[k]?.row === b[k]?.row && a[k]?.col === b[k]?.col);
}

function nextHelpfulClue(
  rng: Rng,
  pool: MurdokuClue[],
  used: Set<string>,
  intended: Assignment,
  world: World,
  extra?: Assignment
): MurdokuClue | undefined {
  if (extra) {
    const discriminator = shuffle(rng, pool).find(
      (c) =>
        !used.has(c.simpleText) &&
        !GRID_TYPES.has(c.type) &&
        clueTrueFor(c, intended, world) &&
        !clueTrueFor(c, extra, world)
    );
    if (discriminator) return discriminator;
  }
  return shuffle(rng, pool).find(
    (c) =>
      !used.has(c.simpleText) &&
      !GRID_TYPES.has(c.type) &&
      (DIRECT_TYPES.has(c.type) || SCENE_CARD_TYPES.has(c.type) || RELATIVE_TYPES.has(c.type)) &&
      clueTrueFor(c, intended, world)
  );
}

function addUntilUnique(
  rng: Rng,
  world: World,
  intended: Assignment,
  selected: MurdokuClue[],
  pool: MurdokuClue[]
): MurdokuClue[] {
  const clues = [...selected];
  const used = new Set(clues.map((c) => c.simpleText));
  const extraTries = Math.max(16, world.characters.filter((c) => c.enabled).length * 4);
  for (let i = 0; i < extraTries; i++) {
    const result = solveMurdoku(world, clues, 2);
    if (
      !result.truncated &&
      result.count === 1 &&
      assignmentsEqual(result.solutions[0], intended)
    ) {
      return clues;
    }
    if (!result.truncated && result.count === 0) {
      clues.pop();
      continue;
    }
    const extra = result.solutions.find((s) => !assignmentsEqual(s, intended)) ?? result.solutions[0];
    const next = nextHelpfulClue(rng, pool, used, intended, world, extra);
    if (!next) break;
    used.add(next.simpleText);
    clues.push(next);
  }
  return clues;
}

export function minimizeClues(world: World, clues: MurdokuClue[]): {
  clues: MurdokuClue[];
  redundantClueIds: string[];
} {
  const kept = [...clues];
  const redundant: string[] = [];
  for (let i = kept.length - 1; i >= 0; i--) {
    const trial = kept.filter((_, idx) => idx !== i);
    const result = solveMurdoku(world, trial, 2);
    if (result.count === 1) {
      redundant.push(kept[i].id);
      kept.splice(i, 1);
    }
  }
  return { clues: kept, redundantClueIds: redundant };
}

export function scoreDifficulty(
  clues: MurdokuClue[],
  deductionSteps: number
): { score: number; label: MurdokuDifficulty } {
  const total = Math.max(1, clues.length);
  const direct = clues.filter((c) => DIRECT_TYPES.has(c.type)).length / total;
  const negative = clues.filter((c) => NEGATIVE_TYPES.has(c.type)).length / total;
  const relative = clues.filter((c) => RELATIVE_TYPES.has(c.type)).length / total;
  const score = Math.max(
    8,
    Math.min(
      100,
      Math.round(
        18 +
          relative * 38 +
          negative * 22 +
          (1 - direct) * 18 +
          Math.min(20, deductionSteps * 2)
      )
    )
  );
  const label: MurdokuDifficulty =
    score < 40 ? 'easy' : score < 62 ? 'medium' : score < 82 ? 'hard' : 'expert';
  return { score, label };
}

function shortestPath(
  a: MurdokuPosition,
  b: MurdokuPosition,
  blocked: Set<string>
): MurdokuPosition[] {
  const key = (p: MurdokuPosition) => `${p.row},${p.col}`;
  const queue: MurdokuPosition[][] = [[a]];
  const seen = new Set([key(a)]);
  while (queue.length) {
    const path = queue.shift()!;
    const cur = path[path.length - 1];
    if (cur.row === b.row && cur.col === b.col) return path;
    for (const n of orthoNeighbors(cur.row, cur.col)) {
      const k = key(n);
      if (seen.has(k) || blocked.has(k)) continue;
      seen.add(k);
      queue.push([...path, n]);
    }
  }
  const path: MurdokuPosition[] = [a];
  let r = a.row;
  let c = a.col;
  while (r !== b.row) {
    r += b.row > r ? 1 : -1;
    path.push({ row: r, col: c });
  }
  while (c !== b.col) {
    c += b.col > c ? 1 : -1;
    path.push({ row: r, col: c });
  }
  return path;
}

const MIN_ROOM_CELLS = 3;
/** Keep enough floor showing so rooms never fill wall-to-wall with props. */
const ROOM_EMPTY_RATIO = 0.4;

export function minEmptyCellsInRoom(size: number): number {
  const n = Math.max(0, Math.floor(size) || 0);
  if (n <= 0) return 0;
  if (n <= 3) return 1;
  return Math.max(2, Math.round(n * ROOM_EMPTY_RATIO));
}

export function maxOccupiedCellsInRoom(size: number): number {
  const n = Math.max(0, Math.floor(size) || 0);
  return Math.max(0, n - minEmptyCellsInRoom(n));
}

export function roomObjectOccupancy(
  cellRoomIds: string[][],
  objects: MurdokuPlacedObject[],
  roomId: string
): { size: number; occupied: number; empty: number } {
  const roomKeys = new Set<string>();
  for (let row = 0; row < cellRoomIds.length; row++) {
    for (let col = 0; col < (cellRoomIds[row]?.length ?? 0); col++) {
      if (cellRoomIds[row][col] !== roomId) continue;
      roomKeys.add(`${row},${col}`);
    }
  }
  const occupiedKeys = new Set<string>();
  for (const obj of objects) {
    for (const cell of objectCells(obj)) {
      const key = `${cell.row},${cell.col}`;
      if (roomKeys.has(key)) occupiedKeys.add(key);
    }
  }
  const size = roomKeys.size;
  return { size, occupied: occupiedKeys.size, empty: size - occupiedKeys.size };
}
const LONG_AREA_NAMES = ['Hallway', 'Corridor', 'Passage', 'Gallery', 'Aisle', 'Walkway'];
const SHAPE_SENSITIVE_ROOM =
  /\b(bed|bedroom|suite|cabin|ward|dorm|kitchen|cafe|cafeteria|office|lab|gymnasium|gym|classroom|dining|library|lounge|study)\b/i;
const HALL_ROOM = /\b(hall|hallway|corridor|passage|gallery|aisle|walkway|promenade)\b/i;

export function roomAreaMetrics(cells: MurdokuPosition[]): {
  width: number;
  height: number;
  aspect: number;
  elongated: boolean;
} {
  if (!cells.length) return { width: 0, height: 0, aspect: 1, elongated: false };
  let minR = cells[0].row;
  let maxR = cells[0].row;
  let minC = cells[0].col;
  let maxC = cells[0].col;
  for (const cell of cells) {
    minR = Math.min(minR, cell.row);
    maxR = Math.max(maxR, cell.row);
    minC = Math.min(minC, cell.col);
    maxC = Math.max(maxC, cell.col);
  }
  const height = maxR - minR + 1;
  const width = maxC - minC + 1;
  const aspect = Math.max(width, height) / Math.max(1, Math.min(width, height));
  const elongated = Math.min(width, height) <= 1 || aspect >= 2.4;
  return { width, height, aspect, elongated };
}

export function labelForRoomShape(
  currentName: string,
  metrics: { elongated: boolean },
  usedNames: string[]
): string {
  if (!metrics.elongated) return currentName;
  if (HALL_ROOM.test(currentName) || !SHAPE_SENSITIVE_ROOM.test(currentName)) return currentName;
  const used = new Set(usedNames.map((name) => name.trim().toLowerCase()));
  for (const name of LONG_AREA_NAMES) {
    if (!used.has(name.toLowerCase())) return name;
  }
  return currentName;
}

function collectRoomCells(cellRoomIds: string[][]): Map<string, MurdokuPosition[]> {
  const map = new Map<string, MurdokuPosition[]>();
  for (let row = 0; row < cellRoomIds.length; row++) {
    for (let col = 0; col < cellRoomIds[row].length; col++) {
      const id = cellRoomIds[row][col];
      if (!id) continue;
      const list = map.get(id) ?? [];
      list.push({ row, col });
      map.set(id, list);
    }
  }
  return map;
}

function reassignRoomCells(cellRoomIds: string[][], fromId: string, toId: string) {
  if (fromId === toId) return;
  for (let row = 0; row < cellRoomIds.length; row++) {
    for (let col = 0; col < cellRoomIds[row].length; col++) {
      if (cellRoomIds[row][col] === fromId) cellRoomIds[row][col] = toId;
    }
  }
}

function adjacentRoomVotes(
  cellRoomIds: string[][],
  cells: MurdokuPosition[],
  selfId: string,
  rows: number,
  cols: number
): Map<string, number> {
  const votes = new Map<string, number>();
  for (const cell of cells) {
    for (const n of orthoNeighbors(cell.row, cell.col)) {
      if (!inBounds(n.row, n.col, rows, cols)) continue;
      const id = cellRoomIds[n.row][n.col];
      if (!id || id === selfId) continue;
      votes.set(id, (votes.get(id) ?? 0) + 1);
    }
  }
  return votes;
}

function stealCellsIntoRoom(
  cellRoomIds: string[][],
  roomId: string,
  need: number,
  protectedKeys: Set<string>,
  rows: number,
  cols: number
): boolean {
  const groups = collectRoomCells(cellRoomIds);
  const current = groups.get(roomId) ?? [];
  let missing = need - current.length;
  if (missing <= 0) return false;
  const candidates: MurdokuPosition[] = [];
  for (const cell of current) {
    for (const n of orthoNeighbors(cell.row, cell.col)) {
      if (!inBounds(n.row, n.col, rows, cols)) continue;
      const fromId = cellRoomIds[n.row][n.col];
      if (!fromId || fromId === roomId) continue;
      if (protectedKeys.has(`${n.row},${n.col}`)) continue;
      const fromSize = groups.get(fromId)?.length ?? 0;
      if (fromSize <= MIN_ROOM_CELLS) continue;
      candidates.push(n);
    }
  }
  let stole = false;
  for (const cell of candidates) {
    if (missing <= 0) break;
    const fromId = cellRoomIds[cell.row][cell.col];
    if (!fromId || fromId === roomId) continue;
    const fromSize = collectRoomCells(cellRoomIds).get(fromId)?.length ?? 0;
    if (fromSize <= MIN_ROOM_CELLS) continue;
    cellRoomIds[cell.row][cell.col] = roomId;
    missing -= 1;
    stole = true;
  }
  return stole;
}

function enforceLogicalRooms(
  cellRoomIds: string[][],
  rooms: MurdokuRoom[],
  placements: Assignment,
  victimId: string,
  murdererId: string,
  rows: number,
  cols: number
) {
  const protectedKeys = new Set<string>();
  const victim = placements[victimId];
  const murderer = placements[murdererId];
  if (victim) protectedKeys.add(`${victim.row},${victim.col}`);
  if (murderer) protectedKeys.add(`${murderer.row},${murderer.col}`);
  const crimeId = victim ? cellRoomIds[victim.row]?.[victim.col] : '';

  for (let step = 0; step < 48; step++) {
    const groups = collectRoomCells(cellRoomIds);
    const small = [...groups.entries()].filter(([, cells]) => cells.length < MIN_ROOM_CELLS);
    if (!small.length) break;
    let changed = false;
    for (const [id, cells] of small) {
      if (stealCellsIntoRoom(cellRoomIds, id, MIN_ROOM_CELLS, protectedKeys, rows, cols)) {
        changed = true;
        continue;
      }
      const votes = [...adjacentRoomVotes(cellRoomIds, cells, id, rows, cols).entries()].sort(
        (a, b) => b[1] - a[1]
      );
      const target = votes[0]?.[0];
      if (!target) continue;
      if (id === crimeId) reassignRoomCells(cellRoomIds, target, id);
      else reassignRoomCells(cellRoomIds, id, target);
      changed = true;
    }
    if (!changed) break;
  }

  for (let pass = 0; pass < 2; pass++) {
    const groups = collectRoomCells(cellRoomIds);
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const id = cellRoomIds[row][col];
        if (!id || protectedKeys.has(`${row},${col}`)) continue;
        if ((groups.get(id)?.length ?? 0) <= MIN_ROOM_CELLS) continue;
        const votes = adjacentRoomVotes(cellRoomIds, [{ row, col }], id, rows, cols);
        let bestId = '';
        let best = 0;
        for (const [other, count] of votes) {
          if (count > best) {
            best = count;
            bestId = other;
          }
        }
        if (bestId && best >= 2) {
          cellRoomIds[row][col] = bestId;
          const next = groups.get(id);
          if (next) {
            const idx = next.findIndex((cell) => cell.row === row && cell.col === col);
            if (idx >= 0) next.splice(idx, 1);
          }
        }
      }
    }
  }

  const usedNames = rooms.map((room) => room.name);
  const groups = collectRoomCells(cellRoomIds);
  for (const room of rooms) {
    const cells = groups.get(room.id);
    if (!cells?.length) continue;
    const metrics = roomAreaMetrics(cells);
    const nextName = labelForRoomShape(room.name, metrics, usedNames);
    if (nextName !== room.name) {
      usedNames.push(nextName);
      room.name = nextName;
    }
  }
}

function generateRooms(
  rng: Rng,
  rows: number,
  cols: number,
  placements: Assignment,
  roomTemplates: MurdokuRoom[],
  victimId: string,
  murdererId: string
): { rooms: MurdokuRoom[]; cellRoomIds: string[][] } {
  const rooms = roomTemplates.map((r) => ({ ...r }));
  const cellRoomIds: string[][] = Array.from({ length: rows }, () => Array(cols).fill(''));
  const characterCells = new Set(
    Object.entries(placements).map(([id, p]) => `${id}:${p.row},${p.col}`)
  );
  const otherCharKeys = new Set(
    Object.entries(placements)
      .filter(([id]) => id !== victimId && id !== murdererId)
      .map(([, p]) => `${p.row},${p.col}`)
  );

  const v = placements[victimId];
  const m = placements[murdererId];
  const crimePath = shortestPath(v, m, otherCharKeys);
  const crimeCells = new Set(crimePath.map((p) => `${p.row},${p.col}`));
  const extra = randInt(rng, 1, Math.max(1, Math.min(8, Math.floor((rows * cols) / 6))));
  for (let i = 0; i < extra; i++) {
    const from = pick(rng, [...crimePath]);
    const n = pick(rng, orthoNeighbors(from.row, from.col));
    const k = `${n.row},${n.col}`;
    if (inBounds(n.row, n.col, rows, cols) && !otherCharKeys.has(k)) {
      crimeCells.add(k);
      crimePath.push(n);
    }
  }
  const crimeRoom = rooms[0] ?? { id: 'room-1', slotId: 'R01', name: 'Crime Scene', color: '#fde68a', labelVisible: true };
  for (const key of crimeCells) {
    const [row, col] = key.split(',').map(Number);
    cellRoomIds[row][col] = crimeRoom.id;
  }

  const remainingRooms = rooms.filter((r) => r.id !== crimeRoom.id);
  const seeds: { roomId: string; row: number; col: number }[] = [];
  const otherPlacements = Object.entries(placements).filter(
    ([id]) => id !== victimId && id !== murdererId
  );
  otherPlacements.forEach(([, pos], i) => {
    const room = remainingRooms[i % Math.max(1, remainingRooms.length)] ?? crimeRoom;
    seeds.push({ roomId: room.id, row: pos.row, col: pos.col });
    cellRoomIds[pos.row][pos.col] = room.id;
  });
  while (seeds.length < remainingRooms.length) {
    const open: MurdokuPosition[] = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (!cellRoomIds[r][c]) open.push({ row: r, col: c });
      }
    }
    if (!open.length) break;
    const cell = pick(rng, open);
    const room = remainingRooms[seeds.length];
    if (!room) break;
    seeds.push({ roomId: room.id, row: cell.row, col: cell.col });
    cellRoomIds[cell.row][cell.col] = room.id;
  }

  const empty: MurdokuPosition[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (!cellRoomIds[r][c]) empty.push({ row: r, col: c });
    }
  }
  if (!seeds.length) {
    for (const cell of empty) {
      cellRoomIds[cell.row][cell.col] = crimeRoom.id;
    }
  } else {
    for (const cell of shuffle(rng, empty)) {
      let best = seeds[0];
      let bestD = 999;
      for (const seed of seeds) {
        const d = Math.abs(seed.row - cell.row) + Math.abs(seed.col - cell.col);
        if (d < bestD) {
          bestD = d;
          best = seed;
        }
      }
      if (otherCharKeys.has(`${cell.row},${cell.col}`) && best.roomId === crimeRoom.id) {
        const alt = seeds.find((s) => s.roomId !== crimeRoom.id) ?? best;
        cellRoomIds[cell.row][cell.col] = alt.roomId;
      } else {
        cellRoomIds[cell.row][cell.col] = best.roomId;
      }
    }
  }

  void characterCells;
  enforceLogicalRooms(cellRoomIds, rooms, placements, victimId, murdererId, rows, cols);
  const usedIds = new Set(cellRoomIds.flat().filter(Boolean));
  return { rooms: rooms.filter((room) => usedIds.has(room.id)), cellRoomIds };
}

type ItemRoomRule = {
  test: RegExp;
  prefer: RegExp;
  forbid: RegExp;
  clueCommon?: boolean;
};

const ITEM_ROOM_RULES: ItemRoomRule[] = [
  {
    test: /\bbed\b/i,
    prefer: /bed|suite|cabin|ward|dorm|sleep|hotel/i,
    forbid: /kitchen|cafe|cafeteria|dining|gym|lab|science|office|hall|corridor|passage|library|lobby|pool|gymnasium/i,
  },
  {
    test: /\b(stove|oven|sink|fridge|refrigerator|counter)\b/i,
    prefer: /kitchen|cafe|cafeteria|dining/i,
    forbid: /bed|suite|library|gym|office|hall|classroom/i,
  },
  {
    test: /\b(desk|bookshelf|bookcase|shelf)\b/i,
    prefer: /library|study|office|classroom|archive|bedroom|lounge|reading/i,
    forbid: /kitchen|gym|pool|cafeteria|gymnasium/i,
  },
  {
    test: /\bsofa\b/i,
    prefer: /lounge|lobby|living|suite|bar|office|foyer|hall/i,
    forbid: /kitchen|gym|lab|science|cafeteria|gymnasium/i,
  },
  {
    test: /\b(shrub|tree|bush)\b/i,
    prefer: /garden|yard|porch|patio|deck|playground|park|lawn/i,
    forbid: /kitchen|lab|office|bedroom|gymnasium/i,
    clueCommon: true,
  },
  {
    test: /\bplant\b/i,
    prefer: /garden|conservatory|lobby|cafe|atrium|foyer|patio|yard|hallway|corridor|lounge|library/i,
    forbid: /kitchen|gym|lab|science|gymnasium/i,
    clueCommon: true,
  },
  {
    test: /\b(chair|bench)\b/i,
    prefer: /dining|kitchen|cafe|lobby|hall|lounge|bar|patio|study|library|foyer|classroom|office|cafeteria/i,
    forbid: /pool|runway/i,
    clueCommon: true,
  },
  {
    test: /\btable\b/i,
    prefer: /dining|kitchen|cafe|lobby|hall|lounge|bar|study|library|office|cafeteria/i,
    forbid: /bedroom|gym|pool|gymnasium/i,
  },
  {
    test: /\b(carpet|rug)\b/i,
    prefer: /dining|lobby|hall|lounge|study|library|foyer|bedroom|office|suite/i,
    forbid: /kitchen|gym|pool|lab|gymnasium/i,
    clueCommon: true,
  },
  {
    test: /\bladder\b/i,
    prefer: /attic|stage|wings|storage|stock|props/i,
    forbid: /dining|bedroom|lobby|cafeteria/i,
  },
  {
    test: /\b(box|trunk|crate)\b/i,
    prefer: /storage|stock|office|props|attic|stockroom/i,
    forbid: /dining|cafeteria/i,
  },
  {
    test: /\blamp\b/i,
    prefer: /bedroom|study|library|office|lounge|lobby|suite|reading/i,
    forbid: /gym|pool|kitchen|gymnasium/i,
    clueCommon: true,
  },
  {
    test: /\b(cart|trolley)\b/i,
    prefer: /kitchen|storage|hall|corridor|lobby|cafeteria|ward/i,
    forbid: /bedroom|suite/i,
  },
];

function itemRoomRule(name: string): ItemRoomRule | undefined {
  return ITEM_ROOM_RULES.find((rule) => rule.test.test(name));
}

function forbiddenRoomIdsForItem(name: string, rooms: MurdokuRoom[]): Set<string> {
  const rule = itemRoomRule(name);
  if (!rule) return new Set();
  return new Set(rooms.filter((room) => rule.forbid.test(room.name)).map((room) => room.id));
}

function elementFootprint(el: MurdokuElementDef, row: number, col: number): MurdokuPosition[] {
  const cells: MurdokuPosition[] = [];
  for (let r = 0; r < Math.max(1, el.heightCells || 1); r++) {
    for (let c = 0; c < Math.max(1, el.widthCells || 1); c++) {
      cells.push({ row: row + r, col: col + c });
    }
  }
  return cells;
}

function targetOccupiedCellsInRoom(size: number): number {
  const max = maxOccupiedCellsInRoom(size);
  return Math.min(max, Math.max(1, Math.round(size * 0.5)));
}

function generateObjects(
  rng: Rng,
  rows: number,
  cols: number,
  elements: MurdokuElementDef[],
  placements: Assignment,
  cellRoomIds: string[][],
  rooms: MurdokuRoom[],
  sceneStyle?: MurdokuSceneStyleOptions,
  themeHint = ''
): MurdokuPlacedObject[] {
  const style = normalizeSceneStyle(sceneStyle);
  const annotatedRooms = syncRoomsCatalog(rooms, themeHint, style);
  const objects: MurdokuPlacedObject[] = [];
  const objectCellsTaken = new Set<string>();
  const characterKeys = new Set(Object.values(placements).map((p) => `${p.row},${p.col}`));
  const catalog = elements.filter((e) => e.quantity > 0 && itemPassesStyle(e.name, style));
  const placedCount = new Map<string, number>();
  const roomCells = collectRoomCells(cellRoomIds);
  let z = 1;

  const maxFor = (el: MurdokuElementDef) => Math.max(1, Math.min(6, el.quantity || 1));
  const canPlaceMore = (el: MurdokuElementDef) => (placedCount.get(el.id) ?? 0) < maxFor(el);
  const occupancyOf = (roomId: string) =>
    (roomCells.get(roomId) ?? []).filter((cell) => objectCellsTaken.has(`${cell.row},${cell.col}`)).length;

  const canFit = (el: MurdokuElementDef, row: number, col: number, allowOnCharacter: boolean) => {
    const cells = elementFootprint(el, row, col);
    let roomId = '';
    let newOccupied = 0;
    for (const cell of cells) {
      const key = `${cell.row},${cell.col}`;
      if (!inBounds(cell.row, cell.col, rows, cols)) return false;
      if (objectCellsTaken.has(key)) return false;
      if (characterKeys.has(key) && !allowOnCharacter) return false;
      if (characterKeys.has(key) && !isStandOnPropName(el.name)) return false;
      const cellRoom = cellRoomIds[cell.row]?.[cell.col];
      if (!cellRoom) return false;
      if (!roomId) roomId = cellRoom;
      else if (cellRoom !== roomId) return false;
      newOccupied += 1;
    }
    const size = roomCells.get(roomId)?.length ?? 0;
    if (occupancyOf(roomId) + newOccupied > maxOccupiedCellsInRoom(size)) return false;
    return true;
  };

  const placeAt = (el: MurdokuElementDef, row: number, col: number) => {
    objects.push({
      id: `${el.id}-p${objects.length + 1}`,
      elementId: el.id,
      row,
      col,
      widthCells: el.widthCells || 1,
      heightCells: el.heightCells || 1,
      rotation: el.rotation,
      scale: el.defaultScale,
      locked: false,
      zIndex: z++,
    });
    placedCount.set(el.id, (placedCount.get(el.id) ?? 0) + 1);
    for (let r = 0; r < Math.max(1, el.heightCells); r++) {
      for (let c = 0; c < Math.max(1, el.widthCells); c++) {
        objectCellsTaken.add(`${row + r},${col + c}`);
      }
    }
  };

  const roomAllowsItem = (el: MurdokuElementDef, roomId: string | undefined) => {
    if (!roomId) return false;
    const room = annotatedRooms.find((entry) => entry.id === roomId);
    if (!room) return false;
    if (forbiddenRoomIdsForItem(el.name, annotatedRooms).has(roomId)) return false;
    return elementFitsRoom(el.name, room, style, themeHint);
  };
  const roomAllowsItemLoose = roomAllowsItem;
  const hostRoomsFor = (el: MurdokuElementDef) => {
    const forbidden = forbiddenRoomIdsForItem(el.name, annotatedRooms);
    const allowed = annotatedRooms
      .filter((room) => !forbidden.has(room.id) && elementFitsRoom(el.name, room, style, themeHint))
      .map((room) => room.id);
    const unique = [...new Set(allowed)];
    const rule = itemRoomRule(el.name);
    const limit = rule?.clueCommon ? Math.min(2, unique.length) : unique.length;
    return new Set(shuffle(rng, unique).slice(0, Math.max(1, limit)));
  };
  const hostByElement = new Map(catalog.map((el) => [el.id, hostRoomsFor(el)]));

  const sitOns = catalog.filter((e) => isStandOnPropName(e.name));
  const charPositions = Object.values(placements);
  const sitTargets = shuffle(rng, charPositions).slice(
    0,
    Math.max(2, Math.ceil(charPositions.length * 0.3))
  );
  sitTargets.forEach((pos) => {
    const roomId = cellRoomIds[pos.row]?.[pos.col];
    const allowed = sitOns.filter(
      (el) => canPlaceMore(el) && canFit(el, pos.row, pos.col, true) && roomAllowsItem(el, roomId)
    );
    const el = allowed[0];
    if (!el) return;
    placeAt(el, pos.row, pos.col);
  });

  const besideCatalog = catalog.filter((e) => e.canBeBeside !== false);
  for (const pos of charPositions) {
    const hasBeside = objects.some((o) => besideObject(objects, pos.row, pos.col, o.id));
    if (hasBeside || besideCatalog.length === 0) continue;
    const roomId = cellRoomIds[pos.row]?.[pos.col];
    const preferBeside = besideCatalog.filter(
      (e) => canPlaceMore(e) && !e.canStandOn && roomAllowsItem(e, roomId)
    );
    const anyBeside = besideCatalog.filter((e) => canPlaceMore(e) && roomAllowsItem(e, roomId));
    const el = preferBeside.length
      ? pick(rng, preferBeside)
      : anyBeside.length
        ? pick(rng, anyBeside)
        : undefined;
    const neighbor = shuffle(rng, orthoNeighbors(pos.row, pos.col)).find((cell) => {
      if (!el || !canFit(el, cell.row, cell.col, false)) return false;
      const neighborRoom = cellRoomIds[cell.row]?.[cell.col];
      return roomAllowsItem(el, neighborRoom);
    });
    if (!el || !neighbor) continue;
    placeAt(el, neighbor.row, neighbor.col);
  }

  for (const el of catalog) {
    const forbidden = forbiddenRoomIdsForItem(el.name, annotatedRooms);
    const hosts = hostByElement.get(el.id) ?? new Set<string>();
    const rule = itemRoomRule(el.name);
    const maxCopies = rule?.clueCommon ? Math.min(2, maxFor(el)) : maxFor(el);
    while ((placedCount.get(el.id) ?? 0) < maxCopies) {
      const underTarget: MurdokuPosition[] = [];
      const rest: MurdokuPosition[] = [];
      for (let row = 0; row <= rows - (el.heightCells || 1); row++) {
        for (let col = 0; col <= cols - (el.widthCells || 1); col++) {
          if (!canFit(el, row, col, false)) continue;
          const roomId = cellRoomIds[row]?.[col];
          if (!roomId || forbidden.has(roomId)) continue;
          if (hosts.size && !hosts.has(roomId)) continue;
          if (!roomAllowsItem(el, roomId)) continue;
          const size = roomCells.get(roomId)?.length ?? 0;
          const cell = { row, col };
          if (occupancyOf(roomId) < targetOccupiedCellsInRoom(size)) underTarget.push(cell);
          else rest.push(cell);
        }
      }
      const pool = underTarget.length ? underTarget : rest;
      if (pool.length === 0) break;
      const cell = pick(rng, pool);
      placeAt(el, cell.row, cell.col);
    }
  }

  const fillers = catalog.filter(
    (el) =>
      Math.max(1, el.widthCells || 1) === 1 &&
      Math.max(1, el.heightCells || 1) === 1 &&
      !itemRoomRule(el.name)?.clueCommon
  );
  for (const [roomId, cells] of roomCells) {
    if (!cells.length || occupancyOf(roomId) > 0) continue;
    const allowed = fillers.filter((el) => canPlaceMore(el) && roomAllowsItemLoose(el, roomId));
    if (!allowed.length) continue;
    const el = pick(rng, allowed);
    const spot = shuffle(rng, cells).find((cell) => canFit(el, cell.row, cell.col, false));
    if (!spot) continue;
    placeAt(el, spot.row, spot.col);
  }

  return objects;
}

const CARD_CLUE_PRIORITY: MurdokuClueType[] = [
  'ALONE_WITH_MURDERER',
  'ALONE_IN_ROOM',
  'BESIDE_KIND_OR',
  'BESIDE_KIND',
  'BESIDE_OBJECT',
  'IN_ROOM',
  'BESIDE_PERSON',
  'SAME_ROOM_AS',
  'ONLY_PERSON_ON_KIND',
  'ON_KIND',
  'ON_OBJECT',
];

function ensurePersonalSceneClues(
  rng: Rng,
  world: World,
  clues: MurdokuClue[],
  pool: MurdokuClue[]
): MurdokuClue[] {
  const next = [...clues];
  const used = new Set(next.map((c) => c.simpleText));
  for (const char of world.characters.filter((c) => c.enabled)) {
    const hasPersonal = next.some(
      (c) => c.subjectId === char.id && SCENE_CARD_TYPES.has(c.type) && !GRID_TYPES.has(c.type)
    );
    if (hasPersonal) continue;
    const extra =
      shuffle(rng, pool).find(
        (c) =>
          c.subjectId === char.id &&
          SCENE_CARD_TYPES.has(c.type) &&
          !ON_SCENE_TYPES.has(c.type) &&
          !GRID_TYPES.has(c.type) &&
          !used.has(c.simpleText)
      ) ??
      shuffle(rng, pool).find(
        (c) =>
          c.subjectId === char.id &&
          SCENE_CARD_TYPES.has(c.type) &&
          !GRID_TYPES.has(c.type) &&
          !used.has(c.simpleText)
      );
    if (!extra) continue;
    used.add(extra.simpleText);
    next.push(extra);
  }
  return next;
}

function replaceGridClues(
  rng: Rng,
  world: World,
  intended: Assignment,
  clues: MurdokuClue[],
  pool: MurdokuClue[]
): MurdokuClue[] {
  let next = [...clues];
  const used = new Set(next.map((c) => c.simpleText));
  for (let i = next.length - 1; i >= 0; i--) {
    if (!GRID_TYPES.has(next[i].type)) continue;
    const without = next.filter((_, idx) => idx !== i);
    const removable = solveMurdoku(world, without, 2);
    if (removable.count === 1 && assignmentsEqual(removable.solutions[0], intended)) {
      next = without;
      continue;
    }
    const replacement = shuffle(rng, pool).find(
      (c) => !used.has(c.simpleText) && !GRID_TYPES.has(c.type) && clueTrueFor(c, intended, world)
    );
    if (!replacement) continue;
    const swapped = [...without, replacement];
    const check = solveMurdoku(world, swapped, 2);
    if (check.count === 1 && assignmentsEqual(check.solutions[0], intended)) {
      used.add(replacement.simpleText);
      next = swapped;
    }
  }
  return next;
}

function publishClues(
  rng: Rng,
  world: World,
  intended: Assignment,
  minimized: MurdokuClue[],
  pool: MurdokuClue[],
  useSimple: boolean
): MurdokuClue[] {
  const sceneFirst = replaceGridClues(
    rng,
    world,
    intended,
    minimized.filter((c) => !GRID_TYPES.has(c.type)),
    pool
  );
  const withPeople = ensurePersonalSceneClues(rng, world, sceneFirst, pool);
  return withVictimClue(rng, world, withPeople, useSimple);
}

export function assignCharacterClueTexts(
  characters: MurdokuCharacter[],
  clues: MurdokuClue[],
  victimId: string
): MurdokuCharacter[] {
  const usedTypes = new Set<MurdokuClueType>();
  return characters.map((c) => {
    if (c.id === victimId) {
      return {
        ...c,
        isVictim: true,
        clueText: `The Victim. ${characterPronoun(c).subject} was alone with the murderer.`,
      };
    }
    const personal = clues.filter(
      (cl) => cl.subjectId === c.id && cl.enabled && !GRID_TYPES.has(cl.type)
    );
    const ranked = CARD_CLUE_PRIORITY
      .map((type) => personal.find((cl) => cl.type === type))
      .filter((cl): cl is MurdokuClue => Boolean(cl));
    const unused = ranked.find((cl) => !usedTypes.has(cl.type) || cl.type === 'IN_ROOM');
    const chosen = unused || ranked[0] || personal[0];
    if (chosen) usedTypes.add(chosen.type);
    const raw = chosen?.displayText || c.clueText;
    return {
      ...c,
      clueText: raw ? personalizeClueText(raw, c) : c.clueText,
    };
  });
}

function withVictimClue(
  rng: Rng,
  world: World,
  clues: MurdokuClue[],
  useSimple: boolean
): MurdokuClue[] {
  if (clues.some((c) => c.type === 'ALONE_WITH_MURDERER')) return clues;
  return [
    ...clues,
    makeClue(rng, { type: 'ALONE_WITH_MURDERER', subjectId: world.victimId }, world, useSimple),
  ];
}

function peopleNeededForGrid(rows: number, cols: number, enabledCount: number): number {
  return Math.max(3, Math.min(rows, cols, enabledCount));
}

function charactersForBoard(
  characters: MurdokuCharacter[],
  rows: number,
  cols: number,
  rng: Rng
): MurdokuCharacter[] {
  const enabled = characters.filter((c) => c.enabled);
  const needed = peopleNeededForGrid(rows, cols, enabled.length);
  return shuffle(rng, enabled)
    .slice(0, needed)
    .map((c) => ({ ...c, enabled: true }));
}

function roomsForBoard(
  rooms: MurdokuRoom[],
  rows: number,
  cols: number,
  people: number
): MurdokuRoom[] {
  if (rooms.length <= 2) return rooms;
  const maxRooms = Math.max(
    2,
    Math.min(rooms.length, people + 1, Math.max(2, Math.floor((rows * cols) / 3)))
  );
  return rooms.slice(0, maxRooms);
}

function placeCharacters(rng: Rng, characters: MurdokuCharacter[], rows: number, cols: number): Assignment {
  const chars = characters.filter((c) => c.enabled);
  const n = Math.min(chars.length, rows, cols);
  const used = shuffle(rng, chars).slice(0, n);
  const rowPerm = shuffle(rng, Array.from({ length: rows }, (_, i) => i)).slice(0, n);
  const colPerm = shuffle(rng, Array.from({ length: cols }, (_, i) => i)).slice(0, n);
  const assignment: Assignment = {};
  used.forEach((char, i) => {
    assignment[char.id] = { row: rowPerm[i], col: colPerm[i] };
  });
  return assignment;
}

function defaultStory(
  theme: MurdokuTheme,
  victim: MurdokuCharacter,
  location: string,
  peopleCount: number
): MurdokuStory {
  return {
    caseTitle: `The ${theme.name} Case`,
    intro: `${victim.name} was found in ${location}. Everyone still inside must account for where they were.`,
    crimeDescription: `${victim.name} was discovered after hours. ${peopleCount} people remained on the premises.`,
    victimName: victim.name,
    victimDescription: victim.description || `${victim.name} worked at the ${theme.location}.`,
    crimeLocation: location,
    whatHappened: `Use the clues to reconstruct where each person was standing.`,
    timeOfIncident: 'After closing time',
    background: theme.description,
    instruction:
      'Use the clues to determine where each character was located. Each character can appear only once in every row and column. Identify the person who was alone in the same area as the victim.',
    flavorText: '',
    solutionExplanation: '',
    source: 'empty',
  };
}

export function validateMurdokuPuzzle(puzzle: MurdokuPuzzle, elements: MurdokuElementDef[]): MurdokuValidation {
  const sceneElements = puzzle.elements?.length ? puzzle.elements : enrichMurdokuElementsForScene(elements);
  const world: World = {
    rows: puzzle.rows,
    cols: puzzle.cols,
    cellRoomIds: puzzle.cellRoomIds,
    objects: puzzle.objects,
    elements: sceneElements,
    characters: puzzle.characters,
    rooms: puzzle.rooms,
    victimId: puzzle.victimId,
    murderRule: 'alone-with-victim',
  };
  const result = solveMurdoku(world, puzzle.clues.filter((c) => c.enabled), 2);
  const { score, label } = scoreDifficulty(puzzle.clues, result.deductionSteps);
  let status: MurdokuLogicStatus = 'generated';
  if (result.count === 1) status = 'unique';
  else if (result.count === 0) status = 'none';
  else status = 'multiple';
  const minimized = result.count === 1 ? minimizeClues(world, puzzle.clues) : { redundantClueIds: [] };
  return {
    status,
    solutionCount: result.count,
    redundantClueIds: minimized.redundantClueIds,
    difficultyScore: score,
    difficultyLabel: label,
    deductionSteps: result.deductionSteps,
  };
}

export function autoFixMurdokuPuzzle(
  puzzle: MurdokuPuzzle,
  elements: MurdokuElementDef[],
  seed = puzzle.seed
): MurdokuPuzzle {
  const rng = mulberry32(seed + 17);
  const sceneElements = puzzle.elements?.length ? puzzle.elements : enrichMurdokuElementsForScene(elements);
  const world: World = {
    rows: puzzle.rows,
    cols: puzzle.cols,
    cellRoomIds: puzzle.cellRoomIds,
    objects: puzzle.objects,
    elements: sceneElements,
    characters: puzzle.characters,
    rooms: puzzle.rooms,
    victimId: puzzle.victimId,
    murderRule: 'alone-with-victim',
  };
  const pool = enumerateTrueClues(rng, world, puzzle.solution.placements, true);
  const fixed = addUntilUnique(rng, world, puzzle.solution.placements, puzzle.clues, pool);
  const uniqueCheck = solveMurdoku(world, fixed, 2);
  const minimized =
    uniqueCheck.count === 1 ? minimizeClues(world, fixed) : { clues: fixed, redundantClueIds: [] };
  const published = publishClues(rng, world, puzzle.solution.placements, minimized.clues, pool, true);
  const scored = scoreDifficulty(published, uniqueCheck.deductionSteps);
  return {
    ...puzzle,
    clues: published,
    characters: assignCharacterClueTexts(puzzle.characters, published, puzzle.victimId),
    validation: {
      status: uniqueCheck.count === 1 ? 'unique' : uniqueCheck.count === 0 ? 'none' : 'multiple',
      solutionCount: uniqueCheck.count,
      redundantClueIds: minimized.redundantClueIds,
      difficultyScore: scored.score,
      difficultyLabel: scored.label,
      deductionSteps: uniqueCheck.deductionSteps,
    },
  };
}

export function generateMurdokuPuzzle(options: MurdokuGenerateOptions): MurdokuPuzzle {
  const seed = options.seed ?? Math.floor(Math.random() * 1e9);
  const rows = Math.max(4, Math.min(16, options.rows || 9));
  const cols = Math.max(4, Math.min(16, options.cols || 9));
  const characters = options.characters.filter((c) => c.enabled);
  const sceneStyle = normalizeSceneStyle({
    avoidRandomProps: options.avoidRandomProps,
    useOnlyLargeFurniture: options.useOnlyLargeFurniture,
    allowedCategories: options.allowedObjectCategories,
  });
  const themedRooms = syncRoomsCatalog(options.rooms, options.theme?.name, sceneStyle);
  const elements = enrichMurdokuElementsForScene(options.elements, themedRooms, sceneStyle);
  if (characters.length < 3) {
    throw new Error('Murdoku needs at least 3 enabled characters.');
  }

  const maxAttempts = Math.max(1, options.maxAttempts ?? (rows === 9 && cols === 9 ? 40 : 48));
  const deadline = options.deadlineMs ? Date.now() + options.deadlineMs : Number.POSITIVE_INFINITY;
  const report = (message: string) => options.onProgress?.(message);

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    if (Date.now() > deadline) break;
    if (attempt === 0) report('Reading the puzzle logic, grid, and areas…');
    else if (attempt === 1) report('Trying another room layout…');
    const rng = mulberry32(seed + attempt * 9973);
    // Latin-square rule: one person per row and per column, so a 6x6 board
    // can host at most 6 of the default 9 suspects — never all 9.
    const boardCharacters = charactersForBoard(characters, rows, cols, rng);
    const placements = placeCharacters(rng, boardCharacters, rows, cols);
    const placedIds = Object.keys(placements);
    const victim = pick(rng, placedIds.map((id) => boardCharacters.find((c) => c.id === id)!));
    const murderer = pick(
      rng,
      placedIds
        .map((id) => boardCharacters.find((c) => c.id === id)!)
        .filter((c) => c.id !== victim.id)
    );
    if (attempt === 0) report('Shaping rooms so each area is at least 3 squares…');
    const rooms = generateRooms(
      rng,
      rows,
      cols,
      placements,
      roomsForBoard(themedRooms, rows, cols, boardCharacters.length),
      victim.id,
      murderer.id
    );
    if (attempt === 0) report('Matching room labels to width and length…');
    if (attempt === 0) report('Placing related items in each room…');
    const sceneRooms = syncRoomsCatalog(rooms.rooms, options.theme?.name, sceneStyle);
    const objects = generateObjects(
      rng,
      rows,
      cols,
      elements,
      placements,
      rooms.cellRoomIds,
      sceneRooms,
      sceneStyle,
      options.theme?.name
    );
    const world: World = {
      rows,
      cols,
      cellRoomIds: rooms.cellRoomIds,
      objects,
      elements,
      characters: boardCharacters,
      rooms: sceneRooms,
      victimId: victim.id,
      murderRule: options.murderRule ?? 'alone-with-victim',
    };
    if (murderRuleHolds(placements, world) !== true) continue;

    if (attempt === 0) report('Checking the puzzle has a unique solution…');
    const useSimple = options.useSimpleWording !== false;
    const pool = enumerateTrueClues(rng, world, placements, useSimple);
    const initial = pickInitialClues(rng, pool, options.difficulty, options.customClueCount);
    const uniqueClues = addUntilUnique(rng, world, placements, initial, pool);
    const solved = solveMurdoku(world, uniqueClues, 2);
    if (solved.count !== 1 || !assignmentsEqual(solved.solutions[0], placements)) continue;

    const minimized = minimizeClues(world, uniqueClues);
    const confirm = solveMurdoku(world, minimized.clues, 2);
    if (confirm.count !== 1) continue;

    const published = publishClues(rng, world, placements, minimized.clues, pool, useSimple);
    const printed = solveMurdoku(world, published, 2);
    if (printed.count !== 1 || !assignmentsEqual(printed.solutions[0], placements)) continue;
    const scored = scoreDifficulty(published, printed.deductionSteps);
    const crimeRoomId = rooms.cellRoomIds[placements[victim.id].row][placements[victim.id].col];
    const crimeRoomName = roomNameOf(rooms.rooms, crimeRoomId);
    const storyBase = defaultStory(options.theme, victim, crimeRoomName, boardCharacters.length);
    const snapshotChars = assignCharacterClueTexts(
      boardCharacters.map((c) => ({
        ...c,
        isVictim: c.id === victim.id,
        isMurderer: c.id === murderer.id,
      })),
      published,
      victim.id
    );

    return {
      type: 'murdoku',
      seed: seed + attempt * 9973,
      rows,
      cols,
      theme: options.theme,
      story: {
        ...storyBase,
        ...options.story,
        victimName: victim.name,
        crimeLocation: crimeRoomName,
        source: options.story?.source ?? 'empty',
      },
      rooms: sceneRooms,
      cellRoomIds: rooms.cellRoomIds,
      objects,
      elements,
      characters: snapshotChars,
      clues: published,
      victimId: victim.id,
      murdererId: murderer.id,
      murdererReason: `${murderer.name} was the only other person in the ${crimeRoomName} with ${victim.name}.`,
      solution: { placements },
      validation: {
        status: 'unique',
        solutionCount: 1,
        redundantClueIds: minimized.redundantClueIds,
        difficultyScore: scored.score,
        difficultyLabel: scored.label,
        deductionSteps: confirm.deductionSteps,
      },
    };
  }

  throw new Error('Could not generate a Murdoku puzzle with a unique solution. Try different settings.');
}

export function regenerateMurdokuClues(
  puzzle: MurdokuPuzzle,
  elements: MurdokuElementDef[],
  difficulty: MurdokuDifficulty,
  useSimpleWording = true
): MurdokuPuzzle {
  const rng = mulberry32(puzzle.seed + 4242);
  const sceneElements = puzzle.elements?.length ? puzzle.elements : enrichMurdokuElementsForScene(elements);
  const world: World = {
    rows: puzzle.rows,
    cols: puzzle.cols,
    cellRoomIds: puzzle.cellRoomIds,
    objects: puzzle.objects,
    elements: sceneElements,
    characters: puzzle.characters,
    rooms: puzzle.rooms,
    victimId: puzzle.victimId,
    murderRule: 'alone-with-victim',
  };
  const pool = enumerateTrueClues(rng, world, puzzle.solution.placements, useSimpleWording);
  const initial = pickInitialClues(rng, pool, difficulty);
  const uniqueClues = addUntilUnique(rng, world, puzzle.solution.placements, initial, pool);
  const minimized = minimizeClues(world, uniqueClues);
  const confirm = solveMurdoku(world, minimized.clues, 2);
  const published = publishClues(
    rng,
    world,
    puzzle.solution.placements,
    minimized.clues,
    pool,
    useSimpleWording
  );
  const scored = scoreDifficulty(published, confirm.deductionSteps);
  return {
    ...puzzle,
    clues: published,
    characters: assignCharacterClueTexts(puzzle.characters, published, puzzle.victimId),
    validation: {
      status: confirm.count === 1 ? 'unique' : confirm.count === 0 ? 'none' : 'multiple',
      solutionCount: confirm.count,
      redundantClueIds: minimized.redundantClueIds,
      difficultyScore: scored.score,
      difficultyLabel: scored.label,
      deductionSteps: confirm.deductionSteps,
    },
  };
}

export function characterAtCell(puzzle: MurdokuPuzzle, row: number, col: number): MurdokuCharacter | undefined {
  const id = Object.entries(puzzle.solution.placements).find(
    ([, pos]) => pos.row === row && pos.col === col
  )?.[0];
  return id ? puzzle.characters.find((c) => c.id === id) : undefined;
}

export function difficultyLabelText(score: number, label: MurdokuDifficulty): string {
  const pretty = label.charAt(0).toUpperCase() + label.slice(1);
  return `Estimated Difficulty: ${score}/100 — ${pretty}`;
}
