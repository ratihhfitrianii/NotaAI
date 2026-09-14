import { env } from "../config/env";
import { AppError, errorCodes } from "../lib/errors";
import { logger } from "../lib/logger";
import { ExamTask } from "../types";

/**
 * Abstraksi antrean. Producer menulis tugas; consumer memanggil handler per pesan.
 * Sesuai PRD: broker menahan beban, producer respons < 50ms, worker auto-scale.
 */
export interface QueueProvider {
  readonly driver: "memory" | "upstash";
  push(task: ExamTask): Promise<void>;
  consume(
    handler: (task: ExamTask) => Promise<void>,
  ): Promise<() => Promise<void>>;
}
