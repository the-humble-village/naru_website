/**
 * Guards against the test suite destroying a real database.
 *
 * tests/setup.ts TRUNCATEs every table in `public` before each test. That is only ever
 * safe against a throwaway database, so both the resolver and the assertion below insist
 * on a database whose name ends in "_test".
 *
 * This exists because .env (loaded by src/config.ts via dotenv, on import) points at the
 * DEVELOPMENT database — without an explicit override it silently became the TRUNCATE target.
 */

import { userInfo } from 'os'

// Prisma requires an explicit user (it does not fall back to the OS user the way libpq
// does), so default to the OS account — that matches a stock `brew install postgresql`
// setup, where the superuser role is named after you. CI supplies its own *_test URL.
const localUser = (): string => {
  try {
    return userInfo().username
  } catch {
    return 'postgres'
  }
}

export const DEFAULT_TEST_DATABASE_URL =
  `postgresql://${encodeURIComponent(localUser())}@127.0.0.1:5432/naru_test`

export const databaseNameFromUrl = (url: string): string => {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    throw new Error(`Refusing to run tests: "${url}" is not a valid database URL.`)
  }
  return decodeURIComponent(parsed.pathname.replace(/^\//, ''))
}

export const isTestDatabaseUrl = (url: string): boolean =>
  databaseNameFromUrl(url).endsWith('_test')

export const assertTestDatabaseUrl = (url: string | undefined, source: string): string => {
  if (!url) {
    throw new Error(`Refusing to run tests: no DATABASE_URL was set (expected one from ${source}).`)
  }

  if (!isTestDatabaseUrl(url)) {
    throw new Error(
      `Refusing to run tests against database "${databaseNameFromUrl(url)}" (from ${source}).\n` +
      `The suite TRUNCATEs every table before each test, so it only runs against a database\n` +
      `whose name ends in "_test". Set TEST_DATABASE_URL to point at one, or unset it to use\n` +
      `the default (${DEFAULT_TEST_DATABASE_URL}).`
    )
  }

  return url
}

/**
 * Picks the URL the suite runs against. Called from vitest.config.ts so the value lands in
 * process.env before any module — including dotenv — gets a chance to set DATABASE_URL.
 *
 * An inherited DATABASE_URL is honoured only when it already names a *_test database (this
 * is how CI passes its service-container URL); otherwise it is ignored rather than obeyed,
 * because in local runs it is almost certainly the development database leaking in.
 */
export const resolveTestDatabaseUrl = (env: NodeJS.ProcessEnv = process.env): string => {
  if (env.TEST_DATABASE_URL) {
    return assertTestDatabaseUrl(env.TEST_DATABASE_URL, 'TEST_DATABASE_URL')
  }

  if (env.DATABASE_URL && isTestDatabaseUrl(env.DATABASE_URL)) {
    return env.DATABASE_URL
  }

  return DEFAULT_TEST_DATABASE_URL
}
