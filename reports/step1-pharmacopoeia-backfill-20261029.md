# Step1 禁忌源《中国药典》回填 — 诊断与推进报告（2026-10-29）

- 工作目录：`D:\RMFOODFP`；环境：backend/venv（0.115.0）
- 目标：`food_materials.contraindications` 禁忌源回填（初始 55/142，剩余 87 行无本地真实源）
- 结论：**可回填 2 行（丁香、肉桂，源=经典《中国药典》十九畏），55→57/142**；剩余 **85 行阻塞**（无权威本地源，外部原文需授权/大文件下载）

---

## 1. 本地源再扫描结果

| 位置/源 | 内容 | 是否含《药典》/禁忌数据 |
|---|---|---|
| `backend/data` | chromadb*/models/synergy/herb_image_map.json | ❌ 无（synergy_coefficients.json 仅测试系数；models 仅模型） |
| `backend/app/services/ai/rag` | RAG 代码 + README | ❌ 无禁忌 JSON/常量 |
| `backend/app/services/knowledge_base.py` `HERB_KNOWLEDGE_BASE` | 52 味药食同源禁忌（已用作主源） | ✅ 已消耗（29→55） |
| `herb_food_herbs.restrictions` / `tcm_herbs.contraindications` | 卫健委目录/TCMSP 禁忌（已用作源2/源3） | ✅ 已消耗 |
| `backend/app/services/formula/compatibility_rules.py` | 50+ 化学/药理/营养/法规规则（成分对如"钙离子-草酸"） | ❌ 非药材级禁忌 |
| `backend/app/services/ai/safety/safety_knowledge_service.py` | `CONTRAINDICATIONS_18`/`CAUTIONS_19`/`FOOD_CLASHES` | ⚠️ 真实但**非经典**（含人参-莱菔子/三棱/皂荚等非经典对、重复项、食物相克=民间） |
| `data/literature.db` | 46302 条 herb-disease 论文（evidence） | ❌ 非禁忌 |
| `tcmsp_data/data/all_herbs.json` | 502 味 TCMSP 药材名录 | ❌ 仅名录，无禁忌字段 |
| RAG `rag_document_versions`/`document_extractions` | 已摄取文档 | ❌ 0 命中《药典》/《本草》/《禁忌》来源 |
| `data/official_food_homology.txt` | 药食同源 106 味清单 | ❌ 仅清单 |
| 仓库全文搜索（十八反/十九畏/妊娠禁忌/配伍禁忌） | — | 仅代码引用术语，无原文/数据文件 |

**结论**：仓库内无《中国药典》2020 /《中华本草》原文；无干净结构化禁忌源。唯一可推导的真实权威数据 = **经典《中国药典》十九畏**（权威配伍禁忌歌诀，`safety_knowledge_service.py` 亦载有其数据）。

### 经典《中国药典》十九畏 交叉核对（87 味剩余）
经典十九畏歌诀：硫磺-朴硝、水银-砒霜、狼毒-密陀僧、巴豆-牵牛、丁香-郁金、牙硝-三棱、川乌/草乌-犀角、人参-五灵脂、官桂(肉桂)-石脂(赤石脂)。

与 87 味剩余药食同源药材交叉：**十八反 0 命中；十九畏 2 命中**：
- **丁香** → 畏 郁金（"丁香莫与郁金见"）
- **肉桂** → 畏 赤石脂（"官桂善能调冷气，若逢石脂便相欺"；官桂=肉桂，石脂=赤石脂）

其余经典十九畏对涉及非药食同源药材（硫磺/朴硝/水银/砒霜/狼毒/密陀僧/巴豆/牵牛/牙硝/三棱/川乌/草乌/犀角/人参/五灵脂），不在 food_materials 范畴。

## 2. 外部源探测结论（只读）

- 网络**可达**（web_search 返回结果），但检索到的是**学术文章/科普**（十八反历史沿革、妊娠禁忌分析、中成药说明书禁忌调查、妊娠期中药用药禁忌科普），**无免费结构化《中国药典》禁忌数据集**。
- 国家药典委员会（ChP）《中国药典》官方文本：**PDF 大文件 + 版权/授权受限**（需付费或正式授权），非免费结构化数据。
- **结论**：无免费可下载的权威结构化《中国药典》禁忌源；获取原文需用户提供文件或授权联网下载（付费/大文件）。

