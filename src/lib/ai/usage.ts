/**
 * AI usage/billing hooks. Pricing stays outside the DeepSeek provider.
 */

export type AiOperationType =
  | 'project_plan'
  | 'word_generation'
  | 'crossword_clues'
  | 'fun_facts'
  | 'ai_edit'
  | 'ai_analysis'
  | 'front_matter'
  | 'agent_tool'
  | 'content_batch'
  | 'other';

export interface AiUsageRecord {
  requestId: string;
  userId?: string;
  projectId?: string;
  model: string;
  inputTokens?: number;
  outputTokens?: number;
  estimatedCost?: number;
  operationType: AiOperationType;
  status: 'ok' | 'error' | 'aborted';
  timestamp: string;
  provider: string;
  errorCode?: string;
}

export type AiUsageListener = (record: AiUsageRecord) => void;

const listeners = new Set<AiUsageListener>();

export function createAiRequestId(): string {
  return `ai-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function onAiUsage(listener: AiUsageListener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function emitAiUsage(record: AiUsageRecord): void {
  for (const listener of listeners) {
    try {
      listener(record);
    } catch {
      // Billing listeners must never break generation.
    }
  }
}

export function extractTokenUsage(raw: unknown): {
  inputTokens?: number;
  outputTokens?: number;
} {
  if (!raw || typeof raw !== 'object') return {};
  const usage = (raw as { usage?: Record<string, unknown> }).usage;
  if (!usage) return {};
  const input =
    Number(usage.prompt_tokens ?? usage.input_tokens ?? usage.promptTokens) || undefined;
  const output =
    Number(usage.completion_tokens ?? usage.output_tokens ?? usage.completionTokens) ||
    undefined;
  return {
    inputTokens: input && input > 0 ? input : undefined,
    outputTokens: output && output > 0 ? output : undefined,
  };
}
