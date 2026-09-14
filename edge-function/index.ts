/// <reference types="https://esm.sh/@supabase/functions-js/src/edge-runtime.d.ts" />

/**
 * NotaAI — Supabase Edge Function: producer antrean (pola §4 PRD).
 * Menerima foto ujian dari Flutter, verifikasi minimal, lalu mem-produce
 * ke Upstash Kafka REST dalam < 50 ms. Tidak menunggu proses OCR.
 */
import { Kafka } from "https://esm.sh/@upstash/kafka@1.3.5";

const kafka = new Kafka({
  url: Deno.env.get("UPSTASH_KAFKA_URL")!,
  username: Deno.env.get("UPSTASH_KAFKA_USERNAME")!,
  password: Deno.env.get("UPSTASH_KAFKA_PASSWORD")!,
});
const producer = kafka.producer();
const TOPIC = "ocr-processing-queue";

const SUBJECTS = ["matematika", "mandarin", "inggris"];

Deno.serve(async (req: Request) => {
  // CORS untuk Flutter web / dev
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders() });
  }
  if (req.method !== "POST") {
    return json({ error: "Method tidak diizinkan" }, 405);
  }

  try {
    const body = await req.json();
    const documentId = String(body?.documentId || "");
    const imageUrl = String(body?.imageUrl || "");
    const subjectType = String(body?.subjectType || "");

    if (!documentId || !imageUrl || !subjectType) {
      return json(
        { error: "documentId, imageUrl, subjectType wajib diisi" },
        400,
      );
    }
    if (!SUBJECTS.includes(subjectType)) {
      return json(
        { error: `subjectType harus salah satu dari: ${SUBJECTS.join(", ")}` },
        400,
      );
    }

    // Producer ringan → antrean menerima beban, DB tak terbebani (§1)
    const payload = {
      documentId,
      imageUrl,
      subjectType,
      answerKey: body?.answerKey,
      answerKeyId: body?.answerKeyId,
      maxScore: body?.maxScore,
      language: body?.language,
    };
    await producer.produce(TOPIC, JSON.stringify(payload));

    return json(
      {
        success: true,
        message: "Ujian diterima; diproses asinkron.",
        data: { documentId, status: "queued", queue: "upstash-kafka" },
      },
      202,
    );
  } catch (e) {
    console.error("produce error", e);
    return json({ error: "Gagal mengantrekan ujian", detail: String(e) }, 500);
  }
});

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders() },
  });
}

function corsHeaders(): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type",
  };
}
