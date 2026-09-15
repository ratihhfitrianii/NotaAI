/** Error terstruktur dengan kode & status HTTP. */
export class AppError extends Error {
  readonly code: string;
  readonly statusCode: number;
  readonly details?: unknown;

  constructor(
    code: string,
    message: string,
    statusCode = 400,
    details?: unknown,
  ) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
  }
}

export function isAppError(e: unknown): e is AppError {
  return e instanceof AppError;
}

export const errorCodes = {
  VALIDATION_ERROR: "VALIDATION_ERROR",
  NOT_FOUND: "NOT_FOUND",
  CONFLICT: "CONFLICT",
  OCR_FAILED: "OCR_FAILED",
  LLM_FAILED: "LLM_FAILED",
  QUEUE_UNAVAILABLE: "QUEUE_UNAVAILABLE",
  STORAGE_UNAVAILABLE: "STORAGE_UNAVAILABLE",
  INTERNAL: "INTERNAL",
} as const;

/** Error ketika API provider mengembalikan 429 (quota habis / rate limit). */
export class RateLimitError extends Error {
  readonly provider: string;
  readonly retryAfter?: number;
  constructor(provider: string, message: string, retryAfter?: number) {
    super(message);
    this.name = "RateLimitError";
    this.provider = provider;
    this.retryAfter = retryAfter;
  }
}
