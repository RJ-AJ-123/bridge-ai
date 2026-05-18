# Company-mode Query intake + Extract preview

Status: ready-for-agent
Labels: feature

## Parent

[../PRD.md](../PRD.md)

## Blocked by

[02-auth-and-query-history.md](./02-auth-and-query-history.md)

## User stories covered

PRD §6 stories **5, 6, 8, 9, 11, 12, 13, 14**.

## 用户价值 (User value)

用户能提交真实的 Company-mode Query，并在花费 Enrich 成本之前看到 BridgeAI 如何理解他的输入、就地修正错读。这是产品差异化的核心 affordance——大多数 LLM 应用没有让用户校对 Extract 的机会。

## 范围 (Scope)

- **Company-mode Query 表单**（前端）：Target Organisation（名 + 可选 URL）、Goal（文本域）、known relationships（可重复字段列表）、可选 hints（budget range、timeline、preferred Decision Role）。
- Mode 选择器（Company / City），但 City 在此 slice 内 disable + 标 "coming in slice 06"。
- `POST /api/queries` 校验 Company-mode payload shape（Mode-aware）。
- **Stage 1 `extract` 模块**：
  - `LlmClient.complete(prompt, schema)` 抽象接口（这是唯一的 LLM 入口，参见 ADR-0002）
  - Anthropic SDK 集成，使用 Haiku-tier 模型（cheap、fast、structured-output）
  - prompt 按 PRD §11 schema 把 Brief 解析为 `ExtractedQuery`（resolved target、canonicalised goal、parsed known relationships、Mode-specific signals、`unknowns`）
- Prisma `extracted_queries` 表（schema 见 PRD §11.3）。
- **ExtractedQuery preview 页**（前端 `frontend/app/queries/:id/extracted/page.tsx`）：
  - 每个字段可就地编辑
  - `unknowns` 区可见，用户可补字段
  - 确认按钮：状态机 `extracted → confirmed`，跳转到下一阶段的占位页（#04 之前显示 "Enrichment coming soon"）
  - 取消按钮：状态机 `extracted → cancelled`
  - Stage 1 失败时显示重试按钮
- **状态机**初始集合：`draft → extracting → extracted → confirmed | cancelled`，以及 `extracting → failed`。

## 涉及的前端 / 后端 / 数据文件

- **前端**：`frontend/app/queries/new/page.tsx`（新 Query 表单）、`frontend/app/queries/:id/extracted/page.tsx`（preview 页）、mode 选择器、known-relationships 可重复字段组件、hints 子表单
- **后端**：`backend/extract/`（或同等模块路径）含 prompt 模板、`LlmClient` 抽象、Anthropic adapter；`POST /api/queries` 改造为同步触发 Stage 1（或返回 job handle，由 implementer 决定 UX）；`PATCH /api/queries/:id/extracted`（保存用户编辑）；`POST /api/queries/:id/confirm`、`POST /api/queries/:id/cancel`
- **数据**：`prisma/migrations/0003_extract/migration.sql` 增加 `extracted_queries` 表 + `queries.state` 列 + state 索引

## 验收标准 (Acceptance criteria)

- [ ] 用户提交 Company-mode Query 后，Query 持久化、state 经历 `draft → extracting → extracted`
- [ ] Extract 完成后，前端跳转到 preview 页，显示 resolved target、canonicalised goal、parsed signals、known relationships、`unknowns`
- [ ] 用户能编辑 preview 中的任意字段并保存
- [ ] 确认按钮使 state 变为 `confirmed`；之后页面显示 "Enrichment coming soon" placeholder（#04 上线后此 placeholder 会被替换）
- [ ] 取消按钮使 state 变为 `cancelled`
- [ ] Stage 1 LLM 失败时，前端显示重试按钮，再点击触发新一轮 Extract
- [ ] 所有 LLM 调用都通过 `LlmClient.complete`；换 provider 只改一处配置
- [ ] 跨用户隔离回归仍通过（User B 看不到 User A 的 ExtractedQuery）

## 测试建议 (Testing suggestions)

- **Unit**：Query payload 校验——Company-mode 必填字段、非法 Mode 拒绝、空 Goal 拒绝
- **Unit**：状态机——枚举合法和非法的 state 转移，断言非法 transition 抛错
- **Unit**：`LlmClient` 接口契约——provider mock 注入，断言 prompt 拼接正确、JSON schema 强制
- **Unit**：Extract 模块——给固定 fixture Brief + mock LlmClient（返回固定 JSON），断言生成的 ExtractedQuery row 与 fixture 匹配
- **Snapshot**：ExtractedQuery preview 页面在 fixture 数据下的渲染快照
- **Smoke E2E**：登录 → 新建 Query → 等待 Extract（mock LlmClient 走快路径）→ preview 出现 → 确认 → 落到 "Enrichment coming soon" placeholder
- **Prior art**：参考 #02 引入的跨用户隔离测试模式；本 slice 新增的 `extracted_queries` 表必须有 scoping 测试
