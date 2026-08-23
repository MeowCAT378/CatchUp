# CatchUp Production Readiness Implementation Plan

> **For agentic workers:** Use `superpowers:executing-plans` and complete the tasks in order. Do not commit, merge, push, or create a PR.

**Goal:** Finish the remaining Priority 1 production-readiness work on the isolated `codex/dev2` branch and produce fresh evidence for a merge recommendation.

**Architecture:** Keep the existing NestJS/Next.js/Prisma modular monolith. Add only native health routes, one shared proxy-address helper, focused PostgreSQL integration coverage, and separate multi-stage production images. Rate limiting remains in-process because the approved deployment target is one API instance.

**Tech stack:** Node.js 24, npm workspaces per app, NestJS/Express/Socket.io, Next.js App Router, Prisma/PostgreSQL, Jest, Docker.

**Approved spec:** `docs/superpowers/specs/2026-08-23-production-readiness-design.md`

## Constraints

- Preserve all existing behavior and public REST/Socket contracts.
- Work only on `codex/dev2`; no branch integration or remote mutation.
- Follow test-first development for health and proxy logic.
- Do not add Redis, a production Compose stack, Kubernetes, or proxy-specific configuration.
- Do not force dependency downgrades. Keep an override only after its required verification passes.
- Do not touch the existing development Docker containers.

## Task 1: Add API and Web health endpoints

**Files:**

- Create: `apps/api/src/modules/health/health.controller.ts`
- Create: `apps/api/src/modules/health/health.module.ts`
- Create: `apps/api/src/modules/health/health.controller.spec.ts`
- Modify: `apps/api/src/app.module.ts`
- Create: `apps/web/src/app/api/health/route.ts`
- Create: `apps/web/src/app/api/health/route.test.ts` only if the Web test runner already supports route tests; otherwise verify with build and live HTTP.

### Steps

1. Write failing API tests proving:
   - `GET /health/live` returns the standard success envelope without database I/O.
   - `GET /health/ready` runs `SELECT 1` through `PrismaService`.
   - readiness converts database failure to the existing normalized 503 error path.
2. Run the focused API spec and confirm the missing health implementation is the only expected failure.
3. Implement a small `HealthController` and `HealthModule`; import it from `AppModule`.
4. Add Web `GET /api/health` returning a stable 200 JSON liveness response with no API/database dependency.
5. Run the focused API tests, API type-check, and Web lint/build.

## Task 2: Validate proxy trust once and use it for HTTP and Socket.io

**Files:**

- Create: `apps/api/src/common/network/trusted-client-address.ts`
- Create: `apps/api/src/common/network/trusted-client-address.spec.ts`
- Modify: `apps/api/src/main.ts`
- Modify: `apps/api/src/modules/rooms/rooms.gateway.ts`
- Modify: `apps/api/src/modules/rooms/rooms.gateway.spec.ts`
- Modify: `.env.example`
- Modify: `apps/api/.env.example`
- Modify: `apps/api/README.md`

### Contract

```ts
export function parseTrustProxyHops(value: string | undefined): number;

export function trustedClientAddress(
  remoteAddress: string | undefined,
  forwardedFor: string | string[] | undefined,
  trustedHops: number,
): string;
```

`TRUST_PROXY_HOPS` defaults to `0`, accepts decimal integers from `0` through `10`, and rejects every other value during startup. With zero trusted hops, forwarded headers are ignored. With `n` trusted hops, select the address `n` positions from the right of `X-Forwarded-For`, falling back to the socket remote address when the chain is too short or malformed.

### Steps

1. Write failing unit tests for default/valid/invalid hop values and right-to-left forwarded-address selection.
2. Run the focused test and preserve the RED output.
3. Implement the two pure functions without a dependency.
4. In `main.ts`, parse once at startup and configure the Nest Express adapter with `app.set('trust proxy', trustedHops)` only when hops are nonzero.
5. In `RoomsGateway`, parse the same setting during initialization and use `trustedClientAddress(...)` for the Socket.io rate-limit key.
6. Add gateway tests proving spoofed forwarding headers are ignored at zero hops and honored only for the configured trusted chain.
7. Document that the last trusted proxy must replace incoming `X-Forwarded-For`, `X-Forwarded-Host`, and `X-Forwarded-Proto` values.
8. Run the focused unit tests, API lint, and API type-check.

## Task 3: Add focused PostgreSQL HTTP/Socket concurrency tests

**Files:**

- Create: `apps/api/test/production-readiness.e2e-spec.ts`
- Modify existing E2E helpers only when reuse cannot be achieved from their current exports.

### Scenarios

1. Concurrent duplicate HTTP host start commands:
   - create a quiz and room with a real PostgreSQL test database;
   - send two authenticated start requests concurrently;
   - assert exactly one succeeds and authoritative room state advances once.
2. Simultaneous Socket.io host phase commands:
   - reach an active/reveal boundary;
   - emit the same transition twice from the host socket;
   - assert one state transition and a deterministic domain error for the loser.
3. Participant reconnect:
   - join, disconnect, reconnect with the participant token;
   - assert the same participant identity and no duplicate persisted participant.
