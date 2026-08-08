# RMFOOD药食同源功能性食品专业配方研发平台 - 升级改造实施计划

**开发单位**: 莱茵(厦门)分子生物科技有限公司
**文档版本**: v1.0.0
**编写日期**: 2026-04-18
**文档状态**: 正式发布

---

## 第一部分：现状分析与升级目标

### 1.1 现有系统架构概述

RMFOOD配方平台目前采用前后端分离架构，后端基于FastAPI + SQLAlchemy，前端基于React 19 + TypeScript + Vite。系统已实现以下核心功能：

| 模块 | 功能状态 | 技术实现 |
|------|----------|----------|
| 用户认证 | ✅ 已完成 | JWT + pydantic-settings |
| 配方管理 | ✅ 已完成 | CRUD + 状态流转 + 版本管理 |
| 实验管理 | ✅ 已完成 | CRUD + 数据采集 |
| AI基础服务 | ⚠️ 部分完成 | SafetyChecker + AI对话 |
| 数据库检索 | ⚠️ 部分完成 | TCMSP + DFBP数据接入 |
| 通知系统 | ✅ 已完成 | WebSocket + 轮询 |
| 权限管理 | ✅ 已完成 | RBAC 五角色 |

### 1.2 现存问题与升级需求

#### 1.2.1 架构层面

| 问题 | 严重性 | 影响 | 解决方案 |
|------|--------|------|----------|
| 后端单体架构 | 中 | 扩展性受限 | 预留微服务拆分接口 |
| 数据库使用SQLite | 高 | 数据安全与并发 | 预留PostgreSQL迁移 |
| 缺少缓存层 | 中 | 性能受限 | Redis集成 |
| 缺少图数据库 | 中 | 知识图谱受限 | Neo4j集成预留 |

#### 1.2.2 功能层面

| 问题 | 严重性 | 影响 | 解决方案 |
|------|--------|------|----------|
| 配方审核流程简化 | 高 | 业务不规范 | 三级审批机制 |
| 功效评估体系缺失 | 高 | 无法验证功效 | 功效评估指标库 |
| 工作流引擎基础 | 中 | 自动化受限 | BPMN工作流设计 |
| 知识图谱可视化 | 中 | 数据关联弱 | Neo4j可视化 |
| 数据分析报表缺失 | 中 | 管理决策受限 | 驾驶舱+自定义报表 |

#### 1.2.3 质量层面

| 问题 | 严重性 | 影响 | 解决方案 |
|------|--------|------|----------|
| 缺少单元测试 | 高 | 代码质量风险 | pytest + pytest-asyncio |
| 缺少集成测试 | 高 | 系统集成风险 | httpx + TestClient |
| 缺少E2E测试 | 中 | 端到端质量 | Playwright |
| 缺少性能测试 | 中 | 生产性能风险 | Locust + k6 |
| 文档不完整 | 中 | 维护困难 | 完善文档体系 |

### 1.3 升级目标

#### 1.3.1 总体目标

基于补全方案文档，全面升级RMFOOD平台，达成以下目标：

1. **功能完备性**: 实现补全方案中的所有核心功能模块
2. **架构合理性**: 优化系统架构，支持未来微服务拆分
3. **质量可靠性**: 建立完整的测试体系，确保系统稳定
4. **性能优越性**: 优化系统性能，满足生产环境需求
5. **安全合规性**: 建立数据安全与合规保障体系

#### 1.3.2 量化指标

| 指标类别 | 指标名称 | 当前值 | 目标值 |
|----------|----------|--------|--------|
| 功能 | 配方审核流程完备度 | 60% | 100% |
| 功能 | AI服务覆盖率 | 40% | 90% |
| 功能 | 功效评估指标覆盖率 | 0% | 85% |
| 质量 | 单元测试覆盖率 | 0% | 70% |
| 质量 | API集成测试通过率 | 0% | 95% |
| 性能 | API平均响应时间 | 200ms | <100ms |
| 性能 | 前端首屏加载时间 | 3s | <1.5s |
| 安全 | 权限控制完备度 | 80% | 100% |
| 安全 | 数据加密覆盖率 | 50% | 100% |

---

## 第二部分：分阶段升级计划

