import { Router, NextFunction, Request, Response } from "express";
import multer from "multer";
import { OcrTask } from "../types";
import { QueueProvider } from "../queue/types";
import { ExamResultRepository } from "../db/repository";
import { DigitizationResult } from "../types";
import { logger } from "../lib/logger";
import path from "path";
import fs from "fs";

/** Buat nama file aman dari nama asli. */
function safeFileName(original: string): string {
  return original.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 80);
}

const upload = multer({
  dest: path.join(process.cwd(), "uploads"),
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (
      file.mimetype.startsWith("image/") ||
      file.mimetype === "application/pdf"
    ) {
      cb(null, true);
    } else {
      cb(new Error(`Tipe file tidak didukung: ${file.mimetype}`));
    }
  },
});

export function createApiRouter(
  queue: QueueProvider,
  repo: ExamResultRepository,
  processTask: (task: OcrTask) => Promise<DigitizationResult>,
): Router {
  const router = Router();

  // ──────────────────────── Health ────────────────────
  router.get("/health", (_req, res) => {
    res.json({ status: "ok", queue: queue.driver });
  });

  // ──────────────── Submit (JSON, satu dokumen) ────────────────
  router.post(
    "/exams",
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const {
          documentId,
          imageUrl,
          subjectType,
          imageBase64,
          imageFileName,
        } = req.body;
        if (!documentId || !imageUrl) {
          return res.status(400).json({
            code: "VALIDATION_ERROR",
            message: "documentId & imageUrl wajib",
          });
        }

        const task: OcrTask = {
          documentId,
          imageUrl,
          subjectType, // opsional
          imageBase64,
          imageFileName,
        };

        const result = await processTask(task);
        res.status(201).json({ code: "OK", data: result });
      } catch (err) {
        next(err);
      }
    },
  );

  // ──────────────── Upload (multipart, bisa banyak file) ────────────────
  router.post(
    "/upload",
    upload.array("files", 20),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const files = req.files as Express.Multer.File[];
        if (!files || files.length === 0) {
          return res.status(400).json({
            code: "VALIDATION_ERROR",
            message: "Unggah minimal 1 file",
          });
        }

        /** Response dengan field foto tambahan untuk dashboard. */
        type UploadResult = DigitizationResult & {
          imageUrl: string;
          imageFileName: string;
        };

        // Persiapkan semua file secara parallel — proses OCR bersamaan.
        const results = await Promise.all(
          files.map(async (file): Promise<UploadResult> => {
            const imageBase64 = fs.readFileSync(file.path).toString("base64");
            const ext = path.extname(file.originalname) || ".png";
            const savedName = `${safeFileName(file.originalname)}-${Date.now()}-${Math.random().toString(36).slice(2,6)}${ext}`;
            const savedPath = path.join(process.cwd(), "uploads", savedName);
            fs.copyFileSync(file.path, savedPath);
            const imageUrl = `/uploads/${savedName}`;

            const task: OcrTask = {
              documentId: `upload-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
              imageUrl,
              subjectType: req.body.subject || undefined,
              imageBase64,
              imageFileName: file.originalname,
            };

            try {
              const result = await processTask(task);
              return { ...result, imageUrl, imageFileName: file.originalname };
            } finally {
              fs.unlink(file.path, () => {});
            }
          }),
        );

        res.status(201).json({ code: "OK", data: results });
      } catch (err) {
        next(err);
      }
    },
  );

  // ──────────────── Daftar hasil ────────────────
  router.get(
    "/documents",
    async (_req: Request, res: Response, next: NextFunction) => {
      try {
        const docs = await repo.list();
        res.json({ code: "OK", data: docs });
      } catch (err) {
        next(err);
      }
    },
  );

  // ──────────────── Detail satu dokumen ────────────────
  router.get(
    "/documents/:id",
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const doc = await repo.getResult(req.params.id);
        if (!doc) {
          return res.status(404).json({
            code: "NOT_FOUND",
            message: `Dokumen ${req.params.id} tidak ditemukan`,
          });
        }
        res.json({ code: "OK", data: doc });
      } catch (err) {
        next(err);
      }
    },
  );

  // ──────────────── Error handler ────────────────
  router.use(
    (err: Error, _req: Request, res: Response, _next: NextFunction) => {
      logger.error("request error", { err: err.message });
      if (err.message?.startsWith("Tipe file tidak didukung")) {
        return res
          .status(400)
          .json({ code: "VALIDATION_ERROR", message: err.message });
      }
      res.status(500).json({ code: "INTERNAL_ERROR", message: err.message });
    },
  );

  return router;
}
