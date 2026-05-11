"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

interface Props {
  userId: string;
  role: string;
  stationId: string | null;
}

export function SentryUserContext({ userId, role, stationId }: Props) {
  useEffect(() => {
    Sentry.setUser({ id: userId, role, stationId: stationId ?? undefined });
    return () => Sentry.setUser(null);
  }, [userId, role, stationId]);

  return null;
}
