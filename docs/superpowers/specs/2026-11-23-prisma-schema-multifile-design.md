# Prisma 多文件 Schema 设计

## 目标

将 Prisma schema 源文件按业务域拆分，便于后续维护和扩展，同时保持现有数据库结构、迁移历史、Prisma Client 输出路径及运行行为不变。

## 范围与约束

- `prisma/schema.prisma` 保留 generator 和 datasource。
- 新增用户域与认证域 schema 文件：`User` 独立；`UserAuth`、`RefreshToken`、`RevokedToken` 同属认证域。
- Prisma 配置将 schema 路径从单文件改为 `prisma/` 目录。
- 迁移仍存放在 `prisma/migrations/`；不生成新迁移，不修改模型定义。
- 生成客户端仍输出至 `src/generated/prisma`。
- 更新 README 中关于修改 Prisma schema 文件的开发说明。

## 方案

- 按业务域拆分：推荐并已选定。文件数量适中，域边界清晰。
- 每模型单文件：当前模型数量少且仅涉及两个域，拆分过细，暂不采用。

## 验收

- Prisma 能校验并生成多文件 schema 对应的 Client。
- TypeScript 检查和现有测试通过。
- Git diff 不包含模型语义或迁移 SQL 的变更。
