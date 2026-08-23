# RMFOOD 配方生成系统 — 深度评估与专业开发方案（终稿）

> 编制日期：2026-08-14
> 基于：`docs/中国普通配方设计思路`（7步法）+ 项目代码深度审查 + 数据库现状
> 文档状态：v2.0 终稿

---

## 第一部分：现状深度诊断

### 1.1 数据库资产盘点（确认数据充足）

| 数据源 | 表/文件 | 内容 | 规模 |
|--------|---------|------|------|
| **TCMHerb** | `tcm_herbs` | TCMSP数据库：OB/DL/化合物/靶点/疾病 | ~48+味 |
| **MMIDHerb** | `mmid_herbs` | 四气/五味/归经/功效原文/产地/炮制 | 完整 |
| **SymMapHerb** | `symmap_herbs` | 性味/归经/功效中英/交叉引用 | 完整 |
| **数据源文件** | `_herb_data_01~06.py` | 6部分扩展数据，含化合物/靶点 | ~242味 |
| **硬编码** | `_BUILTIN_HERBS` | 功效/安全/成本/配伍 | ~200味 |
| **营养库** | `HERB_NUTRITION_DB` | 蛋白质/脂肪/碳水/钠等 | ~20味 |

**结论：数据库层面数据充足，核心瓶颈不在数据量，而在数据连接与使用方式。**

### 1.2 现有架构全貌

```
┌─────────────────────────────────────────────────────────────────────┐
│                        当前架构健康度评估                            │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ✅ 已完备（无需建设）                                              │
│  ├── HerbKnowledgePort（领域接口）                                  │
│  ├── TCMSPHerbKnowledgeAdapter（数据库适配器）                      │
│  ├── HerbKnowledgeService（知识服务）                                │
│  ├── MILPSolver（精确配比求解器）                                    │
│  ├── SynergyEngine（5维协同分析）                                    │
│  ├── CompatibilityChecker（4层兼容性检测）                           │
│  ├── SafetyAlertSystem（三级预警）                                   │
│  ├── FormulaPredictor（7维属性预测）                                 │
│  └── GeneticFormulaOptimizer（GA+NSGA-II+贝叶斯+统一调度器）         │
│                                                                      │
│  ⚠️  已实现但未接入（修复即可）                                       │
│  ├── PyTorchFormulaGenerator（真正的LSTM，但未被调用）               │
│  ├── SignalEncoder（随机投影，需改为可学习嵌入）                     │
│  ├── RLFormulaTuner（骨架代码，缺梯度回传）                          │
│  └── AutoregressiveGenerator（启发式替代了LSTM）                    │
│                                                                      │
│  ❌ 完全缺失（需新建）                                              │
│  ├── Step 2 调色设计引擎                                           │
│  ├── Step 3 调香设计引擎                                           │
│  ├── Step 5 品质改良设计引擎                                       │
│  ├── 产品形态规则库                                                │
│  ├── 剂量计算器（MILP未接入生成流程）                               │
│  └── 七步统一编排引擎                                              │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### 1.3 核心差距分析

#### 🔴 G1: PyTorchGenerator 是孤岛代码

`pytorch_generator.py` 是唯一真正实现了 PyTorch LSTM 网络的模块，但 `unified_formula_engine.py` 从未使用它，而是调用了 `autoregressive_generator.py`（启发式随机采样）。

```python
# unified_formula_engine.py 当前调用的是：
from .autoregressive_generator import get_autoregressive_generator
self._generator = get_autoregressive_generator(herb_vocab=self.herb_vocab)
# ↑ 这是启发式版本，不是 PyTorchLSTM！
```

#### 🔴 G2: RL 训练回路断裂

`rl_tuner.py` 的 `train_step()` 只有一行无效的"损失"计算：

```python
loss = -advantage * self.lr  # 只是数值，没有 backward()/optimizer.step()
# 生成器没有 optimizer 属性，无法进行梯度回传
```

#### 🔴 G3: 信号编码器无学习能力

```python
# signal_encoder.py — 固定随机投影
self._EFFECT_PROJ = [
    [random.uniform(-0.1, 0.1) for _ in range(self.EFFECT_DIM)]
    for _ in range(n_effects)
]
# ↑ 随机噪声，不是可学习嵌入
```

即使未来训练 LSTM，输入信号也是无意义的。

#### 🔴 G4: 剂量分配用随机数而非 MILPSolver

```python
# autoregressive_generator.py: _assign_dosages()
ratio = 0.30 + random.uniform(-0.05, 0.10)  # 君药随机30-40%
# ↑ 而 MILPSolver 已完美实现且可用！
```

#### 🟠 G5: 七步中 4 步缺失

- Step 2 调色设计 → 完全缺失
- Step 3 调香设计 → 完全缺失
- Step 5 品质改良设计 → 完全缺失
- 产品形态规则 → 完全缺失

#### 🟠 G6: 规则引擎未前置到生成前

当前流程：生成 → 评估 → 惩罚
应为：前置过滤 → 生成 → 评估 → 修正

#### 🟡 G7: 预测器-生成器脱节

预测器仅在后验阶段评分，不实时反馈引导生成过程。

---

## 第二部分：七步专业开发方案

### 2.1 总体架构

```
┌─────────────────────────────────────────────────────────────────────┐
│                    七步配方生成引擎 v2.0                            │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  输入: target_effects + product_form + target_group + constraints   │
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ Step 1: 主体骨架设计 (Framework Engine)                      │   │
│  │  · 产品形态规则匹配 → 确定总剂量和角色比例                   │   │
│  │  · 药材选择 → 从数据库检索功效匹配药材                      │   │
│  │  · 剂量规划 → MILPSolver 精确求解                           │   │
│  │  · 前置规则过滤 → 排除禁忌配伍/超量药材                      │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                              ↓                                       │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ Step 2: 调色设计 (Color Engine)                              │   │
│  │  · 着色剂合规选择 (GB 2760)                                  │   │
│  │  · CIELAB 色彩混合预测                                        │   │
│  │  · 工艺适配检测 (pH/温度稳定性)                              │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                              ↓                                       │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ Step 3: 调香设计 (Fragrance Engine)                          │   │
│  │  · 香气轮廓建模 (Top/Mid/Base note)                          │   │
│  │  · 矫味剂匹配                                               │   │
│  │  · 香气-风味协调检查                                         │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                              ↓                                       │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ Step 4: 调味设计 (Flavor Engine)                             │   │
│  │  · 五味调和 (MSE模型升级)                                    │   │
│  │  · 味的增效/相乘/掩蔽/转化数学模型                           │   │
│  │  · 主体香味轮廓确定                                          │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                              ↓                                       │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ Step 5: 品质改良设计 (Quality Engine)                        │   │
│  │  · 增稠/乳化/水分保持/抗氧化/催化设计                        │   │
│  │  · HLB值计算、粘度模型、氧化动力学                            │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                              ↓                                       │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ Step 6: 防腐保鲜设计 (Preservation Engine)                   │   │
│  │  · 技术选型推荐 (低温/干制/防腐剂/罐藏)                       │   │
│  │  · 货架期精确预测                                            │   │
│  │  · 工艺适配检查                                              │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                              ↓                                       │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ Step 7: 功能性设计 (Functional Engine)                       │   │
│  │  · 强化剂选择 → 针对目标人群营养缺乏                          │   │
│  │  · 保留率预测 → 加工过程营养损失                             │   │
│  │  · GB 14880 合规检查                                         │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                              ↓                                       │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ 综合验证层 (Validation Layer)                                │   │
│  │  SynergyEngine · CompatibilityChecker · SafetyAlertSystem   │   │
│  │  · GA/NSGA-II 后验优化                                      │   │
│  │  · 君臣佐使结构构建                                         │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                              ↓                                       │
│  输出: 完整配方 + 生产指导 + 合规报告                                │
└─────────────────────────────────────────────────────────────────────┘
```

---

### 2.2 Step 1: 主体骨架设计引擎（最高优先级）

#### 2.2.1 产品形态规则库

```python
# backend/app/services/formula/product_form_rules.py

