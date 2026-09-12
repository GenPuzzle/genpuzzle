import type { MurdokuCharacter, MurdokuClue, MurdokuPuzzle } from './puzzles/murdoku';
import { isStandOnPropName, simpleClueText } from './puzzles/murdoku';
import type { MurdokuSettings } from './murdoku-settings';

const CLUE_WORDING_STYLES = [
  'witness statement',
  'detective notebook',
  'overheard remark',
  'short plain fact',
  'contrasting observation',
];

const ON_CLAIM = /\b(?:sitting (?:on|in)|standing on|(?:was|were) on)\b/i;

function distinctiveTokens(simple: string): string[] {
  const skip = new Set([
    'the', 'was', 'were', 'not', 'and', 'or', 'only', 'person', 'same', 'area', 'as', 'in', 'on',
    'beside', 'sitting', 'either', 'their', 'with', 'murderer', 'victim', 'she', 'he', 'they',
    'someone', 'contained', 'people',
  ]);
  const words = simple.toLowerCase().match(/[a-z][a-z']+/g) || [];
  const tokens: string[] = [];
  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    if (skip.has(word) || word.length < 3) continue;
    const next = words[i + 1];
    if (next && !skip.has(next) && next.length >= 3) tokens.push(`${word} ${next}`);
    tokens.push(word);
  }
  return [...new Set(tokens)];
}

export function acceptRewrittenClue(simpleText: string, displayText: string): boolean {
  const simple = simpleText.trim();
  const display = displayText.trim();
  if (display.length < 6 || display.length > 240) return false;
  if (/\b(?:column|row)\s+\d/i.test(display)) return false;
  const displayClaimsOn = ON_CLAIM.test(display);
  const simpleClaimsOn = ON_CLAIM.test(simple);
  if (displayClaimsOn && !simpleClaimsOn) return false;
  const onObject = display.match(/\b(?:on|in)\s+(?:the|a|an)\s+([a-z][a-z0-9 '\-]{1,40})/i);
  if (displayClaimsOn && onObject && !isStandOnPropName(onObject[1])) return false;
  const tokens = distinctiveTokens(simple);
  if (tokens.length === 0) return true;
  const lower = display.toLowerCase();
  return tokens.some((token) => lower.includes(token));
}

export type MurdokuAiTask =
  | 'theme'
  | 'room-names'
  | 'character-names'
  | 'character-descriptions'
  | 'element-list'
  | 'story'
  | 'case-title'
  | 'instructions'
  | 'rewrite-clues'
  | 'solution-explanation'
  | 'rewrite-tone';

export interface MurdokuAiRequest {
  task: MurdokuAiTask;
  tone?: string;
  instruction?: string;
  settings: {
    theme: MurdokuSettings['theme'];
    story: MurdokuSettings['story'];
    characters: Array<Pick<MurdokuCharacter, 'name' | 'occupation' | 'description'>>;
    rooms: Array<{ name: string }>;
    elements: Array<{ name: string }>;
    difficulty: string;
  };
  puzzle?: {
    victimName?: string;
    murdererName?: string;
    clues?: Array<Pick<MurdokuClue, 'type' | 'simpleText' | 'displayText'>>;
    murdererReason?: string;
  };
}

export async function requestMurdokuAi(body: MurdokuAiRequest): Promise<Record<string, unknown>> {
  let response: Response;
  try {
    response = await fetch('/api/ai/generate-murdoku', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(60_000),
    });
  } catch (error) {
    const timedOut =
      error instanceof DOMException &&
      (error.name === 'TimeoutError' || error.name === 'AbortError');
    throw new Error(timedOut ? 'AI generation timed out. Please try again.' : 'AI request failed');
  }
  const json = (await response.json()) as { ok?: boolean; data?: Record<string, unknown>; error?: string };
  if (!response.ok || !json.ok || !json.data) {
    throw new Error(json.error || 'AI generation could not be completed.');
  }
  return json.data;
}

export async function rewriteMurdokuPuzzleCluesWithAi(
  puzzle: MurdokuPuzzle,
  settings: MurdokuSettings
): Promise<MurdokuPuzzle> {
  const { assignCharacterClueTexts } = await import('./puzzles/murdoku');
  const style = CLUE_WORDING_STYLES[(puzzle.puzzleIndexInDocument ?? 0) % CLUE_WORDING_STYLES.length];
  const sitOn = settings.elements.filter((el) => isStandOnPropName(el.name)).map((el) => el.name);
  try {
    const data = await requestMurdokuAi({
      task: 'rewrite-clues',
      instruction: `Use a ${style} voice for this puzzle only. Sit-on furniture: ${sitOn.join(', ') || 'chair, sofa, bench, bed, carpet, rug'}.`,
      settings: {
        theme: settings.theme,
        story: settings.story,
        characters: settings.characters.map((c) => ({
          name: c.name,
          occupation: c.occupation,
          description: c.description,
        })),
        rooms: settings.rooms.map((r) => ({ name: r.name })),
        elements: settings.elements.map((e) => ({ name: e.name })),
        difficulty: settings.core.difficulty,
      },
      puzzle: {
        victimName: puzzle.characters.find((c) => c.id === puzzle.victimId)?.name,
        clues: puzzle.clues.map((c) => ({
          type: c.type,
          simpleText: c.simpleText,
          displayText: c.displayText,
        })),
      },
    });
    const rows = Array.isArray(data.clues)
      ? (data.clues as Array<{ displayText?: string }>)
      : [];
    if (!rows.length) return puzzle;
    const clues = puzzle.clues.map((clue, i) => {
      const next = String(rows[i]?.displayText || '').trim();
      return {
        ...clue,
        displayText: next && acceptRewrittenClue(clue.simpleText, next) ? next : clue.simpleText,
      };
    });
    return {
      ...puzzle,
      clues,
      characters: assignCharacterClueTexts(puzzle.characters, clues, puzzle.victimId),
    };
  } catch {
    return puzzle;
  }
}

export function rewriteCluesLocally(
  puzzle: MurdokuPuzzle,
  settings: MurdokuSettings,
  useSimple: boolean
): MurdokuClue[] {
  return puzzle.clues.map((clue) => {
    const simple = simpleClueText(clue, puzzle.characters, puzzle.rooms, puzzle.objects, settings.elements);
    return {
      ...clue,
      simpleText: simple,
      displayText: useSimple ? simple : clue.displayText || simple,
    };
  });
}
