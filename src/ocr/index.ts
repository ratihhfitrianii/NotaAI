import { OcrAdapter } from "./types";
import { env } from "../config/env";
import { SubjectType } from "../types";
import { MathpixOcrAdapter } from "./mathpixAdapter";
import { GoogleVisionOcrAdapter } from "./googleVisionAdapter";
import { EnglishOcrAdapter } from "./englishAdapter";
import { TesseractOcrAdapter } from "./tesseractAdapter";
import { GeminiOcrAdapter } from "./geminiOcrAdapter";
import { MockOcrAdapter } from "./mockAdapter";

/**
 * Pabrik adapter OCR sesuai mode:
 * - gemini (default) → Gemini Vision (baca tulisan tangan + cetak, gratis).
 * - tesseract → Tesseract lokal (cetak saja, tanpa API key).
 * - mock → placeholder (test/dev).
 * - real → per-subjek (Mathpix/Google Vision/Gemini, butuh API key semua).
 */
export function createOcrAdapter(
  subject: string,
  mode: "mock" | "tesseract" | "gemini" | "real" = env.OCR_MODE,
): OcrAdapter {
  if (mode === "gemini") {
    if (!env.GEMINI_API_KEY) {
      return new TesseractOcrAdapter(); // fallback bila key kosong
    }
    return new GeminiOcrAdapter(env.GEMINI_API_KEY);
  }
  if (mode === "tesseract") return new TesseractOcrAdapter();
  if (mode === "mock") return new MockOcrAdapter(subject as SubjectType);
  switch (subject) {
    case "matematika":
      return new MathpixOcrAdapter();
    case "mandarin":
      return new GoogleVisionOcrAdapter();
    case "inggris":
      return new EnglishOcrAdapter();
    default:
      throw new Error(`Subjek OCR tidak dikenal: ${subject}`);
  }
}
