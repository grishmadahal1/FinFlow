import { Router, Request, Response, NextFunction } from 'express';
import { container } from 'tsyringe';
import { z } from 'zod';
import { FinancialRecordRepository } from '../../repositories/financial-record-repository';
import { TransactionRepository } from '../../repositories/transaction-repository';
import { NotFoundError } from '../../core/errors';

const PaginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  type: z.enum(['debit', 'credit']).optional(),
  category: z.string().optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
});

/** Create account routes */
export function createAccountRoutes(): Router {
  const router = Router();
  const recordRepo = container.resolve<FinancialRecordRepository>('FinancialRecordRepository');
  const transactionRepo = container.resolve<TransactionRepository>('TransactionRepository');

  /** GET /api/v1/accounts — List all normalised accounts */
  router.get('/', async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const accounts = await recordRepo.findAllAccounts();
      res.json({
        data: accounts.map((a) => ({
          id: a.id,
          accountNumberMasked: a.accountNumberMasked,
          accountHolderName: a.accountHolderName,
          institution: a.institution,
          currency: a.currency,
          latestPeriodEnd: a.periodEnd,
          closingBalance: a.closingBalance,
        })),
      });
    } catch (error) {
      next(error);
    }
  });

  /** GET /api/v1/accounts/:id/transactions — Paginated transaction list */
  router.get('/:id/transactions', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = req.params.id as string;
      const record = await recordRepo.findById(id);
      if (!record) {
        throw new NotFoundError('Account', id);
      }

      const params = PaginationSchema.parse(req.query);
      const result = await transactionRepo.findPaginated(
        {
          recordId: id,
          type: params.type,
          category: params.category,
          dateFrom: params.dateFrom ? new Date(params.dateFrom) : undefined,
          dateTo: params.dateTo ? new Date(params.dateTo) : undefined,
        },
        { page: params.page, limit: params.limit }
      );

      res.json(result);
    } catch (error) {
      next(error);
    }
  });

  return router;
}
