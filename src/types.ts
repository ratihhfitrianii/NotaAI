/**
 * Domain model NotaAI — tipe bersama seluruh pipeline (queue → worker → DB),
 * sesuai PRD NotaAI (subjek: matematika, mandarin, inggris).
 */
export type SubjectType = "matematika" | "mandarin" | "inggris";

export const SUBJECTS: SubjectType[] = ["matematika", "mandarin", "inggris"];

export const SUBJECT_LABELS: Record<SubjectType, string> = {
  matematika: "Matematika",
  mandarin: "Bahasa Mandarin",
  inggris: "Bahasa Inggris",
};

/** Tugas yang masuk antrean (di-produce oleh Supabase Edge Function; diproses worker). */
export interface ExamTask {
  documentId: string;
  imageUrl: string;
  subjectType: SubjectType;
  /** Kunci jawaban resmi — hanya untuk matematika/inggris (opsional). */
  answerKey?: string;
  /** Id kunci jawaban di DB, bila terdaftar. */
  answerKeyId?: string;
  /** Skor maksimal ujian (default 100). */
  maxScore?: number;
  /** Bahasa untuk koreksi bahasa Inggris. */
  language?: "en" | "zh";
}

/** Hasil OCR mentah per subjek (format output sesuai tabel §2). */
export type OcrResult =
  | { subject: "matematika"; latex: string; rawText?: string }
  | { subject: "mandarin"; hanzi: string; pinyin: string }
  | {
      subject: "inggris";
      text: string;
      grammar?: { errors: string[]; suggestions: string[]; score: number };
    };

/** Kunci jawaban matematika: daftar langkah dengan poin. */
export interface MathAnswerKey {
  steps: Array<{ expression: string; points: number }>;
  totalPoints?: number;
}

/** Hasil koreksi akhir satu ujian. */
export interface GradingResult {
  documentId: string;
  subjectType: SubjectType;
  status: "selesai" | "perlu_review";
  /** 0–100 (dihitung engine untuk matematika; LLM untuk mandarin/inggris bila ada). */
  score: number;
  /** Hasil OCR yang dipakai sebagai dasar koreksi. */
  ocr: OcrResult;
  explanation?: string;
  analysis?: string;
  evaluatedAt: string;
  warning?: string;
}

/** Status baris di tabel `exam_results` (Supabase). */
export type ExamStatus = "queued" | "processing" | "completed" | "failed";
