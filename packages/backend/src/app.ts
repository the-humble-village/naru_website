import { OpenAPIHono } from '@hono/zod-openapi';
import { swaggerUI } from '@hono/swagger-ui';
import { cors } from 'hono/cors';
import { HTTPException } from 'hono/http-exception';
import { ZodError } from 'zod';

// Route imports
import authRoutes from './routes/auth';
import adminRoutes from './routes/admin';
import birthingAssistantsRoutes from './routes/birthing-assistants';
import childVisitsRoutes from './routes/child-visits';
import childrenRoutes from './routes/children';
import dashboardRoutes from './routes/dashboard';
import familiesRoutes from './routes/families';
import familyVisitsRoutes from './routes/family-visits';
import filesRoutes from './routes/files';
import healthRoutes from './routes/health';
import parentsRoutes from './routes/parents';
import searchRoutes from './routes/search';
import syncRoutes from './routes/sync';
import seedRoutes from './routes/seed';
import usersRoutes from './routes/users';
import questionSetsRoutes from './routes/question-sets';
import sitesRoutes from './routes/sites';

// Initialize Hono app with OpenAPI support
const app = new OpenAPIHono();

// CORS middleware
app.use('*', cors({
  origin: ['http://localhost:5173'], // Vite dev server
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
}));

// Global error handler
app.onError((err, c) => {
  console.error(`Error: ${err.message}`);
  console.error(err.stack);

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

  // Handle HTTP exceptions
  if (err instanceof HTTPException) {
    return c.json({
      error: err.message,
    }, err.status);
  }

  // Handle unknown errors
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
app.route('/api/seed', seedRoutes);
app.route('/api/question-sets', questionSetsRoutes);
app.route('/api/sites', sitesRoutes);
app.route('/api/sync', syncRoutes);
app.route('/api/users', usersRoutes);

// Mount nested child routes through families
app.route('/api/families/:familyId/children', childrenRoutes);
app.route('/api/families/:familyId/parents', parentsRoutes);
app.route('/api/families/:fid/children/:cid/visits', childVisitsRoutes);
app.route('/api/families/:familyId/visits', familyVisitsRoutes);

// Health check endpoint (simple version, non-OpenAPI)
app.get('/health', (c) => {
  return c.json({ status: 'ok', timestamp: new Date().toISOString() });
});

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

export default app;