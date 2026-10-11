import {
  DEEPSEEK_BASE_URL,
  DEEPSEEK_CHAT_PATH,
  DEEPSEEK_MODEL,
} from './config';
import {
  createAiRequestId,
  emitAiUsage,
  extractTokenUsage,
  type AiOperationType,
} from './usage';

export type DeepSeekCallResult =
  | { ok: true; content: string; raw: unknown; requestId: string }
  | {
      ok: false;
      code:
        | 'missing_api_key'
        | 'invalid_api_key'
        | 'rate_limit'
        | 'insufficient_balance'
        | 'upstream_error'
        | 'empty_response'
        | 'network_error';
      message: string;
      status?: number;
      requestId: string;
    };

export interface DeepSeekToolDefinition {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

export interface DeepSeekToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

export interface DeepSeekChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  tool_call_id?: string;
  tool_calls?: DeepSeekToolCall[];
  name?: string;
}

type CallMeta = {
  operationType?: AiOperationType;
  projectId?: string;
  userId?: string;
};

function fail(
  requestId: string,
  code: Extract<DeepSeekCallResult, { ok: false }>['code'],
  message: string,
  status?: number,
  meta?: CallMeta
): DeepSeekCallResult {
  emitAiUsage({
    requestId,
    userId: meta?.userId,
    projectId: meta?.projectId,
    model: DEEPSEEK_MODEL,
    operationType: meta?.operationType ?? 'other',
    status: 'error',
    timestamp: new Date().toISOString(),
    provider: 'deepseek',
    errorCode: code,
  });
  return { ok: false, code, message, status, requestId };
}

function mapHttpError(
  requestId: string,
  status: number,
  bodyText: string,
  meta?: CallMeta
): DeepSeekCallResult {
  if (status === 401 || status === 403) {
    return fail(
      requestId,
      'invalid_api_key',
      'AI generation could not be completed. Please try again.',
      status,
      meta
    );
  }
  if (status === 429) {
    return fail(
      requestId,
      'rate_limit',
      'AI service is temporarily busy. Please retry.',
      status,
      meta
    );
  }
  if (status === 402 || /balance|quota|billing/i.test(bodyText)) {
    return fail(
      requestId,
      'insufficient_balance',
      'AI generation could not be completed. Please try again later.',
      status,
      meta
    );
  }
  return fail(
    requestId,
    'upstream_error',
    'AI generation could not be completed. Please try again.',
    status,
    meta
  );
}

