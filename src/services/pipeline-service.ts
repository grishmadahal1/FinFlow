import { injectable, inject } from 'tsyringe';
import { IExtractor, IEventBus } from '../core/interfaces';
import {
  FinancialRecord,
  SourceType,
  PipelineEventType,
  ExtractionContext,
  ok,
  err,
  Result,
} from '../core/types';
import { ValidationPipeline } from '../validators/validation-pipeline';
import { FinancialRecordTransformer, TransformedRecord } from '../transformers';
import { DocumentRepository } from '../repositories/document-repository';
import { FinancialRecordRepository } from '../repositories/financial-record-repository';
import { DataSourceRepository } from '../repositories/data-source-repository';
import { PipelineEventRepository } from '../repositories/pipeline-event-repository';
import { Decimal } from '@prisma/client/runtime/library';
import { Prisma } from '@prisma/client';
import pino from 'pino';

const logger = pino({ name: 'pipeline-service' });

/** Orchestrates the full data processing pipeline: extract -> validate -> transform -> store */
@injectable()
export class PipelineService {
  constructor(
    @inject('PdfExtractor') private pdfExtractor: IExtractor,
    @inject('AlphaVantageExtractor') private alphaVantageExtractor: IExtractor,
    @inject('MockSuperFundExtractor') private mockSuperFundExtractor: IExtractor,
    @inject('ValidationPipeline') private validationPipeline: ValidationPipeline,
    @inject('FinancialRecordTransformer') private transformer: FinancialRecordTransformer,
    @inject('DocumentRepository') private documentRepo: DocumentRepository,
    @inject('FinancialRecordRepository') private recordRepo: FinancialRecordRepository,
    @inject('DataSourceRepository') private dataSourceRepo: DataSourceRepository,
    @inject('PipelineEventRepository') private eventRepo: PipelineEventRepository,
    @inject('IEventBus') private eventBus: IEventBus
  ) {}

  /** Process an uploaded PDF document through the full pipeline */
  async processDocument(documentId: string, pdfBuffer: Buffer): Promise<Result<FinancialRecord>> {
    logger.info({ documentId }, 'Starting document processing pipeline');

    await this.documentRepo.update(documentId, { status: 'processing' });
    this.emitEvent(PipelineEventType.DOCUMENT_UPLOADED, { documentId });

    // Extract
    const context: ExtractionContext = {
      sourceId: documentId,
      sourceType: SourceType.PDF,
      rawData: pdfBuffer,
    };

    const extractResult = await this.pdfExtractor.extract(context);
    if (!extractResult.success) {
      const errorMsg =
        extractResult.error instanceof Error ? extractResult.error.message : 'Unknown error';
      logger.error({ documentId, error: errorMsg }, 'Extraction failed');
      await this.documentRepo.update(documentId, {
        status: 'failed',
        errorMessage: errorMsg,
      });
      this.emitEvent(PipelineEventType.EXTRACTION_FAILED, { documentId, error: errorMsg });
      return extractResult;
    }

    this.emitEvent(PipelineEventType.EXTRACTION_COMPLETED, { documentId });

    // Validate
    const validationResult = await this.validationPipeline.validate(extractResult.data);
    if (!validationResult.valid) {
      logger.warn({ documentId, errors: validationResult.errors }, 'Validation failed');
      await this.documentRepo.update(documentId, {
        status: 'failed',
        errorMessage: JSON.stringify(validationResult.errors),
      });
      this.emitEvent(PipelineEventType.VALIDATION_FAILED, {
        documentId,
        errors: validationResult.errors as unknown as Record<string, unknown>[],
      });
      return err(
        new Error(
          `Validation failed: ${validationResult.errors.map((e) => e.message).join(', ')}`
        )
      );
    }

    this.emitEvent(PipelineEventType.VALIDATION_PASSED, {
      documentId,
      warnings: validationResult.warnings,
    });

    // Transform
    const transformResult = await this.transformer.transform(extractResult.data);
    if (!transformResult.success) {
      const errorMsg =
        transformResult.error instanceof Error
          ? transformResult.error.message
          : 'Unknown error';
      await this.documentRepo.update(documentId, {
        status: 'failed',
        errorMessage: errorMsg,
      });
      return err(transformResult.error);
    }

    // Store
    await this.storeRecord(documentId, null, transformResult.data);
    await this.documentRepo.update(documentId, {
      status: 'completed',
      rawText: JSON.stringify(extractResult.data),
      processedAt: new Date(),
    });

    logger.info({ documentId }, 'Document processing completed');
    return ok(extractResult.data);
  }