### 2.1 总体实施路线图

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                          RMFOOD平台升级改造路线图                                     │
├─────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                     │
│  Phase 1: 基础平台升级 (3个月)                                                     │
│  ┌─────────────────────────────────────────────────────────────────────────────┐   │
│  │ M1.1 数据模型优化     │ M1.2 API重构      │ M1.3 权限系统增强  │ M1.4 测试体系│   │
│  │ ─────────────────── │ ───────────────── │ ───────────────── │ ────────── │   │
│  │ • 模型拆分           │ • 统一响应格式     │ • ABAC增强       │ • pytest   │   │
│  │ • 索引优化           │ • 错误处理统一    │ • 数据权限       │ • 集成测试 │   │
│  │ • 约束完整性         │ • 限流机制        │ • 审计日志增强   │ • 性能基准 │   │
│  └─────────────────────────────────────────────────────────────────────────────┘   │
│                                      │                                                │
│                                      ▼                                                │
│  Phase 2: AI能力集成 (6个月)                                                        │
│  ┌─────────────────────────────────────────────────────────────────────────────┐   │
│  │ M2.1 数据库增强     │ M2.2 知识图谱      │ M2.3 AI服务集成   │ M2.4 智能推荐│   │
│  │ ─────────────────── │ ───────────────── │ ───────────────── │ ────────── │   │
│  │ • TCMSP深度整合     │ • Neo4j图谱构建   │ • FormulaGPT     │ • 配方生成  │   │
│  │ • DFBP增强检索      │ • 实体关系抽取    │ • SynergyNet     │ • 功效预测  │   │
│  │ • 全文检索ES集成     │ • 可视化界面      │ • PeptideScorer  │ • 智能优化  │   │
│  └─────────────────────────────────────────────────────────────────────────────┘   │
│                                      │                                                │
│                                      ▼                                                │
│  Phase 3: 高级功能建设 (9个月)                                                       │
│  ┌─────────────────────────────────────────────────────────────────────────────┐   │
│  │ M3.1 功效评估体系  │ M3.2 工作流引擎    │ M3.3 数据分析     │ M3.4 安全合规│   │
│  │ ─────────────────│ ───────────────── │ ───────────────── │ ────────── │   │
│  │ • 指标库建设       │ • BPMN流程设计     │ • 管理驾驶舱      │ • 等保三级  │   │
│  │ • 评估模型建立     │ • 审批流自动化     │ • 自定义报表      │ • 数据加密  │   │
│  │ • 报告自动生成     │ • 任务调度         │ • 数据导出        │ • 安全审计  │   │
│  └─────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                     │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

### 2.2 Phase 1: 基础平台升级（3个月）

#### 2.2.1 阶段目标

| 目标类别 | 具体目标 | 验收标准 |
|----------|----------|----------|
| 数据模型 | 模型拆分与优化 | 每个模型独立文件、完整索引 |
| API规范 | 统一响应与错误处理 | RESTful规范、标准化错误码 |
| 权限系统 | ABAC权限增强 | 数据层级权限控制 |
| 测试体系 | 单元+集成测试 | 覆盖率≥70%、通过率≥95% |
| 性能 | 响应时间优化 | 平均响应时间降低50% |

#### 2.2.2 M1.1: 数据模型优化

**任务清单**:

| 任务 | 负责人 | 工时 | 交付物 |
|------|--------|------|--------|
| T1.1.1 模型文件拆分 | 后端开发 | 5天 | models/user.py, models/formula.py等 |
| T1.1.2 添加数据库索引 | 后端开发 | 3天 | 索引脚本、索引说明文档 |
| T1.1.3 约束完整性增强 | 后端开发 | 5天 | 约束定义文档、更新验证逻辑 |
| T1.1.4 外键与关系优化 | 后端开发 | 3天 | 关系图 ER Diagram |
| T1.1.5 数据迁移脚本 | 后端开发 | 5天 | 迁移脚本、rollback脚本 |

**实施步骤**:

1. 分析现有models.py文件，识别可拆分的模型
2. 创建models/目录，按领域拆分模型文件
3. 为高频查询字段添加索引
4. 增强约束验证（唯一约束、外键约束、检查约束）
5. 编写数据迁移脚本并测试

