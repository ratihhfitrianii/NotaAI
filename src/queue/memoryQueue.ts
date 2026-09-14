import { QueueProvider } from "./types";
import { OcrTask } from "../types";
import { logger } from "../lib/logger";
import { EventEmitter } from "events";

/**
 * Antrean in-memory (dev/test & fallback bila Kafka tak tersedia).
 * Tetap asynchronous & ber-urutan; cocok untuk uji end-to-end lokal tanpa broker.
 */
export class MemoryQueue implements QueueProvider {
  readonly driver = "memory" as const;
  private tasks: OcrTask[] = [];
  private readonly emitter = new EventEmitter();

  async push(task: OcrTask): Promise<void> {
    this.tasks.push(task);
    this.emitter.emit("task", task);
    logger.debug("memory-queue: push", { documentId: task.documentId });
  }

  async consume(
    handler: (task: OcrTask) => Promise<void>,
  ): Promise<() => Promise<void>> {
    const listener = (task: OcrTask) => {
      // Jalankan async tanpa menunggu; error di-log agar consumer tetap hidup.
      void handler(task).catch((err) => {
        logger.error("memory-queue: handler error", {
          documentId: task.documentId,
          err: String(err),
        });
      });
    };
    this.emitter.on("task", listener);
    logger.info("memory-queue: consumer attached");
    return async () => {
      this.emitter.off("task", listener);
      logger.info("memory-queue: consumer detached");
    };
  }

  size(): number {
    return this.tasks.length;
  }
}
