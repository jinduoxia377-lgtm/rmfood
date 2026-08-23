# RMFOOD 配方生成系统 深度评估与专业开发方案

> 编制日期：2026-08-14
> 编制依据：
>   - 参考标准：`docs/中国普通配方设计思路/配方设计七步.txt`（7步专业配方设计法）
>   - 现状分析：RMFOOD 项目现有 30+ 配方相关模块
>   - 目标：找出差距 → 制定深度开发方案
>
> 文档状态：v1.0 评审版（待决策）

---

## 第一部分：差距深度分析

### 1.1 参考标准：中国普通配方设计七步法

| 步骤 | 名称 | 核心内容 |
|---|---|---|
| **Step 1** | 主体骨架设计 | 主体原料选择 + 量化原则（卫生安全、营养易消化、贮藏耐运、外观、风味、方便性） |
| **Step 2** | 调色设计 | 着色剂合规、物性适配、形态适配、民族习惯、拼色方法、工艺控制 |
| **Step 3** | 调香设计 | 辅助/赋香/补充/稳定/替代/矫味 6大作用 + 5大使用要点 |
| **Step 4** | 调味设计 | 味的增效/相乘/掩盖/转化原理 + 主体轮廓确定 + 香味平衡 |
| **Step 5** | 品质改良设计 | 增稠/乳化/水分保持/催化/抗氧化/抗结/消泡等 7 类设计 |
| **Step 6** | 防腐保鲜设计 | 低温/干制/防腐剂/罐藏/其他保藏技术选型 |
| **Step 7** | 功能性设计 | 营养强化原则（针对需要、均衡吸收、工艺合理、经济合理、风味保留、保留率） |

### 1.2 现有系统能力映射

```
┌──────────────────┬────────────────────────────────────────────┬───────────────┐
│ 设计步骤         │ 现有系统对应模块                            │ 成熟度评级    │
├──────────────────┼────────────────────────────────────────────┼───────────────┤
│ Step 1 主体骨架  │ ✅ GA/Bayesian/NSGA-II 生成配方骨架         │ ★★★★☆ 成熟   │
│                  │ ✅ HerbKnowledgeService 药材知识库          │               │
│                  │ ✅ 君臣佐使结构评估                          │               │
│                  │ ⚠️  无"用量量化原则"规则化引擎              │ 🔴 缺失      │
│                  │ ❌ 无"卫生安全/营养易消化"定量评估          │ 🔴 缺失      │
├──────────────────┼────────────────────────────────────────────┼───────────────┤
│ Step 2 调色设计  │ ❌ 完全缺失                                 │ 🔴 缺失      │
│                  │    （无着色剂选择/拼色/工艺适配）           │               │
├──────────────────┼────────────────────────────────────────────┼───────────────┤
│ Step 3 调香设计  │ ⚠️  TastePredictor 仅5味评分               │ ★★☆☆☆ 粗糙  │
│                  │    （无香气成分建模/挥发性模型/矫味剂选择）  │               │
├──────────────────┼────────────────────────────────────────────┼───────────────┤
│ Step 4 调味设计  │ ⚠️  五味调和MSE模型                         │ ★★★☆☆ 中等  │
│                  │    （无用效增强/掩盖/转化数学模型）         │               │
├──────────────────┼────────────────────────────────────────────┼───────────────┤
│ Step 5 品质改良  │ ❌ 完全缺失                                 │ 🔴 缺失      │
│                  │    （无增稠/乳化/水分保持/抗氧化设计）      │               │
├──────────────────┼────────────────────────────────────────────┼───────────────┤
│ Step 6 防腐保鲜  │ ⚠️  StabilityPredictor 仅货架期预测        │ ★★☆☆☆ 粗糙  │
│                  │    （无防腐保鲜技术选型/工艺适配建议）      │               │
├──────────────────┼────────────────────────────────────────────┼───────────────┤
│ Step 7 功能性    │ ✅ 功效预测引擎 (FormulaPredictor 7维)     │ ★★★★☆ 成熟  │
│   设计           │ ✅ 营养计算服务                             │               │
│                  │ ⚠️  无"营养强化剂选择/保留率"建模          │ 🔴 缺失      │
└──────────────────┴────────────────────────────────────────────┴───────────────┘
```

### 1.3 核心差距矩阵（按严重程度排序）

#### 🔴 致命差距（影响配方可用性的根本问题）

