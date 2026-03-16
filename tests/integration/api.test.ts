import 'reflect-metadata';
import request from 'supertest';
import express from 'express';
import { createHealthRoutes } from '../../src/api/routes/health-routes';
import { container } from 'tsyringe';

// Mock PrismaClient
const mockPrisma = {
  $queryRaw: jest.fn().mockResolvedValue([{ '1': 1 }]),
};

jest.mock('../../src/config', () => ({
  getConfig: () => ({
    ANTHROPIC_API_KEY: 'test-key',
    ALPHA_VANTAGE_API_KEY: 'test-key',
    API_KEY_SALT: 'test-salt-minimum-16ch',
    WEBHOOK_SIGNING_SECRET: 'test-secret-minimum-16ch',
    DATABASE_URL: 'postgresql://test:test@localhost:5432/test',
    PORT: 3000,
    LOG_LEVEL: 'info',
    NODE_ENV: 'test',
  }),
  loadConfig: () => ({}),
}));

describe('API Integration Tests', () => {
  let app: express.Application;

  beforeAll(() => {
    container.registerInstance('PrismaClient', mockPrisma);

    app = express();
    app.use(express.json());
    app.use('/api/v1/health', createHealthRoutes());
  });

  afterAll(() => {
    container.clearInstances();
  });

  describe('GET /api/v1/health', () => {
    it('should return healthy status', async () => {
      const response = await request(app).get('/api/v1/health');

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('healthy');
      expect(response.body.dependencies.database.status).toBe('healthy');
      expect(response.body.uptime).toBeGreaterThan(0);
    });

    it('should return degraded when database is down', async () => {
      mockPrisma.$queryRaw.mockRejectedValueOnce(new Error('Connection refused'));

      const response = await request(app).get('/api/v1/health');

      expect(response.status).toBe(503);
      expect(response.body.status).toBe('degraded');
      expect(response.body.dependencies.database.status).toBe('unhealthy');
    });
  });
});
