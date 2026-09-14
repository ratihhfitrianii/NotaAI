import { PNG } from "pngjs";
import { decode as decodeJpeg } from "jpeg-js";

/** Informasi dasar gambar — dipakai mock OCR untuk "membaca" foto yang diunggah. */
export interface ImageInfo {
  width: number;
  height: number;
  format: string;
}

/** Deteksi format & dimensi dari buffer file (PNG/JPEG). Kembalikan null bila bukan gambar dikenal. */
export function getImageInfo(buf: Buffer): ImageInfo | null {
  if (!buf || buf.length < 8) return null;

  const isPng =
    buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47;
  if (isPng) {
    try {
      const png = PNG.sync.read(buf);
      return { width: png.width, height: png.height, format: "png" };
    } catch {
      return null;
    }
  }

  const isJpeg = buf[0] === 0xff && buf[1] === 0xd8;
  if (isJpeg) {
    try {
      const jpeg = decodeJpeg(buf);
      return { width: jpeg.width, height: jpeg.height, format: "jpeg" };
    } catch {
      return null;
    }
  }

  return null;
}
