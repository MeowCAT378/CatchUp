# CatchUp

CatchUp is a two-application quiz and audience-participation platform:

- `apps/api`: NestJS, Prisma, PostgreSQL, and Socket.io on port `3001`
- `apps/web`: Next.js and Auth.js on port `3000`

## Local setup

Prerequisites are Node.js with npm and Docker Compose.

1. Copy the root `.env.example` to `.env`. Set strong, unique values for the
   blank PostgreSQL and pgAdmin passwords. Docker Compose requires these local
   values and does not provide credential defaults.
2. Start the database (and optional pgAdmin):

   ```bash
   docker compose -f docker-compose.dev.yml up -d postgres pgadmin
   ```

3. Copy `apps/api/.env.example` to `apps/api/.env`. Set `DATABASE_URL` and
   `DIRECT_URL` to the same local PostgreSQL URL using the database, user, and
   URL-encoded password from the root `.env`, then set a long, random
   `JWT_SECRET`.
   `JWT_SECRET` must contain at least 32 characters.
4. Copy `apps/web/.env.example` to `apps/web/.env.local` and replace its
   `NEXTAUTH_SECRET` placeholder with a long, random value.
5. Install, migrate, and run the API:

   ```bash
   cd apps/api
   npm install
   npx prisma generate
   npx prisma migrate deploy
   npm run dev
   ```

6. In another terminal, install and run the web app:

   ```bash
   cd apps/web
   npm install
   npm run dev
   ```

Open `http://localhost:3000`. See `apps/api/README.md` for seeding, guarded E2E
tests, migration development, and verification commands.

## Local-only services

Compose binds PostgreSQL, the opt-in test database, and pgAdmin to
`127.0.0.1`; they are not published on every host interface.

| Service | Address |
| --- | --- |
| Web | `http://localhost:3000` |
| API | `http://localhost:3001` |
| PostgreSQL | `127.0.0.1:5432` |
| Test PostgreSQL (`test` profile) | `127.0.0.1:5433` |
| pgAdmin | `http://127.0.0.1:5050` |

## Supabase + Vercel staging

Create two Vercel projects from this repository. Set their Root Directories to
`apps/api` (NestJS) and `apps/web` (Next.js). Use Vercel's native framework
builds; the Dockerfiles remain for container deployments and local production
verification.

In Supabase, open **Connect** and copy two PostgreSQL URIs for a dedicated
Prisma database role:

- Transaction pooler, port `6543`: API `DATABASE_URL`. Append
  `pgbouncer=true&connection_limit=1` while preserving existing query values.
- Session pooler, port `5432` (or direct connection when IPv6 is available):
  `DIRECT_URL`, used only by Prisma migrations.

Do not add Supabase browser keys. CatchUp accesses PostgreSQL through NestJS and
Prisma, not the Supabase Data API. Disable the Data API for this staging project
if no other client needs it.

Configure the API Vercel project with:

```env
DATABASE_URL=
DIRECT_URL=
JWT_SECRET=
WEB_ORIGIN=https://<staging-web-domain>
TRUST_PROXY_HOPS=1
NODE_ENV=production
```

Configure the Web Vercel project with:

```env
NEXT_PUBLIC_API_URL=https://<staging-api-domain>
NEXT_PUBLIC_SOCKET_URL=https://<staging-api-domain>
NEXTAUTH_URL=https://<staging-web-domain>
NEXTAUTH_SECRET=
```

Run migrations once from a trusted release shell or job before promoting the
application. Never use `prisma migrate dev` against Supabase staging:

```bash
cd apps/api
npx prisma migrate deploy
```

Vercel WebSockets require WebSocket-only Socket.IO transport, which the client
uses. Current Socket.IO rooms, connection presence, and rate-limit buckets are
still process-local. A Vercel API can split new connections across instances
and recycle established connections at the function duration limit, so reliable
multi-instance classroom sessions require a shared Socket.IO adapter/presence
store and shared rate limiting. Until then, use one long-lived API container for
reliable staging or treat the Vercel API as a limited smoke-test target.
