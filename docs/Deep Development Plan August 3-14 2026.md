# RMFOOD 深度开发方案（August 3-14, 2026）

> 基于《Development strategy as of August 3-14, 2026.md》制定，
> 结合当前代码库现状（567个后端文件、1023个前端文件、87个AI服务文件）
> 分阶段执行，每阶段包含具体文件、接口和功能点。

---

## 执行状态总览

| 阶段 | 方向 | 文件数 | 状态 |
|------|------|--------|------|
| **Phase 0** | AI安全护栏 | 3新增 + 2修改 | ✅ 已完成，24/24测试通过 |
| **Phase 1** | 事件总线 + 数据质量 + 自适应求解器 | 3新增 | ✅ 已完成，24/24测试通过 |
| **Phase 2-A** | RAG知识库 + Agent工作流集成 | 2新增 + 3修改 | 🔄 进行中 |
| **Phase 2-B** | 合规前置设计 | 1新增 + 1修改 | ⏳ 待启动 |
| **Phase 2-C** | 知识图谱推理引擎 | 1新增 | ⏳ 待启动 |
| **Phase 3** | 多租户分层隔离体系 | 1新增 + 2修改 | ⏳ 待启动 |
| **Phase 4** | 产品方案报告生成 | 1新增 | ⏳ 待启动 |

---

## Phase 2-A：RAG知识库 + Agent工作流集成

### 背景分析

**现状**：
- `RAGService`（332行）已实现 BM25 + 向量混合检索、RRF重排序、TCM同义词扩展
- Agent编排引擎（330行）已实现 Fast/Smart 两种模式，注册4个工具
- 但两者**未集成**：Agent查询不经过RAG检索，RAG输出不驱动Agent工具调用

**目标**：打通"用户问题 → RAG检索 → Agent工具链 → 合规检查 → 结果输出"全链路

### 新增文件

#### 2-A.1 `backend/app/services/ai/agent/workflow_engine.py`
- Agent工作流编排引擎，串联 RAG → Agent → 合规 → 实验方案
- 支持5种预定义工作流模板：
  - `formula_design`: 配方设计（需求→原料筛选→配方生成→合规检查→报告）
  - `compliance_check`: 合规预审（配方→多维度合规检查→预警）
  - `experiment_plan`: 实验方案（配方→实验设计→指标体系→执行步骤）
  - `ingredient_lookup`: 原料查询（名称/功效/配伍→RAG检索→答案）
  - `full_pipeline`: 全流程（上述四步串联）

#### 2-A.2 `backend/app/services/ai/agent/tools/qa_tool.py`
- 新Agent工具：基于RAG的问答工具
- 集成 `RAGService.augment_query()` 获取上下文
- 注入PromptGuard安全检测
- 返回结构化答案 + 引用来源

### 修改文件

#### 2-A.3 `backend/app/services/ai/agent/orchestrator.py`
- 在 `execute_smart()` 中集成 RAG 检索增强
- 当用户问题涉及配方/原料/合规时，自动调用 RAG 检索
- 检索结果作为"参考资料"注入 InstructionHierarchy

#### 2-A.4 `backend/app/api/v1/agent_router.py`
- 新增 `/agents/workflow/{workflow_type}/execute` 端点
- 新增 `/agents/workflow/status/{execution_id}` 查询端点
- 新增 WebSocket 实时进度推送

#### 2-A.5 `backend/app/api/v1/rag_router.py`
- 新增 `/rag/search` 端点：直接查询RAG知识库
- 新增 `/rag/stats` 端点：知识库统计
- 新增 `/rag/documents` 端点：文档管理

---

## Phase 2-B：合规前置设计

### 背景分析

**现状**：
- `ComplianceAwareFormulaService`（309行）已实现事中合规检查 + 自动修复
- `formula_compliance.py` 已有药食同源目录、禁忌搭配、儿童禁忌规则
- 但当前是**事后检查**：配方生成后检查，不合规则回退修改
- Agent工具的 `ComplianceCheckTool` 只是调用这个服务，没有前置约束

