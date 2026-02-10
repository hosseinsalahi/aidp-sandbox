import { useCallback, useMemo, useRef, useState } from 'react';
import {
  Button,
  Checkbox,
  FormControlLabel,
  Grid,
  TextField,
  Typography,
} from '@material-ui/core';
import { InfoCard, Progress, ResponseErrorPanel } from '@backstage/core-components';
import { useApi } from '@backstage/core-plugin-api';
import { aiApiRef, type AiChatMessage } from './api';

export function AiChat(props: {
  title?: string;
  placeholder?: string;
  initialMessages?: AiChatMessage[];
  entityRef?: string;
  allowEntityRefInput?: boolean;
}) {
  const {
    title = 'Chat',
    placeholder = 'Ask a question…',
    initialMessages,
    entityRef: initialEntityRef,
    allowEntityRefInput,
  } = props;

  const aiApi = useApi(aiApiRef);
  const [messages, setMessages] = useState<AiChatMessage[]>(
    initialMessages ?? [],
  );
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | undefined>();
  const [streaming, setStreaming] = useState(true);
  const [includeTechDocs, setIncludeTechDocs] = useState(false);
  const [entityRef, setEntityRef] = useState(initialEntityRef ?? '');
  const [maxTokens, setMaxTokens] = useState<string>('');
  const abortControllerRef = useRef<AbortController | undefined>();

  const canSend = useMemo(
    () => !loading && input.trim().length > 0,
    [input, loading],
  );

  const onReset = useCallback(() => {
    abortControllerRef.current?.abort();
    abortControllerRef.current = undefined;
    setMessages(initialMessages ?? []);
    setInput('');
    setError(undefined);
  }, [initialMessages]);

  const onStop = useCallback(() => {
    abortControllerRef.current?.abort();
    abortControllerRef.current = undefined;
    setLoading(false);
  }, []);

  const onSend = useCallback(async () => {
    if (!canSend) {
      return;
    }

    setLoading(true);
    setError(undefined);

    const userMessage: AiChatMessage = { role: 'user', content: input.trim() };
    const nextMessages = [...messages, userMessage];
    setMessages(nextMessages);
    setInput('');

    try {
      const parsedMaxTokens =
        maxTokens.trim().length > 0 ? Number(maxTokens.trim()) : undefined;
      const max_tokens =
        parsedMaxTokens && Number.isFinite(parsedMaxTokens)
          ? parsedMaxTokens
          : undefined;

      const includeDocsRequest = includeTechDocs && entityRef.trim().length > 0;

      if (streaming) {
        const assistantIndex = nextMessages.length;
        setMessages([...nextMessages, { role: 'assistant', content: '' }]);

        const abortController = new AbortController();
        abortControllerRef.current = abortController;

        let accumulated = '';
        for await (const chunk of aiApi.chatStream(
          {
            messages: nextMessages,
            ...(includeDocsRequest
              ? { includeTechDocs: true, entityRef: entityRef.trim() }
              : {}),
            ...(max_tokens ? { max_tokens } : {}),
          },
          { signal: abortController.signal },
        )) {
          accumulated += chunk;
          setMessages(prev => {
            const updated = [...prev];
            if (updated[assistantIndex]?.role === 'assistant') {
              updated[assistantIndex] = {
                role: 'assistant',
                content: accumulated,
              };
            }
            return updated;
          });
        }

        abortControllerRef.current = undefined;
      } else {
        const { assistantText } = await aiApi.chat({
          messages: nextMessages,
          ...(includeDocsRequest
            ? { includeTechDocs: true, entityRef: entityRef.trim() }
            : {}),
          ...(max_tokens ? { max_tokens } : {}),
        });
        setMessages([...nextMessages, { role: 'assistant', content: assistantText }]);
      }
    } catch (e) {
      const err = e as Error;
      if (
        err.name === 'AbortError' ||
        /aborted|abort/i.test(err.message ?? '')
      ) {
        // Keep whatever partial assistant output we already streamed into state.
      } else {
        setError(err);
      }
    } finally {
      setLoading(false);
    }
  }, [
    aiApi,
    canSend,
    entityRef,
    includeTechDocs,
    input,
    maxTokens,
    messages,
    streaming,
  ]);

  return (
    <InfoCard title={title}>
      <Grid container spacing={2}>
        <Grid item xs={12}>
          <Grid container spacing={1} alignItems="center">
            <Grid item>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={streaming}
                    onChange={e => setStreaming(e.target.checked)}
                    color="primary"
                  />
                }
                label="Streaming"
              />
            </Grid>

            <Grid item>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={includeTechDocs}
                    onChange={e => setIncludeTechDocs(e.target.checked)}
                    color="primary"
                    disabled={entityRef.trim().length === 0}
                  />
                }
                label="Include TechDocs"
              />
            </Grid>

            <Grid item xs={12} md>
              {allowEntityRefInput ? (
                <TextField
                  value={entityRef}
                  onChange={e => setEntityRef(e.target.value)}
                  label="Entity ref"
                  placeholder="component:default/my-service"
                  fullWidth
                  variant="outlined"
                  size="small"
                />
              ) : null}
            </Grid>

            <Grid item>
              <TextField
                value={maxTokens}
                onChange={e => setMaxTokens(e.target.value)}
                label="Max tokens"
                placeholder="e.g. 256"
                variant="outlined"
                size="small"
                style={{ width: 140 }}
              />
            </Grid>
          </Grid>
        </Grid>

        <Grid item xs={12}>
          {error ? <ResponseErrorPanel error={error} /> : null}
          {loading ? <Progress /> : null}
        </Grid>

        <Grid item xs={12}>
          {messages.length ? (
            <Grid container spacing={1}>
              {messages.map((m, i) => (
                // eslint-disable-next-line react/no-array-index-key
                <Grid item xs={12} key={i}>
                  <Typography variant="subtitle2" color="textSecondary">
                    {m.role}
                  </Typography>
                  <Typography variant="body1" style={{ whiteSpace: 'pre-wrap' }}>
                    {m.content}
                  </Typography>
                </Grid>
              ))}
            </Grid>
          ) : (
            <Typography variant="body2" color="textSecondary">
              No messages yet.
            </Typography>
          )}
        </Grid>

        <Grid item xs={12}>
          <TextField
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder={placeholder}
            fullWidth
            multiline
            minRows={2}
            variant="outlined"
            onKeyDown={e => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                onSend();
              }
            }}
            helperText="Ctrl+Enter / Cmd+Enter to send"
          />
        </Grid>

        <Grid item xs={12}>
          <Grid container spacing={1}>
            <Grid item>
              <Button
                variant="contained"
                color="primary"
                disabled={!canSend}
                onClick={onSend}
              >
                Send
              </Button>
            </Grid>
            {loading && streaming ? (
              <Grid item>
                <Button variant="outlined" onClick={onStop}>
                  Stop
                </Button>
              </Grid>
            ) : null}
            <Grid item>
              <Button variant="outlined" onClick={onReset} disabled={loading}>
                Reset
              </Button>
            </Grid>
          </Grid>
        </Grid>
      </Grid>
    </InfoCard>
  );
}