4. HTTP and Socket throttling:
   - exceed the existing HTTP auth limit and receive 429;
   - exceed the Socket answer limit and receive `RATE_LIMITED`;
   - assert room phase and persisted scoring remain authoritative.
5. Race the last valid answer against a host phase transition and assert no answer is accepted outside the resulting authoritative phase.

### Steps

1. Add the focused E2E file using the existing guarded `CATCHUP_TEST_DATABASE_URL` runner and current REST/Socket event names.
2. Run the new suite alone against PostgreSQL. Treat failures as product defects, not timing allowances.
3. Make only the smallest service/transaction fix required if a scenario exposes a race.
4. Re-run the focused suite until stable, then run the complete PostgreSQL E2E suite.

## Task 4: Evaluate production dependency advisories safely

**Files:**

- Modify if accepted: `apps/api/package.json`
- Modify if accepted: `apps/api/package-lock.json`
- Create: `docs/security/dependency-advisories.md`

### `uuid@11.1.1`

1. In a disposable copy outside the checkout, install a targeted npm override for ExcelJS's `uuid` dependency.
2. Run `npm ls uuid`, the export-related tests, the full API unit/E2E suites, API build, and `npm audit --omit=dev`.
3. Keep the targeted override in the real checkout only if compatibility and behavior pass.

### `deepmerge-ts@8`

1. In a separate disposable install, override only Prisma configuration's `deepmerge-ts` to major 8.
2. Run Prisma validate/generate/migration status, all API unit/E2E tests, API build, migration target, Docker image build/start, and health/readiness probes.
3. Keep the override only if the entire matrix passes.
4. Otherwise remove it and formally document the mitigation:
   - the vulnerable package is in the Prisma CLI/configuration toolchain;
   - it is excluded from the API production runtime image;
   - migrations run as a controlled one-shot image target;
   - untrusted users cannot supply Prisma configuration;
   - upgrading Prisma remains the remediation path when an officially compatible release exists.
5. Record advisory IDs, resolved dependency paths, retained overrides, residual risk, and verification evidence without claiming a clean audit when findings remain.

## Task 5: Add production Dockerfiles

**Files:**

- Create: `apps/api/Dockerfile`
- Create: `apps/api/.dockerignore`
- Create: `apps/web/Dockerfile`
- Create: `apps/web/.dockerignore`
- Modify: `apps/web/next.config.ts`
- Modify: `apps/api/README.md`
- Modify: `apps/web/README.md`

### API image

1. Use Node 24 Debian slim stages for dependency install, Prisma generation/build, migration, and runtime.
2. Install production dependencies only in the runtime stage; copy generated Prisma client/engine artifacts and compiled output.
3. Run as the existing non-root `node` user.
4. Expose port 3001 and define a liveness healthcheck against `/health/live` using Node itself.
5. Provide a named `migrate` target whose command is `npx prisma migrate deploy`; do not run migrations implicitly on every API start.

### Web image

1. Set Next.js `output: 'standalone'`.
2. Use Node 24 slim dependency/build/runtime stages and copy `.next/standalone`, `.next/static`, and `public` only.
3. Run as non-root, expose port 3000, and healthcheck `/api/health` using Node itself.
4. Accept `NEXT_PUBLIC_API_URL` as a build argument because it is embedded in browser assets.

### Disposable private-network verification

1. Build API runtime, API migration, and Web runtime images with unique local tags.
2. Create a uniquely named private Docker network.
3. Start a new PostgreSQL test container on that network with unique credentials/database; never reuse or stop the development containers.
4. Run the migration target to completion.
5. Start API and Web containers with unique names and host ports.
6. Verify:
   - API `/health/live` is 200;
   - API `/health/ready` is 200 with PostgreSQL available;
   - readiness is 503 when database connectivity is intentionally unavailable;
   - Web `/api/health` is 200;
   - both runtime containers report healthy.
7. Remove only the uniquely named disposable containers/network/images after capturing results.

## Task 6: Run the final verification matrix

Run every command fresh from the real checkout and capture exact results:

```powershell
Set-Location apps/api
npm run lint
npm run typecheck
npm test -- --runInBand
npm run test:e2e
npm run build
npx prisma validate
npx prisma generate
npx prisma migrate status
npm audit --omit=dev

Set-Location ../web
npm run lint
npm run build
npm audit --omit=dev

Set-Location ../..
git diff --check
```

Also repeat the guarded PostgreSQL migration target and disposable Docker matrix from Tasks 3 and 5. If package scripts use different names, use the existing equivalent and report it exactly.

## Task 7: Final evidence and merge recommendation

1. Review `git status --short --branch`, `git diff --stat`, and the complete diff for accidental scope creep or secrets.
2. Confirm no commit, merge, push, or PR occurred.
3. Report:
   - Backend Completion percentage and its evidence;
   - Production Readiness percentage and its evidence;
   - remaining blockers;
   - dependency advisory status and mitigation;
   - Docker build/start/migration results;
   - liveness/readiness results;
   - whether `codex/dev2` is safe to merge into `dev1`.
4. Recommend merge only when all required checks pass and every residual advisory has a documented, bounded mitigation.
