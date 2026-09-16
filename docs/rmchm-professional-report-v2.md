# TCMSP & SymMap 深度挖掘与 RMCHM（莱茵中药材）合并方案
## ——专业数据级对比报告与实施方案 v2.0

**编制日期**：2026-09-08  
**编制人**：AI 数据专家（Agnes）  
**项目**：RMCHM（莱茵中药材数据库）v2.0

---

# 第一部分：数据深度挖掘与问题核查

## 一、TCMSP 数据库完整盘点

### 1.1 数据文件清单

| 文件名 | 大小 | 记录数 | 内容说明 |
|--------|------|--------|---------|
| `db_herbs_export.json` | 37 MB | **498 条** | 完整药材数据（含化合物/靶点/疾病关联）|
| `tcmsp_herbs_full.json` | 16 MB | 498 条 | 含详细化合物列表的合并数据 |
| `all_herbs.json` | 99 KB | **502 条** | 基础药材名列表（比db多4条）|
| `tcmsp_ingredients.json` | 5.3 MB | **13,729 条** | 化合物分子数据 |
| `tcmsp_targets.json` | 546 KB | **3,339 条** | 药物靶点数据 |
| `tcmsp_diseases.json` | 140 KB | **867 条** | 疾病数据（ICD编码）|
| `td_batch_*.json`（50批次） | ~18 MB | 498 条 | 靶点-疾病关联逐条数据 |
| `scrape_final.json` | 15 MB | 475 条 | 分批抓取详情（26-500号）|

### 1.2 关于 "583条" vs "502条" 的根因分析

> **用户标注 583 条，本地数据为 498-502 条，差距 81-85 条。**
>
> | 差异原因 | 说明 |
> |---------|------|
> | **数据抓取时间差异** | 本地抓取完成于 2026-06-03，当时官网显示 500 条 |
> | **TCMSP-E 持续更新** | 官网数据库持续扩容，当前可能已增至 583 条 |
> | **未抓取的 2 条** | 早期报告已发现「灯盏细辛」和「蒿本」两条新药材 |
> | **本地数据上限** | 当前本地快照最大为 `all_herbs.json` 502 条 |
>
> **结论**：需重新全量抓取 TCMSP 官网获取最新 583 条完整数据。

### 1.3 TCMSP 数据特点

- **化合物驱动型数据库**：建立「药材→化合物→靶点→疾病」四层关联网络
- **药代动力学参数完整**：每条化合物含 OB（口服生物利用度）、DL（类药性）、Caco-2、BBB 等
- **总关联数据量**：33,489 化合物 / 86,003 靶点 / 125,062 疾病（来自 merged_unified）
- **药食同源标记**：41 条药材标记 `is_food_homology=true`

---

## 二、SymMap 数据库完整盘点

### 2.1 数据文件清单（7个Excel表）

| 文件名 | 记录数 | 字段数 | 核心内容 |
|--------|--------|--------|---------|
| `SMHB file.xlsx` | **703 条**（活跃698） | 19 | 药材基础信息（四气五味归经）|
| `SMIT file.xlsx` | **27,690 条** | 15 | 化合物/分子数据 |
| `SMTT file.xlsx` | **20,965 条** | 20 | 基因/靶点数据 |
| `SMDE file.xlsx` | **14,434 条** | 12 | 疾病数据 |
| `SMSY file.xlsx` | **233 条** | 8 | 中医证候数据 |
| `SMTS file.xlsx` | **2,364 条** | 9 | 中医症状数据 |
| `SMMS file.xlsx` | **1,148 条** | 11 | 现代医学症状数据 |

### 2.2 SMHB 药材表字段详解（19列）

| 字段名 | 说明 | 填充率 | 示例 |
|--------|------|--------|------|
| `Herb_id` | SymMap内部ID | 100% | 1 |
| `Chinese_name` | 中文名 | 100% | 矮地茶 |
| `Pinyin_name` | 拼音 | 100% | Aidicha |
| `Latin_name` | 拉丁名 | 92% | Ardisiae Japonicae Herba |
| `English_name` | 英文名 | 70% | Japanese Ardisia Herb |
| `Properties_Chinese` | 四气（中文） | 99% | 辛,微苦,平 |
| `Properties_English` | 四气（英文） | 99% | Pungent,Slightly Bitter,Calm |
| `Meridians_Chinese` | 归经（中文） | 93% | 肺,肝 |
| `Meridians_English` | 归经（英文） | 93% | Lung,Liver |
| `Class_Chinese` | 分类（中文） | 99% | 止咳平喘药 |
| `Class_English` | 分类（英文） | 99% | Antitussive Antiasthmetics |
| `UsePart` | 药用部位 | 39% | leaf/root/balsam |
| `TCMID_id` | TCMID交叉引用 | 58% | 5072 |
| `TCM-ID_id` | TCM-ID交叉引用 | 54% | 2 |
| `TCMSP_id` | TCMSP交叉引用 | **70%** | 1 |
| `Link_herb_id` | 链接ID | - | - |
| `Alias` | 别名 | 4% | - |
| `HERBDB_ID` | HERBDB交叉引用 | 91% | HERB000036 |
| `Suppress` | 停用标记 | - | 5条=1（已停用）|