**目标**：将合规约束**前置**到配方生成阶段，使AI生成的配方天然合规

### 新增文件

#### 2-B.1 `backend/app/services/compliance/preset_constraints.py`
- 合规约束前置引擎
- 将 `FOOD_HERB_MAX_DOSAGE` 和 `PROHIBITED_COMBINATIONS` 转化为优化器的硬约束
- 提供 `apply_constraints_to_optimizer()` 方法，将合规规则注入求解器
- 支持约束优先级：硬约束（必须满足）/ 软约束（尽量满足，违规时惩罚）

#### 2-B.2 `backend/app/api/v1/compliance_router.py`（修改）
- 新增 `/compliance/preset-rules` 端点：返回当前合规规则集
- 新增 `/compliance/preview` 端点：输入配方参数，返回前置约束警告
- 新增 `/compliance/global-rules` 端点：查询全球法规覆盖情况（预留FDA/EFSA扩展接口）

---

## Phase 2-C：知识图谱推理引擎

### 背景分析

**现状**：
- 知识图谱已从4000+行重构为813行，多层模块化架构（graph/types/engine/analytics/hooks/components）
- 当前功能：查询 + 可视化展示（D3渲染）
- **缺失**：推理能力（路径发现、协同效应预测、冲突检测）

**目标**：从"查询"升级为"推理"，支持自动发现原料协同效应和配伍冲突

### 新增文件

#### 2-C.1 `backend/app/services/kg/reasoning_engine.py`
- 知识图谱推理引擎
- 三大推理能力：
  1. **路径推理**：基于已知关系发现"原料A→功效B→疾病C"路径
  2. **协同效应预测**：基于图结构分析两个原料的组合效应（协同/拮抗/无关）
  3. **配伍冲突检测**：自动检测十八反十九畏等禁忌搭配
- 推理结果写入图谱（异步，不阻塞查询）

#### 2-C.2 `backend/app/services/kg/inference_agent.py`
- 知识图谱推理Agent
- 基于 ReAct 模式，让LLM驱动图谱推理
- 工具：`kg_query`（图谱查询）、`kg_reason`（图谱推理）、`kg_visualize`（可视化）
- 输出：推理报告 + 可视化建议

---

## Phase 3：多租户分层隔离体系

### 背景分析

**现状**：
- 已实现基于RLS的行级安全策略，支持严格/审计两种模式
- 但只有"共享实例+行级隔离"一种模式
- 无法满足不同等级客户的安全合规需求

**目标**：四级分层隔离，支撑商业化定价

### 新增文件

#### 3-A.1 `backend/app/core/multi_tenant/isolation_policy.py`
- 四级隔离策略定义
  - Level 1: 共享实例 + RLS（默认，成本最低）
  - Level 2: Schema级隔离（独立Schema，共享实例）
  - Level 3: 独立数据库实例（物理隔离）
  - Level 4: K8s命名空间 + 独立数据库（极致隔离）
- 提供 `get_isolation_policy(org_id)` 和 `apply_isolation(db_session, org_id)` 方法

#### 3-A.2 `backend/app/services/multi_tenant/tenant_ai_config.py`
- 租户级AI能力定制
- 允许不同租户自定义：
  - LLM模型供应商和参数（temperature/top_p/max_tokens）
  - 配方优化权重（成本/功效/合规的权重系数）
  - 合规规则集覆盖（自定义禁止搭配、自定义限量）
- 提供 `get_tenant_ai_config(org_id)` 和 `update_tenant_ai_config()` 方法

### 修改文件

#### 3-A.3 `backend/app/api/v1/team_router.py`（修改）
- 新增 `/teams/{team_id}/isolation-level` PUT 端点：修改隔离级别
- 新增 `/teams/{team_id}/ai-config` GET/PUT 端点：管理租户AI配置

