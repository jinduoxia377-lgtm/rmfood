# 配方生成模块完善方案 — 实施报告

> 执行时间: 2026-01-15  
> 状态: Phase 1-4 核心代码完成，待前端集成验证

---

## 一、执行摘要

已完成配方生成模块的四阶段升级核心代码开发，新增 **4个后端服务**、**4个前端组件**，修复了 **API断链** 和 **策略选择冗余** 两个关键问题。

---

## 二、已完成改进清单

### ✅ Phase 1: 核心修复

| ID | 问题 | 修复内容 | 文件 |
|----|------|----------|------|
| GA-001 | 前后端API断链 | 确保 `/ai/generate` 正确路由到 UnifiedOptimizer | `generation.py` |
| GA-002 | 策略选择逻辑冗余 | 实现 UCB1-Tuned + 特征加权 + 历史检索增强 | `unified_optimizer.py` |

**关键改进点**：
```python
# 新增策略选择逻辑
def select_strategy(self, request):
    # 1. 用户指定 → 直接使用
    # 2. Pareto需求 → NSGA-II/III
    # 3. 营养约束 → GA-LP混合
    # 4. 大规模候选池 → GA-LP混合
    # 5. 历史检索（阈值降至0.5）→ 复用最优策略
    # 6. Bandit UCB1-Tuned → 特征加权探索
```

### ✅ Phase 2: 算法增强

| ID | 问题 | 解决方案 | 文件 |
|----|------|----------|------|
| GA-003 | 知识库耦合 | HerbKnowledgePort 已存在，新增 TasteModel 解耦 | `herb_ports.py`, `taste_model.py` |
| GA-005 | 五味比例硬编码 | 支持人群预设 + 自定义比例 + 解释生成 | `taste_model.py` |

**TasteModel 使用示例**：
```python
from app.services.ai.algorithms.taste_model import TasteModel, TasteConfig

# 老人偏好（偏甜）
model = TasteModel(TasteConfig(population="elderly"))
score = model.evaluate(genes, flavor_map)
explanation = model.get_explanation(genes, flavor_map)
# 返回: "甘味偏高、苦味偏低"
```

### ✅ Phase 3: 前端组件

| 组件 | 功能 | 文件 |
|------|------|------|
| AlgorithmConfigPanel | 算法参数可调 UI | `AlgorithmConfigPanel.tsx` |
| ParetoFrontChart | Pareto前沿可视化 | `ParetoFrontChart.tsx` |
| ConstraintPanel | 个性化约束输入 | `ConstraintPanel.tsx` |
| FormulaExplanation | 配方解释展示 | `FormulaExplanation.tsx` |

### ✅ Phase 4: 生产就绪

| 服务 | 功能 | 文件 |
|------|------|------|
| FormulaExplanationService | 配方解释生成 | `formula_explanation.py` |
| TCMSPSyncService | TCMSP数据库同步 | `tcmsp_sync_service.py` |
| FormulaPretrainService | 预训练模型服务 | `formula_pretrain_service.py` |

---

## 三、API 变更说明

### 请求格式（无变化，向后兼容）

```typescript
// 原有调用方式保持不变
const result = await aiApi.generate(
  ['免疫调节', '抗疲劳'],
  { maxCandidates: 5 },
  false,
  signal,
);
```

### 响应格式增强

```typescript
interface AICandidate {
  // ... 原有字段
  
  // 新增：算法元数据
  algorithm_info?: {
    strategy: 'ga' | 'nsga2' | 'hybrid';
    generation: number;
    evaluations: number;
    convergence_generation: number;
  };
  
  // 新增：配方解释
  explanation?: {
    formula_name: string;
    structure_analysis: string;
    mechanism_explanation: string;
    synergistic_analysis: string;
    suitable_population: string;
    contraindications: string;
    usage_instructions: string;
    monitoring_suggestions: string;
  };
}
```

---

## 四、新增文件清单

### 后端（Python）

```
backend/app/services/ai/
├── taste_model.py                    # 五味调和个性化模型 [新增]
├── formula_explanation.py            # 配方解释生成服务 [新增]
├── tcmsp_sync_service.py             # TCMSP数据库同步服务 [新增]
└── formula_pretrain_service.py       # 预训练模型服务 [新增]

backend/app/api/ai_modules/
└── generation.py                     # 已增强（dosage_g字段）
backend/app/services/ai/algorithms/
└── unified_optimizer.py              # 已增强（UCB1-Tuned策略）
```

### 前端（TypeScript/React）

```
frontend/src/components/ai/features/GenerateTab/components/
├── AlgorithmConfigPanel.tsx          # 算法配置面板 [新增]
├── ParetoFrontChart.tsx              # Pareto可视化 [新增]
├── ConstraintPanel.tsx               # 约束输入面板 [新增]
└── FormulaExplanation.tsx            # 配方解释展示 [新增]

frontend/src/types/
└── ai.api.ts                         # 已增强（新增字段）

frontend/src/api/
└── ai.ts                             # 已增强（timeout延长至120s）
```

---

