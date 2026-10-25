# RMFOOD 智能配方设计平台

> 面向药食同源功能性食品的 AI 驱动配方研发平台
>
> 传统中医食疗智慧 × 现代营养学 × 分子生物学数据库 × 多目标优化算法

<p align="center">
  <img src="https://img.shields.io/badge/Version-2.0.0-brightgreen.svg" alt="Version" />
  <img src="https://img.shields.io/github/v/release/rmfood/rmfood-platform?label=Release&color=brightgreen" alt="Release" />
  <img src="https://img.shields.io/badge/Python-3.12+-blue.svg" alt="Python" />
  <img src="https://img.shields.io/badge/FastAPI-0.115.0-green.svg" alt="FastAPI" />
  <img src="https://img.shields.io/badge/React-19.2-61DAFB.svg" alt="React" />
  <img src="https://img.shields.io/badge/TypeScript-5.7-3178C6.svg" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Vite-8.0-646CFF.svg" alt="Vite" />
  <img src="https://img.shields.io/badge/TailwindCSS-4.1-06B6D4.svg" alt="TailwindCSS" />
  <img src="https://img.shields.io/badge/License-MIT-yellow.svg" alt="License" />
  <img src="https://img.shields.io/badge/TypeScript_Errors-0-success.svg" alt="TypeScript Errors" />
  <img src="https://img.shields.io/badge/AI_API-API%20v1-orange.svg" alt="AI API" />
</p>

