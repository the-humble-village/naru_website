# Web Design V2 — Program-Centric UI

**Status:** Design approved in outline, details decided by judgment (see §12 for overridable calls)
**Pairs with:** `SCHEMA_V2.md`
**Design system:** `.claude/skills/naru-design/SKILL.md` — Tailwind only, `hv-*` palette

---

## 1. Principles

1. **Enrollment is the spine.** The data model is `Program → Enrollment → Visit`. The UI mirrors it
   exactly. Every visit is created *from* an enrollment, never from a person in the abstract.
2. **Two entry points, one dataset.** *Programs* answers the org's question ("who is in Nutrition
   right now?"). *People* answers the worker's question ("where is María's record?").
3. **Never block admission.** A malnourished infant must be enrollable in under a minute with no
   mother record and no family record. Every form reflects this: almost everything is optional.
4. **Spanish first.** Every string goes through `t(key, lang)` in `@naru/shared/i18n`, with `es`
   entries written at the same time as `en`. Guatemala is the primary deployment.
5. **Tablet and phone are real.** Mobile is frozen (`SCHEMA_V2.md` §11), so the web app *is* the
   field tool. Every table needs a card fallback below `md`.

---

## 2. Navigation

Sidebar shell replaces the current thin top nav in `components/Layout.tsx`.

```
┌─ Humble Village ─────────┐
│  ● Dashboard             │
│                          │
│  ● Programs              │
│      Expectant Mother    │
│      Nutrition Infant    │
│      Nutrition Child     │
│      Midwives            │
│      Youth               │
│      PAF                 │
│                          │
│  ● People                │
│      Mothers             │
│      Children            │
│      Persons             │
│      Families            │
│      ⚠ Unenrolled (38)   │
│                          │
│  ● Visits                │
│  ● Reports               │
│  ● Events                │
│  ● Admin                 │
└──────────────────────────┘
```

- Program list is **data-driven** — it renders `programs WHERE active = true ORDER BY sortOrder`.
  Adding a program row in Admin makes it appear here with no code change.
- **Unenrolled** shows a live count badge and hides itself when the count is zero. It exists to work
  down the migration backlog (`SCHEMA_V2.md` §9.4) and later catches anyone who exits every program.
- Sidebar: `bg-hv-green text-white`, active link `bg-hv-green-hover`.
- Below `md`: collapses to a hamburger drawer. Header keeps the global search box.

### Global search

Always in the header. Searches across mothers, children, persons and families by name in one query,
grouped by type in the results dropdown. This is how workers actually find people — they know the
name, not the program.

```
[🔍 Search people...        ]
  MOTHERS
    María López · 28y · Xela
  CHILDREN
    José Ramírez · 4m · Xela
  FAMILIES
    Familia López · Xela
```

---

## 3. Route map

```
/login

/                                    Dashboard

/programs                            Program index
/programs/:id                        Program roster          ← core screen
/programs/:id/enroll                 Enroll wizard

/mothers            /mothers/new     /mothers/:id      /mothers/:id/edit
/children           /children/new    /children/:id     /children/:id/edit
/people             /people/new      /people/:id       /people/:id/edit
/families           /families/new    /families/:id     /families/:id/edit
/unenrolled                          Migration worklist

/enrollments/:id                     Enrollment detail
/enrollments/:id/exit                Exit form
/enrollments/:id/visits/new          Record visit
/visits                              All visits (filterable)
/visits/:id                          Visit detail
/visits/:id/edit                     Edit visit

/reports                             Report index
/reports/:slug                       Individual report

/events             /events/new      /events/:id

/admin
/admin/users                         ADMIN
/admin/programs                      ADMIN  ← NEW
/admin/sites                         ADMIN
/admin/communities                   ADMIN  (now assigns site)
/admin/resources                     ADMIN  (now has default unit)
/admin/trainings                     ADMIN
/admin/examination-types             ADMIN  ← NEW
/admin/birthing-assistants           SUPERVISOR+
/admin/question-sets                 ADMIN  (now program-scoped)
/admin/language                      any
```

### Routes removed