"""
产品形态 → 配比规则映射
参考《中国普通配方设计思路》第一节"主体骨架设计"
"""

from dataclasses import dataclass
from typing import Dict, List, Optional, Tuple


@dataclass
class ProductFormRule:
    """单种产品形态的配比规则"""
    form_type: str
    total_dosage_g: float           # 日总用量(g)
    max_herbs: int                  # 最大成分数
    min_herbs: int                  # 最小成分数
    jun_ratio_range: Tuple[float, float]   # 君药占比
    chen_ratio_range: Tuple[float, float]  # 臣药占比
    zuo_ratio_range: Tuple[float, float]  # 佐药占比
    shi_ratio_range: Tuple[float, float]  # 使药占比
    water_content_limit: Optional[float]    # 水分上限(%)
    particle_size_um: Optional[float]      # 粒径要求(μm)
    cost_per_gram_max: float = 2.0        # 每克成本上限
    shelf_life_months_min: int = 12       # 最低货架期


PRODUCT_FORM_RULES: Dict[str, ProductFormRule] = {
    "保健饮品": ProductFormRule(
        form_type="保健饮品", total_dosage_g=50.0,
        max_herbs=8, min_herbs=3,
        jun_ratio_range=(0.30, 0.45), chen_ratio_range=(0.15, 0.25),
        zuo_ratio_range=(0.10, 0.20), shi_ratio_range=(0.05, 0.10),
        water_content_limit=5.0, particle_size_um=200.0,
    ),
    "代茶饮": ProductFormRule(
        form_type="代茶饮", total_dosage_g=10.0,
        max_herbs=6, min_herbs=3,
        jun_ratio_range=(0.35, 0.50), chen_ratio_range=(0.15, 0.25),
        zuo_ratio_range=(0.10, 0.15), shi_ratio_range=(0.05, 0.10),
        water_content_limit=8.0,
    ),
    "膏方": ProductFormRule(
        form_type="膏方", total_dosage_g=30.0,
        max_herbs=12, min_herbs=5,
        jun_ratio_range=(0.20, 0.35), chen_ratio_range=(0.15, 0.25),
        zuo_ratio_range=(0.15, 0.25), shi_ratio_range=(0.05, 0.10),
        water_content_limit=15.0,
    ),
    "散剂": ProductFormRule(
        form_type="散剂", total_dosage_g=15.0,
        max_herbs=10, min_herbs=3,
        jun_ratio_range=(0.25, 0.40), chen_ratio_range=(0.15, 0.25),
        zuo_ratio_range=(0.10, 0.20), shi_ratio_range=(0.05, 0.10),
        water_content_limit=3.0, particle_size_um=150.0,
    ),
    "丸剂": ProductFormRule(
        form_type="丸剂", total_dosage_g=9.0,
        max_herbs=8, min_herbs=3,
        jun_ratio_range=(0.30, 0.45), chen_ratio_range=(0.15, 0.25),
        zuo_ratio_range=(0.10, 0.20), shi_ratio_range=(0.05, 0.10),
        water_content_limit=12.0,
    ),
    "口服液": ProductFormRule(
        form_type="口服液", total_dosage_g=10.0,
        max_herbs=6, min_herbs=3,
        jun_ratio_range=(0.30, 0.45), chen_ratio_range=(0.15, 0.25),
        zuo_ratio_range=(0.10, 0.20), shi_ratio_range=(0.05, 0.10),
        water_content_limit=None,
    ),
    "功能性食品": ProductFormRule(
        form_type="功能性食品", total_dosage_g=100.0,
        max_herbs=15, min_herbs=5,
        jun_ratio_range=(0.10, 0.25), chen_ratio_range=(0.10, 0.20),
        zuo_ratio_range=(0.10, 0.20), shi_ratio_range=(0.03, 0.08),
        water_content_limit=5.0,
    ),
    "压片糖果": ProductFormRule(
        form_type="压片糖果", total_dosage_g=5.0,
        max_herbs=8, min_herbs=3,
        jun_ratio_range=(0.20, 0.35), chen_ratio_range=(0.15, 0.25),
        zuo_ratio_range=(0.10, 0.20), shi_ratio_range=(0.05, 0.10),
        water_content_limit=3.0, particle_size_um=100.0,
    ),
}
```

#### 2.2.2 前置规则过滤引擎

```python
# backend/app/services/formula/rule_filter.py

"""
前置规则过滤器 — 在生成前就排除非法组合

当前问题：禁忌检查仅在 Fitness 评分中作为惩罚项
目标：在生成前就硬过滤非法组合

过滤规则：
1. 十八反配伍禁忌
2. 十九畏配伍禁忌
3. 特殊人群禁忌（孕妇/儿童/老人）
4. 单味药剂量超上限
5. 总成本超限
"""

from dataclasses import dataclass
from typing import Dict, List, Optional, Set


# 十八反（经典配伍禁忌）
EIGHTEEN_INCOMPATIBLES: Set[frozenset] = {
    frozenset({"gz", "xv"}),    # 甘草反犀角
    frozenset({"gz", "wan_hua"}), # 甘草反万花
    frozenset({"gz", "gan_sui"}), # 甘草反甘遂
    frozenset({"gz", "yuan_hua"}), # 甘草反远志
    frozenset({"gz", "bei_mu"}),  # 甘草反贝母
    frozenset({"gz", "lv_gu"}),   # 甘草反龙骨
    frozenset({"gz", "fei_lu"}),  # 甘草反飞卢
    frozenset({"hq", "fz"}),     # 黄芪反附子
    frozenset({"ds", "lk"}),     # 党参反藜芦
    frozenset({"rs", "lk"}),     # 人参反藜芦
    frozenset({"dg", "lv_huang"}), # 当归反绿花
}

# 十九畏
NINETEEN_MUTUAL feuds: Set[frozenset] = {
    frozenset({"sz", "wu_yue"}),  # 山楂畏吴茱萸
    frozenset({"dsz", "mi_mang"}), # 丹参畏芒硝
    frozenset({"yg", "dan_nan"}),  # 牙硝畏大黄
    frozenset({"bq", "shi_jian"}), # 白牵牛畏蓖麻
    frozenset({"sz", "shui_fu"}),  # 硫黄畏朴硝
    frozenset({"yl", "yu_jin"}),   # 郁金畏石遗
}

# 特殊人群禁忌
PREGNANCY_CONTRA: Set[str] = {"cs", "dg", "fz", "mld", "lk", "hs", "es", "ys"}
CHILDREN_CAUTION: Set[str] = {"fz", "lk", "mld", "rs", "ylh"}
ELDERLY_CAUTION: Set[str] = {"rs", "ylh", "bxr"}


class RuleFilter:
    """前置规则过滤器"""

    def __init__(self):
        self._antagonistic_pairs = set()
        self._load_antagonistic_pairs()

    def _load_antagonistic_pairs(self):
        """从 HerbKnowledgeService 加载配伍禁忌"""
        # 合并 十八反 + 十九畏 + 数据库中的 antagonistic_pairs
        pass

    def filter(
        self,
        candidate_herbs: List[str],
        target_population: str = "adult",
        max_cost: Optional[float] = None,
    ) -> List[str]:
        """
        前置过滤候选药材列表

        Returns:
            过滤后的合法药材列表
        """
        filtered = list(candidate_herbs)

        # 人群禁忌
        contra_set = {
            "pregnant": PREGNANCY_CONTRA,
            "children": CHILDREN_CAUTION,
            "elderly": ELDERLY_CAUTION,
        }.get(target_population, set())

        filtered = [h for h in filtered if h not in contra_set]

        # 配伍禁忌（如果候选中有禁忌对，移除毒性更大的）
        # ... 实现

        return filtered
```

#### 2.2.3 精确剂量计算器

```python
# backend/app/services/formula/dosage_calculator.py

