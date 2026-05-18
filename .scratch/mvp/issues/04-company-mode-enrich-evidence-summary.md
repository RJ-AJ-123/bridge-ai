# Company-mode Enrich + Evidence Summary 视图

Status: ready-for-agent
Labels: feature

## Parent

[../PRD.md](../PRD.md)

## Blocked by

[03-company-mode-query-intake-extract-preview.md](./03-company-mode-query-intake-extract-preview.md)

## User stories covered

PRD §6 stories **15, 16, 17, 23, 30**（30 在本 slice 体现为"无 Evidence 不进图"的基础约束）。

## 用户价值 (User value)

用户能看到 BridgeAI 真实从公开源拉了什么——每条声明都可点击溯源、初步实体列表呈现 BridgeAI 的方向理解、信息缺口提示用户继续补充。Pipeline 在 `enriched` 状态停下，让用户能在不进入 Score 阶段的情况下评估证据质量。

#05 上线后，pipeline 自动从 `enriched` 流到 Score；但 Evidence Summary 视图保留作为可访问的中间产物（用于复核"这份 Report 是基于哪些证据评出来的"）。

## 范围 (Scope)

- **Stage 2 `enrich` 协调器**：按 Mode 分发；本 slice 内只实现 Company-mode 分发逻辑。
- **`source-adapters/website` adapter**：
  - 抓取工具：firecrawl 或 playwright（implementer 选）
  - 强制 robots.txt 检查——User-Agent: `BridgeAI/<version>`；不允许就标 `blocked-by-robots` 不抓
  - login-wall、CAPTCHA、paywall 检测——发现就标 `login-required` 不抓
  - 内容类型白名单：`text/html`、`application/pdf`、`application/json`
  - 大小上限 5MB；超时 15 秒
  - 抓取目标：landing、`/about`、`/team`、`/customers`、`/partners`、`/pricing`（按存在性）
- **`source-adapters/hiring-page` adapter**：同样的合规约束，目标是 Target Organisation 的 careers 页面（自检测或用 ExtractedQuery hints 中的 URL）
- 每个抓取产出一组 `Evidence` 行：`url`、`snippet`（≤500 字符）、`source_type`、`fetched_at`
- Prisma `enrichment_bundles` 表（PRD §11.3）+ `evidence` 表（id、claim_target_id、claim_target_type、url、snippet、source_type、fetched_at）
- **Stage 3a `graph-build` 最小版**：
  - Target Organisation 总是创建为 Entity（type: `Organization`）
  - 在抓取页面上能识别的 Person 创建为 Entity；和 Organization 之间建 `works-at` Edge
  - 每个 Entity / Edge 持有 Evidence 引用
  - **零 Evidence 的 claim 不进图**（这是 §9 合规硬规则的体现）
  - Graph 在本 slice 内可暂存于内存或临时表（#09 再决定持久化形态）
- **Evidence Summary 视图**（`frontend/app/queries/:id/evidence/page.tsx`）：
  - §1 Goal summary——从 ExtractedQuery 派生
  - 抓取的源列表——每个源带状态徽章（`fetched` / `blocked-by-robots` / `unreachable` / `login-required` / `unsupported-content-type` / `size-exceeded`）
  - Evidence 卡片列表——按 source URL 分组，每张卡显示 snippet + `fetched_at` + 可点击外链
  - 初步 Entity 预览列表——name + type + 关联 Evidence 计数
  - 信息缺口区——把 ExtractedQuery.unknowns 里仍未补的字段列出来
  - 显式不渲染 Score / Items / 6 节 Report——本 slice 内 pipeline 停在 `enriched`
- **状态机扩展**：`confirmed → enriching → enriched`、`enriching → failed`

## 涉及的前端 / 后端 / 数据文件

- **前端**：`frontend/app/queries/:id/evidence/page.tsx`、source-status badge 组件、Evidence card 组件、Entity preview 列表组件、信息缺口区组件
- **后端**：`backend/enrich/coordinator.ts`、`backend/enrich/adapters/website.ts`、`backend/enrich/adapters/hiring-page.ts`、合规 HTTP client（统一 User-Agent + robots 检查 + 内容类型白名单 + 大小/超时上限）、`backend/graph-build/`（最小版）、`POST /api/queries/:id/enrich`（确认后触发）、`GET /api/queries/:id/evidence`
- **数据**：`prisma/migrations/0004_enrich/migration.sql` 增加 `enrichment_bundles`、`evidence` 表 + state 列扩展枚举

## 验收标准 (Acceptance criteria)

- [ ] 用户确认 ExtractedQuery 后，Stage 2 启动；state 经历 `confirmed → enriching → enriched`
- [ ] 完成后用户跳转到 Evidence Summary 视图
- [ ] 所有 fetch 都有审计字段（URL、status、size、fetched_at），UI 显示状态徽章
- [ ] 被 robots.txt disallow 的 URL 一定标 `blocked-by-robots`，且**无任何 HTTP 请求发出**到该域名
- [ ] 含登录表单 / CAPTCHA / paywall 的页面标 `login-required`，**不**尝试抓内容
- [ ] 每条 Evidence 卡片显示 URL、snippet、fetched_at；URL 在新 tab 打开
- [ ] Entity 预览列表中每个 Entity 都有至少一条 Evidence 关联
- [ ] 信息缺口区列出 ExtractedQuery.unknowns 里未补字段
- [ ] 任何 Person / Edge 都不是无 Evidence 创建出来的（零 Evidence claim 不入图）
- [ ] 跨用户隔离回归仍通过

## 测试建议 (Testing suggestions)

- **Unit**：`source-adapters/website` 对固定 fixture HTML——happy path 提取 + snippet 截断
- **Unit**：robots.txt 屏蔽——fixture 含 `Disallow: /` 时返回 `blocked-by-robots`，并断言**未发起任何对该 URL 的真实 HTTP 调用**（mock fetch + spy）
- **Unit**：login-wall 检测——fixture 页面含 `<form>` + 登录关键词时返回 `login-required`
- **Unit**：内容类型白名单——`Content-Type: image/png` 拒绝
- **Unit**：大小上限——fixture 响应 > 5MB 时截断或拒绝
- **Unit**：超时——fixture 服务延迟 > 15s 时返回 `unreachable`
- **Unit**：`graph-build` 最小版——给固定 ExtractedQuery + 固定 EnrichmentBundle，断言生成的 Entity 集合和 Edge 集合稳定可重复
- **Unit**：零 Evidence claim 不入图的负面测试
- **Integration**：确认 ExtractedQuery → 状态机走到 `enriched` → Evidence Summary 视图返回的 JSON 含预期 source list、Evidence、Entity 预览
- **Prior art**：所有 source adapter 都要遵循同样的 fixture-based 测试模式；后续 #06 City-mode adapter、#07 News adapter 沿用