| # | 差距描述 | 影响 | 优先级 |
|---|---------|------|--------|
| **G1** | **Step1 主体骨架无量化工具**：当前仅随机/启发式分配用量，无基于产品形态(饮品/膏方/散剂)的精确剂量计算 | 生成的配方无法直接用于生产 | P0 |
| **G2** | **Step2 调色设计为零**：完全缺失颜色匹配模块，产品视觉品质无法保证 | 产品外观质量不可控 | P0 |
| **G3** | **Step5 品质改良设计为零**：无增稠/乳化/质构建模，产品质地不可控 | 产品物理形态缺陷 | P0 |
| **G4** | **Step6 防腐保鲜仅预测无决策**：StabilityPredictor 只给出评分，无保鲜技术推荐 | 货架期无法保障 | P1 |

#### 🟠 重大差距（影响配方科学性）

| # | 差距描述 | 影响 | 优先级 |
|---|---------|------|--------|
| **G5** | **Step3 调香设计过浅**：当前只有简单五味道评分，无挥发性香气建模/矫味方案 | 香气体验差 | P1 |
| **G6** | **Step4 调味设计缺数学模型**：仅有MSE调和模型，无用效增强/掩盖/转化规则 | 口味设计粗糙 | P1 |
| **G7** | **Step7 功能性无强化设计**：有功效预测但无营养强化路径规划 | 功能性食品价值打折 | P1 |
| **G8** | **数据层太小**：仅 ~50味药材，无法满足Step1的"主体原料选择"需求 | 候选空间严重受限 | P0 |

#### 🟡 中等问题（影响效率与品质）

| # | 差距描述 | 影响 | 优先级 |
|---|---------|------|--------|
| **G9** | **无自回归生成器真实训练**：`autoregressive_generator.py` 是简化启发式，非真正LSTM | 生成质量不如GA | P1 |
| **G10** | **预测器-判别器未连接RL**：`rl_tuner.py` 是骨架代码，无实际训练回路 | AI生成无自我进化 | P1 |
| **G11** | **TemplateSubsystem ID不匹配**：模板使用 "ds"/"bq" 但 `_BUILTIN_HERBS` 的key也是这些，部分模板用拼音缩写 | 模板匹配可能失败 | P2 |
| **G12** | **无用户反馈闭环**：生成结果无A/B测试和用户满意度追踪 | 无法持续优化 | P2 |

---

## 第二部分：专业开发方案

### 2.1 总体架构设计

```
┌────────────────────────────────────────────────────────────────────────────┐
│                    RMFOOD 配方生成引擎 v4.0（专业级）                        │
├────────────────────────────────────────────────────────────────────────────┤
│                                                                            │
│  输入层: 功效需求 + 产品形态 + 目标人群 + 约束条件                           │
│                      ↓                                                     │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │               Step 1: 主体骨架设计引擎 (Framework Engine)            │   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────────┐  │   │
│  │  │ 原料选择器    │  │ 剂量计算器    │  │ 产品结构决策器            │  │   │
│  │  │ 功效→药材    │  │ 产品形态→用量 │  │ 饮品/膏方/散剂→配比规则   │  │   │
│  │  │ 知识库匹配    │  │ MILP精确求解  │  │                          │  │   │
│  │  └──────────────┘  └──────────────┘  └──────────────────────────┘  │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                      ↓                                                     │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │               Step 2: 调色设计引擎 (Color Engine)                    │   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────────┐  │   │
│  │  │ 着色剂选择器  │  │ 拼色计算器    │  │ 工艺适配检测器            │  │   │
│  │  │ GB合规校验    │  │ CIELAB色彩空间 │  │ pH/温度稳定性预测        │  │   │
│  │  └──────────────┘  └──────────────┘  └──────────────────────────┘  │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                      ↓                                                     │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │               Step 3: 调香设计引擎 (Fragrance Engine)                │   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────────┐  │   │
│  │  │ 香气轮廓建模  │  │ 挥发动力学    │  │ 矫味剂匹配器             │  │   │
│  │  │ Topnote/     │  │ 释放曲线模拟  │  │ 掩盖苦味/异味            │  │   │
│  │  │ Mid/Basetone │  │              │  │                          │  │   │
│  │  └──────────────┘  └──────────────┘  └──────────────────────────┘  │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                      ↓                                                     │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │               Step 4: 调味设计引擎 (Flavor Engine)                   │   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────────┐  │   │
│  │  │ 味效增强模型  │  │ 味掩蔽模型    │  │ 香味平衡计算器            │  │   │
│  │  │ 增效/相乘    │  │ 掩盖/转化    │  │ 主体轮廓→香辛料比例       │  │   │
│  │  └──────────────┘  └──────────────┘  └──────────────────────────┘  │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                      ↓                                                     │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │               Step 5: 品质改良引擎 (Quality Engine)                  │   │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ │   │
│  │  │ 增稠设计 │ │ 乳化设计 │ │ 水分保持 │ │ 抗氧化设计│ │ 质构模拟 │ │   │
│  │  └──────────┘ └──────────┘ └──────────┘ └──────────┘ └──────────┘ │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                      ↓                                                     │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │               Step 6: 防腐保鲜引擎 (Preservation Engine)             │   │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐              │   │
│  │  │ 技术选型 │ │ 货架期精 │ │ 工艺适配 │ │ 风险预警 │              │   │
│  │  │ 推荐器   │ │ 准预测    │ │ 检查器   │ │ 系统     │              │   │
│  │  └──────────┘ └──────────┘ └──────────┘ └──────────┘              │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                      ↓                                                     │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │               Step 7: 功能性设计引擎 (Functional Engine)             │   │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐              │   │
│  │  │ 强化剂   │ │ 保留率   │ │ 营养均衡 │ │ 法规合规 │              │   │
│  │  │ 选择器   │ │ 预测器   │ │ 评估器   │ │ 检查器   │              │   │
│  │  └──────────┘ └──────────┘ └──────────┘ └──────────┘              │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                      ↓                                                     │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │         综合验证层 (Validation Layer) ← 继承现有 Synergy/Safety等   │   │
│  │  SynergyEngine · CompatibilityChecker · SafetyAlertSystem · GB28050 │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                      ↓                                                     │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │         结构化输出：君臣佐使 + 完整配方 + 生产指导 + 合规报告        │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                            │
└────────────────────────────────────────────────────────────────────────────┘
```

