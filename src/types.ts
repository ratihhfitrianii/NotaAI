/**
 * NotaAI OCR — Domain model untuk digitalisasi tulisan tangan.
 * Hanya OCR: baca foto → struktur data (tanpa koreksi/nilai).
 */
export type SubjectType = "matematika" | "mandarin" | "inggris";

export const SUBJECTS: SubjectType[] = ["matematika", "mandarin", "inggris"];

export const SUBJECT_LABELS: Record<SubjectType, string> = {
  matematika: "Matematika",
  mandarin: "Bahasa Mandarin",
  inggris: "Bahasa Inggris",
};

/** Tugas OCR yang masuk antrean. */
export interface OcrTask {
  documentId: string;
  imageUrl: string; // URL storage / upload://filename
  /** Subjek (opsional). Bila kosong → digitalisasi teks generik (deteksi otomatis). */
  subjectType?: SubjectType;
  /** Data foto asli (base64) — untuk OCR mock membaca dimensi/format. */
  imageBase64?: string;
  /** Nama file asli. */
  imageFileName?: string;
}

/** Hasil OCR per subjek — format output sesuai PRD §2. */
export type OcrResult =
  | {
      subject: "matematika";
      latex: string;
      rawText?: string;
      source?: string;
    }
  | {
      subject: "mandarin";
      hanzi: string;
      pinyin: string;
      source?: string;
    }
  | {
      subject: "inggris";
      text: string;
      source?: string;
      grammar?: { errors: string[]; suggestions: string[]; score: number };
    };

/** Hasil akhir digitalisasi satu dokumen. */
export interface DigitizationResult {
  documentId: string;
  subjectType: SubjectType;
  ocr: OcrResult;
  processedAt: string;
}

/** Status internal (queue). */
export type OcrStatus = "queued" | "processing" | "completed" | "failed";
