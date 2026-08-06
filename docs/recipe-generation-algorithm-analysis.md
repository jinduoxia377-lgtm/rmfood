# 配方生成算法学术分析报告

> 分析日期：2026-08-06  
> 分析人：RMFOOD 算法团队（院士级评审）  
> 分支：fix/security-hardening

---

## 一、系统整体架构

```
┌─────────────────────────────────────────────────────────────┐
│                     配方生成入口层                            │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐  │
│  │ FormulaGPT   │  │ NeuralEngine │  │  LLM (可选)      │  │
│  │ 规则引擎      │  │ 神经网络      │  │  大模型推理       │  │
│  └──────┬───────┘  └──────┬───────┘  └────────┬─────────┘  │
│         └──────────────────┼───────────────────┘            │
│                            ↓                               │
│  ┌──────────────────────────────────────────────────────┐  │
│  │              协同/安全/营养 后处理管线                  │  │
│  │  SynergyEngine  →  SafetyChecker  →  NutritionSvc   │  │
│  └──────────────────────────────────────────────────────┘  │
│                            ↑                               │
│         ┌──────────────────┼──────────────────┐            │
│         ↓                  ↓                   ↓            │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐    │
│  │ Bayesian     │  │ NSGA-II      │  │  降级方案      │    │
│  │ 优化器       │  │ 多目标GA      │  │  功效评分      │    │
│  └──────────────┘  └──────────────┘  └──────────────┘    │
└─────────────────────────────────────────────────────────────┘
```

**文件路径索引：**

| 模块 | 路径 |
|------|------|
| 总控制器 | `app/services/formula_designer.py` |
| API层 | `app/api/ai_modules/generation.py` |
| 贝叶斯优化器 | `app/services/ai/algorithms/bayesian_formula_optimizer.py` |
| NSGA-II 算法 | `app/services/ai/algorithms/algorithm.py` |
| 多维评估器 | `app/services/ai/algorithms/evaluator.py` |
| 数据结构 | `app/services/ai/algorithms/models.py` |
| 安全合规 | `app/services/ai_models/safety_checker.py` |
| FormulaGPT (模拟) | `app/services/ai_models/formula_gpt.py` |

---

## 二、核心算法：双层优化引擎

### 2.1 算法选择逻辑（`formula_designer.py:21-44`）

```python
async def design(self, intent, knowledge):
    effects = intent.get("target_effects") or ["免疫调节", "抗氧化"]

    if intent.get("is_peptide"):
        return self._design_peptide(effects)        # 肽类专用

    formula_data = await self._optimize_formula(effects, intent)

    if formula_data and len(formula_data) >= 3:
        # 贝叶斯或 NSGA-II 成功
        return self._build_tcm_structure(formula_data, effects, intent)

    return self._manual_formula_design(effects, intent)  # 降级方案
```

**架构设计**：优先调用贝叶斯优化，失败则 NSGA-II，再失败则功效评分降级，形成三级冗余。

---

### 2.2 贝叶斯优化引擎（核心优先路径）

**文件**: `app/services/ai/algorithms/bayesian_formula_optimizer.py`

#### 算法原理

将配方生成建模为**黑箱多目标优化问题**：

```
目标: argmax f(配方成分向量)
其中 f = 0.40×功效 + 0.25×安全 + 0.15×口感 + 0.20×成本（归一化权重）
```

#### 核心算法流程（`generate()` 方法）

```
Step 1: 药材选择 (_select_herbs)
  ├─ 按功效精确匹配 _EFFICACY_TO_HERBS 索引
  ├─ 模糊匹配（字符集 Jaccard > 0.6）
  ├─ 提取君药（top 30% 功效评分）
  ├─ 提取臣药（剩余候选）
  └─ 附加协同配伍药材（synergy_partners）

Step 2: 拉丁超立方采样 (Latin Hypercube Sampling)
  ├─ 将 [0,1]^n 空间均匀分桶
  └─ 每维随机选一点，shuffle 后组成采样点

Step 3: 高斯过程回归建模 (GPR)
  ├─ RBF 核函数: K(x1,x2) = σ² × exp(-||x1-x2||² / 2l²)
  ├─ 构建核矩阵 K + 噪声项 I·σ²ₙ
  ├─ 高斯消元求逆 (O(n³)，限制规模)
  └─ 后验预测: μ* = k*ᵀK⁻¹Y,  σ²* = K(x*,x*) - k*ᵀK⁻¹k*

Step 4: Expected Improvement 采集函数
  ├─ EI(x) = (μ - f*)·Φ(z) + σε(z),  z = (μ-f*)/σ
  ├─ 10 次随机重启寻找最优候选
  ├─ 15% 概率扰动探索
  └─ 注入配伍先验（协同加分、相反扣分）

Step 5: 迭代优化（默认 30 轮）
  └─ 每轮: 采样 → 解码用量 → 评估 → 更新 GP

Step 6: 去重 + Top-K 返回
  └─ Jaccard 相似度 > 0.7 视为重复
```

