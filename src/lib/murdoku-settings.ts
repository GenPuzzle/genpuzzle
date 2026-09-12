/**
 * Murdoku document settings — generation, layout, typography, artwork, and story.
 */

import type { SpriteSheetCropConfig } from './sprite-sheet-importer';
import type { BookCanvasSettings, PageFrameSettings } from './puzzles/types';
import { DEFAULT_PAGE_NUMBER_SETTINGS } from './puzzles/types';
import type {
  MurdokuCharacter,
  MurdokuDifficulty,
  MurdokuElementDef,
  MurdokuMurderRule,
  MurdokuRoom,
  MurdokuStory,
  MurdokuTheme,
} from './puzzles/murdoku';
import {
  defaultMixedSudokuLevelCounts,
  expandMixedSudokuDifficultyPlan,
} from './generic-puzzle-settings';
import {
  buildSharedElementPool,
  elementDefsFromNames,
  normalizeSceneStyle,
  syncRoomsCatalog,
} from './murdoku-room-catalog';

export type MurdokuDifficultyMode = MurdokuDifficulty | 'mixed';

export type MurdokuMixedLevelCounts = {
  easy: number;
  medium: number;
  hard: number;
};

export const defaultMixedMurdokuLevelCounts = defaultMixedSudokuLevelCounts;

export function expandMixedMurdokuDifficultyPlan(
  counts: MurdokuMixedLevelCounts
): Array<'easy' | 'medium' | 'hard'> {
  return expandMixedSudokuDifficultyPlan(counts);
}

export function resolveMurdokuGenerateDifficulty(
  difficulty: MurdokuDifficultyMode
): MurdokuDifficulty {
  return difficulty === 'mixed' ? 'medium' : difficulty;
}

function clampMixedCount(value: unknown, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  return Math.max(0, Math.min(100, Math.round(value)));
}

export function murdokuCountPatchForTotal(
  total: number,
  mixed: boolean
): Partial<MurdokuCoreSettings> {
  const n = Math.max(1, Math.min(100, Math.round(total)));
  if (!mixed) return { numberOfPuzzles: n };
  const counts = defaultMixedMurdokuLevelCounts(n);
  return {
    mixedEasyCount: counts.easy,
    mixedMediumCount: counts.medium,
    mixedHardCount: counts.hard,
    numberOfPuzzles: counts.easy + counts.medium + counts.hard,
  };
}

export const MURDOKU_THEME_PRESETS: MurdokuTheme[] = [
  { id: 'bookstore', name: 'Local Bookstore', location: 'Main Street bookstore', caseType: 'After-hours death', description: 'A quiet independent bookstore after closing time.' },
  { id: 'hotel', name: 'Hotel', location: 'Grand hotel', caseType: 'Guest-floor mystery', description: 'A boutique hotel during a stormy night.' },
  { id: 'airport', name: 'Airport', location: 'Regional airport', caseType: 'Delayed-flight mystery', description: 'A fog-bound terminal with nowhere to go.' },
  { id: 'museum', name: 'Museum', location: 'City museum', caseType: 'After-hours exhibit', description: 'Galleries locked after the last tour.' },
  { id: 'restaurant', name: 'Restaurant', location: 'Downtown restaurant', caseType: 'Kitchen closing', description: 'A restaurant after the last seating.' },
  { id: 'hospital', name: 'Hospital', location: 'Night-shift ward', caseType: 'Overnight incident', description: 'A quiet hospital wing after visiting hours.' },
  { id: 'mansion', name: 'Mansion', location: 'Hilltop mansion', caseType: 'Dinner-party mystery', description: 'A private estate during a gathering.' },
  { id: 'library', name: 'Library', location: 'Public library', caseType: 'Closing-time mystery', description: 'Stacks and reading rooms after closing.' },
  { id: 'theater', name: 'Theater', location: 'Community theater', caseType: 'Backstage mystery', description: 'Dressing rooms and wings after curtain.' },
  { id: 'train-station', name: 'Train Station', location: 'Central station', caseType: 'Last-train mystery', description: 'A nearly empty station at midnight.' },
  { id: 'mall', name: 'Shopping Mall', location: 'Westside mall', caseType: 'Lock-in mystery', description: 'Stores shuttered after mall closing.' },
  { id: 'office', name: 'Office', location: 'Downtown office', caseType: 'Overtime mystery', description: 'An office floor after hours.' },
  { id: 'school', name: 'School', location: 'Academy building', caseType: 'After-class mystery', description: 'Hallways and classrooms after dismissal.' },
  { id: 'cruise', name: 'Cruise Ship', location: 'Ocean liner', caseType: 'At-sea mystery', description: 'Decks and lounges during a crossing.' },
];

const DEFAULT_PEOPLE: Array<{ name: string; gender: 'female' | 'male' | 'neutral' }> = [
  { name: 'Aria', gender: 'female' },
  { name: 'Bruce', gender: 'male' },
  { name: 'Calvin', gender: 'male' },
  { name: 'Don', gender: 'male' },
  { name: 'Everly', gender: 'female' },
  { name: 'Henry', gender: 'male' },
  { name: 'Ivy', gender: 'female' },
  { name: 'Jules', gender: 'neutral' },
  { name: 'Kai', gender: 'neutral' },
];
const DEFAULT_JOBS = [
  'Owner', 'Clerk', 'Author', 'Security', 'Barista', 'Customer', 'Manager', 'Janitor', 'Courier',
];

