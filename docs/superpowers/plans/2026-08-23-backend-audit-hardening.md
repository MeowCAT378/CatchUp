# Backend Audit and Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the audited CatchUp backend checks truthful and fix confirmed validation, concurrency, security, and logging gaps without changing intended product flows.

**Architecture:** Keep Nest controllers and Socket.io gateway thin; enforce domain invariants in existing services and Prisma constraints. Reuse the current response envelope, `AppError`, persisted room state, and activity lifecycle module. Add only one process-local rate-limit module because HTTP and Socket entry points share the same abuse boundary.

**Tech Stack:** NestJS 11, TypeScript, Prisma 6, PostgreSQL 16, Socket.io 4, Jest 30, class-validator, ExcelJS.

**Spec:** `C:/Users/yothi/.codex/attachments/ee8bf2cd-372c-49ed-8bbf-72054b1bf435/pasted-text.txt`

## Global Constraints

- Preserve REST paths, response envelope, WebSocket event names, participant account-free join, and server-authoritative scoring/state.
- Preserve soft-deleted activities and all room, participant, answer, result, and export history.
- Never expose correct answers before `REVEALED` or `COMPLETED`.
- No new dependency, ORM, state store, or speculative abstraction.
- Every production behavior change starts with one focused failing test.

---

### Task 1: Restore truthful type and PostgreSQL E2E checks

**Files:**
- Modify: `apps/api/src/modules/admin/admin.service.spec.ts`
- Modify: `apps/api/src/modules/rooms/rooms.service.spec.ts`
- Modify: `apps/api/test/catchup.e2e-spec.ts`

**Interfaces:**
- Consumes: current Prisma `Room` required snapshot fields and soft-delete behavior.
- Produces: `npx tsc --noEmit --incremental false` clean result and E2E assertions matching current contracts.

- [ ] **Step 1: Keep the reproduced failures as RED evidence**

Run: `npx tsc --noEmit --incremental false`

Expected: failures for recursive test mock inference and missing `Room.activityTitle` / `Room.activityType` fixtures.

Run: `npm run test:e2e`

Expected: failures for worksheet `Participants` and missing room snapshot fields.

- [ ] **Step 2: Correct test-only typing and fixtures**

Use explicit mock object return types, change the invalid phase helper assertion to accept an error code, set `activityTitle` and `activityType` in every direct room fixture, and assert worksheet `Leaderboard`.

- [ ] **Step 3: Replace obsolete hard-delete assertions**

After `DELETE /quizzes/:id`, assert `Quiz.deletedAt` is non-null and room/question/choice/participant/attempt/answer/word-cloud rows still exist. This catches any future data-retention regression.

- [ ] **Step 4: Verify Task 1**

Run: `npx tsc --noEmit --incremental false`

Expected: PASS.

Run: `npm run test:e2e`

Expected: 3/3 PASS against the isolated PostgreSQL test database.

### Task 2: Enforce bounded, normalized request DTOs and soft-delete consistency

**Files:**
- Modify: `apps/api/src/modules/auth/dto.ts`
- Modify: `apps/api/src/modules/quizzes/dto.ts`
- Modify: `apps/api/src/modules/quizzes/quizzes.service.ts`
- Modify: `apps/api/src/modules/quizzes/quizzes.service.spec.ts`
- Create: `apps/api/src/modules/quizzes/dto.spec.ts`

**Interfaces:**
- Consumes: global `ValidationPipe({ whitelist: true, transform: true })`.
- Produces: trimmed bounded auth/activity data and `QUIZ_NOT_FOUND` for soft-deleted duplication/mutation.

- [ ] **Step 1: Write RED DTO and soft-delete tests**

Add tests using `plainToInstance` and `validate` which require trimming, reject whitespace-only text, titles over 150 characters, descriptions over 2,000 characters, questions over 500 characters, choices over 200 characters, more than 100 questions, and more than 20 choices. Add a service test requiring duplication of a soft-deleted activity to fail with `QUIZ_NOT_FOUND`.

- [ ] **Step 2: Run focused RED tests**

Run: `npm test -- dto.spec.ts quizzes.service.spec.ts --runInBand`

Expected: FAIL because transforms/limits and deleted-state check are absent.

- [ ] **Step 3: Add minimal decorators and deleted-state checks**

Use existing `class-transformer` and `class-validator` decorators only. In `duplicate()`, treat `deletedAt` exactly like `owned()`; in question mutations, reject questions whose parent quiz is deleted.

- [ ] **Step 4: Run focused GREEN tests**

Run: `npm test -- dto.spec.ts quizzes.service.spec.ts --runInBand`

Expected: PASS.

### Task 3: Make room transitions and Word Cloud vote moves concurrency-safe

**Files:**
- Modify: `apps/api/src/modules/rooms/rooms.service.ts`
- Modify: `apps/api/src/modules/rooms/rooms.service.spec.ts`
- Modify: `apps/api/prisma/schema.prisma`
- Create: `apps/api/prisma/migrations/20260823010000_word_cloud_vote_participant_unique/migration.sql`

**Interfaces:**
- Consumes: `Room.status`, `Room.phase`, `Room.currentQuestionIndex`, participant-scoped Word Cloud identity.
- Produces: conditional state transitions and one vote row per room-scoped participant.

- [ ] **Step 1: Write RED concurrency tests**

Add one service test where `room.updateMany()` returns `{ count: 0 }` and require a stale host transition to throw `INVALID_ROOM_PHASE`. Change the vote test to require one `wordCloudVote.upsert({ where: { participantId }, update: { entryId }, create: { entryId, participantId } })` call.

- [ ] **Step 2: Run focused RED tests**

Run: `npm test -- rooms.service.spec.ts --runInBand`

Expected: FAIL because transitions use unconditional `update()` and vote moves use delete/create.

