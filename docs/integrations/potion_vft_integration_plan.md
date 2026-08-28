# Potion AI VFT × RMFOOD 深度融合 — 院士级开发方案

> **编制**: 陈总专属技术方案  
> **日期**: 2026-07-17  
> **版本**: v1.0  
> **目标**: 将 Potion AI VFT 平台的"原料搜索"与"零售产品搜索"核心能力，深度整合进 RMFOOD 药食同源配方平台，打造全球领先的**食品/保健品 AI 配方研发平台**。

---

## 一、Potion AI VFT 平台深度分析

### 1.1 平台本质

Potion AI VFT (Virtual Formulation Tool) 是一个**AI 驱动的化妆品/护肤品虚拟配方平台**，核心价值在于：

- **原料搜索引擎**: 混合搜索（BM25 + 向量语义），支持商品名/INCI/供应商多维度检索
- **零售产品搜索引擎**: 逆向工程竞品，支持产品图片、成分表、评分、相似推荐
- **配方工作台**: 虚拟配方创建、修改、保存、分享
- **合规引擎**: FDA/EC 法规自动检查
- **去配方(De-formulation)**: 从零售产品反推配方组成

### 1.2 核心技术架构

```
┌─────────────────────────────────────────────────────┐
│                    Frontend (React)                   │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌────────┐  │
│  │ Raw Mat  │ │ Products │ │ Formula  │ │  INCIS │  │
│  │ Search   │ │ Search   │ │ Builder  │ │ Normalize│  │
│  └──────────┘ └──────────┘ └──────────┘ └────────┘  │
│         ↕ SSE Streaming         ↕ Vector Embedding   │
├──────────────────────────────────────────────────────┤
│                 API Gateway (FastAPI)                  │
│  /search/raw-materials │ /search/products            │
│  /incis/normalize      │ /deformulation/create       │
│  /formulations         │ /organizations              │
├──────────────────────────────────────────────────────┤
│              Search Engine Layer                       │
│  BM25 (Keywords) + Vector (Semantic) → RRF Fusion   │
│  + Real-time Streaming (SSE)                         │
├──────────────────────────────────────────────────────┤
│              Data Sources                              │
│  Raw Materials DB + Retail Products DB + INCIS DB    │
│  + External APIs (MSDS/COA/Regulatory)               │
└─────────────────────────────────────────────────────┘
```

### 1.3 关键 API 端点（逆向提取）

| 端点 | 方法 | 功能 | 认证 |
|------|------|------|------|
| `/search/raw-materials` | POST | 混合搜索原料 | RBAC |
| `/search/raw-materials/stream` | POST | 流式搜索（SSE） | RBAC |
| `/raw-materials/search` | GET | 关键词搜索 | RBAC |
| `/products/search` | POST | 零售产品搜索 | RBAC |
| `/incis/normalize` | POST | INCI 标准化 | RBAC |
| `/deformulation/create` | POST | 逆向配方 | RBAC |
| `/formulations/create` | POST | 创建配方 | RBAC |
| `/organizations/raw-materials` | GET | 按组织获取原料 | RBAC |
| `/organizations/products` | GET | 按组织获取产品 | RBAC |
| `/search/hot-queries` | GET | 热门搜索词 | 公开 |
| `/search/history` | GET/POST | 搜索历史 | RBAC |
| `/pantry/*` | GET/POST/DELETE | 收藏管理 | RBAC |

### 1.4 数据模型核心字段

**Raw Material（原料）**:
```
{
  id, external_id, name, brand, supplier,
  incise_names[], description,
  material_type, category, tags[],
  msds_url, coa_url, external_links[],
  is_favorite, sample_request_url,
  image_url, rating, review_count,
  regulatory_status, country_of_origin
}
```

**Retail Product（零售产品）**:
```
{
  id, external_id, name, brand,
  product_type, category, formulation_type,
  rating, review_count, image_urls[],
  ingredients[], full_ingredients_text,
  similarity_score, similar_products[],
  price, size, country,
  regulatory_info, marketing_claims[]
}
```

---

## 二、RMFOOD 平台现状深度分析

### 2.1 现有能力矩阵

| 能力域 | 状态 | 成熟度 | 备注 |
|--------|------|--------|------|
| TCMSP 中药材数据库 | ✅ 已同步 | 95% | TCMHerb/MMIDHerb/SymMapHerb 三表 |
| DFBP 活性肽数据库 | ✅ 已同步 | 95% | BioactivePeptide 表 |
| 知识图谱 (Neo4j) | ⚠️ 有模型 | 70% | KGNode/KGEdge 表已建 |
| 统一搜索 | ⚠️ 骨架已建 | 30% | SearchEngine 是内存模拟 |
| 交叉检索 (药材↔肽) | ✅ 已实现 | 85% | CrossSearchPanel 前端 |
| Elasticsearch 服务 | ⚠️ 内存模拟 | 30% | ElasticsearchService 是 mock |
| AI 配方生成 | ✅ 多模式 | 95% | Neural/MCTS/Simulated Annealing |
| 肽序列设计 | ✅ PepINVENT | 95% | 完整链路 |
| 合规引擎 | ✅ China Food Regulations | 80% | 基础规则 |
| 术语标准化 | ✅ 已建 | 85% | TermNormalizationRule 表 |
| 搜索建议 | ✅ 基础 | 60% | Fuse.js 前端模糊匹配 |
| 收藏系统 | ✅ 已建 | 70% | SearchFavorites 表 |
| 搜索历史 | ✅ 已建 | 60% | SearchHistory + localStorage 双写 |

