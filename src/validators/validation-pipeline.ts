import { injectable } from 'tsyringe';
import { IValidator } from '../core/interfaces';
import { FinancialRecord, ValidationResult } from '../core/types';

/** Runs all validators in sequence, aggregating results */
@injectable()
export class ValidationPipeline {
  private validators: IValidator[];

  constructor(validators: IValidator[]) {
    this.validators = validators;
  }

  /** Run all validators and aggregate results */
  async validate(record: FinancialRecord): Promise<ValidationResult> {
    const allErrors: ValidationResult['errors'] = [];
    const allWarnings: string[] = [];

    for (const validator of this.validators) {
      const result = await validator.validate(record);
      allErrors.push(...result.errors);
      allWarnings.push(...result.warnings);
    }

    return {
      valid: allErrors.length === 0,
      errors: allErrors,
      warnings: allWarnings,
    };
  }
}