---

### 2.2 Step 1: 主体骨架设计引擎 — 详细设计

#### 核心功能

1. **原料选择器** — 从功效需求到候选药材的精确映射
2. **剂量计算器** — 基于产品形态的精确剂量确定
3. **产品结构决策器** — 根据产品类别确定配比规则

#### 新增文件

```
backend/app/services/formula/framework_engine.py     # 主体骨架设计引擎
backend/app/services/formula/product_form_rules.py   # 产品形态规则库
backend/app/services/formula/dosage_calculator.py    # 剂量计算器
```

#### 产品形态规则库设计

```python
# product_form_rules.py
"""
产品形态 → 配比规则映射
参考《中国普通配方设计思路》第一节"主体骨架设计"
"""

from dataclasses import dataclass
from typing import Dict, List, Optional

@dataclass
class ProductFormRule:
    """单种产品形态的配比规则"""
    form_type: str                # 产品形态
    total_dosage_g: float         # 日总用量(g)
    max_herbs: int                # 最大成分数
    min_herbs: int                # 最小成分数
    jun_ratio_range: tuple        # 君药占比范围
    chen_ratio_range: tuple       # 臣药占比范围
    zuo_ratio_range: tuple        # 佐药占比范围
    shi_ratio_range: tuple        # 使药占比范围
    water_content_limit: float    # 水分含量上限(%)
    particle_size_um: Optional[float] = None  # 粒径要求(μm)

# 产品形态规则库（覆盖主流中式食品形态）
PRODUCT_FORM_RULES: Dict[str, ProductFormRule] = {
    "保健饮品": ProductFormRule(
        form_type="保健饮品",
        total_dosage_g=50.0,      # 每次50g冲泡
        max_herbs=8,
        min_herbs=3,
        jun_ratio_range=(0.30, 0.45),  # 君药30-45%
        chen_ratio_range=(0.15, 0.25),
        zuo_ratio_range=(0.10, 0.20),
        shi_ratio_range=(0.05, 0.10),
        water_content_limit=5.0,
        particle_size_um=200.0,
    ),
    "代茶饮": ProductFormRule(
        form_type="代茶饮",
        total_dosage_g=10.0,       # 每次10g泡茶
        max_herbs=6,
        min_herbs=3,
        jun_ratio_range=(0.35, 0.50),
        chen_ratio_range=(0.15, 0.25),
        zuo_ratio_range=(0.10, 0.15),
        shi_ratio_range=(0.05, 0.10),
        water_content_limit=8.0,
    ),
    "膏方": ProductFormRule(
        form_type="膏方",
        total_dosage_g=30.0,       # 每次30g膏滋
        max_herbs=12,
        min_herbs=5,
        jun_ratio_range=(0.20, 0.35),
        chen_ratio_range=(0.15, 0.25),
        zuo_ratio_range=(0.15, 0.25),
        shi_ratio_range=(0.05, 0.10),
        water_content_limit=15.0,
    ),
    "散剂": ProductFormRule(
        form_type="散剂",
        total_dosage_g=15.0,       # 每次15g
        max_herbs=10,
        min_herbs=3,
        jun_ratio_range=(0.25, 0.40),
        chen_ratio_range=(0.15, 0.25),
        zuo_ratio_range=(0.10, 0.20),
        shi_ratio_range=(0.05, 0.10),
        water_content_limit=3.0,
        particle_size_um=150.0,
    ),
    "丸剂": ProductFormRule(
        form_type="丸剂",
        total_dosage_g=9.0,        # 每次9g（约30丸）
        max_herbs=8,
        min_herbs=3,
        jun_ratio_range=(0.30, 0.45),
        chen_ratio_range=(0.15, 0.25),
        zuo_ratio_range=(0.10, 0.20),
        shi_ratio_range=(0.05, 0.10),
        water_content_limit=12.0,
    ),
    "口服液": ProductFormRule(
        form_type="口服液",
        total_dosage_g=10.0,       # 每次10ml≈10g
        max_herbs=6,
        min_herbs=3,
        jun_ratio_range=(0.30, 0.45),
        chen_ratio_range=(0.15, 0.25),
        zuo_ratio_range=(0.10, 0.20),
        shi_ratio_range=(0.05, 0.10),
        water_content_limit=None,   # 液态产品不限
    ),
    "功能性食品": ProductFormRule(
        form_type="功能性食品",
        total_dosage_g=100.0,      # 每100g产品
        max_herbs=15,
        min_herbs=5,
        jun_ratio_range=(0.10, 0.25),
        chen_ratio_range=(0.10, 0.20),
        zuo_ratio_range=(0.10, 0.20),
        shi_ratio_range=(0.03, 0.08),
        water_content_limit=5.0,
    ),
}
```

