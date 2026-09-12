import { NextRequest, NextResponse } from 'next/server';
import { callDeepSeekJson } from '@/lib/ai/deepseek-client';
import type { MurdokuAiRequest } from '@/lib/murdoku-ai';

function friendlyError(message: string, status = 400) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

function systemPrompt(): string {
  return [
    'You write printable murder-mystery puzzle-book copy.',
    'Never invent or change the hidden puzzle solution, murderer, coordinates, or clue logic.',
    'You may only write names, descriptions, story text, and natural wording around facts you are given.',
    'Keep content family-friendly and editable.',
    'Return JSON only. No markdown.',
  ].join(' ');
}

function userPrompt(req: MurdokuAiRequest): string {
  const ctx = JSON.stringify(req.settings);
  const puzzle = req.puzzle ? JSON.stringify(req.puzzle) : '{}';
  const tone = req.tone || 'mysterious';
  const extra = req.instruction || '';
  switch (req.task) {
    case 'theme':
      return `Invent one original murder-mystery location theme as JSON: {"name","location","caseType","description"}. Avoid copying famous copyrighted properties. Context: ${ctx}`;
    case 'room-names':
      return `Suggest 9 short printable room names for this theme as JSON: {"rooms":["..."]}. Use real locations that belong in the setting (library, classroom, office, gym, cafeteria, hallway, and similar). Do not invent abstract or joke names. Context: ${ctx}`;
    case 'character-names':
      return `Suggest original given names, one per character listed in settings.characters, as JSON: {"names":["..."]}. Context: ${ctx}`;
    case 'character-descriptions':
      return `Write a short occupation and 1-sentence appearance-only description for each character as JSON: {"characters":[{"name","occupation","description","clothingNotes"}]}. Describe face, hair, and clothing only. Do not mention items, props, objects, furniture, or anything held. Context: ${ctx}`;
    case 'element-list':
      return `Create a coherent furniture/decor list for this murder-mystery map as JSON: {"elements":["Bookshelf","Desk","Chair"]}.
Rules:
- First read each room and its allowed furniture/decor/object pool in settings.rooms.
- Generate only furniture, decor, fixtures, storage, and large inanimate scene objects from those pools.
- Every listed object must belong in at least one of the rooms.
- Prefer chairs, tables, desks, shelves, cabinets, counters, plants, lamps, carts, benches, lockers, whiteboards, pianos, boxes, crates, podiums, and similar room-scale pieces.
- Do not add random small props: phone, book, coffee, laptop, screwdriver, pencil, scissors, stapler, ruler, mug, keys, or other handheld clutter unless a room catalog explicitly requires that object.
- Sit-on items may only be chairs, armchairs, sofas, couches, benches, beds, carpets, rugs, or lounges. Include at least 3 sit-on items.
- Keep the list visually believable for the theme (a real school, bookstore, gym, office, or restaurant — not a junk drawer).
- Return 8-12 names, no duplicates.
Context: ${ctx}`;
    case 'story':
      return `Write case copy as JSON: {"caseTitle","intro","intros":["..."],"crimeDescription","victimDescription","whatHappened","timeOfIncident","background","instruction","flavorText"}. "intro" must be newline-separated sentences, one unique sentence per puzzle. "intros" is the same list as an array. Do not repeat one sentence on every puzzle. Tone: ${tone}. ${extra} Do not name the murderer. Context: ${ctx} Puzzle facts: ${puzzle}`;
    case 'case-title':
      return `Write JSON: {"caseTitle":"..."}. Tone: ${tone}. Context: ${ctx}`;
    case 'instructions':
      return `Write JSON: {"instruction":"..."}. Explain the row/column rule and finding who was alone with the victim. Context: ${ctx}`;
    case 'rewrite-clues':
      return `Rewrite each given clue into natural mystery language WITHOUT changing the logical meaning. Keep the same person, room, object, and relationship named in simpleText. Vary sentence openings so clues do not all say "X was …". Never write sitting on, standing on, or "on the …" unless simpleText already uses sitting/on and the object is a chair, sofa, couch, bench, bed, carpet, rug, or lounge. A punching bag, lamp, cart, bag, statue, or similar prop may only be beside someone. If simpleText says beside, the rewrite must also mean beside, not on. Return JSON: {"clues":[{"simpleText","displayText"}]} with one item per input clue, same order. Tone: ${tone}. ${extra} Puzzle: ${puzzle}`;
    case 'solution-explanation':
      return `Explain the verified solution in 1-3 short paragraphs. Return JSON: {"solutionExplanation":"..."}. You may name the murderer because this is solution-page copy. Puzzle: ${puzzle} Context: ${ctx}`;
    case 'rewrite-tone':
      return `Rewrite the story fields in a ${tone} tone. ${extra} Return JSON with the same story keys. Do not name the murderer. Context: ${ctx}`;
    default:
      return `Return JSON: {"ok":true}. Context: ${ctx}`;
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as MurdokuAiRequest;
    if (!body?.task) return friendlyError('Missing AI task.');
    const result = await callDeepSeekJson({
      systemPrompt: systemPrompt(),
      userPrompt: userPrompt(body),
      temperature: 0.7,
      timeoutMs: 60_000,
    });
    if (!result.ok) return friendlyError(result.message, 502);
    let data: Record<string, unknown> = {};
    try {
      const cleaned = result.content.replace(/^```json\s*|\s*```$/g, '').trim();
      data = JSON.parse(cleaned) as Record<string, unknown>;
    } catch {
      return friendlyError('AI returned invalid JSON.');
    }
    return NextResponse.json({ ok: true, data });
  } catch (error) {
    return friendlyError(error instanceof Error ? error.message : 'AI request failed.', 500);
  }
}
