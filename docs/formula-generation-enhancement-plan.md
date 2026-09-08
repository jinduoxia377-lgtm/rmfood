# 配方生成模块完善方案

> 基于遗传算法的深度分析与架构升级方案
> 
> 版本: v1.0.0  
> 日期: 2026-01-15  
> 状态: 提案

---

## 一、现状诊断

### 1.1 架构优势

| 维度 | 现状 | 评分 |
|------|------|------|
| 算法多样性 | 双引擎(GA+NSGA-II) + 混合优化 | ⭐⭐⭐⭐⭐ |
| 领域知识 | TCM经典方剂种子 + 五味调和模型 | ⭐⭐⭐⭐⭐ |
| 多维评估 | 7维评分体系(功效/安全/口感/成本/协同/稳定/ADMET) | ⭐⭐⭐⭐⭐ |
| 工程健壮性 | 院士级修复 + 惰性加载 + 早停机制 | ⭐⭐⭐⭐ |
| 前端体验 | SSE流式推送 + 进度可视化 | ⭐⭐⭐⭐ |

### 1.2 存在问题

#### P0 - 关键缺陷

| ID | 问题 | 影响 | 优先级 |
|----|------|------|--------|
| GA-001 | 前后端API路由不统一（前端调用`/ai/generate`但后端无此路由） | 功能不可用 | 🔴 高 |
| GA-002 | 统一优化器策略选择逻辑冗余，未充分利用历史数据 | 用户体验不一致 | 🔴 高 |
| GA-003 | 中药知识库与算法引擎耦合过紧，缺乏抽象层 | 难以扩展新药材库 | 🟡 中 |
| GA-004 | 前端无参数调优UI，用户无法控制算法行为 | 灵活性不足 | 🟡 中 |

#### P1 - 重要改进

| ID | 问题 | 影响 | 优先级 |
|----|------|------|--------|
| GA-005 | 五味调和模型理想比例硬编码，缺乏个性化调整 | 口感评估不准确 | 🟡 中 |
| GA-006 | 君臣佐使结构评估未与功效目标联动 | 结构合规度失真 | 🟡 中 |
| GA-007 | 缺少配方解释生成模块 | 用户信任度低 | 🟡 中 |
| GA-008 | 前端结果展示单一，缺少Pareto前沿可视化 | 决策辅助不足 | 🟢 低 |

#### P2 - 体验优化

| ID | 问题 | 影响 | 优先级 |
|----|------|------|--------|
| GA-009 | 缺少个性化约束（过敏原、饮食禁忌）传递链路 | 安全性风险 | 🟡 中 |
| GA-010 | 历史配方推荐未融入生成流程 | 复用效率低 | 🟢 低 |
| GA-011 | 缺少A/B测试框架评估不同策略效果 | 迭代优化困难 | 🟢 低 |

---

## 二、完善方案总览

```
Phase 1 (第1周)    Phase 2 (第2周)      Phase 3 (第3周)      Phase 4 (第4周)
┌─────────────┐   ┌─────────────┐    ┌─────────────┐     ┌─────────────┐
│ 核心修复    │   │ 算法增强    │    │ 前端升级    │     │ 生产就绪    │
│ GA-001/002  │ → │ GA-003/005 │ →  │ GA-008/009  │ →   │ GA-010/011  │
│ API统一     │   │ 知识解耦    │    │ UI重构      │     │ 监控完善    │
│             │   │ 可调参数    │    │ 可视化增强  │     │ 文档完善    │
└─────────────┘   └─────────────┘    └─────────────┘     └─────────────┘
```

---

## 三、详细实施方案

### Phase 1: 核心修复（API统一与路由打通）

#### 3.1 任务：修复前后端API断链

**问题**：前端调用`/ai/generate`，但后端只有`/generate/genetic`等路由

