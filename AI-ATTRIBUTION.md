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

## 2026-11-25: AGENTS.md, AI-ATTRIBUTION.md, README.md, docs/WEB_DESIGN_V2.md, apps/web/tsconfig.json, apps/web/vite.config.ts, apps/web/vitest.config.ts, and these files moved from apps/web/src/ to apps/web/tests/: setup.ts, app.test.tsx; components/ (EnrollmentCard, ExitReasonBadge, FilterBar, Layout, OverdueBadge, PhotoGallery, PhotoUpload, ProgramRosterTable, ProtectedRoute, RedirectRoute, ResourceRow, RoleGate, SearchBar, StatStrip, SubjectPicker, SubjectTypeBadge, Tabs, TrainingPicker, VisitForm, VisitQuestionsPanel, WeightDelta, ZScoreBadge).test.tsx; components/ui/ (ConfirmDialog, FormField, FormSelect, LoadingAndEmptyState, PageHeader, PhoneInput, StatCard).test.tsx; hooks/parseZodErrors.test.ts; pages/ (DashboardPage, ErrorPage, LanguagePage, UnenrolledPage).test.tsx; pages/admin/ (AdminBirthingAssistantsPage, AdminLookupsPage, AdminPage, AdminProgramsPage, AdminQuestionSetsPage, AdminSitesPage, AdminUsersPage).test.tsx; pages/auth/LoginPage.test.tsx; pages/children/ (AddChildPage, ChildDetailPage, ChildrenPage, EditChildPage).test.tsx; pages/enrollments/ (EnrollPage, EnrollmentDetailPage, ExitEnrollmentPage).test.tsx; pages/events/ (AddEventPage, EventDetailPage, EventsPage).test.tsx; pages/families/ (AddFamilyPage, EditFamilyPage, FamiliesPage, FamilyDetailPage).test.tsx; pages/mothers/ (AddMotherPage, EditMotherPage, MotherDetailPage, MothersPage).test.tsx; pages/people/ (AddPersonPage, EditPersonPage, PeoplePage, PersonDetailPage).test.tsx; pages/programs/ (ProgramRosterPage, ProgramsPage).test.tsx; pages/reports/ (NutritionReportColors, ReportDetailPage, ReportsPage).test.tsx; pages/visits/ (EditVisitPage, RecordVisitPage, VisitDetailPage, VisitsPage).test.tsx; utils/ (datetime, guatemalanHolidays).test.ts
Tool: Claude Code
Model: Claude Opus 5.5
Task: On a new branch, move the web tests into an apps/web/tests folder that mirrors src, with an @/ import alias. The user approved a one-off script for the path rewrites and header lines.

## 2026-11-25: apps/web/tests/app.test.tsx (deleted), AI-ATTRIBUTION.md
Tool: Claude Code
Model: Claude Opus 5.5
Task: Delete the placeholder app.test.tsx, which tested no app code.

## 2026-11-25: apps/web/tests/components/ZScoreBadge.test.tsx, apps/web/tests/components/RoleGate.test.tsx, apps/web/tests/components/ExitReasonBadge.test.tsx, apps/web/tests/components/SubjectTypeBadge.test.tsx, AI-ATTRIBUTION.md
Tool: Claude Code
Model: Claude Opus 5.5
Task: On a new branch, convert four repetitive web test files to it.each tables.

## 2026-11-25: .github/workflows/pipeline.yml, turbo.json, AI-ATTRIBUTION.md
Tool: Claude Code
Model: Claude Opus 5.5
Task: On a new branch, speed up CI by running lint, tests and build in parallel and giving each job its own Turborepo cache key. Pushes to main always run the tests fresh.

## 2026-11-25: apps/backend/src/middleware/soft-delete.ts, apps/backend/tests/soft-delete.test.ts (new file), AI-ATTRIBUTION.md
Tool: Claude Code
Model: Claude Opus 5.5
Task: On a new branch, make the soft-delete middleware filter findFirstOrThrow, findUniqueOrThrow, aggregate and groupBy, with tests.

## 2026-11-25: apps/backend/package.json, apps/web/package.json, packages/shared/package.json, pnpm-workspace.yaml, pnpm-lock.yaml, packages/shared/src/schemas/ (birthing-assistant, family, photo, program, question, report, visit).ts, packages/shared/src/schemas/__tests__/update-schemas.test.ts (new file), apps/backend/src/app.ts, apps/backend/tests/children.test.ts, apps/web/src/hooks/useFieldErrors.ts, apps/web/src/pages/auth/LoginPage.tsx, apps/web/tests/pages/auth/LoginPage.test.tsx, apps/web/tests/pages/events/AddEventPage.test.tsx, CLAUDE.local.md (not committed), AI-ATTRIBUTION.md
Tool: Claude Code
Model: Claude Opus 5.5
Task: On a new branch, fix the known dependency vulnerabilities, including the moves to Zod 4, React Router 7 and @hono/node-server 2. Also add a local rule to explain long commands before running them.
