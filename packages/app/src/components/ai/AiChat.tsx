import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Button,
  Checkbox,
  FormControlLabel,
  Grid,
  Paper,
  TextField,
  Typography,
} from '@material-ui/core';
import { makeStyles, fade } from '@material-ui/core/styles';
import {
  CopyTextButton,
  InfoCard,
  MarkdownContent,
  Progress,
  ResponseErrorPanel,
} from '@backstage/core-components';
import { useApi } from '@backstage/core-plugin-api';
import { aiApiRef, type AiChatMessage } from './api';

const useStyles = makeStyles(
  theme => ({
    controlsRow: {
      marginBottom: theme.spacing(1),
    },
    messages: {
      maxHeight: 480,
      overflowY: 'auto',
      padding: theme.spacing(1),
      backgroundColor: theme.palette.background.default,
      border: `1px solid ${theme.palette.divider}`,
      borderRadius: theme.shape.borderRadius,
    },
    messageRow: {
      display: 'flex',
      justifyContent: 'flex-start',
      marginBottom: theme.spacing(1),
    },
    messageRowUser: {
      justifyContent: 'flex-end',
    },
    bubble: {
      maxWidth: '85%',
      padding: theme.spacing(1.25, 1.5),
      borderRadius: theme.shape.borderRadius,
      border: `1px solid ${theme.palette.divider}`,
      background: theme.palette.background.paper,
    },
    bubbleUser: {
      background: fade(theme.palette.primary.main, 0.08),
      borderColor: fade(theme.palette.primary.main, 0.25),
    },
    bubbleSystem: {
      background: fade(theme.palette.grey[500], 0.06),
      borderStyle: 'dashed',
    },
    bubbleHeader: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: theme.spacing(1),
      marginBottom: theme.spacing(0.5),
    },
    role: {
      fontWeight: 600,
      textTransform: 'capitalize',
    },
    markdown: {
      '& > :first-child': {
        marginTop: 0,
      },
      '& > :last-child': {
        marginBottom: 0,
      },
    },
    input: {
      marginTop: theme.spacing(0.5),
    },
  }),
  { name: 'AiChat' },
);

function roleLabel(role: AiChatMessage['role']): string {
  if (role === 'user') return 'You';
  if (role === 'assistant') return 'Assistant';
  return 'System';
}

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

  const classes = useStyles();
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
  const messagesContainerRef = useRef<HTMLDivElement | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const canSend = useMemo(
    () => !loading && input.trim().length > 0,
    [input, loading],
  );

  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container) {
      return;
    }

    const nearBottom =
      container.scrollHeight - container.scrollTop - container.clientHeight < 140;
    if (nearBottom) {
      messagesEndRef.current?.scrollIntoView({ block: 'end' });
    }
  }, [messages.length]);

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
          <Grid container spacing={1} alignItems="center" className={classes.controlsRow}>
            <Grid item>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={streaming}
                    onChange={e => setStreaming(e.target.checked)}
                    color="primary"
                    disabled={loading}
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
                    disabled={loading || entityRef.trim().length === 0}
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
                  disabled={loading}
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
                disabled={loading}
              />
            </Grid>
          </Grid>
        </Grid>

        <Grid item xs={12}>
          {error ? <ResponseErrorPanel error={error} /> : null}
          {loading && !streaming ? <Progress /> : null}
        </Grid>

        <Grid item xs={12}>
          <div ref={messagesContainerRef} className={classes.messages}>
            {messages.length ? (
              messages.map((m, i) => {
                const isUser = m.role === 'user';
                const isSystem = m.role === 'system';
                return (
                  // eslint-disable-next-line react/no-array-index-key
                  <div
                    key={i}
                    className={`${classes.messageRow} ${
                      isUser ? classes.messageRowUser : ''
                    }`.trim()}
                  >
                    <Paper
                      elevation={0}
                      className={`${classes.bubble} ${
                        isUser ? classes.bubbleUser : ''
                      } ${isSystem ? classes.bubbleSystem : ''}`.trim()}
                    >
                      <div className={classes.bubbleHeader}>
                        <Typography
                          variant="caption"
                          color="textSecondary"
                          className={classes.role}
                        >
                          {roleLabel(m.role)}
                        </Typography>
                        <CopyTextButton text={m.content} tooltipText="Copy" />
                      </div>
                      <MarkdownContent
                        className={classes.markdown}
                        content={m.content || (loading && m.role === 'assistant' ? '…' : '')}
                      />
                    </Paper>
                  </div>
                );
              })
            ) : (
              <Typography variant="body2" color="textSecondary">
                No messages yet.
              </Typography>
            )}
            <div ref={messagesEndRef} />
          </div>
        </Grid>

        <Grid item xs={12}>
          <TextField
            className={classes.input}
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder={placeholder}
            fullWidth
            multiline
            minRows={2}
            variant="outlined"
            disabled={loading && streaming}
            onKeyDown={e => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                onSend();
              }
            }}
            helperText={
              loading && streaming
                ? 'Streaming… click Stop to cancel'
                : 'Ctrl+Enter / Cmd+Enter to send'
            }
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
