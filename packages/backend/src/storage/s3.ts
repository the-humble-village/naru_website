import {
  S3Client,
  PutObjectCommand,
  HeadObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { appConfig } from '../config.js';
import type { StorageDriver } from './types.js';

const UPLOAD_EXPIRY = 900; // 15 min
const DOWNLOAD_EXPIRY = 3600; // 1 hour

/**
 * Production driver. Hands the browser presigned S3 URLs so uploads/downloads
 * bypass the backend entirely. AWS_* env vars are only read here, so they are
 * only required when this driver is actually selected.
 */
export class S3Storage implements StorageDriver {
  private readonly client: S3Client;
  private readonly bucket: string;

  constructor() {
    this.bucket = appConfig.AWS_S3_BUCKET;
    this.client = new S3Client({
      region: appConfig.AWS_S3_REGION,
      credentials: {
        accessKeyId: appConfig.AWS_ACCESS_KEY_ID,
        secretAccessKey: appConfig.AWS_SECRET_ACCESS_KEY,
      },
    });
  }

  async getUploadUrl(s3Key: string, mimeType: string, size: number): Promise<string> {
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: s3Key,
      ContentType: mimeType,
      ContentLength: size,
    });
    return getSignedUrl(this.client, command, { expiresIn: UPLOAD_EXPIRY });
  }

  async exists(s3Key: string): Promise<boolean> {
    try {
      await this.client.send(new HeadObjectCommand({ Bucket: this.bucket, Key: s3Key }));
      return true;
    } catch {
      return false;
    }
  }

  async getDownloadUrl(s3Key: string): Promise<string> {
    const command = new GetObjectCommand({ Bucket: this.bucket, Key: s3Key });
    return getSignedUrl(this.client, command, { expiresIn: DOWNLOAD_EXPIRY });
  }

  async delete(s3Key: string): Promise<void> {
    try {
      await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: s3Key }));
    } catch {
      // Log but don't fail — the DB record should still be cleaned up.
      console.error(`Failed to delete S3 object ${s3Key}`);
    }
  }
}
