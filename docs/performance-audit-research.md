# CatchUp performance audit research

Date: 2026-08-26  
Scope: static, end-to-end audit of the Next.js/NestJS/Prisma/Socket.IO implementation. Baseline counts were captured before implementation began, then refreshed against the concurrent working-tree fix. This research subtask did not edit application code.

## Conclusion

Two changes were justified and implemented; there is no Critical finding. The highest-confidence baseline problem was repeated construction of the live host dashboard: one dashboard calculation reloaded the same full room/quiz/question/choice graph three times, and that calculation runs after joins, leaves, answers, and host controls. The results/history loader also selected repeated nested records it did not use. The current working tree reuses one loaded room snapshot and narrows both hot-path and results projections. Do not add a general cache, SWR layer, Redis, or broad memoization without production traces.

## Performance audit

### 1. Repeated full-room queries in the live dashboard — implemented and verified

- **Severity:** High baseline — **implemented and verified**
- **File/path:** [`apps/api/src/modules/rooms/rooms.service.ts`](../apps/api/src/modules/rooms/rooms.service.ts#L644), [`apps/api/src/modules/rooms/rooms.gateway.ts`](../apps/api/src/modules/rooms/rooms.gateway.ts#L395), [`apps/api/src/modules/rooms/rooms.service.spec.ts`](../apps/api/src/modules/rooms/rooms.service.spec.ts#L464)
- **Baseline behavior:** `dashboardState()` loaded `room` once, then called `state(code)` and `result(code)`; both reloaded the same room. The shared `room()` query eagerly reads the quiz, every question, and every choice. Thus one baseline dashboard calculation performed a static lower bound of three full room-graph reads before its participant/answer/leaderboard queries ([current shared room graph](../apps/api/src/modules/rooms/rooms.service.ts#L797)).
- **Evidence:** The gateway recalculates the dashboard on join, leave, participant answer, Word Cloud action, and every host action ([join](../apps/api/src/modules/rooms/rooms.gateway.ts#L128), [answer](../apps/api/src/modules/rooms/rooms.gateway.ts#L195), [host action](../apps/api/src/modules/rooms/rooms.gateway.ts#L299), [leave](../apps/api/src/modules/rooms/rooms.gateway.ts#L367)). A successful Socket.IO answer path reaches at least five full `room()` calls: submit, participant state, and the dashboard's room/state/result composition ([answer path](../apps/api/src/modules/rooms/rooms.gateway.ts#L195), [submit loader](../apps/api/src/modules/rooms/rooms.service.ts#L271)). This is a source-derived lower bound, not a runtime trace.
- **Implemented behavior:** `state()`, `result()`, and `dashboardState()` now accept an already-loaded room; `dashboardState()` passes its snapshot to state/result, and the authenticated REST dashboard passes its `hostRoom()` snapshot into `dashboardState()` ([state reuse](../apps/api/src/modules/rooms/rooms.service.ts#L89), [result reuse](../apps/api/src/modules/rooms/rooms.service.ts#L488), [dashboard reuse](../apps/api/src/modules/rooms/rooms.service.ts#L644)). The same diff narrows participant authorization, leaderboard, socket-access, and dashboard participant reads to the fields used ([authorization select](../apps/api/src/modules/rooms/rooms.service.ts#L103), [leaderboard select](../apps/api/src/modules/rooms/rooms.service.ts#L533), [socket/dashboard selects](../apps/api/src/modules/rooms/rooms.service.ts#L632)). A focused Word Cloud dashboard test now asserts a single room lookup ([test](../apps/api/src/modules/rooms/rooms.service.spec.ts#L464)).
- **Post-change static counts:** One dashboard calculation now performs one full room-graph read, down from three. A successful Socket.IO answer path is now a lower bound of three full graph reads (submit + participant state + dashboard), down from five; join is three instead of five; leave is two instead of four. That is two fewer graph reads per path (40% for answer/join, 50% for leave), before branch-specific queries. These are source-derived counts, not measured SQL totals.
- **Expected performance impact:** Less database work and Prisma materialization on the highest-frequency classroom events, with no cross-request cache or stale room state.
- **Risk of change:** Medium. State differs by phase and participant privacy; the focused Rooms service tests, full API unit suite, lint, and API build passed after the change.

### 2. Live pages bootstrap through REST and then immediately fetch the same state through Socket.IO

- **Severity:** Medium — **Optional; preserve the resilience fallback for now**
- **File/path:** [`apps/web/src/app/play/[code]/page.tsx`](../apps/web/src/app/play/%5Bcode%5D/page.tsx#L198), [`apps/web/src/app/teacher/room/[code]/host-room.tsx`](../apps/web/src/app/teacher/room/%5Bcode%5D/host-room.tsx#L70), [`apps/api/src/modules/rooms/rooms.gateway.ts`](../apps/api/src/modules/rooms/rooms.gateway.ts#L81)
- **Current behavior:** The participant waits for `GET /rooms/:code`, then opens a socket and emits `room:join`; the join handler emits another authoritative `room:state` and builds a dashboard ([participant bootstrap](../apps/web/src/app/play/%5Bcode%5D/page.tsx#L198), [join response](../apps/api/src/modules/rooms/rooms.gateway.ts#L128)). In REVEALED/COMPLETED phases, both the REST state and following socket state can start `GET /rooms/:code/result` ([first result load](../apps/web/src/app/play/%5Bcode%5D/page.tsx#L221), [second result load](../apps/web/src/app/play/%5Bcode%5D/page.tsx#L242)). The host starts `GET /dashboard` while its socket join independently emits state and `dashboard:updated` ([host bootstrap](../apps/web/src/app/teacher/room/%5Bcode%5D/host-room.tsx#L70), [server join](../apps/api/src/modules/rooms/rooms.gateway.ts#L128)).
- **Evidence:** Normal successful participant mount: one REST state request plus one socket state event; revealed/completed mount can issue two result requests. Normal host mount: one REST dashboard request plus the socket-generated dashboard update. These counts follow directly from the cited call sites and exclude development-only React replays.
- **Performance impact:** Adds a full network round trip before participant real-time connection and duplicates expensive database state/dashboard work on every live-page mount.
- **Safest minimal fix:** First instrument real first-connect and reconnect timing. If duplication is material, retain REST only as a timed socket-failure fallback and deduplicate result loads by question/phase. The current REST path gives useful state/error recovery when WebSocket connection is delayed or unavailable.
- **Risk of change:** Medium. Test first connect, delayed connect, reconnect, invalid participant token, and host authorization; the optimization must not weaken the current server-authoritative recovery flow.

### 3. Results/history materialized repeated relation data that was not needed — implemented and verified

- **Severity:** Medium baseline — **implemented and verified**
- **File/path:** [`apps/api/src/modules/rooms/room-results.service.ts`](../apps/api/src/modules/rooms/room-results.service.ts#L12)
- **Baseline behavior:** The results query included the complete quiz graph and, for every attempt, a full participant plus every answer's full `choice` and `question`. It also included full Word Cloud entry records. The transformer only needed selected participant fields and answer IDs/flags/timestamps/text; question and choice text were already present in the loaded quiz graph. Prisma returns all scalar fields unless `select`/`omit` narrows them, and its official guidance states that selecting only needed fields reduces result size and can improve query speed ([Prisma select fields](https://www.prisma.io/docs/orm/v6/prisma-client/queries/select-fields)).
- **Performance impact:** Database-to-API transfer and Node memory grow with every answer, including repeated question/choice text and unused participant fields. The same loader serves live results, history detail, CSV, and XLSX exports, so the cost affects all result surfaces ([controller consumers](../apps/api/src/modules/rooms/rooms.controller.ts#L58)).
- **Implemented behavior:** The loader now uses one explicit nested `select`; answer rows carry only IDs, correctness, and timestamps, participant rows carry only display names, and response text is resolved from maps over the already-loaded quiz graph ([result projection](../apps/api/src/modules/rooms/room-results.service.ts#L12)). The public response shape is unchanged.
- **Risk of change:** Low-to-medium. Focused result behavior tests and the full API unit suite pass; database-backed export E2E remains guarded by the test-database requirement.

### 4. Smaller, real issues that do not justify immediate architecture work

| Severity | Current behavior and evidence | Recommendation | Risk |
|---|---|---|---|
| Low — Optional | The teacher quiz list returns every scalar quiz field plus a question count, while its client type consumes only `id`, `title`, `type`, and `_count` ([API query](../apps/api/src/modules/quizzes/quizzes.service.ts#L18), [client type](../apps/web/src/app/teacher/teacher-client.tsx#L20)). | Add a narrow Prisma `select`. This is a small payload win; pagination should wait until list size is measured. | Low. |
| Low — Optional | Removing a question reads all later questions and updates them one by one inside a transaction ([serial loop](../apps/api/src/modules/quizzes/quizzes.service.ts#L175)). | Replace the loop with one `updateMany` atomic decrement if this edit path is measurably slow. It is not a page-load/live-session hot path. | Low. |
| Medium — Measure first | Hot dashboard queries filter answers by `questionId`, while `Answer` has only `@@unique([attemptId, questionId])`; there is no index beginning with `questionId` ([query](../apps/api/src/modules/rooms/rooms.service.ts#L636), [schema](../apps/api/prisma/schema.prisma#L126)). | Run `EXPLAIN (ANALYZE, BUFFERS)` with production-like room sizes. Add `@@index([questionId, choiceId])` only if the plan demonstrates the need; Prisma exposes `@@index` for database indexes ([Prisma indexes](https://docs.prisma.io/docs/orm/prisma-schema/data-model/indexes)). | Medium because every answer write must maintain the index. |

## Recommended implementation order

### Implemented and verified

1. Reuse one room snapshot inside dashboard/state/result composition and narrow the hot-path selects.
2. Narrow `RoomResultsService` relation selections without changing its response.

### Optional

1. Narrow the teacher quiz-list selection.
2. Measure REST + Socket.IO live bootstrap overlap before changing its fallback/reconnect behavior.
3. Replace serial question-position updates if editor traces show latency.
4. Validate the proposed Answer index with a production-like PostgreSQL plan before adding it.

### No change

- **Socket listener/connection lifecycle:** Each host/participant live component creates one socket in one effect, registers data listeners outside the `connect` callback, and disconnects that socket in cleanup ([participant](../apps/web/src/app/play/%5Bcode%5D/page.tsx#L224), [host](../apps/web/src/app/teacher/room/%5Bcode%5D/host-room.tsx#L77)). This follows Socket.IO guidance: `connect` fires on reconnect, listeners should not be registered inside it, and manual `disconnect()` stops reconnection and closes the low-level connection when it is the last active socket ([Socket.IO client API](https://socket.io/docs/v4/client-api/)). Re-emitting `room:join` in `connect` is therefore intentional reconnect recovery, not a duplicate-listener bug.
- **Authentication freshness:** `requireUser()` intentionally sends `/auth/me` with `no-store`, preserving live disabled-user/RBAC checks ([source](../apps/web/src/lib/server-auth.ts#L13)). Identical GET fetches in one Server Component render tree are request-memoized even when not persistently cached, so nested calls do not justify stale cross-request caching ([Next.js fetching](https://nextjs.org/docs/app/getting-started/fetching-data), [React `cache`](https://react.dev/reference/react/cache)). Keep database-backed authorization.
- **Polling:** No `setInterval`, refresh interval, or polling loop exists in application source; live updates use Socket.IO events ([event definitions](../apps/web/src/lib/room-socket.ts#L3)).
- **History/admin list query shape:** History and teacher lists are paginated, use focused `select`/counts, and batch list + total in a transaction rather than issuing per-row queries ([history](../apps/api/src/modules/rooms/room-history.service.ts#L39), [teachers](../apps/api/src/modules/admin/admin.service.ts#L93)). The admin latest-room lookup is one grouped query, not N+1 ([groupBy](../apps/api/src/modules/admin/admin.service.ts#L124)).
- **Broad client caching/memoization:** Client requests are generally one fetch per mount/query plus deliberate post-mutation refreshes ([teacher list](../apps/web/src/app/teacher/teacher-client.tsx#L37), [history](../apps/web/src/components/history-list.tsx#L73), [admin teachers](../apps/web/src/components/admin-teachers.tsx#L41)). There is no evidence for adding a data-fetching dependency or memoizing render work broadly.

## Flow/request inventory

This is a source-derived normal-success inventory, not browser instrumentation.

| Flow | Current application work | Assessment |
|---|---|---|
| Landing -> Login | Landing has no application data fetch; credentials login performs one Nest `/auth/login`, followed by NextAuth session read for routing ([login](../apps/web/src/app/login/page.tsx#L16), [authorize](../apps/web/src/auth.ts#L10)). | No action. |
| Login -> Teacher dashboard / quiz list | Fresh `/auth/me` in the teacher layout and one client `/quizzes` fetch ([layout](../apps/web/src/app/teacher/layout.tsx#L4), [list](../apps/web/src/app/teacher/teacher-client.tsx#L41)). | Narrow list payload; no cache layer. |
| Quiz editor | Fresh protected layout plus one quiz-detail fetch on mount ([editor](../apps/web/src/app/teacher/quiz/%5Bid%5D/quiz-editor.tsx#L50)). | No duplicate request found. |
| Create/open room / Host dashboard | Room create is one POST; the resulting host page duplicates REST and socket bootstrap ([create](../apps/web/src/app/teacher/teacher-client.tsx#L73), [host](../apps/web/src/app/teacher/room/%5Bcode%5D/host-room.tsx#L70)). | Measure first; REST is the current socket-failure fallback. |
| Participant join/play | Join is one POST; play then duplicates REST state and socket state/dashboard work ([join](../apps/web/src/app/join/page.tsx#L27), [play](../apps/web/src/app/play/%5Bcode%5D/page.tsx#L198)). | Measure first; preserve reconnect/error recovery. |
| Results | One client results request; the backend projection is now narrowed to fields consumed by the response ([client](../apps/web/src/app/teacher/room/%5Bcode%5D/results/results-client.tsx#L91), [service](../apps/api/src/modules/rooms/room-results.service.ts#L12)). | Implemented. |
| Session/export history | One paginated history request; admin additionally loads up to 50 teachers for its filter ([client](../apps/web/src/components/history-list.tsx#L85), [API](../apps/api/src/modules/rooms/room-history.service.ts#L39)). | No duplicate found; teacher-filter pagination is a future scale limit. |
| Admin overview/users | One page-specific client request after the server authorization check; teacher list is paginated ([overview](../apps/web/src/components/admin-overview.tsx#L22), [teachers](../apps/web/src/components/admin-teachers.tsx#L41)). | No duplicate/N+1 found. |

## Measurement boundary

- Query/request counts above are static lower bounds from source call graphs. No production trace, representative PostgreSQL dataset, or `EXPLAIN ANALYZE` output was available, so no speculative index or cache is classified **Fix now**.
- A production Next.js webpack build completed. Page-owned JavaScript chunks were 17.4 KiB for participant play, 16.7 KiB for the quiz editor, 16.2 KiB for the teacher list, and 14.3 KiB for the host dashboard (raw, uncompressed); route splitting keeps Socket.IO in its own 41.0 KiB shared chunk. No app dependency was large enough to justify a bundle refactor without browser traces. Next.js recommends measuring a production-like `next build`/`next start` and using its bundle analyzer when bundle evidence is needed ([Next.js production checklist](https://nextjs.org/docs/app/guides/production-checklist)).
