import { z } from "zod";

/**
 * Skema config terpusat, divalidasi saat boot (fail-fast).
 * Semua nilai dibaca dari env; default aman untuk mode development/mock.
 */
const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  PORT: z.coerce.number().int().positive().default(8080),

  QUEUE_DRIVER: z.enum(["memory", "upstash"]).default("memory"),
  QUEUE_TOPIC: z.string().min(1).default("ocr-processing-queue"),
  CONSUMER_INSTANCES: z.coerce.number().int().min(1).max(64).default(4),

  OCR_MODE: z.enum(["mock", "tesseract", "real"]).default("tesseract"),
  LLM_MODE: z.enum(["mock", "real"]).default("mock"),

  UPSTASH_KAFKA_URL: z.string().default(""),
  UPSTASH_KAFKA_USERNAME: z.string().default(""),
  UPSTASH_KAFKA_PASSWORD: z.string().default(""),
  UPSTASH_KAFKA_GROUP: z.string().default("notaai-worker"),
  UPSTASH_KAFKA_INSTANCE: z.string().default(""),

  MATHPIX_APP_ID: z.string().default(""),
  MATHPIX_APP_KEY: z.string().default(""),
  GOOGLE_VISION_API_KEY: z.string().default(""),
  GEMINI_API_KEY: z.string().default(""),

  SUPABASE_URL: z.string().default(""),
  SUPABASE_SERVICE_ROLE_KEY: z.string().default(""),
  SUPABASE_STORAGE_BUCKET: z.string().default("exam-photos"),
  DATABASE_URL: z.string().default(""),
});

export type Env = z.infer<typeof envSchema>;

function loadEnv(): Env {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `${i.path.join(".")}: ${i.message}`)
      .join("; ");
    throw new Error(`Konfigurasi env tidak valid: ${issues}`);
  }
  const cfg = parsed.data;

  // Validasi dependensi silang: mode produksi/real butuh kredensial.
  if (cfg.QUEUE_DRIVER === "upstash") {
    const missing = [
      "UPSTASH_KAFKA_URL",
      "UPSTASH_KAFKA_USERNAME",
      "UPSTASH_KAFKA_PASSWORD",
    ].filter((k) => !cfg[k as keyof Env]);
    if (missing.length)
      throw new Error(`QUEUE_DRIVER=upstash butuh: ${missing.join(", ")}`);
  }
  if (cfg.OCR_MODE === "real") {
    const missing: string[] = [];
    if (!cfg.MATHPIX_APP_ID || !cfg.MATHPIX_APP_KEY)
      missing.push("MATHPIX_APP_ID + MATHPIX_APP_KEY");
    if (!cfg.GOOGLE_VISION_API_KEY) missing.push("GOOGLE_VISION_API_KEY");
    if (missing.length)
      throw new Error(`OCR_MODE=real butuh: ${missing.join(", ")}`);
  }
  if (cfg.LLM_MODE === "real" && !cfg.GEMINI_API_KEY) {
    throw new Error("LLM_MODE=real butuh: GEMINI_API_KEY");
  }
  return cfg;
}

export const env: Env = loadEnv();