**方案A：补全后端路由**
```python
# backend/app/api/ai_modules/generate.py (新建)
@router.post("/generate", summary="统一配方生成入口")
async def generate_formula(
    req: FormulaGenerationRequest,
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
):
    """
    统一生成入口，自动选择最优策略
    - 使用 UnifiedFormulaOptimizer
    - 返回标准格式结果
    """
    from ...services.ai.algorithms.unified_optimizer import (
        get_unified_optimizer, OptimizationRequest
    )
    
    optimizer = get_unified_optimizer()
    request = OptimizationRequest(
        target_effects=req.target_effects,
        strategy=req.strategy or "auto",
        population_size=req.population_size or 50,
        generations=req.generations or 40,
        # ... 其他参数映射
    )
    
    result = optimizer.optimize(request)
    
    return {
        "candidates": result.candidates,
        "total": len(result.candidates),
        "generator": result.strategy_used,
        "execution_time_ms": result.execution_time_ms,
    }
```

**方案B：统一前端调用**（推荐）
```typescript
// frontend/src/api/ai.ts
export const aiApi = {
  // 统一生成入口
  generate: async (params: GenerateParams, signal?: AbortSignal) => {
    // 根据策略自动选择后端接口
    const endpoints: Record<string, string> = {
      'ga': '/ai/generate/genetic',
      'nsga2': '/ai/generate/multi-objective',
      'ga_lp_hybrid': '/ai/generate/genetic/hybrid',
      'auto': '/ai/generate/unified',
    };
    
    const endpoint = endpoints[params.strategy] || endpoints['auto'];
    return api.post(endpoint, params, { signal, timeout: 120000 });
  },
};
```

**验收标准**：
- [ ] 前端点击"开始生成"后，后端能正确响应
- [ ] 日志显示策略选择过程
- [ ] 返回标准格式的候选配方列表

#### 3.2 任务：统一优化器策略选择优化

**当前问题**：
```python
# 策略选择逻辑存在冗余，Bandit学习未充分利用
if request.require_pareto:
    return ("nsga2", "...")  # 硬编码
# Bandit选择只考虑已实现策略
bandit_strategy = self.bandit.select(self.implemented_strategies)
```

**改进方案**：
```python
class UnifiedFormulaOptimizer:
    def select_strategy(self, request: OptimizationRequest) -> Tuple[str, str]:
        """智能策略选择（增强版）"""
        
        # 1. 用户显式指定
        if request.strategy != "auto":
            return self._validate_strategy(request.strategy)
        
        # 2. 检索历史最优策略（提高命中率）
        cached = self.search_history(
            request.target_effects,
            threshold=request.historical_similarity_threshold,
        )
        if cached and cached['best_score'] > 0.85:
            return (cached['strategy'], 
                    f"历史命中: 上次最优={cached['strategy']}, score={cached['best_score']:.3f}")
        
        # 3. 基于问题特征的启发式选择
        features = self._extract_problem_features(request)
        
        # 4. Bandit在线学习选择（加入exploration项）
        bandit_strategy = self._ucb_select(features, request)
        
        # 5. 记录问题特征供后续学习
        self._record_problem_context(request, features)
        
        return (bandit_strategy, self._explain_selection(bandit_strategy, features))
    
    def _ucb_select(self, features: Dict, request: OptimizationRequest) -> str:
        """UCB1-Tuned策略选择（改进版）"""
        strategies = self.available_strategies
        
        # 基于问题特征预筛选
        filtered = self._filter_by_features(strategies, features)
        
        # UCB1选择
        best_strategy = max(
            filtered,
            key=lambda s: self._ucb_value(s, request)
        )
        return best_strategy
    
    def _ucb_value(self, strategy: str, request: OptimizationRequest) -> float:
        """计算UCB值（加入特征加权）"""
        n_s = self.bandit.n_plays.get(strategy, 0)
        Q_s = self.bandit.Q_values.get(strategy, 0.0)
        N = self.bandit.N
        
        # 特征相似度调整探索系数
        feature_bonus = self._compute_feature_bonus(strategy, request)
        
        exploration = (1 + feature_bonus) * math.sqrt(math.log(max(N, 1)) / max(n_s, 1))
        
        return Q_s + exploration
```

