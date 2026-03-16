import { PdfExtractor } from '../../src/extractors/pdf';
import { SourceType, ExtractionContext } from '../../src/core/types';

// Mock the Anthropic SDK
jest.mock('@anthropic-ai/sdk', () => {
  return {
    __esModule: true,
    default: jest.fn().mockImplementation(() => ({
      messages: {
        create: jest.fn().mockResolvedValue({
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                accountHolderName: 'John Doe',
                accountNumberMasked: 'XXXX-XXXX-5678',
                institution: 'Test Bank',
                periodStart: '2024-01-01',
                periodEnd: '2024-01-31',
                openingBalance: 1000.0,
                closingBalance: 1200.0,
                currency: 'AUD',
                transactions: [
                  {
                    date: '2024-01-15',
                    description: 'Salary payment',
                    amount: 200.0,
                    type: 'credit',
                    category: 'salary',
                  },
                ],
              }),
            },
          ],
        }),
      },
    })),
  };
});

// Mock pdf-parse
jest.mock('pdf-parse', () => {
  return jest.fn().mockResolvedValue({
    text: 'Account Statement\nJohn Doe\nAccount: 1234567890\nOpening Balance: $1,000.00\nClosing Balance: $1,200.00\nTransaction: Jan 15 - Salary $200.00 CR',
    numpages: 1,
    info: {},
  });
});

// Mock config
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

describe('PdfExtractor', () => {
  let extractor: PdfExtractor;

  beforeEach(() => {
    extractor = new PdfExtractor();
  });

  it('should support PDF source type', () => {
    expect(extractor.supports(SourceType.PDF)).toBe(true);
    expect(extractor.supports('api_alpha_vantage')).toBe(false);
  });

  it('should reject non-buffer input', async () => {
    const context: ExtractionContext = {
      sourceId: 'test',
      sourceType: SourceType.PDF,
      rawData: 'not a buffer',
    };

    const result = await extractor.extract(context);
    expect(result.success).toBe(false);
  });

  it('should extract data from a valid PDF buffer', async () => {
    const context: ExtractionContext = {
      sourceId: 'test',
      sourceType: SourceType.PDF,
      rawData: Buffer.from('fake-pdf-content'),
    };

    const result = await extractor.extract(context);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.accountHolderName).toBe('John Doe');
      expect(result.data.transactions).toHaveLength(1);
    }
  });

  it('should reject PDFs with too little text content', async () => {
    const pdfParse = require('pdf-parse');
    pdfParse.mockResolvedValueOnce({ text: 'short', numpages: 1, info: {} });

    const context: ExtractionContext = {
      sourceId: 'test',
      sourceType: SourceType.PDF,
      rawData: Buffer.from('fake-pdf'),
    };

    const result = await extractor.extract(context);
    expect(result.success).toBe(false);
  });
});
