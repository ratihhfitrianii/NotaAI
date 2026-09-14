import { OcrAdapter } from "./types";
import { OcrResult } from "../types";

/**
 * Fallback OCR (OCR_MODE=mock) — tanpa API key, untuk uji & dev.
 * Menggunakan pinyin-pro untuk pinyin dinamis bila tersedia, atau kamus statis.
 */
export class MockOcrAdapter implements OcrAdapter {
  readonly provider = "mock";
  private readonly pinyin: (s: string) => string | null;

  constructor() {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { pinyin } = require("pinyin-pro") as {
        pinyin: (s: string) => string;
      };
      this.pinyin = pinyin;
    } catch {
      this.pinyin = () => null;
    }
  }

  async recognize(opts: {
    imageUrl: string;
    languageHint?: "zh" | "en";
  }): Promise<OcrResult> {
    const url = opts.imageUrl.toLowerCase();

    if (
      opts.languageHint === "zh" ||
      url.includes("mandarin") ||
      url.includes("zh")
    ) {
      const hanzi = "我 是 中 国 人".trim();
      return { subject: "mandarin", hanzi, pinyin: this.hanziToPinyin(hanzi) };
    }
    if (
      url.includes("inggris") ||
      url.includes("english") ||
      opts.languageHint === "en"
    ) {
      return {
        subject: "inggris",
        text: "The quick brown fox jumps over the lazy dog.",
      };
    }
    // Matematika (Mathpix fallback): ekspresi LaTeX.
    return { subject: "matematika", latex: "x^2 + y^2 = z^2" };
  }

  private hanziToPinyin(s: string): string {
    return s
      .split(/\s+/)
      .map((w) => this.pinyin?.(w) || w)
      .join(" ");
  }
}
