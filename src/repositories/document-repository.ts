import { injectable, inject } from 'tsyringe';
import { PrismaClient, Document } from '@prisma/client';
import { IRepository } from '../core/interfaces';

/** Repository for document persistence operations */
@injectable()
export class DocumentRepository implements IRepository<Document> {
  constructor(@inject('PrismaClient') private prisma: PrismaClient) {}

  /** Find a document by ID */
  async findById(id: string): Promise<Document | null> {
    return this.prisma.document.findUnique({ where: { id } });
  }

  /** Find all documents with optional filter */
  async findAll(filter?: Partial<Document>): Promise<Document[]> {
    return this.prisma.document.findMany({
      where: filter as Record<string, unknown>,
      orderBy: { createdAt: 'desc' },
    });
  }

  /** Create a new document record */
  async create(data: Omit<Document, 'id'>): Promise<Document> {
    return this.prisma.document.create({ data });
  }

  /** Update an existing document */
  async update(id: string, data: Partial<Document>): Promise<Document> {
    return this.prisma.document.update({ where: { id }, data });
  }

  /** Delete a document */
  async delete(id: string): Promise<boolean> {
    await this.prisma.document.delete({ where: { id } });
    return true;
  }

  /** Find a document by ID with its financial records and transactions */
  async findByIdWithRecords(id: string) {
    return this.prisma.document.findUnique({
      where: { id },
      include: {
        financialRecords: {
          include: { transactions: true },
        },
      },
    });
  }
}
