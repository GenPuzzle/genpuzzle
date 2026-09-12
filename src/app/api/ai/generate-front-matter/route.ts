import { NextRequest, NextResponse } from 'next/server';
import { callDeepSeekJson } from '@/lib/ai/deepseek-client';
import { buildAiSystemPrompt, buildAiFrontMatterUserPrompt } from '@/lib/ai/prompts';
import type { AiFrontMatterRequest } from '@/lib/ai/types';
import { parseAiBatchJson, parseAiFrontMatterCopy } from '@/lib/ai/validate';

function friendlyError(message: string, status = 400) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as Partial<AiFrontMatterRequest>;
    if (!body?.setup?.bookTitle?.trim()) {
      return friendlyError('Book title is required.');
    }
    const needIntroduction = Boolean(body.needIntroduction);
    const needInstructions = Boolean(body.needInstructions);
    if (!needIntroduction && !needInstructions) {
      return NextResponse.json({ ok: true, introduction: '', instructions: '' });
    }

    const setup = {
      bookTitle: body.setup.bookTitle.trim(),
      subtitle: body.setup.subtitle?.trim() || '',
      description: body.setup.description?.trim() || '',
      language: body.setup.language?.trim() || 'English',
      audience: body.setup.audience || 'adults',
      customAudience: body.setup.customAudience,
    };
    const puzzleTypeLabels = Array.isArray(body.puzzleTypeLabels)
      ? body.puzzleTypeLabels.map((label) => String(label).trim()).filter(Boolean).slice(0, 12)
      : [];

    const ai = await callDeepSeekJson({
      systemPrompt: buildAiSystemPrompt(),
      userPrompt: buildAiFrontMatterUserPrompt({
        setup,
        puzzleTypeLabels,
        needIntroduction,
        needInstructions,
      }),
    });

    if (!ai.ok) {
      const status =
        ai.code === 'missing_api_key' || ai.code === 'invalid_api_key'
          ? 503
          : ai.code === 'rate_limit'
            ? 429
            : 502;
      return NextResponse.json({ ok: false, error: ai.message, code: ai.code }, { status });
    }

    let parsed: unknown;
    try {
      parsed = parseAiBatchJson(ai.content);
    } catch {
      return friendlyError('AI returned malformed JSON. Please retry.', 422);
    }

    const copy = parseAiFrontMatterCopy(parsed, needIntroduction, needInstructions);
    return NextResponse.json({
      ok: true,
      introduction: copy.introduction || '',
      instructions: copy.instructions || '',
    });
  } catch (error) {
    console.error('[AI generate-front-matter]', error);
    return NextResponse.json(
      {
        ok: false,
        error: 'AI generation could not be completed. Please try again.',
        code: 'server_error',
      },
      { status: 500 }
    );
  }
}
