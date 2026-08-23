# RMFOOD 核心配方生成模块 · 深度开发方案 v1.0

> **制定日期**：2026-08-10  
> **制定人**：AI 专家评审组  
> **适用范围**：backend/app/services/formula/ + frontend/src/components/formula/

---

## 一、现状诊断与差距分析

### 1.1 当前架构全景

```
配方生成管线 (Formula Generation Pipeline)
┌────────────────────────────────────────────────────────────────────┐
│                     FormulaIntegrationService                      │
│                          (编排层)                                  │
├──────────┬──────────┬──────────┬──────────┬──────────┬────────────┤
│Synergy   │Ratio     │Compat    │Effect    │Safety   │Nutrition   │
│Engine    │Optimizer │Checker   │Simulator │Alert     │Adapter     │
│(协同引擎) │(NSGA-III) │(4层检测) │(PopPK/PD) │(安全告警) │(营养适配)  │
└──────────┴──────────┴──────────┴──────────┴──────────┴────────────┘
         │           │           │           │           │
    5种协同机制   4维目标优化  化学/药理/   一室模型+    规则引擎    中国食物
    Bliss/PK/     NSGA-III   营养/法规层  Sigmoid Emax  成分库      成分表
    Gibbs/Network Pharmacology/Taste  PopPK/PD
    Matrix
┌────────────────────────────────────────────────────────────────────┐
│                      AI 增强层                                     │
├──────────────────┬──────────────────┬──────────────────────────────┤
│  LLM 生成 (备选) │  PepINVENT 肽生成 │  RAG 知识检索               │
│  GPT-4/DeepSeek  │  RDKit+PyTorch   │  Elasticsearch + Neo4j      │
└──────────────────┴──────────────────┴──────────────────────────────┘
```

### 1.2 关键差距表

| 维度 | 当前状态 | 目标状态 | 差距 |
|------|----------|----------|------|
| 知识数据覆盖 | 10味/7味 | 50+味/40+味 | 🔴 严重不足 |
| 测试覆盖 | 核心模块 0% | ≥80% | 🔴 高风险 |
| 管线并行度 | 串行 5 步 | 并行 3+2 | 🟡 性能瓶颈 |
| 算法多样性 | 仅 NSGA-III | NSGA-III + MOEA/D + 粒子群 | 🟡 单一 |
| 前端可视化 | 基础图表 | 3D 分子结构 + 动态桑基图 | 🟡 体验待提升 |
| 数据溯源 | 无版本控制 | 完整审计日志 | 🟡 合规风险 |
| 性能 | 串行 ~15s | 并行 <3s | 🔴 高优先级 |

---

## 二、开发阶段规划

### Phase 1：知识数据底座建设（2周）

**目标**：建立完整、可溯源的知识数据库，支撑上层算法

#### 1.1 PK/PD 参数数据库扩展

**文件**：`backend/app/services/formula/effect_simulator.py`

| 成分类别 | 当前覆盖 | 目标覆盖 | 数据来源 |
|----------|----------|----------|----------|
| 肽类 | 2味 | 15味 | PepINVENT + 文献 |
| 多糖类 | 2味 | 12味 | 中国药典 |
| 皂苷类 | 1味 | 10味 | TCMSP |
| 黄酮类 | 1味 | 10味 | OpenFoodFacts |
| 维生素/矿物质 | 1味 | 5味 | 中国食物成分表 |

**实施步骤**：
```python
# 新增：PK_PARAMETERS_DB 扩展
PK_PARAMETERS_DB = {
    # 现有 7 味保持不变...
    # 新增成分（示例）
    "人参皂苷Rg1": {
        "F": 0.20, "ka": 1.5, "Vd": 0.8, "CL": 0.35, "t_lag": 0.4,
        "source": "TCMSP:DP000123", "文献": "Zhao et al. 2020"
    },
    "黄芪甲苷": {
        "F": 0.15, "ka": 1.2, "Vd": 1.2, "CL": 0.28, "t_lag": 0.5,
        "source": "TCMSP:DP000456", "文献": "Li et al. 2019"
    },
    # ... 扩展到 40+ 味
}
```

