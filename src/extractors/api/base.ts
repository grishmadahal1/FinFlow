import { IExtractor } from '../../core/interfaces';
import { Result, FinancialRecord, ExtractionContext, err } from '../../core/types';
import { ExtractionError, isRetryableError } from '../../core/errors';
import pino from 'pino';

const logger = pino({ name: 'api-extractor' });

export interface RetryConfig {
  maxRetries: number;
  baseDelayMs: number;
  maxDelayMs: number;
}

const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  baseDelayMs: 1000,
  maxDelayMs: 30000,
};

/** Base class for all API-based extractors with retry, rate limiting, and logging */
export abstract class BaseApiExtractor implements IExtractor {
  protected retryConfig: RetryConfig;
  private requestTimestamps: number[] = [];
  private readonly requestsPerMinute: number;

  constructor(requestsPerMinute: number = 5, retryConfig?: Partial<RetryConfig>) {
    this.requestsPerMinute = requestsPerMinute;
    this.retryConfig = { ...DEFAULT_RETRY_CONFIG, ...retryConfig };
  }

  abstract supports(sourceType: string): boolean;

  /** Subclasses implement this to fetch raw data */
  protected abstract fetchData(context: ExtractionContext): Promise<Result<unknown>>;

  /** Subclasses implement this to normalise raw data */
  protected abstract normalise(rawData: unknown): Promise<Result<FinancialRecord>>;

  /** Extract data with retry logic, rate limiting, and logging */
  async extract(context: ExtractionContext): Promise<Result<FinancialRecord>> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= this.retryConfig.maxRetries; attempt++) {
      try {
        await this.enforceRateLimit();

        logger.info({ sourceType: context.sourceType, attempt }, 'Fetching data from API');
        const fetchResult = await this.fetchData(context);
        if (!fetchResult.success) {
          if (isRetryableError(fetchResult.error) && attempt < this.retryConfig.maxRetries) {
            await this.backoff(attempt);
            continue;
          }
          return fetchResult as Result<FinancialRecord>;
        }

        logger.info({ sourceType: context.sourceType }, 'Normalising API response');
        return this.normalise(fetchResult.data);
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        logger.warn({ error: lastError.message, attempt }, 'API request failed');

        if (isRetryableError(error) && attempt < this.retryConfig.maxRetries) {
          await this.backoff(attempt);
          continue;
        }

        return err(
          new ExtractionError(`API extraction failed: ${lastError.message}`, context.sourceType)
        );
      }
    }

    return err(
      new ExtractionError(
        `API extraction failed after ${this.retryConfig.maxRetries} retries: ${lastError?.message}`,
        context.sourceType
      )
    );
  }

  /** Enforce rate limiting */
  private async enforceRateLimit(): Promise<void> {
    const now = Date.now();
    const windowStart = now - 60000;
    this.requestTimestamps = this.requestTimestamps.filter((t) => t > windowStart);

    if (this.requestTimestamps.length >= this.requestsPerMinute) {
      const oldestInWindow = this.requestTimestamps[0];
      const waitTime = oldestInWindow + 60000 - now;
      if (waitTime > 0) {
        logger.info({ waitTime }, 'Rate limit reached, waiting');
        await new Promise((resolve) => setTimeout(resolve, waitTime));
      }
    }

    this.requestTimestamps.push(Date.now());
  }

  /** Exponential backoff with jitter */
  private async backoff(attempt: number): Promise<void> {
    const delay = Math.min(
      this.retryConfig.baseDelayMs * Math.pow(2, attempt),
      this.retryConfig.maxDelayMs
    );
    const jitter = delay * 0.1 * Math.random();
    logger.info({ delay: delay + jitter, attempt }, 'Backing off before retry');
    await new Promise((resolve) => setTimeout(resolve, delay + jitter));
  }
}
