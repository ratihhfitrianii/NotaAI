import { OcrAdapter } from "./types";
import { OcrResult } from "../types";
import { AppError } from "../lib/errors";
import { env } from "../config/env";
import { GoogleVisionOcrAdapter } from "./googleVisionAdapter";
import { extractJsonBlock } from "../grading/mathGrading";

/**
 * Adapter OCR Bahasa Inggris — Google Vision + Gemini 2.5 Flash (fallback: hanya Vision).
 * §2: "Google Vision API + Gemini 2.5 Flash → Teks digital terstruktur & Auto-Grammar".
 * Bila GEMINI_API_KEY tersedia dan dipanggil dengan `analyzeGrammar`, hasil Grammar
 * ditambahkan; bila tidak, kembalikan teks Vision apa adanya.
 */
export class EnglishOcrAdapter implements OcrAdapter {
  readonly provider = "vision+gemini";
  private readonly vision: OcrAdapter;
  private readonly apiKey: string;

  constructor(opts?: { vision?: OcrAdapter; apiKey?: string }) {
    this.vision = opts?.vision || new GoogleVisionOcrAdapter({});
    this.apiKey = opts?.apiKey || env.GEMINI_API_KEY;
  }

  async recognize(opts: {
    imageUrl: string;
    languageHint?: "en";
  }): Promise<Extract<OcrResult, { subject: "inggris" }>> {
    const visionResult = await this.vision.recognize({
      imageUrl: opts.imageUrl,
      languageHint: opts.languageHint || "en",
    });
    if (visionResult.subject !== "inggris") {
      throw new AppError(
        "OCR_FAILED",
        "Adapter Inggris menerima hasil non-Inggris",
        500,
      );
    }
    const text = visionResult.text;

    // Auto-Grammar via Gemini 2.5 Flash bila key tersedia.
    if (this.apiKey) {
      try {
        const grammar = await this.grammarCheck(text);
        return { subject: "inggris", text, grammar };
      } catch (err) {
        // Grammar gagal → tetap kembalikan teks (non-fatal).
        return { subject: "inggris", text };
      }
    }
    return { subject: "inggris", text };
  }

  /** Panggil Gemini 2.5 Flash untuk analisis grammar (output JSON). */
  private async grammarCheck(
    text: string,
  ): Promise<{ errors: string[]; suggestions: string[]; score: number }> {
    const prompt = `Koreksi grammar teks berikut, keluarkan JSON murni: {"errors":[{"original": "...", "suggestion": "..."}], "suggestions": ["..."], "fluency_score": 0-100}\n\nTeks:\n${text}`;
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${this.apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
      },
    );
    if (!res.ok)
      throw new AppError("LLM_FAILED", `Gemini gagal: HTTP ${res.status}`, 502);
    const data = (await res.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };
    const raw = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
    // Validasi JSON longgar; kebanyakan kembalikan teks apa adanya.
    try {
      const parsed: unknown = JSON.parse(extractJsonBlock(raw));
      const o = parsed as Record<string, unknown>;
      const score =
        typeof o.fluency_score === "number"
          ? Math.max(0, Math.min(100, Math.round(o.fluency_score)))
          : 100;
      return {
        errors: Array.isArray(o.errors)
          ? (o.errors as Array<Record<string, unknown>>).map((e) =>
              String(e.suggestion || e.original || ""),
            )
          : [],
        suggestions: Array.isArray(o.suggestions)
          ? o.suggestions.map(String)
          : [],
        score,
      };
    } catch {
      throw new AppError("LLM_FAILED", "Gemini output grammar non-JSON", 502);
    }
  }
}
