#!/usr/bin/env bash
#
# Phase 0.6 — update the production .env for S3 photo storage.
# Run this ON the EC2 instance (i-025ab3760f2dc2ae1), not locally.
#
#   aws ssm start-session --target i-025ab3760f2dc2ae1 --region us-east-1
#   bash phase0-update-env.sh
#
# Idempotent: safe to run more than once. Backs up .env before touching it.
# One-time script — delete it once Phase 0 is done.

set -euo pipefail

ENV_FILE=/var/www/backend/.env
BUCKET=naru-photos-prod
REGION=us-east-1

if [[ ! -f "$ENV_FILE" ]]; then
  echo "ERROR: $ENV_FILE not found. Are you on the right box?" >&2
  exit 1
fi

BACKUP="${ENV_FILE}.bak.$(date +%Y%m%d%H%M%S)"
sudo cp "$ENV_FILE" "$BACKUP"
echo "Backed up to $BACKUP"

# USE_RDS_IAM is read by no code in the repo — remove the dead entry.
sudo sed -i '/^USE_RDS_IAM=/d' "$ENV_FILE"

# Upsert the two vars config.ts requires when STORAGE_DRIVER resolves to 's3'.
# Delete-then-append keeps this idempotent and avoids duplicate keys.
sudo sed -i '/^AWS_S3_BUCKET=/d; /^AWS_S3_REGION=/d' "$ENV_FILE"
printf 'AWS_S3_BUCKET=%s\nAWS_S3_REGION=%s\n' "$BUCKET" "$REGION" | sudo tee -a "$ENV_FILE" > /dev/null

# AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY are deliberately absent: the SDK now
# picks up credentials from the NaruServerRole instance profile (see s3.ts).
# If either is present it would override the instance role — warn loudly.
if sudo grep -qE '^AWS_(ACCESS_KEY_ID|SECRET_ACCESS_KEY)=' "$ENV_FILE"; then
  echo
  echo "WARNING: static AWS keys are present in $ENV_FILE."
  echo "They will take precedence over the instance role. Remove them once the"
  echo "instance-role path is confirmed working."
fi

sudo chown ec2-user:ec2-user "$ENV_FILE"
sudo chmod 600 "$ENV_FILE"

echo
echo "=== KEYS PRESENT NOW ==="
sudo grep -oE '^[A-Z_]+' "$ENV_FILE" | sort

echo
echo "=== JWT SECRET FINGERPRINTS (sha256, first 12 chars) ==="
echo "These are hashes, not the secrets. Compare against your local .env to see"
echo "whether production is reusing dev values — if it is, rotate them."
for key in JWT_SECRET JWT_REFRESH_SECRET; do
  fp=$(sudo grep -E "^${key}=" "$ENV_FILE" | head -1 | cut -d= -f2- | tr -d '\n' | sha256sum | cut -c1-12)
  echo "  ${key}: ${fp}"
done

echo
echo "Done. .env updated but the service has NOT been restarted."
echo "Restart after the Node 24 upgrade (Phase 0.7):"
echo "  sudo systemctl restart naru-backend"
