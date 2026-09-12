/**
 * Theme → room kind → allowed furniture / decor / scene objects.
 * Keeps Murdoku rooms visually coherent and blocks random handheld clutter.
 */

import type { MurdokuElementDef, MurdokuRoom } from './puzzles/murdoku';

export type MurdokuRoomKind =
  | 'library'
  | 'classroom'
  | 'office'
  | 'art'
  | 'music'
  | 'gym'
  | 'auditorium'
  | 'cafeteria'
  | 'kitchen'
  | 'cafe'
  | 'garage'
  | 'outdoor'
  | 'hallway'
  | 'storage'
  | 'lab'
  | 'shop'
  | 'bedroom'
  | 'lobby'
  | 'bathroom'
  | 'kids'
  | 'generic';

export type MurdokuObjectCategory = 'furniture' | 'decor' | 'fixture' | 'storage' | 'scene';

export type MurdokuObjectSize = 'large' | 'medium' | 'small';

export interface MurdokuSceneStyleOptions {
  avoidRandomProps?: boolean;
  useOnlyLargeFurniture?: boolean;
  allowedCategories?: MurdokuObjectCategory[];
}

export interface MurdokuRoomKindCatalog {
  kind: MurdokuRoomKind;
  label: string;
  match: RegExp;
  furniture: string[];
  decor: string[];
  objects: string[];
}

export const MURDOKU_OBJECT_CATEGORIES: MurdokuObjectCategory[] = [
  'furniture',
  'decor',
  'fixture',
  'storage',
  'scene',
];

export const DEFAULT_MURDOKU_SCENE_STYLE: Required<MurdokuSceneStyleOptions> = {
  avoidRandomProps: true,
  useOnlyLargeFurniture: false,
  allowedCategories: [...MURDOKU_OBJECT_CATEGORIES],
};

/** Tiny handheld / clutter props that do not read as room furniture. */
export const RANDOM_CLUTTER_ITEMS = [
  'phone',
  'mobile',
  'cellphone',
  'smartphone',
  'book',
  'notebook',
  'magazine',
  'newspaper',
  'coffee',
  'coffee cup',
  'cup',
  'mug',
  'latte',
  'laptop',
  'computer',
  'tablet',
  'keyboard',
  'mouse',
  'screwdriver',
  'wrench',
  'hammer',
  'pencil',
  'pen',
  'marker',
  'crayon',
  'scissors',
  'stapler',
  'ruler',
  'eraser',
  'paperclip',
  'sticky note',
  'keys',
  'wallet',
  'glasses',
  'remote',
  'bottle',
  'plate',
  'fork',
  'spoon',
  'knife',
  'napkin',
  'phone charger',
  'headphones',
  'earbuds',
  'camera',
  'flashlight',
  'umbrella',
  'backpack',
  'purse',
  'handbag',
];

const LARGE_NOUNS = [
  'piano',
  'car',
  'sofa',
  'couch',
  'bookshelf',
  'bookcase',
  'cabinet',
  'counter',
  'desk',
  'table',
  'bed',
  'locker',
  'whiteboard',
  'blackboard',
  'podium',
  'easel',
  'rack',
  'bike',
  'barrel',
  'bench',
  'shelf',
  'wardrobe',
  'fridge',
  'stove',
  'oven',
  'sink',
  'kiosk',
  'bar',
  'statue',
];

const MEDIUM_NOUNS = [
  'chair',
  'armchair',
  'stool',
  'plant',
  'lamp',
  'cart',
  'trolley',
  'box',
  'crate',
  'trunk',
  'carpet',
  'rug',
  'mat',
  'stand',
  'speaker',
  'bin',
  'toolbox',
  'case',
  'planter',
  'pedestal',
  'lounge',
];

const CATEGORY_NOUNS: Record<MurdokuObjectCategory, string[]> = {
  furniture: [
    'chair', 'armchair', 'sofa', 'couch', 'bench', 'stool', 'bed', 'table', 'desk',
    'bookshelf', 'bookcase', 'shelf', 'cabinet', 'counter', 'podium', 'easel', 'piano',
    'lounge',
  ],
  decor: ['plant', 'lamp', 'carpet', 'rug', 'curtain', 'statue', 'planter', 'pedestal'],
  fixture: [
    'whiteboard', 'blackboard', 'locker', 'counter', 'sink', 'stove', 'oven', 'fridge',
    'kiosk', 'bar', 'clock',
  ],
  storage: ['box', 'crate', 'trunk', 'cabinet', 'locker', 'toolbox', 'shelf', 'cart', 'trolley'],
  scene: [
    'car', 'barrel', 'bike', 'rack', 'mat', 'bin', 'cart', 'speaker', 'stand', 'case',
    'podium', 'curtain',
  ],
};

