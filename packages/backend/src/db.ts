import { PrismaClient } from '@prisma/client';
import { RDS } from '@aws-sdk/client-rds';
import { applySoftDeleteMiddleware } from './middleware/soft-delete';

// Global Prisma client singleton instance
let prisma: PrismaClient;

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
  const rds = new RDS({ region: process.env.AWS_REGION || 'us-east-1' });
  return rds.signer.getAuthToken({
    hostname: 'naru-website-cluster.cluster-cspumw4c8drx.us-east-1.rds.amazonaws.com',
    port: 5432,
    username: 'postgres',
  });
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
      db: { url: process.env.DATABASE_URL || 'postgresql://calebr@127.0.0.1:5432/naru_test' }
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
    url = `postgresql://postgres:${encodedToken}@naru-website-cluster.cluster-cspumw4c8drx.us-east-1.rds.amazonaws.com:5432/postgres?sslmode=verify-full&sslrootcert=/etc/ssl/certs/ca-certificates.crt`;
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

// For backward compatibility with existing synchronous imports, 
// we'll keep the default export but it might be uninitialized 
// if not awaited elsewhere. 
// NOTE: It is recommended to use getPrisma() in your entrypoint (index.ts).
export default prisma;