import { beforeAll, afterAll, beforeEach } from 'vitest'
import { PrismaClient } from '@prisma/client'
import jwt from 'jsonwebtoken'
import { prisma as testDb } from '../src/db'

// Export it so tests can use it
export { testDb }

// Override environment for tests BEFORE anything else reads process.env.
// Do NOT import dotenv — the .env file points at the production database.
process.env.NODE_ENV = 'test'
process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://postgres@127.0.0.1:5432/naru_test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-for-testing-only'
process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'test-jwt-refresh-secret-for-testing-only'

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

  // Check if tables exist and provide helpful error message
  try {
    await testDb.user.count()
  } catch (error: any) {
    if (error.code === 'P2021' || error.message.includes('does not exist')) {
      console.error('❌ Test database tables do not exist.')
      console.error('Please set up the test database by running:')
      console.error('DATABASE_URL="postgresql://postgres@127.0.0.1:5432/naru_test" npx prisma migrate deploy')
      throw new Error('Test database tables do not exist. Run migrations first.')
    }
    throw error
  }
})

afterAll(async () => {
  // Cleanup and disconnect
  await testDb.$disconnect()
})

beforeEach(async () => {
  // Clean up database before each test
  // We'll start with the child tables first, then work up to avoid foreign key issues
  await testDb.childVisit.deleteMany()
  await testDb.familyVisit.deleteMany()
  await testDb.child.deleteMany()
  await testDb.parent.deleteMany()
  await testDb.family.deleteMany()
  await testDb.birthingAssistantTraining.deleteMany()
  await testDb.birthingAssistantCommunity.deleteMany()
  await testDb.birthingAssistant.deleteMany()
  await testDb.user.deleteMany()

  // Clean up lookup tables
  await testDb.childVisitQuestion.deleteMany()
  await testDb.parentVisitQuestion.deleteMany()
  await testDb.familyVisitQuestion.deleteMany()
  await testDb.resource.deleteMany()
  await testDb.training.deleteMany()
  await testDb.site.deleteMany()
  await testDb.community.deleteMany()

  // Files are not soft-deleted, so we'll clean them too
  await testDb.file.deleteMany()
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
      weight: 15000, // 15kg in grams
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
      weight: 16000, // 16kg in grams
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

// Cleanup function
export const cleanupDatabase = async () => {
  // Clean up database before each test
  // We'll start with the child tables first, then work up to avoid foreign key issues
  await testDb.childVisit.deleteMany()
  await testDb.familyVisit.deleteMany()
  await testDb.child.deleteMany()
  await testDb.parent.deleteMany()
  await testDb.family.deleteMany()
  await testDb.birthingAssistantTraining.deleteMany()
  await testDb.birthingAssistantCommunity.deleteMany()
  await testDb.birthingAssistant.deleteMany()
  await testDb.user.deleteMany()

  // Clean up lookup tables
  await testDb.childVisitQuestion.deleteMany()
  await testDb.parentVisitQuestion.deleteMany()
  await testDb.familyVisitQuestion.deleteMany()
  await testDb.resource.deleteMany()
  await testDb.training.deleteMany()
  await testDb.site.deleteMany()
  await testDb.community.deleteMany()

  // Files are not soft-deleted, so we'll clean them too
  await testDb.file.deleteMany()
}
