import { Suspense } from "react";
import { auth } from "@/auth";
import { listProjects } from "@/lib/data/projects";
import { getOwnerGraphStatus } from "@/lib/graph/tokens";
import { zoomPoolConfigured } from "@/lib/zoom/client";
import ProjectsClient from "@/components/ProjectsClient";
import ProjectCardsSkeleton from "@/components/ProjectCardsSkeleton";

export const dynamic = "force-dynamic";

async function ProjectsList() {
  const session = await auth();
  const role = (session?.user as any)?.role;
  const ownerId = role === "org_owner" ? undefined : session?.user?.id;
  const projects = await listProjects(ownerId);

  const uniqueOwnerIds = [...new Set(projects.map((p) => p.ownerId).filter(Boolean))] as string[];
  const statuses = await Promise.all(
    uniqueOwnerIds.map((oid) => getOwnerGraphStatus(oid).catch(() => null))
  );
  const ownerStatusMap = new Map<string, Awaited<ReturnType<typeof getOwnerGraphStatus>> | null>();
  uniqueOwnerIds.forEach((oid, i) => ownerStatusMap.set(oid, statuses[i]));

  return (
    <ProjectsClient
      projects={projects}
      ownerStatusMap={ownerStatusMap}
      zoomPoolConfigured={zoomPoolConfigured()}
    />
  );
}

export default function AdminProjectsPage() {
  return (
    <Suspense fallback={<ProjectCardsSkeleton />}>
      <ProjectsList />
    </Suspense>
  );
}