> **本文档的数据口径**
>
> 本 README 中所有规模数字均来自仓库实测（`git ls-files` + `tsc --noEmit` + `grep` 统计），
> 统计基准日为 **2026-10-25**，基准提交 **`v2.0.0`**。
> 发布版本号由 [CHANGELOG.md](CHANGELOG.md) 与 [git tag](https://github.com/rmfood/rmfood-platform/tags) 权威记录，
> 见 [ADR-038 语义化版本发布体系](docs/adr/ADR-038-语义化版本发布体系.md)。
> 凡无法实测的口径（成熟度百分比）均明确标注来源或标注「待复核」，不写推测数字。

---

## 目录

- [项目概述](#项目概述)
- [版本与代际地图](#版本与代际地图)
- [项目规模实测](#项目规模实测)
- [功能全景](#功能全景)
- [技术架构](#技术架构)
- [迭代里程碑时间线](#迭代里程碑时间线)
- [架构决策记录（ADR）](#架构决策记录adr)
- [工程质量与质量门禁](#工程质量与质量门禁)
- [测试策略](#测试策略)
- [安全体系](#安全体系)
- [快速开始](#快速开始)
- [项目结构](#项目结构)
- [CI/CD 流水线](#cicd-流水线)
- [Docker 部署](#docker-部署)
- [已知技术债务](#已知技术债务)
- [贡献指南](#贡献指南)
- [许可证与致谢](#许可证与致谢)

---

## 项目概述

**RMFOOD (Recipe Management for Optimal Organic Design)** 是一个企业级 AI 智能配方设计平台，
专注于**药食同源功能性食品**的研发全流程。

平台以「君臣佐使」配伍原则为中医逻辑基座，以网络药理学预测与多目标优化算法为现代工程手段，
覆盖 **配方设计 → 安全合规评估 → 实验验证 → COA 出具 → 学术报告** 的完整研发链路，
并提供 Web 端 + 微信小程序双端交付。

### 核心能力矩阵

| 维度 | 能力 | 技术实现 |
|:-----|:-----|:---------|
| **AI 智能研发** | 神经网络配方生成 | `neural_formula_network` / `unified_formula_engine` / `pytorch_generator` |
| | 多目标优化 | GA / NSGA-3 / MOEA-D-CMA-ES / MCTS / 并行 MCTS / 模拟退火 / 梯度下降 / 贝叶斯 / LP |
| | 肽序列设计与分析 | Peplink + RDKit + SELFIES + `peptide_analyzer` 全套管线 |
| | LLM 对话系统 | Provider 抽象层（OpenAI / DeepSeek / 智谱 / 通义千问 / vLLM 自定义端点）+ 连接池 |
| | RAG 检索增强 | ChromaDB + FastEmbed 本地 embedding + 文档版本管理 |
| | Agent 多智能体 | 编排器 / 辩论机制 / 分组会话 / 记忆服务 / 14 个工具 + MCP 桥接 |
| **数据驱动决策** | 中药材数据库 | TCMSP / SymMap / RMCHM / CFAM 四源融合，Alembic 持续迁移 |
| | 活性肽数据库 | DFBP + UniProt/SwissProt 在线客户端 |
| | 食品原料库 | Open Food Facts 同步 + 本地化映射 + 商品条码检索 |
| | 知识图谱 | 图引擎 + 查询 + 推理 Agent + 推理引擎（Neo4j 可选） |
| | 检索体系 | BM25 / 混合检索 / 向量检索 / Elasticsearch（可选）/ 中文 NLP（jieba） |
| **实验管理** | 电子实验记录本 | 实验生命周期 + 结果回写配方 + 分享链接 |
| | 仪器数据解析 | ANIML / JCAMP 解析器 + 信号处理器 |
| | 批次与溯源 | 批次服务 / 样本追踪 / 自定义字段 / 价格变动影响分析 |
| | COA 出具 | COA 生成器 + Word/PDF 下载 |
| | 合规性检查 | China Food Regulations 集成 + 合规引擎 v1/v2 + 预设约束 |
| **协作与企业功能** | 多租户隔离 | 租户配额 / 租户安全 / AI 配置隔离 |
| | 权限控制 | RBAC 5 级角色 + 权限生命周期 + 细粒度装饰器 |
| | 团队协作 | 团队 / 团队仪表板 / @提及解析 / 邀请链接 |
| | 云端同步 | 变更队列 + 冲突检测 + Diff 检测 + 同步协议 |
| | 版本控制 | Prompt 版本历史 + Diff 对比 + 回滚 |
| | 实时通信 | WebSocket 连接管理器 + 广播 + 团队通知 / 在线状态 |
| **工程质量** | 国际化 | i18next 中英双语（105 个 i18n 文件，AI 模块独立命名空间） |
| | 主题系统 | Design Token 双源收敛 + 令牌生成器 + 主题门禁 CI |
| | 插件架构 | 插件注册中心 / 核心插件 / API Key 管理 |
| | 容器化部署 | Docker Compose 5 服务 + 多阶段构建 |

---

## 版本与代际地图

> ✅ **本仓库自 `v2.0.0`（2026-10-25）起建立正式语义化版本体系**，
> 决策记录见 [ADR-038 语义化版本发布体系](docs/adr/ADR-038-语义化版本发布体系.md)，
> 变更历史见 [CHANGELOG.md](CHANGELOG.md)，首个标签 `v2.0.0`。

### 单一权威源模型

平台发布版本以**根 `package.json` 的 `version`** 为唯一权威源，其余 7 处为镜像。
CI 中 `version-gate` job 强制 8 处一致，漂移即阻断流水线。

| # | 文件 | 角色 |
|:-:|:-----|:-----|
| 1 | [`package.json`](package.json) | **权威源** |
| 2 | [`frontend/package.json`](frontend/package.json) | Web 前端镜像 |
| 3 | [`miniprogram/package.json`](miniprogram/package.json) | 微信小程序镜像 |
| 4 | [`backend/pyproject.toml`](backend/pyproject.toml) | 后端构建元数据 |
| 5 | [`backend/app/version.py`](backend/app/version.py) | 后端运行时事实源 |
| 6 | [`.env.example`](.env.example) | 环境变量示例（根） |
| 7 | [`backend/.env.example`](backend/.env.example) | 环境变量示例（后端） |
| 8 | [`CHANGELOG.md`](CHANGELOG.md) | 变更历史条目 |

**本地操作**

```bash
npm run version:check        # 校验 8 个承载点一致（人类可读）
npm run version:check:ci     # 同上，JSON 输出（CI 使用）
npm run version:bump -- patch    # 2.0.0 -> 2.0.1
npm run version:bump -- minor    # 2.0.0 -> 2.1.0
npm run version:bump -- major    # 2.0.0 -> 3.0.0
npm run version:bump -- rc       # 2.1.0 -> 2.1.0-rc.1
npm run version:current          # 打印当前版本
```

`bump` 脚本只改文件、**不执行 git commit**，以便人工审阅完整 diff 后再提交打 tag。

**提交钩子接线**（克隆仓库后必做一次）

```bash
npm run hooks:setup   # 把 .husky/pre-commit 接线到 .git/hooks/pre-commit
npm run qc:baseline   # 仅在有意保留新增违规时刷新 print/console 基线
```

> ⚠️ husky **未安装**在根目录，`frontend/package.json` 虽声明了 husky ^9.1.7 但没有 `prepare` 脚本，
> 因此 `.husky/` 下的钩子长期空转——这是 2026-10-25 实测确认的治理缺陷。
> 本项目改用 `.git/hooks/pre-commit` + `npm run hooks:setup` 接线，`.husky/pre-commit` 是唯一权威源。

### 两个正交的版本轴（勿混用）

| 轴 | 当前值 | 含义 | 权威位置 | 运行时暴露 |
|:--:|:------:|:-----|:---------|:-----------|
| **A. 平台发布版本** | **`2.0.0`** | 整个平台迭代到第几代 | `package.json` | `app.version`、`/api/v1/info` 的 `app_version` |
| **B. REST API 契约版本** | **`v1`** | 接口协议第几版 | [`backend/app/api/api_version.py`](backend/app/api/api_version.py) | `X-API-Version` 响应头、`api_versions` 矩阵 |

**两轴独立演进**：平台 `2.x` 全程运行 API `v1`。实测 `GET /api/v1/info`
返回 `{"api_version": "1.0.0", "app_version": "2.0.0"}`，两轴并列可见。
平台 MAJOR 不必然意味着 API MAJOR，反之亦然。

### 其他代际标记（模块内部代号，不纳入平台版本）

| 层级 | 当前代数 | 依据（可核查） |
|:-----|:--------:|:---------------|
| **架构决策** | **ADR-039**（共 48 篇 ADR 文档） | [docs/adr/index.md](docs/adr/index.md)，最新 ADR-039（API 契约版本命名统一）日期 2026-10-25 |
| **数据库迁移** | **第 75 个 Alembic 版本文件** | `git ls-files backend/alembic/versions/*.py` = 75 |
| **AI 助手中心（模块 CHANGELOG）** | **v8.0.0** | [frontend/src/components/ai/features/CHANGELOG.md](frontend/src/components/ai/features/CHANGELOG.md)：`[8.0.0] - 2026-05-12` |
| **AI 助手中心（源码标记）** | **v9.0** | `KnowledgeGraph.tsx` / `usePerformanceMonitor.ts` / `useReportGenerator.ts` / `MemoizedChatMessage.tsx` / `GraphTab.tsx` 内标记 |
| **前端子系统** | **v8.0 → v9.0** | v8.0：`useFormulaManager` / `useOfflineManager` / `ChatInputArea` / `formulaTransformer` / `useKeyboardShortcuts`；v9.0：`KnowledgeGraph` / `usePerformanceMonitor` / `useReportGenerator` / `MemoizedChatMessage`（流式渲染引擎） |
| **智能引擎代际** | **V4** | `professionalIntelligenceEngineV4.ts`（最新）、`useThinkingProcessV3`、`ChatSidebarV4.tsx`、Hybrid NLP 引擎 V2 |
| **微信小程序** | 独立迭代中 | [ADR-028-微信小程序开发方案.md](docs/adr/ADR-028-微信小程序开发方案.md) 状态「📋 提案」 |

> ℹ️ 上表中的 `v8.0.0` / `v9.0` / `V4` 均为**模块内部代号**，与平台发布版本正交，
> 不驱动 CHANGELOG 与 git tag。是否将其并入统一版本体系留待 AI 模块下一次大版本时决策。

### 版本口径演变（已解决）

| 冲突项 | 历史说法 A | 历史说法 B | 处理结果 |
|:-------|:-----------|:-----------|:---------|
| 平台版本 | `package.json` = 1.0.0 | README = v2.0 | ✅ 以 `pyproject.toml` 既有的 `2.0.0` 为锚点统一，8 处一致，打 `v2.0.0` tag |
| `APP_VERSION` 环境变量 | `.env.example` 声明 | 运行时从不读取（死配置） | ✅ `Settings` 新增 `app_version_override`，环境变量已可生效 |
| 运行时 `app_version` | 硬编码 `"1.0.0"` | 构建产物实际 2.0.0 | ✅ 改为读取 `backend/app/version.py`，返回 `2.0.0` |
| 版本端点 | `/api`、`/api/v1/info` 未注册 | — | ✅ 修复 `_IncludedRouter.path` AttributeError，端点首次成功注册 |
| AI 模块版本 | README = v10.0 | 模块 CHANGELOG = v8.0.0 | ⏸️ 保留为正交轴，README 不再宣称 AI v10.0 |
| 引擎版本 | V2 / V3 / V4 混用 | 易被误读为平台 v4.0 | ⏸️ 登记为「引擎内部代号」，独立 ADR 待定 |
| 迁移数量 | 旧 README = 16 个 | 实测 = 75 个 | ✅ 本文件已更正为 75 |
| TS 错误数 | 旧 README = 140 个 | 实测 = **0 个** | ✅ 本文件已更正为 0 |

---

## 项目规模实测

> 统计方法：`git -c core.quotepath=false ls-files`（仅统计版本库跟踪文件，
> 不含 `node_modules` / `venv` / `__pycache__`；禁用路径转义以正确统计含中文名的文件）
> 统计时间：2026-10-25 ｜ 基准提交：**`v2.0.0`** ｜ 累计提交：**564 次**

### 总量

| 维度 | 实测数量 |
|:-----|:--------:|
| Git 提交总数 | **564** |
| 发布标签（`git tag -l`） | **1**（`v2.0.0`） |
| 后端 Python 文件（`backend/` 全部） | **1,430** |
| 后端应用代码（`backend/app/`，`.py`） | **783** |
| 后端 API 端点装饰器 | **1,011** |
| 前端源码文件（`frontend/src/`） | **1,485** |
| 前端测试文件（`__tests__` + `*.test.*` + `*.spec.*`） | **142** |
| 后端测试文件（`backend/tests/` 189 + `app/tests/` 13 + 根 `tests/` 27） | **229** |
| Alembic 迁移版本文件（`backend/alembic/versions/`） | **75** |
| 微信小程序源码（不含 `miniprogram_npm` 依赖） | **356** |
| 文档资产（`docs/`） | **583** |
| 架构决策记录（`docs/adr/`，`.md`） | **47** |
| GitHub Actions 工作流 | **2**（含 11 个 Job） |
| 版本治理脚本（`scripts/version/`） | **3** |

### 后端分层（`backend/app/`，783 个 `.py` 文件）

| 层 | 文件数 | 说明 |
|:---|:------:|:-----|
| `services/` | **402** | 业务服务，20+ 子域（全部文件 421） |
| `api/` | **132** | 路由层（顶层 61 / `v1/` 44 / `db_modules/` 14 / `ai_modules/` 13；全部文件 133） |
| `core/` | **99** | 核心基础设施（配置/数据库/安全/RBAC/可观测/性能/实时/合规） |
| `models/` | **55** | SQLAlchemy ORM 模型 |
| `schemas/` | **22** | Pydantic Schema |
| `domain/` | **17** | 领域层（端口 + 领域模型，零外部依赖） |
| `infrastructure/` | **16** | 适配器实现 |
| `tests/` | 13 | 应用内测试 |
| `utils/` | 10 | 工具（加密/邮件/验证码/设备指纹） |
| `cqrs/` | 7 | 命令查询职责分离 + 事件处理器 |
| `application/` | 3 | 应用门面（`mobile_facade` / `rag_service`） |
| 其他（`data/` `factories/` `middleware/` `websockets/` + 根） | 7 | `main.py` / `version.py`（版本单一事实源，ADR-038）/ `__init__.py` / `mock_ai_responses` / `adapters_factory` / `data_masking` / `notification_handler` |

### 后端服务子域 Top（`backend/app/services/`）

| 子域 | 文件数 | 核心职责 |
|:-----|:------:|:---------|
| `ai/` | 139 | Agent 编排 / 算法 / 模型 / 对话 / RAG / 安全 / Prompt / Provider |
| `formula/` | 42 | 配伍 / 协同 / 营养 / 稳定性 / 口感 / 质量 / 安全预警 / LP 求解 |
| `data_sources/` | 27 | TCMSP / DFBP / Open Food Facts / 图服务 / 法规 / 采集管线 |
| `ai_models/` | 25 | 神经网络引擎 / MCTS / 模拟退火 / 梯度下降 / PepInvent / 打分器 |
| `peptide_analyzer/` | 14 | 活性预测 / 安全预测 / ML 训练 / NumPy MLP / 真实数据源客户端 |
| `import_engine/` | 12 | 导入适配器 / Celery 任务 / 映射器 |
| `search/` | 11 | BM25 / 混合 / 向量 / ES / 流式 / 合规 / 中文 NLP |
| `openfoodfacts/` | 9 | OFF 客户端 / 加载 / 本地化 / 映射 / 同步追踪 |
| `peptide_analysis_v2/` | 7 | 特征抽取 / 预处理 / UniProt / SwissProt |
| `batch/` / `sync/` | 6 / 6 | 批次溯源 ｜ 同步协议 / 冲突 / Diff |
| `kg/` | 5 | 图引擎 / 图查询 / 推理 Agent / 推理引擎 |
| `report/` / `compliance/` / `nutrition/` / `experiment/` | 4 / 4 / 4 / 4 | 报告 ｜ 合规 ｜ 营养标签 ｜ 仪器解析 |

### 前端分层（`frontend/src/`，1,485 文件）

| 层 | 文件数 | 层 | 文件数 |
|:---|:------:|:---|:------:|
| `components/` | **780** | `hooks/` | 62 |
| `pages/` | **189** | `services/` | 52 |
| `i18n/` | **105** | `api/` | 46 |
| `utils/` | 71 | `types/` | 33 |
| `config/` | 30 | `stores/` | 24 |
| `src/__tests__/` / `src/tests/`（顶层） | 19 / 11 | `theme-pro/` / `theme/` | 5 / 4 |

> 全 `frontend/src/` 测试文件合计 **142 个**（含各子目录内嵌 `__tests__/` 与 `*.test.*` / `*.spec.*`）。

### 前端组件域（`frontend/src/components/`，781 文件）

| 组件域 | 文件数 | 组件域 | 文件数 |
|:-------|:------:|:-------|:------:|
| **`ai/`** | **514** | `layout/` | 6 |
| `ui/` | 63 | `search/` / `inference/` / `nutrition/` | 4 / 4 / 4 |
| `database/` | 57 | `coa/` / `theme/` | 4 / 4 |
| `dashboard/` | 23 | `experiment/` / `report/` / `sync/` | 3 / 2 / 2 |
| `analytics/` | 22 | `molecule/` / `import/` / `file/` | 2 / 2 / 2 |
| `formula/` | 19 | 其余（batch / workflow / auth / team / mobile / integrations / notification） | 各 1 |
| `academic/` | 19 | | |
| `history-sidebar/` | 8 | | |

### 后端文件分布（`backend/` 全量 1,731 个跟踪文件）

| 位置 | 文件数 | 位置 | 文件数 |
|:-----|:------:|:-----|:------:|
| `app/` | 855 | `scripts/` | 372 |
| `app/services/` | 421 | `tests/` | 189 |
| `static/` | 109 | `alembic/` | 79 |
| `app/api/` | 133 | `migrations/` | 22 |
| `app/core/` | 100 | `backend/` 根目录 | 64 |
| `app/models/` | 55 | `requirements/` | 12 |
| `app/data/` | 44 | 其余（`ml_artifacts`/`data`/`deploy`/`services`/`.github`/`reports`/`conf`/`config`） | 29 |

> 其中 Python 源文件共 **1,430 个**（`app/` 783 + `tests/` 184 + `scripts/` 351 +
> `alembic/` 76 + `backend/` 根目录 36）。
>
> **运行期产物已移出索引**（2026-10-25 仓库卫生治理）：`pg_data_new/` 971 +
> `coverage_measurements/` 95 + `pytest-of-Administrator/` 73 = **1,139 个文件**已
> `git rm --cached`（仅移出索引，磁盘文件保留），治理前占 `backend/` 跟踪文件的 39.4%。
> 三者均已加入 `.gitignore`。总量 **2,891 → 1,731**。另将根目录 21 个一次性
> 临时输出/误操作产物移出索引并归档至 `backend/archive/trash-2026-10-25/`（52 文件
> 共 42.9 MB，磁盘保留）。

---

## 功能全景

### 交付端

| 端 | 目录 | 状态 | 说明 |
|:---|:-----|:----:|:-----|
| **Web 前端** | `frontend/` | 主交付 | React 19 + Vite 8 + TS 5.7，33 个一级页面域 |
| **微信小程序** | `miniprogram/` | 并行迭代 | 31 个自定义组件 + 3 个分包 + 14 个主包页面域 |
| **后端 API** | `backend/` | 主服务 | FastAPI，1,011 个端点，`/api/v1` 主前缀 |

### Web 前端：33 个一级页面域

| 分类 | 页面域 |
|:-----|:-------|
| **AI 与研发** | `ai`（AI 助手中心）、`agent`（Agent 工作流）、`workflow`（可视化工作流）、`experiment`（实验管理）、`stability`（稳定性）、`peptide-structure`（肽链结构分析）、`ingredient`（成分分析） |
| **配方与产品** | `formula`（配方管理，最复杂域）、`batch`（批次）、`label` / `labels`（标签）、`terminology`（术语标准化） |
| **数据与知识** | `database`（数据检索中心，6 Tab）、`analytics`（数据分析，4 Tab）、`documents`（文档）、`regulations`（法规）、`compliance`（合规标准） |
| **企业与协作** | `organizations`（组织管理，6 Tab）、`teams` 相关、`invitations`（邀请）、`billing`（订阅计费）、`integrations`（集成）、`notification`（通知） |
| **系统与治理** | `dashboard`（首页仪表盘）、`settings`（设置）、`user`、`admin`（管理后台）、`auth`（认证）、`whitelist`（白名单预注册） |
| **公开与营销** | `landing`（落地页）、`public`（公开文档/FAQ/定价）、`radix-demo`（组件演示） |

### AI 智能助手中心（`/ai`，核心模块）

位于 [frontend/src/components/ai/features/](frontend/src/components/ai/features/)，514 个文件。
Tab 入口定义于 `features/` 顶层：

| Tab | 组件 | 能力 |
|:----|:-----|:-----|
| **智能对话** | `ChatTab.tsx` | 流式响应（`MemoizedChatMessage` v9.0 流式渲染引擎）、思考过程可视化 V3、多会话管理、斜杠命令、@引用回复、文件上传、命令面板、语言切换 |
| **配方生成** | `GenerateTab.tsx` | 遗传算法 / 多目标 / 神经网络多模式、多候选批量生成与对比、帕累托前沿、约束面板、算法配置、配方解释、版本管理、多格式导出 |
| **多目标优化** | `MultiObjectivePanel.tsx` | 帕累托前沿、目标权重、收敛分析 |
| **遗传算法** | `GeneticAlgorithmPanel.tsx` | 种群 / 适应度 / 选择-交叉-变异可视化、GA 图表 |
| **敏感性分析** | `SensitivityAnalysis.tsx` | 单因子滑块实时重算、龙卷风图、场景对比 |
| **安全合规检查** | `SafetyTab.tsx` | 成分安全审查、禁忌检测、过敏原识别、风险矩阵、合规仪表盘、批量检测、安全报告 |
| **协同功效分析** | `SynergyTab.tsx` | 协同/拮抗效应、雷达图、功效网络、推荐参数面板 |
| **口感预测** | `TastePredictTab.tsx` | 口感评分、3D 风味雷达（`FlavorWheel3D`）、偏好学习 |
| **稳定性评估** | `StabilityPredictTab.tsx` | 稳定性评分、时间序列、降解曲线、龙卷风敏感性 |
| **学术报告** | `AcademicReportTab.tsx` | 模板引擎 v1.0、版本控制与 Diff、PDF/Word 导出 |
| **Agent 工作流** | `AgentWorkflowTab.tsx` | 多智能体编排可视化、工作流节点、React Chain |
| **配方向导** | `FormulaWizard.tsx` | 分步配置（功效目标 → 约束 → 高级选项）、权重拖拽、预设保存 |
| **候选对比** | `CandidateComparison.tsx` | 多候选并排、雷达叠加、成分差异高亮、帕累托散点 |

**专业版对话组件**（`features/components/pro/`，22 个文件）：
`ChatMessages` / `ChatInputPro` / `ChatSidebar` / `ChatSidebarV4` / `MarkdownRenderer`（零依赖）/ `TypewriterText`（打字机 + 跳过）/ `ChatHistory` / `MessageList` / `MessageBubble` / `ReasoningRow` / `InlineReasoningRow` / `DetailsPanel` / `ComposerStatusBar` / `FollowUpSuggestionsBar` / `FormulaCard` / `EnhancedContentRenderer` / `ThinkingProcess` / `WorkflowNodeVisualizer` / `DSActions`

**结构化消息块**（`features/components/structured/blocks/`）：
`HeaderBlock` / `ListBlock` / `DataTableBlock` / `MetricsBlock` / `CalloutBlock` / `DividerBlock` / `TimelineBlock` / `ChartBlock` / `SynergyChartBlock` / `IngredientDetailBlock`

使用方式：`import { ChatMessages } from './components/pro'`

### 微信小程序

| 维度 | 实测 |
|:-----|:-----|
| 自定义组件 | **31 个**（含 Apple 系列设计语言组件 + `GlobalIcons` 统一图标） |
| 主包页面域 | **14 个** |
| 分包 | **3 个**：`chat`（对话）、`formulas`（配方列表/详情）、`ingredient`（成分分析） |
| 源码文件（不含 npm 依赖） | **356 个** |

**组件清单**：`AppleButton` / `AppleCard` / `AppleList` / `AppleNavBar` / `AppleSearchBar` / `Avatar` / `Badge` / `Button` / `Card` / `Checkbox` / `Divider` / `EmptyState` / `ErrorBoundary` / `FormulaCard` / `GlobalIcons` / `HealthScore` / `Icon` / `Input` / `LazyImage` / `Loading` / `Modal` / `NavBar` / `NutritionLabel` / `ProgressBar` / `Radio` / `SkeletonLoader` / `Stepper` / `Switch` / `Tabs` / `Tag` / `Toast` / `VirtualList`

**主包页面**：`index` / `search` / `database`（+`herb-detail`）/ `compliance` / `constitution`（体质辨识）/ `calendar` / `compare` / `profile`（+`history` / `favorites` / `feedback`）/ `settings` / `login` / `agreement` / `privacy` / `icon-showcase`

> 已按计划完成「数据检索中心」与「合规标准」两个主项目模块在小程序端的落地（对应 `pages/database` 与 `pages/compliance`）。

### 后端能力域

| 域 | 关键模块 |
|:---|:---------|
| **AI 服务** | `services/ai/` — Agent 编排（14 工具 + MCP 桥）、算法库（GA/NSGA-3/MOEA-D/MCTS/贝叶斯/LP/统一优化器）、模型（GAN 判别器/自回归生成器/RL 调参/信号编码器）、对话引擎、RAG、安全（Prompt 防护/输出过滤/指令层级/批量检查） |
| **配方引擎** | `services/formula/` — 七步引擎、协同引擎 + 计算器、营养引擎 + 缓存、稳定性预测、口感预测、功效模拟、框架引擎、质量引擎、保存引擎、色香引擎、PK/PD 数据库、LP 求解器、多算法编排器、安全预警系统 |
| **肽分析** | `peptide_analyzer/` + `peptide_analysis_v2/` — 活性预测、安全预测、NumPy MLP、真实 ML 训练、SwissProt/UniProt 客户端、特征抽取、预处理 |
| **数据源** | `data_sources/` — TCMSP / DFBP / Open Food Facts / 图服务 / 中国法规 / 自动同步 / 采集管线 + 校验器 |
| **搜索** | `search/` — BM25 / 混合 / 向量 / ES / 流式 / 中文 NLP / 合规引擎 v1/v2 / 搜索分析 / 优化器 |
| **知识图谱** | `kg/` — 图引擎、图查询、推理 Agent、推理引擎 |
| **实验与批次** | `experiment/`（ANIML/JCAMP 解析 + 信号处理）、`batch/`（批次/样本追踪/自定义字段/价格影响）、`doe/`（实验设计）、`coa_generator` + `coa_service`（COA） |
| **合规与营养** | `compliance/`（合规引擎 + 预设约束）、`nutrition/`（营养数据库 + 标签生成 + 导出）、`label_check` / `label_generator` |
| **企业能力** | `multi_tenant/`（隔离策略 + 租户 AI 配置 + 配额）、`sync/`（协议 + 冲突 + Diff + 变更队列）、`team/`、`version/`、`notification/`（@提及解析）、`audit_service` |
| **扩展框架** | `plugin_registry/`、`mcp_server/`、`fact_engine/`、`import_engine/`（适配器 + Celery）、`document_extractor/` |
| **架构分层** | `domain/`（端口：agent/bot/herb/knowledge/mobile/rag/sensory/registration）、`infrastructure/`（适配器实现 + 事件总线 + 微服务网关）、`cqrs/`（事件处理器 + 查询）、`application/`（门面） |

### 后端 API 域

`backend/app/api/` 共 132 个文件、1,011 个端点：

- **顶层路由（61 个文件）**：`auth` / `oauth2_auth` / `users` / `user_settings` / `formulas` / `ingredients` / `experiments` / `ai` / `chat` / `databases` / `knowledge_base` / `knowledge_graph` / `search` / `search_analytics` / `dashboard` / `workflows` / `notifications` / `websocket` / `analytics` / `analytics_scheduler` / `organizations` / `teams` / `integrations` / `file_generator` / `attachments` / `comments` / `comment_likes` / `activity` / `categories` / `tags` / `terminology` / `admin` / `audit` / `enterprise` / `pre_register` / `pre_register_admin` / `whitelist` / `sync` / `articles` / `api_version` / `router_registry` + **肽模块 7 个**（`peptides` / `peptide_analysis_routes` / `peptide_design_routes` / `peptide_structure_routes` / `advanced_peptide` / `food_peptide_routes` / `pepinvent`）+ `lab_validation` / `formula_integration` / `formula_validation` / `coa_routes` / `herb_food` / `herb_images` / `rmchm_images` / `mobile` / `rag_router`
- **`v1/`（44 个文件）**：企业级路由 — `ai_task` / `agent` / `bot` / `group` / `batches` / `samples` / `tasks` / `task_group` / `doe` / `experiment_data` / `formula_cases` / `ingredient_analysis` / `kg` / `report` / `report_export` / `document` / `import` / `compliance` / `label` / `label_check` / `stability` / `metrics` / `usage` / `quota` / `tenant` / `version` / `sync` / `team` / `team_dashboard` / `notification` / `websocket` / `workflow_exec` / `plugin` / `mcp` / `admin_mcp` / `github_mcp` / `data_flywheel` / `fact_engine` / `explainability` / `core` / `query` / `mo_stream` / `ray`
- **`db_modules/`（14 个文件）**：数据检索中心 — `herbs`（TCMSP/SymMap/药食同源）/ `compounds` / `peptides` / `cfam_herbs` / `database_extras`（RMCHM/CFAM/药材图片）/ `food_materials` / `retail_products` / `pantry`（收藏）/ `openfoodfacts` / `search`（统一搜索 + 知识图谱 + 同步）/ `dashboard`（热度排行 + 趋势 + 数据质量）/ `sync` / `import_db`
- **`ai_modules/`（13 个文件）**：`chat` / `generation` / `generation_v2` / `optimization` / `genetic` / `recommendations` / `coordination` / `experiment` / `models_and_tools` / `versions` / `demo` / `utility_endpoints`

---

## 技术架构

### 系统架构全景

```
┌─────────────────────────────────────────────────────────────────┐
│                        交付端                                    │
│   Web 前端 (React 19 + TS 5.7 + Vite 8 + Tailwind 4)            │
│   微信小程序 (原生 + 31 组件 + 3 分包)                           │
└───────────────────────────────┬─────────────────────────────────┘
                                │ REST / WebSocket / SSE
┌───────────────────────────────▼─────────────────────────────────┐
│                     后端 (FastAPI 0.115 / Python 3.12)          │
│                                                                  │
│   api (132 文件 / 1,011 端点)                                    │
│     ├─ 顶层 61  ─┬─ v1/ 44  ─┬─ db_modules/ 14  ─┬─ ai_modules/ 13 │
│        │                                              │          │
│   application (门面) ─── core (99 模块基础设施)               │
│        │                    │                            │      │
│   domain (端口) ─────── infrastructure (适配器)              │
│        │                    │                            │      │
│   cqrs (事件/查询) ── services (402 文件 / 20+ 子域)          │
│                              │                              │    │
│   models (55 ORM) ─── schemas (22 Pydantic)                 │
└───────────────────────────────┬─────────────────────────────────┘
                                │
        ┌───────────────┬───────┴───────┬────────────────┬─────────┐
        ▼               ▼               ▼                ▼         ▼
   PostgreSQL 16     Redis 7        ChromaDB        Neo4j (可选)  Elasticsearch (可选)
   16+ 迁移表         缓存/队列      向量检索           知识图谱       全文搜索
        │
        └── Alembic 75 个迁移版本
```

### 后端架构模式

- **六边形架构（Ports & Adapters）**：`domain/`（端口 + 领域模型，零外部依赖）↔ `infrastructure/`（适配器）↔ `application/`（门面）
  - 注：[ADR-001 六边形架构重构](docs/adr/ADR-001-六边形架构重构.md) 状态为「⏸️ 已暂停」，当前为**渐进式落地**状态（17 个领域端口 + 16 个适配器已存在）
- **DDD 有界上下文**：[ADR-004](docs/adr/ADR-004-领域驱动设计有界上下文划分.md)
- **CQRS + 事件驱动**：`cqrs/handlers/`（`formula_updated_handler` / `event_handlers`）+ `infrastructure/event_bus.py` + `microservice_event_bus.py`
- **应用工厂**：`app/main.py` → `create_app()` + `lifespan` 生命周期（数据库初始化 / CDC 监听 / 缓存 / WebSocket / 延迟路由注册）
- **路由注册**：`api/router_registry.py` 自动发现注册 + `main.py` 内 36 处 `include_router` / `prefix`

### 应用生命周期（`backend/app/main.py`）

| 阶段 | 操作 | 模块 |
|:-----|:-----|:-----|
| 启动 | 日志初始化 + 版本打印 | `core/observability/logging_config` |
| 启动 | 数据库初始化（建表 / 种子数据） | `core/database/init_db` |
| 启动 | CDC 变更捕获监听器 | `core/compliance/cdc_listener` |
| 启动 | 缓存服务初始化 | `core/performance/cache_system` |
| 启动 | WebSocket 连接管理器 | `core/realtime/websocket_manager` |
| 启动 | 延迟注册非关键路由 | `api/register_lazy_routers` |
| 关闭 | CDC / WebSocket / 缓存有序关闭 | — |

### 中间件链

```
请求 → analytics_response_time → audit_middleware → error_handler (全局异常)
     → rate_limiter (速率限制) → CORS → security_middleware (安全响应头)
     → encoding (UTF-8 强制) → error_alert → health_check
     → 路由处理
```

### 前端架构

```
ErrorBoundary
  └── ThemeProvider          (Design Token + 主题令牌双源收敛, ADR-036/037)
      └── QueryClientProvider (TanStack Query)
          └── ToastProvider
              └── ShortcutHelpProvider
                  └── RouterProvider  (React Router v7 Data Router)
                      └── ToastContainer
```

**三层路由守卫**

| 守卫 | 范围 | 逻辑 |
|:-----|:-----|:-----|
| `AuthGuard` | 受保护子路由 | 未认证 → `/login`；persist 恢复中 → Loading |
| `GuestGuard` | `/login`、`/forgot-password` | 已登录 → `/dashboard` |
| `AdminGuard` | `/users`、`/audit-logs` | 非 ADMIN → `/dashboard` |

**关键 npm 脚本**（`frontend/package.json`）

| 命令 | 用途 |
|:-----|:-----|
| `dev` / `build` / `preview` | 开发 / 生产构建（`tsc -b && vite build`）/ 预览 |
| `lint` | ESLint 9 flat config |
| `test` / `test:watch` / `test:coverage` / `test:ci` / `test:ui` | Vitest 系列 |
| `test:e2e` / `test:e2e:ui` | Playwright |
| `tokens:generate` / `tokens:watch` | **Design Token 生成器**（`scripts/generate-css-variables.ts`） |
| `theme:gate` / `theme:gate:m1` / `theme:gate:ci` | **主题门禁**（含 `--require-render` 渲染强制校验） |
| `theme:audit:css` / `theme:validate` | 主题隔离审计 / 令牌校验 |
| `ui:guard` / `ui:guard:baseline` | **UI 一致性守卫**（基线对比） |
| `audit:lighthouse` | Lighthouse 性能审计 |
| `build:optimized` | Terser 优化构建 |
| `postinstall` | 安装后钩子 |

### 前端技术栈

| 层级 | 技术 | 版本 |
|:-----|:-----|:----:|
| 框架 | React / React DOM | ^19.2.4 |
| 路由 | React Router DOM | ^7.6.1 |
| 语言 | TypeScript | ^5.7.3 |
| 构建 | Vite / @vitejs/plugin-react | ^8.0.10 / ^6.0.1 |
| 样式 | TailwindCSS + @tailwindcss/vite + @tailwindcss/postcss | ^4.1.8 / ^4.2.2 / ^4.3.3 |
| 状态管理 | Zustand | ^5.0.5 |
| 服务端状态 | @tanstack/react-query | ^5.101.0 |
| 表格 / 虚拟滚动 | @tanstack/react-table / @tanstack/react-virtual | ^8.21.3 / ^3.13.24 |
| 设计系统 | Radix UI（16 个原语包）+ class-variance-authority + clsx + tailwind-merge | — |
| 图标 | lucide-react / @ant-design/icons | ^0.525.0 / ^6.3.2 |
| 3D | three + @react-three/fiber + @react-three/drei + @use-gesture/react | ^0.160.0 / 9.7.0 / 10.7.8 / ^10.3.1 |
| 图表 | Recharts / d3 | ^2.15.3 / ^7.9.0 |
| 动效 | framer-motion | ^12.40.0 |
| 拖拽 | @dnd-kit/core + sortable + utilities | ^6.3.1 / ^10.0.0 / ^3.2.2 |
| 国际化 | i18next + react-i18next | ^26.2.0 / ^17.0.8 |
| HTTP / 安全 | axios / dompurify | ^1.10.0 / ^3.4.2 |
| 导出 | jspdf + jspdf-autotable / exceljs / docx / html2canvas / qrcode | ^4.2.1 / ^5.0.7 / ^4.4.0 / ^9.6.1 / ^1.4.1 / ^1.5.4 |
| 搜索 / 工具 | fuse.js / date-fns / lodash-es | ^7.3.0 / ^4.1.0 / ^4.18.1 |
| 监控 | @sentry/react + @sentry/tracing / web-vitals | ^10.66.0 / ^7.120.4 / ^5.2.0 |
| 无障碍 | @axe-core/react + axe-core | ^4.11.3 / ^4.11.4 |
| 测试 | Vitest + @vitest/coverage-v8 / @testing-library/react / @playwright/test | ^3.2.4 / ^16.3.2 / ^1.59.1 |
| 代码质量 | ESLint + typescript-eslint / husky + lint-staged / tsx / terser / rollup-plugin-visualizer | ^9.39.4 / ^8.58.0 / ^9.1.7 / ^17.3.0 / ^4.23.15 / ^5.46.1 / ^7.0.1 |

### 后端技术栈

| 层级 | 技术 | 版本 |
|:-----|:-----|:----:|
| 框架 | FastAPI | ==0.115.0 |
| ASGI | uvicorn[standard] | ==0.30.0 |
| ORM | SQLAlchemy[asyncio] + asyncpg | ==2.0.35 / ==0.29.0 |
| 验证 | Pydantic + pydantic-settings + jsonschema | ==2.9.0 / ==2.5.0 / ==4.23.0 |
| 迁移 | Alembic | ==1.13.2 |
| 认证 | python-jose[cryptography] + bcrypt + email-validator | ==3.3.0 / ==4.2.0 / >=2.0.0 |
| HTTP | httpx / aiohttp | ==0.27.2 / ==3.14.5 |
| 数值 | numpy / scipy / pandas | ==1.26.4 / ==1.14.0 / >=2.0.0 |
| 向量检索 | ChromaDB + fastembed | ==0.5.0 / ==0.8.0 |
| 中文 NLP | jieba | ==0.42.1 |
| 化学信息学 | RDKit + SELFIES + Peplink | >=2023.9.0 / >=2.1.1 / >=0.1.2 |
| 可观测 | OpenTelemetry API/SDK + Sentry | ==1.28.0 / >=1.44.0 |
| 任务/缓存 | Celery + Redis + APScheduler + cachetools | >=5.3.0 / >=4.6.0 / ==3.10.4 / >=5.3.0 |
| 文档导出 | python-docx + reportlab + openpyxl + pdfminer.six | ==1.1.2 / ==4.2.5 / ==3.1.5 / ==20240706 |
| 安全扫描 | pip-audit + bandit + psutil | >=2.7.0 / >=1.7.0 / >=5.9.0 |
| 测试 | pytest + pytest-asyncio + pytest-cov + pytest-mock + factory-boy + freezegun + testcontainers | ==8.3.3 / ==0.24.0 / ==6.0.0 / ==3.14.0 / ==3.3.1 / ==1.5.1 / ==4.8.1 |

依赖声明分片：`requirements.txt`（42 项主依赖）+ `requirements-clean.txt` + `requirements-dev.txt` + `requirements/{base,api,db,ml,dev,prod}.txt`

> ⚠️ **依赖声明缺口**：`torch` 在源码中被 9 个文件 `import`（含 `services/ai/models/pytorch_generator.py`），
> 但 `requirements*.txt` **未声明 torch**；`transformers` 在源码中 0 引用但旧 README 曾列为依赖。
> 需核实 torch 的实际安装来源并补入依赖声明。详见 [已知技术债务](#已知技术债务)。

---

## 迭代里程碑时间线

> 数据来源：`git log`（564 次提交，2026-06-10 → 2026-10-25）+ [docs/adr/index.md](docs/adr/index.md)

### 提交分布

| 月份 | 提交数 | 占比 |
|:-----|:------:|:----:|
| 2026-06 | 25 | 4.4% |
| 2026-07 | 48 | 8.5% |
| 2026-08 | 150 | 26.6% |
| 2026-09 | 136 | 24.1% |
| 2026-10 | 204 | 36.2% |

| 提交类型 | 数量 | 类型 | 数量 |
|:---------|:----:|:-----|:----:|
| `fix` | 272 | `chore` | 42 |
| `feat` | 80 | `refactor` | 36 |
| `docs` | 73 | 其他 | 32 |
| | | `test` | 14 |
| | | `style` / `ci` | 7 / 2 |

> `fix` 占 48% 说明项目处于**高强度打磨与整改期**，而非纯功能扩张期。

### 关键里程碑

| 日期 | 事件 | 依据 |
|:-----|:-----|:-----|
| **2026-06-10** | 项目初始化 `71ddbb4` | `git log --max-parents=0` |
| **2026-06-05** | 架构奠基：ADR-001~005（六边形架构 / 事件驱动 / 数据分类分级 / DDD 有界上下文 / 可观测性） | ADR 001–005 |
| **2026-06-15** | 基础设施：ADR-006~010（认证授权 / 数据库迁移 / CI-CD / 前端架构 / AI-ML 集成） | ADR 006–010 |
| **2026-06-30** | 架构收敛决策 | ADR-011 |
| **2026-05-11 / 05-12** | AI 助手中心 v7.0.0 → v8.0.0（插件架构、流式引擎、多会话、报告引擎、i18n、a11y） | AI CHANGELOG |
| **2026-07-25** | 微信小程序开发方案立项（状态：提案中） | ADR-028 |
| **2026-08-15** | 主题系统统一专项：ADR-012~016（精简统一 / 完整性补齐 / 组件级迁移 / 完整性审计 / 深度审计） | ADR 012–016 |
| **2026-08-16** | Dashboard + 配方详情页深度开发：ADR-017~026（含 TS 错误修复、Hooks 顺序修复、配方详情页 Phase 3） | ADR 017–026 |
| **2026-08-23** | Radix UI / shadcn-ui 设计系统迁移 | ADR-027 |
| **2026-08-28** | 配方详情页成分列表 Tab UI 修复（034 + 034b 双层修复） | ADR 034 / 034b |
| **2026-09-05** | AI 对话架构融合（ADR-012b）+ 微信小程序方案（ADR-028b） | ADR 012b / 028b |
| **2026-09-21** | AI 对话框架重构（ADR-029 实现篇 + 029b 方案篇） | ADR 029 / 029b |
| **2026-09-22** | 配方在线验证工作流架构设计 | ADR-030b |
| **2026-09-23 ~ 09-30** | 配方详情页 UI-UX 三轮重构：ADR-031（重构）→ 032（全面优化）→ 033（深度审查与修复）→ 035（CSS 布局深度优化） | ADR 031–035 |
| **2026-09-17** | 食源性多肽肽链结构分析模块立项（独立开发后合并模式） | 项目记忆 |
| **2026-10-02** | 主题令牌治理收官：ADR-036（双源收敛 + 生成器 L0 名映射）→ ADR-037（页头表面令牌） | ADR 036 / 037 |
| **2026-10-24** | AI 阈值集中化重构启动（`deepThinkingService` 深度思考置信度） | commit `f7e1b18` |
| **2026-10-25** | AI 阈值集中化重构完成（14 个引擎）+ 已知成分接入后端稳定性数据库 | commits `f7e1b18` → `05a7759` |
| **2026-10-25** | 🏷️ **首个正式发布 `v2.0.0`**：建立语义化版本体系（8 承载点 + 3 脚本 + CI 门禁）、补 LICENSE、建 CHANGELOG | ADR-038 / CHANGELOG.md |

### 2026-10-25 提交批次（当前最新）

```
05a7759  feat(stability): 已知成分接入后端稳定性数据库并新增专项测试
8c64305  refactor(ai): 集中 formulaExtractorService 提取阈值
319b9ec  refactor(ai): 集中 nlpProcessor 规则评分阈值
faa0d15  refactor(ai): 集中 FormulaGeneticOptimizer 评分阈值并修复 structured 日志
1b878d4  refactor(ai): 集中 FormulaKnowledgeGraph 兼容性阈值
45283cd  refactor(ai): 集中 FormulaInferenceEngine 推断阈值
6514ac9  refactor(ai): 集中 professionalIntelligenceEngineV4 专家级别阈值
44f27b2  refactor(ai): 集中 promptEngineeringFramework 评分与等级阈值
0707229  refactor(ai): 集中 intelligentSuggestionGenerator 建议生成阈值
69c6756  refactor(ai): 集中 knowledgeGraphUpdater 健康状态阈值
e0cc846  refactor(ai): 集中 expertIntelligenceEngine 置信度阈值
4b01f96  refactor(ai): 集中 promptOptimizer 质量分级与复杂度阈值
6c3a4db  refactor(ai): 集中 formulaDesignEngine 配伍与评分阈值
f852de8  refactor(ai): 集中 sentimentEngine 情感强度评分阈值
f7e1b18  refactor(ai): 集中 deepThinkingService 深度思考置信度评分阈值
```

> **当前工作重心**：AI 模块「魔法数字治理」——将散落在 14 个引擎中的硬编码阈值集中为可配置常量，
> 这是可维护性与可测试性的关键整改，而非新功能开发。

---

## 架构决策记录（ADR）

> 完整索引：[docs/adr/index.md](docs/adr/index.md) ｜ 48 篇文档，编号 001–039 + 7 组同号续篇

### 当前活跃 ADR

| # | 标题 | 状态 | 日期 | 领域 |
|:-:|:-----|:----:|:----:|:-----|
| 001 | [六边形架构重构](docs/adr/ADR-001-六边形架构重构.md) | ⏸️ 已暂停 | 2026-06-05 | 架构模式 |
| 002 | [事件驱动架构选型](docs/adr/ADR-002-事件驱动架构选型.md) | ✅ 已接受 | 2026-06-05 | 通信模式 |
| 003 | [数据分类分级体系](docs/adr/ADR-003-数据分类分级体系.md) | ✅ 已接受 | 2026-06-05 | 数据治理 |
| 004 | [DDD 有界上下文划分](docs/adr/ADR-004-领域驱动设计有界上下文划分.md) | ✅ 已接受 | 2026-06-05 | 领域建模 |
| 005 | [可观测性体系](docs/adr/ADR-005-可观测性体系.md) | ✅ 已接受 | 2026-06-05 | 运维 |
| 006 | [认证授权与访问控制](docs/adr/ADR-006-认证授权与访问控制策略.md) | ✅ 已接受 | 2026-06-15 | 安全 |
| 007 | [数据库迁移与版本管理](docs/adr/ADR-007-数据库迁移与版本管理策略.md) | ✅ 已接受 | 2026-06-15 | 数据 |
| 008 | [CI/CD 流水线](docs/adr/ADR-008-CI-CD流水线与持续交付策略.md) | ✅ 已接受 | 2026-06-15 | DevOps |
| 009 | [前端架构与状态管理](docs/adr/ADR-009-前端架构与状态管理策略.md) | ✅ 已接受 | 2026-06-15 | 前端 |
| 010 | [AI/ML 服务集成](docs/adr/ADR-010-AI-ML服务集成架构策略.md) | ✅ 已接受 | 2026-06-15 | AI/ML |
| 011 | [架构收敛决策](docs/adr/ADR-011-架构收敛决策.md) | ✅ 已接受 | 2026-06-30 | 架构收敛 |
| 012 | [主题系统精简与统一](docs/adr/ADR-012-主题系统精简与统一.md) | ✅ 已接受 | 2026-08-15 | 前端/UI/UX |
| 013 | [主题系统完整性补齐](docs/adr/ADR-013-主题系统完整性补齐.md) | ✅ 已接受 | 2026-08-15 | 前端/UI/UX |
| 014 | [主题系统组件级迁移](docs/adr/ADR-014-主题系统组件级迁移.md) | ✅ 已接受 | 2026-08-15 | 前端/UI/UX |
| 015 | [主题系统完整性审计与修复](docs/adr/ADR-015-主题系统完整性审计与修复.md) | ✅ 已接受 | 2026-08-15 | 前端/UI/UX |
| 016 | [主题系统深度审计与补齐](docs/adr/ADR-016-主题系统深度审计与补齐.md) | ✅ 已接受 | 2026-08-15 | 前端/UI/UX |
| 017 | [Dashboard UI/UX 深度审计与升级方案](docs/adr/ADR-017-Dashboard-UIUX深度审计与升级方案.md) | ✅ 已接受 | 2026-08-16 | 前端/UI/UX |
| 018 | [Dashboard UI/UX 深度修复与升级](docs/adr/ADR-018-Dashboard-UIUX深度修复与升级.md) | ✅ 已执行 | 2026-08-16 | 前端/UI/UX |
| 019 | [Dashboard UI/UX 深度设计审计与执行](docs/adr/ADR-019-Dashboard-UIUX深度设计审计与执行.md) | ✅ 已执行 | 2026-08-16 | 前端/UI/UX |
| 020 | [配方案例页面 TypeScript 错误修复](docs/adr/ADR-020-TypeScript错误修复-配方案例页面.md) | ✅ 已执行 | 2026-08-16 | 前端/TS |
| 021 | [配方管理页面 UI/UX 深度审计与语义化修复](docs/adr/ADR-021-配方管理页面UIUX深度审计与语义化修复.md) | ✅ 已执行 | 2026-08-16 | 前端/UI/UX |
| 022 | [Invalid time value 错误修复](docs/adr/ADR-022-InvalidTimeValue错误修复.md) | ✅ 已执行 | 2026-08-16 | 前端/TS |
| 023 | [公式详情页 React Hooks 顺序错误修复](docs/adr/ADR-023-公式详情页Hooks顺序错误修复.md) | ✅ 已执行 | 2026-08-16 | 前端/React |
| 024 | [配方详情页深度开发](docs/adr/ADR-024-配方详情页深度开发.md) | ✅ 已执行 | 2026-08-16 | 前端/产品化 |
| 025 | [配方详情页深度审查与开发方案](docs/adr/ADR-025-配方详情页深度审查与开发方案.md) | ✅ 已执行 | 2026-08-16 | 前端/审查 |
| 026 | [配方详情页 Phase 3 深度开发方案](docs/adr/ADR-026-配方详情页Phase3深度开发方案.md) | ✅ 已执行 | 2026-08-16 | 前端/产品化 |
| 027 | [Radix UI / shadcn/ui 设计系统迁移](docs/adr/ADR-027-Radix-UI-shadcn-ui迁移.md) | ✅ 已接受 | 2026-08-23 | 前端/UI/UX |
| 028 | [微信小程序开发方案](docs/adr/ADR-028-微信小程序开发方案.md) | 📋 提案 | 2026-07-25 | 前端/小程序 |
| 030 | [配方在线验证工作流架构设计](docs/adr/ADR-030-配方在线验证工作流架构设计.md) | ✅ 已接受 | 2026-09-22 | 实验管理/工作流 |
| 031 | [配方详情页 UI-UX 重构](docs/adr/ADR-031-配方详情页UI-UX重构.md) | ✅ 已执行 | 2026-09-25 | 前端/UI/UX |
| 032 | [配方详情页 UI-UX 全面优化](docs/adr/ADR-032-配方详情页UI-UX全面优化.md) | ✅ 已执行 | 2026-09-26 | 前端/UI/UX |
| 033 | [配方详情页 UI-UX 深度审查与修复](docs/adr/ADR-033-配方详情页UI-UX深度审查与修复.md) | ✅ 已执行 | 2026-09-27 | 前端/UI/UX |
| 034 | [配方详情页成分列表 Tab UI 修复](docs/adr/ADR-034-配方详情页成分列表Tab%20UI修复.md) | ✅ 已执行 | 2026-08-28 | 前端/UI/UX |
| 034b | [配方详情页成分列表 Tab UI 深度修复](docs/adr/ADR-034-配方详情页成分列表Tab%20UI深度修复.md) | ✅ 已执行 | 2026-08-28 | 前端/UI/UX |
| 035 | [CSS 布局深度优化方案](docs/adr/ADR-035-CSS布局深度优化方案.md) | ✅ 已接受 | 2026-09-30 | 前端/UI/UX |
| 036 | [主题令牌双源收敛与生成器 L0 名映射](docs/adr/ADR-036-主题令牌双源收敛与生成器L0名映射.md) | ✅ 已接受 | 2026-10-02 | 前端/UI/UX |
| 037 | [页头表面令牌（不参与反转的实底色）](docs/adr/ADR-037-页头表面令牌（不参与反转的实底色）.md) | ✅ 已接受 | 2026-10-02 | 前端/UI/UX |
| 038 | [语义化版本发布体系](docs/adr/ADR-038-语义化版本发布体系.md) | ✅ 已接受 | 2026-10-25 | 工程治理/版本管理 |
| 039 | [API 契约版本命名统一](docs/adr/ADR-039-API契约版本命名统一.md) | 📋 提案 | 2026-10-25 | 工程治理/API 契约 |

### 同号多文档登记（M4 治理裁决）

> 历史原因有 7 组编号被两个不同主题的文档共用。**M4 裁决**：不删除、不改名
> （避免破坏跨文档引用），以 `NNNb` 后缀登记续篇；**后续新 ADR 从 036 起编号**。

| 编号 | 主文档 | 续篇（NNNb） | 说明 |
|:-----|:-------|:-------------|:-----|
| 012 | 主题系统精简与统一 | 智能对话架构融合（012b） | 不同领域（前端 UI vs AI 架构），历史误编号 |
| 019 | Dashboard UI/UX 深度设计审计 | 审计与执行（019b） | 同一审计的方案篇 + 执行篇 |
| 024 | 配方详情页深度开发方案 | 深度开发（024b） | 方案篇 + 执行篇 |
| 028 | 组织管理页面深度开发与 UI/UX 统一 | 微信小程序开发方案（028b） | 不同领域，历史误编号 |
| 029 | IMPLEMENTATION（对话框架实现） | AI 对话框架重构方案（029b） | 实现篇 + 方案篇 |
| 030 | 组织管理页面功能补全 | 配方在线验证工作流架构设计（030b） | 不同领域，历史误编号 |
| 034 | 成分列表 Tab UI 修复 | 深度修复（034b） | 浅层篇 + 深度篇 |

### ADR 编写原则

- **及时**：决策做出后立即记录
- **简洁**：一个决策一个 ADR
- **上下文优先**：背景和动机比方案更持久
- **保留选项**：记录考虑过的其他方案和否决原因
- **生命周期**：`提案 → 评审 → 已接受 / 已否决 → (可选) 已废弃 / 已替换`

**需要写 ADR 的情形**：引入新架构模式或技术栈、改变现有架构的重大决策、数据模型或 API 协议重大变更、外部服务/工具选型。

---

## 工程质量与质量门禁

### TypeScript 编译质量

| 指标 | 实测值（2026-10-25） | 说明 |
|:-----|:-------------------:|:-----|
| **编译错误数** | **0** | `npx tsc --noEmit` 实测通过，见 [TypeScript_Errors-0 badge](#rmfood-智能配方设计平台) |
| 严格模式 | 全量启用 | `strict: true` |
| ESLint | Flat Config 9.x | `typescript-eslint` ^8.58.0 |
| 历史轨迹 | 1,331 → 140 → **0** | 旧 README 记录至 140，现已清零 |

### 质量门禁（自动化）

| 门禁 | 命令 | 用途 |
|:-----|:-----|:-----|
| **版本门禁** | `npm run version:check` / `version:check:ci` | 8 个版本承载点一致性校验，CI 强制（ADR-038） |
| **版本发布** | `npm run version:bump -- patch\|minor\|major\|rc\|prerelease\|final` | 原子化更新全部承载点 + CHANGELOG 骨架（`final` 用于 rc 转正，只剥离后缀不推进 M.N.P） |
| **版本一致性校验** | `npm run version:check`（含双写清单校验） | 8 承载点一致性 + `version-sources.js` ↔ `version.py` 清单同步，`--json` 供 CI |
| **版本单元测试** | `npm run version:test` | `node:test` 覆盖 bump 运算 / 解析 / 漂移检测 / 退出码（45 用例） |
| **主题门禁** | `npm run theme:gate` / `theme:gate:ci`（`--require-render`） | 设计令牌一致性，CI 强制 |
| **主题审计** | `npm run theme:audit:css` / `theme:validate` | CSS 隔离审计 + 令牌校验 |
| **UI 守卫** | `npm run ui:guard` / `ui:guard:baseline` | UI 一致性基线对比 |
| **令牌生成** | `npm run tokens:generate` | 从 TS 定义生成 CSS 变量（单一事实源） |
| **性能审计** | `npm run audit:lighthouse` | Lighthouse 评分 |
| **包体分析** | `rollup-plugin-visualizer` | 依赖体积可视化 |
| **提交钩子** | `.husky/pre-commit`（9 节：肽结构防还原 / print·console 棘轮 / as any / tsc / ruff / UI 护栏 / 未定义名称 / 版本门禁） | `npm run hooks:setup` 接线到 `.git/hooks/pre-commit` |
| **print/console 棘轮** | `npm run qc:baseline`（刷新）/ `node scripts/qc-ratchet.mjs print\|console` | 逐文件计数基线，只减不增：存量 94 处 print + 9 处 console 不阻塞，新增即阻塞 |
| **后端扫描** | pip-audit + bandit | 依赖 CVE + AST 安全扫描 |

### 代码健康度（上一轮审计记录，2026-06-10，待下次全面复评）

| 维度 | 评分 | 依据 |
|:-----|:----:|:-----|
| 架构设计 | 8.5/10 | 六边形架构渐进落地、路由注册统一、端口注入 |
| 安全性 | 9/10 | console.log=0、bare except=0、API Key 加密、7 层纵深防御 |
| 性能 | 7.5/10 | 连接池优化、O(1) 缓存、N+1 已修复 |
| 可维护性 | 8.5/10 | 路由自动发现、request_id 传播、结构化日志 |
| 测试覆盖 | 6.5/10 | 259 后端测试用例、覆盖率阈值 70% |
| DevOps | 8/10 | devcontainer、部署脚本、每日安全扫描 |
| 可观测性 | 6/10 | request_id 传播、OTel 就绪、Prometheus 就绪 |

---

## 测试策略

### 测试分布（实测）

| 层 | 文件数 | 说明 |
|:---|:------:|:-----|
| 前端测试 | **142** | Vitest + @testing-library/react（`__tests__` + `*.test.*` + `*.spec.*`） |
| 后端测试（`backend/tests/`） | **189** | pytest，分层 unit / integration / e2e |
| 应用内测试（`backend/app/tests/`） | 13 | api / integration / e2e / unit |
| 根目录测试（`tests/`） | 27 | 跨模块 |

### 后端测试分层

```
backend/tests/                       (189 文件)
├── unit/            单元测试
├── integration/     集成测试（含 testcontainers[postgres]）
├── e2e/             端到端
└── 其余             功能/专项测试
```

### AI 模块测试（`frontend/src/components/ai/features/`，共 79 个测试相关文件）

- `features/__tests__/`（48 个）：`unit/`（ChatTab 结构修复反馈与校验、FormulaValidationModal、FormulaVisualization、agent-workflow、useChatMessages、useChatSessions、useExportManager、useFormulaManager、useStreamingText、reportPlumbing、useReportGeneratorExport）、`components/`（AdvancedFilter、BatchOperationBar、DialogInput、FormulaCard、MessageList、ThinkingWithInput）、`integration/`（chatFlow、smartChatIntegration）、`safety`、`helpers/testRenderer`
- 各子域内嵌 `__tests__/`（31 个）：`utils/` 13、`components/` 7、`hooks/` 4、`services/` 3、`GenerateTab/` 2、`state/` 1

### 运行命令速查

```bash
# ═══════════ 后端 ═══════════
cd backend
pytest tests/ -v --cov=app --cov-report=html --cov-fail-under=60
pytest tests/ -m unit            # 快速单元
pytest tests/ -m integration     # 集成
black --check --diff app/ && ruff check app/

# ═══════════ 前端 ═══════════
cd frontend
npx tsc --noEmit                 # 类型检查（当前 0 错误）
npm run lint
npm run test                     # Vitest
npm run test:coverage            # 覆盖率
npm run test:e2e                 # Playwright
npm run theme:gate:ci            # 主题门禁（CI 模式）
npm run ui:guard                 # UI 一致性守卫
npm run build                    # 生产构建
```

### 覆盖率配置

| 配置项 | 值 |
|:-------|:---:|
| 后端阈值 | **60%**（`--cov-fail-under`） |
| 排除目录 | `ai_models/*`、`data_sources/*`、`peptide_analysis_v2/*` |

---

## 安全体系

本项目实施 **7 层纵深防御**，遵循 OWASP Top 10。

| 层级 | 领域 | 关键措施 | 代码位置 |
|:----:|:-----|:---------|:---------|
| L7 | 应用层 | Pydantic v2 输入验证 / DOMPurify XSS 防护 / CSRF（JWT Bearer）/ SQLAlchemy 参数化查询 / 全局异常处理 | `core/middleware/`、`utils/encryption.py` |
| L6 | 认证授权 | JWT 双 Token（Access + Refresh）/ OAuth2 / RBAC 5 级 / 账户锁定（5 次/15 分钟）/ 设备限制（5 台/用户）/ TOTP | `core/rbac/`、`core/security/account_lockout.py`、`core/security/totp.py` |
| L5 | 速率限制 | 滑动窗口 / 多维度（全局/IP/用户/端点）/ AI 独立限流 | `core/middleware/rate_limiter.py`、`core/ai_infra/ai_rate_limiter.py` |
| L4 | 数据保护 | bcrypt（cost=12）/ 数据脱敏 / 审计日志 / UTF-8 强制编码 / AES-256-GCM API Key 加密 | `core/database/data_masking.py`、`core/middleware/audit_middleware.py`、`utils/key_manager.py` |
| L3 | 网络传输 | 安全响应头（HSTS）/ CORS 精确配置 / TLS 配置 | `core/security/security_middleware.py`、`core/security/tls_config.py` |
| L2 | 容器安全 | 非 root 用户 / 多阶段构建 | `Dockerfile` |
| L1 | 供应链安全 | pip-audit + bandit + safety / npm audit | CI/CD |

### AI 安全专项（`backend/app/services/ai/safety/`）

| 模块 | 用途 |
|:-----|:-----|
| `prompt_guard.py` | Prompt 注入防护 |
| `output_filter.py` | 输出过滤 |
| `instruction_hierarchy.py` | 指令层级隔离 |
| `batch_safety_check.py` | 批量安全检查 |
| `safety_report_generator.py` | 安全报告生成 |

### 安全工具链

| 工具 | 扫描类型 | 集成 |
|:-----|:---------|:-----|
| pip-audit（>=2.7.0） | Python 依赖 CVE | CI/CD |
| bandit（>=1.7.0） | Python 代码安全（AST） | CI/CD |
| npm audit | Node.js 依赖 | CI/CD |

### 生产环境安全检查清单

- [ ] `SECRET_KEY` >= 32 位随机字符串
- [ ] `ADMIN_PASSWORD` >= 12 位（大小写 + 数字 + 特殊字符）
- [ ] `DEBUG=false`
- [ ] `DATABASE_URL` 使用 PostgreSQL
- [ ] `CORS_ORIGINS` 明确指定生产域名
- [ ] 生产启用 HTTPS + HSTS
- [ ] 定期执行安全扫描

---

## 快速开始

### 一键启动（推荐，非 Docker）

Windows 环境下两条命令完成，脚本会自动清理旧进程、检查依赖、启动服务并验证就绪状态。

```powershell
# 启动（自动等待前后端就绪）
.\start.ps1

# 停止
.\stop.ps1
```

启动成功后访问：

| 服务 | 地址 |
|:-----|:-----|
| 应用 | http://localhost:3000 |
| API | http://localhost:8000/api/v1 |
| Swagger UI | http://localhost:8000/docs |
| ReDoc | http://localhost:8000/redoc |
| OpenAPI JSON | http://localhost:8000/openapi.json |
| 健康检查 | http://localhost:8000/health |

### 环境要求

| 工具 | 版本 | 用途 |
|:-----|:----:|:-----|
| Python | 3.12+ | 后端运行 |
| Node.js | 20.x | 前端构建 |
| PostgreSQL | 16+（生产）/ SQLite（开发） | 数据库 |
| Redis | 7.x（可选） | 缓存 / 队列 |
| Docker + Compose | 2.0+（可选） | 容器化部署 |

### 方式一：本地开发（不使用 Docker）

<details>
<summary><b>克隆与后端启动</b></summary>

```bash
git clone https://github.com/your-org/rmfood-platform.git
cd rmfood-platform

cd backend
python -m venv venv
# Windows:
venv\Scripts\activate
# Linux/Mac:
source venv/bin/activate

pip install -r requirements.txt
cp ../.env.example .env
# 编辑 .env：SECRET_KEY 和 ADMIN_PASSWORD 为必填项

alembic upgrade head            # 75 个迁移版本
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

</details>

<details>
<summary><b>前端启动</b></summary>

```bash
cd frontend
npm install
cp .env.example .env.local
npm run dev                     # http://localhost:3000
```

</details>

### 方式二：Docker 部署

```bash
cp .env.example .env            # 必填: SECRET_KEY, ADMIN_PASSWORD, POSTGRES_PASSWORD
docker compose up -d
```

| 服务 | 基础镜像 | 端口 | 资源限制 |
|:-----|:---------|:----:|:---------|
| backend | python:3.12-slim | 8000 | 2 CPU / 2 GB RAM |
| postgres | postgres:16-alpine | 5432 | 1 CPU / 1 GB RAM |
| redis | redis:7-alpine | 6379 | 0.5 CPU / 512 MB |
| frontend | node:20-alpine → nginx:alpine | 3000→80 | 1 CPU / 512 MB |
| nginx | nginx:alpine | 80/443 | 0.5 CPU / 128 MB |

Dockerfile 变体：`Dockerfile`（全量）/ `Dockerfile.backend-only` / `Dockerfile.frontend-only` / `Dockerfile.optimized`

数据卷：`backend-data` / `uploads-data` / `postgres-data` / `redis-data`

### 默认账号

| 项目 | 值 |
|:-----|:---|
| 用户名 | `admin` |
| 密码 | `.env` 中的 `ADMIN_PASSWORD`（开发见控制台掩码输出） |

> 生产环境必须设置强密码：`ADMIN_PASSWORD=YourStrongP@ssw0rd2024!`

---

## 项目结构

<details>
<summary><b>点击展开完整目录树</b></summary>

```
rmfood-platform/
│
├── backend/                                  # 后端 (FastAPI / Python 3.12)
│   ├── app/                                  # 应用代码 (783 文件)
│   │   ├── api/                              # 路由 (132 文件 / 1,011 端点)
│   │   │   ├── (顶层 61) auth users formulas experiments ai chat ...
│   │   │   │              肽模块 7 个 peptides*/peptide_*_routes/pepinvent
│   │   │   ├── v1/  (44)    企业级路由 ai_task agent batch doe report ...
│   │   │   ├── db_modules/ (14) 数据检索中心 herbs compounds peptides off ...
│   │   │   └── ai_modules/(13)  generation optimization genetic ...
│   │   ├── core/                (99)  配置/数据库/安全/RBAC/可观测/性能/实时/合规
│   │   ├── services/            (402) ai formula data_sources ai_models ...
│   │   ├── models/              (55)  SQLAlchemy ORM
│   │   ├── schemas/             (22)  Pydantic
│   │   ├── domain/              (17)  领域端口（六边形架构）
│   │   ├── infrastructure/      (16)  适配器实现
│   │   ├── cqrs/                (7)   事件处理器 + 查询
│   │   ├── application/         (3)   门面
│   │   ├── utils/ middleware/ websockets/ data/ factories/
│   │   ├── tests/               (13)
│   │   ├── version.py           # 版本单一事实源（ADR-038）
│   │   └── main.py              # 工厂模式 + lifespan + 36 处路由注册
│   ├── alembic/versions/         (75 迁移版本)
│   ├── tests/                    (189)
│   ├── scripts/                  (372)
│   └── requirements*.txt         # 主 + clean + dev + requirements/{base,api,db,ml,dev,prod}
│
├── frontend/                               # 前端 (React 19 / Vite 8 / TS 5.7)
│   ├── src/                              (1,485 文件)
│   │   ├── pages/              (189)  33 个一级页面域
│   │   ├── components/         (781)  ai(515) ui(63) database(57) dashboard(23) ...
│   │   │   └── ai/features/    (405)  12 Tab + components(101) services(57)
│   │   │                          hooks(44) __tests__(48) GenerateTab(36)
│   │   │   └── ai/features/components/pro/   专业版对话组件 (22)
│   │   │   └── ai/features/components/structured/blocks/  结构化消息块 (10)
│   │   ├── i18n/               (105)  中英双语，AI 模块独立命名空间
│   │   ├── utils/ hooks/ services/ api/ types/ config/ stores/
│   │   ├── theme/ theme-pro/ styles/ design-system/
│   │   ├── __tests__/ + tests/    (全 src 测试文件 142)
│   │   ├── App.tsx             # 3 守卫 + RouterProvider + 6 Provider
│   │   └── main.tsx
│   ├── scripts/                  # tokens/theme-gate/ui-guard/postinstall
│   ├── public/
│   ├── vite.config.ts / tsconfig*.json / eslint.config.js
│   └── package.json
│
├── miniprogram/                            # 微信小程序
│   ├── pages/   (14 主包页面域, 73 文件)
│   ├── packages/(3 分包: chat formulas ingredient, 16 文件)
│   ├── components/ (31 组件, 128 文件)
│   ├── utils/ (49) assets/ (34) docs/ (17)
│   └── miniprogram_npm/ (634, 第三方依赖, 不计入源码)
│
├── docs/                                    # 文档资产 (586)
│   ├── adr/          (48)   架构决策记录 ← 权威索引
│   ├── release/      (3)    发布流程（总览 / CHECKLIST / ROLLBACK）
│   ├── reports/      (49)   审计报告
│   ├── assets/       (28)   设计资产
│   ├── plans/        (38)   实施计划
│   ├── reviews/      (27)   代码审查
│   ├── ai/ (14) design/ (13) deployment/ (8) integrations/ (4)
│   ├── superpowers/ (8) deepseek-harness-analysis/ (8)
│   └── 中国普通配方设计思路/ 营养成分表公式算法/ 食源性多肽原材料COA/
│
├── tests/                 # 根级测试 (7)
├── scripts/               # 项目级脚本
│   └── version/         # 版本治理（version-sources / check-version / bump-version + 2 测试）
├── backend/archive/       # 卫生治理归档区（已 gitignore，仅本地留存，不入库）
├── models/ data/ tcmsp_data/ openfoodfacts/   # 数据与模型资产
├── deploy/ certs/ conf/ logs/                 # 部署与运行
│
├── .github/workflows/     # ci-cd.yml (11 Job) + security-scan.yml
├── .devcontainer/         # 开发容器
├── docker-compose.yml     # 5 服务编排
├── Dockerfile*            # 4 个变体
├── start.ps1 stop.ps1     # 一键启停（非 Docker 推荐）
├── STARTUP.md             # 启动说明
├── .env.example           # 环境变量模板
├── package.json           # 版本权威源（version:check / version:bump）
├── CHANGELOG.md           # 变更历史（Keep a Changelog）
├── LICENSE                # MIT License
├── pytest.ini
├── CLAUDE.md              # AI 协作规范
└── README.md              # 本文件
```

</details>

---

## CI/CD 流水线

GitHub Actions（[.github/workflows/](.github/workflows/)），Node 20 + Python 3.12。

### `ci-cd.yml`（11 个 Job）

| # | Job | 说明 |
|:-:|:-----|:-----|
| 1 | `version-gate` | **版本一致性门禁**：校验 8 个版本承载点指向同一版本号（ADR-038）。零第三方依赖、不设 `needs`，与 `lint` 并行秒级返回 |
| 2 | `lint` | 后端 Black/isort/Bandit + 前端 ESLint |
| 3 | `security-scan` | pip-audit + npm audit |
| 4 | `test-backend` | pytest + 覆盖率 |
| 5 | `test-frontend` | Vitest + 生产构建 |
| 6 | `theme-gate` | **主题令牌门禁**（`theme:gate:ci --require-render`） |
| 7 | `build` | 多阶段镜像构建 → `ghcr.io` |
| 8 | `deploy-staging` | 预发布环境 |
| 9 | `deploy-production` | 生产环境 |
| 10 | `smoke-test` | 部署后冒烟测试 |
| 11 | `rollback` | 回滚（**仅回滚镜像**，不执行数据库迁移回滚） |

> ⚠️ **`rollback` job 不覆盖数据库**：该 job 流程为取旧镜像 tag → `docker compose down` → `docker pull` → `up -d` → 健康检查，全程无任何 `alembic` 调用。已部署带数据库迁移的版本被回滚后，数据库仍停留在新 schema。数据库回滚须人工按 [docs/release/ROLLBACK.md](docs/release/ROLLBACK.md) 场景 D 执行（迁移前必备份）。

### `security-scan.yml`

定时（schedule）+ 手动（workflow_dispatch）触发的独立安全扫描。

---

## Docker 部署

### 镜像构建阶段

| 阶段 | 后端 | 前端 |
|:-----|:-----|:-----|
| Builder | python:3.12-slim（gcc + libffi） | node:20-alpine |
| Production | python:3.12-slim（appuser，gunicorn 4 workers） | nginx:alpine |

### 数据库迁移

```bash
alembic upgrade head          # 75 个迁移版本
alembic revision --autogenerate -m "描述"
alembic downgrade -1          # 回滚一个版本
```

---

## 已知技术债务

> 依据：本次 README 更新过程中实测发现的问题 + 上一轮审计记录（2026-06-10）

### 本次实测发现（2026-10-25）

| 优先级 | 项 | 说明 |
|:-------|:---|:-----|
| 🔴 P0 | **`torch` 依赖未声明** | 源码 9 个文件 `import torch`（含 `pytorch_generator.py`），但 `requirements*.txt` 均未声明；旧 README 曾声明 PyTorch ≥2.0.0。需核实安装来源并补入 |
| 🟠 P1 | **ADR-001 六边形架构处于「已暂停」状态** | 领域层/适配器层已存在（17 + 16 文件）但未完成收敛，存在 `app/core` 与 `app/infrastructure` 职责重叠 |
| 🟠 P1 | **ADR 编号历史误编号 7 组** | 已通过 `NNNb` 后缀治理，但旧编号仍在文件系统中并存，易误读 |
| 🟠 P1 | **REST API 契约版本内部不一致** | `CURRENT_API_VERSION = "1.0.0"` 与 `API_MATRIX` 的 `v1`/`v2` 键名不对齐；实测另有三处 `X-API-Version` 注入点三种取值、`api_root` 硬编码脱钩、`deprecates: "2026-01-01"` 已过期 10 个月仍标 `current`、`api_versioning.py`（795 行）从未注册。**方案已成型**：见 [ADR-039](docs/adr/ADR-039-API契约版本命名统一.md)（📋 提案，推荐双轨制），待评审接受后实施 |
| 🟡 P2 | **`transformers` 曾列为依赖但源码 0 引用** | 旧 README 声明 Transformers ≥4.35.0，实测无引用，需从文档中移除 |
| 🟡 P2 | **后端 `services/` 体量过大（402 文件）** | 子域边界清晰但缺乏模块间契约约束，需考虑引入接口层 |
| 🟡 P2 | **`backend/` 根目录 40 个一次性脚本入库** | 实测 40 个 tracked 脚本 = 启动/停止 12 + 探针/排障 28（README 旧称 36，偏低）。根目录 21 个一次性临时输出已移出索引并归档；**40 个脚本本体仍待决策**（迁入 `scripts/` 或删除，其中 12 个启动脚本与根 `start.ps1` 冗余）。另有 3 个 untracked 脚本，含 `test_chat_user_key.py` 硬编码 `password = "admin123"`（已被 `backend/test_*.py` 忽略，不会入库） |
| 🟡 P2 | **测试覆盖率偏低** | 上一轮审计 6.5/10，阈值 60%，目标 80%；当前 142 前端 + 229 后端测试文件 |
| 🟡 P2 | **AI 阈值集中化仅完成前端 14 个引擎** | 后端对应引擎（`services/ai/`）的硬编码阈值尚未同步治理 |
| 🟡 P2 | **AI 模块版本号仍与平台版本正交** | 模块 CHANGELOG = v8.0.0、源码标记 = v9.0，与平台 `v2.0.0` 互不驱动。刻意未合并（见 ADR-038），待 AI 模块下一次大版本决策 |
| 🟢 P3 | **`docs/` 根目录 310 个文件** | 文档散落，需按主题归档（`reports` / `reviews` / `plans` 已分目录） |
| 🟢 P3 | **`APP_VERSION` 环境变量覆盖未经生产验证** | 本地已验证 `APP_VERSION=9.9.9` 可覆盖成功，但 Docker / Compose 部署流水线尚未实际注入该变量，首次生产发布需观察 |
| 🟢 P3 | **CI `rollback` job 不回滚数据库** | 该 job 仅回滚镜像，全程无 `alembic` 调用。带迁移的版本被回滚后数据库仍停在新 schema，须人工按 [docs/release/ROLLBACK.md](docs/release/ROLLBACK.md) 场景 D 执行 |
| 🟢 P3 | **`v2.0.0` tag 是否已推送远端无法确认** | 本机 `git ls-remote --tags origin` 挂起超时（网络不通），本地 tag 已建且 `git describe` 可解析，但远端状态需联网环境复核 |

### 本轮已解决（v2.0.0，2026-10-25）

| 项 | 原状态 | 解决方式 |
|:-----|:-------|:---------|
| 🔴 P0 版本号口径不统一 | `package.json` ×3 = 1.0.0、`pyproject.toml` = 2.0.0、`config.py` = "1.0.0"、README = v2.0 / v10.0、0 tag | 以 `pyproject.toml` 的 `2.0.0` 为锚点，8 个承载点统一，CI `version-gate` 强制，打 `v2.0.0` tag。见 [ADR-038](docs/adr/ADR-038-语义化版本发布体系.md) |
| 🔴 P0 运行时版本不可信 | `settings.app_version` 永远返回 `"1.0.0"` | 改为读取 `backend/app/version.py`，实测返回 `2.0.0` |
| 🟠 P1 `APP_VERSION` 死配置 | `.env.example` 声明但运行时从不读取 | `Settings` 新增 `app_version_override` 字段，环境变量已生效 |
| 🟠 P1 版本端点从未注册 | `register_version_routes` 因 `'_IncludedRouter' object has no attribute 'path'` 抛异常，被 try/except 静默降级 | 改用 `getattr(route, "path", None)` 防御，`/api` 与 `/api/v1/info` 首次成功注册 |
| 🟡 P2 `LICENSE` 文件缺失 | README 与徽章声明 MIT 但无实体文件 | 补入根目录 [`LICENSE`](LICENSE) |
| 🟠 P1 旧 README 数字严重过时 | 迁移 16 / TS 错误 140 / 后端 247 / 前端 839 / 端点 52 | 本文件已按实测全部更正（75 / 0 / 1,430 / 1,485 / 1,011） |
| 🟢 无版本治理工具 | 手工维护 6 处版本号 | 新增 `scripts/version/` 五个脚本 + 5 个 npm scripts |
| 🟡 P2 运行期产物被提交入库 | `pg_data_new/` 971 + `coverage_measurements/` 95 + `pytest-of-Administrator/` 73 = **1,139 文件**被跟踪，占 `backend/` 的 39.4% | 三者全部 `git rm --cached`（磁盘保留，不物理删除）+ `.gitignore` 卫生分区 15 条规则防回归；`backend/` 跟踪文件 **2,891 → 1,731** |
| 🟡 P2 运行期 OpenAPI 导出物入库 | `openapi_clean.json` / `openapi_cleaned.json` / `openapi_fixed.json` 合计 4.27 MB，前两者 md5 相同（重复副本），三者均 mojibake；全仓**零代码引用**（`main.py:952 get_openapi_fixed()` 是函数名巧合，动态调用 `get_openapi()` 不读文件） | 移出索引并归档 + `backend/openapi_*.json` 规则 |
| 🟡 P2 误命名的运行日志入库 | `herb_mechanisms_patch.txt` 名为"数据补丁"，实为 UTF-16 LE PowerShell 控制台日志（38,966 字节 / 19,483 字符，含 SciPy 版本告警） | 移出索引并归档 + 精确文件名规则 |
| 🟢 P3 版本承载点清单双写 | `version-sources.js` 与 `version.py` 的 `VERSION_SOURCE_FILES` 需人工同步，无自动化校验 | `check-version.js` 新增 `--verify-source-list`（默认开启），从 Python 侧正则解析并与 JS 侧双向对比（缺失/多余/顺序差异均非 0），`version:check` 与 `version:check:ci` 强制；实测双写一致 |
| 🟠 P1 rc 无法转正为正式版 | `version:bump -- rc` 后**无任何路径**产出正式版（patch/minor/major 保留 `-rc.N`，`prerelease` 反而推进 minor），脚本注释与实现不符 | 新增 `final` kind：只剥离 prerelease 后缀，M.N.P 与 build metadata 不变，已是正式版则报错；同时修正 `prerelease` 语义（正式版→bump patch 加标识符，预发布→递增标识符） |
| 🟢 版本工具链零测试 | `scripts/version/` 无任何单元测试 | 新增 `version:test`（`node:test`），**45 用例**覆盖 bump 运算 / 各 kind 解析 / 双写漂移检测 / build metadata 落盘 / 退出码，全绿 |
| 🟢 无发布流程文档 | 版本治理仅靠脚本注释与个人记忆 | 新增 [docs/release/](docs/release/) 三份文档（总览 / CHECKLIST / ROLLBACK），含两轴判定表、完整 checklist 与四类回滚场景 SOP |
| 🟠 P1 ADR-007 迁移路径陈旧 | 文中 `backend/app/migrations/versions/` 与 `backend/app/core/migration.py` 两条路径均不存在 | 已按实际结构更正为 `backend/alembic/versions/`（75 个版本文件）与 `backend/app/core/compliance/migration.py`，并补充 `backend/migrations/` 遗留目录说明与修订记录 |

### 上一轮已完成项（2026-06-10 审计，历史记录）

| 项 | 状态 |
|:-----|:----:|
| `xlsx` 替换为 ExcelJS | ✅ |
| TypeScript 5.7.3 稳定 | ✅ |
| 生产构建 minify | ✅ |
| Mock 数据分离（独立 `mockData.ts`） | ✅ |
| `console.log` 清理（413→0） | ✅ |
| bare except 修复（136→0） | ✅ |
| API Key 加密存储（AES-256-GCM + HKDF + 密钥轮换） | ✅ |
| 路由注册统一（自动发现注册中心） | ✅ |
| 六边形架构违规修复（`mobile_facade` 端口注入） | ✅ |
| request_id 传播（contextvars） | ✅ |
| 测试覆盖提升（+259 用例，阈值 70%） | ✅ |
| devcontainer（Python 3.12 + Node 20） | ✅ |
| 部署脚本（一键部署 + 数据库备份） | ✅ |
| 每日安全扫描（GitHub Actions 定时） | ✅ |
| 后端 `print()` 棘轮治理（存量 94 处 → 只减不增） | ✅（基线 `scripts/qc-baseline.json`） |
| OpenTelemetry 分布式追踪 | ✅ |
| API 版本协商机制（`X-API-Version` 响应头） | ✅ |
| 邮件服务（`forgot_password`） | ✅ |
| husky / lint-staged 提交钩子 | ❌ 从未生效：husky 未安装在根目录、frontend 无 `prepare` 脚本，`.husky/` 钩子长期空转（2026-10-25 实测确认） |
| 移除未使用依赖（`passlib`） | ✅ |
| **TypeScript 编译错误清零（1,331 → 0）** | ✅（2026-10-25 实测） |

---

## 贡献指南

### 提交流程

```
Fork → Clone → 分支 (feature/fix/docs/refactor)
     → 编写 → 本地测试 → Conventional Commits → Push → PR
```

### 分支与提交规范

| 语言 | 工具链 | 规范 |
|:-----|:-------|:-----|
| Python | Ruff + Black + isort | target py312，禁 bare except |
| TypeScript | ESLint 9 + Prettier | strict mode，ES2023 |
| Commit | Conventional Commits | `feat:` / `fix:` / `docs:` / `refactor:` / `test:` / `chore:` |
| 测试 | pytest / Vitest / Playwright | 新功能必含测试 |

### 开发约定

1. **禁止使用假数据/模拟数据**交付生产功能；Mock 仅限开发期且须独立模块
2. **UI 图标一律使用纯 SVG**（`lucide-react` / `GlobalIcons`），禁止 emoji 充当功能图标
3. **主题样式必须走 Design Token**，禁止硬编码颜色；提交前跑 `npm run theme:gate`
4. **架构变更须先写 ADR**，参考 [docs/adr/index.md](docs/adr/index.md) 编写指南
5. **新增 AI 引擎阈值须集中配置**，禁止散落的魔法数字（参考 2026-10-25 治理批次）
6. **独立模块先行开发、全链路测试通过后再合并入主项目**
7. **发布须走文档化流程**：先按 [docs/release/](docs/release/) 判定改动属于轴 A（平台版本）还是轴 B（API 契约），再执行 CHECKLIST；回滚遵循 ROLLBACK 四类场景 SOP
8. **版本承载点禁止手工编辑**：一律用 `npm run version:bump`，否则 8 处镜像极易漂移

### 提交前自检

```bash
# 版本治理：一致性门禁 + 工具链自测
npm run version:check      # 8 个承载点 + JS/Python 双写清单
npm run version:test       # 45 个用例

# 前端
cd frontend && npx tsc --noEmit && npm run lint && npm run test && npm run theme:gate:ci

# 后端
cd backend && pytest tests/ -q && black --check app/ && ruff check app/
```

### 发布流程（简版，完整版见 [docs/release/CHECKLIST.md](docs/release/CHECKLIST.md)）

```
1. 判定轴      轴 A（平台版本）还是轴 B（API 契约）？两轴可独立演进
2. 提升版本    npm run version:bump -- patch|minor|major|rc    # rc 转正用 final
3. 手写 CHANGELOG   bump 只写骨架，条目内容必须手写
4. 门禁        npm run version:check && npm run version:test
5. 提交 + tag  git commit && git tag -a v<VERSION> -m "..."
```

> `version:bump` **绝不代提交**，只打印建议命令。tag 须为 annotated tag，推送需人工执行。

---

## 许可证与致谢

### 许可证

**[MIT License](LICENSE)**

完整条款见仓库根目录 [`LICENSE`](LICENSE)。自 `v2.0.0` 起（2026-10-25）LICENSE 实体文件已入库，
与 README 徽章、`package.json` 的 `license: MIT` 声明一致。

### 致谢

[FastAPI](https://fastapi.tiangolo.com/) · [React](https://react.dev/) · [TypeScript](https://www.typescriptlang.org/) · [Vite](https://vitejs.dev/) · [TailwindCSS v4](https://tailwindcss.com/) · [Radix UI](https://www.radix-ui.com/) · [SQLAlchemy](https://www.sqlalchemy.org/) · [Alembic](https://alembic.sqlalchemy.org/) · [Zustand](https://zustand.docs.pmnd.rs/) · [TanStack Query](https://tanstack.com/query) · [React Router](https://reactrouter.com/) · [Recharts](https://recharts.org/) · [d3](https://d3js.org/) · [three.js](https://threejs.org/) · [framer-motion](https://www.framer.com/motion/) · [i18next](https://www.i18next.com/) · [Playwright](https://playwright.dev/) · [Vitest](https://vitest.dev/)

**领域专用**：[Peplink](https://github.com/brianhbyrne/peplink) · [RDKit](https://www.rdkit.org/) · [SELFIES](https://selfies.molecular.cr/) · [PepINVENT](https://github.com/MolecularAI/PepINVENT) · [ChromaDB](https://www.trychroma.com/) · [FastEmbed](https://maartengr.github.io/FastEmbed/) · [Open Food Facts](https://world.openfoodfacts.org/) · [TCMSP](http://lcp.mbcn.net.cn/tcmsp.php) · [DFBP](https://www.dfbp.cn/)

**数据源**：TCMSP 中药系统药理学数据库 · SymMap · RMCHM · CFAM 药食同源目录 · DFBP 活性肽数据库 · UniProt / SwissProt · Open Food Facts

**标准与法规**：GB 16740-2014《食品安全国家标准 保健食品》· 中国药食同源物质目录 · 《中华本草》

---

<p align="center">

**RMFOOD 智能配方设计平台** · 药食同源 · AI 驱动 · 循证研发

Made with care by RMFOOD Team

</p>
