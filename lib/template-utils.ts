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
  { value: "reminder", label: "Reminder", defaultAudience: "participant" },
  { value: "reschedule_notice", label: "Reschedule Notice", defaultAudience: "participant" },
  { value: "cancellation_notice", label: "Cancellation Notice", defaultAudience: "participant" },
  { value: "waitlist_offer", label: "Waitlist Offer", defaultAudience: "participant" },
  { value: "zoom_fallback_to_teams", label: "Zoom → Teams Fallback (Owner)", defaultAudience: "super_admin" },
  { value: "zoom_pool_full_no_fallback", label: "Zoom Unavailable, No Fallback (Owner)", defaultAudience: "super_admin" },
];

export const PLACEHOLDER_TOKENS = [
  "participant_name",
  "admin_name",
  "admin_email",
  "project_name",
  "availability_period",
  "session_date",
  "session_time",
  "time_zone",
  "meeting_link",
  "booking_link",
  "manage_booking_link",
  "company_logo",
  "company_name",
  "reminder_label",
  "is_feedback",
];

export const MOCK_PREVIEW_CONTEXT: Record<string, string> = {
  participant_name: "Jane Doe",
  admin_name: "Priya Nair",
  project_name: "Senior PM — Round 1 Interview",
  availability_period: "30",
  session_date: "Monday, July 20, 2026",
  session_time: "10:30 AM",
  time_zone: "Africa/Nairobi (GMT+3)",
  meeting_link: "https://teams.microsoft.com/meeting/example",
  booking_link: "http://localhost:3000/book/senior-pm-interview",
  manage_booking_link: "http://localhost:3000/manage/cmrbookingid123",
  company_logo: "",
  company_name: "Career Connections",
  reminder_label: "24 Hour Reminder",
  is_feedback: "",
};

/**
 * Process {{#unless KEY}}...{{/unless KEY}} conditional blocks.
 * If context[KEY] is any truthy string, the block content is removed entirely.
 * If the key is absent or falsy, only the tags are removed — content is kept.
 * Blocks can be nested (innermost matched first via non-greedy regex + loop).
 */
function processUnlessBlocks(
  text: string,
  context: Record<string, string>
): string {
  const re = /\{\{#unless\s+(\w+)\}\}([\s\S]*?)\{\{\/unless\s+\1\}\}/g;
  let prev = "";
  while (prev !== text) {
    prev = text;
    text = text.replace(re, (_match, key: string, content: string) => {
      return context[key] ? "" : content;
    });
  }
  return text;
}

export function renderTemplate(
  template: { subject: string; bodyHtml: string },
  context: Record<string, string>
): { subject: string; bodyHtml: string } {
  let subject = template.subject;
  let bodyHtml = template.bodyHtml;

  subject = processUnlessBlocks(subject, context);
  bodyHtml = processUnlessBlocks(bodyHtml, context);

  for (const key of Object.keys(context)) {
    const re = new RegExp(`\\{\\{${key}\\}\\}`, "g");
    subject = subject.replace(re, context[key]);
    bodyHtml = bodyHtml.replace(re, context[key]);
  }
  return { subject, bodyHtml };
}
