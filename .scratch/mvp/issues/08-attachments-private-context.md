# Attachments + private context

Status: ready-for-agent
Labels: feature

## Parent

[../PRD.md](../PRD.md)

## Blocked by

[05-opportunity-items-score-report.md](./05-opportunity-items-score-report.md)

## User stories covered

PRD §6 stories **10, 29**。

## 用户价值 (User value)

用户能把已有上下文（邮件、PDF、截图、prior contract、手写笔记）传进来，BridgeAI 拿来作为 Stage 1 Extract 的额外输入。这是用户私有信号——比任何公开数据源都更有针对性。隔离严格：**永不**汇入全局 Entity 库。

## 范围 (Scope)

- **附件上传 UI**（在 Query 新建页或 ExtractedQuery preview 页二选一）：
  - 拖拽 + 文件选择
  - 支持类型：PDF、PNG / JPG、TXT、`.eml`、`.msg`（Outlook）
  - 上传中状态指示
  - 上传后显示已识别文件名 + 大小 + 已抽取文本预览
- **后端文件接收**：
  - 文件大小上限（默认 20MB 单文件）
  - 类型白名单 + magic-byte 校验（不能只信扩展名）
  - 上传到对象存储（local filesystem in dev、S3 兼容存储 in prod）
- **文本抽取**：
  - PDF → 文本（pdf-parse 或 unpdf 等）
  - 图像 → OCR（tesseract.js 或服务端 tesseract binary）
  - `.eml` / `.msg` → MIME 解析提取 body + 发件人 / 收件人 / 时间
  - 纯文本直接读
  - **抽取失败的附件标 `extraction-failed` 并向用户展示**，不阻塞 Query 提交
- **私有存储**：
  - Prisma `user_attachments` 表（id、user_id、query_id、filename、content_type、storage_uri、text_extracted、uploaded_at）
  - Prisma `user_notes` 表（id、user_id、query_id、body、created_at）——用户在 ExtractedQuery preview 页可输入自由笔记
  - **绝不**写入 `global_entities` 或 `global_evidence`——这是 ADR-0001 的硬约束
- **Stage 1 Extract 改造**：
  - Extract 的 prompt 输入除 Brief 外，把附件的 `text_extracted` 和 user notes 一并拼入
  - LLM 看到的内容总长有上限（如 50k token），超出时按时间倒序截断并提示用户
- **删除级联**：删除 Query 时连同删除该 Query 下的 attachments 和 notes（具体级联在 #10 实现，本 slice 保证外键关系正确）

## 涉及的前端 / 后端 / 数据文件

- **前端**：文件上传组件、拖拽区、附件列表、抽取预览、user-notes 编辑器
- **后端**：`backend/attachments/upload.ts`、`backend/attachments/extract.ts`（PDF / OCR / MIME 派发器）、`backend/attachments/storage.ts`（local fs / S3 adapter）、Extract 模块的 prompt 拼装扩展
- **数据**：`prisma/migrations/0008_attachments/migration.sql` 增加 `user_attachments` 和 `user_notes` 表（带 `user_id` 和 `query_id` 外键）

## 验收标准 (Acceptance criteria)

- [ ] 用户能在新 Query 流程中上传 PDF、PNG、JPG、TXT、`.eml`，文件被抽取为文本并显示预览
- [ ] 抽取后的文本进入 Stage 1 Extract 的 prompt 输入
- [ ] User B **无法**通过任何 endpoint 读取 User A 的附件或 notes（read isolation 强制）
- [ ] 损坏 / 不支持 / 超大的文件被拒绝或标 `extraction-failed`，**Query 仍可提交**，无附件影响其他附件
- [ ] 删除 Query 时附件和 notes 一同删除（验收依赖 #10，但本 slice 至少要让外键关系正确支持级联）
- [ ] 附件和 notes **从未**进入 `global_entities` 或 `global_evidence`（用一个回归测试验证：上传含 "Acme Corp" 提及的附件后，global_entities 表无变化）

## 测试建议 (Testing suggestions)

- **Unit**：PDF 抽取——固定 fixture PDF
- **Unit**：OCR——固定 fixture PNG 含已知文本
- **Unit**：MIME 解析——固定 fixture `.eml` 提取 body + 发件人
- **Unit**：损坏文件——fixture 损坏 PDF 被标 `extraction-failed`，不抛
- **Unit**：跨用户 read isolation——User B 用自己 session 请求 User A 的附件 URL，返回 404
- **Unit**：私有上下文不进全局——上传含 "Acme Corp" 内容的附件后，断言 `global_entities` 表行数不变（一个明确的负面测试，作为合规回归）
- **Integration**：上传附件 → Stage 1 Extract 调用时 prompt 包含附件抽取的文本（断言 LlmClient 收到的 input 含附件内容）
- **Prior art**：跨用户隔离测试模式沿用 #02