const THEME_ROOMS: Record<string, string[]> = {
  bookstore: ['Best Sellers', 'Cafe', 'Kids Corner', 'Rare Books', 'Office', 'Stockroom', 'Poetry Nook', 'Registers', 'Reading Room'],
  hotel: ['Lobby', 'Bar', 'Suite 12', 'Kitchen', 'Pool', 'Gym', 'Office', 'Laundry', 'Garden'],
  airport: ['Gate A', 'Security', 'Lounge', 'Baggage', 'Cafe', 'Shop', 'Office', 'Runway View', 'Restrooms'],
  museum: ['Lobby', 'Modern Wing', 'Archive', 'Cafe', 'Gift Shop', 'Sculpture Hall', 'Office', 'Storage', 'Garden'],
  restaurant: ['Dining Room', 'Kitchen', 'Bar', 'Patio', 'Office', 'Wine Cellar', 'Coat Check', 'Restroom Hall', 'Storage'],
  hospital: ['Lobby', 'Ward A', 'Ward B', 'Pharmacy', 'Cafeteria', 'Office', 'Lab', 'Garden', 'Records'],
  mansion: ['Foyer', 'Library', 'Dining Hall', 'Kitchen', 'Study', 'Conservatory', 'Bedroom', 'Garden', 'Attic'],
  library: ['Main Hall', 'Reference', 'Kids Room', 'Archives', 'Cafe', 'Office', 'Computers', 'Stacks', 'Garden'],
  theater: ['Lobby', 'Stage', 'Wings', 'Dressing A', 'Dressing B', 'Props', 'Box Office', 'Balcony', 'Green Room'],
  'train-station': ['Concourse', 'Platform 1', 'Platform 2', 'Ticket Hall', 'Cafe', 'Office', 'Lost & Found', 'Newsstand', 'Waiting Room'],
  mall: ['Atrium', 'Food Court', 'Bookstore', 'Fashion', 'Electronics', 'Security', 'Office', 'Parking', 'Fountain'],
  office: ['Reception', 'Open Desk', 'Boardroom', 'Kitchen', 'IT Closet', 'HR', 'Copy Room', 'Roof Garden', 'Archives'],
  school: ['Hallway', 'Classroom A', 'Classroom B', 'Library', 'Cafeteria', 'Office', 'Gym', 'Lab', 'Playground'],
  cruise: ['Deck', 'Dining', 'Theater', 'Pool', 'Bridge', 'Cabin Hall', 'Spa', 'Casino', 'Kitchen'],
};

interface ThemeElementSpec {
  name: string;
  quantity?: number;
  standOn?: boolean;
}