Everything family-nested. `/families/:id/children/:cid`, `/families/:id/parents/:pid/visits/:vid`
and the rest all collapse to flat top-level routes, because in V2 a child or mother can exist with
no family at all.

| V1 route | V2 replacement |
|---|---|
| `/families/:id/children/:cid` | `/children/:cid` |
| `/families/:id/parents/:pid` | `/mothers/:id` or `/people/:id` |
| `/families/:id/children/:cid/visits/new` | `/enrollments/:eid/visits/new` |
| `/families/:id/visits/*` | `/enrollments/:eid/visits/*` |
| `/admin/question-sets/:visitType` | `/admin/question-sets` (program-scoped) |

**Redirects:** keep 301-style client redirects from the old family-nested paths for one release so
bookmarks don't break.

---

## 4. Program roster — the core screen

`/programs/:id`

```
Expectant Mother                              [+ Enroll]
─────────────────────────────────────────────────────────

    42            6              3            7 ⚠
  Active      New this mo   Exited this mo   Overdue

─────────────────────────────────────────────────────────
[Active]  Exited  All
[🔍 Search…]  [Site ▾] [Community ▾] [Status ▾]

NAME          AGE   COMMUNITY   WEIGHT      STATUS   LAST
María López   28y   Xela        58.2→63.1   —        4d    [+ Visit]
Ana Morales   22y   Nahualá     51.0→52.4   —        34d ⚠ [+ Visit]
Rosa Tzul     31y   Xela        60.5→61.0   —        9d    [+ Visit]
```

**Stat strip** uses the dashboard "Impact" pattern — `bg-white p-8 rounded-lg`, **no borders**,
`text-4xl font-bold text-hv-green`. Overdue uses `text-hv-crisis`.

| Stat | Query |
|---|---|
| Active | `enrollments WHERE programId AND exitedAt IS NULL` |
| New this month | `... AND enrolledAt >= date_trunc('month', now())` |
| Exited this month | `... AND exitedAt >= date_trunc('month', now())` |
| Overdue | active enrollments whose latest visit is older than `program.visitIntervalDays` |

**Columns are kind-aware.** The table renders a different column set per `program.kind`:

| Kind | Columns |
|---|---|
| `PREGNANCY` | Name · Age · Community · Weight Δ · Gestation · Due · Last visit |
| `NUTRITION` | Name · Age · Community · Weight Δ · **Status badge** · Last visit |
| `MIDWIFE` | Name · Age · Community · Mothers assigned · Last visit |
| `STUDENT` | Name · Age · Community · School · Year · Last visit |
| `FAMILY_PAF` | Family name · Community · Members · Last visit |

**Weight Δ** renders `entryWeight → latestVisitWeight` with an arrow coloured green when rising,
`hv-crisis` when falling. For nutrition this is the single most important number on the page.

**Status** is `ZScoreBadge` (already exists in `components/`), fed from
`nutrition_visit_detail.nutritionalStatus` on the most recent visit.

**Overdue** renders the day count in `text-hv-crisis` with a `⚠` when it exceeds the program's
interval.

**Exited tab** swaps the last two columns for `Exited` and `Reason` (an exit-reason badge) and drops
the `+ Visit` action.

**Below `md`:** each row becomes a card — name and status badge on the top line, meta beneath,
full-width `+ Visit` button.

---

## 5. Enrollment flow

Two entry points, one form.

- **From a program** (`/programs/:id/enroll`) — program is fixed, you pick the subject.
- **From a profile** (`+ Enroll in program` on any profile) — subject is fixed, you pick the program.

### Step 1 — Subject (skipped when entering from a profile)

The subject type is fixed by `program.subjectType`, so the picker only searches that one table.

```
Enroll in Nutrition Infant <6m
─────────────────────────────────────────
Step 1 of 2 · Choose child

[🔍 Search children by name…]

  José Ramírez    4m   Xela      ⚠ unenrolled
  Josefa Cua      2m   Nahualá   in Nutrition Child

  ─── or ───
  [+ Create a new child]
```

Search results warn when the subject already has an **active enrollment in this same program** and
disable selection — the DB blocks it anyway (`SCHEMA_V2.md` §7.2), so the UI should not let a worker
get that far.

