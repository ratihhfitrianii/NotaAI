import { OcrAdapter } from "./types";
import { OcrResult } from "../types";
import { AppError } from "../lib/errors";
import { env } from "../config/env";
import { toPinyin } from "../lib/pinyin";

/**
 * Adapter OCR Multibahasa — Google Cloud Vision API (REST).
 * - Mandarin: languageHint 'zh' → karakter Unicode Hanzi + Pinyin (§2).
 * - Inggris: teks digital terstruktur (§2).
 * Menggunakan endpoint annotate; fallback mock bila GOOGLE_VISION_API_KEY kosong (OCR_MODE=mock).
 */
export class GoogleVisionOcrAdapter implements OcrAdapter {
  readonly provider = "google-vision";
  private readonly apiKey: string;

  constructor(opts?: { apiKey?: string }) {
    this.apiKey = opts?.apiKey || env.GOOGLE_VISION_API_KEY;
  }

  async recognize(opts: {
    imageUrl: string;
    languageHint?: "zh" | "en";
  }): Promise<
    Extract<OcrResult, { subject: "mandarin" } | { subject: "inggris" }>
  > {
    if (!this.apiKey) {
      throw new AppError(
        "OCR_FAILED",
        "GOOGLE_VISION_API_KEY belum dikonfigurasi",
        503,
      );
    }
    const languageHints = opts.languageHint ? [opts.languageHint] : [];
    const body = {
      requests: [
        {
          image: { source: { imageUri: opts.imageUrl } },
          features: [{ type: "TEXT_DETECTION" }],
          imageContext: { languageHints },
        },
      ],
    };
    const res = await fetch(
      `https://vision.googleapis.com/v1/images:annotate?key=${this.apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      },
    );
    if (!res.ok) {
      throw new AppError(
        "OCR_FAILED",
        `Google Vision gagal: HTTP ${res.status}`,
        502,
      );
    }
    const data = (await res.json()) as {
      responses?: Array<{ textAnnotations?: Array<{ description?: string }> }>;
    };
    const text =
      data.responses?.[0]?.textAnnotations?.[0]?.description?.trim() || "";
    if (!text)
      throw new AppError(
        "OCR_FAILED",
        "Google Vision tidak mengenali teks",
        422,
      );

    if (opts.languageHint === "zh") {
      return { subject: "mandarin", hanzi: text, pinyin: toPinyin(text) };
    }
    return { subject: "inggris", text };
  }
}