**验收标准**：
- [ ] 相同功效目标的二次请求速度提升30%+
- [ ] Bandit统计信息可通过API查询

---

### Phase 2: 算法增强

#### 3.3 任务：知识层解耦（HerbKnowledgePort）

**当前问题**：
```python
# 硬编码依赖内置字典
from .bayesian_formula_optimizer import _BUILTIN_HERBS

class GeneticFormulaOptimizer:
    def __init__(self):
        self._herbs = dict(_BUILTIN_HERBS)  # 耦合！
```

**改进方案**：
```python
# backend/app/domain/herb_ports.py (新建)
from abc import ABC, abstractmethod
from typing import Dict, List, Optional
from dataclasses import dataclass

@dataclass
class HerbParameter:
    herb_id: str
    name_cn: str
    dosage_min: float
    dosage_max: float
    dosage_step: float
    efficacy_scores: Dict[str, float]
    safety_index: float
    cost_per_gram: float
    synergy_partners: List[str]
    antagonistic_pairs: List[str]
    flavor_type: str  # sweet/bitter/pungent/neutral/other
    nature: str       # 寒/凉/温/热/平
    meridian: str     # 归经

class HerbKnowledgePort(ABC):
    """药材知识端口 - 解耦数据源"""
    
    @abstractmethod
    async def get_herb(self, herb_id: str) -> Optional[HerbParameter]:
        pass
    
    @abstractmethod
    async def get_herbs_by_efficacy(self, effect: str) -> List[str]:
        pass
    
    @abstractmethod
    async def get_all_herbs(self) -> Dict[str, HerbParameter]:
        pass
    
    @abstractmethod
    async def search_herbs(self, keywords: List[str]) -> List[HerbParameter]:
        pass

# 内置实现
class BuiltinHerbKnowledge(HerbKnowledgePort):
    """基于内置字典的实现"""
    def __init__(self, herb_dict: Dict[str, HerbParameter]):
        self._herbs = herb_dict
        self._efficacy_index = self._build_efficacy_index()
    
    # ... 实现各方法

# 数据库实现
class DatabaseHerbKnowledge(HerbKnowledgePort):
    """基于数据库的实现"""
    def __init__(self, session_factory):
        self._session_factory = session_factory
    
    # ... 实现各方法
```

**算法层改造**：
```python
class GeneticFormulaOptimizer:
    def __init__(self, config=None, herb_knowledge: Optional[HerbKnowledgePort] = None):
        self.config = config or GAConfig()
        self._herb_knowledge = herb_knowledge
        self._herbs: Dict[str, HerbParameter] = {}
        
    def _load_herb_database(self) -> None:
        """从Port加载药材数据库"""
        if self._herb_knowledge is None:
            # 回退到内置字典
            self._herbs = self._load_builtin_herbs()
            return
        
        try:
            herbs = self._herb_knowledge.get_all_herbs()
            if herbs:
                self._herbs = herbs
                logger.info(f"从 HerbKnowledgePort 加载 {len(herbs)} 种药材")
            else:
                logger.warning("HerbKnowledgePort 返回空数据，回退内置字典")
                self._herbs = self._load_builtin_herbs()
        except Exception as e:
            logger.error(f"加载药材库失败: {e}，使用内置字典")
            self._herbs = self._load_builtin_herbs()
```

**验收标准**：
- [ ] 可注入不同的HerbKnowledge实现
- [ ] 内置字典作为默认回退
- [ ] 数据库实现可通过配置启用

#### 3.4 任务：五味调和个性化模型

**当前问题**：理想比例硬编码
```python
_IDEAL_RATIOS = {"sweet": 0.45, "neutral": 0.20, "bitter": 0.15, ...}
```

