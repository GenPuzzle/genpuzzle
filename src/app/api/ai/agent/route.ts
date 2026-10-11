import { NextRequest, NextResponse } from 'next/server';
import { getAIProvider, type AiChatMessage } from '@/lib/ai/provider';
import { AGENT_SYSTEM_PROMPT, GENPUZZLE_AGENT_TOOLS } from '@/lib/ai/agent-tools';

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      message?: string;
      history?: AiChatMessage[];
      projectContext?: unknown;
      selectedElements?: unknown;
      projectId?: string;
      userId?: string;
    };

    const message = typeof body.message === 'string' ? body.message.trim() : '';
    if (!message) {
      return NextResponse.json({ ok: false, error: 'Message is required.' }, { status: 400 });
    }

    const history = Array.isArray(body.history) ? body.history.slice(-12) : [];
    const contextBlock = {
      project: body.projectContext ?? null,
      selectedElements: body.selectedElements ?? null,
    };

    const messages: AiChatMessage[] = [
      { role: 'system', content: AGENT_SYSTEM_PROMPT },
      {
        role: 'system',
        content: `Current compact GenPuzzle context (do not invent missing fields):\n${JSON.stringify(contextBlock)}`,
      },
      ...history.filter((m) => m.role === 'user' || m.role === 'assistant'),
      { role: 'user', content: message.normalize('NFC') },
    ];

    const provider = getAIProvider();
    const result = await provider.runToolCalling({
      messages,
      tools: GENPUZZLE_AGENT_TOOLS,
      temperature: 0.3,
      timeoutMs: 90_000,
      operationType: 'ai_edit',
      projectId: body.projectId,
      userId: body.userId,
    });

    if (!result.ok) {
      const status =
        result.code === 'missing_api_key' || result.code === 'invalid_api_key'
          ? 503
          : result.code === 'rate_limit'
            ? 429
            : 502;
      return NextResponse.json(
        { ok: false, error: result.message, code: result.code, requestId: result.requestId },
        { status }
      );
    }

    return NextResponse.json({
      ok: true,
      content: result.content,
      toolCalls: result.toolCalls.map((tc) => ({
        id: tc.id,
        name: tc.function?.name,
        arguments: tc.function?.arguments,
      })),
      requestId: result.requestId,
    });
  } catch {
    return NextResponse.json(
      { ok: false, error: 'AI assistant could not complete the request.' },
      { status: 500 }
    );
  }
}