"""
精确剂量计算器 — 基于产品形态规则 + MILPSolver

设计原理：
1. 根据产品形态确定总剂量和各角色比例范围
2. 使用 MILPSolver 在约束下精确求解各药材用量
3. 满足：①总和=总剂量 ②各角色在比例范围内 ③单味在安全范围内
"""

from typing import Dict, List, Optional
import logging

from .lp_solver import MILPSolver, HerbNutritionData, NutritionConstraint
from .product_form_rules import PRODUCT_FORM_RULES, ProductFormRule

logger = logging.getLogger(__name__)


class DosageCalculator:
    """精确剂量计算器"""

    def __init__(self):
        self._rules = PRODUCT_FORM_RULES

    def calculate(
        self,
        candidate_herbs: List[Dict],  # [{id, name, efficacy_score, safety_index, ...}]
        product_form: str,
        target_effects: List[str],
        max_cost: Optional[float] = None,
    ) -> Dict[str, float]:
        """
        计算精确剂量

        Args:
            candidate_herbs: 候选药材列表（来自优化器或人工选择）
            product_form: 产品形态
            target_effects: 目标功效
            max_cost: 成本上限

        Returns:
            {herb_id: dosage_g} 精确剂量分配
        """
        rule = self._rules.get(product_form)
        if not rule:
            raise ValueError(f"不支持的产品形态: {product_form}")

        # Step 1: 按角色分组（功效高+安全性高优先）
        sorted_herbs = self._assign_roles(candidate_herbs, rule)
        jun = sorted_herbs[:1]
        chen = sorted_herbs[1:3]
        zuo = sorted_herbs[3:5]
        shi = sorted_herbs[5:6] if len(sorted_herbs) > 5 else []

        # Step 2: 构建 MILP 约束
        herb_data = {}
        for herb in sorted_herbs:
            herb_data[herb["id"]] = HerbNutritionData(
                herb_id=herb["id"],
                name_cn=herb["name"],
                cost_per_gram=herb.get("cost_per_gram", 0.1),
                nutrition_per_100g=herb.get("nutrition", {}),
                dosage_min=herb.get("dosage_min", 1.0),
                dosage_max=herb.get("dosage_max", 30.0),
                dosage_step=herb.get("dosage_step", 1.0),
            )

        solver = MILPSolver(herb_data)

        # Step 3: 构建角色比例约束
        total = rule.total_dosage_g
        constraints = []

        # 成本约束
        if max_cost:
            constraints.append(NutritionConstraint(nutrient="cost", max_value=max_cost))

        # 角色比例约束（通过上下界实现）
        # 君药：占总剂量的 jun_ratio_range
        for herb in jun:
            low = total * rule.jun_ratio_range[0]
            high = total * rule.jun_ratio_range[1]
            herb_data[herb["id"]].dosage_min = max(herb_data[herb["id"]].dosage_min, low)
            herb_data[herb["id"]].dosage_max = min(herb_data[herb["id"]].dosage_max, high)

        # Step 4: 求解
        result = solver.solve(
            selected_herbs=[h["id"] for h in sorted_herbs],
            total_dosage=total,
            additional_constraints={"max_cost": max_cost},
        )

        if result.feasible:
            logger.info(f"[DosageCalculator] 求解成功: {len(result.ratios)} 味药材")
            return result.ratios

        # 回退：等比例分配
        logger.warning("[DosageCalculator] MILP不可行，使用等比例回退")
        n = len(sorted_herbs)
        return {h["id"]: total / n for h in sorted_herbs}

    def _assign_roles(
        self, herbs: List[Dict], rule: ProductFormRule
    ) -> List[Dict]:
        """按功效权重 + 安全性分配君臣佐使角色"""
        scored = sorted(herbs, key=lambda h: (
            h.get("efficacy_score", 0) * 0.6 +
            h.get("safety_index", 0) * 0.4
        ), reverse=True)
        return scored[:6]  # 最多6味
```

---

### 2.3 Step 2: 调色设计引擎（新增）

```python
# backend/app/services/formula/color_engine.py

"""
调色设计引擎 — GB 2760 合规的着色剂智能选择

功能：
1. 着色剂合规选择器（GB 2760 允许列表 + 适用食品类别）
2. CIELAB 色彩混合预测
3. 工艺适配检测（pH/温度/光照稳定性）
4. 民族/地区习惯适配
"""

from dataclasses import dataclass
from typing import Dict, List, Optional, Tuple


@dataclass
class Colorant:
    """着色剂定义（GB 2760 标准）"""
    name: str
    e_number: str          # E编码
    cs_number: str         # 中国序号
    type_: str             # "天然" | "合成"
    solubility: str        # "水溶性" | "油溶性"
    ph_stability: Tuple[float, float]  # 稳定pH范围
    heat_stability: bool
    light_stability: bool
    max_usage_g_per_kg: float  # 最大使用量
    applicable_foods: List[str]
    color_lab: Tuple[float, float, float]  # CIELAB值
    safety_class: str = "safe"  # safe/caution/restricted


# 核心着色剂库（从 GB 2760 标准提取）
COLORANT_DB: Dict[str, Colorant] = {
    "甜菜红": Colorant(
        name="甜菜红", e_number="E162", cs_number="08.001",
        type_="天然", solubility="水溶性",
        ph_stability=(3.0, 7.0), heat_stability=True, light_stability=False,
        max_usage_g_per_kg=0.05,
        applicable_foods=["饮料", "糖果", "糕点", "配制酒"],
        color_lab=(30.0, 25.0, -15.0),
    ),
    "栀子黄": Colorant(
        name="栀子黄", e_number="E163", cs_number="09.002",
        type_="天然", solubility="水溶性",
        ph_stability=(4.0, 8.0), heat_stability=True, light_stability=True,
        max_usage_g_per_kg=0.20,
        applicable_foods=["饮料", "糕点", "冰淇淋", "配制酒"],
        color_lab=(70.0, 5.0, 65.0),
    ),
    # ... 更多着色剂
}


class ColorEngine:
    """调色设计引擎"""

    def design(
        self,
        framework_result: Dict,
        product_form: str,
        target_color: Optional[Tuple[float, float, float]] = None,
    ) -> Dict:
        """
        调色设计主入口

        Returns:
            {
                "colorants": [{"name": "...", "dosage": X, "lab": (L,a,b)}],
                "predicted_color": (L, a, b),
                "compliance_checks": [...],
                "工艺建议": [...]
            }
        """
        # 1. 根据产品形态筛选适用着色剂
        suitable = self._filter_by_product_form(product_form)

        # 2. 根据目标颜色匹配合适着色剂组合
        if target_color:
            selection = self._select_by_target_color(suitable, target_color)
        else:
            # 默认：根据药材本色推荐
            selection = self._recommend_by_herb_nature(framework_result)

        # 3. 工艺适配检测
        compliance = self._check_compliance(selection, product_form)

        # 4. 色彩混合预测
        predicted = self._predict_mixed_color(selection)

        return {
            "colorants": selection,
            "predicted_color": predicted,
            "compliance_checks": compliance,
            "工艺建议": self._generate_process_advice(selection, product_form),
        }

    def _filter_by_product_form(self, product_form: str) -> List[Colorant]:
        """根据产品形态筛选适用着色剂"""
        form_to_foods = {
            "保健饮品": ["饮料"],
            "代茶饮": ["饮料"],
            "膏方": ["糕点", "膏方"],
            "散剂": ["调味品"],
        }
        allowed_foods = form_to_foods.get(product_form, [])
        return [
            c for c in COLORANT_DB.values()
            if any(f in c.applicable_foods for f in allowed_foods)
        ]

    def _predict_mixed_color(self, selection: List[Dict]) -> Tuple[float, float, float]:
        """CIELAB 色彩混合预测（加权平均模型）"""
        if not selection:
            return (50.0, 0.0, 0.0)
        total_dosage = sum(s["dosage"] for s in selection)
        L = sum(s["lab"][0] * s["dosage"] / total_dosage for s in selection)
        a = sum(s["lab"][1] * s["dosage"] / total_dosage for s in selection)
        b = sum(s["lab"][2] * s["dosage"] / total_dosage for s in selection)
        return (round(L, 1), round(a, 1), round(b, 1))
