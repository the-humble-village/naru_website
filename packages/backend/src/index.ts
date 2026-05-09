import { serve } from '@hono/node-server';
import app from './app.js';
import { appConfig } from './config.js';
import { getPrisma } from './db.js';

const port = appConfig.PORT;

async function startServer() {
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
