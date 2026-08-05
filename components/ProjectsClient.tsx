"use client";

import { useState, useMemo } from "react";
import type { CSSProperties, ReactNode } from "react";
import Link from "next/link";
import { Search, User, Users, CalendarClock } from "lucide-react";
import type { ProjectWithAdmins } from "@/lib/data/projects";
import {
  designTokens,
  dtScreenVars,
  pageTitleStyle,
  pageSubtitleStyle,
  cardTitleStyle,
  bodyTextStyle,
  metaTextStyle,
  primaryButton,
  primaryButtonHover,
  statusChip,
  statusDot,
  avatarTile,
  editLink,
  editLinkHover,
} from "@/lib/design-tokens";
import { PlatformChip } from "@/components/shared/PlatformChip";
import type { PlatformKey } from "@/components/shared/PlatformChip";

type OwnerStatus = { connected: boolean; reason?: string | null } | null;

const STATUS_LABEL: Record<string, string> = {
  draft: "Draft",
  active: "Active",
  paused: "Paused",
  closed: "Closed",
  archived: "Archived",
};

function StatusBadge({ status }: { status: string }) {
  return (
    <span style={statusChip(status)}>
      <span style={statusDot(status)} />
      {STATUS_LABEL[status] ?? status}
    </span>
  );
}

function MetaRow({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <span
      className="dt-text-secondary"
      style={{ display: "inline-flex", alignItems: "center", gap: 6, ...metaTextStyle, color: undefined }}
    >
      {icon}
      {children}
    </span>
  );
}

function EditLink({ href }: { href: string }) {
  const [active, setActive] = useState(false);
  return (
    <Link
      href={href}
      onMouseEnter={() => setActive(true)}
      onMouseLeave={() => setActive(false)}
      onFocus={() => setActive(true)}
      onBlur={() => setActive(false)}
      style={active ? editLinkHover : { ...editLink, color: "var(--dt-link)" }}
      className="shrink-0"
    >
      Edit
    </Link>
  );
}

function NewProjectButton() {
  const [hover, setHover] = useState(false);
  return (
    <Link
      href="/admin/projects/new"
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={hover ? { ...primaryButton, ...primaryButtonHover } : primaryButton}
      className="shrink-0"
    >
      New project
    </Link>
  );
}

function platformStates(
  p: ProjectWithAdmins,
  ownerStatus: OwnerStatus,
  zoomPoolConfigured: boolean,
): { label: string; connected: boolean; platform: PlatformKey }[] {
  const teamsConnected = ownerStatus?.connected === true;
  const zoomConnected = zoomPoolConfigured;
  if (p.meetingPlatformPreference === "teams") {
    return [{ label: "Teams", connected: teamsConnected, platform: "teams" }];
  }
  if (p.meetingPlatformPreference === "zoom") {
    return [{ label: "Zoom", connected: zoomConnected, platform: "zoom" }];
  }
  return [
    { label: "Zoom", connected: zoomConnected, platform: "zoom" },
    { label: "Teams", connected: teamsConnected, platform: "teams" },
  ];
}

