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

- 版本工具链：`version:bump -- final` 子命令（rc 转正——只剥离 prerelease 后缀，M.N.P 与 build metadata 保持不变；已是正式版则报错退出）
- 版本工具链：`check-version.js --verify-source-list`（默认开启），校验 JS `VERSION_SOURCES` 与 Python `VERSION_SOURCE_FILES` 双写清单的集合与顺序一致
- 版本工具链：`npm run version:test`（`node:test`，45 个用例）
- 提交钩子接线：`npm run hooks:setup`（把权威钩子 `.husky/pre-commit` 复制到 `.git/hooks/pre-commit`，自动备份原文件）
- 提交钩子加固：`.husky/pre-commit` 合并为单一权威（9 节），新增肽结构 P0 修复防还原守卫与受保护文件暂存内容校验
- print / console.log 棘轮：`scripts/qc-ratchet.mjs` + `scripts/qc-baseline.json` + `npm run qc:baseline`（逐文件计数，只减不增）
- 发布文档集 [docs/release/](docs/release/)：发布流程总览（含两轴判定表）、CHECKLIST、ROLLBACK（四类回滚场景 SOP）
- [ADR-039 API 契约版本命名统一](docs/adr/ADR-039-API契约版本命名统一.md)（📋 提案）

### Changed

- `version:bump` 的 `patch` / `minor` / `major` 与 `prerelease` 语义修正：转正路径收敛为 `final` 唯一路径
- `.husky/pre-commit` 重写为 bash（原 `#!/bin/sh` 下 `PIPESTATUS`、数组等 bash 专有语法不可用），print / console.log 由「零违规即失败」改为棘轮基线
- 目录切换改为子 shell，消除原钩子 `cd frontend` 污染后续节工作目录的问题

### Fixed

- 仓库卫生：1,139 个运行期产物文件（`pg_data_new/` 971 + `coverage_measurements/` 95 + `pytest-of-Administrator/` 73）移出 Git 索引，`backend/` 跟踪文件由 2,891 降至 1,731
- `version-sources.js` / `bump-version.js` / `version.py` 三处注释「7 个承载点」更正为 8；`version.py` 注释中 `CURRENT_API_API_VERSION` 笔误更正
- **提交钩子空转**：`.husky/pre-commit` 从未被执行——husky 未安装在根目录、`frontend/package.json` 无 `prepare` 脚本、`core.hooksPath` 为空，而实际生效的 `.git/hooks/pre-commit` 未被 Git 跟踪。此前 README 宣称的 husky + lint-staged 提交钩子长期是虚假状态
- README 三处失实描述更正：提交钩子机制、`print()` 清理（实际存量 94 处而非已清零 9 处）、husky / lint-staged 状态
- ADR-007 两条不存在的迁移路径更正为实际结构

### Removed

- 根目录 21 个一次性临时输出与误操作产物移出索引（含 4.27 MB 的 OpenAPI 导出副本、UTF-16 日志误名文件），磁盘副本归档至 `backend/archive/trash-2026-10-25/`

---

## [2.0.0] - 2026-10-25

> **首个正式语义化版本发布**。此前项目无任何 git tag、无 CHANGELOG，
> 版本号停留在 `1.0.0`（三处 package.json）而 `backend/pyproject.toml` 已为 `2.0.0`。
> 本次以 `backend/pyproject.toml` 既有的 `2.0.0` 为锚点，统一全平台版本号，
> 并补齐版本治理基础设施。累计涵盖 **564 次提交**（2026-06-10 → 2026-10-25）与
> **48 篇 ADR**（001–039，含 7 组同号续篇）。

### Added — 版本治理基础设施

- 建立平台版本**单一事实源** `backend/app/version.py`（`__version__` / `VERSION_TUPLE` / `RELEASE_DATE`）
- 版本一致性门禁脚本 `scripts/version/check-version.js`（8 个承载点交叉校验 + 双写清单漂移检测）
- 版本发布助手 `scripts/version/bump-version.js`（patch / minor / major / rc / prerelease / final 原子化更新）
- CI 新增 `version-gate` job，PR 与 push 均强制校验版本一致性
- 根 [package.json](package.json) 新增 `version:check` / `version:bump` / `version:current` 脚本
- 本文件（CHANGELOG）与 [ADR-038](docs/adr/ADR-038-语义化版本发布体系.md) 版本策略记录
- 首个发布标签 `v2.0.0`

### Changed — 平台版本统一

- 平台发布版本由 `1.0.0` 统一升级为 **`2.0.0`**，覆盖 8 个承载点：
  `package.json` / `frontend/package.json` / `miniprogram/package.json` /
  `backend/pyproject.toml` / `backend/app/version.py` / `.env.example` /
  `backend/.env.example` / `CHANGELOG.md`

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
