import { NextRequest, NextResponse } from 'next/server';
import { callDeepSeekJson } from '@/lib/ai/deepseek-client';

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      theme?: string;
      style?: string;
      sheetIndex?: number;
      sheetCount?: number;
      count?: number;
      avoid?: string[];
    };
    const theme = (body.theme || '').trim();
    if (!theme) {
      return NextResponse.json({ ok: false, error: 'Enter a theme before applying it.' }, { status: 400 });
    }
    const count = Math.max(1, Math.min(10, Number(body.count) || 10));
    const sheetIndex = Number(body.sheetIndex) || 0;
    const sheetCount = Math.max(1, Number(body.sheetCount) || 1);
    const avoid = Array.isArray(body.avoid)
      ? body.avoid.map((item) => String(item).trim()).filter(Boolean).slice(0, 80)
      : [];
    const result = await callDeepSeekJson({
      systemPrompt: [
        'You plan printable maze start and end illustrations.',
        'The user theme is mandatory. Every subject and every description must be about that theme and nothing else.',
        'Do not keep, rewrite, or lightly restyle subjects from a different theme.',
        'Each pair is two related pictures: the first belongs at the maze entrance, the second at the exit.',
        'Descriptions tell an artist what to draw. They are not captions and must not be text inside the picture.',
        'Keep every description family-friendly, specific, and one sentence.',
        'Return JSON only. No markdown.',
      ].join(' '),
      userPrompt: [
        `The only theme is: "${theme}".`,
        `Every startSubject, endSubject, startDescription, and endDescription must be unmistakably part of "${theme}".`,
        `If "${theme}" is not about space, animals, food, or the ocean, do not use astronauts, rockets, rabbits, carrots, or other unrelated subjects.`,
        `Drawing style: ${body.style || 'coloring-page'}.`,
        `This is sheet ${sheetIndex + 1} of ${sheetCount}.`,
        `Invent ${count} new related pairs for this theme.`,
        avoid.length ? `Do not repeat these subjects already used on earlier sheets: ${avoid.join(', ')}.` : '',
        `Return JSON: {"pairs":[{"startSubject","startDescription","endSubject","endDescription"}]} with exactly ${count} pairs.`,
        'startDescription and endDescription must describe the drawing only: pose, shape, and main features. Do not mention grids, labels, or backgrounds.',
      ]
        .filter(Boolean)
        .join('\n'),
      temperature: 0.7,
      timeoutMs: 60_000,
    });
    if (!result.ok) {
      return NextResponse.json({ ok: false, error: result.message }, { status: 502 });
    }
    let data: { pairs?: Array<Record<string, unknown>> } = {};
    try {
      const cleaned = result.content.replace(/^```json\s*|\s*```$/g, '').trim();
      data = JSON.parse(cleaned) as { pairs?: Array<Record<string, unknown>> };
    } catch {
      return NextResponse.json({ ok: false, error: 'AI returned invalid JSON.' }, { status: 502 });
    }
    const rows = Array.isArray(data.pairs) ? data.pairs : [];
    if (rows.length < count) {
      return NextResponse.json({ ok: false, error: 'AI did not describe every image on the sheet.' }, { status: 502 });
    }
    const pairs = rows.slice(0, count).map((row) => ({
      startSubject: String(row.startSubject || '').trim(),
      endSubject: String(row.endSubject || '').trim(),
      startDescription: String(row.startDescription || '').trim(),
      endDescription: String(row.endDescription || '').trim(),
    }));
    if (pairs.some((pair) => !pair.startSubject || !pair.endSubject || !pair.startDescription || !pair.endDescription)) {
      return NextResponse.json({ ok: false, error: 'AI left a picture without a theme description.' }, { status: 502 });
    }
    return NextResponse.json({ ok: true, data: { pairs } });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'AI request failed.' },
      { status: 500 }
    );
  }
}
