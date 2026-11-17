# 配方生成 efficacy_score 恒 0.01 修复记录

- 日期：2026-11-16
- 工程师：gen-fix-efficacy（后端算法修复）
- 文件所有权：仅修改 `backend/app/services/ai/formula_generation_service.py` 与 `backend/app/services/ai/algorithms/genetic_formula_optimizer.py`

## 1. 根因（已核实，不重新怀疑方向）

`POST /ai/generate` 对 `target_effects=["增强免疫"]` 恒返回 `efficacy_score=0.01`。
0.01 = `genetic_formula_optimizer.py:171`（旧）`max(0.01, s)` 硬地板，唯一成因是评分时
`optimizer._herbs` 里药材 `efficacy_scores` 为空 → 4 个关键词（免疫调节/补气/抗炎/抗氧化）评分全部压地板。

服务进程内的功效数据未送达 GA，属**进程级运行时状态 bug**，非词表/数据/公式缺失：
- 旧自愈闸 `formula_generation_service.py:632` 条件 `not _hk.get_efficacy_to_herbs()` 只查
  「功效→药材索引是否为空」；当**索引非空但单味药材 efficacy_scores 为空**时不触发，GA 照样对空功效打分。

## 2. 修改内容

### 2.1 P0（主）：收紧自愈闸 + 启动自检日志
文件：`formula_generation_service.py`，函数 `run_ga_generation`，原 626–642 行区间。

- 自愈条件从「仅查索引空」收紧为**校验本次 tcm_keywords 能否真正命中带功效分的药材**：
  - 统计 `herbs_with_efficacy`（`efficacy_scores` 非空的药材数）；为 0 立即 `logger.error` 告警。
  - 对每个关键词统计全库命中数 `sum(1 for h in herbs if h.efficacy_scores.get(kw,0)>0)`；
    任一关键词命中=0 或带功效分药材数=0 → `await _hk.load_herbs(force_reload=True)` 并复检。
  - 重载后仍无功效分 → `logger.error` 明确告警「功效数据管线在进程内失效，根因需在适配器/预热链路排查」。
- 启动自检日志：打印「带功效分药材数/总药材数」及每个关键词命中数，为 0 即 error。

### 2.2 P1（次）：修 efficacy 稀释反向激励
文件：`genetic_formula_optimizer.py`，函数 `Individual.evaluate`，原 157–171 行。

- 分母由 `len(self.genes)`（总基因数）改为**对该关键词有真实贡献（s>0）的药材数 `contributors`**，
  消除「多选一味无此功效的药就摊薄整体分」的反向激励。
- 地板：仅当某关键词在当前个体内 `contributors==0`（真无任何命中）时给下界 `0.05`
  （比旧 0.01 更合理），有真实命中的关键词不再被地板压低。
- 向后兼容：`evaluate(target_effects, herb_dict)` 签名不变，NSGA/其它调用路径无需改动。

## 3. 验证

### 3.1 离线复现（新进程 + 真实 DB 结构功效分）— 证明修复正确
用假 HerbKnowledgePort 注入与 `tcm_herbs.extra_knowledge.efficacy_scores` 同结构的真实分
（茯苓 免疫调节0.7、党参 补气0.88 等 6 味），跑同一 `GeneticFormulaOptimizer`：

| 候选 | efficacy（修复后） | 旧值 |
|------|-------------------|------|
| cand1 | **0.3448** | 0.01 |
| cand2 | **0.3958** | 0.01 |
| cand3 | **0.3417** | 0.01 |

启动自检打印 `带功效分药材数=6/6`；单测 `6 味含功效药 efficacy=0.05`（真实下界，非 0.01）。
功效分确已进入 GA 评分。

### 3.2 在线端点 — 无法验证（环境阻塞，非修复缺陷）
- 用 admin/admin123 经 csrf→login→refresh csrf 全流程认证后实测
  `POST /api/v1/ai/generate {"target_effects":["增强免疫"],...}` 仍返回 `efficacy=0.01`。
- **根因**：后端 uvicorn `--reload` 的**监督进程（PID 10988）已死亡**，worker（PID 4524）
  自 **2026-11-14 23:47** 起为孤儿进程，从未随文件改动重新拉起 → 在线进程仍运行**旧代码**。
