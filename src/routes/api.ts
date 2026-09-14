import { Router } from "express";
import { z } from "zod";
import { ExamTask, SUBJECTS, SubjectType, SUBJECT_LABELS } from "../types";
import { QueueProvider } from "../queue/types";
import { AppError } from "../lib/errors";
import { logger } from "../lib/logger";

/**
 * API NotaAI (Cloud Run worker) — endpoint publik:
 *  - POST /api/v1/exams/submit  → terima tugas ujian, masukkan ke antrean (response < 50 ms).
 *  - GET  /api/v1/health        → health check (Cloud Run).
 * Sesuai PRD: producer ringan (Edge Function) menembak antrean; worker memproses asinkron.
 */
const subjectEnum = z.enum(SUBJECTS as [SubjectType, ...SubjectType[]]);
const submitSchema = z.object({
  documentId: z.string().min(1),
  imageUrl: z.string().url(),
  subjectType: subjectEnum,
  answerKey: z.string().optional(),
  answerKeyId: z.string().optional(),
  maxScore: z.number().int().min(1).max(1000).optional(),
  language: z.enum(["en", "zh"]).optional(),
});

export function createApiRouter(queue: QueueProvider): Router {
  const router = Router();

  router.get("/health", (_req, res) => {
    res.json({
      status: "ok",
      queue: queue.driver,
      ts: new Date().toISOString(),
    });
  });

  router.post("/exams/submit", async (req, res, next) => {
    try {
      const parsed = submitSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new AppError(
          "VALIDATION_ERROR",
          "Payload ujian tidak valid",
          400,
          parsed.error.issues,
        );
      }
      const task: ExamTask = {
        documentId: parsed.data.documentId,
        imageUrl: parsed.data.imageUrl,
        subjectType: parsed.data.subjectType as SubjectType,
        answerKey: parsed.data.answerKey,
        answerKeyId: parsed.data.answerKeyId,
        maxScore: parsed.data.maxScore,
        language: parsed.data.language,
      };
      await queue.push(task);
      logger.info("exam submitted", {
        documentId: task.documentId,
        subjectType: task.subjectType,
      });
      res.status(202).json({
        success: true,
        message: `Ujian ${SUBJECT_LABELS[task.subjectType]} diterima; diproses asinkron.`,
        data: {
          documentId: task.documentId,
          queue: queue.driver,
          status: "queued",
        },
      });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