export async function callDeepSeekJson(options: {
  systemPrompt: string;
  userPrompt: string;
  temperature?: number;
  timeoutMs?: number;
  operationType?: AiOperationType;
  projectId?: string;
  userId?: string;
}): Promise<DeepSeekCallResult> {
  const requestId = createAiRequestId();
  const meta: CallMeta = {
    operationType: options.operationType ?? 'content_batch',
    projectId: options.projectId,
    userId: options.userId,
  };
  const apiKey = process.env.DEEPSEEK_API_KEY?.trim();
  if (!apiKey) {
    return fail(
      requestId,
      'missing_api_key',
      'AI generation is not configured. Please try again later.',
      undefined,
      meta
    );
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? 120_000);

  try {
    const response = await fetch(`${DEEPSEEK_BASE_URL}${DEEPSEEK_CHAT_PATH}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: DEEPSEEK_MODEL,
        messages: [
          { role: 'system', content: options.systemPrompt },
          { role: 'user', content: options.userPrompt },
        ],
        temperature: options.temperature ?? 0.7,
        response_format: { type: 'json_object' },
        thinking: { type: 'disabled' },
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      let bodyText = '';
      try {
        bodyText = await response.text();
      } catch {
        bodyText = '';
      }
      return mapHttpError(requestId, response.status, bodyText, meta);
    }

    const raw = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
      usage?: Record<string, unknown>;
    };
    const content = raw?.choices?.[0]?.message?.content?.trim() ?? '';
    const tokens = extractTokenUsage(raw);
    if (!content) {
      return fail(requestId, 'empty_response', 'AI returned an empty response. Please retry.', undefined, meta);
    }
    emitAiUsage({
      requestId,
      userId: meta.userId,
      projectId: meta.projectId,
      model: DEEPSEEK_MODEL,
      inputTokens: tokens.inputTokens,
      outputTokens: tokens.outputTokens,
      operationType: meta.operationType ?? 'content_batch',
      status: 'ok',
      timestamp: new Date().toISOString(),
      provider: 'deepseek',
    });
    return { ok: true, content, raw, requestId };
  } catch (error) {
    const aborted =
      error instanceof Error &&
      (error.name === 'AbortError' || /aborted/i.test(error.message));
    return fail(
      requestId,
      'network_error',
      aborted
        ? 'AI generation timed out. Please retry.'
        : 'AI generation could not be completed. Please try again.',
      undefined,
      meta
    );
  } finally {
    clearTimeout(timeout);
  }
}

export type DeepSeekChatResult =
  | {
      ok: true;
      content: string;
      toolCalls: DeepSeekToolCall[];
      raw: unknown;
      requestId: string;
    }
  | {
      ok: false;
      code: string;
      message: string;
      requestId: string;
      status?: number;
    };

export async function callDeepSeekChat(options: {
  messages: DeepSeekChatMessage[];
  tools?: DeepSeekToolDefinition[];
  temperature?: number;
  timeoutMs?: number;
  jsonMode?: boolean;
  operationType?: AiOperationType;
  projectId?: string;
  userId?: string;
}): Promise<DeepSeekChatResult> {
  const requestId = createAiRequestId();
  const meta: CallMeta = {
    operationType: options.operationType ?? 'ai_edit',
    projectId: options.projectId,
    userId: options.userId,
  };
  const apiKey = process.env.DEEPSEEK_API_KEY?.trim();
  if (!apiKey) {
    emitAiUsage({
      requestId,
      userId: meta.userId,
      projectId: meta.projectId,
      model: DEEPSEEK_MODEL,
      operationType: meta.operationType ?? 'ai_edit',
      status: 'error',
      timestamp: new Date().toISOString(),
      provider: 'deepseek',
      errorCode: 'missing_api_key',
    });
    return {
      ok: false,
      code: 'missing_api_key',
      message: 'AI generation is not configured. Please try again later.',
      requestId,
    };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? 120_000);

  try {
    const body: Record<string, unknown> = {
      model: DEEPSEEK_MODEL,
      messages: options.messages,
      temperature: options.temperature ?? 0.4,
      thinking: { type: 'disabled' },
    };
    if (options.jsonMode) {
      body.response_format = { type: 'json_object' };
    }
    if (options.tools && options.tools.length > 0 && !options.jsonMode) {
      body.tools = options.tools;
      body.tool_choice = 'auto';
    }

    const response = await fetch(`${DEEPSEEK_BASE_URL}${DEEPSEEK_CHAT_PATH}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    if (!response.ok) {
      let bodyText = '';
      try {
        bodyText = await response.text();
      } catch {
        bodyText = '';
      }
      const mapped = mapHttpError(requestId, response.status, bodyText, meta);
      return {
        ok: false,
        code: mapped.ok === false ? mapped.code : 'upstream_error',
        message: mapped.ok === false ? mapped.message : 'AI request failed.',
        requestId,
        status: response.status,
      };
    }

    const raw = (await response.json()) as {
      choices?: Array<{
        message?: {
          content?: string | null;
          tool_calls?: DeepSeekToolCall[];
        };
      }>;
    };
    const message = raw?.choices?.[0]?.message;
    const content = (message?.content ?? '').trim();
    const toolCalls = Array.isArray(message?.tool_calls) ? message!.tool_calls! : [];
    const tokens = extractTokenUsage(raw);

    if (!content && toolCalls.length === 0) {
      emitAiUsage({
        requestId,
        userId: meta.userId,
        projectId: meta.projectId,
        model: DEEPSEEK_MODEL,
        operationType: meta.operationType ?? 'ai_edit',
        status: 'error',
        timestamp: new Date().toISOString(),
        provider: 'deepseek',
        errorCode: 'empty_response',
      });
      return {
        ok: false,
        code: 'empty_response',
        message: 'AI returned an empty response. Please retry.',
        requestId,
      };
    }

    emitAiUsage({
      requestId,
      userId: meta.userId,
      projectId: meta.projectId,
      model: DEEPSEEK_MODEL,
      inputTokens: tokens.inputTokens,
      outputTokens: tokens.outputTokens,
      operationType: meta.operationType ?? 'ai_edit',
      status: 'ok',
      timestamp: new Date().toISOString(),
      provider: 'deepseek',
    });

    return { ok: true, content, toolCalls, raw, requestId };
  } catch (error) {
    const aborted =
      error instanceof Error &&
      (error.name === 'AbortError' || /aborted/i.test(error.message));
    emitAiUsage({
      requestId,
      userId: meta.userId,
      projectId: meta.projectId,
      model: DEEPSEEK_MODEL,
      operationType: meta.operationType ?? 'ai_edit',
      status: aborted ? 'aborted' : 'error',
      timestamp: new Date().toISOString(),
      provider: 'deepseek',
      errorCode: 'network_error',
    });
    return {
      ok: false,
      code: 'network_error',
      message: aborted
        ? 'AI generation timed out. Please retry.'
        : 'AI generation could not be completed. Please try again.',
      requestId,
    };
  } finally {
    clearTimeout(timeout);
  }
}
