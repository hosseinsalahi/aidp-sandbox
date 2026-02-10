import type { DiscoveryApi, FetchApi } from '@backstage/core-plugin-api';
import { createApiRef } from '@backstage/core-plugin-api';

export type AiChatMessage = {
  role: 'system' | 'user' | 'assistant';
  content: string;
};

type ChatCompletionResponse = {
  choices?: Array<{
    message?: { role?: string; content?: string };
  }>;
  error?: { message?: string };
};

export type AiChatRequest = {
  messages: AiChatMessage[];
  model?: string;
};

export interface AiApi {
  chat(request: AiChatRequest): Promise<{ assistantText: string; raw: unknown }>;
}

export const aiApiRef = createApiRef<AiApi>({
  id: 'internal.ai',
});

export class AiClient implements AiApi {
  private readonly discoveryApi: DiscoveryApi;
  private readonly fetchApi: FetchApi;

  constructor(options: { discoveryApi: DiscoveryApi; fetchApi: FetchApi }) {
    this.discoveryApi = options.discoveryApi;
    this.fetchApi = options.fetchApi;
  }

  async chat(
    request: AiChatRequest,
  ): Promise<{ assistantText: string; raw: unknown }> {
    const baseUrl = await this.discoveryApi.getBaseUrl('ai');
    const response = await this.fetchApi.fetch(`${baseUrl}/chat`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        messages: request.messages,
        ...(request.model ? { model: request.model } : {}),
      }),
    });

    const text = await response.text();
    let json: ChatCompletionResponse | undefined;
    try {
      json = JSON.parse(text) as ChatCompletionResponse;
    } catch {
      // ignore
    }

    if (!response.ok) {
      const message =
        json?.error?.message ??
        `AI request failed (${response.status} ${response.statusText})`;
      throw new Error(message);
    }

    const assistantText = json?.choices?.[0]?.message?.content;
    if (!assistantText) {
      throw new Error('AI response was missing choices[0].message.content');
    }

    return { assistantText, raw: json ?? text };
  }
}