```

---

### 2.4 Step 3: 调香设计引擎（新增）

```python
# backend/app/services/formula/fragrance_engine.py

"""
调香设计引擎 — 香气轮廓建模与矫味剂匹配

设计原理（参考《中国普通配方设计思路》第三节）：
1. 根据主体骨架确定基础香气
2. 计算香气层次（Top/Mid/Base note）
3. 检测不良气味并匹配矫味剂
4. 确保香气与风味协调一致
"""

from dataclasses import dataclass
from typing import Dict, List, Optional, Tuple


@dataclass
class AromaComponent:
    """香气成分"""
    name: str
    note_level: int          # 0=Top, 1=Mid, 2=Base
    volatility: float        # 挥发性 (0~1)
    intensity: float         # 强度 (0~1)
    type_: str               # "草本" | "花香" | "果香" | "辛香" | "甜香"


@dataclass
class MaskingAgent:
    """矫味剂"""
    name: str
    target_bad_taste: str    # "苦味" | "涩味" | "腥膻" | "药味"
    efficacy: float          # 矫味效率 (0~1)
    max_dosage_g: float      # 最大用量
    taste_impact: Dict[str, float]  # 对五味的影响


# 常见矫味剂库
MASKING_AGENTS: Dict[str, MaskingAgent] = {
    "甘草": MaskingAgent(
        name="甘草", target_bad_taste="苦味",
        efficacy=0.85, max_dosage_g=6.0,
        taste_impact={"sweet": 0.9, "bitter": -0.5, "pungent": 0.1},
    ),
    "大枣": MaskingAgent(
        name="大枣", target_bad_taste="苦味",
        efficacy=0.75, max_dosage_g=15.0,
        taste_impact={"sweet": 0.8, "bitter": -0.4},
    ),
    "蜂蜜": MaskingAgent(
        name="蜂蜜", target_bad_taste="涩味",
        efficacy=0.90, max_dosage_g=20.0,
        taste_impact={"sweet": 1.0, "bitter": -0.6, "astringent": -0.5},
    ),
    "陈皮": MaskingAgent(
        name="陈皮", target_bad_taste="腥膻",
        efficacy=0.70, max_dosage_g=10.0,
        taste_impact={"pungent": 0.6, "bitter": 0.2},
    ),
}


class FragranceEngine:
    """调香设计引擎"""

    def design(
        self,
        framework_result: Dict,
        product_form: str,
    ) -> Dict:
        """
        调香设计主入口

        Returns:
            {
                "aroma_profile": {...},
                "masking_agents": [...],
                "协调建议": [...]
            }
        """
        # 1. 基于药材确定基础香气轮廓
        aroma_profile = self._build_aroma_profile(framework_result)

        # 2. 检测不良气味
        bad_tastes = self._detect_bad_tastes(framework_result)

        # 3. 匹配矫味剂
        masking_suggestions = self._match_masking_agents(bad_tastes)

        # 4. 香气-风味协调检查
        coordination_advice = self._check_coordination(aroma_profile, framework_result)

        return {
            "aroma_profile": aroma_profile,
            "bad_tastes_detected": bad_tastes,
            "masking_agents": masking_suggestions,
            "coordination_advice": coordination_advice,
        }

    def _detect_bad_tastes(self, framework: Dict) -> List[str]:
        """检测不良气味来源"""
        bad_tastes = set()
        herbs = framework.get("herbs", [])

        # 苦味药材映射
        bitter_herbs = {"cyh", "lk", "cs", "jgh", "fz", "bq", "mld"}
        # 腥膻味药材映射
        fishy_herbs = {"dg", "cs", "ys"}

        for herb in herbs:
            hid = herb.get("id", "")
            if hid in bitter_herbs:
                bad_tastes.add("苦味")
            if hid in fishy_herbs:
                bad_tastes.add("腥膻")

        return sorted(bad_tastes)

    def _match_masking_agents(self, bad_tastes: List[str]) -> List[Dict]:
        """为不良气味匹配矫味剂"""
        suggestions = []
        for taste in bad_tastes:
            for agent in MASKING_AGENTS.values():
                if agent.target_bad_taste == taste or taste in agent.target_bad_taste:
                    suggestions.append({
                        "name": agent.name,
                        "target": taste,
                        "efficacy": agent.efficacy,
                        "max_dosage_g": agent.max_dosage_g,
                    })
        return suggestions
```

---

### 2.5 Step 4: 调味设计引擎（增强现有）

```python
# backend/app/services/formula/flavor_engine.py

"""
调味设计引擎 — 味的增效/相乘/掩盖/转化模型

设计原理（参考《中国普通配方设计思路》第四节）：
1. 味的增效：两种以上不同味道按比例混合，量大者突出
2. 味的相乘：同种味觉的两种以上呈味物质混合，味觉猛增
3. 味的掩盖：明显不同的主味混合，彼此风味减弱
4. 味的转化：多种味道混合，导致风味发生转变
"""

import math
from typing import Dict, List, Optional, Tuple


class FlavorEngine:
    """调味设计引擎"""

    # 五味强度映射（每味药材对各味道的贡献）
    TASTE_CONTRIBUTION = {
        "hq": {"sweet": 0.8, "bitter": 0.1, "umami": 0.1},
        "ds": {"sweet": 0.9, "bitter": 0.05, "umami": 0.05},
        "gz": {"sweet": 0.85, "bitter": 0.05, "umami": 0.1},
        "rs": {"sweet": 0.7, "bitter": 0.2, "umami": 0.1},
        "dg": {"sweet": 0.3, "bitter": 0.1, "umami": 0.1, "pungent": 0.5},
        "cyh": {"bitter": 0.9, "pungent": 0.1},
        "jgh": {"bitter": 0.7, "pungent": 0.2, "sweet": 0.1},
        "gq": {"sweet": 0.95, "bitter": 0.02, "umami": 0.03},
        "dcx": {"sweet": 0.9, "umami": 0.1},
        "cx": {"pungent": 0.8, "bitter": 0.1, "sweet": 0.1},
        "sj": {"pungent": 0.9, "sweet": 0.1},
        "fp": {"sweet": 0.3, "neutral": 0.7},
        "bq": {"bitter": 0.6, "pungent": 0.3, "sweet": 0.1},
    }

    # 理想五味比例（中式食品）
    IDEAL_TASTE_RATIO = {
        "sweet": 0.40,
        "umami": 0.20,
        "bitter": 0.10,
        "pungent": 0.10,
        "sour": 0.10,
        "salty": 0.10,
    }

    def design(
        self,
        framework_result: Dict,
        target_taste: Optional[str] = None,
    ) -> Dict:
        """
        调味设计主入口

        Returns:
            {
                "taste_profile": {...},
                "enhancement_suggestions": [...],
                "masking_suggestions": [...],
                "balance_score": float
            }
        """
        # 1. 计算当前五味分布
        taste_profile = self._calculate_taste_profile(framework_result)

        # 2. 味的增效分析
        enhancements = self._analyze_synergistic_tastes(taste_profile)

        # 3. 味的掩蔽分析
        maskings = self._analyze_masking_tastes(taste_profile)

        # 4. 平衡度评分
        balance_score = self._calculate_balance_score(taste_profile)

        return {
            "taste_profile": taste_profile,
            "enhancement_suggestions": enhancements,
            "masking_suggestions": maskings,
            "balance_score": balance_score,
        }

    def _calculate_taste_profile(
        self, framework: Dict
    ) -> Dict[str, float]:
        """计算五味分布（加权平均模型）"""
        herbs = framework.get("herbs", [])
        if not herbs:
            return dict(self.IDEAL_TASTE_RATIO)

        totals = {"sweet": 0.0, "bitter": 0.0, "umami": 0.0,
                  "pungent": 0.0, "sour": 0.0, "salty": 0.0}
        total_dosage = sum(h.get("dosage", 1.0) for h in herbs)

        for herb in herbs:
            hid = herb.get("id", "")
            dosage = herb.get("dosage", 1.0)
            ratio = dosage / max(total_dosage, 1)

            contrib = self.TASTE_CONTRIBUTION.get(hid, {
                "sweet": 0.3, "umami": 0.2, "bitter": 0.1, "pungent": 0.1
            })

            for taste, value in contrib.items():
                if taste in totals:
                    totals[taste] += value * ratio

        # 归一化
        total = sum(totals.values()) or 1.0
        return {k: round(v / total, 3) for k, v in totals.items()}

    def _calculate_balance_score(self, taste_profile: Dict[str, float]) -> float:
        """计算五味平衡度（MSE 逆函数）"""
        mse = sum(
            (taste_profile.get(k, 0) - v) ** 2
            for k, v in self.IDEAL_TASTE_RATIO.items()
        ) / len(self.IDEAL_TASTE_RATIO)
        # MSE 越小越好，映射到 [0, 1]
        return max(0.0, min(1.0, 1.0 - mse * 10))

    def _analyze_synergistic_tastes(self, taste_profile: Dict[str, float]) -> List[Dict]:
        """味的增效分析"""
        suggestions = []
        # 甜味增效：甘草+大枣
        if taste_profile.get("sweet", 0) < 0.3:
            suggestions.append({
                "type": "增效",
                "target": "甜味不足",
                "suggestion": "增加甘草(3-6g) + 大枣(6-15g) 协同增甜",
                "mechanism": "甘草甜素 + 大枣果糖 → 甜味相乘效应",
            })
        # 鲜味增效：氨基酸类药材
        if taste_profile.get("umami", 0) < 0.15:
            suggestions.append({
                "type": "增效",
                "target": "鲜味不足",
                "suggestion": "增加山药、薏苡仁等富含氨基酸的药材",
                "mechanism": "谷氨酸 + 核苷酸 → 鲜味相乘",
            })
        return suggestions
