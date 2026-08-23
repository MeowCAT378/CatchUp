# Production Dependency Advisories

**Reviewed:** 2026-08-23

## Status

`apps/api` uses two narrowly scoped npm overrides:

| Advisory | Dependency path | Resolution |
| --- | --- | --- |
| `GHSA-w5hq-g745-h8pq` | `exceljs -> uuid` | Override ExcelJS's transitive dependency to `uuid@11.1.1`. |
| `GHSA-ggr8-5vv4-36mx` | `prisma -> @prisma/config -> deepmerge-ts` | Override only `@prisma/config` to `deepmerge-ts@8.0.2`. |

Both overrides were installed in separate disposable copies before the real
lockfile was changed. The UUID probe passed dependency resolution, all API unit
and PostgreSQL E2E tests (including XLSX export), API build, and production
audit. The deepmerge probe passed Prisma validate/generate/migration status,
all API unit and PostgreSQL E2E tests, API build, both Docker targets, clean
database migration, runtime startup, and readiness.

The API runtime image installs with `--omit=dev --omit=optional`; it contains
neither the Prisma CLI nor `deepmerge-ts`. The migration image intentionally
retains the verified Prisma toolchain for the controlled one-shot
`prisma migrate deploy` release step.

## Revisit triggers

- Remove either override when its direct parent ships a compatible fixed range.
- Repeat the full relevant matrix whenever ExcelJS, Prisma, or either override
  changes.
- Do not use `npm audit fix --force` to accept a Prisma downgrade or unrelated
  breaking dependency change.