**技术方案**:

```python
# models/formula.py
from sqlalchemy import Index
from app.models.base import Base

class Formula(Base):
    __tablename__ = "formulas"
    __table_args__ = (
        Index('idx_formula_status', 'status'),
        Index('idx_formula_creator', 'creator_id'),
        Index('idx_formula_created', 'created_at'),
        Index('idx_formula_code', 'code', unique=True),
    )
```

#### 2.2.3 M1.2: API重构

**任务清单**:

| 任务 | 负责人 | 工时 | 交付物 |
|------|--------|------|--------|
| T1.2.1 统一响应格式 | 后端开发 | 3天 | ApiResponse类、示例代码 |
| T1.2.2 标准化错误码 | 后端开发 | 3天 | ErrorCode枚举、错误处理中间件 |
| T1.2.3 API版本控制 | 后端开发 | 2天 | v1路由组、版本迁移策略 |
| T1.2.4 限流机制 | 后端开发 | 3天 | 限流中间件、配置项 |
| T1.2.5 API文档增强 | 后端开发 | 2天 | OpenAPI扩展、示例数据 |

**技术方案**:

```python
# app/core/response.py
from typing import Generic, TypeVar, Optional
from pydantic import BaseModel

T = TypeVar('T')

class ApiResponse(BaseModel, Generic[T]):
    success: bool = True
    data: Optional[T] = None
    message: Optional[str] = None
    error: Optional[str] = None
    code: int = 200

class PaginatedResponse(BaseModel, Generic[T]):
    items: list[T]
    total: int
    page: int
    page_size: int
    total_pages: int
```

```python
# app/core/exceptions.py
from enum import Enum

class ErrorCode(str, Enum):
    VALIDATION_ERROR = "E1001"
    AUTHENTICATION_FAILED = "E2001"
    PERMISSION_DENIED = "E3001"
    RESOURCE_NOT_FOUND = "E4001"
    FORMULA_REVIEW_FAILED = "E5001"
    # ... 更多错误码
```

#### 2.2.4 M1.3: 权限系统增强

**任务清单**:

| 任务 | 负责人 | 工时 | 交付物 |
|------|--------|------|--------|
| T1.3.1 ABAC策略引擎 | 后端开发 | 5天 | PolicyEngine类、策略配置 |
| T1.3.2 数据层级权限 | 后端开发 | 5天 | check_data_access函数 |
| T1.3.3 审计日志增强 | 后端开发 | 3天 | 完整审计字段、日志查询API |
| T1.3.4 敏感操作二次验证 | 后端开发 | 3天 | 二次验证中间件 |
| T1.3.5 权限测试用例 | 测试工程师 | 3天 | 权限测试用例集 |

**技术方案**:

```python
# app/core/permission.py
class PermissionChecker:
    """ABAC权限检查器"""
    async def check_access(
        self,
        user: User,
        resource_type: str,
        resource_id: int,
        action: str
    ) -> bool:
        # 获取资源
        resource = await self._get_resource(resource_type, resource_id)

        # 检查属性
        attributes = {
            "user.role": user.role,
            "user.department": user.department,
            "resource.creator_id": resource.creator_id,
            "resource.team_id": resource.team_id,
            "resource.classification": resource.classification,
        }

        # 评估策略
        return self.policy_engine.evaluate(user, action, attributes)
```

#### 2.2.5 M1.4: 测试体系建设

**任务清单**:

| 任务 | 负责人 | 工时 | 交付物 |
|------|--------|------|--------|
| T1.4.1 pytest配置 | 后端开发 | 2天 | pytest.ini、conftest.py |
| T1.4.2 单元测试框架 | 后端开发 | 5天 | fixtures、mock工具 |
| T1.4.3 API集成测试 | 后端开发 | 8天 | TestClient测试用例 |
| T1.4.4 性能基准测试 | 后端开发 | 3天 | 性能测试脚本、基准数据 |
| T1.4.5 测试覆盖率配置 | 后端开发 | 2天 | .coveragerc、CI集成 |

**技术方案**:

