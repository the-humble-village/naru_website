# Infrastructure & Deployment Hardening Plan

**Written:** 2026-08-02
**Account:** `481971219588` · **Region:** `us-east-1` (note: local `~/.aws/config` says `us-west-1` — wrong)
**Author's note:** Findings below come from a live audit of the AWS account, the EC2 instance
(via SSM), and the repo. Items marked *(unverified)* need a human to confirm before acting.

---

## Current State

| Resource | Value |
|---|---|
| EC2 instance | `i-025ab3760f2dc2ae1` — t2.micro, Amazon Linux 2023, us-east-1c |
| Public IP | `54.146.102.220` — **auto-assigned, not an Elastic IP** |
| Instance profile | `NaruServerRole` |
| SSH keypair | `NARU_EC2_PRIVATE_KEY_TYLER` |
| Aurora cluster | `naru` — aurora-postgresql 17.7, private, 7-day backups, **unencrypted** |
| Aurora writer | `naru.cluster-cspumw4c8drx.us-east-1.rds.amazonaws.com:5432` |
| S3 buckets | `bucky13buckdybuck`, `nrau-tester` — **no production bucket** |
| Node on server | v18.20.8 (**EOL**) — CI builds with Node 24 |
| Last deploy | **2026-05-23** — ~10 weeks stale |
| Applied migrations | 7 of 9 (branch adds the 9th) |

**Already done this session:** attached `AmazonSSMManagedInstanceCore` to `NaruServerRole`;
instance is registered with SSM and Online. Access no longer requires the `.pem`:

```bash
export AWS_REGION=us-east-1
aws ssm start-session --target i-025ab3760f2dc2ae1
```

---

## Findings

### Critical — blocks or endangers the next deploy

| # | Finding | Evidence |
|---|---|---|
| C1 | No production S3 bucket exists | `list-buckets` → only `bucky13buckdybuck`, `nrau-tester` |
| C2 | `.env` missing all four S3 vars; deploy goes green then 500s on first photo | `config.ts:58-69`, `storage/index.ts:14-19` |
| C3 | Destructive migration will run against real patient data with no backup step | `20260518040524_multi_photo_s3/migration.sql:15,30-31` |
| C4 | `main` is self-inconsistent — `schema.prisma` declares `photoId`, migrations drop it | `main:prisma/schema.prisma:82,105` |
| C5 | Server runs EOL Node 18; CI builds and bundles with Node 24 | `pipeline.yml:25,71,124,169` |
| C6 | Aurora storage is unencrypted at rest, holding patient health records | `StorageEncrypted: false` |

### High — security posture

| # | Finding | Evidence |
|---|---|---|
| H1 | Operating as account **root**; no IAM user exists for you | `sts get-caller-identity` → `:root` |
| H2 | `NaruServerRole` has `AmazonRDSFullAccess` — app never calls the RDS control plane | `list-attached-role-policies` |
| H3 | `naru-web-sg` opens port **5432 to `0.0.0.0/0`** | `sg-017101c22f92a7839` |
| H4 | Port 22 open to `0.0.0.0/0` so GitHub runners can reach it | same SG |
| H5 | Long-lived SSH private key stored as `NARU_GITHUB_PRIVATE_KEY` | `pipeline.yml:204` etc. |
| H6 | `appleboy/ssh-action@master` / `scp-action@master` unpinned — these actions receive the private key | `pipeline.yml:200,215,226,237,247,257` |
| H7 | HTTPS uses self-signed certs; browsers warn | `naru.conf:94-95` |
| H8 | Secrets live only in a hand-edited `/var/www/backend/.env`; no rotation, no backup | `pipeline.yml:280-284` |
| H9 | `JWT_REFRESH_SECRET` is only 22 chars — under the 32-byte minimum for HS256 | verified 2026-08-02 |
| H10 | `s3.ts` hardcodes static credential use, blocking instance-role auth | `s3.ts:26-32` |

### Medium — reliability & pipeline quality

