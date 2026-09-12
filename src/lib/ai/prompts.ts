import type { AiBatchRequest, AiPuzzleTypeConfig } from './types';
import { aiMurdokuGridFromConfig, getAiPuzzleTypeLabel, themeTitlesForBatch } from './types';

export function buildAiSystemPrompt(): string {
  return [
    'You are a professional puzzle-book content writer for printable puzzle books.',
    'Generate original, family-friendly, accurate content that matches the book topic, language, audience, and difficulty.',
    'Return JSON only. Do not wrap JSON in markdown fences. Do not include commentary.',
    'Follow the requested schema exactly. Never invent unsupported puzzle types.',
    'Avoid duplicate titles, duplicate answers, and duplicate theme words across puzzles whenever practical.',
    'Answers and clues must match. Vocabulary must be clean and printable.',
    'Word lists must use real, correctly spelled words in the requested language.',
    'Never concatenate words: write "Sea Animals" not "Seaanimals" or "SeaAnimals". Multi-word phrases must include a space between each word.',
  ].join(' ');
}

function customThemeInstruction(req: AiBatchRequest): string {
  if (!req.typeConfig.useCustomThemeTitles) return '';
  const titles = themeTitlesForBatch(
    req.typeConfig.themeTitles,
    req.startIndex,
    req.count
  );
  if (titles.length === 0) return '';
  return [
    'Use these exact theme titles in order for this batch. Do not rename, number, or replace them:',
    titles.map((title, i) => `${i + 1}. ${title}`).join('\n'),
    'Each puzzle "title" (and "theme" when present) MUST be the assigned theme title.',
    'All words, clues, answers, and questions for that puzzle must fit that theme.',
  ].join('\n');
}

function audienceLabel(req: AiBatchRequest): string {
  if (req.setup.audience === 'custom') {
    return req.setup.customAudience?.trim() || 'general audience';
  }
  return req.setup.audience;
}

function wordListQualityRules(cfg: AiPuzzleTypeConfig, wordsPerPuzzle: number): string {
  const max = cfg.maxWordLength ?? 12;
  return [
    `- exactly ${wordsPerPuzzle} unique words or phrases`,
    `- every entry must be a real, correctly spelled dictionary word, proper name, or common phrase in the requested language`,
    `- never smash words together: write "Sea Animals" not "Seaanimals" or "SeaAnimals"`,
    `- if an entry is two or more words, put a space between each word (Ice Cream, New York, Fire Truck)`,
    `- letters from the requested language and spaces only; preserve required accents (such as ä, é, ñ); no digits, punctuation, or invented compounds`,
    `- letter count ignoring spaces must be 3–${max} (so "Sea Animals" is 11 letters)`,
    `- uppercase preferred; do not misspell, abbreviate, or invent words to fit the length limit — pick a different real word instead`,
  ].join('\n');
}

function schemaForType(type: string, cfg: AiPuzzleTypeConfig): string {
  switch (type) {
    case 'word-search':
      return `{
  "puzzles": [
    {
      "type": "word-search",
      "title": "string",
      "theme": "string",
      "difficulty": "easy|medium|hard",
      "funFact": "string (optional short fun fact)",
      "words": ["DOLPHIN", "SEA ANIMALS"]
    }
  ]
}
Requirements per puzzle:
${wordListQualityRules(cfg, cfg.wordsPerPuzzle ?? 15)}
- words must fit the theme/title
${cfg.generateFunFacts ? '- include funFact for every puzzle' : '- funFact optional'}`;
    case 'crossword':
      return `{
  "puzzles": [
    {
      "type": "crossword",
      "title": "string",
      "difficulty": "easy|medium|hard",
      "entries": [{ "answer": "SHOVEL", "clue": "Tool used for digging" }]
    }
  ]
}
Requirements per puzzle:
- exactly ${cfg.cluesPerPuzzle ?? 15} answer/clue pairs — no more, no fewer
- every answer MUST have a matching clue (same array index)
- answers: letters only (A–Z), length 3–${cfg.maxAnswerLength ?? 15}, no spaces, no hyphens
- clues: one short sentence on a SINGLE line (no line breaks, no numbering)
- no duplicate answers within a puzzle
- do not omit a clue even if it is short`
    case 'sudoku':
      return `{ "puzzles": [] }
Do not generate Sudoku content, titles, or themes. The app builds Sudoku locally.`;
    case 'maze':
      return `{ "puzzles": [] }
Do not generate maze content, titles, or themes. The app builds mazes locally.`;
    case 'cryptogram':
      return `{
  "puzzles": [
    {
      "type": "cryptogram",
      "title": "string",
      "difficulty": "easy|medium|hard",
      "phrase": "A complete quote or sentence"
    }
  ]
}
Phrases should be printable, original or well-known short quotes suitable for cryptograms.`;
    case 'word-scramble':
      return `{
  "puzzles": [
    {
      "type": "word-scramble",
      "title": "string",
      "difficulty": "easy|medium|hard",
      "words": ["APPLE", "ICE CREAM"]
    }
  ]
}
Requirements per puzzle:
${wordListQualityRules(cfg, cfg.wordsPerPuzzle ?? 10)}`;
    case 'trivia':
      return `{
  "puzzles": [
    {
      "type": "trivia",
      "title": "string",
      "difficulty": "easy|medium|hard",
      "questions": [
        {
          "prompt": "Question text?",
          "suggestions": ["A", "B", "C", "D"],
          "answer": "B"
        }
      ]
    }
  ]
}
Requirements per puzzle (trivia game):
- exactly ${cfg.questionsPerPuzzle ?? 10} questions
- each question has exactly ${cfg.suggestionsPerQuestion ?? 4} suggestions
- answer must exactly match one suggestion`;
    case 'murdoku': {
      const { rows, cols, people } = aiMurdokuGridFromConfig(cfg);
      const roomCount = Math.max(2, Math.min(9, people + 1));
      const elementCount = Math.max(4, Math.min(12, people + 3));
      const avoidRandom = cfg.murdokuAvoidRandomProps !== false;
      const largeOnly = cfg.murdokuLargeFurnitureOnly === true;
      return `{
  "puzzles": [
    {
      "type": "murdoku",
      "title": "string",
      "theme": "Bookstore",
      "location": "Main Street bookstore",
      "difficulty": "easy|medium|hard",
      "caseTitle": "string",
      "intro": "short case intro, do not name the murderer",
      "instruction": "how to solve",
      "characters": [{ "name": "Aria", "occupation": "Owner", "description": "short appearance only, no objects" }],
      "rooms": ["Best Sellers", "Cafe"],
      "elements": ["Bookshelf", "Table"]
    }
  ]
}
Requirements per puzzle:
- the printed grid is ${rows} rows by ${cols} columns
- exactly ${people} character names (no more, no fewer)
- exactly ${roomCount} room names that fit the theme (library, classroom, office, gym, cafeteria, and similar real locations)
- exactly ${elementCount} scene objects
- elements must be furniture, decor, fixtures, storage, or large inanimate scene objects that belong in those rooms
- match rooms to objects: Library → bookshelf, reading chair, table, lamp, cart; Classroom → desk, chair, whiteboard, cabinet; Gym → bench, locker, yoga mat; Cafeteria → dining table, chair, serving counter, cart
- do not invent random miscellaneous props just to fill the list
${avoidRandom ? '- never include phones, books, coffee cups, laptops, screwdrivers, pencils, scissors, staplers, rulers, mugs, or other tiny handheld clutter' : ''}
${largeOnly ? '- use only medium and large furniture/decor/fixtures; no small scattered items' : ''}
- character descriptions are appearance only (face, hair, clothing). Never mention held items, props, or objects
- never identify the murderer or give coordinates
- keep copy family-friendly and printable`;
    }
    default:
      return `{ "puzzles": [] }`;
  }
}

