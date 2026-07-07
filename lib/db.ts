import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);

declare global {
  // eslint-disable-next-line no-var
  var prisma: PrismaClient | undefined;
}

export const db = global.prisma ?? new PrismaClient({ adapter });

if (process.env.NODE_ENV !== "production") {
  global.prisma = db;
}
