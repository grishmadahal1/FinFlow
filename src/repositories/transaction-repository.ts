import { injectable, inject } from 'tsyringe';
import { PrismaClient, Transaction } from '@prisma/client';
import { IRepository } from '../core/interfaces';

export interface TransactionFilter {
  recordId?: string;
  type?: string;
  category?: string;
  dateFrom?: Date;
  dateTo?: Date;
}

export interface PaginationOptions {
  page: number;
  limit: number;
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

/** Repository for transaction persistence with pagination and filtering */
@injectable()
export class TransactionRepository implements IRepository<Transaction> {
  constructor(@inject('PrismaClient') private prisma: PrismaClient) {}

  /** Find a transaction by ID */
  async findById(id: string): Promise<Transaction | null> {
    return this.prisma.transaction.findUnique({ where: { id } });
  }

  /** Find all transactions */
  async findAll(filter?: Partial<Transaction>): Promise<Transaction[]> {
    return this.prisma.transaction.findMany({
      where: filter as Record<string, unknown>,
      orderBy: { date: 'desc' },
    });
  }

  /** Create a new transaction */
  async create(data: Omit<Transaction, 'id'>): Promise<Transaction> {
    return this.prisma.transaction.create({ data });
  }

  /** Update a transaction */
  async update(id: string, data: Partial<Transaction>): Promise<Transaction> {
    return this.prisma.transaction.update({ where: { id }, data });
  }

  /** Delete a transaction */
  async delete(id: string): Promise<boolean> {
    await this.prisma.transaction.delete({ where: { id } });
    return true;
  }

  /** Find transactions with filtering and pagination */
  async findPaginated(
    filter: TransactionFilter,
    pagination: PaginationOptions
  ): Promise<PaginatedResult<Transaction>> {
    const where: Record<string, unknown> = {};

    if (filter.recordId) where.recordId = filter.recordId;
    if (filter.type) where.type = filter.type;
    if (filter.category) where.category = filter.category;
    if (filter.dateFrom || filter.dateTo) {
      where.date = {} as Record<string, unknown>;
      if (filter.dateFrom) (where.date as Record<string, unknown>).gte = filter.dateFrom;
      if (filter.dateTo) (where.date as Record<string, unknown>).lte = filter.dateTo;
    }

    const [data, total] = await Promise.all([
      this.prisma.transaction.findMany({
        where,
        orderBy: { date: 'desc' },
        skip: (pagination.page - 1) * pagination.limit,
        take: pagination.limit,
      }),
      this.prisma.transaction.count({ where }),
    ]);

    return {
      data,
      total,
      page: pagination.page,
      limit: pagination.limit,
      totalPages: Math.ceil(total / pagination.limit),
    };
  }
}
