# CatchUp API

NestJS, Prisma, and PostgreSQL backend for CatchUp. The API listens on port
`3001` by default and accepts browser and Socket.io traffic from the configured
`WEB_ORIGIN` (normally `http://localhost:3000`).

`TRUST_PROXY_HOPS` defaults to `0`. Set it to the exact number of trusted
reverse-proxy hops (maximum `10`) only when every path to the API has that
topology. The last trusted proxy must remove or overwrite incoming
`X-Forwarded-For`, `X-Forwarded-Host`, and `X-Forwarded-Proto` headers. HTTP
and Socket.io use the same setting. Rate limits are process-local and therefore
support the current single-API-instance deployment only.

## Local setup

1. From the repository root, copy `.env.example` to `.env`, set the required
   Docker credentials, and start PostgreSQL:

   ```bash
   docker compose -f docker-compose.dev.yml up -d postgres
   ```

2. In this directory, install dependencies and copy `.env.example` to `.env`.
   Set `DATABASE_URL` and `DIRECT_URL` to the same local connection string,
   matching the root Docker credentials, and set a long, deployment-only
   `JWT_SECRET` with at least 32 characters.

3. Prepare the database and start the API:

   ```bash
   npm install
   npx prisma generate
   npx prisma migrate deploy
   npm run dev
   ```

Use `npx prisma migrate dev` instead of `migrate deploy` when authoring a new
development migration.

## Development seed

Set `CATCHUP_SEED_ADMIN_PASSWORD` and `CATCHUP_SEED_KAZUMA_PASSWORD` in the
local API `.env` to non-whitespace development passwords, then run:

```bash
npm run seed
```

The seed is idempotent and runs only when `NODE_ENV` is explicitly
`development` or `test`. It fails closed for missing or other environment
values and never prints the supplied password.

## Verification

```bash
npm run lint
npm test
npm run test:seed
npm run build
```

`npm run lint` is read-only. Use `npm run lint:fix` only when you intend to
rewrite files.

For PostgreSQL E2E tests, start the isolated test service from this directory:

```bash
docker compose -f ../../docker-compose.dev.yml --profile test up -d postgres-test
```

Set `CATCHUP_TEST_DATABASE_URL` in the current shell to the value documented in
`.env.test.example`, then run:

```bash
npm run test:e2e:setup
npm run test:e2e
```

The guarded runner refuses any database URL whose database name does not
contain `test`. Browser E2E scripts additionally require the API and web app to
be running.

## Local ports

| Service | Address |
| --- | --- |
| API | `http://localhost:3001` |
| Web origin | `http://localhost:3000` |
| PostgreSQL | `127.0.0.1:5432` |
| Test PostgreSQL | `127.0.0.1:5433` |
| pgAdmin | `http://127.0.0.1:5050` |

## Production image

Build the API runtime and explicit migration target from this directory:

```bash
docker build --target runtime -t catchup-api .
docker build --target migrate -t catchup-api-migrate .
docker run --rm --env-file .env catchup-api-migrate
docker run --rm --env-file .env -p 3001:3001 catchup-api
```

Run the migration image once during a controlled release. The API process does
not apply migrations on startup. `GET /health/live` checks only the process;
`GET /health/ready` verifies PostgreSQL with `SELECT 1`.

For Supabase staging, use the transaction pooler URL for `DATABASE_URL` and the
session pooler or direct URL for `DIRECT_URL`. Run only `npx prisma migrate
deploy` against staging; `prisma migrate dev` is for local migration authoring.
