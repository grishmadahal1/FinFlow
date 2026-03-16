import { Router, Request, Response } from 'express';
import { container } from 'tsyringe';
import { EventBus } from '../../events/event-bus';

/** Create pipeline event routes (including SSE) */
export function createPipelineRoutes(): Router {
  const router = Router();
  const eventBus = container.resolve<EventBus>('IEventBus');

  /** GET /api/v1/pipeline/events — SSE stream of live pipeline events */
  router.get('/events', (req: Request, res: Response) => {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    });

    res.write('data: {"type":"connected"}\n\n');

    const handler = (payload: Record<string, unknown>): void => {
      res.write(`data: ${JSON.stringify(payload)}\n\n`);
    };

    const eventTypes = eventBus.getEventTypes();
    for (const eventType of eventTypes) {
      eventBus.on(eventType, handler);
    }

    req.on('close', () => {
      for (const eventType of eventTypes) {
        eventBus.off(eventType, handler);
      }
    });
  });

  return router;
}
