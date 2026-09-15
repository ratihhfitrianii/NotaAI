import express, { NextFunction, Request, Response } from "express";
import path from "path";
import fs from "fs";
import { createApiRouter } from "./routes/api";
import { createQueue } from "./queue";
import { MemoryExamResultRepository } from "./db/memoryRepository";
import { OcrPipeline } from "./pipeline/ocrPipeline";
import { isAppError } from "./lib/errors";
import { logger } from "./lib/logger";
import { env } from "./config/env";

export async function startServer(opts?: {
  useMemoryQueue?: boolean;
  ocrMode?: "mock" | "tesseract" | "gemini" | "real";
}): Promise<{ app: express.Express; stop: () => Promise<void> }> {
  const app = express();
  app.use(express.json({ limit: "10mb" }));

  // CORS — izinkan dashboard Vercel (frontend terpisah) memanggil API di Render.
  app.use((req: Request, res: Response, next: NextFunction) => {
    const origin = req.headers.origin;
    // Izinkan semua origin untuk demo; sesuaikan dengan domain Vercel bila perlu.
    res.setHeader("Access-Control-Allow-Origin", origin || "*");
    res.setHeader("Vary", "Origin");
    res.setHeader(
      "Access-Control-Allow-Methods",
      "GET,POST,PUT,PATCH,DELETE,OPTIONS",
    );
    res.setHeader(
      "Access-Control-Allow-Headers",
      "Content-Type, Authorization",
    );
    if (req.method === "OPTIONS") return res.sendStatus(204);
    next();
  });

  const uploadDir = path.join(process.cwd(), "uploads");
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }

  // Dashboard web (mode demo): tampilan nyata untuk tes mandiri.
  app.use(express.static("public"));

  // Serve foto/dokumen yang sudah di-upload agar bisa ditampilkan di dashboard.
  app.use("/uploads", express.static(uploadDir));

  const queue = opts?.useMemoryQueue ? createQueue() : createQueue();
  const repo = new MemoryExamResultRepository();
  const ocrMode = opts?.ocrMode ?? env.OCR_MODE;
  const pipeline = new OcrPipeline(queue, repo, ocrMode);

  app.use(
    "/api/v1",
    createApiRouter(queue, repo, (task) => pipeline.process(task)),
  );

  // Error handler terpusat — AppError → status sesuai; lainnya → 500.
  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (isAppError(err)) {
      res.status(err.statusCode).json({
        success: false,
        error: { code: err.code, message: err.message, details: err.details },
      });
      return;
    }
    logger.error("unhandled error", { err: String(err) });
    res.status(500).json({
      success: false,
      error: { code: "INTERNAL", message: "Terjadi kesalahan internal" },
    });
  });

  const stopConsumer = await pipeline.start();
  const stop = async () => {
    await stopConsumer();
  };

  return { app, stop };
}
