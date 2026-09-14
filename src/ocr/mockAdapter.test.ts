import { MockOcrAdapter } from "./mockAdapter";
import { toPinyin } from "../lib/pinyin";

describe("MockOcrAdapter", () => {
  it("matematika → latex", async () => {
    const a = new MockOcrAdapter();
    const r = await a.recognize({
      imageUrl: "https://x.com/math.jpg",
      languageHint: undefined,
    });
    expect(r.subject).toBe("matematika");
    if (r.subject === "matematika") expect(r.latex).toContain("^");
  });
  it("mandarin → hanzi + pinyin", async () => {
    const a = new MockOcrAdapter();
    const r = await a.recognize({
      imageUrl: "https://x.com/zh.jpg",
      languageHint: "zh",
    });
    expect(r.subject).toBe("mandarin");
    if (r.subject === "mandarin") {
      expect(r.hanzi).toContain("我");
      expect(r.pinyin.length).toBeGreaterThan(0);
    }
  });
  it("inggris → teks", async () => {
    const a = new MockOcrAdapter();
    const r = await a.recognize({
      imageUrl: "https://x.com/en.jpg",
      languageHint: "en",
    });
    expect(r.subject).toBe("inggris");
    if (r.subject === "inggris") expect(r.text.length).toBeGreaterThan(0);
  });
});

describe("toPinyin", () => {
  it("kamus statis: 中文 → pinyin", () => {
    const p = toPinyin("中");
    expect(p).toBe("zhōng");
  });
  it("teks campuran mempertahankan non-Hanzi", () => {
    expect(toPinyin("中文 123")).toContain("123");
  });
});