#### 关键代码 — 评估函数（`_evaluate_formula`，行 632-712）

```python
# 功效评分（目标功效加权几何平均）
for effect in target_effects:
    effect_score = sum(
        herb.efficacy_scores.get(effect, 0) * (0.5 + 0.5 * dosage_weight)
        for herb in herbs
    ) / n_herbs
efficacy_final = prod(scores) ** (1/n)  # 几何平均，强调全面性

# 安全评分（含配伍禁忌惩罚）
safety = mean(herb.safety_index * (1 - 0.3 * dosage_ratio))
for forbidden_pair in antagonistic_pairs:
    safety *= (1 - 0.15)  # 每对禁忌扣分15%

# 综合评分（加权）
overall = 0.40 * efficacy + 0.25 * safety + 0.15 * taste + 0.20 * cost
```

#### 先验知识注入（`_inject_synergy_bias`，行 612-628）

```python
# 提高协同药材用量
if x[i] > 0.3 and x[j] < 0.5:
    x[j] = min(1.0, x[j] + 0.1)

# 避免相反药材同时高用量
if x[i] > 0.5 and x[j] > 0.5:
    x[j] = max(0.0, x[j] - 0.3)
```

---

### 2.3 NSGA-II 多目标遗传算法（并行/备选引擎）

**文件**: `app/services/ai/algorithms/algorithm.py` + `evaluator.py`

#### 算法原理

**Pareto 前沿求解**：同时优化 7 个目标，不聚合为单值：

| 目标 | 键 | 方向 | 默认权重 |
|------|------|------|------|
| 功效效能 | `efficacy` | maximize | 0.30 |
| 安全性 | `safety` | maximize | 0.25 |
| 口感 | `taste` | maximize | 0.10 |
| 成本效率 | `cost_efficiency` | maximize | 0.15 |
| 协同效应 | `synergy` | maximize | 0.10 |
| 稳定性 | `stability` | maximize | 0.10 |
| ADMET | `admet` | maximize | — |

#### NSGA-II 主循环（`_run_nsga2_loop`，行 97-251）

```
初始化:
  ├─ 经典方剂种子 (四君子汤、六味地黄丸、桂枝汤、逍遥散、银翘散)
  ├─ 功效最佳随机种子 (5个)
  └─ 随机填充至 population_size (默认60)

每代循环:
  ├─ 多样性检测 → < 0.15 时注入 20% 随机个体
  ├─ 快速非支配排序 O(MN²)
  ├─ 拥挤度距离分配
  ├─ 锦标赛选择 (size=5)
  ├─ SBX 交叉 (η=15)
  ├─ 多项式变异 (η_m=20, 自适应率)
  ├─ 精英保留 (combined = population + offspring, 截断)
  └─ 小生境清除 (niche_radius=0.15, max_per_niche=3)

早停:
  ├─ 达到阈值 early_stop_threshold
  └─ 连续 patience 代无改进
```

#### 评估器核心（`FormulaEvaluator.evaluate_full`，行 179-394）

```python
# 1. 功效评分 — 多功效几何平均 + 用量归一化
dosage_ratio = (dosage - min) / (max - min)
effect_score = herb.efficacy_scores[te] * (0.5 + 0.5 * dosage_ratio)

# 2. 安全性 — 基础安全 × 配伍惩罚
nature_conflict:    大热 + 寒 = -8%
antagonistic_pair:  相反药材  = -12%
special_group:      孕妇/儿童/老人 额外惩罚

# 3. 口感 — 五味调和 MSE 模型
ideal_ratios = {sweet: 0.45, neutral: 0.20, bitter: 0.15, pungent: 0.12}
taste_base = max(0, 1 - MSE × 8)
if bitter > 0.25: taste_base *= max(0.4, 1 - (bitter - 0.25) * 2)

# 4. 协同效应 — 三层评分模型
# Layer 1: 功效互补 Jaccard (0.15) + 差异互补 (0.25)
# Layer 2: 经典配伍字典 lookup
# Layer 3: 用量比例协调 (0.20~0.30, ratio 2~4 最优)
dynamic_syn = (base_syn - 0.15) + layer3
balance = 1 - |d1 - d2| / (d1 + d2)

# 5. 稳定性 — 安全性 × 用量中点偏移惩罚
r_factor = 1 - 0.3 * |dosage - mid| / range

# 6. ADMET = mean(safety, stability, cost_inverse)

# 属性增强
meridian_coverage_bonus = min(len(covered_meridians) / 12, 1.0) * 0.05
```

