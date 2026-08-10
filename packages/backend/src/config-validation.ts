import { appConfig } from './config.js';

/**
 * Boot-time configuration checks.
 *
 * These deliberately live outside `config.ts` rather than inside its getters.
 * `storage/local.ts` HMACs signed URLs with `appConfig.JWT_SECRET`, so a getter
 * that throws would fire in the middle of a request — turning a misconfiguration
 * into a sporadic 500 instead of a refusal to start. Everything here runs once,
 * before the port is bound.
 */

/**
 * HS256 derives a 256-bit key from the secret, so anything shorter than 32
 * characters carries less entropy than the algorithm assumes.
 */
const MIN_SECRET_LENGTH = 32;

const GENERATE_HINT = 'Generate one with: openssl rand -base64 48';

/**
 * Touch the config the selected storage driver needs so a misconfigured server
 * dies at boot rather than 500-ing on the first photo request — the latter
 * sails past deployment health checks and only surfaces in front of a user.
 */
export function validateStorageConfig(): void {
  if (appConfig.STORAGE_DRIVER !== 's3') return;
  void appConfig.AWS_S3_BUCKET;
  void appConfig.AWS_S3_REGION;
}

/**
 * Both JWT secrets must be present, long enough to be worth signing with, and
 * distinct from one another.
 *
 * Reading the getters is itself the presence check — they throw a named
 * "Missing required environment variable" for an unset or empty value.
 */
export function validateAuthConfig(): void {
  const secrets: ReadonlyArray<readonly [string, string]> = [
    ['JWT_SECRET', appConfig.JWT_SECRET],
    ['JWT_REFRESH_SECRET', appConfig.JWT_REFRESH_SECRET],
  ];

  for (const [name, value] of secrets) {
    if (value.length < MIN_SECRET_LENGTH) {
      // Names the variable and its length but never the value — this message
      // ends up in the systemd journal.
      throw new Error(
        `${name} is ${value.length} characters; at least ${MIN_SECRET_LENGTH} are required. ${GENERATE_HINT}`
      );
    }
  }

  // Reusing one secret for both means a 30-day refresh token verifies as a
  // 1-hour access token, quietly erasing the shorter lifetime.
  if (appConfig.JWT_SECRET === appConfig.JWT_REFRESH_SECRET) {
    throw new Error(
      `JWT_SECRET and JWT_REFRESH_SECRET must be different values. ${GENERATE_HINT}`
    );
  }
}
