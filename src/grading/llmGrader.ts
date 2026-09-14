import { AppError } from "../lib/errors";
import { env } from "../config/env";
import {
  extractJsonBlock,
  parseMathGradingJson,
  MathGradingJson,
} from "../grading/mathGrading";
import { GradingResult, OcrResult } from "../types";

/**
 * Grader berbasis LLM — Gemini 2.5 Flash (JSON mode) untuk English & Math,
 * mengikuti §2 & prompt JSON §3 PRD.
 * Bila LLM_MODE=mock / tanpa key → fallback deterministik (skor 0 untuk LLM-only path).
 */
export interface LlmGrader {
  /** Koreksi esai/teks Inggris: skor + analisis grammar. */
  gradeEnglish(input: {
    text: string;
    answerKey?: string;
  }): Promise<{ score: number; explanation: string }>;
  /** Koreksi matematika via LLM (JSON mode §3); `latexSiswa` hasil OCR Mathpix, `kunci` kunci jawaban resmi. */
  gradeMath(input: {
    latexSiswa: string;
    kunci: string;
  }): Promise<MathGradingJson>;
}

export class GeminiLlmGrader implements LlmGrader {
  private readonly apiKey: string;

  constructor(opts?: { apiKey?: string }) {
    this.apiKey = opts?.apiKey || env.GEMINI_API_KEY;
  }

  private async generate(prompt: string): Promise<string> {
    if (!this.apiKey)
      throw new AppError(
        "LLM_FAILED",
        "GEMINI_API_KEY belum dikonfigurasi",
        503,
      );
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${this.apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { responseMimeType: "application/json" },
        }),
      },
    );
    if (!res.ok)
      throw new AppError("LLM_FAILED", `Gemini gagal: HTTP ${res.status}`, 502);
    const data = (await res.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };
    return data.candidates?.[0]?.content?.parts?.[0]?.text || "";
  }

  async gradeEnglish(input: {
    text: string;
    answerKey?: string;
  }): Promise<{ score: number; explanation: string }> {
    const prompt = `Koreksi esai bahasa Inggris berikut. Keluarkan JSON murni: {"score": 0-100, "feedback": "..."}${input.answerKey ? `, bandingkan dengan kunci jawaban: ${input.answerKey}` : ""}\n\nTeks:\n${input.text}`;
    const raw = await this.generate(prompt);
    try {
      const o = JSON.parse(extractJsonBlock(raw)) as Record<string, unknown>;
      const score =
        typeof o.score === "number"
          ? Math.max(0, Math.min(100, Math.round(o.score)))
          : 0;
      return {
        score,
        explanation: typeof o.feedback === "string" ? o.feedback : "",
      };
    } catch {
      throw new AppError("LLM_FAILED", "Gemini output English non-JSON", 502);
    }
  }

  async gradeMath(input: {
    latexSiswa: string;
    kunci: string;
  }): Promise<MathGradingJson> {
    const raw = await this.generate(
      `Kamu adalah Guru Matematika dan AI Korektor Ujian.\nLangkah siswa (LaTeX): ${input.latexSiswa}\nKunci jawaban resmi: ${input.kunci}\nKeluarkan JSON murni: {"status_jawaban": "...", "transkripsi_langkah_latex": "...", "analisis_kesalahan": "...", "nilai_rekomendasi": 0-100}`,
    );
    return parseMathGradingJson(raw);
  }
}

/**
 * Grader deterministik (LLM_MODE=mock) — tanpa API key.
 * - Math: pakai `scoreMathAnswer` (engine lokal).
 * - English: skor 0 + catatan (butuh LLM untuk grammar).
 */
export class DeterministicLlmGrader implements LlmGrader {
  async gradeEnglish(): Promise<{ score: number; explanation: string }> {
    return {
      score: 0,
      explanation: "Mode mock: koreksi grammar memerlukan GEMINI_API_KEY.",
    };
  }
  async gradeMath(): Promise<MathGradingJson> {
    throw new AppError(
      "LLM_FAILED",
      "Mode mock: koreksi matematika via LLM memerlukan GEMINI_API_KEY.",
      503,
    );
  }
}

export function createLlmGrader(): LlmGrader {
  return env.LLM_MODE === "real"
    ? new GeminiLlmGrader()
    : new DeterministicLlmGrader();
}

/** Gunakan skor LLM (nilai_rekomendasi) sebagai skor final bila tersedia. */
export function toGradingResult(opts: {
  documentId: string;
  subjectType: GradingResult["subjectType"];
  ocr: OcrResult;
  score: number;
  status?: GradingResult["status"];
  explanation?: string;
  analysis?: string;
  warning?: string;
}): GradingResult {
  return {
    documentId: opts.documentId,
    subjectType: opts.subjectType,
    status: opts.status || "selesai",
    score: opts.score,
    ocr: opts.ocr,
    explanation: opts.explanation,
    analysis: opts.analysis,
    evaluatedAt: new Date().toISOString(),
    warning: opts.warning,
  };
}
