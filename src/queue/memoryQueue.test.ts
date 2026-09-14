import { MemoryQueue } from "./memoryQueue";
import { OcrTask } from "../types";

const task: OcrTask = {
  documentId: "doc-1",
  imageUrl: "https://example.com/a.jpg",
  subjectType: "matematika",
};

describe("MemoryQueue", () => {
  it("push lalu consume memanggil handler", async () => {
    const q = new MemoryQueue();
    const received: OcrTask[] = [];
    await q.consume((t) => {
      received.push(t);
      return Promise.resolve();
    });
    await q.push(task);
    // Beri event loop kesempatan memproses.
    await new Promise((r) => setTimeout(r, 10));
    expect(received).toHaveLength(1);
    expect(received[0].documentId).toBe("doc-1");
  });

  it("handler error tidak menghentikan queue", async () => {
    const q = new MemoryQueue();
    let called = 0;
    await q.consume(async () => {
      called++;
      throw new Error("boom");
    });
    await q.push(task);
    await new Promise((r) => setTimeout(r, 10));
    expect(called).toBe(1);
    // Tetap bisa push lagi.
    await q.push(task);
    await new Promise((r) => setTimeout(r, 10));
    expect(called).toBe(2);
  });
});
