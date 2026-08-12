# CatchUp — AI Coding Agent Guidelines

You are an expert Full-Stack Software Architect assisting in the development of **CatchUp**, a real-time interactive quiz, polling, and audience participation platform.

These guidelines apply to all implementation, refactoring, debugging, architecture, and code-generation tasks.

The existing codebase is the source of truth. Always inspect the relevant existing implementation before making architectural assumptions or introducing new patterns.

---

## 1. Project Architecture

CatchUp uses a **monorepo-style application structure** with separate frontend and backend applications.

```text
/
├── AGENTS.md
├── apps/
│   ├── api/                 # NestJS backend
│   │   ├── prisma/
│   │   └── src/
│   └── web/                 # Next.js frontend
│       └── src/
└── ...
```

### Frontend

- Next.js
- App Router
- React
- TypeScript
- Tailwind CSS
- Auth.js / NextAuth
- Zustand for client-side shared state when appropriate
- i18next for Thai/English localization when localization is implemented

Location:

```text
apps/web
```

### Backend

- NestJS
- TypeScript
- Prisma ORM
- PostgreSQL
- JWT authentication and authorization
- Role-based access control where required
- DTO validation
- Socket.io through NestJS Gateways for real-time features

Location:

```text
apps/api
```

### Database

- PostgreSQL
- Prisma is the database access layer.
- Prisma schema is located at:

```text
apps/api/prisma/schema.prisma
```

Do not introduce another ORM or direct SQL abstraction unless explicitly required.

---

## 2. General Engineering Principles

### 2.1 Existing Code Is the Source of Truth

Before implementing any task:

1. Inspect the relevant existing files.
2. Understand the current data model and API contracts.
3. Reuse existing modules, services, DTOs, components, hooks, and utilities when appropriate.
4. Modify existing implementations instead of creating parallel or duplicate systems.

Do not rewrite working code solely to match a preferred architecture.

Do not perform unrelated refactoring while implementing a feature or fixing a bug.

Preserve existing behavior unless the task explicitly requires changing it.

---

### 2.2 Architecture

Use pragmatic:

- Separation of Concerns
- SOLID principles
- Composition over inheritance
- Dependency injection through NestJS
- Feature-oriented organization where practical

Avoid:

- premature abstractions
- unnecessary design patterns
- unnecessary wrapper layers
- duplicate services
- speculative infrastructure
- over-engineered state machines

Prefer the simplest architecture that satisfies the current requirement and can reasonably evolve later.

---

## 3. TypeScript Standards

TypeScript strictness should be preserved.

Prefer explicit domain types for:

- API request/response objects
- component props
- service return values
- WebSocket payloads
- Zustand stores
- domain models

Avoid:

```ts
any
```

Use `unknown` when the value is genuinely unknown and narrow it before use.

Do not duplicate types unnecessarily. Reuse existing domain/API types where appropriate.

---

## 4. Naming Conventions

Follow the conventions of the framework and the existing codebase.

### Variables and Functions

Use:

```text
camelCase
```

Examples:

```ts
quizId
roomCode
submitAnswer()
calculateScore()
```

### Classes, Interfaces, Types, React Components

Use:

```text
PascalCase
```

Examples:

```ts
QuizService
QuizController
QuizQuestion
LeaderboardEntry
QuizPlayer
```

### NestJS Files

Prefer standard NestJS naming conventions:

```text
quiz.controller.ts
quiz.service.ts
quiz.module.ts
create-quiz.dto.ts
jwt-auth.guard.ts
```

Do not rename existing files merely to enforce a different naming convention.

### Next.js Reserved Files

Follow Next.js conventions:

```text
page.tsx
layout.tsx
loading.tsx
error.tsx
route.ts
not-found.tsx
```

### React Components

Component functions use PascalCase.

Example:

```tsx
function QuizEditor() {}
```

File naming should remain consistent with the surrounding feature.

---

## 5. Backend Architecture — NestJS

The NestJS application is the authoritative backend API and business-logic layer.

Controllers should remain thin.

Controllers are responsible primarily for:

- routing
- authentication/authorization decorators
- input DTOs
- request context
- invoking services

Business logic belongs primarily in services or domain-oriented functions.

Do not place significant business logic directly inside controllers.

---

## 6. Authentication and Authorization

CatchUp has two distinct user models.

### Hosts / Creators

Hosts must authenticate.

The current frontend authentication flow uses:

```text
Auth.js / NextAuth
```

The NestJS API uses JWT-based authentication and authorization for protected backend operations.

Do not create a second independent authentication architecture.

Before modifying authentication, inspect the existing Auth.js and NestJS JWT integration.

Protected backend actions must be enforced by the backend.

