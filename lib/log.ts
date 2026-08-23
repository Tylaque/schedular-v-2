type LogLevel = "info" | "warn" | "error";

type LogContext = Record<string, unknown>;

export function log(level: LogLevel, category: string, message: string, context?: LogContext) {
  const entry: Record<string, unknown> = {
    timestamp: new Date().toISOString(),
    level,
    category,
    message,
    ...context,
  };
  const line = JSON.stringify(entry);
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}
