import { beforeAll, afterAll, beforeEach } from 'vitest'
import { assertTestDatabaseUrl } from './assert-test-database'

// NODE_ENV and DATABASE_URL are set in vitest.config.ts (`test.env`), which is applied
// before any module in this graph loads. Setting them here would be too late: ESM hoists
// the `../src/db` import below above all top-level statements, and src/config.ts calls
// dotenv on import — so .env (which points at the DEVELOPMENT database) would win.
//
// cleanupDatabase() TRUNCATEs every table before each test, so re-check here rather than
// trusting that config: a wrong value destroys real data.
assertTestDatabaseUrl(process.env.DATABASE_URL, 'the test environment')

// Assigned unconditionally, not `||`-defaulted. Vitest loads packages/backend/.env
// into process.env, so a `||` here hands the suite whatever secret the developer
// happens to have locally — different on every machine, and different again in CI.
// Same hazard as DATABASE_URL above, minus the data loss.
//
// validateAuthConfig() enforces a 32-character floor. The access secret below is
// exactly 32 — zero margin, so shortening it by even one character breaks
// tests/config-validation.test.ts. The same applies to .env.test and to
// pipeline.yml, which carry copies of these literals.
process.env.JWT_SECRET = 'test-jwt-secret-for-testing-only'
process.env.JWT_REFRESH_SECRET = 'test-jwt-refresh-secret-for-testing-only'

import { PrismaClient } from '@prisma/client'
import jwt from 'jsonwebtoken'
import { prisma as testDb } from '../src/db'
import { resetAllRateLimits } from '../src/middleware/rate-limit'

// Export it so tests can use it
export { testDb }

// Setup hooks
beforeAll(async () => {
  // Connect to test database
  try {
    await testDb.$connect()
  } catch (error: any) {
    console.error('❌ Failed to connect to the test database.')
    console.error('DATABASE_URL:', process.env.DATABASE_URL?.replace(/:([^@]+)@/, ':****@')) // Mask password
    console.error('Error:', error.message)
    console.error('\nPossible solutions:')
    console.error('1. Make sure PostgreSQL is running.')
    console.error('2. Check if the database "naru_test" exists (run: createdb naru_test).')
    console.error('3. Verify your DATABASE_URL in .env.test or environment variables.')
    throw error
  }

  // Check the schema is current and provide a helpful error message.
  // P2021 = table missing (never migrated), P2022 = column missing (stale schema,
  // i.e. a migration landed on main that this database has not caught up with).
  try {
    await testDb.user.count()
  } catch (error: any) {
    if (error.code === 'P2021' || error.code === 'P2022' || error.message.includes('does not exist')) {
      const detail = error.code === 'P2022'
        ? 'Test database schema is out of date (a column is missing).'
        : 'Test database tables do not exist.'
      console.error(`❌ ${detail}`)
      console.error('Bring it up to date by running, from packages/backend:')
      console.error(`DATABASE_URL="${process.env.DATABASE_URL}" npx prisma migrate deploy`)
      throw new Error(`${detail} Run migrations first.`)
    }
    throw error
  }
})

afterAll(async () => {
  // Cleanup
})

beforeEach(async () => {
  await cleanupDatabase()
  // vitest.config.ts runs everything in a single fork, so every test file shares
  // one instance of the limiter's Map. Without this, failed-login assertions
  // accumulate across the suite and eventually 429 for reasons unrelated to the
  // test that trips it.
  resetAllRateLimits()
})

// Helper functions for tests
export const createTestUser = async (overrides: any = {}) => {
  const email = overrides.email || 'test@example.com';
  const login = overrides.login || email.split('@')[0];
  return testDb.user.create({
    data: {
      login,
      email,
      firstName: 'Test',
      lastName: 'User',
      passwordHash: '$2b$12$test.hash.here',
      role: 'CASEWORKER',
      lang: 'en',
      ...overrides
    }
  })
}

export const createTestFamily = async (familyNameOrOverrides: string | any = {}) => {
  // Handle both string and object forms
  const overrides = typeof familyNameOrOverrides === 'string'
    ? { familyName: familyNameOrOverrides }
    : familyNameOrOverrides;

  return testDb.family.create({
    data: {
      familyName: 'Test Family',
      inCrisis: false,
      notes: 'Test notes',
      ...overrides
    }
  })
}