#### 剂量计算器核心逻辑

```python
# dosage_calculator.py
"""
基于产品形态的精确剂量计算器

设计原理：
1. 从优化器获取候选药材列表
2. 根据产品形态规则确定总用量和各角色比例范围
3. 使用 MILP 精确求解各药材用量
4. 满足：①总和=总剂量 ②各角色在比例范围内 ③单味在安全剂量范围内
"""

from dataclasses import dataclass
from typing import Dict, List, Optional
import logging

logger = logging.getLogger(__name__)

@dataclass
class DosageResult:
    """剂量计算结果"""
    formula: Dict[str, float]           # {herb_name: dosage_g}
    total_dosage_g: float               # 总用量
    product_form: str                   # 产品形态
    jun_herbs: List[str]                # 君药列表
    chen_herbs: List[str]               # 臣药列表
    zuo_herbs: List[str]                # 佐药列表
    shi_herb: str                       # 使药
    structure_score: float              # 结构合规度
    violations: List[str] = None        # 违规项

    def __post_init__(self):
        if self.violations is None:
            self.violations = []


class DosageCalculator:
    """
    剂量计算器

    核心算法：
    - 输入：候选药材列表 + 功效权重 + 产品形态规则
    - 约束：总剂量固定、各角色比例范围、单味安全剂量
    - 目标：最大化功效得分 × 结构合规度
    """

    def __init__(self, product_form_rules: Dict[str, "ProductFormRule"] = None):
        self._rules = product_form_rules or PRODUCT_FORM_RULES

    def calculate(
        self,
        candidate_herbs: List[Dict],     # [{id, name, efficacy_score, safety_index, ...}]
        target_effects: List[str],
        product_form: str,
        structural_compliance: float = 0.7,
    ) -> DosageResult:
        """
        计算精确剂量

        Args:
            candidate_herbs: 候选药材列表（来自优化器）
            target_effects: 目标功效
            product_form: 产品形态
            structural_compliance: 君臣佐使结构合规度（0~1）

        Returns:
            DosageResult
        """
        rule = self._rules.get(product_form)
        if not rule:
            raise ValueError(f"不支持的产品形态: {product_form}")

        # Step 1: 按角色分组
        sorted_herbs = self._assign_roles(candidate_herbs, structural_compliance)
        jun = sorted_herbs[:1]                    # 君药1味
        chen = sorted_herbs[1:3]                  # 臣药2味
        zuo = sorted_herbs[3:5]                   # 佐药2味
        shi = sorted_herbs[5:6] if len(sorted_herbs) > 5 else []  # 使药1味

        # Step 2: MILP 精确求解
        formula, violations = self._solve_milp(
            jun=jun, chen=chen, zuo=zuo, shi=shi,
            rule=rule, target_effects=target_effects
        )

        return DosageResult(
            formula=formula,
            total_dosage_g=rule.total_dosage_g,
            product_form=product_form,
            jun_herbs=[h["name"] for h in jun],
            chen_herbs=[h["name"] for h in chen],
            zuo_herbs=[h["name"] for h in zuo],
            shi_herb=shi[0]["name"] if shi else "",
            structure_score=structural_compliance,
            violations=violations,
        )

    def _assign_roles(self, herbs: List[Dict], compliance: float) -> List[Dict]:
        """按功效得分和安全性分配君臣佐使角色"""
        # 排序：功效分高 + 安全性高优先
        scored = sorted(herbs, key=lambda h: (
            h.get("efficacy_score", 0) * 0.6 +
            h.get("safety_index", 0) * 0.4
        ), reverse=True)
        return scored[:6]

    def _solve_milp(self, ...):
        """MILP 精确求解（调用 lp_solver）"""
        # 实现略，复用现有 MILPSolver
        pass
```