const ROOM_KIND_CATALOGS: MurdokuRoomKindCatalog[] = [
  {
    kind: 'art',
    label: 'Art room',
    match: /\b(art|studio|craft|ceramics|paint|kiln)\b/i,
    furniture: ['Easel', 'Art table', 'Stool', 'Storage cabinet', 'Shelf'],
    decor: ['Plant', 'Lamp'],
    objects: ['Supply box', 'Cart', 'Crate'],
  },
  {
    kind: 'music',
    label: 'Music room',
    match: /\b(music|band|orchestra|choir|piano|rehearsal)\b/i,
    furniture: ['Piano', 'Stool', 'Chair', 'Shelf', 'Cabinet'],
    decor: ['Lamp', 'Plant'],
    objects: ['Music stand', 'Instrument case', 'Box'],
  },
  {
    kind: 'gym',
    label: 'Gym',
    match: /\b(gym|gymnasium|fitness|weight room|locker room)\b/i,
    furniture: ['Bench', 'Locker', 'Chair'],
    decor: ['Plant'],
    objects: ['Weights rack', 'Yoga mat', 'Exercise bike', 'Cart', 'Box'],
  },
  {
    kind: 'auditorium',
    label: 'Auditorium',
    match: /\b(auditorium|theater|theatre|stage|assembly|wings|green room|balcony|box office)\b/i,
    furniture: ['Stage chair', 'Bench', 'Podium', 'Cabinet'],
    decor: ['Curtain stand', 'Lamp', 'Plant'],
    objects: ['Speaker', 'Prop box', 'Crate', 'Cart'],
  },
  {
    kind: 'cafeteria',
    label: 'Cafeteria',
    match: /\b(cafeteria|canteen|dining|lunchroom|food court)\b/i,
    furniture: ['Dining table', 'Chair', 'Serving counter', 'Bench'],
    decor: ['Plant', 'Lamp'],
    objects: ['Tray cart', 'Trash bin', 'Box'],
  },
  {
    kind: 'classroom',
    label: 'Classroom',
    match: /\b(class|classroom|homeroom|lecture|schoolroom)\b/i,
    furniture: ['Desk', 'Chair', 'Cabinet', 'Shelf', 'Table'],
    decor: ['Plant', 'Lamp'],
    objects: ['Whiteboard', 'Box', 'Cart'],
  },
  {
    kind: 'lab',
    label: 'Lab',
    match: /\b(lab|laboratory|science|chemistry|biology|computers?)\b/i,
    furniture: ['Lab table', 'Stool', 'Chair', 'Cabinet', 'Shelf', 'Desk'],
    decor: ['Plant', 'Lamp'],
    objects: ['Cart', 'Box', 'Crate'],
  },
  {
    kind: 'library',
    label: 'Library',
    match: /\b(library|bookstore|bookshop|stacks|archive|archives|reading|reference|poetry|rare book|best seller|newsstand)\b/i,
    furniture: ['Bookshelf', 'Reading chair', 'Table', 'Desk', 'Bench', 'Counter'],
    decor: ['Lamp', 'Plant', 'Carpet'],
    objects: ['Cart', 'Box', 'Display case'],
  },
  {
    kind: 'kids',
    label: 'Kids area',
    match: /\b(kids?|children|playroom|toy)\b/i,
    furniture: ['Bench', 'Table', 'Chair', 'Bookshelf', 'Carpet'],
    decor: ['Plant', 'Lamp', 'Rug'],
    objects: ['Toy box', 'Crate', 'Cart'],
  },
  {
    kind: 'office',
    label: 'Office',
    match: /\b(office|principal|headmaster|study|boardroom|hr\b|records|it closet|copy room)\b/i,
    furniture: ['Desk', 'Office chair', 'Visitor chair', 'File cabinet', 'Bookshelf', 'Table'],
    decor: ['Plant', 'Lamp', 'Carpet'],
    objects: ['Cabinet', 'Box', 'Cart'],
  },
  {
    kind: 'kitchen',
    label: 'Kitchen',
    match: /\b(kitchen|galley)\b/i,
    furniture: ['Counter', 'Stool', 'Table', 'Chair', 'Cabinet'],
    decor: ['Plant', 'Lamp'],
    objects: ['Cart', 'Box', 'Crate', 'Trash bin'],
  },
  {
    kind: 'cafe',
    label: 'Cafe',
    match: /\b(cafe|bistro|bar|coffee shop)\b/i,
    furniture: ['Table', 'Chair', 'Counter', 'Sofa', 'Bench'],
    decor: ['Plant', 'Lamp', 'Carpet'],
    objects: ['Cart', 'Box', 'Trash bin'],
  },
  {
    kind: 'garage',
    label: 'Garage',
    match: /\b(garage|workshop|maintenance|loading|parking)\b/i,
    furniture: ['Bench', 'Cabinet', 'Shelf', 'Stool'],
    decor: ['Lamp', 'Plant'],
    objects: ['Car', 'Box', 'Crate', 'Barrel', 'Toolbox', 'Cart'],
  },
  {
    kind: 'outdoor',
    label: 'Outdoor',
    match: /\b(playground|garden|patio|yard|park|outdoor|pool|deck|courtyard|promenade|fountain|runway)\b/i,
    furniture: ['Bench', 'Table', 'Chair'],
    decor: ['Plant', 'Planter', 'Lamp'],
    objects: ['Crate', 'Barrel', 'Box', 'Cart'],
  },
  {
    kind: 'hallway',
    label: 'Hallway',
    match: /\b(hall|hallway|corridor|passage|aisle|walkway|concourse|platform)\b/i,
    furniture: ['Bench', 'Locker', 'Chair'],
    decor: ['Plant', 'Lamp'],
    objects: ['Cart', 'Box', 'Trash bin'],
  },
  {
    kind: 'lobby',
    label: 'Lobby',
    match: /\b(lobby|foyer|atrium|reception|waiting)\b/i,
    furniture: ['Sofa', 'Chair', 'Bench', 'Table', 'Desk', 'Counter'],
    decor: ['Plant', 'Lamp', 'Carpet'],
    objects: ['Cart', 'Box'],
  },
  {
    kind: 'storage',
    label: 'Storage',
    match: /\b(storage|stock|stockroom|props|warehouse|supply|laundry|coat check|lost)\b/i,
    furniture: ['Shelf', 'Cabinet', 'Bench', 'Table'],
    decor: ['Lamp'],
    objects: ['Box', 'Crate', 'Barrel', 'Cart', 'Trunk'],
  },
  {
    kind: 'shop',
    label: 'Shop',
    match: /\b(shop|store|gift|register|fashion|electronics|kiosk)\b/i,
    furniture: ['Counter', 'Shelf', 'Cabinet', 'Chair', 'Table'],
    decor: ['Plant', 'Lamp'],
    objects: ['Cart', 'Box', 'Display case', 'Kiosk'],
  },
  {
    kind: 'bedroom',
    label: 'Bedroom',
    match: /\b(bed|bedroom|suite|cabin|dorm|ward)\b/i,
    furniture: ['Bed', 'Chair', 'Desk', 'Night table', 'Cabinet', 'Bench'],
    decor: ['Lamp', 'Plant', 'Carpet'],
    objects: ['Box', 'Trunk'],
  },
  {
    kind: 'bathroom',
    label: 'Restroom',
    match: /\b(restroom|bathroom|toilet|washroom)\b/i,
    furniture: ['Bench', 'Cabinet'],
    decor: ['Plant', 'Lamp'],
    objects: ['Trash bin', 'Cart', 'Box'],
  },
  {
    kind: 'generic',
    label: 'Room',
    match: /./,
    furniture: ['Chair', 'Table', 'Cabinet', 'Shelf', 'Bench'],
    decor: ['Plant', 'Lamp'],
    objects: ['Box', 'Cart'],
  },
];

