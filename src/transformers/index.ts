import { injectable } from 'tsyringe';
import { ITransformer } from '../core/interfaces';
import { Result, FinancialRecord, ok, err } from '../core/types';
import { createHash } from 'crypto';

export interface TransformedRecord {
  record: FinancialRecord;
  transactionHashes: string[];
  metadata: {
    transformedAt: Date;
    transactionCount: number;
    netChange: number;
  };
}

/** Normalise and enrich financial records for storage */
@injectable()
export class FinancialRecordTransformer
  implements ITransformer<FinancialRecord, TransformedRecord>
{
  /** Transform a financial record by computing hashes and metadata */
  async transform(input: FinancialRecord): Promise<Result<TransformedRecord>> {
    try {
      const normalisedTransactions = input.transactions.map((t) => ({
        ...t,
        description: t.description.trim().replace(/\s+/g, ' '),
        category: t.category?.toLowerCase().trim(),
      }));

      const transactionHashes = normalisedTransactions.map((t) => {
        const hashInput = `${t.date}|${t.amount}|${t.description}`;
        return createHash('sha256').update(hashInput).digest('hex');
      });

      const netChange = normalisedTransactions.reduce((sum, t) => {
        return t.type === 'credit' ? sum + t.amount : sum - t.amount;
      }, 0);

      const transformed: TransformedRecord = {
        record: { ...input, transactions: normalisedTransactions },
        transactionHashes,
        metadata: {
          transformedAt: new Date(),
          transactionCount: normalisedTransactions.length,
          netChange: Math.round(netChange * 100) / 100,
        },
      };

      return ok(transformed);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown transform error';
      return err(new Error(`Transformation failed: ${message}`));
    }
  }
}