```ini
# pytest.ini
[pytest]
testpaths = tests
python_files = test_*.py
python_functions = test_*
asyncio_mode = auto
addopts =
    --strict-markers
    --cov=app
    --cov-report=term-missing
    --cov-report=html
    --cov-fail-under=70
markers =
    slow: marks tests as slow
    integration: marks tests as integration tests
```

```python
# tests/conftest.py
import pytest
from httpx import AsyncClient, ASGITransport
from app.main import app

@pytest.fixture
async def client():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac

@pytest.fixture
async def auth_headers(client):
    response = await client.post("/api/v1/auth/login", json={
        "username": "admin",
        "password": "admin123"
    })
    token = response.json()["data"]["access_token"]
    return {"Authorization": f"Bearer {token}"}
```

### 2.3 Phase 2: AI能力集成（6个月）

#### 2.3.1 阶段目标

| 目标类别 | 具体目标 | 验收标准 |
|----------|----------|----------|
| 数据检索 | 全文检索能力 | ES集成、毫秒级响应 |
| 知识图谱 | 图数据库集成 | Neo4j存储、关系查询 |
| AI服务 | 六大AI模型集成 | FormulaGPT/SynergyNet/PeptideScorer上线 |
| 智能推荐 | 配方智能生成 | 候选配方生成、功效预测 |

#### 2.3.2 M2.1: 数据库增强

**任务清单**:

| 任务 | 负责人 | 工时 | 交付物 |
|------|--------|------|--------|
| T2.1.1 ES集群部署 | 运维工程师 | 5天 | ES集群、索引模板 |
| T2.1.2 数据同步管道 | 后端开发 | 10天 | ETL脚本、同步监控 |
| T2.1.3 全文检索API | 后端开发 | 8天 | 检索接口、分词器配置 |
| T2.1.4 检索界面优化 | 前端开发 | 5天 | 高级筛选、聚合统计 |

#### 2.3.3 M2.2: 知识图谱

**任务清单**:

| 任务 | 负责人 | 工时 | 交付物 |
|------|--------|------|--------|
| T2.2.1 Neo4j集群部署 | 运维工程师 | 5天 | Neo4j集群、备份策略 |
| T2.2.2 图谱数据模型 | 后端开发 | 8天 | 节点类型定义、关系类型 |
| T2.2.3 图谱构建服务 | 后端开发 | 15天 | 数据导入、增量更新 |
| T2.2.4 可视化界面 | 前端开发 | 10天 | 力导向图、路径探索 |

#### 2.3.4 M2.3: AI服务集成

**任务清单**:

| 任务 | 负责人 | 工时 | 交付物 |
|------|--------|------|--------|
| T2.3.1 vLLM部署 | 运维工程师 | 5天 | vLLM集群、模型管理 |
| T2.3.2 FormulaGPT集成 | 后端开发 | 15天 | 配方生成API、prompt模板 |
| T2.3.3 SynergyNet集成 | 后端开发 | 15天 | 协同分析API |
| T2.3.4 PeptideScorer集成 | 后端开发 | 10天 | 活性预测API |
| T2.3.5 AI任务队列 | 后端开发 | 8天 | Celery任务、异步处理 |

#### 2.3.5 M2.4: 智能推荐

**任务清单**:

| 任务 | 负责人 | 工时 | 交付物 |
|------|--------|------|--------|
| T2.4.1 配方生成工作流 | 后端开发 | 10天 | 多阶段推理流程 |
| T2.4.2 功效预测模型 | 后端开发 | 15天 | 功效评分API |
| T2.4.3 推荐界面优化 | 前端开发 | 8天 | 生成结果展示、优化建议 |
| T2.4.4 推荐效果评估 | 全栈 | 5天 | 评估指标、AB测试 |

### 2.4 Phase 3: 高级功能建设（9个月）

#### 2.4.1 阶段目标

| 目标类别 | 具体目标 | 验收标准 |
|----------|----------|----------|
| 功效评估 | 评估体系建成 | 8大类功效指标覆盖 |
| 工作流 | BPMN流程引擎 | 可视化流程设计、自动化审批 |
| 数据分析 | 管理驾驶舱 | 核心指标可视化、自定义报表 |
| 安全合规 | 等保三级认证 | 安全测评通过 |

#### 2.4.2 M3.1: 功效评估体系

**任务清单**:

