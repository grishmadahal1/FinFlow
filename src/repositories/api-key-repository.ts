import { injectable, inject } from 'tsyringe';
import { PrismaClient, ApiKey } from '@prisma/client';
import { createHash } from 'crypto';
import { IRepository } from '../core/interfaces';
import { getConfig } from '../config';

/** Repository for API key management */
@injectable()
export class ApiKeyRepository implements IRepository<ApiKey> {
  constructor(@inject('PrismaClient') private prisma: PrismaClient) {}

  /** Find an API key by ID */
  async findById(id: string): Promise<ApiKey | null> {
    return this.prisma.apiKey.findUnique({ where: { id } });
  }

  /** Find all API keys */
  async findAll(): Promise<ApiKey[]> {
    return this.prisma.apiKey.findMany({ orderBy: { createdAt: 'desc' } });
  }

  /** Create a new API key */
  async create(data: Omit<ApiKey, 'id'>): Promise<ApiKey> {
    return this.prisma.apiKey.create({ data });
  }

  /** Update an API key */
  async update(id: string, data: Partial<ApiKey>): Promise<ApiKey> {
    return this.prisma.apiKey.update({ where: { id }, data });
  }

  /** Delete an API key */
  async delete(id: string): Promise<boolean> {
    await this.prisma.apiKey.delete({ where: { id } });
    return true;
  }

  /** Validate an API key by hashing and looking up */
  async validateKey(rawKey: string): Promise<ApiKey | null> {
    const hash = this.hashKey(rawKey);
    return this.prisma.apiKey.findUnique({ where: { keyHash: hash } });
  }

  /** Hash a raw API key for storage/lookup */
  hashKey(rawKey: string): string {
    const salt = getConfig().API_KEY_SALT;
    return createHash('sha256').update(`${salt}:${rawKey}`).digest('hex');
  }
}
