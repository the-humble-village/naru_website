import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import {
  EnrollmentCreateSchema,
  EnrollmentUpdateSchema,
  EnrollmentExitSchema,
  DateOnlySchema,
  type UserRead,
  type TokenPayload,
} from '@naru/shared';
import { auth } from '../middleware/auth.js';
import { requireSupervisor } from '../middleware/role.js';
import * as enrollmentService from '../services/enrollment.service.js';

type Variables = {
  user: UserRead;
  tokenPayload: TokenPayload;
};

const app = new Hono<{ Variables: Variables }>();

const ListQuerySchema = z.object({
  programId: z.string().optional(),
  motherId: z.string().optional(),
  childId: z.string().optional(),
  personId: z.string().optional(),
  familyId: z.string().optional(),
  status: z.enum(['active', 'exited', 'all']).optional(),
  onDate: DateOnlySchema.optional(),
  communityId: z.string().optional(),
  siteId: z.string().optional(),
  skip: z.string().optional(),
  limit: z.string().optional(),
});

const IdParamSchema = z.object({
  id: z.string().transform((val) => parseInt(val, 10)),
});

function toInt(value: string | undefined): number | undefined {
  if (value === undefined) return undefined;
  const parsed = parseInt(value, 10);
  return isNaN(parsed) ? undefined : parsed;
}

/**
 * GET /enrollments
 * Defaults to active only. `onDate` is the census filter (SCHEMA_V2.md §8).
 */
app.get('/', auth, zValidator('query', ListQuerySchema), async (c) => {
  const query = c.req.valid('query');
  const user = c.get('user') as UserRead;

  const result = await enrollmentService.listEnrollments({
    programId: toInt(query.programId),
    motherId: toInt(query.motherId),
    childId: toInt(query.childId),
    personId: toInt(query.personId),
    familyId: toInt(query.familyId),
    status: query.status,
    onDate: query.onDate,
    communityId: toInt(query.communityId),
    siteId: toInt(query.siteId),
    skip: toInt(query.skip),
    limit: toInt(query.limit),
    user,
  });

  return c.json({
    items: result.enrollments,
    total: result.total,
    skip: toInt(query.skip) ?? 0,
    limit: toInt(query.limit) ?? 50,
  });
});

/**
 * POST /enrollments
 */
app.post('/', auth, zValidator('json', EnrollmentCreateSchema), async (c) => {
  const data = c.req.valid('json');
  const enrollment = await enrollmentService.createEnrollment(data);
  return c.json(enrollment, 201);
});

/**
 * GET /enrollments/:id
 */
app.get('/:id', auth, zValidator('param', IdParamSchema), async (c) => {
  const { id } = c.req.valid('param');
  const user = c.get('user') as UserRead;

  const enrollment = await enrollmentService.getEnrollmentById(id, user);
  return c.json(enrollment);
});

/**
 * PUT /enrollments/:id
 * Admission data only — the subject and program are immutable.
 */
app.put(
  '/:id',
  auth,
  zValidator('param', IdParamSchema),
  zValidator('json', EnrollmentUpdateSchema),
  async (c) => {
    const { id } = c.req.valid('param');
    const data = c.req.valid('json');
    const user = c.get('user') as UserRead;

    const enrollment = await enrollmentService.updateEnrollment(id, data, user);
    return c.json(enrollment);
  }
);

/**
 * POST /enrollments/:id/exit
 */
app.post(
  '/:id/exit',
  auth,
  zValidator('param', IdParamSchema),
  zValidator('json', EnrollmentExitSchema),
  async (c) => {
    const { id } = c.req.valid('param');
    const data = c.req.valid('json');
    const user = c.get('user') as UserRead;

    const enrollment = await enrollmentService.exitEnrollment(id, data, user);
    return c.json(enrollment);
  }
);

/**
 * POST /enrollments/:id/reopen
 * Undo an exit. Supervisor+ only.
 */
app.post(
  '/:id/reopen',
  auth,
  requireSupervisor,
  zValidator('param', IdParamSchema),
  async (c) => {
    const { id } = c.req.valid('param');
    const user = c.get('user') as UserRead;

    const enrollment = await enrollmentService.reopenEnrollment(id, user);
    return c.json(enrollment);
  }
);

/**
 * DELETE /enrollments/:id
 * Soft delete (supervisor+ only)
 */
app.delete('/:id', auth, requireSupervisor, zValidator('param', IdParamSchema), async (c) => {
  const { id } = c.req.valid('param');
  const user = c.get('user') as UserRead;

  await enrollmentService.deleteEnrollment(id, user);
  return c.json({ message: 'Enrollment deleted successfully' });
});

export default app;