| 任务 | 负责人 | 工时 | 交付物 |
|------|--------|------|--------|
| T3.1.1 功效指标库 | 业务专家 | 20天 | 指标定义、评估标准 |
| T3.1.2 评估模型建立 | 算法工程师 | 30天 | 评估算法、权重配置 |
| T3.1.3 评估报告生成 | 后端开发 | 15天 | 报告模板、PDF导出 |
| T3.1.4 评估界面 | 前端开发 | 10天 | 评估向导、结果展示 |

#### 2.4.3 M3.2: 工作流引擎

**任务清单**:

| 任务 | 负责人 | 工时 | 交付物 |
|------|--------|------|--------|
| T3.2.1 流程设计器 | 前端开发 | 20天 | 可视化拖拽设计 |
| T3.2.2 流程引擎 | 后端开发 | 25天 | BPMN执行、状态管理 |
| T3.2.3 审批组件 | 前端开发 | 10天 | 审批界面、加签转交 |
| T3.2.4 任务调度 | 后端开发 | 10天 | Cron任务、超时提醒 |

#### 2.4.4 M3.3: 数据分析

**任务清单**:

| 任务 | 负责人 | 工时 | 交付物 |
|------|--------|------|--------|
| T3.3.1 管理驾驶舱 | 前端开发 | 15天 | 数据大屏、ECharts |
| T3.3.2 自定义报表 | 前端开发 | 20天 | 报表设计器、图表配置 |
| T3.3.3 数据导出 | 后端开发 | 8天 | Excel/PDF导出 |
| T3.3.4 定时推送 | 后端开发 | 5天 | 邮件推送、订阅配置 |

#### 2.4.5 M3.4: 安全合规

**任务清单**:

| 任务 | 负责人 | 工时 | 交付物 |
|------|--------|------|--------|
| T3.4.1 安全加固 | 安全工程师 | 20天 | 安全评估报告、整改清单 |
| T3.4.2 数据加密 | 后端开发 | 15天 | 敏感字段加密、密钥轮换 |
| T3.4.3 等保测评 | 第三方测评 | 30天 | 等保三级证书 |
| T3.4.4 安全培训 | 安全工程师 | 10天 | 安全开发规范、意识培训 |

---

## 第三部分：代码重构计划

### 3.1 后端代码重构

#### 3.1.1 目录结构重构

**目标结构**:

```
backend/app/
├── __init__.py
├── main.py
├── api/
│   ├── __init__.py
│   ├── v1/
│   │   ├── __init__.py
│   │   ├── router.py
│   │   ├── auth/
│   │   ├── formulas/
│   │   ├── experiments/
│   │   ├── ai/
│   │   ├── database/
│   │   ├── admin/
│   │   └── common/
│   └── deps.py
├── core/
│   ├── __init__.py
│   ├── config.py
│   ├── database.py
│   ├── response.py
│   ├── exceptions.py
│   ├── permission.py
│   ├── pagination.py
│   └── security.py
├── models/
│   ├── __init__.py
│   ├── base.py
│   ├── user.py
│   ├── formula.py
│   ├── experiment.py
│   ├── database/
│   └── workflow.py
├── schemas/
│   ├── __init__.py
│   ├── user.py
│   ├── formula.py
│   ├── experiment.py
│   └── common.py
├── services/
│   ├── __init__.py
│   ├── auth.py
│   ├── formula.py
│   ├── experiment.py
│   ├── ai/
│   └── tasks/
├── utils/
│   ├── __init__.py
│   ├── validators.py
│   ├── formatters.py
│   └── constants.py
├── middleware/
│   ├── __init__.py
│   ├── logging.py
│   ├── rate_limit.py
│   └── security.py
└── exceptions/
    ├── __init__.py
    ├── base.py
    ├── auth.py
    └── business.py
```

**重构原则**:

1. **单一职责**: 每个模块只负责一个功能领域
2. **依赖注入**: 使用FastAPI的Depends进行依赖管理
3. **接口隔离**: API层只暴露必要的接口，内部实现可替换
4. **测试可测**: 每个模块都可以独立进行单元测试

#### 3.1.2 重构任务分解

