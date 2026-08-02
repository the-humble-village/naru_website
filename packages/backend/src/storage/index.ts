import { appConfig } from '../config.js';
import type { StorageDriver } from './types.js';
import { S3Storage } from './s3.js';
import { LocalStorage } from './local.js';

export type { StorageDriver } from './types.js';

let driver: StorageDriver | null = null;

/**
 * Return the process-wide storage driver, chosen once by config:
 * S3 in production, local filesystem in dev/test (overridable via STORAGE_DRIVER).
 */
export function getStorage(): StorageDriver {
  if (!driver) {
    driver = appConfig.STORAGE_DRIVER === 's3' ? new S3Storage() : new LocalStorage();
  }
  return driver;
}
