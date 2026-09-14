import { AppError } from "../lib/errors";

/**
 * Prompt korektor ujian matematika (cetak biru prompt §3 PRD).
 * `{KUNCI_JAWABAN}` diisi kunci jawaban resmi; `{LATEX_SISWA}` diisi hasil OCR Mathpix.
 * Output diminta JSON murni — di-parse dengan `parseMathGradingJson`.
 */
export const MATH_GRADING_SYSTEM_PROMPT = `
Kamu adalah Guru Matematika dan AI Korektor Ujian. Tugasmu memeriksa jawaban matematika tulisan tangan siswa.

1. Input berupa teks hasil OCR Mathpix dalam format LaTeX.
2. Analisis langkah demi langkah penyelesaian siswa dan bandingkan dengan Kunci Jawaban Resmi: {KUNCI_JAWABAN}.
3. Berikut adalah langkah penyelesaian siswa (hasil OCR Mathpix, LaTeX):
{LATEX_SISWA}
4. Keluarkan output dalam format JSON murni: {"status_jawaban": "...", "transkripsi_langkah_latex": "...", "analisis_kesalahan": "...", "nilai_rekomendasi": 0-100}
`.trim();

/** Hasil parse JSON korektor matematika (sesuai skema §3). */
export interface MathGradingJson {
  status_jawaban: string;
  transkripsi_langkah_latex: string;
  analisis_kesalahan: string;
  nilai_rekomendasi: number;
}

/** Ambil blok JSON murni dari teks yang mungkin dibungkus markdown/code-fence. */
export function extractJsonBlock(text: string): string {
  let t = text.trim();
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (fence) t = fence[1].trim();
  const start = t.indexOf("{");
  const end = t.lastIndexOf("}");
  if (start !== -1 && end !== -1 && end > start) t = t.slice(start, end + 1);
  return t;
}

/** Parse + validasi output JSON korektor sesuai skema PRD §3. */
export function parseMathGradingJson(raw: string): MathGradingJson {
  let obj: unknown;
  try {
    obj = JSON.parse(extractJsonBlock(raw));
  } catch {
    throw new AppError(
      "LLM_FAILED",
      "Korektor menampilkan output non-JSON",
      502,
    );
  }
  if (typeof obj !== "object" || obj === null) {
    throw new AppError("LLM_FAILED", "Output korektor bukan objek JSON", 502);
  }
  const o = obj as Record<string, unknown>;
  const nilai = o.nilai_rekomendasi;
  if (
    typeof o.status_jawaban !== "string" ||
    typeof o.transkripsi_langkah_latex !== "string" ||
    typeof o.analisis_kesalahan !== "string" ||
    typeof nilai !== "number" ||
    !Number.isFinite(nilai)
  ) {
    throw new AppError(
      "LLM_FAILED",
      "Skema JSON korektor tidak sesuai PRD §3",
      502,
    );
  }
  return {
    status_jawaban: o.status_jawaban,
    transkripsi_langkah_latex: o.transkripsi_langkah_latex,
    analisis_kesalahan: o.analisis_kesalahan,
    nilai_rekomendasi: Math.max(0, Math.min(100, Math.round(nilai))),
  };
}

/** Warnai prompt dengan kunci jawaban & transkripsi siswa. */
export function buildMathPrompt(
  answerKey: string,
  studentLatex: string,
): string {
  return MATH_GRADING_SYSTEM_PROMPT.replace("{KUNCI_JAWABAN}", answerKey)
    .replace("{LATEX_SISWA}", studentLatex)
    .replace(/\{\{LATEX_SISWA\}\}/g, studentLatex);
}
