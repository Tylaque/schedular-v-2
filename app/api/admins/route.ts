import { listAllAdmins } from "@/lib/data/admins";
import { NextResponse } from "next/server";

export async function GET() {
  const admins = await listAllAdmins();
  return NextResponse.json(admins);
}
