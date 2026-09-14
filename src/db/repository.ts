import { GradingResult, ExamStatus } from "../types";

/**
 * Repositori hasil ujian — antarmuka bebas storage.
 * Implementasi nyata: Supabase/Postgres (lihat supabase/ + src/db/).
 */
export interface ExamResultRepository {
  save(result: GradingResult): Promise<void>;
  getById(id: string): Promise<{ id: string; status: ExamStatus } | null>;
  updateStatus(
    id: string,
    status: ExamStatus,
    payload?: Partial<GradingResult>,
  ): Promise<void>;
  markFailed(id: string, reason: string): Promise<void>;
}
