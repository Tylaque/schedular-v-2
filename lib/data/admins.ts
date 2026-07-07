import { db } from "@/lib/db";

export type AdminRecord = {
  id: string;
  name: string;
  initials: string;
  email: string;
};

export async function listAllAdmins(): Promise<AdminRecord[]> {
  const rows = await db.admin.findMany({ orderBy: { name: "asc" } });
  return rows.map((a) => ({ id: a.id, name: a.name, initials: a.initials, email: a.email }));
}