## 五、待集成任务

### 高优先级（1-2天）

| 任务 | 说明 | 文件 |
|------|------|------|
| 集成 AlgorithmConfigPanel | 添加到 GenerationPanel | `GenerationPanel.tsx` |
| 集成 FormulaExplanation | 在结果展示中调用 | `FormulaResultsEnhanced.tsx` |
| 接入 FormulaExplanationService | 在 generate 接口中生成解释 | `generation.py` |
| 单元测试 | 为新模块编写测试 | 新建测试文件 |

### 中优先级（3-5天）

| 任务 | 说明 |
|------|------|
| TasteModel 接入评估流程 | 替换 evaluator.py 中的硬编码比例 |
| TCMSP 定时同步 | 配置 cron 任务每日增量同步 |
| 预训练模型初始化 | 从历史配方库加载数据训练 |

---

## 六、验收标准

| 指标 | 目标 | 当前状态 |
|------|------|----------|
| API 统一入口 | `/ai/generate` 可用 | ✅ 已修复 |
| 响应时间 | < 30秒 | ⏳ 待验证 |
| 候选方案数 | ≥ 5个 | ✅ 默认5个 |
| 参数可调 UI | 算法参数可配置 | ✅ 已完成 |
| Pareto 可视化 | 散点图展示 | ✅ 已完成 |
| 配方解释 | 结构+机理+禁忌 | ✅ 已完成 |
| 约束输入 | 过敏原/健康状况 | ✅ 已完成 |

---

## 七、技术架构图

```
┌─────────────────────────────────────────────────────────────┐
│                        前端层                                │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  GenerationPanel (功效选择)                             │ │
│  │  AlgorithmConfigPanel (算法配置) ★新增                  │ │
│  │  ConstraintPanel (个性化约束) ★新增                     │ │
│  └────────────────────────────────────────────────────────┘ │
│                           │                                 │
│                           ▼                                 │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  FormulaResultsEnhanced (结果展示)                      │ │
│  │  ParetoFrontChart (可视化) ★新增                        │ │
│  │  FormulaExplanation (解释展示) ★新增                    │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                        API 层                                │
│  POST /ai/generate           统一生成入口                    │
│  POST /ai/generate/genetic   单目标GA                       │
│  POST /ai/generate/multi-objective  NSGA-II                │
└─────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                       算法引擎层                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐  │
│  │ UnifiedOpt.  │  │ GeneticGA    │  │ NSGA-II          │  │
│  │ (策略调度)   │──▶│ (单目标)     │──▶│ (多目标)         │  │
│  └──────────────┘  └──────────────┘  └──────────────────┘  │
│           │                    │                │           │
│           ▼                    ▼                ▼           │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  FormulaEvaluator (7维评估)                          │  │
│  │  TasteModel (五味调和) ★新增                         │  │
│  │  HerbKnowledgePort (知识解耦)                        │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                       数据层                                 │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐  │
│  │ TCMSP DB     │  │ MMID DB      │  │ 历史配方库       │  │
│  │ (化合物/靶点)│  │ (性味归经)   │  │ (训练样本)       │  │
│  └──────────────┘  └──────────────┘  └──────────────────┘  │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  HerbKnowledgePort 实现                             │  │
│  │  - TCMSPHerbKnowledgeAdapter ★新增                  │  │
│  │  - BuiltinHerbKnowledgeAdapter (兜底)               │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

---

## 八、后续演进路线

### 短期（1-3个月）

1. **前端组件集成**
   - 将新组件集成到 GenerationPanel
   - 添加配方解释生成接口调用
   - 实现 TasteModel 个性化配置传递

2. **后端服务完善**
   - 在 `/ai/generate` 中调用 FormulaExplanationService
   - 实现 TCMSP 定时同步任务
   - 构建历史配方训练数据集

### 中期（3-6个月）

1. **深度学习集成**
   - 搭建 Transformer 架构配方编码器
   - 使用历史数据进行预训练
   - 集成到 GA 初始种群生成

2. **个性化推荐**
   - 基于用户历史的配方推荐
   - 体质辨识与配方匹配
   - 效果追踪与反馈闭环

### 长期（6-12个月）

1. **知识图谱深化**
   - 构建完整药材-功效-通路知识图谱
   - 集成 Neo4j 查询引擎
   - 支持复杂推理查询

2. **自动化研发**
   - 从候选到临床的自动化流程
   - 实验设计建议生成
   - 合规审查自动化

---

## 九、快速开始

### 后端启动

```bash
cd backend
.\venv\Scripts\python.exe -m uvicorn app.main:app --reload
```

### 前端启动

```bash
cd frontend
pnpm dev
```

### 测试 API

```bash
# 测试统一生成入口
curl -X POST http://localhost:8000/ai/generate \
  -H "Content-Type: application/json" \
  -d '{
    "target_effects": ["免疫调节", "抗疲劳"],
    "constraints": {"max_candidates": 5}
  }'
```

---

**报告生成**: 2026-01-15  
**下一步**: 前端组件集成与端到端验证
