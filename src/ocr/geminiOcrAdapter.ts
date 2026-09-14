import { OcrAdapter } from "./types";
import { OcrResult } from "../types";
import { GoogleGenAI } from "@google/genai";
import { logger } from "../lib/logger";

/**
 * OCR via Google Gemini Vision — membaca tulisan tangan & cetak
 * dari foto/foto dokumen. Gratis (free tier 15 RPM).
 *
 * Mendukung:
 * - Semua bahasa di dunia (ID, EN, AR, ZH, JA, KO, dll)
 * - Rumus matematika (tulis dalam LaTeX bila ada simbol matematika)
 * - Tulisan tangan dokter / catatan medis
 * - Teks cetak / form / dokumen
 */
export class GeminiOcrAdapter implements OcrAdapter {
  readonly provider = "gemini-vision";
  private genai: GoogleGenAI;

  constructor(apiKey: string) {
    this.genai = new GoogleGenAI({ apiKey });
  }

  async recognize(input: {
    imageUrl: string;
    imageBase64?: string;
    imageFileName?: string;
    languageHint?: string;
  }): Promise<OcrResult> {
    const fileLabel = input.imageFileName ?? input.imageUrl;

    if (!input.imageBase64) {
      return {
        subject: "inggris",
        text: `[OCR membutuhkan foto asli, bukan URL]`,
        source: fileLabel,
      };
    }

    try {
      // Deteksi mime type dari nama file
      const ext = (input.imageFileName ?? "").toLowerCase();
      let mimeType = "image/jpeg";
      if (ext.endsWith(".png")) mimeType = "image/png";
      else if (ext.endsWith(".webp")) mimeType = "image/webp";
      else if (ext.endsWith(".gif")) mimeType = "image/gif";

      const response = await this.genai.models.generateContent({
        model: "gemini-3.6-flash",
        contents: [
          {
            inlineData: {
              mimeType,
              data: input.imageBase64,
            },
          },
          {
            text: OCR_PROMPT,
          },
        ],
        config: {
          temperature: 0.1,
          maxOutputTokens: 4096,
        },
      });

      const text = response.text?.trim() ?? "";

      if (!text) {
        return {
          subject: "inggris",
          text: `[teks tidak terdeteksi dari gambar]`,
          source: fileLabel,
        };
      }

      return {
        subject: "inggris",
        text,
        source: fileLabel,
      };
    } catch (err) {
      logger.error("gemini OCR gagal", { err: String(err) });
      return {
        subject: "inggris",
        text: `[gemini OCR gagal: ${err instanceof Error ? err.message : String(err)}]`,
        source: fileLabel,
      };
    }
  }
}

/**
 * Prompt universal untuk digitalisasi dokumen:
 * semua bahasa, rumus matematika, tulisan tangan dokter, teks cetak.
 */
const OCR_PROMPT = `You are a universal document digitizer. Read ALL text from this image.

RULES:
1. Output ONLY the text that appears in the image — no explanations, no translations, no summaries.
2. Preserve the original layout: line breaks, spacing, indentation.
3. Detect the language automatically and output in that language (Indonesian, English, Arabic, Chinese, Japanese, Korean, Hindi, etc — any language).
4. MATH FORMULAS: if you see mathematical formulas or equations, write them in LaTeX notation wrapped in $$...$$ for display math, or $...$ for inline math. For example: $$\\int_0^1 x^2 dx = \\frac{1}{3}$$
5. DOCTOR HANDWRITING / MEDICAL NOTES: read carefully even if handwriting is messy. Use context to disambiguate medical terms, drug names, dosages. Common abbreviations: mg, ml, tablets, cap, OD (once daily), BD (twice daily), TDS (three times), PRN (as needed), Sig (instructions), Dx (diagnosis), Rx (prescription), BP (blood pressure), HR (heart rate).
6. If text is unclear or partially illegible, put [?] for unreadable parts. Do NOT guess or fabricate text.
7. For mixed content (typed + handwritten on same page), output all of it in reading order (top to bottom, left to right).
8. Tables: preserve column alignment using spaces.

Output the digitized text now:`;
