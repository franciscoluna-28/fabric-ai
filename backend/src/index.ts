import "dotenv/config.js";
import { buildApp } from "@/app";
import { env } from "@/config/env";
import { logger } from "@/shared/logger";

async function main() {
  const app = await buildApp();

  try {
    await app.listen({ port: env.PORT, host: env.HOST });
    logger.info(
      { host: env.HOST, port: env.PORT },
      `backend running at http://${env.HOST}:${env.PORT}`,
    );
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

main();