const THEME_ELEMENTS: Record<string, ThemeElementSpec[]> = {
  bookstore: [
    { name: 'Chair', quantity: 3, standOn: true },
    { name: 'Table', quantity: 2 },
    { name: 'Sofa', quantity: 1, standOn: true },
    { name: 'Carpet', quantity: 2, standOn: true },
    { name: 'Plant', quantity: 2 },
    { name: 'Box', quantity: 2 },
    { name: 'Bookshelf', quantity: 2 },
    { name: 'Bench', quantity: 1, standOn: true },
    { name: 'Lamp', quantity: 1 },
    { name: 'Cart', quantity: 1 },
  ],
  hotel: [
    { name: 'Chair', quantity: 2, standOn: true },
    { name: 'Sofa', quantity: 2, standOn: true },
    { name: 'Bed', quantity: 2, standOn: true },
    { name: 'Table', quantity: 1 },
    { name: 'Carpet', quantity: 2, standOn: true },
    { name: 'Plant', quantity: 2 },
    { name: 'Box', quantity: 1 },
    { name: 'Desk', quantity: 1 },
    { name: 'Lamp', quantity: 1 },
    { name: 'Cart', quantity: 1 },
  ],
  airport: [
    { name: 'Bench', quantity: 3, standOn: true },
    { name: 'Chair', quantity: 2, standOn: true },
    { name: 'Plant', quantity: 2 },
    { name: 'Cart', quantity: 2 },
    { name: 'Bag', quantity: 2 },
    { name: 'Box', quantity: 1 },
    { name: 'Counter', quantity: 1 },
    { name: 'Kiosk', quantity: 1 },
    { name: 'Sign', quantity: 1 },
  ],
  museum: [
    { name: 'Bench', quantity: 2, standOn: true },
    { name: 'Chair', quantity: 1, standOn: true },
    { name: 'Carpet', quantity: 1, standOn: true },
    { name: 'Plant', quantity: 2 },
    { name: 'Box', quantity: 1 },
    { name: 'Pedestal', quantity: 1 },
    { name: 'Statue', quantity: 1 },
    { name: 'Case', quantity: 1 },
    { name: 'Desk', quantity: 1 },
    { name: 'Plaque', quantity: 1 },
  ],
  restaurant: [
    { name: 'Chair', quantity: 3, standOn: true },
    { name: 'Table', quantity: 2 },
    { name: 'Sofa', quantity: 1, standOn: true },
    { name: 'Carpet', quantity: 1, standOn: true },
    { name: 'Plant', quantity: 2 },
    { name: 'Box', quantity: 1 },
    { name: 'Counter', quantity: 1 },
    { name: 'Lamp', quantity: 1 },
    { name: 'Bar', quantity: 1 },
  ],
  hospital: [
    { name: 'Bed', quantity: 2, standOn: true },
    { name: 'Chair', quantity: 3, standOn: true },
    { name: 'Bench', quantity: 1, standOn: true },
    { name: 'Desk', quantity: 1 },
    { name: 'Cart', quantity: 2 },
    { name: 'Plant', quantity: 1 },
    { name: 'Box', quantity: 1 },
    { name: 'Cabinet', quantity: 1 },
  ],
  mansion: [
    { name: 'Chair', quantity: 3, standOn: true },
    { name: 'Table', quantity: 2 },
    { name: 'Sofa', quantity: 2, standOn: true },
    { name: 'Carpet', quantity: 2, standOn: true },
    { name: 'Plant', quantity: 2 },
    { name: 'Shrub', quantity: 2 },
    { name: 'Tree', quantity: 1 },
    { name: 'Box', quantity: 2 },
    { name: 'Bed', quantity: 1, standOn: true },
    { name: 'Ladder', quantity: 1 },
    { name: 'Lamp', quantity: 1 },
  ],
  library: [
    { name: 'Chair', quantity: 3, standOn: true },
    { name: 'Table', quantity: 2 },
    { name: 'Desk', quantity: 1 },
    { name: 'Carpet', quantity: 2, standOn: true },
    { name: 'Plant', quantity: 2 },
    { name: 'Box', quantity: 1 },
    { name: 'Bookshelf', quantity: 2 },
    { name: 'Bench', quantity: 1, standOn: true },
    { name: 'Lamp', quantity: 1 },
  ],
  theater: [
    { name: 'Chair', quantity: 3, standOn: true },
    { name: 'Sofa', quantity: 1, standOn: true },
    { name: 'Carpet', quantity: 1, standOn: true },
    { name: 'Trunk', quantity: 1 },
    { name: 'Box', quantity: 2 },
    { name: 'Ladder', quantity: 1 },
    { name: 'Plant', quantity: 1 },
    { name: 'Mirror', quantity: 1 },
    { name: 'Lamp', quantity: 1 },
  ],
  'train-station': [
    { name: 'Bench', quantity: 3, standOn: true },
    { name: 'Chair', quantity: 2, standOn: true },
    { name: 'Plant', quantity: 2 },
    { name: 'Box', quantity: 1 },
    { name: 'Cart', quantity: 1 },
    { name: 'Kiosk', quantity: 1 },
    { name: 'Locker', quantity: 1 },
    { name: 'Clock', quantity: 1 },
  ],
  mall: [
    { name: 'Bench', quantity: 2, standOn: true },
    { name: 'Chair', quantity: 2, standOn: true },
    { name: 'Table', quantity: 2 },
    { name: 'Plant', quantity: 3 },
    { name: 'Carpet', quantity: 1, standOn: true },
    { name: 'Box', quantity: 1 },
    { name: 'Kiosk', quantity: 1 },
    { name: 'Cart', quantity: 1 },
  ],
  office: [
    { name: 'Chair', quantity: 3, standOn: true },
    { name: 'Desk', quantity: 2 },
    { name: 'Sofa', quantity: 1, standOn: true },
    { name: 'Carpet', quantity: 1, standOn: true },
    { name: 'Plant', quantity: 2 },
    { name: 'Box', quantity: 2 },
    { name: 'Cabinet', quantity: 1 },
    { name: 'Lamp', quantity: 1 },
  ],
  school: [
    { name: 'Chair', quantity: 3, standOn: true },
    { name: 'Desk', quantity: 2 },
    { name: 'Table', quantity: 1 },
    { name: 'Bench', quantity: 1, standOn: true },
    { name: 'Plant', quantity: 2 },
    { name: 'Tree', quantity: 1 },
    { name: 'Box', quantity: 1 },
    { name: 'Bookshelf', quantity: 1 },
    { name: 'Locker', quantity: 1 },
  ],
  cruise: [
    { name: 'Chair', quantity: 3, standOn: true },
    { name: 'Table', quantity: 2 },
    { name: 'Sofa', quantity: 1, standOn: true },
    { name: 'Plant', quantity: 2 },
    { name: 'Box', quantity: 1 },
    { name: 'Bar', quantity: 1 },
    { name: 'Lamp', quantity: 1 },
    { name: 'Lifebuoy', quantity: 1 },
    { name: 'Lounge', quantity: 1, standOn: true },
  ],
};

function isStandOnPropName(name: string): boolean {
  return /\b(chair|armchair|sofa|couch|bench|bed|carpet|rug|lounge)\b/i.test(name);
}

const ROOM_COLORS = [
  '#fde68a', '#bfdbfe', '#bbf7d0', '#fecaca', '#e9d5ff', '#fed7aa', '#c7d2fe', '#fbcfe8', '#d9f99d',
];

