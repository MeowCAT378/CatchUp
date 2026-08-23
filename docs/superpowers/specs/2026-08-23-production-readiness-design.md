# CatchUp Production Readiness Design

**Date:** 2026-08-23

**Status:** Approved

## Goal

Make the existing CatchUp modular monolith deployable as separate API and Web production containers, expose deterministic liveness/readiness signals, preserve correct client identity behind an explicitly trusted reverse proxy, resolve or formally mitigate the two known dependency advisory chains, and prove concurrent room behavior against PostgreSQL and Socket.io.

## Constraints

- Keep all work isolated on `codex/dev2`; do not merge, push, or create a pull request.
- Preserve all REST paths, response envelopes, Socket.io event names, participant identity, scoring, result visibility, and retained history behavior.
- Keep the NestJS API and Next.js Web applications separately deployable.
- Keep rate limiting process-local for the current single-instance on-premise target.
- Do not add Redis, a production reverse proxy, Kubernetes, a production Compose stack, or another ORM.
- Do not run migrations automatically on every API process start.
- Do not force an incompatible dependency downgrade.
- Do not retain a transitive dependency override unless its owning integration passes its focused and full verification.

## Runtime Containers

### API

`apps/api/Dockerfile` uses multi-stage `node:24-bookworm-slim` builds:

1. `deps` installs the locked dependency tree.
2. `build` generates Prisma Client and builds NestJS.
3. `migrate` retains the Prisma CLI and migrations solely for the trusted one-shot `prisma migrate deploy` release step.
4. `runtime` installs production dependencies, copies only `dist` and the generated Prisma runtime, runs as the built-in non-root `node` user, exposes port `3001`, and checks `/health/live` with Node's built-in HTTP client.

The default final image is `runtime`. Database migration is an explicit deployment operation using the `migrate` target, matching Prisma's recommendation to run `prisma migrate deploy` as a release/CI action rather than on every application restart.

### Web

`apps/web/Dockerfile` uses Next.js `output: "standalone"` with a multi-stage `node:24-bookworm-slim` build. It accepts `NEXT_PUBLIC_API_URL` as a build argument, copies the standalone server, static assets, and public assets into a non-root runtime image, exposes port `3000`, and checks `/api/health`.

The configured public API URL must be reachable by both browsers and the Web container. An internal-only API URL or production reverse-proxy implementation is outside this change.

Each application receives its own `.dockerignore` so local dependencies, build artifacts, logs, tests, and secret-bearing `.env` files never enter the Docker build context.

## Health Interface

The API exposes two unauthenticated operational endpoints through a small `src/modules/health/HealthModule`:

- `GET /health/live` returns `{ status: "ok" }` through the existing success envelope and performs no external I/O.
- `GET /health/ready` executes PostgreSQL `SELECT 1`. Success returns `{ status: "ready" }`; database failure returns HTTP `503` with error code `SERVICE_UNAVAILABLE` through the existing exception filter.

The Web application exposes `GET /api/health`, returning `{ status: "ok" }`. The Web health route reports only Web process liveness; API/database readiness remains the API readiness endpoint so failures do not cascade across container health states.

## Trusted Client Address Interface

`apps/api/src/common/network/trusted-client-address.ts` owns the proxy seam with two functions:

```ts
parseTrustProxyHops(value: string | undefined): number
trustedClientAddress(
  remoteAddress: string | undefined,
  forwardedFor: string | string[] | undefined,
  trustedHops: number,
): string
```

`TRUST_PROXY_HOPS` defaults to `0`, accepts integer values from `0` through `10`, and fails startup for any other value. The Nest Express adapter receives the same numeric setting used by Socket.io address selection.

When the value is `0`, forwarded headers are ignored. When positive, Socket.io selects the address the configured number of hops from the server, using `X-Forwarded-For` only after the deployment explicitly opts in. Production documentation requires the final trusted proxy to remove or overwrite client-supplied `X-Forwarded-For`, `X-Forwarded-Host`, and `X-Forwarded-Proto` values.

The existing fixed-window process-local limiter remains unchanged apart from using the trusted Socket client address. A shared limiter is required only if the deployment later runs multiple API instances.

## Dependency Advisory Strategy

### `uuid`

ExcelJS 4.4.0 declares `uuid@^8.3.0` and uses only `uuid.v4()` without a caller-provided buffer. The reported vulnerability affects buffer handling in UUID v3/v5/v6. A targeted `overrides` entry to `uuid@11.1.1` may be retained only if:

- dependency installation succeeds without invalid peers;
- `npm ls uuid` resolves the expected version;
- ExcelJS unit tests and PostgreSQL XLSX E2E pass;
- API build and Docker runtime start pass; and
- `npm audit --omit=dev` no longer reports the UUID advisory.

### `deepmerge-ts`

Prisma 6.19.3's `@prisma/config` pins `deepmerge-ts@7.1.5`; the advisory is patched in version 8. The version-8 override is tested first in a disposable copy and may be retained only if installation, Prisma validate/generate/migrate, all API tests, and both API Docker targets pass.

If any compatibility check fails, the override is discarded. The remaining advisory is formally mitigated by excluding the Prisma CLI/config dependency chain from the network-facing runtime image, limiting it to a short-lived trusted migration image that accepts only deployment-controlled configuration, and documenting the exact advisory, exposure, revisit trigger, and verification evidence.

## Focused Integration Verification

A PostgreSQL-backed production-readiness E2E suite exercises real NestJS, Prisma, REST, and Socket.io behavior:

1. `/health/live` and `/health/ready` return their expected envelopes while PostgreSQL is available.
2. Two concurrent HTTP room-start requests yield exactly one success and one `INVALID_ROOM_PHASE`; persisted state advances once.
3. Two simultaneous Socket host-advance commands yield one new-question event and one `INVALID_ROOM_PHASE`; persisted question index advances once.
4. A participant reconnects with the same ID/token and does not create another participant row.
5. Repeated normalized-account login attempts produce HTTP `429` / `RATE_LIMITED` at the configured boundary.
6. Repeated authenticated participant Socket mutations produce `RATE_LIMITED` without changing identity or room phase.

Characterization checks that cover already-correct concurrency behavior may pass before production changes; new health and proxy behaviors must demonstrate RED before implementation.

## Verification

Completion requires fresh successful evidence for:

- API lint, TypeScript check, unit tests, seed test, coverage, and production build;
- Web lint and production build;
- Prisma validate, generate, local migration status, and clean-database migrate deploy;
- all PostgreSQL E2E suites;
- both Docker image builds and the API migration target;
- API and Web container startup on a disposable private Docker network;
- API liveness/readiness, Web liveness, and API readiness failure with PostgreSQL unavailable;
- production runtime dependency trees and `npm audit --omit=dev`;
- `git diff --check` and final branch/status review.

Disposable database containers, application containers, images used only for verification, and the private verification network are removed after the checks. Existing development PostgreSQL and pgAdmin containers remain untouched.

## References

- Next.js Docker standalone example: https://github.com/vercel/next.js/tree/canary/examples/with-docker
- Prisma migration deployment: https://www.prisma.io/docs/orm/prisma-client/deployment/deploy-database-changes-with-prisma-migrate
- Express proxy trust behavior: https://expressjs.com/en/guide/behind-proxies.html
- DeepmergeTS advisory: https://github.com/advisories/GHSA-ggr8-5vv4-36mx
- UUID advisory: https://github.com/advisories/GHSA-w5hq-g745-h8pq
- ExcelJS upstream dependency issue: https://github.com/exceljs/exceljs/issues/3055