| 任务 | 工时 | 风险 | 缓解措施 |
|------|------|------|----------|
| 创建新目录结构 | 2天 | 低 | - |
| 拆分models.py | 5天 | 中 | 保留迁移脚本 |
| 重构API路由 | 10天 | 中 | 逐步迁移、保持兼容 |
| 提取公共服务 | 5天 | 低 | - |
| 更新依赖注入 | 3天 | 中 | 单元测试验证 |
| 删除旧文件 | 2天 | 低 | 备份后删除 |

### 3.2 前端代码重构

#### 3.2.1 目录结构重构

**目标结构**:

```
frontend/src/
├── __tests__/
│   ├── setup.ts
│   ├── unit/
│   └── integration/
├── api/
│   ├── index.ts
│   ├── client.ts
│   ├── auth.ts
│   ├── core/
│   └── features/
├── components/
│   ├── ui/
│   ├── layout/
│   ├── features/
│   │   ├── formula/
│   │   ├── experiment/
│   │   ├── database/
│   │   └── common/
│   └── common/
├── constants/
│   ├── index.ts
│   ├── routes.ts
│   └── ui.ts
├── hooks/
│   ├── useAuth.ts
│   ├── useForm.ts
│   └── useQuery.ts
├── lib/
│   ├── utils.ts
│   └── validators.ts
├── pages/
│   └── [feature]/
├── stores/
├── types/
│   └── index.ts
├── App.tsx
└── main.tsx
```

#### 3.2.2 组件库优化

| 任务 | 工时 | 交付物 |
|------|------|--------|
| 统一Button组件 | 2天 | Button.tsx |
| 优化表单组件 | 5天 | Form组件族 |
| 增强表格组件 | 5天 | Table.tsx |
| 添加图表组件 | 8天 | Chart组件 |
| 完善文档 | 3天 | Storybook |

### 3.3 性能优化

#### 3.3.1 后端性能优化

| 优化项 | 当前 | 目标 | 方案 |
|--------|------|------|------|
| 数据库查询 | 200ms | <50ms | 索引+N+1查询优化 |
| API响应 | 200ms | <100ms | 缓存+异步处理 |
| 并发能力 | 100 req/s | 500 req/s | 连接池+限流 |

#### 3.3.2 前端性能优化

| 优化项 | 当前 | 目标 | 方案 |
|--------|------|------|------|
| 首屏加载 | 3s | <1.5s | 代码分割+懒加载 |
| 运行时性能 | 60fps | 60fps | React Profiler优化 |
| 包大小 | 500KB | <300KB | Tree shaking+压缩 |

---

## 第四部分：数据迁移方案

### 4.1 迁移原则

1. **兼容性优先**: 保持新旧系统数据格式兼容
2. **可回滚**: 每次迁移都有回滚方案
3. **增量迁移**: 支持增量同步，减少停机时间
4. **可验证**: 迁移后进行数据校验

### 4.2 迁移计划

#### 4.2.1 用户数据迁移

```python
# migrations/user_migration.py
async def migrate_users():
    """用户数据迁移"""
    # 1. 导出旧数据
    old_users = await old_db.execute(select(OldUser))

    # 2. 转换数据格式
    new_users = []
    for old_user in old_users:
        new_user = {
            "id": old_user.id,
            "username": old_user.username,
            "email": old_user.email,
            "hashed_password": old_user.password_hash,  # 需要重新哈希
            "full_name": old_user.fullname,
            "role": convert_role(old_user.user_type),
            "department": old_user.dept,
            "created_at": old_user.create_time,
        }
        new_users.append(new_user)

    # 3. 批量导入
    for batch in chunked(new_users, 1000):
        await new_db.execute(insert(User), batch)

    # 4. 校验
    old_count = await old_db.scalar(select(func.count(OldUser.id)))
    new_count = await new_db.scalar(select(func.count(User.id)))
    assert old_count == new_count, f"用户数量不一致: {old_count} vs {new_count}"
```

#### 4.2.2 配方数据迁移