export type MurdokuArtStyle =
  | 'flat-vector'
  | 'cozy-cartoon'
  | 'comic'
  | 'retro'
  | 'modern'
  | 'vintage'
  | 'realistic'
  | 'black-white'
  | 'coloring-book'
  | 'custom';

export type MurdokuTextAlign = 'left' | 'center' | 'right';

export interface MurdokuTextStyle {
  fontFamily: string;
  fontSize: number;
  minFontSize: number;
  bold: boolean;
  italic: boolean;
  underline: boolean;
  color: string;
  align: MurdokuTextAlign;
  lineHeight: number;
  letterSpacing: number;
  paragraphSpacing: number;
  widthPercent: number;
  heightPercent: number;
  xPercent: number;
  yPercent: number;
  autoFit: boolean;
  padding: number;
  background: string;
  borderColor: string;
  borderWidth: number;
  borderRadius: number;
  visible: boolean;
}

export type MurdokuTextKey =
  | 'title'
  | 'puzzleNumber'
  | 'subtitle'
  | 'intro'
  | 'instructions'
  | 'characterName'
  | 'characterClue'
  | 'victimCard'
  | 'roomLabel'
  | 'objectLabel'
  | 'hint'
  | 'solution'
  | 'pageNumber'
  | 'solutionRef';

export interface MurdokuLayoutBox {
  visible: boolean;
  locked: boolean;
  xPercent: number;
  yPercent: number;
  widthPercent: number;
  heightPercent: number;
}

export interface MurdokuGridVisual {
  xPercent: number;
  yPercent: number;
  widthPercent: number;
  heightPercent: number;
  cellSize: number;
  autoCellSize: boolean;
  lineThickness: number;
  outerBorderThickness: number;
  roomBorderThickness: number;
  lineStyle: 'solid' | 'dashed' | 'dotted';
  padding: number;
  showCoordinates: boolean;
  showRoomLabels: boolean;
  showRoomBackground: boolean;
  roomBackgroundOpacity: number;
  roomLabelPosition: 'center' | 'top' | 'bottom';
  objectSize: number;
  characterMarkerSize: number;
  snapObjectsToCells: boolean;
  snapRoomBorders: boolean;
  autoFitToMargins: boolean;
  locked: boolean;
}

export interface MurdokuCharacterCardVisual {
  cardWidth: number;
  cardHeight: number;
  portraitWidth: number;
  portraitHeight: number;
  columns: number;
  rows: number;
  autoLayout: boolean;
  spacing: number;
  padding: number;
  borderWidth: number;
  borderRadius: number;
  borderColor: string;
  background: string;
  imageBorderWidth: number;
  imageShape: 'square' | 'rounded' | 'circle';
  shadow: boolean;
}

export interface MurdokuDeductionGridVisual {
  visible: boolean;
  xPercent: number;
  yPercent: number;
  widthPercent: number;
  heightPercent: number;
  rows: number;
  cols: number;
  cellSize: number;
  borderThickness: number;
  showLabels: boolean;
  background: string;
  opacity: number;
}

export interface MurdokuReferenceSheetSettings {
  rows: number;
  columns: number;
  canvasWidth: number;
  canvasHeight: number;
  cellWidth: number;
  cellHeight: number;
  labelFont: string;
  labelFontSize: number;
  slotIdFontSize: number;
  borderThickness: number;
  padding: number;
  whiteBackground: boolean;
  includeDescriptions: boolean;
  includeSlotIds: boolean;
}

export interface MurdokuAssetPack {
  id: string;
  name: string;
  themeId: string;
  characterImages: Record<string, string>;
  elementImages: Record<string, string>;
}

export interface MurdokuArtworkSettings {
  artStyle: MurdokuArtStyle;
  customStyle: string;
  promptSuffix: string;
  characterPrompt: string;
  elementPrompt: string;
  roomPrompt: string;
  characterSheetSrc?: string;
  elementSheetSrc?: string;
  roomSheetSrc?: string;
  characterStatus: 'names-ready' | 'sheet-ready' | 'awaiting-art' | 'imported';
  elementStatus: 'list-ready' | 'sheet-ready' | 'awaiting-art' | 'imported';
  roomStatus: 'names-ready' | 'sheet-ready' | 'awaiting-art' | 'imported';
  characterSheet: MurdokuReferenceSheetSettings;
  elementSheet: MurdokuReferenceSheetSettings;
  roomSheet: MurdokuReferenceSheetSettings;
  characterCrop?: SpriteSheetCropConfig;
  elementCrop?: SpriteSheetCropConfig;
  roomCrop?: SpriteSheetCropConfig;
}

