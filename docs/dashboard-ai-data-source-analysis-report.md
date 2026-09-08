# Dashboard AI 模块数据源深度分析报告

> 分析时间：2026-08-28  
> 分析对象：AI智能洞察（ai-insights）和 AI智能分析面板（ai-analysis）  
> 结论：**两套系统数据源混合，真实性程度不同**

---

## 一、整体结论速览

| 模块 | 数据源 | 真实性评级 | 说明 |
|------|--------|------------|------|
| **AI智能洞察**（ai-insights） | ✅ 真实数据派生 | **85% 真实** | 基于真实统计 API 派生，洞察内容随用户数据变化 |
| **AI分析面板**（ai-analysis） | ⚠️ 混合数据 | **40% 真实** | 部分端点有真实数据，大量硬编码降级值 |

---

## 二、AI智能洞察（ai-insights）详细分析

### 2.1 数据流链路

```
前端 aiInsightsApi.getInsights()
    ↓
GET /api/v1/dashboard/statistics   ← 真实 SQL 查询
GET /api/v1/dashboard/trends?period=30d  ← 真实 SQL 查询
    ↓
前端 JavaScript 派生逻辑
    ↓
输出 AIInsight[]
```

### 2.2 各子函数数据源

#### getInsights() — 85% 真实

| 洞察类型 | 数据来源 | 真实性 |
|----------|----------|--------|
| 配方批准率 | `stats.formulas.total` + `by_status['approved']` | ✅ 真实 DB |
| 待审核积压 | `stats.formulas.by_status['pending_review']` | ✅ 真实 DB |
| 实验失败率 | `stats.experiments.by_status['failed']` | ✅ 真实 DB |
| 进行中实验 | `stats.experiments.by_status['in_progress']` | ✅ 真实 DB |
| 配方趋势 | `trends.data`（近30天公式创建量） | ✅ 真实 DB |
| 兜底通用洞察 | 无数据来源，固定文案 | ❌ 硬编码 |

**关键代码路径：**
```typescript
// aiInsights.ts:38-40
const [stats, trends] = await Promise.all([
  apiClient.get('/dashboard/statistics').then(r => r.data),  // 真实
  apiClient.get('/dashboard/trends?period=30d').then(r => r.data),  // 真实
])
```

#### getPredictions() — 70% 真实

| 预测项 | 数据来源 | 真实性 |
|--------|----------|--------|
| 新增配方预测 | `formulasTotal * 1.15` | ⚠️ 真实基数 + 硬编码增长系数 |
| 实验成功率预测 | `completedExps / totalExps` | ✅ 真实 DB 计算 |

#### getKPIProgress() — 90% 真实

| KPI 项 | 数据来源 | 真实性 |
|--------|----------|--------|
| 配方完成率 | `approvedFormulas / formulasTotal * 100` | ✅ 真实 DB |
| 实验成功率 | `completedExps / totalExps * 100` | ✅ 真实 DB |

### 2.3 后端真实数据来源验证

**`/api/v1/dashboard/statistics`**（`backend/app/api/dashboard.py:23`）：
```python
# 真实 SQL 查询
SELECT count(*) FROM formulas                           # 真实配方总数
SELECT status, count(*) FROM formulas GROUP BY status   # 真实状态分布
SELECT count(*) FROM experiments                         # 真实实验总数
SELECT count(*) FROM users                               # 真实用户数
```

**`/api/v1/dashboard/trends`**（`backend/app/api/db_modules/dashboard.py:171`）：
```python
# 真实数据库查询
herbs_db = (await db.execute(select(TCMHerb).limit(500))).scalars().all()
peptides_db = (await db.execute(select(BioactivePeptide).limit(500))).scalars().all()
```

### 2.4 发现问题：模板字符串 Bug

