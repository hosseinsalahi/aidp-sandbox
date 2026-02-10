import {
  Content,
  Header,
  Page,
  SupportButton,
  WarningPanel,
} from '@backstage/core-components';
import { Grid } from '@material-ui/core';
import { useApi, configApiRef } from '@backstage/core-plugin-api';
import { AiChat } from './AiChat';

export function AiPage() {
  const configApi = useApi(configApiRef);
  const unauthenticated =
    configApi.getOptionalBoolean('ai.auth.allowUnauthenticated') === true;

  return (
    <Page themeId="tool">
      <Header title="AI" subtitle="Chat with your LiteLLM-backed assistant">
        <SupportButton>Uses the Backstage backend `/api/ai/chat` endpoint.</SupportButton>
      </Header>
      <Content>
        <Grid container spacing={3}>
          <Grid item xs={12} md={10} lg={8}>
            {unauthenticated ? (
              <WarningPanel
                title="Dev only: unauthenticated AI endpoint enabled"
                message="`ai.auth.allowUnauthenticated` is true; anyone who can reach this Backstage instance can call the AI proxy."
                severity="warning"
              />
            ) : null}
            <AiChat title="Assistant" allowEntityRefInput />
          </Grid>
        </Grid>
      </Content>
    </Page>
  );
}
