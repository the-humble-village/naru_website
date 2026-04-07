#!/usr/bin/env node

// Script to set up the test database
const DEFAULT_DB_URL = 'postgresql://postgres@localhost:5432/naru_test';
process.env.DATABASE_URL = process.env.DATABASE_URL || DEFAULT_DB_URL;

const { execSync } = require('child_process');

try {
  console.log('🔄 Setting up test database...');
  console.log(`🔗 Using database: ${process.env.DATABASE_URL.replace(/:[^:@]+@/, ':****@')}`);
  console.log('🔄 Running migrations on test database...');

  execSync('npx prisma migrate deploy --schema=prisma/schema.prisma', {
    stdio: 'inherit',
    env: {
      ...process.env,
      DATABASE_URL: process.env.DATABASE_URL
    }
  });

  console.log('✅ Test database set up successfully!');
} catch (error) {
  console.error('❌ Failed to set up test database:', error.message);
  process.exit(1);
}