export interface MurdokuCoreSettings {
  numberOfPuzzles: number;
  puzzlesStartingNumber: number;
  rows: number;
  cols: number;
  difficulty: MurdokuDifficultyMode;
  /** Editable counts when difficulty === 'mixed' (easy → hard, same split as Sudoku). */
  mixedEasyCount: number;
  mixedMediumCount: number;
  mixedHardCount: number;
  customClueCount: number;
  murderRule: MurdokuMurderRule;
  useSimpleLogicWording: boolean;
  useAiClueWording: boolean;
  autoBalanceFont: boolean;
  showSolution: boolean;
  showDeductionGrid: boolean;
  solutionStyle: 'simple' | 'detailed' | 'ai-narrative';
  sameThemeForAll: boolean;
  rotateThemes: boolean;
  progressiveDifficulty: boolean;
  /** Split each puzzle across two pages: characters/clues, then a larger crime-scene grid. */
  twoPagePuzzles: boolean;
  /** Drop phones, cups, laptops, and other random handheld clutter. Default on. */
  avoidRandomProps: boolean;
  /** Prefer medium/large furniture, fixtures, and storage over small scatter. */
  useOnlyLargeFurniture: boolean;
}

export interface MurdokuSettings {
  bookCanvas: BookCanvasSettings;
  core: MurdokuCoreSettings;
  theme: MurdokuTheme;
  story: MurdokuStory;
  characters: MurdokuCharacter[];
  rooms: MurdokuRoom[];
  elements: MurdokuElementDef[];
  grid: MurdokuGridVisual;
  cards: MurdokuCharacterCardVisual;
  deductionGrid: MurdokuDeductionGridVisual;
  layout: Record<string, MurdokuLayoutBox>;
  textStyles: Record<MurdokuTextKey, MurdokuTextStyle>;
  artwork: MurdokuArtworkSettings;
  assetPacks: MurdokuAssetPack[];
  savedThemes: MurdokuTheme[];
  pageFrameSettings?: PageFrameSettings;
  applyTextToAll: boolean;
}

function textStyle(
  partial: Partial<MurdokuTextStyle> & Pick<MurdokuTextStyle, 'fontSize' | 'xPercent' | 'yPercent' | 'widthPercent' | 'heightPercent'>
): MurdokuTextStyle {
  return {
    fontFamily: 'Arial',
    minFontSize: 18,
    bold: false,
    italic: false,
    underline: false,
    color: '#1f2937',
    align: 'left',
    lineHeight: 1.25,
    letterSpacing: 0,
    paragraphSpacing: 4,
    autoFit: true,
    padding: 4,
    background: 'transparent',
    borderColor: 'transparent',
    borderWidth: 0,
    borderRadius: 0,
    visible: true,
    ...partial,
  };
}

function layoutBox(
  x: number,
  y: number,
  w: number,
  h: number,
  visible = true
): MurdokuLayoutBox {
  return { visible, locked: false, xPercent: x, yPercent: y, widthPercent: w, heightPercent: h };
}

export function slotId(prefix: 'C' | 'E' | 'R', index: number): string {
  return `${prefix}${String(index + 1).padStart(2, '0')}`;
}

export function defaultMurdokuCharacters(count = 9): MurdokuCharacter[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `char-${i + 1}`,
    slotId: slotId('C', i),
    name: DEFAULT_PEOPLE[i]?.name ?? `Suspect ${i + 1}`,
    enabled: true,
    gender: DEFAULT_PEOPLE[i]?.gender,
    occupation: DEFAULT_JOBS[i] ?? 'Guest',
    description: '',
    clothingNotes: '',
    clueText: '',
    isVictim: i === 0,
    isMurderer: false,
  }));
}

export function defaultMurdokuRooms(themeId: string, themeName = ''): MurdokuRoom[] {
  const names = THEME_ROOMS[themeId] ?? THEME_ROOMS.bookstore;
  const hint = themeName || themeId;
  return syncRoomsCatalog(
    names.map((name, i) => ({
      id: `room-${i + 1}`,
      slotId: slotId('R', i),
      name,
      color: ROOM_COLORS[i % ROOM_COLORS.length],
      labelVisible: true,
      description: '',
    })),
    hint
  );
}

export function defaultMurdokuElements(themeId: string, rooms?: MurdokuRoom[]): MurdokuElementDef[] {
  const roomList = rooms?.length ? rooms : defaultMurdokuRooms(themeId);
  const pool = buildSharedElementPool(roomList, { avoidRandomProps: true }, themeId, 12);
  if (pool.length >= 6) return elementDefsFromNames(pool);
  const specs = THEME_ELEMENTS[themeId] ?? THEME_ELEMENTS.bookstore;
  return specs.map((spec, i) => {
    const name = spec.name;
    return {
      id: `el-${i + 1}`,
      slotId: slotId('E', i),
      name,
      internalName: name.toLowerCase().replace(/\s+/g, '_'),
      description: '',
      quantity: spec.quantity ?? 1,
      occupiesCell: true,
      canStandOn: spec.standOn ?? isStandOnPropName(name),
      canBeBeside: true,
      blocksPlacement: false,
      widthCells: 1,
      heightCells: 1,
      rotation: 0,
      defaultScale: 1,
    };
  });
}

export function applyThemePreset(theme: MurdokuTheme): Pick<MurdokuSettings, 'theme' | 'rooms' | 'elements' | 'story'> {
  const rooms = defaultMurdokuRooms(theme.id, theme.name);
  return {
    theme,
    rooms,
    elements: defaultMurdokuElements(theme.id, rooms),
    story: {
      caseTitle: `The ${theme.name} Case`,
      intro: '',
      crimeDescription: '',
      victimName: '',
      victimDescription: '',
      crimeLocation: theme.location,
      whatHappened: '',
      timeOfIncident: 'After closing time',
      background: theme.description,
      instruction:
        'Use the clues to determine where each character was located. Each character can appear only once in every row and column. Identify the person who was alone in the same area as the victim.',
      flavorText: '',
      solutionExplanation: '',
      source: 'empty',
    },
  };
}

