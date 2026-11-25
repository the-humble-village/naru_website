// AI-assisted: see AI-ATTRIBUTION.md
import { describe, it, expect, beforeEach } from 'vitest';
import sitesRoutes from '@/routes/sites';
import { testDb, createTestUser } from '../setup';
import { mountRoutes, tokenFor } from '../http';

const client = mountRoutes('/sites', sitesRoutes);

const BOUNDARY: [number, number][] = [
  [14.6, -90.5],
  [14.7, -90.5],
  [14.7, -90.4],
];

describe('Site Routes', () => {
  let adminToken: string;

  beforeEach(async () => {
    const admin = await createTestUser({ login: 'admin', email: 'admin@example.com', role: 'ADMIN' });
    adminToken = tokenFor(admin);
  });

  describe('PUT /sites/:id', () => {
    it('clears the boundary when it is null', async () => {
      const site = await testDb.site.create({ data: { title: 'Xela', boundary: BOUNDARY } });

      const res = await client.put(`/sites/${site.id}`, { boundary: null }, adminToken);

      expect(res.status).toBe(200);
      expect((await res.json()).boundary).toBeNull();

      const after = await client.get(`/sites/${site.id}`, adminToken);
      expect((await after.json()).boundary).toBeNull();
    });

    it('leaves the boundary alone when it is omitted', async () => {
      const site = await testDb.site.create({ data: { title: 'Xela', boundary: BOUNDARY } });

      const res = await client.put(`/sites/${site.id}`, { title: 'Quetzaltenango' }, adminToken);

      expect(res.status).toBe(200);
      expect((await res.json()).boundary).toEqual(BOUNDARY);
    });
  });
});
