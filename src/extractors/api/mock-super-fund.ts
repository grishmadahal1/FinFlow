import { injectable } from 'tsyringe';
import { BaseApiExtractor } from './base';
import { Result, FinancialRecord, SourceType, ExtractionContext, ok, err } from '../../core/types';
import { ExtractionError, RateLimitError } from '../../core/errors';

const RATE_LIMIT_PROBABILITY = 0.15;
const TIMEOUT_PROBABILITY = 0.1;

/** Mock super fund extractor that simulates real-world API resilience patterns */
@injectable()
export class MockSuperFundExtractor extends BaseApiExtractor {
  constructor() {
    super(10);
  }

  supports(sourceType: string): boolean {
    return sourceType === SourceType.API_SUPER_FUND;
  }

  /** Simulate fetching data from a super fund API with realistic failures */
  protected async fetchData(_context: ExtractionContext): Promise<Result<unknown>> {
    // Simulate network delay
    await new Promise((resolve) => setTimeout(resolve, 200 + Math.random() * 300));

    // Simulate 429 rate limit
    if (Math.random() < RATE_LIMIT_PROBABILITY) {
      return err(new RateLimitError(5000));
    }

    // Simulate 503 timeout
    if (Math.random() < TIMEOUT_PROBABILITY) {
      return err(new ExtractionError('Service temporarily unavailable (503)', 'super_fund'));
    }

    // Simulate inconsistent field naming across API "versions"
    const version = Math.random() > 0.5 ? 'v1' : 'v2';
    const mockData = version === 'v1' ? this.generateV1Response() : this.generateV2Response();

    return ok({ version, data: mockData });
  }

  /** Normalise mock super fund response regardless of version */
  protected async normalise(rawData: unknown): Promise<Result<FinancialRecord>> {
    try {
      const response = rawData as { version: string; data: Record<string, unknown> };
      const data = response.data;

      // Handle inconsistent field names between v1 and v2
      const holderName = (data['account_holder'] ??
        data['accountHolder'] ??
        data['holder_name']) as string;
      const accountNum = (data['account_num'] ??
        data['accountNumber'] ??
        data['acct_no']) as string;
      const institution = (data['fund_name'] ??
        data['fundName'] ??
        data['provider']) as string;
      const startDate = (data['period_from'] ??
        data['periodStart'] ??
        data['start_date']) as string;
      const endDate = (data['period_to'] ?? data['periodEnd'] ?? data['end_date']) as string;
      const openBal = Number(
        data['opening_bal'] ?? data['openingBalance'] ?? data['start_balance']
      );
      const closeBal = Number(
        data['closing_bal'] ?? data['closingBalance'] ?? data['end_balance']
      );
      const txns = (data['transactions'] ?? data['txns'] ?? data['movements']) as Array<
        Record<string, unknown>
      >;

      const transactions = txns.map((t) => ({
        date: String(t['date'] ?? t['txn_date'] ?? t['transaction_date']),
        description: String(t['desc'] ?? t['description'] ?? t['narration']),
        amount: Math.abs(Number(t['amount'] ?? t['value'] ?? t['amt'])),
        type: (Number(t['amount'] ?? t['value'] ?? t['amt']) >= 0
          ? 'credit'
          : 'debit') as 'credit' | 'debit',
        category: String(t['category'] ?? t['type'] ?? 'superannuation'),
      }));

      const record: FinancialRecord = {
        accountHolderName: holderName,
        accountNumberMasked: this.maskAccountNumber(accountNum),
        institution,
        periodStart: startDate,
        periodEnd: endDate,
        openingBalance: openBal,
        closingBalance: closeBal,
        currency: 'AUD',
        transactions,
      };

      return ok(record);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return err(
        new ExtractionError(`Failed to normalise super fund data: ${message}`, 'super_fund')
      );
    }
  }

  private maskAccountNumber(num: string): string {
    if (num.length <= 4) return `XXXX-${num}`;
    return `XXXX-XXXX-${num.slice(-4)}`;
  }

  private generateV1Response(): Record<string, unknown> {
    return {
      account_holder: 'Jane Smith',
      account_num: '987654321',
      fund_name: 'AustralianSuper',
      period_from: '2024-01-01',
      period_to: '2024-03-31',
      opening_bal: 125000.0,
      closing_bal: 128500.75,
      transactions: [
        { date: '2024-01-15', desc: 'Employer contribution', amount: 2500.0, category: 'contribution' },
        { date: '2024-02-15', desc: 'Employer contribution', amount: 2500.0, category: 'contribution' },
        { date: '2024-02-28', desc: 'Insurance premium', amount: -45.25, category: 'insurance' },
        { date: '2024-03-15', desc: 'Employer contribution', amount: 2500.0, category: 'contribution' },
        { date: '2024-03-31', desc: 'Investment earnings', amount: -3954.0, category: 'earnings' },
      ],
    };
  }

  private generateV2Response(): Record<string, unknown> {
    return {
      accountHolder: 'Jane Smith',
      accountNumber: '987654321',
      fundName: 'AustralianSuper',
      periodStart: '2024-01-01',
      periodEnd: '2024-03-31',
      openingBalance: 125000.0,
      closingBalance: 128500.75,
      txns: [
        { txn_date: '2024-01-15', narration: 'Employer SG contribution', value: 2500.0, type: 'contribution' },
        { txn_date: '2024-02-15', narration: 'Employer SG contribution', value: 2500.0, type: 'contribution' },
        { txn_date: '2024-02-28', narration: 'Life insurance premium', value: -45.25, type: 'insurance' },
        { txn_date: '2024-03-15', narration: 'Employer SG contribution', value: 2500.0, type: 'contribution' },
        { txn_date: '2024-03-31', narration: 'Investment return', value: -3954.0, type: 'earnings' },
      ],
    };
  }
}
