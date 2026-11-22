import { describe, it, expect, afterEach } from 'vitest';
import { validateAuthConfig } from '../src/config-validation';

// appConfig reads process.env at access time, so these mutate the environment and
// restore it rather than mocking the module.

const ORIGINAL_SECRET = process.env.JWT_SECRET;
const ORIGINAL_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET;

afterEach(() => {
  process.env.JWT_SECRET = ORIGINAL_SECRET;
  process.env.JWT_REFRESH_SECRET = ORIGINAL_REFRESH_SECRET;
});

describe('validateAuthConfig', () => {
  // The one that earns its keep: if anyone shortens a literal in .env.test,
  // tests/setup.ts or pipeline.yml below the floor, this fails instead of the
  // whole suite dying at boot in CI with no explanation.
  it('accepts the secrets this test suite runs with', () => {
    expect(() => validateAuthConfig()).not.toThrow();
  });

  it('rejects a secret shorter than 32 characters', () => {
    process.env.JWT_SECRET = 'too-short';

    expect(() => validateAuthConfig()).toThrow(/JWT_SECRET is 9 characters/);
  });

  it('rejects a short refresh secret too', () => {
    process.env.JWT_REFRESH_SECRET = 'also-too-short';

    expect(() => validateAuthConfig()).toThrow(/JWT_REFRESH_SECRET is 14 characters/);
  });

  it('accepts a secret of exactly 32 characters', () => {
    process.env.JWT_SECRET = 'a'.repeat(32);

    expect(() => validateAuthConfig()).not.toThrow();
  });

  it('rejects 31 characters', () => {
    process.env.JWT_SECRET = 'a'.repeat(31);

    expect(() => validateAuthConfig()).toThrow(/at least 32 are required/);
  });

  // Sharing one secret makes a 30-day refresh token verify as a 1-hour access
  // token, silently erasing the shorter lifetime.
  it('rejects identical secrets', () => {
    process.env.JWT_SECRET = 'b'.repeat(40);
    process.env.JWT_REFRESH_SECRET = 'b'.repeat(40);

    expect(() => validateAuthConfig()).toThrow(/must be different values/);
  });

  it('rejects a missing secret', () => {
    delete process.env.JWT_SECRET;

    expect(() => validateAuthConfig()).toThrow(/Missing required environment variable: JWT_SECRET/);
  });

  // The message is written to the journal, so it may name the variable and its
  // length but never its contents.
  it('never puts the secret value in the error message', () => {
    process.env.JWT_SECRET = 'hunter2';

    expect(() => validateAuthConfig()).toThrow();
    try {
      validateAuthConfig();
    } catch (error) {
      expect((error as Error).message).not.toContain('hunter2');
    }
  });
});
