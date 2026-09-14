import { scoreMathAnswer } from "./mathScore";
import { AppError } from "../lib/errors";

const key = {
  steps: [
    { expression: "x^2 + y^2 = z^2", points: 2 },
    { expression: "x = 2", points: 1 },
    { expression: "y = 3", points: 1 },
  ],
  totalPoints: 4,
};

describe("scoreMathAnswer", () => {
  it("skor penuh saat semua langkah cocok persis", () => {
    const r = scoreMathAnswer({
      studentLatex: "x^2 + y^2 = z^2 ; x = 2 ; y = 3",
      answerKey: key,
    });
    expect(r.matchedSteps).toBe(3);
    expect(r.totalSteps).toBe(3);
    expect(r.score).toBe(100);
  });
  it("skor proporsional saat sebagian cocok (2 dari 3)", () => {
    const r = scoreMathAnswer({
      studentLatex: "x^2 + y^2 = z^2 ; x = 2",
      answerKey: key,
    });
    expect(r.score).toBe(75);
    expect(r.unmatchedExpressions).toEqual(["y = 3"]);
  });
  it("lolos dengan kecocokan longgar (spasi/urutan)", () => {
    const r = scoreMathAnswer({ studentLatex: "x=2", answerKey: key });
    expect(r.matchedSteps).toBe(1);
    expect(r.score).toBe(25);
  });
  it("skor 0 saat tidak ada langkah cocok", () => {
    const r = scoreMathAnswer({ studentLatex: "q = 9", answerKey: key });
    expect(r.score).toBe(0);
    expect(r.matchedExpressions).toEqual([]);
  });
  it("menolak kunci jawaban kosong", () => {
    expect(() =>
      scoreMathAnswer({ studentLatex: "x", answerKey: { steps: [] } }),
    ).toThrow(AppError);
  });
});