```typescript
// aiInsights.ts:58 — 字符串插值错误（使用单引号而非反引号）
title: '配方批准率达 ${rate}%',        // ❌ 字面量 "${rate}"
description: `已批准的 ${approvedFormulas} 个配方...`,  // ✅ 正确

// aiInsights.ts:94
title: '实验失败率偏高 (${rate}%)',     // ❌ 字面量
```

**影响：** 洞察标题中会出现字面量 `${rate}` 而非实际数值，用户可见此 bug。

---

## 三、AI分析面板（ai-analysis）详细分析

### 3.1 数据流链路

```
AIAnalysisPanel 组件挂载
    ↓
useEffect(() => { fetchFormulaAnalysis() }, [])
    ↓
POST /api/v1/ai/analyze/formula   ← 后端存在，但无 formula_id
POST /api/v1/ai/recommend/formulas ← 后端存在，返回真实配方
POST /api/v1/ai/predict/trends    ← 后端存在，部分硬编码
POST /api/v1/ai/analyze/experiment← 后端存在，无 experiment_id
```

### 3.2 各 Tab 数据源详细分析

#### Tab 1: 配方分析（analysis）

**前端代码路径：**
```typescript
// AIAnalysisPanel.tsx:139-203
const response = await api.post<FormulaAnalysisResult>('/ai/analyze/formula', {
  target_effects: ['增强免疫', '抗疲劳'],  // 硬编码请求体
})
```

**后端逻辑（`backend/app/api/ai_modules/recommendations.py:60`）：**
```python
# 无 formula_id 时 → ingredients = None
# 调用 ai_service.analyze_synergy([]) → 空列表 → 返回默认值
# 调用 ai_service.check_safety([]) → 空列表 → 返回安全
# 最终返回的 suggested_enhancements 是硬编码的 ["建议添加黄芪以增强免疫效果"]
```

**真实性评估：**

| 字段 | 来源 | 真实性 |
|------|------|--------|
| `ingredient_analysis.total_count` | `len(ingredients) or 0` → 0 | ⚠️ 真实（确实为0） |
| `effect_prediction.predicted_effects` | `target_effects or []` → 硬编码请求体 | ⚠️ 模拟请求 |
| `suggested_enhancements` | 后端硬编码字符串 | ❌ 硬编码 |
| `safety_assessment` | `safety.get('passed', True)` → 默认 True | ⚠️ 无真实检测 |
| `optimization_suggestions` | 前端 mockData 硬编码 | ❌ 硬编码 |
| `confidence` | 前端 mockData 0.88 | ❌ 硬编码 |

#### Tab 2: 智能推荐（recommendations）

**前端代码路径：**
```typescript
// AIAnalysisPanel.tsx:214
const response = await api.post('/ai/recommend/formulas', { limit: 3 })
```

**后端逻辑（`backend/app/api/ai_modules/optimization.py:145`）：**
```python
# 真实数据库查询：SELECT * FROM formulas WHERE owner_id = ? ORDER BY overall_score DESC
formulas = await db.execute(query.order_by(Formula.overall_score.desc()).limit(req.limit))
```

**真实性评估：**

| 字段 | 来源 | 真实性 |
|------|------|--------|
| `recommendations[]` | 真实数据库查询 | ✅ 真实 |
| `relevance_score` | `f.overall_score` | ✅ 真实 |
| `target_effects` | `f.target_effects` | ✅ 真实 |
| `ingredient_count` | `len(f.ingredients)` | ✅ 真实 |
| 前端 fallback mockData | 硬编码 3 条示例配方 | ⚠️ 仅 API 失败时使用 |

#### Tab 3: 趋势预测（trends）

**前端代码路径：**
```typescript
// AIAnalysisPanel.tsx:264
const response = await api.post<TrendPrediction>('/ai/predict/trends', {
  timeframe: '30d',
  metrics: ['formulas', 'experiments', 'success_rate'],
})
```

