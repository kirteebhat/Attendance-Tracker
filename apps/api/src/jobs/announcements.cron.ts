import cron, { ScheduledTask } from "node-cron";
import { announcementService } from "../services/announcement.service";
import { policyService } from "../services/policy.service";
import { logger } from "../utils/logger";
import { featureFlagService } from "../services/featureFlag.service";

let announcementTask: ScheduledTask | null = null;

/**
 * Initializes and starts the automated announcements generation cron job.
 * Evaluates upcoming holidays, daily meetings, closures, and reminders.
 */
export async function startAnnouncementsCronJob(): Promise<ScheduledTask | null> {
  if (process.env.NODE_ENV === "test") {
    return null;
  }

  try {
    const policy = await policyService.getActivePolicy();
    const timezone = policy.timezone || "Asia/Kolkata";

    // Run hourly to check upcoming events and broadcast required notifications
    announcementTask = cron.schedule(
      "0 * * * *",
      async () => {
        try {
          const isEnabled = await featureFlagService.isFeatureEnabled("announcements");
          if (!isEnabled) {
            return;
          }

          logger.info("[Announcements Cron] Running scheduled announcements generation...");
          const res = await announcementService.runScheduledJob();
          logger.info("[Announcements Cron] Completed evaluation:", res);
        } catch (error) {
          logger.error("[Announcements Cron] Error running scheduled announcements job:", error);
        }
      },
      { timezone }
    );

    logger.info(`[Announcements Cron] Scheduled job initialized for timezone ${timezone}.`);
    return announcementTask;
  } catch (error) {
    logger.error("[Announcements Cron] Failed to initialize cron job:", error);
    return null;
  }
}

/**
 * Stops and cleans up the cron task during graceful shutdown.
 */
export function stopAnnouncementsCronJob(): void {
  if (announcementTask) {
    announcementTask.stop();
    announcementTask = null;
    logger.info("[Announcements Cron] Scheduled announcements job stopped.");
  }
}
