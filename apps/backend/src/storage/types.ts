/**
 * Storage driver abstraction.
 *
 * Two implementations exist:
 *  - S3Storage    (production) — presigned S3 PUT/GET URLs, browser talks to S3 directly
 *  - LocalStorage (dev/test)   — files on the local filesystem, browser talks to the
 *                                backend's own /api/files/local endpoint
 *
 * The `s3Key` argument is the object's logical path (e.g. `uploads/2026/07/26/<uuid>.jpg`).
 * It is reused verbatim as the on-disk relative path for the local driver, so the DB
 * schema and the rest of the app are identical regardless of driver.
 */
export interface StorageDriver {
  /** A URL the browser can PUT the raw file bytes to. */
  getUploadUrl(s3Key: string, mimeType: string, size: number): Promise<string>;

  /** Whether the object actually landed in the backing store. */
  exists(s3Key: string): Promise<boolean>;

  /** A URL the browser can GET the object from (for `<img src>` etc.). */
  getDownloadUrl(s3Key: string, mimeType: string): Promise<string>;

  /** Delete the object. Must not throw if the object is already missing. */
  delete(s3Key: string): Promise<void>;
}
