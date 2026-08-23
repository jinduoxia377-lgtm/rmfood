# RMFOOD 配方生成系统 — 深度评估与进阶开发方案

> 编制日期：2026-08-14
> 性质：对上一版方案的**深度审视与纠偏**
> 关键发现：上一版方案低估了"骨架代码"问题，高估了可实现性

---

## 第一部分：上一版方案的深度缺陷

### 1.1 致命盲区：现有 AI 模型层是"空壳"

通过逐文件审查，发现以下关键发现：

| 文件 | 行数 | 实际实现 | 规划文档中描述 | 差距 |
|------|------|---------|-------------|------|
| `pytorch_generator.py` | 257 | **真正实现了PyTorch LSTM**，含forward/train_step/save/load | 自回归生成器 | **未被任何地方调用！** |
| `autoregressive_generator.py` | 335 | 启发式采样（非神经网络），随机权重 | 自回归LSTM | 实际被统一引擎调用 |
| `formula_predictor.py` | 331 | **纯规则引擎**（几何平均、MSE、经验公式），无神经网络 | BiLSTM+Attention预测器 | 文档说用NN，实际是规则 |
| `formula_discriminator.py` | 218 | **统计模型**（频率+熵），非神经网络 | GAN判别器 | 文档说GAN，实际是统计 |
| `rl_tuner.py` | 224 | **骨架代码**：loss=-advantage*lr，无backward/optim.step | REINFORCE+baseline | 完全无法训练 |

**核心问题**：`pytorch_generator.py` 是唯一真正实现了 PyTorch 网络的模块，但它是**孤岛代码**，没有被 `unified_formula_engine.py` 调用。引擎实际使用的是 `autoregressive_generator.py` 的启发式版本。

```
当前调用链（实际）：
FormulaDesigner → UnifiedFormulaEngine
                     └→ AutoregressiveGenerator（启发式采样）← 不是真正的LSTM
                        └→ FormulaPredictor（纯规则引擎）← 不是BiLSTM
                           └→ FormulaDiscriminator（统计模型）← 不是GAN
                              └→ RLFormulaTuner（无梯度，无效）

未被调用的真实代码（孤岛）：
pytorch_generator.py → PyTorchFormulaGenerator（真正的LSTM网络）
  → train_step() 方法完整实现
  → save/load 方法完整实现
  → 但从未被任何地方实例化
```

### 1.2 上一版方案的问题

| 问题 | 描述 | 严重程度 |
|------|------|---------|
| **未区分"骨架"与"实现"** | 方案把 `autoregressive_generator.py`（启发式）当作了真正的自回归生成器来设计 | 🔴 致命 |
| **未检查RL训练回路** | 方案假设RL调优器可用，但 `train_step()` 仅有 `loss = -advantage * lr`，无梯度回传 | 🔴 致命 |
| **未检查预测器架构** | 方案假设预测器是BiLSTM，实际是纯规则引擎 | 🟠 重大 |
| **数据量严重低估** | 方案提到"200+味药材"，但实际仅有 ~200个样本（8经典方剂+硬编码），远不足以训练神经网络 | 🔴 致命 |
| **七步中Step 2/3/5为零** | 方案虽然列出了这些步骤，但未考虑如何与现有7维评估引擎整合 | 🟡 中等 |
| **未评估"是否真的需要神经网络"** | 在数据量如此小的情况下（~200样本），神经网络是否比规则引擎更好？方案未讨论 | 🟠 重大 |

---

## 第二部分：更深层的系统问题分析

### 2.1 数据层 — 最严重的瓶颈

```
当前状态：
  · _BUILTIN_HERBS: ~200味药材（硬编码）
  · 经典方剂样本: 8个（四君子汤、六味地黄丸等）
  · 功效-药材映射: 100+条（来自硬编码）
  · 营养数据库: 仅20味有营养数据
  · 市场配方库: 约100个DB记录（用于判别器训练）
  · 训练集大小: ~200个样本（8经典方剂 × 每次增广32倍 ≈ 256）

神经网络训练需求：
  · PyTorchFormulaGenerator: 3层LSTM + 4个头 = ~100K参数
  · 最小训练样本: 10,000+（专家共识）
  · 当前样本: ~256
  · 数据缺口: 40倍+

结论：在数据不足40倍的情况下，强行训练神经网络只会过拟合，
      规则引擎在当前阶段是更合理的选择。
```

### 2.2 信号编码器 — 无学习能力的投影