/** Compact sprite-sheet grid for N labeled boxes (6 → 2×3, 7 → 3×3 with two gaps). */
export function autoSheetLayout(count: number): { rows: number; columns: number } {
  const n = Math.max(1, Math.floor(Number(count)) || 1);
  let exact: { rows: number; columns: number } | null = null;
  let exactScore = Infinity;
  for (let columns = 1; columns <= n; columns++) {
    if (n % columns !== 0) continue;
    const rows = n / columns;
    const ratio = Math.max(rows, columns) / Math.min(rows, columns);
    if (ratio > 3) continue;
    const score = Math.abs(rows - columns) + (columns < rows ? 0.15 : 0);
    if (score < exactScore) {
      exactScore = score;
      exact = { rows, columns };
    }
  }
  if (exact) return exact;
  const columns = Math.ceil(Math.sqrt(n));
  return { rows: Math.ceil(n / columns), columns };
}

function defaultSheet(count: number): MurdokuReferenceSheetSettings {
  const { rows, columns } = autoSheetLayout(count);
  const size = 1800;
  const cell = Math.max(1, Math.floor(size / Math.max(rows, columns)));
  return {
    rows,
    columns,
    canvasWidth: columns * cell,
    canvasHeight: rows * cell,
    cellWidth: cell,
    cellHeight: cell,
    labelFont: 'Arial',
    labelFontSize: 28,
    slotIdFontSize: 22,
    borderThickness: 4,
    padding: 16,
    whiteBackground: true,
    includeDescriptions: true,
    includeSlotIds: true,
  };
}

