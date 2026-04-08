import { PrismaClient } from '@prisma/client';
import { Signer } from '@aws-sdk/rds-signer';
import { applySoftDeleteMiddleware } from './middleware/soft-delete';
import { appConfig } from './config';

// Global Prisma client singleton instance
export let prisma: PrismaClient;

declare global {
  // Allow global `var` declarations
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined;
}

/**
 * Generates an RDS IAM Auth Token
 * Equivalent to boto3's generate_db_auth_token
 */
async function getRDSToken() {
  const hostname = process.env.RDS_HOSTNAME || 'naru-website-cluster.cluster-cspumw4c8drx.us-east-1.rds.amazonaws.com';
  const port = parseInt(process.env.RDS_PORT || '5432');
  const username = process.env.RDS_USERNAME || 'postgres';

  const signer = new Signer({
    region: process.env.AWS_REGION || 'us-east-1',
    hostname,
    port,
    username,
  });
  return signer.getAuthToken();
}

// Create client with explicit datasource for tests
const createPrismaClient = (databaseUrl?: string) => {
  const options: any = {};

  if (databaseUrl) {
    options.datasources = {
      db: { url: databaseUrl }
    };
  } else if (process.env.NODE_ENV === 'test') {
    options.datasources = {
      db: { url: process.env.DATABASE_URL || 'postgresql://postgres@localhost:5432/naru_test' }
    };
  }

  return new PrismaClient(options);
};

async function initializePrisma() {
  if (prisma) return prisma;

  let url = process.env.DATABASE_URL;

  // Handle RDS IAM Authentication
  if (process.env.USE_RDS_IAM === 'true' && process.env.NODE_ENV === 'production') {
    const token = await getRDSToken();
    // Encode token because it contains special characters
    const encodedToken = encodeURIComponent(token);

    const hostname = process.env.RDS_HOSTNAME || 'naru-website-cluster.cluster-cspumw4c8drx.us-east-1.rds.amazonaws.com';
    const port = process.env.RDS_PORT || '5432';
    const dbName = process.env.RDS_DB_NAME || 'postgres';
    const username = process.env.RDS_USERNAME || 'postgres';
    const sslMode = process.env.RDS_SSL_MODE || 'verify-full';
    const sslCert = process.env.RDS_SSL_CERT_PATH || '/etc/ssl/certs/ca-certificates.crt';

    url = `postgresql://${username}:${encodedToken}@${hostname}:${port}/${dbName}?sslmode=${sslMode}&sslrootcert=${sslCert}`;
  }

  // If no URL is set and not in production IAM mode, we should at least check appConfig
  if (!url) {
    try {
      url = appConfig.DATABASE_URL;
    } catch (e) {
      // appConfig.DATABASE_URL throws if missing. If we're here, Prisma will
      // try to read DATABASE_URL on its own, which will likely fail later.
    }
  }

  const client = createPrismaClient(url);
  applySoftDeleteMiddleware(client);

  if (process.env.NODE_ENV !== 'production') {
    globalThis.__prisma = client;
  }

  prisma = client;
  return client;
}

// Export a promise-based getter since token generation is async
export const getPrisma = initializePrisma;

// Also provide a default export for backward compatibility
export default prisma;