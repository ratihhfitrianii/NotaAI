import { OcrTask, DigitizationResult, OcrResult, SubjectType } from "../types";
import { createOcrAdapter } from "../ocr";
import { QueueProvider } from "../queue/types";
import { ExamResultRepository } from "../db/repository";
import { AppError } from "../lib/errors";
import { logger } from "../lib/logger";

/**
 * Pipeline OCR NotaAI — alur digitalisasi:
 * 1. OCR sesuai subjek  2. Simpan hasil  3. Update status.
 * Matematika: OCR Mathpix → LaTeX
 * Mandarin: OCR Google Vision (zh) → Hanzi + Pinyin
 * Inggris: OCR Vision → teks digital
 */
export class OcrPipeline {
  constructor(
    private readonly queue: QueueProvider,
    private readonly repo: ExamResultRepository,
    private readonly ocrMode:
      "mock" | "tesseract" | "gemini" | "real" = "gemini",
  ) {}

  async start(): Promise<() => Promise<void>> {
    return this.queue.consume(async (task) => {
      try {
        await this.process(task);
      } catch {
        // error sudah di-handle di process
      }
    });
  }

  async process(task: OcrTask): Promise<DigitizationResult> {
    const { documentId, subjectType } = task;
    await this.repo.updateStatus(documentId, "processing");
    try {
      const result = await this.runOcr(task);
      await this.repo.save(result);
      await this.repo.updateStatus(documentId, "completed", result);
      return result;
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      await this.repo.markFailed(documentId, reason);
      logger.error("ocr pipeline: gagal", { documentId, subjectType, reason });
      throw err;
    }
  }

  private async runOcr(task: OcrTask): Promise<DigitizationResult> {
    const { documentId, imageUrl } = task;
    // Tanpa subjek → digitalisasi teks generik (deteksi otomatis).
    const subjectType: SubjectType = task.subjectType ?? "inggris";
    const adapter = createOcrAdapter(subjectType, this.ocrMode);
    const ocr = await adapter.recognize({
      imageUrl,
      languageHint:
        subjectType === "mandarin"
          ? "zh"
          : subjectType === "inggris"
            ? "en"
            : undefined,
      imageBase64: task.imageBase64,
      imageFileName: task.imageFileName,
    });

    return {
      documentId,
      subjectType,
      ocr,
      processedAt: new Date().toISOString(),
    };
  }
}
