import { Request, Response, NextFunction } from 'express';
import { injectable, inject } from 'tsyringe';
import { ApiKeyRepository } from '../../repositories/api-key-repository';
import { AuthenticationError } from '../../core/errors';

const API_KEY_HEADER = 'x-api-key';

/** API key authentication middleware factory */
@injectable()
export class AuthMiddleware {
  constructor(@inject('ApiKeyRepository') private apiKeyRepo: ApiKeyRepository) {}

  /** Create Express middleware that validates API key from header */
  authenticate() {
    return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
      const apiKey = req.header(API_KEY_HEADER);
      if (!apiKey) {
        next(new AuthenticationError('API key is required. Provide it via the x-api-key header.'));
        return;
      }

      const keyRecord = await this.apiKeyRepo.validateKey(apiKey);
      if (!keyRecord) {
        next(new AuthenticationError('Invalid API key'));
        return;
      }

      (req as Request & { apiKeyName?: string }).apiKeyName = keyRecord.name;
      next();
    };
  }
}
