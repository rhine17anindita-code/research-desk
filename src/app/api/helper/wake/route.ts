import { route } from "@/lib/http";
import { startScheduler, tickIfDue } from "@/lib/scheduler";

export const maxDuration = 180;

/**
 * Wake-up ping (public, returns nothing private): hosting can put an idle server to sleep, which
 * stops the feed schedule. An outside timer (GitHub Actions, the Mac helper) calls this every few
 * minutes; it pulls feeds only when they're due, so calling it more often changes nothing.
 */
export const GET = route(() => {
  startScheduler();
  // Don't hold the caller while feeds download; the work carries on in the background.
  void tickIfDue().catch(() => null);
  return { ok: true };
});