### 2.2 现有搜索架构（待升级）

```
当前架构:
┌─────────────────────────────────────────────────┐
│  Frontend: Fuse.js 客户端模糊搜索                  │
│  (searchService.ts, 本地索引)                      │
├─────────────────────────────────────────────────┤
│  Backend: SearchEngine (内存模拟)                  │
│  - LIKE 模糊匹配                                   │
│  - ElasticsearchService (Mock)                    │
│  - 无向量搜索                                      │
│  - 无混合排序                                      │
├─────────────────────────────────────────────────┤
│  Data: PostgreSQL (仅基础表结构)                   │
│  - tcm_herbs / mmid_herbs / symmap_herbs         │
│  - bioactive_peptides                             │
│  - 无 pgvector                                   │
│  - 无全文搜索索引                                  │
└─────────────────────────────────────────────────┘
```

### 2.3 差距分析（Potion AI VFT vs RMFOOD）

| 维度 | Potion AI VFT | RMFOOD 现状 | 差距 |
|------|--------------|-------------|------|
| 搜索算法 | BM25 + Vector RRF | LIKE 模糊匹配 | 🔴 重大 |
| 语义理解 | 向量嵌入搜索 | 前端 Fuse.js 模糊 | 🔴 重大 |
| 中文 NLP | 英文分词 | 无中文分词管线 | 🔴 重大 |
| 流式搜索 | SSE 实时推送 | 无 | 🔴 重大 |
| 数据源 | 化妆品原料库 | 中药材/肽（非食品） | 🟡 需扩展 |
| 零售产品 | 完整产品库 | 无 | 🔴 重大 |
| 合规引擎 | FDA/EC | 中国法规（基础） | 🟡 需增强 |
| 名称标准化 | INCI Normalize | 术语表（基础） | 🟡 需增强 |
| 搜索建议 | 后端驱动 | 前端 Fuse.js | 🟡 可接受 |
| 收藏/书架 | Pantry 系统 | 基础收藏 | 🟢 已有 |
| 搜索历史 | 后端存储 | 双写（DB + localStorage） | 🟡 可优化 |

---

## 三、融合架构设计

### 3.1 总体架构（升级后）

```
┌──────────────────────────────────────────────────────────────────┐
│                        RMFOOD Frontend                           │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐           │
│  │ 数据库搜索  │ │ 食品原料  │ │ 竞品成品  │ │ 合规检查  │           │
│  │ (现有增强)  │ │ 搜索引擎  │ │ 搜索引擎  │ │ 引擎     │           │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘           │
│         ↕ Hybrid Search (BM25 + Vector)    ↕ SSE Streaming      │
├──────────────────────────────────────────────────────────────────┤
│                     FastAPI Backend                                │
│                                                                  │
│  ┌────────────────┐  ┌────────────────┐  ┌──────────────────┐   │
│  │ DatabaseSearch │  │ FoodMaterial   │  │ RetailProduct    │   │
│  │ Service (增强)  │  │ Search Service │  │ Search Service   │   │
│  │ (药材+肽+化合物) │  │ (新增)          │  │ (新增)            │   │
│  └────────────────┘  └────────────────┘  └──────────────────┘   │
│         ↕                        ↕                               │
│  ┌─────────────────────────────────────────────────────┐         │
│  │           Unified Search Router                      │         │
│  │  /api/v1/search/global              (现有)           │         │
│  │  /api/v1/search/herbs                 (现有增强)     │         │
│  │  /api/v1/search/peptides              (现有增强)     │         │
│  │  /api/v1/search/food-materials        (新增)         │         │
│  │  /api/v1/search/retail-products       (新增)         │         │
│  │  /api/v1/search/unified               (新增)         │         │
│  │  /api/v1/search/suggest               (现有增强)     │         │
│  │  /api/v1/search/stream                (新增)         │         │
│  │  /api/v1/standards/normalize          (新增)         │         │
│  └─────────────────────────────────────────────────────┘         │
├──────────────────────────────────────────────────────────────────┤
│                     Search Engine Layer                           │
│                                                                   │
│  ┌─────────────┐  ┌──────────────┐  ┌──────────────────────┐    │
│  │ PostgreSQL  │  │ pgvector /   │  │ Chinese NLP          │    │
│  │ (BM25/FTS)  │  │ Qdrant       │  │ (jieba/HanLP)        │    │
│  │ + Vector    │  │ (Embedding)  │  │ + TCM/食品词典        │   │
│  └─────────────┘  └──────────────┘  └──────────────────────┘    │
├──────────────────────────────────────────────────────────────────┤
│                     Data Sources                                 │
│                                                                  │
│  ┌─────────────┐  ┌──────────────┐  ┌──────────────────────┐    │
│  │ 中国药典    │  │ 全球食品     │  │ 法规数据库           │    │
│  │ GB 标准     │  │ 原料数据库   │  │ (FDA/EFSA/HC/GB)    │    │
│  │ TCMSP/DFBP │  │ (FoodDB/    │  │ 毒理数据库           │    │
│  │ (现有)      │  │ CosIng)     │  │ (Tox21/ChemBL)      │    │
│  └─────────────┘  └──────────────┘  └──────────────────────┘    │
│                                                                  │
│  ┌─────────────┐  ┌──────────────┐                              │
│  │ 零售产品    │  │ 竞品情报     │                              │
│  │ 爬取/导入   │  │ 市场洞察     │                              │
│  │ (电商/API)  │  │ (天猫/京东)  │                              │
│  └─────────────┘  └──────────────┘                              │
└──────────────────────────────────────────────────────────────────┘
```