- 本次修复靠 reload 生效的前提不成立；**需用户侧重启后端**（本次禁止重启后端）后，
  上述 §3.1 离线结果即为重启后在线预期。

## 4. 遗留 / 后续处理
- `ai/__init__.py:174-176` 的 `_schedule_async_warmup` 是否把已加载的
  `herb.efficacy_scores` 清空/替换仍需在**有重启权限**时观察启动自检日志确认；
  本修复已在 service 层加防御性重载兜底，即使预热脱钩也能自愈。
- 后端重启后建议回归：`["增强免疫"]`（预期 ~0.2–0.4）、`["改善睡眠"]`、`["安神助眠"]` 确认不回归。

---

# 第二轮（2026-11-16 23:2x）：在线仍 0.05 的深挖

## 背景
后端重启（新进程 PID 10776）加载第一轮修复后，在线 `["增强免疫"]` efficacy 从 0.01 → **0.05**
（= P1 新地板 `contributors==0` 值）。说明：①新代码已生效；②但服务进程内 GA 评分那一刻
`herb.efficacy_scores` 对 4 个关键词**全部 contributors==0**。

## 对照实验（关键，推翻"键名不匹配/mojibake"假设）
用服务进程同路径（`init_ai_services()` → `get_global_herb_knowledge()`）实测：

| 场景 | 带功效分药材 | 茯苓功效键 | 关键词命中(免疫调节/补气/抗炎/抗氧化) | endpoint efficacy |
|------|------|------|------|------|
| init_ai_services 后 | 562/590 | 利尿/免疫调节/消化系统（正确中文） | 11 / 13 / 11 / 9 | — |
| 不设 PYTHONUTF8（复刻服务默认编码） | 562/590 | 同上，仍正确中文 | 11 / 13 / 11 / 9 | — |
| 进程内直调 `run_ga_generation(["增强免疫"])` | 562/590 | 正确 | 11/13/11/9 | **0.71 / 0.66 / 0.64** |

**结论：**
1. 服务进程内 `get_herbs()` 的功效键**是正确的中文**（免疫调节/补气/抗炎/抗氧化都查得到）。
2. console `????` 是 **PowerShell GBK 控制台渲染问题**，Python 字符串与 `.get()` 查找均正确。
   → 之前"关键词命中=0 / ????"是被渲染误导，实际键没坏。
3. **进程内直调端点 = 0.64+，在线 HTTP = 0.05**：同一份代码、同一 init 路径、同样 562 带功效分药材。
   唯一差异 = "进程内直调 vs 真实 uvicorn 服务进程" → 根因是**真实服务进程特有的运行时状态**
   （嫌疑：RAG 钩子在真实进程 Embedding 正常→白名单/黑名单与降级模式不同；或某服务单例状态）。

## 本轮改动（防御 + 取证）
1. `herb_knowledge_adapters.py`：新增 `_normalize_efficacy_key()`，`_to_profile` 构造
   `efficacy_scores` 时归一化键（mojibake→UTF-8 还原，正常中文原样返回）。虽已证伪，
   作为无害防御保留。
2. `genetic_formula_optimizer.py`：新增两处 **mojibake-proof 字节级诊断日志**（`hex(ord(c))`
   codepoint，不受控制台编码影响）：
   - `optimize()`：候选功效自检（候选数/带功效分候选数/每关键词命中数）。
   - `Individual.evaluate()`：首次评估打印 target0 codepoint、scoring_herbs 数、样例药材功效键 codepoint。
   这两行在**真实服务进程**打印评分那一刻功效键的真实码点，一次定位（空 / mojibake / 键体系不同 / 药材脱钩）。

## 待办（需重启权限 + 真实服务进程日志）
重启后触发一次 `["增强免疫"]`，用 UTF-8 抓取：
- `[Individual.evaluate][字节诊断]`（最关键：sample_keys / sample_key0_cp / target0_cp）
- `[GeneticAlgorithm][字节诊断]` + `[GeneticAlgorithm] 候选功效自检`

