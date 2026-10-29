# RAG 禁忌补全（Step1：food_materials.contraindications）验证报告

- 处理日期：2026-10-28
- 执行角色：RMFOODFP 后端开发专家（dev-rag-backend2）
- 承接：`reports/rag-nonfunc-complete-verify.md`（contraindications 29/142 遗留项）

---

## 结论
**本地真实禁忌源已穷举并回填，contraindications 29 → 55/142（+26 行）**。
剩余 87 行在**所有本地真实源中均无禁忌数据**，需外部《中国药典》/《中华本草》原文源或用户提供数据文件（详见「缺口与建议」）。

---

## 一、本地可用禁忌源检索结果（只读穷举）

### 1.1 DB 全表/列扫描（public schema 全部 ~150 表）
| 源 | 字段 | 真实非空 | 用途判定 |
|:---|:---|:---:|:---|
| `knowledge_base.py` | `HERB_KNOWLEDGE_BASE.contraindication`（代码常量，52 味药） | 52/52 | ✅ **主源**（卫健委目录+典籍策展；孕妇慎用/脾胃虚寒者慎用等） |
| `herb_food_herbs` | `restrictions`（ARRAY，卫健委药食同源目录表） | 11 | ✅ 次源（山药:胃寒腹痛者忌用、乌梅:表邪未解者禁用、甘草:高血压/孕妇慎用等） |
| `tcm_herbs` | `contraindications`（text，TCMSP/典籍） | 11 | ⚠️ 弱源（与上述重叠，新增 0） |
| `tcm_herbs` | `toxicity`（text） | 11 | ❌ 毒性分级（无/小毒/有毒/大毒），非禁忌文 |
| `hf_enriched_herbs` | `restrictions`（ARRAY） | 6 | ❌ 仅「仅作为调味品使用」6 行，已在前轮入库 |
| `mmid_herbs` | `toxicity`（text） | 88 | ❌ 全为 `non-toxic`（布尔标志，非禁忌文） |
| `rmchm_herbs` | `is_toxic`（bool） | 726 | ❌ 布尔毒性标志，非禁忌文 |
| `cfam_herbs` | `usage_restriction`（text） | 0 | ❌ 空表 |
| `food_materials` | `toxicity_class` | 136 | ❌ 粗粒度（无毒/有毒），非禁忌文（前轮已有） |
| `HERB_DOSAGE_DATABASE` | `restrictions` | — | ✅ 已在既有 29 行应用（前轮） |

### 1.2 文件检索（backend/data、app/services/ai/data、conf）
- `backend/data/`：无命中。
- `app/services/ai/data/seed_templates.json`：仅电商营销模板，无禁忌数据。
- `conf/prompts/default.yaml`、`professional_formula_example.json`：命中均为 **prompt 模板/示例配方文案**
  （如 `ingredient-detail.notes`、禁忌人群 data-table），**非结构化每味药禁忌映射**，不作为回填源。

### 1.3 判定
- **可用真实源**：`HERB_KNOWLEDGE_BASE.contraindication`（52 味）> `herb_food_herbs.restrictions`（11）> `tcm_herbs.contraindications`（11）。
- **不可用**：所有毒性/安全标志字段（toxicity/is_toxic/toxicity_class）为等级或布尔，非禁忌陈述——不造数据，不采用。

---

## 二、回填实现（`backend/scripts/backfill_contraindications.py`，新增）

- **非破坏 + 幂等**：仅对 `array_length(contraindications,1) IS NULL OR =0` 的行回填（空数组在 PG 的
  `array_length('{}',1)` 返回 **NULL**，必须同时判 IS NULL 与 =0），**绝不覆盖非空值**；默认 `dry-run`，`--apply` 才写库。
- **源优先级**（首命中）：`HERB_KNOWLEDGE_BASE` → `herb_food_herbs` → `tcm_herbs`；禁忌文本按 `、，,；;/` 切分为数组（与既有 29 行格式一致）。
- 仅改 `food_materials.contraindications` + `updated_at`；不触碰前端。

### before/after（真实非空，`array_length>0`）
| 指标 | before | after | 说明 |
|:-----|:------:|:-----:|:-----|
| food_materials | 142 | 142 | 无增删 |
| **contraindications 非空** | **29/142** | **55/142** | **+26 行**（knowledge_base 20 + herb_food_herbs 6） |
| 仍缺 | 113 | **87** | 本地真实源无禁忌数据（诚实缺口） |