### 3.2 数据源策略

#### 3.2.1 食品原料数据源（优先级排序）

| 优先级 | 数据源 | 类型 | 预估数据量 | 接入方式 |
|--------|--------|------|-----------|----------|
| P0 | **中国药典 2020 版** | 法定标准 | ~1,200 味药食同源物质 | 结构化录入 |
| P0 | **GB 14880 营养强化剂** | 国家标准 | ~100+ 种 | 结构化录入 |
| P0 | **卫健委药食同源目录** | 官方目录 | ~110 种 | 结构化录入 |
| P1 | **FoodDB** | 开源数据库 | ~20,000 种食品成分 | API/CSV 导入 |
| P1 | **USDA Food Composition Database** | 官方 | ~80,000+ 食品 | API 下载 |
| P1 | **CosIng (EU 化妆品原料库)** | 官方 | ~25,000 种 | API 下载 |
| P2 | **PubMed/PMC 文献** | 学术 | 海量 | API 抓取 |
| P2 | **内部原料库** | 自建 | 增长中 | CRUD |

#### 3.2.2 零售产品数据源

| 优先级 | 数据源 | 类型 | 接入方式 |
|--------|--------|------|----------|
| P0 | **天猫/京东保健品 API** | 电商 | 爬虫/第三方数据服务 |
| P1 | **OpenFoodFacts** | 开源 | API |
| P1 | **内部竞品库** | 自建 | 手动录入+爬虫 |

---

## 四、数据库 Schema 设计

### 4.1 食品原料表 (`food_materials`)

```sql
CREATE TABLE food_materials (
    id              BIGSERIAL PRIMARY KEY,
    
    -- 身份标识
    external_id     VARCHAR(100) UNIQUE,
    gb_code         VARCHAR(50),
    name_cn         VARCHAR(200) NOT NULL,
    name_latin      VARCHAR(200),
    name_en         VARCHAR(200),
    aliases         TEXT[],
    
    -- 分类
    category        VARCHAR(100),
    sub_category    VARCHAR(100),
    food_homology   BOOLEAN DEFAULT FALSE,
    toxicity_class  VARCHAR(20),
    
    -- 活性成分
    active_ingredients TEXT[],
    compound_refs   BIGINT[],
    
    -- 功效
    effects         TEXT[],
    indications     TEXT,
    
    -- 安全参数
    safe_dose_min   FLOAT,
    safe_dose_max   FLOAT,
    contraindications TEXT[],
    interactions    TEXT[],
    
    -- 法规状态
    regulatory_status VARCHAR(50),
    approved_regions TEXT[],
    max_daily_intake VARCHAR(50),
    
    -- 供应商信息
    suppliers       JSONB,
    origin_countries TEXT[],
    
    -- 多媒体
    description     TEXT,
    image_url       VARCHAR(500),
    msds_url        VARCHAR(500),
    coa_url         VARCHAR(500),
    
    -- 向量嵌入 (用于语义搜索)
    embedding       VECTOR(768),
    search_vector   TSVECTOR,
    
    -- 元数据
    source_db       VARCHAR(50) DEFAULT 'manual',
    data_quality    FLOAT DEFAULT 1.0,
    review_status   VARCHAR(20) DEFAULT 'pending',
    
    -- 审计字段
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW(),
    created_by      BIGINT REFERENCES users(id)
);

-- 索引
CREATE INDEX idx_food_materials_search ON food_materials USING GIN(search_vector);
CREATE INDEX idx_food_materials_embedding ON food_materials USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
CREATE INDEX idx_food_materials_category ON food_materials (category, food_homology);
CREATE INDEX idx_food_materials_name_cn ON food_materials USING gin(to_tsvector('simple', name_cn));
```

### 4.2 零售产品表 (`retail_products`)

