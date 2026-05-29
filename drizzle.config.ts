import { defineConfig } from "drizzle-kit";

const url = process.env.DATABASE_URL?.replace(/^file:/, "") ?? "./data/educraft.db";

export default defineConfig({
  dialect: "sqlite",
  schema: "./app/server/schema.server.ts",
  out: "./drizzle",
  dbCredentials: { url },
});
