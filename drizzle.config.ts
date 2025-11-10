import { defineConfig } from "drizzle-kit";

const dsn = Deno.env.get("VALKYRIE_DATABASE_URL");

export default defineConfig({
  out: "./drizzle",
  schema: "./src/db/schema.ts",
  dialect: "postgresql",
  dbCredentials: dsn ? { url: dsn } : {
    host: Deno.env.get("VALKYRIE_DATABASE_HOST") ?? "localhost",
    user: Deno.env.get("VALKYRIE_DATABASE_USER") ?? "postgres",
    password: Deno.env.get("VALKYRIE_DATABASE_PASS") ?? "postgres",
    database: Deno.env.get("VALKYRIE_DATABASE_TABLE") ?? "valkyrie",
    port: parseInt(Deno.env.get("VALKYRIE_DATABASE_PORT") ?? "5432"),
  },
  casing: "snake_case",
});
