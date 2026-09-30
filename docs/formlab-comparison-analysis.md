# RMFOODFP × FormLab 功能对比分析与补全方案

> 报告作者：RMFOODFP 项目开发院士
> 分析基准：FormLab 88篇技术指南体系 + RMFOODFP 现有架构
> 日期：2026年
> 状态：已完成深度核查，等待实施

---

## 一、项目定位与战略判断

| 维度 | RMFOODFP | FormLab | 战略判断 |
|------|----------|---------|----------|
| **领域** | 药食同源配方 AI 平台 | 通用配方 ELN/LIMS | 互补而非竞争 |
| **核心优势** | 中医知识图谱 + 多目标优化 + 网络药理学 | 数据基础设施 + DOE + 实验管理 | RMFOODFP 胜在"智能"，FormLab 胜在"结构" |
| **缺失本质** | 没有 FormLab 验证过的"数据底座" | 没有 RMFOODFP 的中医科学推理 | 补齐底座才能发挥智能 |

**院士结论**：RMFOODFP 当前是一个"AI 算法很丰富但数据链路不完整"的平台。形似 FormLab 的外壳，但内核缺少数据实体链。补全后将成为**全球首个"AI原生+数据完整+法规深厚"的药食同源配方平台**。

---

## 二、功能矩阵完整对标（含本次新增核查项）

### 2.1 已有能力评分

| 能力域 | FormLab | RMFOODFP | 评分 | 备注 |
|--------|---------|----------|------|------|
| **配方版本控制** | 完整 diff/时间线 | FormulaVersion + VersionDiffViewer | ⭐⭐⭐⭐⭐ | 算法更丰富 |
| **原料结构化库** | CAS/密度/供应商/价格 | 药材+TCMSP+OpenFood | ⭐⭐⭐⭐ | 缺动态字段 |
| **合规引擎** | IFRA法规 | 药食同源目录+十八反十九畏+GB16740 | ⭐⭐⭐⭐⭐ | 中医特色更强 |
| **AI助手** | 内置+MCP 40工具 | AIAssistant+RAG | ⭐⭐⭐⭐ | **缺MCP协议** |
| **多目标优化** | Designer逆设计 | NSGA3/MOEAD/贝叶斯/MCTS | ⭐⭐⭐⭐⭐ | 算法远超FormLab |
| **配方对比** | 成分+过程双向diff | FormulaCompare (仅成分) | ⭐⭐⭐ | **缺过程对比** |
| **成本计算** | 原料价格联动公式 | cost_calculator (硬编码) | ⭐⭐⭐ | **缺实时滚动+供应商价更新** |
| **批记录** | 完整 Batch→Sample→Test 链 | **无模型** | ⭐ | **最严重缺口** |
| **实验管理** | DOE矩阵+响应面+趋势 | ExperimentPage (数据录入+AnIML解析) | ⭐⭐⭐ | 有数据采集缺DOE |
| **稳定性研究** | 方案设计+趋势+失效预测 | MockStabilityModel (模拟) | ⭐ | **需完全重实现** |
| **报告生成** | AI+确定性分离，4tone | ExplainabilityReport (基础) | ⭐⭐ | **缺4tone+事实/AI分离** |
| **追溯系统** | 批号→批次→成品双向 | **无模型** | ⭐ | **缺Lot/Batch/Sample实体** |
| **标签打印** | Code128/QR标签 | **无** | ⭐ | 完全缺失 |
| **文档提取** | AI读取CoA/PDS/SDS结构化 | PDF附件上传 | ⭐⭐ | 缺AI结构化提取 |
| **自定义字段** | 原料动态字段+理论参数 | 固定schema | ⭐⭐ | 缺动态字段引擎 |
| **逆向搜索** | Find by Results (按结果搜配方) | 仅正向搜索 | ⭐ | **完全缺失** |
| **项目级看板** | 阶段/时间线/财务/门评审 | 仅Analytics (无项目实体) | ⭐⭐ | **缺Project实体+时间线** |
| **实时协作** | WebSocket | WebRTC + WebSocket | ⭐⭐⭐⭐ | 已有但需完善 |
| **多租户** | Organization级隔离 | RBAC+MultiTenantService | ⭐⭐⭐⭐⭐ | 架构一致 |
| **同步服务** | 云同步 | ChangeQueue+ConflictResolver | ⭐⭐⭐⭐ | 架构完整 |

---

## 三、深度核查发现的遗漏项

### 🔴 T9 — MCP 协议缺失（对外AI接口）

**现状**：搜索全库未发现任何 MCP 相关代码。FormLab 提供 40 个只读 MCP 工具，允许外部 AI（Claude Desktop/VS Code）安全查询数据。

**影响**：RMFOODFP 无法接入外部 AI 生态，丧失了"AI 工具链扩展"的机会。

