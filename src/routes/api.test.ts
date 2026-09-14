import request from "supertest";
import { startServer } from "../server";

describe("API NotaAI (integration)", () => {
  let stop: () => Promise<void>;
  let app: import("express").Express;

  beforeAll(async () => {
    const s = await startServer();
    app = s.app;
    stop = s.stop;
  }, 30000);

  afterAll(async () => {
    await stop();
  });

  it("GET /api/v1/health", async () => {
    const res = await request(app).get("/api/v1/health");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ok");
    expect(["memory", "upstash"]).toContain(res.body.queue);
  });

  it("POST /api/v1/exams/submit matematika → 202 queued", async () => {
    const res = await request(app)
      .post("/api/v1/exams/submit")
      .send({
        documentId: "doc-api-1",
        imageUrl: "https://img.example.com/math1.jpg",
        subjectType: "matematika",
        answerKey: JSON.stringify({
          steps: [{ expression: "x=2", points: 1 }],
          totalPoints: 1,
        }),
      });
    expect(res.status).toBe(202);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe("queued");
    expect(res.body.data.documentId).toBe("doc-api-1");
  });

  it("POST /api/v1/exams/submit validasi: subjectType tak dikenal → 400", async () => {
    const res = await request(app).post("/api/v1/exams/submit").send({
      documentId: "x",
      imageUrl: "https://x.com/a.jpg",
      subjectType: "fisika",
    });
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });
});