```python
# 当前实现：随机投影矩阵（硬编码seed=42）
self._EFFECT_PROJ = [
    [random.uniform(-0.1, 0.1) for _ in range(self.EFFECT_DIM)]
    for _ in range(n_effects)
]
# ↑ 这意味着所有功效嵌入都是随机噪声，没有任何语义结构
```

**问题**：SignalEncoder 使用的是固定随机投影而非可学习嵌入。即使未来有足够数据训练 LSTM，输入信号本身也是无意义的。

### 2.3 剂量分配 — 无科学性

```python
# autoregressive_generator.py: _assign_dosages()
# 君药随机分配 30-40%
ratio = 0.30 + random.uniform(-0.05, 0.10)
# 臣药随机分配 20-25%
ratio = 0.20 + random.uniform(-0.05, 0.05)
# 佐使随机分配剩余
```

**问题**：用量分配基于随机数而非产品形态规则或 MILP 求解。MILPSolver 已实现且可用，但从未在生成流程中调用。

### 2.4 预测-生成脱节

```
当前流程：
  生成器 → 输出配方 → 预测器评分（后验）→ 排序选择

问题：
  · 预测器不参与生成过程
  · 生成器不知道自己在生成什么质量的配方
  · 无法实现"边生成边评估"的前馈引导

理想流程：
  生成器 → 预测器实时评分 → 调整生成策略 → 下一代生成
  （即：预测器作为生成器的奖励函数）
```

### 2.5 五步缺失分析（上一版方案遗漏的深度问题）

#### 缺失 A：无"配方生成历史记忆"
- 系统不记录哪些配方曾生成过、用户是否采纳
- 无法实现"相似问题复用策略"的真正价值
- Bandit学习器只记录策略统计，不记录配方结果

#### 缺失 B：无"专家规则注入层"
- TCM 配伍知识（十八反、十九畏、君臣佐使）目前仅在 Fitness 评估中作为惩罚项
- 没有独立的"规则引擎层"在生成前就排除非法组合
- 应在生成前就做硬约束过滤，而非后验评分

#### 缺失 C：无"产品工艺适配层"
- 同一配方（如黄芪30g+党参15g）在饮品、散剂、膏方中的适用性不同
- 当前系统不考虑加工工艺对配方参数的影响

#### 缺失 D：无"成本-功效 Pareto 可视化"
- 优化器输出只是 Top-K 配方列表
- 用户无法看到"如果我降低10%成本，功效会损失多少"
- 缺少交互式 Pareto 前沿探索

#### 缺失 E：无"失败配方学习"
- 被拒绝/审核不通过的配方没有被利用
- 审核反馈没有形成训练数据
- 系统与人工审核流程完全脱节

---

## 第三部分：升级方案（深度版）

### 3.1 核心设计理念

```
第一阶段（立即修复）：让现有骨架代码真正运转起来
  · 修复 RL 训练回路
  · 连接 PyTorchGenerator 到统一引擎
  · 修复信号编码器的可学习性
  · 修复剂量分配的科学性

第二阶段（中期建设）：七步专业设计引擎
  · 建立数据管道
  · 实现各步专业引擎
  · 建立反馈闭环

第三阶段（长期演进）：自进化系统
  · 从用户反馈中学习
  · 从专家审核中学习
  · 从市场数据中学习
```

### 3.2 第一阶段：骨架修复（2周）

#### 任务 1.1：修复 RL 训练回路

**问题**：`rl_tuner.py` 的 `train_step()` 没有梯度回传

**修复方案**：

```python
# rl_tuner.py — 修复后的核心
def train_step(self, formula, predictor_result, discriminator_result, ...):
    # 计算奖励
    rewards = self.compute_reward(...)

    # 关键修复：将奖励转换为可微分的张量
    reward_tensor = torch.tensor(rewards["total"], device=self.device)

    # 梯度回传到生成器的输出分布
    # 这需要在生成器端配合修改
    self.generator.optimizer.zero_grad()
    loss = -reward_tensor * self.lr
    loss.backward()
    self.generator.optimizer.step()
```

需要同时修改 `pytorch_generator.py`：
- 使 `forward()` 返回 log_prob 而非仅输出
- 添加 `optimizer` 属性
- 使 `train_step()` 能接收奖励信号

#### 任务 1.2：连接 PyTorchGenerator 到统一引擎

**问题**：`unified_formula_engine.py` 使用的是启发式生成器，不是真正的 PyTorch LSTM

**修复方案**：

