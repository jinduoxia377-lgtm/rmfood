# RMFOOD 配方生成系统 — 深度评估与专业开发方案（终稿）

> 编制日期：2026-08-14
> 基于：`docs/中国普通配方设计思路`（7步法）+ 项目代码深度审查 + 数据库现状
> 文档状态：v3.0 终稿（含实施后差距分析）

---

## 第一部分：数据库资产盘点（确认数据充足）

| 数据源 | 规模 | 内容 |
|--------|------|------|
| TCMHerb 表 | ~54味 | OB/DL/化合物/靶点/疾病 |
| MMIDHerb 表 | 完整 | 四气/五味/归经/功效原文 |
| SymMapHerb 表 | 完整 | 性味/归经/功效中英 |
| `_herb_data_01~06.py` | ~242味 | 含化合物/靶点/疾病 |
| `_BUILTIN_HERBS` | ~200味 | 功效/安全/成本/配伍 |
| **总计去重** | **300+味** | ✅ 充足 |

**结论：数据库层面数据充足，核心瓶颈是数据连接与使用方式。**

---

## 第二部分：差距深度诊断

### 2.1 现有架构健康度评估

```
┌─────────────────────────────────────────────────────────────────────┐
│                         当前架构健康度                              │
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
│  ├── PyTorchFormulaGenerator（真正的LSTM，已连接）                   │
│  ├── SignalEncoder（随机投影→可学习嵌入，已修复）                    │
│  ├── RLFormulaTuner（骨架代码→完整梯度回传，已修复）                 │
│  └── 统一引擎已接入PyTorchGenerator                                  │
│                                                                      │
│  ❌ 完全缺失（需新建）                                              │
│  ├── Step 2 调色设计引擎 → 已创建 ✅                                 │
│  ├── Step 3 调香设计引擎 → 已创建 ✅                                 │
│  ├── Step 5 品质改良设计引擎 → 已创建 ✅                              │
│  ├── 产品形态规则库 → 已创建 ✅                                       │
│  ├── 剂量计算器（MILP已接入生成流程）                                │
│  ├── 前置规则过滤器（十八反/十九畏）→ 已创建 ✅                       │
│  └── 七步统一编排引擎 → 已创建 ✅                                     │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### 2.2 核心问题修复清单

| # | 问题 | 状态 | 修复内容 |
|---|------|------|---------|
| G1 | PyTorchGenerator 是孤岛 | ✅ 已修复 | 已连接至 UnifiedFormulaEngine |
| G2 | RL 训练回路断裂 | ✅ 已修复 | 添加 loss.backward() + optimizer.step() |
| G3 | 信号编码器无学习能力 | ✅ 已修复 | 改为 Xavier 初始化嵌入矩阵 + to_torch_module()/sync_from_torch() |
| G4 | 剂量分配用随机数 | ✅ 已修复 | 接入 MILPSolver，不可行时回退比例分配 |
| G5 | Step 2/3/5 缺失 | ✅ 已修复 | 创建 color_engine/fragrance_engine/quality_engine |
| G6 | 规则未前置 | ✅ 已修复 | 创建 rule_filter.py，在生成前硬过滤禁忌组合 |
| G7 | 预测器-生成器脱节 | ✅ 已修复 | 统一引擎中预测器实时评分，RL tuner 使用奖励信号 |
| G8 | 数据连接 | ✅ 已验证 | HerbKnowledgeService 通过适配器从 DB 读取 |
| G9 | API 未接入 | ✅ 已修复 | 新增 `/generate/seven-step` 端点 |
| G10 | CompatibilityChecker NameError | ✅ 已修复 | 添加 `from typing import Any` |

---

## 第三部分：新建模块清单

### 3.1 Phase 0: 骨架修复（4个文件修改）

| 文件 | 修改内容 |
|------|---------|
| `signal_encoder.py` | 随机投影→Xavier嵌入矩阵 + to_torch_module()/sync_from_torch() |
| `pytorch_generator.py` | 添加 optimizer + herb_embed(nn.Embedding) + return_log_probs + train_step改进 |
| `rl_tuner.py` | 添加 generator 引用 + backward()/optimizer.step() 完整梯度回传 |
| `unified_formula_engine.py` | 优先使用 PyTorchGenerator + 降级到启发式 + RL tuner 传入 generator |

### 3.2 Phase 1: 数据层（无新建）

数据层已完备，无需新建。

### 3.3 Phase 2: 七步引擎（10个新建文件）

| 文件 | 行数 | 核心功能 |
|------|------|---------|
| `product_form_rules.py` | ~100 | 8种产品形态规则库（保健饮品/代茶饮/膏方/散剂/丸剂/口服液/功能性食品/压片糖果） |
| `rule_filter.py` | ~200 | 十八反/十九畏/人群禁忌/成本超限量化过滤 |
| `framework_engine.py` | ~380 | Step1：候选药材检索→规则过滤→君臣佐使分配→MILP剂量求解 |
| `color_engine.py` | ~200 | Step2：GB 2760着色剂库+CIELAB混合+工艺适配 |
| `fragrance_engine.py` | ~200 | Step3：Top/Mid/Base香气轮廓+矫味剂匹配 |
| `flavor_engine.py` | ~250 | Step4：五味增效/相乘/掩蔽/转化模型+主体香味轮廓 |
| `quality_engine.py` | ~300 | Step5：增稠/乳化/水分保持/抗氧化/质构预测 |
| `preservation_engine.py` | ~200 | Step6：技术选型+货架期修正+工艺适配检查 |
| `functional_engine.py` | ~360 | Step7：强化剂选择+保留率预测+GB 14880合规 |
| `seven_step_engine.py` | ~290 | 七步编排+综合验证（协同+兼容+安全） |

### 3.4 API 适配（1个文件修改）

| 文件 | 修改内容 |
|------|---------|
| `api/ai_modules/generation.py` | 新增 `POST /generate/seven-step` 端点 |

---

## 第四部分：关键技术决策

| 决策 | 选择 | 理由 |
|------|------|------|
| 神经网络 vs 规则引擎 | **双轨制** | NN训练+规则生产，数据达标后切换 |
| 是否替换现有优化器 | **不替换** | GA/Bayesian/NSGA-II 保留为后验优化层 |
| 数据来源 | **数据库优先** | TCMSP/MMID/SymMap 三表读取 |
| 七步优先级 | **全量实现** | 8种产品形态全覆盖 |
| 产品形态适配 | **规则驱动** | 每种形态独立配比规则库 |

---

## 第五部分：实施后剩余差距分析

### 5.1 已完成的（对比原方案）

| 原方案要求 | 实际完成 | 状态 |
|-----------|---------|------|
| SignalEncoder 可学习嵌入 | Xavier初始化 + nn.Embedding包装接口 | ✅ |
| PyTorchGenerator 连接 | 已接入 UnifiedEngine + 有optimizer | ✅ |
| RL训练回路 | backward+step完整实现 | ✅ |
| MILP剂量分配 | FrameworkEngine中已接入 | ✅ |
| 前置规则过滤 | rule_filter.py 完整实现 | ✅ |
| Step 1-7 引擎 | 全部创建 | ✅ |
| 七步编排引擎 | seven_step_engine.py | ✅ |
| API接入 | /generate/seven-step | ✅ |

### 5.2 剩余差距（需后续迭代）

| 差距 | 描述 | 优先级 | 建议方案 |
|------|------|--------|---------|
| **神经网络训练** | PyTorchGenerator 有 forward/train_step 但无训练数据管道 | P1 | 需开发 training_pipeline.py + 数据增强 |
| **药材嵌入学习** | herb_embed 使用 nn.Embedding 但仍是随机初始化 | P1 | 训练后调用 sync_from_torch 持久化 |
| **判别器真实训练** | FormulaDiscriminator 是统计模型，非GAN | P2 | 可用 WGAN-GP 替代 |
| **用户反馈闭环** | 生成结果无 A/B 测试和采纳追踪 | P2 | 需在 API 层添加反馈收集 |
| **专家评审集成** | 无专家审核流程对接 | P3 | 可在 Workflow 层扩展 |

### 5.3 数据层补充建议

```
当前数据流：
  TCMSP/MMID/SymMap DB → HerbKnowledgeService → FrameworkEngine

