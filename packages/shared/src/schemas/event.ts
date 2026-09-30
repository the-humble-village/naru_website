import { z } from 'zod';
import { DateOnlySchema } from './enums.js';

export const EventCreateSchema = z.object({
  name: z.string().min(1).max(256),
  eventDate: DateOnlySchema,
  notes: z.string().optional().nullable(),
});

export const EventUpdateSchema = EventCreateSchema.partial();

export const EventReadSchema = z.object({
  id: z.number().int().positive(),
  name: z.string(),
  eventDate: DateOnlySchema,
  notes: z.string().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const EventWithCountSchema = EventReadSchema.extend({
  visitCount: z.number().int().nonnegative(),
});

export type EventCreate = z.infer<typeof EventCreateSchema>;
export type EventUpdate = z.infer<typeof EventUpdateSchema>;
export type EventRead = z.infer<typeof EventReadSchema>;
export type EventWithCount = z.infer<typeof EventWithCountSchema>;
