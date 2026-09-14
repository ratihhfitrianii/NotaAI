import { GradingResult, ExamStatus } from "../types";
import { ExamResultRepository } from "./repository";

/** Repositori in-memory (dev/test & fallback bila Supabase tak dikonfigurasi). */
export class MemoryExamResultRepository implements ExamResultRepository {
  private readonly store = new Map<string, GradingResult>();

  async save(result: GradingResult): Promise<void> {
    this.store.set(result.documentId, result);
  }
  async getById(
    id: string,
  ): Promise<{ id: string; status: ExamStatus } | null> {
    const r = this.store.get(id);
    return r
      ? {
          id: r.documentId,
          status: r.status === "perlu_review" ? "completed" : "completed",
        }
      : null;
  }
  async updateStatus(
    id: string,
    status: ExamStatus,
    payload?: Partial<GradingResult>,
  ): Promise<void> {
    const existing = this.store.get(id);
    const merged: GradingResult = existing
      ? { ...existing, ...payload }
      : { ...(payload as unknown as GradingResult) };
    // Default saat payload tak membawa result_status: mapping dari ExamStatus.
    if (status === "completed") merged.status = "selesai";
    else if (status === "failed") merged.status = "perlu_review";
    this.store.set(id, merged);
  }
  async markFailed(id: string, reason: string): Promise<void> {
    const existing = this.store.get(id);
    this.store.set(id, {
      documentId: id,
      subjectType: existing?.subjectType || "matematika",
      status: "perlu_review",
      score: 0,
      ocr: existing?.ocr || { subject: "matematika", latex: "" },
      evaluatedAt: new Date().toISOString(),
      warning: reason,
    });
  }
}
