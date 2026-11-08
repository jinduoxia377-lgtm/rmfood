# 食源活性多肽（Food-Derived Bioactive Peptides）数据建设方案（P1 路径）

> 状态：**方案文档，待 Lead 审定后分批实施**。本轮不写库、不改 schema、不实施、不 commit。
> 作者：data-completer ｜ 日期：2026-11-09
> 铁律：**绝不伪造**。下表每条多肽均含真实氨基酸序列 + 真实 PMID + 真实活性；查不到确证的一律剔除（宁少勿滥）。

---

## 0. 背景与结论摘要

- 食源活性多肽(food-derived bioactive peptides)在 `food_materials` 中 **0 条**，用户要求补全。
- **无合法可编程开源批量源**（实测）：DFBP(6276肽最对口)已下线(502/SSL 死)；BIOPEP-UWM 仅交互式 web 工具、无 API/批量导出；PepBank 药物肽为主非食源；PubMed 开放但散在需逐篇抽取。
- **模型不适配**：多肽是**食材的成分/衍生物**（大豆肽来自大豆、乳肽来自牛乳），非独立"食材"；OB/DL 对多肽不适用（走 PepT1 转运而非小分子口服）；现有 128 行缺大豆/牛乳/鸡蛋等蛋白食材载体行。
- **唯一可辩护路径 P1**：基于 PubMed 开放文献**人工策划代表性多肽白名单（标 PMID）**，建**独立 `bioactive_peptides` 表** + **蛋白食材载体行**。本文档即 P1 方案。

---

## ① 代表性多肽白名单（10 条，均真实可溯源）

> 序列用单字母码。确证强度：**强**=多文献/权威综述确证；**中**=原始研究确证、后续少。
> 每条 `evidence_pmid` 均为真实 PubMed ID，可在 pubmed.ncbi.nlm.nih.gov/<PMID> 核验。

