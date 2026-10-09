import { describe, it, expect, beforeEach } from 'vitest';
import bcrypt from 'bcrypt';
import app from '../src/app';
import { testDb } from './setup';

// Exercises the real app so app.ts's onError is in the path — a thrown 429 would
// lose its Retry-After header there, which is why the middleware returns one.

const login = (body: unknown, headers: Record<string, string> = {}) =>
  app.request(
    new Request('http://localhost/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify(body),
    })
  );

const FROM_IP = (ip: string) => ({ 'X-Real-IP': ip });

describe('login rate limiting', () => {
  beforeEach(async () => {
    await testDb.user.create({
      data: {
        login: 'ratelimited',
        passwordHash: await bcrypt.hash('correct-horse-battery', 10),
        role: 'CASEWORKER',
        lang: 'en',
      },
    });
  });

  it('allows five failures then blocks the sixth', async () => {
    const attempt = () =>
      login({ login: 'ratelimited', password: 'wrong' }, FROM_IP('203.0.113.1'));

    for (let i = 0; i < 5; i++) {
      expect((await attempt()).status).toBe(401);
    }

    const blocked = await attempt();
    expect(blocked.status).toBe(429);
  });

  // app.ts's onError rebuilds responses from err.status/err.message and discards
  // getResponse(), so a thrown HTTPException would arrive here with no header.
  it('sets Retry-After on the 429', async () => {
    for (let i = 0; i < 5; i++) {
      await login({ login: 'ratelimited', password: 'wrong' }, FROM_IP('203.0.113.2'));
    }

    const blocked = await login(
      { login: 'ratelimited', password: 'wrong' },
      FROM_IP('203.0.113.2')
    );

    expect(blocked.status).toBe(429);
    expect(Number(blocked.headers.get('Retry-After'))).toBeGreaterThan(0);
    expect((await blocked.json()).error).toMatch(/too many login attempts/i);
  });

  // login() throws HTTPException(401) instead of returning a response. A limiter
  // that only inspected c.res.status after next() would never charge the bucket.
  it('charges the bucket even though the service throws rather than returns', async () => {
    for (let i = 0; i < 5; i++) {
      await login({ login: 'ratelimited', password: 'wrong' }, FROM_IP('203.0.113.3'));
    }

    // The correct password must not get through — the identity is locked out.
    const blocked = await login(
      { login: 'ratelimited', password: 'correct-horse-battery' },
      FROM_IP('203.0.113.3')
    );
    expect(blocked.status).toBe(429);
  });

  it('does not charge the identity bucket on a successful login', async () => {
    for (let i = 0; i < 8; i++) {
      const response = await login(
        { login: 'ratelimited', password: 'correct-horse-battery' },
        FROM_IP('203.0.113.4')
      );
      expect(response.status).toBe(200);
    }
  });

  it('keeps buckets separate per IP', async () => {
    for (let i = 0; i < 5; i++) {
      await login({ login: 'ratelimited', password: 'wrong' }, FROM_IP('203.0.113.5'));
    }

    const otherHost = await login(
      { login: 'ratelimited', password: 'wrong' },
      FROM_IP('203.0.113.6')
    );
    expect(otherHost.status).toBe(401);
  });

  it('keeps buckets separate per login on the same IP', async () => {
    for (let i = 0; i < 5; i++) {
      await login({ login: 'ratelimited', password: 'wrong' }, FROM_IP('203.0.113.7'));
    }

    const otherAccount = await login(
      { login: 'someone-else', password: 'wrong' },
      FROM_IP('203.0.113.7')
    );
    expect(otherAccount.status).toBe(401);
  });

  // The per-IP bucket is what catches stuffing that spreads across accounts.
  it('blocks after 30 attempts from one IP regardless of which account', async () => {
    for (let i = 0; i < 30; i++) {
      const response = await login(
        { login: `account-${i}`, password: 'wrong' },
        FROM_IP('203.0.113.8')
      );
      expect(response.status).toBe(401);
    }

    const blocked = await login({ login: 'account-31', password: 'wrong' }, FROM_IP('203.0.113.8'));
    expect(blocked.status).toBe(429);
  });

  // nginx sets X-Real-IP from $remote_addr, overwriting client input. X-Forwarded-For
  // is $proxy_add_x_forwarded_for, so a client-supplied value survives as a prefix
  // and only the last hop is ours — reading the first would hand out a fresh bucket
  // on demand.
  it('ignores a spoofed X-Forwarded-For when X-Real-IP is present', async () => {
    for (let i = 0; i < 5; i++) {
      await login({ login: 'ratelimited', password: 'wrong' }, FROM_IP('203.0.113.9'));
    }

    const spoofed = await login(
      { login: 'ratelimited', password: 'wrong' },
      { 'X-Real-IP': '203.0.113.9', 'X-Forwarded-For': '1.2.3.4' }
    );
    expect(spoofed.status).toBe(429);
  });

  it('trusts only the last hop of X-Forwarded-For', async () => {
    const headers = { 'X-Forwarded-For': '1.2.3.4, 203.0.113.10' };

    for (let i = 0; i < 5; i++) {
      await login({ login: 'ratelimited', password: 'wrong' }, headers);
    }

    // Same real client, different forged prefix — must land in the same bucket.
    const spoofed = await login(
      { login: 'ratelimited', password: 'wrong' },
      { 'X-Forwarded-For': '9.9.9.9, 203.0.113.10' }
    );
    expect(spoofed.status).toBe(429);
  });

  // The limiter reads the body before the validator does; Hono caches it, but a
  // regression here would surface as a 400 turning into something else.
  it('still validates the body after the limiter has read it', async () => {
    const response = await login({ login: 'ratelimited' }, FROM_IP('203.0.113.11'));
    expect(response.status).toBe(400);
  });
});
