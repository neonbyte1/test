import { Logger, LoggerService } from "@denorid/logger";
import { sodium_init } from "@neonbyte/libsodium";
import { ENV_API_TOKEN, ENV_APP_ID } from "./constants.ts";
import { loaderRepository } from "./db/loader.ts";
import { listen } from "./routes/_internal.ts";

await sodium_init();

const logger: LoggerService = new Logger("valkyrie", {
  levels: ["debug", "verbose", "log", "warn", "error", "fatal"],
});

// validate required environment variables first before doing anything in the application
{
  let validEnv = true;

  for (const envName of [ENV_APP_ID, ENV_API_TOKEN]) {
    if (!Deno.env.has(envName)) {
      logger.error(`Missing environment variable: ${envName}`);

      validEnv = false;
    }
  }

  if (!validEnv) {
    Deno.exit(1);
  }
}

await loaderRepository.seed();
await listen();
