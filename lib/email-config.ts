const DEVELOPMENT_FROM = "Scheduler [development/test only] <notifications@example.invalid>";
const DEFAULT_DEMO_ALIAS_DOMAIN = "eureka-ent.org";

/** Returns the configured sender. Production must configure a verified sender. */
export function getEmailFrom(): string {
  const configured = process.env.EMAIL_FROM?.trim();
  if (configured) return configured;

  if (process.env.NODE_ENV === "development" || process.env.NODE_ENV === "test") {
    return DEVELOPMENT_FROM;
  }

  const message = process.env.NODE_ENV === "production"
    ? "EMAIL_FROM is required in production; email sending is disabled until a verified sender is configured."
    : "EMAIL_FROM is required unless NODE_ENV is development or test; email sending is disabled until a sender is configured.";
  console.error(`[email-config] ${message}`);
  throw new Error(message);
}

/** Defaults replies to the sender to preserve prior behavior unless configured. */
export function getEmailReplyTo(): string {
  return process.env.EMAIL_REPLY_TO?.trim() || getEmailFrom();
}

/** Demo aliases stay on their existing domain unless explicitly overridden. */
export function getDemoAliasDomain(): string {
  return process.env.DEMO_ADMIN_DOMAIN?.trim() || DEFAULT_DEMO_ALIAS_DOMAIN;
}
