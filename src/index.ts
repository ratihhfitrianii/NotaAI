import "dotenv/config";
import { startServer } from "./server";
import { env } from "./config/env";
import { logger } from "./lib/logger";

async function main(): Promise<void> {
  const { app, stop } = await startServer();
  const server = app.listen(env.PORT, () => {
    logger.info(`NotaAI worker berjalan di :${env.PORT}`, {
      driver: env.QUEUE_DRIVER,
      ocr: env.OCR_MODE,
      llm: env.LLM_MODE,
    });
  });

  const shutdown = async (signal: string) => {
    logger.info("shutdown diterima", { signal });
    server.close();
    await stop();
    process.exit(0);
  };
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
  process.on("SIGINT", () => void shutdown("SIGINT"));
}

void main();
