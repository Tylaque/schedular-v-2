import { auth } from "@/auth";
import { listProjects } from "@/lib/data/projects";
import { getOwnerGraphStatus } from "@/lib/graph/tokens";
import ProjectsClient from "@/components/ProjectsClient";

export const dynamic = "force-dynamic";

export default async function AdminProjectsPage() {
  const session = await auth();
  const role = (session?.user as any)?.role;
  const ownerId = role === "org_owner" ? undefined : session?.user?.id;
  const projects = await listProjects(ownerId);

  const uniqueOwnderIds = [...new Set(projects.map((p) => p.ownerId).filter(Boolean))] as string[];
  const statuses = await Promise.all(
    uniqueOwnderIds.map((oid) => getOwnerGraphStatus(oid).catch(() => null))
  );
  const ownerStatusMap = new Map<string, Awaited<ReturnType<typeof getOwnerGraphStatus>> | null>();
  uniqueOwnderIds.forEach((oid, i) => ownerStatusMap.set(oid, statuses[i]));

  return <ProjectsClient projects={projects} ownerStatusMap={ownerStatusMap} />;
}