#### 3-A.4 `backend/app/core/database/session.py`（修改）
- 修改 `get_db_session()` 根据租户隔离级别返回不同session
- Level 1: 现有RLS session（不变）
- Level 2: 切换到租户专属Schema
- Level 3: 切换到租户专属数据库连接

---

## Phase 4：产品方案报告生成

### 背景分析

**现状**：
- 配方生成后仅返回成分列表和评分
- 缺少"产品定位""市场分析""成本估算""工艺建议"等完整报告
- 用户需手动整理，无法直接用于产品申报

**目标**：配方生成后自动附加完整产品方案报告

### 新增文件

#### 4-A.1 `backend/app/services/report/product_plan_reporter.py`
- 产品方案报告生成引擎
- 生成内容包括：
  1. **产品定位**：目标人群、核心功效、差异化卖点
  2. **原料功效说明**：每味原料的性味归经、主要功效、科学依据
  3. **成本估算**：基于原料单价的总成本、单份成本、毛利空间
  4. **工艺路线建议**：剂型选择、关键控制点、生产注意事项
  5. **法规合规预审**：基于当前法规的合规性风险提示
- 报告格式：Markdown（供前端渲染）+ JSON（供程序处理）

#### 4-A.2 `backend/app/api/v1/report_export_router.py`（修改）
- 新增 `/reports/product-plan` POST 端点：生成产品方案报告
- 支持 PDF/Markdown/JSON 三种导出格式

---

## 开发节奏与里程碑

```
Week 1-2: Phase 2-A (RAG + Agent工作流)
  - 完成 workflow_engine.py 和 qa_tool.py
  - 修改 orchestrator.py 集成RAG
  - 更新 agent_router.py 和 rag_router.py
  - 验收标准：用户说"帮我设计枸杞饮品配方"，系统自动完成RAG检索→配方生成→合规检查→报告输出

Week 3: Phase 2-B (合规前置设计)
  - 完成 preset_constraints.py
  - 更新 compliance_router.py
  - 验收标准：配方生成时自动排除超量成分，无需事后回退

Week 4: Phase 2-C (知识图谱推理)
  - 完成 reasoning_engine.py 和 inference_agent.py
  - 验收标准：输入"枸杞和黄芪搭配有什么协同效应"，系统自动推理并输出结论

Week 5-6: Phase 3 (多租户分层隔离)
  - 完成 isolation_policy.py 和 tenant_ai_config.py
  - 更新 team_router.py 和 session.py
  - 验收标准：高级租户可配置独立Schema，企业租户可配置独立数据库

Week 7: Phase 4 (产品方案报告)
  - 完成 product_plan_reporter.py
  - 更新 report_export_router.py
  - 验收标准：配方生成后自动生成包含5大模块的完整产品方案报告

Week 8: 集成测试 + 性能优化
  - 端到端测试全流程
  - 性能基准测试（RAG检索延迟<200ms，Agent工作流端到端<10s）
  - 安全回归测试（所有安全护栏功能验证）
```

---

## 关键风险与缓解

| 风险 | 影响 | 缓解措施 |
|------|------|---------|
| RAG检索延迟过高 | Agent响应慢 | 缓存高频查询结果，TTLMINUTE |
| 知识图谱推理数据不足 | 推理质量差 | 先从10条规则开始验证，逐步扩展 |
| 多租户Schema切换复杂 | 迁移风险 | 保留Level 1为默认，Level 2-4逐步灰度 |
| 产品报告模板固化 | 不同客户需求不同 | 模板引擎化，支持租户自定义模板 |

---

## 代码规范

1. 所有新增模块必须有类型注解（遵循 PEP 484）
2. 所有异步函数必须有 `-> AsyncIterator` 或 `-> Awaitable` 返回类型
3. 所有公开 API 必须有中文 docstring
4. 新增模块必须有对应测试文件，覆盖率目标 ≥ 80%
5. 安全相关代码必须经过 `prompt_guard` 和 `output_filter` 双重检测
