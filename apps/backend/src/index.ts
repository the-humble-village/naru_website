import { serve } from '@hono/node-server';
import app from './app.js';
import { appConfig } from './config.js';
import { validateAuthConfig, validateStorageConfig } from './config-validation.js';
import { getPrisma } from './db.js';

const port = appConfig.PORT;

async function startServer() {
  try {
    validateAuthConfig();
    validateStorageConfig();
  } catch (error) {
    // Print the message, not the Error — a deploy health check dumps this via
    // `journalctl`, where a stack trace buries the one line that matters.
    console.error(
      `Invalid configuration: ${error instanceof Error ? error.message : String(error)}`
    );
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
