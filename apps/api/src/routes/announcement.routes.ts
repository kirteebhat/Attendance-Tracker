import { Router } from "express";
import { announcementController } from "../controllers/announcement.controller";
import { authenticate, requireRole } from "../middleware/auth";
import { requireFeatureFlag } from "../middleware/featureFlag";
import { UserRole } from "@vorldx/shared";

const router = Router();

// Strictly guard entire announcements subsystem behind 'announcements' feature flag
router.use(requireFeatureFlag("announcements"));

// Public/Kiosk announcements for lobby displays & tickers (scope: "all")
router.get("/public", announcementController.getPublicAnnouncements);

// All subsequent announcement routes require authenticated user
router.use(authenticate);

// =========================================================================
// General Employee Routes
// =========================================================================

// GET /api/announcements/unread-count - Unread count for current user
router.get("/unread-count", announcementController.getUnreadCount);

// POST /api/announcements/:id/read - Mark announcement as read
router.post("/:id/read", announcementController.markAsRead);

// GET /api/announcements - Active targeted announcements for user
router.get("/", announcementController.getAnnouncements);

// =========================================================================
// HR & Administrative Management Routes
// =========================================================================

// GET /api/announcements/admin - All announcements with delivery metrics
router.get(
  "/admin",
  requireRole(UserRole.ADMIN, UserRole.HR, UserRole.HR_ADMIN),
  announcementController.getAdminAnnouncements
);

// POST /api/announcements - Create manual broadcast
router.post(
  "/",
  requireRole(UserRole.ADMIN, UserRole.HR, UserRole.HR_ADMIN),
  announcementController.createAnnouncement
);

// PUT /api/announcements/:id - Update announcement
router.put(
  "/:id",
  requireRole(UserRole.ADMIN, UserRole.HR, UserRole.HR_ADMIN),
  announcementController.updateAnnouncement
);

// DELETE /api/announcements/:id - Delete announcement
router.delete(
  "/:id",
  requireRole(UserRole.ADMIN, UserRole.HR, UserRole.HR_ADMIN),
  announcementController.deleteAnnouncement
);

// Template Management
router.get(
  "/templates",
  requireRole(UserRole.ADMIN, UserRole.HR, UserRole.HR_ADMIN),
  announcementController.listTemplates
);

router.get(
  "/templates/:key",
  requireRole(UserRole.ADMIN, UserRole.HR, UserRole.HR_ADMIN),
  announcementController.getTemplateByKey
);

router.put(
  "/templates/:key",
  requireRole(UserRole.ADMIN, UserRole.HR, UserRole.HR_ADMIN),
  announcementController.updateTemplate
);

// Run auto-announcements trigger manually
router.post(
  "/trigger-auto",
  requireRole(UserRole.ADMIN, UserRole.HR, UserRole.HR_ADMIN),
  announcementController.triggerAutoAnnouncements
);

export const announcementRouter = router;
export default router;

