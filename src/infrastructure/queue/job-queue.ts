import { injectable } from 'tsyringe';
import { EventEmitter } from 'events';
import { IQueue } from '../../core/interfaces';
import { v4 as uuidv4 } from 'uuid';
import pino from 'pino';

const logger = pino({ name: 'job-queue' });

export interface Job<T = unknown> {
  id: string;
  data: T;
  attempts: number;
  maxAttempts: number;
  createdAt: Date;
}

/** Simple in-memory job queue for async processing */
@injectable()
export class JobQueue<T = unknown> implements IQueue<T> {
  private queue: Job<T>[] = [];
  private processing = false;
  private handler: ((job: T) => Promise<void>) | null = null;
  private emitter = new EventEmitter();

  /** Add a job to the queue */
  async enqueue(data: T, maxAttempts: number = 3): Promise<string> {
    const job: Job<T> = {
      id: uuidv4(),
      data,
      attempts: 0,
      maxAttempts,
      createdAt: new Date(),
    };

    this.queue.push(job);
    logger.info({ jobId: job.id, queueLength: this.queue.length }, 'Job enqueued');

    this.processNext();
    return job.id;
  }

  /** Register a handler for processing jobs */
  process(handler: (job: T) => Promise<void>): void {
    this.handler = handler;
    this.processNext();
  }

  /** Get current queue length */
  get length(): number {
    return this.queue.length;
  }

  /** Listen for queue events */
  on(event: 'completed' | 'failed', handler: (jobId: string) => void): void {
    this.emitter.on(event, handler);
  }

  /** Process the next job in the queue */
  private async processNext(): Promise<void> {
    if (this.processing || !this.handler || this.queue.length === 0) return;

    this.processing = true;
    const job = this.queue.shift();

    if (!job) {
      this.processing = false;
      return;
    }

    job.attempts++;

    try {
      logger.info({ jobId: job.id, attempt: job.attempts }, 'Processing job');
      await this.handler(job.data);
      logger.info({ jobId: job.id }, 'Job completed');
      this.emitter.emit('completed', job.id);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      logger.error({ jobId: job.id, error: message, attempt: job.attempts }, 'Job failed');

      if (job.attempts < job.maxAttempts) {
        this.queue.push(job);
      } else {
        logger.error({ jobId: job.id }, 'Job permanently failed');
        this.emitter.emit('failed', job.id);
      }
    } finally {
      this.processing = false;
      if (this.queue.length > 0) {
        this.processNext();
      }
    }
  }
}