export function getDefaultMurdokuSettings(): MurdokuSettings {
  const theme = MURDOKU_THEME_PRESETS[0];
  const themed = applyThemePreset(theme);
  return {
    bookCanvas: {
      includeBleed: false,
      useCustomTrim: false,
      customWidth: 8.5,
      customHeight: 11,
      trimSizePreset: '8_5X11IN',
      measurementUnits: 'INCHES',
      puzzleType: 'murdoku',
      answersPerPage: 1,
      includePageBetweenPuzzleAndSolutions: false,
    },
    core: {
      numberOfPuzzles: 1,
      puzzlesStartingNumber: 1,
      rows: 9,
      cols: 9,
      difficulty: 'medium',
      mixedEasyCount: 2,
      mixedMediumCount: 3,
      mixedHardCount: 5,
      customClueCount: 12,
      murderRule: 'alone-with-victim',
      useSimpleLogicWording: true,
      useAiClueWording: false,
      autoBalanceFont: false,
      showSolution: false,
      showDeductionGrid: true,
      solutionStyle: 'simple',
      sameThemeForAll: true,
      rotateThemes: false,
      progressiveDifficulty: false,
      twoPagePuzzles: true,
      avoidRandomProps: true,
      useOnlyLargeFurniture: false,
    },
    theme: themed.theme,
    story: themed.story,
    characters: defaultMurdokuCharacters(9),
    rooms: themed.rooms,
    elements: themed.elements,
    grid: {
      xPercent: 4,
      yPercent: 34,
      widthPercent: 54,
      heightPercent: 42,
      cellSize: 28,
      autoCellSize: true,
      lineThickness: 0.5,
      outerBorderThickness: 7,
      roomBorderThickness: 7,
      lineStyle: 'solid',
      padding: 4,
      showCoordinates: true,
      showRoomLabels: true,
      showRoomBackground: true,
      roomBackgroundOpacity: 35,
      roomLabelPosition: 'bottom',
      objectSize: 78,
      characterMarkerSize: 86,
      snapObjectsToCells: true,
      snapRoomBorders: true,
      autoFitToMargins: true,
      locked: false,
    },
    cards: {
      cardWidth: 96,
      cardHeight: 158,
      portraitWidth: 68,
      portraitHeight: 68,
      columns: 9,
      rows: 1,
      autoLayout: true,
      spacing: 8,
      padding: 6,
      borderWidth: 1,
      borderRadius: 8,
      borderColor: '#cbd5e1',
      background: '#ffffff',
      imageBorderWidth: 1,
      imageShape: 'rounded',
      shadow: true,
    },
    deductionGrid: {
      visible: true,
      xPercent: 62,
      yPercent: 70,
      widthPercent: 34,
      heightPercent: 18,
      rows: 9,
      cols: 9,
      cellSize: 14,
      borderThickness: 1,
      showLabels: true,
      background: '#ffffff',
      opacity: 100,
    },
    layout: {
      title: layoutBox(4, 3, 92, 5),
      story: layoutBox(4, 8.5, 92, 8),
      instructions: layoutBox(4, 17, 92, 5),
      characters: layoutBox(4, 22.5, 92, 11),
      grid: layoutBox(4, 34, 54, 42),
      clues: layoutBox(60, 34, 36, 34),
      victim: layoutBox(60, 22.5, 36, 10),
      deduction: layoutBox(62, 70, 34, 18),
      murdererLine: layoutBox(4, 78, 54, 5),
      legend: layoutBox(4, 84, 92, 4),
      solutionRef: layoutBox(4, 89, 92, 3),
    },
    textStyles: {
      title: textStyle({ fontSize: 22, bold: true, align: 'center', xPercent: 4, yPercent: 3, widthPercent: 92, heightPercent: 5 }),
      puzzleNumber: textStyle({ fontSize: 12, align: 'right', xPercent: 70, yPercent: 3, widthPercent: 26, heightPercent: 4, color: '#64748b' }),
      subtitle: textStyle({ fontSize: 13, italic: true, align: 'center', xPercent: 4, yPercent: 7, widthPercent: 92, heightPercent: 3, color: '#475569' }),
      intro: textStyle({ fontSize: 11, xPercent: 4, yPercent: 8.5, widthPercent: 92, heightPercent: 8, minFontSize: 10 }),
      instructions: textStyle({ fontSize: 11, italic: true, xPercent: 4, yPercent: 17, widthPercent: 92, heightPercent: 5, minFontSize: 10 }),
      characterName: textStyle({ fontSize: 10, bold: true, align: 'center', xPercent: 0, yPercent: 0, widthPercent: 10, heightPercent: 3, minFontSize: 9 }),
      characterClue: textStyle({ fontSize: 9, xPercent: 0, yPercent: 0, widthPercent: 10, heightPercent: 4, minFontSize: 8 }),
      victimCard: textStyle({ fontSize: 11, bold: true, xPercent: 60, yPercent: 22.5, widthPercent: 36, heightPercent: 10 }),
      roomLabel: textStyle({
        fontSize: 18,
        bold: true,
        italic: false,
        align: 'center',
        xPercent: 0,
        yPercent: 0,
        widthPercent: 8,
        heightPercent: 3,
        minFontSize: 10,
        fontFamily: 'Georgia, Times New Roman, serif',
        color: '#111827',
        background: '#ffffff',
        borderColor: '#111827',
        borderWidth: 2,
        borderRadius: 10,
        padding: 5,
      }),
      objectLabel: textStyle({ fontSize: 8, align: 'center', xPercent: 0, yPercent: 0, widthPercent: 8, heightPercent: 2, minFontSize: 7 }),
      hint: textStyle({ fontSize: 10, xPercent: 4, yPercent: 84, widthPercent: 92, heightPercent: 4, visible: false }),
      solution: textStyle({ fontSize: 12, xPercent: 4, yPercent: 70, widthPercent: 92, heightPercent: 20 }),
      pageNumber: textStyle({
        fontSize: DEFAULT_PAGE_NUMBER_SETTINGS.fontSize,
        align: 'center',
        xPercent: 40,
        yPercent: 94,
        widthPercent: 20,
        heightPercent: 4,
      }),
      solutionRef: textStyle({ fontSize: 10, italic: true, align: 'center', xPercent: 4, yPercent: 89, widthPercent: 92, heightPercent: 3, color: '#64748b' }),
    },
    artwork: {
      artStyle: 'cozy-cartoon',
      customStyle: '',
      promptSuffix: '',
      characterPrompt: '',
      elementPrompt: '',
      roomPrompt: '',
      characterStatus: 'names-ready',
      elementStatus: 'list-ready',
      roomStatus: 'names-ready',
      characterSheet: defaultSheet(9),
      elementSheet: defaultSheet(themed.elements.length),
      roomSheet: defaultSheet(themed.rooms.length),
    },
    assetPacks: [],
    savedThemes: [],
    applyTextToAll: false,
  };
}

