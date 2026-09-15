import sharp from "sharp";
import { logger } from "./logger";

/**
 * Pra-proses gambar sebelum OCR:
 * 1. Grayscale  2. Tingkatkan kontras  3. Threshold biner
 * Hasil: buffer PNG grayscale yang jelas, cocok untuk Tesseract.
 */
export async function preprocessImage(input: Buffer): Promise<Buffer> {
  try {
    const meta = await sharp(input).metadata();
    const w = meta.width ?? 800;
    const h = meta.height ?? 600;

    // Langkah 1-2: grayscale + auto-contrast (normalize)
    let img = sharp(input)
      .grayscale()
      .normalize() // rentang 0-255 penuh
      .sharpen({ sigma: 1.2 }) // perjelas tepi huruf
      .resize({ width: Math.min(w, 2400), withoutEnlargement: true });

    // Langkah 3: Otsu threshold → hitam-putih bersih
    img = img.threshold(0); // 0 = auto (Otsu)

    return await img.png().toBuffer();
  } catch (err) {
    logger.warn("preprocessImage gagal, gunakan buffer asli", {
      err: String(err),
    });
    return input;
  }
}