---

### 2.3 Step 2: 调色设计引擎 — 详细设计

#### 核心功能

1. **着色剂合规选择器** — GB 2760 着色剂目录 + 适用产品
2. **拼色计算器** — CIELAB 色彩空间中的混合预测
3. **工艺适配检测器** — pH/温度对颜色的影响

#### 新增文件

```
backend/app/services/formula/color_engine.py     # 调色设计引擎
backend/app/services/formula/color_database.py   # 着色剂数据库
```

#### 着色剂数据库设计

```python
# color_database.py
"""
GB 2760 允许使用的食品着色剂数据库

数据来源：GB 2760-2014 食品添加剂使用标准
"""

from dataclasses import dataclass
from typing import Dict, List

@dataclass
class Colorant:
    """着色剂定义"""
    name: str                    # 着色剂名称
    e_number: str                # E编码
    cs_number: str               # 中国序号
    type_: str                   # "天然" | "合成"
    solubility: str              # "水溶性" | "油溶性"
    ph_stability: tuple          # 稳定pH范围
    heat_stability: bool         # 耐热性
    light_stability: bool        # 耐光性
    max_usage_g_per_kg: float    # 最大使用量(g/kg)
    applicable_foods: List[str]  # 适用食品类别
    color_lab: tuple             # CIELAB值 (L*, a*, b*)
    notes: str = ""

# 核心着色剂库
COLORANT_DB: Dict[str, Colorant] = {
    "甜菜红": Colorant(
        name="甜菜红", e_number="E162", cs_number="08.001",
        type_="天然", solubility="水溶性",
        ph_stability=(3.0, 7.0), heat_stability=True, light_stability=False,
        max_usage_g_per_kg=0.05,
        applicable_foods=["饮料", "糖果", "糕点", "配制酒"],
        color_lab=(30.0, 25.0, -15.0),
    ),
    "姜黄": Colorant(
        name="姜黄", e_number="E100", cs_number="05.001",
        type_="天然", solubility="水溶性",
        ph_stability=(6.0, 8.0), heat_stability=True, light_stability=False,
        max_usage_g_per_kg=0.10,
        applicable_foods=["饮料", "糕点", "食用油", "膨化食品"],
        color_lab=(80.0, 10.0, 75.0),
    ),
    "栀子黄": Colorant(
        name="栀子黄", e_number="E163", cs_number="09.002",
        type_="天然", solubility="水溶性",
        ph_stability=(4.0, 8.0), heat_stability=True, light_stability=True,
        max_usage_g_per_kg=0.20,
        applicable_foods=["饮料", "糕点", "冰淇淋", "配制酒"],
        color_lab=(70.0, 5.0, 65.0),
    ),
    "焦糖色": Colorant(
        name="焦糖色", e_number="E150a", cs_number="04.001",
        type_="合成", solubility="水溶性",
        ph_stability=(2.0, 10.0), heat_stability=True, light_stability=False,
        max_usage_g_per_kg=2.0,
        applicable_foods=["酱油", "碳酸饮料", "配制酒", "糖果"],
        color_lab=(10.0, 2.0, 15.0),
    ),
    "β-胡萝卜素": Colorant(
        name="β-胡萝卜素", e_number="E160a", cs_number="01.001",
        type_="天然", solubility="油溶性",
        ph_stability=(3.0, 8.0), heat_stability=True, light_stability=False,
        max_usage_g_per_kg=0.15,
        applicable_foods=["饮料", "糖果", "糕点", "乳制品"],
        color_lab=(65.0, 20.0, 70.0),
    ),
    "花青素": Colorant(
        name="花青素", e_number="E163", cs_number="12.001",
        type_="天然", solubility="水溶性",
        ph_stability=(2.0, 5.0), heat_stability=False, light_stability=True,
        max_usage_g_per_kg=0.50,
        applicable_foods=["饮料", "糖果", "配制酒"],
        color_lab=(20.0, 15.0, -30.0),
    ),
}
```