#### 1.2 营养数据库扩展

**文件**：`backend/app/services/formula/nutrition_service.py`

- 目标：从 10 味扩展到 50+ 味标准药材
- 数据源：《中国食物成分表 标准版 第6版》
- 字段：protein/fat/carbohydrate/dietary_fiber/sodium/calcium/iron/zinc/vitamin_a/vitamin_c

#### 1.3 兼容性规则库建设

**文件**：`backend/app/services/formula/compatibility_checker.py`

| 规则类别 | 当前 | 目标 | 来源 |
|----------|------|------|------|
| 沉淀反应 | 3条 | 20条 | 《中药复配禁忌研究》 |
| 酶互作 | 2条 | 8条 | DrugBank + CYP数据库 |
| 受体竞争 | 2条 | 10条 | ChEMBL |
| 抗营养因子 | 1条 | 5条 | FAO/WHO |
| 法规限制 | 0条 | 15条 | GB 14880, GB 2760 |

#### 1.4 协同系数库版本化管理

**文件**：`backend/data/synergy/`

```json
{
  "version": 3,
  "updated_at": "2026-08-10",
  "source": "人工标定 + 文献提取",
  "coefficients": [
    {
      "ingredient_a": "黄芪多糖",
      "ingredient_b": "大豆肽",
      "mechanism": "bliss_independence",
      "coefficient": 0.35,
      "confidence": 0.8,
      "source_paper": "张等. 2023",
      "experiment_id": "EXP-2023-001"
    }
  ]
}
```

**新增功能**：
- 系数来源可追溯（文献DOI/实验ID）
- 置信度评分机制
- 版本历史查询 API

---

### Phase 2：算法增强（3周）

**目标**：提升算法科学深度和搜索效率

#### 2.1 NSGA-III 优化升级

**文件**：`backend/app/services/formula/ratio_optimizer.py`

**问题诊断**：
- 硬编码 5 对拮抗组合，远不足实际药食同源拮抗关系
- 固定种群大小，无自适应策略
- 缺少收敛性监测

**实施方案**：

```python
# 新增：自适应种群策略
class AdaptivePopulationStrategy:
    """根据搜索空间动态调整种群大小"""
    
    def __init__(self, base_size: int = 100):
        self.base_size = base_size
        self.generation = 0
        self.diversity_history: List[float] = []
    
    def get_population_size(self, diversity: float) -> int:
        """多样性低时增大种群"""
        if diversity < 0.3:
            return int(self.base_size * 1.5)
        elif diversity > 0.7:
            return int(self.base_size * 0.8)
        return self.base_size

# 新增：动态约束库加载
class AntagonisticPairsLoader:
    """从数据库加载拮抗对，替代硬编码"""
    
    def __init__(self, db_session: AsyncSession):
        self.db = db_session
    
    async def get_pairs(self) -> Set[Tuple[str, str]]:
        """从 compatibility_rules 表加载"""
        result = await self.db.execute(
            select(CompatibilityRule).where(
                CompatibilityRule.rule_type == "antagonism"
            )
        )
        return {(r.ingredient_a, r.ingredient_b) for r in result.scalars()}
```

#### 2.2 多算法融合

**新增文件**：`backend/app/services/formula/multi_algorithm_orchestrator.py`

| 算法 | 适用场景 | 优势 |
|------|----------|------|
| NSGA-III | 4+ 维目标优化 | 良好多样性 |
| MOEA/D | 高维目标（5+维） | 分解策略 |
| 粒子群优化(PSO) | 连续空间快速收敛 | 速度快 |
| 模拟退火(SA) | 局部搜索精化 | 跳出局部最优 |

**编排逻辑**：
```python
async def optimize_with_multiple_algorithms(
    ingredients: List[Ingredient],
    constraints: Dict,
    time_budget: float = 30.0
) -> ParetoFrontier:
    """多算法并行搜索 + 结果融合"""
    
    # Phase 1: 并行启动各算法
    tasks = [
        asyncio.create_task(run_nsga3(ingredients, constraints)),
        asyncio.create_task(run_moead(ingredients, constraints)),
        asyncio.create_task(run_pso(ingredients, constraints)),
    ]
    
    # Phase 2: 收集结果，取并集
    results = await asyncio.gather(*tasks)
    unified_frontier = merge_pareto_frontiers(results)
    
    # Phase 3: 局部精化
    refined = await refine_with_sa(unified_frontier, constraints)
    
    return refined
```