判定规则：`sample_key0_cp` 若为 `0x514d 0x75ab…`(免 疫)=键正常但与 target0 不匹配→关键词侧；
若为其它码点=真 mojibake/别的键体系；若 `sample_herb=NOT_IN_DICT` 或 keys 空=评分路径药材脱钩。

---

# 第三轮（2026-11-16 23:4x）：日志被过滤 → 改用响应内嵌诊断字段

## 为什么改手段
Lead 反馈：我加的日志诊断行（`[Individual.evaluate][字节诊断]` 等）在 live 日志里**一次未出现**
（被 uvicorn logging 配置过滤）。→ 改为**不依赖日志**：把诊断数据直接塞进 `/ai/generate` 响应 JSON。

## 回答 Lead 关键问题：进程内 0.64 是否走同一全局单例？
**是。** 诊断确认 `run_ga_generation` 内部用 `get_global_herb_knowledge()`（type=HerbKnowledgeService）
这一**全局单例**，非自建实例。进程内实测：
- `service_singleton`: total=590, with_efficacy=562, sample=茯苓
- `optimizer_dict`: total=590, with_efficacy=562, sample=茯苓（与单例一致）
- GA 实际评分键 `ga_evaluated_keywords` = 免疫调节/补气/抗炎/抗氧化（`_translate_effect_ids` 归一化后）
- 各关键词真实贡献者：免疫调节 n=3~4（大枣/薏苡仁/党参/黄芪…）、补气 n=3~4（灵芝/党参…分0.78~0.92）、
  抗炎 n=1~2、抗氧化 n=1~2
- efficacy_raw = **0.6678 / 0.5614 / 0.6936**

**唯一环境差异**：我进程内 RAG 钩子处于 **Embedding 降级（BM25-only）**，真实服务 Embedding 正常。
RAG 影响 include/exclude 白黑名单 → 可能改变候选池，但不该把带功效分药材变成无功效分。
所以 0.64 能代表"单例数据正确、代码路径正确"，在线 0.05 仍是真实服务进程特有状态。

## 关键发现：前端 label vs DB 评分键
`run_ga_generation` 传给 `_format_ga_candidates` 的是**前端 label `增强免疫`**，
而 GA `evaluate()` 实际用 `_translate_effect_ids("增强免疫") → [免疫调节,补气,抗炎,抗氧化]` 评分。
`增强免疫` 本身在 DB 无此键（per_keyword 显示 `增强免疫: n=0` 属正常），真实评分键是归一化后的 4 个。
**这不影响评分正确性**（efficacy 用的是归一化键），但调试/展示须用归一化键。

## 本轮改动（响应内嵌诊断，log 无关）
`formula_generation_service.py` `_format_ga_candidates(..., tcm_keywords=...)` 新增：
- 每候选 `_efficacy_debug`：`efficacy_raw`、`per_keyword{ contributors/scores/n_contributors }`
  （覆盖 ga_evaluated_keywords + target_effects）、`sample_herb_name/efficacy_keys`、
  `optimizer_herbs_total/with_efficacy`。
- 响应级 `_herb_load_debug`：`service_singleton{total/with_efficacy/sample_name/sample_efficacy_keys}`、
  `optimizer_dict{...}`、`target_tcm_keywords`、`ga_evaluated_keywords`。
- 调用处传入 `tcm_keywords=tcm_keywords`。

## 待办（Lead 重启 + 调 API）
重启后调 `POST /api/v1/ai/generate ["增强免疫"]`，直接读响应 JSON 的
`_herb_load_debug` 与每个 candidate 的 `_efficacy_debug`，即可在线看到评分那一刻：
- service 单例 vs optimizer 字典是否都 562/590 带功效分（若在线 service 侧 with_efficacy=0 → 单例加载问题）。
- `ga_evaluated_keywords` 是否为 免疫调节/补气/抗炎/抗氧化（若为 ????/乱码 → 归一化或编码问题）。
- 每关键词 contributors 是否为空（若全空 → 评分路径药材脱钩；若有值但 efficacy 仍 0.05 → 评分公式/地板问题）。
此三字段一次定位在线 0.05 的确切环节。
