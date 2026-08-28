# 技术整合分析报告：herb-formula-master → RMFOODFP

**分析日期：** 2026-08-18  
**源项目：** `E:/参考案例配方系统/herb-formula-master`（药食同源智能配方推荐系统）  
**目标项目：** `D:/RMFOODFP`（RMFOOD 智能配方设计平台）

---

## 一、源项目核心分析

### 1.1 项目定位

一个基于**网络药理学知识图谱**的 Web 应用，专注于「药食同源」范畴的中药辅助配方推荐。采用 Streamlit 框架，单次部署即可运行。

### 1.2 数据规模

| 数据类型 | 规模 | 存储路径 |
|:---------|-----:|:---------|
| 中药-化合物关系 | 13,984 条 | `data/*.xlsx` Sheet1 |
| 化合物-靶点关系 | 57,243 条 | `data/*.xlsx` Sheet2 |
| 靶点-疾病关系 | 58,983 条 | `data/*.xlsx` Sheet3 |
| 药食同源中药种类 | 100 种 | 统一 Excel 数据源 |
| 化合物种类 | 3,507 种 | 同上 |
| 蛋白质靶点 | 4,758 个 | 同上 |
| 关联疾病（英文） | 8,300+ 种 | 同上 |
| 高质量疾病中文名 | 300+ 种 | 汉字占比>50% 过滤 |
| 中医古籍 TXT | 42 本 / 15.8 MB | `data/ancient_books/` |
| 方剂书 TXT | 12 本 | `data/方剂_books/`（构建脚本存在） |
| 文献数据库 | 97 万条 | `data/literature.db` (130.5 MB) |
| 古籍向量库 | — | `data/chroma_db/` (267.5 MB) |
| 方剂向量库 | — | `data/chroma_db_fangji/` (39.9 MB) |
| 中药高清图片 | 107 张 | `（高清版）106种药食同源带介绍/` |

### 1.3 核心技术栈

```
Streamlit + pandas + LangChain + ChromaDB + BAAI/bge-small-zh-v1.5
+ Pyecharts（可视化）+ OpenAI DeepSeek API（AI对话）
```

### 1.4 核心算法模块

#### ① 知识图谱检索引擎（`src/data_loader.py`）

```
疾病名（中文）→ 中英映射 → 英文疾病名 → 靶点集 → 化合物集 → 中药集
                                                      ↓
                                              按靶点覆盖度降序排列
                                                      ↓
                                              返回 Top-N + 证据链
```

**关键函数：**
- `rank_herbs_for_disease(cn_disease, top_k=15)` — 核心排序函数
- `get_herb_disease_chain(herb, disease, ...)` — 分子链路查询（用于环形图）
- `get_graph_stats(cn_disease)` — 图谱统计概览
- `resolve_cn_disease(cn_name)` — 中文疾病名精确映射
- `translate_cn_keywords(cn_text)` — 医学术语拆分为英文关键词

#### ② 中英医学翻译引擎（`src/data_loader.py` + `src/medical_dict.py`）

三层匹配机制：
1. **精确字典**：`CN_TO_EN_DISEASE`（140+ 组）
2. **词级智能翻译**：分词 → 后缀还原 → 专业词典匹配 → 连字符拆分
3. **模糊子串**：大小写不敏感 in 匹配

#### ③ 疾病建议引擎（`src/disease_advice.py`）

双路建议生成：
- **内置知识库**：12 种高发疾病（糖尿病/高血压/高血脂/肥胖/失眠/等），每条含概述、注意事项、推荐饮食、生活建议
- **AI 实时生成**：Groq Llama 3.1 8B（免费）或 DeepSeek，带知识图谱上下文注入

#### ④ 评分系统（`src/scorer.py`）

多维度加权评分（用于优化前候选排序）：
```
final_score = 0.50 × 有效吸收评分 + 0.35 × 靶点覆盖评分 + 0.15 × 协同潜力评分
```

#### ⑤ 约束检查器（`src/constraint_checker.py`）

配方优化结果校验：剂型总重量上限（代茶饮≤5g）、单味最低用量、靶点起效剂量达标。

#### ⑥ 古籍 RAG 检索（`app.py` + `src/build_rag_db.py`）

```python
# 首次运行自动下载 + 解压
# 每次查询：ChromaDB similarity_search(query, k=3)
# 结果注入 AI 对话上下文
```

---

## 二、与 RMFOODFP 的对照分析

### 2.1 已有能力对照

