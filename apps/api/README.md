# CatchUp API

NestJS, Prisma, and PostgreSQL backend for CatchUp. The API listens on port
`3001` by default and accepts browser and Socket.io traffic from the configured
`WEB_ORIGIN` (normally `http://localhost:3000`).

## Local setup

1. From the repository root, copy `.env.example` to `.env`, set the required
   Docker credentials, and start PostgreSQL:

   ```bash
   docker compose -f docker-compose.dev.yml up -d postgres
   ```

2. In this directory, install dependencies and copy `.env.example` to `.env`.
   Set `DATABASE_URL` to match the root Docker credentials and set a long,
   deployment-only `JWT_SECRET` with at least 32 characters.

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

Set `CATCHUP_SEED_PASSWORD` in the local API `.env` to at least 12
non-whitespace characters, then run:

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
| PostgreSQL | `127.0.0.1:5434` |
| Test PostgreSQL | `127.0.0.1:5433` |
| pgAdmin | `http://127.0.0.1:5050` |
