import { injectable, inject } from 'tsyringe';
import { PrismaClient, DataSource, Prisma } from '@prisma/client';

/** Repository for external data source configuration */
@injectable()
export class DataSourceRepository {
  constructor(@inject('PrismaClient') private prisma: PrismaClient) {}

  /** Find a data source by ID */
  async findById(id: string): Promise<DataSource | null> {
    return this.prisma.dataSource.findUnique({ where: { id } });
  }

  /** Find all data sources */
  async findAll(): Promise<DataSource[]> {
    return this.prisma.dataSource.findMany({ orderBy: { createdAt: 'desc' } });
  }

  /** Create a new data source */
  async create(data: Prisma.DataSourceCreateInput): Promise<DataSource> {
    return this.prisma.dataSource.create({ data });
  }

  /** Update a data source */
  async update(id: string, data: Prisma.DataSourceUpdateInput): Promise<DataSource> {
    return this.prisma.dataSource.update({ where: { id }, data });
  }

  /** Delete a data source */
  async delete(id: string): Promise<boolean> {
    await this.prisma.dataSource.delete({ where: { id } });
    return true;
  }

  /** Update the last synced timestamp */
  async markSynced(id: string): Promise<DataSource> {
    return this.prisma.dataSource.update({
      where: { id },
      data: { lastSyncedAt: new Date() },
    });
  }
}