| # | Finding | Evidence |
|---|---|---|
| M1 | **No Elastic IP** — a stop/start changes the IP, breaking `naru.conf:7` and the `EC2_HOST` secret | `describe-addresses` → `[]` |
| M2 | `build` job's output is discarded; `deploy` rebuilds from scratch | `pipeline.yml:110-197` |
| M3 | `on: push`/`pull_request` with no branch filters → duplicate CI runs | `pipeline.yml:4-6` |
| M4 | scp never deletes — stale files accumulate in `dist/` and `backend/` forever | `pipeline.yml:214-234` |
| M5 | No health check after restart — a crash-looping backend still reports green | `pipeline.yml:299-301` |
| M6 | Migrations apply *before* the service restart — old code briefly sees new schema | `pipeline.yml:294` then `:301` |
| M7 | No rollback path of any kind | — |
| M8 | Every deploy causes downtime (single instance, hard restart) | — |
| M9 | Unused local Postgres running on the box, restarted every deploy | `pipeline.yml:274`; `ss -lntp` |
| M10 | Single instance, single AZ, no ALB/ASG — SPOF | — |
| M11 | 8 GB root volume at 47%, no artifact cleanup | `df -h` |

### Low — hygiene

| # | Finding |
|---|---|
| L1 | `DEPLOYMENT.md:70` references `deploy.yml`; the real file is `pipeline.yml` |
| L2 | `DEPLOYMENT.md:13` documents a `DATABASE_URL` secret that nothing uses |
| L3 | `USE_RDS_IAM` in server `.env` is read by no code |
| L4 | `AWS_REGION` in `.env` duplicates `AWS_S3_REGION` from `config.ts:61` |
| L5 | Stray `20260403012809_add_photos_to_visits/migration 2.sql` (macOS duplicate; Prisma ignores it) |
| L6 | JWT validation failures log full stack traces — noisy, not exceptional |
| L7 | Idle instances: `i-03a741c46091ed98d` (us-east-1), two in us-east-2 — verify and terminate |
| L8 | Local `~/.aws/config` region is `us-west-1` but all infra is `us-east-1` |

**Already correct, don't regress:** Aurora is private and only reachable from the EC2 security
group (`rds-ec2-1` ← `ec2-rds-1`); the box's local Postgres binds to `127.0.0.1` only, so H3 is
defence-in-depth rather than an active exposure; IMDSv2 is `required`.

---

## Phase 0 — Before the next deploy

Blocking work. Nothing ships until these are done.

### 0.1 Create an IAM admin user and stop using root

```bash
aws iam create-user --user-name caleb
aws iam attach-user-policy --user-name caleb \
  --policy-arn arn:aws:iam::aws:policy/AdministratorAccess
aws iam create-access-key --user-name caleb
```

Enable MFA on the user, enable MFA on root, delete any root access keys, then shelve the root
credentials. Root cannot be scoped or revoked, and CloudTrail cannot distinguish you from anyone
else holding those credentials.

### 0.2 Snapshot Aurora

`multi_photo_s3` drops `parents.photo_id` and `children.photo_id` irreversibly. The backfill at
`:24-25` is correct, but you want a restore point regardless.

```bash
aws rds create-db-cluster-snapshot --region us-east-1 \
  --db-cluster-identifier naru \
  --db-cluster-snapshot-identifier naru-pre-s3-migration
aws rds wait db-cluster-snapshot-available --region us-east-1 \
  --db-cluster-snapshot-identifier naru-pre-s3-migration
```

### 0.3 Create the production S3 bucket

```bash
BUCKET=naru-photos-prod
aws s3api create-bucket --bucket $BUCKET --region us-east-1
aws s3api put-public-access-block --bucket $BUCKET \
  --public-access-block-configuration \
  "BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true"
aws s3api put-bucket-encryption --bucket $BUCKET \
  --server-side-encryption-configuration \
  '{"Rules":[{"ApplyServerSideEncryptionByDefault":{"SSEAlgorithm":"AES256"}}]}'
aws s3api put-bucket-versioning --bucket $BUCKET \
  --versioning-configuration Status=Enabled
```

CORS is required — the browser PUTs directly to S3 via presigned URLs (`s3.ts:35-43`):

```bash
aws s3api put-bucket-cors --bucket $BUCKET --cors-configuration '{
  "CORSRules": [{
    "AllowedHeaders": ["*"],
    "AllowedMethods": ["GET", "PUT", "HEAD"],
    "AllowedOrigins": ["http://54.146.102.220", "https://54.146.102.220"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3000
  }]
}'
```

Update `AllowedOrigins` when the real domain lands (Phase 2.4).

### 0.4 Switch S3 auth to the instance role

Removes the last long-lived AWS keys from the server. Replace `s3.ts:26-32`:

