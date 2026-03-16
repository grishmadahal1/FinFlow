import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import pino from 'pino';
import { container } from 'tsyringe';
import {
  createDocumentRoutes,
  createSourceRoutes,
  createAccountRoutes,
  createPipelineRoutes,
  createWebhookRoutes,
  createHealthRoutes,
} from './api/routes';
import { AuthMiddleware } from './api/middleware/auth';
import { errorHandler } from './api/middleware/error-handler';
import { WebhookService } from './api/webhooks/webhook-service';

const logger = pino({ name: 'app' });

/** Create and configure the Express application */
export function createApp(): express.Application {
  const app = express();

  // Global middleware
  app.use(helmet());
  app.use(cors());
  app.use(express.json({ limit: '1mb' }));
  app.use(
    rateLimit({
      windowMs: 60 * 1000,
      max: 100,
      standardHeaders: true,
      legacyHeaders: false,
      message: { error: { code: 'RATE_LIMIT', message: 'Too many requests' } },
    })
  );

  // Request logging
  app.use((req, _res, next) => {
    logger.info({ method: req.method, url: req.url }, 'Incoming request');
    next();
  });

  // Health check (no auth required)
  app.use('/api/v1/health', createHealthRoutes());

  // Auth middleware for all other routes
  const authMiddleware = container.resolve<AuthMiddleware>(AuthMiddleware);
  app.use('/api/v1', authMiddleware.authenticate());

  // API routes
  app.use('/api/v1/documents', createDocumentRoutes());
  app.use('/api/v1/sources', createSourceRoutes());
  app.use('/api/v1/accounts', createAccountRoutes());
  app.use('/api/v1/pipeline', createPipelineRoutes());
  app.use('/api/v1/webhooks', createWebhookRoutes());

  // Global error handler
  app.use(errorHandler);

  // Initialize webhook service
  const webhookService = container.resolve<WebhookService>('WebhookService');
  webhookService.init();

  logger.info('Application configured');
  return app;
}