`+ Create a new child` opens the create form inline (not a separate page), and on save flows
straight into step 2. This is the *"never block admission"* path — one screen, no navigation.

### Step 2 — Admission

Shared fields, then a kind-specific block.

```
Enroll José Ramírez in Nutrition Infant <6m
─────────────────────────────────────────
Step 2 of 2 · Admission

Admission date *      [2026-09-20]        ← defaults today
Entry weight (kg)     [  3.10 ]
Entry photo           [ 📷 Upload ]

── Nutrition ──────────────────────────
Length at admission (mm)   [   540 ]
Caretaker name             [ Juana Ramírez     ]
Caretaker phone            [ 5512-3344         ]

  Age at admission: 4 months          ← derived, read-only
  Nutritional status: ● MODERATE      ← computed live

Admission notes
[                                      ]

                      [Cancel]  [Enroll]
```

- **Age at admission** is derived from `birthDate` and the admission date — never an input
  (`SCHEMA_V2.md` §6.2).
- **Nutritional status** is computed **live in the browser** as weight and length are typed, using
  `@naru/shared/health`. The same functions run server-side on save, so the value the worker sees is
  the value that gets stored.
- Kind-specific blocks: `PREGNANCY` → due date, pregnancy number, birthing assistant.
  `STUDENT` → school, class/year. `MIDWIFE` and `FAMILY_PAF` → no block; step 2 is the shared
  fields only.

### Exit

`/enrollments/:id/exit` — a full page, not a modal, because it captures a photo and a weight.

```
Exit José Ramírez from Nutrition Infant <6m
─────────────────────────────────────────
Enrolled 2026-05-02 · 18 visits · entry 3.10kg

Exit date *     [2026-09-20]
Reason *        [Graduated          ▾]
Exit weight     [  6.40 ]  kg
Exit photo      [ 📷 Upload ]
Exit notes      [                     ]

  Entry 3.10kg → Exit 6.40kg   +3.30kg
  Age at exit: 8 months
  Status: MODERATE → NORMAL

                  [Cancel]  [Exit program]
```

The summary block is the church's *"weight and age at graduation"* report, shown at the moment the
data is captured so mistakes are caught immediately.

`DIED` as a reason shows a confirmation step. Exiting is reversible by a SUPERVISOR (clears
`exitedAt`, `exitReason`, `exitWeight`) — workers will mis-click.

---

## 6. Profile pages

**Decision: profile header + enrollment cards, each carrying its own visits.** Enrollment is the
spine of the data model, so making it the spine of the page keeps the two aligned. A second
pregnancy two years later is a separate card rather than tangled into the first, and exited
enrollments collapse so the active one is what you see.

`/mothers/:id`

```
← Mothers

María López                                     [Edit]
28y · Xela (Site: Quetzaltenango) · 5512-3344
Midwife: Juana Ramírez     Family: Familia López
Children: José (4m) · Ana (3y)
Pregnancies 3 · Children 2 · Breastfed 2 · Malnutrition deaths 0

─────────────────────────────────────────────────────
ENROLLMENTS                        [+ Enroll in program]

┌ ● ACTIVE · Expectant Mother ──────────────────────┐
│ Since 2026-04-02 · due 2026-11-15 · pregnancy #3  │
│ Entry 58.2 kg → latest 63.1 kg   +4.9 kg          │
│ Birthing assistant: Carmen Say                    │
│                          [+ Visit]  [Exit]        │
│ ▾ 6 visits                                        │
│   2026-09-04  Site    64.1 kg  7 mo  Prenatal     │
│   2026-08-12  Home    62.8 kg  6 mo  Prenatal     │
│   2026-07-09  Mobile  61.2 kg  5 mo  —            │
│                                  [View all →]     │
└───────────────────────────────────────────────────┘

▶ EXITED · PAF · 2024-03 → 2025-06 · GRADUATED
```

- Active cards: `border-hv-accent`, expanded by default, showing the 3 most recent visits.
- Exited cards: collapsed one-liners with an exit-reason badge.
- `+ Visit` is on the **card**, not the page header — a visit always belongs to one enrollment, so
  there is never ambiguity about which program it counts toward.
