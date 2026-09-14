import { QueueProvider } from "./types";
import { OcrTask } from "../types";

/**
 * Antrean Upstash Kafka via REST API (pola §4 PRD).
 * Producer ringan: satu POST → tugas masuk antrean dalam < 50 ms tanpa membebani DB.
 */
export class UpstashKafkaQueue implements QueueProvider {
  readonly driver = "upstash" as const;
  private readonly url: string;
  private readonly username: string;
  private readonly password: string;

  constructor(opts: { url: string; username: string; password: string }) {
    this.url = opts.url.replace(/\/+$/, "");
    this.username = opts.username;
    this.password = opts.password;
  }

  private authHeader(): string {
    return `Basic ${Buffer.from(`${this.username}:${this.password}`).toString("base64")}`;
  }

  async push(task: OcrTask): Promise<void> {
    const res = await fetch(
      `${this.url}/produce/${encodeURIComponent("ocr-processing-queue")}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: this.authHeader(),
        },
        body: JSON.stringify({ value: JSON.stringify(task) }),
      },
    );
    if (!res.ok) {
      throw new Error(
        `Upstash Kafka produce gagal: HTTP ${res.status} ${await res.text()}`,
      );
    }
  }

  /** Consumption via REST belum didukung Upstash — gunakan SDK konsumen (lihat docs). */
  async consume(): Promise<() => Promise<void>> {
    throw new Error(
      "Konsumsi Upstash via REST tidak didukung; gunakan @upstash/kafka consumer SDK.",
    );
  }
}
