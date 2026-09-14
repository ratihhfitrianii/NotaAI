import { DigitizationResult, OcrStatus } from "../types";
import { ExamResultRepository } from "./repository";

/** Repositori in-memory (dev/test & fallback bila Supabase tak dikonfigurasi). */
export class MemoryExamResultRepository implements ExamResultRepository {
  private readonly store = new Map<string, DigitizationResult>();

  async save(result: DigitizationResult): Promise<void> {
    this.store.set(result.documentId, result);
  }
  async getById(id: string): Promise<{ id: string; status: OcrStatus } | null> {
    const r = this.store.get(id);
    return r ? { id: r.documentId, status: "completed" } : null;
  }
  async getResult(id: string): Promise<DigitizationResult | null> {
    return this.store.get(id) ?? null;
  }
  async list(): Promise<DigitizationResult[]> {
    return Array.from(this.store.values()).sort((a, b) =>
      (b.processedAt || "").localeCompare(a.processedAt || ""),
    );
  }
  async updateStatus(
    id: string,
    status: OcrStatus,
    payload?: Partial<DigitizationResult>,
  ): Promise<void> {
    const existing = this.store.get(id);
    const merged: DigitizationResult = existing
      ? { ...existing, ...payload }
      : { ...(payload as unknown as DigitizationResult) };
    // Default saat payload tak membawa status.
    this.store.set(id, merged);
  }
  async markFailed(id: string, reason: string): Promise<void> {
    const existing = this.store.get(id);
    this.store.set(id, {
      documentId: id,
      subjectType: existing?.subjectType || "matematika",
      ocr: existing?.ocr || {
        subject: "matematika",
        latex: "",
      },
      processedAt: new Date().toISOString(),
    });
  }
}
