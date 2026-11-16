import { PrismaClient } from '@prisma/client';
import { Signer } from '@aws-sdk/rds-signer';
import { softDeleteExtension } from './middleware/soft-delete.js';
import { appConfig } from './config.js';

// Create base client with explicit datasource for tests
function createBasePrismaClient(databaseUrl?: string) {
  const options: any = {};

  if (databaseUrl) {
    options.datasources = {
      db: { url: databaseUrl }
    };
  } else if (process.env.NODE_ENV === 'test') {
    options.datasources = {
      db: { url: process.env.DATABASE_URL || 'postgresql://postgres:postgres@127.0.0.1:5432/naru_test' }
    };
  }

  return new PrismaClient(options);
}

// Global Prisma client singleton instance
// We use 'any' here because the extended client type is complex, but it still behaves like PrismaClient
export let prisma: any = globalThis.__prisma || createBasePrismaClient().$extends(softDeleteExtension);

// Ensure globalThis.__prisma is set for non-production environments
if (process.env.NODE_ENV !== 'production' && !globalThis.__prisma) {
  globalThis.__prisma = prisma;
}

declare global {
  // Allow global `var` declarations
  // eslint-disable-next-line no-var
  var __prisma: any | undefined;
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

// Create client with extension
function createPrismaClient(databaseUrl?: string) {
  return createBasePrismaClient(databaseUrl).$extends(softDeleteExtension);
}

async function initializePrisma() {
  // If prisma is already initialized and not just a default one, we might still want to re-initialize 
  // if we need RDS IAM tokens in production.
  
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
    
    // In this case, we definitely want a new client with the fresh token
    prisma = createPrismaClient(url);
  } else if (!prisma || prisma === globalThis.__prisma) {
    // If not production IAM, and we don't have a specific client yet (other than maybe the global one)
    if (!url) {
        try {
          url = appConfig.DATABASE_URL;
        } catch (e) {
          // ignore
        }
    }
    
    if (url) {
        prisma = createPrismaClient(url);
    }
  }

  if (process.env.NODE_ENV !== 'production' && !globalThis.__prisma) {
    globalThis.__prisma = prisma;
  }

  return prisma;
}

// Export a promise-based getter since token generation is async
export const getPrisma = initializePrisma;

// Also provide a default export for backward compatibility
export { prisma as default };