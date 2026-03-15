import { defineConfig } from "prisma/config";
import { loadEnvFiles } from "./src/core/config/load-env";

if (process.env.NODE_ENV) {
  loadEnvFiles({ nodeEnv: process.env.NODE_ENV });
} else {
  loadEnvFiles();
}

const DATABASE_URL = process.env.DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5432/hono_starter";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: DATABASE_URL,
  },
});
