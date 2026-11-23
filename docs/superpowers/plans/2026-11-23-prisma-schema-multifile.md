# Prisma Multi-File Schema Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Split the Prisma schema sources by business domain without changing the database schema, migration history, or generated client output.

**Architecture:** Keep `prisma/schema.prisma` as the entry file for generator and datasource configuration. Move user and authentication models into sibling `.prisma` files and configure Prisma to load the `prisma/` schema directory while keeping migrations in `prisma/migrations/`.

**Tech Stack:** Prisma 7.10.1, Prisma config, PostgreSQL, Bun.

**Spec:** `docs/superpowers/specs/2026-11-23-prisma-schema-multifile-design.md`

## Global Constraints

- `prisma/schema.prisma` retains generator and datasource.
- Add user-domain and authentication-domain schema files: `User` is separate; `UserAuth`, `RefreshToken`, and `RevokedToken` belong to the authentication domain.
- Change Prisma config schema path from a single file to the `prisma/` directory.
- Keep migrations in `prisma/migrations/`; do not create migrations or modify model definitions.
- Keep the generated client output at `src/generated/prisma`.

## Review Focus

- Schema directory discovery: Prisma must load models from sibling `.prisma` files; verify with `bunx prisma validate`.
- Migration discovery: Prisma must continue to find existing migrations under `prisma/migrations/`; verify with `bunx prisma migrate status` when a database is available, otherwise verify config and directory values remain unchanged.
- Generated-client path: output remains `src/generated/prisma`; verify with `bun run prisma:generate`.
- Schema equivalence: splitting files must not change models or fields; inspect the diff and validate generated client types.
- Application compatibility: aliased generated-client imports continue compiling; verify with `bun run check` and `bun run test`.

---

### Task 1: Split Prisma schema sources by domain

**Files:**

- Modify: `prisma/schema.prisma`
- Create: `prisma/users.prisma`
- Create: `prisma/auth.prisma`
- Modify: `prisma.config.ts`
- Modify: `README.md`

**Interfaces:**

- Consumes: Current Prisma models and generator/datasource settings.
- Produces: A directory-based Prisma schema with `User` in `prisma/users.prisma`; `UserAuth`, `RefreshToken`, and `RevokedToken` in `prisma/auth.prisma`; generator/datasource retained in `prisma/schema.prisma`; Prisma config schema path set to `prisma`.

- [x] **Step 1: Move the `User` model unchanged into `prisma/users.prisma`**

- [x] **Step 2: Move `UserAuth`, `RefreshToken`, and `RevokedToken` unchanged into `prisma/auth.prisma`**

- [x] **Step 3: Change `prisma.config.ts` schema path to `prisma`, keeping migrations path at `prisma/migrations`**

- [x] **Step 4: Update Prisma schema guidance in `README.md`**

Expected: Documentation identifies `prisma/*.prisma` as schema sources and explains that the root schema file keeps generator/datasource configuration.

- [x] **Step 5: Validate the multi-file schema**

Run: `bunx prisma validate`
Expected: Prisma reports the schema is valid and recognizes all four models.

- [x] **Step 6: Generate the client and verify its output path**

Run: `bun run prisma:generate`
Expected: Prisma Client is generated to `src/generated/prisma`.

- [x] **Step 7: Verify application behavior and migration files**

Run: `bun run check && bun run test`
Expected: Typecheck passes, all tests pass, and no files under `prisma/migrations/` change.
