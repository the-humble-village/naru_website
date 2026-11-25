// AI-assisted: see AI-ATTRIBUTION.md
import { describe, it, expect, beforeEach } from 'vitest';
import { testDb, createTestChild } from './setup';

describe('soft-delete read filtering', () => {
  let liveId: number;
  let deletedId: number;

  beforeEach(async () => {
    liveId = (await createTestChild({ name: 'Live' })).id;
    deletedId = (await createTestChild({ name: 'Deleted', deletedAt: new Date() })).id;
  });

  it.each(['findFirstOrThrow', 'findUniqueOrThrow'] as const)(
    '%s returns a live row and rejects a soft-deleted one',
    async (operation) => {
      const live = await testDb.child[operation]({ where: { id: liveId } });
      expect(live.name).toBe('Live');

      await expect(
        testDb.child[operation]({ where: { id: deletedId } })
      ).rejects.toMatchObject({ code: 'P2025' });
    }
  );

  it('aggregate ignores soft-deleted rows', async () => {
    const result = await testDb.child.aggregate({ _count: { id: true }, _max: { id: true } });
    expect(result._count.id).toBe(1);
    expect(result._max.id).toBe(liveId);
  });

  it('groupBy ignores soft-deleted rows', async () => {
    const groups = await testDb.child.groupBy({ by: ['name'], _count: { id: true } });
    expect(groups).toEqual([{ name: 'Live', _count: { id: 1 } }]);
  });

  it('keeps the caller’s own where alongside the filter', async () => {
    const result = await testDb.child.aggregate({
      where: { name: 'Deleted' },
      _count: { id: true },
    });
    expect(result._count.id).toBe(0);
  });

  it('still includes soft-deleted rows when asked to', async () => {
    const result = await testDb.child.aggregate({ includeDeleted: true, _count: { id: true } });
    expect(result._count.id).toBe(2);
  });
});
