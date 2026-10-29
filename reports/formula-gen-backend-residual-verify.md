# 配方生成模块后端剩余缺口 验证报告（任务 1-3）

- 处理日期：2026-10-28
- 执行角色：RMFOODFP 后端开发专家（dev-rag-backend2）
- 范围：仅后端 `backend/app/`；未碰前端；未实际重建 `.venv`。

---

## 任务 1（P2）：功效标签映射补全 — ✅ 已完成

### 改动
`backend/app/services/ai/formula_generation_service.py` `EFFECT_LABEL_TO_TCM_KEYWORD`：**26 → 45 键**，
补齐前端 `CATEGORY_EFFECTS`（generateTabConfig.ts:134-144）缺失的 **19 个 label**（`:71-90` 新增段），
映射到古籍/药典常用功效词（与既有 26 键风格一致）：

| label | 映射 | label | 映射 |
|:---|:---|:---|:---|
| 提高抵抗力 | 补气/益气固表/免疫调节/扶正 | 保护血管 | 心血管保护/活血/化瘀/降脂 |
| 缓解疲劳 | 抗疲劳/益气健脾/补气/补肾 | 促进循环 | 活血/通络/温通经脉/改善微循环 |
| 提升精力 | 补气/补肾/益精/抗疲劳 | 强健筋骨 | 强筋骨/补肝肾/壮骨/益精 |
| 促进消化 | 消食/健脾/理气/助消化 | 补钙健骨 | 补肝肾/强筋骨/壮骨/益精 |
| 调理脾胃 | 健脾/和胃/理气/消化系统 | 明目护眼 | 明目/养肝/清肝/益精 |
| 安神定志 | 安神/养心安神/宁心/定志 | 缓解眼疲劳 | 明目/养肝/清肝/滋养肝血 |
| 美容养颜 | 美容养颜/养血/活血/润肤 | 清咽利喉 | 利咽/润喉/清热解毒/润肺 |
| 护肤保湿 | 养阴生津/滋阴润燥/润肤/美容养颜 | 辅助降尿酸 | 利尿/祛湿/清热利湿/降尿酸 |
| 延缓衰老 | 抗衰老/抗氧化/补肾/益精 | 调节代谢 | 健脾/利湿/化痰/降脂 |
| | | 控制体重 | 利湿/化痰/消食/降脂 |

- `build_tcm_keywords` L78 回退 `[label]` **保持不变**（未丢标签）。

### 验收
| 项 | 结果 | 证据 |
|:--|:--:|:--|
| 映射覆盖 | ✅ | 31/31（26+19=45 键；前端 31 唯一 label 全覆盖，无 missing） |
| 样本返回非空 TCM 关键词 | ✅ | 提高抵抗力/安神定志/护肤保湿/控制体重/清咽利喉 → 均非空数组 |
| 无 label 返回空 | ✅ | 0 个空（全 31 个 label 均返回非空） |
| py_compile | ✅ | PY_COMPILE_OK |

---

## 任务 2（P2）：RAG 黑名单接入结构化禁忌 — ✅ 已完成

### 背景/现状
`formula_rag_hook.py:27-49` 原仅 ±120 字符共现启发式；结构化 `extra_knowledge.contraindication`
（models/external_data.py:32）存在但未用。`HerbProfile`（domain/herb_ports.py:14）不携带 contraindication 字段。

### 改动（`backend/app/services/ai/rag/formula_rag_hook.py`）
1. **新增** `_load_structured_contraindications()`（异步，进程内缓存）：构建 `{name_cn: [禁忌...]}`，源优先级/并集：
   - `HERB_KNOWLEDGE_BASE.contraindication`（knowledge_base.py，52 味；enrich_herb_knowledge 将其写入
     `tcm_herbs.extra_knowledge.contraindication`——即所指结构化禁忌源）。
   - `food_materials.contraindications`（DB，55/142）。
   - `herb_food_herbs.restrictions`（卫健委药食同源目录表，如 甘草→高血压患者慎用/孕妇慎用）。
   - `tcm_herbs.contraindications`（DB，11 行）。
   - **任何一步失败不抛出**（返回已成功部分；全失败返回 {} → 调用方降级共现启发式，不阻断主流程）。
2. **黑名单判定改**（chunk 循环内）：`structured_contra.get(n)` 命中 → 黑名单（结构化强证据，按药材名）；
   **否则**回退 `_is_negative_evidence`（±120 字符共现启发式，避免召回丢失）。
3. 数据来源与匹配逻辑：结构化禁忌**按药材名精确匹配**（`name_cn`），为强证据；共现启发式仅在无结构化数据时兜底。

### 验收
| 项 | 结果 | 证据 |
|:--|:--:|:--|
| 结构化禁忌加载 | ✅ | `structured_contra herbs: 76`（KB 52 ∪ food_materials 55 ∪ herb_food_herbs ∪ tcm_herbs 去重） |
| 甘草 → 孕妇/高血压慎用 | ✅ | structured 命中（food_materials/herb_food_herbs 卫健委目录源） |
| 有结构化禁忌药材 → 黑名单（即使内容无禁忌词） | ✅ | 场景1 甘草（内容"补脾益气"无禁忌词）→ **blacklist** |
| 无结构化 + 内容含有毒 → 启发式黑名单 | ✅ | 场景2 → **blacklist**（fallback） |
| 无结构化 + 无禁忌词 → 白名单 | ✅ | 场景3 → **whitelist** |
| 黑名单致空候选防护 | ✅ | 调用方 L410-424 已有「去掉 RAG 黑名单重试 GA」安全阀，不会打成规则引擎回退 |
| py_compile | ✅ | PY_COMPILE_OK |

---

## 任务 3（P2）：`.venv` 补全（环境）— ✅ 只读确认完成（未重建）

### 只读实测
| 环境 | site-packages 实体 | import 实测 |
|:---|:--:|:--|
| `backend/.venv` | **1**（仅 `_virtualenv` shim，无真实依赖） | — |
| `backend/venv` | **301**（真实依赖） | ✅ fastapi 0.115.0 / sqlalchemy 2.0.35 / pydantic 2.13.5 / asyncpg 正常 |

### 结论与建议
- **统一用 `backend/venv`**：已完整安装并可用（全部关键依赖 import 正常），是本项目实际运行环境。
- `backend/.venv` 为**过期空壳**（仅 `_virtualenv.pth`/`_virtualenv.py`，无 fastapi 等），建议**删除**或忽略；
  若某工具强制要求 `.venv` 名，可从 `venv` 复制或 `python -m venv .venv && .venv\Scripts\pip install -r requirements.txt` 重建——**本轮不执行**（避免破坏当前工作环境）。
- 风险说明：`venv` 的包数因统计口径（含/不含 dist-info、pip/setuptools）与任务描述（538）略有差异，但功能等价（import 正常）。

---

## 改动文件汇总
1. `backend/app/services/ai/formula_generation_service.py`（`:33-90`）— 功效标签映射 26→45 键（任务1）。
2. `backend/app/services/ai/rag/formula_rag_hook.py`（新增 `_load_structured_contraindications` + 黑名单逻辑改造）— 任务2。
3. （只读确认，未改）`backend/.venv`、`backend/venv` — 任务3。

## 环境备注
- `backend/venv`（Py3.11.15）为实际环境；仅改动 2 个后端文件 + 只读确认 .venv；未触碰前端；未重建 .venv。
- 脚本 stderr 的 `SECRET_KEY 未设置`/Redis/遥测告警为既有环境噪声；`py_compile`、映射/黑名单断言均正常。
