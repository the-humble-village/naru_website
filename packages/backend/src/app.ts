import { OpenAPIHono } from '@hono/zod-openapi';
import { swaggerUI } from '@hono/swagger-ui';
import { cors } from 'hono/cors';
import { secureHeaders } from 'hono/secure-headers';
import { HTTPException } from 'hono/http-exception';
import { ZodError } from 'zod';

// Route imports
import authRoutes from './routes/auth.js';
import adminRoutes from './routes/admin.js';
import birthingAssistantsRoutes from './routes/birthing-assistants.js';
import childVisitsRoutes from './routes/child-visits.js';
import childrenRoutes from './routes/children.js';
import dashboardRoutes from './routes/dashboard.js';
import familiesRoutes from './routes/families.js';
import familyVisitsRoutes from './routes/family-visits.js';
import filesRoutes from './routes/files.js';
import healthRoutes from './routes/health.js';
import parentsRoutes from './routes/parents.js';
import searchRoutes from './routes/search.js';
import syncRoutes from './routes/sync.js';
import parentVisitsRoutes from './routes/parent-visits.js';
import usersRoutes from './routes/users.js';
import questionSetsRoutes from './routes/question-sets.js';
import sitesRoutes from './routes/sites.js';

// Initialize Hono app with OpenAPI support
const app = new OpenAPIHono();

// CORS middleware.
// Production is same-origin — nginx proxies /api/ to this process and serves the
// SPA from the same server_name, and the web client uses a relative baseURL — so
// the allowlist is empty there and no Access-Control-Allow-Origin is emitted.
// CORS_ORIGINS (comma-separated) overrides this if a separate origin ever appears.
const corsOrigins = (
  process.env.CORS_ORIGINS ??
  (process.env.NODE_ENV === 'production' ? '' : 'http://localhost:5173')
).split(',').map(o => o.trim()).filter(Boolean);

app.use('*', cors({
  origin: corsOrigins,
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
}));

// Security headers.
//
// strictTransportSecurity MUST stay false. The middleware defaults it on
// (max-age=15552000; includeSubDomains), but nginx serves a self-signed cert on
// :443 (nginx/naru.conf). HSTS makes cert warnings non-bypassable, so emitting it
// would lock every browser out for 180 days — and because the state lives client
// side, removing the header later would not undo it. Turn this on in the same
// change that installs a real certificate, starting with a short max-age.
app.use('*', secureHeaders({
  strictTransportSecurity: false,
  contentSecurityPolicy: { defaultSrc: ["'none'"], frameAncestors: ["'none'"] },
  crossOriginResourcePolicy: 'same-origin',
  referrerPolicy: 'no-referrer',
  xFrameOptions: 'DENY',
}));

// Global error handler
app.onError((err, c) => {
  // Handle Zod validation errors (from @hono/zod-validator or @hono/zod-openapi)
  if (err instanceof ZodError) {
    return c.json({
      error: 'Validation failed',
      details: err.errors.map(e => ({
        path: e.path.join('.'),
        message: e.message,
      })),
    }, 400);
  }

  // Handle HTTP exceptions. These are expected and client-caused — a rejected
  // token or a missing record is not worth a stack trace in the journal.
  if (err instanceof HTTPException) {
    if (err.status >= 500) {
      console.error(`HTTP ${err.status} on ${c.req.method} ${c.req.path}: ${err.message}`);
    }
    return c.json({
      error: err.message,
    }, err.status);
  }

  // Genuinely unexpected — keep the full stack.
  console.error(`Unhandled error on ${c.req.method} ${c.req.path}: ${err.message}`);
  console.error(err.stack);
  return c.json({
    error: 'Internal server error',
  }, 500);
});

// Mount route modules under /api prefix
app.route('/api/auth', authRoutes);
app.route('/api/admin', adminRoutes);
app.route('/api/birthing-assistants', birthingAssistantsRoutes);
app.route('/api/dashboard', dashboardRoutes);
app.route('/api/families', familiesRoutes);
app.route('/api/files', filesRoutes);
app.route('/api/health', healthRoutes);
app.route('/api/search', searchRoutes);
app.route('/api/question-sets', questionSetsRoutes);
app.route('/api/sites', sitesRoutes);
app.route('/api/sync', syncRoutes);
app.route('/api/users', usersRoutes);

// Mount nested child routes through families
app.route('/api/families/:familyId/parents/:pid/visits', parentVisitsRoutes);
app.route('/api/families/:familyId/children', childrenRoutes);
app.route('/api/families/:familyId/parents', parentsRoutes);
app.route('/api/families/:fid/children/:cid/visits', childVisitsRoutes);
app.route('/api/families/:familyId/visits', familyVisitsRoutes);

// Health check endpoint (simple version, non-OpenAPI)
app.get('/health', (c) => {
  return c.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API docs, non-production only. Both endpoints are unauthenticated, and the
// restrictive CSP above would break Swagger UI's inline assets anyway.
if (process.env.NODE_ENV !== 'production') {
  // OpenAPI Documentation JSON
  app.doc('/api/doc', {
    openapi: '3.0.0',
    info: {
      version: '1.0.0',
      title: 'Naru Backend API',
      description: 'API documentation for the Naru Website backend',
    },
  });

  // Swagger UI
  app.get('/api/ui', swaggerUI({ url: '/api/doc' }));
}

export default app;