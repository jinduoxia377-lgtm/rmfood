# Phase 4 + 5 实施报告

> 执行日期：2026-09-26
> 后端端口：8000（用户指定，不可更改）

---

## 一、Phase 4：Arrhenius 稳定性预测模型

### 核心变更

| 文件 | 操作 | 说明 |
|------|------|------|
| `app/services/ai_models/stability_model.py` | 重写 | Mock → Arrhenius 真实模型 |
| `app/api/v1/stability_router.py` | 新建 | 4 个 API 端点 |
| `app/core/security/security_middleware.py` | 修改 | `/stability` CSRF 豁免 |
| `app/api/v1/__init__.py` | 修改 | 注册 stability_router |

### 科学模型

```
k(T) = k_25 · exp[Ea/R · (1/298.15 - 1/(T+273.15))]

Q10 = (k₂/k₁)^(10/(T₂-T₁))

货架期：首次 remaining_pct < 0.90 的月份（线性插值）
```

### 数据库

29 种药食同源成分，覆盖 6 大类别：

| 类别 | 数量 | 代表成分 | k_25 范围 |
|------|:----:|----------|:---------:|
| 多糖类 | 5 | 黄芪多糖、枸杞多糖 | 0.002-0.005 |
| 皂苷类 | 3 | 人参皂苷、黄芪甲苷 | 0.007-0.010 |
| 黄酮类 | 4 | 大豆异黄酮、槲皮素 | 0.006-0.010 |
| 肽类 | 4 | 大豆肽、胶原蛋白肽 | 0.003-0.006 |
| 维生素 | 3 | 维生素C、维生素E | 0.006-0.015 |
| 基础食材 | 5 | 茯苓、山药、莲子 | 0.001-0.002 |

### API 端点

```
GET  /api/v1/stability/health     → 健康检查 + 模型信息
POST /api/v1/stability/predict    → Arrhenius 稳定性预测
POST /api/v1/stability/q10        → Q10 温度系数
GET  /api/v1/stability/ingredients → 成分数据库查询
```

### 验证结果

**四神汤（茯苓+山药+莲子+薏苡仁），25°C，棕色瓶：**
- 稳定性评分：0.80（优秀）
- 货架期：28.8 月
- 风险因素：0 项

**敏感配方（人参皂苷+姜黄素+VC+大豆肽），25°C，明亮光，普通包装：**
- 稳定性评分：0.13（较差）
- 货架期：4.5 月（90%阈值），10.7 月（80%阈值）
- Q10 = 2.46（中等温度敏感性）

---

## 二、Phase 5：外围能力补齐

### 5.1 MCP 服务器

**新建文件：**
```
app/services/mcp_server/__init__.py     — 工具注册表（21 个工具）
app/services/mcp_server/handlers.py     — 工具调用处理器
app/api/v1/mcp_router.py              — FastAPI 路由
```

**21 个 MCP 工具覆盖 6 大领域：**

| 领域 | 工具 |
|------|------|
| 配方查询 | list_formulas, get_formula, search_formulas |
| 药材查询 | search_herbs, get_ingredient, list_ingredients |
| 合规检查 | check_compliance, check_contraindications |
| 成本计算 | calculate_cost |
| 稳定性 | get_stability_prediction |
| 批次追溯 | get_batch, trace_batch_ingredients, trace_ingredient_forward |
| 样品测试 | list_samples, get_sample_result |
| 实验设计 | list_doe_runs, get_doe_model |
| 组织管理 | list_organizations, get_organization |
| 知识图谱 | search_knowledge_graph, get_erb_property |

**API 端点：**
```
GET  /api/v1/mcp/health  → 健康检查
GET  /api/v1/mcp/tools   → 21 个工具 JSON Schema
GET  /api/v1/mcp/tools/{name} → 单个工具定义
POST /api/v1/mcp/call    → 通用工具调用入口
```

### 5.2 标签生成器

**新建文件：**
```
app/services/label_generator/generator.py  — 核心引擎
app/api/v1/label_router.py                — FastAPI 路由
```

**功能：**
- Code128 条码生成（python-barcode）
- QR 码生成（qrcode），Deep Link 直达实体
- SVG + PNG 双格式输出
- 三种尺寸：small(200×100) / medium(400×200) / large(600×300)

**API 端点：**
```
POST /api/v1/labels/generate → 生成条码/QR 标签
GET  /api/v1/labels/sizes    → 可用尺寸
GET  /api/v1/labels/health   → 健康检查
```

### 5.3 文档智能提取

**新建文件：**
```
app/services/document_extractor/extractor.py  — 提取引擎
app/api/v1/document_router.py                 — FastAPI 路由
```

**支持三种文档类型，33 个提取字段：**

| 类型 | 字段数 | 关键字段 |
|------|:------:|----------|
| CoA | 16 | 批号、含量、水分、重金属、微生物、检验结论 |
| PDS | 9 | 产品名称、规格、储存条件、保质期 |
| SD | 8 | 化学品名称、CAS号、危险性、急救措施 |

**提取策略（优先级从高到低）：**
1. PDF 文本层提取（pdfminer.six，如已安装）
2. Word 文档解析（python-docx，如已安装）
3. 基于规则的正则匹配（20+ 字段模式）
4. 通用 fallback 发现

**API 端点：**
```
POST /api/v1/documents/extract     — 上传文件提取
POST /api/v1/documents/extract/text — 纯文本提取
GET  /api/v1/documents/schemas     — 字段定义
GET  /api/v1/documents/health      — 健康检查
```

**提取验证：**
```json
输入: "Batch No: HT2024001\nProduct: Huang Qi\nAssay: 98.5%\nMoisture: 3.8%\nResult: PASS"
结果:
  批号: HT2024001 (conf=0.85)
  含量: 98.5 (conf=0.85)
  水分: 3.8 (conf=0.80)
  结论: PASS (conf=0.85)
  需要人工审核: true（4/16 字段，提取率 25%）
```

---

## 三、CSRF 豁免更新

```python
# security_middleware.py
if request.url.path.startswith("/api/v1/doe"):
    return await call_next(request)
if request.url.path.startswith("/api/v1/stability"):
    return await call_next(request)
if request.url.path.startswith("/api/v1/labels") or request.url.path.startswith("/api/v1/documents"):
    return await call_next(request)
```

---

## 四、最终路由注册表

```
16 个路由组，共 21 个端点：

  /sync           — Cloud Sync
  /teams          — Team Collaboration
  /teams/dashboard — Team Dashboard
  /prompts        — Version Control
  /metrics        — Metrics
  /ray            — Ray 集群管理
  /mo-stream      — NSGA-II 多目标优化
  /batches        — 批记录管理
  /samples        — 样品与测试
  /facts          — FactEngine 确定性计算
  /doe            — DOE 实验设计（7端点）
  /stability      — Arrhenius 稳定性预测（4端点）
  /labels         — 标签生成（3端点）
  /documents      — 文档智能提取（4端点）
  /mcp            — MCP Server（4端点）
  /imports        — 数据导入
```

---

## 五、实施进度总览

| Phase | 内容 | 状态 | 进度 |
|-------|------|:----:|:----:|
| Phase 1 | 数据底座加固 | ✅ | 100% |
| Phase 2 | FactEngine + AIReportWriter | ✅ | 100% |
| Phase 3 | DOE 实验设计生成器 | ✅ | 100% |
| Phase 4 | Arrhenius 稳定性模型 | ✅ | 100% |
| Phase 5 | MCP + 标签 + 文档提取 | ✅ | 100% |

**整体进度：5/5 阶段全部完成，后端能力补全。**
