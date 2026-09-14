import { OcrAdapter } from "./types";
import { OcrResult } from "../types";
import { AppError } from "../lib/errors";
import { env } from "../config/env";

/**
 * Adapter OCR Matematika — Mathpix OCR API.
 * Format output: LaTeX murni ($$ ... $$) sesuai §2 PRD.
 * Mathpix menerima image URL publik (imageUrl) atau base64 (opsional).
 */
export class MathpixOcrAdapter implements OcrAdapter {
  readonly provider = "mathpix";
  private readonly appId: string;
  private readonly appKey: string;

  constructor(opts?: { appId?: string; appKey?: string }) {
    this.appId = opts?.appId || env.MATHPIX_APP_ID;
    this.appKey = opts?.appKey || env.MATHPIX_APP_KEY;
  }

  async recognize(opts: {
    imageUrl: string;
  }): Promise<Extract<OcrResult, { subject: "matematika" }>> {
    if (!this.appId || !this.appKey) {
      throw new AppError(
        "OCR_FAILED",
        "Mathpix App ID/Key belum dikonfigurasi",
        503,
      );
    }
    const res = await fetch("https://api.mathpix.com/v3/latex", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        app_id: this.appId,
        app_key: this.appKey,
      },
      body: JSON.stringify({
        src: opts.imageUrl,
        formats: ["latex_simplified"],
        math_inline_delimiters: ["$", "$"],
        math_display_delimiters: ["$$", "$$"],
      }),
    });
    if (!res.ok) {
      throw new AppError(
        "OCR_FAILED",
        `Mathpix gagal: HTTP ${res.status}`,
        502,
      );
    }
    const data = (await res.json()) as { latex?: string };
    const latex = (data.latex || "").replace(/\s+/g, " ").trim();
    if (!latex)
      throw new AppError("OCR_FAILED", "Mathpix tidak mengenali konten", 422);
    return { subject: "matematika", latex };
  }
}
