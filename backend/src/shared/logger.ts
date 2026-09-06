import { pino } from "pino";
import { env } from "@/config/env";

export const logger = pino({
  base: undefined,
  timestamp: pino.stdTimeFunctions.isoTime,
  level: env.LOG_LEVEL ?? "info",
});
