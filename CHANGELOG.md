# 变更日志（CHANGELOG）

本文件记录 RMFOOD 智能配方设计平台的所有重要变更。

格式基于 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，
版本号遵循 [语义化版本 2.0.0](https://semver.org/lang/zh-CN/)。

> **版本策略**：完整规范见 [ADR-038 语义化版本发布体系](docs/adr/ADR-038-语义化版本发布体系.md)。
> **版本号单一事实源**：[package.json](package.json)（平台发布版本）／ [backend/app/version.py](backend/app/version.py)（后端运行时）。
> **一致性门禁**：`npm run version:check`，CI 中由 `version-gate` job 强制执行。
>
> ⚠️ 本仓库的 **平台发布版本**（本文件）与 **REST API 契约版本**（`v1` / `v2`，见
> [api_version.py](backend/app/api/api_version.py)）是两个独立轴，不得混用。

---

## [Unreleased]

### Added

- 暂无

---

## [2.0.0] - 2026-10-25

> **首个正式语义化版本发布**。此前项目无任何 git tag、无 CHANGELOG，
> 版本号停留在 `1.0.0`（三处 package.json）而 `backend/pyproject.toml` 已为 `2.0.0`。
> 本次以 `backend/pyproject.toml` 既有的 `2.0.0` 为锚点，统一全平台版本号，
> 并补齐版本治理基础设施。累计涵盖 **563 次提交**（2026-06-10 → 2026-10-25）与
> **46 篇 ADR**（001–037）。

### Added — 版本治理基础设施

- 建立平台版本**单一事实源** `backend/app/version.py`（`__version__` / `VERSION_TUPLE` / `RELEASE_DATE`）
- 版本一致性门禁脚本 `scripts/version/check-version.js`（7 个承载点交叉校验）
- 版本发布助手 `scripts/version/bump-version.js`（patch / minor / major / rc 原子化更新）
- CI 新增 `version-gate` job，PR 与 push 均强制校验版本一致性
- 根 [package.json](package.json) 新增 `version:check` / `version:bump` / `version:current` 脚本
- 本文件（CHANGELOG）与 [ADR-038](docs/adr/ADR-038-语义化版本发布体系.md) 版本策略记录
- 首个发布标签 `v2.0.0`

### Changed — 平台版本统一

- 平台发布版本由 `1.0.0` 统一升级为 **`2.0.0`**，覆盖 7 个承载点：
  `package.json` / `frontend/package.json` / `miniprogram/package.json` /
  `backend/pyproject.toml` / `backend/app/version.py` / `.env.example` / `CHANGELOG.md`

### Fixed — 运行时版本注入链路

- **修复 `APP_VERSION` 死配置**：`AppInfoConfig` 原无 `alias`，`.env.example` 声明的
  `APP_VERSION` 从未流入运行时。现 `Settings` 新增 `app_version_override` 字段
  （`alias="APP_VERSION"`），`settings.app_version` 属性按
  **环境变量 > `app.version.PLATFORM_VERSION`** 优先级取值
- 后端启动信息、健康检查、API 版本端点、OpenAPI 文档、API Docs 中间件的版本字段
  全部由死值 `"1.0.0"` 改为读取统一事实源，返回 `2.0.0`

### Added — 平台主要能力（本版本区间累计交付）

**AI 智能研发**
- 神经网络配方生成（`neural_formula_network` / `unified_formula_engine`）
- 多目标优化：GA / NSGA-3 / MOEA-D-CMA-ES / MCTS / 并行 MCTS / 模拟退火 / 梯度下降 / 贝叶斯 / LP
- 食源性肽序列分析与设计：Peplink + RDKit + SELFIES + `peptide_analyzer` 全套管线
- LLM 多 Provider 抽象（OpenAI / DeepSeek / 智谱 / 通义千问 / vLLM 自定义端点）
- RAG 检索增强（ChromaDB + FastEmbed 本地 embedding + 文档版本管理）
- Agent 多智能体编排（14 个工具 + MCP 桥接 + 辩论机制 + 记忆服务）

**数据与知识**
- TCMSP / SymMap / RMCHM / CFAM 四源中药数据库融合，**75 个 Alembic 迁移版本**
- DFBP 活性肽数据库 + UniProt / SwissProt 在线客户端
- Open Food Facts 同步 + 本地化映射 + 商品条码检索
- 知识图谱引擎 + 图查询 + 推理 Agent + 推理引擎（Neo4j 可选）
- BM25 / 混合 / 向量 / Elasticsearch 多路检索 + 中文 NLP（jieba）

**实验与合规**
- 电子实验记录本（ELN）+ 实验结果回写配方
- ANIML / JCAMP 仪器数据解析 + 信号处理
- 批次与样本溯源 + 自定义字段 + 价格变动影响分析
- COA 生成器（Word / PDF 导出）
- China Food Regulations 合规引擎 v1 / v2 + 预设约束

**企业能力**
- 多租户隔离（配额 + 安全 + AI 配置）
- RBAC 5 级角色 + 权限生命周期 + 细粒度装饰器
- 团队 / @提及解析 / 邀请链接 / 团队仪表板
- 云端同步（变更队列 + 冲突检测 + Diff 检测 + 同步协议）
- Prompt 版本历史 + Diff 对比 + 回滚
- WebSocket 实时通信（连接管理器 + 广播 + 团队通知）

**前端体验**
- 自建设计系统（Design Token 双源收敛 + 令牌生成器 + 主题门禁 CI）
- Radix UI / shadcn-ui 设计系统迁移
- AI 助手中心 12 个 Tab（对话 / 生成 / 安全 / 协同 / 口感 / 稳定性 / 学术 / Agent / 多目标 / GA / 敏感性 / 向导）
- 微信小程序端（31 个组件 + 3 个分包 + 14 个主包页面域）
- 中英双语国际化（105 个 i18n 文件）

### Fixed — 工程质量

- **TypeScript 编译错误清零**：从 1,331 → 140 → **0**（`tsc --noEmit` 实测通过）
- `console.log` 清理（413 → 0）
- bare `except` 修复（136 → 0）
- AI 硬编码阈值集中化治理（14 个引擎，2026-10-25 批次）
- `xlsx` 替换为 `exceljs`，移除未使用依赖 `passlib`

### Security

- 7 层纵深防御（OWASP Top 10 全覆盖）
- JWT 双 Token（Access + Refresh）+ bcrypt（cost=12）+ 账户锁定（5 次 / 15 分钟）
- API Key AES-256-GCM 加密 + HKDF 密钥派生 + 密钥轮换
- AI 安全专项：Prompt 注入防护 / 输出过滤 / 指令层级隔离 / 批量安全检查
- pip-audit + bandit + safety 供应链扫描接入 CI

### Docs

- [README.md](README.md) 全量重写为实测口径（962 行，41 个内部链接全部验证可达）
- ADR 索引治理：46 篇文档，7 组同号续篇以 `NNNb` 后缀登记
- 新增 ADR-038（语义化版本发布体系）

---

## [1.0.0] - 2026-06-10

> ⚠️ **历史版本，未打 git tag**。`1.0.0` 从未正式发布，仅为
> 三个 `package.json` 的初始默认值。此处登记仅用于保持版本谱系完整。

项目初始化（`git log --max-parents=0` → `71ddbb4 feat: initial commit - RMFOOD智能配方设计平台`），
同期建立 ADR-001 ~ ADR-005：六边形架构 / 事件驱动架构 / 数据分类分级 /
DDD 有界上下文 / 可观测性体系。

---

## 版本谱系

| 版本 | 发布日期 | 类型 | 基线 |
|:-----|:--------:|:-----|:-----|
| `1.0.0` | 2026-06-10 | 初始（未发布，无 tag） | 项目初始化 |
| **`2.0.0`** | **2026-10-25** | **首个正式发布** | **563 commits / 46 ADR** |

## 后续版本约定

| 变更类型 | 触发 MAJOR（3.0.0） | 触发 MINOR（2.1.0） | 触发 PATCH（2.0.1） |
|:---------|:-------------------|:--------------------|:--------------------|
| REST API 破坏性变更 | ✅（同时新建 API 契约版本） | — | — |
| 数据库不兼容迁移 | ✅ | — | — |
| 新增页面 / Tab / 路由 | — | ✅ | — |
| 新增后端端点（向后兼容） | — | ✅ | — |
| 缺陷修复 / 重构（无行为变化） | — | — | ✅ |
| 文档更新 | — | — | ✅ |

> 发布候选使用 `rc`：`2.1.0-rc.1` → `2.1.0-rc.2` → `2.1.0`。
> 完整规则见 [ADR-038](docs/adr/ADR-038-语义化版本发布体系.md)。
