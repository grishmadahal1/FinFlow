import { injectable } from 'tsyringe';
import Anthropic from '@anthropic-ai/sdk';

// pdf-parse v2 exports differently
// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdfParse = require('pdf-parse');
import { IExtractor } from '../../core/interfaces';
import {
  Result,
  FinancialRecord,
  FinancialRecordSchema,
  SourceType,
  ExtractionContext,
  ok,
  err,
} from '../../core/types';
import { ExtractionError, UnsupportedError } from '../../core/errors';
import { getConfig } from '../../config';

const MAX_RETRIES = 3;
const BASE_DELAY_MS = 1000;
const MIN_TEXT_LENGTH = 50;

const EXTRACTION_PROMPT = `You are a financial document parser. Extract structured data from the following bank statement or financial document text.

Return a JSON object with exactly this structure:
{
  "accountHolderName": "string - full name of account holder",
  "accountNumberMasked": "string - account number with middle digits masked, e.g., XXXX-XXXX-1234",
  "institution": "string - name of the financial institution",
  "periodStart": "string - start date in YYYY-MM-DD format",
  "periodEnd": "string - end date in YYYY-MM-DD format",
  "openingBalance": number,
  "closingBalance": number,
  "currency": "string - 3-letter currency code, default AUD",
  "transactions": [
    {
      "date": "string - YYYY-MM-DD format",
      "description": "string - transaction description",
      "amount": number (positive value),
      "type": "debit" or "credit",
      "category": "string - best guess category like 'groceries', 'salary', 'utilities', etc."
    }
  ]
}

Rules:
- All amounts must be positive numbers
- Dates must be in YYYY-MM-DD format
- If you cannot determine a field, use a reasonable default
- Mask account numbers by replacing middle digits with X
- Categorise transactions based on description
- Return ONLY valid JSON, no markdown or explanation

Document text:
`;

/** Extracts financial data from PDF documents using Claude */
@injectable()
export class PdfExtractor implements IExtractor {
  private client: Anthropic;

  constructor() {
    this.client = new Anthropic({ apiKey: getConfig().ANTHROPIC_API_KEY });
  }

  /** Check if this extractor supports the given source type */
  supports(sourceType: string): boolean {
    return sourceType === SourceType.PDF;
  }

  /** Extract financial data from a PDF buffer */
  async extract(context: ExtractionContext): Promise<Result<FinancialRecord>> {
    const buffer = context.rawData;
    if (!(buffer instanceof Buffer)) {
      return err(new ExtractionError('Expected PDF buffer input', 'pdf'));
    }

    const textResult = await this.extractText(buffer);
    if (!textResult.success) return textResult;

    const rawText = textResult.data;
    if (rawText.trim().length < MIN_TEXT_LENGTH) {
      return err(
        new UnsupportedError(
          'PDF appears to be scanned/image-based or contains insufficient text. OCR is not currently supported.'
        )
      );
    }

    return this.extractWithLLM(rawText);
  }

  /** Extract raw text from PDF buffer */
  private async extractText(buffer: Buffer): Promise<Result<string>> {
    try {
      const parsed = await pdfParse(buffer);
      return ok(parsed.text);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown PDF parse error';
      return err(new ExtractionError(`Failed to parse PDF: ${message}`, 'pdf'));
    }
  }

  /** Send extracted text to Claude for structured extraction */
  private async extractWithLLM(text: string): Promise<Result<FinancialRecord>> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        const response = await this.client.messages.create({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 4096,
          messages: [{ role: 'user', content: EXTRACTION_PROMPT + text }],
        });

        const content = response.content[0];
        if (content.type !== 'text') {
          return err(new ExtractionError('Unexpected response type from Claude', 'pdf'));
        }

        const parsed = this.parseJsonResponse(content.text);
        if (!parsed.success) return parsed;

        const validated = FinancialRecordSchema.safeParse(parsed.data);
        if (!validated.success) {
          return err(
            new ExtractionError(
              `LLM response validation failed: ${validated.error.message}`,
              'pdf'
            )
          );
        }

        return ok(validated.data);
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        if (attempt < MAX_RETRIES - 1) {
          const delay = BASE_DELAY_MS * Math.pow(2, attempt);
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }

    return err(
      new ExtractionError(
        `LLM extraction failed after ${MAX_RETRIES} attempts: ${lastError?.message}`,
        'pdf'
      )
    );
  }

  /** Parse JSON from LLM response, handling markdown code blocks */
  private parseJsonResponse(text: string): Result<unknown> {
    let cleaned = text.trim();
    const jsonMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      cleaned = jsonMatch[1].trim();
    }

    try {
      return ok(JSON.parse(cleaned));
    } catch {
      return err(new ExtractionError('Failed to parse JSON from LLM response', 'pdf'));
    }
  }
}