```sql
CREATE TABLE retail_products (
    id              BIGSERIAL PRIMARY KEY,
    
    external_id     VARCHAR(100) UNIQUE,
    sku             VARCHAR(100),
    brand           VARCHAR(200) NOT NULL,
    product_name    VARCHAR(500) NOT NULL,
    product_line    VARCHAR(200),
    
    category        VARCHAR(100),
    sub_category    VARCHAR(100),
    formulation_type VARCHAR(50),
    
    effects         TEXT[],
    target_population TEXT[],
    
    full_ingredients TEXT,
    key_ingredients JSONB,
    material_refs   BIGINT[],
    peptide_refs    BIGINT[],
    
    price           DECIMAL(10,2),
    currency        VARCHAR(3) DEFAULT 'CNY',
    package_size    VARCHAR(50),
    volume_ml       FLOAT,
    weight_g        FLOAT,
    
    sales_channels  TEXT[],
    avg_rating      FLOAT,
    review_count    INTEGER,
    monthly_sales   INTEGER,
    
    image_urls      TEXT[],
    
    reg_number      VARCHAR(100),
    reg_type        VARCHAR(20),
    approved_region VARCHAR(50),
    
    embedding       VECTOR(768),
    search_vector   TSVECTOR,
    
    source          VARCHAR(50) DEFAULT 'crawl',
    crawl_timestamp TIMESTAMPTZ,
    data_quality    FLOAT DEFAULT 1.0,
    
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW(),
    created_by      BIGINT REFERENCES users(id)
);

-- 索引
CREATE INDEX idx_retail_products_search ON retail_products USING GIN(search_vector);
CREATE INDEX idx_retail_products_embedding ON retail_products USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
CREATE INDEX idx_retail_products_brand ON retail_products (brand);
CREATE INDEX idx_retail_products_category ON retail_products (category, formulation_type);
```

### 4.3 搜索增强表

```sql
-- 搜索历史 (增强现有)
ALTER TABLE search_history ADD COLUMN IF NOT EXISTS search_type VARCHAR(50);
ALTER TABLE search_history ADD COLUMN IF NOT EXISTS filters JSONB;
ALTER TABLE search_history ADD COLUMN IF NOT EXISTS result_count INTEGER;

-- 热门搜索词
CREATE TABLE hot_search_queries (
    id          BIGSERIAL PRIMARY KEY,
    query       VARCHAR(200) NOT NULL UNIQUE,
    search_count INTEGER DEFAULT 0,
    trend_score FLOAT DEFAULT 0.0,
    category    VARCHAR(100),
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- 收藏/书架 (对标 Pantry)
CREATE TABLE user_pantry (
    id          BIGSERIAL PRIMARY KEY,
    user_id     BIGINT REFERENCES users(id),
    item_type   VARCHAR(50) NOT NULL,
    item_id     BIGINT NOT NULL,
    notes       TEXT,
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, item_type, item_id)
);
```

---

## 五、搜索引擎架构

### 5.1 混合搜索算法 (Hybrid Search)

```
搜索请求 → 中文分词 → 双路并行检索 → RRF 融合 → 重排序 → 结果返回
           (jieba)    BM25 + Vector    (k=60)    BM25×0.4 + Vector×0.3 + Rule×0.3
```

#### 5.1.1 BM25 检索 (PostgreSQL FTS)

利用 PostgreSQL 内置 FTS 能力，相比现有的 LIKE 模糊匹配，BM25 提供更高质量的相关性排序。

```python
# backend/app/services/search/bm25_searcher.py

class BM25Searcher:
    """PostgreSQL 全文检索搜索器"""
    
    def search(self, query: str, search_type: str, 
               filters: Dict = None, limit: int = 50) -> List[Dict]:
        """
        使用 PostgreSQL 内置 FTS 进行 BM25 搜索
        
        字段权重: name^3.0, effects^2.0, description^1.0, aliases^2.5
        """
        ...
```

#### 5.1.2 向量语义搜索 (pgvector)

```python
# backend/app/services/search/vector_searcher.py

class VectorSearcher:
    """向量语义搜索器"""
    
    def __init__(self, embedding_model: str = "shibing624/text2vec-base-chinese"):
        self.model = load_embedding_model(embedding_model)
    
    def search(self, query: str, top_k: int = 50, 
               filters: Dict = None) -> List[Dict]:
        """
        使用 Sentence-BERT 中文模型生成查询向量，
        在 pgvector 中进行余弦相似度搜索
        
        嵌入模型选型:
        - 首选: shibing624/text2vec-base-chinese (中文优化)
        - 备选: BGE-M3 (多语言 + 长文本)
        """
        query_vec = self.model.encode(query)
        ...
```

#### 5.1.3 RRF 融合算法

```python
# backend/app/services/search/hybrid_search.py

class RRF_Fusion:
    """Reciprocal Rank Fusion - 融合多路搜索结果"""
    
    K = 60  # 常数
    
    def fuse(self, results: List[List[Dict]], weights: List[float] = None) -> List[Dict]:
        """
        融合 BM25 结果 + 向量结果 + 规则匹配结果
        
        RRF 公式: score(d) = Σ (1 / (K + rank_d))
        
        权重分配:
        - BM25: 0.40 (精确匹配优先)
        - Vector: 0.30 (语义理解)
        - Rule: 0.30 (法规/毒性硬规则)
        """
        ...
```

### 5.2 流式搜索 (SSE)

