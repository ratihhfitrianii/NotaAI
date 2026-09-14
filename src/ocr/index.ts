import { OcrAdapter } from "./types";
import { env } from "../config/env";
import { SubjectType } from "../types";
import { MathpixOcrAdapter } from "./mathpixAdapter";
import { GoogleVisionOcrAdapter } from "./googleVisionAdapter";
import { EnglishOcrAdapter } from "./englishAdapter";
import { MockOcrAdapter } from "./mockAdapter";

/**
 * Pabrik adapter OCR sesuai mode & subjek:
 * - OCR_MODE=mock → MockOcrAdapter (uji/dev tanpa API key).
 * - OCR_MODE=real → Mathpix (matematika), Google Vision (mandarin), Vision+Gemini (inggris).
 * Subjek tak dikenal → error validasi.
 */
export function createOcrAdapter(
  subject: string,
  mode: "mock" | "real" = env.OCR_MODE,
): OcrAdapter {
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
