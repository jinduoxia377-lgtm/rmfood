---

## 3. 架构深度解析（院士级评审）

**评审级别**：院士级专家评审  
**评审日期**：2026-08-10  
**分析对象**：`D:\RMFOODFP` 全量代码库

---

### 3.1 项目总体概述

RMFOOD（Recipe Management for Optimal Organic Design）是一个**面向药食同源功能性食品的 AI 驱动配方设计平台**，聚焦于食品研发的全流程数字化。项目集成了神经网络配方生成、多目标优化算法、肽序列设计、LLM 对话系统、知识图谱、实验数据管理等核心能力，为食品研发团队提供一站式解决方案。

#### 技术栈总览

| 层级 | 技术 | 版本 |
|------|------|------|
| 前端框架 | React | 19.2.4 |
| 构建工具 | Vite | 8.0.10 |
| 类型系统 | TypeScript | 5.7.3（strict mode） |
| 样式方案 | Tailwind CSS | 4.1.8 |
| 状态管理 | Zustand | 5.x |
| 后端框架 | FastAPI | 0.115.0 |
| ORM | SQLAlchemy | 2.0.35（async） |
| 主数据库 | PostgreSQL | 16 Alpine |
| 缓存/消息队列 | Redis | 7 Alpine |
| 搜索引擎 | Elasticsearch（可选）+ PostgreSQL FTS | - |
| 向量数据库 | ChromaDB（RAG） | - |
| 知识图谱 | Neo4j（可选） | - |
| 监控 | Prometheus + Grafana | - |
| 分布式计算 | Ray | 集群管理 |

---

### 3.2 整体架构分层

项目采用**分层模块化架构（Layered Modular Architecture）**，清晰划分以下核心层次：

```
┌─────────────────────────────────────────────────────────┐
│                 Frontend (React 19 + Vite 8)            │
│  Pages / Components / Hooks / Stores / API Clients     │
└────────────────────────┬────────────────────────────────┘
                         │ HTTP / WebSocket / SSE
┌────────────────────────▼────────────────────────────────┐
│                 Backend (FastAPI 0.115)                 │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐    │
│  │    API      │  │   Services   │  │    CQRS     │    │
│  │  (52路由)   │  │  (90+服务)   │  │  (Handler)  │    │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘    │
│         └─────────────────┼─────────────────┘          │
│                    ┌──────▼──────┐                    │
│                    │   Domain    │                    │
│                    │  (DDD领域层) │                    │
│                    └──────┬──────┘                    │
│         ┌─────────────────┼─────────────────┐        │
│    ┌────▼────┐    ┌──────▼──────┐    ┌────▼────┐   │
│    │  Core   │    │Infrastructure│    │  Models │   │
│    │(安全/可观测│   │ (事件总线/   │    │ (ORM模型)│   │
│    │/配置/RBAC)│   │  缓存/网关)   │    │         │   │
│    └─────────┘    └─────────────┘    └─────────┘   │
└─────────────────────────────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────┐
│                  Data & AI Layer                        │
│  PostgreSQL · Redis · ChromaDB · Neo4j · Elasticsearch  │
│  OpenFoodFacts · TCMSP · DFBP肽库 · PepINVENT引擎       │
└─────────────────────────────────────────────────────────┘
```

---

### 3.3 后端架构深度解析

#### 3.3.1 目录结构与分层设计

