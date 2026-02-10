import { Content, Header, Page, SupportButton } from '@backstage/core-components';
import { Grid } from '@material-ui/core';
import { AiChat } from './AiChat';

export function AiPage() {
  return (
    <Page themeId="tool">
      <Header title="AI" subtitle="Chat with your LiteLLM-backed assistant">
        <SupportButton>Uses the Backstage backend `/api/ai/chat` endpoint.</SupportButton>
      </Header>
      <Content>
        <Grid container spacing={3}>
          <Grid item xs={12} md={10} lg={8}>
            <AiChat title="Assistant" />
          </Grid>
        </Grid>
      </Content>
    </Page>
  );
}

