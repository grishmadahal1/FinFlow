import { injectable, inject } from 'tsyringe';
import { PrismaClient, PipelineEvent, Prisma } from '@prisma/client';

/** Repository for pipeline event persistence */
@injectable()
export class PipelineEventRepository {
  constructor(@inject('PrismaClient') private prisma: PrismaClient) {}

  /** Create a new pipeline event */
  async create(eventType: string, payload: Record<string, unknown>): Promise<PipelineEvent> {
    return this.prisma.pipelineEvent.create({
      data: { eventType, payloadJson: payload as Prisma.InputJsonValue },
    });
  }

  /** Find recent pipeline events */
  async findRecent(limit: number = 50): Promise<PipelineEvent[]> {
    return this.prisma.pipelineEvent.findMany({
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  /** Find events after a given timestamp (for SSE) */
  async findAfter(since: Date): Promise<PipelineEvent[]> {
    return this.prisma.pipelineEvent.findMany({
      where: { createdAt: { gt: since } },
      orderBy: { createdAt: 'asc' },
    });
  }
}
