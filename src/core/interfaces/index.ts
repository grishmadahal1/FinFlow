import { Result, FinancialRecord, ValidationResult, ExtractionContext } from '../types';

/** Interface for data extraction from any source */
export interface IExtractor {
  /** Extract financial data from a raw source */
  extract(context: ExtractionContext): Promise<Result<FinancialRecord>>;
  /** Check if this extractor supports the given source type */
  supports(sourceType: string): boolean;
}

/** Interface for data validation */
export interface IValidator {
  /** Validate a financial record */
  validate(record: FinancialRecord): Promise<ValidationResult>;
  /** Name identifier for this validator */
  readonly name: string;
}

/** Interface for data transformation/normalisation */
export interface ITransformer<TInput, TOutput> {
  /** Transform input data to output format */
  transform(input: TInput): Promise<Result<TOutput>>;
}

/** Interface for data persistence */
export interface IRepository<T> {
  /** Find entity by ID */
  findById(id: string): Promise<T | null>;
  /** Find all entities with optional filter */
  findAll(filter?: Partial<T>): Promise<T[]>;
  /** Create a new entity */
  create(entity: Omit<T, 'id'>): Promise<T>;
  /** Update an existing entity */
  update(id: string, entity: Partial<T>): Promise<T>;
  /** Delete an entity */
  delete(id: string): Promise<boolean>;
}

/** Interface for the event bus */
export interface IEventBus {
  /** Emit an event */
  emit(event: string, payload: Record<string, unknown>): void;
  /** Subscribe to an event */
  on(event: string, handler: (payload: Record<string, unknown>) => void): void;
  /** Remove subscription */
  off(event: string, handler: (payload: Record<string, unknown>) => void): void;
}

/** Interface for webhook delivery */
export interface IWebhookService {
  /** Register a webhook endpoint */
  register(url: string, events: string[], secret: string): Promise<string>;
  /** Deliver event to all subscribed endpoints */
  deliver(event: string, payload: Record<string, unknown>): Promise<void>;
}

/** Interface for queue operations */
export interface IQueue<T> {
  /** Add a job to the queue */
  enqueue(job: T): Promise<string>;
  /** Process jobs from the queue */
  process(handler: (job: T) => Promise<void>): void;
}
