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

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-for-testing-only'
process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'test-jwt-refresh-secret-for-testing-only'

import { PrismaClient } from '@prisma/client'
import jwt from 'jsonwebtoken'
import { prisma as testDb } from '../src/db'

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
      childrenEditable: 1,
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

export const createTestParent = async (familyId: number, name: string = 'Test Parent', role: string = 'mother', overrides: any = {}) => {
  return testDb.parent.create({
    data: {
      familyId,
      name,
      role,
      notes: 'Test parent notes',
      ...overrides
    }
  })
}

export const createTestChild = async (familyId: number, name: string = 'Test Child', overrides: any = {}) => {
  return testDb.child.create({
    data: {
      familyId,
      name,
      birthDate: new Date('2020-01-15'), // Default to 4+ year old child
      sex: 'MALE',
      weight: 15, // kg
      observations: 'Test child observations',
      ...overrides
    }
  })
}

export const createTestChildVisit = async (familyId: number, childId: number, overrides: any = {}) => {
  return testDb.childVisit.create({
    data: {
      familyId,
      childId,
      visitDate: new Date('2024-01-15T10:00:00.000Z'),
      weight: 16, // kg
      armCircumference: 140, // 140mm
      height: 1000, // 1000mm (100cm)
      incap: false,
      leche: false,
      bagsGiven: null,
      recvAnyMedicine: null,
      leftFromProg: null,
      passedAway: null,
      questions: [],
      notes: 'Test visit notes',
      ...overrides
    }
  })
}

export const createTestFamilyVisit = async (familyId: number, overrides: any = {}) => {
  return testDb.familyVisit.create({
    data: {
      familyId,
      visitDate: new Date('2024-01-15T10:00:00.000Z'),
      trainingsReceived: [],
      resourcesReceived: [],
      questions: [],
      notes: 'Test family visit notes',
      ...overrides
    }
  })
}

export const createTestParentVisit = async (familyId: number, parentId: number, overrides: any = {}) => {
  return testDb.parentVisit.create({
    data: {
      familyId,
      parentId,
      visitDate: new Date('2024-01-15T10:00:00.000Z'),
      weight: 60, // kg
      trainingsReceived: [],
      resourcesReceived: [],
      questions: [],
      notes: 'Test parent visit notes',
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
