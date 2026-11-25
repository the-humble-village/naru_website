# AI attribution

## 2026-11-25: AGENTS.md (new file), AI-ATTRIBUTION.md (new file), CLAUDE.md, README.md, docs/README.md

Tool: Claude Code
Model: Claude Opus 5.5
Task: Create AGENTS.md on a new branch, moving the CLAUDE.md content into it and pointing CLAUDE.md at it. Add AI attribution rules, including the header line for TypeScript files.

## 2026-11-25: AGENTS.md, AI-ATTRIBUTION.md
Tool: Claude Code
Model: Claude Opus 5.5
Task: Add a rule that git commits end with '[agent-assisted]'.

## 2026-11-25: apps/web/vitest.config.ts, AI-ATTRIBUTION.md
Tool: Claude Code
Model: Claude Opus 5.5
Task: On a new branch, delete the Vitest poolOptions setting, which Vitest 4 removed, instead of restoring the two-worker cap.

## 2026-11-25: apps/backend/package.json, pnpm-workspace.yaml, pnpm-lock.yaml, AI-ATTRIBUTION.md
Tool: Claude Code
Model: Claude Opus 5.5
Task: On a new branch, remove the unused backend dependencies multer, @types/multer and @aws-sdk/client-rds, plus the leftover multer override.

## 2026-11-25: apps/web/src/pages/__tests__/ErrorPage.test.tsx (new file), AI-ATTRIBUTION.md
Tool: Claude Code
Model: Claude Opus 5.5
Task: On a new branch, add a test for ErrorPage, the only top-level page without one.

## 2026-11-25: apps/web/src/store/auth.ts, AI-ATTRIBUTION.md
Tool: Claude Code
Model: Claude Opus 5.5
Task: On a new branch, derive the auth store's User type from the shared UserRead type instead of duplicating it.