#### 2.3 风味预测模型

**新增文件**：`backend/app/services/formula/taste_predictor.py`

- 基于现有 TasteMatrix 扩展为 ML 预测模型
- 输入：成分列表 + 比例
- 输出：苦涩度、鲜味度、总体接受度评分
- 训练数据：历史配方评分 + 人工标注

#### 2.4 稳定性预测模型

**新增文件**：`backend/app/services/formula/stability_predictor.py`

- 预测配方在储存条件下的稳定性
- 考虑因素：pH、温度、光照、成分相互作用
- 输出：预计 shelf_life + 降解速率

---

### Phase 3：性能优化（2周）

**目标**：将配方生成时间从 ~15s 降至 <3s

#### 3.1 管线并行化

**当前**：5 模块串行执行
**目标**：Synergy + Compatibility 并行，Effect + Safety 并行

```python
# 新增并行编排
async def orchestrate_deep_generation(request):
    # Phase 1: 独立模块并行
    synergy_task = asyncio.create_task(
        self.synergy_engine.analyze_synergy(...)
    )
    compat_task = asyncio.create_task(
        self.compatibility_checker.check(...)
    )
    synergy_report, compat_report = await asyncio.gather(
        synergy_task, compat_task
    )
    
    # Phase 2: 依赖 Phase 1 的模块并行
    ratio_task = asyncio.create_task(
        self.ratio_optimizer.optimize_ratio(...)
    )
    effect_task = asyncio.create_task(
        self.effect_simulator.simulate(...)
    )
    ratio_result, effect_result = await asyncio.gather(
        ratio_task, effect_task
    )
    
    # Phase 3: 最终安全校验
    safety_result = await self.safety_alert_system.check(...)
    
    return DeepGenerationResponse(...)
```

#### 3.2 缓存策略升级

**文件**：`backend/app/services/formula/nutrition_cache.py`

```python
class EnhancedNutritionCache:
    """支持增量更新和预加载的缓存"""
    
    def __init__(self):
        self._cache: Dict[frozenset, NutritionSnapshot] = {}
        self._lru_order: OrderedDict = OrderedDict()
        self._lock = asyncio.Lock()  # 异步锁
        self._stats = {"hits": 0, "misses": 0}
    
    async def get_or_compute(
        self, herb_ids: Iterable[str], 
        compute_fn: Callable
    ) -> NutritionSnapshot:
        """原子化 get-or-compute，避免竞态"""
        async with self._lock:
            key = frozenset(herb_ids)
            if key in self._cache:
                self._stats["hits"] += 1
                self._move_to_front(key)
                return self._cache[key]
            
            # 缓存未命中，计算并存储
            snapshot = await compute_fn()
            self._cache[key] = snapshot
            self._stats["misses"] += 1
            self._evict_if_needed()
            return snapshot
    
    def get_hit_rate(self) -> float:
        total = self._stats["hits"] + self._stats["misses"]
        return self._stats["hits"] / total if total > 0 else 0.0
```

#### 3.3 预计算策略

**文件**：`backend/app/services/formula/precomputed_cache.py`

```python
class PrecomputedCache:
    """预计算高频组合的搜索结果"""
    
    def __init__(self):
        self._cache: Dict[str, Any] = {}
    
    async def preload_common_combinations(self):
        """启动时预计算常见配方组合"""
        common_herb_groups = [
            ["黄芪", "人参", "枸杞"],      # 免疫增强
            ["大豆肽", "胶原蛋白肽"],       # 美容养颜
            ["菊花", "枸杞", "决明子"],     # 明目
            # ... 更多常见组合
        ]
        for group in common_herb_groups:
            key = tuple(sorted(group))
            result = await self._compute_result(group)
            self._cache[key] = result
    
    async def get_cached(self, herbs: List[str]) -> Optional[Any]:
        key = tuple(sorted(herbs))
        return self._cache.get(key)
```

