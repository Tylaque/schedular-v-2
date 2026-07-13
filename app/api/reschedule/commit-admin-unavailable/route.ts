import { commitAdminUnavailableAction } from "@/lib/actions";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const { adminId, fromDate, toDate } = await req.json();
  const result = await commitAdminUnavailableAction(adminId, fromDate, toDate);
  return NextResponse.json(result);
}