---

### 2.4 Step 3: 调香设计引擎 — 详细设计

#### 核心功能

1. **香气轮廓建模** — Top/Mid/Base note 三层模型
2. **挥发动力学** — 香气随时间和温度的释放曲线
3. **矫味剂匹配** — 掩盖不良气味

#### 新增文件

```
backend/app/services/formula/fragrance_engine.py   # 调香设计引擎
backend/app/services/formula/aroma_database.py     # 香气成分数据库
```

#### 核心设计

```python
# fragrance_engine.py
"""
调香设计引擎 — 基于香气轮廓模型的智能调香

设计原理：
1. 根据主体骨架确定基础风味
2. 计算香气层次（Top/Mid/Base）
3. 检测不良气味并匹配矫味剂
4. 输出调香方案
"""

from dataclasses import dataclass
from typing import Dict, List, Optional

@dataclass
class AromaProfile:
    """香气轮廓"""
    top_note: List[str]        # 前调（挥发性强，先感知）
    mid_note: List[str]        # 中调（主体香气）
    base_note: List[str]       # 后调（持久留香）
    intensity_score: float     # 强度 0~1
    pleasantness_score: float  # 愉悦度 0~1

class FragranceEngine:
    """调香设计引擎"""

    def design(
        self,
        framework_result: Dict,    # Step 1 输出
        product_form: str,
    ) -> Dict:
        """
        调香设计主入口

        流程：
        1. 基于药材确定基础香气轮廓
        2. 检测不良气味（苦/涩/腥/膻）
        3. 匹配矫味剂
        4. 输出调香方案
        """
        # ... 实现
        pass
```

---

### 2.5 Step 4: 调味设计引擎 — 详细设计

#### 现有 vs 待增强

| 能力 | 现有 | 目标 |
|---|---|---|
| 五味调和 MSE 模型 | ✅ 已实现 | ✅ 保留 |
| 味效增强（相乘） | ❌ | ✅ 新增 |
| 味掩蔽模型 | ❌ | ✅ 新增 |
| 味转化模型 | ❌ | ✅ 新增 |
| 主体香味轮廓确定 | ❌ | ✅ 新增 |
| 香辛料组合平衡 | ❌ | ✅ 新增 |

#### 新增文件

```
backend/app/services/formula/flavor_engine.py    # 调味设计引擎
```

---

### 2.6 Step 5: 品质改良设计引擎 — 详细设计

#### 核心功能

```
品质改良设计 = 7类设计 + 质构模拟

1. 增稠设计   → 亲水胶体选择 + 粘度模型
2. 乳化设计   → HLB值计算 + 乳液稳定性
3. 水分保持   → 磷酸盐/乳酸盐选型
4. 抗氧化设计 → 抗氧化剂复配 + 氧化动力学
5. 催化设计   → 酶制剂选型
6. 抗结设计   → 防结块剂选择
7. 消泡设计   → 消泡剂选型
```

#### 新增文件

```
backend/app/services/formula/quality_engine.py   # 品质改良设计引擎
```

---

### 2.7 Step 6: 防腐保鲜设计引擎 — 详细设计

#### 现有能力扩展

| 现有 | 新增 |
|---|---|
| StabilityPredictor（货架期预测） | 防腐技术选型推荐器 |
| | 工艺适配检查 |
| | 风险预警升级（动态阈值） |

#### 新增文件

```
backend/app/services/formula/preservation_engine.py  # 防腐保鲜设计引擎
```

---

### 2.8 Step 7: 功能性设计引擎 — 详细设计

#### 新增功能

