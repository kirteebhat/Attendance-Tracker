import { Router } from "express";
import * as auditController from "../controllers/audit.controller";
import { authenticate, requireRole } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { AuditLogFilterQuerySchema, UserRole } from "@vorldx/shared";

const router = Router();

// Audit log endpoints require HR or Admin role
router.use(authenticate);
router.use(requireRole(UserRole.HR, UserRole.ADMIN));

router.get("/", validate({ query: AuditLogFilterQuerySchema }), auditController.listAuditLogs);

export const auditRouter = router;
export default router;
