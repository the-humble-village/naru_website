/**
 * S3 connectivity smoke test.
 *
 * Exercises the real S3Storage driver end-to-end against whatever bucket your
 * .env points at: presign upload → PUT bytes → HeadObject exists → presign
 * download → GET bytes → delete. If every step is green, your bucket name,
 * region, IAM permissions, and access keys are all correct.
 *
 * This talks to S3 over plain HTTP (like the browser would) but from Node, so
 * it does NOT test browser CORS — a green run here plus a failing in-browser
 * upload means your bucket CORS is the problem.
 *
 * Run:  cd packages/backend && npx tsx scripts/s3-smoke.ts
 * Needs in .env:  AWS_S3_BUCKET, AWS_S3_REGION, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY
 */

// Force the S3 driver regardless of NODE_ENV so you don't have to flip .env.
process.env.STORAGE_DRIVER = 's3';

import { getStorage } from '../src/storage/index.js';
import { appConfig } from '../src/config.js';

const ok = (m: string) => console.log(`\x1b[32m✓\x1b[0m ${m}`);
const fail = (m: string, e?: unknown) => {
  console.error(`\x1b[31m✗ ${m}\x1b[0m`);
  if (e) console.error(`  ${e instanceof Error ? e.message : String(e)}`);
};

async function main() {
  const storage = getStorage();
  const key = `uploads/smoke-test/${Date.now()}.txt`;
  const mime = 'text/plain';
  const body = Buffer.from(`naru s3 smoke test ${new Date().toISOString()}`);

  console.log(`\nBucket:  ${appConfig.AWS_S3_BUCKET}`);
  console.log(`Region:  ${appConfig.AWS_S3_REGION}`);
  console.log(`Key:     ${key}\n`);

  // 1. Presign upload
  let uploadUrl: string;
  try {
    uploadUrl = await storage.getUploadUrl(key, mime, body.byteLength);
    ok('presign upload URL');
  } catch (e) {
    fail('presign upload URL (check bucket/region/keys)', e);
    process.exit(1);
  }

  // 2. PUT the bytes to S3
  try {
    const res = await fetch(uploadUrl, {
      method: 'PUT',
      headers: { 'Content-Type': mime },
      body,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status} ${await res.text()}`);
    ok('PUT object to S3 (s3:PutObject)');
  } catch (e) {
    fail('PUT object to S3 — likely s3:PutObject denied or bad signature', e);
    process.exit(1);
  }

  // 3. HeadObject existence check (authorized by s3:GetObject)
  try {
    if (!(await storage.exists(key))) throw new Error('HeadObject reported missing');
    ok('HeadObject exists check (s3:GetObject)');
  } catch (e) {
    fail('HeadObject — likely s3:GetObject denied', e);
  }

  // 4. Presign download + GET the bytes back
  try {
    const downloadUrl = await storage.getDownloadUrl(key, mime);
    const res = await fetch(downloadUrl);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const got = Buffer.from(await res.arrayBuffer());
    if (!got.equals(body)) throw new Error('downloaded bytes did not match');
    ok('presign download + GET round-trip (s3:GetObject)');
  } catch (e) {
    fail('download round-trip', e);
  }

  // 5. Delete
  try {
    await storage.delete(key);
    if (await storage.exists(key)) throw new Error('object still present after delete');
    ok('DeleteObject (s3:DeleteObject)');
  } catch (e) {
    fail('DeleteObject — likely s3:DeleteObject denied', e);
  }

  console.log('\n\x1b[32mS3 connection working.\x1b[0m Bucket, region, keys, and IAM are good.\n');
}

main().catch((e) => {
  fail('unexpected failure', e);
  process.exit(1);
});
