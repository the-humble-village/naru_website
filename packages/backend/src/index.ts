import { serve } from '@hono/node-server';
import app from './app';
import { appConfig } from './config';
import { getPrisma } from './db';

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
