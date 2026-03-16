import 'reflect-metadata';
import { loadConfig } from './config';
import { configureContainer } from './container';
import { createApp } from './app';
import pino from 'pino';

const logger = pino({ name: 'finflow' });

async function main(): Promise<void> {
  try {
    const config = loadConfig();
    logger.info({ env: config.NODE_ENV }, 'Configuration loaded');

    configureContainer();
    logger.info('DI container configured');

    const app = createApp();
    const port = config.PORT;

    app.listen(port, () => {
      logger.info({ port }, `FinFlow API server running on port ${port}`);
    });
  } catch (error) {
    logger.fatal({ error }, 'Failed to start application');
    process.exit(1);
  }
}

main();