```
backend/app/
├── main.py                      # 应用入口 + 生命周期管理
├── api/                         # API 层（52个路由模块）
│   ├── v1/                      # V1 API 路由（27个路由文件）
│   ├── ai_modules/              # AI 模块路由
│   ├── db_modules/              # 数据库管理路由
│   ├── auth.py                  # 认证路由
│   ├── formulas.py              # 配方管理
│   ├── peptides.py              # 肽序列
│   ├── chat.py                  # AI对话
│   ├── knowledge_base.py        # 知识库
│   ├── knowledge_graph.py       # 知识图谱
│   └── ...（共52个路由文件）
├── domain/                      # DDD 领域层
│   ├── models/                  # 领域模型
│   ├── events/                  # 领域事件
│   ├── agents.py                # AI Agent 抽象
│   ├── rag.py                   # RAG 领域接口
│   ├── sensory.py               # 感官分析领域
│   ├── digital_twin.py          # 数字孪生
│   └── ...
├── services/                    # 业务服务层（90+服务文件）
│   ├── ai/                      # AI 核心服务
│   │   ├── algorithms/          # 优化算法（MCTS/SA/GA等）
│   │   ├── llm/                 # LLM 多提供商适配
│   │   ├── rag/                 # RAG 检索增强生成
│   │   ├── safety/              # 安全检测
│   │   ├── conversation/        # 对话服务
│   │   └── formula_optimizer.py # 配方优化器
│   ├── formula/                 # 配方服务（26个文件）
│   │   ├── synergy_engine.py    # 协同效应引擎
│   │   ├── taste_predictor.py   # 口感预测
│   │   ├── stability_predictor.py
│   │   └── multi_algorithm_orchestrator.py  # 多算法编排器
│   ├── peptide_analysis_v2/     # 肽分析引擎
│   ├── kg/                      # 知识图谱服务
│   ├── search/                  # 搜索服务（BM25+向量混合）
│   ├── openfoodfacts/           # OpenFoodFacts 数据同步
│   ├── sync/                    # 云端同步服务
│   ├── ml/                      # 机器学习服务
│   └── report/                  # 报告生成服务
├── core/                        # 核心基础设施
│   ├── config.py                # 多环境配置管理
│   ├── security/                # 7层纵深安全防护
│   ├── rbac/                    # RBAC 权限控制
│   ├── multi_tenant/            # 多租户隔离
│   ├── middleware/              # 中间件链
│   ├── observability/           # 可观测性（日志/指标/追踪）
│   ├── database/                # 数据库连接池管理
│   ├── distributed/             # 分布式（Ray集群管理）
│   ├── realtime/                # WebSocket 实时通信
│   ├── workflow/                # 工作流引擎
│   └── api_framework/           # API 框架扩展
├── infrastructure/              # 基础设施适配器
│   ├── event_bus.py             # Redis Streams 事件总线
│   ├── cache.py                 # 多级缓存
│   └── ...
├── models/                      # ORM 数据模型（38个模型文件）
├── schemas/                     # Pydantic 数据校验（17个）
├── cqrs/                        # CQRS 模式实现
│   ├── handlers/                # 事件处理器
│   └── queries/                 # 查询处理器
├── factories/                   # 工厂模式
├── utils/                       # 工具函数
└── websockets/                  # WebSocket 处理器
```

#### 3.3.2 关键架构模式

**（1）DDD（领域驱动设计）分层**
- **Domain 层**：定义核心业务实体（Formula、Peptide、Herb、Experiment 等）和领域事件
- **Application 层（Services）**：编排领域逻辑，实现具体业务用例
- **Infrastructure 层**：实现领域接口（事件总线、缓存、搜索适配器等）
- **Interface 层（API）**：处理 HTTP/WebSocket 协议，调用服务层

**（2）多算法融合优化架构**
- `multi_algorithm_orchestrator.py` 实现了**四种优化算法的并行编排**：
  - **NSGA-III**：多目标遗传算法（高维度帕累托前沿搜索）
  - **MOEA/D**：基于分解的多目标进化算法
  - **PSO**：粒子群优化算法
  - **SA**：模拟退火算法
- 支持并行执行（最多 4 并发）、结果融合（union/weighted/voting）、时间预算控制

**（3）CQRS 模式**
- `cqrs/` 目录实现了命令查询分离
- Commands → `handlers/event_handlers.py` 处理状态变更
- Queries → `queries/search.py` 和 `queries/service.py` 处理读取

**（4）事件驱动架构**
- **Redis Streams 事件总线**（`infrastructure/event_bus.py`）
- 支持领域事件发布/订阅
- 变更队列（`sync/change_queue.py`）实现实时同步

**（5）分布式计算**
- **Ray 集群管理**（`core/distributed/ray_manager.py`）
- 用于并行肽分析计算和大规模数据处理

---

### 3.4 AI/ML 智能引擎深度解析

#### 3.4.1 AI 服务目录结构

