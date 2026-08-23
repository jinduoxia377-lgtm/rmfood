# RMFOOD 项目配方生成系统分析报告

> 生成时间: 2026-08-14  
> 分析范围: backend/app 下所有配方相关模块

---

## 一、功能模块总览

RMFOOD 的配方生成系统采用**六边形架构**，分为四个层次：**用户交互层 → API 层 → 算法优化层 → 评估验证层**。共涉及 30+ 个 Python 文件，覆盖从 AI 生成到合规审核的全链路。

```
┌─────────────────────────────────────────────────────────────────────┐
│                        用户交互层 (Frontend)                        │
│  Formula Designer / ChatAI / Experiment / Dashboard               │
└──────────────────────────┬──────────────────────────────────────────┘
                           │ HTTP REST API
┌──────────────────────────▼──────────────────────────────────────────┐
│                          API 层 (Routers)                           │
│  formulas.py  ·  ai_modules/generation.py  ·  advanced_peptide.py   │
│  peptide_design_routes.py  ·  formula_integration.py               │
└──────────────────────────┬──────────────────────────────────────────┘
                           │ Service → Algorithm
┌──────────────────────────▼──────────────────────────────────────────┐
│                      算法优化层 (Algorithms)                        │
│  Genetic · Bayesian · NSGA-II/III · Multi-Algorithm Orchestrator   │
│  BinaryGA+MILP · Unified Optimizer (Bandit auto-selection)        │
└──────────────────────────┬──────────────────────────────────────────┘
                           │ 优化结果
┌──────────────────────────▼──────────────────────────────────────────┐
│                      评估验证层 (Validation)                        │
│  Nutrition · Synergy · Compatibility · Safety · Stability · Taste   │
│  Effect Simulator (PopPK/PD) · Compliance Check                   │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 二、各模块详细清单

### 2.1 核心算法引擎（配方生成）

| 文件路径 | 类名 | 算法原理 | 状态 |
|---|---|---|---|
| `services/ai/algorithms/genetic_formula_optimizer.py` | `GeneticFormulaOptimizer` | 实数编码遗传算法，含君臣佐使结构评估、自适应变异、多样性恢复 | ✅ 生产就绪 |
| `services/ai/algorithms/bayesian_formula_optimizer.py` | `BayesianFormulaOptimizer` | 高斯过程回归 + Expected Improvement 采集函数，多目标 Pareto 优化 | ✅ 生产就绪 |
| `services/ai/algorithms/multi_objective_optimizer.py` | `NSGAIIOptimizer` | NSGA-II 多目标遗传算法，支持 Pareto 前沿求解（拆分后：models.py/evaluator.py/algorithm.py） | ✅ 生产就绪 |
| `services/ai/algorithms/binary_ga_optimizer.py` | `BinaryGAOptimizer` | 二进制 GA + MILP 混合引擎，解决离散选择 + 连续配比联合优化 | ✅ 生产就绪 |
| `services/ai/algorithms/unified_optimizer.py` | `UnifiedFormulaOptimizer` | 统一调度器，内置 Bandit UCB1 学习器自动选择最优策略 | ✅ 生产就绪 |
| `services/ai/algorithms/multi_algorithm_orchestrator.py` | `MultiAlgorithmOrchestrator` | 四算法并行融合（NSGA-III + MOEA/D + PSO + SA），union/weighted/voting 三种融合策略 | 🧪 实验性 |
| `services/ai/algorithms/nsga3_optimizer.py` | `NSGAIIIOptimizer` | NSGA-III 高维多目标优化（≥6 维目标） | 🧪 实验性 |

### 2.2 AI 预测模型（配方属性评估）

| 文件路径 | 类名 | 功能 |
|---|---|---|
| `services/ai/models/formula_predictor.py` | `FormulaPredictor` | 7 维属性预测器：功效/安全/口感/成本/协同/稳定/ADMET |
| `services/ai/models/unified_formula_engine.py` | `UnifiedFormulaEngine` | 统一配方生成引擎（整合 LLM + 规则 + 优化算法） |
| `services/ai/models/autoregressive_generator.py` | — | 自回归配方序列生成模型 |
| `services/ai/models/formula_discriminator.py` | — | 判别器：区分真实配方 vs 生成配方 |
| `services/ai_models/neural_formula_engine.py` | `NeuralFormulaEngine` | 神经网络配方引擎（PyTorch） |
| `services/ai_models/formula_gpt.py` | `FormulaGPT` | GPT 风格配方生成 |
| `services/ai_models/safety_checker.py` | `SafetyChecker` | 安全性检查器 |
| `services/ai_models/taste_predictor.py` | `TastePredictor` | 风味预测模型 |

### 2.3 营养计算模块

| 文件路径 | 类名/功能 |
|---|---|
| `services/formula/nutrition_service.py` | `FormulaNutritionService` — 营养成分计算、总量校验、单位换算 |
| `services/formula/nutrition_cache.py` | `NutritionCache` — 营养数据缓存 |
| `services/formula/nutrition_adapter.py` | `NutritionAdapter` — 营养数据库适配器 |
| `services/formula/nutrition_database.py` | `HERB_NUTRITION_DB` — 药食同源成分营养数据库 |
| `services/nutrition/nutrition_label_generator.py` | GB 28050 营养成分表生成器 |
| `services/nutrition/nutrition_export.py` | 营养标签 Excel/PDF 导出 |

### 2.4 协同效应分析

| 文件路径 | 类名/功能 |
|---|---|
| `services/formula/synergy_engine.py` | `SynergyEngine` — 五维协同机制引擎主类 |
| `services/formula/synergy_models.py` | 协同数据类型定义（MechanismType, SynergyReport 等） |
| `services/formula/synergy_calculators_1.py` | Calculator Mixin 1：Bliss Independence + PK Interaction + Gibbs |
| `services/formula/synergy_calculators_2.py` | Calculator Mixin 2：Network Pharmacology + Taste Matrix |
| `services/formula/synergy_analysis.py` | SynergyAnalysisMixin — 综合分析逻辑 |
| `services/formula/synergy_data.py` | SynergyDataMixin — 系数存储与版本管理 |

### 2.5 兼容性检测

| 文件路径 | 类名/功能 |
|---|---|
| `services/formula/compatibility_checker.py` | `CompatibilityChecker` — 四层兼容性检测（化学/药理学/营养学/法规） |
| `services/formula/compatibility_rules.py` | 兼容性规则库定义 |

### 2.6 安全性预警

| 文件路径 | 类名/功能 |
|---|---|
| `services/formula/safety_alert_system/core.py` | `SafetyAlertSystem` — 三级阈值预警系统 |
| `services/formula/safety_alert_system/formula_check.py` | 配方安全检查规则 |
| `services/formula/safety_alert_system/thresholds.py` | 安全阈值定义 |
| `services/formula/safety_alert_system/api.py` | 安全 API 接口 |

### 2.7 稳定性与风味预测

| 文件路径 | 类名/功能 |
|---|---|
| `services/formula/stability_predictor.py` | `StabilityPredictor` — 货架期预测、降解速率、风险因子 |
| `services/formula/taste_predictor.py` | `TastePredictor` — 风味档案预测、接受度评分 |
| `services/formula/effect_simulator.py` | `EffectSimulator` — PopPK/PD 效应曲线模拟 |

### 2.8 其他辅助模块

| 文件路径 | 类名/功能 |
|---|---|
| `services/formula/formula_module.py` | `FormulaNutritionService` — 营养计算、剂量换算、过敏原检测 |
| `services/formula/lp_solver.py` | `MILPSolver` — 混合整数线性规划求解器 |
| `services/formula/ratio_optimizer.py` | `RatioOptimizer` — 配比优化 |
| `services/formula/integration_service.py` | `IntegrationService` — 配方整合服务 |
| `services/formula/parallel_pipeline.py` | `ParallelPipeline` — 并行计算管道 |
| `services/formula/coefficient_version_manager.py` | `CoefficientVersionManager` — 协同系数版本管理 |
| `services/formula_designer.py` | `FormulaDesigner` — 配方设计服务（业务编排） |
| `services/constraint_penalty.py` | `ConstraintPenalty` — 约束惩罚函数 |
| `services/cost_calculator.py` | 成本计算器 |
| `services/compliance/formula_compliance.py` | 配方合规检查服务 |
| `services/compliance/preset_constraints.py` | 预设约束规则 |
| `services/peptide_design_service.py` | 肽段设计服务 |
| `services/peptide_analysis_service.py` | 肽段分析服务 |
| `services/ai/formula_optimizer.py` | AI 配方优化服务（高级编排） |
| `services/ai/formula_service.py` | AI 配方服务 |
| `services/ai/orchestration/formula_service.py` | AI 编排配方服务 |
| `services/ai/orchestration/generation_service.py` | AI 生成服务（编排层） |
| `services/ai/calculation_service/optimizer.py` | AI 计算服务优化器 |
| `services/llm_service.py` | LLM 服务集成（LLM 生成配方） |
| `services/ai/agent/tools/formula_tool.py` | Agent 工具：配方操作 |
| `services/ai/agent/tools/safety_tool.py` | Agent 工具：安全检测 |
| `services/ai/agent/tools/taste_tool.py` | Agent 工具：风味预测 |
| `services/ai/agent/tools/stability_tool.py` | Agent 工具：稳定性预测 |

### 2.9 API 路由层

| 文件路径 | 路由前缀 | 核心功能 |
|---|---|---|
| `api/formulas.py` | `/formulas` | 配方 CRUD、版本管理、审核流程、统计、营养成分表、协同分析、稳定性预测、安全性检查 |
| `api/ai_modules/generation.py` | `/ai/generate` | AI 配方生成入口（遗传算法 + LLM + PepINVERT） |
| `api/ai_modules/optimization.py` | `/ai/optimization` | 多目标优化 API |
| `api/advanced_peptide.py` | `/advanced-peptide` | 高级肽段分析与设计 |
| `api/peptide_design_routes.py` | `/peptide-design` | 肽段设计路由 |
| `api/peptide_analysis_routes.py` | `/peptide-analysis` | 肽段分析路由 |
| `api/formula_integration.py` | `/formula-integration` | 配方集成服务 |

---

## 三、配方生成设计思路与原理

### 3.1 整体设计哲学

```
目标功效 → 候选药材选择 → 优化算法搜索 → 多维度评估 → 安全合规校验 → 最终配方
              ↑                                        ↓
         HerbKnowledgeService ←←←←←←←←←←←←←←←←←←← 用户反馈
