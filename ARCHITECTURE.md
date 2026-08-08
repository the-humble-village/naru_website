# Architecture

## System Overview

NaruProject is a full-stack family health tracking system for community health workers ("Humble Village"). It is a pnpm + Turborepo monorepo with three packages: a shared validation/i18n library, a Hono REST API backend, and a React SPA frontend. An Android app (Kotlin + Jetpack Compose) exists as a separate Gradle project.

---

## Monorepo Package Diagram

```mermaid
graph TD
    subgraph Monorepo["HumbleVillageWebAppOpen (pnpm workspaces + Turborepo)"]
        shared["@naru/shared<br/>Zod schemas · health utils · i18n"]
        backend["@naru/backend<br/>Hono REST API · Prisma ORM"]
        web["@naru/web<br/>React SPA · Vite · Tailwind"]
        android["android/<br/>Kotlin + Jetpack Compose"]
    end

    shared -->|"imported by"| backend
    shared -->|"imported by"| web
    backend -->|"REST API (/api)"| web
    backend -->|"REST API (/api/sync)"| android
```

---

## Tech Stack

```mermaid
graph LR
    subgraph Frontend
        React["React 18"]
        Vite["Vite"]
        RR["React Router v6"]
        TQ["TanStack Query"]
        Zustand["Zustand"]
        Tailwind["Tailwind CSS"]
        Axios["Axios"]
    end

    subgraph Backend
        Hono["Hono"]
        Prisma["Prisma"]
        Zod["Zod (@hono/zod-validator)"]
        JWT["JWT (access 1h + refresh 30d)"]
    end

    subgraph Database
        PG["PostgreSQL 16"]
    end

    subgraph Shared
        ZodShared["Zod Schemas"]
        Health["WHO Health Utils"]
        i18n["i18n (en/es)"]
    end

    React --> Axios --> Hono --> Prisma --> PG
    Hono --> Zod
    Hono --> JWT
    ZodShared --> Zod
    ZodShared --> React
```

---

## Backend Architecture

```mermaid
graph TD
    Request["HTTP Request"]

    subgraph Middleware["Middleware Chain"]
        Auth["auth.ts<br/>JWT → c.var.user"]
        Role["role.ts<br/>requireRole / requireAdmin / requireSupervisor"]
        SoftDel["soft-delete.ts<br/>Prisma middleware (auto-filter deletedAt)"]
    end

    subgraph Routes["Route Handlers (src/routes/)"]
        AuthR["auth.ts"]
        FamiliesR["families.ts"]
        ChildrenR["children.ts"]
        ParentsR["parents.ts"]
        ChildVisitsR["child-visits.ts"]
        FamilyVisitsR["family-visits.ts"]
        UsersR["users.ts"]
        AdminR["admin.ts"]
        DashboardR["dashboard.ts"]
        SearchR["search.ts"]
        FilesR["files.ts"]
        SyncR["sync.ts"]
        BAR["birthing-assistants.ts"]
        QSetsR["question-sets.ts"]
        SitesR["sites.ts"]
        end

    subgraph Services["Service Layer (src/services/)"]
        AuthS["auth.service.ts"]
        FamilyS["family.service.ts"]
        ChildS["child.service.ts"]
        ParentS["parent.service.ts"]
        ChildVisitS["child-visit.service.ts"]
        FamilyVisitS["family-visit.service.ts"]
        UserS["user.service.ts"]
        AdminS["admin.service.ts"]
        DashS["dashboard.service.ts"]
        SearchS["search.service.ts"]
        FileS["file.service.ts"]
        SyncS["sync.service.ts"]
        BAS["birthing-assistant.service.ts"]
        QSetS["question-set.service.ts"]
        SiteS["site.service.ts"]
    end

    DB["Prisma Client (db.ts) → PostgreSQL"]

    Request --> Auth --> Role --> SoftDel
    SoftDel --> Routes
    Routes --> Services --> DB
```

---

## API Routes

