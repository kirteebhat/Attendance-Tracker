import { Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import * as auditService from "../services/audit.service";
import { AuditLogFilterQuery } from "@vorldx/shared";

/**
 * GET /audit-logs (and /api/audit-logs, /api/admin/audit-logs)
 * HR/Admin query of immutable security and operational audit trail with filters & pagination.
 */
export const listAuditLogs = asyncHandler(async (req: Request, res: Response) => {
  const query: AuditLogFilterQuery = {
    actor: req.query.actor as string | undefined,
    performedBy: req.query.performedBy as string | undefined,
    performedByEmployeeId: req.query.performedByEmployeeId as string | undefined,
    action: req.query.action as string | undefined,
    entity: req.query.entity as string | undefined,
    entityType: req.query.entityType as string | undefined,
    entityId: req.query.entityId as string | undefined,
    startDate: (req.query.startDate || req.query.from) as string | undefined,
    endDate: (req.query.endDate || req.query.to) as string | undefined,
    from: req.query.from as string | undefined,
    to: req.query.to as string | undefined,
    search: req.query.search as string | undefined,
    page: req.query.page ? parseInt(req.query.page as string, 10) : 1,
    limit: req.query.limit ? parseInt(req.query.limit as string, 10) : 20,
    sortBy: "timestamp",
    sortOrder: (req.query.sortOrder as "asc" | "desc") || "desc",
  };

  const result = await auditService.listAuditLogs(query);
  res.status(200).json(result);
});
