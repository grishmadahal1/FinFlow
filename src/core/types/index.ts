import { z } from 'zod';

/** Result pattern for operations that can fail */
export type Result<T, E = Error> =
  | { success: true; data: T }
  | { success: false; error: E };

/** Create a success result */
export function ok<T>(data: T): Result<T, never> {
  return { success: true, data };
}

/** Create a failure result */
export function err<E>(error: E): Result<never, E> {
  return { success: false, error };
}

export const TransactionType = {
  DEBIT: 'debit',
  CREDIT: 'credit',
} as const;
export type TransactionType = (typeof TransactionType)[keyof typeof TransactionType];

export const SourceType = {
  PDF: 'pdf',
  API_ALPHA_VANTAGE: 'api_alpha_vantage',
  API_SUPER_FUND: 'api_super_fund',
} as const;
export type SourceType = (typeof SourceType)[keyof typeof SourceType];

export const DocumentStatus = {
  PENDING: 'pending',
  PROCESSING: 'processing',
  COMPLETED: 'completed',
  FAILED: 'failed',
} as const;
export type DocumentStatus = (typeof DocumentStatus)[keyof typeof DocumentStatus];

export const DeliveryStatus = {
  PENDING: 'pending',
  DELIVERED: 'delivered',
  FAILED: 'failed',
} as const;
export type DeliveryStatus = (typeof DeliveryStatus)[keyof typeof DeliveryStatus];

export const TransactionSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD format'),
  description: z.string().min(1),
  amount: z.number(),
  type: z.enum(['debit', 'credit']),
  category: z.string().optional(),
});

export const FinancialRecordSchema = z.object({
  accountHolderName: z.string().min(1),
  accountNumberMasked: z.string().min(1),
  institution: z.string().min(1),
  periodStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  periodEnd: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  openingBalance: z.number(),
  closingBalance: z.number(),
  currency: z.string().length(3).default('AUD'),
  transactions: z.array(TransactionSchema),
});

export type Transaction = z.infer<typeof TransactionSchema>;
export type FinancialRecord = z.infer<typeof FinancialRecordSchema>;

export const PipelineEventType = {
  DOCUMENT_UPLOADED: 'document.uploaded',
  EXTRACTION_COMPLETED: 'extraction.completed',
  EXTRACTION_FAILED: 'extraction.failed',
  VALIDATION_PASSED: 'validation.passed',
  VALIDATION_FAILED: 'validation.failed',
  SYNC_COMPLETED: 'sync.completed',
} as const;
export type PipelineEventType = (typeof PipelineEventType)[keyof typeof PipelineEventType];

export interface PipelineEvent {
  id: string;
  type: PipelineEventType;
  payload: Record<string, unknown>;
  createdAt: Date;
}

export interface ValidationError {
  field: string;
  message: string;
  code: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: string[];
}

export interface WebhookEndpoint {
  id: string;
  url: string;
  secret: string;
  events: string[];
  active: boolean;
}

export interface DataSourceConfig {
  id: string;
  type: SourceType;
  config: Record<string, unknown>;
  lastSyncedAt: Date | null;
}

export interface ExtractionContext {
  sourceId: string;
  sourceType: SourceType;
  rawData: unknown;
}
