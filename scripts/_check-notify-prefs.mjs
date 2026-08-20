// READ-ONLY. Prints notifyOnBooking for Laque and Carl on safe-test.
// Usage: $env:DATABASE_URL="<prod>"; node scripts/_check-notify-prefs.mjs
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

if (!process.env.DATABASE_URL) { console.error("DATABASE_URL not set"); process.exit(2); }

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = new PrismaClient({ adapter: new PrismaPg(pool) });

try {
  const admins = await db.admin.findMany({
    where: { email: { in: ["calebmwebi@gmail.com", "caleb@careerconnectionsltd.com"] } },
    select: { name: true, email: true, notifyOnBooking: true },
  });
  for (const a of admins) {
    console.log(`${a.name} (${a.email}): notifyOnBooking=${a.notifyOnBooking}`);
  }
} catch (err) {
  console.error("ERROR:", err.message);
  process.exit(1);
} finally {
  await db.$disconnect();
}