```
services/ai/
├── main.py                    # AI 服务入口
├── conversation_service.py     # 对话服务（v10.0）
├── formula_service.py          # 配方生成服务
├── formula_optimizer.py        # 配方优化服务
├── agent/                     # AI Agent 框架
├── algorithms/                # 核心算法
│   ├── mcts_solver.py         # 蒙特卡洛树搜索
│   ├── parallel_mcts_solver.py
│   ├── gradient_descent_optimizer.py
│   ├── simulated_annealing.py
│   └── constraint_solver.py
├── llm/                       # LLM 多提供商
│   ├── openai.py
│   ├── deepseek.py
│   ├── zhipu.py（智谱）
│   ├── tongyi.py（通义千问）
│   └── vllm.py（自定义端点）
├── rag/                       # RAG 检索增强
│   ├── rag_service.py         # ChromaDB 向量检索
│   ├── embedding_service.py
│   ├── document_processor.py
│   └── vector_store.py
├── prompts/                   # Prompt 工程管理（24模板/8场景/12维评估）
├── safety/                    # 安全检测
└── ...
```

#### 3.4.2 核心 AI 能力矩阵

| 能力 | 技术实现 | 模块路径 |
|------|----------|----------|
| 神经网络配方生成 | PyTorch Neural Network | `neural_formula_engine.py` |
| 多目标优化（4种算法融合） | NSGA-III/MOEA/D/PSO/SA | `multi_algorithm_orchestrator.py` |
| 肽序列设计 | PepINVENT 引擎 (RDKit+PyTorch) | `pepinvent_service.py` |
| 肽分析流水线 | 理化性质→二级结构→ADMET | `peptide_analysis_v2/` |
| LLM 对话（v10.0） | OpenAI/DeepSeek/智谱/通义/vLLM | `conversation_service.py` |
| RAG 检索增强 | ChromaDB + 语义检索 | `rag/` |
| 知识图谱推理 | Neo4j + 推理引擎 | `kg/reasoning_engine.py` |
| 口感预测 | 机器学习模型 | `taste_predictor.py` |
| 稳定性预测 | 预测模型 | `stability_model.py` |
| 协同效应分析 | 雷达成像 + 专利比对 | `synergy_engine.py` |
| 合规检查 | 中国食品法规引擎 | `compliance_engine_v2.py` |

---

### 3.5 数据层架构

#### 3.5.1 ORM 模型体系（38个模型）

核心模型包括：用户模型、组织模型、团队管理、配方核心模型（含多对多关联表）、肽分析记录、肽设计记录、实验记录（ELN）、知识图谱节点、TCMSP 中药 schema、DFBP 活性肽 schema、搜索索引、工作流定义、Prompt 管理等。

- **Alembic 迁移版本：16 个**（持续增强的 TCMSP 中药数据库 schema）
- 支持数据脱敏（`data_masking.py`）

#### 3.5.2 数据源集成

| 数据源 | 用途 | 同步方式 |
|--------|------|----------|
| OpenFoodFacts | 全球食品数据库 | ETL 定时同步（`openfoodfacts/loader_sync.py`） |
| TCMSP | 中药成分数据库 | Alembic 16版本增强 |
| DFBP | 食源性活性肽数据库 | 种子数据导入 |
| PepINVENT | 肽序列数据库 | API 适配器 |

---

### 3.6 前端架构深度解析

#### 3.6.1 目录结构

```
frontend/src/
├── App.tsx                    # 路由入口（react-router v7 + lazyWithPreload）
├── api/                       # API 客户端（24个模块）
├── components/                # UI 组件库（200+组件）
│   ├── ai/                    # AI 模块组件（130+文件）
│   │   ├── ChatTab.tsx        # 对话Tab（v10.0）
│   │   ├── GenerateTab.tsx    # 配方生成Tab
│   │   ├── SafetyTab.tsx      # 安全检测Tab
│   │   ├── SynergyTab.tsx     # 协同分析Tab
│   │   └── ...（130+ AI组件）
│   ├── layout/                # 布局组件
│   ├── charts/                # 图表组件（Recharts/D3）
│   └── ui/                    # 基础UI组件
├── pages/                     # 页面（16个一级目录，50+页面）
│   ├── ai/AIAssistantPage.tsx  # AI助手主页
│   ├── formula/               # 配方管理（7个页面）
│   ├── experiment/            # 实验管理（4个页面）
│   ├── academic/              # 学术报告生成
│   └── ...
├── stores/                    # Zustand Store（14个）
├── hooks/                     # 自定义Hooks（42个）
├── i18n/                      # 国际化（i18next 中英双语）
├── theme/                     # 主题系统（Design Token驱动）
└── design-system/             # MD3 Design Token
```