const GENERIC_CATALOG = ROOM_KIND_CATALOGS[ROOM_KIND_CATALOGS.length - 1];

export function normalizeSceneStyle(options?: MurdokuSceneStyleOptions): Required<MurdokuSceneStyleOptions> {
  const categories = (options?.allowedCategories ?? DEFAULT_MURDOKU_SCENE_STYLE.allowedCategories).filter((c) =>
    MURDOKU_OBJECT_CATEGORIES.includes(c)
  );
  return {
    avoidRandomProps: options?.avoidRandomProps !== false,
    useOnlyLargeFurniture: options?.useOnlyLargeFurniture === true,
    allowedCategories: categories.length ? categories : [...MURDOKU_OBJECT_CATEGORIES],
  };
}

function isSitOnName(name: string): boolean {
  return /\b(chair|armchair|sofa|couch|bench|bed|carpet|rug|lounge)\b/i.test(name);
}

export function tokensOfName(name: string): string[] {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
}

function lastNoun(name: string): string {
  const tokens = tokensOfName(name);
  return tokens[tokens.length - 1] || '';
}

export function isClutterItem(name: string): boolean {
  const tokens = tokensOfName(name);
  const joined = tokens.join(' ');
  return RANDOM_CLUTTER_ITEMS.some((item) => {
    const clutter = tokensOfName(item).join(' ');
    return joined === clutter || tokens[tokens.length - 1] === clutter;
  });
}

