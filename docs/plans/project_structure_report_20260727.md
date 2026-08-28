# RMFOOD配方平台 - 项目结构与功能模块汇报

> **版本**: 1.0
> **日期**: 2026-07-27
> **状态**: 正式汇报文档

---

## 一、项目总览

**RMFOOD配方平台**是一款面向中药与食品领域的智能配方研发与管理平台，深度融合了AI实验优化、知识图谱分析、多源数据集成等先进技术。系统采用现代化微前端与微服务架构思想，通过六边形架构（Ports & Adapters）实现领域逻辑与基础设施的清晰分离。

| 维度 | 说明 |
|------|------|
| **核心定位** | AI驱动的智能配方研发管理平台 |
| **技术栈** | Python (FastAPI) + React/TypeScript |
| **架构风格** | 六边形架构 + DDD + 分层设计 |
| **部署方式** | Docker容器化，支持多环境部署 |
| **目标用户** | 中医药研究机构、食品企业研发团队 |

---

## 二、整体架构视图

```
┌─────────────────────────────────────────────────────────────┐
│                      FRONTEND (React + TS)                   │
│               Vite · Ant Design · TanStack Query            │
│                 i18next · framer-motion · zustand           │
└──────────────────────┬──────────────────────────────────────┘
                       │ REST/WebSocket API
                       ▼
┌─────────────────────────────────────────────────────────────┐
│                    BACKEND (FastAPI / Python)               │
│                                                             │
│   ┌──────────────────────┐    ┌────────────────────┐        │
│   │   API LAYER          │    │   CORE/LAYER      │        │
│   │  ─────────────────── │    │  ────────────────  │        │
│   │  · Router Registry   │    │  · AI Infrastructure│       │
│   │  · Versioned Endpoints│   │  · Analytics Engine│      │
│   │  · API Framework     │    │  · Compliance Mgmt │      │
│   └──────────┬───────────┘    └──────────┬──────────┘        │
│              │                           │                    │
│              ▼                           ▼                    │
│   ┌──────────────────────┐    ┌────────────────────┐        │
│   │ APPLICATION LAYER    │    │ DOMAIN LAYER      │        │
│   │  ─────────────────── │    │  ────────────────  │        │
│   │  · RAG Service       │    │  · Knowledge Core │        │
│   │  · Mobile Facade     │    │  · Agent Orchestration │      │
│   └──────────┬───────────┘    └──────────┬──────────┘        │
│              │                           │                    │
│              ▼                           ▼                    │
│   ┌──────────────────────┐    ┌────────────────────┐        │
│   │ INFRASTRUCTURE LAYER │    │ DATABASE (PostgreSQL)│      │
│   │  ─────────────────── │    │  ────────────────  │        │
│   │  · Database Layer    │    │  · pgvector/KG      │    │
│   │  · File Storage     │    │  · Extensions/ML     │  │
│   │  · External Services │    │  · Audit System      │  │
│   └──────────────────────┘    └────────────────────┘        │
└─────────────────────────────────────────────────────────────┘
```

---

## 三、后端模块详解

### 3.1 API层 (`app/api`)

#### 核心API路由

| 模块 | 文件 | 功能描述 |
|------|------|----------|
| **认证授权** | `auth.py`, `oauth2_auth.py` | JWT认证、OAuth2登录、角色权限控制 |
| **用户管理** | `users.py`, `user_settings.py` | 用户资料、偏好设置、组织架构 |
| **组织管理** | `organizations.py`, `teams.py` | 多租户体系、团队协作、企业版功能 |
| **配方核心** | `formulas.py`, `ingredients.py` | 配方创建、编辑、版本管理、成分查询 |
| **实验优化** | `experiments.py`, `advanced_peptide.py` | AI实验、肽段优化、参数调优 |
| **知识图谱** | `knowledge_graph.py`, `rag_router.py` | 图谱查询、RAG检索、语义搜索 |
| **数据采集** | `openfoodfacts.py`, `import_router.py` | OpenFoodFacts对接、CSV导入引擎 |
| **数据同步** | `sync.py`, `notifications.py` | 数据同步、消息通知 |
| **监控分析** | `analytics.py`, `search_analytics.py` | 业务统计、搜索行为分析 |
| **审计日志** | `audit.py`, `activity.py` | 操作审计、活动追踪 |
| **系统运维** | `admin.py`, `lab_validation.py` | 后台管理、实验室验证 |

#### AI专用模块 (`app/api/ai_modules`)

- **chat**: AI对话聊天接口
- **experiment**: 实验参数配置与结果管理
- **generation**: AI生成式配方推荐
- **models_and_tools**: AI模型注册与工具调用
- **optimization**: 配方优化算法接口
- **recommendations**: 个性化推荐服务
- **versions**: AI版本管理与回溯

#### v1版本路由 (`app/api/v1/`)

独立的路由注册中心，支持API版本迭代和灰度发布，包含：
- `team_dashboard_router.tsx`: 团队看板
- `sync_router`: 同步任务
- `notification_router`: 通知服务