```ts
this.client = new S3Client({
  region: appConfig.AWS_S3_REGION,
  // Credentials come from the instance profile in production. Only fall back to
  // static keys when they are explicitly configured (local dev against real S3).
  ...(process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY
    ? {
        credentials: {
          accessKeyId: appConfig.AWS_ACCESS_KEY_ID,
          secretAccessKey: appConfig.AWS_SECRET_ACCESS_KEY,
        },
      }
    : {}),
});
```

Then grant the role scoped bucket access and drop the over-broad RDS policy:

```bash
aws iam put-role-policy --role-name NaruServerRole --policy-name NaruS3Photos \
  --policy-document '{
    "Version": "2012-10-17",
    "Statement": [{
      "Effect": "Allow",
      "Action": ["s3:GetObject", "s3:PutObject", "s3:DeleteObject"],
      "Resource": "arn:aws:s3:::naru-photos-prod/*"
    }]
  }'

aws iam detach-role-policy --role-name NaruServerRole \
  --policy-arn arn:aws:iam::aws:policy/AmazonRDSFullAccess
```

> **Caveat:** presigned URLs generated from instance-role credentials expire when the underlying
> temporary credentials do. With `UPLOAD_EXPIRY` at 15 min and `DOWNLOAD_EXPIRY` at 1 hour
> (`s3.ts:12-13`) this is fine — IMDS credentials rotate roughly every 6 hours and the SDK
> refreshes automatically. Worth a smoke test after deploy regardless.

### 0.5 Fail fast on missing config

Today a missing `AWS_S3_BUCKET` surfaces as a 500 on the first photo request, long after the
deploy reports success. Validate at boot in `src/index.ts`:

```ts
// Touch every getter the selected storage driver needs so a misconfigured
// server fails at startup instead of on the first photo request.
if (appConfig.STORAGE_DRIVER === 's3') {
  void appConfig.AWS_S3_BUCKET;
  void appConfig.AWS_S3_REGION;
}
```

Combined with the pipeline health check (2.2), a bad `.env` then fails the deploy instead of
silently shipping.

### 0.6 Update the server `.env`

Currently present: `AWS_REGION`, `DATABASE_URL`, `JWT_SECRET`, `JWT_REFRESH_SECRET`, `PORT`,
`USE_RDS_IAM`. Add:

```env
AWS_S3_BUCKET=naru-photos-prod
AWS_S3_REGION=us-east-1
```

With 0.4 in place, `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` are deliberately omitted. Delete
`USE_RDS_IAM` (L3).

**JWT secrets — checked 2026-08-02, no action needed here.** Production is *not* reusing the repo
placeholders: `JWT_SECRET` is 32 chars vs. 24 for `your-jwt-secret-key-here`, and
`JWT_REFRESH_SECRET` is 22 chars vs. 32 for `your-jwt-refresh-secret-key-here`. Neither length
matches. The short refresh secret is a separate concern — see 2.6.

### 0.7 Align Node versions

```bash
aws ssm start-session --target i-025ab3760f2dc2ae1
sudo dnf install -y nodejs24 || curl -fsSL https://rpm.nodesource.com/setup_24.x | sudo bash -
sudo systemctl restart naru-backend
```

Confirm `/usr/bin/node` resolves to v24 — `naru-backend.service:9` hardcodes that path.

---

## Phase 1 — Deploy this branch

1. Merge `EditableOrDeletableEverything` → `main`. This also resolves C4, since the branch's
   `schema.prisma` is what finally matches the migrations already on `main`.
2. Watch the deploy. Two migrations apply in one run: `multi_photo_s3` (destructive) and
   `add_file_deleted_at`.
3. Verify:
   ```bash
   aws ssm start-session --target i-025ab3760f2dc2ae1
   cd /var/www/backend && npx prisma migrate status   # expect 9 applied
   systemctl is-active naru-backend
   curl -sf localhost:3000/api/health || journalctl -u naru-backend -n 50 --no-pager
   ```
4. Smoke test a full photo round-trip through the UI — upload, view, delete. This is the path that
   exercises S3 presigning, the instance role, and the new `photos` JSON columns together.
5. Keep the `naru-pre-s3-migration` snapshot for at least a week.

---

## Phase 2 — Pipeline rebuild

### 2.1 Replace SSH with OIDC + SSM