**补全方案**：
```
新建模块：mcp_server/
├── mcp_tool_registry.py      # MCP 工具注册表（目标 20+ 工具）
├── formula_tools.py           # list_formulas, get_formula, get_ingredients
├── herb_tools.py              # search_herbs, get_herb_details
├── compliance_tools.py        # check_compliance, get_dosage_limits
├── experiment_tools.py        # list_experiments, get_experiment_data
└── main.py                   # MCP 服务器入口（stdio/SSE 双模式）
```

### 🔴 T10 — 批记录数据实体链完全缺失（最严重）

**现状**：模型层仅有 `Formula`、`Experiment`、`ExperimentData`，**没有** `Batch`、`Sample`、`TestReport`、`IngredientLot` 实体。实验数据是扁平 JSON，没有形成"原料→配方→批次→样品→测试→稳定性"的链式关联。

**影响**：无法追溯"哪个批用了哪批原料"、"哪个样品对应哪份报告"，合规审计不可行。

**补全方案**：
```
新建模型：
├── batch_record.py         # Batch(id, formula_id, lot_refs[], weight, status)
├── sample.py               # Sample(id, batch_id, code, storage_condition)
├── test_report.py          # TestReport(id, sample_id, parameter, value, unit, spec_min, spec_max, result)
├── ingredient_lot.py       # IngredientLot(id, ingredient_id, supplier_lot, qty, expiry, received_at)

新建服务：
├── batch_service.py        # 从配方生成批记录（按比例放大）
├── sample_tracking.py      # 样品分配与追踪
├── test_result_service.py  # 测试结果录入与 Spec 判定
└── traceability_engine.py  # 双向追溯查询
```

### 🟡 T11 — 稳定性研究仅为 Mock

**现状**：`MockStabilityModelService` 使用线性退化公式模拟 12 个月预测，无真实 protocol、无 Arrhenius 模型、无失效模式分析。

**补全方案**：
```
替换 mock 为真实实现：
├── stability_protocol.py      # 方案设计（条件×时间点×测试参数）
├── arrhenius_model.py         # Arrhenius 加速模型（k = A·e^(-Ea/RT)）
├── trend_analyzer.py          # 时间序列趋势分析（线性回归+突变检测）
├── shelf_life_estimator.py    # 有效期估算（外推至 spec 边界）
└── frontend: StabilityStudyPage.tsx
```

### 🟡 T12 — DOE 实验设计矩阵缺失

**现状**：有 NSGA3/MOEAD 优化器，但**没有**实验设计生成器（CCD/BBD/拉丁超立方/Plackett-Burman）。无法"设计实验→收集数据→拟合模型→优化"的闭环。

**补全方案**：
```
扩展 algorithm/ 模块：
├── doe_generator.py          # 实验设计矩阵生成（全因子/响应面/混料）
├── response_surface.py       # 响应面拟合（多项式回归）
├── correlation_heatmap.py    # 相关系数矩阵计算
└── active_learning.py        # 主动学习——推荐下一个最优实验点
```

### 🟡 T13 — 配方对比仅限成分，缺过程对比

**现状**：`FormulaComparePage` 和 `FormulaCompare.tsx` 组件只对比成分列表，FormLab 的核心差异是**成分+过程双向 diff**。

**补全方案**：
```
扩展 formula_comparison.py：
├── composition_diff.py       # 成分差异计算（已部分实现）
├── procedure_diff.py         # 步骤/温度/RPM/时间差异（新增）
└── frontend: 增强 FormulaCompare 组件显示过程差异
```

### 🟡 T14 — 成本计算硬编码且无实时联动

**现状**：`cost_calculator.py` 中价格是硬编码的 dict，`FormulaCostAnalysis.tsx` 中也是硬编码的前端常量。FormLab 的价格存储在原料上，一个供应商调价自动重新计算所有配方。

**补全方案**：
```
├── 原料模型添加 price_per_unit, supplier_id, last_price_update 字段
├── cost_calculator.py 改为从数据库读取实时价格
└── 新增 PriceChangeImpactService：供应商调价后计算影响范围
```

### 🟡 T15 — 无项目级时间线与阶段管理

**现状**：无 Project 实体，公式直接挂在 Organization 下。FormLab 的项目看板有阶段（Phase）、时间线、里程碑、财务面板。

**补全方案**：
```
新建模型：
├── project.py               # Project(id, name, phase, owner, start_date, target_launch)

新建前端页面：
└── ProjectTimelinePage.tsx  # 公式×批次×样品的日期轴时间线
```

### 🟢 T16 — 现有但未充分利用的能力

