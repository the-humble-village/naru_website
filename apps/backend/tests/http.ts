import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import jwt from 'jsonwebtoken';
import { appConfig } from '../src/config';

/**
 * Mounts a route module on a bare Hono app with the same error handler shape the
 * real app uses, and returns a client for driving it.
 *
 * The older suites (children, families, ...) each carry their own copy of this;
 * new suites use this instead.
 */
export function mountRoutes(basePath: string, routes: Hono<any>) {
  const app = new Hono();

  app.onError((err, c) => {
    if (err instanceof HTTPException) {
      return c.json({ message: err.message, error: err.message }, err.status);
    }
    return c.json({ message: 'Internal Server Error' }, 500);
  });

  app.route(basePath, routes as any);

  const send = async (
    method: string,
    path: string,
    body?: any,
    accessToken?: string
  ): Promise<Response> => {
    const headers: Record<string, string> = {};
    if (accessToken) headers['Authorization'] = `Bearer ${accessToken}`;
    if (body !== undefined) headers['Content-Type'] = 'application/json';

    return app.request(
      new Request(`http://localhost${path}`, {
        method,
        headers,
        body: body !== undefined ? JSON.stringify(body) : undefined,
      })
    );
  };

  return {
    app,
    get: (path: string, token?: string) => send('GET', path, undefined, token),
    post: (path: string, body?: any, token?: string) => send('POST', path, body, token),
    put: (path: string, body?: any, token?: string) => send('PUT', path, body, token),
    delete: (path: string, token?: string) => send('DELETE', path, undefined, token),
  };
}

export const tokenFor = (user: { id: number; role: string; lang?: string }): string =>
  jwt.sign(
    { userId: user.id, role: user.role, lang: user.lang || 'en' },
    appConfig.JWT_SECRET,
    { expiresIn: '15m' }
  );
