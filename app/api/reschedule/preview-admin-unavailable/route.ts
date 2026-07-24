import { auth } from "@/auth";
import { previewAdminUnavailableAction } from "@/lib/actions";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { adminId, fromDate, toDate } = await req.json();
  const result = await previewAdminUnavailableAction(adminId, fromDate, toDate);
  return NextResponse.json(result);
}
