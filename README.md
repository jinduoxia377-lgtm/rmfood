# RMFOOD 智能配方设计平台

<p align="center">
  <strong>面向药食同源功能性食品的 AI 驱动配方研发平台</strong>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Python-3.12+-blue.svg" alt="Python" />
  <img src="https://img.shields.io/badge/FastAPI-0.115-green.svg" alt="FastAPI" />
  <img src="https://img.shields.io/badge/React-19.x-61DAFB.svg" alt="React" />
  <img src="https://img.shields.io/badge/TypeScript-5.7-3178C6.svg" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Vite-8.x-646CFF.svg" alt="Vite" />
  <img src="https://img.shields.io/badge/TailwindCSS-4.x-06B6D4.svg" alt="TailwindCSS" />
  <img src="https://img.shields.io/badge/License-MIT-yellow.svg" alt="License" />
  <img src="https://img.shields.io/badge/TypeScript_Errors-0-success.svg" alt="TypeScript Errors" />
  <img src="https://img.shields.io/badge/AI_Chat-v10.0-8A2BE2.svg" alt="AI Chat v10" />
</p>

---

## 📋 目录

- [项目概述](#项目概述)
- [当前版本亮点](#当前版本亮点)
- [AI 智能助手中心](#ai-智能助手中心)
- [技术架构](#技术架构)
- [后端架构详解](#后端架构详解)
- [前端架构详解](#前端架构详解)
- [快速开始](#快速开始)
- [项目结构](#项目结构)
- [安全体系](#安全体系)
- [代码质量](#代码质量)
- [测试策略](#测试策略)
- [API 文档](#api-文档)
- [CI/CD 流水线](#cicd-流水线)
- [Docker 部署](#docker-部署)
- [已知技术债务](#已知技术债务)
- [贡献指南](#贡献指南)

---

## 项目概述

RMFOOD (Recipe Management for Optimal Organic Design) 是一个**企业级 AI 智能配方设计平台**，专注于**药食同源功能性食品**的研发。平台集成了 AI 驱动的配方生成、多目标优化算法、实验数据管理、协同工作流、知识图谱等核心功能，为食品研发团队提供一站式解决方案。

### 核心能力矩阵

| 维度 | 能力 | 技术实现 |
|:-----|:-----|:---------|
| **AI 智能研发** | 神经网络配方生成 | Neural Formula Engine (PyTorch) |
| | 多目标优化 | MCTS / 模拟退火 / 梯度下降 (3 种求解器) |
| | 肽序列设计 | PepINVENT 引擎集成 (RDKit + PyTorch) — **含 Qwell/Peptan 临床参考** |
| | LLM 对话系统 | OpenAI / DeepSeek / 智谱 / 通义千问 / vLLM 自定义端点 |
| **数据驱动决策** | TCMSP 中药材数据库 | 16 个 Alembic 迁移版本持续增强 |
| | DFBP 活性肽数据库 | 食源性生物活性肽结构库 |
| | 知识图谱 | Neo4j 可选集成 + 本地图谱查询服务 |
| | 全文搜索 | Elasticsearch 可选集成 + PostgreSQL 内置 FTS |
| **实验管理** | 电子实验记录本 (ELN) | 标准化实验流程 + HPLC/GC/MS 数据解析 |
| | 合规性检查 | China Food Regulations 集成引擎 |
| **协作与企业功能** | 多租户隔离 | Multi-Tenant 数据隔离 + 组织级管理 |
| | 权限控制 | RBAC 5 级角色 + 细粒度权限装饰器 |
| | 团队协作 | 成员管理 / 邀请链接 / 在线状态 / @提及 |
| | 云端同步 | 冲突检测 + Diff 对比 + 变更队列 |
| | 版本控制 | Prompt 版本历史 + Diff 回滚 |
| | 实时通信 | WebSocket 连接管理器 + 分析仪表盘推送 |
| **工程质量** | 国际化 | i18next 中英双语 (含 AI 模块独立翻译) |
| | 主题系统 | Design Token 驱动 + 深色/浅色模式 + 自定义编辑器 |
| | 插件架构 | AI 助手可扩展插件框架 |
| | 容器化部署 | Docker Compose 5 服务编排 + 多阶段构建 |

### 项目规模概览

| 指标 | 数值 |
|:-----|-----:|
| 后端 Python 源文件 | **247 个** |
| 后端 API 路由模块 | **52 个** |
| 后端核心基础设施模块 | **48 个** |
| 后端 ORM 模型 | **28 个** |
| 后端 Pydantic Schema | **17 个** |
| 后端服务文件 | **90+** (13 子目录) |
| 前端 TypeScript/TSX 文件 | **839 个** |
| 前端页面组件 | **50+** (16 个一级目录) |
| 前端 UI 组件 | **200+** (20 个子目录，AI 模块 130+) |
| 前端 API 服务模块 | **24 个** |
| 前端自定义 Hooks | **42 个** |
| 前端 Zustand Store | **14 个** |
| 前端配置文件 | **21 个** |
| 数据库迁移版本 | **16 个 Alembic** |
| 项目文档资产 | **74+** |
| CI/CD Pipeline Jobs | **9 个** |

---

## 当前版本亮点

### v2.0 迭代成果

| 领域 | 成就 |
|:-----|:-----|
| **AI 模块** | 对话系统迭代至 **v10.0**，9 大功能 Tab |
| **前端架构** | 自建设计系统 (MD3 Design Token)，WCAG AA 合规 |
| **安全性** | 7 层纵深防御，OWASP Top 10 覆盖 |
| **代码质量** | **TypeScript 编译 0 错误** (从 1,331→0) |
| **肽分析** | 专业级分析管线：理化性质→二级结构→ADMET |
| **主题系统** | 亮/暗/系统模式 + 无障碍模式 + 多种预设 |

### 技术栈版本

| 层级 | 技术 | 版本 | 状态 |
|:-----|:-----|:----:|:-----|
| 前端框架 | **React** | ^19.2.4 | ✅ 最新稳定版 |
| 构建工具 | **Vite** | ^8.0.10 | ✅ 前沿版本 |
| 类型系统 | **TypeScript** | ^5.7.3 | ✅ 稳定版 (strict mode) |
| 样式方案 | **Tailwind CSS** | ^4.1.8 | ✅ 最新版 |
| 后端框架 | **FastAPI** | ==0.115.0 | ✅ 最新稳定版 |
| ORM | **SQLAlchemy** | ==2.0.35 | ✅ 异步模式 |
| 数据库 | **PostgreSQL** | 16 Alpine | ✅ 生产级 |

---

## AI 智能助手中心

AI 助手是平台的核心模块，位于 `http://localhost:3000/ai`，提供 **9 大功能 Tab**，代码量占前端的 **130+ 文件**。

### 功能模块全景

```
RMFOOD AI 智能助手中心
├── 💬 智能对话 (ChatTab v10.0)   ← 最成熟模块
│   ├── 流式响应 + 消息列表
│   ├── 提示词工程框架 V2.0 (24 模板 / 8 场景 / 12 维评估)
│   ├── Hybrid NLP 引擎 V2 (意图识别 85%+)
│   ├── 工作记忆机制 (100 条 + 实时实体追踪)
│   ├── 实时思考可视化 V3
│   └── 配方推荐 / 报告生成 / 导出
├── 🧪 配方生成 (GenerateTab)
│   ├── 功效标签选择 + 多生成模式 (规则/LLM/神经网络)
│   ├── 多候选方案批量生成 + 对比
│   ├── 版本管理 + 历史记录 + 模板系统
│   └── 进度可视化 + 多格式导出
├── 🛡️ 安全检查 (SafetyTab)
│   ├── 成分安全审查 / 禁忌检测 / 过敏原识别
│   ├── 剂量合规性 + 法规合规引用
│   └── 安全报告生成
├── 🔗 协同分析 (SynergyTab)
│   ├── 成分协同效应 + 拮抗效应检测
│   ├── 雷达图可视化 + 专利协同对比
│   └── 功效网络分析
├── 👅 口感预测 (TastePredictTab)
│   ├── 口感评分预测 + 雷达图
│   └── 配方优化建议
├── 📊 稳定性评估 (StabilityPredictTab)
│   ├── 稳定性评分 + 存储条件影响分析
│   └── 保质期预测
├── 🧬 肽序列分析 (AdvancedPeptideAnalyzer)
│   ├── 基本性质计算 (MW/pI/电荷)
│   ├── 二级结构预测 (α-螺旋/β-折叠)
│   ├── 生物活性预测 (抗氧化/ACE抑制)
│   ├── 安全性评估 (毒性/致敏性)
│   └── ADMET 预测管线
├── 💊 肽设计优化 (AdvancedPeptideDesign)
│   ├── 序列设计 / 突变分析
│   ├── 多目标优化 / 相似性搜索
│   └── Qwell/Peptan 临床参考集成
└── ⚙️ 配置管理
    ├── 模型选择 + 参数配置
    ├── API Key 管理 + 诊断工具
    └── 模型状态实时监控
```

### 模块成熟度评估

| 模块 | 完成度 | 状态 |
|:-----|:------:|:-----|
| 智能对话 (ChatTab) | **95%** | ⭐ 最成熟，v10.0 |
| 配方生成 | **90%** | ✅ 多模式+多候选 |
| 安全合规检查 | **88%** | ✅ 成分/禁忌/剂量 |
| 口感预测 | **85%** | ✅ 评分+雷达图 |
| 稳定性评估 | **85%** | ✅ 条件影响+保质期 |
| 肽序列分析 | **95%** | ⭐ 专业级深度管线 |
| 肽设计优化 | **85%** | ✅ 序列设计+突变 |
| 协同功效分析 | **90%** | ✅ 协同/拮抗/专利 |
| **整体** | **88%** | **12 大能力域** |

---

## 技术架构

### 系统架构全景

```
┌─────────────────────────────────────────────────────────────────┐
│                        前端 (Frontend)                          │
│           React 19 + TypeScript 5.7 + Vite 8 + TailwindCSS 4    │
│                                                                 │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐          │
│  │ 配方管理  │ │ AI 助手   │ │ 实验数据  │ │学术报告  │          │
│  │ 7个子页面 │ │130+文件   │ │ 4个页面   │ │ 协作编辑 │          │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘          │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐          │
│  │ 知识图谱  │ │ 数据分析  │ │ 工作流    │ │ 通知中心  │          │
│  │ 6个Tab页  │ │ 4个Tab页  │ │ 可视化    │ │ @提及    │          │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘          │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐          │
│  │ 组织管理  │ │ 团队协作  │ │ 云端同步  │ │ 集成框架  │          │
│  │ 6个Tab页  │ │ 仪表盘   │ │ 冲突解决  │ │ Webhook  │          │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘          │
└──────────────────────────────┬──────────────────────────────────┘
                               │ REST API / WebSocket
┌──────────────────────────────▼──────────────────────────────────┐
│                        后端 (Backend)                           │
│         FastAPI 0.115 + SQLAlchemy 2.0 (async) + Pydantic 2.9   │
│                                                                 │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐          │
│  │ 认证授权  │ │ 业务路由  │ │ AI 引擎   │ │ 数据层    │          │
│  │JWT+OAuth2│ │ 46个路由  │ │ LLM+神经  │ │ ORM+迁移  │          │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘          │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐          │
│  │ 多租户   │ │ 工作流引擎│ │ 通知中心  │ │WebSocket │          │
│  │ 隔离     │ │ 可视化    │ │ @提及解析 │ │ 实时推送  │          │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘          │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐          │
│  │ 安全中间件│ │ CDC 监听 │ │ 缓存系统  │ │ 搜索引擎  │          │
│  │ 7层防护  │ │ 变更捕获  │ │ Redis    │ │ ES可选   │          │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘          │
└──────────────────────────────┬──────────────────────────────────┘
                               │
              ┌────────────────┼────────────────┬────────────────┐
              ▼                ▼                ▼                ▼
        ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐
        │PostgreSQL│    │  Redis   │    │  Neo4j   │    │    ES    │
        │  v16     │    │   v7     │    │  (可选)  │    │  (可选)  │
        └──────────┘    └──────────┘    └──────────┘    └──────────┘
```

### 技术栈总览

#### 前端技术栈

| 层级 | 技术 | 精确版本 | 用途 |
|:-----|:-----|:--------:|:-----|
| 框架 | React | ^19.2.4 | UI 组件化 (Automatic JSX Runtime) |
| 语言 | TypeScript | ^5.7.3 | 类型安全 (ES2023 target, strict mode) |
| 构建 | Vite | ^8.0.10 | 极速开发 (自定义 polyfill + esbuild 兼容插件) |
| 样式 | TailwindCSS | ^4.1.8 | 原子化 CSS (@tailwindcss/vite 插件集成) |
| 状态管理 | Zustand | ^5.0.5 | 轻量级状态 (14 stores, 含 persist middleware) |
| 服务端状态 | TanStack Query | ^5.81.5 | 缓存/重试/乐观更新 |
| 数据表格 | TanStack Table | ^8.21.3 | 高性能无头表格 |
| 虚拟滚动 | TanStack Virtual | ^3.13.24 | 大列表性能优化 |
| 路由 | React Router DOM | ^7.6.1 | Data Router (createBrowserRouter) |
| HTTP 客户端 | Axios | ^1.10.0 | 封装 client.ts (拦截器/重试/Mock 降级) |
| 图表 | Recharts + D3 | ^2.15.3 / ^7.9.0 | 雷达图/柱状图/折线图/风味轮 |
| 拖拽 | DnD Kit | ^6.3.1 / ^10.0.0 | @dnd-kit 模块化拖拽 |
| 国际化 | i18next | ^26.2.0 | 中英文双语 (react-i18next, AI 模块独立翻译) |
| XSS 防护 | DOMPurify | ^3.4.2 | 输出编码消毒 |
| PDF 导出 | jsPDF + autoTable | ^4.2.1 / ^5.0.7 | 报告生成 |
| Excel 处理 | ExcelJS | ^4.4.0 | 导入导出 (已替换 xlsx) |
| Word 处理 | docx | ^9.6.1 | Word 文档生成 |
| 模糊搜索 | Fuse.js | ^7.3.0 | 客户端模糊搜索 |
| 无障碍 | axe-core | ^4.11.4 | WCAG 合规检测 |
| 单元测试 | Vitest | ^3.2.4 | + @testing-library/react |
| E2E 测试 | Playwright | ^1.59.1 | 端到端测试 |
| Lint | ESLint | ^9.39.4 | Flat Config + typescript-eslint |

#### 后端技术栈

| 层级 | 技术 | 精确版本 | 用途 |
|:-----|:-----|:--------:|:-----|
| 框架 | FastAPI | ==0.115.0 | 高性能异步 ASGI 框架 |
| ASGI 服务器 | Uvicorn | ==0.30.0 | 开发; 生产 Gunicorn + UvicornWorker (4 workers) |
| ORM | SQLAlchemy | ==2.0.35 | 异步 ORM (asyncpg 驱动) |
| 验证 | Pydantic | ==2.9.0 | 数据校验与序列化 |
| 认证 | python-jose | ==3.3.0 | JWT 双 Token (Access+Refresh) |
| 密码哈希 | bcrypt | >=4.0.0 | cost=12 |
| 数据库 | PostgreSQL | 16 Alpine | 连接池 20+10 |
| 缓存 | Redis | 7 Alpine | 可选, maxmemory 256MB |
| 图数据库 | Neo4j | — | 知识图谱 (可选) |
| 搜索引擎 | Elasticsearch | — | 全文搜索 (可选) |
| 数据库迁移 | Alembic | >=1.13.0 | 16 个版本 |
| AI/ML 核心 | PyTorch | >=2.0.0 | 神经网络引擎 |
| 化学信息学 | RDKit | >=2023.9.6 | 分子结构与肽分析 |
| NLP | Transformers | >=4.35.0 | HuggingFace |
| 代码质量 | Ruff / Black / isort | — | Lint + 格式化 |

---

## 后端架构详解

### 应用入口 (`app/main.py`)

采用**工厂模式** (`create_app()`) 创建 FastAPI 实例，通过 `lifespan` 上下文管理器控制应用生命周期：

| 生命周期阶段 | 操作 | 来源模块 |
|:------------|:-----|:---------|
| 启动 | 日志初始化 + 版本打印 | `core.logging_config.logger` |
| 启动 | 数据库初始化 (建表/种子数据) | `core.init_db.init_db()` |
| 启动 | CDC 变更捕获监听器启动 | `core.cdc_listener.cdc_listener.start()` |
| 启动 | 延迟注册非关键路由 | `api.register_lazy_routers()` |
| 启动 | 缓存服务初始化 | `core.cache_system.init_cache()` |
| 启动 | WebSocket 连接管理器启动 | `core.websocket.connection_manager.start()` |
| 关闭 | CDC 监听器 / WS / 缓存关闭 | 有序关闭 |

### 中间件链（执行顺序：自下而上）

```
请求 → GlobalExceptionHandler (全局异常)
     → RateLimitMiddleware      (速率限制: 开发 60/min, 生产 100/min)
     → CORSMiddleware          (CORS 跨域)
     → SecurityHeadersMiddleware (安全响应头)
     → UTF8EncodingMiddleware   (UTF-8 编码强制)
     → RequestLoggingMiddleware (请求日志)
     → 路由处理
```

### API 路由层 (`app/api/`) — 52 个文件

#### 基础业务路由 (44 个)

| 分类 | 路由文件 | 功能说明 |
|:-----|:---------|:---------|
| 认证 | `auth.py`, `oauth2_auth.py` | JWT 登录/注册/刷新 + OAuth2 |
| 用户 | `users.py` | 用户 CRUD / 角色 |
| 配方 | `formulas.py`, `ingredients.py`, `formula_integration.py` | 全生命周期 |
| 实验 | `experiments.py` | 实验数据管理 |
| AI 核心 | `ai.py`, `chat.py` | 生成/优化/推荐 + 流式对话 |
| 肽模块 (7) | `peptides.py`, `peptide_analysis_routes.py`, `peptide_design_routes.py`, `advanced_peptide.py`, `food_peptide_routes.py`, `pepinvent.py`, `lab_validation.py` | 完整肽管线 |
| 知识库 | `databases.py`, `knowledge_base.py` | TCMSP/DFBP 检索 |
| 搜索 | `search.py` | 全文搜索 |
| 仪表盘 | `dashboard.py` | 数据概览 |
| 工作流 | `workflows.py` | 流程编排 |
| 通知 | `notifications.py` | 通知中心 |
| WebSocket | `websocket.py` | WS 连接 |
| 分析 | `analytics.py` | SSS 数据分析 |
| 组织 | `organizations.py` | 多租户管理 |
| 集成 | `integrations.py` | Webhook/API 密钥 |
| 文件 | `file_generator.py`, `attachments.py` | 报告/附件 |
| 其余 | `comments/comment_likes/activity/categories/tags/terminology/admin/audit` | 社交/分类/管理 |

#### SSS 企业级 v1 子路由 (8 个)

`ai_router` / `notification_router` / `sync_router` / `team_router` / `team_dashboard_router` / `version_router` / `websocket_router`

### 核心基础设施 (`app/core/`) — 48 个模块

| 子系统 | 关键模块 | 功能 |
|:-------|:---------|:-----|
| 配置中心 | `config.py` | Pydantic Settings (50+ 配置项) |
| 数据库 | `database.py`, `session.py`, `init_db.py` | 连接池 20+10 |
| 安全体系 | `security.py`, `security_middleware.py`, `sql_security.py`, `account_lockout.py`, `ai_rate_limiter.py` | JWT/RBAC/锁定/限流 |
| 认证授权 | `rbac.py`, `permission.py` | 5 级角色 + 装饰器 |
| 异常处理 | `error_handler.py`, `exceptions.py` | 全局异常 + 告警 |
| 监控日志 | `logger.py`, `logging_config.py`, `monitoring.py`, `performance.py` | 结构化日志 |
| 缓存/CDC | `cache_system.py`, `cdc_listener.py` | 多级缓存 O(1) LRU |
| 多租户 | `multi_tenant.py`, `collaboration.py` | 组织隔离 |
| 通知 | `notification_center.py` | @提及 解析 |
| 搜索 | `search_engine.py` | ES 集成 |
| 扩展框架 | `extension_framework.py`, `integration_framework.py` | 插件 + 外部集成 |
| 业务引擎 | `nutrition_engine.py`, `query_optimizer.py`, `resilience.py`, `batch_processor.py`, `task_queue.py` | 业务支撑 |
| 实时通信 | `websocket.py` | WS 连接管理器 |

### ORM 模型层 (`app/models/`) — 28 个模型

| 分类 | 模型文件 |
|:-----|:---------|
| 用户体系 | `user_model.py`, `user_device.py` |
| 配方核心 | `formula.py`, `formula_deep_integration.py`, `ingredient.py` |
| 实验 | `experiment.py` |
| 肽模块 | `peptide_analysis.py`, `peptide_design.py` |
| AI | `chat.py`, `ai_suggestion.py` |
| 工作流 | `workflow.py` |
| 知识图谱 | `knowledge_graph.py` |
| 通知/团队 | `notification.py`, `team.py`, `team_member.py` |
| 版本控制 | `prompt_template.py`, `prompt_version.py` |
| 同步 | `sync_log.py` |
| 多租户 | `organization.py`, `system.py` |
| 外部数据 | `tcm_schema.py`, `dfbp_schema.py`, `external_data.py`, `data_source_health.py` |
| 基础设施 | `base.py`, `models.py`, `terminology.py`, `enums.py`, `change_event.py` |

### 业务服务层 (`app/services/`) — 90+ 文件 / 13 子目录

| 子目录 | 文件数 | 核心功能 |
|:-------|:------:|:---------|
| **顶层服务** | 23 | auth/user/formula/experiment/LLM/file/workflow/audit/notification/terminology/等 |
| **ai/** | 15 | LLM Provider 抽象层 / 生成/优化/推荐/功效预测/结构分析/语法校验/模板 |
| **ai_models/** | 20 | 神经网络引擎 / GPT 生成 / 编码解码 / MCTS / 模拟退火 / 梯度下降 / 安全/稳定性/口感/协同/肽分析 |
| **data_sources/** | 9 | TCMSP/DFBP/图谱/搜索/法规/扩展 |
| **formula/** | 7 | 集成/配比/禁忌/协同/功效/安全 |
| **sync/** | 6 | 同步/冲突/Diff/变更队列 |
| **auth/notification/team/kg/search/version/tasks** | 各 1-4 | 辅助服务 |
| **peptide_analysis_v2/** | 4+ | 核心算法 + SwissProt/UniProt 客户端 |

---

## 前端架构详解

### 应用根组件 (`App.tsx`) — Provider 层级与路由守卫

```
ErrorBoundary (应用级错误边界)
  └── ThemeProvider (Zustand Design Token 主题)
      └── QueryClientProvider (TanStack Query, staleTime=30s)
          └── ToastProvider (Toast 上下文)
              └── ShortcutHelpProvider (快捷键帮助)
                  └── RouterProvider (React Router v7 Data Router)
                      └── ToastContainer (全局 Toast)
```

#### 三层路由守卫

| 守卫 | 范围 | 逻辑 |
|:-----|:-----|:-----|
| **AuthGuard** | `/` 子路由 | 未认证→`/login`; persist 恢复中→Loading |
| **GuestGuard** | `/login`, `/forgot-password` | 已登录→`/dashboard` |
| **AdminGuard** | `/users`, `/audit-logs` | 非 ADMIN→`/dashboard` |

#### 路由表 (27 条路由)

| 类型 | 路径 | 组件 | 加载 |
|:-----|:-----|:-----|:----:|
| 公开 | `/login` | RhineLoginPage | 直接 |
| 公开 | `/forgot-password` | ForgotPasswordPage | 直接 |
| 受保护 | `/dashboard` | DashboardPage | 直接 |
| 受保护 | `/formulas/*` (7) | List/New/Detail/Edit/Templates/Compare/Test | lazy |
| 受保护 | `/experiments/*` (4) | List/New/Detail/Edit | lazy |
| 受保护 | `/ai` | AIAssistantPage | lazy |
| 受保护 | `/academic-report` | AcademicReportPage | lazy |
| 受保护 | `/databases` | DatabasePage | lazy |
| 受保护 | `/workflows` | WorkflowPage | lazy |
| 受保护 | `/analytics` / `/organizations` / `/integrations` | SSS 页面 | lazy |
| 受保护 | `/notifications` / `/settings` | 通知/设置 | lazy |
| Admin | `/users` / `/audit-logs` | 用户管理/审计 | lazy |
| 兜底 | `*` → `/404` | NotFoundPage | lazy |

### 页面层 (`src/pages/`) — 16 个目录 / 50+ 文件

| 目录 | 页面数 | 说明 |
|:-----|:------:|:-----|
| `auth/` | 6 | Rhine 风格登录/密码找回/DNA 螺旋/六边形网格/粒子场 |
| `formula/` | 22+ | 最复杂: 7 页面 + 22 子组件 + 测试套件 |
| `database/` | 8 | 6 Tab (中药材/活性肽/图谱/同源/同步/管理) |
| `organizations/` | 8 | 列表 + 6 Detail Tab |
| `settings/` | 8 | 个人设置 (hooks/services/types/utils 独立) |
| `analytics/` | 5 | 4 Tab (概览/趋势/报表/自定义) |
| 其余 | 各 1-4 | experiment/academic/ai/workflow/integrations/notification/admin/user |

### 组件库 (`src/components/`) — 20 子目录 / 200+ 组件

| 子目录 | 文件数 | 说明 |
|:-------|:------:|:-----|
| **ui/** | 39 | 基础原子组件库: Button/Card/Input/Modal/Select/Tabs/Toast/VirtualList/ErrorBoundary/CommandPalette |
| **ai/** | **130+** | **核心模块**: features(ChatTab/GenerateTab/SafetyTab 含 components/hooks/services/state) + charts/professional + 40+ 聊天组件 + 25+ hooks + 35+ services |
| **academic/** | ~18 | 协作/编辑/导出/引用/审阅/模板 |
| **theme/** | 6 | 编辑器/切换/预览/历史 |
| **history-sidebar/** | 9 | 会话列表/搜索/过滤 |
| **dashboard/search/analytics/formula/inference/common/layout** | 各 4-10 | 通用组件 |

### API 服务层 (`src/api/`) — 24 个模块

| 文件 | 职责 |
|:-----|:-----|
| `client.ts` | Axios 实例 (拦截器/Token 刷新/Mock 降级) |
| `apiConfig.ts` / `apiInit.ts` / `apiArchitecture.ts` | 配置/初始化/架构 |
| `modelClient.ts` | 模型客户端 |
| 业务 API (18) | auth/user/formula/experiment/ai/chat/dashboard/analytics/notification/search/tag/comment/activity/admin/workflow/category/attachment/fileGenerator/database |
| Mock (2) | `database.mock.ts`, `mockData.ts` |

### 自定义 Hooks (`src/hooks/`) — 42 个

| 分类 | Hooks |
|:-----|:------|
| 业务核心 | useFormulaAnalysis / useExport / usePeptideAnalysis / useReportGenerator / useGenerationProgress |
| 性能优化 | usePerformance / useSmartPrefetch / useOptimizedComponents / useMobileOptimization |
| 主题系统 | useTheme / useThemePersistence / useCustomTheme |
| 权限协作 | usePermissions / useCollaboration / useRealtimeSync / useBulkOperations |
| 用户体验 | useKeyboardShortcuts / useOnboarding / useOperationFeedback / useToast / usePersistentState / useMobile |

### 状态管理 (`src/stores/`) — 14 个 Zustand Store

| Store | 用途 |
|:------|:-----|
| `auth.ts` | JWT 持久化 + 自动刷新 + 竞态处理 |
| `themeStore.ts` / `theme.presets.ts` | 完整主题系统 |
| `toastStore.ts` / `userPreferenceStore.ts` | 通知/偏好 |
| `academicReportStore.ts` / `collaborationStore.ts` | 学术报告/协作 |
| `exportStore.ts` / `referenceStore.ts` | 导出/引用 |
| `reviewStore.ts` / `reviewStore.enhanced.ts` | 审阅 (标准+增强) |
| `templateStore.ts` | 模板管理 |

---

## 快速开始

### 环境要求

| 工具 | 最低版本 | 用途 |
|:-----|:--------:|:-----|
| Python | 3.12+ | 后端运行 |
| Node.js | 20.x | 前端构建 |
| PostgreSQL | 16+ (生产) / SQLite (开发) | 数据库 |
| Redis | 7.x (可选) | 缓存 |
| Docker + Compose | 2.0+ (可选) | 容器化 |

### 方式一：本地开发

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

alembic upgrade head          # 16 个迁移版本
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

> Swagger UI: http://localhost:8000/docs
> ReDoc: http://localhost:8000/redoc (debug 模式)

</details>

<details>
<summary><b>前端启动</b></summary>

```bash
cd frontend
npm install
cp .env.example .env.local
npm run dev                  # http://localhost:3000
```

</details>

### 方式二：Docker 一键部署

<details>
<summary><b>Docker Compose 编排 (5 服务)</b></summary>

```bash
cp .env.example .env         # 必填: SECRET_KEY, ADMIN_PASSWORD, POSTGRES_PASSWORD

# 开发环境 (含代码热挂载)
docker compose up -d

# 生产环境 (DEBUG=false)
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

| 服务 | 基础镜像 | 端口 | 资源限制 |
|:-----|:---------|:----:|:---------|
| backend | python:3.12-slim | 8000 | 2 CPU / 2 GB RAM |
| postgres | postgres:16-alpine | 5432 | 1 CPU / 1 GB RAM |
| redis | redis:7-alpine | 6379 | 0.5 CPU / 512 MB |
| frontend | node:20-alpine → nginx:alpine | 3000→80 | 1 CPU / 512 MB |
| nginx | nginx:alpine | 80/443 | 0.5 CPU / 128 MB |

所有服务配置 healthcheck, 依赖链: backend ← postgres+redis, frontend ← backend.

</details>

### 默认账号

| 项目 | 值 |
|:-----|:---|
| 用户名 | `admin` |
| 密码 | `.env` 设置 (开发见控制台掩码输出) |

> ⚠️ 生产环境必须设置强密码: `ADMIN_PASSWORD=YourStrongP@ssw0rd2024!`

### 前端常用脚本

| 命令 | 说明 |
|:-----|:-----|
| `npm run dev` | Vite 开发服务器 |
| `npm run build` | tsc + Vite 生产构建 |
| `npm run lint` | ESLint 9 flat config |
| `npm run test` | Vitest 单元测试 |
| `npm run test:coverage` | 覆盖率报告 |
| `npm run test:e2e` | Playwright E2E |
| `npm run preview` | 预览生产构建 |
| `npm run build:optimized` | Terser 优化构建 |

---

## 项目结构

<details>
<summary><b>点击展开完整目录树</b></summary>

```
rmfood-platform/
│
├── 📂 backend/                              # 后端 (FastAPI / Python 3.12+)
│   ├── 📂 app/
│   │   ├── 📂 api/                          # API 路由 (52 文件, 46 业务路由)
│   │   │   ├── auth/oauth2_auth/users/formulas/ingredients/experiments/ai/chat
│   │   │   ├── peptides*/peptide_*_routes/advanced_peptide/food_peptide_routes
│   │   │   ├── pepinvent/lab_validation/formula_integration/databases
│   │   │   ├── knowledge_base/search/dashboard/workflows/notifications
│   │   │   ├── websocket/analytics/organizations/integrations
│   │   │   ├── file_generator/attachments/comments/comment_likes/activity
│   │   │   ├── audit/categories/tags/terminology/admin
│   │   │   └── 📂 v1/                       # SSS 企业级路由 (8)
│   │   │
│   │   ├── 📂 core/                         # 核心基础设施 (48 模块)
│   │   │   ├── 配置: config/database/db_config/session/init_db
│   │   │   ├── 安全: security/security_middleware/sql_security/account_lockout/ai_rate_limiter
│   │   │   ├── 授权: rbac/permission
│   │   │   ├── 异常: error_handler/error_alert/exceptions
│   │   │   ├── 日志: logger/logging_config/monitoring/performance
│   │   │   ├── 缓存: cache_system/cdc_listener
│   │   │   ├── 租户: multi_tenant/multi_tenant_service/collaboration
│   │   │   ├── 通知/搜索/分析: notification_center/search_engine/analytics/analytics_engine
│   │   │   ├── 引擎: extension_framework/integration_framework/nutrition_engine
│   │   │   ├── 工具: query_optimizer/resilience/batch_processor/task_queue/audit_system
│   │   │   └── 通信: websocket/pagination/response
│   │   │
│   │   ├── 📂 models/                       # ORM 模型 (28)
│   │   ├── 📂 schemas/                      # Pydantic Schema (17)
│   │   ├── 📂 services/                     # 业务服务 (90+ / 13 子目录)
│   │   │   ├── 顶层 (23): auth/user/formula/LLM/file/workflow/audit/等
│   │   │   ├── 📂 ai/ (15): LLM Provider / 生成/优化/推荐/功效预测
│   │   │   ├── 📂 ai_models/ (20): 神经网络引擎/MCTS/模拟退火/梯度下降/肽分析
│   │   │   ├── 📂 data_sources/ (9): TCMSP/DFBP/法规
│   │   │   ├── 📂 formula/ (7): 集成/配比/禁忌/协同/功效
│   │   │   ├── 📂 sync/ (6) / auth/ (4) / notification/ (3) / team/ (3)
│   │   │   ├── 📂 kg/ (2) / search/ (2) / version/ (2) / tasks/ (1)
│   │   │   └── 📂 peptide_analysis_v2/ (4+)
│   │   │
│   │   ├── 📂 utils/ / 📂 middleware/ / 📂 websockets/
│   │   └── main.py                          # 工厂模式 + lifespan + 6 中间件
│   │
│   ├── 📂 alembic/ (16 迁移版本)
│   ├── 📂 tests/ / 📂 config/
│   ├── requirements.txt / pyproject.toml
│   ├── Dockerfile.backend / SECURITY.md
│   └── start.bat / stop.bat
│
├── 📂 frontend/                              # 前端 (React 19 / Vite 8 / TS 5.7)
│   ├── 📂 src/
│   │   ├── 📂 pages/ (16 目录 / 50+ 文件)
│   │   │   ├── auth/dashboard/formula(22+)/experiment/ai/academic
│   │   │   ├── database(8)/workflow/analytics(5)/organizations(8)
│   │   │   └── integrations/notification/settings(8)/admin/user/404
│   │   │
│   │   ├── 📂 components/ (20 目录 / 200+ 组件)
│   │   │   ├── 📂 ui/ (39): 37 基础原子组件
│   │   │   ├── 📂 ai/ (130+): **核心** - 9 Tab × 子组件体系
│   │   │   │   ├── features/ (ChatTab/GenerateTab/SafetyTab 各含 components/hooks/services)
│   │   │   │   ├── charts/ / professional/ / visualization/
│   │   │   │   └── components(40+) / hooks(25+) / services(35+)
│   │   │   ├── academic(~18) / theme(6) / history-sidebar(9)
│   │   │   └── dashboard/search/analytics/formula/inference/common/layout/...
│   │   │
│   │   ├── 📂 api/ (24) | 📂 hooks/ (42) | 📂 stores/ (14)
│   │   ├── 📂 config/ (21) | 📂 types/ | 📂 i18n/ (8)
│   │   ├── 📂 theme/ / 📂 design-system/ (8 类 Design Token)
│   │   ├── 📂 constants/ / 📂 contexts/AIContext/
│   │   ├── App.tsx (3 守卫 + 27 路由 + 6 Provider)
│   │   └── main.tsx
│   │
│   ├── 📂 public/
│   ├── vite.config.ts / tsconfig*.json (4)
│   ├── eslint.config.js
│   ├── Dockerfile.frontend
│   └── package.json
│
├── 📂 tests/ (14 文件): e2e/performance/security
├── 📂 docs/ (74+ 资产): 28 文档 + 27 截图 + 22 报告
├── 📂 .github/workflows/ci-cd.yml (9 Job)
├── docker-compose*.yml (3 套)
├── Dockerfile.backend / Dockerfile.frontend
├── DOCKER.md (341 行部署手册)
├── .env.example (50+ 变量)
└── README.md
```

</details>

---

## 安全体系

本项目实施 **7 层纵深防御**，遵循 OWASP Top 10。

| 层级 | 领域 | 关键措施 |
|:----:|:-----|:---------|
| L7 | 应用层 | Pydantic v2 输入验证 / DOMPurify XSS 防护 / CSRF (JWT Bearer) / SQLAlchemy 参数化查询 / GlobalExceptionHandler |
| L6 | 认证授权 | JWT 双 Token (Access+Refresh) / OAuth2 / RBAC 5 级角色 / 账户锁定 (5 次/15 分钟) / 设备限制 (5 台/用户) |
| L5 | 速率限制 | 滑动窗口 / 多维度 (全局/IP/用户/端点) / AI 独立限流 |
| L4 | 数据保护 | bcrypt (cost=12) / data_masking / 审计日志 / UTF-8 强制编码 |
| L3 | 网络传输 | Security Headers (HSTS) / CORS 精确配置 / TLS 支持 |
| L2 | 容器安全 | 非 root 用户 / 多阶段构建 |
| L1 | 供应链安全 | pip-audit + bandit + safety / npm audit |

### 安全工具链

| 工具 | 扫描类型 | 集成 |
|:-----|:---------|:-----|
| pip-audit | Python 依赖 CVE | CI/CD |
| bandit | Python 代码安全 (AST) | CI/CD |
| safety | Python 依赖备选 | CI/CD |
| TruffleHog | Git 密钥泄露 | GitHub Actions |
| npm audit | Node.js 依赖 | GitHub Actions |

### 生产环境安全检查清单

- [ ] `SECRET_KEY` >= 32 位随机字符串
- [ ] `ADMIN_PASSWORD` >= 12 位 (大小写+数字+特殊字符)
- [ ] `DEBUG=false`
- [ ] `DATABASE_URL` 使用 PostgreSQL
- [ ] `CORS_ORIGINS` 明确指定生产域名
- [ ] 定期执行安全扫描
- [ ] 生产启用 HTTPS

---

## 代码质量

### 当前代码健康度 (2026-06-10 更新)

| 维度 | 评分 | 状态 |
|:-----|:----:|:-----|
| 架构设计 | **8.5/10** | ✅ 六边形架构落地, 路由注册统一, 端口注入 |
| 安全性 | **9/10** | ✅ console.log=0, bare except=0, API Key 加密, 7 层纵深防御 |
| 性能 | **7.5/10** | ✅ 连接池优化, O(1) 缓存, N+1 已修复 |
| 可维护性 | **8.5/10** | ✅ 路由自动发现, request_id 传播, 结构化日志 |
| 测试覆盖 | **6.5/10** | ✅ 新增 259 测试用例, 覆盖率阈值 70% |
| DevOps | **8/10** | ✅ devcontainer, 部署脚本, 每日安全扫描 |
| 可观测性 | **6/10** | ✅ request_id 传播, 可观测性配置, Prometheus 就绪 |

### TypeScript 代码质量

| 指标 | 数值 | 状态 |
|:-----|:----:|:-----|
| 编译错误 | **0** | ✅ 全部清除 (从 1,331 降至 0) |
| ESLint 自动修复 | 已执行 | ✅ 11,512 格式化问题已修复 |
| Strict Mode | 全量启用 | ✅ strict: true |
| ESLint 配置 | Flat Config 9.x | ✅ |

### 已知技术债务 (2026-06-10 更新)

| 项目 | 优先级 | 说明 |
|:-----|:------:|:-----|
| `xlsx` 已替换为 ExcelJS | ✅ P0 | 已完成 |
| TypeScript 5.7.3 稳定 | ✅ P0 | 已验证 |
| 生产构建 minify | ✅ P1 | 已验证 |
| Mock 数据分离 | ✅ P1 | 独立 `mockData.ts` 模块 |
| console.log 清理 | ✅ P0 | 413→0, 全部替换为 safeLogger |
| bare except 修复 | ✅ P0 | 136→0, 全部改为具体异常类型 |
| API Key 加密存储 | ✅ P0 | AES-256-GCM 加密, 向后兼容 |
| 路由注册统一 | ✅ P1 | 路由自动发现注册中心 |
| 六边形架构违规 | ✅ P1 | mobile_facade 端口注入修复 |
| request_id 传播 | ✅ P1 | contextvars 传播, 日志自动注入 |
| 测试覆盖提升 | ✅ P1 | 新增 259 测试用例, 阈值 70% |
| devcontainer | ✅ P2 | Python 3.12 + Node 20 开发容器 |
| 部署脚本 | ✅ P2 | 一键部署 + 数据库备份 |
| 每日安全扫描 | ✅ P2 | GitHub Actions 定时任务 |
| 后端 print() 清理 | 🟡 P2 | 503 处, 需替换为 logger |
| OpenTelemetry 完整集成 | ⬜ P3 | request_context 已就绪, 需 OTel SDK |
| API 版本管理 | ⬜ P3 | 待增强 |
| 邮件服务 | ⬜ P3 | 密码重置 TODO |

---

## 测试策略

### 测试架构

```
tests/
├── e2e/              端到端测试 (用户旅程 / AI工作流 / 同步场景)
├── performance/      性能测试 (Locust / SQL 优化 / 报告)
├── security/         安全测试 (OWASP / GDPR / 审计)
└── *.py              后端集成测试
```

### 运行命令速查

```bash
# ═══════════════════════ 后端 ═══════════════════════
cd backend
pytest tests/ -v --cov=app --cov-report=html --cov-fail-under=60
pytest tests/ -m unit                               # 快速单元
pytest tests/ -m integration                        # 集成
black --check --diff app/ && ruff check app/

# ═══════════════════════ 前端 ═══════════════════════
cd frontend
npm run test / test:watch / test:coverage            # Vitest
npm run test:e2e / test:e2e:ui                       # Playwright
npx tsc --noEmit && npm run lint                     # 类型 + Lint
```

### 覆盖率配置

| 配置项 | 值 |
|:-------|:---:|
| 阈值 | **60%** (fail_under) |
| 排除 | `ai_models/*`, `data_sources/*`, `peptide_analysis_v2/*` |

---

## API 文档

| 文档 | 地址 |
|:-----|:-----|
| Swagger UI | http://localhost:8000/docs |
| ReDoc | http://localhost:8000/redoc |
| OpenAPI JSON | http://localhost:8000/openapi.json |
| 健康检查 | http://localhost:8000/health |

22 个端点分类：认证/用户/配方/实验/AI/肽设计/知识库/搜索/工作流/通知/仪表盘/活动/分析/组织/集成/同步/团队/版本控制/管理/文件/WebSocket

---

## CI/CD 流水线

GitHub Actions (`.github/workflows/ci-cd.yml`), **9 个 Job**, Node 20 + Python 3.12:

| # | Job | 触发 | 依赖 | 内容 |
|:-:|:-----|:-----|:-----|:-----|
| 1 | backend-lint | push/PR | — | Black + isort + Bandit |
| 2 | frontend-lint | push/PR | — | `tsc --noEmit` |
| 3 | backend-tests | after lint | 1 | pytest + coverage ≥60% |
| 4 | frontend-tests | after lint | 2 | Vitest + Production Build |
| 5 | security-scan | always | — | npm audit + TruffleHog |
| 6 | build-docker | push+tests | 3,4 | 多阶段镜像 |
| 7 | deploy-staging | develop | 6,5 | 预发布 |
| 8 | deploy-production | tag v* | 7 | 生产 |
| 9 | notify | always | 3,4 | 结果汇总 |

---

## Docker 部署

### 镜像构建

| 阶段 | 后端 | 前端 |
|:-----|:-----|:-----|
| Builder | python:3.12-slim (gcc+libffi) | node:20-alpine |
| Production | python:3.12-slim (appuser, gunicorn 4w) | nginx:alpine |

### 数据卷

| 卷名 | 用途 |
|:-----|:-----|
| backend-data | 后端数据 |
| uploads-data | 文件上传 |
| postgres-data | PG 数据 |
| redis-data | Redis AOF |

---

## 已知技术债务

以下为审计发现的待改进项, 按优先级排序:

| 优先级 | 项 | 状态 | 工作量 |
|:-------|:---|:----:|:------:|
| 🔴 P0 | xlsx 安全漏洞 → 已替换 ExcelJS | ✅ 完成 | 2天 |
| 🔴 P0 | ESLint 零错误 | 🟡 剩余 16,011 非自动修复 | 5天+ |
| 🟠 P1 | 生产构建 minify 启用 | ✅ 完成 | 0.5天 |
| 🟠 P1 | Mock 数据分离 | ✅ 完成 | 3天 |
| 🟠 P1 | API Key 加密存储 | ⬜ 待办 | 2天 |
| 🟡 P2 | 核心组件单元测试补充 | ⬜ 待办 | 5天 |
| 🟡 P2 | Prettier + husky/lint-staged | ⬜ 待办 | 1天 |
| 🟡 P2 | 移除未使用依赖 (`passlib`) | ⬜ 待办 | 0.5天 |
| ⬜ P5 | OpenTelemetry 分布式追踪 | ⬜ 待办 | — |
| ⬜ P5 | API 版本协商机制 | ⬜ 待办 | — |
| ⬜ P5 | 邮件服务 (forgot_password) | ⬜ 待办 | — |

---

## 贡献指南

```
Fork → Clone → 分支(feature/fix/docs/refactor) → 编写 → 测试 → Conventional Commits → Push → PR
```

| 语言 | 工具链 | 规范 |
|:-----|:-------|:-----|
| Python | Ruff + Black + isort | target py312 |
| TypeScript | ESLint 9 + Prettier | strict mode ES2023 |
| Commit | Conventional Commits | `feat:` / `fix:` / `docs:` |
| 测试 | pytest / Vitest / Playwright | 新功能必含测试 |

---

## 许可证

[MIT License](LICENSE)

---

## 致谢

[FastAPI](https://fastapi.tiangolo.com/) · [React](https://react.dev/) · [SQLAlchemy](https://www.sqlalchemy.org/) · [TailwindCSS v4](https://tailwindcss.com/) · [Vite](https://vitejs.dev/) · [Zustand](https://zustand.docs.pmnd.rs/) · [TanStack Query](https://tanstack.com/query) · [PepINVENT](https://github.com/MolecularAI/PepINVENT) · [PyTorch](https://pytorch.org/) · [RDKit](https://www.rdkit.org/)

---

<div align="center">

如果这个项目对你有帮助，欢迎 **Star** 支持！

Made with care by RMFOOD Team

</div>
