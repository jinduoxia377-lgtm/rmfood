# RMCHM 数据库融入主项目"数据检索中心"深度分析

**编制日期**：2026-09-08  
**版本**：v1.0  
**分析视角**：数据专家  
**目标**：将RMCHM数据库专业融入RMFOOD主项目"数据检索中心"

---

## 一、项目架构理解

### 1.1 主项目技术栈

| 层级 | 技术 | 版本 |
|------|------|------|
| 前端框架 | React + TypeScript | 19.x + 5.7 |
| 构建工具 | Vite | 8.x |
| UI组件 | TailwindCSS + Lucide Icons | 4.x |
| 状态管理 | Zustand + React Query | latest |
| 图表库 | Recharts | latest |
| 后端框架 | FastAPI (Python) | 0.115 |
| ORM | SQLAlchemy (async) | 2.0 |
| 数据库 | PostgreSQL | 18 |

### 1.2 数据检索中心架构

```
┌─────────────────────────────────────────────────────────────────────┐
│                        前端 (React + TypeScript)                     │
├─────────────────────────────────────────────────────────────────────┤
│  DatabasePage (数据检索中心)                                          │
│  ├── HerbsTab (药材检索) ← 当前支持 TCMSP + SymMap                   │
│  ├── PeptidesTab (活性肽检索)                                        │
│  ├── GraphTab (知识图谱)                                             │
│  ├── HomologyTab (药食同源)                                          │
│  ├── DataManagementTab (数据管理)                                    │
│  └── SearchAnalyticsDashboard (搜索分析)                             │
├─────────────────────────────────────────────────────────────────────┤
│  API 层 (frontend/src/api/database.ts)                               │
│  ├── databaseApi.searchHerbs()       → GET /databases/herbs         │
│  ├── databaseApi.searchSymmapHerbs() → GET /databases/herbs/symmap  │
│  ├── databaseApi.getCategories()     → GET /databases/herbs/categories│
│  └── databaseApi.getFoodHomologyHerbs() → GET /databases/herbs/food-homology│
├─────────────────────────────────────────────────────────────────────┤
│  后端 API (backend/app/api/db_modules/herbs.py)                      │
│  ├── @router.get("/herbs")           TCMSP 药材检索                   │
│  ├── @router.get("/herbs/symmap")    SymMap 药材检索                  │
│  ├── @router.get("/herbs/categories") 分类统计                        │
│  └── @router.get("/herbs/food-homology") 药食同源列表                 │
├─────────────────────────────────────────────────────────────────────┤
│  数据模型 (backend/app/models/external_data.py)                       │
│  ├── TCMHerb      → tcm_herbs 表 (502条)                            │
│  ├── MMIDHerb     → mmid_herbs 表                                   │
│  ├── SymMapHerb   → symmap_herbs 表 (698条)                         │
│  └── [NEW] RMCHMHerb → rmchm_herbs 表 (714条) ← 待添加              │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 二、RMCHM 数据资产分析

### 2.1 数据总量

| 指标 | 数值 | 对比TCMSP | 对比SymMap |
|------|------|-----------|------------|
| **总药材数** | **714 条** | +58.6% (vs 502) | +14.7% (vs 698) |
| 药食同源 | **127 条** | +32.3% (vs 96) | 持平 |
| 四气覆盖 | **97.6%** | 相当 | 相当 |
| 归经覆盖 | **92.0%** | 相当 | 相当 |
| OB%覆盖 | **69.7%** | 相当 | 较低 |
| 图片资源 | **107 张** | 新增 | 新增 |

### 2.2 数据结构对比

| 字段 | TCMHerb | SymMapHerb | RMCHMHerb (新) |
|------|---------|------------|----------------|
| 基础名称 | ✅ | ✅ | ✅ + rmchm_code |
| 四气 | ✅ effects | ✅ nature_cn | ✅ nature_cn (更详细) |
| 归经 | ❌ | ✅ meridians_cn | ✅ meridians_cn |
| 分类 | ✅ category | ✅ category_cn | ✅ category_cn |
| OB%/DL | ✅ | ❌ | ✅ ob_percent, dl_value |
| 药食同源 | ✅ | ❌ | ✅ is_food_homology |
| 图片 | ❌ | ❌ | ✅ image_path |
| 质量评分 | ❌ | ❌ | ✅ data_quality_score |
| 化合物数 | JSON数组 | ❌ | ✅ compounds_count |
| 靶点数 | JSON数组 | ❌ | ✅ targets_count |

### 2.3 RMCHM 独特价值

| 价值点 | 说明 |
|--------|------|
| **官方合规性** | 106种药食同源100%覆盖国家卫健委目录 |
| **数据质量评分** | 唯一具有data_quality_score的数据源 |
| **图片资源** | 107张标准药材图片，其他数据源无 |
| **补充新药** | 代代花、白扁豆花等新入库药材 |
| **拉丁名修正** | 茯苓Omphalia→Poria等错误已修正 |

---

## 三、集成方案设计

### 3.1 后端集成

#### 3.1.1 新增数据模型

**文件**: `backend/app/models/external_data.py`

```python
class RMCHMHerb(Base):
    """RMCHM 莱茵中药材数据库
    
    莱茵制药中药材数据库，整合TCMSP+SymMap+官方药食同源目录
    特点：数据质量评分、图片资源、官方合规标记
    """
    __tablename__ = "rmchm_herbs"
    
    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    
    # 唯一标识
    rmchm_id: Mapped[str] = mapped_column(String(8), nullable=False, unique=True, index=True)
    rmchm_code: Mapped[str] = mapped_column(String(20), nullable=False, unique=True, index=True)
    
    # 基础名称
    name_cn: Mapped[str] = mapped_column(String(200), nullable=False, index=True)
    name_pinyin: Mapped[str | None] = mapped_column(String(200))
    name_latin: Mapped[str | None] = mapped_column(String(300))
    name_eng: Mapped[str | None] = mapped_column(String(300))
    
    # 传统属性
    nature_cn: Mapped[str | None] = mapped_column(String(1000))  # 四气
    nature_eng: Mapped[str | None] = mapped_column(String(500))
    meridians_cn: Mapped[str | None] = mapped_column(String(1000))  # 归经
    meridians_eng: Mapped[str | None] = mapped_column(String(500))
    category_cn: Mapped[str | None] = mapped_column(String(100))
    category_eng: Mapped[str | None] = mapped_column(String(100))
    use_part: Mapped[str | None] = mapped_column(String(100))
    alias: Mapped[str | None] = mapped_column(Text)
    function_cn: Mapped[str | None] = mapped_column(Text)
    
    # 现代药理学
    ob_percent: Mapped[float | None] = mapped_column(Float)
    dl_value: Mapped[float | None] = mapped_column(Float)
    is_food_homology: Mapped[bool] = mapped_column(Boolean, default=False)
    is_toxic: Mapped[bool] = mapped_column(Boolean, default=False)
    
    # 交叉引用
    tcmsp_id: Mapped[int | None] = mapped_column(Integer, index=True)
    symmap_id: Mapped[int | None] = mapped_column(Integer, index=True)
    
    # 统计信息
    compounds_count: Mapped[int] = mapped_column(Integer, default=0)
    targets_count: Mapped[int] = mapped_column(Integer, default=0)
    diseases_count: Mapped[int] = mapped_column(Integer, default=0)
    
    # 图片资源
    image_path: Mapped[str | None] = mapped_column(String(500))
    image_source: Mapped[str | None] = mapped_column(String(50))
    
    # 质量评估
    data_quality_score: Mapped[float | None] = mapped_column(Float)
    
    # 元数据
    source_versions: Mapped[dict | None] = mapped_column(JSON)
    synced_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc_mapped)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc_mapped, onupdate=now_utc_mapped)
