import { NextRequest, NextResponse } from 'next/server';
import { planProjectFromPrompt } from '@/lib/ai/plan-project';

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      prompt?: string;
      useDeepSeek?: boolean;
      projectId?: string;
      userId?: string;
    };
    const prompt = typeof body.prompt === 'string' ? body.prompt : '';
    const result = await planProjectFromPrompt(prompt, {
      useDeepSeek: body.useDeepSeek !== false,
      projectId: body.projectId,
      userId: body.userId,
    });
    if (!result.ok) {
      return NextResponse.json(
        { ok: false, error: result.error, partialSpec: result.partialSpec },
        { status: 422 }
      );
    }
    return NextResponse.json({
      ok: true,
      spec: result.spec,
      summary: result.summary,
      source: result.source,
      requestId: result.requestId,
    });
  } catch (error) {
    console.error('[plan-project]', error);
    return NextResponse.json(
      { ok: false, error: 'Could not plan the project. Please try again.' },
      { status: 500 }
    );
  }
}