```

**核心理念**：将配方生成建模为一个**带约束的多目标黑箱优化问题**。

> **优化目标函数**: argmax f(ingredients, dosages)
> 其中 f 是功效/安全/口感/成本/协同/稳定性的综合加权评分

### 3.2 配方生成的数学建模

#### 搜索空间定义

```python
# 每个药材 i 的决策变量：
# x_i ∈ [dosage_min_i, dosage_max_i]  (连续用量)
# s_i ∈ {0, 1}                        (是否选择该药材，离散选择)

# 对于 BinaryGA+MILP:
# 外层: s_i 二进制编码 → 选择哪些药材
# 内层: x_i 连续变量  → 精确配比优化（MILP 求解）
```

#### 多维度评价函数

系统采用 **7 维属性向量** 评估每个候选配方：

| 维度 | 权重 | 计算方法 |
|---|---|---|
| 功效 Efficacy | 30% | 目标功效加权几何平均 |
| 安全 Safety | 25% | 各药材安全性均值 × 配伍禁忌惩罚 |
| 口感 Taste | 10% | 五味调和 MSE 模型 |
| 成本 Cost | 15% | 总成本归一化 (≤50 元基准) |
| 协同 Synergy | 10% | 三层模型：功效互补 + 经典配伍 + 用量比例 |
| 稳定 Stability | 10% | 安全评分 × 用量集中度惩罚 |
| ADMET | 综合 | 安全×0.4 + 稳定×0.35 + 成本×0.25 |

**综合评分公式**：
```
Fitness = Σ(w_i × score_i) × structural_compliance_factor
其中 structural_compliance_factor = 0.5 + 0.5 × 君臣佐使结构合规度
```

### 3.3 算法选择策略（统一调度器）

`UnifiedFormulaOptimizer` 采用**多策略自动调度**机制：

```
请求进入
   │
   ├─ 用户指定策略 → 直接执行
   │
   ├─ 需要 Pareto 前沿 → NSGA-II/III
   │     ├─ 目标 ≥6 维 → NSGA-III
   │     └─ 目标 <6 维 → NSGA-II
   │
   ├─ 严格营养约束 → BinaryGA+MILP 混合引擎
   │
   ├─ 大规模候选池 (>20种药材) → BinaryGA+MILP
   │
   ├─ 历史检索命中（Jaccard ≥ 0.9）→ 复用上次最优策略
   │
   └─ 默认 → Bandit UCB1 学习器推荐策略