```

#### 3.1.2 新增API端点

**文件**: `backend/app/api/db_modules/herbs.py`

```python
# ═══════════════════════════════════════════
# RMCHM 中药材检索
# ═══════════════════════════════════════════

@router.get("/herbs/rmchm", summary="RMCHM 中药材检索")
async def search_rmchm_herbs(
    keyword: str = Query("", description="搜索关键词"),
    category: str = Query(None, description="分类过滤"),
    nature: str = Query(None, description="四气过滤"),
    food_homology_only: bool = Query(False, description="仅药食同源"),
    min_quality: float = Query(0.0, description="最低质量评分"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
):
    """搜索 RMCHM 莱茵中药材数据库"""
    from ...models import RMCHMHerb
    
    query = select(RMCHMHerb)
    count_query = select(func.count()).select_from(RMCHMHerb)
    
    if keyword:
        like_pattern = f"%{keyword}%"
        query = query.where(
            (RMCHMHerb.name_cn.ilike(like_pattern))
            | (RMCHMHerb.name_latin.ilike(like_pattern))
            | (RMCHMHerb.name_pinyin.ilike(like_pattern))
            | (RMCHMHerb.alias.ilike(like_pattern))
        )
        count_query = count_query.where(
            (RMCHMHerb.name_cn.ilike(like_pattern))
            | (RMCHMHerb.name_latin.ilike(like_pattern))
            | (RMCHMHerb.name_pinyin.ilike(like_pattern))
        )
    
    if category:
        query = query.where(RMCHMHerb.category_cn == category)
        count_query = count_query.where(RMCHMHerb.category_cn == category)
    
    if nature:
        query = query.where(RMCHMHerb.nature_cn.ilike(f"%{nature}%"))
        count_query = count_query.where(RMCHMHerb.nature_cn.ilike(f"%{nature}%"))
    
    if food_homology_only:
        query = query.where(RMCHMHerb.is_food_homology == True)
        count_query = count_query.where(RMCHMHerb.is_food_homology == True)
    
    if min_quality > 0:
        query = query.where(RMCHMHerb.data_quality_score >= min_quality)
        count_query = count_query.where(RMCHMHerb.data_quality_score >= min_quality)
    
    total = (await db.execute(count_query)).scalar() or 0
    items = (await db.execute(
        query.order_by(RMCHMHerb.name_cn)
             .offset((page - 1) * page_size)
             .limit(page_size)
    )).scalars().all()
    
    return {
        "items": [
            {
                "id": h.id,
                "rmchm_id": h.rmchm_id,
                "rmchm_code": h.rmchm_code,
                "name_cn": h.name_cn,
                "name_pinyin": h.name_pinyin,
                "name_latin": h.name_latin,
                "name_eng": h.name_eng,
                "nature_cn": h.nature_cn,
                "meridians_cn": h.meridians_cn,
                "category_cn": h.category_cn,
                "use_part": h.use_part,
                "alias": h.alias,
                "function_cn": h.function_cn,
                "ob_percent": h.ob_percent,
                "dl_value": h.dl_value,
                "is_food_homology": h.is_food_homology,
                "is_toxic": h.is_toxic,
                "tcmsp_id": h.tcmsp_id,
                "symmap_id": h.symmap_id,
                "compounds_count": h.compounds_count,
                "targets_count": h.targets_count,
                "diseases_count": h.diseases_count,
                "image_path": h.image_path,
                "image_source": h.image_source,
                "data_quality_score": h.data_quality_score,
                "source_version": "rmchm_v311",
            }
            for h in items
        ],
        "total": total,
        "page": page,
        "page_size": page_size,
        "source": "rmchm"
    }


@router.get("/herbs/rmchm/stats", summary="RMCHM 数据统计")
async def get_rmchm_stats(db: AsyncSession = Depends(get_db_session)):
    """获取 RMCHM 数据统计"""
    from ...models import RMCHMHerb
    
    # 总体统计
    total = (await db.execute(select(func.count()).select_from(RMCHMHerb))).scalar()
    homology = (await db.execute(
        select(func.count()).where(RMCHMHerb.is_food_homology == True)
    )).scalar()
    
    # 分类统计
    category_stats = (await db.execute("""
        SELECT category_cn, COUNT(*) as cnt,
               SUM(CASE WHEN is_food_homology THEN 1 ELSE 0 END) as homology_cnt
        FROM rmchm_herbs
        WHERE category_cn IS NOT NULL
        GROUP BY category_cn
        ORDER BY cnt DESC
    """)).all()
    
    # 四气分布
    nature_stats = (await db.execute("""
        SELECT nature_cn, COUNT(*) as cnt
        FROM rmchm_herbs
        WHERE nature_cn IS NOT NULL
        GROUP BY nature_cn
        ORDER BY cnt DESC
        LIMIT 10
    """)).all()
    
    # 质量分布
    quality_dist = (await db.execute("""
        SELECT 
            CASE 
                WHEN data_quality_score >= 0.8 THEN 'high'
                WHEN data_quality_score >= 0.5 THEN 'medium'
                ELSE 'low'
            END as quality_level,
            COUNT(*) as cnt
        FROM rmchm_herbs
        GROUP BY quality_level
    """)).all()
    
    return {
        "total_herbs": total,
        "homology_count": homology,
        "homology_rate": round(homology / total * 100, 1) if total > 0 else 0,
        "category_distribution": [{"category": r[0], "count": r[1], "homology_count": r[2]} for r in category_stats],
        "nature_distribution": [{"nature": r[0], "count": r[1]} for r in nature_stats],
        "quality_distribution": {r[0]: r[1] for r in quality_dist},
        "avg_quality_score": (await db.execute(
            select(func.avg(RMCHMHerb.data_quality_score))
        )).scalar(),
        "source": "rmchm",
        "version": "v311"
    }
```

#### 3.1.3 更新 models.py 导出

**文件**: `backend/app/models/models.py`

```python
from .external_data import TCMHerb, MMIDHerb, SymMapHerb, BioactivePeptide, KnowledgeGraphNode, RMCHMHerb

__all__ = [
    ...
    "RMCHMHerb",
]
```

---

### 3.2 前端集成

#### 3.2.1 新增 TypeScript 类型

**文件**: `frontend/src/types/index.ts`

```typescript
/** RMCHM 莱茵中药材数据 */
export interface RMCHMHerb {
  id: number;
  rmchm_id: string;
  rmchm_code: string;
  name_cn: string;
  name_pinyin?: string;
  name_latin?: string;
  name_eng?: string;
  nature_cn?: string;      // 四气
  nature_eng?: string;
  meridians_cn?: string;   // 归经
  meridians_eng?: string;
  category_cn?: string;
  category_eng?: string;
  use_part?: string;       // 药用部位
  alias?: string;          // 别名
  function_cn?: string;    // 功效
  ob_percent?: number;     // 口服生物利用度
  dl_value?: number;       // 类药性
  is_food_homology?: boolean;
  is_toxic?: boolean;
  tcmsp_id?: number;       // 交叉引用
  symmap_id?: number;
  compounds_count?: number;
  targets_count?: number;
  diseases_count?: number;
  image_path?: string;     // 图片路径
  image_source?: string;
  data_quality_score?: number;  // 质量评分
  source_version?: string;
  created_at: string;
  updated_at: string;
}

export interface RMCHMStats {
  total_herbs: number;
  homology_count: number;
  homology_rate: number;
  category_distribution: Array<{ category: string; count: number; homology_count: number }>;
  nature_distribution: Array<{ nature: string; count: number }>;
  quality_distribution: { high: number; medium: number; low: number };
  avg_quality_score: number;
  source: string;
  version: string;
}
```

#### 3.2.2 新增 API 方法

**文件**: `frontend/src/api/database.ts`

```typescript
// ═══════════════════════════════════════════
// RMCHM 莱茵中药材检索
// ═══════════════════════════════════════════

/** RMCHM 中药材检索 */
searchRmchmHerbs: (params: {
  keyword?: string;
  category?: string;
  nature?: string;
  food_homology_only?: boolean;
  min_quality?: number;
  page?: number;
  page_size?: number;
}) => api.get<PaginatedResponse<RMCHMHerb>>('/databases/herbs/rmchm', { params }).then((r) => r.data),

/** RMCHM 数据统计 */
getRmchmStats: () => 
  api.get<RMCHMStats>('/databases/herbs/rmchm/stats').then((r) => r.data),

/** RMCHM 药材详情 */
getRmchmHerb: (rmchmId: string) => 
  api.get<RMCHMHerb>(`/databases/herbs/rmchm/${rmchmId}`).then((r) => r.data),
```

#### 3.2.3 更新 HerbsTab 组件

**文件**: `frontend/src/pages/database/tabs/HerbsTab.tsx`

```typescript
// 新增数据源类型
type DataSource = 'tcmsp' | 'symmap' | 'rmchm';

// 新增查询
const rmchmQuery = useQuery({
  queryKey: ['db-rmchm-herbs', keyword, category, nature, foodOnly, page, pageSize],
  queryFn: () =>
    databaseApi.searchRmchmHerbs({
      keyword,
      category: category || undefined,
      nature: nature || undefined,
      food_homology_only: foodOnly,
      page,
      page_size: pageSize,
    }),
  enabled: dataSource === 'rmchm',
});

// 统一获取 items
const herbData = dataSource === 'tcmsp' ? herbQuery : 
                 dataSource === 'symmap' ? symmapQuery : rmchmQuery;
```

---

## 四、数据检索中心整体架构

### 4.1 三数据源融合视图

```
┌─────────────────────────────────────────────────────────────────────┐
│  药材检索 Tab                                                        │
├─────────────────────────────────────────────────────────────────────┤
│  [数据源切换]  TCMSP (502) | SymMap (698) | RMCHM (714) 🔥         │
├─────────────────────────────────────────────────────────────────────┤
│  [搜索框] 输入药材名称/拼音/拉丁名...    [分类筛选▼] [四气筛选▼]     │
├─────────────────────────────────────────────────────────────────────┤
│  排序: 名称↑ | OB%↓ | 质量评分↑ | 药食同源优先                       │
├─────────────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ [图片] 茯苓      OB%=83.96  质量=0.85  [药食同源]            │   │
│  │ 四气: 甘,淡,平    归经: 心,肺,脾,肾                           │   │
│  │ [TCMSP] [SymMap] [RMCHM] ← 多源标记                          │   │
│  └─────────────────────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ [图片] 枸杞子    OB%=68.89  质量=0.78  [药食同源]            │   │
│  │ 四气: 甘,平      归经: 肝,肾                                  │   │
│  │ [TCMSP] [SymMap] [RMCHM]                                     │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                          ...                                        │
├─────────────────────────────────────────────────────────────────────┤
│  共 714 条记录  每页 20 条  [< 1 2 3 ... 36 >]                      │
└─────────────────────────────────────────────────────────────────────┘
```

### 4.2 跨数据源关联

```
                    ┌──────────────┐
                    │   茯苓        │
                    │  Poria       │
                    └──────┬───────┘
                           │
           ┌───────────────┼───────────────┐
           │               │               │
           ▼               ▼               ▼
    ┌────────────┐ ┌────────────┐ ┌────────────┐
    │ TCMSP      │ │ SymMap     │ │ RMCHM      │
    │ ID: 123    │ │ ID: 456    │ │ ID: RM001  │
    │ OB%=83.96  │ │ OB%=83.96  │ │ OB%=83.96  │
    │ DL=0.18    │ │ DL=0.18    │ │ DL=0.18    │
    │ 化合物:4    │ │ 化合物:4    │ │ 化合物:4    │
    │ [查看]     │ │ [查看]     │ │ [查看]     │
    └────────────┘ └────────────┘ └────────────┘
```

---

## 五、前端展示设计

### 5.1 药材卡片增强

```typescript
// RMCHM 药材卡片组件
function RmchmHerbCard({ herb }: { herb: RMCHMHerb }) {
  return (
    <Card className="herb-card" onClick={() => navigate(`/database/herb/${herb.rmchm_id}`)}>
      {/* 图片区 */}
      {herb.image_path && (
        <div className="herb-image">
          <img src={herb.image_path} alt={herb.name_cn} />
        </div>
      )}
      
      {/* 基本信息 */}
      <div className="herb-info">
        <div className="herb-name">
          <span className="cn">{herb.name_cn}</span>
          <span className="latin">{herb.name_latin}</span>
        </div>
        
        {/* 标签组 */}
        <div className="herb-tags">
          {herb.is_food_homology && (
            <Badge variant="success">药食同源</Badge>
          )}
          {herb.is_toxic && (
            <Badge variant="danger">有毒</Badge>
          )}
          <Badge variant="info">{herb.category_cn}</Badge>
        </div>
        
        {/* 属性展示 */}
        <div className="herb-properties">
          <span className="nature">四气: {herb.nature_cn}</span>
          <span className="meridians">归经: {herb.meridians_cn}</span>
        </div>
        
        {/* 药理学指标 */}
        <div className="herb-metrics">
          <div className="metric">
            <span className="label">OB%</span>
            <Progress value={herb.ob_percent} max={100} />
            <span className="value">{herb.ob_percent?.toFixed(1)}</span>
          </div>
          <div className="metric">
            <span className="label">质量</span>
            <span className="value">{herb.data_quality_score?.toFixed(2)}</span>
          </div>
        </div>
        
        {/* 多源标记 */}
        <div className="source-badges">
          {herb.tcmsp_id && <span className="source-tag">TCMSP</span>}
          {herb.symmap_id && <span className="source-tag">SymMap</span>}
          <span className="source-tag active">RMCHM</span>
        </div>
      </div>
    </Card>
  );
}
```

### 5.2 药材详情页增强

```
┌─────────────────────────────────────────────────────────────┐
│  ← 返回          药材详情                    [分享] [收藏]   │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐  ┌─────────────────────────────────┐   │
│  │                 │  │ 茯苓  Poria                     │   │
│  │   [药材图片]    │  │  Fuling                         │   │
│  │   (107张可展示) │  │                                 │   │
│  │                 │  │  [药食同源] [利水渗湿药] [质量0.85]│   │
│  └─────────────────┘  └─────────────────────────────────┘   │
├─────────────────────────────────────────────────────────────┤
│  【基本信息】                                                 │
│  中文名：茯苓    拼音：Fuling    拉丁名：Poria               │
│  药用部位：菌核    别名：云苓、白茯苓                         │
│  数据来源：RMCHM v311 (TCMSP+SymMap融合)                    │
├─────────────────────────────────────────────────────────────┤
│  【传统属性】                                                 │
│  四气：甘、淡、平                                            │
│  归经：心、肺、脾、肾                                        │
│  功效：利水渗湿，健脾宁心                                    │
├─────────────────────────────────────────────────────────────┤
│  【现代药理学】                                               │
│  OB%：83.96 ████████████████████ 良好吸收                    │
│  DL：0.18  ████████ 类药性                                    │
│  化合物：4个    靶点：23个    疾病：45个                      │
├─────────────────────────────────────────────────────────────┤
│  【多源数据对比】                                             │
│  ┌──────────┬──────────┬──────────┐                         │
│  │  TCMSP   │  SymMap  │  RMCHM   │                         │
│  │  ID:123  │  ID:456  │  RM001   │                         │
│  │  OB%:84  │  OB%:84  │  OB%:84  │                         │
│  │  ✓ 有    │  ✓ 有    │  ✓ 有    │                         │
│  └──────────┴──────────┴──────────┘                         │
├─────────────────────────────────────────────────────────────┤
│  【化合物列表】(4个)                    [查看全部]             │
│  • 茯苓酸 (OB%=84.2)     • 茯苓醇 (OB%=78.5)                │
│  • 羊毛脂甾醇 (OB%=92.1)  • 羟基茯苓酸 (OB%=75.3)            │
├─────────────────────────────────────────────────────────────┤
│  【靶点网络】(23个)                   [查看图谱]              │
│  IL-6 · TNF-alpha · NF-kB · ...                            │
├─────────────────────────────────────────────────────────────┤
│  【关联疾病】(45个)                   [查看全部]              │
│  水肿 · 失眠 · 消化不良 · 尿retention · ...                 │
├─────────────────────────────────────────────────────────────┤
│  [加入配方]  [对比药材]  [导出数据]                          │
└─────────────────────────────────────────────────────────────┘
```

---

## 六、数据统计看板集成

### 6.1 首页数据概览增强

在 `DatabasePage` 的统计卡片中增加 RMCHM 数据：

```typescript
// 统计卡片配置
const statsCards = [
  {
    title: 'TCMSP 药材',
    value: '502',
    icon: Database,
    color: 'blue',
    link: '/database?source=tcmsp'
  },
  {
    title: 'SymMap 药材',
    value: '698',
    icon: Database,
    color: 'green',
    link: '/database?source=symmap'
  },
  {
    title: 'RMCHM 药材',
    value: '714',
    icon: Database,
    color: 'purple',
    subtitle: '莱茵制药数据',
    link: '/database?source=rmchm',
    badge: 'NEW'  // 新数据源标记
  },
  {
    title: '药食同源',
    value: '127',
    icon: Leaf,
    color: 'red',
    link: '/database?tab=homology'
  },
  {
    title: '化合物总数',
    value: '33,482',
    icon: Dna,
    color: 'orange'
  },
  {
    title: '图片资源',
    value: '107',
    icon: Image,
    color: 'cyan',
    subtitle: 'RMCHM独家'
  }
];
```

### 6.2 RMCHM 专属统计面板

新增 RMCHM 数据统计接口，在 `SearchAnalyticsDashboard` 中展示：

```typescript
// RMCHM 数据质量分布图
const qualityDistribution = {
  high: 100,    // 质量≥0.8
  medium: 380,  // 0.5≤质量<0.8
  low: 234      // 质量<0.5
};

// 分类分布（Top 10）
const categoryDistribution = [
  { name: '清热解毒药', count: 88, homology: 7 },
  { name: '化痰药', count: 52, homology: 6 },
  { name: '理气药', count: 38, homology: 11 },  // 药食同源比例最高
  { name: '补气药', count: 23, homology: 12 },  // 药食同源比例最高
  ...
];
```

---

## 七、实施路线图

### Phase 1: 后端集成（1天）

| 任务 | 文件 | 状态 |
|------|------|------|
| 添加 RMCHMHerb 模型 | `models/external_data.py` | ⏳ |
| 添加 API 端点 | `api/db_modules/herbs.py` | ⏳ |
| 更新 models.py 导出 | `models/models.py` | ⏳ |
| 添加 Alembic 迁移 | `migrations/` | ⏳ |

### Phase 2: 前端集成（1天）

| 任务 | 文件 | 状态 |
|------|------|------|
| 添加 TypeScript 类型 | `types/index.ts` | ⏳ |
| 添加 API 方法 | `api/database.ts` | ⏳ |
| 更新 HerbsTab 数据源切换 | `pages/database/tabs/HerbsTab.tsx` | ⏳ |
| 新增 RMCHM 专属卡片样式 | `components/ui/HerbCard.tsx` | ⏳ |

### Phase 3: 功能增强（0.5天）

| 任务 | 说明 |
|------|------|
| 多源交叉引用展示 | 详情页显示TCMSP/SymMap/RMCHM三源ID |
| 质量评分筛选 | 支持按质量评分过滤 |
| 图片懒加载 | 107张图片优化加载 |
| 数据统计面板 | RMCHM专属统计图表 |

---

## 八、关键设计决策

### 8.1 数据源切换策略

| 方案 | 优点 | 缺点 | 推荐 |
|------|------|------|------|
| 独立Tab | 清晰隔离 | 重复代码 | ❌ |
| 下拉选择器 | 简洁 | 切换开销 | ⚠️ |
| **数据源标签** | 直观、可切换 | 需重构查询 | ✅ |

**推荐方案**：在 HerbsTab 顶部添加数据源标签切换，支持 TCMSP/SymMap/RMCHM 三源切换，并显示各源数据量。

### 8.2 交叉引用策略

| 场景 | 处理方式 |
|------|---------|
| 同名药材 | 通过 name_cn 模糊匹配建立关联 |
| 多源ID | 详情页展示所有源的ID |
| 数据差异 | 以RMCHM为主，显示其他源对比 |

### 8.3 图片资源策略

| 策略 | 说明 |
|------|------|
| 优先展示RMCHM图片 | 107张标准药材图片 |
| 无图提示 | 显示"暂无图片"占位符 |
| 图片懒加载 | 使用 `loading="lazy"` |

---

## 九、总结

### 9.1 RMCHM 核心价值

1. **数据量最大**：714条，超越TCMSP(502)和SymMap(698)
2. **官方合规**：106种药食同源100%覆盖国家卫健委目录
3. **图片资源**：107张标准药材图片，填补空白
4. **质量评分**：唯一具有data_quality_score的数据源
5. **数据融合**：整合TCMSP+SymMap优势，修正错误数据

### 9.2 集成关键点

| 层级 | 关键文件 | 关键变更 |
|------|---------|---------|
| 模型 | `external_data.py` | 新增 RMCHMHerb 类 |
| API | `herbs.py` | 新增 /herbs/rmchm 端点 |
| 类型 | `types/index.ts` | 新增 RMCHMHerb 接口 |
| API客户端 | `database.ts` | 新增 searchRmchmHerbs 方法 |
| 前端组件 | `HerbsTab.tsx` | 新增 RMCHM 数据源支持 |

### 9.3 预期效果

- 用户可在药材检索页直接切换查看 RMCHM 数据
- 药材详情页展示多源数据对比
- 统计看板新增 RMCHM 专属数据
- 药食同源筛选优先展示 RMCHM 数据（官方来源）

---

**报告完毕，等待下一步指示。**