建议补充：
  1. 营养数据库扩展（当前仅 ~20 味有营养数据）
  2. 经典方剂库扩充（当前仅 8 个模板）
  3. 市场配方库积累（用于判别器训练）
```

---

## 第六部分：文件索引

### 新建文件（10个）

```
backend/app/services/formula/
├── product_form_rules.py          # 产品形态规则库
├── rule_filter.py                 # 前置规则过滤器
├── framework_engine.py            # Step 1 骨架设计
├── color_engine.py                # Step 2 调色设计
├── fragrance_engine.py            # Step 3 调香设计
├── flavor_engine.py               # Step 4 调味设计
├── quality_engine.py              # Step 5 品质改良
├── preservation_engine.py         # Step 6 防腐保鲜
├── functional_engine.py           # Step 7 功能性设计
└── seven_step_engine.py           # 七步编排引擎
```

### 修改文件（5个）

```
backend/app/services/ai/models/
├── signal_encoder.py              # 可学习嵌入
├── pytorch_generator.py           # 真实LSTM+optimizer+herb_embed
├── rl_tuner.py                    # 完整梯度回传
├── unified_formula_engine.py      # 连接PyTorchGenerator

backend/app/api/ai_modules/
└── generation.py                  # 新增七步API端点
```

---

## 结语

本次开发完成了**Phase 0-2 的核心骨架建设**，解决了原始方案中指出的所有关键问题：

1. **骨架修复**：4个核心文件的修复，使 AI 模型层真正运转
2. **七步引擎**：10个新文件实现完整的七步配方设计流程
3. **数据连通**：确认 300+ 味药材数据库可用
4. **API接入**：新增 `/generate/seven-step` 端点

剩余工作（神经网络训练、用户反馈闭环等）属于**Phase 3+ 的演进任务**，可在后续迭代中逐步完成。