```python
# migrations/formula_migration.py
async def migrate_formulas():
    """配方数据迁移"""
    # 1. 迁移配方主数据
    old_formulas = await old_db.execute(select(OldFormula))

    for old_formula in old_formulas:
        new_formula = Formula(
            id=old_formula.id,
            name=old_formula.formula_name,
            code=old_formula.formula_code,
            description=old_formula.desc,
            status=convert_formula_status(old_formula.state),
            version=old_formula.version or 1,
            target_effects=json.loads(old_formula.effects or "[]"),
            composition=json.loads(old_formula.composition or "{}"),
            creator_id=old_formula.creator_id,
            created_at=old_formula.create_time,
        )
        await new_db.execute(insert(Formula), [new_formula.__dict__])

    # 2. 迁移配方版本
    old_versions = await old_db.execute(select(OldFormulaVersion))
    # ... 类似处理

    # 3. 迁移关联数据
    await migrate_formula_ingredients()
    await migrate_formula_peptides()
```

### 4.3 迁移验证

| 验证项 | 方法 | 标准 |
|--------|------|------|
| 数据完整性 | 行数对比 | 100%一致 |
| 数据准确性 | 抽样校验 | 抽样100条，误差率<0.1% |
| 关联完整性 | 外键校验 | 无孤儿记录 |
| 功能验证 | 冒烟测试 | 核心流程通过 |

---

## 第五部分：测试计划

### 5.1 测试策略

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                              测试金字塔                                              │
│                                                                                     │
│                                    ▲                                               │
│                                   /█\                                              │
│                                  / █ \                                             │
│                                 /  █  \                E2E Tests (10%)           │
│                                /   █   \                                           │
│                               /────█────\────────────────────────────────────────   │
│                              /     █     \         Integration Tests (30%)         │
│                             /      █      \                                         │
│                            /───────█───────\────────────────────────────────────   │
│                           /         █         \       Unit Tests (60%)              │
│                          /────────────────────\                                      │
│                                                                                     │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

### 5.2 单元测试

**覆盖率目标**: ≥70%

| 模块 | 目标覆盖率 | 关键测试用例 |
|------|------------|--------------|
| models | 90% | CRUD操作、约束验证 |
| services | 80% | 业务逻辑、边界条件 |
| api | 70% | 请求验证、响应格式 |
| utils | 80% | 工具函数、格式化 |

### 5.3 集成测试

**通过率目标**: ≥95%

| 场景 | 测试内容 | 预期结果 |
|------|----------|----------|
| 用户认证 | 登录/登出/Token刷新 | 成功返回Token |
| 配方CRUD | 创建/读取/更新/删除 | 数据一致 |
| 配方审核 | 提交/审核/通过/驳回 | 状态正确流转 |
| 实验管理 | 创建/数据录入/完成 | 数据完整 |
| AI服务 | 配方生成/安全检查 | 返回有效结果 |

### 5.4 系统测试

| 测试类型 | 执行时机 | 负责团队 |
|----------|----------|----------|
| 冒烟测试 | 每次部署前 | CI/CD自动执行 |
| 回归测试 | 每周 | QA团队 |
| 性能测试 | Phase结束后 | 性能测试团队 |
| 安全测试 | Phase结束后 | 安全团队 |
| 用户验收测试 | 里程碑 | 业务方 |

---

## 第六部分：交付物清单

### 6.1 Phase 1 交付物

| 交付物 | 验收标准 | 负责人 |
|--------|----------|--------|
| 数据模型优化代码 | 通过代码评审 | 后端开发 |
| API重构代码 | 通过API测试 | 后端开发 |
| 权限增强代码 | 通过权限测试 | 后端开发 |
| 测试套件 | 覆盖率≥70% | 后端开发 |
| 测试报告 | 通过率≥95% | 测试工程师 |
| 迁移脚本 | 数据一致性验证 | 后端开发 |
| 部署文档 | 可独立部署 | 运维工程师 |

### 6.2 Phase 2 交付物

| 交付物 | 验收标准 | 负责人 |
|--------|----------|--------|
| ES检索服务 | 响应时间<100ms | 后端开发 |
| Neo4j图谱 | 支持关系查询 | 后端开发 |
| FormulaGPT API | 生成有效配方 | 后端开发 |
| SynergyNet API | 协同分析正确 | 后端开发 |
| PeptideScorer API | 预测准确率>85% | 算法工程师 |
| 智能推荐界面 | 可用性测试通过 | 前端开发 |
| 知识图谱界面 | 可视化展示正常 | 前端开发 |

