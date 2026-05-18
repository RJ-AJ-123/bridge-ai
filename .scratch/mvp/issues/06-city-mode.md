# City-mode 端到端

Status: ready-for-agent
Labels: feature

## Parent

[../PRD.md](../PRD.md)

## Blocked by

[05-opportunity-items-score-report.md](./05-opportunity-items-score-report.md)

## User stories covered

PRD §6 story **7**，以及 §6 stories 19/21/26 的 City 模式变体。

## 用户价值 (User value)

第二个 persona 上线——刚到陌生城市的个人能用 BridgeAI 找到值得参加的活动、值得认识的组织、可能的机会。Sales / BD 之外的使用场景验证。

## 范围 (Scope)

- **City-mode Query 表单**（前端）：City（单一字符串，下拉或自由输入由 implementer 选）、Industry（标签输入）、Skills（标签输入）、Goal（文本域）、known relationships（可选）。Mode 选择器的 City 选项启用。
- **Extract 的 City 分支**：
  - 单独的 prompt 模板
  - ExtractedQuery 的 mode-specific 部分含 `(city, industry, skills)` 结构化字段
  - City 模式下**不**填充 Company-mode 专属字段（target_organisation 等）
- **Enrich 协调器的 City 分发**：
  - **`source-adapters/lu-ma`** adapter——按 `(city, industry)` 查询 Lu.ma 的活动列表，抓取活动详情页（嘉宾、组织方、地点、日期），全部遵守 #04 的合规 HTTP client 约束
  - **`source-adapters/meetup`** adapter——同上，对 Meetup 的活动列表 + 详情
  - 数据返回为 Event Entity（type: `Event`）+ Organization / Person Entities + `speaks-at` / `organized-by` / `held-in` 等 Edges
- **Report 文案的 mode-aware 调整**：
  - §3 标题在 City 模式下从 "Key people and organisations" 改为 "Key communities, organisers, and people"
  - **Decision Role chip 在 City 模式下隐藏**——Decision Role 是 Company-mode 专属概念
  - §9 推荐动作的描述模板调整（如 "attend Event X" vs "request intro to Person A"）
- 不引入新的 Opportunity Type；现有 6 种（`sales` / `collaboration` / `referral` / `recruitment` / `investment` / `resource-match`）足以覆盖

## 涉及的前端 / 后端 / 数据文件

- **前端**：City-mode form 字段、Mode 切换逻辑、Report 视图的 mode-aware 文案
- **后端**：Extract 模块的 City 分支（prompt + JSON schema 分支）、`backend/enrich/adapters/lu-ma.ts`、`backend/enrich/adapters/meetup.ts`、Enrich 协调器扩展
- **数据**：`source_type` 枚举值扩展（增加 `event-listing`）；可能新增 `Event` 类型在 graph schema 的支持

## 验收标准 (Acceptance criteria)

- [ ] 用户能提交 City-mode Query 并最终拿到 6 节 Report
- [ ] Extract 输出包含 `(city, industry, skills)` 结构化字段
- [ ] Enrich for City mode 抓取 Lu.ma 和 Meetup；**不**调用 Company-mode adapters（website / hiring-page）
- [ ] Lu.ma 或 Meetup 任一源失败时，Pipeline 不阻塞（沿用 #04 的合规 HTTP client 行为，#10 会进一步加强 resilience）
- [ ] §3 在 City mode 下不显示 Decision Role chip
- [ ] §3 标题在 City 模式下使用 "Key communities, organisers, and people" 之类的措辞
- [ ] 同一 Goal 在 Company-mode 和 City-mode 下产生**显著不同**的 Report 内容（手动验收 + 一个 snapshot 测试）
- [ ] 跨用户隔离回归仍通过

## 测试建议 (Testing suggestions)

- **Unit**：Extract City-mode prompt 在固定 Brief 下产生预期 `(city, industry, skills)` 结构
- **Unit**：`source-adapters/lu-ma` 对固定 fixture 页面——happy path 抽取 Event + 嘉宾，robots / login-wall / 内容大小三类拒抓 case
- **Unit**：`source-adapters/meetup` 同上
- **Unit**：Enrich 协调器分发——City-mode 不触发 Company-mode adapter（mock + spy）
- **Integration**：完整 City-mode pipeline `draft → done`，mock LlmClient + mock adapters
- **Snapshot**：同一 Goal 在 Company-mode 和 City-mode 下渲染的 Report 不同（防止 mode 切换被静默无效化）
- **Prior art**：所有 adapter 沿用 #04 引入的 fixture-based 测试模式和合规 HTTP client 单测