```

**Bandit UCB1 公式**：
```
UCB(s) = Q(s) + c × √(ln(N) / n_s)
  Q(s): 策略 s 的历史平均奖励
  N:    总选择次数
  n_s:  策略 s 的选择次数
  c:    探索常数 = √2 ≈ 1.414
```

### 3.4 遗传算法核心设计

**种群初始化策略**（三元混合种子）：
1. **TCM 经典方剂种子**：四君子汤、六味地黄丸、桂枝汤、逍遥散、银翘散 → 注入千年验证的配伍智慧
2. **功效最佳种子**：按目标功效选取评分最高的药材组合
3. **随机填充**：随机选择 3~8 味药材填充剩余个体

**进化算子**：
- **选择**：锦标赛选择（size=5），精英保留（15%）
- **交叉**：算术交叉（Blend Crossover），alpha 均匀采样
- **变异**：高斯变异 + 药材添加/删除（30% 概率修改现有基因，20% 概率添加新药材）
- **自适应变异率**：低多样性时 2.5× 增强，高多样性时 0.7× 降低
- **多样性恢复**：多样性 < 0.15 时注入 20% 随机个体
- **早停**：连续 15 代无改进 或 达到 fitness ≥ 0.95 阈值

**君臣佐使结构合规度**：
- 按剂量降序分组 → 君药(1-2味) → 臣药(2-3味) → 佐药(1-2味) → 使药(剩余)
- 检查剂量递减关系、数量合理性、跨度限制
- 合规度作为乘法因子：`fitness × (0.5 + 0.5 × compliance)`

### 3.5 贝叶斯优化核心设计

**核心思想**：将配方评分建模为黑箱函数，用高斯过程（GP）学习其映射关系，通过 EI 采集函数平衡探索与利用。

```
迭代流程：
1. 拉丁超立方采样 → 初始 N=10 个配方 + 评分
2. 构建 GP 代理模型（RBF 核函数）
3. 计算 EI(x) = (μ(x)-f*)Φ(z) + σ(x)φ(z)，z=(μ(x)-f*-ε)/σ(x)
4. 选取 EI 最大的点作为下一候选
5. 评估候选配方 → 更新 GP 模型
6. 重复 30 轮 → 取 Top-5
```

**先验知识注入**：
- **协同偏置**：已知配伍对（如黄芪+党参）提高协同药材用量
- **禁忌抑制**：相反药材对（如藜芦+人参）降低同时高用量概率
- **TCM 药效索引**：基于 `_EFFICACY_TO_HERBS` 字典进行功效→药材映射

### 3.6 协同效应分析设计

`SynergyEngine` 实现 **5 种协同机制**的数学模型：

| 机制 | 模型 | 适用场景 |
|---|---|---|
| 药效增强协同 | Bliss Independence 模型 | 两种成分独立作用时的叠加效应 |
| 药代动力学协同 | PK Interaction 模型 | 成分间吸收/代谢互作 |
| 结构稳定性协同 | Gibbs 自由能模型 | 分子间相互作用能量 |
| 靶点通路协同 | 网络药理学模型 | 共享靶点/通路的 Jaccard 相似度 |
| 感官品质协同 | 味觉矩阵模型 | 五味的互补与调和 |

**综合协同指数 (SI)** = 加权平均各机制得分，输出主导机制 + 置信度。

### 3.7 安全性与合规性设计

**四级安全防线**：

1. **Level 1 - 兼容性检测** (`CompatibilityChecker`)：
   - 化学层面：pH 冲突、沉淀反应（Ksp）、氧化还原（ΔE > 0.3V）
   - 药理学层面：受体竞争、酶抑制（CYP3A4/CYP2D6）
   - 营养学层面：抗营养因子（植酸/单宁/胰蛋白酶抑制剂/皂苷）
   - 法规层面：GB 2760 限量标准、特殊人群禁忌

2. **Level 2 - 三级阈值预警** (`SafetyAlertSystem`)：
   - 蓝色预警 (<80% 阈值)：提示关注
   - 黄色预警 (80-100%)：建议调整
   - 红色阻断 (>100%)：禁止通过

3. **Level 3 - 配伍禁忌**：
   - 十八反、十九畏 内置规则
   - 特殊人群（孕妇/儿童/老人）禁忌药材列表

4. **Level 4 - 合规审核**：
   - GB 28050 营养成分表标准
   - 药食同源目录合规性
   - 审核工作流（草稿 → 待审核 → 通过/驳回 → 发布）

---

## 四、数据流图

```
用户输入目标功效 ["免疫调节", "抗氧化"]
         │
         ▼
