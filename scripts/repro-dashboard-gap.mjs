// Root-cause repro for: project shows on /admin/projects but not My Dashboard.
// Sets up a throwaway super_admin with:
//   P1 "Owned-Not-Assigned": ownerId = them, NO ProjectAdmin row (Shape A)
//   P2 "Owned-And-Assigned": ownerId = them, ProjectAdmin row present (Shape B)
// Probes /api/dashboard/admin and /admin/projects with a forged super_admin session.
import dotenv from "dotenv";
dotenv.config();
import { readFileSync } from "node:fs";
import { randomUUID, hkdfSync } from "node:crypto";
import { EncryptJWT, base64url, calculateJwkThumbprint } from "jose";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = new PrismaClient({ adapter: new PrismaPg(pool) });
const BASE = "http://localhost:3000";
const ID = "diag-dash";
const EMAIL = "diag-dash@phase.test";
const COOKIE_NAME = "authjs.session-token";
const env = readFileSync(".env", "utf8");
const secret = env.match(/^AUTH_SECRET=(.+)$/m)[1].replace(/^["']|["']$/g, "");

// ---- fixture
await db.admin.upsert({
  where: { id: ID },
  update: { role: "super_admin", isActive: true },
  create: { id: ID, name: "Diag Dash", initials: "DD", email: EMAIL, passwordHash: "x", role: "super_admin", accountType: "organizational" },
});
await db.projectAdmin.deleteMany({ where: { adminId: ID } });
await db.project.deleteMany({ where: { ownerId: ID } });

const mk = (name, slug, adminIds) =>
  db.project.create({
    data: {
      slug,
      name,
      company: "Diag",
      description: "repro",
      durationMinutes: 30,
      availabilityPeriodDays: 30,
      dailyStart: "09:00",
      dailyEnd: "17:00",
      includeWeekends: false,
      minNoticeHours: 24,
      timezone: "UTC",
      bookingDeadlineDays: 2,
      bufferMinutes: 5,
      maxSessionsPerAdminPerDay: 4,
      sessionCapacity: 1,
      availabilityLockDate: new Date(Date.now() + 86400000 * 14),
      brandingLogoInitial: "D",
      brandingPrimaryColor: "#2563eb",
      brandingSenderName: "Diag",
      ownerId: ID,
      admins: adminIds.length ? { create: adminIds.map((adminId) => ({ adminId })) } : undefined,
    },
    select: { id: true, slug: true, name: true },
  });

const P1 = await mk("Owned-Not-Assigned", "diag-own-only", []);
const P2 = await mk("Owned-And-Assigned", "diag-own-assigned", [ID]);
console.log("fixture:");
console.log("  P1", JSON.stringify(P1), "adminIds=[]  (owned, NOT assigned)");
console.log("  P2", JSON.stringify(P2), "adminIds=[diag-dash]  (owned AND assigned)");

// ---- forge super_admin session
const info = `Auth.js Generated Encryption Key (${COOKIE_NAME})`;
const encKey = new Uint8Array(
  hkdfSync("sha256", new TextEncoder().encode(secret), new TextEncoder().encode(COOKIE_NAME), new TextEncoder().encode(info), 64)
);
const thumbprint = await calculateJwkThumbprint({ kty: "oct", k: base64url.encode(encKey) }, "sha512");
const token = await new EncryptJWT({ sub: ID, role: "super_admin", accountType: "organizational", name: "Diag Dash", email: EMAIL })
  .setProtectedHeader({ alg: "dir", enc: "A256CBC-HS512", kid: thumbprint })
  .setIssuedAt().setExpirationTime(Math.floor(Date.now() / 1000) + 3600).setJti(randomUUID()).encrypt(encKey);
const cookie = `${COOKIE_NAME}=${token}`;

// ---- probe: My Dashboard API
const dash = await fetch(`${BASE}/api/dashboard/admin?adminId=${ID}`, { headers: { cookie } });
const dashBody = await dash.json().catch(() => null);
console.log("\nMy Dashboard API (/api/dashboard/admin):");
console.log("  status:", dash.status, dash.status === 200 ? "" : "(403 = super_admin scope gate fired)");
if (dash.status === 200) {
  console.log("  assignedProjects:", JSON.stringify(dashBody?.assignedProjects?.map((p) => p.name) ?? null));
} else {
  console.log("  body:", JSON.stringify(dashBody));
}

// ---- probe: Projects page (server-rendered)
const proj = await fetch(`${BASE}/admin/projects`, { headers: { cookie, accept: "text/html" }, redirect: "manual" });
const projHtml = proj.status === 200 ? await proj.text() : null;
console.log("\nProjects page (/admin/projects):");
console.log("  status:", proj.status);
if (projHtml) {
  console.log("  P1 shown:", projHtml.includes("Owned-Not-Assigned"), "| P2 shown:", projHtml.includes("Owned-And-Assigned"));
}

// ---- cleanup
await db.project.deleteMany({ where: { ownerId: ID } });
await db.projectAdmin.deleteMany({ where: { adminId: ID } });
await db.admin.delete({ where: { id: ID } });
console.log("\ncleanup done.");
await db.$disconnect();
await pool.end();
