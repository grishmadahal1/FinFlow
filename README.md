# FinFlow

> **This project was AI-generated using [Claude Code](https://claude.com/claude-code).** I'm using it as a hands-on way to learn how to work with Claude Code effectively — writing better prompts, optimising workflows, and exploring how to structure code, packages, and architecture collaboratively with AI.

A data aggregation hub that processes PDF documents and external API data into a unified, clean REST API. Built with TypeScript, Express, Prisma, and the Anthropic SDK.

## Architecture

```
                    ┌─────────────────────────────────────────────┐
                    │                REST API (Express)            │
                    │  /documents  /sources  /accounts  /webhooks │
                    └──────────────────┬──────────────────────────┘
                                       │
                    ┌──────────────────┴──────────────────────────┐
                    │           Pipeline Service                   │
                    │    Extract → Validate → Transform → Store    │
                    └──┬──────────────┬───────────────┬───────────┘
                       │              │               │
              ┌────────┴───┐  ┌──────┴──────┐  ┌────┴────────┐
              │ Extractors  │  │ Validators   │  │ Transformer  │
              │ ┌─────────┐ │  │ ┌──────────┐│  │             │
              │ │PDF+Claude│ │  │ │Schema    ││  │ Normalise   │
              │ │AlphaVant │ │  │ │Balance   ││  │ Hash        │
              │ │SuperFund │ │  │ │Duplicate ││  │ Enrich      │
              │ └─────────┘ │  │ └──────────┘│  │             │
              └─────────────┘  └─────────────┘  └─────────────┘
                       │              │               │
                    ┌──┴──────────────┴───────────────┴───────────┐
                    │         PostgreSQL (Prisma ORM)               │
                    └──────────────────┬──────────────────────────┘
                                       │
                    ┌──────────────────┴──────────────────────────┐
                    │           Event Bus → Webhooks                │
                    └─────────────────────────────────────────────┘
```

## Tech Stack

| Technology | Purpose |
|---|---|
| **TypeScript** | Type-safe codebase with strict mode |
| **Express** | REST API framework |
| **Prisma** | Type-safe PostgreSQL ORM |
| **Anthropic SDK** | Claude-powered PDF data extraction |
| **tsyringe** | Dependency injection (SOLID principles) |
| **Zod** | Runtime schema validation |
| **Pino** | Structured JSON logging |
| **Jest** | Unit and integration testing |
| **Docker** | Containerised deployment |
| **AWS Lambda** | Serverless handler wrappers |
| **GitHub Actions** | CI/CD pipeline |

## Getting Started

### Prerequisites

- Node.js 20+
- PostgreSQL 16+ (or Docker)
- Anthropic API key
- Alpha Vantage API key (free tier)

### Docker Setup (Recommended)

```bash
# Clone and configure
cp .env.example .env
# Edit .env with your API keys

# Start all services
docker-compose up -d

# Run database migrations
docker-compose exec api npx prisma db push
```

### Local Setup

```bash
# Install dependencies
npm install

# Generate Prisma client
npx prisma generate

# Configure environment
cp .env.example .env
# Edit .env with your credentials

# Start PostgreSQL (if not using Docker)
# Ensure DATABASE_URL in .env points to your PostgreSQL instance

# Push schema to database
npx prisma db push

# Start development server
npm run dev
```

### Environment Variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `DATABASE_URL` | Yes | - | PostgreSQL connection string |
| `ANTHROPIC_API_KEY` | Yes | - | Claude API key for PDF extraction |
| `ALPHA_VANTAGE_API_KEY` | Yes | - | Alpha Vantage API key |
| `API_KEY_SALT` | Yes | - | Salt for API key hashing (min 16 chars) |
| `WEBHOOK_SIGNING_SECRET` | Yes | - | Secret for HMAC webhook signatures (min 16 chars) |
| `PORT` | No | 3000 | Server port |
| `LOG_LEVEL` | No | info | Pino log level |
| `NODE_ENV` | No | development | Environment mode |

## API Reference

All endpoints except `/health` require the `x-api-key` header.

### Health Check

```bash
curl http://localhost:3000/api/v1/health
```

### Upload PDF Document

```bash
curl -X POST http://localhost:3000/api/v1/documents/upload \
  -H "x-api-key: YOUR_API_KEY" \
  -F "file=@statement.pdf"
```

**Response (202):**
```json
{
  "id": "uuid",
  "filename": "statement.pdf",
  "status": "pending",
  "message": "Document uploaded and processing started"
}
```

### Get Document Status

```bash
curl http://localhost:3000/api/v1/documents/{id} \
  -H "x-api-key: YOUR_API_KEY"
```

### Connect External Data Source

```bash
curl -X POST http://localhost:3000/api/v1/sources/connect \
  -H "x-api-key: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"type": "api_alpha_vantage", "config": {"symbol": "AAPL"}}'
```

### Trigger Data Source Sync

```bash
curl -X POST http://localhost:3000/api/v1/sources/{id}/sync \
  -H "x-api-key: YOUR_API_KEY"
```

### List Accounts

```bash
curl http://localhost:3000/api/v1/accounts \
  -H "x-api-key: YOUR_API_KEY"
```

### Get Account Transactions (Paginated)

```bash
curl "http://localhost:3000/api/v1/accounts/{id}/transactions?page=1&limit=20&type=debit" \
  -H "x-api-key: YOUR_API_KEY"
```

### Stream Pipeline Events (SSE)

```bash
curl http://localhost:3000/api/v1/pipeline/events \
  -H "x-api-key: YOUR_API_KEY"
```

### Register Webhook

```bash
curl -X POST http://localhost:3000/api/v1/webhooks/register \
  -H "x-api-key: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"url": "https://your-endpoint.com/webhook", "events": ["extraction.completed", "validation.failed"]}'
```

## PDF Extraction

The PDF extraction pipeline uses Claude (`claude-sonnet-4-20250514`) to parse financial documents:

1. **Text Extraction**: `pdf-parse` extracts raw text from uploaded PDFs
2. **LLM Extraction**: The text is sent to Claude with a structured prompt requesting JSON output
3. **Schema Validation**: The LLM response is validated against a Zod schema
4. **Retry Logic**: Exponential backoff on API failures (3 retries)

### Tuning the Extraction Prompt

The extraction prompt is defined in `src/extractors/pdf/index.ts`. To modify:

- Adjust the `EXTRACTION_PROMPT` constant
- Add or remove fields from the expected JSON structure
- Update the corresponding `FinancialRecordSchema` in `src/core/types/index.ts`
- Update Prisma schema if persisted fields change

### Limitations

- Scanned/image-based PDFs are flagged as unsupported (no OCR)
- Very large PDFs may exceed Claude's context window
- Non-English documents may produce inconsistent results

## Adding a New Data Source

The project follows the Open/Closed principle — add new extractors without modifying existing code:

1. **Create extractor** in `src/extractors/api/`:

```typescript
import { injectable } from 'tsyringe';
import { BaseApiExtractor } from './base';
import { Result, FinancialRecord, ExtractionContext, ok, err } from '../../core/types';

@injectable()
export class MyNewExtractor extends BaseApiExtractor {
  constructor() {
    super(10); // requests per minute
  }

  supports(sourceType: string): boolean {
    return sourceType === 'my_new_source';
  }

  protected async fetchData(context: ExtractionContext): Promise<Result<unknown>> {
    // Fetch from your API
  }

  protected async normalise(rawData: unknown): Promise<Result<FinancialRecord>> {
    // Normalise to FinancialRecord schema
  }
}
```

2. **Register in DI container** (`src/container.ts`):

```typescript
container.registerSingleton('MyNewExtractor', MyNewExtractor);
```

3. **Add to PipelineService** (`src/services/pipeline-service.ts`):

```typescript
// Inject the new extractor and add to getExtractorForType()
```

4. **Add source type** to `SourceType` in `src/core/types/index.ts`

## Testing

```bash
# Run all tests
npm test

# Run unit tests only
npm run test:unit

# Run integration tests
npm run test:integration

# Type check
npm run typecheck
```

## Project Structure

```
src/
├── core/
│   ├── interfaces/     # IExtractor, IValidator, ITransformer, IRepository
│   ├── types/          # Domain types, Zod schemas, Result pattern
│   └── errors/         # Custom error hierarchy (ExtractionError, etc.)
├── extractors/
│   ├── pdf/            # Claude-powered PDF extraction
│   └── api/            # Alpha Vantage + Mock Super Fund extractors
├── transformers/       # Normalisation, hashing, enrichment
├── validators/         # Schema, balance reconciliation, duplicate detection
├── repositories/       # Prisma data access layer
├── services/           # Pipeline orchestration
├── api/
│   ├── routes/         # Express route handlers
│   ├── middleware/      # Auth, error handling, validation
│   └── webhooks/       # Webhook delivery service
├── events/             # EventEmitter-based event bus
├── infrastructure/
│   ├── aws/            # Lambda handler wrappers
│   └── queue/          # In-memory job queue
├── config/             # Zod-validated environment config
├── container.ts        # tsyringe DI setup
├── app.ts              # Express app factory
└── index.ts            # Entry point
```

## Known Limitations & Future Improvements

- **In-memory job queue**: Replace with Redis/SQS for production workloads
- **No OCR**: Scanned PDFs are unsupported; could add Tesseract or AWS Textract
- **Simple auth**: API key-based; should add JWT/OAuth2 for production
- **No pagination on all list endpoints**: Only transactions are paginated currently
- **Single-node events**: EventEmitter is process-local; use Redis Pub/Sub for multi-node
- **Lambda handlers are stubs**: Full DI container integration pending for Lambda deployment
- **No database migrations**: Using `prisma db push` for simplicity; add migrations for production