**后端逻辑（`backend/app/api/ai_modules/optimization.py:191`）：**
```python
# 真实查询
total_formulas = SELECT count(*) FROM formulas WHERE owner_id = ?
total_experiments = SELECT count(*) FROM experiments WHERE owner_id = ?
# 硬编码预测
"predicted": max(total_formulas + 5, total_formulas),  # 固定 +5
"success_rate": {"current": 80, "predicted": 82}       # ❌ 硬编码
"top_trending_effects": [...]                          # ❌ 硬编码
```

**真实性评估：**

| 字段 | 来源 | 真实性 |
|------|------|--------|
| `formulas.current` | 真实公式总数 | ✅ 真实 |
| `formulas.predicted` | `current + 5` | ⚠️ 真实基数 + 硬编码增幅 |
| `experiments.current` | 真实实验总数 | ✅ 真实 |
| `experiments.predicted` | `current + 3` | ⚠️ 真实基数 + 硬编码增幅 |
| `success_rate` | ❌ 固定 80/82 | ❌ 硬编码 |
| `top_trending_effects` | ❌ 固定列表 | ❌ 硬编码 |

#### Tab 4: 实验分析（experiments）

**前端代码路径：**
```typescript
// AIAnalysisPanel.tsx:317
const response = await api.post('/ai/analyze/experiment', {})  // 无 experiment_id
```

**后端逻辑（`backend/app/api/ai_modules/experiment.py:32`）：**
```python
# 无 experiment_id → experiment_data = None
# 返回默认值
key_metrics = {"effectiveness": 85, "stability": 90, "taste_score": 75, "safety": 95}
overall_status = "success"  # 因为 all(v >= 70) = True
# 所有 interpretation/recommendations 均为硬编码
```

**真实性评估：**

| 字段 | 来源 | 真实性 |
|------|------|--------|
| `experiment_id` | null | ⚠️ 无真实实验 |
| `result_summary.overall_status` | 基于 key_metrics 判断 | ⚠️ 默认值 |
| `key_metrics` | 硬编码默认值 | ❌ 硬编码 |
| `comparison_to_baseline.improvement` | 硬编码 15 | ❌ 硬编码 |
| `interpretation.key_findings` | 格式化硬编码字符串 | ❌ 硬编码 |
| `recommendations.next_experiments` | 硬编码列表 | ❌ 硬编码 |

---

## 四、对比总结

| 维度 | AI智能洞察 | AI分析面板 |
|------|-----------|-----------|
| **API 端点** | `/dashboard/statistics` + `/dashboard/trends` | `/ai/analyze/formula` + `/ai/recommend/formulas` + `/ai/predict/trends` + `/ai/analyze/experiment` |
| **后端实现时间** | 较早（真实统计 API） | v2.0（2026-07-06）重构 |
| **请求参数** | 无需参数，自动获取 | 需要 formula_id/experiment_id |
| **当前请求参数** | 无 | 硬编码默认值（无 formula_id） |
| **真实数据覆盖** | 85% | 约 40% |
| **主要硬编码来源** | 兜底文案 + 字符串插值 Bug | 配方分析建议、趋势预测增幅、实验指标 |
| **是否随用户数据变化** | ✅ 是 | ⚠️ 部分（推荐和趋势基数变化，但分析和实验不变） |

---

## 五、具体问题清单

### 🔴 严重问题

| # | 问题 | 位置 | 影响 |
|---|------|------|------|
| B-001 | `aiInsights.ts` 字符串插值使用单引号而非模板字符串 | Line 58, 94 | 洞察标题显示字面量 `${rate}` 而非实际数值 |
| B-002 | AI分析面板发起分析时无 formula_id | `fetchFormulaAnalysis` | 后端返回空成分分析，建议全部硬编码 |
| B-003 | 实验分析无 experiment_id | `fetchExperimentAnalysis` | 后端返回默认值，所有指标硬编码 |

### ⚠️ 中等问题

