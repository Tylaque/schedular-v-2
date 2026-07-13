import { notFound } from "next/navigation";
import { getWaitlistEntry } from "@/lib/data/waitlist";
import ClaimOffer from "./ClaimOffer";

export const dynamic = "force-dynamic";

export default async function ClaimPage({
  params,
}: {
  params: { entryId: string };
}) {
  const entry = await getWaitlistEntry(params.entryId);
  if (!entry) return notFound();

  return <ClaimOffer entry={entry} />;
}
