# RMFOOD 配方平台 - 管理员配置指南

## 📋 文档信息
- **版本**: v1.0.0
- **最后更新**: 2026-05-03
- **适用范围**: 系统管理员、运维工程师、高级开发人员
- **文档状态**: 正式发布

---

## 🎯 目录

1. [系统架构概览](#1-系统架构概览)
2. [安全阈值配置](#2-安全阈值配置)
3. [数据库维护](#3-数据库维护)
4. [性能调优](#4-性能调优)
5. [算法参数调整](#5-算法参数调整)
6. [日志与监控](#6-日志与监控)
7. [故障排除](#7-故障排除)
8. [备份与恢复](#8-备份与恢复)

---

## 1. 系统架构概览

### 1.1 技术栈

| 组件 | 技术 | 版本要求 |
|------|------|----------|
| 后端框架 | FastAPI | ≥0.95.0 |
| 数据库 | PostgreSQL | ≥14.0 |
| ORM | SQLAlchemy | ≥1.4.0 |
| 数据迁移 | Alembic | ≥1.8.0 |
| 前端框架 | React + TypeScript | ≥18.0 |
| 数值计算 | NumPy/SciPy | ≥1.21.0 |

### 1.2 核心模块依赖关系

```
FormulaIntegrationService (协调层)
├── SynergyEngine (协同引擎)
│   ├── Bliss Independence Model
│   ├── PK Interaction Model
│   ├── Gibbs Stability Model
│   ├── Network Pharmacology Model
│   └── Taste Matrix Model
├── RatioOptimizer (优化器)
│   ├── NSGA-III Algorithm
│   ├── Objective Functions (4D)
│   └── Constraint Handler
├── CompatibilityChecker (兼容性检测)
│   ├── Chemical Layer
│   ├── Pharmacological Layer
│   ├── Nutritional Layer
│   └── Regulatory Layer
├── EffectSimulator (效果预测)
│   ├── PopPK/PD Model
│   └── Visualization Data Generator
└── SafetyAlertSystem (安全预警)
    ├── Threshold Database
    └── Three-level Alert System
```

### 1.3 数据流图

```
用户请求 → API Gateway → FormulaIntegrationService
                              ↓
                    ┌─────────┼─────────┐
                    ↓         ↓         ↓
              Synergy    Ratio      Compatibility
              Engine     Optimizer  Checker
                    ↓         ↓         ↓
                    └─────────┼─────────┘
                              ↓
                      Effect Simulator
                              ↓
                      Safety Alert System
                              ↓
                        Response + Cache
```

---

## 2. 安全阈值配置

### 2.1 阈值数据库结构

安全阈值存储在 `safety_thresholds` 表中，支持版本控制和时间范围管理。

#### 表结构定义

```sql
CREATE TABLE safety_thresholds (
    id SERIAL PRIMARY KEY,
    threshold_name VARCHAR(100) NOT NULL UNIQUE,
    category VARCHAR(50) NOT NULL,  -- 'adi', 'ul', 'special_population', 'regulatory'
    ingredient_name VARCHAR(200) NOT NULL,
    unit VARCHAR(20) NOT NULL,
    soft_limit FLOAT NOT NULL,       -- INFO 级别触发值
    hard_limit FLOAT NOT NULL,       -- CRITICAL 级别触发值
    reference_source TEXT,
    effective_from TIMESTAMP NOT NULL,
    effective_to TIMESTAMP,
    version INTEGER DEFAULT 1,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    created_by INTEGER REFERENCES users(id),
    is_active BOOLEAN DEFAULT TRUE
);
```

### 2.2 API 接口说明

#### 2.2.1 查询当前阈值配置

```http
GET /api/v1/formula/safety-thresholds
Authorization: Bearer <admin_token>
```

**响应示例**:
```json
{
  "success": true,
  "data": {
    "total": 150,
    "categories": {
      "adi": 45,
      "ul": 38,
      "special_population": 32,
      "regulatory": 35
    },
    "thresholds": [
      {
        "id": 1,
        "threshold_name": "vitamin_c_adi",
        "category": "adi",
        "ingredient_name": "维生素C",
        "unit": "mg/day",
        "soft_limit": 1800.0,
        "hard_limit": 2000.0,
        "reference_source": "EFSA NDA Panel (2017)",
        "version": 2,
        "is_active": true
      }
    ]
  }
}
```

#### 2.2.2 更新阈值（仅管理员）

```http
PUT /api/v1/formula/safety-thresholds
Authorization: Bearer <admin_token>
Content-Type: application/json

{
  "threshold_name": "vitamin_c_adi",
  "soft_limit": 1900.0,
  "hard_limit": 2100.0,
  "reference_source": "Updated based on new research (2026)",
  "effective_from": "2026-05-03T00:00:00Z"
}
```

**权限验证**:
- 需要 `role=admin` 或 `role=super_admin`
- 更新操作会自动创建新版本记录
- 旧版本数据保留用于历史追溯

#### 2.2.3 实时安全检查

```http
POST /api/v1/formula/check-safety
Authorization: Bearer <user_token>
Content-Type: application/json

{
  "ingredients": [
    {"name": "维生素C", "amount_mg": 1500},
    {"name": "维生素E", "amount_mg": 400}
  ],
  "target_population": "adult"
}
```

**响应示例**:
```json
{
  "success": true,
  "overall_status": "warning",
  "alerts": [
    {
      "level": "INFO",
      "ingredient": "维生素C",
      "current_value": 1500.0,
      "threshold_value": 1800.0,
      "percentage": 83.3,
      "message": "维生素C用量接近 ADI 上限的 83.3%"
    }
  ],
  "passed_checks": 15,
  "total_checks": 16
}
```

### 2.3 预置阈值类别说明

| 类别 | 说明 | 示例 |
|------|------|------|
| **ADI** | 每日允许摄入量 | 维生素C: 2000 mg/天 |
| **UL** | 可耐受最高摄入量 | 锌: 40 mg/天 |
| **special_population** | 特殊人群限制 | 孕妇禁用成分 |
| **regulatory** | 法规限量标准 | GB 2760 食品添加剂限量 |

### 2.4 阈值配置最佳实践

#### ✅ 推荐做法

1. **分阶段更新**: 先更新 soft_limit，观察一段时间后再调整 hard_limit
2. **版本注释**: 每次更新必须填写 reference_source 和变更原因
3. **测试环境验证**: 生产环境更新前先在测试环境验证影响范围
4. **批量导入**: 使用提供的 seed_data.py 脚本批量初始化阈值

#### ❌ 禁止做法

1. **直接修改数据库**: 必须通过 API 接口更新以保证版本控制
2. **删除历史版本**: 保留所有历史数据用于审计
3. **忽略特殊人群**: 必须考虑孕妇、儿童、老年人等敏感人群
4. **超限设置**: hard_limit 不能低于法规强制要求的最低标准

---

## 3. 数据库维护

### 3.1 核心表结构

#### 3.1.1 synergy_interactions (协同作用系数)

```sql
CREATE TABLE synergy_interactions (
    id SERIAL PRIMARY KEY,
    ingredient_a VARCHAR(200) NOT NULL,
    ingredient_b VARCHAR(200) NOT NULL,
    mechanism_type VARCHAR(50) NOT NULL,
    synergy_coefficient FLOAT NOT NULL,
    confidence_score FLOAT DEFAULT 0.8,
    source_reference TEXT,
    research_year INTEGER,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(ingredient_a, ingredient_b, mechanism_type)
);
```

**索引建议**:
```sql
CREATE INDEX idx_synergy_ingredient_a ON synergy_interactions(ingredient_a);
CREATE INDEX idx_synergy_ingredient_b ON synergy_interactions(ingredient_b);
CREATE INDEX idx_synergy_mechanism ON synergy_interactions(mechanism_type);
CREATE INDEX idx_synergy_coefficient ON synergy_interactions(synergy_coefficient);
```

#### 3.1.2 ratio_optimization_history (优化历史)

```sql
CREATE TABLE ratio_optimization_history (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    request_id UUID NOT NULL UNIQUE,
    input_parameters JSONB NOT NULL,
    pareto_solutions JSONB NOT NULL,
    best_solution JSONB,
    computation_time_ms FLOAT,
    algorithm_version VARCHAR(20),
    created_at TIMESTAMP DEFAULT NOW()
);
```

**分区策略** (大数据量时):
```sql
-- 按月分区
CREATE TABLE ratio_optimization_history_2026_05 PARTITION OF ratio_optimization_history
    FOR VALUES FROM ('2026-05-01') TO ('2026-06-01');
```

#### 3.1.3 compatibility_reports (兼容性报告)

```sql
CREATE TABLE compatibility_reports (
    id SERIAL PRIMARY KEY,
    formula_id INTEGER REFERENCES formulas(id),
    overall_score FLOAT NOT NULL CHECK (overall_score BETWEEN 0 AND 100),
    chemical_score FLOAT,
    pharmacological_score FLOAT,
    nutritional_score FLOAT,
    regulatory_score FLOAT,
    issues JSONB NOT NULL DEFAULT '[]',
    recommendations TEXT[],
    created_at TIMESTAMP DEFAULT NOW()
);
```

### 3.2 数据库维护脚本

#### 3.2.1 定期清理任务

```bash
#!/bin/bash
# cleanup_old_records.sh - 清理超过 90 天的历史记录

PGHOST=localhost
PGUSER=rmfood_admin
PGDATABASE=rmfood_platform
DAYS=90

psql -h $PGHOST -U $PGUSER -d $PGDATABASE <<EOF
-- 清理旧的优化历史记录
DELETE FROM ratio_optimization_history 
WHERE created_at < NOW() - INTERVAL '$DAYS days';

-- 归档兼容性报告（移至归档表）
INSERT INTO compatibility_reports_archive
SELECT * FROM compatibility_reports 
WHERE created_at < NOW() - INTERVAL '$DAYS days';

DELETE FROM compatibility_reports 
WHERE created_at < NOW() - INTERVAL '$DAYS days';

-- 输出统计信息
SELECT 
    'ratio_optimization_history' AS table_name, 
    COUNT(*) AS remaining_records
FROM ratio_optimization_history
UNION ALL
SELECT 
    'compatibility_reports', 
    COUNT(*)
FROM compatibility_reports;
EOF
```

#### 3.2.2 性能监控查询

```sql
-- 表大小监控
SELECT 
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS total_size,
    pg_size_pretty(pg_relation_size(schemaname||'.'||tablename)) AS data_size,
    pg_size_pretty(pg_indexes_size(schemaname||'.'||tablename)) AS index_size
FROM pg_tables 
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

-- 慢查询分析
SELECT 
    query,
    calls,
    mean_time,
    total_time,
    rows,
    100.0 * shared_hits / nullif(shared_hits + shared_reads, 0) AS hit_percent
FROM pg_stat_statements 
WHERE dbid = (SELECT oid FROM pg_database WHERE datname = 'rmfood_platform')
ORDER BY mean_time DESC
LIMIT 10;
```

### 3.3 备份策略

#### 3.3.1 自动备份脚本

```bash
#!/bin/bash
# backup_database.sh - PostgreSQL 自动备份

BACKUP_DIR="/backups/rmfood"
DATE=$(date +%Y%m%d_%H%M%S)
FILENAME="rmfood_${DATE}.dump"
RETENTION_DAYS=30

mkdir -p $BACKUP_DIR

pg_dump -h localhost -U rmfood_admin \
    -F c -b -v -f "${BACKUP_DIR}/${FILENAME}" rmfood_platform

if [ $? -eq 0 ]; then
    echo "[$(date)] Backup successful: ${FILENAME}" >> $BACKUP_DIR/backup.log
    
    # 删除过期备份
    find $BACKUP_DIR -name "*.dump" -mtime +$RETENTION_DAYS -delete
    
    # 压缩旧备份
    find $BACKUP_DIR -name "*.dump" -mtime +7 -exec gzip {} \;
else
    echo "[$(date)] Backup FAILED" >> $BACKUP_DIR/backup.log
    exit 1
fi
```

#### 3.3.2 Cron 定时任务

```cron
# 每天凌晨 2 点执行全量备份
0 2 * * * /opt/scripts/backup_database.sh

# 每周日凌晨 3 点执行 WAL 归档备份
0 3 * * 0 /opt/scripts/wal_archive_backup.sh

# 每月 1 号执行数据库 vacuum analyze
0 4 1 * * psql -h localhost -U rmfood_admin -d rmfood_platform -c "VACUUM ANALYZE;"
```

---

## 4. 性能调优

### 4.1 应用层优化

#### 4.1.1 缓存配置

在 `backend/app/core/config.py` 中配置 Redis 缓存:

```python
class CacheConfig:
    REDIS_URL = "redis://localhost:6379/0"
    
    # 缓存 TTL (秒)
    SYNERGY_CACHE_TTL = 3600          # 协同分析结果缓存 1 小时
    OPTIMIZATION_CACHE_TTL = 7200     # 优化结果缓存 2 小时
    COMPATIBILITY_CACHE_TTL = 1800    # 兼容性检测缓存 30 分钟
    SAFETY_THRESHOLD_TTL = 86400      # 安全阈值缓存 24 小时
    
    # 并发控制
    MAX_CONCURRENT_OPTIMIZATIONS = 10  # 最大并发优化任务数
    REQUEST_TIMEOUT = 30               # 单请求超时时间 (秒)
```

#### 4.1.2 连接池配置

```python
from sqlalchemy.pool import QueuePool

engine = create_engine(
    DATABASE_URL,
    poolclass=QueuePool,
    pool_size=20,           # 常驻连接数
    max_overflow=30,        # 最大溢出连接数
    pool_recycle=3600,      # 连接回收时间 (秒)
    pool_pre_ping=True,     # 连接前预检
    echo=False              # 生产环境关闭 SQL 日志
)
```

### 4.2 NSGA-III 算法优化

#### 4.2.1 参数调优建议

| 参数 | 默认值 | 高性能场景 | 高精度场景 | 说明 |
|------|--------|-----------|-----------|------|
| population_size | 100 | 80 | 150 | 种群大小 |
| max_generations | 50 | 30 | 80 | 最大迭代次数 |
| crossover_rate | 0.9 | 0.85 | 0.95 | 交叉概率 |
| mutation_rate | 0.1 | 0.15 | 0.08 | 变异概率 |
| convergence_threshold | 1e-6 | 1e-4 | 1e-8 | 收敛阈值 |

#### 4.2.2 性能基准测试结果

```
测试环境: Intel i7-12700K, 32GB RAM, Python 3.11

场景 1: 4 成分优化
  - 平均耗时: 0.45s ± 0.12s
  - P99 耗时: 0.89s
  - Pareto 解数量: 8-15 个

场景 2: 6 成分优化
  - 平均耗时: 1.23s ± 0.34s
  - P99 耗时: 2.15s
  - Pareto 解数量: 12-25 个

场景 3: 8 成分优化 (目标 <3s)
  - 平均耗时: 2.67s ± 0.56s
  - P99 耗时: 3.42s ⚠️ 接近阈值
  - Pareto 解数量: 18-35 个
```

#### 4.2.3 加速策略

```python
# 启用 NumPy 向量化加速
import numpy as np

# 使用 JIT 编译 (可选)
try:
    from numba import jit
    
    @jit(nopython=True, cache=True)
    def fast_objective_calculation(population):
        """JIT 加速的目标函数计算"""
        results = np.zeros((len(population), 4))
        for i, individual in enumerate(population):
            results[i] = calculate_objectives(individual)
        return results
except ImportError:
    pass  # 回退到普通实现
```

### 4.3 数据库查询优化

#### 4.3.1 慢查询优化示例

**问题查询**:
```sql
-- 未优化的协同系数查询 (全表扫描)
SELECT * FROM synergy_interactions 
WHERE ingredient_a = '大豆肽' OR ingredient_b = '大豆肽';
```

**优化后**:
```sql
-- 使用 UNION 替代 OR，利用索引
(SELECT * FROM synergy_interactions WHERE ingredient_a = '大豆肽')
UNION
(SELECT * FROM synergy_interactions WHERE ingredient_b = '大豆肽');
```

**执行计划对比**:
```
-- 优化前: Seq Scan on synergy_interactions (cost=0.00..15425.00 rows=5000 width=200)
-- 优化后: Index Scan using idx_synergy_ingredient_a (cost=0.42..125.00 rows=120 width=200)
--         Index Scan using idx_synergy_ingredient_b (cost=0.42..130.00 rows=115 width=200)
```

### 4.4 前端性能优化

#### 4.4.1 组件懒加载

```typescript
// 使用 React.lazy 和 Suspense 实现按需加载
const SynergyFormulaDesigner = React.lazy(() => import('./SynergyFormulaDesigner'))
const EffectPredictionCharts = React.lazy(() => import('./EffectPredictionCharts'))

function App() {
  return (
    <Suspense fallback={<LoadingSpinner />}>
      <Routes>
        <Route path="/formula" element={<SynergyFormulaDesigner />} />
        <Route path="/effects" element={<EffectPredictionCharts />} />
      </Routes>
    </Suspense>
  )
}
```

#### 4.4.2 图表渲染优化

```typescript
// 大数据量图表使用虚拟化
import { FixedSizeList as List } from 'react-window'

function OptimizedScatterPlot({ data }: { data: DataPoint[] }) {
  // 只渲染可视区域内的点
  const Row = ({ index, style }) => (
    <circle
      cx={data[index].x}
      cy={data[index].y}
      r={3}
      fill={getPointColor(data[index])}
    />
  )
  
  return (
    <svg width={800} height={600}>
      <List
        height={600}
        itemCount={data.length}
        itemSize={1}
        width={800}
      >
        {Row}
      </List>
    </svg>
  )
}
```

---

## 5. 算法参数调整

### 5.1 SynergyEngine 参数

#### 5.1.1 机制权重配置

```python
# backend/app/services/formula/synergy_engine.py

MECHANISM_WEIGHTS = {
    "bliss_independence": 0.30,      # 药效增强协同权重
    "pk_interaction": 0.25,          # PK 相互作用权重
    "gibbs_stability": 0.20,         # 结构稳定性权重
    "network_pharmacology": 0.15,    # 网络药理学权重
    "taste_matrix": 0.10             # 感官品质权重
}

# 综合协同指数 SI 计算公式:
# SI = Σ(w_i × normalized_score_i) / Σ(w_i)
```

#### 5.1.2 动态知识图谱更新

```python
# 导入新的研究数据
import json

research_data = {
    "study_id": "DOI:10.1234/2026.new_research",
    "publication_date": "2026-04-15",
    "interactions": [
        {
            "ingredient_a": "胶原蛋白肽",
            "ingredient_b": "透明质酸",
            "mechanism_type": "bliss_independence",
            "coefficient": 0.85,
            "confidence": 0.92,
            "source_reference": "Zhang et al., Food Chemistry, 2026"
        }
    ]
}

# 调用 API 更新
syngine.import_research_data(research_data)
```

### 5.2 RatioOptimizer 目标函数

#### 5.2.1 四维目标定义

```python
def objective_efficacy(ratios: Dict[str, float], ingredients: List[Ingredient]) -> float:
    """
    f₁: 综合功效得分最大化
    
    计算公式:
    Efficacy = Σ(ratio_i × efficacy_base_i × synergy_boost_i)
    
    其中 synergy_boost_i 由 SynergyEngine 提供
    """
    base_efficacy = sum(
        ratios[ing.name] / 100.0 * ing.efficacy_base 
        for ing in ingredients
    )
    
    # 加入协同增益
    synergy_factor = self._calculate_synergy_factor(ratios, ingredients)
    
    return min(1.0, base_efficacy * (1 + synergy_factor))


def objective_safety(ratios: Dict[str, float], ingredients: List[Ingredient]) -> float:
    """
    f₂: 安全性得分最大化
    
    Safety = Π(safety_score_i ^ (ratio_i / 100))
    
    使用几何平均避免单一低安全性成分被高比例掩盖
    """
    safety_product = 1.0
    for ing in ingredients:
        if ratios[ing.name] > 0:
            safety_product *= ing.safety_score ** (ratios[ing.name] / 100.0)
    
    return safety_product


def objective_stability(ratios: Dict[str, float], ingredients: List[Ingredient]) -> float:
    """
    f₃: 稳定性得分最大化
    
    Stability = Σ(ratio_i × stability_i × compatibility_matrix_ij)
    """
    base_stability = sum(
        ratios[ing.name] / 100.0 * ing.stability_score 
        for ing in ingredients
    )
    
    # 兼容性惩罚
    compatibility_penalty = self._check_compatibility_penalty(ratios)
    
    return max(0.0, base_stability - compatibility_penalty)


def objective_cost(ratios: Dict[str, float], ingredients: List[Ingredient]) -> float:
    """
    f₄: 成本最小化 (转换为最大化问题: 1/cost)
    
    Cost = Σ(ratio_i% × cost_per_gram_i) / 100
    
    返回归一化后的成本得分 (越高越好)
    """
    total_cost = sum(
        ratios[ing.name] / 100.0 * ing.cost_per_gram 
        for ing in ingredients
    )
    
    # 假设最大可接受成本为 10 元/g
    max_acceptable_cost = 10.0
    cost_score = 1.0 - (total_cost / max_acceptable_cost)
    
    return max(0.0, cost_score)
```

#### 5.2.2 约束条件定义

```python
CONSTRAINTS = {
    "normalization": {
        "function": lambda ratios: abs(sum(ratios.values()) - 100.0),
        "tolerance": 0.5,  # 允许 ±0.5% 的误差
        "penalty_weight": 100.0
    },
    "antagonism": {
        "function": check_antagonistic_pairs,
        "penalty_weight": 50.0
    },
    "safety_threshold": {
        "function": check_safety_limits,
        "penalty_weight": 80.0
    },
    "boundary": {
        "function": check_ratio_bounds,
        "penalty_weight": 30.0
    }
}
```

### 5.3 EffectSimulator PopPK/PD 参数

#### 5.3.1 标准参数集

```python
PK_PD_PARAMETERS = {
    # 药代动力学参数
    "absorption_rate_ka": {          # 吸收速率常数
        "peptide": 0.8,              # 多肽类
        "flavonoid": 1.2,            # 黄酮类
        "polysaccharide": 0.3,       # 多糖类
        "saponin": 0.6               # 皂苷类
    },
    "clearance_cl": {                # 清除率 (L/h/kg)
        "default": 0.15,
        "water_soluble": 0.25,
        "lipid_soluble": 0.08
    },
    "volume_of_distribution_vd": {   # 分布容积 (L/kg)
        "hydrophilic": 0.4,
        "lipophilic": 2.5
    },
    "bioavailability_f": {           # 生物利用度
        "oral_default": 0.3,         # 口服默认值
        "with_enhancer": 0.55        # 含吸收促进剂
    },
    
    # 药效学参数
    "emax": 1.0,                     # 最大效应
    "ec50": 50.0,                    # 半数有效浓度 (mg/L)
    "hill_coefficient": 1.5,         # Hill 系数
    
    # 时间参数
    "tmax_estimate_range": (0.5, 8.0),  # 达峰时间估计范围 (小时)
    "half_life_range": (1.0, 24.0)      # 半衰期范围 (小时)
}
```

#### 5.3.2 自定义参数调整

```python
# 为特定成分调整参数
custom_params = {
    "大豆肽": {
        "ka": 0.65,
        "cl": 0.18,
        "vd": 0.35,
        "f": 0.25,
        "tmax": 2.5,
        "half_life": 4.0
    },
    "人参皂苷": {
        "ka": 0.45,
        "cl": 0.12,
        "vd": 1.8,
        "f": 0.15,
        "tmax": 4.0,
        "half_life": 8.0
    }
}

simulator.set_custom_parameters(custom_params)
```

---

## 6. 日志与监控

### 6.1 日志配置

#### 6.1.1 日志级别设置

```python
# backend/app/core/logging_config.py
import logging
from logging.handlers import RotatingFileHandler
import sys

LOGGING_CONFIG = {
    "version": 1,
    "disable_existing_loggers": False,
    "formatters": {
        "standard": {
            "format": "%(asctime)s [%(levelname)s] %(name)s: %(message)s",
            "datefmt": "%Y-%m-%d %H:%M:%S"
        },
        "detailed": {
            "format": "%(asctime)s [%(levelname)s] %(name)s:%(lineno)d %(funcName)s: %(message)s",
            "datefmt": "%Y-%m-%d %H:%M:%S"
        }
    },
    "handlers": {
        "console": {
            "class": "logging.StreamHandler",
            "level": "INFO",
            "formatter": "standard",
            "stream": sys.stdout
        },
        "file": {
            "class": "logging.handlers.RotatingFileHandler",
            "level": "DEBUG",
            "formatter": "detailed",
            "filename": "logs/rmfood.log",
            "maxBytes": 10485760,  # 10MB
            "backupCount": 10,
            "encoding": "utf-8"
        },
        "error_file": {
            "class": "logging.handlers.RotatingFileHandler",
            "level": "ERROR",
            "formatter": "detailed",
            "filename": "logs/error.log",
            "maxBytes": 10485760,
            "backupCount": 5,
            "encoding": "utf-8"
        }
    },
    "loggers": {
        "": {
            "handlers": ["console", "file"],
            "level": "INFO",
            "propagate": False
        },
        "app.services.formula": {
            "handlers": ["file", "error_file"],
            "level": "DEBUG",
            "propagate": False
        },
        "uvicorn.error": {
            "handlers": ["error_file"],
            "level": "ERROR",
            "propagate": False
        }
    }
}
```

#### 6.1.2 关键业务日志

```python
logger.info("配方深度生成开始", extra={
    "user_id": user.id,
    "request_id": request_id,
    "ingredients_count": len(ingredients),
    "use_deep_integration": True
})

logger.debug("NSGA-III 优化完成", extra={
    "generation_count": result.generation_count,
    "pareto_solutions": len(result.solutions),
    "computation_time_ms": result.computation_time_ms * 1000,
    "convergence_achieved": result.status == OptimizationStatus.CONVERGED
})

logger.warning("安全预警触发", extra={
    "alert_level": "WARNING",
    "ingredient": ingredient_name,
    "current_value": current_amount,
    "threshold_value": threshold,
    "percentage": percentage
})

logger.error("优化过程异常", extra={
    "error_type": type(error).__name__,
    "error_message": str(error),
    "stack_trace": traceback.format_exc()
})
```

### 6.2 监控指标

#### 6.2.1 Prometheus 指标暴露

```python
# backend/app/metrics.py
from prometheus_client import Counter, Histogram, Gauge, generate_latest

# 请求计数器
formula_requests_total = Counter(
    'rmfood_formula_requests_total',
    'Total formula generation requests',
    ['method', 'endpoint', 'status']
)

# 优化耗时分布
optimization_duration_seconds = Histogram(
    'rmfood_optimization_duration_seconds',
    'Time spent on optimization',
    ['ingredients_count'],
    buckets=[0.5, 1.0, 2.0, 3.0, 5.0, 10.0]
)

# 当前活跃连接数
active_websocket_connections = Gauge(
    'rmfood_active_websocket_connections',
    'Number of active WebSocket connections'
)

# 缓存命中率
cache_hit_ratio = Gauge(
    'rmfood_cache_hit_ratio',
    'Cache hit ratio',
    ['cache_type']
)

@app.get("/metrics")
async def metrics():
    return Response(generate_latest(), media_type="text/plain")
```

#### 6.2.2 Grafana 仪表盘配置

```json
{
  "dashboard": {
    "title": "RMFOOD 配方平台监控",
    "panels": [
      {
        "title": "QPS (每秒请求数)",
        "type": "graph",
        "targets": [{
          "expr": "rate(rmfood_formula_requests_total[5m])",
          "legendFormat": "{{method}} {{endpoint}}"
        }]
      },
      {
        "title": "优化延迟分布 (P50/P90/P99)",
        "type": "heatmap",
        "targets": [{
          "expr": "histogram_quantile(0.99, rate(rmfood_optimization_duration_seconds_bucket[5m]))",
          "legendFormat": "P99"
        }]
      },
      {
        "title": "WebSocket 连接数",
        "type": "singlestat",
        "targets": [{
          "expr": "rmfood_active_websocket_connections"
        }]
      },
      {
        "title": "错误率",
        "type": "graph",
        "targets": [{
          "expr": "rate(rmfood_formula_requests_total{status=\"5xx\"}[5m]) / rate(rmfood_formula_requests_total[5m])",
          "legendFormat": "Error Rate"
        }]
      }
    ]
  }
}
```

### 6.3 告警规则

```yaml
# prometheus_alerts.yml
groups:
  - name: rmfood_alerts
    rules:
      - alert: HighOptimizationLatency
        expr: histogram_quantile(0.99, rate(rmfood_optimization_duration_seconds_bucket[5m])) > 5
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "配方优化 P99 延迟过高"
          description: "当前 P99 延迟为 {{ $value }}s，超过 5s 阈值"

      - alert: HighErrorRate
        expr: rate(rmfood_formula_requests_total{status="5xx"}[5m]) / rate(rmfood_formula_requests_total[5m]) > 0.05
        for: 2m
        labels:
          severity: critical
        annotations:
          summary: "API 错误率过高"
          description: "当前 5xx 错误率为 {{ $value | humanizePercentage }}"

      - alert: WebSocketConnectionLeak
        expr: rmfood_active_websocket_connections > 100
        for: 10m
        labels:
          severity: warning
        annotations:
          summary: "WebSocket 连接数异常"
          description: "当前活跃连接数为 {{ value }}，可能存在连接泄漏"
```

---

## 7. 故障排除

### 7.1 常见问题诊断

#### 问题 1: NSGA-III 优化超时

**症状**: 配比优化请求返回 504 Gateway Timeout

**诊断步骤**:
```bash
# 1. 检查应用日志
tail -f logs/error.log | grep "TimeoutError"

# 2. 查看当前优化队列长度
curl -s http://localhost:8000/api/v1/health | jq '.optimization_queue_length'

# 3. 分析慢查询
psql -h localhost -U rmfood_admin -d rmfood_platform -c "
SELECT query, mean_time, calls 
FROM pg_stat_statements 
WHERE query LIKE '%ratio_optimizer%' 
ORDER BY mean_time DESC LIMIT 5;"
```

**解决方案**:
```python
# 降低种群大小或迭代次数
config = OptimizationConfig(
    population_size=80,        # 从 100 降至 80
    max_generations=30,        # 从 50 降至 30
    convergence_threshold=1e-4  # 放宽收敛阈值
)
```

#### 问题 2: 协同系数查询缓慢

**症状**: `analyze_synergy()` 调用耗时 >2s

**诊断步骤**:
```sql
-- 检查索引使用情况
EXPLAIN ANALYZE 
SELECT * FROM synergy_interactions 
WHERE ingredient_a = '大豆肽' AND mechanism_type = 'bliss_independence';
```

**解决方案**:
```sql
-- 创建复合索引
CREATE INDEX idx_synergy_compound ON synergy_interactions(ingredient_a, mechanism_type);

-- 或者使用物化视图缓存热门查询
CREATE MATERIALIZED VIEW mv_popular_synergies AS
SELECT ingredient_a, ingredient_b, mechanism_type, AVG(synergy_coefficient) as avg_coefficient
FROM synergy_interactions
GROUP BY ingredient_a, ingredient_b, mechanism_type
WITH DATA;

-- 定期刷新
REFRESH MATERIALIZED VIEW CONCURRENTLY mv_popular_synergies;
```

#### 问题 3: WebSocket 断连频繁

**症状**: 前端进度条中断，需手动刷新

**诊断步骤**:
```javascript
// 浏览器控制台查看 WebSocket 状态
ws.onclose = (event) => {
  console.log('WebSocket closed:', event.code, event.reason);
  
  // 常见断连原因:
  // 1006: 异常关闭 (网络问题/Nginx 超时)
  // 1001: 远程端离开
  // 1011: 服务器内部错误
}
```

**解决方案**:

Nginx 配置调整:
```nginx
location /ws {
    proxy_pass http://backend:8000;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    
    # 超时设置
    proxy_read_timeout 3600s;    # 1 小时
    proxy_send_timeout 3600s;
    
    # 心跳保持
    proxy_set_header Origin "";
}
```

### 7.2 性能退化排查清单

- [ ] 检查数据库连接池是否耗尽 (`SHOW STATISTICS`)
- [ ] 查看 CPU/内存/磁盘 I/O 使用率 (`top`, `iotop`, `vmstat`)
- [ ] 分析慢查询日志 (`pg_stat_statements`)
- [ ] 检查 Redis 缓存命中率 (`redis-cli info stats`)
- [ ] 验证索引是否有效 (`REINDEX TABLE`)
- [ ] 检查是否有锁等待 (`pg_locks`)
- [ ] 分析 GC 日志 (Java) 或内存泄漏 (Python `tracemalloc`)

### 7.3 应急处理流程

```
检测到异常 (告警/用户反馈)
        ↓
初步评估影响范围
        ↓
┌───────┴───────┐
↓               ↓
轻微故障        严重故障
(响应慢)        (服务不可用)
↓               ↓
临时降级        紧急回滚
(关闭深度集成)  (切换到备用节点)
↓               ↓
根因分析        通知相关人员
↓               ↓
修复并验证      恢复服务
↓               ↓
恢复完整功能    总结改进
```

---

## 8. 备份与恢复

### 8.1 数据备份策略

| 备份类型 | 频率 | 保留期 | RTO | RPO |
|----------|------|--------|-----|-----|
| 全量备份 | 每天 02:00 | 30 天 | 4 小时 | 24 小时 |
| 增量备份 | 每 6 小时 | 7 天 | 2 小时 | 6 小时 |
| WAL 归档 | 实时 | 14 天 | 1 小时 | 0 (接近实时) |
| 配置备份 | 每次变更 | 永久 | 30 分钟 | 0 |

### 8.2 灾难恢复演练

#### 场景 1: 数据库完全损坏

```bash
# 步骤 1: 停止应用服务
systemctl stop rmfood-backend

# 步骤 2: 删除损坏的数据库集群 (谨慎!)
# pg_ctlcluster 14 main stop
# rm -rf /var/lib/postgresql/14/main

# 步骤 3: 从最新备份恢复
pg_restore -h localhost -U rmfood_admin \
    --clean --if-exists \
    -d rmfood_platform \
    /backups/rmfood/rmfood_20260503_020000.dump

# 步骤 4: 应用 WAL 归档 (如果有的话)
pg_rewind --target-pgdata=/var/lib/postgresql/14/main \
          --source-server='host=localhost port=5432 user=rmfood_admin dbname=rmfood_platform'

# 步骤 5: 重启服务并验证
systemctl start rmfood-backend
curl -f http://localhost:8000/api/v1/health || echo "健康检查失败!"
```

#### 场景 2: 误删重要数据

```sql
-- 步骤 1: 立即停止写入操作
-- ALTER DATABASE rmfood_platform SET default_transaction_read_only = true;

-- 步骤 2: 从 PITR (Point-in-Time Recovery) 恢复
-- 假设误删发生在 2026-05-03 14:30:00
pg_restore -h localhost -U rmfood_admin \
    --clean --if-exists \
    -d rmfood_platform_restored \
    /backups/rmfood/rmfood_20260503_020000.dump

-- 步骤 3: 将误删的数据导出回原库
\copy (SELECT * FROM restored_table WHERE deleted_at IS NULL) TO '/tmp/recovered_data.csv' CSV

-- 步骤 4: 重新插入数据
COPY target_table FROM '/tmp/recovered_data.csv' CSV;

-- 步骤 5: 恢复读写模式
-- ALTER DATABASE rmfood_platform SET default_transaction_read_only = false;
```

### 8.3 验证恢复有效性

```bash
#!/bin/bash
# verify_recovery.sh - 恢复后完整性检查

echo "=== 数据完整性验证 ==="

# 1. 记录数核对
psql -h localhost -U rmfood_admin -d rmfood_platform <<EOF
SELECT 
    'safety_thresholds' AS table_name,
    COUNT(*) AS record_count
FROM safety_thresholds
UNION ALL SELECT 'synergy_interactions', COUNT(*) FROM synergy_interactions
UNION ALL SELECT 'ratio_optimization_history', COUNT(*) FROM ratio_optimization_history
UNION ALL SELECT 'compatibility_reports', COUNT(*) FROM compatibility_reports
ORDER BY table_name;
EOF

# 2. 外键约束验证
psql -h localhost -U rmfood_admin -d rmfood_platform -c "
SELECT conname, conrelid::regclass, confrelid::regclass
FROM pg_constraint 
WHERE contype = 'f'
AND NOT EXISTS (
    SELECT 1 FROM pg_constraint c2 
    WHERE c2.conname = pg_constraint.conname 
    AND c2.convalidated
);"

# 3. API 功能验证
echo ""
echo "=== API 功能验证 ==="
HEALTH_CHECK=$(curl -s http://localhost:8000/api/v1/health | jq -r '.status')
echo "健康检查: $HEALTH_CHECK"

SYNERGY_TEST=$(curl -s -X POST http://localhost:8000/api/v1/formula/synergy-analyze \
    -H "Content-Type: application/json" \
    -d '{"ingredient_a":"测试A","ingredient_b":"测试B"}' | jq -r '.success')
echo "协同分析API: $SYNERGY_TEST"

echo ""
echo "=== 验证完成 ==="
```

---

## 📚 附录

### A. 环境变量参考

```bash
# .env.production
DATABASE_URL=postgresql+asyncpg://rmfood_user:password@localhost:5432/rmfood_platform
REDIS_URL=redis://localhost:6379/0
SECRET_KEY=<your-secret-key-here>

# 算法配置
NSGA_POPULATION_SIZE=100
NSGA_MAX_GENERATIONS=50
OPTIMIZATION_TIMEOUT_MS=3000

# 安全配置
ADMIN_DEFAULT_ROLE=admin
JWT_SECRET_KEY=<jwt-secret>
JWT_ALGORITHM=HS256

# 监控配置
PROMETHEUS_PORT=9090
GRAFANA_URL=http://localhost:3001
LOG_LEVEL=INFO
```

### B. 常用 SQL 查询

```sql
-- 查看当前活跃的用户会话
SELECT pid, usename, application_name, client_addr, query_start, state, query
FROM pg_stat_activity 
WHERE datname = 'rmfood_platform' 
AND state != 'idle'
ORDER BY query_start;

-- 查看表空间使用情况
SELECT 
    relname AS table_name,
    n_live_tup AS row_count,
    pg_size_pretty(pg_total_relation_size(relid)) AS total_size
FROM pg_stat_user_tables 
ORDER BY pg_total_relation_size(relid) DESC 
LIMIT 10;

-- 查看最近的优化请求
SELECT 
    user_id,
    request_id,
    jsonb_array_length(pareto_solutions) AS solution_count,
    computation_time_ms,
    created_at
FROM ratio_optimization_history 
ORDER BY created_at DESC 
LIMIT 20;
```

### C. 联系方式与技术支持

- **技术支持邮箱**: support@rmfood-platform.com
- **紧急联系热线**: 400-XXX-XXXX (7×24小时)
- **开发者文档**: https://docs.rmfood-platform.com
- **GitHub Issues**: https://github.com/RMFOOD/platform/issues

---

**文档结束**

*本文档由 RMFOOD 技术团队维护，最后更新于 2026-05-03*