```python
# unified_formula_engine.py — 修改组件初始化
def _ensure_initialized(self):
    # 优先级：PyTorch Generator > 启发式 Generator
    try:
        from .pytorch_generator import get_pytorch_generator
        self._generator = get_pytorch_generator(
            n_herbs=len(self.herb_vocab),
            input_dim=self._signal_encoder.output_dim,
        )
        # 尝试加载预训练权重
        checkpoint = os.path.join(self._model_dir, "generator.pt")
        if os.path.exists(checkpoint):
            self._generator.load(checkpoint)
    except ImportError:
        # 降级到启发式生成器
        from .autoregressive_generator import get_autoregressive_generator
        self._generator = get_autoregressive_generator(herb_vocab=self.herb_vocab)
```

#### 任务 1.3：修复信号编码器的可学习性

**问题**：SignalEncoder 使用固定随机投影

**修复方案**：

```python
# signal_encoder.py — 改为可学习嵌入
class SignalEncoder(nn.Module):
    def __init__(self, n_effects=20, effect_dim=16, category_dim=8, group_dim=8):
        super().__init__()
        self.effect_embed = nn.Embedding(n_effects, effect_dim)
        self.category_embed = nn.Embedding(10, category_dim)
        self.group_embed = nn.Embedding(5, group_dim)

    def encode(self, target_effects, ...):
        # 使用可学习嵌入替代随机投影
        effect_vec = self.effect_embed(effect_indices).mean(dim=1)
        # ...
```

#### 任务 1.4：修复剂量分配 — 接入 MILPSolver

**问题**：`_assign_dosages()` 使用随机分配

**修复方案**：

```python
# unified_formula_engine.py 或 framework_engine.py
def _assign_dosages_precise(self, herbs, product_form, total_dosage):
    """使用 MILPSolver 精确求解剂量"""
    from .lp_solver import MILPSolver, HerbNutritionData

    # 构建 MILP 求解器
    herb_data = {h: HerbNutritionData(...) for h in herbs}
    solver = MILPSolver(herb_data)

    # 求解精确配比
    result = solver.solve(
        selected_herbs=herbs,
        total_dosage=total_dosage,
        additional_constraints={"max_cost": max_cost},
    )

    return result.ratios if result.feasible else self._fallback_assign(herbs)
```

### 3.3 第二阶段：数据层建设（2周）

#### 任务 2.1：建立数据增强管道

```
数据来源：
1. 内置经典方剂（8个）→ 剂量扰动增强 → 200+ 样本
2. TCMSP API → 口服吸收率OB≥30% 的药材 → 功效映射
3. DFBP 数据库 → 药效学数据
4. 用户生成的历史配方（DB中的Formulas表）→ 真实配方数据

增强策略：
- 剂量扰动：±20% 高斯噪声
- 功效重采样：随机选取子功效列表
- 模板变异：经典方剂随机替换臣佐药
```

#### 任务 2.2：扩展药材库

```
当前：~200味（硬编码）
目标：500+味
来源：
1. 《中华人民共和国药典》2020年版 → 收录药材1200+
2. 《中国药食同源目录》 → 106种
3. TCMSP 数据库 → 4200+ 中药
4. DFBP → 400+ 食物成分

优先扩展：
- 补气类：增加太子参、红参、西洋参
- 补血类：增加阿胶、龙眼肉
- 清热类：增加板蓝根、蒲公英、夏枯草
- 祛湿类：增加泽泻、车前子
- 理气类：增加枳壳、砂仁
```

### 3.4 第三阶段：七步专业引擎（4周）

#### 各步骤的深度设计

**Step 1: 主体骨架设计**
```
新增模块：framework_engine.py
功能：
  1. 产品形态决策器：根据用户选择确定产品类型（饮品/膏方/散剂等）
  2. 剂量规划器：基于产品形态规则 + MILPSolver 精确求解
  3. 君臣佐使分配器：按功效权重 + 安全性 + 成本综合排序

集成点：
  · 调用 MILPSolver 替换当前随机剂量分配
  · 调用 ProductFormRule 确定各角色比例范围
  · 输出：带精确剂量的结构化配方
```

**Step 2: 调色设计**（新增）
```
新增模块：color_engine.py
功能：
  1. 着色剂合规选择器：GB 2760 数据库 + 适用食品类别
  2. CIELAB 色彩混合计算器
  3. 工艺适配检测：pH/温度稳定性
  4. 民族/地区习惯适配
```

**Step 3: 调香设计**（新增）
```
新增模块：fragrance_engine.py
功能：
  1. 香气轮廓建模：Top/Mid/Base note 三层
  2. 挥发动力学模拟
  3. 矫味剂匹配器
  4. 香气-风味协调检查
```