**改进方案**：
```python
class TasteModel:
    """五味调和个性化模型"""
    
    # 人群预设
    POPULATION_PRESETS = {
        "elderly": {"sweet": 0.50, "neutral": 0.25, "bitter": 0.10, ...},
        "children": {"sweet": 0.55, "neutral": 0.20, "bitter": 0.08, ...},
        "general": {"sweet": 0.45, "neutral": 0.20, "bitter": 0.15, ...},
    }
    
    def __init__(self, population: str = "general", custom_ratios: Dict = None):
        self._base_ratios = dict(self.POPULATION_PRESETS.get(population, {}))
        if custom_ratios:
            self._base_ratios.update(custom_ratios)
        self._normalize()
    
    def evaluate(self, genes: Dict[str, float]) -> float:
        """评估口感（支持个性化）"""
        # ... 原有MSE计算逻辑
        # 使用 self._base_ratios 替代硬编码
        
    def get_explanation(self, genes: Dict[str, float]) -> str:
        """生成口感评估解释"""
        total = sum(genes.values())
        flavor_dist = self._compute_flavor_distribution(genes, total)
        
        explanations = []
        for flavor, ratio in flavor_dist.items():
            ideal = self._base_ratios.get(flavor, 0)
            diff = ratio - ideal
            if abs(diff) > 0.05:
                direction = "偏高" if diff > 0 else "偏低"
                explanations.append(f"{self._FLAVOR_NAMES[flavor]}味{direction}")
        
        return "、".join(explanations) if explanations else "五味调和，口感均衡"
```

**API扩展**：
```python
class GeneticRequest(BaseModel):
    target_effects: List[str]
    # ... 原有字段
    
    # 新增：口感偏好
    taste_preference: Optional[str] = Field(
        None, 
        description="口感偏好: balanced/sweet_enhanced/bitter_reduced"
    )
    custom_taste_ratios: Optional[Dict[str, float]] = None
```

#### 3.5 任务：动态经典方剂种子库

**当前问题**：种子方剂硬编码在代码中

**改进方案**：
```python
# backend/app/services/ai/algorithms/classic_formulas.py
@dataclass
class ClassicFormula:
    name: str
    source: str           # 四君子汤、六味地黄丸等
    dynasty: str          # 朝代
    category: str         # 补气、补血、解表等
    herbs: Dict[str, float]  # {herb_id: dosage_g}
    indications: List[str]
    evidence_level: str   # 经典/验方/民间
    
    def to_genes(self, herb_db: Dict) -> Dict[str, float]:
        """转换为基因向量"""
        genes = {}
        for hid, dosage in self.herbs.items():
            if hid in herb_db:
                herb = herb_db[hid]
                clamped = max(herb.dosage_min, min(herb.dosage_max, dosage))
                clamped = round(clamped / herb.dosage_step) * herb.dosage_step
                genes[hid] = clamped
        return genes

# 经典方剂库（可外部加载）
CLASSIC_FORMULAS = [
    ClassicFormula(
        name="四君子汤",
        source="《太平惠民和剂局方》",
        dynasty="宋",
        category="补气",
        herbs={"ds": 9, "bq": 9, "fp": 9, "gq": 6},
        indications=["气虚", "食欲不振", "乏力"],
        evidence_level="经典",
    ),
    # ... 更多方剂
]

def load_classic_formulas(source: str = "builtin") -> List[ClassicFormula]:
    """从不同源加载经典方剂"""
    if source == "builtin":
        return CLASSIC_FORMULAS
    elif source == "database":
        # 从数据库加载扩展方剂库
        return fetch_from_database()
    elif source == "user":
        # 从用户收藏加载
        return fetch_user_formulas()
```

**种群初始化增强**：
```python
def _init_population(self, candidates: List[str]) -> List[Individual]:
    """增强版种群初始化"""
    population = []
    
    # 1. 功效匹配的经典方剂种子
    matched_formulas = self._select_relevant_formulas(self.config.target_effects)
    for formula in matched_formulas[:3]:  # 取最相关的3个
        genes = formula.to_genes(self._herbs)
        if len(genes) >= 3:
            population.append(Individual(genes))
    
    # 2. 用户历史配方种子（如有）
    user_history = self._load_user_history()
    for formula in user_history[:2]:  # 取最近使用的2个
        if self._is_similar_to_targets(formula, self.config.target_effects):
            population.append(Individual(formula.genes))
    
    # 3. 随机采样填充...
```

