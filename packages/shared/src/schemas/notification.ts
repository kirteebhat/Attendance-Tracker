import { z } from "zod";

export const NotificationTypeSchema = z.enum([
  "LEAVE_STATUS",
  "WFH_STATUS",
  "ANNOUNCEMENT",
  "ENQUIRY_REPLY",
  "SYSTEM",
  "SECURITY",
]);
export type NotificationType = z.infer<typeof NotificationTypeSchema>;

export const NotificationSchema = z.object({
  _id: z.string().optional(),
  user: z.string(), // ObjectId ref User
  type: NotificationTypeSchema,
  title: z.string().min(1).max(150),
  message: z.string().min(1).max(1000),
  payload: z.record(z.unknown()).default({}),
  readAt: z.string().datetime().or(z.date()).optional().nullable(),
  expiresAt: z.string().datetime().or(z.date()).optional().nullable(),
  createdAt: z.date().optional(),
  updatedAt: z.date().optional(),
});
export type Notification = z.infer<typeof NotificationSchema>;

export const CreateNotificationInputSchema = z.object({
  user: z.string(),
  type: NotificationTypeSchema,
  title: z.string().min(1).max(150),
  message: z.string().min(1).max(1000),
  payload: z.record(z.unknown()).optional(),
  expiresAt: z.string().datetime().optional().nullable(),
});
export type CreateNotificationInput = z.infer<typeof CreateNotificationInputSchema>;

