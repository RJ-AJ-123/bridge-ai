# Opportunity Items + Score + 6-section Report

Status: ready-for-agent
Labels: feature

## Parent

[../PRD.md](../PRD.md)

## Blocked by

[04-company-mode-enrich-evidence-summary.md](./04-company-mode-enrich-evidence-summary.md)

## User stories covered

PRD §6 stories **18, 19, 20, 21, 22, 24, 25, 26, 30, 32**。

## 用户价值 (User value)

用户拿到完整的 6 节 Report：评分过的 Opportunity Items、Decision Role 标签、每个 Item 的证据列表、Credibility 标签、Top-5 推荐动作 + 一句话理由。**这是 MVP 闭环的最后一环——闭环走完，BridgeAI 第一版上线可用。**

## 范围 (Scope)

- **Stage 3b `items-generate` 模块**：
  - 从 #04 的 Graph + ExtractedQuery 枚举候选 Opportunity Items
  - 每个 Item = `(target_entity_ids, suggested_action, opportunity_type, evidence_ids)`
  - `opportunity_type` 取值：`sales` | `collaboration` | `referral` | `recruitment` | `investment` | `resource-match`
  - **零 Evidence 的 Item 在创建前就丢弃**（永不进打分阶段）
- **Stage 3c `score` 模块**：
  - 8 维 LLM 评分（Sonnet 4.6 或 Opus 4.7 走 `LlmClient.complete`，**批量**调用以减少往返）
  - 维度：`opportunity-value`、`match`、`decision-influence`、`relationship-distance`、`credibility`、`action-feasibility`、`timeliness`、`risk-level`，全部 0–100
  - 默认权重见 PRD §10 表；权重作为常量，不开放用户自定义（#11+ 才考虑）
  - 加权聚合公式：`Σ w_i · d_i'`，其中 `risk-level` 反向 `d' = 100 − d`
  - **Veto 规则**：
    - `credibility < 30` → 标 `low-evidence`，从 §3 / §5 移除
    - `risk-level > 70` → 标 `high-risk`，从 §3 / §5 移除
    - `evidence.length == 0` → 在 `items-generate` 阶段就丢弃，根本不到 Score
- **Stage 3d `report-render` 模块**：
  - 6 节 MVP Report：§1、§3、§5、§6、§7、§9，**严格按 PRD §9 的字段 schema**
  - §3 上限 10 个 Entity，按其最高分关联 Item 的 `weighted_score` 降序
  - §5 每个 type 最多 5 个 Item，全 Report 最多 20 个 Item，组内按 `weighted_score` 降序
  - §7 credibility label 派生：`≥70 high` / `40–69 medium` / `30–39 low` / `<30 vetoed`
  - §9 取 §5 全局 top-5 Item，每条带 ≤200 字符的 one-line rationale（指出主导维度）
- Prisma `reports` 表（query_id、report_json、rendered_at）
- **状态机扩展**：`enriched → building-graph → scoring → rendering → done`、任一阶段失败 `→ failed`
- **Report 查看页**（`frontend/app/queries/:id/report/page.tsx`）：
  - 6 节渲染，每节带 anchor 锚点
  - §3 Person 行显示 **Company-mode Decision Role 标签**（chip 形式：`decision-maker` / `influencer` / `user-buyer` / `budget-owner` / `champion` / `blocker`）
  - §5 Item 卡片可展开看 8 维分数（雷达图或条形图均可）+ Evidence 引用
  - §7 credibility label 显示在 §5 每个 Item 卡的右上角
  - §9 top-5 列表，每条 inline rationale
  - 表头同时给到 Evidence Summary 视图的快捷入口（保留 #04 的中间产物可访问性）
- **Evidence Summary 视图（来自 #04）保持可访问**，作为已完成 Query 的中间产物

## 涉及的前端 / 后端 / 数据文件

- **前端**：`frontend/app/queries/:id/report/page.tsx`、Decision Role chip 组件（Company-mode 专用）、Item 展开卡片、8 维分数可视化组件、Credibility label 组件、§9 推荐动作列表
- **后端**：`backend/items-generate/`、`backend/score/`（含 LLM-driven 维度评分子模块 + 纯函数加权 + 否决规则）、`backend/report-render/`、LLM prompts for 维度评分；`GET /api/queries/:id/report`
- **数据**：`prisma/migrations/0005_score_report/migration.sql` 增加 `reports` 表 + state 枚举扩展

## 验收标准 (Acceptance criteria)

- [ ] 用户在 `enriched` 状态后无需再点击，pipeline 自动继续到 `done`
- [ ] Report 包含**且仅包含**六节：§1、§3、§5、§6、§7、§9
- [ ] §5 中 Items 按 Opportunity Type 分组；每组 ≤5 个，全 Report ≤20 个
- [ ] 每个 Item 都带 8 维分数；`weighted_score` 与公式计算结果差 ≤1
- [ ] `credibility < 30` 或 `risk-level > 70` 的 Item 不出现在 §3 / §5
- [ ] 零 Evidence 的 Item 永不被创建
- [ ] §9 恰好包含 §5 中全局 top-5 Item，按 `weighted_score` 降序
- [ ] §3 至多 10 个 Entity；Person 行带 Company-mode Decision Role chip
- [ ] Evidence Summary 视图（#04）对已完成 Query 仍可访问
- [ ] 跨用户隔离回归仍通过（User B 看不到 User A 的 Report）

## 测试建议 (Testing suggestions)

- **Unit (pure)**：`score` 加权聚合数学——给固定 dimension scores 和权重，断言 `weighted_score`；risk-level 反向断言
- **Unit**：Veto 规则——`credibility < 30` 标 `low-evidence`；`risk-level > 70` 标 `high-risk`；零 Evidence Item 在 `items-generate` 阶段被拒
- **Unit**：`items-generate`——给固定 Graph，断言生成的 Item 集合（ID、target、Action、Type、evidence_ids）稳定
- **Snapshot**：`report-render` 在固定 ScoredItem 列表下输出的 Report JSON
- **Unit**：Credibility label 派生函数——边界值 30 / 40 / 70
- **Unit**：§9 top-5 选取——给 30 个 Item，断言取出全局 top-5 而非每个 type top-1
- **Integration**：Company-mode 完整 pipeline `draft → done`，mock LlmClient，断言最终 Report 结构与字段
- **Performance check**：Score 阶段批量调用——单 Query 内的 LLM 往返次数有上限（document an SLO，比如 ≤3 次 batched calls per Query），在 CI 中做轻量断言避免 N+1 prompt 退化
