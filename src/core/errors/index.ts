/** Base error for all FinFlow domain errors */
export class FinFlowError extends Error {
  public readonly code: string;
  public readonly statusCode: number;

  constructor(message: string, code: string, statusCode: number = 500) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.statusCode = statusCode;
    Error.captureStackTrace(this, this.constructor);
  }
}

/** Error during data extraction */
export class ExtractionError extends FinFlowError {
  constructor(message: string, public readonly source: string) {
    super(message, 'EXTRACTION_ERROR', 422);
  }
}

/** Error during validation */
export class ValidationError extends FinFlowError {
  constructor(message: string, public readonly fields: string[] = []) {
    super(message, 'VALIDATION_ERROR', 400);
  }
}

/** Error when a resource is not found */
export class NotFoundError extends FinFlowError {
  constructor(resource: string, id: string) {
    super(`${resource} with id ${id} not found`, 'NOT_FOUND', 404);
  }
}

/** Error for rate limiting */
export class RateLimitError extends FinFlowError {
  constructor(public readonly retryAfterMs: number) {
    super('Rate limit exceeded', 'RATE_LIMIT', 429);
  }
}

/** Error for authentication failures */
export class AuthenticationError extends FinFlowError {
  constructor(message: string = 'Authentication required') {
    super(message, 'AUTH_ERROR', 401);
  }
}

/** Error for unsupported operations */
export class UnsupportedError extends FinFlowError {
  constructor(message: string) {
    super(message, 'UNSUPPORTED', 415);
  }
}

/** Classify if an error is retryable */
export function isRetryableError(error: unknown): boolean {
  if (error instanceof RateLimitError) return true;
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    return (
      message.includes('timeout') ||
      message.includes('econnreset') ||
      message.includes('503') ||
      message.includes('429')
    );
  }
  return false;
}
