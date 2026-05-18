# Auth + Query history — 登录与历史

Status: ready-for-agent
Labels: feature

## Parent

[../PRD.md](../PRD.md)

## Blocked by

[01-bootstrap-skeleton.md](./01-bootstrap-skeleton.md)

## User stories covered

PRD §6 stories **1, 3, 4, 27**.

## 用户价值 (User value)

用户能通过 magic link 登录、看到自己以往的所有 Query；跨用户隔离从 day 1 强制——保证 ADR-0001 的"每用户私有上下文"边界在第一次写入时就被守住。

## 范围 (Scope)

- Magic-link 登录（实现库由 implementer 选：Auth.js / Lucia / 自写均可）。邮件 provider 在 dev 用 console-log fake，prod 用 Resend / Postmark / SendGrid 任一。
- Prisma schema 扩展：`users`（id、email、created_at、last_login_at）和 `sessions`（id、user_id、expires_at、token_hash）。
- Session 中间件：从 cookie / Authorization header 解析 session、注入到所有受保护 route 的 context。
- `POST /api/queries` 升级为受保护 route：未登录返回 401；已登录把 `user_id` 写入 Query 行。
- `GET /api/queries`：只返回当前 user 的 Query 列表，按 `created_at` 倒序。
- 前端：
  - 登录页 `frontend/app/(auth)/sign-in/page.tsx`——邮箱输入 + 发送链接 + "已发送，请检查邮箱" 状态
  - Magic-link 回调处理（接受 token，验证，建立 session）
  - 历史页 `frontend/app/queries/page.tsx`——卡片列表，每张卡显示 Query mode、target、状态、`created_at`
  - 受保护页路由：未登录时跳转到登录页
  - 登出按钮
- **跨用户隔离测试**：必须从 day 1 存在，作为后续 slice 的回归基线。

## 涉及的前端 / 后端 / 数据文件

- **前端**：`frontend/app/(auth)/sign-in/page.tsx`、magic-link verify route、`frontend/app/queries/page.tsx`、登出组件、auth-aware layout wrapper
- **后端**：auth provider 集成模块（`backend/auth/` 或同等位置）、session 中间件、`POST /api/queries` 改造、`GET /api/queries` 新增、magic-link 邮件发送
- **数据**：`prisma/schema.prisma` 增加 `users`、`sessions`，`prisma/migrations/0002_auth/migration.sql`，`queries.user_id` 外键列

## 验收标准 (Acceptance criteria)

- [ ] 未登录请求 `POST /api/queries` 返回 401
- [ ] 在 dev 环境提交邮箱，console / 本地邮件日志出现 magic link，点击后用户登录成功
- [ ] 登录后能看到自己创建的 Query 列表，但看不到别的 user 的
- [ ] User B 通过 `GET /api/queries` 或 `GET /api/queries/:id` 无法获取 User A 的 Query（404 或 403，绝不返回数据）
- [ ] 跨用户隔离单测覆盖：read scoping + write scoping 两个方向
- [ ] 登出后 session 失效，再次访问受保护页跳回登录

## 测试建议 (Testing suggestions)

- **Unit**：Query repository 的 scoping 逻辑——给定 User A 和 User B 各自的 Query，断言 User B 的 session 无法 read User A 的 Query
- **Unit**：session 中间件——valid token / expired token / missing token 三种 case
- **Integration**：完整登录链——POST 邮箱 → 假 provider 截获 magic link → GET 验证 link → cookie 写入 → 访问受保护 endpoint
- **Regression test guard**：把跨用户隔离测试在 CI 标记为不可跳过；后续 slice 改 Query 模型或新增表时必须维持这套测试通过