```
功能性设计 = 营养强化 + 保留率预测 + 合规检查

1. 强化剂选择器 — 针对目标人群的营养缺乏问题选择强化剂
2. 保留率预测器 — 考虑加工过程中的营养损失
3. 营养均衡评估器 — 确保强化后的营养均衡性
4. 法规合规检查器 — GB 14880 营养强化剂标准
```

#### 新增文件

```
backend/app/services/formula/functional_engine.py  # 功能性设计引擎
```

---

### 2.9 统一编排引擎升级

#### 核心变化

```python
# 新架构：七步流水线 + 反馈循环
class SevenStepFormulaEngine:
    """七步配方设计引擎"""

    async def design(self, request: FormulaRequest) -> FormulaOutput:
        # Step 1: 主体骨架设计
        framework = await self._framework_engine.design(
            effects=request.target_effects,
            product_form=request.product_form,
            target_group=request.target_group,
        )

        # Step 2: 调色设计
        color = await self._color_engine.design(
            framework=framework,
            product_form=request.product_form,
        )

        # Step 3: 调香设计
        fragrance = await self._fragrance_engine.design(
            framework=framework,
            product_form=request.product_form,
        )

        # Step 4: 调味设计
        flavor = await self._flavor_engine.design(
            framework=framework,
            fragrance=fragrance,
        )

        # Step 5: 品质改良设计
        quality = await self._quality_engine.design(
            framework=framework,
            product_form=request.product_form,
        )

        # Step 6: 防腐保鲜设计
        preservation = await self._preservation_engine.design(
            framework=framework,
            quality=quality,
            shelf_life_target=request.shelf_life_months,
        )

        # Step 7: 功能性设计
        functional = await self._functional_engine.design(
            framework=framework,
            target_group=request.target_group,
            nutrition_requirements=request.nutrition_requirements,
        )

        # 综合验证
        validation = await self._validate(
            framework=framework,
            color=color,
            fragrance=fragrance,
            flavor=flavor,
            quality=quality,
            preservation=preservation,
            functional=functional,
        )

        return FormulaOutput(
            framework=framework,
            color=color,
            fragrance=fragrance,
            flavor=flavor,
            quality=quality,
            preservation=preservation,
            functional=functional,
            validation=validation,
        )
```

---

## 第三部分：实施计划

### 3.1 阶段划分

| 阶段 | 名称 | 工期 | 核心产出 | 依赖 |
|---|---|---|---|---|
| **Phase 1** | 基础设施 | 1周 | 数据库扩展 + 产品形态规则库 | 无 |
| **Phase 2** | Step1 骨架设计 | 2周 | FrameworkEngine + DosageCalculator | Phase 1 |
| **Phase 3** | Step2-4 感官设计 | 2周 | Color/Fragrance/Flavor Engine | Phase 2 |
| **Phase 4** | Step5-6 品质+保鲜 | 2周 | Quality/Preservation Engine | Phase 3 |
| **Phase 5** | Step7 功能性 | 1周 | Functional Engine | Phase 4 |
| **Phase 6** | 统一编排 | 1周 | SevenStepEngine + API集成 | Phase 5 |
| **Phase 7** | 测试验证 | 1周 | 集成测试 + 专家评审 | Phase 6 |

**总工期：10 周**

### 3.2 各阶段详细任务

#### Phase 1: 基础设施（1周）

| # | 任务 | 文件 | 验收标准 |
|---|------|------|---------|
| 1.1 | 药材数据库扩展至 200+ 味 | `bayesian_formula_optimizer.py` + DB | 功效索引覆盖全部目标功效 |
| 1.2 | 产品形态规则库 | `formula/product_form_rules.py` | 7种形态全覆盖 |
| 1.3 | 着色剂数据库 | `formula/color_database.py` | GB 2760 核心着色剂 |
| 1.4 | 香气成分数据库 | `formula/aroma_database.py` | 50+ 常见香气成分 |

#### Phase 2: Step1 主体骨架设计（2周）

| # | 任务 | 文件 | 验收标准 |
|---|------|------|---------|
| 2.1 | DosageCalculator | `formula/dosage_calculator.py` | MILP精确求解，约束满足率>95% |
| 2.2 | FrameworkEngine | `formula/framework_engine.py` | 与优化器集成，端到端跑通 |
| 2.3 | 产品形态适配 | `formula/framework_engine.py` | 每种形态生成合理剂量 |

#### Phase 3: Step2-4 感官设计（2周）

