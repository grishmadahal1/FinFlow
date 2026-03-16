import { FinancialRecordTransformer } from '../../src/transformers';
import { FinancialRecord } from '../../src/core/types';

describe('FinancialRecordTransformer', () => {
  const transformer = new FinancialRecordTransformer();

  const record: FinancialRecord = {
    accountHolderName: 'John Doe',
    accountNumberMasked: 'XXXX-XXXX-1234',
    institution: 'Test Bank',
    periodStart: '2024-01-01',
    periodEnd: '2024-01-31',
    openingBalance: 1000.0,
    closingBalance: 1150.0,
    currency: 'AUD',
    transactions: [
      { date: '2024-01-05', description: '  Salary  Payment  ', amount: 300.0, type: 'credit', category: 'INCOME' },
      { date: '2024-01-15', description: 'Groceries', amount: 150.0, type: 'debit', category: 'food' },
    ],
  };

  it('should normalise transaction descriptions', async () => {
    const result = await transformer.transform(record);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.record.transactions[0].description).toBe('Salary Payment');
    }
  });

  it('should lowercase categories', async () => {
    const result = await transformer.transform(record);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.record.transactions[0].category).toBe('income');
    }
  });

  it('should compute transaction hashes', async () => {
    const result = await transformer.transform(record);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.transactionHashes).toHaveLength(2);
      expect(result.data.transactionHashes[0]).toHaveLength(64);
    }
  });

  it('should calculate correct metadata', async () => {
    const result = await transformer.transform(record);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.metadata.transactionCount).toBe(2);
      expect(result.data.metadata.netChange).toBe(150.0);
      expect(result.data.metadata.transformedAt).toBeInstanceOf(Date);
    }
  });
});