---

## 三、后处理管线

### 3.1 君臣佐使结构构建（`formula_designer.py:110-163`）

```python
sorted_herbs = sorted(dosages.items(), key=lambda x: -x[1])  # 按用量降序
roles = ["君", "臣", "臣", "佐", "佐", "使"]
for i, (name, dosage) in enumerate(sorted_herbs[:6]):
    role = roles[i]  # 用量最大 → 君药
```

### 3.2 安全合规检查（`safety_checker.py`）

四层检查：

| 层级 | 检查内容 | 规则来源 |
|------|----------|----------|
| 1 | 药食同源目录 | 109种合规材料白名单（卫健委公告） |
| 2 | 配伍禁忌 | 十九畏（15对）+ 十八反（13对）= 28对 |
| 3 | 过敏原 | 花生/大豆/牛奶/鸡蛋/坚果/鱼/贝类 |
| 4 | 特殊人群 | 孕妇慎用清单 + 肽段序列安全（长度/模式） |

### 3.3 协同效应分析（`synergy_engine.py`）

五机制协同指数（SI 范围 0~1）：

| 机制 | 说明 |
|------|------|
| Mechanism-1 | Bliss Independence（药效增强协同） |
| Mechanism-2 | PK Interaction（药代动力学协同） |
| Mechanism-3 | Gibbs Free Energy（结构稳定性协同） |
| Mechanism-4 | Network Pharmacology（网络药理学靶点协同） |
| Mechanism-5 | Taste Matrix（感官品质协同） |

---

## 四、肽类配方分支（`_design_peptide`，行 240-260）

```python
def _design_peptide(self, effects):
    return {
        "summary": "已完成活性肽配方设计",
        "data": [
            {"role": "君", "name": "ACE抑制复合多肽",  "dosage": "5-10g/天",
             "purpose": "竞争性抑制ACE活性，降低血管紧张素Ⅱ"},
            {"role": "臣", "name": "山楂提取物",        "dosage": "500mg",
             "purpose": "黄酮类协同降脂"},
            {"role": "佐", "name": "决明子提取物",      "dosage": "300mg",
             "purpose": "蒽醌类辅助降压"},
            {"role": "使", "name": "丹参素",            "dosage": "200mg",
             "purpose": "改善微循环"},
        ],
        "scores": {"overall_score": 0.75},
    }
```

> **注**：肽类分支目前为**静态模板**，未调用 DFBP 数据库或 PepINVERT 进行动态生成。

---

## 五、算法数据流总结

```
用户输入: {target_effects, constraints, is_peptide?}
                ↓
        ┌───────┴───────┐
        ↓               ↓
   肽类分支          普通配方分支
   _design_peptide   _optimize_formula()
                         ↓
              ┌──────────┴──────────┐
              ↓                     ↓
       贝叶斯优化器 (GP+EI)    降级: 功效评分规则引擎
       (优先路径，30轮迭代)    _manual_formula_design
              ↓
       评估: 功效/安全/口感/成本
              ↓
       GP更新 + EI采样 (30轮)
              ↓
       Top-3 候选 → _build_tcm_structure()
              ↓
       君臣佐使排序 (按用量降序)
              ↓
       后处理: 安全检查 → 协同分析 → 营养计算
              ↓
       返回: {summary, data, scores}
```

---

## 六、算法设计合理性评价

### ✅ 优点

| 方面 | 评价 |
|------|------|
| **多层冗余** | 贝叶斯 → NSGA-II → 规则引擎，三级降级，容错性优 |
| **多目标优化** | 7 维评估（功效/安全/口感/成本/协同/稳定/ADMET）比单目标更科学 |
| **先验知识注入** | 经典方剂种子 + 配伍禁忌 + 四气五味 + 归经理论，深度结合中医知识 |
| **Pareto 前沿** | NSGA-II 输出多组非支配解，供决策者权衡，非单一"最优" |
| **自适应机制** | 多样性过低时注入随机个体、变异率自适应调整、早停策略 |
| **剂量约束硬编码** | 每种药材有 min/max/step，避免物理不可行的配方 |
| **协同三层评分** | Layer1(功效互补) + Layer2(经典配伍) + Layer3(用量协调)，结构合理 |

### ⚠️ 值得关注的问题

