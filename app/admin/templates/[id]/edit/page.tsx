import { db } from "@/lib/db";
import { getTemplateHistory } from "@/lib/data/templates";
import { notFound } from "next/navigation";
import TemplateEditForm from "@/components/TemplateEditForm";

export const dynamic = "force-dynamic";

export default async function EditTemplatePage({ params }: { params: { id: string } }) {
  const template = await db.emailTemplate.findUnique({ where: { id: params.id } });
  if (!template) notFound();

  const history = await getTemplateHistory(template.category, template.projectId ?? undefined);
  const notificationLogs = await db.notificationLog.findMany({
    where: { templateId: template.id },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  return (
    <TemplateEditForm template={template} history={history} notificationLogs={notificationLogs} />
  );
}
