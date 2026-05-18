# Global entity store + 实体解析

Status: ready-for-agent
Labels: feature

## Parent

[../PRD.md](../PRD.md)

## Blocked by

[05-opportunity-items-score-report.md](./05-opportunity-items-score-report.md)

## User stories covered

基础设施，PRD §6 无单独 user story；落地 ADR-0001 的双层存储模型。

## 用户价值 (User value)

跨 Query 复用同一公开 Entity——同一目标公司被两个不同用户查询时，公开层证据合并到同一实体行，避免重复抓取、保留证据时间线。这是 ADR-0001 描述的"公开层是平台资产"的第一步落地。

## 范围 (Scope)

- **全局公开层 Prisma 表**：
  - `global_entities`（id、type、canonical_name、normalized_url、attributes_json、created_at、updated_at）
  - `global_edges`（id、src_id、dst_id、type、attributes_json、created_at）
  - `global_evidence`（id、claim_target_id、claim_target_type: `entity` | `edge`、url、snippet、source_type、fetched_at）
- **`entity-resolver` 模块**：
  - 朴素策略：`canonical_name match` AND `normalized_url match` 同时为真才合并；任一不一致就**新建独立 Entity**（保守策略，避免误合并污染全局层）
  - `canonical_name` 计算：lowercase、去掉 `Inc.` / `Ltd.` / `Corp.` / `Co.` 等公司类后缀、压缩多空格
  - `normalized_url` 计算：lowercase、去掉 scheme、去掉 `www.`、去掉尾部斜杠和 query string；若是 LinkedIn / Crunchbase 等已知公开 profile 形态可做特殊归一
  - 解析输入是 `(type, raw_name, raw_url)`，输出是 `existing_entity_id | null`（null 表示需要新建）
- **`graph-build` 模块改造**（来自 #04 / #05）：
  - 接 `entity-resolver`：在创建新 Entity 前先查全局层
  - 命中 → 复用 entity_id，新增 Evidence 行（带新 fetched_at）
  - 未命中 → 新建 global_entity 行
  - **写入合并是幂等的**——两个并发 Query 同时第一次见到 "Acme Corp" 应该收敛到同一行（数据库唯一约束或乐观锁）
- **用户私有层不动**：`user_attachments` / `user_notes` 仍是 per-user，**不**经过 entity-resolver、**不**写 global_*
- **读取时叠加**：Query 渲染时，Graph 中的 global_entity 引用与该用户的 private context（来自 #08）叠加显示——但写入路径严格分层
- **审计**：每次 entity merge 在 `global_entities.attributes_json` 里附加一条 merge provenance 记录（哪个 Query 触发、何时合并），便于将来回溯

## 涉及的前端 / 后端 / 数据文件

- **前端**：无新页面；Report 中 Entity 显示 "evidence accumulated across N queries" 这类微小元数据可选
- **后端**：`backend/entity-resolver/`、`backend/graph-build/` 的合并逻辑、合并幂等性（数据库约束 + 应用层重试）
- **数据**：`prisma/migrations/0009_global_entities/migration.sql` 增加三张 global_* 表；`global_entities` 上加 `(type, canonical_name, normalized_url)` 唯一约束或部分唯一索引

## 验收标准 (Acceptance criteria)

- [ ] 两个不同用户查询同一 Target Organisation，全局层只产生一条 `global_entities` 行
- [ ] 不同名归一后相同 + 不同 URL → **不**合并（产生两条独立 entity 行）
- [ ] 不同名归一后相同 + 相同 URL → 合并到同一行，Evidence 累加
- [ ] 相同名 + 不同 URL → **不**合并（保守策略）
- [ ] 用户上传的附件（来自 #08）产生的 Entity **不**进 global_*
- [ ] 跨用户 read 隔离仍通过：User A 看不到 User B 的 private Entities，即便两者引用同一 global Entity
- [ ] 并发 Query 同时第一次发现同一 Entity 时，合并幂等：最终只有一行（不依赖锁顺序）

## 测试建议 (Testing suggestions)

- **Unit (exhaustive matrix)**：`entity-resolver` 输入组合——
  - 名同 + URL 同 → merge
  - 名同 + URL 不同 → 新建
  - 名不同 + URL 同 → 新建
  - 名不同 + URL 不同 → 新建
- **Unit**：`canonical_name` 归一——"Acme Inc.", "ACME Inc", "Acme, Inc.", "Acme  Inc." 都映射到同一字符串
- **Unit**：`normalized_url` 归一——`https://www.acme.com/`、`http://acme.com`、`https://acme.com/?utm=x` 都映射到同一字符串
- **Concurrency**：并发 upsert——两个 transaction 同时 upsert 同一 Entity，断言最终全局表只一行（Postgres ON CONFLICT 或 SERIALIZABLE 隔离级别）
- **Negative**：上传含 "Acme Corp" 提及的附件（来自 #08 的私有路径），断言 `global_entities` 行数不变
- **Cross-user isolation regression**：User A 和 User B 都查 Acme Corp 后，User A 的 Report 不包含 User B 私有 context 派生的 Entity
- **Prior art**：沿用 #04 的 fixture-based 测试、#02 的跨用户隔离测试模式
