# Pipeline 健壮性 + 删除级联

Status: ready-for-agent
Labels: feature

## Parent

[../PRD.md](../PRD.md)

## Blocked by

[05-opportunity-items-score-report.md](./05-opportunity-items-score-report.md)

## User stories covered

PRD §6 stories **28, 33, 34, 35**。

## 用户价值 (User value)

Transient 错误不再毁掉整个 Query：单个源失败不阻塞整条 Enrich、单个 stage 失败可单独重试。用户能删除不再需要的历史 Query，级联清理私有数据但**保留**全局 Entity（合规与数据效率）。

## 范围 (Scope)

- **每个 stage 可独立重试**：
  - Stage 1 / 2 / 3a-3d 的失败入 `failed` 状态，前端展示哪个阶段失败 + 失败原因
  - 重试按钮触发从该阶段重新开始，**保留**前面阶段的产物（不重做 Extract / Enrich 已成功的部分）
  - 重试有上限（如 3 次），防止死循环
- **Stage 2 部分失败容错**：
  - 单个 source adapter 失败时，Enrich 协调器继续调用其他 adapter
  - EnrichmentBundle metadata 记录哪些源成功 / 失败 / 跳过
  - 只有当**所有**源都失败时整个 Stage 2 才算 `failed`
- **Query 取消**：
  - 用户在任意 in-progress 状态都能取消（`extracting` / `enriching` / `building-graph` / `scoring` / `rendering`）
  - 取消时停止正在进行的工作（best-effort——LLM 请求不一定能中止，但本地任务和数据库标记立即转 `cancelled`）
- **删除级联**：
  - `DELETE /api/queries/:id` 校验所有权，然后级联清理：
    - `queries` 行
    - `extracted_queries` 行
    - `enrichment_bundles` 行
    - `reports` 行
    - **该 Query 关联的** `user_attachments` 和 `user_notes` 行
    - **该 Query 关联的** evidence 行（per-query 持有的 evidence；全局层的 global_evidence 不删）
  - **不删** `global_entities` / `global_edges` / `global_evidence`（这些归属公开层，跨 Query 复用）
  - 实现要么用数据库级 `ON DELETE CASCADE` 要么在应用层显式级联，保证一致性
- **前端进度 UI**：
  - 在 Query 详情页展示 pipeline 各 stage 的实时状态（待开始 / 进行中 / 已完成 / 失败 / 已跳过）
  - 失败 stage 显示原因 + 重试按钮
  - 任意进行中状态显示取消按钮 + 删除按钮

## 涉及的前端 / 后端 / 数据文件

- **前端**：Query 详情页的 pipeline 进度组件、stage 状态徽章、重试按钮、取消按钮、删除确认对话框
- **后端**：pipeline orchestrator 增加 per-stage retry 逻辑、Enrich 协调器的部分失败模式、`DELETE /api/queries/:id` 级联清理、`POST /api/queries/:id/cancel`、`POST /api/queries/:id/stages/:stage/retry`
- **数据**：state 枚举扩展加入 `cancelled` 和 stage-level retry counters；EnrichmentBundle metadata 表或 JSON 列记录 source-level 成功 / 失败

## 验收标准 (Acceptance criteria)

- [ ] Stage 2 中其中一个 source adapter 失败（如 news-search timeout），Pipeline 仍能完成 Stage 2 并进入 Stage 3
- [ ] EnrichmentBundle metadata 中记录失败源的状态和原因
- [ ] 任一 stage 失败后，用户可点击"重试"，**仅**重跑该 stage 及其后；前面的 Extract / Enrich 产物被复用
- [ ] 单 Query 内单 stage 重试次数 > 3 时禁止再重试，建议用户取消或删除
- [ ] 用户在任一 in-progress 状态可取消，state 立即变为 `cancelled`
- [ ] `DELETE /api/queries/:id` 移除该 Query 所有相关行；`global_entities` / `global_edges` 行数不变
- [ ] 跨用户：User B 不能 `DELETE` User A 的 Query（403/404）
- [ ] 同一 Query 删除两次返回幂等（第二次 404 或已删除标记，但不抛错）

## 测试建议 (Testing suggestions)

- **Unit**：per-stage 重试——给定中间状态，断言从对应 stage 重新开始且不重做前置
- **Unit**：retry 上限——第 4 次重试被拒
- **Unit**：删除级联——给定 fixture Query（含 attachments、notes、evidence），删除后断言：
  - Query / ExtractedQuery / EnrichmentBundle / Report / 该 Query 的 attachments / notes / per-query evidence 全部清除
  - `global_entities` / `global_edges` / `global_evidence` 行数不变
- **Unit**：跨用户删除——User B 删除 User A 的 Query 返回 403/404
- **Unit**：删除幂等——同 ID 删两次不抛
- **Integration**：模拟 source adapter 中途失败的完整 pipeline，断言 Pipeline 最终产出 Report（degraded but valid）
- **Integration**：取消正在 enriching 的 Query，断言 state 立刻是 `cancelled`，后续不再产生新 Evidence 行
- **Prior art**：跨用户隔离回归（#02、#08、#09）继续维护
