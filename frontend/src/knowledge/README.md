# 前端知识库 JSON 资源

本目录存放平台知识库的前端静态数据资源。此前 4 个文件均为孤儿文件（全库无 import），
2026-10-23 已做如下处置：

| 文件 | 用途 | 接入状态 |
|------|------|----------|
| `terminology-dict.json` | 药食同源 / 多肽领域专业术语词典（中英定义、缩写、单位、示例） | ✅ 已接入：`src/knowledge/terminology.ts` 加载器 → 知识库面板 `KnowledgeBasePanel` 的「术语词典」速查（`components/ai/rag/TerminologyLookup.tsx`） |
| `herb-compatibility.json` | 药食同源成分配伍禁忌/协同知识库（十八反、十九畏、增效配伍、安全警告） | 📋 数据资源，暂未接入。建议接入点：`backend/app/services/ai/rag/seeder.py`（作为 RAG 种子文档之一注入）或前端 `CompatibilityChecker`/配方校验 UI |
| `tcm-database-schema.json` | 药食同源数据库 Schema 定义（ingredients 主表/字段约束/索引） | 📋 Schema 资源，暂未接入。建议接入点：数据库迁移/ORM 模型生成参考，或 `docs/adr` 数据建模文档 |
| `peptide-database-schema.json` | 食源性多肽数据库 Schema 定义（peptides 主表/字段约束/索引） | 📋 Schema 资源，暂未接入。建议接入点：多肽数据库迁移/ORM 模型生成参考，或 `docs/adr` 数据建模文档 |

## 接入约定

- 新增代码如需使用术语词典，请通过 `@/knowledge/terminology`（`searchTerminology` / `TERMINOLOGY_ENTRIES`）读取，不要直接 `import` JSON 散落各处。
- JSON 文件不支持注释；如需补充说明，请维护本 README，或在 JSON 顶部增加 `_note` 元数据字段。
- 接入新 JSON 时需确认 `tsconfig` 已开启 `resolveJsonModule`（2026-10-23 已开启）。