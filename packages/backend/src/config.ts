import { config } from 'dotenv';

// Load environment variables from .env file if not in test environment
// Test files set environment variables directly
if (process.env.NODE_ENV !== 'test') {
  config();
}

interface Config {
  DATABASE_URL: string;
  JWT_SECRET: string;
  JWT_REFRESH_SECRET: string;
  PORT: number;
}

function getRequiredEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

function getOptionalEnv(key: string, defaultValue: string): string {
  return process.env[key] || defaultValue;
}

// Create config getter that reads environment variables at access time
// This ensures test environment variables are properly picked up
export const appConfig: Config = {
  get DATABASE_URL(): string {
    return getRequiredEnv('DATABASE_URL');
  },
  get JWT_SECRET(): string {
    return getRequiredEnv('JWT_SECRET');
  },
  get JWT_REFRESH_SECRET(): string {
    return getRequiredEnv('JWT_REFRESH_SECRET');
  },
  get PORT(): number {
    return parseInt(getOptionalEnv('PORT', '3000'), 10);
  },
};