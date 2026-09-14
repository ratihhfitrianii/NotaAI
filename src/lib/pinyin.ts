/**
 * Kamus Hanzi → Pinyin (data statis kecil).
 * Produksi: perbesar lewat data terpisah atau layanan pinyin (mis. pinyin-pro npm).
 * `pinyin-pro` tersedia sebagai dependency untuk fallback dinamis bila kamus tak memuat karakter.
 */
export const PINYIN_STATIC: Record<string, string> = {
  中: "zhōng",
  国: "guó",
  人: "rén",
  我: "wǒ",
  是: "shì",
  的: "de",
  学: "xué",
  生: "shēng",
  老: "lǎo",
  师: "shī",
  爱: "ài",
  好: "hǎo",
  大: "dà",
  小: "xiǎo",
  天: "tiān",
  地: "dì",
  水: "shuǐ",
  火: "huǒ",
  山: "shān",
  月: "yuè",
  日: "rì",
  木: "mù",
  口: "kǒu",
  手: "shǒu",
  心: "xīn",
};

/**
 * Terjemahkan teks Hanzi → Pinyin.
 * 1) Karakter yang ada di kamus statis → langsung.
 * 2) Sisa → pinyin-pro bila tersedia (guard try/catch).
 * 3) Bukan Hanzi (huruf/angka) → dipertahankan apa adanya.
 */
export function toPinyin(input: string): string {
  const segments: string[] = [];
  let current = "";

  const flush = () => {
    if (current) {
      segments.push(convertHanziBlock(current));
      current = "";
    }
  };

  for (const ch of input) {
    if (/[\u4e00-\u9fff]/.test(ch)) {
      current += ch;
    } else {
      flush();
      segments.push(ch);
    }
  }
  flush();

  return segments.join("");
}

function convertHanziBlock(block: string): string {
  const out: string[] = [];
  let rest = "";
  for (const ch of block) {
    const known = PINYIN_STATIC[ch];
    if (known) {
      if (rest) {
        out.push(dynamicToPinyin(rest));
        rest = "";
      }
      out.push(known);
    } else {
      rest += ch;
    }
  }
  if (rest) out.push(dynamicToPinyin(rest));
  return out.join(" ");
}

function dynamicToPinyin(block: string): string {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { pinyin } = require("pinyin-pro") as {
      pinyin: (s: string) => string;
    };
    return pinyin(block);
  } catch {
    // Kamus statis tak memuat karakter ini dan pinyin-pro tak tersedia → kembalikan asli.
    return block;
  }
}
