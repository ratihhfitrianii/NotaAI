import express, { NextFunction, Request, Response } from "express";
import { createApiRouter } from "./routes/api";
import { createQueue } from "./queue";
import { MemoryExamResultRepository } from "./db/memoryRepository";
import { ExamPipeline } from "./pipeline/examPipeline";
import { isAppError } from "./lib/errors";
import { logger } from "./lib/logger";
import { env } from "./config/env";

export async function startServer(opts?: {
  useMemoryQueue?: boolean;
}): Promise<{ app: express.Express; stop: () => Promise<void> }> {
  const app = express();
  app.use(express.json({ limit: "10mb" }));

  const queue = opts?.useMemoryQueue ? createQueue() : createQueue();
  const repo = new MemoryExamResultRepository();
  const pipeline = new ExamPipeline(queue, repo);

  app.use("/api/v1", createApiRouter(queue));

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
