import { z } from "zod";

export const ALLOWED_ENQUIRY_ATTACHMENT_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
] as const;

export const MAX_ENQUIRY_ATTACHMENT_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

export const EnquiryCategorySchema = z.enum([
  "ATTENDANCE",
  "LEAVE",
  "WFH",
  "PAYROLL",
  "TECHNICAL",
  "OTHER",
  "BENEFITS",
  "IT",
  "GENERAL",
]);
export type EnquiryCategory = z.infer<typeof EnquiryCategorySchema>;

export const EnquiryStatusSchema = z.enum([
  "OPEN",
  "IN_PROGRESS",
  "RESOLVED",
  "CLOSED",
]);
export type EnquiryStatus = z.infer<typeof EnquiryStatusSchema>;

export const EnquiryPrioritySchema = z.enum([
  "LOW",
  "MEDIUM",
  "HIGH",
  "URGENT",
]);
export type EnquiryPriority = z.infer<typeof EnquiryPrioritySchema>;

export const EnquiryAttachmentSchema = z.object({
  name: z.string().min(1).default("attachment.png"),
  mimeType: z.string().refine(
    (val) => (ALLOWED_ENQUIRY_ATTACHMENT_MIME_TYPES as readonly string[]).includes(val.toLowerCase()),
    {
      message: "Invalid image type. Allowed: image/jpeg, image/png, image/webp, image/gif",
    }
  ),
  sizeBytes: z
    .number()
    .min(1, "File cannot be empty")
    .max(MAX_ENQUIRY_ATTACHMENT_SIZE_BYTES, "Image attachment cannot exceed 5MB"),
  url: z.string().optional(),
  dataUrl: z.string().optional(),
});
export type EnquiryAttachment = z.infer<typeof EnquiryAttachmentSchema>;

export const EnquiryMessageSchema = z.object({
  _id: z.string().optional(),
  enquiryId: z.string(),
  sender: z.string(), // ObjectId
  senderRole: z.enum(["EMPLOYEE", "HR", "ADMIN"]),
  message: z.string().min(1).max(3000),
  attachments: z.array(EnquiryAttachmentSchema).default([]),
  readByRecipient: z.boolean().default(false),
  createdAt: z.string().datetime().or(z.date()).optional(),
});
export type EnquiryMessage = z.infer<typeof EnquiryMessageSchema>;

export const EnquirySchema = z.object({
  _id: z.string().optional(),
  ticketNumber: z.string().optional(),
  employee: z.string(), // ObjectId ref Employee/User
  category: EnquiryCategorySchema,
  subject: z.string().min(3).max(150),
  status: EnquiryStatusSchema.default("OPEN"),
  priority: EnquiryPrioritySchema.default("MEDIUM"),
  assignee: z.string().optional().nullable(), // ObjectId ref User
  firstResponseAt: z.string().datetime().or(z.date()).optional().nullable(),
  resolvedAt: z.string().datetime().or(z.date()).optional().nullable(),
  closedAt: z.string().datetime().or(z.date()).optional().nullable(),
  reopenDeadline: z.string().datetime().or(z.date()).optional().nullable(),
  lastMessageAt: z.string().datetime().or(z.date()).optional(),
  createdAt: z.date().optional(),
  updatedAt: z.date().optional(),
});
export type Enquiry = z.infer<typeof EnquirySchema>;

export const CreateEnquiryInputSchema = z.object({
  category: z.preprocess(
    (v) => (typeof v === "string" ? v.toUpperCase() : v),
    EnquiryCategorySchema
  ),
  subject: z.string().min(3, "Subject must be at least 3 characters").max(150),
  message: z.string().min(5, "Initial message must be at least 5 characters").max(3000),
  priority: z
    .preprocess(
      (v) => (typeof v === "string" ? v.toUpperCase() : v),
      EnquiryPrioritySchema
    )
    .optional()
    .default("MEDIUM"),
  attachment: EnquiryAttachmentSchema.optional(),
  attachments: z.array(EnquiryAttachmentSchema).optional().default([]),
});
export type CreateEnquiryInput = z.infer<typeof CreateEnquiryInputSchema>;

export const SendEnquiryMessageInputSchema = z.object({
  message: z.string().min(1, "Message cannot be empty").max(3000),
  attachment: EnquiryAttachmentSchema.optional(),
  attachments: z.array(EnquiryAttachmentSchema).optional().default([]),
});
export type SendEnquiryMessageInput = z.infer<typeof SendEnquiryMessageInputSchema>;

export const AssignEnquiryInputSchema = z.object({
  assigneeId: z.string().min(1, "Assignee user ID is required"),
});
export type AssignEnquiryInput = z.infer<typeof AssignEnquiryInputSchema>;

export const UpdateEnquiryStatusInputSchema = z.object({
  status: z.preprocess(
    (v) => (typeof v === "string" ? v.toUpperCase() : v),
    EnquiryStatusSchema
  ),
  note: z.string().max(500).optional(),
});
export type UpdateEnquiryStatusInput = z.infer<typeof UpdateEnquiryStatusInputSchema>;

export const ReopenEnquiryInputSchema = z.object({
  reason: z.string().min(3, "Reason must be at least 3 characters").max(500),
});
export type ReopenEnquiryInput = z.infer<typeof ReopenEnquiryInputSchema>;