### 3.2 应用层 (`app/application`)

| 模块 | 职责 |
|------|------|
| `mobile_facade.py` | 移动端适配的API门面 |
| `rag_service.py` | RAG检索增强生成服务封装 |

### 3.3 领域层 (`app/domain`)

遵循DDD有界上下文设计：

| 模块 | 核心概念 |
|------|----------|
| `agents.py` | 智能体编排与调度 |
| `herb_ports.py` | 中药数据端口接口 |
| `knowledge.py` | 知识图谱核心实体与关系 |
| `rag.py` | 检索增强生成领域逻辑 |
| `sensory.py` | 感官评价体系 |
| `digital_twin.py` | 数字孪生配方建模 |
| `registration.py` | 配方注册与备案流程 |

### 3.4 核心层 (`app/core`)

#### AI基础设施 (`ai_infra`)
- `ai_models.py`: AI模型注册表
- `ai_rate_limiter.py`: 请求限流保护
- `ai_exceptions.py`: AI异常类型定义

#### 数据库 (`database`)
- `database.py`: SQLAlchemy会话工厂
- `database_router.py`: 读写分离路由
- `database_pool.py`: 连接池配置
- `query_optimizer.py`: SQL查询优化器
- `data_masking.py`: 数据脱敏保护
- `init_db`: 初始化管理

#### 合规性 (`compliance`)
- `cdc_listener.py`: CDC变更数据捕获
- `gdpr_compliance.py`: GDPR合规策略
- `migration_audit.py`: 迁移审计
- `backup_and_recovery.py`: 备份恢复机制

#### API框架 (`api_framework`)
- 自定义FastAPI扩展框架：自动文档、分页、集成扩展、懒加载模块等

#### 中间件 (`middleware`)
- `audit_system.py`: 审计日志记录
- `encoding.py`: 编码处理
- `error_handler.py`: 全局错误处理
- `exceptions.py`: 自定义异常

### 3.5 基础设施层 (`app/infrastructure`)

提供具体实现：
- 数据库仓储实现
- 第三方服务集成（OpenFoodFacts, S3存储等）
- 消息队列适配器
- 文件系统访问层

### 3.6 数据层 (`app/data`)

| 目录 | 内容 |
|------|------|
| `schemas/` | Pydantic数据验证模型 |
| `models/` | SQLAlchemy ORM模型 |
| `utils/` | 工具函数、字符串处理、时间戳格式化等 |

---

## 四、前端模块详解 (`frontend`)

### 4.1 技术栈概览

| 类别 | 技术选型 |
|------|----------|
| **框架** | React 19 + TypeScript |
| **构建工具** | Vite |
| **UI库** | Ant Design 6 |
| **状态管理** | Zustand + React Query |
| **路由** | React Router 7 |
| **表单处理** | 未明确（可能使用 Formik或React Hook Form）|
| **国际化** | i18next + react-i18next |
| **图表** | Recharts + D3.js |
| **拖拽** | dnd-kit |
| **动画** | Framer Motion |
| **监控** | Sentry |
| **测试** | Vitest + Playwright E2E |

### 4.2 前端源码结构 (`frontend/src`)

根据Git状态显示，主要修改集中在：

| 路径 | 说明 |
|------|------|
| `/src/components/database/graph/` | 知识图谱可视化组件 |
| `/src/components/import/` | 数据导入界面组件 |
| `/src/hooks/useImportEngine.ts` | 导入引擎Hook |
| `/src/api/import.ts` | Import API封装 |

### 4.3 核心功能模块推测

1. **配方工作台** - 配方编辑与可视化设计
2. **AI实验控制台** - 参数配置、结果分析
3. **知识图谱浏览器** - 图谱节点探索与关系查询
4. **数据导入面板** - CSV/Excel批量导入支持
5. **多租户仪表盘** - 不同企业的隔离视图
6. **移动端适配界面** - 响应式设计

---

## 五、数据库与持久化

### 5.1 数据库技术

- **主数据库**: PostgreSQL
- **向量数据库**: pgvector (已启用，见 migration 20260720)
- **缓存层**: Redis (潜在，用于会话和查询缓存)
- **文件存储**: 本地文件系统 + 可能S3兼容对象存储

### 5.2 关键数据库特性

| 特性 | 说明 |
|------|------|
| **行级安全 (RLS)** | 已在迁移中添加 (`add_rls_policies`) |
| **全文搜索** | 支持JSONB字段上的GIN索引 |
| **软删除** | 通过is_deleted标记实现 |
| **审计字段** | created_by, updated_by, created_at, updated_at |
| **UUID主键** | 全系统使用UUID作为主键 |

### 5.3 重要数据表域（基于文件名推断）

```
herbs (中药材)
formulas (配方)
ingredients (成分)
peptides (肽段)
knowledge_graph (图谱实体关系)
open_food_facts (外部食品数据)
pantry ( pantry库存)
organizations (组织)
teams (团队)
users (用户)
audit_logs (审计日志)
```

