import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema.ts";

export const db = drizzle({
  client: new Pool(
    Deno.env.has("VALKYRIE_DATABASE_URL")
      ? { connectionString: Deno.env.get("VALKYRIE_DATABASE_URL") }
      : {
        host: Deno.env.get("VALKYRIE_DATABASE_HOST") ?? "localhost",
        user: Deno.env.get("VALKYRIE_DATABASE_USER") ?? "postgres",
        password: Deno.env.get("VALKYRIE_DATABASE_PASS") ?? "postgres",
        database: Deno.env.get("VALKYRIE_DATABASE_TABLE") ?? "valkyrie",
        port: parseInt(Deno.env.get("VALKYRIE_DATABASE_PORT") ?? "5432"),
      },
  ),
  casing: "snake_case",
  schema,
});
