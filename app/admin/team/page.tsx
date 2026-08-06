import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { listTeamMembers } from "@/lib/data/team";
import { listCertifications, getCertificationAssignments } from "@/lib/data/certifications";
import TeamClient from "@/components/TeamClient";
import { dtScreenVars, pageTitleStyle, pageSubtitleStyle } from "@/lib/design-tokens";

export const dynamic = "force-dynamic";

export default async function TeamPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/auth/signin");
  }

  const role = (session.user as any)?.role;
  if (role !== "org_owner" && role !== "super_admin") {
    redirect("/admin/projects");
  }

  const members = await listTeamMembers();
  const certifications = await listCertifications();
  const assignments = await getCertificationAssignments();

  const certificationsByAdmin: Record<string, string[]> = {};
  for (const a of assignments) {
    (certificationsByAdmin[a.adminId] ??= []).push(a.certificationId);
  }

  return (
    <div className="max-w-5xl mx-auto p-6" style={dtScreenVars()}>
      <div style={{ marginBottom: 20 }}>
        <h1 className="dt-text-primary" style={pageTitleStyle}>Team Management</h1>
        <p className="dt-text-secondary" style={{ ...pageSubtitleStyle, marginTop: 6 }}>
          Manage associates, roles, certifications, and ownership.
        </p>
      </div>
      <TeamClient
        members={members}
        currentUserId={session.user.id}
        currentUserRole={role}
        certifications={certifications}
        certificationsByAdmin={certificationsByAdmin}
      />
    </div>
  );
}
