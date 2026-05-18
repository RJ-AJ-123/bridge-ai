# 合规审计 + 成本上限 + Google OAuth

Status: ready-for-agent
Labels: feature

## Parent

[../PRD.md](../PRD.md)

## Blocked by

[05-opportunity-items-score-report.md](./05-opportunity-items-score-report.md)

## User stories covered

PRD §6 stories **2, 31**。

## 用户价值 (User value)

运营成熟度补全：每次外部 fetch 留底审计；单 Query 不会因为遇到极端输入烧穿 token 预算；用户多一个登录选项（Google OAuth）；端到端隔离回归覆盖所有 mode × source × 附件组合。

## 范围 (Scope)

### Fetch 审计日志

- 新表 `fetch_audit_log`（id、query_id、user_id、url、http_status、bytes_received、duration_ms、fetched_at、failure_reason）
- 所有出站 fetch 都通过统一 HTTP client（已在 #04 引入），client 在每次调用后写一行 audit log
- `LlmClient.complete` 也记录：模型、prompt token、completion token、duration、cost-estimate
- 前端：Query 详情页可展开 "Audit log" 抽屉，显示该 Query 触发的所有外部调用

### 单 Query 成本上限

- 配置项 `MAX_TOKENS_PER_QUERY`（默认值在 ADR-0003 决定时一并写下，建议初始 100k tokens）
- `LlmClient` 在每次 complete 前查询该 Query 已累计成本；超出时**早停**并把 Query state 转为 `failed`（reason: `cost-cap-exceeded`）
- 早停发生在 Stage 2 → `state = enrich-budget-exhausted`；发生在 Stage 3 → `state = score-budget-exhausted`（具体常量值由 implementer 在 schema 里加）
- 前端：早停时显示明确文案、当前累计成本、是否可调高 cap 后重试（MVP 暂不让用户在 UI 上调，只显示信息；后台可手动调环境变量重启服务）

### Google OAuth

- 在 #02 magic-link 之外新增 Google OAuth provider
- Sign-in 页面提供两个选项：邮箱 magic-link / Google
- 同一 email 在两种 provider 下登录视为同一用户（用 email 作为 user identity 锚点；`users.oauth_provider` 记录最近一次使用的 provider，可同时存在多种）

### 端到端隔离回归

- 把现有隔离测试扩展为一个矩阵：
  - Mode：`company` × `city`
  - Auth provider：`magic-link` × `google-oauth`
  - Source：`website` × `hiring-page` × `news` × `lu-ma` × `meetup` × `attachment`（按可用性组合）
  - 用户对：User A 不能读 User B 的任何资源
- 这套测试 CI 必跑、不可跳过

## 涉及的前端 / 后端 / 数据文件

- **前端**：sign-in 页面的 Google OAuth 按钮、Query 详情页的 Audit log 抽屉、cost-cap 早停时的状态文案
- **后端**：`backend/audit/` 模块、`LlmClient` 的成本累计中间件、Google OAuth provider 集成（沿用 #02 选定的 auth 库的 OAuth 支持，如 Auth.js / Lucia / 自写）、统一 HTTP client 的审计日志写入
- **数据**：`prisma/migrations/0011_audit_cost/migration.sql` 增加 `fetch_audit_log` 表、`users.oauth_provider` 列；query state 枚举扩展加入 `enrich-budget-exhausted` 和 `score-budget-exhausted`

## 验收标准 (Acceptance criteria)

- [ ] 每个 Enrich 阶段的 HTTP fetch 在 `fetch_audit_log` 留下完整记录（url、status、size、duration、fetched_at）
- [ ] 每次 LLM 调用都有 cost 记录（model、prompt token、completion token、cost-estimate）
- [ ] 审计日志在 Query 详情页可见，只对该 Query 的所有者可见（跨用户隔离）
- [ ] 单 Query 累计成本超出 `MAX_TOKENS_PER_QUERY` 时，pipeline **早停**且 state 明确（`enrich-budget-exhausted` 或 `score-budget-exhausted`）
- [ ] 早停后用户看到清晰文案，说明发生了什么、当前累计成本是多少
- [ ] 用户能用 Google OAuth 登录；登录后能看到自己之前用 magic-link 创建的 Query（基于 email 同一性）
- [ ] 端到端隔离矩阵测试全部通过，作为 CI 不可跳过的 gate

## 测试建议 (Testing suggestions)

- **Unit**：`LlmClient` 成本累计中间件——mock LLM 响应带 token 计数，断言累加正确
- **Unit**：成本上限触发——给定累计 90k token 状态，发起一个会产生 20k 的 call，断言中间件拒绝并触发早停
- **Unit**：审计日志 row 在 HTTP fetch 失败 / 成功两种 case 下都被写入
- **Integration**：Google OAuth 登录路径（用 Google 的 dev / staging credentials 或本地 mock）
- **Integration**：同 email 在 magic-link 和 Google OAuth 之间登录，断言 Query history 一致
- **Integration matrix**：所有 mode × auth × source × user 对的组合隔离回归测试——CI 中标记不可 skip
- **Prior art**：跨用户隔离测试从 #02 起一路维护，这里是收尾性的 comprehensive regression