| # | 问题 | 位置 | 影响 | 建议 |
|---|------|------|------|------|
| 1 | GP 求逆 O(n³) 无稀疏近似 | `bayesian_formula_optimizer.py:778-807` | 候选药材 >30 时较慢 | 引入 Sparse GP 或 FITC 近似 |
| 2 | 疗效数据手工标注 | `_BUILTIN_HERBS` (约200行) | 数据不可扩展，难以验证准确性 | 对接 TCMSP / DFBP 数据库自动填充 |
| 3 | FormulaGPT 为 MOCK | `formula_gpt.py:1`（文件头明确标注） | LLM 路径未实际工作 | 接入 vLLM 或真实 API |
| 4 | 口感模型较粗 | `evaluator.py:395-416` | 五味仅归4类，理想比例固定 | 引入真实感官评分数据校准 |
| 5 | 配伍禁忌字典有限 | `safety_checker.py:40-54` | 仅覆盖28对，典籍中禁忌远多于此 | 补充《神农本草经》《本草纲目》完整禁忌表 |
| 6 | 肽类分支为静态模板 | `formula_designer.py:240-260` | 无动态生成能力 | 接入 PepINVERT 或 DFBP 肽数据库 |
| 7 | 无交叉验证评估指标 | 全局 | 算法效果缺乏量化基准 | 引入 10-fold CV 及 AUC-ROC 评估 |

---

## 七、核心数据结构

### 7.1 药材参数（`HerbParameter`）

```python
@dataclass
class HerbParameter:
    herb_id: str                      # 唯一ID (如 "hq")
    name_cn: str                      # 中文名 (如 "黄芪")
    dosage_min: float                 # 最小用量 (g)
    dosage_max: float                 # 最大用量 (g)
    dosage_step: float                # 用量步长 (g)
    efficacy_scores: Dict[str, float] # 功效评分 {功效名: 0~1}
    safety_index: float               # 安全性指数 0~1
    cost_per_gram: float              # 每克成本 (元)
    synergy_partners: List[str]       # 协同配伍药材ID列表
    antagonistic_pairs: List[str]     # 相反药材ID列表
```

### 7.2 配方候选（`FormulaCandidate`）

```python
@dataclass
class FormulaCandidate:
    ingredients: Dict[str, float]   # {药材ID: 用量(g)}
    efficacy_score: float           # 功效评分 (0~1)
    safety_score: float             # 安全评分 (0~1)
    taste_score: float              # 口感评分 (0~1)
    cost_score: float               # 成本评分 (0~1)
    overall_score: float            # 综合评分 (0~1)
    confidence: float               # 置信度 (0~1)
    generation_round: int           # 生成轮次
```

### 7.3 多目标个体（`MultiObjectiveIndividual`）

```python
class MultiObjectiveIndividual:
    genes: Dict[str, float]         # {药材ID: 用量(g)}
    objectives: Dict[str, float]    # {目标键: 值} (7维)
    rank: int                       # 非支配层级
    crowding_distance: float        # 拥挤度距离
    fitness: float                  # 加权适应度
    efficacy, safety, taste, cost_score, synergy, stability, admet: float
```

---

## 八、关键超参数汇总

| 参数 | 贝叶斯优化 | NSGA-II |
|------|-----------|---------|
| 初始采样数 | 10 (LHS) | 60 (种群大小) |
| 迭代轮次/代数 | 30 | 50 |
| 候选药材上限 | 12 | 15 |
| 最小成分数 | 3 | 3 |
| 探索权重 (ε) | 0.3 | — |
| 交叉率 | — | 0.85 (SBX) |
| 变异率 | — | 0.15 (多项式, 自适应) |
| 精英比例 | — | 0.1 |
| 早停耐心 | — | 20 代 |
| 去重阈值 | Jaccard > 0.7 | — |

---

## 九、综合评级

| 维度 | 评分 | 说明 |
|------|------|------|
| 算法严谨性 | ★★★☆☆ | 多目标框架规范，但 GP 实现过于简化 |
| 知识工程深度 | ★★★★☆ | 君臣佐使、四气五味、配伍禁忌均有体现 |
| 可扩展性 | ★★☆☆☆ | 数据硬编码为主，数据库对接未完成 |
| 工程健壮性 | ★★★★☆ | 三级降级、早停、多样性维持机制完善 |
| 科学验证 | ★★☆☆☆ | 缺乏基准测试和交叉验证 |

**总体评价**：算法骨架设计合理，多目标优化方向正确，中医知识体系融入有据。当前主要短板在于**数据层**（人工标注、静态模板）和**验证层**（缺乏量化评估），建议优先完成数据库对接和评估基准建设。
