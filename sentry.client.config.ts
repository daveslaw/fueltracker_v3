import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  enabled: process.env.NODE_ENV === "production",
  tracesSampleRate: 0.2,
  sendDefaultPii: false,
  beforeSend(event) {
    // Drop noise from PWA offline scenarios
    const msg = event.exception?.values?.[0]?.value ?? "";
    if (
      msg.includes("Failed to fetch") ||
      msg.includes("Network request failed") ||
      msg.includes("NetworkError") ||
      msg.includes("Load failed")
    ) {
      return null;
    }
    return event;
  },
});
