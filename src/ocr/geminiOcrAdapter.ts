import { OcrAdapter } from "./types";
import { OcrResult } from "../types";
import sharp from "sharp";
import { logger } from "../lib/logger";
import { RateLimitError } from "../lib/errors";

// @google/genai adalah ESM-only — gunakan dynamic import agar kompatibel CommonJS.
type GoogleGenAIInstance = import("@google/genai", {
  with: { "resolution-mode": "import" },
}).GoogleGenAI;
async function getGenAI(): Promise<
  typeof import("@google/genai", { with: { "resolution-mode": "import" } })
> {
  return import("@google/genai");
}

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
  private genai: GoogleGenAIInstance;

  constructor(apiKey: string) {
    // Instansiasi dilakukan async via init() karena ESM dynamic import.
    this.apiKey = apiKey;
    this.genai = null as unknown as GoogleGenAIInstance;
  }
  private apiKey: string;

  async init(): Promise<void> {
    if (!this.genai) {
      const mod = await getGenAI();
      this.genai = new mod.GoogleGenAI({ apiKey: this.apiKey });
    }
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
      await this.init();

      // Deteksi mime type dari nama file
      const ext = (input.imageFileName ?? "").toLowerCase();
      let mimeType = "image/jpeg";
      if (ext.endsWith(".png")) mimeType = "image/png";
      else if (ext.endsWith(".webp")) mimeType = "image/webp";
      else if (ext.endsWith(".gif")) mimeType = "image/gif";

      // Optimasi: resize gambar ke max 1600px + konversi ke JPEG q80.
      // Payload lebih kecil 5-10x → Gemini jauh lebih cepat merespons.
      const rawBuf = Buffer.from(input.imageBase64, "base64");
      let payload = input.imageBase64;
      try {
        const meta = await sharp(rawBuf).metadata();
        if (
          (meta.width ?? 0) > 1600 ||
          (meta.height ?? 0) > 1600 ||
          meta.format !== "jpeg"
        ) {
          const resized = await sharp(rawBuf)
            .resize({
              width: 1600,
              height: 1600,
              fit: "inside",
              withoutEnlargement: true,
            })
            .jpeg({ quality: 80 })
            .toBuffer();
          payload = resized.toString("base64");
          mimeType = "image/jpeg";
        }
      } catch {
        // Pakai asli bila resize gagal
      }

      const response = await this.genai.models.generateContent({
        model: "gemini-3.6-flash",
        contents: [
          {
            inlineData: {
              mimeType,
              data: payload,
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
      // Deteksi 429 (quota habis / rate limit) — lempar RateLimitError agar pipeline bisa fallback
      const msg = err instanceof Error ? err.message : String(err);
      if (
        msg.includes("429") ||
        msg.includes("RESOURCE_EXHAUSTED") ||
        msg.includes("quota")
      ) {
        logger.warn("gemini OCR: quota/rate limit habis", {
          msg: msg.slice(0, 200),
        });
        throw new RateLimitError(
          "gemini",
          `Gemini quota habis — fallback ke Tesseract`,
          60,
        );
      }
      logger.error("gemini OCR gagal", { err: msg.slice(0, 200) });
      return {
        subject: "inggris",
        text: `[gemini OCR gagal: ${msg.slice(0, 300)}]`,
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
8. FORMS & FIELDS: if the image is a form (prescription, registration form, etc.), keep every field in its original position — e.g. "ADDRESS" and "DATE" side by side at the top, signatures right-aligned where they appear on the right side, notes aligned as in the original. Pad with leading spaces to reflect right-aligned or centered elements. Never merge separate fields into one line and never flatten the layout into a left-aligned list.
9. TABLES: CRITICAL — if the image contains a table/spreadsheet/grid of data, output it as a Markdown table. Format:
   | Header 1 | Header 2 | Header 3 |
   |----------|----------|----------|
   | cell 1   | cell 2   | cell 3   |
   Put the exact number of columns. Combine merged cells by repeating the value. Empty cells stay empty. If the table has no header row, use the first row as header. A table can have many rows — output ALL of them, never truncate.

Output the digitized text now:`;