export function objectSizeOf(name: string): MurdokuObjectSize {
  const noun = lastNoun(name);
  if (LARGE_NOUNS.includes(noun) || /\b(bookshelf|bookcase|whiteboard|blackboard)\b/i.test(name)) return 'large';
  if (MEDIUM_NOUNS.includes(noun)) return 'medium';
  if (isClutterItem(name)) return 'small';
  return 'medium';
}

export function objectCategoryOf(name: string): MurdokuObjectCategory {
  const noun = lastNoun(name);
  const order: MurdokuObjectCategory[] = ['furniture', 'fixture', 'storage', 'decor', 'scene'];
  for (const category of order) {
    if (CATEGORY_NOUNS[category].includes(noun)) return category;
  }
  if (/\b(bookshelf|bookcase|sofa|couch|desk|table|chair|bed|bench|piano|easel|podium)\b/i.test(name)) {
    return 'furniture';
  }
  return 'scene';
}

export function catalogForKind(kind: MurdokuRoomKind): MurdokuRoomKindCatalog {
  return ROOM_KIND_CATALOGS.find((entry) => entry.kind === kind) ?? GENERIC_CATALOG;
}

export function classifyRoomKind(roomName: string, themeHint = ''): MurdokuRoomKind {
  for (const entry of ROOM_KIND_CATALOGS) {
    if (entry.kind === 'generic') continue;
    if (entry.match.test(roomName)) return entry.kind;
  }
  if (themeHint && /main hall|area|room|wing/i.test(roomName)) {
    for (const entry of ROOM_KIND_CATALOGS) {
      if (entry.kind === 'generic') continue;
      if (entry.match.test(themeHint)) return entry.kind;
    }
  }
  return 'generic';
}

export function excludedItemsForStyle(options?: MurdokuSceneStyleOptions): string[] {
  const style = normalizeSceneStyle(options);
  const excluded = style.avoidRandomProps ? [...RANDOM_CLUTTER_ITEMS] : [];
  return [...new Set(excluded.map((name) => titleCaseName(name)))];
}

function titleCaseName(name: string): string {
  return name
    .split(/\s+/)
    .map((part) => (part ? part[0].toUpperCase() + part.slice(1) : part))
    .join(' ');
}

export function allowedListsForRoom(
  roomName: string,
  options?: MurdokuSceneStyleOptions,
  themeHint = ''
): { kind: MurdokuRoomKind; furniture: string[]; decor: string[]; objects: string[]; excluded: string[] } {
  const style = normalizeSceneStyle(options);
  const kind = classifyRoomKind(roomName, themeHint);
  const catalog = catalogForKind(kind);
  const keep = (name: string) => itemPassesStyle(name, style);
  return {
    kind,
    furniture: catalog.furniture.filter(keep),
    decor: catalog.decor.filter(keep),
    objects: catalog.objects.filter(keep),
    excluded: excludedItemsForStyle(style),
  };
}

export function allAllowedNamesForRoom(
  roomName: string,
  options?: MurdokuSceneStyleOptions,
  themeHint = ''
): string[] {
  const lists = allowedListsForRoom(roomName, options, themeHint);
  return [...new Set([...lists.furniture, ...lists.decor, ...lists.objects])];
}

export function itemPassesStyle(name: string, options?: MurdokuSceneStyleOptions): boolean {
  const style = normalizeSceneStyle(options);
  if (style.avoidRandomProps && isClutterItem(name)) return false;
  if (style.useOnlyLargeFurniture && objectSizeOf(name) === 'small') return false;
  return style.allowedCategories.includes(objectCategoryOf(name));
}

