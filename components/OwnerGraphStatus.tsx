"use client";

import { useEffect, useState } from "react";
import { GraphStatusBadge } from "./GraphStatusBadge";

export function OwnerGraphStatus({ ownerId }: { ownerId: string | null }) {
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    if (!ownerId) { setStatus(null); return; }
    fetch(`/api/graph-status?adminId=${ownerId}`)
      .then((r) => r.json())
      .then((d) => setStatus(d.status ?? null))
      .catch(() => setStatus("token_error"));
  }, [ownerId]);

  return <GraphStatusBadge status={status as any} />;
}
