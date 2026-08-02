import { serve } from '@hono/node-server';
import app from './app.js';
import { appConfig } from './config.js';
import { getPrisma } from './db.js';

const port = appConfig.PORT;

/**
 * Touch the config the selected storage driver needs so a misconfigured server
 * dies at boot rather than 500-ing on the first photo request — the latter
 * sails past deployment health checks and only surfaces in front of a user.
 */
function validateStorageConfig() {
  if (appConfig.STORAGE_DRIVER !== 's3') return;
  void appConfig.AWS_S3_BUCKET;
  void appConfig.AWS_S3_REGION;
}

async function startServer() {
  try {
    validateStorageConfig();
  } catch (error) {
    console.error('Invalid storage configuration:', error);
    process.exit(1);
  }

  console.log(`Initializing database connection...`);
  try {
    await getPrisma();
    console.log('Database initialized successfully.');
  } catch (error) {
    console.error('Failed to initialize database:', error);
    process.exit(1);
  }

  console.log(`Starting Hono server on port ${port}...`);

  serve({
    fetch: app.fetch,
    port,
  }, () => {
    console.log(`Server running at http://localhost:${port}`);
  });
}

startServer();
