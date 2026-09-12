import {
  DEEPSEEK_BASE_URL,
  DEEPSEEK_CHAT_PATH,
  DEEPSEEK_MODEL,
} from './config';

export type DeepSeekCallResult =
  | { ok: true; content: string; raw: unknown }
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
    };

export async function callDeepSeekJson(options: {
  systemPrompt: string;
  userPrompt: string;
  temperature?: number;
  timeoutMs?: number;
}): Promise<DeepSeekCallResult> {
  const apiKey = process.env.DEEPSEEK_API_KEY?.trim();
  if (!apiKey) {
    return {
      ok: false,
      code: 'missing_api_key',
      message: 'AI generation is not configured. Please try again later.',
    };
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
        // Disable thinking so JSON content generation stays fast and parseable.
        thinking: { type: 'disabled' },
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const status = response.status;
      let bodyText = '';
      try {
        bodyText = await response.text();
      } catch {
        bodyText = '';
      }

      if (status === 401 || status === 403) {
        return {
          ok: false,
          code: 'invalid_api_key',
          message: 'AI generation could not be completed. Please try again.',
          status,
        };
      }
      if (status === 429) {
        return {
          ok: false,
          code: 'rate_limit',
          message: 'AI service is temporarily busy. Please retry.',
          status,
        };
      }
      if (status === 402 || /balance|quota|billing/i.test(bodyText)) {
        return {
          ok: false,
          code: 'insufficient_balance',
          message: 'AI generation could not be completed. Please try again later.',
          status,
        };
      }
      return {
        ok: false,
        code: 'upstream_error',
        message: 'AI generation could not be completed. Please try again.',
        status,
      };
    }

    const raw = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = raw?.choices?.[0]?.message?.content?.trim() ?? '';
    if (!content) {
      return {
        ok: false,
        code: 'empty_response',
        message: 'AI returned an empty response. Please retry.',
      };
    }
    return { ok: true, content, raw };
  } catch (error) {
    const aborted =
      error instanceof Error &&
      (error.name === 'AbortError' || /aborted/i.test(error.message));
    return {
      ok: false,
      code: 'network_error',
      message: aborted
        ? 'AI generation timed out. Please retry.'
        : 'AI generation could not be completed. Please try again.',
    };
  } finally {
    clearTimeout(timeout);
  }
}
