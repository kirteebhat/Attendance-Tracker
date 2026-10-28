import { z } from "zod";

export const AnnouncementPrioritySchema = z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]);
export type AnnouncementPriority = z.infer<typeof AnnouncementPrioritySchema>;

export const AnnouncementSourceSchema = z.enum(["manual", "auto"]);
export type AnnouncementSource = z.infer<typeof AnnouncementSourceSchema>;

export const AnnouncementAudienceSchema = z.object({
  scope: z.enum(["all", "department", "role"]).default("all"),
  departments: z.array(z.string()).default([]),
  roles: z.array(z.string()).default([]),
});
export type AnnouncementAudience = z.infer<typeof AnnouncementAudienceSchema>;

export const AnnouncementReadReceiptSchema = z.object({
  user: z.string(),
  readAt: z.string().datetime().or(z.date()),
});
export type AnnouncementReadReceipt = z.infer<typeof AnnouncementReadReceiptSchema>;

export const AnnouncementSchema = z.object({
  _id: z.string().optional(),
  title: z.string().min(2).max(150),
  body: z.string().min(5).max(5000),
  audience: AnnouncementAudienceSchema.default({ scope: "all", departments: [], roles: [] }),
  priority: AnnouncementPrioritySchema.default("MEDIUM"),
  pinned: z.boolean().default(false),
  startsAt: z.string().datetime().or(z.date()),
  expiresAt: z.string().datetime().or(z.date()).optional().nullable(),
  source: AnnouncementSourceSchema.default("manual"),
  templateKey: z.string().optional(),
  idempotencyKey: z.string().optional(),
  isAuto: z.boolean().optional(),
  metadata: z.record(z.unknown()).optional(),
  readBy: z.array(AnnouncementReadReceiptSchema).default([]),
  createdBy: z.string().optional(),
  createdAt: z.date().optional(),
  updatedAt: z.date().optional(),
});
export type Announcement = z.infer<typeof AnnouncementSchema>;

export const CreateAnnouncementInputSchema = z.object({
  title: z.string().min(2, "Title must be at least 2 characters").max(150),
  body: z.string().min(5, "Body must be at least 5 characters").max(5000),
  audience: AnnouncementAudienceSchema.optional(),
  priority: AnnouncementPrioritySchema.default("MEDIUM"),
  pinned: z.boolean().default(false),
  startsAt: z.string().datetime().or(z.date()).optional(),
  expiresAt: z.string().datetime().or(z.date()).optional().nullable(),
  source: AnnouncementSourceSchema.default("manual"),
  templateKey: z.string().optional(),
  idempotencyKey: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
});
export type CreateAnnouncementInput = z.infer<typeof CreateAnnouncementInputSchema>;

export const UpdateAnnouncementInputSchema = z.object({
  title: z.string().min(2).max(150).optional(),
  body: z.string().min(5).max(5000).optional(),
  audience: AnnouncementAudienceSchema.optional(),
  priority: AnnouncementPrioritySchema.optional(),
  pinned: z.boolean().optional(),
  startsAt: z.string().datetime().or(z.date()).optional(),
  expiresAt: z.string().datetime().or(z.date()).optional().nullable(),
});
export type UpdateAnnouncementInput = z.infer<typeof UpdateAnnouncementInputSchema>;

/**
 * Announcement Template Schema for auto-generated broadcasts
 */
export const AnnouncementTemplateSchema = z.object({
  _id: z.string().optional(),
  key: z.string().min(2).max(50),
  name: z.string().min(2).max(100),
  titleTemplate: z.string().min(2).max(200),
  bodyTemplate: z.string().min(2).max(5000),
  priority: AnnouncementPrioritySchema.default("MEDIUM"),
  audience: AnnouncementAudienceSchema.default({ scope: "all", departments: [], roles: [] }),
  isEnabled: z.boolean().default(true),
  variables: z.array(z.string()).default([]),
  description: z.string().optional(),
  createdAt: z.date().optional(),
  updatedAt: z.date().optional(),
});
export type AnnouncementTemplate = z.infer<typeof AnnouncementTemplateSchema>;

export const UpdateAnnouncementTemplateInputSchema = z.object({
  titleTemplate: z.string().min(2).max(200).optional(),
  bodyTemplate: z.string().min(2).max(5000).optional(),
  priority: AnnouncementPrioritySchema.optional(),
  audience: AnnouncementAudienceSchema.optional(),
  isEnabled: z.boolean().optional(),
});
export type UpdateAnnouncementTemplateInput = z.infer<typeof UpdateAnnouncementTemplateInputSchema>;
