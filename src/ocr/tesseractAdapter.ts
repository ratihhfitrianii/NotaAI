import { OcrAdapter } from "./types";
import { OcrResult } from "../types";
import { createWorker, Worker } from "tesseract.js";
import { preprocessImage } from "../lib/preprocessImage";
import { logger } from "../lib/logger";

/**
 * OCR lokal via Tesseract.js — membaca tulisan dari foto TANPA API key.
 * Pra-proses: grayscale + kontras + threshold → hasil jauh lebih akurat.
 * Multi-bahasa: eng+ind (deteksi otomatis).
 */
let workerPromise: Promise<Worker> | null = null;

async function getWorker(): Promise<Worker> {
  if (!workerPromise) {
    workerPromise = createWorker("eng+ind").catch((err) => {
      logger.error("gagal memuat worker tesseract", { err: String(err) });
      workerPromise = null;
      throw err;
    });
  }
  return workerPromise;
}

export class TesseractOcrAdapter implements OcrAdapter {
  readonly provider = "tesseract-local";

  async recognize(input: {
    imageUrl: string;
    imageBase64?: string;
    imageFileName?: string;
    languageHint?: string;
  }): Promise<OcrResult> {
    const fileLabel = input.imageFileName ?? input.imageUrl;
    let text = "";

    if (input.imageBase64) {
      const rawBuf = Buffer.from(input.imageBase64, "base64");

      // Pra-proses: grayscale + kontras + threshold → teks lebih jelas
      const processed = await preprocessImage(rawBuf);

      try {
        const worker = await getWorker();
        const { data } = await worker.recognize(processed);
        text = (data.text || "").trim();
      } catch (err) {
        logger.warn("tesseract gagal membaca", { err: String(err) });
      }

      if (!text) {
        text = `[gambar — teks tidak terdeteksi]`;
      }
    } else {
      text = `[gambar dari URL: ${input.imageUrl}]`;
    }

    return {
      subject: "inggris",
      text,
      source: fileLabel,
    };
  }
}