---

### Phase 4：测试体系建设（2周）

**目标**：核心模块测试覆盖率达 80%+

#### 4.1 单元测试补全

**新增测试文件**：

| 测试文件 | 目标行数 | 覆盖模块 |
|----------|----------|----------|
| `test_synergy_engine.py` | 800+ | SynergyEngine 全部方法 |
| `test_compatibility_checker.py` | 600+ | 4层检测逻辑 |
| `test_ratio_optimizer.py` | 500+ | NSGA-III 核心逻辑 |
| `test_effect_simulator.py` | 400+ | PK/PD 计算 |
| `test_lp_solver.py` | 300+ | MILP 求解正确性 |
| `test_nutrition_cache.py` | 200+ | 缓存命中率/淘汰策略 |
| `test_integration_service.py` | 400+ | 管线编排 |

#### 4.2 测试用例设计模板

```python
# backend/tests/test_synergy_engine.py
import pytest
from app.services.formula.synergy_engine import SynergyEngine
from app.services.formula.synergy_models import MechanismType


class TestSynergyEngine:
    @pytest.fixture
    def engine(self):
        return SynergyEngine()
    
    # === Bliss Independence 测试 ===
    def test_bliss_independence_synergy(self, engine):
        """测试正向协同：两成分协同增强"""
        result = engine.bliss_independence(
            efficacy_a=0.7, efficacy_b=0.6, alpha=0.5
        )
        assert result.score > 0.7 + 0.6 - 0.7*0.6  # 大于独立作用
        assert result.mechanism_type == MechanismType.BLISS_INDEPENDENCE
    
    def test_bliss_independence_antagonism(self, engine):
        """测试拮抗作用：负 alpha"""
        result = engine.bliss_independence(
            efficacy_a=0.7, efficacy_b=0.6, alpha=-0.3
        )
        assert result.score < 0.7 + 0.6 - 0.7*0.6  # 小于独立作用
    
    def test_bliss_independence_boundary(self, engine):
        """边界值测试：efficacy 范围 [0,1]"""
        with pytest.raises(ValueError):
            engine.bliss_independence(efficacy_a=1.5, efficacy_b=0.5)
    
    # === 协同系数持久化测试 ===
    def test_coefficient_persistence(self, engine, tmp_path):
        """测试系数保存和加载"""
        # 添加自定义系数
        engine.add_coefficient(
            ingredient_a="测试A",
            ingredient_b="测试B",
            mechanism="bliss_independence",
            coefficient=0.5,
            source="test",
            confidence=0.9
        )
        # 保存
        engine.save_coefficients()
        # 重新加载
        engine2 = SynergyEngine(config=engine.config)
        loaded = engine2.get_coefficient("测试A", "测试B", "bliss_independence")
        assert loaded == 0.5
    
    # === 综合分析测试 ===
    def test_analyze_synergy_full(self, engine):
        """完整协同分析流程"""
        report = engine.analyze_synergy(
            ingredient_a="黄芪多糖",
            ingredient_b="大豆肽",
            context={
                "bliss": {"efficacy_a": 0.7, "efficacy_b": 0.6},
                "pk": {"auc_a": 100, "auc_b": 80, "auc_combination": 220},
                "gibbs": {"delta_h": -20, "delta_s": 50},
                "network": {
                    "targets_a": ["EGFR", "VEGF"],
                    "targets_b": ["EGFR", "IL6"]
                },
                "taste": {
                    "taste_profile_a": {"bitter": 0.3, "umami": 0.2},
                    "taste_profile_b": {"bitter": 0.4, "sweet": 0.3}
                }
            }
        )
        assert report.overall_si >= 0
        assert report.dominant_mechanism is not None
        assert len(report.mechanisms) == 5
```

#### 4.3 集成测试

**文件**：`backend/tests/test_formula_pipeline.py`