┌─────────────────────────────────────────────┐
│  Step 1: 候选药材选择                        │
│  _EFFICACY_TO_HERBS["免疫调节"] → [hq,ds,rs,fp...] │
│  _EFFICACY_TO_HERBS["抗氧化"]  → [gz,cyh,jgh...] │
│  合并 → 去重 → 排序 → 取 Top25              │
└────────────────────────┬────────────────────┘
                         ▼
┌─────────────────────────────────────────────┐
│  Step 2: 算法优化搜索                        │
│  ┌─────────────────────────────────────┐   │
│  │ Genetic: 50个体 × 40代 × 自适应变异   │   │
│  │ Bayesian: 10初始采样 × 30轮EI优化     │   │
│  │ NSGA-II: Pareto 前沿 50个非支配解     │   │
│  │ BinaryGA+MILP: 离散选择+连续配比     │   │
│  └─────────────────────────────────────┘   │
└────────────────────────┬────────────────────┘
                         ▼
┌─────────────────────────────────────────────┐
│  Step 3: 多维评估                            │
│  · 功效评分（几何平均多功效）                │
│  · 安全评分（基础安全 × 配伍禁忌惩罚）       │
│  · 口感评分（五味调和 MSE）                  │
│  · 成本评分（归一化 ≤50 元基准）            │
│  · 协同评分（三层模型）                      │
│  · 稳定性评分                              │
│  · 君臣佐使结构合规度                        │
└────────────────────────┬────────────────────┘
                         ▼
