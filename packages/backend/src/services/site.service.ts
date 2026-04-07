import { HTTPException } from 'hono/http-exception';
import { type SiteCreate, type SiteUpdate, type SiteRead } from '@naru/shared';
import prisma from '../db';

function fmt(s: any): SiteRead {
  return {
    id: s.id,
    title: s.title,
    lat: s.lat ?? null,
    lng: s.lng ?? null,
    boundary: (s.boundary as [number, number][] | null) ?? null,
    createdAt: s.createdAt.toISOString(),
    updatedAt: s.updatedAt.toISOString(),
  };
}

export async function listSites(): Promise<SiteRead[]> {
  const sites = await prisma.site.findMany({
    where: { deletedAt: null },
    orderBy: { title: 'asc' },
  });
  return sites.map(fmt);
}

export async function getSite(id: number): Promise<SiteRead> {
  const site = await prisma.site.findFirst({ where: { id, deletedAt: null } });
  if (!site) throw new HTTPException(404, { message: 'Site not found' });
  return fmt(site);
}

export async function createSite(data: SiteCreate): Promise<SiteRead> {
  const site = await prisma.site.create({
    data: {
      title: data.title,
      lat: data.lat ?? null,
      lng: data.lng ?? null,
      boundary: data.boundary ?? undefined,
    },
  });
  return fmt(site);
}

export async function updateSite(id: number, data: SiteUpdate): Promise<SiteRead> {
  const existing = await prisma.site.findFirst({ where: { id, deletedAt: null } });
  if (!existing) throw new HTTPException(404, { message: 'Site not found' });

  const site = await prisma.site.update({
    where: { id },
    data: {
      ...(data.title !== undefined && { title: data.title }),
      ...(data.lat !== undefined && { lat: data.lat }),
      ...(data.lng !== undefined && { lng: data.lng }),
      ...(data.boundary !== undefined && { boundary: data.boundary ?? undefined }),
    },
  });
  return fmt(site);
}

export async function deleteSite(id: number): Promise<void> {
  const existing = await prisma.site.findFirst({ where: { id, deletedAt: null } });
  if (!existing) throw new HTTPException(404, { message: 'Site not found' });
  await prisma.site.update({ where: { id }, data: { deletedAt: new Date() } });
}