### 6.3 Phase 3 交付物

| 交付物 | 验收标准 | 负责人 |
|--------|----------|--------|
| 功效评估体系 | 8大类功效覆盖 | 业务专家 |
| BPMN工作流引擎 | 流程执行正确 | 后端开发 |
| 管理驾驶舱 | 核心指标可视化 | 前端开发 |
| 自定义报表 | 可导出Excel/PDF | 前端开发 |
| 等保三级证书 | 测评通过 | 安全工程师 |
| 安全评估报告 | 无高危漏洞 | 安全工程师 |
| 运维文档 | 完整可操作 | 运维工程师 |

---

## 第七部分：风险管理与应对

### 7.1 主要风险识别

| 风险ID | 风险描述 | 可能性 | 影响 | 风险等级 |
|--------|----------|--------|------|----------|
| R1 | AI模型集成难度超预期 | 高 | 高 | 严重 |
| R2 | 数据迁移丢失或损坏 | 低 | 高 | 严重 |
| R3 | 性能优化效果不达预期 | 中 | 中 | 中等 |
| R4 | 人员技术储备不足 | 中 | 高 | 严重 |
| R5 | 第三方服务依赖风险 | 中 | 中 | 中等 |
| R6 | 需求变更影响进度 | 高 | 中 | 中等 |

### 7.2 风险应对策略

| 风险ID | 应对策略 | 责任人 | 触发条件 |
|--------|----------|--------|----------|
| R1 | 预留2周缓冲；准备备选方案（规则引擎） | 技术负责人 | 模型响应率<80% |
| R2 | 迁移前全量备份；小批量验证 | 架构师 | 迁移后数据不一致 |
| R3 | 性能测试先行；优化分阶段验证 | 性能工程师 | 响应时间>200ms |
| R4 | 提前组织技术培训；引入外部专家 | 项目经理 | 代码评审发现技术债 |
| R5 | 评估替代方案；本地化部署 | 技术负责人 | 第三方服务不可用 |
| R6 | 定期需求评审；预留缓冲时间 | 产品经理 | 需求变更>20% |

---

## 第八部分：资源计划

### 8.1 人力资源

| 角色 | Phase 1 | Phase 2 | Phase 3 | 总工时 |
|------|---------|---------|---------|--------|
| 项目经理 | 30% | 30% | 30% | 6个月 |
| 后端开发(高级) | 100% | 80% | 60% | 18个月 |
| 后端开发(中级) | 100% | 80% | 50% | 15个月 |
| 前端开发(高级) | 80% | 60% | 60% | 14个月 |
| 前端开发(中级) | 80% | 50% | 40% | 12个月 |
| 算法工程师 | 0% | 50% | 30% | 6个月 |
| 测试工程师 | 50% | 80% | 80% | 15个月 |
| 安全工程师 | 10% | 20% | 50% | 6个月 |
| 运维工程师 | 30% | 50% | 50% | 10个月 |
| 业务专家 | 20% | 30% | 50% | 8个月 |

### 8.2 基础设施资源

| 资源 | Phase 1 | Phase 2 | Phase 3 | 说明 |
|------|---------|---------|---------|------|
| 开发服务器 | 2台 | 2台 | 2台 | 16C64G |
| 测试服务器 | 1台 | 2台 | 2台 | 8C32G |
| 生产服务器 | 0台 | 2台 | 4台 | 16C64G |
| ES集群 | 0台 | 3台 | 3台 | 8C32G |
| Neo4j集群 | 0台 | 3台 | 3台 | 8C32G |
| GPU服务器 | 0台 | 1台 | 2台 | Tesla V100 |
| 备份存储 | 1TB | 2TB | 5TB | 云存储 |

---

**文档结束**

本升级改造实施计划基于补全方案文档制定，明确了分阶段升级目标、详细任务分解、资源计划和风险管理措施。计划遵循先基础后高级、先核心后增强的原则，确保升级过程平稳可控。

**文档版本**: v1.0.0
**编写日期**: 2026-04-18
**编写团队**: 莱茵(厦门)分子生物科技有限公司
**审核状态**: 待审核
**计划总工期**: 18个月