Eliminates H4, H5, H6 at once: no private key in GitHub, no port 22 open to the world, no
third-party action handling credentials.

```bash
aws iam create-open-id-connect-provider \
  --url https://token.actions.githubusercontent.com \
  --client-id-list sts.amazonaws.com
```

Create a `GithubDeployRole` trusted by that provider, with its `sub` condition scoped to
`repo:<org>/<repo>:ref:refs/heads/main`, granting only `ssm:SendCommand`,
`ssm:GetCommandInvocation`, and `s3:PutObject` on a deploy-artifact bucket. Then:

```yaml
permissions:
  id-token: write
  contents: read

steps:
  - uses: aws-actions/configure-aws-credentials@v4
    with:
      role-to-assume: arn:aws:iam::481971219588:role/GithubDeployRole
      aws-region: us-east-1

  - run: aws s3 cp deploy.tar.gz s3://naru-deploy-artifacts/${{ github.sha }}.tar.gz

  - run: |
      aws ssm send-command --instance-ids i-025ab3760f2dc2ae1 \
        --document-name AWS-RunShellScript \
        --parameters commands='["/usr/local/bin/naru-deploy.sh ${{ github.sha }}"]'
```

The runner pushes an artifact and triggers a script; the box pulls. Once this works, remove the
22, 5432, and (after 2.4) 80/443-direct rules from `naru-web-sg`, and delete the
`NARU_GITHUB_PRIVATE_KEY` secret.

### 2.2 Deploy script on the box

Put the deploy logic in `/usr/local/bin/naru-deploy.sh`, version-controlled in `deployment/`.
It should, in order:

1. Snapshot Aurora if `prisma migrate status` reports pending migrations — automates 0.2
2. Extract the artifact to `/var/www/backend.new`, then atomically swap symlinks (fixes M4, M7 —
   rollback becomes re-pointing the symlink at the previous release)
3. Run `prisma migrate deploy`
4. Restart, then **poll `/api/health` until it returns 200, with a timeout** (fixes M5)
5. On failure, swap the symlink back and restart

Keep the last 3 releases; prune the rest (fixes M11).

### 2.3 Fix the CI graph

```yaml
on:
  push:
    branches: [main]
  pull_request:
    branches: [main]
```

Have `build` upload its output with `actions/upload-artifact`, and `deploy` consume it with
`download-artifact` instead of rebuilding (M2, M3). Roughly halves CI time.

### 2.4 Elastic IP, domain, and real TLS

M1 is a latent outage: stop the instance for any reason and the IP changes, breaking both nginx
and the `EC2_HOST` secret.

```bash
aws ec2 allocate-address --domain vpc --region us-east-1
aws ec2 associate-address --instance-id i-025ab3760f2dc2ae1 \
  --allocation-id <alloc-id> --region us-east-1
```

Then point a domain at it, replace the self-signed certs (H7) with Let's Encrypt via certbot, set
`server_name` to the hostname instead of a literal IP, and add an HTTP→HTTPS redirect. Update the
S3 CORS origins from 0.3 to match.

### 2.5 Move secrets into SSM Parameter Store

Replaces the hand-edited `.env` (H8):

```bash
aws ssm put-parameter --name /naru/prod/DATABASE_URL --type SecureString --value '...'
aws ssm put-parameter --name /naru/prod/JWT_SECRET --type SecureString --value '...'
```

Grant `NaruServerRole` `ssm:GetParametersByPath` on `/naru/prod/*`, and have the deploy script
render `.env` from the parameters on each deploy. Rotation stops requiring a shell, and the
values are versioned and audited.

### 2.6 Rotate JWT secrets to 64 chars (H9)

Production is not using the repo placeholders — that was verified on 2026-08-02 — but
`JWT_REFRESH_SECRET` is only **22 characters**. HS256 keys should carry at least 32 bytes of
entropy; below that the signature is brute-forceable given a captured token, and refresh tokens
are the higher-value target since they live 30 days (`access 1h + refresh 30d`).

Do this *after* 2.5, so the new values go straight into Parameter Store rather than a hand-edited
`.env` you'd have to redo:

```bash
aws ssm put-parameter --name /naru/prod/JWT_SECRET --type SecureString --overwrite \
  --value "$(openssl rand -base64 48 | tr -d '\n=+/' | cut -c1-64)"
aws ssm put-parameter --name /naru/prod/JWT_REFRESH_SECRET --type SecureString --overwrite \
  --value "$(openssl rand -base64 48 | tr -d '\n=+/' | cut -c1-64)"
```