- [ ] **Step 3: Implement conditional transitions**

Add one private `transition(where: Prisma.RoomWhereInput, data: Prisma.RoomUpdateManyMutationInput)` module implementation. It calls `updateMany`, throws `INVALID_ROOM_PHASE` unless exactly one row changed, then returns `findUniqueOrThrow`. Use it in `start`, `reveal`, `next`, and `complete` with expected status, phase, and question index.

- [ ] **Step 4: Enforce and use participant-unique votes**

Change the Prisma relation to one optional vote per participant and make `participantId` unique. Migration removes duplicate legacy votes by newest `createdAt`, drops the old compound unique index, and creates `WordCloudVote_participantId_key`. Replace delete/create transaction with one Prisma `upsert`.

- [ ] **Step 5: Verify Task 3**

Run: `npx prisma validate`

Run: `npx prisma generate`

Run: `npm test -- rooms.service.spec.ts --runInBand`

Expected: all PASS.

### Task 4: Rate-limit public and realtime mutation boundaries

**Files:**
- Create: `apps/api/src/common/rate-limit.ts`
- Create: `apps/api/src/common/rate-limit.spec.ts`
- Modify: `apps/api/src/modules/auth/auth.controller.ts`
- Modify: `apps/api/src/modules/rooms/rooms.controller.ts`
- Modify: `apps/api/src/modules/rooms/rooms.gateway.ts`
- Modify: `apps/web/src/lib/api.ts`
- Modify: `apps/web/src/i18n/errors.ts`

**Interfaces:**
- Consumes: request/socket address, normalized email, room code, participant ID.
- Produces: `checkRateLimit(key: string, limit: number, windowMs: number): void`, throwing `AppError('RATE_LIMITED', 429, 'Too many requests')`.

- [ ] **Step 1: Write RED rate-limit test**

Freeze `Date.now()`, allow exactly the configured count, require the next call to throw `RATE_LIMITED`, advance beyond the window, and require the next call to pass.

- [ ] **Step 2: Run focused RED test**

Run: `npm test -- rate-limit.spec.ts --runInBand`

Expected: FAIL because module does not exist.

- [ ] **Step 3: Implement one bounded process-local limiter**

Use a `Map<string, { count: number; resetAt: number }>` with expired-entry cleanup and a 10,000-key ceiling. Add the required `ponytail:` comment that shared ingress/store limits replace it before horizontal scaling.

- [ ] **Step 4: Apply it at trust boundaries**

Limit register/login per address, login per normalized email, room join per address/code, REST participant mutations per participant, Socket join per address, and Socket participant/host mutations per participant/user. Never put tokens in rate-limit keys.

- [ ] **Step 5: Preserve frontend error contract**

Add `RATE_LIMITED` to `ApiErrorCode` and Thai/English error text.

- [ ] **Step 6: Verify Task 4**

Run: `npm test -- rate-limit.spec.ts --runInBand`

Run: `npm run build`

Expected: PASS.

### Task 5: Normalize Socket errors, remove dead work, and stop credential logging

**Files:**
- Modify: `apps/api/src/modules/rooms/rooms.gateway.ts`
- Modify: `apps/api/src/modules/rooms/rooms.gateway.spec.ts`
- Modify: `apps/api/prisma/seed.cjs`
- Modify: `apps/api/README.md`

**Interfaces:**
- Consumes: existing `RoomEvents.error` payload `{ code }`.
- Produces: `FORBIDDEN` for Socket authorization failures, no duplicate completion dashboard refresh, no obsolete `activityDeleted()` path, and no raw generated passwords in seed output.

- [ ] **Step 1: Write RED Socket error test**

Invoke the real gateway authorization path with a mismatched participant payload and require `room:error` to contain `{ code: 'FORBIDDEN' }`.

- [ ] **Step 2: Run focused RED test**

Run: `npm test -- rooms.gateway.spec.ts --runInBand`

Expected: FAIL because `ForbiddenException` currently maps to `REQUEST_FAILED`.

- [ ] **Step 3: Implement minimal cleanup**

Map `ForbiddenException` to `FORBIDDEN`, delete unreferenced `activityDeleted()`, and remove the duplicate `dashboard()` call inside completion because the shared host wrapper already refreshes it.

- [ ] **Step 4: Remove credential output and fix seed docs**

Keep admin/Kazuma password source labels, but never print generated mock-host passwords. Document the actual `CATCHUP_SEED_ADMIN_PASSWORD` and `CATCHUP_SEED_KAZUMA_PASSWORD` variables.

- [ ] **Step 5: Verify Task 5**

Run: `npm test -- rooms.gateway.spec.ts --runInBand`

Run: `npm run test:seed`

Expected: PASS.

### Task 6: Full verification and report

**Files:**
- Review: all changed files
- Review: `apps/api/package-lock.json`

**Interfaces:**
- Produces: evidence-backed backend readiness report.

- [ ] **Step 1: Run full static and unit checks**

Run: `npm run lint`

Run: `npx tsc --noEmit --incremental false`

Run: `npm test -- --runInBand`

Run: `npm run test:seed`

Run: `npm run build`

Run: `npx prisma validate`

- [ ] **Step 2: Run PostgreSQL E2E**

Start only Compose `postgres-test` with process-only credentials, run `npm run test:e2e:setup`, run `npm run test:e2e`, and stop `postgres-test` in `finally`.

- [ ] **Step 3: Run security and diff checks**

Run: `npm audit --omit=dev`

Run: `git diff --check`

Run: `git status --short`

- [ ] **Step 4: Report verified scope and remaining gaps**

Separate passed checks, warnings, unavailable browser checks, production dependency advisories, missing Dockerfiles, test coverage, and recommended priorities. Never report unrun checks as passed.