```

---

### 2.6 Step 5: 品质改良设计引擎（新增）

```python
# backend/app/services/formula/quality_engine.py

"""
品质改良设计引擎 — 7 类品质改良设计

参考《中国普通配方设计思路》第五节
"""

from dataclasses import dataclass
from typing import Dict, List, Optional, Tuple


@dataclass
class Thickener:
    """增稠剂"""
    name: str
    HLB_value: float           # 亲水亲油平衡值
    max_usage_g_per_kg: float
    applicable_forms: List[str]
    viscosity_impact: float    # 对粘度的影响系数


@dataclass
class Emulsifier:
    """乳化剂"""
    name: str
    HLB_required: float        # 所需HLB值
    max_usage_g_per_kg: float
    compatibility: List[str]   # 兼容的增稠剂


# 核心数据库
THICKENER_DB: Dict[str, Thickener] = {
    "黄原胶": Thickener("黄原胶", 13.0, 1.0,
                       ["保健饮品", "口服液", "膏方"], 0.85),
    "羧甲基纤维素钠": Thickener("CMC-Na", 12.0, 0.5,
                                ["散剂", "丸剂", "压片糖果"], 0.70),
    "明胶": Thickener("明胶", 9.0, 2.0,
                      ["膏方", "口服液", "软胶囊"], 0.60),
    "果胶": Thickener("果胶", 14.0, 0.3,
                     ["保健饮品", "糖果"], 0.55),
    "魔芋胶": Thickener("魔芋胶", 11.0, 0.5,
                        ["保健饮品", "膏方"], 0.90),
}

EMULSIFIER_DB: Dict[str, Emulsifier] = {
    "蔗糖脂肪酸酯": Emulsifier("蔗糖脂肪酸酯", 12.0, 0.5, ["黄原胶", "CMC-Na"]),
    "吐温-80": Emulsifier("吐温-80", 15.0, 0.3, ["黄原胶"]),
    "司盘-80": Emulsifier("司盘-80", 4.3, 0.5, ["果胶"]),
}


class QualityEngine:
    """品质改良设计引擎"""

    def design(
        self,
        framework_result: Dict,
        product_form: str,
    ) -> Dict:
        """
        品质改良设计主入口

        Returns:
            {
                "thickener_recommendation": {...},
                "emulsifier_recommendation": {...},
                "moisture_control": {...},
                "antioxidant_recommendation": {...},
                "texture_prediction": {...}
            }
        """
        return {
            "thickener": self._recommend_thickener(product_form),
            "emulsifier": self._recommend_emulsifier(product_form),
            "moisture_control": self._design_moisture_control(product_form),
            "antioxidant": self._design_antioxidant(framework_result),
            "texture_prediction": self._predict_texture(framework_result, product_form),
        }

    def _recommend_thickener(self, product_form: str) -> Dict:
        """增稠剂推荐"""
        suitable = [
            t for t in THICKENER_DB.values()
            if product_form in t.applicable_forms
        ]
        if not suitable:
            return {"recommendation": "无需增稠剂", "reason": f"{product_form} 不适用"}
        # 按粘度影响排序
        best = max(suitable, key=lambda t: t.viscosity_impact)
        return {
            "name": best.name,
            "max_dosage_g": best.max_usage_g_per_kg,
            "HLB_value": best.HLB_value,
            "viscosity_impact": best.viscosity_impact,
        }

    def _design_moisture_control(self, product_form: str) -> Dict:
        """水分保持设计"""
        from .product_form_rules import PRODUCT_FORM_RULES
        rule = PRODUCT_FORM_RULES.get(product_form)
        if not rule or rule.water_content_limit is None:
            return {"status": "液态产品，无水分限制", "limit": None}

        return {
            "max_water_content_pct": rule.water_content_limit,
            "recommended_preservatives": ["乳酸钙", "乳酸钠"],
            "process_advice": "控制干燥温度 < 60°C，避免水分过度蒸发",
        }

    def _design_antioxidant(self, framework_result: Dict) -> Dict:
        """抗氧化设计"""
        # 基于药材成分判断是否需要抗氧化
        herbs = framework_result.get("herbs", [])
        antioxidant_herbs = {"gz", "cyh", "jgh", "sj", "cx"}  # 含抗氧化成分的药材

        has_antioxidant = any(
            h.get("id") in antioxidant_herbs for h in herbs
        )

        if has_antioxidant:
            return {
                "status": "配方含天然抗氧化成分，无需额外添加",
                "natural_antioxidants": ["维生素E（来自药材）", "多酚类"],
                "shelf_life_impact": "+20%",
            }
        else:
            return {
                "status": "建议添加抗氧化剂",
                "recommendation": "维生素C (0.1-0.3g/kg) 或 维生素E (0.05-0.1g/kg)",
                "添加时机": "后处理阶段加入，避免高温破坏",
            }
```

---

### 2.7 Step 6: 防腐保鲜设计引擎（增强）

```python
# backend/app/services/formula/preservation_engine.py

"""
防腐保鲜设计引擎 — 增强现有 StabilityPredictor

参考《中国普通配方设计思路》第六节
"""

from typing import Dict, List, Optional


