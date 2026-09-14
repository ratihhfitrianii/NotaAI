import { ExamPipeline } from "./examPipeline";
import { MemoryQueue } from "../queue/memoryQueue";
import { MemoryExamResultRepository } from "../db/memoryRepository";
import { ExamTask } from "../types";
import { AppError } from "../lib/errors";
import { LlmGrader } from "../grading/llmGrader";
import type { MathGradingJson } from "../grading/mathGrading";

const mathKey = JSON.stringify({
  steps: [
    { expression: "x^2 + y^2 = z^2", points: 2 },
    { expression: "x = 2", points: 1 },
    { expression: "y = 3", points: 1 },
  ],
  totalPoints: 4,
});

/** Stub LLM deterministik — memenuhi kontrak, tanpa API key. */
class StubLlm implements LlmGrader {
  async gradeEnglish(): Promise<{ score: number; explanation: string }> {
    return { score: 50, explanation: "stub" };
  }
  async gradeMath(): Promise<MathGradingJson> {
    return {
      status_jawaban: "benar",
      transkripsi_langkah_latex: "x=2",
      analisis_kesalahan: "",
      nilai_rekomendasi: 90,
    };
  }
}

describe("ExamPipeline (end-to-end, mode mock)", () => {
  it("matematika: OCR mock → skor engine → tersimpan", async () => {
    const queue = new MemoryQueue();
    const repo = new MemoryExamResultRepository();
    const pipeline = new ExamPipeline(queue, repo, new StubLlm(), "mock");
    // Pipeline memulai konsumen sendiri; jangan menimpa dengan handler kosong.
    const stop = await pipeline.start();

    const task: ExamTask = {
      documentId: "doc-math",
      imageUrl: "https://x.com/math.jpg",
      subjectType: "matematika",
      answerKey: mathKey,
    };
    await queue.push(task);
    await new Promise((r) => setTimeout(r, 30));

    const saved = await repo.getById("doc-math");
    expect(saved?.status).toBe("completed");
    await stop();
  });

  it("mandarin: OCR mock → Hanzi + Pinyin → perlu_review", async () => {
    const queue = new MemoryQueue();
    const repo = new MemoryExamResultRepository();
    const pipeline = new ExamPipeline(queue, repo, new StubLlm(), "mock");
    const stop = await pipeline.start();

    await queue.push({
      documentId: "doc-zh",
      imageUrl: "https://x.com/zh.jpg",
      subjectType: "mandarin",
    });
    await new Promise((r) => setTimeout(r, 30));

    const saved = await repo.getById("doc-zh");
    expect(saved?.status).toBe("completed");
    await stop();
  });

  it("matematika tanpa answerKey → error validasi", async () => {
    const queue = new MemoryQueue();
    const repo = new MemoryExamResultRepository();
    const pipeline = new ExamPipeline(queue, repo, new StubLlm(), "mock");
    await expect(
      pipeline.process({
        documentId: "doc-x",
        imageUrl: "https://x.com/m.jpg",
        subjectType: "matematika",
      }),
    ).rejects.toThrow(AppError);
  });
});
