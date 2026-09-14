import {
  extractJsonBlock,
  parseMathGradingJson,
  buildMathPrompt,
} from "../grading/mathGrading";
import { AppError } from "../lib/errors";

describe("extractJsonBlock", () => {
  it("mengambil JSON dari teks apa adanya", () => {
    expect(extractJsonBlock('{"a":1} trailing')).toBe('{"a":1}');
  });
  it("menangani blok kode markdown", () => {
    expect(extractJsonBlock('```json\n{"a":1}\n```')).toBe('{"a":1}');
  });
  it("memotong teks di sekitar objek", () => {
    expect(extractJsonBlock('prefix {"a":1} suffix')).toBe('{"a":1}');
  });
  it("kembalikan input bila tak ada kurung", () => {
    expect(extractJsonBlock("hello")).toBe("hello");
  });
});

describe("parseMathGradingJson", () => {
  it("parse output valid sesuai PRD §3", () => {
    const out = parseMathGradingJson(
      '{"status_jawaban": "benar", "transkripsi_langkah_latex": "x=2", "analisis_kesalahan": "", "nilai_rekomendasi": 92}',
    );
    expect(out.status_jawaban).toBe("benar");
    expect(out.transkripsi_langkah_latex).toBe("x=2");
    expect(out.analisis_kesalahan).toBe("");
    expect(out.nilai_rekomendasi).toBe(92);
  });
  it("mengapit nilai_rekomendasi ke 0–100", () => {
    expect(
      parseMathGradingJson(
        '{"status_jawaban":"s","transkripsi_langkah_latex":"","analisis_kesalahan":"","nilai_rekomendasi":150}',
      ).nilai_rekomendasi,
    ).toBe(100);
    expect(
      parseMathGradingJson(
        '{"status_jawaban":"s","transkripsi_langkah_latex":"","analisis_kesalahan":"","nilai_rekomendasi":-5}',
      ).nilai_rekomendasi,
    ).toBe(0);
  });
  it("menolak non-JSON", () => {
    expect(() => parseMathGradingJson("not json")).toThrow(AppError);
  });
  it("menolak skema tak sesuai PRD", () => {
    expect(() => parseMathGradingJson('{"foo":1}')).toThrow(AppError);
  });
});

describe("buildMathPrompt", () => {
  it("mengisi placeholder kunci & latex siswa", () => {
    const p = buildMathPrompt("x=1", "\\frac{1}{2}");
    expect(p).toContain("x=1");
    expect(p).toContain("\\frac{1}{2}");
    expect(p).not.toContain("{KUNCI_JAWABAN}");
  });
});