```python
# backend/app/api/search.py

@router.post("/search/stream")
async def stream_search(
    request: SearchRequest,
    db: AsyncSession = Depends(get_db_session),
):
    """
    SSE 流式返回搜索结果
    
    逐批返回结果，提升用户体验:
    - 第1批: 立即返回命中数
    - 第2批: BM25 初步结果
    - 第3批: 向量补充结果
    - 第4批: 最终重排序结果
    """
    async def event_generator():
        yield f"data: {{\"type\": \"meta\", \"estimated_count\": 150}}\n\n"
        bm25_results = await bm25_search(request.query, limit=20)
        yield f"data: {{\"type\": \"results\", \"batch\": 1, \"count\": {len(bm25_results)}}}\n\n"
        vector_results = await vector_search(request.query, limit=20)
        fused = rrf_fuse(bm25_results, vector_results)
        yield f"data: {{\"type\": \"results\", \"batch\": 2, \"count\": {len(fused)}}}\n\n"
        ranked = await reranker.rerank(fused, request.query)
        for item in ranked:
            yield f"data: {json.dumps(item, ensure_ascii=False)}\n\n"
    
    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache"}
    )
```

### 5.3 中文 NLP 管线

```python
# backend/app/services/search/chinese_nlp.py

import jieba

class ChineseNLPPipeline:
    """中文 NLP 处理管线"""
    
    def __init__(self):
        self._load_tcm_dictionary()
        self._load_food_science_dictionary()
    
    def _load_tcm_dictionary(self):
        """加载中药材专业词典"""
        tcm_terms = [
            "黄芪", "人参", "当归", "枸杞子", "三七", "灵芝",
            "黄芪甲苷", "人参皂苷", "阿魏酸", "丹参酮",
        ]
        for term in tcm_terms:
            jieba.add_word(term, freq=1000)
    
    def segment(self, text: str) -> List[str]:
        return jieba.cut(text, HMM=False)
    
    def normalize_query(self, query: str) -> str:
        """查询标准化: 别名归一 + 同义词扩展"""
        # "党参" → ["党参", "东党参", "潞党参"]
        # "补气" → ["补气", "益气", "补中益气"]
        ...
```

---

## 六、API 端点设计

### 6.1 统一搜索 API

```
POST   /api/v1/search/unified                 # 跨数据源统一搜索
POST   /api/v1/search/food-materials          # 食品原料混合搜索
POST   /api/v1/search/food-materials/stream   # 食品原料流式搜索 (SSE)
POST   /api/v1/search/retail-products         # 零售产品混合搜索
POST   /api/v1/search/retail-products/stream  # 零售产品流式搜索 (SSE)
GET    /api/v1/search/suggest                 # 搜索建议 (增强版)
GET    /api/v1/search/hot-queries             # 热门搜索
POST   /api/v1/standards/normalize            # 名称标准化 (对标 INCI Normalize)
GET    /api/v1/pantry                         # 收藏列表
POST   /api/v1/pantry                         # 添加到收藏
DELETE /api/v1/pantry/:id                     # 移除收藏
```

### 6.2 保留并增强现有 API

```
# 现有 API 保持不变，增强底层搜索逻辑
GET    /api/v1/search/global                  # 全局搜索 (增强: 混合搜索)
GET    /api/v1/search/{resource_type}         # 资源类型搜索 (增强: 混合搜索)
GET    /api/v1/search/suggestions             # 搜索建议 (增强: 后端驱动)
POST   /api/v1/search/favorites               # 收藏 (增强: 统一 pantry)
GET    /api/v1/search/favorites               # 收藏列表
GET    /api/v1/search/recent-views            # 最近访问
```

### 6.3 请求/响应示例

**食品原料搜索请求**:
```json
{
  "query": "具有抗氧化作用的中药材",
  "filters": {
    "category": "中药材",
    "food_homology": true,
    "toxicity_class": "无毒",
    "has_effects": ["抗氧化", "抗衰老"],
    "regulatory_status": "已批准",
    "min_ob": 30,
    "min_data_quality": 0.7
  },
  "search_modes": {
    "bm25_weight": 0.4,
    "vector_weight": 0.3,
    "rule_weight": 0.3
  },
  "pagination": {
    "page": 1,
    "per_page": 20,
    "sort_by": "relevance"
  }
}
```

**零售产品搜索请求**:
```json
{
  "query": "含有胶原蛋白肽的口服液",
  "filters": {
    "category": "保健食品",
    "formulation_type": "口服液",
    "brand": [],
    "price_range": {"min": 50, "max": 500},
    "min_rating": 4.0,
    "has_ingredient": ["胶原蛋白肽", "透明质酸钠"],
    "effects": ["美容养颜", "保湿"]
  },
  "pagination": {
    "page": 1,
    "per_page": 20
  }
}
```

---

## 七、前端组件设计

### 7.1 组件架构

```
frontend/src/components/search/
├── UnifiedSearchBar.tsx          # 统一搜索栏 (顶部导航)
├── FoodMaterialSearchPanel.tsx   # 食品原料搜索面板
├── RetailProductSearchPanel.tsx  # 零售产品搜索面板
├── SearchResultsCard.tsx         # 搜索结果卡片
├── SearchFilters.tsx             # 搜索筛选器
├── SearchSuggestions.tsx         # 搜索建议下拉
├── SearchResultStream.tsx        # 流式结果展示
├── HotQueries.tsx                # 热门搜索词
├── PantryPanel.tsx               # 收藏管理面板
└── ProductComparison.tsx         # 产品对比
```

