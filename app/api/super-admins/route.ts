import { listSuperAdmins } from "@/lib/data/admins";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const admins = await listSuperAdmins();
  return NextResponse.json(admins);
}
