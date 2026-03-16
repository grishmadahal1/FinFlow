import { injectable, inject } from 'tsyringe';
import { PrismaClient, FinancialRecord, Prisma } from '@prisma/client';

/** Repository for financial record persistence */
@injectable()
export class FinancialRecordRepository {
  constructor(@inject('PrismaClient') private prisma: PrismaClient) {}

  /** Find a financial record by ID */
  async findById(id: string): Promise<FinancialRecord | null> {
    return this.prisma.financialRecord.findUnique({ where: { id } });
  }

  /** Find all financial records */
  async findAll(): Promise<FinancialRecord[]> {
    return this.prisma.financialRecord.findMany({ orderBy: { createdAt: 'desc' } });
  }

  /** Create a new financial record */
  async create(data: Prisma.FinancialRecordUncheckedCreateInput): Promise<FinancialRecord> {
    return this.prisma.financialRecord.create({ data });
  }

  /** Update an existing financial record */
  async update(
    id: string,
    data: Prisma.FinancialRecordUncheckedUpdateInput
  ): Promise<FinancialRecord> {
    return this.prisma.financialRecord.update({ where: { id }, data });
  }

  /** Delete a financial record */
  async delete(id: string): Promise<boolean> {
    await this.prisma.financialRecord.delete({ where: { id } });
    return true;
  }

  /** Create a financial record with its transactions in a single DB transaction */
  async createWithTransactions(
    recordData: Prisma.FinancialRecordUncheckedCreateInput,
    transactions: Array<{
      date: Date;
      description: string;
      amount: number;
      type: string;
      category: string | null;
      hash: string;
      createdAt: Date;
    }>
  ): Promise<FinancialRecord> {
    return this.prisma.$transaction(async (tx) => {
      const record = await tx.financialRecord.create({ data: recordData });

      if (transactions.length > 0) {
        await tx.transaction.createMany({
          data: transactions.map((t) => ({
            ...t,
            recordId: record.id,
          })),
          skipDuplicates: true,
        });
      }

      return record;
    });
  }

  /** Find all accounts (distinct account numbers with latest record info) */
  async findAllAccounts(): Promise<FinancialRecord[]> {
    return this.prisma.financialRecord.findMany({
      distinct: ['accountNumberMasked'],
      orderBy: { createdAt: 'desc' },
    });
  }
}