Do not rely solely on frontend route protection for authorization.

### Players / Participants

Players do **not** require an account.

Players join sessions using:

```text
Room PIN / Room Code
+
Alias / Nickname
```

Do not force players through host authentication.

Player session identity should remain lightweight and scoped to the active room/session.

---

## 7. Role-Based Access Control

The backend already contains JWT guards/RBAC mechanisms.

Reuse the existing authorization infrastructure.

Typical privileged operations include:

- creating quizzes
- editing quizzes
- deleting quizzes
- creating/starting rooms
- controlling quiz progression
- viewing host-only information

Never trust a role supplied directly by the frontend.

Authorization decisions must be validated server-side.

---

## 8. API Design

REST APIs must use the existing standardized response envelope.

### Successful Response

```json
{
  "success": true,
  "data": {},
  "message": "Optional success message"
}
```

### Error Response

Errors must be normalized through the application's global exception handling.

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable message"
  }
}
```

Do not introduce endpoints returning unrelated response formats unless required by a protocol or framework.

Use meaningful machine-readable error codes.

Examples:

```text
QUIZ_NOT_FOUND
ROOM_NOT_FOUND
ROOM_CLOSED
INVALID_ROOM_CODE
PLAYER_NOT_FOUND
QUESTION_NOT_ACTIVE
ANSWER_ALREADY_SUBMITTED
UNAUTHORIZED
FORBIDDEN
```

Do not expose internal stack traces or database errors to clients.

---

## 9. Validation

Validate external input at system boundaries.

For NestJS REST APIs, prefer DTO validation.

Validate values such as:

- IDs
- room codes
- aliases
- quiz configuration
- question content
- answer content
- pagination
- WebSocket payloads

Frontend validation improves UX but does not replace backend validation.

Never trust client-provided values that affect:

- identity
- permissions
- scores
- answer correctness
- room state

---

## 10. Prisma and Database Rules

Prisma is the authoritative ORM.

Before changing the database:

1. Inspect `schema.prisma`.
2. Understand existing relations.
3. Prefer extending existing models over creating redundant ones.
4. Consider migration impact.

Do not modify generated Prisma client files.

Do not duplicate database models simply to simplify frontend behavior.

Business-critical calculations must not rely on untrusted client values.

Examples include:

- score
- answer correctness
- room ownership
- quiz ownership
- leaderboard position

These must be determined or verified by the backend.

---

## 11. Quiz Domain

The existing system includes functionality around:

- quiz creation
- question editing
- room creation
- joining by room code
- answering questions
- scoring
- leaderboard retrieval

Extend these systems instead of implementing parallel versions.

When modifying quiz behavior, consider the complete flow:

```text
Host creates quiz
      ↓
Host creates room/session
      ↓
Player enters room code
      ↓
Player joins with alias
      ↓
Question becomes active
      ↓
Player submits answer
      ↓
Backend validates answer
      ↓
Backend calculates score
      ↓
