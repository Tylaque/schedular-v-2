const STATUS_CONFIG = {
  connected: { label: "Connected", className: "bg-emerald-100 text-emerald-700" },
  no_account: { label: "No account", className: "bg-gray-100 text-gray-500" },
  no_refresh_token: { label: "Reconnect", className: "bg-amber-100 text-amber-700" },
  token_error: { label: "Error", className: "bg-red-100 text-red-700" },
} as const;

type GraphStatus = keyof typeof STATUS_CONFIG;

export function GraphStatusBadge({ status }: { status: GraphStatus | null }) {
  if (!status) return null;
  const cfg = STATUS_CONFIG[status];
  return (
    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${cfg.className}`}>
      Teams: {cfg.label}
    </span>
  );
}
