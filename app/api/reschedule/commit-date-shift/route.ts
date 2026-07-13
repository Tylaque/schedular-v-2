import { commitDateShiftAction } from "@/lib/actions";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const { projectId, fromDate, toDate, offsetDays } = await req.json();
  const result = await commitDateShiftAction(projectId, fromDate, toDate, offsetDays);
  return NextResponse.json(result);
}
