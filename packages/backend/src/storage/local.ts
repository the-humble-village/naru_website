import { createHmac, timingSafeEqual } from 'crypto';
import { promises as fs, existsSync } from 'fs';
import path from 'path';
import { appConfig } from '../config.js';
import type { StorageDriver } from './types.js';

const UPLOAD_TTL_MS = 15 * 60 * 1000; // 15 min, mirrors the S3 presign window
const DOWNLOAD_TTL_MS = 60 * 60 * 1000; // 1 hour

/** Base directory on disk where uploaded files live (gitignored). */
export const LOCAL_STORAGE_DIR = path.resolve(
  process.cwd(),
  process.env.LOCAL_STORAGE_DIR || 'uploads'
);

type Op = 'put' | 'get';

interface TokenPayload {
  key: string;
  op: Op;
  mime: string;
  exp: number;
}

// ── Signed token helpers ────────────────────────────────────────────────────
// The local upload/download endpoints can't require a JWT (the browser omits
// auth headers on raw PUTs and <img> loads), so access is gated by a short-TTL
// HMAC token baked into the URL — the same shape of guarantee a presigned S3
// URL gives you.

function sign(data: string): string {
  return createHmac('sha256', appConfig.JWT_SECRET).update(data).digest('base64url');
}

function encodeToken(payload: TokenPayload): string {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `${body}.${sign(body)}`;
}

/**
 * Verify a local-storage token and return its payload, or null if the token is
 * malformed, tampered, expired, or for the wrong operation.
 */
export function verifyToken(token: string, expectedOp: Op): TokenPayload | null {
  const dot = token.indexOf('.');
  if (dot < 0) return null;

  const body = token.slice(0, dot);
  const providedSig = token.slice(dot + 1);
  const expectedSig = sign(body);

  const a = Buffer.from(providedSig);
  const b = Buffer.from(expectedSig);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  let payload: TokenPayload;
  try {
    payload = JSON.parse(Buffer.from(body, 'base64url').toString());
  } catch {
    return null;
  }

  if (payload.op !== expectedOp) return null;
  if (typeof payload.exp !== 'number' || payload.exp < Date.now()) return null;
  // Defense in depth: keys are server-generated UUID paths, but never trust a
  // path that could escape the storage root.
  if (!payload.key || payload.key.includes('..')) return null;

  return payload;
}

function urlFor(payload: TokenPayload): string {
  return `/api/files/local?token=${encodeURIComponent(encodeToken(payload))}`;
}

// ── Disk I/O (used by the local routes) ─────────────────────────────────────

function absPath(s3Key: string): string {
  const resolved = path.resolve(LOCAL_STORAGE_DIR, s3Key);
  if (!resolved.startsWith(LOCAL_STORAGE_DIR + path.sep)) {
    throw new Error('Invalid storage key');
  }
  return resolved;
}

export async function writeLocalFile(s3Key: string, data: Buffer): Promise<void> {
  const target = absPath(s3Key);
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, data);
}

export async function readLocalFile(s3Key: string): Promise<Buffer> {
  return fs.readFile(absPath(s3Key));
}

// ── Driver ──────────────────────────────────────────────────────────────────

/**
 * Dev/test driver. "Presigned" URLs point back at the backend's own
 * /api/files/local endpoint; the browser reaches them through the Vite proxy,
 * so no external service or absolute base URL is needed.
 */
export class LocalStorage implements StorageDriver {
  async getUploadUrl(s3Key: string, mimeType: string): Promise<string> {
    return urlFor({ key: s3Key, op: 'put', mime: mimeType, exp: Date.now() + UPLOAD_TTL_MS });
  }

  async exists(s3Key: string): Promise<boolean> {
    return existsSync(absPath(s3Key));
  }

  async getDownloadUrl(s3Key: string, mimeType: string): Promise<string> {
    return urlFor({ key: s3Key, op: 'get', mime: mimeType, exp: Date.now() + DOWNLOAD_TTL_MS });
  }

  async delete(s3Key: string): Promise<void> {
    await fs.rm(absPath(s3Key), { force: true });
  }
}