```mermaid
graph LR
    subgraph Public["/api/auth (public)"]
        Login["POST /login"]
        Register["POST /register"]
        Refresh["POST /refresh"]
    end

    subgraph Protected["Protected (auth required)"]
        subgraph AnyRole["Any Role"]
            Dashboard["GET /api/dashboard"]
            Search["GET /api/search"]
            Health["GET /api/health"]
            Lang["GET /api/admin/language"]
        end

        subgraph FamilyTree["Family Tree (CASEWORKER+)"]
            Families["GET|POST /api/families<br/>GET|PUT|DELETE /api/families/:id"]
            Parents["GET|POST /api/families/:id/parents<br/>GET|PUT /api/families/:id/parents/:pid"]
            Children["GET|POST /api/families/:id/children<br/>GET|PUT /api/families/:id/children/:cid"]
            ChildVisits["GET|POST .../children/:cid/visits<br/>GET|PUT .../visits/:vid"]
            FamilyVisits["GET|POST /api/families/:id/visits<br/>GET|PUT .../visits/:vid"]
        end

        subgraph SupervisorPlus["SUPERVISOR+"]
            BA["GET|POST|PUT|DELETE /api/birthing-assistants"]
        end

        subgraph AdminOnly["ADMIN only"]
            Users["GET|POST|PUT|DELETE /api/users"]
            AdminLookups["GET|POST|PUT|DELETE /api/admin/:table"]
            Sites["GET|POST|PUT|DELETE /api/sites"]
            QSets["GET|POST|PUT|DELETE /api/question-sets"]
        end
    end

    subgraph MobileSync["Mobile Sync"]
        Sync["POST /api/sync"]
    end
```

---

## Database Schema

```mermaid
erDiagram
    User {
        string id
        string localId
        string login
        string email
        string firstName
        string lastName
        string passwordHash
        Role role
        string lang
        datetime createdAt
        datetime updatedAt
        datetime deletedAt
    }

    Family {
        string id
        string localId
        string familyName
        bool childrenEditable
        bool inCrisis
        string notes
        string communityId
        string siteId
        string birthingAssistantId
        datetime createdAt
        datetime updatedAt
        datetime deletedAt
    }

    Parent {
        string id
        string localId
        string familyId
        string name
        string role
        datetime birthDate
        datetime dateEntered
        string photoId
        string reasonEnroll
        datetime dueDate
        string notes
        datetime createdAt
        datetime updatedAt
        datetime deletedAt
    }

    Child {
        string id
        string localId
        string familyId
        string name
        datetime birthDate
        Sex sex
        datetime dateEntered
        string photoId
        float weight
        string nutritionalState
        string reasonEnrollment
        string observations
        datetime createdAt
        datetime updatedAt
        datetime deletedAt
    }

    ChildVisit {
        string id
        string localId
        string familyId
        string childId
        datetime visitDate
        float weight
        float armCircumference
        float height
        bool incap
        bool leche
        json questions
        string bagsGiven
        string recvAnyMedicine
        string leftFromProg
        string passedAway
        string notes
        datetime createdAt
        datetime updatedAt
        datetime deletedAt
    }

    FamilyVisit {
        string id
        string localId
        string familyId
        datetime visitDate
        json trainingsReceived
        json resourcesReceived
        json questions
        string notes
        datetime createdAt
        datetime updatedAt
        datetime deletedAt
    }

    BirthingAssistant {
        string id
        string localId
        string name
        datetime createdAt
        datetime updatedAt
        datetime deletedAt
    }

    Community {
        string id
        string title
        datetime createdAt
        datetime updatedAt
        datetime deletedAt
    }

    Site {
        string id
        string title
        float lat
        float lng
        json boundary
        datetime createdAt
        datetime updatedAt
        datetime deletedAt
    }

    Resource {
        string id
        string title
        datetime createdAt
        datetime updatedAt
        datetime deletedAt
    }

    Training {
        string id
        string title
        datetime createdAt
        datetime updatedAt
        datetime deletedAt
    }

    File {
        string id
        string hash
        string extension
        datetime createdAt
    }

    Family ||--o{ Parent : "has many"
    Family ||--o{ Child : "has many"
    Family ||--o{ FamilyVisit : "has many"
    Family }o--o| Community : "belongs to"
    Family }o--o| Site : "belongs to"
    Family }o--o| BirthingAssistant : "belongs to"
    Child ||--o{ ChildVisit : "has many"
    Parent }o--o| File : "photo"
    Child }o--o| File : "photo"
    BirthingAssistant }o--o{ Community : "serves (junction)"
    BirthingAssistant }o--o{ Training : "received (junction)"
```