---

### Phase 3: 前端升级

#### 3.6 任务：算法参数可调UI

**新增组件**：`AlgorithmConfigPanel.tsx`

```typescript
// frontend/src/components/ai/features/GenerateTab/components/AlgorithmConfigPanel.tsx
interface AlgorithmConfig {
  strategy: 'ga' | 'nsga2' | 'hybrid' | 'auto';
  populationSize: number;
  generations: number;
  mutationRate: number;
  crossoverRate: number;
  eliteRatio: number;
  preset: 'balanced' | 'cost_first' | 'efficacy_first' | 'safety_first' | null;
}

export function AlgorithmConfigPanel({
  config,
  onChange,
  onApplyPreset,
}: {
  config: AlgorithmConfig;
  onChange: (config: AlgorithmConfig) => void;
  onApplyPreset: (preset: string) => void;
}) {
  return (
    <Card title="算法配置">
      {/* 策略选择 */}
      <div className="flex gap-2 mb-4">
        {['auto', 'ga', 'nsga2', 'hybrid'].map(s => (
          <Button
            key={s}
            variant={config.strategy === s ? 'primary' : 'outline'}
            onClick={() => onChange({...config, strategy: s})}
          >
            {STRATEGY_LABELS[s]}
          </Button>
        ))}
      </div>
      
      {/* 预设场景 */}
      <Select
        value={config.preset || ''}
        onChange={(v) => onApplyPreset(v)}
        options={PRESET_OPTIONS}
      />
      
      {/* 参数调节 */}
      <SliderField
        label="种群大小"
        value={config.populationSize}
        min={20}
        max={200}
        step={10}
        onChange={(v) => onChange({...config, populationSize: v})}
      />
      
      {/* ... 其他参数 */}
    </Card>
  );
}
```

#### 3.7 任务：Pareto前沿可视化

**新增组件**：`ParetoFrontChart.tsx`

```typescript
import React from 'react';
import { ScatterChart, Scatter, XAxis, YAxis, ZAxis, Tooltip, Legend } from 'recharts';

interface ParetoFrontChartProps {
  candidates: AICandidate[];
  objectives: Array<{ key: string; label: string; color: string }>;
}

export function ParetoFrontChart({ candidates, objectives }: ParetoFrontChartProps) {
  // 选择两个主要目标进行可视化
  const xKey = objectives[0].key;  // 功效
  const yKey = objectives[1].key;  // 安全
  
  return (
    <ScatterChart width={400} height={300}>
      <XAxis type="number" dataKey={xKey} name="功效" unit="" />
      <YAxis type="number" dataKey={yKey} name="安全" unit="" />
      <ZAxis type="number" dataKey="fitness" range={[50, 400]} name="综合得分" />
      <Tooltip cursor={{ strokeDasharray: '3 3' }} />
      <Legend />
      <Scatter 
        name="Pareto前沿" 
        data={candidates} 
        fill="#8884d8" 
        line={{ strokeWidth: 2 }}
      />
    </ScatterChart>
  );
}
```

#### 3.8 任务：个性化约束输入

**新增表单字段**：
```typescript
// frontend/src/components/ai/features/GenerateTab/components/ConstraintPanel.tsx
interface PersonalConstraints {
  // 人群信息
  ageGroup: 'children' | 'adult' | 'elderly' | 'pregnant';
  gender?: 'male' | 'female';
  
  // 禁忌信息
  allergies: string[];
  contraindications: string[];  // 禁用药材
  dietaryRestrictions: string[];
  
  // 健康指标
  conditions: string[];  // 如"高血压"、"糖尿病"
  
  // 烹饪条件
  cookingMethod: 'decoction' | 'tea' | 'soup' | 'paste';
  cookingTime?: number;  // 分钟
}
```

---

### Phase 4: 生产就绪

