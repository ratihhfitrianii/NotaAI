import { ExamTask, GradingResult } from "../types";
import { createOcrAdapter } from "../ocr";
import { createLlmGrader, toGradingResult } from "../grading/llmGrader";
import { scoreMathAnswer } from "../grading/mathScore";
import { QueueProvider } from "../queue/types";
import { ExamResultRepository } from "../db/repository";
import { AppError } from "../lib/errors";
import { logger } from "../lib/logger";

/**
 * Orchestrator pipeline NotaAI (worker Cloud Run) — alur async:
 * 1. OCR sesuai subjek (§2)  2. Koreksi  3. Simpan hasil  4. Update status.
 * Matematika: OCR Mathpix → LaTeX; skor via engine deterministik `scoreMathAnswer`,
 *   plus nilai_rekomendasi LLM (bila LLM_MODE=real) sebagai pertimbangan.
 * Mandarin: OCR Google Vision (zh) → Hanzi + Pinyin; skor default 0 (butuh review manusia/guru).
 * Inggris: OCR Vision+Gemini → teks; koreksi grammar & skor via LLM (bila real).
 */
export class ExamPipeline {
  constructor(
    private readonly queue: QueueProvider,
    private readonly repo: ExamResultRepository,
    private readonly llm = createLlmGrader(),
    private readonly ocrMode: "mock" | "real" = "mock",
  ) {}

  /** Mulai consumer: jalankan worker untuk setiap tugas dari antrean. */
  async start(): Promise<() => Promise<void>> {
    return this.queue.consume(async (task) => {
      try {
        await this.process(task);
      } catch {
        // error sudah di-handle & ditandai gagal di `process`.
      }
    });
  }

  /** Proses satu tugas ujian dari antrean hingga hasil tersimpan. */
  async process(task: ExamTask): Promise<GradingResult> {
    const { documentId, subjectType } = task;
    await this.repo.updateStatus(documentId, "processing");
    try {
      const result = await this.runPipeline(task);
      await this.repo.save(result);
      await this.repo.updateStatus(documentId, "completed", result);
      return result;
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      await this.repo.markFailed(documentId, reason);
      logger.error("exam pipeline: gagal", { documentId, subjectType, reason });
      throw err;
    }
  }

  private async runPipeline(task: ExamTask): Promise<GradingResult> {
    const { documentId, subjectType, imageUrl, answerKey } = task;
    const adapter = createOcrAdapter(subjectType, this.ocrMode);
    const ocr = await adapter.recognize({
      imageUrl,
      languageHint:
        subjectType === "mandarin"
          ? "zh"
          : subjectType === "inggris"
            ? "en"
            : undefined,
    });

    switch (subjectType) {
      case "matematika": {
        if (ocr.subject !== "matematika")
          throw new AppError("INTERNAL", "OCR mismatch matematika", 500);
        if (!answerKey)
          throw new AppError(
            "VALIDATION_ERROR",
            "Matematika butuh answerKey",
            400,
          );
        try {
          const parsedKey = JSON.parse(answerKey) as {
            steps?: Array<{ expression: string; points: number }>;
            totalPoints?: number;
          };
          const key = {
            steps: parsedKey.steps || [],
            totalPoints: parsedKey.totalPoints,
          };
          const scoring = scoreMathAnswer({
            studentLatex: ocr.latex,
            answerKey: key,
          });
          let score = scoring.score;
          let warning: string | undefined;
          if (process.env.LLM_MODE === "real") {
            try {
              const llm = await this.llm.gradeMath({
                latexSiswa: ocr.latex,
                kunci: answerKey,
              });
              score = llm.nilai_rekomendasi;
            } catch (e) {
              warning = `LLM grading gagal (${e instanceof Error ? e.message : String(e)}), pakai skor engine.`;
            }
          }
          return toGradingResult({
            documentId,
            subjectType,
            ocr,
            score,
            status: "selesai",
            analysis: scoring.matchedExpressions.join(" | "),
            warning,
            explanation: `Engine: ${scoring.matchedSteps}/${scoring.totalSteps} langkah cocok dengan kunci jawaban.`,
          });
        } catch (e) {
          if (e instanceof AppError) throw e;
          throw new AppError(
            "VALIDATION_ERROR",
            `Kunci jawaban tidak valid: ${e instanceof Error ? e.message : String(e)}`,
            400,
          );
        }
      }
      case "mandarin": {
        if (ocr.subject !== "mandarin")
          throw new AppError("INTERNAL", "OCR mismatch mandarin", 500);
        // Hanzi + Pinyin; skor butuh penilaian guru (LLM/guru) — default 0 + flag review.
        let explanation: string | undefined;
        let score = 0;
        if (process.env.LLM_MODE === "real") {
          try {
            const llm = await this.llm.gradeEnglish({
              text: ocr.hanzi,
              answerKey,
            });
            score = llm.score;
            explanation = llm.explanation;
          } catch (e) {
            explanation = `LLM grading gagal (${e instanceof Error ? e.message : String(e)}), skor 0.`;
          }
        } else {
          explanation = "Mode mock: skor Mandarin memerlukan koreksi guru/LLM.";
        }
        return toGradingResult({
          documentId,
          subjectType,
          ocr,
          score,
          status: "perlu_review",
          explanation,
          warning: "Koreksi Mandarin memerlukan peninjauan guru.",
        });
      }
      case "inggris": {
        if (ocr.subject !== "inggris")
          throw new AppError("INTERNAL", "OCR mismatch inggris", 500);
        let explanation: string | undefined;
        let score = 0;
        if (process.env.LLM_MODE === "real") {
          try {
            const llm = await this.llm.gradeEnglish({
              text: ocr.text,
              answerKey,
            });
            score = llm.score;
            explanation = llm.explanation;
          } catch (e) {
            explanation = `LLM grading gagal (${e instanceof Error ? e.message : String(e)}), skor 0.`;
          }
        } else {
          explanation =
            "Mode mock: koreksi Inggris memerlukan LLM (GEMINI_API_KEY).";
        }
        return toGradingResult({
          documentId,
          subjectType,
          ocr,
          score,
          status: "selesai",
          explanation,
          warning: explanation,
        });
      }
    }
  }
}