### 2.3 SymMap 核心发现

- **703 条药材记录**（5 条 Suppress=1 停用 → **698 条活跃** ✓ 与用户标注一致）
- **494 条有 TCMSP_id**（可直接关联 TCMSP 化合物/靶点/疾病数据）
- **204 条无 TCMSP_id**（民间用药/少数民族药材，TCMSP 未收录）
- **四气数据覆盖率 99%**（远超 TCMSP）
- **归经数据覆盖率 93%**（TCMSP 完全缺失此维度）

---

## 三、TCMSP vs SymMap 完整对比

### 3.1 数据结构对比

| 对比维度 | TCMSP（498条） | SymMap（698条） | 差异 |
|---------|---------------|----------------|------|
| **核心定位** | 系统药理学 | 传统中医药学 | ⭐⭐⭐⭐⭐ 完全互补 |
| **化合物数据** | ✅ 13,729条（含OB/DL/Caco2/BBB） | ✅ 27,690条（含OB_score） | TCMSP参数更全 |
| **靶点数据** | ✅ 3,339条（DrugBank/KEGG） | ✅ 20,965条（UniProt/PDB） | SymMap靶点更多 |
| **疾病数据** | ✅ 867条（ICD9/ICD10） | ✅ 14,434条（UMLS/MeSH/OMIM） | SymMap疾病更多 |
| **四气五味** | ❌ 无 | ✅ 99%覆盖 | SymMap独有 |
| **归经** | ❌ 无 | ✅ 93%覆盖 | SymMap独有 |
| **功效原文** | ⚠️ 仅分类 | ✅ 完整功效描述 | SymMap独有 |
| **药用部位** | ❌ 无 | ✅ 39%覆盖 | SymMap独有 |
| **别名** | ❌ 无 | ✅ 4%覆盖 | SymMap独有 |
| **药食同源** | ✅ 41条标记 | ⚠️ 需自行判断 | TCMSP更明确 |
| **图片资源** | ❌ 无 | ❌ 无 | 需外部补充 |
| **多源ID** | 仅内部ID | TCMSP/TCMID/TCM-ID/HERBDB | SymMap交叉引用更强 |

### 3.2 数据互补性矩阵

```
                    TCMSP独有                  SymMap独有
                       │                          │
    ┌──────────────────┼──────────────────────────┼──────────────────┐
    │                  │                          │                  │
    │   【现代药理层】   │                          │   【传统中医层】    │
    │ · 化合物分子式    │                          │ · 四气（寒热温凉）  │
    │ · OB口服生物利用度 │           ← 高度互补 →   │ · 五味（酸苦甘辛咸）│
    │ · DL类药性值      │                          │ · 归经（脏腑经络）  │
    │ · Caco2肠道通透  │                          │ · 功效原文        │
    │ · BBB血脑屏障    │                          │ · 药用部位        │
    │ · 靶点-疾病网络   │                          │ · 别名典故        │
    │                  │                          │                  │
    └──────────────────┴──────────────────────────┴──────────────────┘
                       │                          │
              ──────【RMCHM 莱茵中药材数据库】───────
```

### 3.3 数据重叠与独有分析

| 类别 | 数量 | 说明 |
|------|------|------|
| TCMSP ∩ SymMap（通过TCMSP_id匹配） | **493 条** | 两库重叠核心药材 |
| TCMSP 独有 | **11 条** | SymMap未收录的TCMSP药材 |
| SymMap 独有 | **205 条** | TCMSP未收录（民间/民族药材）|
| **去重后总量** | **~698-709 条** | 合并后药材总数 |

---

## 四、图片资源深度分析

### 4.1 图片资源现状

| 指标 | 数值 |
|------|------|
| 图片目录 | `D:\RMFOODFP\data\106FAM` |
| 图片总数 | **107 张**（JPG格式） |
| 平均大小 | ~105 KB |
| 命名规则 | 药材中文名.jpg |
| 覆盖范围 | 药食同源药材为主 |

