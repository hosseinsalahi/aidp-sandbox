import {
  coreServices,
  createBackendPlugin,
} from '@backstage/backend-plugin-api';
import { createAiRouter } from './aiRouter';

const aiPlugin = createBackendPlugin({
  pluginId: 'ai',
  register(env) {
    env.registerInit({
      deps: {
        config: coreServices.rootConfig,
        httpAuth: coreServices.httpAuth,
        httpRouter: coreServices.httpRouter,
        logger: coreServices.logger,
      },
      async init({ config, httpAuth, httpRouter, logger }) {
        httpRouter.addAuthPolicy({ path: '/health', allow: 'unauthenticated' });
        if (config.getOptionalBoolean('ai.auth.allowUnauthenticated') === true) {
          httpRouter.addAuthPolicy({ path: '/chat', allow: 'unauthenticated' });
        }
        httpRouter.use(
          await createAiRouter({
            config,
            httpAuth,
            logger,
          }),
        );
      },
    });
  },
});

export default aiPlugin;