---

## Frontend Architecture

```mermaid
graph TD
    subgraph Router["React Router v6 (App.tsx)"]
        Public["Public Routes<br/>/login"]
        Protected["ProtectedRoute (redirects if not authed)"]
    end

    subgraph Layout["Layout.tsx (Nav sidebar shell)"]
        Dashboard["/  →  DashboardPage"]

        subgraph FamiliesGroup["Family Routes"]
            Families["/families  →  FamiliesPage"]
            FamilyDetail["/families/:id  →  FamilyDetailPage"]
            AddFamily["/families/new  →  AddFamilyPage"]
            AddChild["/families/:id/children/new"]
            ChildDetail["/families/:id/children/:cid"]
            AddChildVisit[".../visits/new"]
            ChildVisitDetail[".../visits/:vid"]
            AddParent["/families/:id/parents/new"]
            ParentDetail["/families/:id/parents/:pid"]
            AddFamilyVisit["/families/:id/visits/new"]
            FamilyVisitDetail["/families/:id/visits/:vid"]
        end

        subgraph AdminGroup["Admin Routes (role-gated via RoleGate)"]
            AdminPage["/admin  →  SUPERVISOR+"]
            AdminUsers["/admin/users  →  ADMIN"]
            AdminBA["/admin/birthing-assistants  →  SUPERVISOR+"]
            AdminLang["/admin/language  →  any role"]
            AdminSites["/admin/sites  →  ADMIN"]
            AdminQSets["/admin/question-sets/:type  →  ADMIN"]
            AdminLookups["/admin/:table  →  ADMIN"]
        end
    end

    subgraph State["State Management"]
        AuthStore["Zustand: useAuthStore<br/>user · tokens · role · lang"]
        TanStack["TanStack Query<br/>server state cache"]
    end

    subgraph APILayer["API Layer (src/api/)"]
        AxiosClient["client.ts<br/>Axios + JWT interceptor + silent refresh"]
        APIModules["familiesApi · childrenApi · parentsApi<br/>visitsApi · usersApi · adminApi · etc."]
    end

    Protected --> Layout
    Layout --> State
    APILayer --> TanStack
    AxiosClient --> APIModules
```

---

## Authentication Flow

```mermaid
sequenceDiagram
    participant User
    participant Frontend
    participant Backend
    participant DB

    User->>Frontend: POST /login (login + password)
    Frontend->>Backend: POST /api/auth/login
    Backend->>DB: Lookup user by login
    DB-->>Backend: User record
    Backend->>Backend: bcrypt.compare(password, hash)
    Backend-->>Frontend: { user, accessToken (1h), refreshToken (30d) }
    Frontend->>Frontend: Store tokens in Zustand + localStorage

    Note over Frontend,Backend: Subsequent requests
    Frontend->>Backend: GET /api/families (Authorization: Bearer <accessToken>)
    Backend->>Backend: auth middleware: verify JWT
    Backend-->>Frontend: 200 { items, total, ... }

    Note over Frontend,Backend: Token expiry
    Frontend->>Backend: GET /api/families (expired token)
    Backend-->>Frontend: 401 Unauthorized
    Frontend->>Backend: POST /api/auth/refresh (refreshToken)
    Backend-->>Frontend: { accessToken (new) }
    Frontend->>Backend: GET /api/families (retry with new token)
    Backend-->>Frontend: 200 { items, total, ... }
```

---

## Mobile Sync Flow