#### 3.9 任务：配方解释生成

**新增服务**：`FormulaExplanationService`

```python
# backend/app/services/ai/formula_explanation.py
class FormulaExplanationService:
    """配方解释生成服务"""
    
    def __init__(self, llm_service):
        self._llm = llm_service
    
    async def generate_explanation(
        self,
        candidate: Individual,
        target_effects: List[str],
        herb_db: Dict[str, HerbParameter],
    ) -> str:
        """生成配方解释"""
        
        # 1. 构建解释模板
        template = self._build_template(candidate, target_effects)
        
        # 2. LLM生成详细解释
        explanation = await self._llm.generate(
            prompt=template,
            temperature=0.7,
            max_tokens=500,
        )
        
        # 3. 后处理：添加科学机理
        enriched = await self._enrich_with_mechanism(
            explanation, candidate, herb_db
        )
        
        return enriched
    
    def _build_template(self, candidate: Individual, effects: List[str]) -> str:
        """构建解释模板"""
        herbs = ", ".join(
            f"{herb_db[hid].name_cn}({hid})" 
            for hid in candidate.genes.keys()
        )
        
        return f"""请为以下药食同源配方生成专业解释：

## 目标功效
{', '.join(effects)}

## 配方组成
{herbs}

## 各药材剂量
{json.dumps({herb_db[hid].name_cn: f"{dosage}g" for hid, dosage in candidate.genes.items()}, ensure_ascii=False, indent=2)}

请从以下角度解释：
1. 君臣佐使结构分析
2. 各药材在现代药理学中的作用机制
3. 配伍协同原理
4. 适用人群与禁忌"""
    
    async def _enrich_with_mechanism(
        self,
        explanation: str,
        candidate: Individual,
        herb_db: Dict[str, HerbParameter],
    ) -> str:
        """增强科学机理"""
        # 为每味药材添加活性成分和作用通路
        mechanisms = []
        for hid, dosage in candidate.genes.items():
            herb = herb_db.get(hid)
            if herb:
                # 查询活性成分数据库
                active_compounds = await self._query_active_compounds(hid)
                mechanisms.append(f"**{herb.name_cn}**：含{', '.join(active_compounds[:3])}等活性成分，通过调节XX通路发挥{herb.efficacy_scores}等功效。")
        
        return f"{explanation}\n\n## 科学机理\n{'\\n'.join(mechanisms)}"
    
    async def _query_active_compounds(self, herb_id: str) -> List[str]:
        """查询活性成分（需对接TCMSP等数据库）"""
        # TODO: 实现数据库查询
        return ["黄酮类", "皂苷", "多糖"]
```

#### 3.10 任务：A/B测试框架

**新增服务**：`ABTestService`

```python
# backend/app/services/ai/shared/ab_test.py
class ABTestService:
    """配方生成A/B测试服务"""
    
    def __init__(self, db_session_factory):
        self._db = db_session_factory
    
    async def assign_variant(self, user_id: int, context: Dict) -> str:
        """分配实验组"""
        # 基于用户ID哈希决定组别
        hash_val = int(hashlib.md5(f"{user_id}_{context['timestamp']}".encode()).hexdigest(), 16)
        variants = ['control', 'new_ga', 'nsga2']
        return variants[hash_val % len(variants)]
    
    async def record_experiment(
        self,
        experiment_id: str,
        variant: str,
        metrics: Dict[str, float],
    ) -> None:
        """记录实验指标"""
        record = ExperimentRecord(
            experiment_id=experiment_id,
            variant=variant,
            metrics=json.dumps(metrics),
            created_at=datetime.now(timezone.utc),
        )
        # ... 保存到数据库
    
    async def analyze_results(self, experiment_id: str) -> Dict:
        """分析实验结果"""
        # 统计各组的平均评分、收敛速度等
        pass
```

---

## 四、实施计划

### 4.1 时间规划

