import { injectable } from 'tsyringe';
import { IValidator } from '../core/interfaces';
import { FinancialRecord, ValidationResult } from '../core/types';

const TOLERANCE = 0.01;

/** Verifies that opening balance + transactions = closing balance */
@injectable()
export class BalanceReconciliationValidator implements IValidator {
  readonly name = 'BalanceReconciliationValidator';

  /** Validate that opening balance + net transactions equals closing balance */
  async validate(record: FinancialRecord): Promise<ValidationResult> {
    const warnings: string[] = [];
    const netTransactions = record.transactions.reduce((sum, t) => {
      return t.type === 'credit' ? sum + t.amount : sum - t.amount;
    }, 0);

    const expectedClosing = record.openingBalance + netTransactions;
    const difference = Math.abs(expectedClosing - record.closingBalance);

    if (difference > TOLERANCE) {
      return {
        valid: false,
        errors: [
          {
            field: 'closingBalance',
            message: `Balance mismatch: opening (${record.openingBalance}) + net transactions (${netTransactions.toFixed(2)}) = ${expectedClosing.toFixed(2)}, but closing balance is ${record.closingBalance}. Difference: ${difference.toFixed(2)}`,
            code: 'BALANCE_MISMATCH',
          },
        ],
        warnings,
      };
    }

    if (difference > 0) {
      warnings.push(`Minor rounding difference of ${difference.toFixed(4)} detected`);
    }

    return { valid: true, errors: [], warnings };
  }
}
