import { Content, Header, Page } from '@backstage/core-components';
import { Grid } from '@material-ui/core';
import { stringifyEntityRef } from '@backstage/catalog-model';
import { useEntity } from '@backstage/plugin-catalog-react';
import { AiChat } from './AiChat';
import type { AiChatMessage } from './api';

export function EntityAiContent() {
  const { entity } = useEntity();
  const entityRef = stringifyEntityRef(entity);

  const componentSpec = (entity as any).spec ?? {};
  const contextLines = [
    `EntityRef: ${entityRef}`,
    entity.metadata.title ? `Title: ${entity.metadata.title}` : undefined,
    entity.metadata.description
      ? `Description: ${entity.metadata.description}`
      : undefined,
    Array.isArray(entity.metadata.tags) && entity.metadata.tags.length
      ? `Tags: ${entity.metadata.tags.join(', ')}`
      : undefined,
    componentSpec.type ? `Type: ${String(componentSpec.type)}` : undefined,
    componentSpec.owner ? `Owner: ${String(componentSpec.owner)}` : undefined,
    componentSpec.lifecycle
      ? `Lifecycle: ${String(componentSpec.lifecycle)}`
      : undefined,
    componentSpec.system ? `System: ${String(componentSpec.system)}` : undefined,
  ].filter(Boolean);

  const initialMessages: AiChatMessage[] = [
    {
      role: 'system',
      content:
        'You are helping with a Backstage catalog entity. Use the context below when answering.\n\n' +
        contextLines.join('\n'),
    },
  ];

  return (
    <Page themeId="tool">
      <Header title="AI" subtitle={entityRef} />
      <Content>
        <Grid container spacing={3}>
          <Grid item xs={12} md={10} lg={8}>
            <AiChat title="Ask about this component" initialMessages={initialMessages} />
          </Grid>
        </Grid>
      </Content>
    </Page>
  );
}