```python
class TestFormulaGenerationPipeline:
    """完整管线集成测试"""
    
    @pytest.mark.asyncio
    async def test_end_to_end_generation(self):
        """端到端配方生成测试"""
        service = FormulaIntegrationService()
        request = DeepGenerationRequest(
            ingredients=[
                {"name": "黄芪多糖", "efficacy": 0.7},
                {"name": "大豆肽", "efficacy": 0.6},
            ],
            target_efficacy = 0.75,
            safety_priority = True
        )
        result = await service.orchestrate_deep_generation(request)
        
        assert result.success
        assert result.optimized_ratios
        assert result.synergy_report
        assert result.compatibility_report
        assert result.effect_prediction
        assert result.safety_check
    
    @pytest.mark.asyncio
    async def test_pipeline_performance(self):
        """性能基准测试"""
        service = FormulaIntegrationService()
        request = DeepGenerationRequest(...)
        
        start = time.perf_counter()
        result = await service.orchestrate_deep_generation(request)
        elapsed = time.perf_counter() - start
        
        assert elapsed < 5.0  # 目标 <5秒
        assert result.success
```

---

### Phase 5：前端增强（2周）

**目标**：提升配方设计体验和数据可视化深度

#### 5.1 3D 分子结构可视化

**新增文件**：`frontend/src/components/formula/MoleculeViewer3D.tsx`

- 使用 Three.js / React-Three-Fiber
- 展示活性成分的分子结构
- 支持旋转、缩放、旋转查看键合关系

#### 5.2 动态桑基图

**新增文件**：`frontend/src/components/formula/SankeyDiagram.tsx`

- 展示成分 → 功效 → 靶点的能量流动
- 动态更新：调整比例时实时刷新

#### 5.3 实时协同热力图

**新增文件**：`frontend/src/components/formula/SynergyHeatmap.tsx`

- 矩阵展示所有成分对的协同强度
- 颜色编码：绿色=协同，红色=拮抗

#### 5.4 配方对比工具

**新增文件**：`frontend/src/components/formula/FormulaComparison.tsx`

- 多方案并排对比
- Pareto 前沿可视化
- 差异高亮

---

### Phase 6：安全与合规加固（1周）

**目标**：消除已知安全风险，满足生产要求

#### 6.1 配置文件安全

**文件**：`.env.example`

```diff
- ADMIN_PASSWORD=admin123
+ ADMIN_PASSWORD=<FROM_ENV>
```

**文件**：`docker-compose.prod.yml`

```diff
- CORS_ORIGINS: '["*"]'
+ CORS_ORIGINS: '["https://rmfood.example.com"]'
```

#### 6.2 输入验证强化

**文件**：`backend/app/api/ai_modules/generation.py`

```python
from pydantic import field_validator

class FormulaGenerateRequest(BaseModel):
    target_effects: list[str] = Field(..., min_length=1, max_length=5)
    
    @field_validator("target_effects")
    @classmethod
    def validate_effects(cls, v):
        allowed = {"immune", "antiaging", "energy", "cognitive", 
                   "bone", "digestive", "cardiovascular"}
        for effect in v:
            if effect not in allowed:
                raise ValueError(f"无效功效: {effect}")
        return v
```

#### 6.3 依赖漏洞扫描

**文件**：`.github/workflows/security-scan.yml`

```yaml
name: Security Scan
on: [push, pull_request]
jobs:
  audit:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Python dependency audit
        run: pip-audit --requirement backend/requirements/prod.txt
      - name: Node.js dependency audit
        run: npm audit --production
```

---

## 三、里程碑与交付物

| 阶段 | 时间 | 交付物 | 验收标准 |
|------|------|--------|----------|
| Phase 1 | W1-W2 | PK/PD 数据库(40+味)、营养库(50+味)、兼容规则库(50+条) | 数据覆盖度 ≥90% |
| Phase 2 | W3-W5 | 多算法融合、自适应种群、风味/稳定性预测 | 算法多样性 + 预测准确率 |
| Phase 3 | W6-W7 | 并行管线、增强缓存、预计算 | 生成时间 <3s，缓存命中率 >80% |
| Phase 4 | W8-W9 | 单元测试套件、集成测试、覆盖率报告 | 核心模块覆盖 ≥80% |
| Phase 5 | W10-W11 | 3D 可视化、桑基图、热力图、对比工具 | UX 评审通过 |
| Phase 6 | W12 | 安全加固、漏洞修复、合规检查 | OWASP Top 10 无高危 |

