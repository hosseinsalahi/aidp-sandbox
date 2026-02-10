import type { DiscoveryApi, FetchApi } from '@backstage/core-plugin-api';
import { createApiRef } from '@backstage/core-plugin-api';

export type AiChatMessage = {
  role: 'system' | 'user' | 'assistant';
  content: string;
};

type ChatCompletionResponse = {
  choices?: Array<{
    message?: { role?: string; content?: string };
    delta?: { role?: string; content?: string };
  }>;
  error?: { message?: string };
};

export type AiChatRequest = {
  messages: AiChatMessage[];
  model?: string;
  stream?: boolean;
  includeTechDocs?: boolean;
  entityRef?: string;
  max_tokens?: number;
};

export interface AiApi {
  chat(request: AiChatRequest): Promise<{ assistantText: string; raw: unknown }>;
  chatStream(
    request: Omit<AiChatRequest, 'stream'>,
    options?: { signal?: AbortSignal },
  ): AsyncIterable<string>;
}

export const aiApiRef = createApiRef<AiApi>({
  id: 'internal.ai',
});

async function* parseOpenAiSse(response: Response): AsyncIterable<string> {
  if (!response.body) {
    return;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder('utf-8');
  let buffer = '';

  while (true) {
    const { value, done } = await reader.read();
    if (done) {
      break;
    }

    buffer += decoder.decode(value, { stream: true });

    while (true) {
      const separatorIndex = buffer.indexOf('\n\n');
      if (separatorIndex === -1) {
        break;
      }

      const eventBlock = buffer.slice(0, separatorIndex);
      buffer = buffer.slice(separatorIndex + 2);

      const dataLines = eventBlock
        .split('\n')
        .map(l => l.trim())
        .filter(l => l.startsWith('data:'))
        .map(l => l.slice('data:'.length).trim());

      for (const data of dataLines) {
        if (data === '[DONE]') {
          return;
        }

        let parsed: ChatCompletionResponse | undefined;
        try {
          parsed = JSON.parse(data) as ChatCompletionResponse;
        } catch {
          continue;
        }

        const choice = parsed.choices?.[0];
        const delta = choice?.delta?.content;
        const message = choice?.message?.content;
        if (typeof delta === 'string' && delta.length) {
          yield delta;
        } else if (typeof message === 'string' && message.length) {
          yield message;
        }
      }
    }
  }
}

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
        ...(request.includeTechDocs !== undefined
          ? { includeTechDocs: request.includeTechDocs }
          : {}),
        ...(request.entityRef ? { entityRef: request.entityRef } : {}),
        ...(request.max_tokens ? { max_tokens: request.max_tokens } : {}),
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

  async *chatStream(
    request: Omit<AiChatRequest, 'stream'>,
    options?: { signal?: AbortSignal },
  ): AsyncIterable<string> {
    const baseUrl = await this.discoveryApi.getBaseUrl('ai');
    const response = await this.fetchApi.fetch(`${baseUrl}/chat`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        accept: 'text/event-stream',
      },
      credentials: 'include',
      body: JSON.stringify({
        stream: true,
        messages: request.messages,
        ...(request.model ? { model: request.model } : {}),
        ...(request.includeTechDocs !== undefined
          ? { includeTechDocs: request.includeTechDocs }
          : {}),
        ...(request.entityRef ? { entityRef: request.entityRef } : {}),
        ...(request.max_tokens ? { max_tokens: request.max_tokens } : {}),
      }),
      signal: options?.signal,
    });

    if (!response.ok) {
      const text = await response.text();
      let json: ChatCompletionResponse | undefined;
      try {
        json = JSON.parse(text) as ChatCompletionResponse;
      } catch {
        // ignore
      }
      const message =
        json?.error?.message ??
        `AI request failed (${response.status} ${response.statusText})`;
      throw new Error(message);
    }

    const contentType = response.headers.get('content-type') ?? '';
    if (!contentType.includes('text/event-stream')) {
      const text = await response.text();
      throw new Error(
        `AI streaming response was not SSE (content-type: ${contentType || 'n/a'}): ${text.slice(
          0,
          200,
        )}`,
      );
    }

    yield* parseOpenAiSse(response);
  }
}