  /** Sync data from an external API source */
  async syncDataSource(dataSourceId: string): Promise<Result<FinancialRecord>> {
    logger.info({ dataSourceId }, 'Starting data source sync');

    const dataSource = await this.dataSourceRepo.findById(dataSourceId);
    if (!dataSource) {
      return err(new Error(`Data source ${dataSourceId} not found`));
    }

    const extractor = this.getExtractorForType(dataSource.type);
    if (!extractor) {
      return err(new Error(`No extractor found for source type: ${dataSource.type}`));
    }

    const context: ExtractionContext = {
      sourceId: dataSourceId,
      sourceType: dataSource.type as SourceType,
      rawData: dataSource.configJson,
    };

    const extractResult = await extractor.extract(context);
    if (!extractResult.success) return extractResult;

    // Validate
    const validationResult = await this.validationPipeline.validate(extractResult.data);
    if (!validationResult.valid) {
      return err(
        new Error(
          `Validation failed: ${validationResult.errors.map((e) => e.message).join(', ')}`
        )
      );
    }

    // Transform
    const transformResult = await this.transformer.transform(extractResult.data);
    if (!transformResult.success) return err(transformResult.error);

    // Store
    await this.storeRecord(null, dataSourceId, transformResult.data);
    await this.dataSourceRepo.markSynced(dataSourceId);

    this.emitEvent(PipelineEventType.SYNC_COMPLETED, { dataSourceId });
    logger.info({ dataSourceId }, 'Data source sync completed');

    return ok(extractResult.data);
  }

  /** Store a transformed record with its transactions */
  private async storeRecord(
    documentId: string | null,
    dataSourceId: string | null,
    transformed: TransformedRecord
  ): Promise<void> {
    const { record, transactionHashes } = transformed;

    await this.recordRepo.createWithTransactions(
      {
        sourceType: documentId ? SourceType.PDF : SourceType.API_ALPHA_VANTAGE,
        sourceId: documentId ?? dataSourceId ?? '',
        accountNumberMasked: record.accountNumberMasked,
        accountHolderName: record.accountHolderName,
        institution: record.institution,
        periodStart: new Date(record.periodStart),
        periodEnd: new Date(record.periodEnd),
        openingBalance: new Decimal(record.openingBalance),
        closingBalance: new Decimal(record.closingBalance),
        currency: record.currency ?? 'AUD',
        rawJson: record as unknown as Prisma.InputJsonValue,
        createdAt: new Date(),
        documentId,
        dataSourceId,
      },
      record.transactions.map((t, i) => ({
        date: new Date(t.date),
        description: t.description,
        amount: t.amount,
        type: t.type,
        category: t.category ?? null,
        hash: transactionHashes[i],
        createdAt: new Date(),
      }))
    );
  }

  /** Get the appropriate extractor for a source type */
  private getExtractorForType(type: string): IExtractor | null {
    if (this.alphaVantageExtractor.supports(type)) return this.alphaVantageExtractor;
    if (this.mockSuperFundExtractor.supports(type)) return this.mockSuperFundExtractor;
    if (this.pdfExtractor.supports(type)) return this.pdfExtractor;
    return null;
  }

  /** Emit a pipeline event and persist it */
  private emitEvent(type: string, payload: Record<string, unknown>): void {
    this.eventBus.emit(type, payload);
    this.eventRepo.create(type, payload).catch((error) => {
      logger.error({ error, type }, 'Failed to persist pipeline event');
    });
  }
}