| # | 任务 | 文件 | 验收标准 |
|---|------|------|---------|
| 3.1 | ColorEngine | `formula/color_engine.py` | 着色剂选择合规率100% |
| 3.2 | FragranceEngine | `formula/fragrance_engine.py` | 香气轮廓合理 |
| 3.3 | FlavorEngine | `formula/flavor_engine.py` | 五味调和+增强+掩蔽模型 |

#### Phase 4: Step5-6 品质+保鲜（2周）

| # | 任务 | 文件 | 验收标准 |
|---|------|------|---------|
| 4.1 | QualityEngine | `formula/quality_engine.py` | 7类改良设计均可执行 |
| 4.2 | PreservationEngine | `formula/preservation_engine.py` | 技术选型推荐准确率>80% |

#### Phase 5: Step7 功能性（1周）

| # | 任务 | 文件 | 验收标准 |
|---|------|------|---------|
| 5.1 | FunctionalEngine | `formula/functional_engine.py` | 强化剂选择+保留率预测 |

#### Phase 6: 统一编排（1周）

| # | 任务 | 文件 | 验收标准 |
|---|------|------|---------|
| 6.1 | SevenStepEngine | `formula/seven_step_engine.py` | 七步流水线端到端 |
| 6.2 | API适配 | `api/formulas.py` + `api/ai_modules/` | 向后兼容，新接口可用 |

#### Phase 7: 测试验证（1周）

| # | 任务 | 验收标准 |
|---|------|---------|
| 7.1 | 单元测试 | 各引擎独立测试覆盖率>80% |
| 7.2 | 集成测试 | 七步端到端测试通过 |
| 7.3 | 专家评审 | 3位食品科学专家盲评 |
| 7.4 | 对比实验 | 与现有系统产出对比评分 |

---

## 第四部分：风险与缓解

| 风险 | 概率 | 影响 | 缓解措施 |
|---|---|---|---|
| 数据不足（着色剂/香气数据库） | 中 | 高 | 从GB标准文档人工录入核心数据 |
| 专家知识难以数字化 | 高 | 高 | 与食品科学专家合作建立规则库 |
| 与现有系统冲突 | 低 | 中 | 渐进式替换，保持API兼容 |
| 开发周期超支 | 中 | 中 | Phase 1-2 为 MVP，后续迭代 |
| 法规变动导致数据库失效 | 低 | 高 | 数据库版本化管理，定期更新 |

---

## 第五部分：决策建议

### 建议执行策略

```
方案A: 全量推进（10周）
  ├─ 优点：一次到位，完整覆盖7步
  └─ 缺点：周期长，风险集中

方案B: 分步交付（推荐）⭐
  ├─ Week 1-2: 交付 Phase 1+2（骨架设计 + 数据库扩展）→ 立即提升核心质量
  ├─ Week 3-6: 交付 Phase 3-4（感官 + 品质）→ 完善产品体验
  └─ Week 7-10: 交付 Phase 5-7（功能 + 编排 + 验证）→ 完成闭环

方案C: 仅补关键缺失（4周）
  ├─ 只做 Phase 1+2（骨架设计 + 数据库）
  └─ 后续迭代其余
```

### 我的建议

**推荐方案 B（分步交付）**，理由：
1. **骨架设计（Step 1）是最关键的** — 当前剂量分配过于粗糙，直接影响配方实用性
2. **数据库扩展是基础** — 当前仅 50 味药材严重限制了所有后续步骤
3. **分步验证** — 每阶段交付后可获得真实使用反馈
4. **风险可控** — 即使中途调整，已有产出可复用

---

## 附录：新建文件清单

```
backend/app/services/formula/
├── framework_engine.py          # Step 1: 主体骨架设计引擎
├── product_form_rules.py        # 产品形态规则库
├── dosage_calculator.py         # 剂量计算器
├── color_engine.py              # Step 2: 调色设计引擎
├── color_database.py            # 着色剂数据库
├── fragrance_engine.py          # Step 3: 调香设计引擎
├── aroma_database.py            # 香气成分数据库
├── flavor_engine.py             # Step 4: 调味设计引擎
├── quality_engine.py            # Step 5: 品质改良设计引擎
├── preservation_engine.py       # Step 6: 防腐保鲜设计引擎
├── functional_engine.py         # Step 7: 功能性设计引擎
├── seven_step_engine.py         # 七步统一编排引擎
└── __init__.py                  # 更新导出

backend/app/api/
├── formulas.py                  # 新增七步引擎 API 端点
└── ai_modules/generation.py     # 适配新引擎

backend/app/schemas/
└── formula.py                   # 新增 SevenStepRequest/Response schema
```
