import "dotenv/config";
import { defineConfig } from "prisma/config";

// NOTE (Neon migration): every prisma CLI command uses DATABASE_URL — including
// the deploy-time `prisma migrate deploy` in package.json's start script. If
// DATABASE_URL is Neon's POOLED endpoint (hostname contains `-pooler`), run
// schema migrations manually with the DIRECT (non-pooler) string instead, e.g.:
//   $env:DATABASE_URL="postgresql://user:pass@ep-xxx.aws.neon.tech/db" ; npx prisma migrate deploy
// Transaction-mode PgBouncer does not support all DDL, so do not rely on the
// automatic deploy step to apply future migrations.
const DATABASE_URL =
  process.env.DATABASE_URL ??
  "postgresql://placeholder:placeholder@localhost:5432/placeholder?schema=public";

export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    url: DATABASE_URL,
  },
  migrations: {
    path: "prisma/migrations",
    seed: "npx tsx prisma/seed.ts",
  },
});