```mermaid
sequenceDiagram
    participant Android
    participant Backend
    participant DB

    Note over Android: User works offline
    Android->>Android: Create Family/Parent/Child/Visit (stored with localId)

    Note over Android: Connection restored
    Android->>Backend: POST /api/sync { lastSyncedAt, changes[] }
    Backend->>Backend: Begin transaction
    Backend->>DB: Create Family (by localId, skip duplicates)
    Backend->>DB: Create Parents (by localId)
    Backend->>DB: Create Children (by localId)
    Backend->>DB: Create FamilyVisits / ChildVisits / ParentVisits (by localId)
    Backend->>Backend: Commit transaction
    Backend-->>Android: { syncedAt, results[], serverChanges: { …, parentVisits[], deleted[], lookups } }
```

### Client contract

**Push** — `changes[]` carries `create` only; edits and deletes are online-only.
Syncable entities: `family`, `parent`, `child`, `familyVisit`, `childVisit`,
`parentVisit`, `birthingAssistant`. The server sorts a batch into dependency
order itself, so send order doesn't matter.

Records created offline have no server ids, so foreign keys are named by
localId instead:

- `parentLocalId` on the change — the owning **Family** (legacy, still honoured)
- `localRefs: { familyId?, parentId?, childId? }` — any of those columns, by the
  target record's localId

Each reference resolves against the current batch first, then the database, so
retrying a batch whose earlier half already committed is safe (those changes come
back as `already_exists`).

**Pull** — `serverChanges` holds every record with `updatedAt > lastSyncedAt`,
plus all lookup tables in full, plus `deleted[]`: tombstones
(`{ entity, id, localId, deletedAt }`) for records soft-deleted since
`lastSyncedAt`. Soft-deleted rows are filtered out of every other array, so a
client that ignores `deleted[]` keeps deleted records forever. `deleted[]` is
empty on a first sync (`lastSyncedAt: null`), since there is nothing local to
drop. Tombstones cover the lookup tables too.

---

## RBAC (Role-Based Access Control)

```mermaid
graph TD
    ADMIN["ADMIN<br/>(highest)"]
    SUPERVISOR["SUPERVISOR"]
    CASEWORKER["CASEWORKER<br/>(lowest)"]

    ADMIN -->|"includes"| SUPERVISOR
    SUPERVISOR -->|"includes"| CASEWORKER

    CASEWORKER -->|"can"| CW1["CRUD own assigned families"]
    CASEWORKER -->|"can"| CW2["CRUD children + parents in assigned families"]
    CASEWORKER -->|"can"| CW3["Record child + family visits"]

    SUPERVISOR -->|"additionally"| SV1["View ALL families"]
    SUPERVISOR -->|"additionally"| SV2["Soft-delete families"]
    SUPERVISOR -->|"additionally"| SV3["Manage birthing assistants"]

    ADMIN -->|"additionally"| AD1["Manage users (create, edit, delete)"]
    ADMIN -->|"additionally"| AD2["Manage lookup tables (community, site, resource, training)"]
    ADMIN -->|"additionally"| AD3["Manage question sets"]
    ADMIN -->|"additionally"| AD4["Manage sites"]
```

---

## Shared Package Dependency Graph

```mermaid
graph LR
    subgraph shared["@naru/shared (src/)"]
        Schemas["schemas/<br/>user · family · child · parent<br/>child-visit · family-visit<br/>birthing-assistant · file<br/>lookups · dashboard · sync<br/>search · health · question-sets"]
        Health["health/<br/>zscore.ts · who-data.ts"]
        I18n["i18n/<br/>en.ts · es.ts · t(key, lang)"]
        SharedIndex["index.ts (barrel)"]
    end

    Schemas --> SharedIndex
    Health --> SharedIndex
    I18n --> SharedIndex

    SharedIndex -->|"Zod schemas + types"| BackendRoutes["@naru/backend routes + services"]
    SharedIndex -->|"Zod schemas + types"| FrontendAPI["@naru/web api/ + pages/"]
    SharedIndex -->|"Health utils"| FrontendPages["@naru/web ZScoreBadge.tsx + visit pages"]
    SharedIndex -->|"t(key, lang)"| FrontendI18n["@naru/web (language switching)"]
```
