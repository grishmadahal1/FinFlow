import { Router, Request, Response } from 'express';
import { container } from 'tsyringe';
import { PrismaClient } from '@prisma/client';

/** Create health check routes */
export function createHealthRoutes(): Router {
  const router = Router();

  /** GET /api/v1/health — Health check with dependency status */
  router.get('/', async (_req: Request, res: Response) => {
    const health: {
      status: string;
      timestamp: string;
      uptime: number;
      dependencies: Record<string, { status: string; latencyMs?: number; error?: string }>;
    } = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      dependencies: {},
    };

    // Check database
    try {
      const prisma = container.resolve<PrismaClient>('PrismaClient');
      const start = Date.now();
      await prisma.$queryRaw`SELECT 1`;
      health.dependencies.database = {
        status: 'healthy',
        latencyMs: Date.now() - start,
      };
    } catch (error) {
      health.status = 'degraded';
      health.dependencies.database = {
        status: 'unhealthy',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }

    const statusCode = health.status === 'healthy' ? 200 : 503;
    res.status(statusCode).json(health);
  });

  return router;
}
