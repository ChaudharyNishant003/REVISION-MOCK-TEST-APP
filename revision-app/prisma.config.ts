import { defineConfig, env } from "prisma/config";

// Prisma 7's config loader doesn't auto-load .env before evaluating this file.
try {
  process.loadEnvFile();
} catch {
  // .env is optional in environments where DATABASE_URL is already set.
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    url: env("DATABASE_URL"),
  },
});