| # | 问题 | 位置 | 影响 |
|---|------|------|------|
| B-004 | 趋势预测 success_rate 硬编码为 80/82 | `optimization.py:232-233` | 与实际实验成功率不符 |
| B-005 | 趋势预测 top_trending_effects 硬编码 | `optimization.py:239-244` | 不受用户数据影响 |
| B-006 | 推荐模块 fallback 使用硬编码示例配方 | `AIAnalysisPanel.tsx:221-252` | API 失败时显示假数据 |

---

## 六、修复建议

### 优先级 P0：修复字符串插值 Bug

```typescript
// aiInsights.ts — 修改前
title: '配方批准率达 ${rate}%',

// aiInsights.ts — 修改后
title: `配方批准率达 ${rate}%`,
```

### 优先级 P1：AI分析面板传入真实 formula_id

```typescript
// AIAnalysisPanel.tsx — 在组件加载时先获取用户配方列表
const { data: formulas } = useQuery({
  queryKey: ['user-formulas'],
  queryFn: () => api.get('/formulas?page=1&page_size=1'),
  enabled: !isInitialLoading,
})

// 然后在 fetchFormulaAnalysis 中传入第一个配方的 ID
const fetchFormulaAnalysis = useCallback(async () => {
  const formulaId = formulas?.data?.[0]?.id ?? null
  const response = await api.post('/ai/analyze/formula', {
    formula_id: formulaId,
    target_effects: ['增强免疫', '抗疲劳'],
  })
}, [formulas])
```

### 优先级 P1：实验分析传入真实 experiment_id

```typescript
// 同样从实验列表中取第一个
const { data: experiments } = useQuery({
  queryKey: ['user-experiments'],
  queryFn: () => api.get('/experiments?page=1&page_size=1'),
  enabled: !isInitialLoading,
})

const fetchExperimentAnalysis = useCallback(async () => {
  const expId = experiments?.data?.[0]?.id ?? null
  const response = await api.post('/ai/analyze/experiment', {
    experiment_id: expId,  // 传入真实 ID
  })
}, [experiments])
```

### 优先级 P2：后端趋势预测 success_rate 使用真实数据

```python
# optimization.py — 替换硬编码
completed_exps = await db.execute(
    select(func.count(Experiment.id)).where(
        Experiment.status == 'completed'
    )
)
total_exps = await db.execute(
    select(func.count(Experiment.id))
)
current_success_rate = total_exps > 0 ? completed_exps / total_exps * 100 : 0
```

---

## 七、数据流向图

```
┌─────────────────────────────────────────────────────────────┐
│                    AI智能洞察（ai-insights）                  │
│                                                             │
│  前端 fetch                                                    │
│  ↓                                                           │
│  GET /dashboard/statistics  ──────→ POSTGRES (真实)          │
│  GET /dashboard/trends      ──────→ POSTGRES (真实)          │
│  ↓                                                           │
│  前端 JavaScript 派生逻辑（确定性算法）                          │
│  ↓                                                           │
│  AIInsight[] → 渲染到卡片                                      │
│  真实性: 85%（后端真实 + 前端派生，仅有兜底文案为硬编码）         │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                  AI分析面板（ai-analysis）                     │
│                                                             │
│  前端 fetch                                                   │
│  ↓                                                           │
│  POST /ai/analyze/formula   ────→ 后端 ai_service（需 formula_id）│
│  POST /ai/recommend/formulas ────→ POSTGRES 真实查询 ✅       │
│  POST /ai/predict/trends    ────→ 后端混合（真实基数+硬编码增幅） │
│  POST /ai/analyze/experiment ────→ 后端默认值（需 experiment_id）│
│  ↓                                                           │
│  问题：无 formula_id / experiment_id → 后端返回降级数据           │
│  真实性: ~40%                                                │
└─────────────────────────────────────────────────────────────┘
```

---

**报告生成时间：** 2026-08-28  
**下一步：** 请确认是否需要执行修复方案