### 7.2 页面路由

```
/frontend/src/pages/
├── search/
│   ├── UnifiedSearchPage.tsx     # /search — 统一搜索 (Tab 切换)
│   ├── FoodMaterialSearchPage.tsx # /search/materials — 食品原料搜索
│   ├── RetailProductSearchPage.tsx # /search/products — 零售产品搜索
│   └── PantryPage.tsx           # /search/pantry — 收藏管理
└── product/
    ├── ProductDetailPage.tsx     # /materials/:id — 原料详情
    └── ComparisonPage.tsx        # /compare — 对比分析
```

### 7.3 与现有页面的集成

**关键决策**: 不创建全新页面，而是将新功能**嵌入现有 DatabasePage 的 Tab 体系中**，同时提供独立的搜索入口。

```
DatabasePage.tsx (现有)
├── HerbsTab (现有) ← 增强: 混合搜索 + 向量搜索
├── PeptidesTab (现有) ← 增强: 混合搜索
├── HomologyTab (现有) ← 保持不变
├── GraphTab (现有) ← 保持不变
├── DataManagementTab (现有) ← 保持不变
├── SyncTab (现有) ← 保持不变
├── FoodMaterialsTab (新增) ← 食品原料搜索
└── RetailProductsTab (新增) ← 零售产品搜索

CrossSearchPanel.tsx (现有) ← 增强: 支持食品原料 + 零售产品
```

**顶部导航增强**: 在现有搜索栏中新增搜索范围选择器：
```
[ 🔍 搜索...] [▼ 全部 | 中药材 | 活性肽 | 食品原料 | 零售产品 | 配方]
```

---

## 八、与现有 RMFOOD 能力的集成

### 8.1 与知识图谱的联动

```
搜索 "黄芪" 
  → 知识图谱: 黄芪 → 黄芪甲苷 → DPP-4 → 糖尿病
  → 交叉检索: 黄芪 → 相关活性肽
  → 法规检查: 黄芪在药食同源目录中 ✓
  → 配方推荐: 含黄芪的经典方剂
```

### 8.2 与 AI 配方生成的联动

```
用户在搜索中找到 "枸杞子" → 点击"加入配方"
  → 配方生成器接收枸杞子的功效标签
  → AI 推荐协同成分 (菊花、决明子)
  → 多目标优化生成最优配比
  → 合规引擎检查安全性
```

### 8.3 与肽设计的联动

```
搜索 "胶原蛋白肽" (零售产品)
  → 提取肽序列
  → PepINVENT 引擎分析: 理化性质/二级结构/ADMET
  → 优化肽序列 (提高稳定性/生物利用度)
  → 生成定制肽配方
```

### 8.4 与术语标准化的联动

```
利用现有 TermNormalizationRule 表:
搜索 "党参" → 术语标准化 → ["党参", "东党参", "潞党参"]
搜索 "黄芪" → 术语标准化 → ["黄芪", "黄耆", "Astragali Radix"]
```

---

## 九、三阶段实施计划

### Phase 1: 搜索内核升级 (Weeks 1-4)

**目标**: 升级现有搜索引擎，引入 pgvector 和混合搜索

| 任务 | 工作量 | 负责人 | 验收标准 |
|------|--------|--------|----------|
| PostgreSQL pgvector 扩展安装 | 1d | DevOps | `CREATE EXTENSION vector` 成功 |
| 中文 NLP 管线 (jieba + 专业词典) | 2d | 后端 | 分词准确率 > 95% |
| 现有 SearchEngine 增强 (BM25) | 3d | 后端 | 替换 LIKE 模糊匹配 |
| 向量嵌入模型集成 | 3d | 后端 | Sentence-BERT 中文模型可用 |
| 混合搜索 RRF 融合算法 | 3d | 后端 | BM25 + Vector 融合效果验证 |
| 现有搜索 API 底层替换 | 3d | 后端 | `/search/global` 使用混合搜索 |
| 现有 CrossSearchPanel 增强 | 3d | 前端 | 搜索结果卡片增强 |
| 集成测试 | 2d | 全员 | 搜索准确率 > 85% |

**里程碑**: 现有搜索能力全面升级，中药材/肽搜索从 LIKE 模糊匹配升级为 BM25 + 向量混合搜索。

### Phase 2: 食品原料 + 零售产品搜索 (Weeks 5-10)

**目标**: 新增食品原料和零售产品搜索能力