### 回填明细（26 行，来源分布）
- **knowledge_base（20）**：百合(风寒咳嗽者慎用)、薄荷(阴虚血燥者慎用)、甘草(湿盛胀满/水肿者慎用)、
  山楂(胃酸过多/孕妇慎用)、荷叶(气血虚弱者慎用)、黑芝麻(脾虚便溏者慎用)、红枣(湿盛中满/食积者慎用)、
  金银花(脾胃虚寒者慎用)、桔梗(阴虚久咳者慎用)、菊花(气虚胃寒/食少泄泻者慎用)、莲子(便秘者慎用)、
  麦冬(阴虚津伤者慎用)、马齿苋(脾胃虚寒者慎用)、蒲公英(脾胃虚寒者慎用)、桑叶(脾胃虚寒者慎用)、
  山药(胃酸过多/孕妇慎用)、桑椹(脾胃虚寒者慎用)、薏苡仁(**孕妇慎用**)、鱼腥草(虚寒者慎用)、玉米须(脾胃虚弱者慎用)。
- **herb_food_herbs（6）**：白扁豆(寒热往来者忌用)、白果(大便溏泄者慎用)、桃仁(**孕妇禁用**)、
  白芷(便溏者忌用)、白豆蔻(温燥伤阴)、乌梅(表邪未解者禁用)。

---

## 三、验收
| 项 | 结果 | 证据 |
|:--|:----:|:-----|
| dry-run before/after | ✅ | before 29/142 → 可回填 26 行 |
| `--apply` 后实测 | ✅ | contraindications **55/142**（+26） |
| `retrieve_herb_knowledge` 样本返回禁忌 | ✅ | 薏苡仁/金银花/山楂/山药/人参/甘草/枸杞子 **7/7** 含禁忌（如薏苡仁:孕妇慎用、金银花:脾胃虚寒者慎用） |
| 非破坏（不覆盖既有 29） | ✅ | 仅填空；既有 29 行未动 |
| 幂等 | ✅ | 仅填空；重复运行 0 变更 |

---

## 四、缺口与建议（剩余 87 行）
- **原因**：这 87 行主要源自 `hf_enriched_herbs`（官方 106+ 药食同源清单），该表无每味药禁忌原文；
  `tcm_herbs` 仅 11 行禁忌、`knowledge_base` 仅覆盖 52 味、`herb_food_herbs` 仅 11 行——**本地真实禁忌数据已尽用**。
- **建议（按可行性排序）**：
  1. **外部权威源**：导入《中国药典》（2020）或《中华本草》每味药「注意事项/禁忌」原文，需用户提供数据文件（json/csv，含 name_cn + contraindication 列），或联网授权抓取（如中医药数据库）。
  2. **复用现有提示词模板**：`conf/prompts/default.yaml` 的 `ingredient-detail.notes` 为示例配方级文案，非逐味药权威映射，不建议回填（避免以示例当权威）。
  3. 若仅需「安全提示」而非医学禁忌，可将 `toxicity_class`（无毒/有毒）与 `is_toxic` 映射为通用提示——**但属衍生数据，违反「不造禁忌数据」约束，本轮不采用**。

---

## 五、改动文件汇总
1. `backend/scripts/backfill_contraindications.py`（新增）— 非破坏禁忌回填（仅填空、幂等、dry-run 默认）。
2. （只读确认，未改）`app/services/knowledge_base.py`、`herb_food_herbs`、`tcm_herbs`、各数据文件——均为源，未改。

## 六、环境备注
- `backend/venv`（Py3.11.15）为实际环境；DB 操作：只读诊断 + 非破坏回填（仅填空、不覆盖）。
- 脚本 stderr 的 `SECRET_KEY 未设置`/Redis/遥测告警为既有环境噪声；`--apply` 已执行（符合任务授权，非破坏）。
- 禁忌源真实性：所有回填值均来自 `HERB_KNOWLEDGE_BASE`（卫健委目录+典籍）或 `herb_food_herbs`（卫健委目录表）的**原文**，未合成。
