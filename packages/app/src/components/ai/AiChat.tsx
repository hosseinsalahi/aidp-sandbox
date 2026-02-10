import { useCallback, useMemo, useState } from 'react';
import { Button, Grid, TextField, Typography } from '@material-ui/core';
import { InfoCard, Progress, ResponseErrorPanel } from '@backstage/core-components';
import { useApi } from '@backstage/core-plugin-api';
import { aiApiRef, type AiChatMessage } from './api';

export function AiChat(props: {
  title?: string;
  placeholder?: string;
  initialMessages?: AiChatMessage[];
}) {
  const { title = 'Chat', placeholder = 'Ask a question…', initialMessages } = props;

  const aiApi = useApi(aiApiRef);
  const [messages, setMessages] = useState<AiChatMessage[]>(
    initialMessages ?? [],
  );
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | undefined>();

  const canSend = useMemo(
    () => !loading && input.trim().length > 0,
    [input, loading],
  );

  const onReset = useCallback(() => {
    setMessages(initialMessages ?? []);
    setInput('');
    setError(undefined);
  }, [initialMessages]);

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
      const { assistantText } = await aiApi.chat({ messages: nextMessages });
      setMessages([...nextMessages, { role: 'assistant', content: assistantText }]);
    } catch (e) {
      setError(e as Error);
      setMessages(nextMessages);
    } finally {
      setLoading(false);
    }
  }, [aiApi, canSend, input, messages]);

  return (
    <InfoCard title={title}>
      <Grid container spacing={2}>
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