| 任务 | 工作量 | 负责人 | 验收标准 |
|------|--------|--------|----------|
| food_materials / retail_products 表迁移 | 2d | 后端 | Alembic 迁移完成 |
| 食品原料数据导入管线 | 4d | 后端 | 首批 ≥ 3,000 种食品原料入库 |
| 中国药典数据录入 (前 100 种) | 3d | 人工+脚本 | 100 种完整数据 |
| 食品原料搜索 API | 4d | 后端 | 混合搜索 + 筛选 |
| 零售产品搜索 API | 4d | 后端 | 混合搜索 + 筛选 |
| 流式搜索 (SSE) | 3d | 前后端 | 首屏 < 200ms |
| 食品原料搜索前端 Tab | 4d | 前端 | FoodMaterialsTab |
| 零售产品搜索前端 Tab | 4d | 前端 | RetailProductsTab |
| 统一搜索页面 (Tab 切换) | 3d | 前端 | 原料/产品/统一三 Tab |
| 收藏系统增强 (Pantry) | 2d | 前后端 | 统一收藏管理 |
| 名称标准化 API | 2d | 后端 | 别名归一化准确率 > 98% |

**里程碑**: 食品原料 + 零售产品搜索上线，统一搜索页面上线。

### Phase 3: 高级能力 (Weeks 11-14)

**目标**: 合规引擎、搜索分析、性能优化

| 任务 | 工作量 | 负责人 | 验收标准 |
|------|--------|--------|----------|
| 合规检查引擎 (中国 GB 法规) | 4d | 后端 | 自动检查 GB 法规 |
| 产品相似度推荐 | 2d | 后端 | 推荐准确率 > 80% |
| 搜索分析面板 | 3d | 前端 | 搜索热词/趋势/漏斗 |
| 多语言支持 (EN/Latin) | 2d | 后端 | 中英拉丁三语搜索 |
| 性能优化 + 缓存层 | 2d | 后端 | Redis 缓存命中率 > 70% |
| 全面测试 + 文档 | 3d | 全员 | 覆盖率 > 85% |

**里程碑**: 完整的食品原料 + 零售产品搜索生态系统上线。

---

## 十、项目目录结构更新

```
D:\RMFOOD配方平台\
├── backend\
│   ├── app\
│   │   ├── api\
│   │   │   └── db_modules\
│   │   │       ├── food_materials.py     # ← 新增: 食品原料 API
│   │   │       └── retail_products.py    # ← 新增: 零售产品 API
│   │   ├── models\
│   │   │   ├── food_material.py          # ← 新增
│   │   │   └── retail_product.py         # ← 新增
│   │   ├── schemas\
│   │   │   ├── food_material.py          # ← 新增
│   │   │   └── retail_product.py         # ← 新增
│   │   └── services\
│   │       └── search\
│   │           ├── bm25_searcher.py      # ← 新增: BM25 搜索
│   │           ├── vector_searcher.py    # ← 新增: 向量搜索
│   │           ├── hybrid_search.py      # ← 新增: RRF 融合
│   │           ├── chinese_nlp.py        # ← 新增: 中文 NLP
│   │           ├── query_normalizer.py   # ← 新增: 查询标准化
│   │           ├── stream_search.py      # ← 新增: SSE 流式
│   │           ├── compliance_engine.py  # ← 新增: 合规检查
│   │           └── data_import\
│   │               ├── material_importer.py  # ← 新增
│   │               └── product_importer.py   # ← 新增
│   └── alembic\
│       └── versions\
│           ├── 00XX_food_materials.py    # ← 新增
│           ├── 00XX_retail_products.py   # ← 新增
│           └── 00XX_pgvector_extension.py # ← 新增
│
├── frontend\
│   ├── src\
│   │   ├── api\
│   │   │   ├── foodMaterials.ts          # ← 新增
│   │   │   └── retailProducts.ts         # ← 新增
│   │   ├── components\
│   │   │   └── search\
│   │   │       ├── FoodMaterialSearchPanel.tsx  # ← 新增
│   │   │       ├── RetailProductSearchPanel.tsx # ← 新增
│   │   │       ├── SearchFilters.tsx            # ← 增强
│   │   │       └── SearchResultStream.tsx       # ← 新增
│   │   ├── pages\
│   │   │   └── database\tabs\
│   │   │       ├── FoodMaterialsTab.tsx  # ← 新增
│   │   │       └── RetailProductsTab.tsx # ← 新增
│   │   ├── hooks\
│   │   │   └── useSearchStream.ts        # ← 新增: SSE hook
│   │   └── types\
│   │       └── search.types.ts           # ← 增强
│   └── docker/
│       └── postgres\
│           └── extensions.sql            # ← 新增: pgvector 安装
│
├── deploy\
│   └── docker-compose.yml                # ← 增强: 添加 pgvector 扩展配置
│
└── docs\
    └── search_architecture.md            # ← 新增: 搜索架构文档
```

---

## 十一、关键技术决策

### 11.1 向量数据库选型

| 方案 | 优点 | 缺点 | 推荐 |
|------|------|------|------|
| **pgvector** | 与 PG 同库、运维简单、ACID | 大规模性能有限 | ✅ Phase 1-2 首选 |
| **Qdrant** | 高性能、过滤支持好 | 额外服务、运维成本 | ✅ Phase 3 升级 |

**推荐路线**: Phase 1 使用 pgvector (与现有 PG 集成)，Phase 3 根据数据量决定是否升级到 Qdrant。

### 11.2 嵌入模型选型

| 模型 | 维度 | 中文性能 | 推理速度 | 推荐 |
|------|------|----------|----------|------|
| shibing624/text2vec-base-chinese | 768 | 优秀 | 快 | ✅ 首选 |
| BAAI/bge-m3 | 1024 | 优秀 | 中 | ✅ 备选 |

