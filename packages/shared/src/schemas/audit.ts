import { z } from "zod";

export const AuditLogFilterQuerySchema = z.object({
  actor: z.string().trim().optional(),
  performedBy: z.string().trim().optional(),
  performedByEmployeeId: z.string().trim().optional(),
  action: z.string().trim().optional(),
  entity: z.string().trim().optional(),
  entityType: z.string().trim().optional(),
  entityId: z.string().trim().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  search: z.string().trim().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  sortBy: z.enum(["timestamp"]).default("timestamp"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
});

export type AuditLogFilterQuery = z.infer<typeof AuditLogFilterQuerySchema>;
