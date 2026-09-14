type Level = "debug" | "info" | "warn" | "error";

const LEVELS: Record<Level, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

const currentLevel: Level = (process.env.LOG_LEVEL as Level) || "info";

function log(
  level: Level,
  msg: string,
  fields?: Record<string, unknown>,
): void {
  if (LEVELS[level] < LEVELS[currentLevel]) return;
  const entry: Record<string, unknown> = {
    ts: new Date().toISOString(),
    level,
    msg,
  };
  if (fields) Object.assign(entry, fields);
  // JSON satu baris agar mudah di-parse di Cloud Run / GCP Logging.
  process.stdout.write(`${JSON.stringify(entry)}\n`);
}

export const logger = {
  debug: (msg: string, fields?: Record<string, unknown>) =>
    log("debug", msg, fields),
  info: (msg: string, fields?: Record<string, unknown>) =>
    log("info", msg, fields),
  warn: (msg: string, fields?: Record<string, unknown>) =>
    log("warn", msg, fields),
  error: (msg: string, fields?: Record<string, unknown>) =>
    log("error", msg, fields),
};
