import { Router, Request, Response, NextFunction } from 'express';
import { container } from 'tsyringe';
import { z } from 'zod';
import { WebhookService } from '../webhooks/webhook-service';
import { validateRequest } from '../middleware/validate-request';
import { randomBytes } from 'crypto';

const RegisterWebhookSchema = z.object({
  url: z.string().url(),
  events: z.array(z.string()).min(1),
});

/** Create webhook routes */
export function createWebhookRoutes(): Router {
  const router = Router();
  const webhookService = container.resolve<WebhookService>('WebhookService');

  /** POST /api/v1/webhooks/register — Register a webhook URL */
  router.post(
    '/register',
    validateRequest(RegisterWebhookSchema),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { url, events } = req.body;
        const secret = randomBytes(32).toString('hex');
        const id = await webhookService.register(url, events, secret);

        res.status(201).json({
          id,
          url,
          events,
          secret, // Only returned once on creation
          message: 'Webhook registered. Store the secret — it will not be shown again.',
        });
      } catch (error) {
        next(error);
      }
    }
  );

  return router;
}
