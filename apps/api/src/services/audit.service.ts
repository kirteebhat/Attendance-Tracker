import { Types } from "mongoose";
import { AuditEvent, IAuditEvent } from "../models";
import { AuditLogFilterQuery } from "@vorldx/shared";

export interface AuditLogListResult {
  success: boolean;
  data: IAuditEvent[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

/**
 * Retrieves audit events with multi-field filtering and pagination
 */
export async function listAuditLogs(query: AuditLogFilterQuery): Promise<AuditLogListResult> {
  const page = Math.max(1, query.page || 1);
  const limit = Math.min(100, Math.max(1, query.limit || 20));
  const skip = (page - 1) * limit;

  const filter: Record<string, unknown> = {};

  // Actor / Performed By
  const actor = query.actor || query.performedBy || query.performedByEmployeeId;
  if (actor) {
    if (Types.ObjectId.isValid(actor)) {
      filter.$or = [{ performedBy: new Types.ObjectId(actor) }, { performedByEmployeeId: actor }];
    } else {
      filter.performedByEmployeeId = actor.trim().toUpperCase();
    }
  }

  // Action
  if (query.action) {
    filter.action = query.action.toUpperCase();
  }

  // Entity Type
  const entityType = query.entity || query.entityType;
  if (entityType) {
    filter.entityType = entityType.toUpperCase();
  }

  // Entity ID
  if (query.entityId) {
    filter.entityId = query.entityId;
  }

  // Date Range on timestamp
  const startDate = query.startDate || query.from;
  const endDate = query.endDate || query.to;

  if (startDate && endDate) {
    filter.timestamp = {
      $gte: new Date(startDate),
      $lte: new Date(endDate.includes("T") ? endDate : `${endDate}T23:59:59.999Z`),
    };
  } else if (startDate) {
    filter.timestamp = { $gte: new Date(startDate) };
  } else if (endDate) {
    filter.timestamp = {
      $lte: new Date(endDate.includes("T") ? endDate : `${endDate}T23:59:59.999Z`),
    };
  }

  // Free-text search in reason or entityId
  if (query.search && query.search.trim().length > 0) {
    const searchRegex = new RegExp(query.search.trim(), "i");
    filter.$or = [
      { reason: searchRegex },
      { entityId: searchRegex },
      { performedByEmployeeId: searchRegex },
    ];
  }

  const [events, total] = await Promise.all([
    AuditEvent.find(filter)
      .populate("performedBy", "email employeeId role")
      .sort({ timestamp: -1 })
      .skip(skip)
      .limit(limit),
    AuditEvent.countDocuments(filter),
  ]);

  return {
    success: true,
    data: events,
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    },
  };
}
