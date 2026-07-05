import { notFound } from "next/navigation";
import { PROJECTS } from "@/lib/mockData";
import BookingFlow from "@/components/BookingFlow";

export default function BookPage({ params }: { params: { project: string } }) {
  const project = PROJECTS[params.project];
  if (!project) return notFound();
  return <BookingFlow project={project} />;
}

export function generateStaticParams() {
  return Object.keys(PROJECTS).map((slug) => ({ project: slug }));
}
