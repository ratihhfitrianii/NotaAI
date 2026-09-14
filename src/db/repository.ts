import { DigitizationResult, OcrStatus } from "../types";

/**
 * Repositori hasil digitalisasi — antarmuka bebas storage.
 * Implementasi nyata: Supabase/Postgres (lihat supabase/ + src/db/).
 */
export interface ExamResultRepository {
  save(result: DigitizationResult): Promise<void>;
  getById(id: string): Promise<{ id: string; status: OcrStatus } | null>;
  /** Ambil hasil digitalisasi lengkap. */
  getResult(id: string): Promise<DigitizationResult | null>;
  /** Ambil semua hasil (untuk dashboard live). */
  list(): Promise<DigitizationResult[]>;
  updateStatus(
    id: string,
    status: OcrStatus,
    payload?: Partial<DigitizationResult>,
  ): Promise<void>;
  markFailed(id: string, reason: string): Promise<void>;
}
