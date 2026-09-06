import type { IncomingMessage, ServerResponse } from "node:http";
import { env } from "@/config/env";

/**
 * Applies the CORS origin header to a hijacked raw response. `@fastify/cors`
 * sets its headers via `reply.header()`, which is discarded when a handler
 * calls `reply.hijack()` and writes headers itself — so any SSE/streaming
 * handler must set the allow-origin header on the raw `res` manually. Mirrors
 * the plugin's semantics: reflect the request Origin if it is allowed by
 * `CORS_ORIGIN` (comma-separated origins supported).
 */
export function applyCorsToRawResponse(
  req: IncomingMessage,
  res: ServerResponse,
): void {
  const origin = req.headers.origin;
  if (!origin) return;

  const allowed = env.CORS_ORIGIN.split(",")
    .map((o) => o.trim())
    .filter(Boolean);
  if (allowed.includes("*") || allowed.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
  }
}
