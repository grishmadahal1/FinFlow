import { injectable } from 'tsyringe';
import { createHash } from 'crypto';
import { IValidator } from '../core/interfaces';
import { FinancialRecord, ValidationResult } from '../core/types';

/** Detects duplicate transactions by hash of (date + amount + description) */
@injectable()
export class DuplicateDetectionValidator implements IValidator {
  readonly name = 'DuplicateDetectionValidator';

  /** Check for duplicate transactions within a record */
  async validate(record: FinancialRecord): Promise<ValidationResult> {
    const seen = new Map<string, number>();
    const warnings: string[] = [];

    for (let i = 0; i < record.transactions.length; i++) {
      const t = record.transactions[i];
      const hashInput = `${t.date}|${t.amount}|${t.description}`;
      const hash = createHash('sha256').update(hashInput).digest('hex').slice(0, 16);

      if (seen.has(hash)) {
        warnings.push(
          `Transaction at index ${i} ("${t.description}" on ${t.date} for ${t.amount}) is a potential duplicate of transaction at index ${seen.get(hash)}`
        );
      } else {
        seen.set(hash, i);
      }
    }

    return {
      valid: true, // duplicates are warnings, not errors
      errors: [],
      warnings,
    };
  }
}
