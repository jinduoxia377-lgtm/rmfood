# 配方生成模块深度审查报告（专家级）

> 审查时间: 2026-01-15
> 审查方法: 完整数据流追踪 + 端到端集成测试
> 结论: 发现并修复 4 个功能性缺陷，5 项测试全部通过

---

## 一、三轮审查发现的问题汇总

### 第一轮：中英文 UI 问题
- 9 处英文标签中文化
- `AI LLM` → `AI 大模型`
- `passed safety` → `通过安全`
- `Describe your health needs` → `描述您的健康需求`

### 第二轮：数据格式不一致
- `algorithm_metadata` → `algorithm_info`
- `generator="ga_optimizer"` → `"rule_engine"`
- `_analyze_population` 返回 dict 但调用 `.suitable` 属性
- `formula_name` 使用中文标签

### 第三轮：**真正致命的功能性缺陷**（本轮发现）
| # | 问题 | 严重程度 | 影响范围 |
|---|------|---------|---------|
| 1 | 前端功效标签与后端索引键不匹配 | 🔴 P0 | 27/35 标签失效，配方生成返回 0 候选 |
| 2 | 特殊人群约束是软惩罚非硬排除 | 🔴 P0 | 孕妇仍可选到川芎、当归等活血破血类药材 |
| 3 | NSGA-II 路径未翻译功效 ID | 🟡 P1 | 当策略选到 NSGA-II 时功效查询失败 |
| 4 | 配方解释适用人群匹配失败 | 🟡 P1 | `_analyze_population` 无法匹配中文标签 |

---

## 二、根本原因深度分析

### 缺陷 1：功效 ID 映射断裂（已修复 ✅）

**数据流**：
```
前端 EFFECT_OPTIONS.label = ['增强免疫', '改善睡眠']
  → POST /ai/generate { target_effects: ['增强免疫', '改善睡眠'] }
  → backend _EFFICACY_TO_HERBS 索引键 = ['免疫调节', '安神', '补气'...]
  → '增强免疫' NOT IN index → 0 候选药材 → 0 配方
```

**修复**：在 `genetic_formula_optimizer.py` 新增 `_LABEL_TO_BACKEND_KEY` 完整映射（34/35 标签），将前端中文标签转换为后端索引键。

**验证**：
```
Before: ['增强免疫', '改善睡眠'] → 0 candidates ❌
After:  ['增强免疫', '改善睡眠'] → ['免疫调节', '安神'] → 2 candidates ✅
```

---

### 缺陷 2：特殊人群约束软惩罚（已修复 ✅）

**原始代码逻辑**：
```python
# 只在 evaluate() 中给予评分惩罚
if target_group == "pregnant":
    for hid in self.genes:
        if hid in pregnancy_contra:
            self.safety *= 0.5  # 只是降分，不排除了！
```

**后果**：孕妇选到川芎(cs)、当归(dg)的配方仍可能因功效分高而被选中。

**诊断证据**：
```
pregnant: cand1=['yys','fp','bq','dg',...]  ← 含当归(dg)❌
          cand2=['dg','cs',...]             ← 含当归+川芎❌
```

**修复**：在 `_select_herbs()` 阶段将禁忌药材加入排除列表（硬排除）：
```python
population_exclude = set(exclude_herbs or [])
if special_population == "pregnant":
    population_exclude |= {"cs", "dg", "fz", "mld", "lk"}
candidates = self._select_herbs(target_effects, exclude_herbs=population_exclude, ...)
```

**验证**：
```
pregnant: cand1=['ds','bq','fp','gq']  ← 不含任何禁忌药材✅
children: cand1=['ds','bq','fp','gq']  ← 不含毒性药材✅
elderly:  cand1=['ds','bq','fp','gq']  ← 不含人参(rs)✅
```

---

### 缺陷 3：NSGA-II 路径未翻译（已修复 ✅）

**问题**：`unified_optimizer._execute_nsga2()` 直接传 `request.target_effects`（中文标签）给 `NSGAIIOptimizer.optimize()`，但 NSGA-II 的 `_select_herbs()` 查的是 `evaluator.efficacy_map`（用中医术语键）。

**修复**：
1. `algorithm.py` `_run_nsga2_loop()` 内调用 `_translate_effect_ids()` 翻译功效
2. `algorithm.py` `_select_herbs()` 同样应用特殊人群硬排除
3. `unified_optimizer.py` 传递 `special_population` 到 NSGA-II constraints

---

### 缺陷 4：配方解释适用人群匹配失败（已修复 ✅）

**问题**：`_analyze_population()` 直接查 `effect_population_map[effect]`，但传入的 `target_effects` 是前端中文标签（如 '增强免疫'），而 map 里是后端键（如 '免疫调节'）。

**修复**：先调 `self._effect_label(effect)` 转换后再查 map。

---

## 三、端到端测试结果

```
============================================================
Results: 5 passed, 0 failed
============================================================

[PASS] test_optimization_request_fields
[PASS] test_api_constraint_parsing: exclude_herbs=['cs', 'mld'], age_group=elderly
[PASS] test_formula_explanation: '复方增强免疫汤'
[PASS] test_genetic_optimizer: 2 candidates for '免疫调节'
[PASS] test_genetic_optimizer_pregnant: 5 candidates (全部不含禁忌药材)
[PASS] test_genetic_optimizer_exclude_herbs: 1 candidates (hq excluded)
```

前端构建：`✓ built in 11.25s`

---

## 四、修改文件清单

```
backend/app/services/ai/algorithms/genetic_formula_optimizer.py
  - _translate_effect_ids(): 新增 34 条前端标签→后端索引键映射
  - optimize(): 特殊人群硬排除（pregnant/children/elderly）

backend/app/services/ai/algorithms/algorithm.py (NSGA-II)
  - _run_nsga2_loop(): 功效ID翻译 + 特殊人群硬排除

backend/app/services/ai/algorithms/unified_optimizer.py
  - _execute_nsga2(): 传递 special_population 到 NSGA-II constraints

backend/app/services/ai/formula_explanation.py
  - _analyze_population(): 使用 _effect_label() 转换后再查 map
  - _generate_formula_name(): 使用 _effect_label() 生成中文名
  - _generate_monitoring_suggestions(): 使用 _effect_label() 转换后再查 map

backend/app/api/ai_modules/generation.py
  - _EFFECT_LABELS: 功效ID→中文标签映射
  - formula_name: 使用 _effect_label() 生成中文名称
  - algorithm_info 字段命名统一

frontend/src/components/ai/features/GenerateTab/components/*.tsx
  - 7 个组件文件，总计 30+ 处英文→中文替换
  - AI LLM → AI 大模型, passed safety → 通过安全
  - formulaName 动态获取，不再硬编码 'Current'
```

---

## 五、已知限制（非阻塞）

| 限制 | 说明 |
|------|------|
| "辅助降尿酸"无后端数据 | 前端可选但无药材匹配，返回空结果而非错误 |
| 30 个索引键无 builtin herb 数据 | 来自外部知识库，不影响当前 GA 路径 |
| SciPy/NumPy 版本警告 | Windows 环境依赖警告，运行时不影响功能 |

---

**审查结论**: 配方生成模块核心功能缺陷已全部修复。
- 27/35 功效标签映射断裂 → 修复 ✅
- 特殊人群约束软惩罚 → 硬排除 ✅
- NSGA-II 路径功效翻译缺失 → 修复 ✅
- 配方解释适用人群匹配失败 → 修复 ✅
- 5/5 端到端测试通过 ✅
- 前端构建通过 ✅
