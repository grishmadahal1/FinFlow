import { Request, Response, NextFunction } from 'express';
import { FinFlowError } from '../../core/errors';
import { ZodError } from 'zod';
import pino from 'pino';

const logger = pino({ name: 'error-handler' });

/** Global error handler mapping domain errors to HTTP responses */
export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  logger.error({ error: err.message, stack: err.stack, name: err.name }, 'Request error');

  if (err instanceof FinFlowError) {
    res.status(err.statusCode).json({
      error: { code: err.code, message: err.message },
    });
    return;
  }

  if (err instanceof ZodError) {
    res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Request validation failed',
        details: err.issues.map((i) => ({
          path: i.path.join('.'),
          message: i.message,
        })),
      },
    });
    return;
  }

  if (err.message === 'File too large') {
    res.status(413).json({
      error: { code: 'FILE_TOO_LARGE', message: 'Uploaded file exceeds the maximum size limit' },
    });
    return;
  }

  res.status(500).json({
    error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' },
  });
}
