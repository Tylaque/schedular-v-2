import { NextResponse } from "next/server";
import { listAllAdmins } from "@/lib/data/admins";

export const dynamic = "force-dynamic";

export async function GET() {
  const admins = await listAllAdmins();
  return NextResponse.json(admins);
}