---

## 六、AI与机器学习能力

### 6.1 AI能力矩阵

| 能力模块 | 技术实现 | 功能用途 |
|----------|----------|----------|
| **配方生成** | LLM + Prompt Engineering | 基于输入条件自动生成配方建议 |
| **配方优化** | 遗传算法 (MOGA?) | 多目标配方参数优化 |
| **知识检索** | RAG + pgvector | 语义搜索、知识图谱问答 |
| **实验分析** | Peptide Analysis | 肽段性质预测与分析 |
| **推荐系统** | Collaborative Filtering | 个性化配方推荐 |
| **语音交互** | Websocket Chat | AI聊天助手 |

### 6.2 Ray集群支持 (`core/distributed/ray_manager.py`)

- 分布式计算任务编排
- AI训练任务调度
- 平行计算支持（如MOGA多目标优化）

---

## 七、DevOps与工程实践

### 7.1 开发工具链

```
uv (Python包管理器)   ← 替代pip/poetry
Vite (前端构建)         ← 替代Webpack
ESLint + Prettier       ← 代码风格检查
Vitest (单元测试)       ← 替代Jest
Playwright (E2E测试)    ← 端到端测试自动化
Alembic (DB迁移)       ← 数据库版本控制
```

### 7.2 CI/CD流水线

从 `.github/` 目录可见存在GitHub Actions工作流（需进一步查看具体配置）

Docker支持完整：
- `Dockerfile.backend`
- `Dockerfile.frontend`
- `docker-compose.prod.yml`

### 7.3 测试覆盖率

- **总体覆盖率**: 报告示7月16日生成，覆盖2.2MB（可能是coverage.xml）
- **单元测试**: pytest框架，tests目录完整
- **E2E测试**: Playwright脚本
- **API测试**: 专门test_api_endpoints等脚本

---

## 八、近期开发重点（根据Git提交历史）

基于`git status`显示的修改，当前正在推进的功能：

1. **知识库图谱功能** (`graph/`目录大量修改)
   - 重构知识图谱可视化组件
   - 减少主文件体积至813行（PR优化中）
   - Context菜单、布局面板、类型定义完善

2. **数据导入功能** (`import_router.py`, `import_schema.py`, `import_engine/`)
   - OpenFoodFacts CSV导入支持
   - 前端导入组件（`import/`）
   - 导入引擎服务层

3. **安全加固** (`security-hardening`分支)
   - 添加行级安全策略 (RLS)
   - 数据加密/脱敏

---

## 九、依赖关系图谱

```
Frontend → REST API ← Backend
     │            │
     │            ├─→ PostgreSQL (核心数据)
     │            │       └─→ pgvector (向量检索)
     │            │
     │            ├─→ File Storage (配方文件、实验数据)
     │            │
     │            ├─→ Redis/Celery (异步任务队列)
     │            │
     │            └─→ External APIs (OpenFoodFacts, Google Maps?)
     │
     ├─→ Sentry (错误监控)
     └─→ i18next (多语言支持)
```

---

## 十、风险与建议

### 10.1 已知风险

| 风险等级 | 问题描述 | 影响范围 |
|----------|----------|----------|
| ⚠️ HIGH | 代码库规模庞大，单文件过长（如GraphPanelLayout.tsx被重构前超1000行） | 可维护性 |
| ⚠️ HIGH | AI模块耦合度高，ray_manager与多个ai_modules直接依赖 | 架构稳定性 |
| ⚠️ MEDIUM | 多处使用了动态类型检查，严格类型约束有待加强 | 代码质量 |
| ⚠️ MEDIUM | 数据库迁移数量过多（约40+），合并策略需考虑 | 数据库演化 |

### 10.2 改进建议

1. **模块化拆分**：将大型AI模块拆分为独立的微服务或插件
2. **引入CQRS**：针对读多写少的场景（如知识图谱查询）采用命令查询职责分离
3. **测试覆盖**：目前估计测试覆盖率在可接受范围，但需要达到80%基准线
4. **文档补充**：缺失完整的API文档和架构图
5. **安全审查**：建议进行第三方安全审计（特别涉及AI生成和数据处理）

---

## 附录：相关文件清单

| 路径 | 大小 | 备注 |
|------|------|------|
| `main.py` | ~24KB | 应用入口 |
| `README.md` | ~42KB | 项目主文档 |
| `requirements.txt` | ~1.7KB | 生产依赖 |
| `alembic/` | 40+迁移文件 | 数据库演化历史 |
| `docs/` | 各类文档 | ADR、指南、报告 |
| `deploy/` | 部署脚本 | 生产部署配置 |

---

> **文档说明**: 本报告基于对项目代码基座的静态分析生成，反映截至2026-07-27的项目状态。建议结合运行时的API端点列表和用户手册进行完整验证。