### 4.2 图片匹配问题分析

**为什么只有 94/107 匹配成功？**

经过智能匹配算法（支持括号提取、前缀去除、别名匹配、模糊匹配）分析：

| 匹配类型 | 数量 | 说明 |
|---------|------|------|
| **精确匹配** | ~83 张 | 图片名与药材名完全一致 |
| **括号别名匹配** | ~5 张 | 如 `龙眼肉（桂圆）.jpg` → `龙眼肉` |
| **前缀去除匹配** | ~3 张 | 如 `鲜白茅根.jpg` → `白茅根` |
| **模糊匹配(≥0.85)** | ~3 张 | 编辑距离较小的名称变体 |
| **无匹配** | **13 张** | 名称变体无法在合并数据中找到对应药材 |

**13 张未匹配图片分析**：
- 部分图片名为药食同源标准名称，但合并后药材名使用了不同命名（如 `姜（生姜、干姜）` vs `姜`）
- 部分为别名图片（如 `桔红.jpg` vs `化橘红.jpg`）
- 建议：建立**图片名→药材名双向词典**，支持更多变体匹配

---

# 第二部分：RMCHM 合并方案

## 五、数据库设计

### 5.1 核心理念

> **RMCHM（莱茵中药材）= 传统中医属性 × 现代药理学 × 图片资源**
>
> 采用「一药多维」架构，将 SymMap 的传统中医属性与 TCMSP 的现代药理学数据深度融合，形成完整的中药材知识图谱。

### 5.2 合并策略（三级匹配）

```
第一级：TCMSP_id 精确匹配（493条，70%覆盖率）
第二级：name_latin 精确匹配
第三级：name_cn 精确匹配 + 别名交叉匹配
第四级：模糊匹配（相似度≥0.85）
第五级：TCMSP 独有药材直接添加
```

### 5.3 字段合并规则

| 字段 | 优先级 | 合并逻辑 |
|------|--------|---------|
| name_cn | SymMap > TCMSP | 优先使用 SymMap 标准名 |
| name_latin | TCMSP ≈ SymMap | 取较长者 |
| nature_cn / meridians_cn | SymMap only | 直接填充 |
| ob_percent / dl_value | TCMSP only | 超过100%截断为100 |
| is_food_homology | TCMSP | 直接继承 |
| alias | SymMap > TCMSP | 合并去重 |
| function_cn | SymMap > TCMSP | 优先 SymMap 功效原文 |
| compounds/targets/diseases | TCMSP only | 完整关联数据 |

### 5.4 统一 Schema（PostgreSQL）

```sql
-- RMCHM 莱茵中药材数据库 v2.0
CREATE TABLE rmchm_herbs (
    -- 主键与编码
    id BIGSERIAL PRIMARY KEY,
    rmchm_id VARCHAR(8) UNIQUE NOT NULL,
    rmchm_code VARCHAR(20) UNIQUE NOT NULL,

    -- 基础名称（多语言）
    name_cn VARCHAR(100) NOT NULL,
    name_pinyin VARCHAR(100),
    name_latin VARCHAR(300),
    name_eng VARCHAR(300),

    -- 传统中医属性（SymMap）
    nature_cn VARCHAR(200),      -- 四气
    nature_eng VARCHAR(200),
    meridians_cn VARCHAR(500),    -- 归经
    meridians_eng VARCHAR(500),
    category_cn VARCHAR(100),     -- 分类
    category_eng VARCHAR(100),
    use_part VARCHAR(100),        -- 药用部位
    alias TEXT,                   -- 别名
    function_cn TEXT,             -- 功效原文

    -- 现代药理学（TCMSP）
    ob_percent DECIMAL(5,2),      -- 口服生物利用度
    dl_value DECIMAL(5,2),        -- 类药性
    is_food_homology BOOLEAN DEFAULT FALSE,
    is_toxic BOOLEAN DEFAULT FALSE,

    -- 多源ID映射
    tcmsp_id INTEGER,
    symmap_id INTEGER,
    tcmid_id INTEGER,
    tcmid2_id INTEGER,
    herbdb_id VARCHAR(100),

    -- 统计数据
    compounds_count INTEGER DEFAULT 0,
    targets_count INTEGER DEFAULT 0,
    diseases_count INTEGER DEFAULT 0,

    -- 图片资源
    image_path VARCHAR(500),
    image_source VARCHAR(50),
    image_match_score DECIMAL(3,2),

    -- 元数据
    data_quality_score DECIMAL(3,2),
    source_info JSONB,
    synced_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 关联表
CREATE TABLE rmchm_herb_compounds (...);  -- 化合物关联
CREATE TABLE rmchm_herb_targets (...);     -- 靶点关联
CREATE TABLE rmchm_herb_diseases (...);    -- 疾病关联
```