function namesMatch(elementName: string, allowedName: string): boolean {
  const elementTokens = tokensOfName(elementName);
  const allowedTokens = tokensOfName(allowedName);
  if (!elementTokens.length || !allowedTokens.length) return false;
  if (elementTokens.join(' ') === allowedTokens.join(' ')) return true;
  const elementNoun = elementTokens[elementTokens.length - 1];
  const allowedNoun = allowedTokens[allowedTokens.length - 1];
  if (elementNoun !== allowedNoun) {
    if (elementNoun === 'bookshelf' && allowedNoun === 'shelf') return true;
    if (elementNoun === 'bookcase' && (allowedNoun === 'shelf' || allowedNoun === 'bookshelf')) return true;
    if (elementNoun === 'armchair' && allowedNoun === 'chair') return true;
    if (elementNoun === 'couch' && (allowedNoun === 'sofa' || allowedNoun === 'lounge')) return true;
    return false;
  }
  if (allowedTokens.length === 1 || elementTokens.length === 1) return true;
  return allowedTokens.every((token) => elementTokens.includes(token)) ||
    elementTokens.every((token) => allowedTokens.includes(token));
}

export function elementFitsRoom(
  elementName: string,
  room: Pick<MurdokuRoom, 'name' | 'allowedFurniture' | 'allowedDecor' | 'allowedObjects' | 'roomKind'>,
  options?: MurdokuSceneStyleOptions,
  themeHint = ''
): boolean {
  if (!itemPassesStyle(elementName, options)) return false;
  const allowed = [
    ...(room.allowedFurniture ?? []),
    ...(room.allowedDecor ?? []),
    ...(room.allowedObjects ?? []),
  ];
  const names = allowed.length
    ? allowed
    : allAllowedNamesForRoom(room.name, options, themeHint);
  return names.some((item) => namesMatch(elementName, item));
}

export function syncRoomCatalog(
  room: MurdokuRoom,
  themeHint = '',
  options?: MurdokuSceneStyleOptions
): MurdokuRoom {
  const lists = allowedListsForRoom(room.name, options, themeHint);
  return {
    ...room,
    roomKind: lists.kind,
    allowedFurniture: lists.furniture,
    allowedDecor: lists.decor,
    allowedObjects: lists.objects,
    excludedItems: lists.excluded,
  };
}

export function syncRoomsCatalog(
  rooms: MurdokuRoom[],
  themeHint = '',
  options?: MurdokuSceneStyleOptions
): MurdokuRoom[] {
  return rooms.map((room) => syncRoomCatalog(room, themeHint, options));
}

export function buildSharedElementPool(
  rooms: MurdokuRoom[],
  options?: MurdokuSceneStyleOptions,
  themeHint = '',
  maxCount = 12
): string[] {
  const style = normalizeSceneStyle(options);
  const annotated = syncRoomsCatalog(rooms, themeHint, style);
  const perRoom = annotated.map((room) => allAllowedNamesForRoom(room.name, style, themeHint));
  const counts = new Map<string, number>();
  for (const names of perRoom) {
    for (const name of new Set(names)) {
      counts.set(name, (counts.get(name) ?? 0) + 1);
    }
  }
  const distinctive: string[] = [];
  for (const names of perRoom) {
    const pick =
      names.find((name) => (counts.get(name) ?? 0) <= 2 && !distinctive.some((d) => namesMatch(d, name))) ??
      names.find((name) => !distinctive.some((d) => namesMatch(d, name)));
    if (pick) distinctive.push(pick);
  }
  const shared = [...counts.entries()]
    .filter(([, count]) => count >= 2)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([name]) => name);
  const sitOn = [...counts.keys()].filter((name) => isSitOnName(name));
  const merged: string[] = [];
  const add = (name: string) => {
    if (!itemPassesStyle(name, style)) return;
    if (merged.some((existing) => namesMatch(existing, name))) return;
    merged.push(name);
  };
  sitOn.slice(0, 4).forEach(add);
  distinctive.forEach(add);
  shared.forEach(add);
  return merged.slice(0, Math.max(6, maxCount));
}

export function elementDefsFromNames(names: string[]): MurdokuElementDef[] {
  return names.map((name, i) => ({
    id: `el-${i + 1}`,
    slotId: `E${String(i + 1).padStart(2, '0')}`,
    name,
    internalName: name.toLowerCase().replace(/\s+/g, '_'),
    description: '',
    quantity: isSitOnName(name) ? 3 : objectSizeOf(name) === 'large' ? 1 : 2,
    occupiesCell: true,
    canStandOn: isSitOnName(name),
    canBeBeside: true,
    blocksPlacement: false,
    widthCells: 1,
    heightCells: 1,
    rotation: 0,
    defaultScale: 1,
  }));
}

