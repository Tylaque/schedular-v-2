import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { listCertifications } from "@/lib/data/certifications";
import CertificationsClient from "@/components/CertificationsClient";

export const dynamic = "force-dynamic";

export default async function CertificationsPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/auth/signin");
  }

  const role = (session.user as any)?.role;
  if (role !== "org_owner") {
    redirect("/admin/projects");
  }

  const certifications = await listCertifications();

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-xl font-bold text-gray-900 mb-1 dark:text-gray-50">Certifications</h1>
      <p className="text-sm text-gray-500 mb-6 dark:text-gray-400">
        Manage the certification catalog used for associate skills and project requirements.
      </p>
      <CertificationsClient certifications={certifications} />
    </div>
  );
}
