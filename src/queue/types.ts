import { env } from "../config/env";
import { AppError, errorCodes } from "../lib/errors";
import { logger } from "../lib/logger";
import { OcrTask } from "../types";

/**
 * Abstraksi antrean. Producer menulis tugas; consumer memanggil handler per pesan.
 * Sesuai PRD: broker menahan beban, producer respons < 50ms, worker auto-scale.
 */
export interface QueueProvider {
  readonly driver: "memory" | "upstash";
  push(task: OcrTask): Promise<void>;
  consume(
    handler: (task: OcrTask) => Promise<void>,
  ): Promise<() => Promise<void>>;
}
