import type { Prisma } from "@prisma/client";

export type EmailTemplateWithDefault = Prisma.EmailTemplateGetPayload<{}> & {
  isGlobalDefault: boolean;
};

export type EmailCategoryTuple = {
  value: string;
  label: string;
  defaultAudience: string;
};

export const ALL_CATEGORIES: EmailCategoryTuple[] = [
  { value: "admin_invitation", label: "Admin Invitation", defaultAudience: "admin" },
  { value: "availability_request", label: "Availability Request", defaultAudience: "admin" },
  { value: "participant_invitation", label: "Participant Invitation", defaultAudience: "participant" },
  { value: "booking_confirmation", label: "Booking Confirmation", defaultAudience: "participant" },
  { value: "reminder_24h", label: "24h Reminder", defaultAudience: "participant" },
  { value: "reminder_1h", label: "1h Reminder", defaultAudience: "participant" },
  { value: "reschedule_notice", label: "Reschedule Notice", defaultAudience: "participant" },
  { value: "cancellation_notice", label: "Cancellation Notice", defaultAudience: "participant" },
  { value: "waitlist_offer", label: "Waitlist Offer", defaultAudience: "participant" },
];

export const PLACEHOLDER_TOKENS = [
  "participant_name",
  "admin_name",
  "admin_email",
  "project_name",
  "session_date",
  "session_time",
  "time_zone",
  "meeting_link",
  "booking_link",
  "manage_booking_link",
  "company_logo",
  "company_name",
];

export const MOCK_PREVIEW_CONTEXT: Record<string, string> = {
  participant_name: "Jane Doe",
  admin_name: "Priya Nair",
  project_name: "Senior PM — Round 1 Interview",
  session_date: "Monday, July 20, 2026",
  session_time: "10:30 AM",
  time_zone: "Africa/Nairobi (GMT+3)",
  meeting_link: "https://teams.microsoft.com/meeting/example",
  booking_link: "http://localhost:3000/book/senior-pm-interview",
  manage_booking_link: "http://localhost:3000/manage/cmrbookingid123",
  company_logo: "",
  company_name: "Northwind Labs",
};

export function renderTemplate(
  template: { subject: string; bodyHtml: string },
  context: Record<string, string>
): { subject: string; bodyHtml: string } {
  let subject = template.subject;
  let bodyHtml = template.bodyHtml;
  for (const key of Object.keys(context)) {
    const re = new RegExp(`\\{\\{${key}\\}\\}`, "g");
    subject = subject.replace(re, context[key]);
    bodyHtml = bodyHtml.replace(re, context[key]);
  }
  return { subject, bodyHtml };
}
