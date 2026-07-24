import { auth } from "@/auth";
import { commitDateShiftAction } from "@/lib/actions";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { projectId, fromDate, toDate, offsetDays } = await req.json();
  const result = await commitDateShiftAction(projectId, fromDate, toDate, offsetDays);
  return NextResponse.json(result);
}