---

## 四、风险与应对

| 风险 | 概率 | 影响 | 应对措施 |
|------|------|------|----------|
| 数据获取困难 | 中 | 高 | 优先获取核心药材数据，其余用插值估算 |
| 算法收敛问题 | 低 | 中 | 保留 NSGA-III 作为基准，多算法并行备选 |
| 测试环境不稳定 | 中 | 中 | 使用 fixtures + mock，减少外部依赖 |
| 前端性能问题 | 低 | 低 | 使用虚拟滚动 + 按需加载 |
| 团队技能缺口 | 低 | 中 | 安排 NSGA-III 和 Three.js 专项学习 |

---

## 五、技术栈变更

| 新增依赖 | 用途 | 版本 |
|----------|------|------|
| `cmaes` | CMA-ES 优化算法 | >=3.1.0 |
| `pymoo` | 多目标优化框架 | >=0.6.0 |
| `@react-three/fiber` | 3D 可视化 | >=8.0.0 |
| `three` | 3D 渲染引擎 | >=0.160.0 |
| `d3-sankey` | 桑基图 | >=0.12.3 |

---

## 六、代码变更清单

### 后端新增/修改文件

| 文件路径 | 操作 | 预估行数 |
|----------|------|----------|
| `app/services/formula/pk_database.py` | 新增 | 300 |
| `app/services/formula/nutrition_database.py` | 新增 | 400 |
| `app/services/formula/compatibility_rules.py` | 新增 | 350 |
| `app/services/formula/multi_algorithm_orchestrator.py` | 新增 | 250 |
| `app/services/formula/taste_predictor.py` | 新增 | 200 |
| `app/services/formula/stability_predictor.py` | 新增 | 180 |
| `app/services/formula/precomputed_cache.py` | 新增 | 150 |
| `app/services/formula/ratio_optimizer.py` | 修改 | +150 |
| `app/services/formula/integration_service.py` | 修改 | +100 |
| `tests/test_synergy_engine.py` | 新增 | 300 |
| `tests/test_compatibility_checker.py` | 新增 | 250 |
| `tests/test_ratio_optimizer.py` | 新增 | 200 |
| `tests/test_effect_simulator.py` | 新增 | 150 |
| `tests/test_formula_pipeline.py` | 新增 | 200 |

### 前端新增/修改文件

| 文件路径 | 操作 | 预估行数 |
|----------|------|----------|
| `components/formula/MoleculeViewer3D.tsx` | 新增 | 250 |
| `components/formula/SankeyDiagram.tsx` | 新增 | 200 |
| `components/formula/SynergyHeatmap.tsx` | 新增 | 180 |
| `components/formula/FormulaComparison.tsx` | 新增 | 220 |
| `pages/formula/FormulaDesignerPage.tsx` | 修改 | +100 |

---

## 七、验收标准

### 功能验收
- [ ] 配方生成支持 50+ 味药材
- [ ] PK/PD 参数覆盖 40+ 味
- [ ] 协同分析支持 5 种机制
- [ ] 多算法融合输出 Pareto 前沿
- [ ] 风味/稳定性预测可用

### 性能验收
- [ ] 配方生成时间 < 3 秒（5 成分以内）
- [ ] 缓存命中率 > 80%
- [ ] 前端首屏加载 < 2 秒

### 质量验收
- [ ] 核心模块单元测试覆盖率 ≥ 80%
- [ ] 集成测试 100% 通过
- [ ] 无高危安全漏洞
- [ ] TypeScript 编译零错误

### 合规验收
- [ ] 数据溯源完整（来源可查）
- [ ] 符合 GB 14880、GB 2760 法规
- [ ] 多租户数据隔离验证通过

---

**方案制定**：AI 专家评审组  
**版本**：v1.0  
**日期**：2026-08-10
