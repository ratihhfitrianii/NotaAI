import { OcrResult } from "../types";

/**
 * Kontrak adapter OCR. Setiap subjek mengembalikan format output sesuai tabel §2 PRD.
 */
export interface OcrAdapter {
  /** Nama provider (untuk log & audit). */
  readonly provider: string;
  /** Proses satu gambar ujian → hasil OCR terstruktur. */
  recognize(opts: {
    imageUrl: string;
    languageHint?: "zh" | "en";
    imageBase64?: string;
    imageFileName?: string;
  }): Promise<OcrResult>;
}
