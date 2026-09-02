import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { ensureDemoBaseline } from "../lib/demo";

const urlOverride = process.argv[2];
if (urlOverride) {
  process.env.DATABASE_URL = urlOverride;
}
if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is required (pass it as argv[2] or set env).");
  process.exit(1);
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const db = new PrismaClient({ adapter });

async function main() {
  const result = await ensureDemoBaseline(db);
  console.log("Demo baseline ready:", JSON.stringify(result, null, 2));
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
    await pool.end();
  });
