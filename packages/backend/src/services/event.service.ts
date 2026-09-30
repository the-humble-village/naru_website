import { HTTPException } from 'hono/http-exception';
import {
  type EventCreate,
  type EventUpdate,
  type EventWithCount,
  type UserRead,
} from '@naru/shared';
import prisma from '../db.js';
import { toDateOnly } from '../utils/date.js';

const EVENT_SELECT = {
  id: true,
  name: true,
  eventDate: true,
  notes: true,
  createdAt: true,
  updatedAt: true,
  _count: { select: { visits: { where: { deletedAt: null } } } },
  // Explicitly exclude deletedAt
} as const;

function toEventRead(row: any): EventWithCount {
  return {
    id: row.id,
    name: row.name,
    eventDate: toDateOnly(row.eventDate)!,
    notes: row.notes,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    visitCount: row._count.visits,
  };
}

export async function listEvents(options: {
  search?: string;
  from?: string;
  to?: string;
  skip?: number;
  limit?: number;
  user: UserRead;
}): Promise<{ events: EventWithCount[]; total: number }> {
  const skip = Math.max(0, options.skip || 0);
  const limit = Math.min(100, Math.max(1, options.limit || 50));

  const where: any = {};

  if (options.search?.trim()) {
    where.name = { contains: options.search.trim(), mode: 'insensitive' };
  }

  if (options.from !== undefined || options.to !== undefined) {
    where.eventDate = {};
    if (options.from !== undefined) where.eventDate.gte = new Date(options.from);
    if (options.to !== undefined) where.eventDate.lte = new Date(options.to);
  }

  const [rows, total] = await Promise.all([
    prisma.event.findMany({
      where,
      skip,
      take: limit,
      select: EVENT_SELECT,
      orderBy: [{ eventDate: 'desc' }, { id: 'desc' }],
    }),
    prisma.event.count({ where }),
  ]);

  return { events: rows.map(toEventRead), total };
}

export async function getEventById(eventId: number, user: UserRead): Promise<EventWithCount> {
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: EVENT_SELECT,
  });

  if (!event) {
    throw new HTTPException(404, { message: 'Event not found' });
  }

  return toEventRead(event);
}

export async function createEvent(data: EventCreate, user: UserRead): Promise<EventWithCount> {
  const created = await prisma.event.create({
    data: {
      name: data.name,
      eventDate: new Date(data.eventDate),
      notes: data.notes ?? null,
    },
    select: EVENT_SELECT,
  });

  return toEventRead(created);
}

export async function updateEvent(
  eventId: number,
  data: EventUpdate,
  user: UserRead
): Promise<EventWithCount> {
  const existing = await prisma.event.findUnique({
    where: { id: eventId },
    select: { id: true },
  });

  if (!existing) {
    throw new HTTPException(404, { message: 'Event not found' });
  }

  const updateData: any = { updatedAt: new Date() };

  if (data.name !== undefined) updateData.name = data.name;
  if (data.eventDate !== undefined) updateData.eventDate = new Date(data.eventDate);
  if (data.notes !== undefined) updateData.notes = data.notes;

  const updated = await prisma.event.update({
    where: { id: eventId },
    data: updateData,
    select: EVENT_SELECT,
  });

  return toEventRead(updated);
}

/**
 * Soft delete an event. Supervisor+.
 *
 * Attached visits keep their eventId. The DB's onDelete: SetNull never fires
 * because the row is never actually removed, so a visit recorded at a deleted
 * event stays readable and stays attributable — losing the link would silently
 * drop it out of any per-event attendance count added later (SCHEMA_V2.md §11).
 */
export async function deleteEvent(eventId: number, user: UserRead): Promise<void> {
  const existing = await prisma.event.findUnique({
    where: { id: eventId },
    select: { id: true },
  });

  if (!existing) {
    throw new HTTPException(404, { message: 'Event not found' });
  }

  await prisma.event.update({
    where: { id: eventId },
    data: { deletedAt: new Date() },
  });
}