class PreservationEngine:
    """防腐保鲜设计引擎"""

    def design(
        self,
        framework_result: Dict,
        product_form: str,
        target_shelf_life_months: int = 12,
    ) -> Dict:
        """
        防腐保鲜设计主入口

        Returns:
            {
                "technology_recommendation": {...},
                "shelf_life_prediction": {...},
                "process_advice": [...],
                "risk_warnings": [...]
            }
        """
        # Step 1: 保鲜技术选型
        tech = self._select_preservation_technology(product_form, target_shelf_life_months)

        # Step 2: 货架期精确预测（集成现有 StabilityPredictor）
        shelf_life = self._predict_shelf_life(framework_result, tech["type"])

        # Step 3: 工艺适配检查
        process_advice = self._check_process_compatibility(tech["type"], product_form)

        # Step 4: 风险预警
        warnings = self._generate_risk_warnings(framework_result, tech)

        return {
            "technology_recommendation": tech,
            "shelf_life_prediction": shelf_life,
            "process_advice": process_advice,
            "risk_warnings": warnings,
        }

    def _select_preservation_technology(
        self, product_form: str, target_months: int
    ) -> Dict:
        """保鲜技术选型"""
        tech_map = {
            "保健饮品": {
                "primary": "巴氏杀菌 + 无菌灌装",
                "secondary": "冷藏储运",
                "max_shelf_life_months": 12,
            },
            "代茶饮": {
                "primary": "热风干燥 + 密封包装",
                "secondary": "充氮包装",
                "max_shelf_life_months": 24,
            },
            "膏方": {
                "primary": "浓缩收膏 + 高糖防腐",
                "secondary": "冷藏",
                "max_shelf_life_months": 18,
            },
            "散剂": {
                "primary": "低温干燥 + 防潮包装",
                "secondary": "脱氧剂",
                "max_shelf_life_months": 24,
            },
            "丸剂": {
                "primary": "泛丸干燥 + 蜡壳包装",
                "secondary": "密封避光",
                "max_shelf_life_months": 36,
            },
            "口服液": {
                "primary": "高温灭菌 + 玻璃瓶密封",
                "secondary": "常温储运",
                "max_shelf_life_months": 18,
            },
            "功能性食品": {
                "primary": "真空包装 + 脱氧剂",
                "secondary": "常温储运",
                "max_shelf_life_months": 18,
            },
            "压片糖果": {
                "primary": "铝塑包装 + 防潮",
                "secondary": "常温储运",
                "max_shelf_life_months": 24,
            },
        }

        tech = tech_map.get(product_form, {
            "primary": "常规干燥 + 密封包装",
            "secondary": "常温储运",
            "max_shelf_life_months": 12,
        })

        # 检查是否满足目标货架期
        if tech["max_shelf_life_months"] < target_months:
            tech["upgrade_advice"] = f"建议升级至：{self._get_upgrade_tech(product_form)}"

        return tech

    def _get_upgrade_tech(self, product_form: str) -> str:
        """获取保鲜技术升级建议"""
        upgrades = {
            "保健饮品": "UHT超高温瞬时灭菌 + 无菌冷灌装",
            "膏方": "减压浓缩 + 真空包装",
            "散剂": "冷冻干燥 + 充氮包装",
        }
        return upgrades.get(product_form, "咨询食品工程专家")
```

---

### 2.8 Step 7: 功能性设计引擎（增强）

```python
# backend/app/services/formula/functional_engine.py

"""
功能性设计引擎 — 营养强化 + 保留率预测 + 合规检查

参考《中国普通配方设计思路》第七节
"""

from typing import Dict, List, Optional


class FunctionalEngine:
    """功能性设计引擎"""

    # GB 14880 营养强化剂允许清单（简化版）
    ALLOWED_ENHANCERS = {
        "维生素A": {"max_mg_per_day": 0.8, "forms": ["棕榈酸视黄酯", "醋酸视黄酯"]},
        "维生素D3": {"max_mg_per_day": 0.025, "forms": ["胆钙化醇"]},
        "维生素E": {"max_mg_per_day": 0.8, "forms": ["d-α-生育酚"]},
        "维生素C": {"max_mg_per_day": 2.0, "forms": ["抗坏血酸", "抗坏血酸钠"]},
        "钙": {"max_mg_per_day": 2.5, "forms": ["碳酸钙", "乳酸钙", "葡萄糖酸钙"]},
        "铁": {"max_mg_per_day": 30, "forms": ["硫酸亚铁", "富马酸亚铁"]},
        "锌": {"max_mg_per_day": 25, "forms": ["葡萄糖酸锌", "硫酸锌"]},
        "硒": {"max_ug_per_day": 250, "forms": ["硒酵母", "硒化蛋白质"]},
    }

    # 目标人群营养需求
    POPULATION_NUTRITION = {
        "adult": {"calcium_mg": 800, "iron_mg": 12, "vitamin_d_mcg": 10},
        "elderly": {"calcium_mg": 1000, "iron_mg": 10, "vitamin_d_mcg": 15},
        "children": {"calcium_mg": 800, "iron_mg": 10, "vitamin_d_mg": 10},
        "pregnant": {"calcium_mg": 1200, "iron_mg": 25, "folic_acid_mcg": 400},
    }

    def design(
        self,
        framework_result: Dict,
        target_group: str,
        nutrition_requirements: Optional[Dict] = None,
    ) -> Dict:
        """
        功能性设计主入口

        Returns:
            {
                "enhancer_recommendations": [...],
                "retention_prediction": {...},
                "compliance_check": {...},
                "nutrition_balance": {...}
            }
        """
        # Step 1: 营养缺口分析
        gaps = self._analyze_nutrition_gaps(target_group, nutrition_requirements)

        # Step 2: 强化剂推荐
        enhancers = self._recommend_enhancers(gaps, framework_result)

        # Step 3: 保留率预测
        retention = self._predict_retention(framework_result, enhancers)

        # Step 4: 合规检查
        compliance = self._check_compliance(enhancers, target_group)

        # Step 5: 营养均衡评估
        balance = self._assess_nutrition_balance(enhancers, gaps)

        return {
            "enhancer_recommendations": enhancers,
            "retention_prediction": retention,
            "compliance_check": compliance,
            "nutrition_balance": balance,
        }

    def _analyze_nutrition_gaps(
        self, target_group: str, requirements: Optional[Dict]
    ) -> Dict[str, float]:
        """分析目标人群的营养缺口"""
        base_needs = self.POPULATION_NUTRITION.get(target_group, self.POPULATION_NUTRITION["adult"])
        if requirements:
            base_needs.update(requirements)

        # 从框架结果中估算当前营养含量
        current = self._estimate_current_nutrition(base_needs)

        gaps = {}
        for nutrient, needed in base_needs.items():
            actual = current.get(nutrient, 0)
            if actual < needed:
                gaps[nutrient] = needed - actual

        return gaps

    def _predict_retention(
        self, framework: Dict, enhancers: List[Dict]
    ) -> Dict:
        """预测加工过程中的营养保留率"""
        # 简化模型：基于产品类型和强化剂类型
        retention_rates = {
            "维生素C": {"饮料": 0.85, "膏方": 0.70, "散剂": 0.90, "丸剂": 0.80},
            "维生素E": {"饮料": 0.90, "膏方": 0.85, "散剂": 0.95, "丸剂": 0.90},
            "钙": {"饮料": 0.95, "膏方": 0.90, "散剂": 0.95, "丸剂": 0.95},
            "铁": {"饮料": 0.80, "膏方": 0.75, "散剂": 0.90, "丸剂": 0.85},
        }

        product_form = framework.get("product_form", "功能性食品")
        results = {}
        for enhancer in enhancers:
            vitamin = enhancer.get("nutrient", "")
            if vitamin in retention_rates:
                form_retention = retention_rates[vitamin].get(product_form, 0.80)
                results[enhancer["name"]] = {
                    "retention_rate": form_retention,
                    "added_mg": enhancer.get("dosage_mg", 0),
                    "retained_mg": round(enhancer.get("dosage_mg", 0) * form_retention, 2),
                }
        return results
```

---

### 2.9 七步统一编排引擎

```python
# backend/app/services/formula/seven_step_engine.py

"""
七步配方设计统一编排引擎

集成所有七步专业引擎 + 继承现有验证层
"""

import asyncio
import logging
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional

from .framework_engine import FrameworkEngine
from .color_engine import ColorEngine
from .fragrance_engine import FragranceEngine
from .flavor_engine import FlavorEngine
from .quality_engine import QualityEngine
from .preservation_engine import PreservationEngine
from .functional_engine import FunctionalEngine

logger = logging.getLogger(__name__)


@dataclass
class FormulaRequest:
    """配方设计请求"""
    target_effects: List[str]
    product_form: str = "保健饮品"
    target_group: str = "adult"
    constraints: Dict[str, Any] = field(default_factory=dict)
    max_cost: Optional[float] = None
    target_shelf_life_months: int = 12
    n_candidates: int = 10


