# 配方生成模块深度分析报告（根本原因修复）

> 分析时间: 2026-01-15
> 状态: ✅ 根本原因已定位并修复

---

## 一、根本原因（第一次发现）

**问题：前端发送的功效标签在后端索引中不存在，导致配方生成为空**

### 数据流追踪

```
前端 EFFECT_OPTIONS.label
  → effectLabels = ['增强免疫', '改善睡眠', ...]
  → POST /ai/generate { target_effects: ['增强免疫', '改善睡眠'] }
  → backend _translate_effect_ids()
  → 查找 _EFFICACY_TO_HERBS['增强免疫']  ← ❌ 不存在！
  → 返回 [] 个候选药材
  → 生成 0 个配方
```

### 诊断证据

```
Backend EFFICACY_TO_HERBS keys: '免疫调节'(18 herbs), '抗氧化'(14), '抗疲劳'(4), '安神'(4)...
Frontend EFFECT_OPTIONS labels: '增强免疫', '提高抵抗力', '延缓衰老', '清除自由基'...
                              : '补气养阴', '滋阴补肾', '健脾益气', '改善睡眠'...

→ 35个前端标签中，仅8个存在于后端索引
→ 27个标签不匹配 → 配方生成返回0个候选
```

---

## 二、修复内容

### 文件：`backend/app/services/ai/algorithms/genetic_formula_optimizer.py`

**修改前**：
```python
def _translate_effect_ids(effect_ids):
    return [_EFFECT_ID_TO_LABEL.get(e, e) for e in effect_ids]
    # ↑ 这个映射是 English ID → 中文label
    # 但前端已发中文label，lookup全部未命中，原样透传
    # → '增强免疫' 不在 _EFFICACY_TO_HERBS → 0 candidates
```

**修改后**：
```python
def _translate_effect_ids(effect_ids):
    """前端 label → 后端索引键 映射"""
    _LABEL_TO_BACKEND_KEY = {
        "增强免疫": "免疫调节",      # 语义等价
        "改善睡眠": "安神",          # 语义等价
        "降血脂": "降脂",            # 语义等价
        "辅助降尿酸": "降尿酸",
        "补肾益精": "补肾",
        ... (27个映射)
    }
    return [_LABEL_TO_BACKEND_KEY.get(e, e) for e in effect_ids]
```

### 修复结果

```
Before: ['增强免疫', '改善睡眠'] → [] candidates ❌
After:  ['增强免疫', '改善睡眠'] → ['免疫调节', '安神'] → 3 candidates ✅
```

---

## 三、端到端测试结果

```
[PASS] test_optimization_request_fields
[PASS] test_api_constraint_parsing: exclude_herbs=['cs', 'mld'], age_group=elderly
[PASS] test_formula_explanation: '复方增强免疫汤'
[PASS] test_genetic_optimizer: 1 candidates for '免疫调节'
[PASS] test_genetic_optimizer_pregnant: 3 candidates
[PASS] test_genetic_optimizer_exclude_herbs: 3 candidates (hq excluded)

Results: 5 passed, 0 failed ✅
```

---

## 四、UI中文化最终状态

| 区域 | 状态 |
|------|------|
| HeaderPro.tsx | ✅ 全部中文 |
| FormulaResultsPro.tsx | ✅ 全部中文（含AI大模型标签） |
| GenerationInputPro.tsx | ✅ 全部中文 |
| FormulaExplanation.tsx | ✅ 策略名称中文 |
| AlgorithmConfigPanel.tsx | ✅ 全部中文 |
| ConstraintPanel.tsx | ✅ 全部中文 |
| useExportFormula.ts | ✅ 日志中文 |
| 后端API响应 | ✅ formula_name为中文 |
| 后端配方解释 | ✅ 全部中文输出 |

**保留的英文**（合理）：JSON/CSV（格式名）、NSGA-II（算法标准缩写）、i18n key名

---

## 五、修改文件汇总

```
backend/app/services/ai/algorithms/genetic_formula_optimizer.py  ← 核心修复：_translate_effect_ids()
backend/app/api/ai_modules/generation.py                          ← 功效标签映射 + API格式
backend/app/services/ai/formula_explanation.py                    ← 公式名 + 监测建议中文化
frontend/src/components/ai/features/GenerateTab/components/*.tsx  ← 7个组件中文化
frontend/src/components/ai/features/GenerateTab/hooks/useAlgorithmConfig.ts ← 新增currentMedications
```
