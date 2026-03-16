import { Router, Request, Response, NextFunction } from 'express';
import { container } from 'tsyringe';
import multer from 'multer';
import { DocumentRepository } from '../../repositories/document-repository';
import { PipelineService } from '../../services/pipeline-service';
import { NotFoundError } from '../../core/errors';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are accepted'));
    }
  },
});

/** Create document routes */
export function createDocumentRoutes(): Router {
  const router = Router();
  const documentRepo = container.resolve<DocumentRepository>('DocumentRepository');
  const pipelineService = container.resolve<PipelineService>('PipelineService');

  /** POST /api/v1/documents/upload — Upload a PDF and trigger extraction */
  router.post(
    '/upload',
    upload.single('file'),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        if (!req.file) {
          res.status(400).json({ error: { code: 'NO_FILE', message: 'PDF file is required' } });
          return;
        }

        const document = await documentRepo.create({
          filename: req.file.originalname,
          status: 'pending',
          rawText: null,
          errorMessage: null,
          createdAt: new Date(),
          processedAt: null,
        });

        // Process async — don't wait for completion
        pipelineService.processDocument(document.id, req.file.buffer).catch((error) => {
          console.error('Pipeline processing error:', error);
        });

        res.status(202).json({
          id: document.id,
          filename: document.filename,
          status: document.status,
          message: 'Document uploaded and processing started',
        });
      } catch (error) {
        next(error);
      }
    }
  );

  /** GET /api/v1/documents/:id — Get document status and results */
  router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = req.params.id as string;
      const document = await documentRepo.findByIdWithRecords(id);
      if (!document) {
        throw new NotFoundError('Document', id);
      }

      res.json({
        id: document.id,
        filename: document.filename,
        status: document.status,
        errorMessage: document.errorMessage,
        createdAt: document.createdAt,
        processedAt: document.processedAt,
        records: document.financialRecords,
      });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