@dataclass
class FormulaOutput:
    """配方设计输出"""
    # Step 1
    framework: Dict = field(default_factory=dict)
    # Step 2
    color: Dict = field(default_factory=dict)
    # Step 3
    fragrance: Dict = field(default_factory=dict)
    # Step 4
    flavor: Dict = field(default_factory=dict)
    # Step 5
    quality: Dict = field(default_factory=dict)
    # Step 6
    preservation: Dict = field(default_factory=dict)
    # Step 7
    functional: Dict = field(default_factory=dict)
    # 综合
    validation: Dict = field(default_factory=dict)
    # 汇总
    summary: str = ""
    total_time_ms: float = 0.0


class SevenStepFormulaEngine:
    """
    七步配方设计引擎

    设计原则：
    1. 顺序执行：每一步的输出作为下一步的输入
    2. 可跳步：某些步骤可跳过（如调色对散剂不重要）
    3. 回退机制：某步失败时，使用上一步结果继续
    4. 并行验证：验证层可与Step 6-7并行执行
    """

    def __init__(self):
        # 七步引擎
        self.framework_engine = FrameworkEngine()
        self.color_engine = ColorEngine()
        self.fragrance_engine = FragranceEngine()
        self.flavor_engine = FlavorEngine()
        self.quality_engine = QualityEngine()
        self.preservation_engine = PreservationEngine()
        self.functional_engine = FunctionalEngine()

        # 验证层（继承现有）
        from ..ai.algorithms.multi_objective_optimizer import get_nsga2_optimizer
        from ..formula.synergy_engine import SynergyEngine
        from ..formula.compatibility_checker import CompatibilityChecker
        from ..formula.safety_alert_system import SafetyAlertSystem

        self.nsga = get_nsga2_optimizer()
        self.synergy = SynergyEngine()
        self.compatibility = CompatibilityChecker()
        self.safety = SafetyAlertSystem()

    async def design(self, request: FormulaRequest) -> FormulaOutput:
        """七步设计主入口"""
        import time
        start = time.perf_counter()

        output = FormulaOutput()

        try:
            # ═══ Step 1: 主体骨架设计 ═══
            logger.info("[SevenStep] Step 1: 主体骨架设计")
            output.framework = await self.framework_engine.design(
                effects=request.target_effects,
                product_form=request.product_form,
                target_group=request.target_group,
                max_cost=request.max_cost,
                n_candidates=request.n_candidates,
            )

            # ═══ Step 2: 调色设计（仅液态/半固态产品需要）════
            if request.product_form in ("保健饮品", "口服液", "膏方", "代茶饮"):
                logger.info("[SevenStep] Step 2: 调色设计")
                output.color = self.color_engine.design(
                    framework_result=output.framework,
                    product_form=request.product_form,
                )

            # ═══ Step 3: 调香设计 ═══
            logger.info("[SevenStep] Step 3: 调香设计")
            output.fragrance = self.fragrance_engine.design(
                framework_result=output.framework,
                product_form=request.product_form,
            )

            # ═══ Step 4: 调味设计 ═══
            logger.info("[SevenStep] Step 4: 调味设计")
            output.flavor = self.flavor_engine.design(
                framework_result=output.framework,
            )

            # ═══ Step 5: 品质改良设计 ═══
            logger.info("[SevenStep] Step 5: 品质改良设计")
            output.quality = self.quality_engine.design(
                framework_result=output.framework,
                product_form=request.product_form,
            )

            # ═══ Step 6: 防腐保鲜设计 ═══
            logger.info("[SevenStep] Step 6: 防腐保鲜设计")
            output.preservation = self.preservation_engine.design(
                framework_result=output.framework,
                product_form=request.product_form,
                target_shelf_life_months=request.target_shelf_life_months,
            )

            # ═══ Step 7: 功能性设计 ═══
            logger.info("[SevenStep] Step 7: 功能性设计")
            output.functional = self.functional_engine.design(
                framework_result=output.framework,
                target_group=request.target_group,
            )

            # ═══ 综合验证 ═══
            logger.info("[SevenStep] 综合验证")
            output.validation = await self._validate(output)

            # ═══ 构建输出摘要 ═══
            output.summary = self._build_summary(output)

        except Exception as e:
            logger.error(f"[SevenStep] 设计失败: {e}", exc_info=True)
            output.summary = f"设计失败: {str(e)[:100]}"

        output.total_time_ms = (time.perf_counter() - start) * 1000
        return output

    async def _validate(self, output: FormulaOutput) -> Dict:
        """综合验证"""
        # 协同效应分析
        herbs = output.framework.get("herbs", [])
        synergy_result = {}
        if len(herbs) >= 2:
            from ..formula.synergy_engine import SynergyEngine
            engine = SynergyEngine()
            # 分析主要成分对的协同
            pairs = herbs[:3]  # 只分析前3味
            synergy_scores = []
            for i in range(len(pairs)):
                for j in range(i + 1, len(pairs)):
                    try:
                        report = engine.analyze_synergy(pairs[i]["name"], pairs[j]["name"])
                        synergy_scores.append(report.overall_si)
                    except:
                        pass
            if synergy_scores:
                synergy_result = {
                    "overall_si": sum(synergy_scores) / len(synergy_scores),
                    "pairs_analyzed": len(synergy_scores),
                }

        # 兼容性检测
        compatibility_result = {}
        if herbs:
            ingredients_data = [
                {"name": h["name"], "amount_mg": h.get("dosage", 5) * 1000}
                for h in herbs[:6]
            ]
            report = self.compatibility.check_compatibility(
                ingredients=ingredients_data,
                formula_id="seven-step-test",
                target_population=output.framework.get("target_group", "adult"),
            )
            compatibility_result = {
                "overall_score": report.overall_score,
                "error_count": report.error_count,
                "warning_count": report.warning_count,
            }

        # 安全预警
        safety_result = {}
        if herbs:
            from ..formula.safety_alert_system import SafetyAlertSystem
            system = SafetyAlertSystem()
            result = system.check_formula_safety(
                formula_data={
                    "ingredients": [
                        {"name": h["name"], "amount_g": h.get("dosage", 5)}
                        for h in herbs[:6]
                    ],
                    "daily_dosage_g": output.framework.get("total_dosage_g", 10),
                    "usage_scenario": "supplement",
                },
                target_group=output.framework.get("target_group", "adult"),
            )
            safety_result = {
                "is_safe": result.is_safe,
                "overall_risk_score": result.overall_risk_score,
                "alert_count": len(result.alerts),
            }

        return {
            "synergy": synergy_result,
            "compatibility": compatibility_result,
            "safety": safety_result,
        }

    def _build_summary(self, output: FormulaOutput) -> str:
        """构建输出摘要"""
        fw = output.framework
        val = output.validation

        parts = [
            f"产品形态: {fw.get('product_form', '未知')}",
            f"目标功效: {', '.join(fw.get('target_effects', []))}",
            f"配方组成: {len(fw.get('herbs', []))} 味药材",
            f"总剂量: {fw.get('total_dosage_g', 0)}g",
        ]

        if val.get("safety", {}).get("is_safe"):
            parts.append("安全性: ✅ 通过")
        else:
            parts.append(f"安全性: ⚠️ 风险分 {val.get('safety', {}).get('overall_risk_score', '?')}")

        if val.get("compatibility", {}).get("overall_score", 100) >= 70:
            parts.append("兼容性: ✅ 良好")
        else:
            parts.append(f"兼容性: ⚠️ 评分 {val.get('compatibility', {}).get('overall_score', '?')}/100")

        if val.get("synergy", {}).get("overall_si"):
            parts.append(f"协同效应: SI={val['synergy']['overall_si']:.3f}")

        return " | ".join(parts)