| 能力域 | RMFOODFP 现状 | herb-formula-master 参考 | 差距/可借鉴 |
|:-------|:--------------|:------------------------|:-----------|
| 知识图谱 | Neo4j 可选集成 + 本地图谱服务 | 三层 Excel 关系链（130K 条） | **herb 库中药-化合物-靶点-疾病完整链路更完整** |
| 中药材数据库 | TCMSP + DFBP 两条独立数据库 | 统一的 100 种药食同源专用数据集 | **herb 数据更聚焦、质量更高（去重关系链）** |
| AI 对话系统 | ChatTab v10.0（最成熟） | DeepSeek + Groq 双路 | **RMFOOD 已领先，但可借鉴 her b的疾病上下文注入模式** |
| 古籍检索 | 无明确 RAG 实现 | 42 本古籍 + 12 本方剂书 ChromaDB | **herb 有完整实现，可直接移植** |
| 文献数据库 | 无 | 97万条 PubMed+CNKI SQLite | **herb 有完整实现，可直接移植** |
| 配方评分 | 多种（规则/LLM/神经网络） | 多维度加权评分（吸收率×覆盖×协同） | **herb 评分公式简洁实用，可借鉴** |
| 约束校验 | 无明确模块 | 剂型/用量/靶点剂量三重校验 | **herb 约束检查器可提取复用** |
| 疾病知识库 | 无 | 12 种内置 + AI 扩充 | **herb 的疾病建议结构值得引入** |
| 中药图片 | 无 | 107 张高清图片 | **视觉体验增强** |

### 2.2 关键可移植模块

#### A. 关系链数据模型（高价值）

`药食同源_真实关系链（去重）(1).xlsx` 三表结构可直接导入 RMFOODFP 的 PostgreSQL：

```sql
-- 建议建表结构
CREATE TABLE herb_compound (
    herb_id VARCHAR PRIMARY KEY,
    herb_name VARCHAR NOT NULL,
    compound_id VARCHAR NOT NULL,
    compound_name_cn VARCHAR,
    compound_name_en VARCHAR,
    molecular_formula VARCHAR,
    smiles TEXT,
    UNIQUE(herb_id, compound_id)
);

CREATE TABLE compound_target (
    compound_id VARCHAR,
    target_id VARCHAR,
    target_symbol VARCHAR,
    target_full_name VARCHAR,
    target_type VARCHAR,
    evidence_source VARCHAR,
    PRIMARY KEY (compound_id, target_id)
);

CREATE TABLE target_disease (
    target_id VARCHAR,
    disease_id VARCHAR,
    disease_name VARCHAR,
    umls_id VARCHAR,
    geonet_type VARCHAR,
    pubmed_id VARCHAR,
    PRIMARY KEY (target_id, disease_id)
);

CREATE INDEX idx_compound_target_compound ON compound_target(compound_id);
CREATE INDEX idx_compound_target_target ON compound_target(target_id);
CREATE INDEX idx_target_disease_target ON target_disease(target_id);
CREATE INDEX idx_target_disease_disease ON target_disease(disease_id);
```

#### B. 中英疾病映射词典（中等价值）

`CN_TO_EN_DISEASE` 映射表（140+ 组）和 `EN_TO_CN_MEDICAL`（400+ 词）可直接迁移到 RMFOODFP 的 `/src/services/kg/` 目录，用于增强疾病名检索。

#### C. 古籍 RAG 实现（高价值）

`src/build_rag_db.py` 和 `app.py` 中的 RAG 检索逻辑可直接移植：
- 文本切块参数：`chunk_size=300, chunk_overlap=50`
- Embedding 模型：`BAAI/bge-small-zh-v1.5`（CPU 友好）
- 向量库：ChromaDB（已适合 RMFOODFP 的 Python 后端）
- 检索方式：`similarity_search(query, k=3)`

#### D. 疾病内置知识库（中等价值）

`disease_advice.py` 中的 12 种疾病 JSON 结构可补充 RMFOODFP 的健康建议模块：

```python
{
    "疾病名": {
        "概述": str,
        "注意事项": list[str],
        "推荐饮食": list[str],
        "生活建议": list[str],
    }
}
```

---

## 三、整合建议方案

### 方案一：最小集成（推荐快速落地）

**目标：** 将 herb-formula-master 的核心数据层接入 RMFOODFP 的后端