**Step 4: 调味设计**（增强）
```
现有：TastePredictor（五味MSE模型）
增强：
  1. 味的增效模型（相乘效应数学表达）
  2. 味的掩蔽模型（苦味掩盖效率计算）
  3. 主体香味轮廓确定算法
  4. 香辛料组合平衡计算器
```

**Step 5: 品质改良设计**（新增）
```
新增模块：quality_engine.py
功能：
  1. 增稠剂选择器：亲水胶体数据库 + 粘度模型
  2. 乳化剂选择器：HLB值计算 + 乳液稳定性
  3. 水分保持设计：磷酸盐/乳酸盐选型
  4. 抗氧化设计：抗氧化剂复配 + 氧化动力学
  5. 质构模拟：流变学简化模型
```

**Step 6: 防腐保鲜设计**（增强）
```
现有：StabilityPredictor（货架期预测）
增强：
  1. 防腐技术选型推荐器：低温/干制/防腐剂/罐藏
  2. 工艺适配检查：加工方式对保质期的影响
  3. 风险预警升级：动态阈值 + 分级建议
```

**Step 7: 功能性设计**（新增）
```
新增模块：functional_engine.py
功能：
  1. 强化剂选择器：针对目标人群的营养缺乏
  2. 保留率预测器：加工过程中的营养损失
  3. 营养均衡评估器
  4. GB 14880 合规检查
```

### 3.5 第四阶段：统一编排与闭环（2周）

#### 统一编排引擎

```python
class SevenStepFormulaEngine:
    """七步配方设计引擎"""

    def __init__(self):
        # Step 1-7 引擎
        self.framework_engine = FrameworkEngine()
        self.color_engine = ColorEngine()
        self.fragrance_engine = FragranceEngine()
        self.flavor_engine = FlavorEngine()
        self.quality_engine = QualityEngine()
        self.preservation_engine = PreservationEngine()
        self.functional_engine = FunctionalEngine()

        # 验证层（继承现有）
        self.synergy_engine = SynergyEngine()
        self.compatibility_checker = CompatibilityChecker()
        self.safety_system = SafetyAlertSystem()

    async def design(self, request: FormulaRequest) -> FormulaOutput:
        # Step 1: 主体骨架
        framework = await self.framework_engine.design(request)

        # Step 2-7: 依次执行，每步可传入上一步输出
        color = await self.color_engine.design(framework)
        fragrance = await self.fragrance_engine.design(framework, color)
        flavor = await self.flavor_engine.design(framework, fragrance)
        quality = await self.quality_engine.design(framework)
        preservation = await self.preservation_engine.design(framework, quality)
        functional = await self.functional_engine.design(framework, request)

        # 综合验证
        validation = await self._validate_all(
            framework, color, fragrance, flavor, quality, preservation, functional
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

#### 反馈闭环设计

```
用户交互流程：
  用户查看生成配方 → 采纳/修改/拒绝
       ↓                    ↓
  反馈存入DB           反馈存入DB
       ↓                    ↓
  用于：               用于：
  1. 更新判别器训练数据  1. 发现安全漏洞
  2. 统计用户偏好       2. 优化规则权重
  3. A/B测试          3. 改进生成策略