export function buildAiUserPrompt(req: AiBatchRequest): string {
  const label = getAiPuzzleTypeLabel(req.puzzleType);
  const difficulties = req.assignedDifficulties.join(', ');
  return [
    `Book title: ${req.setup.bookTitle}`,
    req.setup.subtitle ? `Subtitle: ${req.setup.subtitle}` : '',
    req.setup.description ? `Topic/description: ${req.setup.description}` : '',
    `Language: ${req.setup.language}`,
    `Audience: ${audienceLabel(req)}`,
    '',
    `Generate ${req.count} ${label} puzzle(s) as a JSON object.`,
    `These are puzzles ${req.startIndex + 1}–${req.startIndex + req.count} for this type.`,
    `Assigned difficulties in order: [${difficulties}]`,
    customThemeInstruction(req),
    '',
    req.typeConfig.useCustomThemeTitles
      ? 'Do not invent different titles for this batch.'
      : 'Avoid these already-used titles:',
    req.typeConfig.useCustomThemeTitles ? '' : JSON.stringify(req.excludeTitles.slice(-80)),
    'Avoid these already-used words/answers where relevant:',
    JSON.stringify([...req.excludeWords, ...req.excludeAnswers].slice(-200)),
    '',
    'JSON schema:',
    schemaForType(req.puzzleType, req.typeConfig),
  ]
    .filter(Boolean)
    .join('\n');
}

export function buildAiFrontMatterUserPrompt(req: {
  setup: AiBatchRequest['setup'];
  puzzleTypeLabels: string[];
  needIntroduction: boolean;
  needInstructions: boolean;
}): string {
  const audience =
    req.setup.audience === 'custom'
      ? req.setup.customAudience?.trim() || 'general audience'
      : req.setup.audience;
  const keys: string[] = [];
  if (req.needIntroduction) keys.push('"introduction": "2–4 short paragraphs welcoming the reader"');
  if (req.needInstructions) {
    keys.push(
      '"instructions": "Clear how-to text covering each included puzzle type, as short paragraphs or numbered steps"'
    );
  }
  return [
    `Book title: ${req.setup.bookTitle}`,
    req.setup.subtitle ? `Subtitle: ${req.setup.subtitle}` : '',
    req.setup.description ? `Topic/description: ${req.setup.description}` : '',
    `Language: ${req.setup.language}`,
    `Audience: ${audience}`,
    `Puzzle types in this book: ${req.puzzleTypeLabels.join(', ') || 'puzzles'}`,
    '',
    'Write printable front-matter copy for this puzzle book.',
    'Family-friendly, correctly spelled, in the requested language.',
    'Do not mention AI, generators, or software.',
    'Return JSON only with these keys:',
    `{ ${keys.join(', ')} }`,
    req.needIntroduction
      ? 'Introduction: warm, specific to the book topic, 120–220 words. No heading line.'
      : '',
    req.needInstructions
      ? 'Instructions: explain how to solve each listed puzzle type and how to use the solutions section. 120–260 words. No heading line.'
      : '',
  ]
    .filter(Boolean)
    .join('\n');
}