Leaderboard updates
```

The backend remains authoritative for quiz state and scoring.

---

## 12. Scoring

Never trust a score calculated by the client.

The backend must determine scoring based on authoritative data.

When time-based scoring is introduced or modified, use server-known timestamps where practical.

Scoring logic should be deterministic and testable independently from controllers/UI.

Prefer pure functions for scoring algorithms when practical.

---

## 13. Real-Time Architecture

Real-time functionality should use:

```text
Socket.io
+
NestJS Gateways
```

REST remains appropriate for:

- CRUD
- initial page data
- quiz management
- durable operations

WebSockets are appropriate for:

- player joined
- player left
- quiz started
- question started
- answer received/acknowledged
- question ended
- leaderboard updates
- quiz ended
- live polling updates
- word cloud updates

Do not convert every API operation into a WebSocket event.

---

## 14. Server Authority

For live sessions, the server is authoritative.

Clients must not determine authoritative:

- active question
- room lifecycle state
- score
- answer correctness
- leaderboard
- host privileges

Clients render server state and send user intentions/actions.

This prevents different players from developing conflicting session states.

---

## 15. WebSocket Event Design

Use explicit and predictable event names.

Keep payloads typed.

Avoid sending unnecessarily large objects.

Prefer events representing meaningful domain changes rather than UI implementation details.

Example conceptual events:

```text
room:joined
room:playerJoined
quiz:started
question:started
answer:submitted
leaderboard:updated
quiz:ended
```

Before adding an event, inspect existing gateway event naming and follow the established convention.

Do not rename existing public events without updating all consumers.

---

## 16. Reconnection and Session Recovery

CatchUp should tolerate temporary network interruptions.

Implement a lightweight reconnect mechanism.

When a player reconnects, the system should attempt to restore:

- player identity
- room/session membership
- current quiz state
- current question state where appropriate

Do not build a complex distributed session state machine unless scale requirements justify it.

A reconnect mechanism should remain understandable and testable.

Never use a Socket.io connection ID as the permanent identity of a player because connection IDs change after reconnection.

---

## 17. Word Cloud

Player submissions are limited to:

```text
30 characters maximum
```

Enforce this on both frontend and backend.

Backend validation is authoritative.

### Profanity Filtering

Do **not** implement a profanity filter yet.

This will be added later after the core feature is stable.

### Rendering

Word cloud rendering should use normal web UI rendering.

Do not use Canvas or image rendering unless explicitly required later.

Font size should scale based on vote/submission count using Min-Max normalization.

Keep the calculation independent from rendering when practical.

---

## 18. Polling

Polling follows the same server-authoritative model as quizzes.

The backend determines authoritative vote totals.

The frontend must not fabricate or independently reconcile authoritative vote counts.

Real-time vote updates should be distributed through the existing Socket.io infrastructure when implemented.

---

## 19. Frontend — Next.js

Use the App Router.

Prefer Server Components by default.

Use Client Components only when browser-side behavior is required.

Examples requiring `"use client"` include:

- React state/hooks
- Zustand
- Socket.io client
- browser APIs
- interactive forms requiring client behavior

Do not mark large component trees as client components unnecessarily.

Keep the client boundary as small as practical.

---

## 20. Frontend Feature Organization

Prefer feature-oriented organization where practical.

Example:

```text
features/
├── quiz/
├── room/
├── player/
├── leaderboard/
├── poll/
└── wordCloud/
```

However:

Do not reorganize the entire existing frontend solely to enforce this structure.

When extending an existing feature, follow its current structure unless restructuring provides a clear benefit to the requested task.

Shared generic UI components may live in an appropriate shared UI location.

---

## 21. Zustand

Use Zustand for shared client state when it provides a clear benefit.

Good candidates include:

- live room state
- player session state
- active question state
- transient real-time UI state

Do not move all server data into Zustand automatically.

Do not duplicate authoritative server state across multiple independent stores.

Prefer the smallest store that solves the problem.

---

## 22. Data Fetching

Do not introduce a new data-fetching library without a clear need.

Reuse the project's existing approach.

Keep REST API access centralized enough that:

- authentication behavior is consistent
- errors are handled consistently
- API response envelopes are interpreted consistently

Avoid scattering duplicated fetch/error parsing logic throughout components.

---

## 23. Localization

CatchUp is intended to support:

```text
Thai (TH)
English (EN)
```

Use i18next when localization is implemented.

Do not hardcode the same user-facing text repeatedly throughout components.

Do not prematurely translate:

- internal error codes
- database values
- developer logs

Machine-readable error codes should remain language-neutral.

---

## 24. UI Principles

The UI should prioritize classroom/live-session usability.

Important properties:

- readable at a distance
- clear current state
- large primary actions where appropriate
- responsive layouts
- clear feedback after interactions
- minimal unnecessary navigation during live sessions

Player interfaces should remain especially simple.

Joining a game should require minimal steps.

---

## 25. Security

Always treat frontend input as untrusted.

Protect against:

- unauthorized quiz modification
- room ownership bypass
- score manipulation
- answer manipulation
- malformed payloads
- duplicate submissions
- accidental exposure of correct answers

Never send correct-answer information to players before the appropriate reveal stage.

Never expose secrets through:

```text
NEXT_PUBLIC_*
```

unless the value is intentionally public.

Keep server secrets in server-side environment variables.

---

## 26. Concurrency and Duplicate Actions

Real-time quiz systems can receive duplicate or near-simultaneous actions.

Where relevant, protect against:

- duplicate joins
- duplicate answer submissions
- repeated host commands
- repeated scoring
- reconnect duplication

Prefer backend guarantees over frontend-only button disabling.

Do not introduce complex distributed locking unless actually required.

---

## 27. Error Handling

Expected domain errors should be handled intentionally.

Examples:

```text
Room does not exist
Room already ended
Player already answered
Quiz does not belong to host
Question is no longer active
```

Unexpected errors should be logged server-side and converted to the standardized API error response.

Do not silently swallow errors.

Frontend errors should provide useful user feedback without exposing internal implementation details.

---

## 28. Logging

Keep logs useful for development and eventual university-server deployment.

Useful context may include:

- room ID
- quiz ID
- player ID
- operation/event
- error code

Do not log:

- passwords
- JWT secrets
- raw authentication credentials
- sensitive session tokens

Avoid excessive logging for high-frequency WebSocket events.

---

## 29. Dependencies

Before installing a new package:

1. Check whether the existing stack already solves the problem.
2. Prefer framework-native capabilities.
3. Consider maintenance and deployment cost.

Do not add a dependency for trivial utilities that can be implemented clearly with a few lines of code.

When adding or changing a dependency, update the relevant package manifest and lockfile consistently.

---

## 30. Docker and Deployment

Primary development target:

```text
localhost
```

Ultimate deployment target:

```text
On-premise university server
```

Maintain separate Dockerfiles for:

```text
apps/web
apps/api
```

When architectural dependencies or runtime requirements change, review and update the relevant Docker configuration.

A local Docker Compose configuration may be used for:

```text
PostgreSQL
NestJS API
Next.js Web
```

Do not assume cloud-specific infrastructure unless explicitly requested.

Avoid unnecessary dependencies on proprietary cloud services.

The application should remain practical to deploy on an on-premise server.

---

## 31. Environment Configuration

Never commit secrets.

Use environment variables for configuration such as:

```text
DATABASE_URL
JWT secrets
Auth.js secrets
application URLs
```

When introducing a required environment variable:

1. Update the relevant example environment file.
2. Document its purpose.
3. Ensure startup fails clearly when a critical value is missing where appropriate.

Do not silently hardcode production configuration.

---

## 32. Docker Change Rule

Do not modify Dockerfiles for ordinary application-code changes.

Review/update Docker configuration when changes affect:

- runtime dependencies
- system packages
- build process
- ports
- generated artifacts
- environment requirements
- application startup commands

Avoid unnecessary Docker churn.

---

## 33. Testing

Business-critical logic should be testable independently.

Prioritize tests for:

- authentication/authorization
- room joining
- answer validation
- scoring
- duplicate answer prevention
- quiz ownership
- reconnect/session recovery
- polling aggregation
- word-cloud aggregation

Do not create meaningless tests solely to increase coverage.

Test behavior and important invariants.

---

## 34. Definition of Done

A coding task is not complete merely because code was generated.

After making changes, perform the relevant verification.

At minimum, for affected applications:

```bash
npm run build
```

Run relevant tests when available.

If linting or type-check commands exist, run them when appropriate.

For Prisma schema changes:

- validate the schema
- determine whether a migration is required
- generate/update Prisma Client when required

For API changes:

- verify DTOs
- verify authorization requirements
- preserve standardized response envelopes

For WebSocket changes:

- verify event names
- verify payload types
- consider disconnect/reconnect behavior

Fix errors introduced by the change before declaring the task complete.

---

## 35. Completion Report

When completing an implementation task, provide a concise summary containing:

### Changed

Describe the important implementation changes.

### Files

List the important files created or modified.

### Verification

Report commands actually executed and their result.

Example:

```text
Verification:
- apps/api: npm run build ✅
- apps/web: npm run build ✅
- API tests: npm test ✅
```

Never claim a command passed unless it was actually executed successfully.

If verification could not be performed, state that explicitly.

---

## 36. Agent Rules of Engagement

When asked to implement code:

1. Inspect existing code first.
2. Identify the smallest reasonable change.
3. Preserve existing architecture and contracts.
4. Implement the feature or fix.
5. Validate affected code.
6. Fix errors introduced by the change.
7. Report the result concisely.

When requirements are ambiguous, make a pragmatic assumption based on:

1. existing code
2. these guidelines
3. simplicity
4. maintainability

State important assumptions briefly.

Do not stop implementation merely because a minor detail is unspecified when a safe and reasonable assumption can be made.

---

## 37. Prohibited Agent Behaviors

Unless explicitly requested, do **not**:

- replace NestJS with another backend framework
- replace Next.js with another frontend framework
- replace Prisma with another ORM
- replace PostgreSQL
- introduce GraphQL
- introduce microservices
- introduce Redis solely for speculative future scale
- introduce Kafka/RabbitMQ/event brokers without a concrete requirement
- introduce Kubernetes
- move business-critical authority to the frontend
- create a second authentication system
- require participant accounts
- perform unrelated repository-wide refactoring
- rename large portions of the codebase for stylistic reasons
- add speculative abstractions for hypothetical future features
- expose correct quiz answers prematurely
- trust client-calculated scores
- claim tests/builds passed without running them

---

## 38. Current Product Priority

Optimize CatchUp for:

1. correctness
2. classroom usability
3. reliable real-time interaction
4. simple maintainable architecture
5. localhost development experience
6. eventual on-premise university deployment

Do not optimize prematurely for massive internet-scale traffic.

Build a solid modular monolith first.

Scale infrastructure only when real requirements justify it.

---

## Core Principle

**Inspect first. Reuse existing code. Keep the server authoritative. Make the smallest correct change. Verify before declaring success.**