- Header shows the **derived site** (`community.siteId`) as read-only context, since the worker
  selects only a community.

**`/children/:id`** — same shape. Header adds sex, links to mother (or an `⚠ No mother linked`
prompt with a picker) and family. Nutrition cards show a weight/z-score sparkline across visits.

**`/people/:id`** — same shape. For a person enrolled in Midwives, the header adds an **Assigned
mothers** section listing `mothers WHERE midwifeId = :id`, each linking to her profile. That is the
caseload view `mother.midwifeId` exists to serve.

**`/families/:id`** — header (name, community, phone, caretaker 2, income sources, deaths notes),
then a **Members** section listing linked mothers and children as cards, then enrollment cards for
PAF. Members are links, not nested detail.

---

## 7. Visit form

`/enrollments/:id/visits/new`

One component, `VisitForm`, branching on `program.kind`. Same form is reused for edit.

```
← María López · Expectant Mother

Record visit
─────────────────────────────────────────
Date *          [2026-09-20]     ← defaults today
Location *      [Home        ▾]  ← defaults to previous visit's
Site            [Quetzaltenango ▾]
Community       [Xela           ▾]

── Pregnancy ────────────────────────────
Weight (kg)         [ 64.1 ]
Months gestation    [   7  ]
Examination type    [Prenatal check ▾]

── Trainings given ──────────────────────
[✓] Nutrition basics    [ ] Handwashing
[ ] Breastfeeding       [ ] Family health

── Resources given ──────────────────────
Incaparina    [  2 ] [bag  ▾]   [×]
Milk          [  1 ] [litre▾]   [×]
              [+ Add resource]

── Questions ────────────────────────────
Does the family have chickens?   ( ) Yes (•) No
How many meals per day?          [  2 ]

── Notes & photos ───────────────────────
[                                        ]
[ 📷 Add photos ]

                        [Cancel]  [Save visit]
```