┌─────────────────────────────────────────────┐
│  Step 4: 深度验证                            │
│  · SynergyEngine: 5 机制协同分析             │
│  · CompatibilityChecker: 4 层兼容性检测       │
│  · SafetyAlertSystem: 三级阈值预警           │
│  · StabilityPredictor: 货架期预测            │
│  · TastePredictor: 风味档案预测              │
│  · EffectSimulator: PopPK/PD 效应曲线        │
└────────────────────────┬────────────────────┘
                         ▼
┌─────────────────────────────────────────────┐
│  Step 5: 输出                                │
│  · Top-N 候选配方（含完整评分明细）           │
│  · Pareto 前沿解集（多目标场景）             │
│  · GB 28050 营养成分表                      │
│  · 安全合规报告                              │
│  · 协同效应分析报告                          │
└─────────────────────────────────────────────┘
```

---

## 五、技术亮点与创新点

1. **多策略自动调度**：统一调度器根据问题特征（目标维数、候选规模、约束类型）自动选择最优算法，并持续通过 Bandit 学习优化策略选择
2. **TCM 知识驱动**：从初始化阶段就注入经典方剂种子和君臣佐使结构约束，而非纯随机搜索
3. **混合整数优化**：BinaryGA+MILP 将药材选择（离散）和配比优化（连续）解耦，兼顾搜索效率和精度
4. **先验知识注入**：贝叶斯优化的 GP 模型通过协同偏置和禁忌抑制注入 TCM 配伍知识
5. **多层验证体系**：从化学相容性到法规合规性，四层检测确保配方安全
6. **自适应进化**：变异率动态调节 + 多样性恢复机制，防止早熟收敛
7. **历史记忆**：统一调度器记录历史运行结果，相似问题自动复用最优策略

---

## 六、关键文件索引

| 用途 | 路径 |
|---|---|
| 配方生成入口 API | `backend/app/api/ai_modules/generation.py` |
| 配方 CRUD + 审核 | `backend/app/api/formulas.py` |
| 遗传算法核心 | `backend/app/services/ai/algorithms/genetic_formula_optimizer.py` |
| 贝叶斯优化核心 | `backend/app/services/ai/algorithms/bayesian_formula_optimizer.py` |
| NSGA-II 核心 | `backend/app/services/ai/algorithms/multi_objective_optimizer.py` |
| 统一调度器 | `backend/app/services/ai/algorithms/unified_optimizer.py` |
| 协同效应引擎 | `backend/app/services/formula/synergy_engine.py` |
| 兼容性检测 | `backend/app/services/formula/compatibility_checker.py` |
| 安全预警 | `backend/app/services/formula/safety_alert_system/core.py` |
| 配方服务 | `backend/app/services/formula/formula_module.py` |
| 营养计算 | `backend/app/services/formula/nutrition_service.py` |
| 配方属性预测 | `backend/app/services/ai/models/formula_predictor.py` |
| 配方模型定义 | `backend/app/domain/models/formula_model.py` |
| 配方 Schema | `backend/app/schemas/formula.py` |
| 配方数据库模型 | `backend/app/models/formula.py` |
