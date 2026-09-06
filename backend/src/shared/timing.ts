import { logger } from "@/shared/logger";

/**
 * Runs `fn` while measuring its duration and logs a `stage complete` /
 * `stage failed` line via the shared pino logger. `ctx` is merged into the
 * log payload so callers can attach counts, shas, models, etc.
 */
export async function timed<T>(
  stage: string,
  ctx: Record<string, unknown>,
  fn: () => Promise<T>,
): Promise<T> {
  const start = performance.now();
  try {
    const result = await fn();
    logger.info(
      { stage, durationMs: Math.round(performance.now() - start), ...ctx },
      "stage complete",
    );
    return result;
  } catch (error) {
    logger.error(
      {
        stage,
        durationMs: Math.round(performance.now() - start),
        ...ctx,
        err: (error as Error)?.message ?? String(error),
      },
      "stage failed",
    );
    throw error;
  }
}
