import { Router, Request, Response, NextFunction } from 'express';
import { container } from 'tsyringe';
import { z } from 'zod';
import { DataSourceRepository } from '../../repositories/data-source-repository';
import { PipelineService } from '../../services/pipeline-service';
import { NotFoundError } from '../../core/errors';
import { validateRequest } from '../middleware/validate-request';

const ConnectSourceSchema = z.object({
  type: z.enum(['api_alpha_vantage', 'api_super_fund']),
  config: z.record(z.unknown()),
});

/** Create data source routes */
export function createSourceRoutes(): Router {
  const router = Router();
  const dataSourceRepo = container.resolve<DataSourceRepository>('DataSourceRepository');
  const pipelineService = container.resolve<PipelineService>('PipelineService');

  /** POST /api/v1/sources/connect — Register a new external data source */
  router.post(
    '/connect',
    validateRequest(ConnectSourceSchema),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { type, config } = req.body;
        const source = await dataSourceRepo.create({
          type,
          configJson: config,
          lastSyncedAt: null,
          createdAt: new Date(),
        });

        res.status(201).json({
          id: source.id,
          type: source.type,
          message: 'Data source connected successfully',
        });
      } catch (error) {
        next(error);
      }
    }
  );

  /** POST /api/v1/sources/:id/sync — Trigger a manual sync */
  router.post('/:id/sync', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = req.params.id as string;
      const source = await dataSourceRepo.findById(id);
      if (!source) {
        throw new NotFoundError('DataSource', id);
      }

      pipelineService.syncDataSource(source.id).catch((error) => {
        console.error('Sync error:', error);
      });

      res.status(202).json({ id: source.id, message: 'Sync triggered' });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
