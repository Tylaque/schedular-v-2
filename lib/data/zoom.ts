// Zoom account pool data layer.
//
// "Availability" of a pool account is determined by the LOCAL database: an
// account is free iff no confirmed Zoom booking already exists on it whose
// window overlaps the proposed session. The local DB is the source of truth;
// the live Zoom API is a secondary confirmation during provisioning. Because
// every account claim runs inside a transaction that takes FOR UPDATE locks on
// all active ZoomAccount rows, two concurrent claims serialize and cannot both
// grab the same account.

import { db, isSerializationConflict } from "@/lib/db";
import { getOffsetMinutesForDate } from "@/lib/slotHelpers";
import { epochOverlap } from "@/lib/timeOverlap";
import type { ZoomAccount } from "@prisma/client";

/**
 * Converts a booking's dateKey+time (project-local, 24hr) into a UTC Date
 * using the project's IANA timezone and that date's actual UTC offset
 * (DST-aware).
 */
export function bookingToUtcDate(
  dateKey: string,
  time: string,
  timezone: string
): Date {
  const [year, month, day] = dateKey.split("-").map(Number);
  const [hour, minute] = time.split(":").map(Number);
  const offsetMin = getOffsetMinutesForDate(dateKey, timezone);
  const utcMs = Date.UTC(year, month - 1, day, hour, minute) - offsetMin * 60000;
  return new Date(utcMs);
}

export function bookingToUtcISO(dateKey: string, time: string, timezone: string): string {
  return bookingToUtcDate(dateKey, time, timezone).toISOString();
}

export interface ZoomAccountWithUsage extends ZoomAccount {
  bookingCount: number;
}

/**
 * Definitive claim: locks ALL active ZoomAccount rows FOR UPDATE inside a
 * serializable transaction, re-checks overlap against the (now fully visible)
 * confirmed booking set, and either attaches the winning account to the
 * booking or reports that the pool is full. Because every claim serializes on
 * the same rows, two concurrent claims cannot select the same account.
 *
 * Among free accounts the one with the fewest confirmed bookings wins (least
 * used first; label as tie-breaker).
 */
export async function claimZoomAccountForBooking(input: {
  bookingId: string;
  dateKey: string;
  time: string;
  timezone: string;
  durationMinutes: number;
}): Promise<
  { ok: true; account: ZoomAccount } | { ok: false; reason: "pool_full" | "error"; detail?: string }
> {
  // Concurrent claims serialize on the FOR UPDATE row locks; PostgreSQL aborts
  // one of them with a serialization failure (Prisma P2034) rather than deadlock.
  // Retrying re-reads the winner's committed claim so the loser resolves to a
  // clean pool_full instead of a spurious provisioning error.
  const attempt = async () =>
    db.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<
        ZoomAccount[]
      >`SELECT * FROM "ZoomAccount"
        WHERE "isActive" = true
        ORDER BY
          (SELECT COUNT(*) FROM "Booking" b WHERE b."zoomAccountId" = "ZoomAccount"."id" AND b.status = 'confirmed') ASC,
          "label" ASC
        FOR UPDATE`;

      if (rows.length === 0) return { ok: false as const, reason: "pool_full" as const };

      const accountIds = rows.map((r) => r.id);
      const booked = await tx.booking.findMany({
        where: { zoomAccountId: { in: accountIds }, status: "confirmed" },
        select: {
          zoomAccountId: true,
          dateKey: true,
          time: true,
          project: { select: { durationMinutes: true, timezone: true } },
        },
      });

      const startMs = bookingToUtcDate(input.dateKey, input.time, input.timezone).getTime();
      const endMs = startMs + input.durationMinutes * 60000;

      for (const row of rows) {
        const busy = booked.some((b) => {
          if (b.zoomAccountId !== row.id) return false;
          const bStart = bookingToUtcDate(b.dateKey, b.time, b.project.timezone).getTime();
          const bEnd = bStart + b.project.durationMinutes * 60000;
          return epochOverlap(startMs, endMs, bStart, bEnd);
        });
        if (!busy) {
          await tx.booking.update({
            where: { id: input.bookingId },
            data: { zoomAccountId: row.id },
          });
          return { ok: true as const, account: row };
        }
      }

      return { ok: false as const, reason: "pool_full" as const };
    }, {
      isolationLevel: "Serializable",
      maxWait: 5000,
      timeout: 10000,
    });

  for (let i = 0; i < 3; i++) {
    try {
      return await attempt();
    } catch (err: any) {
      if (!isSerializationConflict(err) || i === 2) {
        return { ok: false, reason: "error", detail: err?.message ?? String(err) };
      }
      await new Promise((r) => setTimeout(r, 25 * (i + 1)));
    }
  }
  return { ok: false, reason: "error", detail: "claim retries exhausted" };
}

export async function listZoomPoolAccounts(): Promise<ZoomAccountWithUsage[]> {
  const accounts = await db.zoomAccount.findMany({
    orderBy: { label: "asc" },
    include: {
      bookings: { where: { status: "confirmed" }, select: { id: true } },
    },
  });
  return accounts.map((a) => ({ ...a, bookingCount: a.bookings.length }));
}

export async function createZoomAccount(input: {
  label: string;
  zoomUserId: string;
  zoomEmail: string;
}): Promise<ZoomAccount> {
  return db.zoomAccount.create({ data: input });
}

export async function setZoomAccountActive(id: string, isActive: boolean): Promise<ZoomAccount> {
  return db.zoomAccount.update({ where: { id }, data: { isActive } });
}

export async function deleteZoomAccount(id: string): Promise<void> {
  await db.zoomAccount.delete({ where: { id } });
}

/**
 * Sync the pool from the live Zoom user directory (Server-to-Server app scope).
 * Upserts by zoomUserId; accounts present in the directory are reactivated,
 * accounts absent are left untouched (manual disable wins).
 */
export async function syncZoomAccountsFromDirectory(users: { id: string; email: string; displayName: string }[]): Promise<number> {
  let count = 0;
  for (const u of users) {
    await db.zoomAccount.upsert({
      where: { zoomUserId: u.id },
      update: { zoomEmail: u.email, label: u.displayName || u.email, isActive: true },
      create: { label: u.displayName || u.email, zoomUserId: u.id, zoomEmail: u.email },
    });
    count += 1;
  }
  return count;
}
