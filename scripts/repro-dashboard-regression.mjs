// Regression checks after the My Dashboard / Projects gap fix:
//   1. super_admin self-view includes owned-but-unassigned projects (FIXED path)
//   2. super_admin cross-view of an assigned admin stays ownerId-scoped
//   3. super_admin cross-view of a non-assigned admin still 403s
//   4. my-area (getAdminDashboardData(adminId) single-arg) unchanged: assigned only
//   5. org_owner self-view includes owned projects (same self-dashboard rule)
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
const SELF = "diag-dash";
const OTHER = "diag-other";
const OTHER_UNSCOPED = "diag-other2";
const OWNER = "diag-owner";
const COOKIE_NAME = "authjs.session-token";
const env = readFileSync(".env", "utf8");
const secret = env.match(/^AUTH_SECRET=(.+)$/m)[1].replace(/^["']|["']$/g, "");

const results = [];
const check = (name, ok, detail) => {
  results.push({ name, ok, detail });
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  (${detail})` : ""}`);
};

async function mkAdmin(id, email, role) {
  return db.admin.upsert({
    where: { id },
    update: { role, isActive: true },
    create: { id, name: id, initials: "XX", email, passwordHash: "x", role, accountType: "organizational" },
  });
}

async function forgeToken(sub, role) {
  const info = `Auth.js Generated Encryption Key (${COOKIE_NAME})`;
  const encKey = new Uint8Array(
    hkdfSync("sha256", new TextEncoder().encode(secret), new TextEncoder().encode(COOKIE_NAME), new TextEncoder().encode(info), 64)
  );
  const thumbprint = await calculateJwkThumbprint({ kty: "oct", k: base64url.encode(encKey) }, "sha512");
  const token = await new EncryptJWT({ sub, role, accountType: "organizational", name: sub, email: `${sub}@phase.test` })
    .setProtectedHeader({ alg: "dir", enc: "A256CBC-HS512", kid: thumbprint })
    .setIssuedAt().setExpirationTime(Math.floor(Date.now() / 1000) + 3600).setJti(randomUUID()).encrypt(encKey);
  return `${COOKIE_NAME}=${token}`;
}

async function mkProject(name, slug, ownerId, adminIds) {
  return db.project.create({
    data: {
      slug, name, company: "Diag", description: "repro", durationMinutes: 30,
      availabilityPeriodDays: 30, dailyStart: "09:00", dailyEnd: "17:00",
      includeWeekends: false, minNoticeHours: 24, timezone: "UTC",
      bookingDeadlineDays: 2, bufferMinutes: 5, maxSessionsPerAdminPerDay: 4,
      sessionCapacity: 1, availabilityLockDate: new Date(Date.now() + 86400000 * 14),
      brandingLogoInitial: "D", brandingPrimaryColor: "#2563eb", brandingSenderName: "Diag",
      ownerId,
      admins: adminIds.length ? { create: adminIds.map((adminId) => ({ adminId })) } : undefined,
    },
    select: { id: true, slug: true, name: true },
  });
}

// ---- fixture
await mkAdmin(SELF, "diag-dash@phase.test", "super_admin");
await mkAdmin(OTHER, "diag-other@phase.test", "admin");
await mkAdmin(OTHER_UNSCOPED, "diag-other2@phase.test", "admin");
await mkAdmin(OWNER, "diag-owner@phase.test", "org_owner");
await db.projectAdmin.deleteMany({ where: { adminId: { in: [SELF, OTHER, OTHER_UNSCOPED] } } });
await db.project.deleteMany({ where: { ownerId: { in: [SELF, OWNER] } } });

const P1 = await mkProject("Reg-Owned-Only", "reg-own-only", SELF, []);            // super_admin owns, unassigned
const P3 = await mkProject("Reg-Scoped", "reg-scoped", SELF, [OTHER]);             // super_admin owns, OTHER assigned
const P4 = await mkProject("Reg-Org-Owned", "reg-org-owned", OWNER, []);           // org_owner owns, unassigned
console.log("fixture: P1/P3 owned by super_admin; P4 owned by org_owner");

const dashCookie = await forgeToken(SELF, "super_admin");
const ownerCookie = await forgeToken(OWNER, "org_owner");

// 1. super_admin self-view: owned + assigned both present
{
  const r = await fetch(`${BASE}/api/dashboard/admin?adminId=${SELF}`, { headers: { cookie: dashCookie } });
  const b = await r.json().catch(() => null);
  const names = (b?.assignedProjects ?? []).map((p) => p.name);
  check("super_admin self-view 200", r.status === 200, `status=${r.status}`);
  check("self includes owned-not-assigned", names.includes("Reg-Owned-Only"), JSON.stringify(names));
  check("self includes assigned", names.includes("Reg-Scoped"), JSON.stringify(names));
}

// 2. super_admin cross-view of assigned admin: 200 + ownerId-scoped (P3 only)
{
  const r = await fetch(`${BASE}/api/dashboard/admin?adminId=${OTHER}`, { headers: { cookie: dashCookie } });
  const b = await r.json().catch(() => null);
  const names = (b?.assignedProjects ?? []).map((p) => p.name);
  check("super_admin cross-view assigned 200", r.status === 200, `status=${r.status}`);
  check("cross-view scoped (P3 only)", names.length === 1 && names[0] === "Reg-Scoped", JSON.stringify(names));
}

// 3. super_admin cross-view of non-assigned admin: 403
{
  const r = await fetch(`${BASE}/api/dashboard/admin?adminId=${OTHER_UNSCOPED}`, { headers: { cookie: dashCookie } });
  check("super_admin cross-view unscoped 403", r.status === 403, `status=${r.status}`);
}

// 4. my-area (single-arg call): unchanged, assigned-only
{
  const r = await fetch(`${BASE}/admin/my-area`, { headers: { cookie: dashCookie, accept: "text/html" } });
  const html = await r.text();
  check("my-area 200", r.status === 200, `status=${r.status}`);
  check("my-area shows assigned only (no owned-only P1)", html.includes("No projects assigned."), "expected 'No projects assigned.'");
  check("my-area does NOT list Reg-Owned-Only", !html.includes("Reg-Owned-Only"), "");
}

// 5. org_owner self-view: includes owned projects (self-dashboard rule)
{
  const r = await fetch(`${BASE}/api/dashboard/admin?adminId=${OWNER}`, { headers: { cookie: ownerCookie } });
  const b = await r.json().catch(() => null);
  const names = (b?.assignedProjects ?? []).map((p) => p.name);
  check("org_owner self-view 200", r.status === 200, `status=${r.status}`);
  check("org_owner self includes owned", names.includes("Reg-Org-Owned"), JSON.stringify(names));
}

// ---- cleanup
await db.project.deleteMany({ where: { ownerId: { in: [SELF, OWNER] } } });
await db.projectAdmin.deleteMany({ where: { adminId: { in: [SELF, OTHER, OTHER_UNSCOPED] } } });
await db.admin.deleteMany({ where: { id: { in: [SELF, OTHER, OTHER_UNSCOPED, OWNER] } } });

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed.`);
if (failed.length) {
  console.log(`FAILED: ${failed.map((f) => f.name).join(", ")}`);
  process.exitCode = 1;
}
await db.$disconnect();
await pool.end();
