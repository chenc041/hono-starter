# Hono Backend Starter Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade the current minimal Hono app into a Bun-first backend starter with Prisma, Biome, Valibot validation, JWT auth, rate limiting, OpenAPI docs, Docker, and test baseline.

**Architecture:** Build a modular app entry (`createApp`) with shared core middleware (request id, logging, error handling, rate limiting), module routes (`health`, `auth`, `users`), and a Prisma-backed service layer. Keep runtime Bun-first while preserving clear boundaries for routes/services/db. Provide static OpenAPI JSON + docs endpoint for quick API discovery.

**Tech Stack:** Bun, TypeScript, Hono, Prisma/PostgreSQL, Valibot, Biome, Bun test

---

## Chunk 1: Project foundation and quality gates

### Task 1: Upgrade scripts and dependencies

**Files:**
- Modify: `package.json`
- Modify: `tsconfig.json`
- Modify: `biome.json`

- [ ] **Step 1: Write failing test expectation for script availability (manual contract check)**
- [ ] **Step 2: Add scripts for dev/build/check/test/prisma and dependencies for zod/dotenv**
- [ ] **Step 3: Run `bun run check` and `bun test` to ensure toolchain works**
- [ ] **Step 4: Commit**

### Task 2: Create runtime and app composition entry

**Files:**
- Create: `src/app.ts`
- Modify: `src/index.ts`

- [ ] **Step 1: Write failing app smoke tests (health + root)**
- [ ] **Step 2: Implement `createApp()` and server bootstrap**
- [ ] **Step 3: Run tests to green**
- [ ] **Step 4: Commit**

## Chunk 2: Core middleware and modules

### Task 3: Core middleware and error model

**Files:**
- Create: `src/core/errors/app-error.ts`
- Create: `src/core/middleware/error-handler.ts`
- Create: `src/core/middleware/request-id.ts`
- Create: `src/core/middleware/logger.ts`
- Create: `src/core/middleware/rate-limit.ts`

- [ ] **Step 1: Write failing tests for request id/error envelope/rate limit**
- [ ] **Step 2: Implement middleware to satisfy tests**
- [ ] **Step 3: Run tests to green**
- [ ] **Step 4: Commit**

### Task 4: Auth + health modules

**Files:**
- Create: `src/core/config/env.ts`
- Create: `src/modules/health/routes.ts`
- Create: `src/modules/auth/routes.ts`

- [ ] **Step 1: Write failing tests for login and protected auth endpoint**
- [ ] **Step 2: Implement zod validation + JWT issue/verify middleware**
- [ ] **Step 3: Run tests to green**
- [ ] **Step 4: Commit**

### Task 5: Users module with Prisma

**Files:**
- Create: `src/db/client.ts`
- Create: `src/modules/users/user.schema.ts`
- Create: `src/modules/users/user.repository.ts`
- Create: `src/modules/users/user.service.ts`
- Create: `src/modules/users/user.routes.ts`

- [ ] **Step 1: Write failing tests for validation + auth protection (db-independent cases)**
- [ ] **Step 2: Implement routes/service/repository and integrate Prisma client**
- [ ] **Step 3: Run tests to green**
- [ ] **Step 4: Commit**

## Chunk 3: Prisma schema, docs and delivery

### Task 6: Prisma schema and config

**Files:**
- Modify: `prisma/schema.prisma`
- Modify: `prisma.config.ts`
- Create: `.env.example`

- [ ] **Step 1: Add `User` model and datasource configuration contract**
- [ ] **Step 2: Run `bunx prisma generate` to verify client generation**
- [ ] **Step 3: Commit**

### Task 7: OpenAPI docs endpoints

**Files:**
- Create: `src/openapi/spec.ts`
- Create: `src/openapi/routes.ts`

- [ ] **Step 1: Write failing tests for `/openapi.json` and `/docs`**
- [ ] **Step 2: Implement static spec and docs route**
- [ ] **Step 3: Run tests to green**
- [ ] **Step 4: Commit**

### Task 8: Containerization and documentation

**Files:**
- Create: `Dockerfile`
- Create: `docker-compose.yml`
- Modify: `README.md`

- [ ] **Step 1: Add Docker runtime + compose with Postgres**
- [ ] **Step 2: Document quick start, scripts, API modules, and workflow**
- [ ] **Step 3: Run full verification (`bun run check`, `bun test`)**
- [ ] **Step 4: Commit**

Plan complete and saved to `docs/superpowers/plans/2026-03-15-hono-backend-starter.md`. Ready to execute.
