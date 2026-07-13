import { listProjects } from "@/lib/data/projects";
import { NextResponse } from "next/server";

export async function GET() {
  const projects = await listProjects();
  return NextResponse.json(projects);
}
