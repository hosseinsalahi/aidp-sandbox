import type {
  HttpAuthService,
  LoggerService,
  RootConfigService,
} from '@backstage/backend-plugin-api';
import { InputError } from '@backstage/errors';
import express from 'express';

type LiteLLMConfig = {
  baseUrl: string;
  apiKey?: string;
  model?: string;
};

function readLiteLLMConfig(config: RootConfigService): LiteLLMConfig | undefined {
  const baseUrl = config.getOptionalString('ai.litellm.baseUrl');
  if (!baseUrl) {
    return undefined;
  }

  return {
    baseUrl,
    apiKey: config.getOptionalString('ai.litellm.apiKey'),
    model: config.getOptionalString('ai.litellm.model'),
  };
}

function resolveChatCompletionsUrl(baseUrl: string): string {
  const trimmed = baseUrl.trim();
  if (/\/chat\/completions\/?$/.test(trimmed)) {
    return trimmed;
  }

  const normalized = trimmed.endsWith('/') ? trimmed : `${trimmed}/`;
  return new URL('chat/completions', normalized).toString();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export async function createAiRouter(options: {
  config: RootConfigService;
  httpAuth: HttpAuthService;
  logger: LoggerService;
}): Promise<express.Router> {
  const { config, httpAuth, logger } = options;

  const router = express.Router();
  router.use(express.json({ limit: '1mb' }));

  router.get('/health', async (_req, res) => {
    const litellm = readLiteLLMConfig(config);
    res.json({
      ok: Boolean(litellm?.baseUrl),
      configured: Boolean(litellm?.baseUrl),
      model: litellm?.model ?? null,
    });
  });

  router.post('/chat', async (req, res, next) => {
    try {
      const litellm = readLiteLLMConfig(config);
      if (!litellm) {
        res.status(503).json({
          error: {
            message: 'LiteLLM is not configured (missing ai.litellm.baseUrl)',
          },
        });
        return;
      }

      if (!isRecord(req.body)) {
        throw new InputError('Request body must be a JSON object');
      }

      const stream = req.body.stream;
      if (stream === true) {
        throw new InputError('Streaming is not supported by this endpoint');
      }

      const messages = req.body.messages;
      if (!Array.isArray(messages) || messages.length === 0) {
        throw new InputError('`messages` must be a non-empty array');
      }

      const credentials = await httpAuth.credentials(req, {
        allow: ['user', 'service', 'none'],
      });

      const userEntityRef =
        credentials.principal.type === 'user'
          ? credentials.principal.userEntityRef
          : undefined;

      const requestModel =
        typeof req.body.model === 'string' ? req.body.model : undefined;

      const model = requestModel ?? litellm.model;
      if (!model) {
        throw new InputError(
          'No model configured; set ai.litellm.model or pass model in the request body',
        );
      }

      const upstreamUrl = resolveChatCompletionsUrl(litellm.baseUrl);
      const upstreamBody = {
        ...req.body,
        model,
      };

      const upstreamHeaders: Record<string, string> = {
        'content-type': 'application/json',
      };
      if (litellm.apiKey) {
        upstreamHeaders.authorization = `Bearer ${litellm.apiKey}`;
      }
      if (userEntityRef) {
        upstreamHeaders['x-backstage-user'] = userEntityRef;
      }

      const upstreamResponse = await fetch(upstreamUrl, {
        method: 'POST',
        headers: upstreamHeaders,
        body: JSON.stringify(upstreamBody),
        signal: AbortSignal.timeout(60_000),
      });

      const contentType = upstreamResponse.headers.get('content-type') ?? '';
      const raw = await upstreamResponse.text();

      logger.debug(
        `LiteLLM chat completion: status=${upstreamResponse.status} user=${
          userEntityRef ?? 'n/a'
        }`,
      );

      res.status(upstreamResponse.status);
      if (contentType.includes('application/json')) {
        res.setHeader('content-type', 'application/json');
        res.send(raw);
        return;
      }

      res.setHeader('content-type', contentType || 'text/plain');
      res.send(raw);
    } catch (e) {
      next(e);
    }
  });

  return router;
}