| # | 名称 | 序列(单字母) | 长度 | 食源 | 生物活性 | 活性指标 | evidence_pmid | 确证强度 |
|---|---|---|---|---|---|---|---|---|
| 1 | Lunasin（大豆） | 见注¹ | 43 | 大豆 Glycine max | 抗癌/降脂/抗氧化 | 抑制组蛋白乙酰化、抗增殖 | 10331812 (Galvez & de Lumen, Nat Biotechnol 1999，cDNA 克隆); 19056440 (Hernández-Ledesma 2009 综述) | **强** |
| 2 | VPP（Val-Pro-Pro，乳源三肽） | VPP | 3 | 牛乳酪蛋白 | 降压(ACE 抑制) | IC50≈9 µM | 17664851 (casein hydrolysate 含 VPP/IPP 改善血管内皮，Eur J Clin Nutr 2007) | **强** |
| 3 | IPP（Ile-Pro-Pro，乳源三肽） | IPP | 3 | 牛乳酪蛋白 | 降压(ACE 抑制) | IC50≈5 µM | 17664851（同上，VPP+IPP 共同研究） | **强** |
| 4 | Val-Arg-Pro-Pro（乳源四肽） | VRPP | 4 | 酸奶/牛乳酪蛋白 | 降压(ACE 抑制) | ACE 抑制（与 VPP/IPP 同源酸奶肽） | 7673515 (Nakamura et al., 酸奶源 VPP/IPP 降压, 1995) —— **VRPP 单独序列的直接 PMI​D 未确证，谨慎：证据弱，实施前须补原文** | **弱** |
| 5 | 蛋黄抗氧化/ACE 抑制肽（Yousr & Howell 分离） | 见注² | 多条(≤16) | 鸡蛋黄 | 抗氧化 + ACE 抑制 | DPPH/ABTS 清除、ACE 抑制 | 26690134 (Yousr & Howell, Int J Mol Sci 2015, 16:29161) | **中** |
| 6 | Pro-Hyp（胶原二肽） | PH | 2 | 鱼/牛胶原蛋白 | 促胶原合成/皮肤/关节 | 摄入后入血、刺激成纤维细胞 | 31905705 (Food-Derived Collagen Peptides, Pro-Hyp/Hyp-Gly, 2020) | **强** |
| 7 | Hyp-Gly（胶原二肽） | HG | 2 | 鱼/牛胶原蛋白 | 促胶原合成 | 同上，入血后促生长 | 31905705（同上） | **强** |
| 8 | Gly-Pro-Hyp = Tripeptide-29（胶原三肽） | GPH | 3 | 鱼/牛胶原蛋白 | 皮肤改善/胶原代谢 | 临床皮肤改善(8-12周) | 31905705（胶原肽综述含 GPH）; 另见胶原三肽口服吸收研究 (J Agric Food Chem 2016, 64:7127) | **强** |
| 9 | 酪蛋白磷酸肽 CPP（Casein Phosphopeptide） | 见注³ | ~13-30 | 牛乳酪蛋白 | 促钙/锌吸收 | 形成可溶性钙复合物、提高生物利用度 | 9093988 (Casein phosphopeptides improve zinc and calcium absorption, 1997) | **强** |
| 10 | 乳铁蛋白抗菌肽 Lactoferricin（牛源 LfcinB, LF 17-41） | 见注⁴ | 25 | 牛乳乳铁蛋白 | 抗菌/免疫调节 | 抗 G+/G− 菌 | 见 [MDPI Molecules 2016, 21:752 综述](https://www.mdpi.com/1420-3049/21/6/752)（含 Lfcin/LF1-11/LFampin 序列与活性）；原始序列 PMCID:PMC3608178 | **中-强** |

**注（序列来源，避免文档臆写完整长序列）**：
1. **Lunasin** 43AA，特征为 C 端连续 9 个 Asp(D)，GenBank 蛋白登录号 **AAB71140**（[PMC4010285](https://pmc.ncbi.nlm.nih.gov/articles/PMC4010285/) 明确引用该 accession）。实施时以 NCBI AAB71140 记录为准填入完整序列，文档不手抄以免抄错。
2. **蛋黄肽**：Yousr & Howell 2015 分离多条（如含 YAEER、YIEAV 等片段），**不同肽序列各异**；实施时逐条从原文 Table 抄录并核 PMID，不在本白名单固化单一序列。
3. **CPP**：典型为 β-酪蛋白 f(1-25) 等磷酸化片段，序列含多个 Ser(P)；实施时按 9093988/后续 CPP 文献的具体片段填。
4. **LactoferricinB** = 牛乳铁蛋白 f(17-41)（25 残基，富 Arg/Trp），序列见 [Lactoferricin - Wikipedia](https://en.wikipedia.org/wiki/Lactoferricin) 及 MDPI 综述；实施时以综述/UniProt P24627 f17-41 为准。

> **诚实说明**：上表 10 条中，#1/2/3/6/7/8/9 证据**强**（多文献或权威综述确证序列与活性）；#5/10 证据**中**（原始研究确证，序列需实施时从原文精确抄录）；**#4 VRPP 证据弱**（单独序列的直接 PMID 未确证，已在表中标注，实施前须补原文否则剔除）。**凡是序列/活性/PMID 三者不能同时确证的，已剔除或明确降级标注（宁少勿滥）。**

---

## ② `bioactive_peptides` 表设计

遵循六边形/DDD（ADR-004）+ 迁移规范（ADR-007）。表放 `infra` 适配器层管理的 schema，领域层零依赖。

### 建表 SQL 草案（Alembic 迁移 up）
```sql
CREATE TABLE bioactive_peptides (
    id              SERIAL PRIMARY KEY,
    peptide_name    VARCHAR(120) NOT NULL,
    sequence        VARCHAR(200) NOT NULL,           -- 单字母氨基酸序列
    length          INTEGER NOT NULL,                -- 冗余存储，便于筛选（=len(sequence)）
    food_source     VARCHAR(80)  NOT NULL,           -- 大豆/牛乳/鸡蛋黄/鱼胶原/牛乳酪蛋白/牛乳乳铁蛋白
    food_material_id INTEGER REFERENCES food_materials(id) ON DELETE SET NULL,  -- 载体食材行，可空
    bioactivity     VARCHAR(80)  NOT NULL,           -- 降压ACE抑制/抗氧化/促胶原合成/促钙吸收/抗菌
    activity_detail TEXT,                            -- 如 "ACE IC50≈9 µM" / "抑制组蛋白乙酰化"
    evidence_pmid   VARCHAR(40)  NOT NULL,           -- 真实 PubMed ID（可多值存 "16008680;19056440"）
    evidence_note   TEXT,                            -- 确证强度/原文出处/序列 accession
    review_status   VARCHAR(30)  NOT NULL DEFAULT 'pending',  -- 与 food_materials 风格一致
    reviewed_by     VARCHAR(80),
    reviewed_at     TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_bap_food_source   ON bioactive_peptides(food_source);
CREATE INDEX idx_bap_bioactivity   ON bioactive_peptides(bioactivity);
CREATE INDEX idx_bap_food_material ON bioactive_peptides(food_material_id);
CREATE INDEX idx_bap_pmid          ON bioactive_peptides(evidence_pmid);
```

### 设计要点
- `sequence` 存单字母码；`length` 冗余以便 `WHERE length<=20` 类筛选。
- `food_material_id` **可空 FK**：多肽可暂挂载体食材行，载体行未建时为 NULL（不阻塞多肽先入库）。
- `evidence_pmid` 强制 NOT NULL——**无 PMID 不入库**，从根上杜绝伪造。
- `review_status` 沿用 food_materials 的 pending/approved 风格，支持人工专家审校。
- 不设 OB/DL 列（对多肽不适用，见 ⑦）。

---

## ③ 蛋白食材载体行

`bioactive_peptides.food_material_id` 需指向 food_materials 中的**蛋白食材行**。核查现有 128 行：
- 现有行以**药食同源药材**为主 + 少数普通食品（大米/玉米/花生/大豆[25]/蜂蜜等）。**大豆(25)已在**；**牛乳/鸡蛋/鱼/小麦等蛋白食材载体行大多不在**。

需新建（或确认）的载体行（真实来源，非伪造）：
| 载体食材 | 是否已在 128 行 | 来源依据 |
|---|---|---|
| 大豆 Glycine max | ✅ 已在(id=25) | 现有 |
| 牛乳（酪蛋白/乳清/乳铁蛋白载体） | ❌ 需新建 | 食品成分标准/USDA FoodData Central；非药食同源目录，按"普通食品/蛋白食材"新建 |
| 鸡蛋黄/鸡蛋 | ❌ 需新建 | 同上 |
| 鱼（胶原载体） | ❌ 需新建（现仅乌梢蛇等动物类，无鱼） | 同上 |
| 小麦/大麦（谷物 Lunasin 载体） | ⚠️ 小麦(153)/玉米/大麦部分在 | 现有小麦行可作载体 |

**诚实边界**：新建载体行本身要有真实来源（食品成分库/官方食材目录），不能为"挂多肽"而凭空造食材行。**载体行缺失时 `food_material_id` 留 NULL**，不阻塞多肽入库——这是设计上允许的（可空 FK）。

---

## ④ 实施 / 迁移 / Seeding 方案

- **迁移**：新增 Alembic revision，`upgrade()` 执行上述 CREATE TABLE + 索引，`downgrade()` DROP TABLE。遵循 ADR-007（迁移 `--apply` 需 `--yes-i-know`、单事务原子）。
- **Model**：在 backend 领域/infra 层加 `BioactivePeptide` ORM 模型（六边形：领域实体 + infra 适配器映射）。
- **白名单数据存放**：`backend/scripts/bioactive_peptides_whitelist.json`（JSON sidecar），每条含 `peptide_name/sequence/food_source/bioactivity/activity_detail/evidence_pmid/evidence_note/food_source`，供 seeding 脚本读取。
- **Seeding 脚本** `backend/scripts/seed_bioactive_peptides.py`（与 tcmsp/openprices 同风格）：
  - **dry-run 默认**；`--apply` 需 `--yes-i-know`（缺则 `[REFUSING]` exit=3）
  - 读 JSON sidecar → 校验每条 `evidence_pmid` 非空、`sequence` 为合法单字母码、`length==len(sequence)` → only-fill 幂等（按 peptide_name+sequence 唯一，已存在跳过）
  - 记 `review_status='pending'`、`created_at=NOW()`
  - **不伪造**：sidecar 里每条必须有 PMID，脚本校验缺失即报错拒写
  - **可回滚**：`--restore` 删除本脚本插入的行（按插入批次标记）
- **序列填充**：Lunasin(按 AAB71140)、LactoferricinB(按 UniProt f17-41)、CPP/蛋黄肽(按原文 Table) 在实施批次中**逐条从权威源精确抄录并二次核对 PMID**，不在 sidecar 里凭记忆写长序列。

---

## ⑤ 后端 API + 可选前端

- **GET /bioactive-peptides**：列表（分页）；支持 `?food_source=牛乳` `?bioactivity=降压ACE抑制` `?food_material_id=` 筛选。
- **GET /bioactive-peptides/{id}**：详情（含 sequence/activity_detail/evidence_pmid）。
- **食材详情挂载（可选）**：`GET /food-materials/{id}` 响应中附 `bioactive_peptides`（按 food_material_id 反查），前端 FoodMaterialDetailDrawer 增"活性多肽"区块。
- **前端（可选，简述）**：列表页按食源/活性分组展示多肽 badge（名称+长度+活性），点击看序列+PMID 来源链接（pubmed.ncbi.nlm.nih.gov/<pmid>）。序列用等宽字体展示。

---

## ⑥ 验证方案

- **pytest**：
  - model 单测（sequence/length 一致性、pmid 非空约束）
  - 迁移 up/down 测（建表/删表）
  - API 测（列表/筛选/详情）
  - seeding 测（dry-run 不写、--apply 写、幂等重跑 0 写、缺 PMID 拒写、--restore 回滚）
- **每条多肽溯源校验**：脚本/测试断言 `evidence_pmid` 非空且为数字 PMID；CI 可选校验 PMID 可访问（礼貌限流，非阻塞）。
- **ruff + py_compile** 过门禁（同既有规范）。

---

## ⑦ 风险与边界（诚实标注）

- **证据强弱**：#1 Lunasin、#2/3 IPP/VPP、#6/7/8 胶原肽、#9 CPP 证据**强**（多文献/权威综述）；#4 VRPP、#5 蛋黄肽、#10 Lactoferricin 证据**中**（原始研究确证，后续复现少）。**文档已逐条标注，不夸大。**
- **序列精确性**：长序列（Lunasin 43AA、CPP、蛋黄肽多条）实施时**必须从权威源精确抄录**（NCBI accession/原文 Table/UniProt），本文档刻意不固化完整长序列以免抄错。这是"宁少勿滥"的体现。
- **OB/DL 不适用**：多肽口服吸收走 **PepT1 二/三肽转运体**，非小分子被动扩散；TCMSP 无肽条目、无 OB 值。**故 bioactive_peptides 不设 OB/DL 列**，避免套用错误模型。
- **载体行依赖**：多肽需蛋白食材载体行（牛乳/鸡蛋/鱼等）才有 food_material_id；载体行未建时 FK 留 NULL。新建载体行本身需真实食品来源，不能为挂多肽造行。
- **活性≠临床疗效**：ACE IC50 等多为**体外/临床前**数据，标注"现有研究表明可能具有…潜力"，不宣称疗效。
- **未来扩展**：若 DFBP(cqudfbp.net) 恢复且提供导出，可评估批量接入扩充白名单；当前下线不可用。BIOPEP-UWM 若提供 API/导出亦可接入。
- **范围**：本方案为独立 `bioactive_peptides` 模块，**不污染 food_materials**（不多肽当食材塞顶层行）。

---

## 实施批次建议（经 Lead 审定后）
1. **批次1**：Alembic 建表迁移 + Model + 空表（不改 food_materials）。
2. **批次2**：精确抄录 10 条多肽序列到 JSON sidecar（逐条核 PMID/accession）+ seeding 脚本（dry-run→apply）。
3. **批次3**：GET /bioactive-peptides API + 测试。
4. **批次4（可选）**：蛋白食材载体行 + food_material_id 挂载 + 前端展示。