export function sanitizeElementNames(
  names: string[],
  rooms: MurdokuRoom[],
  options?: MurdokuSceneStyleOptions,
  themeHint = ''
): string[] {
  const style = normalizeSceneStyle(options);
  const annotated = syncRoomsCatalog(rooms, themeHint, style);
  const kept: string[] = [];
  for (const raw of names) {
    const name = String(raw || '').trim();
    if (!name || !itemPassesStyle(name, style)) continue;
    if (!annotated.some((room) => elementFitsRoom(name, room, style, themeHint))) continue;
    if (kept.some((existing) => namesMatch(existing, name))) continue;
    kept.push(titleCaseName(name));
  }
  const pool = buildSharedElementPool(annotated, style, themeHint);
  for (const name of pool) {
    if (kept.length >= 12) break;
    if (kept.some((existing) => namesMatch(existing, name))) continue;
    kept.push(name);
  }
  if (!kept.some((name) => isSitOnName(name))) {
    const sitOn = pool.find((name) => isSitOnName(name)) || 'Chair';
    if (itemPassesStyle(sitOn, style)) kept.unshift(sitOn);
  }
  return kept.slice(0, 12);
}

export function themeConsistencyScore(
  rooms: MurdokuRoom[],
  elements: Array<Pick<MurdokuElementDef, 'name'>>,
  options?: MurdokuSceneStyleOptions,
  themeHint = ''
): { score: number; label: string; notes: string[] } {
  const style = normalizeSceneStyle(options);
  const annotated = syncRoomsCatalog(rooms, themeHint, style);
  const notes: string[] = [];
  if (!annotated.length) return { score: 0, label: 'No rooms', notes: ['Add rooms first.'] };
  const clutter = elements.filter((el) => isClutterItem(el.name));
  if (clutter.length) {
    notes.push(`Random props to remove: ${clutter.map((el) => el.name).join(', ')}`);
  }
  let covered = 0;
  for (const room of annotated) {
    const matches = elements.filter((el) => elementFitsRoom(el.name, room, style, themeHint));
    if (matches.length) covered += 1;
    else notes.push(`${room.name} has no matching furniture yet.`);
  }
  const coverage = covered / annotated.length;
  const clutterPenalty = style.avoidRandomProps ? Math.min(40, clutter.length * 12) : 0;
  const sitOnBonus = elements.some((el) => isSitOnName(el.name)) ? 8 : 0;
  const score = Math.max(0, Math.min(100, Math.round(coverage * 78 + sitOnBonus + (clutter.length ? 0 : 14) - clutterPenalty)));
  const label =
    score >= 85 ? 'Strong theme match' : score >= 65 ? 'Good match' : score >= 40 ? 'Needs tighter props' : 'Off-theme';
  if (!notes.length) notes.push('Rooms and objects look consistent.');
  return { score, label, notes };
}

export function roomCatalogPromptBlock(
  rooms: MurdokuRoom[],
  options?: MurdokuSceneStyleOptions,
  themeHint = ''
): string {
  const style = normalizeSceneStyle(options);
  const annotated = syncRoomsCatalog(rooms, themeHint, style);
  const lines = annotated.map((room) => {
    const lists = allowedListsForRoom(room.name, style, themeHint);
    return [
      `- ${room.name} (${lists.kind}): furniture [${lists.furniture.join(', ') || 'none'}]; decor [${lists.decor.join(', ') || 'none'}]; objects [${lists.objects.join(', ') || 'none'}]`,
    ].join('');
  });
  return [
    'Match every room with furniture, decor, and inanimate objects that belong in that room.',
    'Use only room-relevant inanimate objects. Avoid random unrelated props and clutter.',
    'Avoid tiny handheld objects unless a room catalog explicitly lists them.',
    style.useOnlyLargeFurniture
      ? 'Prefer medium and large furniture, fixtures, and storage. Do not add small scattered items.'
      : 'Prefer furniture, decor, fixtures, storage, and large scene objects.',
    `Never include: ${excludedItemsForStyle(style).join(', ')}.`,
    'Room object pools:',
    ...lines,
  ].join('\n');
}
