# 食源活性多肽「品类级」数据集草案（带完整来源）

> 状态：**调研 + 数据集草案，待 Lead 审定**。本轮不写库、不改 schema、不 commit、不 kill 后端（PID 4328 @8000）。
> 作者：data-completer ｜ 日期：2026-11-09
> 铁律：**绝不伪造**。下表每条序列/活性/来源均有真实 PMID/DOI 可溯源；查不到确证来源的不入库（宁少勿滥）。

---

## 0. 需求方向修正（重要）
用户真实需求不是 5 条孤立序列肽（IPP/VPP，虽真实但覆盖太小），而是**作为食材/成分的多肽品类**——食品工业里的"大豆肽粉""胶原蛋白肽粉""豌豆肽"等真实成分。本草案按**品类级**组织，每类挂代表性**序列级**确证肽（带 PMID）。

---

## ① 逐品类调研结果（7 品类，均含代表性确证肽 + PMID）

| # | 品类(中/英) | 来源蛋白 | 代表性确证肽(序列) | 活性/功能(证据强度) | 真实来源(PMID/DOI) |
|---|---|---|---|---|---|
| 1 | **大豆肽** Soy peptide | 大豆蛋白 Glycine max | **Lunasin**（43AA，C端9个Asp，GenBank AAB71140） | 抗癌/降脂/抗氧化（体外+临床前，人体初步） | 10331812（Galvez & de Lumen 1999 克隆）; 19056440（Hernández-Ledesma 2009 综述）; 综述 [PMC9455814](https://pmc.ncbi.nlm.nih.gov/articles/PMC9455814/) Lunasin 43AA anticancer |
| 2 | **胶原三肽** Collagen tripeptide | 胶原蛋白 Collagen | **Gly-Pro-Hyp (GPH)** / **Pro-Hyp (PH)** / **Hyp-Gly (HG)** | 促胶原合成/皮肤/关节（临床前+人体摄入入血） | 31905705（Food-Derived Collagen Peptides, Pro-Hyp/Hyp-Gly 2020）; 品类综述 [PMC10538231](https://pmc.ncbi.nlm.nih.gov/articles/PMC10538231/)（牛/猪胶原 GPH 含量更高） |
| 3 | **牛骨胶原蛋白肽** Bovine bone collagen peptide | 牛骨胶原 Bovine bone collagen | 同胶原肽 **Pro-Hyp / Hyp-Gly / Gly-Pro-Hyp** | 关节/骨/皮肤（人体临床试验，系统性综述） | 31905705（同上）; 骨肌关节系统综述 PMID 28384173 / 38235711（Type I collagen hydrolysate） |
| 4 | **豌豆肽** Pea peptide | 豌豆蛋白 Pisum sativum | **YLVN**（ABTS IC50=0.002 mg/mL）/ **EEHLCFR**（DPPH IC50=0.027 mg/mL）/ **TFY** | 抗氧化（体外+细胞 LO2，Keap1-Nrf2 通路） | **37049715**（Zhao & Liu, Molecules 2023;28:2952, [PMC10096042](https://pmc.ncbi.nlm.nih.gov/articles/PMC10096042/)，3 条新肽 LC-MS/MS 确证） |
| 5 | **乳清肽** Whey peptide | 乳清蛋白（β-乳球蛋白/α-乳白蛋白） | **β-lactorphin (β-LG f142-148, Tyr-Leu-Leu-Phe-Gly-Val)** 等 lactokinins；IPP/VPP | 降压 ACE 抑制（体外+人体） | **10399349**（Lactokinins: whey protein-derived ACE inhibitory peptides, 2003）；IPP/VPP 见 17664851 |
| 6 | **蛋清肽** Egg white peptide | 蛋清蛋白 Gallus gallus | 蛋清水解抗氧化肽（Neutrase 水解物，序列见原文） | 抗氧化（体外） | [PMC4597870](https://pmc.ncbi.nlm.nih.gov/articles/PMC4597870/)（egg-white 水解抗氧化）；蛋清肽稳定性 [MDPI Foods 13:3148](https://www.mdpi.com/2304-8158/13/19/3148) |
| 7 | **鱼胶原蛋白肽** Fish/marine collagen peptide | 鱼皮/鳞胶原 Marine collagen | **Pro-Hyp / Hyp-Gly / Gly-Pro-Hyp**（鱼胶原同源） | 皮肤抗衰/促胶原（临床前+人体） | 31905705（含鱼胶原肽）; 海洋胶原 [PMID 38667776](https://pubmed.ncbi.nlm.nih.gov/38667776/)；[PMC12701666](https://pmc.ncbi.nlm.nih.gov/articles/PMC12701666/) 水解海洋胶原 |

> **诚实标注**：#1/2/3/4/5 证据**强**（序列级 PMID 确证）；#6 蛋清肽证据**中**（水解物级确证，具体序列需从原文 Table 抄录，暂无单一代表序列固化）；#7 鱼胶原肽与 #2/3 共享胶原肽序列（Pro-Hyp 等），序列级确证。**凡序列/活性/PMID 三者不能同时确证的（如蛋清肽具体序列）已标注需补，不硬凑。**

---

## ② 合法开源来源系统评估

| 来源 | 开放性 | 可编程访问 | 权威性 | 能否拿到上述品类数据 | 结论 |
|---|---|---|---|---|---|
| **PubMed/PMC (E-utilities)** | 完全开放 | ✅ esearch/efetch API，免费无 key（限流） | 极高（NIH） | ✅ 上述所有 PMID 均可溯源 | **主源，可用** |
| **USDA FoodData Central** | 公有领域 CC0 | ✅ REST API（需免费 data.gov key，1000 req/h） | 高（USDA） | ⚠️ **营养素级**（蛋白/氨基酸），**无单体肽序列/活性条目** | 仅用于品类"食材基质"营养背景，**不提供肽序列** |
| **BIOPEP-UWM** | 公开无需注册（[2025 status](https://sciforum.net/paper/28003)） | ⚠️ Web 工具为主，**API/批量导出有限**（实测 SSL/接口不稳） | 高（UWM，[PMID 31783634](https://pubmed.ncbi.nlm.nih.gov/31783634/)） | ✅ 食源肽分类齐全 | 参考/交叉核对源，**非批量管道** |
| **PepBank** | 开放获取（[PMID 17587461/10.1186/1471-2105-8-280](https://link.springer.com/article/10.1186/1471-2105-8-280)） | Web 检索/BLAST | 中（~19792 条，偏药物肽） | ⚠️ 药物肽为主，食源肽少 | 辅助，非主源 |
| **DFBP (cqudfbp.net)** | — | — | — | — | **已下线**（实测 502/SSL 死，前序确认） |

**结论**：本轮 7 品类数据**全部可从 PubMed/PMC 开放文献溯源**（已逐一给 PMID）。USDA FDC 只补"食材基质"营养背景不给肽；BIOPEP 可交叉核对但非批量；DFBP 死。→ **文献策划路径（P1）是唯一可辩护路径**，与既有方案一致。

---

## ③ 带来源的数据集草案（品类级 + 序列级两层）

### 品类级（食材成分，对应 food_materials 或独立"多肽成分"概念）
| 品类 | 来源蛋白 | 分子量分布 | 氨基酸特征 | 功能定位 | 来源 |
|---|---|---|---|---|---|
| 大豆肽 | 大豆蛋白 | 多为 <3kDa 寡肽 | 富 Glu/Leu/Asp；Lunasin 富 Asp | 降压/抗氧化/抗癌 | 19056440 |
| 胶原三肽 | 胶原蛋白 | 2-3AA(GPH/PH/HG) | 富 Gly/Pro/Hyp(羟脯氨酸) | 促胶原合成/皮肤关节 | 31905705; PMC10538231 |
| 牛骨胶原肽 | 牛骨胶原 | <3kDa 为主 | 富 Gly/Pro/Hyp | 关节/骨 | 31905705; 28384173 |
| 豌豆肽 | 豌豆蛋白 | <3kDa(PHH-I) | 富 Glu/Leu/Lys；YLVN/EEHLCFR/TFY | 抗氧化 | 37049715 |
| 乳清肽 | 乳清蛋白 | 2-10AA | 富 Trp/Tyr/Leu(疏水) | 降压 ACE 抑制 | 10399349 |
| 蛋清肽 | 蛋清蛋白 | 水解寡肽 | 富疏水/芳香 AA | 抗氧化 | PMC4597870 |
| 鱼胶原肽 | 鱼胶原 | <3kDa | 富 Gly/Pro/Hyp | 皮肤/抗衰 | 38667776 |

### 序列级（确证活性肽，对应 bioactive_peptides literature_confirmed）
见 ①表「代表性确证肽」列：Lunasin / Gly-Pro-Hyp / Pro-Hyp / Hyp-Gly / YLVN / EEHLCFR / TFY / β-lactorphin / IPP / VPP。**每条带 PMID，可作 literature_confirmed 行**。

---

## ④ 给 Lead 的入库方案建议

### 品类级 vs 序列级——两者共存映射
- **序列级**（具体肽如 Lunasin/YLVN/GPH）→ 落 **bioactive_peptides 表**，标 `provenance='literature_confirmed'`（复用路径1 的分层机制），挂 `food_material_id` 指向载体食材。
- **品类级**（大豆肽/胶原肽粉作为"成分/食材"）→ 这是**食材/成分概念**，不是单条肽。两个选项：
  - **选项 A（推荐）**：品类作为 **food_materials 中的"加工成分"行**（如"大豆肽粉""胶原蛋白肽粉"），序列级肽通过 `food_material_id` 挂到该品类行。符合"多肽是食材衍生物"模型。
  - **选项 B**：建独立 `peptide_categories` 表（品类名/来源蛋白/MW分布/功能/来源），`bioactive_peptides` 加 `category_id` FK。更规范但需改 schema。

### 与现有表/路径1 的关系
- 这些新品类肽 = **新增 `literature_confirmed` 行**（复用路径1 的 provenance 分层，不碰 7655 合成肽）。
- **不推翻路径1**：路径1 的 5 条（IPP/VPP 等）仍是合法 literature_confirmed；本草案是**扩充**（从 5 条→覆盖 7 品类 ~12 条确证肽）。
- **载体行缺口**：需新建 food_materials 行——大豆肽粉/胶原肽/豌豆肽/乳清肽/蛋清肽/鱼胶原肽（部分载体如大豆/玉米已有，胶原/豌豆/乳清需新建真实来源行）。

### 字段填充（bioactive_peptides）
- sequence=确证肽序列（三字母或单字母，如实）、source_protein=来源蛋白、activity_type=功能、activity_value/unit=IC50 等、literature_doi=DOI、provenance='literature_confirmed'、food_material_id=品类载体行。
- **品类级 MW 分布/氨基酸组成** bioactive_peptides 无对应列——若走选项 A 放 food_materials.description/active_ingredients；若选项 B 放 peptide_categories 表。

---

## ⑤ 诚实边界
- **蛋清肽**具体代表序列本轮未固化（水解物级确证，序列需抄原文 Table）——标注待补，不硬凑。
- **牛骨胶原肽**与胶原三肽共享序列（Pro-Hyp 等），非独立新序列，按"来源/加工不同"区分品类。
- 部分活性为**体外/临床前**（如豌豆肽 Keap1-Nrf2 为细胞实验），文档标证据强度，不宣称临床疗效。
- USDA FDC **无肽序列**，不能作为肽序列来源（仅营养背景）。
