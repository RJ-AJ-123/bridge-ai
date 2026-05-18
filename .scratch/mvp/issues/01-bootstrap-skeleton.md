# Bootstrap skeleton — 工程脚手架 + 栈定型 ADR

Status: ready-for-agent
Labels: feature

## Parent

[../PRD.md](../PRD.md)

## Blocked by

None — can start immediately.

## User stories covered

Foundational. No PRD §6 user story is fully delivered here; this slice unblocks every later slice from being able to land code.

## 用户价值 (User value)

工程脚手架就绪：栈选择固化在 `ADR-0003`、第一版迁移跑通、CI 绿、可访问的 stub UI 端到端连通。后续 11 个 slice 不再被栈决策阻塞。

## 范围 (Scope)

- 初始化 Next.js 14（App Router，TypeScript）。前端代码放 `frontend/`。
- 初始化 Prisma + Postgres。Prisma schema 放 `prisma/schema.prisma`，第一版迁移仅包含一个占位 `queries` 表（`id`、`user_id`(预留外键)、`mode`、`payload_json`、`state`、`created_at`）。
- HTTP `POST /api/queries`（Next.js API route 或 Route Handler）接受请求体，原样回显并附加一份**硬编码 stub Report JSON**（结构对齐 PRD §9 即可，内容占位）。
- 前端单页：一个表单（mode 选择 + 一个 `goal` 文本域）→ 提交 → 显示返回 JSON。**不实现真实表单语义**，只验证端到端连通。
- CI（GitHub Actions 或等价）跑：`pnpm install`、`pnpm lint`、`pnpm typecheck`、`pnpm test`。Postgres 用 service container 拉起，跑 `prisma migrate deploy`。
- **产出 `docs/adr/0003-tech-stack.md`**：记录 TypeScript + Next.js + Prisma + Postgres 这一选择的理由（编入团队、栈一致、ORM 成熟、单一仓库便于 vertical slice 开发），以及考虑过的替代（Python + FastAPI、TypeScript + Hono、Drizzle 等）。

## 涉及的前端 / 后端 / 数据文件

- **前端**：`frontend/app/page.tsx`（占位首页 + 表单）、`frontend/app/api/queries/route.ts`（如采用 Next.js Route Handler）、`frontend/package.json`、`frontend/tsconfig.json`、`frontend/next.config.js`
- **后端**：可选 `backend/`（如选择独立 Node service）或与前端合并到 Next.js Route Handlers。在 #1 内做出决定并写入 ADR-0003。
- **数据**：`prisma/schema.prisma`、`prisma/migrations/0001_init/migration.sql`
- **基础设施**：`.github/workflows/ci.yml`、`docker-compose.yml`（本地 Postgres）
- **文档**：`docs/adr/0003-tech-stack.md`

## 验收标准 (Acceptance criteria)

- [ ] `pnpm install && pnpm dev`（或选定的包管理器/启动命令）能在本地启动应用，无错误
- [ ] 浏览器打开首页，提交表单后返回 stub Report JSON，前端展示内容含用户输入回显
- [ ] `pnpm test` 通过；至少存在一个示例单测确认测试框架工作
- [ ] `pnpm lint` 和 `pnpm typecheck` 全绿
- [ ] Prisma 能连接 Postgres 并跑通 `0001_init` 迁移
- [ ] CI 在新分支推送时跑通全部 step
- [ ] `docs/adr/0003-tech-stack.md` 已落地，包含选定栈和被否决的替代方案

## 测试建议 (Testing suggestions)

- **Smoke E2E**：Playwright（或等价）一个测试，启动应用 + 提交表单 + 断言返回 JSON 含 stub Report 的关键字段
- **Unit**：一个示例单测（如对一个简单的工具函数），主要为了验证测试 runner、覆盖率工具、Prisma test 数据库 setup 正常
- **没有 prior art**：本仓库尚无测试。本 slice 引入的测试组织规约是后续所有 slice 的 prior art，请明确把测试目录结构和命名习惯写在 README 或 `docs/testing.md` 里
