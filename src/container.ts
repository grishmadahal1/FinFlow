import 'reflect-metadata';
import { container } from 'tsyringe';
import { PrismaClient } from '@prisma/client';

import { EventBus } from './events/event-bus';
import { PdfExtractor } from './extractors/pdf';
import { AlphaVantageExtractor } from './extractors/api/alpha-vantage';
import { MockSuperFundExtractor } from './extractors/api/mock-super-fund';
import { FinancialRecordTransformer } from './transformers';
import { SchemaValidator } from './validators/schema-validator';
import { BalanceReconciliationValidator } from './validators/balance-reconciliation-validator';
import { DuplicateDetectionValidator } from './validators/duplicate-detection-validator';
import { ValidationPipeline } from './validators/validation-pipeline';
import { DocumentRepository } from './repositories/document-repository';
import { FinancialRecordRepository } from './repositories/financial-record-repository';
import { TransactionRepository } from './repositories/transaction-repository';
import { DataSourceRepository } from './repositories/data-source-repository';
import { ApiKeyRepository } from './repositories/api-key-repository';
import { PipelineEventRepository } from './repositories/pipeline-event-repository';
import { PipelineService } from './services/pipeline-service';
import { WebhookService } from './api/webhooks/webhook-service';

/** Configure the dependency injection container */
export function configureContainer(): void {
  // Singletons
  const prisma = new PrismaClient();
  container.registerInstance('PrismaClient', prisma);

  const eventBus = new EventBus();
  container.registerInstance('IEventBus', eventBus);

  // Extractors
  container.registerSingleton('PdfExtractor', PdfExtractor);
  container.registerSingleton('AlphaVantageExtractor', AlphaVantageExtractor);
  container.registerSingleton('MockSuperFundExtractor', MockSuperFundExtractor);

  // Transformer
  container.registerSingleton('FinancialRecordTransformer', FinancialRecordTransformer);

  // Validators
  const schemaValidator = new SchemaValidator();
  const balanceValidator = new BalanceReconciliationValidator();
  const duplicateValidator = new DuplicateDetectionValidator();

  const validationPipeline = new ValidationPipeline([
    schemaValidator,
    balanceValidator,
    duplicateValidator,
  ]);
  container.registerInstance('ValidationPipeline', validationPipeline);

  // Repositories
  container.registerSingleton('DocumentRepository', DocumentRepository);
  container.registerSingleton('FinancialRecordRepository', FinancialRecordRepository);
  container.registerSingleton('TransactionRepository', TransactionRepository);
  container.registerSingleton('DataSourceRepository', DataSourceRepository);
  container.registerSingleton('ApiKeyRepository', ApiKeyRepository);
  container.registerSingleton('PipelineEventRepository', PipelineEventRepository);

  // Services
  container.registerSingleton('PipelineService', PipelineService);
  container.registerSingleton('WebhookService', WebhookService);
}