## 3. 回填

### 3.1 决策（仅权威、可溯源、非编造）
- **回填**：丁香、肉桂（经典《中国药典》十九畏推导，权威、真实、可溯源）。
- **排除**：莱菔子（人参-莱菔子**非**经典十九畏，另类传统）、大蒜/蜂蜜（**食物相克**=民间/食品卫生 caution，非《中国药典》）——避免向临床禁忌字段传播低质/民间数据。

### 3.2 脚本（新，非破坏 only-fill，dry-run 默认）
- `backend/scripts/backfill_contraindications_pharmacopoeia.py`
  - 源：经典《中国药典》十九畏（`SHIJIWEI_CANONICAL_PAIRS`，仅药食同源适用对：丁香-郁金、肉桂-赤石脂）。
  - 推导：药材级 `["不宜与XX同用（《中国药典》十九畏）"]`。
  - 仅填空（`array_length(contraindications,1)` IS NULL 或 =0 才写，**绝不覆盖非空**）；幂等；`--apply` 才写库。
  - 使用 `async_session_factory`（可靠连接；原 `backfill_contraindications.py` 的 raw asyncpg 在本环境 `WinError 64` 连接失败，为其预存问题，未改动原脚本）。

### 3.3 实际回填
- `[before] 55/142`；`[APPLY] 回填 2 行`；`[APPLY] 实测 57/142`。
- 回填内容：
  - 丁香 → `["不宜与郁金同用（《中国药典》十九畏）"]`
  - 肉桂 → `["不宜与赤石脂同用（《中国药典》十九畏）"]`

## 4. 验证

| 断言 | 结果 |
|---|---|
| count 提升（55→57） | ✅ 实测 57/142 |
| 仅填空（不覆盖非空） | ✅ only-fill 逻辑；`if not cur` 才写 |
| 幂等（重跑无副作用） | ✅ 重跑 `--apply` → 回填 0 行，仍 57/142 |
| 回填值正确 | ✅ 丁香/肉桂 = 上述《药典》十九畏文本 |
| 无副作用（仅 2 行变化） | ✅ 计数 55→57 恰为 2 行 |
| py_compile | ✅ PY_COMPILE_OK |
| 源可溯源/非编造 | ✅ 经典《中国药典》十九畏（权威公开歌诀，safety_knowledge_service.py 亦载） |

## 5. 阻塞原因与后续

- **已回填**：2 行（丁香、肉桂，经典《中国药典》十九畏）。
- **剩余阻塞**：**85 行**（87−2）无权威本地源。
  - 本地：仓库无《中国药典》2020/《中华本草》原文；无干净结构化禁忌数据。
  - 外部：无免费结构化《中国药典》数据集；官方文本需授权/付费/大文件下载。
- **明确阻塞结论**：需用户提供《中国药典》2020 原文（或《中华本草》相应条目）**或授权联网下载**，方可继续回填剩余 85 行。禁止编造禁忌。

## 6. 遗留 / 建议

1. **剩余 85 行**：待用户提供《中国药典》2020 原文或授权下载后，用同源可溯源的 only-fill 脚本继续回填。
2. **safety_knowledge_service.py 的 18反/19畏/食物相克**数据质量待评估：含非经典对/重复/民间项，建议后续校正为经典十八反/十九畏（可溯源），避免用于权威禁忌字段。
3. 未改前端；未动运行进程；后端改动仅新增 1 个回填脚本（`backfill_contraindications_pharmacopoeia.py`）；未改原 `backfill_contraindications.py`。

## 附：临时诊断文件（诊断后清理）
- `backend/scripts/_probe_contra_state.py`、`_probe_contra_overlap.py`、`_probe_canonical.py`、`_probe_ragdocs.py`、`_probe_litdb.py`、`_probe_tcmsp.py`、`_verify_contra.py`
- `tmp_contra_overlap.txt`、`tmp_canonical.txt`、`tmp_ragdocs.txt`、`tmp_tcmsp.txt`、`tmp_dryrun.txt`、`tmp_apply.txt`、`tmp_apply2.txt`、`tmp_verify.txt`
