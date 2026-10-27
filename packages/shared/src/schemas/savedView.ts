import { z } from "zod";

export const SavedViewSchema = z.object({
  _id: z.string().optional(),
  user: z.string(), // ObjectId ref User
  page: z.string().min(1).max(50),
  name: z.string().min(1).max(60),
  filters: z.record(z.unknown()).default({}),
  sort: z.record(z.union([z.literal(1), z.literal(-1), z.literal("asc"), z.literal("desc")])).optional(),
  isDefault: z.boolean().default(false),
  createdAt: z.date().optional(),
  updatedAt: z.date().optional(),
});
export type SavedView = z.infer<typeof SavedViewSchema>;

export const CreateSavedViewInputSchema = z.object({
  page: z.string().min(1).max(50),
  name: z.string().min(1, "View name is required").max(60),
  filters: z.record(z.unknown()).default({}),
  sort: z.record(z.union([z.literal(1), z.literal(-1), z.literal("asc"), z.literal("desc")])).optional(),
  isDefault: z.boolean().default(false),
});
export type CreateSavedViewInput = z.infer<typeof CreateSavedViewInputSchema>;