export const createTestCommunity = async (overrides: any = {}) => {
  return testDb.community.create({
    data: {
      title: 'Test Community',
      ...overrides
    }
  })
}

export const createTestMother = async (overrides: any = {}) => {
  return testDb.mother.create({
    data: {
      name: 'Test Mother',
      notes: 'Test mother notes',
      ...overrides
    }
  })
}

export const createTestPerson = async (overrides: any = {}) => {
  return testDb.person.create({
    data: {
      name: 'Test Person',
      ...overrides
    }
  })
}

// familyId is deliberately optional: a child must be creatable with no family
// and no mother.
export const createTestChild = async (overrides: any = {}) => {
  return testDb.child.create({
    data: {
      name: 'Test Child',
      birthDate: new Date('2020-01-15'),
      sex: 'MALE',
      notes: 'Test child notes',
      ...overrides
    }
  })
}

// cleanupDatabase() truncates `programs` too, so each test creates the program
// rows it needs rather than relying on the migration seed.
export const createTestProgram = async (overrides: any = {}) => {
  return testDb.program.create({
    data: {
      name: 'Test Nutrition Program',
      kind: 'NUTRITION',
      subjectType: 'CHILD',
      ...overrides
    }
  })
}

export const createTestEnrollment = async (programId: number, subject: any, overrides: any = {}) => {
  return testDb.enrollment.create({
    data: {
      programId,
      enrolledAt: new Date('2026-01-15'),
      ...subject,
      ...overrides
    }
  })
}

export const createTestVisit = async (enrollmentId: number, overrides: any = {}) => {
  return testDb.visit.create({
    data: {
      enrollmentId,
      visitDate: new Date('2026-02-15'),
      locationType: 'SITE',
      notes: 'Test visit notes',
      ...overrides
    }
  })
}

// Add missing helper functions needed by birthing assistants test
export const setupTestUser = async (login: string, email: string, role: 'ADMIN' | 'SUPERVISOR' | 'CASEWORKER' = 'CASEWORKER') => {
  return createTestUser({
    login,
    email,
    role,
  });
};

// Generate JWT tokens for testing
export const generateTokens = (user: { id: number; role: string; lang?: string }) => {
  const accessToken = jwt.sign(
    { userId: user.id, role: user.role, lang: user.lang || 'en' },
    process.env.JWT_SECRET!,
    { expiresIn: '15m' }
  );
  const refreshToken = jwt.sign(
    { userId: user.id, role: user.role, lang: user.lang || 'en' },
    process.env.JWT_REFRESH_SECRET!,
    { expiresIn: '30d' }
  );
  return { accessToken, refreshToken };
};

export const createTestTraining = async (title: string) => {
  return testDb.training.create({
    data: {
      title,
    }
  });
};

// Verify the *actual* connection, not just the URL we asked for — src/db.ts
// resolves its datasource independently, so this is the last line of defence
// before the TRUNCATE. Checked once, then cached.
let verifiedDatabase: string | null = null

const assertConnectedToTestDatabase = async () => {
  if (verifiedDatabase) return

  const [{ current_database: name }] = await testDb.$queryRaw<
    Array<{ current_database: string }>
  >`SELECT current_database();`

  if (!name.endsWith('_test')) {
    throw new Error(
      `Refusing to TRUNCATE: connected to database "${name}", which is not a *_test database.\n` +
      `Aborting before any data is destroyed.`
    )
  }

  verifiedDatabase = name
}

// Cleanup function
export const cleanupDatabase = async () => {
  // Clean up database before each test
  // Use a systematic TRUNCATE approach to handle all tables and foreign keys
  await assertConnectedToTestDatabase()

  try {
    const tableNames = await testDb.$queryRaw<
      Array<{ tablename: string }>
    >`SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename NOT LIKE '_prisma_migrations%';`;

    if (tableNames.length > 0) {
      const tables = tableNames
        .map(({ tablename }) => `"${tablename}"`)
        .join(', ');
      
      await testDb.$executeRawUnsafe(`TRUNCATE TABLE ${tables} CASCADE;`);
    }
  } catch (error) {
    console.error('❌ Database cleanup failed:', error);
    throw error;
  }
}
