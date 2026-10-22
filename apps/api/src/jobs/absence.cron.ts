import cron, { ScheduledTask } from "node-cron";
import { evaluateAbsenceAndIncompleteJob } from "../services/attendance.service";
import { logger } from "../utils/logger";
import { policyService } from "../services/policy.service";

let absenceTask: ScheduledTask | null = null;

/**
 * Initializes and starts the automated absence and incomplete checkout evaluation cron job.
 * Runs on a recurring schedule (default: every hour at minute 0, or daily at cutoff)
 * evaluating after the configured policy cutoff time in the company timezone.
 */
export async function startAbsenceCronJob(): Promise<ScheduledTask | null> {
  if (process.env.NODE_ENV === "test") {
    return null;
  }

  try {
    const policy = await policyService.getActivePolicy();
    const timezone = policy.timezone || "Asia/Kolkata";

    // Run hourly to check if cutoff was reached and evaluate absentees
    // e.g. "0 * * * *" runs at the top of every hour in the configured timezone
    absenceTask = cron.schedule(
      "0 * * * *",
      async () => {
        try {
          logger.info("[Absence Cron] Running scheduled absence evaluation job...");
          const result = await evaluateAbsenceAndIncompleteJob();
          logger.info("[Absence Cron] Result:", result);
        } catch (error: unknown) {
          const err = error as Error;
          // Normal skip when cutoff not reached yet
          logger.info(`[Absence Cron] Evaluation skipped: ${err.message}`);
        }
      },
      {
        timezone,
      }
    );

    logger.info(`[Absence Cron] Scheduled absence evaluation job initialized for ${timezone}.`);
    return absenceTask;
  } catch (error) {
    logger.error("[Absence Cron] Failed to initialize cron job:", error);
    return null;
  }
}

/**
 * Stops and cleans up the cron task (e.g. during graceful shutdown)
 */
export function stopAbsenceCronJob(): void {
  if (absenceTask) {
    absenceTask.stop();
    absenceTask = null;
    logger.info("[Absence Cron] Scheduled absence evaluation job stopped.");
  }
}
