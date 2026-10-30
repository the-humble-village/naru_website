import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { ReportQuerySchema, type TokenPayload, type UserRead } from '@naru/shared';
import { auth } from '../middleware/auth.js';
import * as reportService from '../services/report.service.js';

type Variables = {
  user: UserRead;
  tokenPayload: TokenPayload;
};

const app = new Hono<{ Variables: Variables }>();

const SlugParamSchema = z.object({ slug: z.string() });

/**
 * GET /reports
 * The index, including the deferred reports marked unavailable.
 */
app.get('/', auth, (c) => c.json(reportService.listReports()));

/**
 * GET /reports/:slug/export
 * Registered before /:slug so the literal segment wins.
 */
app.get(
  '/:slug/export',
  auth,
  zValidator('param', SlugParamSchema),
  zValidator('query', ReportQuerySchema),
  async (c) => {
    const { slug } = c.req.valid('param');
    const report = await reportService.runReport(slug, c.req.valid('query'));

    return c.body(reportService.toCsv(report), 200, {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${reportService.csvFilename(slug)}"`,
    });
  }
);

/**
 * GET /reports/:slug
 */
app.get(
  '/:slug',
  auth,
  zValidator('param', SlugParamSchema),
  zValidator('query', ReportQuerySchema),
  async (c) => {
    const { slug } = c.req.valid('param');
    return c.json(await reportService.runReport(slug, c.req.valid('query')));
  }
);

export default app;
