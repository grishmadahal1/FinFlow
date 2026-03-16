import { injectable } from 'tsyringe';
import { EventEmitter } from 'events';
import { IEventBus } from '../core/interfaces';
import { PipelineEventType } from '../core/types';
import pino from 'pino';

const logger = pino({ name: 'event-bus' });

/** Typed internal event bus using Node.js EventEmitter */
@injectable()
export class EventBus implements IEventBus {
  private emitter: EventEmitter;

  constructor() {
    this.emitter = new EventEmitter();
    this.emitter.setMaxListeners(50);
  }

  /** Emit a typed event */
  emit(event: string, payload: Record<string, unknown>): void {
    logger.debug({ event, payload }, 'Event emitted');
    this.emitter.emit(event, payload);
  }

  /** Subscribe to an event */
  on(event: string, handler: (payload: Record<string, unknown>) => void): void {
    this.emitter.on(event, handler);
  }

  /** Unsubscribe from an event */
  off(event: string, handler: (payload: Record<string, unknown>) => void): void {
    this.emitter.off(event, handler);
  }

  /** Get list of all valid pipeline event types */
  getEventTypes(): string[] {
    return Object.values(PipelineEventType);
  }
}
