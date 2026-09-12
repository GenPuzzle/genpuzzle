import { NextRequest, NextResponse } from 'next/server';
import { callDeepSeekJson } from '@/lib/ai/deepseek-client';
import { buildAiSystemPrompt, buildAiUserPrompt } from '@/lib/ai/prompts';
import { isAiPuzzleType, type AiBatchRequest, applyCustomThemeTitles } from '@/lib/ai/types';
import { parseAiBatchJson, validateAiBatchResponse } from '@/lib/ai/validate';

function friendlyError(message: string, status = 400) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as Partial<AiBatchRequest>;
    if (!body?.setup?.bookTitle?.trim()) {
      return friendlyError('Book title is required.');
    }
    if (!body.puzzleType || !isAiPuzzleType(body.puzzleType)) {
      return friendlyError('Unsupported puzzle type.');
    }
    const count = Math.max(1, Math.min(40, Math.floor(Number(body.count) || 0)));
    if (!count) return friendlyError('Invalid batch count.');
    if (!body.typeConfig || body.typeConfig.type !== body.puzzleType) {
      return friendlyError('Puzzle type configuration is invalid.');
    }

    const batchRequest: AiBatchRequest = {
      setup: {
        bookTitle: body.setup.bookTitle.trim(),
        subtitle: body.setup.subtitle?.trim() || '',
        description: body.setup.description?.trim() || '',
        language: body.setup.language?.trim() || 'English',
        audience: body.setup.audience || 'adults',
        customAudience: body.setup.customAudience,
      },
      puzzleType: body.puzzleType,
      typeConfig: body.typeConfig,
      startIndex: Math.max(0, Math.floor(Number(body.startIndex) || 0)),
      count,
      assignedDifficulties: Array.isArray(body.assignedDifficulties)
        ? body.assignedDifficulties
        : [],
      excludeTitles: Array.isArray(body.excludeTitles) ? body.excludeTitles.slice(0, 120) : [],
      excludeWords: Array.isArray(body.excludeWords) ? body.excludeWords.slice(0, 300) : [],
      excludeAnswers: Array.isArray(body.excludeAnswers)
        ? body.excludeAnswers.slice(0, 300)
        : [],
    };

    while (batchRequest.assignedDifficulties.length < count) {
      batchRequest.assignedDifficulties.push('medium');
    }

    const ai = await callDeepSeekJson({
      systemPrompt: buildAiSystemPrompt(),
      userPrompt: buildAiUserPrompt(batchRequest),
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

    const validated = validateAiBatchResponse(
      parsed,
      batchRequest.puzzleType,
      count,
      batchRequest.typeConfig,
      batchRequest.assignedDifficulties
    );

    if (!validated.ok) {
      return NextResponse.json(
        { ok: false, error: validated.message, code: 'validation_failed' },
        { status: 422 }
      );
    }

    return NextResponse.json({
      ok: true,
      puzzles: applyCustomThemeTitles(
        validated.puzzles,
        batchRequest.typeConfig,
        batchRequest.startIndex
      ),
    });
  } catch (error) {
    console.error('[AI generate-batch]', error);
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
