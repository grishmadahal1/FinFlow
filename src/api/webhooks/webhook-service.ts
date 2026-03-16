import { injectable, inject } from 'tsyringe';
import { createHmac } from 'crypto';
import { IWebhookService, IEventBus } from '../../core/interfaces';
import { PrismaClient, Prisma } from '@prisma/client';
import pino from 'pino';

const logger = pino({ name: 'webhook-service' });

const MAX_DELIVERY_ATTEMPTS = 3;
const DELIVERY_BACKOFF_MS = 2000;

/** Manages webhook registration and event delivery with HMAC signatures */
@injectable()
export class WebhookService implements IWebhookService {
  constructor(
    @inject('PrismaClient') private prisma: PrismaClient,
    @inject('IEventBus') private eventBus: IEventBus
  ) {}

  /** Initialize event subscriptions for webhook delivery */
  init(): void {
    const eventTypes = [
      'document.uploaded',
      'extraction.completed',
      'extraction.failed',
      'validation.passed',
      'validation.failed',
      'sync.completed',
    ];

    for (const eventType of eventTypes) {
      this.eventBus.on(eventType, (payload) => {
        this.deliver(eventType, payload).catch((error) => {
          logger.error({ error, eventType }, 'Failed to deliver webhook');
        });
      });
    }
  }

  /** Register a new webhook endpoint */
  async register(url: string, events: string[], secret: string): Promise<string> {
    const endpoint = await this.prisma.webhookEndpoint.create({
      data: { url, secret, eventsJson: events, active: true },
    });

    logger.info({ endpointId: endpoint.id, url }, 'Webhook endpoint registered');
    return endpoint.id;
  }

  /** Deliver event payload to all matching webhook endpoints */
  async deliver(event: string, payload: Record<string, unknown>): Promise<void> {
    const endpoints = await this.prisma.webhookEndpoint.findMany({
      where: { active: true },
    });

    const matching = endpoints.filter((ep) => {
      const events = ep.eventsJson as string[];
      return events.includes(event) || events.includes('*');
    });

    const deliveryPromises = matching.map((endpoint) =>
      this.deliverToEndpoint(endpoint.id, endpoint.url, endpoint.secret, event, payload)
    );

    await Promise.allSettled(deliveryPromises);
  }

  /** Deliver to a single endpoint with retries */
  private async deliverToEndpoint(
    endpointId: string,
    url: string,
    secret: string,
    event: string,
    payload: Record<string, unknown>
  ): Promise<void> {
    const delivery = await this.prisma.webhookDelivery.create({
      data: {
        endpointId,
        eventType: event,
        payloadJson: payload as Prisma.InputJsonValue,
        status: 'pending',
        attempts: 0,
      },
    });

    for (let attempt = 1; attempt <= MAX_DELIVERY_ATTEMPTS; attempt++) {
      try {
        const body = JSON.stringify({ event, payload, deliveryId: delivery.id });
        const signature = createHmac('sha256', secret).update(body).digest('hex');

        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-FinFlow-Signature': signature,
            'X-FinFlow-Event': event,
          },
          body,
          signal: AbortSignal.timeout(10000),
        });

        if (response.ok) {
          await this.prisma.webhookDelivery.update({
            where: { id: delivery.id },
            data: { status: 'delivered', attempts: attempt },
          });
          logger.info({ deliveryId: delivery.id, endpointId, attempt }, 'Webhook delivered');
          return;
        }

        throw new Error(`HTTP ${response.status}`);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        logger.warn({ deliveryId: delivery.id, attempt, error: errorMessage }, 'Webhook delivery failed');

        await this.prisma.webhookDelivery.update({
          where: { id: delivery.id },
          data: { attempts: attempt, lastError: errorMessage },
        });

        if (attempt < MAX_DELIVERY_ATTEMPTS) {
          await new Promise((resolve) => setTimeout(resolve, DELIVERY_BACKOFF_MS * attempt));
        }
      }
    }

    await this.prisma.webhookDelivery.update({
      where: { id: delivery.id },
      data: { status: 'failed' },
    });
    logger.error({ deliveryId: delivery.id, endpointId }, 'Webhook delivery permanently failed');
  }
}
