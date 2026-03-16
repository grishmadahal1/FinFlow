---
name: add-endpoint
description: Add a new API endpoint with validation, DI, and tests.
---

Add a new API endpoint: $ARGUMENTS

Follow the project's existing patterns:

1. Create or edit route file in `src/api/routes/`
2. Use zod schema for request validation via `validateRequest()` middleware
3. Resolve dependencies from the DI container (`container.resolve()`)
4. Use `Result<T, E>` pattern — don't throw for expected errors
5. Pass errors to `next()` for the global error handler
6. Register the route in `src/app.ts` if it's a new route group
7. Write an integration test in `tests/integration/` using supertest
8. Run `/check` to verify
