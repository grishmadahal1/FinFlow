---
name: add-validator
description: Create a new validator and wire it into the ValidationPipeline.
---

Create a new validator: $ARGUMENTS

Follow the project's validator pattern:

1. Create `src/validators/<name>-validator.ts` implementing `IValidator` interface
2. Set `readonly name` property
3. Implement `validate(record: FinancialRecord): Promise<ValidationResult>`
4. Return `{ valid, errors, warnings }` — use errors for failures, warnings for non-blocking issues
5. Export from `src/validators/index.ts`
6. Add to the ValidationPipeline array in `src/container.ts`
7. Write a unit test in `tests/unit/validators.test.ts`
8. Run `/check` to verify
