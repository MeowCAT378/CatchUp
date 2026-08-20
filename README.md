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

3. Copy `apps/api/.env.example` to `apps/api/.env`. Set `DATABASE_URL` using
   the same PostgreSQL database, user, and URL-encoded password from the root
   `.env`, then set a long, random `JWT_SECRET`.
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
| PostgreSQL | `127.0.0.1:5434` |
| Test PostgreSQL (`test` profile) | `127.0.0.1:5433` |
| pgAdmin | `http://127.0.0.1:5050` |
