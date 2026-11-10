import { describe, it, expect, beforeEach } from 'vitest';
import jwt from 'jsonwebtoken';
import app from '../src/app';
import { createTestUser, testDb } from './setup';
import { appConfig } from '../src/config';

// Exercises the real app so the global onError, the security headers and the auth
// middleware are all in the path — these behaviours only compose correctly together.

const get = (path: string, token?: string) =>
  app.request(
    new Request(`http://localhost${path}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
  );

describe('auth middleware', () => {
  let userId: number;

  beforeEach(async () => {
    const user = await createTestUser({ login: 'authmw', email: 'authmw@example.com' });
    userId = user.id;
  });

  it('accepts a valid token', async () => {
    const token = jwt.sign({ userId, role: 'CASEWORKER', lang: 'en' }, appConfig.JWT_SECRET, {
      expiresIn: '15m',
    });

    const response = await get('/api/users/me', token);

    expect(response.status).toBe(200);
    expect((await response.json()).login).toBe('authmw');
  });

  it('rejects a missing Authorization header with 401', async () => {
    expect((await get('/api/users/me')).status).toBe(401);
  });

  it('rejects a malformed token with 401', async () => {
    expect((await get('/api/users/me', 'not-a-jwt')).status).toBe(401);
  });

  // Regression: TokenPayloadSchema.parse used to throw ZodError past the catch,
  // surfacing as a 500 — a validly signed token should never produce a server error.
  it('rejects a validly signed token with a malformed payload with 401, not 500', async () => {
    const token = jwt.sign({ userId: 'not-a-number' }, appConfig.JWT_SECRET, {
      expiresIn: '15m',
    });

    const response = await get('/api/users/me', token);

    expect(response.status).toBe(401);
    expect((await response.json()).error).toBe('Invalid token');
  });

  // Regression: TokenExpiredError extends JsonWebTokenError, so ordering the checks
  // the other way round made this branch unreachable and reported "Invalid token".
  it('reports an expired token as expired', async () => {
    const token = jwt.sign({ userId, role: 'CASEWORKER', lang: 'en' }, appConfig.JWT_SECRET, {
      expiresIn: '-1s',
    });

    const response = await get('/api/users/me', token);

    expect(response.status).toBe(401);
    expect((await response.json()).error).toBe('Token expired');
  });

  it('rejects a token signed with the refresh secret', async () => {
    const token = jwt.sign(
      { userId, role: 'CASEWORKER', lang: 'en' },
      appConfig.JWT_REFRESH_SECRET,
      { expiresIn: '15m' }
    );

    expect((await get('/api/users/me', token)).status).toBe(401);
  });

  it('rejects an unsigned (alg: none) token', async () => {
    const unsigned = `${Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString(
      'base64url'
    )}.${Buffer.from(JSON.stringify({ userId, role: 'ADMIN', lang: 'en' })).toString(
      'base64url'
    )}.`;

    expect((await get('/api/users/me', unsigned)).status).toBe(401);
  });
});

describe('token revocation (tokenVersion)', () => {
  let userId: number;

  const sign = (claims: Record<string, unknown>) =>
    jwt.sign({ userId, role: 'CASEWORKER', lang: 'en', ...claims }, appConfig.JWT_SECRET, {
      expiresIn: '15m',
    });

  beforeEach(async () => {
    const user = await createTestUser({ login: 'revoke', email: 'revoke@example.com' });
    userId = user.id;
  });

  it('accepts a token whose version matches the stored counter', async () => {
    await testDb.user.update({ where: { id: userId }, data: { tokenVersion: 3 } });

    expect((await get('/api/users/me', sign({ tokenVersion: 3 }))).status).toBe(200);
  });

  it('rejects a token minted before the counter was bumped', async () => {
    const token = sign({ tokenVersion: 0 });
    await testDb.user.update({ where: { id: userId }, data: { tokenVersion: { increment: 1 } } });

    const response = await get('/api/users/me', token);

    expect(response.status).toBe(401);
    expect((await response.json()).error).toBe('Session expired. Please sign in again.');
  });

  // The claim is optional so the tokens hand-signed across this suite — and any
  // token issued before the column existed — keep working while the counter is 0.
  it('treats an absent tokenVersion claim as 0', async () => {
    expect((await get('/api/users/me', sign({}))).status).toBe(200);
  });

  it('rejects an absent tokenVersion claim once the counter has moved', async () => {
    const token = sign({});
    await testDb.user.update({ where: { id: userId }, data: { tokenVersion: 1 } });

    expect((await get('/api/users/me', token)).status).toBe(401);
  });

  // GET /users/me returns c.var.user verbatim, so a missed destructure would ship
  // the internal counter to every client.
  it('does not expose tokenVersion on GET /users/me', async () => {
    const response = await get('/api/users/me', sign({}));

    expect(Object.keys(await response.json())).not.toContain('tokenVersion');
  });
});

describe('security headers', () => {
  it('sets restrictive headers on API responses', async () => {
    const response = await get('/health');

    expect(response.headers.get('x-frame-options')).toBe('DENY');
    expect(response.headers.get('x-content-type-options')).toBe('nosniff');
    expect(response.headers.get('referrer-policy')).toBe('no-referrer');
    expect(response.headers.get('cross-origin-resource-policy')).toBe('same-origin');
  });

  // nginx serves a self-signed cert on :443. HSTS makes cert warnings
  // non-bypassable and is remembered client-side for its full max-age, so shipping
  // it would lock users out for 180 days with no server-side way to undo it.
  it('does NOT set HSTS while the production certificate is self-signed', async () => {
    const response = await get('/health');

    expect(response.headers.get('strict-transport-security')).toBeNull();
  });
});
