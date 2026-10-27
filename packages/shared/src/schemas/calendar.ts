import { z } from "zod";

export const CalendarEventTypeSchema = z.enum([
  "holiday",
  "companyOffDay",
  "meeting",
  "event",
]);
export type CalendarEventType = z.infer<typeof CalendarEventTypeSchema>;

export const CalendarEventSourceSchema = z.enum(["manual", "imported"]);
export type CalendarEventSource = z.infer<typeof CalendarEventSourceSchema>;

export const CalendarAudienceSchema = z.object({
  scope: z.enum(["all", "department", "shift", "custom"]).default("all"),
  departments: z.array(z.string()).default([]),
  roles: z.array(z.string()).default([]),
  shiftIds: z.array(z.string()).default([]),
});
export type CalendarAudience = z.infer<typeof CalendarAudienceSchema>;

export const CalendarEventSchema = z.object({
  _id: z.string().optional(),
  type: CalendarEventTypeSchema,
  title: z.string().min(2).max(120),
  description: z.string().max(1000).optional(),
  startDate: z.string().datetime().or(z.date()),
  endDate: z.string().datetime().or(z.date()),
  isFullDay: z.boolean().default(true),
  source: CalendarEventSourceSchema.default("manual"),
  audience: CalendarAudienceSchema.default({
    scope: "all",
    departments: [],
    roles: [],
    shiftIds: [],
  }),
  externalId: z.string().optional(),
  location: z.string().max(200).optional(),
  createdBy: z.string().optional(),
  createdAt: z.date().optional(),
  updatedAt: z.date().optional(),
});
export type CalendarEvent = z.infer<typeof CalendarEventSchema>;

export const CreateCalendarEventInputSchema = z.object({
  type: CalendarEventTypeSchema,
  title: z.string().min(2, "Title must be at least 2 characters").max(120),
  description: z.string().max(1000).optional(),
  startDate: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)),
  endDate: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)),
  isFullDay: z.boolean().default(true),
  source: CalendarEventSourceSchema.default("manual"),
  audience: CalendarAudienceSchema.optional(),
  location: z.string().max(200).optional(),
});
export type CreateCalendarEventInput = z.infer<typeof CreateCalendarEventInputSchema>;