```

---

## 第三部分：骨架修复（Phase 0，最高优先级）

在七步引擎之前，必须先修复现有的AI模型层骨架：

### 任务 0.1：连接 PyTorchGenerator 到统一引擎

```python
# unified_formula_engine.py — 修改 _ensure_initialized()
def _ensure_initialized(self):
    if self._initialized:
        return
    try:
        from .signal_encoder import get_signal_encoder
        from .pytorch_generator import get_pytorch_generator  # ← 改这里
        from .formula_predictor import get_formula_predictor
        from .formula_discriminator import get_formula_discriminator
        from .template_subsystem import get_template_subsystem
        from .rl_tuner import get_rl_tuner
        from .formula_selector import get_formula_selector

        self._signal_encoder = get_signal_encoder()
        self._generator = get_pytorch_generator(  # ← 使用真正的LSTM
            n_herbs=len(self.herb_vocab),
            input_dim=self._signal_encoder.output_dim,
        )
        # ... 其他组件
        self._initialized = True
    except ImportError as e:
        # 降级到启发式生成器
        logger.warning(f"[UnifiedEngine] PyTorch不可用，降级到启发式: {e}")
        from .autoregressive_generator import get_autoregressive_generator
        self._generator = get_autoregressive_generator(herb_vocab=self.herb_vocab)
```

### 任务 0.2：修复信号编码器为可学习嵌入

```python
# signal_encoder.py — 改为 nn.Module
import torch
import torch.nn as nn

class SignalEncoder(nn.Module):
    def __init__(self, n_effects=20, effect_dim=16, category_dim=8, group_dim=8):
        super().__init__()
        self.effect_embed = nn.Embedding(n_effects, effect_dim)
        self.category_embed = nn.Embedding(10, category_dim)
        self.group_embed = nn.Embedding(5, group_dim)

    def encode(self, target_effects, ...):
        # 使用可学习嵌入
        effect_vec = self.effect_embed(effect_indices).mean(dim=1)
        # ...
        return EncodedSignal(raw_vector=...)

    @property
    def output_dim(self):
        return 16 + 8 + 8 + 4  # = 36
```

### 任务 0.3：修复 RL 训练回路

```python
# rl_tuner.py — 修复 train_step()
def train_step(self, formula, predictor_result, discriminator_result, ...):
    # 计算奖励
    rewards = self.compute_reward(...)
    total_reward = rewards["total"]

    # 关键修复：将奖励转换为可微分张量
    reward_tensor = torch.tensor(total_reward, device=self.device)

    # 更新基线
    self.update_baseline(total_reward)
    advantage = self.compute_advantage(total_reward)

    # 关键修复：梯度回传到生成器
    if hasattr(self.generator, 'optimizer'):
        self.generator.optimizer.zero_grad()
        # 使用 reward 作为加权因子调整 log_prob
        loss = -advantage * self.generator._current_log_prob.mean()
        loss.backward()
        torch.nn.utils.clip_grad_norm_(self.generator.parameters(), max_norm=1.0)
        self.generator.optimizer.step()
```

### 任务 0.4：剂量分配接入 MILPSolver

```python
# autoregressive_generator.py 或 seven_step_engine.py
def _assign_dosages(self, herbs, product_form, total_dosage):
    """使用 MILPSolver 替代随机分配"""
    from .lp_solver import MILPSolver, HerbNutritionData

    herb_data = {}
    for herb in herbs:
        herb_data[herb["id"]] = HerbNutritionData(
            herb_id=herb["id"],
            name_cn=herb["name"],
            cost_per_gram=herb.get("cost_per_gram", 0.1),
            nutrition_per_100g=herb.get("nutrition", {}),
            dosage_min=herb.get("dosage_min", 1.0),
            dosage_max=herb.get("dosage_max", 30.0),
            dosage_step=herb.get("dosage_step", 1.0),
        )

    solver = MILPSolver(herb_data)
    result = solver.solve(
        selected_herbs=[h["id"] for h in herbs],
        total_dosage=total_dosage,
    )

    return result.ratios if result.feasible else self._fallback_assign(herbs, total_dosage)
```

---

## 第四部分：实施路线图

### Phase 0: 骨架修复（1周）⭐

| # | 任务 | 文件 | 验收标准 |
|---|------|------|---------|
| 0.1 | 连接 PyTorchGenerator | `unified_formula_engine.py` | 引擎使用真正LSTM |
| 0.2 | 修复信号编码器 | `signal_encoder.py` | 使用 nn.Embedding |
| 0.3 | 修复RL训练回路 | `rl_tuner.py` + `pytorch_generator.py` | backward+step可执行 |
| 0.4 | 剂量分配接入MILP | `seven_step_engine.py` | MILP求解替代随机分配 |
| 0.5 | 前置规则过滤 | `formula/rule_filter.py` | 十八反/十九畏硬过滤 |

### Phase 1: 数据层连通（1周）

| # | 任务 | 验收标准 |
|---|------|---------|
| 1.1 | HerbKnowledgeService 接入数据库 | 从 TCMHerb/MMIDHerb/SymMapHerb 读取 |
| 1.2 | 营养数据库扩展 | 补充 ~200 味药材的营养数据 |
| 1.3 | 数据质量检查 | 功效索引覆盖率 > 90% |

### Phase 2: 七步引擎开发（4周）

| 周 | 任务 | 验收标准 |
|---|------|---------|
| W1 | Step 1 骨架引擎 + 产品形态规则库 | MILP精确求解，8种形态全覆盖 |
| W2 | Step 2 调色 + Step 3 调香 | GB合规率100%，香气轮廓合理 |
| W3 | Step 4 调味增强 + Step 5 品质改良 | 五味模型完整，7类设计可执行 |
| W4 | Step 6 保鲜增强 + Step 7 功能性 + 编排引擎 | 技术选型推荐，端到端跑通 |

### Phase 3: 集成验证（1周）

| # | 任务 | 验收标准 |
|---|------|---------|
| 3.1 | API层适配 | 新旧接口兼容 |
| 3.2 | 端到端测试 | 七步流水线完整测试 |
| 3.3 | 专家评审 | 3位专家盲评10组配方 |
| 3.4 | 对比实验 | 与现有系统产出对比 |

### Phase 4: 反馈闭环（1周）

| # | 任务 | 验收标准 |
|---|------|---------|
| 4.1 | 用户反馈收集 | 采纳/修改/拒绝三种反馈 |
| 4.2 | 判别器增量更新 | 新配方自动加入训练库 |
| 4.3 | 文档更新 | 技术文档 + API文档 |

**总工期：8周**

---

## 第五部分：关键技术决策

| 决策 | 选择 | 理由 |
|------|------|------|
| 神经网络 vs 规则引擎 | **双轨制** | 神经网络训练 + 规则引擎生产，数据达标后逐步切换 |
| 七步是否全部实现 | **分优先级** | P0: Step1+7, P1: Step4+6, P2: Step2+3, P3: Step5 |
| 是否替换现有优化器 | **不替换，增强** | GA/Bayesian/NSGA-II 保留，作为后验优化层 |
| 数据扩充策略 | **数据库优先** | 从 TCMSP/MMID/SymMap 读取，硬编码仅作为兜底 |
| 产品形态适配 | **规则驱动** | 每种形态有独立的配比规则库，可扩展 |

---

## 附录：文件变更清单

### 需修复的文件

```
backend/app/services/ai/models/
├── pytorch_generator.py        # 连接至统一引擎
├── rl_tuner.py                 # 修复训练回路
├── signal_encoder.py           # 改为 nn.Embedding
├── unified_formula_engine.py   # 接入 PyTorchGen + MILPSolver
└── autoregressive_generator.py # 保留为 fallback

backend/app/services/formula/
├── product_form_rules.py       # 产品形态规则库（新建）
├── rule_filter.py              # 前置规则过滤器（新建）
├── framework_engine.py         # Step 1 骨架引擎（新建）
├── color_engine.py             # Step 2 调色引擎（新建）
├── fragrance_engine.py         # Step 3 调香引擎（新建）
├── flavor_engine.py            # Step 4 调味引擎（增强）
├── quality_engine.py           # Step 5 品质引擎（新建）
├── preservation_engine.py      # Step 6 保鲜引擎（增强）
├── functional_engine.py        # Step 7 功能引擎（新建）
└── seven_step_engine.py        # 七步编排引擎（新建）
```