| 能力 | 现状 | 建议强化 |
|------|------|----------|
| AnIML/JCAMP 数据解析 | `experiment_data_router.py` 已实现 | 增强：增加更多仪器格式支持 |
| 协同系数版本管理 | `coefficient_version_manager.py` 已实现 | 强化：增加 UI 追溯界面 |
| 异常检测引擎 | `anomaly_detector.py` 已有 3σ+CUSUM | 强化：与稳定性研究联动 |
| 定时报表调度 | `scheduled_reports.py` 已有 cron 调度 | 强化：增加稳定性报告自动发送 |
| 业务洞察 Tab | `BusinessInsightsTab` 已有生命周期漏斗 | 强化：增加 DOE 结果汇总视图 |
| 文档模板系统 | `document_templates.py` 有 DOCX/PDF 导出 | 强化：增加确定性/AI 分离架构 |

---

## 四、补全路线图（最终版 5 阶段）

### Phase 1：数据底座加固（6周）⭐⭐⭐⭐⭐

| 周次 | 交付物 | FormLab 对标 |
|------|--------|-------------|
| W1-W2 | `Batch`/`Sample`/`TestReport`/`IngredientLot` 模型 + 服务 | Batch→Sample→Test 链路 |
| W3 | `BatchRecordService`：配方→可称重批记录 | Bench formula to batch record |
| W4 | `TraceabilityEngine`：双向追溯（批号→批次→成品） | Lot & raw-material traceability |
| W5 | 原料价格字段 + `PriceChangeImpactService` | Raw material cost management |
| W6 | `CustomFieldService` + `TheoreticalParameterService` | Custom fields & calculated parameters |

### Phase 2：报告与 AI 分离（3周）⭐⭐⭐⭐

| 周次 | 交付物 | FormLab 对标 |
|------|--------|-------------|
| W7 | `FactEngine`：成本/合规/异常的确定性计算 | AI reports deterministic layer |
| W8 | `AIReportWriter`：4 tone（技术/管理/客户/监管） | AI report tones |
| W9 | `ExplainabilityReport` 重构 + PDF 溯源标注 | "数据来自系统，AI 生成叙述" |

### Phase 3：DOE 与逆向搜索（4周）⭐⭐⭐⭐

| 周次 | 交付物 | FormLab 对标 |
|------|--------|-------------|
| W10-W11 | `DOEGenrator`：CCD/BBD/混料设计 | DOE workbench |
| W12 | `ResponseSurface` + 3D 可视化 | Response surface visualization |
| W13 | `ReverseSearchService`：按结果搜配方 | Find by results |
| W14 | `ActiveLearning`：推荐下一个实验点 | Suggest next experiments |

### Phase 4：稳定性与追溯增强（4周）⭐⭐⭐

| 周次 | 交付物 | FormLab 对标 |
|------|--------|-------------|
| W15-W16 | 替换 MockStabilityModel 为真实 Arrhenius 模型 | Stability studies |
| W17 | `StabilityProtocolBuilder` + 时间线追踪 UI | Protocol planning |
| W18 | `TrendAnalyzer` + 失效模式分析 | Trend reading & failure mode |

### Phase 5：外围能力补齐（3周）⭐⭐⭐

| 周次 | 交付物 | FormLab 对标 |
|------|--------|-------------|
| W19 | `MCPServer`：20+ 只读工具 | MCP integration |
| W20 | `LabelGenerator`：Code128/QR 标签 | Barcode & QR labels |
| W21 | `DocumentExtractor`：CoA/PDS/SDS AI 解析 | Extract data from supplier documents |

---

## 五、架构原则建议（从 FormLab 借鉴）

### 5.1 确定性/解释性分离（最重要的哲学）

```
【铁律】任何 AI 生成的报告中，数字必须来自确定性计算，AI 只写文字叙述
【实现】FactEngine → AIReportWriter 的单向数据流
【标注】每份报告底部："本报告中所有数值来自系统记录，AI 仅负责叙述部分"
```

### 5.2 数据链路完整性

```
原料批号 → 配方版本 → 批记录 → 样品 → 测试结果 → 稳定性追踪
    ↑___________________________________________↓
              双向追溯（recall-readiness）
```

### 5.3 分析三步法（FormLab 核心方法论）

```
1. 比较输入 → 两个配方/批次有什么不同？
2. 比较输出 → 测试结果有什么差异？
3. 建立因果 → DOE 设计实验，确认哪个变量驱动了结果
```

---

## 六、最终评分总结

| 维度 | 当前 | 补全后 | FormLab 对标 |
|------|------|--------|-------------|
| 数据完整性 | ⭐⭐ | ⭐⭐⭐⭐⭐ | ✅ 持平 |
| AI 算法深度 | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ✅ 超越 |
| 法规覆盖深度 | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ✅ 超越（中医特色） |
| 实验设计能力 | ⭐⭐ | ⭐⭐⭐⭐ | ✅ 持平 |
| 报告与追溯 | ⭐⭐ | ⭐⭐⭐⭐⭐ | ✅ 持平 |
| 整体产品化 | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ✅ 持平+差异化 |
