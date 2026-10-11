/**
 * Provider-agnostic AI interface. DeepSeek is the first implementation;
 * GenPuzzle features should depend on this layer, not vendor-specific APIs.
 */

import { DEEPSEEK_MODEL } from './config';
import {
  callDeepSeekChat,
  callDeepSeekJson,
  type DeepSeekCallResult,
  type DeepSeekToolDefinition,
  type DeepSeekToolCall,
} from './deepseek-client';
import type { AiOperationType } from './usage';

export interface AiChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  toolCallId?: string;
  toolCalls?: DeepSeekToolCall[];
  name?: string;
}

export interface AiStructuredRequest {
  systemPrompt: string;
  userPrompt: string;
  temperature?: number;
  timeoutMs?: number;
  operationType?: AiOperationType;
  projectId?: string;
  userId?: string;
}

export interface AiAgentRequest {
  messages: AiChatMessage[];
  tools?: DeepSeekToolDefinition[];
  temperature?: number;
  timeoutMs?: number;
  /** When true, force JSON object response (no tools). */
  jsonMode?: boolean;
  operationType?: AiOperationType;
  projectId?: string;
  userId?: string;
}

export interface AiAgentSuccess {
  ok: true;
  content: string;
  toolCalls: DeepSeekToolCall[];
  raw: unknown;
  requestId: string;
}

export interface AiAgentFailure {
  ok: false;
  code: string;
  message: string;
  requestId: string;
  status?: number;
}

export type AiAgentResult = AiAgentSuccess | AiAgentFailure;

export interface AIProvider {
  readonly id: string;
  readonly model: string;
  generateStructuredContent(request: AiStructuredRequest): Promise<DeepSeekCallResult & { requestId: string }>;
  runToolCalling(request: AiAgentRequest): Promise<AiAgentResult>;
  sendAgentRequest(request: AiAgentRequest): Promise<AiAgentResult>;
  generateTextBatch(request: AiStructuredRequest): Promise<DeepSeekCallResult & { requestId: string }>;
}

export class DeepSeekProvider implements AIProvider {
  readonly id = 'deepseek';
  readonly model = DEEPSEEK_MODEL;

  async generateStructuredContent(
    request: AiStructuredRequest
  ): Promise<DeepSeekCallResult & { requestId: string }> {
    return callDeepSeekJson({
      systemPrompt: request.systemPrompt,
      userPrompt: request.userPrompt,
      temperature: request.temperature,
      timeoutMs: request.timeoutMs,
      operationType: request.operationType ?? 'content_batch',
      projectId: request.projectId,
      userId: request.userId,
    });
  }

  async generateTextBatch(
    request: AiStructuredRequest
  ): Promise<DeepSeekCallResult & { requestId: string }> {
    return this.generateStructuredContent(request);
  }

  async runToolCalling(request: AiAgentRequest): Promise<AiAgentResult> {
    return this.sendAgentRequest({ ...request, jsonMode: false });
  }

  async sendAgentRequest(request: AiAgentRequest): Promise<AiAgentResult> {
    return callDeepSeekChat({
      messages: request.messages,
      tools: request.tools,
      temperature: request.temperature,
      timeoutMs: request.timeoutMs,
      jsonMode: request.jsonMode,
      operationType: request.operationType ?? 'ai_edit',
      projectId: request.projectId,
      userId: request.userId,
    });
  }
}

let defaultProvider: AIProvider | null = null;

export function getAIProvider(): AIProvider {
  if (!defaultProvider) defaultProvider = new DeepSeekProvider();
  return defaultProvider;
}

export function setAIProvider(provider: AIProvider): void {
  defaultProvider = provider;
}
