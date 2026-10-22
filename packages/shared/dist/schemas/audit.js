"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuditLogFilterQuerySchema = void 0;
const zod_1 = require("zod");
exports.AuditLogFilterQuerySchema = zod_1.z.object({
    actor: zod_1.z.string().trim().optional(),
    performedBy: zod_1.z.string().trim().optional(),
    performedByEmployeeId: zod_1.z.string().trim().optional(),
    action: zod_1.z.string().trim().optional(),
    entity: zod_1.z.string().trim().optional(),
    entityType: zod_1.z.string().trim().optional(),
    entityId: zod_1.z.string().trim().optional(),
    startDate: zod_1.z.string().optional(),
    endDate: zod_1.z.string().optional(),
    from: zod_1.z.string().optional(),
    to: zod_1.z.string().optional(),
    search: zod_1.z.string().trim().optional(),
    page: zod_1.z.coerce.number().int().positive().default(1),
    limit: zod_1.z.coerce.number().int().positive().max(100).default(20),
    sortBy: zod_1.z.enum(["timestamp"]).default("timestamp"),
    sortOrder: zod_1.z.enum(["asc", "desc"]).default("desc"),
});
