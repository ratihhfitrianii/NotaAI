import request from "supertest";
import fs from "fs";
import path from "path";
import { startServer } from "../server";

describe("API NotaAI OCR (integration)", () => {
  let stop: () => Promise<void>;
  let app: import("express").Express;

  beforeAll(async () => {
    const s = await startServer({ useMemoryQueue: true });
    stop = s.stop;
    app = s.app;
  });

  afterAll(async () => {
    await stop();
  });

  describe("GET /api/v1/health", () => {
    it("mengembalikan status ok", async () => {
      const res = await request(app).get("/api/v1/health");
      expect(res.status).toBe(200);
      expect(res.body.status).toBe("ok");
      expect(res.body.queue).toBe("memory");
    });
  });

  describe("POST /api/v1/exams (submit JSON)", () => {
    it("201 bila valid", async () => {
      const res = await request(app).post("/api/v1/exams").send({
        documentId: "test-1",
        imageUrl: "https://img.example.com/note.jpg",
      });
      expect(res.status).toBe(201);
      expect(res.body.code).toBe("OK");
      expect(res.body.data.documentId).toBe("test-1");
      expect(res.body.data.ocr).toBeDefined();
    });

    it("opsional subjectType", async () => {
      const res = await request(app).post("/api/v1/exams").send({
        documentId: "test-subject",
        imageUrl: "https://img.example.com/math.jpg",
        subjectType: "matematika",
      });
      expect(res.status).toBe(201);
      expect(res.body.data.ocr.subject).toBe("matematika");
      expect(res.body.data.ocr.latex).toBeDefined();
    });

    it("400 bila imageUrl kosong", async () => {
      const res = await request(app)
        .post("/api/v1/exams")
        .send({ documentId: "test-2" });
      expect(res.status).toBe(400);
      expect(res.body.code).toBe("VALIDATION_ERROR");
    });
  });

  describe("POST /api/v1/upload (multipart)", () => {
    const samplePath = path.join(process.cwd(), "sample-math.png");

    it("201 bila upload minimal 1 file", async () => {
      if (!fs.existsSync(samplePath)) {
        console.warn("sample-math.png tidak ditemukan, skip test upload");
        return;
      }
      const res = await request(app)
        .post("/api/v1/upload")
        .attach("files", samplePath);
      expect(res.status).toBe(201);
      expect(res.body.code).toBe("OK");
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThanOrEqual(1);
      expect(res.body.data[0].ocr).toBeDefined();
    });

    it("bisa upload beberapa file sekaligus", async () => {
      if (!fs.existsSync(samplePath)) {
        console.warn("sample-math.png tidak ditemukan, skip test multi upload");
        return;
      }
      const res = await request(app)
        .post("/api/v1/upload")
        .attach("files", samplePath)
        .attach("files", samplePath);
      expect(res.status).toBe(201);
      expect(res.body.data.length).toBe(2);
    });

    it("400 bila tidak ada file", async () => {
      const res = await request(app).post("/api/v1/upload");
      expect(res.status).toBe(400);
      expect(res.body.code).toBe("VALIDATION_ERROR");
    });
  });

  describe("GET /api/v1/documents", () => {
    it("mengembalikan array", async () => {
      const res = await request(app).get("/api/v1/documents");
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
    });
  });

  describe("GET /api/v1/documents/:id", () => {
    it("200 bila ada", async () => {
      // Submit dulu agar ada di repo
      await request(app).post("/api/v1/exams").send({
        documentId: "detail-test",
        imageUrl: "https://img.example.com/x.jpg",
      });
      const res = await request(app).get("/api/v1/documents/detail-test");
      expect(res.status).toBe(200);
      expect(res.body.data.documentId).toBe("detail-test");
    });

    it("404 bila tidak ada", async () => {
      const res = await request(app).get("/api/v1/documents/xyz-404");
      expect(res.status).toBe(404);
      expect(res.body.code).toBe("NOT_FOUND");
    });
  });
});
