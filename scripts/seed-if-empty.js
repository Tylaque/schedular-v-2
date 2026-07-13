const { execSync } = require("child_process");

async function main() {
  const { PrismaClient } = require("@prisma/client");
  const { PrismaPg } = require("@prisma/adapter-pg");
  const { Pool } = require("pg");

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const adapter = new PrismaPg(pool);
  const db = new PrismaClient({ adapter });

  try {
    const count = await db.admin.count();
    if (count > 0) {
      console.log(`[seed-if-empty] Database already has data (${count} admins found), skipping seed.`);
      await db.$disconnect();
      process.exit(0);
    }

    console.log("[seed-if-empty] Database is empty, running seed...");
    await db.$disconnect();
    execSync("npx prisma db seed", { stdio: "inherit" });
    console.log("[seed-if-empty] Seed completed successfully.");
    process.exit(0);
  } catch (err) {
    console.error("[seed-if-empty] Error:", err instanceof Error ? err.message : String(err));
    await db.$disconnect().catch(() => {});
    process.exit(1);
  }
}

main();