**Rotating invalidates every outstanding token, so all users are logged out and every mobile
client must re-authenticate.** That matters more than it sounds for this app: field workers may
be offline with queued sync data, and `POST /api/sync` requires a valid token. Schedule it when
caseworkers are not mid-visit, and confirm the mobile clients handle a 401 on sync by prompting
re-login rather than discarding the queue.

Verify afterwards that neither secret is 22 or 32 chars by accident:

```bash
aws ssm get-parameter --name /naru/prod/JWT_REFRESH_SECRET --with-decryption \
  --query 'Parameter.Value' --output text | tr -d '\n' | wc -c
```

---

## Phase 3 — Remaining hardening

### 3.1 Encrypt Aurora at rest (C6)

Cannot be enabled in place. Requires snapshot → copy with a KMS key → restore → cut over:

```bash
aws rds create-db-cluster-snapshot --db-cluster-identifier naru \
  --db-cluster-snapshot-identifier naru-preencrypt
aws rds copy-db-cluster-snapshot \
  --source-db-cluster-snapshot-identifier naru-preencrypt \
  --target-db-cluster-snapshot-identifier naru-encrypted \
  --kms-key-id alias/aws/rds
aws rds restore-db-cluster-from-snapshot \
  --db-cluster-identifier naru-enc \
  --snapshot-identifier naru-encrypted --engine aurora-postgresql
```

Then repoint `DATABASE_URL` and retire the old cluster. Schedule a maintenance window — this
involves real downtime. Given that the database holds identifiable child and parent health
records, this should not stay open-ended.

While here: raise `BackupRetentionPeriod` from 7 to 30 days and enable deletion protection.

### 3.2 Close the security group

After 2.1 and 2.4, `naru-web-sg` should allow only 80 and 443 from `0.0.0.0/0`. Remove 22 and
5432 entirely — SSM replaces both.

```bash
aws ec2 revoke-security-group-ingress --group-id sg-017101c22f92a7839 \
  --protocol tcp --port 5432 --cidr 0.0.0.0/0
aws ec2 revoke-security-group-ingress --group-id sg-017101c22f92a7839 \
  --protocol tcp --port 22 --cidr 0.0.0.0/0
```

### 3.3 Remove the unused local Postgres (M9)

```bash
sudo systemctl disable --now postgresql
```

Delete the `systemctl start postgresql || true` line from the pipeline. Frees memory on a t2.micro
that is also running nginx and Node.

### 3.4 Observability

Nothing currently tells you the site is down. Add CloudWatch alarms on instance status checks,
Aurora CPU and free storage, and an external uptime check against `/api/health`. Ship
`journalctl -u naru-backend` to CloudWatch Logs via the agent, and turn `deletedAt`-style audit
events into something queryable.

### 3.5 Hygiene

- Fix `DEPLOYMENT.md` — rename references to `pipeline.yml`, drop the unused `DATABASE_URL`
  secret row (L1, L2)
- `git rm "packages/backend/prisma/migrations/20260403012809_add_photos_to_visits/migration 2.sql"` (L5)
- Log JWT validation failures at warn level without stack traces (L6)
- Audit and terminate the three idle instances (L7)
- `aws configure set region us-east-1` (L8)

---

## Deferred — worth discussing, not urgent

- **M8/M10 (single instance, deploy downtime).** An ALB + ASG across two AZs removes the SPOF and
  enables zero-downtime deploys, but roughly triples cost and adds real complexity. For a
  community health tool with a small user base, the symlink-swap in 2.2 may be sufficient. Revisit
  if uptime requirements change.
- **Compliance.** If this data falls under HIPAA or an equivalent regime, you need a BAA with AWS,
  encryption at rest (3.1) as a hard requirement rather than a nice-to-have, audit logging, and a
  documented retention policy. Worth getting a straight answer on before scaling up.

---

## Suggested sequencing

| When | Items |
|---|---|
| Before any deploy | 0.1 – 0.7 |
| Deploy day | Phase 1 |
| Next sprint | 2.1 – 2.6, 3.2, 3.3, 3.5 |
| Scheduled window | 3.1 (Aurora encryption) |
| Ongoing | 3.4 |
