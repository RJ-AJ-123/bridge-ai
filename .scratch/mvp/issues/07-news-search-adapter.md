# News search adapter

Status: ready-for-agent
Labels: feature

## Parent

[../PRD.md](../PRD.md)

## Blocked by

[05-opportunity-items-score-report.md](./05-opportunity-items-score-report.md)

## User stories covered

PRD §6 story **15**（更多源覆盖）；间接提升 §7 credibility 维度（更多独立来源 → 更高 credibility）和 §10 timeliness 维度的信号质量。

## 用户价值 (User value)

Report 不再只基于目标公司自己网站说的话——近期新闻、融资消息、人事变动这类公开信号进入证据池，提升 Report 的时效性和可信度。

## 范围 (Scope)

- **`source-adapters/news-search`** adapter：
  - 抽象 `SearchProvider` 接口（`search(query: string, limit: number) → SearchResult[]`），底层 implementor 可选 Tavily、Bing Search、Brave Search 任一
  - 配置切换 provider 只改一处配置文件，不改 adapter 代码
  - 单次查询上限 10 条结果
  - 对每条结果抓取（如对方允许）+ LLM 总结成 bullet（沿用 Haiku-tier 走 `LlmClient.complete`）
  - 每条 SearchResult 落地为 Evidence（`source_type: "news"`、url、snippet、fetched_at）
- **Enrich 协调器扩展**：Company-mode 和 City-mode **均触发** news-search
  - Company-mode：查询 `"<target organisation> news"` 或更精细的 `"<target organisation> <industry hint>"`
  - City-mode：查询 `"<city> <industry> news"`
- **失败容错**：search API 错误 / rate limit / 超时 → 该 adapter 跳过，**不阻塞** Enrich 的其他源
- 配置项：`NEWS_SEARCH_PROVIDER`（环境变量）、`NEWS_SEARCH_RESULT_LIMIT`（默认 10）

## 涉及的前端 / 后端 / 数据文件

- **前端**：Evidence Summary 视图（#04）和 Report §6 自动接收新的 `source_type: news` evidence，无 UI 改动**除非**要新增专门的 News 徽章——可选
- **后端**：`backend/enrich/adapters/news-search.ts`、`backend/enrich/providers/search/{tavily,bing,brave}.ts`、`SearchProvider` 接口定义、Enrich 协调器变更
- **数据**：`source_type` 枚举增加 `news`；无新表

## 验收标准 (Acceptance criteria)

- [ ] News search adapter 在 Company 和 City 两种模式的 Enrich 阶段都被调用
- [ ] 每次调用结果数 ≤ 10
- [ ] 每条结果产出一条 Evidence，`source_type: "news"`，url 可点击到原文
- [ ] Provider 失败 / rate limit / 超时时，adapter 标记自己 skipped，Enrich 的其他源不受影响
- [ ] 切换 `NEWS_SEARCH_PROVIDER` 配置项后，只需重启服务即可换 provider，**不需要改任何代码**
- [ ] Report 中能看到 news Evidence 影响了 `credibility` 或 `timeliness` 维度（人工抽检验收）

## 测试建议 (Testing suggestions)

- **Unit**：`source-adapters/news-search` happy path——mock SearchProvider 返回固定 5 条结果，断言产出 5 条 Evidence
- **Unit**：Result 数上限——mock provider 返回 20 条，断言 adapter 截断到 10
- **Unit**：Provider 失败容错——mock provider 抛错，断言 adapter 标 skipped 且不抛出到上层
- **Unit**：每个具体 SearchProvider impl（Tavily / Bing / Brave）对各自 API 响应格式的解析单测，用 recorded fixtures
- **Integration**：Company-mode 完整 pipeline，启用 news adapter，断言 Report Evidence 列表中含 `source_type: news` 行
- **Prior art**：沿用 #04 source adapter 的 fixture-based 测试组织
