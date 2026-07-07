# Scheduling Platform

A Doodle-style multi-project scheduling platform built with Next.js 14 (App Router), TypeScript, Tailwind CSS, and PostgreSQL via Prisma.

**Prerequisite**: Node.js ≥20 (tested on v24.18.0) and a running PostgreSQL instance (16 or 18).

## Quick start (native PostgreSQL)

```bash
# 1. Create the database user and database
psql -U postgres -c "CREATE USER scheduler WITH PASSWORD 'scheduler' CREATEDB;"
psql -U postgres -c "CREATE DATABASE scheduler OWNER scheduler;"

# 2. Grant schema permissions
psql -U postgres -d scheduler -c "GRANT ALL ON SCHEMA public TO scheduler;"
psql -U postgres -d scheduler -c "ALTER SCHEMA public OWNER TO scheduler;"

# 3. Install dependencies (also runs prisma generate)
npm install

# 4. Run database migrations
npx prisma migrate dev

# 5. Seed with demo data
npx prisma db seed

# 6. Start the dev server
npm run dev
```

## Quick start (Docker)

```bash
# 1. Start the database
docker compose up -d

# 2. Install dependencies (also runs prisma generate)
npm install

# 3. Run database migrations
npx prisma migrate dev

# 4. Seed with demo data
npx prisma db seed

# 5. Start the dev server
npm run dev
```

Then open:
- `http://localhost:3000` — landing page
- `http://localhost:3000/admin/projects` — Super Admin project management
- `http://localhost:3000/admin/availability/senior-pm-interview` — Admin availability grid
- `http://localhost:3000/book/senior-pm-interview` — Participant booking page

> **Port note**: This development environment runs native PostgreSQL 18 on port **5433** (Docker Desktop's Hyper-V/WSL2 dependency is unavailable). If your Docker or native instance uses a different port, update `DATABASE_URL` in `.env` accordingly.

## Tech stack

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Database**: PostgreSQL (via Docker Compose or native installation)
- **ORM**: Prisma 7
- **Icons**: lucide-react

## Prisma 7 & Node.js compatibility

This project uses **Prisma 7** (≥7.8.0). Key differences from Prisma 5/6:

- **`url` removed from `schema.prisma`** — the datasource block no longer has a `url` field. The connection string is configured in `prisma.config.ts` via `env("DATABASE_URL")`.
- **`prisma.config.ts`** — new mandatory file at project root, read by all Prisma CLI commands. Contains the datasource URL, migration path, and seed command.
- **`PrismaClient` needs an adapter** — the constructor requires `{ adapter }` (provided by `@prisma/adapter-pg` wrapping a `pg.Pool`). The `lib/db.ts` singleton handles this.
- **Seed config moved** — from `package.json`'s `prisma.seed` block into `prisma.config.ts` under `migrations.seed`.
- **Node.js ≥20 required**; tested on v24.18.0. With Node 24, install Prisma ≥7 (earlier versions fail with `assertNodeAPISupported`).

## Project structure

```
scheduler-app/
  app/
    page.tsx                         Landing page
    book/[project]/page.tsx          Participant booking
    admin/projects/page.tsx          Super Admin project list
    admin/projects/new/page.tsx      Create project
    admin/projects/[project]/edit/   Edit project
    admin/availability/[project]/    Admin availability grid
    api/availability/                Availability data API
    api/admins/                      Admin directory API
  components/
    BookingFlow.tsx                  Booking UI (calendar → slots → confirmation)
    AvailabilityGrid.tsx             Doodle-style availability grid with drag-select
    ProjectForm.tsx                  Create/edit project form
  lib/
    db.ts                            Prisma client singleton (Prisma 7 adapter-based)
    slotHelpers.ts                   Pure calculation functions (slot generation, admin assignment)
    data/
      projects.ts                    Project CRUD (database layer)
      admins.ts                      Admin directory queries
      availability.ts                Admin availability queries + consolidation
    actions.ts                       Server Actions for client-side mutations
  prisma/
    schema.prisma                    Database schema (no datasource.url — moved to prisma.config.ts)
    seed.ts                          Seed script with demo data
  prisma.config.ts                   Prisma CLI config (datasource URL, seed command, migration path)
  docker-compose.yml                 PostgreSQL container config
```

## Database

The app requires a running PostgreSQL instance (16 or 18). Two paths are supported:

### Option A — Docker

```bash
docker compose up -d
```

The provided `docker-compose.yml` starts PostgreSQL on port **5432** with user `scheduler`, password `scheduler`, and database `scheduler`.

### Option B — Native PostgreSQL (no Docker)

Install PostgreSQL via your platform's package manager, start the service, then:

```bash
# Create user and database
psql -U postgres -c "CREATE USER scheduler WITH PASSWORD 'scheduler' CREATEDB;"
psql -U postgres -c "CREATE DATABASE scheduler OWNER scheduler;"

# Grant schema permissions
psql -U postgres -d scheduler -c "GRANT ALL ON SCHEMA public TO scheduler;"
psql -U postgres -d scheduler -c "ALTER SCHEMA public OWNER TO scheduler;"
```

The database URL is configured in `.env`:

```
DATABASE_URL="postgresql://scheduler:scheduler@localhost:5433/scheduler?schema=public"
```

The default port in `.env` is **5433** (this project's environment uses a native PostgreSQL 18 install on the non-default port because Docker Desktop cannot start when Hyper-V/WSL2 is unavailable). Change to `5432` if your Docker or native instance uses the default port.

### Resetting the database

```bash
npx prisma migrate reset --force
npx prisma db seed
```

## Architecture

- **Server Components** fetch data directly via async data-access functions in `lib/data/`.
- **Client Components** that mutate data call Server Actions in `lib/actions.ts`, which invoke the data-access layer and revalidate the Next.js cache.
- Pure calculation helpers (`generateSystemSlotGrid`, `buildSlotsForDate`, `assignAdmin`) live in `lib/slotHelpers.ts` — they have no database dependency.

## Seeded demo data

- **Admins**: 10 mock people (Priya Nair, Marcus Webb, Jo Ellery, Sam Torres, Lina Chen, Omar Hassan, Kate Brooks, Raj Patel, Fiona O'Sullivan, Derek Kim)
- **Project**: "Senior PM — Round 1 Interview" (Northwind Labs) — 45 min slots, weekdays only, 09:00–16:00
- **Availability**: Priya Nair has 12 pre-seeded availability slots across four days

## Planned features (not yet built)

- Microsoft Graph integration for Teams meeting + calendar creation
- Entra ID authentication
- Participant tokenized invite links
- Email notifications
- Reporting dashboard