#### 3.6.2 懒加载策略

- 首屏关键页面（登录、仪表盘）**同步加载**
- 其他页面使用 `lazyWithPreload`（空闲时预加载）
- 大体积模块（图表/导出）**延迟加载**

---

### 3.7 安全体系（7层纵深防御）

```
┌─────────────────────────────────────┐
│  L7: 应用层安全                      │
│    - 输入验证与清洗 (InputSanitizer) │
│    - 输出编码 (防XSS)               │
│    - 敏感数据脱敏 (DataMasker)       │
├─────────────────────────────────────┤
│  L6: 认证与授权                      │
│    - JWT Token 验证                  │
│    - RBAC 5级角色权限                │
│    - 安全审计日志                    │
├─────────────────────────────────────┤
│  L5: 速率限制                        │
│    - 滑动窗口算法                    │
│    - IP/User/端点多维限制            │
│    - 自动黑名单机制                  │
├─────────────────────────────────────┤
│  L4: 数据保护                        │
│    - HSTS/CSP/X-Frame 安全头        │
│    - 请求体大小限制                  │
│    - 请求日志脱敏                    │
├─────────────────────────────────────┤
│  L3: 多租户隔离                      │
│    - TenantMiddleware                │
│    - 租户查询守卫 (tenant_query_guard)│
│    - 资源隔离策略                    │
├─────────────────────────────────────┤
│  L2: 传输层安全                      │
│    - TLS 配置                        │
│    - 安全上传 (secure_upload)        │
├─────────────────────────────────────┤
│  L1: 基础设施安全                    │
│    - Sentry 错误追踪                 │
│    - 数据库 SQL 安全过滤             │
└─────────────────────────────────────┘
```

---

### 3.8 部署架构（Docker Compose 5服务编排）

```yaml
services:
  postgres:16-alpine    # 主数据库
  backend               # FastAPI 应用
  frontend              # Nginx + Vite 构建产物
  nginx:1.25-alpine     # 反向代理（统一入口）
  redis:7-alpine        # 缓存 + 消息队列
  prometheus            # 指标采集
  grafana               # 监控仪表盘
```

---

### 3.9 项目规模统计

| 指标 | 数量 |
|------|------|
| 后端 Python 源文件 | **247 个** |
| 后端 API 路由模块 | **52 个** |
| 后端核心基础设施模块 | **48 个** |
| 后端 ORM 模型 | **38 个** |
| 后端 Pydantic Schema | **17 个** |
| 后端服务文件 | **90+** (13 子目录) |
| 前端 TypeScript/TSX 文件 | **839 个** |
| 前端页面组件 | **50+** (16 一级目录) |
| 前端 UI 组件 | **200+** (20 子目录，AI模块130+) |
| 前端 API 服务模块 | **24 个** |
| 前端自定义 Hooks | **42 个** |
| 前端 Zustand Store | **14 个** |
| 数据库 Alembic 迁移版本 | **16 个** |
| CI/CD Pipeline Jobs | **9 个** |

---

### 3.10 核心亮点与技术评价

#### 亮点

1. **AI 驱动的深度集成**：从 LLM 对话（v10.0）到多目标优化算法（NSGA-III/MOEA/D/PSO/SA）到肽序列设计（PepINVENT），AI 贯穿整个研发流程
2. **企业级架构**：多租户隔离、RBAC 5级权限、7层纵深安全、CQRS 模式、事件驱动架构
3. **工程化成熟**：TypeScript strict mode、完整测试体系、Prometheus+Grafana 可观测性
4. **国际化与无障碍**：i18next 中英双语、MD3 Design Token、WCAG AA 合规
5. **数据生态丰富**：OpenFoodFacts、TCMSP、DFBP、PepINVENT 多源数据集成

#### 潜在技术债务与建议

| 关注点 | 现状 | 建议 |
|--------|------|------|
| TypeScript 错误 | 140 个编译错误（持续修复中）| 建议设立阶段性清零目标 |
| AI 模块体积 | 前端 130+ AI 组件文件 | 考虑按功能域进一步微服务化 |
| 依赖版本激进 | Vite 8.x / React 19（前沿版）| 评估生产稳定性风险 |
| 代码图索引 | `.codegraph/` 已建立 | 建议持续维护索引质量 |

---

