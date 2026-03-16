# FinFlow - Claude Code Project Guide

## Git Config
- Do NOT add "Co-Authored-By" lines to commit messages
- Git user: Grishma Dahal <grishmadahal1@gmail.com>

## Project Overview
Financial data aggregation hub — processes PDFs and external API data into a unified REST API.
TypeScript + Express + Prisma + PostgreSQL. Uses SOLID principles with DI (tsyringe).

## Quick Commands
```bash
npm run dev            # Start dev server
npm run build          # Compile TypeScript
npm run typecheck      # Type check without emit
npm run test           # Run all tests
npm run test:unit      # Unit tests only
npm run test:integration # Integration tests only
npm run lint           # ESLint
npm run format         # Prettier
npx prisma generate    # Regenerate Prisma client
npx prisma db push     # Push schema to DB
docker compose up      # Start everything (API + Postgres + webhook receiver)
```

## Architecture

```
src/
  core/          # Types, interfaces (IExtractor, IValidator, ITransformer, IRepository), errors
  extractors/    # PDF (Claude SDK) and API extractors (Alpha Vantage, Mock Super Fund)
  transformers/  # Normalise data into unified FinancialRecord schema
  validators/    # Schema, balance reconciliation, duplicate detection — chained via ValidationPipeline
  repositories/  # Prisma-based data access layer
  services/      # PipelineService orchestrates: extract → validate → transform → store
  api/           # Express routes, auth middleware, error handler, webhook routes
  events/        # EventBus (typed EventEmitter) for pipeline events + SSE
  infrastructure/# Job queue, AWS Lambda handler wrappers
  config/        # Zod-validated env config — fails fast on missing vars
```

## Key Patterns
- **Result<T, E>** pattern instead of throwing for expected errors (see `core/types`)
- **ValidationPipeline** chains validators in sequence, aggregates errors/warnings
- **BaseApiExtractor** abstract class with retry, rate limiting, backoff (extend for new sources)
- **EventBus** emits typed pipeline events; WebhookService delivers to registered URLs with HMAC
- All extractors implement `IExtractor` — interchangeable via DI

## Adding a New Data Source
1. Create `src/extractors/api/my-source.ts` extending `BaseApiExtractor`
2. Implement `supports()`, `fetchData()`, and `normalise()`
3. Register in `src/container.ts`
4. No existing code needs modification (Open/Closed principle)

## Environment Variables
Required: `DATABASE_URL`, `ANTHROPIC_API_KEY`, `ALPHA_VANTAGE_API_KEY`, `API_KEY_SALT`, `WEBHOOK_SIGNING_SECRET`
Optional: `PORT` (3000), `LOG_LEVEL` (info), `NODE_ENV` (development)
See `.env.example` for template.

## Code Rules
- Strict TypeScript — no `any` types, use `unknown` + type guards
- All async functions handle errors explicitly
- JSDoc on public methods
- Named constants for magic strings/numbers
- Tests in `tests/unit/` and `tests/integration/` using Jest

## Testing
- Unit tests mock external deps (Anthropic SDK, pdf-parse, Prisma)
- Integration tests use supertest against Express app with mocked DB
- Run `npm test` before committing

## Database
- Prisma v5 with PostgreSQL
- Schema in `prisma/schema.prisma`
- Tables: api_keys, documents, data_sources, financial_records, transactions, webhook_endpoints, webhook_deliveries, pipeline_events