| 阶段 | 任务 | 工期 | 负责人 |
|------|------|------|--------|
| Phase 1 | API统一、策略优化 | 3天 | 后端 |
| Phase 2 | 知识解耦、五味模型 | 5天 | 算法 |
| Phase 3 | 前端UI升级 | 4天 | 前端 |
| Phase 4 | 解释生成、A/B测试 | 5天 | 全栈 |
| **总计** | | **17个工作日** | |

### 4.2 里程碑

```
Week 1: API统一完成，基本功能可用
Week 2: 算法增强上线，支持参数调节
Week 3: 前端升级完成，可视化增强
Week 4: 生产就绪，监控完善
```

### 4.3 风险评估

| 风险 | 概率 | 影响 | 缓解措施 |
|------|------|------|----------|
| 后端API兼容性破坏 | 中 | 高 | 保留旧接口，新增统一接口 |
| 药材数据库迁移失败 | 低 | 高 | 内置字典作为兜底 |
| 前端性能下降 | 中 | 中 | 增量加载、虚拟滚动 |
| 用户接受度低 | 低 | 中 | 渐进式上线、用户反馈闭环 |

---

## 五、验收标准

### 5.1 功能验收

- [ ] 前端点击生成后，能在30秒内返回候选配方
- [ ] 至少返回5个候选方案，包含完整评分
- [ ] 支持切换算法策略（GA/NSGA-II/混合）
- [ ] 支持预设场景快速选择
- [ ] 支持参数调节并实时生效

### 5.2 性能验收

- [ ] 单次生成响应时间 < 30秒
- [ ] 并发支持 ≥ 10 QPS
- [ ] 内存占用稳定，无泄漏

### 5.3 质量验收

- [ ] 单元测试覆盖率 ≥ 80%
- [ ] 集成测试通过
- [ ] 无P0/P1级别Bug

---

## 六、后续演进方向

### 6.1 短期（1-3个月）

1. **药材数据库扩充**
   - 接入TCMSP数据库
   - 支持自定义药材库导入

2. **深度学习集成**
   - 配方生成预训练模型
   - 功效-剂量预测网络

3. **多模态支持**
   - 图片识别药材
   - 语音输入症状

### 6.2 中期（3-6个月）

1. **个性化推荐**
   - 基于用户历史的配方推荐
   - 体质辨识与配方匹配

2. **临床验证闭环**
   - 用户反馈收集
   - 配方效果追踪

3. **协作功能**
   - 多人协同配方设计
   - 专家评审工作流

### 6.3 长期（6-12个月）

1. **知识图谱**
   - 药材-功效-通路知识图谱
   - 推理引擎增强

2. **自动化研发**
   - 从候选到临床的自动化流程
   - 实验设计建议

3. **生态开放**
   - 第三方药材库接入
   - 算法插件市场

---

## 附录

### A. 相关文件清单

| 文件 | 路径 | 说明 |
|------|------|------|
| 遗传算法核心 | `backend/app/services/ai/algorithms/genetic_formula_optimizer.py` | 单目标GA |
| NSGA-II算法 | `backend/app/services/ai/algorithms/algorithm.py` | 多目标优化 |
| 评估器 | `backend/app/services/ai/algorithms/evaluator.py` | 7维评分 |
| 统一优化器 | `backend/app/services/ai/algorithms/unified_optimizer.py` | 策略调度 |
| API路由 | `backend/app/api/ai_modules/genetic.py` | 接口定义 |
| 前端Hook | `frontend/src/components/ai/features/GenerateTab/hooks/useFormulaGeneration.ts` | 生成逻辑 |

### B. 参考资料

1. Deb, K., et al. (2002). "A fast elitist nondominated sorting genetic algorithm for multiobjective optimization: NSGA-II"
2. 《中华本草》编委会. (1999). 中华本草. 上海科学技术出版社.
3. TCMSP数据库: https://tcmsp-e.com/

---

**审批记录**

| 角色 | 姓名 | 日期 | 意见 |
|------|------|------|------|
| 产品负责人 | | | |
| 技术负责人 | | | |
| 算法专家 | | | |
