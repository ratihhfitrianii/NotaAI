import { OcrAdapter } from "./types";
import { OcrResult } from "../types";
import { createWorker, Worker } from "tesseract.js";
import { getImageInfo } from "../lib/imageInfo";
import { logger } from "../lib/logger";

/**
 * OCR lokal via Tesseract.js — membaca tulisan dari foto TANPA API key.
 * Cocok untuk demo/lokal: hasil adalah teks yang benar-benar terbaca.
 * Worker di-cache agar upload multi-file cepat.
 */
let workerPromise: Promise<Worker> | null = null;

async function getWorker(): Promise<Worker> {
  if (!workerPromise) {
    workerPromise = createWorker("eng").catch((err) => {
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
      const buf = Buffer.from(input.imageBase64, "base64");
      try {
        const worker = await getWorker();
        const { data } = await worker.recognize(buf);
        text = (data.text || "").trim();
      } catch (err) {
        logger.warn("tesseract gagal membaca, fallback info file", {
          err: String(err),
        });
      }
      if (!text) {
        const info = getImageInfo(buf);
        if (info) {
          text = `[gambar ${info.width}×${info.height}px ${info.format} — teks tidak terdeteksi]`;
        } else {
          text = `[${fileLabel} — ${(buf.length / 1024).toFixed(0)} KB (bukan gambar yang didukung)]`;
        }
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