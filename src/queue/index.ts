import { env } from "../config/env";
import { MemoryQueue } from "./memoryQueue";
import { UpstashKafkaQueue } from "./upstashKafka";
import { QueueProvider } from "./types";

export function createQueue(): QueueProvider {
  if (env.QUEUE_DRIVER === "upstash") {
    return new UpstashKafkaQueue({
      url: env.UPSTASH_KAFKA_URL,
      username: env.UPSTASH_KAFKA_USERNAME,
      password: env.UPSTASH_KAFKA_PASSWORD,
    });
  }
  return new MemoryQueue();
}
