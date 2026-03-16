import { injectable } from 'tsyringe';
import { IValidator } from '../core/interfaces';
import { FinancialRecord, FinancialRecordSchema, ValidationResult } from '../core/types';

/** Validates structural integrity of financial records using zod schemas */
@injectable()
export class SchemaValidator implements IValidator {
  readonly name = 'SchemaValidator';

  /** Validate record against the FinancialRecord zod schema */
  async validate(record: FinancialRecord): Promise<ValidationResult> {
    const result = FinancialRecordSchema.safeParse(record);
    if (result.success) {
      return { valid: true, errors: [], warnings: [] };
    }

    const errors = result.error.issues.map((issue) => ({
      field: issue.path.join('.'),
      message: issue.message,
      code: 'SCHEMA_INVALID',
    }));

    return { valid: false, errors, warnings: [] };
  }
}
