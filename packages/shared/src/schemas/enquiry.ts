import { z } from "zod";

export const EnquiryCategorySchema = z.enum([
  "PAYROLL",
  "ATTENDANCE",
  "LEAVE",
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

export const EnquiryPrioritySchema = z.enum(["LOW", "MEDIUM", "HIGH"]);
export type EnquiryPriority = z.infer<typeof EnquiryPrioritySchema>;

export const EnquiryMessageSchema = z.object({
  _id: z.string().optional(),
  enquiryId: z.string(),
  sender: z.string(), // ObjectId
  senderRole: z.enum(["EMPLOYEE", "HR", "ADMIN"]),
  message: z.string().min(1).max(3000),
  attachments: z.array(z.string().url()).default([]),
  readByRecipient: z.boolean().default(false),
  createdAt: z.string().datetime().or(z.date()).optional(),
});
export type EnquiryMessage = z.infer<typeof EnquiryMessageSchema>;

export const EnquirySchema = z.object({
  _id: z.string().optional(),
  employee: z.string(), // ObjectId ref Employee/User
  category: EnquiryCategorySchema,
  subject: z.string().min(3).max(150),
  status: EnquiryStatusSchema.default("OPEN"),
  priority: EnquiryPrioritySchema.default("MEDIUM"),
  assignee: z.string().optional().nullable(), // ObjectId ref User
  lastMessageAt: z.string().datetime().or(z.date()).optional(),
  closedAt: z.string().datetime().or(z.date()).optional().nullable(),
  createdAt: z.date().optional(),
  updatedAt: z.date().optional(),
});
export type Enquiry = z.infer<typeof EnquirySchema>;

export const CreateEnquiryInputSchema = z.object({
  category: EnquiryCategorySchema,
  subject: z.string().min(3, "Subject must be at least 3 characters").max(150),
  message: z.string().min(5, "Initial message must be at least 5 characters").max(3000),
  priority: EnquiryPrioritySchema.default("MEDIUM"),
  attachments: z.array(z.string().url()).optional(),
});
export type CreateEnquiryInput = z.infer<typeof CreateEnquiryInputSchema>;

export const SendEnquiryMessageInputSchema = z.object({
  message: z.string().min(1, "Message cannot be empty").max(3000),
  attachments: z.array(z.string().url()).optional(),
});
export type SendEnquiryMessageInput = z.infer<typeof SendEnquiryMessageInputSchema>;
