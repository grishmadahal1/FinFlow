import { SchemaValidator } from '../../src/validators/schema-validator';
import { BalanceReconciliationValidator } from '../../src/validators/balance-reconciliation-validator';
import { DuplicateDetectionValidator } from '../../src/validators/duplicate-detection-validator';
import { ValidationPipeline } from '../../src/validators/validation-pipeline';
import { FinancialRecord } from '../../src/core/types';

const validRecord: FinancialRecord = {
  accountHolderName: 'John Doe',
  accountNumberMasked: 'XXXX-XXXX-1234',
  institution: 'Test Bank',
  periodStart: '2024-01-01',
  periodEnd: '2024-01-31',
  openingBalance: 1000.0,
  closingBalance: 1150.0,
  currency: 'AUD',
  transactions: [
    { date: '2024-01-05', description: 'Salary', amount: 300.0, type: 'credit', category: 'income' },
    { date: '2024-01-15', description: 'Groceries', amount: 50.0, type: 'debit', category: 'food' },
    { date: '2024-01-20', description: 'Utilities', amount: 100.0, type: 'debit', category: 'bills' },
  ],
};

describe('SchemaValidator', () => {
  const validator = new SchemaValidator();

  it('should pass for a valid record', async () => {
    const result = await validator.validate(validRecord);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should fail for missing required fields', async () => {
    const invalid = { ...validRecord, accountHolderName: '' };
    const result = await validator.validate(invalid);
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('should fail for invalid date format', async () => {
    const invalid = { ...validRecord, periodStart: '01/01/2024' };
    const result = await validator.validate(invalid);
    expect(result.valid).toBe(false);
  });

  it('should fail for invalid transaction type', async () => {
    const invalid = {
      ...validRecord,
      transactions: [
        { date: '2024-01-05', description: 'Test', amount: 100, type: 'transfer' as 'credit', category: 'other' },
      ],
    };
    const result = await validator.validate(invalid);
    expect(result.valid).toBe(false);
  });
});

describe('BalanceReconciliationValidator', () => {
  const validator = new BalanceReconciliationValidator();

  it('should pass when balances reconcile', async () => {
    const result = await validator.validate(validRecord);
    expect(result.valid).toBe(true);
  });

  it('should fail when balances do not reconcile', async () => {
    const mismatch = { ...validRecord, closingBalance: 9999.0 };
    const result = await validator.validate(mismatch);
    expect(result.valid).toBe(false);
    expect(result.errors[0].code).toBe('BALANCE_MISMATCH');
  });

  it('should pass with minor rounding differences and warn', async () => {
    const almostRight = { ...validRecord, closingBalance: 1150.005 };
    const result = await validator.validate(almostRight);
    expect(result.valid).toBe(true);
    expect(result.warnings.length).toBeGreaterThan(0);
  });
});

describe('DuplicateDetectionValidator', () => {
  const validator = new DuplicateDetectionValidator();

  it('should pass with no duplicates', async () => {
    const result = await validator.validate(validRecord);
    expect(result.valid).toBe(true);
    expect(result.warnings).toHaveLength(0);
  });

  it('should warn on duplicate transactions', async () => {
    const withDupes: FinancialRecord = {
      ...validRecord,
      transactions: [
        { date: '2024-01-05', description: 'Salary', amount: 300.0, type: 'credit', category: 'income' },
        { date: '2024-01-05', description: 'Salary', amount: 300.0, type: 'credit', category: 'income' },
      ],
    };
    const result = await validator.validate(withDupes);
    expect(result.valid).toBe(true);
    expect(result.warnings.length).toBeGreaterThan(0);
  });
});

describe('ValidationPipeline', () => {
  const pipeline = new ValidationPipeline([
    new SchemaValidator(),
    new BalanceReconciliationValidator(),
    new DuplicateDetectionValidator(),
  ]);

  it('should aggregate results from all validators', async () => {
    const result = await pipeline.validate(validRecord);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should collect errors from multiple validators', async () => {
    const invalid = {
      ...validRecord,
      accountHolderName: '',
      closingBalance: 9999,
    };
    const result = await pipeline.validate(invalid);
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThanOrEqual(2);
  });
});