```
步骤：
1. 将 药食同源_真实关系链.xlsx 导入 RMFOODFP 的 PostgreSQL
   → 新增 3 张表 + 对应 Alembic 迁移
2. 移植 src/data_loader.py → backend/app/services/kg/herb_graph.py
3. 移植 src/medical_dict.py → backend/app/services/kg/medical_dict.py
4. 新增 API 路由 /api/v1/herb/disease-herbs 支持疾病→中药查询
5. 前端新增「药食同源疾病推荐」页面（复用现有 formula 组件）
```

**预计工作量：** 2-3 天

### 方案二：完整 RAG 集成（推荐中期规划）

**目标：** 将古籍知识库和文献数据库也集成进 RMFOODFP

```
步骤1-4（同方案一）：
5. 移植 build_rag_db.py 逻辑 → 后端启动时自动构建/加载 ChromaDB
6. 新增 API /api/v1/ancient/retrieve 支持古籍向量检索
7. 修改 AI 助手 ChatTab，注入古籍 RAG 上下文
8. 集成 literature.db（97万条）作为药品-疾病文献辅助查询
```

**预计工作量：** 5-7 天

### 方案三：评分系统引入（长期优化）

**目标：** 将多维评分体系引入配方优化流程

```
步骤：
1. 移植 scorer.py 的评分公式 → backend/app/services/formula/scorer.py
2. 扩展 synergy_map（协同系数数据源需补充）
3. 将评分作为配方候选排序的辅助维度（当前仅依赖权重优化）
```

---

## 四、数据资产清单（可直接复用）

| 资产 | 源路径 | 目标位置建议 | 备注 |
|:-----|:-------|:------------|:-----|
| 关系链 Excel | `data/药食同源_真实关系链（去重）(1).xlsx` | 导入 PostgreSQL | 13K+57K+59K 条关系 |
| 古籍 TXT | `data/ancient_books/` (42本) | `D:/RMFOODFP/data/ancient_books/` | 原样复制 |
| 文献 DB | `data/literature.db` | `D:/RMFOODFP/data/literature.db` | 130MB，直接复制 |
| 古籍向量库 | `data/chroma_db/` | `D:/RMFOODFP/data/chroma_db/` | 268MB，直接复制 |
| 方剂向量库 | `data/chroma_db_fangji/` | `D:/RMFOODFP/data/chroma_db_fangji/` | 40MB，直接复制 |
| 中药图片 | `（高清版）106种药食同源带介绍/` | `D:/RMFOODFP/frontend/public/herb-images/` | 107张JPG |
| 医学词典 | `src/medical_dict.py` | `backend/app/services/kg/medical_dict.py` | Python代码移植 |
| 疾病建议库 | `src/disease_advice.py` | `backend/app/services/advice/disease_knowledge.py` | 12种疾病JSON |

---

## 五、风险评估

| 风险 | 等级 | 说明 |
|:-----|:----:|:-----|
| 数据版权 | 🟡 中 | 关系链来自 TCMSP/DisGeNET，需在整合时注明数据来源 |
| 依赖冲突 | 🟢 低 | RMFOODFP 已有 LangChain/ChromaDB/sentence-transformers，无冲突 |
| 性能影响 | 🟡 中 | 古籍向量库 268MB 加载会占用额外内存，建议按需懒加载 |
| 中英映射覆盖 | 🟢 低 | 内置 140+ 疾病映射可大幅减少 RMFOODFP 的搜索盲区 |
| 评分模块缺失 | 🟡 中 | 协同系数（synergy_map）在源项目中为占位数据，需补充真实数据源 |

---

## 六、结论

herb-formula-master 项目的核心贡献在于：

1. **完整可用的药食同源知识图谱数据**（130K+ 关系链，100 种中药，3500+ 化合物，4700+ 靶点，8300+ 疾病）
2. **成熟的古籍 RAG 实现**（42 本古籍 + 12 本方剂书，BGE Embedding，ChromaDB 持久化）
3. **中英文疾病智能映射系统**（三层匹配：精确→词级翻译→模糊，解决跨语言检索难题）
4. **简洁实用的多维评分框架**（吸收率×覆盖×协同，0.5/0.35/0.15 权重）

**建议优先整合顺序：**
1. ⭐ 关系链数据导入 PostgreSQL（最高价值）
2. ⭐ 古籍 RAG 加载 + 检索 API（技术已成熟）
3. ⭐ 疾病内置知识库补充（内容质量高）
4. 医学翻译词典（增强搜索能力）
5. 评分模块（需补充协同系数数据）