```

---

## 第四部分：实施路线图（修正版）

### Phase 0: 骨架修复（1周）⭐ 最高优先级

| 任务 | 文件 | 验收标准 |
|------|------|---------|
| 0.1 连接 PyTorchGenerator | `unified_formula_engine.py` | 引擎使用真正LSTM而非启发式 |
| 0.2 修复RL训练回路 | `rl_tuner.py` + `pytorch_generator.py` | loss.backward() + optimizer.step() 可执行 |
| 0.3 修复信号编码器 | `signal_encoder.py` | 使用 nn.Embedding 替代随机投影 |
| 0.4 修复剂量分配 | `unified_formula_engine.py` | 调用 MILPSolver 替代随机分配 |

### Phase 1: 数据层建设（2周）

| 任务 | 产出 | 验收标准 |
|------|------|---------|
| 1.1 药材库扩展至 500+ | `_BUILTIN_HERBS` + `herb_database_extender.py` | 覆盖10大功效类别 |
| 1.2 数据增强管道 | `data_loader.py` 增强模块 | 生成 ≥5000 训练样本 |
| 1.3 训练脚本 | `scripts/train_generator.py` | 可在CPU上跑通100轮 |
| 1.4 预训练权重 | `models/generator.pt` | 保存/加载正常 |

### Phase 2: 七步引擎开发（4周）

| 任务 | 产出 | 验收标准 |
|------|------|---------|
| 2.1 Step1 骨架设计引擎 | `framework_engine.py` | MILP精确求解 |
| 2.2 Step2 调色引擎 | `color_engine.py` | GB合规率100% |
| 2.3 Step3 调香引擎 | `fragrance_engine.py` | 香气轮廓合理 |
| 2.4 Step4 调味增强 | `flavor_engine.py` | 五味模型完整 |
| 2.5 Step5 品质改良 | `quality_engine.py` | 7类设计可执行 |
| 2.6 Step6 保鲜增强 | `preservation_engine.py` | 技术选型推荐 |
| 2.7 Step7 功能性 | `functional_engine.py` | 强化剂选择+合规 |
| 2.8 七步编排引擎 | `seven_step_engine.py` | 端到端跑通 |

### Phase 3: 集成与验证（2周）

| 任务 | 验收标准 |
|------|---------|
| 3.1 API层适配 | 新旧接口兼容，向后兼容 |
| 3.2 端到端测试 | 七步流水线完整测试 |
| 3.3 专家评审 | 3位食品专家盲评10组配方 |
| 3.4 对比实验 | 与现有系统产出对比评分 |

### Phase 4: 反馈闭环（1周）

| 任务 | 验收标准 |
|------|---------|
| 4.1 用户反馈收集 | 采纳/修改/拒绝三种反馈类型 |
| 4.2 判别器增量更新 | 新配方自动加入训练库 |
| 4.3 规则权重自适应 | 基于反馈调整评估权重 |
| 4.4 文档更新 | 技术文档 + API文档 |

**总工期：8周**（比原方案10周缩短，因为Phase 0修复了根本问题）

---

## 第五部分：关键技术决策

### Q1：数据不足时是否应该训练神经网络？

**结论：先训练，后应用**

- 当前 ~200 样本不足以直接生产级使用
- 但训练本身是必要的：建立数据管道、验证架构、积累训练经验
- 同时保留规则引擎作为 fallback，在神经网络达到质量阈值前使用
- **策略**：双轨制 — 神经网络训练 + 规则引擎生产

### Q2：七步引擎是否需要全部实现？

**结论：分优先级，分阶段交付**

| 优先级 | 步骤 | 理由 |
|--------|------|------|
| P0 | Step 1（骨架） | 核心缺失，直接影响配方可用性 |
| P0 | Step 7（功能性） | 已有基础，只需增强 |
| P1 | Step 4（调味） | 已有MSE模型，需增强 |
| P1 | Step 6（保鲜） | 已有预测器，需增强 |
| P2 | Step 2（调色） | 食品工业重要但非核心 |
| P2 | Step 3（调香） | 需要大量领域知识 |
| P3 | Step 5（品质改良） | 复杂度高，可后续迭代 |

### Q3：是否应该完全替换现有优化器？

**结论：保留 + 增强，不替换**

- GA/Bayesian/NSGA-II 是成熟的全局搜索算法
- 神经网络生成器应作为补充而非替代
- 架构：神经网络生成初始候选 → GA/Bayesian 精细优化
- 这样既能利用AI的创造性，又能保证数学上的最优性

---

## 附录：文件变更清单

### 需修复的文件（Phase 0）

```
backend/app/services/ai/models/
├── pytorch_generator.py        # 连接至统一引擎
├── rl_tuner.py                 # 修复训练回路
├── signal_encoder.py           # 改为可学习嵌入
├── unified_formula_engine.py   # 接入PyTorchGen + MILPSolver
└── autoregressive_generator.py # 保留为fallback
```

### 需新增的文件（Phase 1-3）

```
backend/app/services/formula/
├── framework_engine.py         # Step 1: 主体骨架
├── product_form_rules.py       # 产品形态规则库
├── color_engine.py             # Step 2: 调色设计
├── color_database.py           # 着色剂数据库
├── fragrance_engine.py         # Step 3: 调香设计
├── aroma_database.py           # 香气成分数据库
├── flavor_engine.py            # Step 4: 调味增强
├── quality_engine.py           # Step 5: 品质改良
├── preservation_engine.py      # Step 6: 防腐保鲜增强
├── functional_engine.py        # Step 7: 功能性设计
└── seven_step_engine.py        # 七步编排引擎

backend/app/services/ai/models/
├── training_pipeline.py        # 训练管道（新增）
└── herb_embedding.py           # 药材嵌入（新增）
```