### 11.3 中文分词方案

| 方案 | 精度 | 速度 | 领域适配 | 推荐 |
|------|------|------|----------|------|
| **jieba + 自定义词典** | 高 | 极快 | 需维护词典 | ✅ 首选 |
| HanLP | 极高 | 中 | 内置 TCM | 备选 |

### 11.4 数据导入策略

| 策略 | 适用场景 | 实施方式 |
|------|----------|----------|
| **API 对接** | USDA/FoodDB/CosIng | HTTP 定时拉取 |
| **CSV/Excel 批量导入** | 中国药典/内部数据 | 管理后台上传 |
| **Web 爬虫** | 电商平台 | Scrapy + 反爬应对 |
| **手动录入** | 核心药食同源目录 | 管理后台表单 |

---

## 十二、与 Potion AI VFT 的差异与优势

| 维度 | Potion AI VFT | RMFOOD (融合后) |
|------|--------------|-----------------|
| **领域** | 化妆品/护肤品 | **食品/保健品/药食同源** |
| **法规** | FDA/EC | **中国 GB 标准 + 国际** |
| **语言** | 英文为主 | **中文优先 + 英/拉丁** |
| **数据库** | 化妆品原料 | **TCMSP + DFBP + 中国药典 + 食品成分** |
| **搜索** | 英文 BM25 + Vector | **中文 NLP + 专业词典 + 混合搜索** |
| **合规** | 化妆品法规 | **食品安全法 + 药食同源目录 + GB 标准** |
| **肽能力** | 有限 | **PepINVENT 专业肽分析** |
| **知识图谱** | 有限 | **Neo4j 药材-化合物-靶点-疾病** |
| **AI 配方** | 基础 | **神经网络 + MCTS + 模拟退火** |

**RMFOOD 的差异化竞争优势**:
1. **唯一专注中国药食同源 + 食品科学的 AI 配方平台**
2. **TCM 专业知识 + 现代食品科学深度融合**
3. **合规引擎覆盖中国食品安全法规体系**
4. **活性肽专业分析能力 (PepINVENT)**
5. **知识图谱驱动的成分-功效-靶点关联**

---

## 十三、风险与缓解

| 风险 | 影响 | 概率 | 缓解措施 |
|------|------|------|----------|
| 电商数据爬取被反爬 | 数据源缺失 | 高 | 使用第三方数据服务 + 手动录入备用 |
| pgvector 大数据量性能瓶颈 | 搜索延迟 | 中 | Phase 3 升级到 Qdrant |
| 中文分词领域术语覆盖不全 | 搜索准确率 | 中 | 持续维护专业词典 + 用户反馈闭环 |
| 食品法规数据更新不及时 | 合规准确性 | 低 | 订阅官方 RSS + 月度人工审核 |
| 嵌入模型显存不足 | 向量生成 | 中 | 批量离线生成 + Redis 缓存 |
| 多数据源数据质量不一致 | 搜索结果可信度 | 高 | 数据质量评分 + 来源标注 + 人工审核 |

---

## 十四、成功指标 (KPIs)

| 指标 | Phase 1 | Phase 2 | Phase 3 |
|------|---------|---------|---------|
| 搜索算法 | LIKE → BM25+Vector | 混合搜索上线 | RRF 重排序 |
| 搜索平均延迟 | < 200ms | < 150ms | < 100ms |
| 搜索准确率 (人工评估) | > 85% | > 90% | > 93% |
| 食品原料数据量 | N/A | ≥ 3,000 | ≥ 10,000 |
| 零售产品数据量 | N/A | ≥ 5,000 | ≥ 20,000 |
| 日均搜索次数 | N/A | > 100 | > 500 |

---

## 十五、附录

### A. 药食同源物质目录 (首批录入)

枸杞子、山药、山楂、桂圆肉、核桃仁、杏仁、薄荷、薏苡仁、赤小豆、莲子、百合、荷叶、淡竹叶、菊花、桑叶、决明子、茺蔚子、桔梗、栀子、麦芽、蒲黄、莱菔子、紫苏子、火麻仁、枳椇子、蜂蜜、豆蔻、砂仁、羊肚菌、平菇、黑木耳、银耳...

### B. 核心参考标准

- 《中华人民共和国药典》2020 年版
- 《按照传统既是食品又是中药材的物质目录》
- 《食品安全国家标准 食品添加剂使用标准》(GB 2760)
- 《食品安全国家标准 营养强化剂使用标准》(GB 14880)
- 《保健食品注册与备案管理办法》

### C. 技术栈版本

| 组件 | 版本 | 备注 |
|------|------|------|
| PostgreSQL | 16 | 已有 |
| pgvector | 0.7+ | 新增 |
| Redis | 7 | 已有 |
| Python | 3.12 | 已有 |
| FastAPI | 0.115 | 已有 |
| SQLAlchemy | 2.0 | 已有 |
| jieba | 0.42 | 新增 |
| sentence-transformers | 3.0 | 新增 |
| Qdrant (Phase 3) | 1.9+ | 新增 |
