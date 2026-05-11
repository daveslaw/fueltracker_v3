import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  enabled: process.env.NODE_ENV === "production",
  tracesSampleRate: 0.2,
  sendDefaultPii: false,
  beforeSend(event) {
    // Strip request body — may contain meter readings, POS revenue, stock counts
    if (event.request) {
      delete event.request.data;
    }
    return event;
  },
});
