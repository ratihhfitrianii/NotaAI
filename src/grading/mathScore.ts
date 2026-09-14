import { MathAnswerKey } from "../types";
import { AppError } from "../lib/errors";

/**
 * Mesin penilaian matematika deterministik (tanpa LLM).
 * Membandingkan langkah siswa (OCR Mathpix LaTeX) dengan kunci jawaban resmi per langkah:
 *  - kecocokan persis (dengan normalisasi spasi/whitespace) → poin penuh;
 *  - baris siswa yang belum terwakili → dianggap langkah benar bila mengandung ekspresi kunci
 *    (fallback longgar untuk OCR yang tidak persis);
 *  - tanpa langkah yang cocok → 0.
 * Skor dinormalisasi ke 0–100; nilai_rekomendasi LLM dapat menimpanya di pipeline (`useLLMScore`).
 */

/** Normalisasi ekspresi LaTeX untuk perbandingan longgar. */
export function normalizeLatex(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

/** Pencocokan: apakah teks siswa mengandung ekspresi kunci (cocok sebagian)? */
function looseMatch(studentLatex: string, keyExpr: string): boolean {
  const n = normalizeLatex(keyExpr);
  if (!n) return false;
  // strip spasi kedua sisi agar urutan token lebih ketat
  return normalizeLatex(studentLatex)
    .replace(/ /g, "")
    .includes(n.replace(/ /g, ""));
}

export interface MathScoringInput {
  studentLatex: string;
  answerKey: MathAnswerKey;
}

export interface MathScoringResult {
  score: number;
  matchedSteps: number;
  totalSteps: number;
  matchedExpressions: string[];
  unmatchedExpressions: string[];
}

export function scoreMathAnswer({
  studentLatex,
  answerKey,
}: MathScoringInput): MathScoringResult {
  if (!answerKey.steps.length)
    throw new AppError("VALIDATION_ERROR", "Kunci jawaban kosong", 400);

  const totalPoints =
    answerKey.totalPoints ??
    answerKey.steps.reduce((s, st) => s + st.points, 0);
  if (totalPoints <= 0)
    throw new AppError(
      "VALIDATION_ERROR",
      "Total poin kunci jawaban harus > 0",
      400,
    );

  const normalizedStudent = normalizeLatex(studentLatex);
  const matchedExpressions: string[] = [];
  const unmatchedExpressions: string[] = [];
  let earned = 0;

  for (const step of answerKey.steps) {
    const exact = normalizeLatex(step.expression) === normalizedStudent;
    const contains = looseMatch(normalizedStudent, step.expression);
    if (exact || contains) {
      earned += step.points;
      matchedExpressions.push(step.expression);
    } else {
      unmatchedExpressions.push(step.expression);
    }
  }

  const score = Math.max(
    0,
    Math.min(100, Math.round((earned / totalPoints) * 100)),
  );
  return {
    score,
    matchedSteps: matchedExpressions.length,
    totalSteps: answerKey.steps.length,
    matchedExpressions,
    unmatchedExpressions,
  };
}
