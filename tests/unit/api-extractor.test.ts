import { MockSuperFundExtractor } from '../../src/extractors/api/mock-super-fund';
import { SourceType, ExtractionContext } from '../../src/core/types';

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
}));

describe('MockSuperFundExtractor', () => {
  let extractor: MockSuperFundExtractor;

  beforeEach(() => {
    extractor = new MockSuperFundExtractor();
  });

  it('should support super fund source type', () => {
    expect(extractor.supports(SourceType.API_SUPER_FUND)).toBe(true);
    expect(extractor.supports(SourceType.PDF)).toBe(false);
  });

  it('should eventually extract data successfully (with retries)', async () => {
    const context: ExtractionContext = {
      sourceId: 'test-source',
      sourceType: SourceType.API_SUPER_FUND,
      rawData: {},
    };

    let successCount = 0;
    const attempts = 5;

    for (let i = 0; i < attempts; i++) {
      const result = await extractor.extract(context);
      if (result.success) {
        successCount++;
        expect(result.data.accountHolderName).toBe('Jane Smith');
        expect(result.data.institution).toBe('AustralianSuper');
        expect(result.data.transactions.length).toBeGreaterThan(0);
      }
    }

    // With retries, we should succeed at least once
    expect(successCount).toBeGreaterThan(0);
  }, 30000);
});