export function normalizeMurdokuSettings(raw?: Partial<MurdokuSettings> | null): MurdokuSettings {
  const d = getDefaultMurdokuSettings();
  if (!raw) return d;
  const core: MurdokuCoreSettings = { ...d.core, ...raw.core };
  const validDifficulty: MurdokuDifficultyMode[] = [
    'easy',
    'medium',
    'hard',
    'expert',
    'custom',
    'mixed',
  ];
  if (!validDifficulty.includes(core.difficulty)) core.difficulty = 'medium';
  const mixedDefaults = defaultMixedMurdokuLevelCounts(Math.max(1, core.numberOfPuzzles || 1));
  core.mixedEasyCount = clampMixedCount(core.mixedEasyCount, mixedDefaults.easy);
  core.mixedMediumCount = clampMixedCount(core.mixedMediumCount, mixedDefaults.medium);
  core.mixedHardCount = clampMixedCount(core.mixedHardCount, mixedDefaults.hard);
  if (core.difficulty === 'mixed') {
    const sum = core.mixedEasyCount + core.mixedMediumCount + core.mixedHardCount;
    if (sum <= 0) {
      core.mixedEasyCount = mixedDefaults.easy;
      core.mixedMediumCount = mixedDefaults.medium;
      core.mixedHardCount = mixedDefaults.hard;
      core.numberOfPuzzles = mixedDefaults.easy + mixedDefaults.medium + mixedDefaults.hard;
    } else {
      core.numberOfPuzzles = sum;
    }
  }
  core.avoidRandomProps = raw.core?.avoidRandomProps !== false;
  core.useOnlyLargeFurniture = raw.core?.useOnlyLargeFurniture === true;
  const themeName = raw.theme?.name || d.theme.name;
  const sceneStyle = normalizeSceneStyle({
    avoidRandomProps: core.avoidRandomProps,
    useOnlyLargeFurniture: core.useOnlyLargeFurniture,
  });
  const rooms = syncRoomsCatalog(
    (raw.rooms?.length ? raw.rooms : d.rooms).map((room, i) => ({
      ...room,
      slotId: room.slotId || slotId('R', i),
      labelVisible: room.labelVisible !== false,
    })),
    themeName,
    sceneStyle
  );
  return {
    ...d,
    ...raw,
    bookCanvas: { ...d.bookCanvas, ...raw.bookCanvas, puzzleType: 'murdoku' },
    core,
    theme: { ...d.theme, ...raw.theme },
    story: { ...d.story, ...raw.story },
    characters: raw.characters?.length ? raw.characters : d.characters,
    rooms,
    elements: raw.elements?.length ? raw.elements : d.elements,
    grid: {
      ...d.grid,
      ...raw.grid,
      roomBorderThickness:
        raw.grid?.roomBorderThickness === 2 || raw.grid?.roomBorderThickness === 3.5 || raw.grid?.roomBorderThickness == null
          ? d.grid.roomBorderThickness
          : raw.grid.roomBorderThickness,
      outerBorderThickness:
        raw.grid?.outerBorderThickness === 2.5 || raw.grid?.outerBorderThickness == null
          ? d.grid.outerBorderThickness
          : raw.grid.outerBorderThickness,
      lineThickness:
        raw.grid?.lineThickness == null || raw.grid.lineThickness === 1
          ? d.grid.lineThickness
          : raw.grid.lineThickness,
      roomLabelPosition:
        !raw.grid?.roomLabelPosition || raw.grid.roomLabelPosition === 'center'
          ? d.grid.roomLabelPosition
          : raw.grid.roomLabelPosition,
      showCoordinates: true,
      showRoomLabels: true,
      showRoomBackground: true,
      snapObjectsToCells: true,
      snapRoomBorders: true,
      autoFitToMargins: true,
    },
    cards: { ...d.cards, ...raw.cards },
    deductionGrid: { ...d.deductionGrid, ...raw.deductionGrid },
    layout: { ...d.layout, ...raw.layout },
    textStyles: {
      ...d.textStyles,
      ...(raw.textStyles as MurdokuSettings['textStyles']),
      roomLabel: {
        ...d.textStyles.roomLabel,
        ...raw.textStyles?.roomLabel,
        ...(raw.textStyles?.roomLabel?.fontSize === 8 && !raw.textStyles?.roomLabel?.borderWidth
          ? d.textStyles.roomLabel
          : {}),
      },
    },
    artwork: {
      ...d.artwork,
      ...raw.artwork,
      characterSheet: { ...d.artwork.characterSheet, ...raw.artwork?.characterSheet },
      elementSheet: { ...d.artwork.elementSheet, ...raw.artwork?.elementSheet },
      roomSheet: { ...d.artwork.roomSheet, ...raw.artwork?.roomSheet },
    },
    assetPacks: raw.assetPacks ?? d.assetPacks,
    savedThemes: raw.savedThemes ?? d.savedThemes,
    pageFrameSettings: raw.pageFrameSettings ?? d.pageFrameSettings,
  };
}

export function randomMurdokuTheme(): MurdokuTheme {
  return MURDOKU_THEME_PRESETS[Math.floor(Math.random() * MURDOKU_THEME_PRESETS.length)];
}

export function murdokuLinesForCount(text: string | undefined, count: number): string[] {
  const lines = (text || '').split(/\r?\n/);
  return Array.from({ length: Math.max(1, count) }, (_, i) => lines[i] ?? '');
}

/** One line per puzzle, same as Word Search fun facts. */
export function murdokuLineForPuzzle(
  text: string | undefined,
  index: number,
  opts?: { repeatSingle?: boolean }
): string {
  const lines = (text || '').split(/\r?\n/);
  const filled = lines.filter((line) => line.trim().length > 0);
  if (opts?.repeatSingle && filled.length <= 1) return (filled[0] || '').trim();
  return (lines[Math.max(0, index)] || '').trim();
}

export function joinMurdokuLines(lines: string[]): string {
  return lines.join('\n');
}

export function resolveMurdokuPuzzleTitle(
  puzzle: { story?: { title?: string }; theme?: { name?: string } } | null | undefined,
  fallback: string
): string {
  return puzzle?.story?.title?.trim() || puzzle?.theme?.name?.trim() || fallback;
}

export const MURDOKU_ART_STYLE_LABELS: Record<MurdokuArtStyle, string> = {
  'flat-vector': 'Flat vector',
  'cozy-cartoon': 'Cozy cartoon',
  comic: 'Comic',
  retro: 'Retro',
  modern: 'Modern',
  vintage: 'Vintage',
  realistic: 'Realistic illustration',
  'black-white': 'Black and white',
  'coloring-book': 'Coloring-book line art',
  custom: 'Custom style',
};