**Prefill rules** (from the source doc's *"should load from previous visit"*):

| Field | Default |
|---|---|
| Date | today |
| Location type | previous visit on this enrollment, else `SITE` |
| Site / Community | previous visit, else the subject's home community and its site |
| Trainings / resources | **never** prefilled — these are per-visit facts |

**Kind-specific block:**

| Kind | Fields |
|---|---|
| `PREGNANCY` | weight, months gestation, examination type |
| `NUTRITION` | weight, height, arm circumference + **live z-score badge** |
| `MIDWIFE` `STUDENT` `FAMILY_PAF` | none — spine only |

**Live z-score.** On the nutrition form, typing weight or height immediately renders the computed
`ZScoreBadge` plus the delta from the previous visit:

```
Weight (kg)          [  3.90 ]
Height (mm)          [   560 ]
Arm circumference    [   118 ]

  ● MODERATE    was SEVERE (+0.4 WFA)  ↑ improving
```

This is the *"severe → moderate"* transition the church reports on, surfaced to the worker at the
moment it happens.

**Resources** render as rows of `resource ▾ | quantity | unit ▾`, with the unit prefilled from
`resource.defaultUnit`. Quantity is numeric — never free text like `"1 bag"`.

**Questions** are driven by the `QuestionSet` attached to this program, rendered by `answerType`
(`TEXT` → input, `NUMBER` → numeric, `BOOL` → radio, `CHOICE` → select). The existing
`VisitQuestionsPanel` component is adapted to read from `question_set` by program instead of by
visit type, and to write `visit_answer` rows instead of JSON.

**Save** is one transaction: `visit` + kind detail + `visit_resource[]` + `visit_training[]` +
`visit_answer[]`.

---

## 8. Reports

`/reports` — an index of cards, each linking to `/reports/:slug`. Every report shares one filter bar
and a CSV export.

```
Reports
─────────────────────────────────────────
Date range [2026-01-01] → [2026-09-20]
Site [All ▾]   Program [All ▾]   [Apply]  [Export CSV]
```

Mapped directly from the source doc's *"DATA we can then filter"* list:

| Report | Slug | Source |
|---|---|---|
| Program census at date | `census` | `enrolledAt <= D AND (exitedAt IS NULL OR exitedAt > D)` |
| Entry vs exit weight | `weight-change` | `enrollment.entryWeight` / `exitWeight` |
| Graduations | `graduations` | `exitReason = 'GRADUATED'` + weight + age |
| Nutrition transitions | `transitions` | consecutive `nutritionalStatus` per enrollment |
| Newcomers per month | `newcomers` | `GROUP BY date_trunc('month', enrolledAt)` |
| Program attendance | `attendance` | `COUNT(visit) GROUP BY programId, siteId` |
| Visits per site | `visits-by-site` | `COUNT(visit) GROUP BY siteId` |
| Nutrition evaluations | `evaluations` | `COUNT(nutrition_visit_detail) GROUP BY siteId` |
| Home visits | `home-visits` | `locationType = 'HOME'` |
| Resources distributed | `resources` | `visit_resource` — covers kitchen gardens and chickens |
| Members by community / age | `demographics` | subject `communityId` + `birthDate` |
| Mother–infant incap pairs | `incap-pairs` | `child JOIN mother ON child.motherId` |

**Not available in V1:** *"How many mobile clinics and how many communities for each"* — needs event
attendance (`SCHEMA_V2.md` §11). The reports index shows this card **disabled** with the note
*"Coming in a future version"* rather than omitting it, so nobody assumes it was forgotten.

Each report is a table plus one chart where a chart adds meaning (trend lines for census and
newcomers, grouped bars for transitions). Charts use the `hv-*` palette.

---

## 9. Dashboard

`/` — the landing page, oriented around *what needs doing today*.

```
Buenos días, Caleb
─────────────────────────────────────────

   127          18            9           14 ⚠
 Enrolled   New this mo   Graduated    Overdue

─────────────────────────────────────────
⚠ NEEDS ATTENTION
  Ana Morales    Pregnancy   34 days since visit   →
  Pedro Vásquez  Nutrition   SEVERE, falling       →
  38 people not enrolled in any program            →

─────────────────────────────────────────
ENROLLED BY PROGRAM
  Expectant Mother   ████████████  42
  Nutrition Infant   █████████     31
  Nutrition Child    ███████       24
  Midwives           █████         18
  Youth              ███           12

─────────────────────────────────────────
RECENT VISITS
  2026-09-20  José Ramírez    Nutrition   3.9kg  MODERATE
  2026-09-20  María López     Pregnancy   64.1kg
```

Stat grid uses the borderless "Impact" pattern. **Needs attention** is the operational core: overdue
visits, deteriorating nutrition status, and the unenrolled backlog.

---

## 10. Admin

| Page | Change |
|---|---|
| `/admin/programs` | **NEW.** Create/edit program rows: name, kind, subject type, active, sort order, visit interval. Kind and subject type are locked after creation. |
| `/admin/communities` | Gains a **Site** column and selector. After migration every community needs one — show a `⚠ N communities have no site` banner until the count is zero. |
| `/admin/resources` | Gains a **Default unit** column. |
| `/admin/examination-types` | **NEW.** Standard lookup CRUD. |
| `/admin/question-sets` | Sets now attach to a **program**, not a visit type. Route loses `:visitType`. Questions gain an `answerType` selector. |
| `/admin/birthing-assistants` | Unchanged. Add a help note distinguishing BAs from midwives — this confusion is guaranteed otherwise. |
| `/admin/users` `/admin/sites` `/admin/language` | Unchanged. |

---

## 11. Component inventory

### Reuse as-is
`ZScoreBadge` · `PhotoUpload` · `PhotoGallery` · `SearchBar` · `MapPicker` · `ProtectedRoute` ·
`RoleGate` · everything in `components/ui`

### Rewrite
| Component | Change |
|---|---|
| `Layout` | Top nav → sidebar shell with data-driven program list and mobile drawer |
| `VisitQuestionsPanel` | Program-scoped sets; writes `visit_answer` rows instead of JSON; renders by `answerType` |

### New
| Component | Purpose |
|---|---|
| `StatStrip` | Borderless stat grid — dashboard and every program page |
| `EnrollmentCard` | Active/exited card with inline visit list, used on all four profile types |
| `SubjectPicker` | Type-scoped search + inline create, for the enroll wizard |
| `ProgramRosterTable` | Kind-aware columns, responsive card fallback |
| `VisitForm` | Kind-aware visit create/edit |
| `ResourceRow` | resource + quantity + unit, with add/remove |
| `TrainingPicker` | Checkbox grid of trainings |
| `WeightDelta` | `58.2 → 63.1  +4.9` with direction colouring |
| `OverdueBadge` | Day count, `hv-crisis` past the program's interval |
| `ExitReasonBadge` | Coloured badge per `ExitReason` |
| `SubjectTypeBadge` | Mother / Child / Person / Family chip for mixed lists |
| `Tabs` | Active / Exited / All |
| `EmptyState` | Icon + message + primary action |
| `FilterBar` | Shared date-range / site / program / community filters |

### Delete
All of `pages/parents/*`, all of `pages/visits/*` (replaced by the enrollment-scoped visit pages),
`pages/families/FamiliesTable.tsx` (superseded by `ProgramRosterTable` and the generic list pages),
and `api/parents.ts`.

### New API clients
`programs.ts` · `enrollments.ts` · `mothers.ts` · `people.ts` · `reports.ts` · `events.ts`
`visits.ts` is rewritten around enrollment-scoped endpoints.

---

## 12. Judgment calls — override any of these

These were decided without asking. Each is cheap to change now and expensive later.

1. **Profile = enrollment cards**, not a merged cross-program timeline. Chosen because it mirrors
   the data model and keeps a second pregnancy cleanly separate. A merged chart-style timeline would
   read better for clinical history but makes "which program am I adding a visit to?" ambiguous.
2. **`+ Visit` lives on the enrollment card**, never on the profile header — this is what removes
   that ambiguity.
3. **Enroll is a 2-step wizard**, not one long form, so the subject search and the admission data
   don't compete for attention.
4. **Inline subject creation** inside the wizard, so admission is never blocked by a missing record.
5. **Program roster columns vary by kind.** A shared column set would show empty Status columns for
   Midwives and Youth.
6. **Z-scores computed live client-side**, recomputed server-side on save. Same shared functions, so
   they cannot disagree.
7. **Reports are server-rendered tables + CSV**, not an interactive query builder.
8. **The unavailable mobile-clinic report is shown disabled**, not hidden.
9. **Exits are reversible by SUPERVISOR.** Workers will mis-click `DIED`.
10. **Site is displayed but never selected** on subject forms — it derives from community
    (`SCHEMA_V2.md` §6.7). Visit forms *do* let you pick both, because a visit can happen away from
    home.

---

## 13. Schema addendum required by this design

The overdue indicator on the program roster and dashboard needs a per-program cadence, which
`SCHEMA_V2.md` does not yet define:

```prisma
model Program {
  // ...
  visitIntervalDays Int? @map("visit_interval_days")  // null = never flag overdue
}
```

`Midwives`, `Youth` and `PAF` would leave this null. Nutrition and Pregnancy set it to 30.

Also still open from `SCHEMA_V2.md` §12 and relevant to the UI:
- **Nutrition age bands** (`minAgeMonths` / `maxAgeMonths` on `Program`) would let the enroll wizard
  warn when a child is being put in the wrong nutrition program, and let the roster flag children
  who have aged out. Recommended.
- **Gestation months** — currently a manual input on the pregnancy visit form. If it turns out to be
  derivable from `dueDate`, it becomes read-only.

---

## 14. Build order

1. `Layout` sidebar shell + routing skeleton with placeholder pages.
2. `/admin/programs` + seed the six program rows — nothing else works without programs.
3. Subject list and profile pages (mothers, children, people, families) with empty enrollment
   sections.
4. Enroll wizard + `EnrollmentCard`.
5. `VisitForm` + visit detail, one kind at a time: Nutrition, Pregnancy, then the spine-only kinds.
6. Program roster with stats and filters.
7. Dashboard.
8. Reports.
9. Remaining admin pages.
10. Events.

Every page gets a render test in `pages/__tests__/` per the existing convention.
