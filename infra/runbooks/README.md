# runbooks

One-shot scripts that were run **by hand**, once, on the server or against a database. Nothing in CI calls them. They are kept as a record of what was done and as a template for the next migration of the same kind. Read a script fully before rerunning it.

| Script | What it did |
|---|---|
| `phase0-upgrade-node.sh` | Moved the EC2 box from Node 18 to Node 24 |
| `phase0-update-env.sh` | Updated the production `.env` for S3 photo storage (`docs/INFRASTRUCTURE_PLAN.md` Phase 0) |
| `migrate-v1-to-v2.sh` | Copied users and lookup tables from the V1 database into a fresh V2 schema (`docs/SCHEMA_V2.md`) |