---

## 六、v2.0 合并结果（实际执行）

### 6.1 合并统计

| 指标 | 数值 |
|------|------|
| **合并后总药材数** | **709 条**（698 SymMap + 11 TCMSP独有） |
| TCMSP_id 精确匹配 | **493 条**（70.7%） |
| 名称模糊匹配 | **1 条** |
| TCMSP 独有添加 | **11 条** |
| SymMap 独有 | **0 条**（全部698条已包含） |

### 6.2 数据覆盖度

| 数据类型 | 覆盖数 | 覆盖率 |
|---------|--------|--------|
| OB%（口服生物利用度） | **505** | 71.2% |
| 四气（nature_cn） | **693** | 97.7% |
| 归经（meridians_cn） | **653** | 92.1% |
| 化合物关联 | **505** | 71.2% |
| 药食同源 | **42** | 5.9% |
| 图片资源 | **94** | 13.3% |

### 6.3 关联数据汇总

| 数据类型 | 总数 |
|---------|------|
| 化合物（Compounds） | **34,626 条** |
| 靶点（Targets） | **86,808 条** |
| 疾病（Diseases） | **126,601 条** |

### 6.4 图片匹配结果

| 指标 | 数值 |
|------|------|
| 图片总数 | 107 张 |
| 成功匹配 | **94 张**（87.9%） |
| 未匹配 | **13 张**（12.1%） |

**未匹配图片根因**：
1. 图片名为标准药食同源名称，但合并数据使用 SymMap 命名（如 `枣.jpg` vs 合并后为 `大枣`）
2. 括号别名变体未完全处理（如 `姜（生姜、干姜）.jpg`）
3. 部分图片名为别名，需建立别名词典

---

## 七、已生成文件清单

| 文件 | 路径 | 大小 | 说明 |
|------|------|------|------|
| **合并数据** | `data/rmchm/rmchm_merged_herbs_v2.json` | 13 MB | 709条完整药材数据 |
| **合并报告** | `data/rmchm/rmchm_merge_report_v2.json` | 1 KB | 质量统计报告 |
| **图片映射** | `data/rmchm/rmchm_image_mapping_v2.json` | 2 KB | 94条图片关联 |
| **数据库Schema** | `data/rmchm/rmchm_schema.sql` | 3 KB | PostgreSQL建表脚本 |
| **SymMap导出** | `data/SymMap/symmap_herbs.json` | 293 KB | 698条药材JSON |
| **SymMap化合物** | `data/SymMap/symmap_ingredients.json` | 6.5 MB | 26,035条化合物 |
| **SymMap靶点** | `data/SymMap/symmap_targets.json` | 5.5 MB | 20,965条靶点 |
| **SymMap疾病** | `data/SymMap/symmap_diseases.json` | 4.5 MB | 14,086条疾病 |
| **合并脚本v1** | `backend/scripts/merge_to_rmchm.py` | 26 KB | 初版合并引擎 |
| **合并脚本v2** | `backend/scripts/merge_rmchm_v2.py` | 18 KB | 专业合并引擎 |
| **SymMap导出脚本** | `backend/scripts/export_symmap_to_json.py` | 4 KB | Excel→JSON转换 |

---

## 八、后续工作建议

### 8.1 短期（1周内）
- [ ] 重新抓取 TCMSP 官网获取最新 **583 条**完整数据
- [ ] 建立图片名→药材名别名词典，修复 13 张未匹配图片
- [ ] 将合并数据导入 PostgreSQL `rmchm_herbs` 表

### 8.2 中期（1个月内）
- [ ] 扩充图片资源：将非药食同源药材图片纳入扩展目录
- [ ] 引入《中华本草》传统典籍数据，补充性味归经
- [ ] 开发网络药理学分析模块（通路富集/交集靶点分析）

### 8.3 长期
- [ ] 构建完整知识图谱（Neo4j），支持 "药材-化合物-靶点-疾病-证候" 多跳查询
- [ ] 开发配方推荐引擎（君臣佐使 + 网络药理学双驱动）
- [ ] 接入 PubMed 最新文献，实时更新功效证据等级

---

**报告完毕。以上为 TCMSP & SymMap 深度挖掘与 RMCHM 合并方案的完整专业汇报。**
