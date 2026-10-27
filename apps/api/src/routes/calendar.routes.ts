import { Router } from "express";
import { calendarController } from "../controllers/calendar.controller";
import { authenticate, requireRole } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { CreateCalendarEventInputSchema, UserRole } from "@vorldx/shared";

const router = Router();

// =========================================================================
// Public / Standard Authenticated Calendar Endpoints
// =========================================================================

// Export ICS file (accessible by employees / staff / subscriptions)
router.get("/export.ics", calendarController.exportIcs);
router.get("/export", calendarController.exportIcs);

// Core Day Type & Working Days Engine (timezone-safe)
router.get("/day-type", calendarController.getDayType);
router.get("/working-days", calendarController.countWorkingDays);
router.get("/next-working-day", calendarController.getNextWorkingDay);

// List events by date range / query (authenticated employees & staff)
router.get("/events", authenticate, calendarController.listEvents);
router.get("/events/:id", authenticate, calendarController.getEventById);

// =========================================================================
// Privileged Administrative / HR Calendar Endpoints
// =========================================================================

// CRUD for CalendarEvent
router.post(
  "/events",
  authenticate,
  requireRole(UserRole.HR, UserRole.ADMIN),
  validate({ body: CreateCalendarEventInputSchema }),
  calendarController.createEvent
);

router.put(
  "/events/:id",
  authenticate,
  requireRole(UserRole.HR, UserRole.ADMIN),
  calendarController.updateEvent
);

router.delete(
  "/events/:id",
  authenticate,
  requireRole(UserRole.HR, UserRole.ADMIN),
  calendarController.deleteEvent
);

// Holiday Import via Provider Adapter (Preview & Merge Safe)
router.get(
  "/holidays/preview",
  authenticate,
  requireRole(UserRole.HR, UserRole.ADMIN),
  calendarController.previewHolidays
);

router.post(
  "/holidays/preview",
  authenticate,
  requireRole(UserRole.HR, UserRole.ADMIN),
  calendarController.previewHolidays
);

router.post(
  "/holidays/import",
  authenticate,
  requireRole(UserRole.HR, UserRole.ADMIN),
  calendarController.importHolidays
);

export const calendarRouter = router;
export default router;

