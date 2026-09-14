import { OcrAdapter } from "./types";
import { OcrResult, SubjectType } from "../types";
import { getImageInfo } from "../lib/imageInfo";

/**
 * Mock OCR — meniru hasil OCR dari foto asli.
 * Tanpa subjek → mode teks generik (baca info file).
 * Dengan subjek → simulasi per-bidang.
 */
export class MockOcrAdapter implements OcrAdapter {
  readonly provider = "mock";
  private subject?: SubjectType;

  constructor(subject?: SubjectType) {
    this.subject = subject;
  }

  async recognize(input: {
    imageUrl: string;
    imageBase64?: string;
    imageFileName?: string;
    languageHint?: string;
  }): Promise<OcrResult> {
    const src = input.imageBase64
      ? `${input.imageFileName ?? "foto"} (foto asli)`
      : input.imageUrl;

    // Baca info foto asli bila ada
    let meta = "";
    if (input.imageBase64) {
      const buf = Buffer.from(input.imageBase64, "base64");
      const info = getImageInfo(buf);
      if (info) {
        meta = `${info.width}×${info.height}px ${info.format}`;
      } else {
        meta = `${buf.length} bytes (format tidak dikenali)`;
      }
    }

    const source = meta ? `${src} — ${meta}` : src;

    if (this.subject === "matematika") {
      return {
        subject: "matematika",
        latex: "$$x^2 + y^2 = z^2$$",
        rawText: `[mock] x^2 + y^2 = z^2`,
        source,
      };
    }

    if (this.subject === "mandarin") {
      return {
        subject: "mandarin",
        hanzi: "我 是 中 国 人",
        pinyin: "wǒ shì zhōng guó rén",
        source,
      };
    }

    // Default: teks generik — cocok untuk dokumen/corat-coret/apapun
    return {
      subject: "inggris",
      text: `[digitalisasi] Dokumen ${input.imageFileName ?? input.imageUrl} — ${meta || "terbaca"}`,
      source,
    };
  }
}