function ProjectCard({
  project,
  ownerStatus,
  zoomPoolConfigured,
}: {
  project: ProjectWithAdmins;
  ownerStatus: OwnerStatus;
  zoomPoolConfigured: boolean;
}) {
  const chips = platformStates(project, ownerStatus, zoomPoolConfigured);
  const lockDate = project.availabilityLockDate.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  return (
    <article className="project-card flex items-start gap-4">
      <div
        style={{ ...avatarTile, backgroundColor: project.branding.primaryColor }}
        aria-hidden="true"
      >
        {project.branding.logoInitial}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <h3 className="truncate dt-text-primary" style={{ ...cardTitleStyle, color: undefined }}>
            {project.name}
          </h3>
          <StatusBadge status={project.status} />
        </div>
        <p className="mt-0.5 truncate dt-text-secondary" style={{ ...bodyTextStyle, color: undefined }}>
          {project.company}
        </p>

        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: `${designTokens.spacing.section}px ${designTokens.spacing.section + 4}px`,
            marginTop: designTokens.spacing.cardGap,
          }}
        >
          <MetaRow icon={<User style={{ width: 14, height: 14 }} />}>
            {project.ownerName ?? "—"}
          </MetaRow>
          <MetaRow icon={<Users style={{ width: 14, height: 14 }} />}>
            {project.admins.length} admin{project.admins.length === 1 ? "" : "s"}
          </MetaRow>
          <MetaRow icon={<CalendarClock style={{ width: 14, height: 14 }} />}>
            {lockDate}
          </MetaRow>
        </div>

        {chips.length > 0 && (
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: designTokens.spacing.chipGap,
              marginTop: designTokens.spacing.section,
            }}
          >
            {chips.map((c) => (
              <PlatformChip key={c.platform} {...c} />
            ))}
          </div>
        )}
      </div>

      <EditLink href={`/admin/projects/${project.slug}/edit`} />
    </article>
  );
}

export default function ProjectsClient({
  projects,
  ownerStatusMap,
  zoomPoolConfigured,
}: {
  projects: ProjectWithAdmins[];
  ownerStatusMap: Map<string, OwnerStatus>;
  zoomPoolConfigured: boolean;
}) {
  const [search, setSearch] = useState("");

  const filtered = useMemo(
    () => projects.filter((p) => p.name.toLowerCase().includes(search.toLowerCase())),
    [projects, search],
  );

  return (
    <div className="max-w-5xl mx-auto p-6" style={dtScreenVars()}>
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="flex items-center gap-2 dt-text-primary" style={{ ...pageTitleStyle, color: undefined }}>
            Projects
            {projects.length > 0 && (
              <span
                className="dt-pill"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  minWidth: 24,
                  height: 24,
                  padding: "0 8px",
                  borderRadius: 999,
                  fontSize: designTokens.type.caption.size,
                  fontWeight: designTokens.type.caption.weight,
                }}
              >
                {projects.length}
              </span>
            )}
          </h1>
          <p className="mt-1 dt-text-secondary" style={{ ...pageSubtitleStyle, color: undefined }}>
            Manage your scheduling projects.
          </p>
        </div>
        <NewProjectButton />
      </div>

      {projects.length === 0 && (
        <div className="text-center py-16">
          <p className="mb-4 dt-text-secondary" style={{ ...bodyTextStyle, color: undefined }}>
            No projects yet.
          </p>
          <NewProjectButton />
        </div>
      )}

      {projects.length > 0 && (
        <div>
          {projects.length > 5 && (
            <div style={{ position: "relative", marginBottom: designTokens.spacing.section }}>
              <Search
                className="dt-text-muted"
                style={{
                  position: "absolute",
                  left: 10,
                  top: "50%",
                  transform: "translateY(-50%)",
                  width: 16,
                  height: 16,
                }}
              />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search projects by name..."
                className="dt-search dt-text-primary"
                style={{
                  width: "100%",
                  padding: "9px 12px 9px 34px",
                  fontSize: designTokens.type.body.size,
                  borderRadius: designTokens.radius.control,
                }}
              />
            </div>
          )}

          {filtered.length === 0 && search && (
            <div className="text-center py-8">
              <p className="dt-text-muted" style={{ ...metaTextStyle, color: undefined }}>
                No projects match &quot;{search}&quot;.
              </p>
            </div>
          )}

          {filtered.length > 0 && (
            <div style={{ display: "grid", gap: designTokens.spacing.cardGap }}>
              {filtered.map((p) => (
                <ProjectCard
                  key={p.slug}
                  project={p}
                  ownerStatus={p.ownerId ? ownerStatusMap.get(p.ownerId) ?? null : null}
                  zoomPoolConfigured={zoomPoolConfigured}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
