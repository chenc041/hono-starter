# Hono Backend Starter (Bun-first)

生产可用后端脚手架，核心技术：

- `Bun + Hono`
- `Prisma + PostgreSQL`
- `Zod` 参数校验
- `Argon2` 密码哈希验证
- `JWT(access + refresh)` + refresh rotation + token blacklist
- `Redis 优先限流（不可用时降级内存）`
- `Biome`、`OpenAPI`、`Docker`

## 快速启动

```bash
bun install
cp .env.example .env
bun run db:dev:up
bun run dev
```

## 环境变量加载顺序（高 -> 低）

- `.env.<NODE_ENV>.local`
- `.env.local`
- `.env.<NODE_ENV>`
- `.env`

## 生产硬化默认能力

- 安全头：`x-content-type-options` / `x-frame-options` / `referrer-policy`
- CORS 白名单（`CORS_ORIGINS`）
- 请求体大小限制（`REQUEST_BODY_LIMIT_BYTES`）
- 限流：`REDIS_URL` 存在时使用 Redis，否则自动回退内存

## Docker

```bash
docker compose up --build
```

## 初始化管理员账号

```bash
ADMIN_EMAIL=admin@example.com ADMIN_PASSWORD=change-this-strong-pass bun run seed:admin
```

## 命令速查（命令作用）

### 应用运行

- `bun run dev`：开发模式启动服务（会先自动执行 `db:dev:prepare`）。
- `bun run start`：生产模式启动服务（会先自动执行 `db:prod:prepare`）。
- `bun run check`：执行代码质量检查（`lint + typecheck`）。
- `bun run test`：运行全部测试。
- `bun run test:watch`：测试监听模式。

### 数据库（开发）

- `bun run db:dev:up`：启动本地开发数据库与 Redis（Docker）。
- `bun run db:dev:prepare`：开发环境数据库准备（`prisma generate + migrate deploy`）。
- `bun run db:dev:migrate <name>`：根据 schema 变更创建并应用开发迁移（手动命名）。
- `bun run db:dev:migrate:auto`：自动时间戳命名创建并应用开发迁移。
- `bun run db:dev:status`：查看当前迁移状态。
- `bun run db:dev:reset`：重置本地数据库（会清空数据）。

### 数据库（通用 Prisma）

- `bun run prisma:generate`：生成 Prisma Client。
- `bun run prisma:migrate --name <name>`：创建并应用开发迁移（原始 Prisma 命令封装）。
- `bun run prisma:studio`：打开 Prisma Studio。
- `bun run prisma:reset`：重置数据库（危险操作）。

### 数据库（生产）

- `bun run db:prod:prepare`：生产数据库准备（`prisma generate + migrate deploy`）。
- `bun run db:prod:status`：查看生产迁移状态。

### 管理员初始化

- `bun run seed:admin`：创建或更新管理员账号（需传 `ADMIN_EMAIL` 和 `ADMIN_PASSWORD`）。

示例：

```bash
ADMIN_EMAIL=admin@example.com ADMIN_PASSWORD='StrongPass123!' bun run seed:admin
```

## 数据库操作指南（开发 / 生产）

### 开发阶段（本地）

1. 启动数据库和 Redis（推荐 Docker）

```bash
bun run db:dev:up
```

2. 启动服务（会自动执行数据库准备）

```bash
bun run dev
```

说明：`bun run dev` 会先执行 `predev -> db:dev:prepare`，内部包含：

```bash
bun run prisma:generate
bunx prisma migrate deploy
```

3. 当你修改了 `prisma/schema.prisma`，必须先创建开发迁移

```bash
bun run db:dev:migrate add_user_auth
```

不要跳过这一步，否则 `bun run dev` 里的 `db:dev:prepare` 只会执行已有迁移，不会自动生成新迁移。

如果你不想手动命名，也可以使用自动时间戳命名：

```bash
bun run db:dev:migrate:auto
```

4. 查看当前迁移状态（可选）

```bash
bun run db:dev:status
```

5. 查看数据库内容（可选）

```bash
bun run prisma:studio
```

6. 需要重置本地数据库（危险：会清空数据）

```bash
bun run db:dev:reset
```

开发阶段你应该提交到仓库的数据库相关内容：

- `prisma/schema.prisma`
- `prisma/migrations/**`

### 生产阶段（线上）

生产原则：

- 只使用 `migrate deploy`，不要使用 `migrate dev`
- 迁移前先备份数据库
- 迁移与应用版本一起发布

1. 准备生产环境变量（至少）

```env
NODE_ENV=production
DATABASE_URL=postgresql://<user>:<password>@<host>:5432/<db>
```

2. 发布前生成 Prisma Client（CI 或构建阶段）

```bash
bun run db:prod:prepare
```

说明：`db:prod:prepare` 内部包含：

```bash
bun run prisma:generate
bunx prisma migrate deploy
```

3. 启动服务（会自动执行数据库准备）

```bash
bun run start
```

说明：`bun run start` 会先执行 `prestart -> db:prod:prepare`。

4. 首次部署或需要重置管理员时，初始化管理员账号

```bash
ADMIN_EMAIL=admin@example.com ADMIN_PASSWORD=<strong_password> bun run seed:admin
```

5. 发布后做数据库健康检查（建议）

```bash
bun run db:prod:status
```

推荐生产发布顺序：

1. 备份数据库
2. 部署新版本代码
3. 执行 `prisma migrate deploy`
4. 执行 `seed:admin`（如需要）
5. 启动/切换应用实例
6. 验证核心接口与登录链路

## 开发阶段注意事项

- 不要把 `.env.local`、`.env.*.local` 提交到仓库。
- 本地开发建议使用：`NODE_ENV=development bun run dev`。
- 变更 Prisma 模型后固定执行：
  - `bun run prisma:migrate`
  - `bun run prisma:generate`
- 提交前至少执行一次：
  - `bun run check`
  - `bun test`
- 新增接口时同步更新 OpenAPI（路由 schema）并补测试。
- 认证相关改动要覆盖这些场景：登录、刷新、登出、黑名单校验。
- 本地如果不启 Redis 会自动降级内存限流；联调压测前请接上 Redis。

## 部署阶段注意事项

- 生产环境必须使用强 `JWT_SECRET`，禁止默认值。
- 生产数据库必须使用独立账号、强密码，并限制公网访问。
- 生产迁移使用 `prisma migrate deploy`，不要用 `migrate dev`。
- 首次部署顺序建议：
  - 部署数据库与 Redis
  - 执行迁移与 Prisma Client 生成
  - 初始化管理员账号（`seed:admin`）
  - 启动 API 服务
- `CORS_ORIGINS` 必须配置为真实前端域名，禁止随意放开 `*`。
- 建议将日志目录挂载持久化卷，避免容器重建丢失日志。
- 建议在网关层启用 HTTPS、基础 WAF 与请求限流，应用层限流作为第二道防线。
- 发布后检查项：
  - `/health` 正常
  - 登录/刷新/登出链路正常
  - 日志写入正常（access/error）
  - 错误率与延迟无明显异常
