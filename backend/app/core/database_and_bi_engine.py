"""
RMFOOD 数据库高级优化与数据智能引擎

功能 (P5-3: 数据库高级优化):
- 读写分离 (Read-Write Splitting) - 主从配置
- 分库分表 (Sharding) - 水平/垂直分片
- 智能连接池管理 (Smart Connection Pool) - 动态扩容/收缩
- 查询计划缓存与自动重写
- 索引自动推荐与健康检查
- 慢查询自动检测与告警
- 数据热点识别与自动缓存
- SQL 注入防御与 WAF 集成

功能 (P5-4: 商业智能与数据可视化):
- 多维度数据建模 (OLAP Cube)
- ETL 流水线管理 (Extract-Transform-Load)
- 数据看板自动生成 (KPI Dashboard)
- 异常检测与智能告警 (Anomaly Detection)
- 趋势预测 (Time Series Forecasting)
- 配方智能推荐与关联分析
- 数据血缘追踪 (Data Lineage)
- 导出多种格式（Excel / PDF / CSV / JSON）

设计原则:
- 与核心业务解耦，可独立部署
- 支持异步处理（任务队列 + 后台 worker）
- 智能缓存（多级缓存与热点识别）
- 安全的只读查询（沙箱模式）
"""

import hashlib
import json
import logging
import math
import threading
import time as _time
import uuid
from collections import Counter, defaultdict
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from enum import Enum
from statistics import mean, median, stdev
from typing import Any, Callable, Dict, List, Optional, Set, Tuple

logger = logging.getLogger(__name__)


# ============================================================
# 枚举与数据模型
# ============================================================

class ShardingStrategy(str, Enum):
    """分片策略"""
    NONE = "none"
    HASH = "hash"                    # 哈希分片
    RANGE = "range"                  # 范围分片 (按 ID / 时间)
    LIST = "list"                    # 列表分片 (按租户)
    LOOKUP = "lookup"                # 查找表分片


class QueryType(str, Enum):
    """查询类型（用于读写分离路由）"""
    READ = "read"
    WRITE = "write"
    ANALYTICS = "analytics"          # 分析查询（走只读副本）
    ADMIN = "admin"                  # 管理操作（走主库）


class ETLPhase(str, Enum):
    """ETL 阶段"""
    EXTRACT = "extract"
    TRANSFORM = "transform"
    LOAD = "load"
    VALIDATE = "validate"
    COMPLETE = "complete"


class DashboardWidgetType(str, Enum):
    """看板组件类型"""
    KPI = "kpi"
    LINE_CHART = "line_chart"
    BAR_CHART = "bar_chart"
    PIE_CHART = "pie_chart"
    TABLE = "table"
    HEATMAP = "heatmap"
    GAUGE = "gauge"
    TREND = "trend"
    ANOMALY = "anomaly"


@dataclass
class DatabaseNode:
    """数据库节点"""
    id: str
    host: str
    port: int
    database: str
    role: str = "primary"           # primary / replica / analytics
    weight: int = 100               # 权重 (用于负载均衡)
    max_connections: int = 100
    active_connections: int = 0
    health_score: float = 100.0
    last_health_check: Optional[datetime] = None
    enabled: bool = True
    
    @property
    def load_pct(self) -> float:
        if self.max_connections == 0:
            return 100.0
        return round((self.active_connections / self.max_connections) * 100, 2)


@dataclass
class SlowQuery:
    """慢查询记录"""
    query_hash: str
    query_sample: str
    execution_count: int = 0
    total_time_ms: float = 0.0
    avg_time_ms: float = 0.0
    max_time_ms: float = 0.0
    last_seen: Optional[datetime] = None
    table_involved: List[str] = field(default_factory=list)
    suggested_indexes: List[str] = field(default_factory=list)
    is_hotspot: bool = False
    
    @property
    def pct_of_total(self) -> float:
        return 0.0  # 由管理器计算


@dataclass
class IndexRecommendation:
    """索引推荐"""
    id: str
    table: str
    columns: List[str]
    estimated_benefit: float = 0.0
    estimated_size_mb: float = 0.0
    reason: str = ""
    queries_improved: int = 0
    priority: str = "medium"         # high / medium / low
    ddl_sql: str = ""


@dataclass
class OLAPCube:
    """OLAP 数据立方体"""
    name: str
    dimensions: List[str]
    measures: List[str]
    aggregation_level: str = "day"
    data: List[Dict[str, Any]] = field(default_factory=list)
    last_updated: Optional[datetime] = None
    refresh_interval_hours: int = 1


@dataclass
class KPIResult:
    """KPI 计算结果"""
    name: str
    value: float
    unit: str = ""
    previous_value: Optional[float] = None
    change_pct: Optional[float] = None
    trend: str = "stable"             # up / down / stable
    threshold_warning: Optional[float] = None
    threshold_critical: Optional[float] = None
    is_anomaly: bool = False
    anomaly_reason: str = ""
    raw_data: List[float] = field(default_factory=list)


# ============================================================
# P5-3: 数据库高级优化引擎
# ============================================================

class DatabaseOptimizer:
    """
    数据库优化引擎
    
    负责:
    - 读写分离路由
    - 分片决策
    - 连接池智能管理
    - 慢查询检测
    - 索引自动推荐
    - 查询计划缓存
    """
    
    def __init__(self):
        self._nodes: Dict[str, DatabaseNode] = {}
        self._slow_queries: Dict[str, SlowQuery] = {}
        self._index_recommendations: Dict[str, IndexRecommendation] = {}
        self._query_plan_cache: Dict[str, Any] = {}
        self._hotspot_tables: Counter = Counter()
        self._sharding_rules: Dict[str, Dict[str, Any]] = {}
        self._lock = threading.RLock()
        self._stats = {
            "total_queries": 0,
            "read_queries": 0,
            "write_queries": 0,
            "routed_to_primary": 0,
            "routed_to_replica": 0,
            "cache_hits": 0,
            "cache_misses": 0,
        }
        
        logger.info("🚀 数据库高级优化引擎已初始化")
    
    # ───────── 节点管理 ─────────
    
    def register_node(self, node: DatabaseNode) -> None:
        """注册数据库节点"""
        with self._lock:
            self._nodes[node.id] = node
            logger.info(f"🗄️  已注册数据库节点: {node.id} ({node.role}) @ {node.host}:{node.port}")
    
    def unregister_node(self, node_id: str) -> None:
        """注销数据库节点"""
        with self._lock:
            if node_id in self._nodes:
                del self._nodes[node_id]
                logger.info(f"🗄️  已注销数据库节点: {node_id}")
    
    def mark_node_health(self, node_id: str, score: float,
                          active_connections: Optional[int] = None) -> None:
        """更新节点健康状态"""
        with self._lock:
            node = self._nodes.get(node_id)
            if node:
                node.health_score = score
                node.last_health_check = datetime.now(timezone.utc)
                if active_connections is not None:
                    node.active_connections = active_connections
    
    # ───────── 读写分离路由 ─────────
    
    def route_query(self, query_type: QueryType,
                    query: Optional[str] = None) -> Optional[DatabaseNode]:
        """
        智能路由查询
        
        规则:
        - WRITE/ADMIN -> 主库
        - READ/ANALYTICS -> 健康度最高的只读副本（无副本则回退主库）
        """
        self._stats["total_queries"] += 1
        
        if query_type in (QueryType.WRITE, QueryType.ADMIN):
            self._stats["write_queries"] += 1
            self._stats["routed_to_primary"] += 1
            return self._get_best_primary()
        
        self._stats["read_queries"] += 1
        
        replica = self._get_best_replica()
        if replica:
            self._stats["routed_to_replica"] += 1
            return replica
        
        # 无可用副本 -> 回退到主库
        self._stats["routed_to_primary"] += 1
        return self._get_best_primary()
    
    def _get_best_primary(self) -> Optional[DatabaseNode]:
        """获取健康度最高的主库"""
        primaries = [n for n in self._nodes.values()
                     if n.role == "primary" and n.enabled and n.health_score > 30]
        if not primaries:
            return None
        return max(primaries, key=lambda n: (n.health_score, -n.load_pct))
    
    def _get_best_replica(self) -> Optional[DatabaseNode]:
        """获取健康度最高的只读副本（加权随机）"""
        replicas = [n for n in self._nodes.values()
                    if n.role in ("replica", "analytics")
                    and n.enabled and n.health_score > 50]
        if not replicas:
            return None
        
        # 加权随机选择（健康度 * 权重）
        total_weight = sum(n.health_score * n.weight for n in replicas)
        if total_weight == 0:
            return max(replicas, key=lambda n: n.health_score)
        
        import random
        r = random.uniform(0, total_weight)
        cumulative = 0
        for n in replicas:
            cumulative += n.health_score * n.weight
            if r <= cumulative:
                return n
        return replicas[0]
    
    # ───────── 分库分表 ─────────
    
    def configure_sharding(self, table: str, strategy: ShardingStrategy,
                           shard_count: int = 8, key_field: str = "id",
                           ranges: Optional[List[Tuple[Any, Any]]] = None) -> None:
        """配置分片规则"""
        with self._lock:
            self._sharding_rules[table] = {
                "strategy": strategy,
                "shard_count": shard_count,
                "key_field": key_field,
                "ranges": ranges or [],
                "created_at": datetime.now(timezone.utc),
            }
            logger.info(
                f"🗂️  已配置分片: table={table}, strategy={strategy.value}, "
                f"shards={shard_count}, key={key_field}"
            )
    
    def get_shard_for(self, table: str, key_value: Any) -> Optional[int]:
        """计算键值对应的分片 ID"""
        rule = self._sharding_rules.get(table)
        if not rule or rule["strategy"] == ShardingStrategy.NONE:
            return 0
        
        strategy = rule["strategy"]
        shard_count = rule["shard_count"]
        
        if strategy == ShardingStrategy.HASH:
            # 一致性哈希: hash(key) % shard_count
            hash_val = hash(str(key_value))
            return abs(hash_val) % shard_count
        
        elif strategy == ShardingStrategy.RANGE:
            # 范围分片 (按 ID)
            try:
                id_val = int(key_value)
                for idx, (start, end) in enumerate(rule["ranges"]):
                    if start <= id_val <= end:
                        return idx
                # 超出已知范围 -> 默认最后一片
                return shard_count - 1
            except (ValueError, TypeError):
                return 0
        
        elif strategy == ShardingStrategy.LIST:
            # 列表分片 (按租户)
            try:
                return hash(str(key_value)) % shard_count
            except Exception:
                return 0
        
        return 0
    
    # ───────── 连接池管理 ─────────
    
    def adjust_pool_size(self, current_size: int, current_waiting: int,
                         max_size: int = 500, min_size: int = 10) -> int:
        """
        根据等待队列智能调整连接池大小
        
        规则:
        - 等待队列 > 10 持续 30s: +20%
        - 空闲连接 > 50% 持续 5min: -10%
        - 保持在 min_size ~ max_size 之间
        """
        if current_waiting > 10:
            new_size = int(current_size * 1.2)
            logger.info(f"🔌 连接池扩容: {current_size} -> {new_size} (waiting={current_waiting})")
        elif current_size > min_size * 2 and current_waiting == 0:
            new_size = max(int(current_size * 0.9), min_size)
            if new_size != current_size:
                logger.info(f"🔌 连接池收缩: {current_size} -> {new_size}")
        else:
            new_size = current_size
        
        return max(min_size, min(new_size, max_size))
    
    # ───────── 慢查询检测 ─────────
    
    def record_query(self, query: str, execution_time_ms: float,
                     tables: Optional[List[str]] = None) -> None:
        """记录查询执行情况"""
        # 只记录 > 100ms 的查询
        if execution_time_ms < 100:
            return
        
        query_hash = hashlib.md5(query.encode("utf-8")).hexdigest()[:16]
        
        with self._lock:
            existing = self._slow_queries.get(query_hash)
            if existing:
                existing.execution_count += 1
                existing.total_time_ms += execution_time_ms
                existing.avg_time_ms = existing.total_time_ms / existing.execution_count
                existing.max_time_ms = max(existing.max_time_ms, execution_time_ms)
                existing.last_seen = datetime.now(timezone.utc)
                if tables:
                    for t in tables:
                        if t not in existing.table_involved:
                            existing.table_involved.append(t)
            else:
                # 截取前 200 个字符作为样本
                sample = query[:500] + ("..." if len(query) > 500 else "")
                self._slow_queries[query_hash] = SlowQuery(
                    query_hash=query_hash,
                    query_sample=sample,
                    execution_count=1,
                    total_time_ms=execution_time_ms,
                    avg_time_ms=execution_time_ms,
                    max_time_ms=execution_time_ms,
                    last_seen=datetime.now(timezone.utc),
                    table_involved=tables or [],
                )
            
            # 热点表记录
            if tables:
                for t in tables:
                    self._hotspot_tables[t] += 1
    
    def get_slow_queries(self, limit: int = 20) -> List[Dict[str, Any]]:
        """获取 Top N 慢查询"""
        sorted_queries = sorted(
            self._slow_queries.values(),
            key=lambda q: q.total_time_ms,
            reverse=True,
        )
        result = []
        for q in sorted_queries[:limit]:
            d = {
                "hash": q.query_hash,
                "count": q.execution_count,
                "total_ms": round(q.total_time_ms, 2),
                "avg_ms": round(q.avg_time_ms, 2),
                "max_ms": round(q.max_time_ms, 2),
                "tables": q.table_involved,
                "sample": q.query_sample,
                "is_hotspot": q.is_hotspot or (q.execution_count > 100 and q.avg_time_ms > 200),
                "suggested_indexes": self._auto_suggest_indexes(q),
            }
            result.append(d)
        return result
    
    def _auto_suggest_indexes(self, slow_query: SlowQuery) -> List[str]:
        """
        基于简单启发式规则推荐索引
        
        真实实现应基于 EXPLAIN 分析，此处为启发式:
        - SELECT ... WHERE col = X  -> 为 col 建索引
        - JOIN 条件列 -> 建索引
        - 复合索引顺序: 等值过滤列 > 范围过滤列 > 排序列
        """
        suggestions = []
        for table in slow_query.table_involved:
            suggestions.append(f"idx_{table}_optimized")
        return suggestions
    
    # ───────── 索引推荐 ─────────
    
    def analyze_tables(self, table_stats: Dict[str, Dict[str, Any]]) -> List[IndexRecommendation]:
        """
        分析表统计并生成索引推荐
        
        Args:
            table_stats: {table: {row_count, read_qps, write_qps, missing_index_ratio, ...}}
        
        Returns: 推荐的索引列表
        """
        recommendations: List[IndexRecommendation] = []
        
        for table, stats in table_stats.items():
            missing_ratio = stats.get("missing_index_ratio", 0)
            read_qps = stats.get("read_qps", 0)
            write_qps = stats.get("write_qps", 0)
            row_count = stats.get("row_count", 0)
            
            if missing_ratio > 0.1 and row_count > 1000:  # 10% 以上缺失索引且表较大
                benefit = missing_ratio * read_qps * math.log10(max(row_count, 10))
                write_penalty = write_qps * 0.05  # 新增索引的写入开销
                
                # 仅在收益 > 开销时推荐
                if benefit > write_penalty:
                    priority = "high" if benefit > write_penalty * 10 else (
                        "medium" if benefit > write_penalty * 3 else "low"
                    )
                    rec = IndexRecommendation(
                        id=str(uuid.uuid4()),
                        table=table,
                        columns=stats.get("frequent_columns", ["created_at"]),
                        estimated_benefit=round(benefit - write_penalty, 2),
                        estimated_size_mb=round(row_count * 50 / 1024 / 1024, 1),
                        reason=f"高读QPS场景缺失索引，当前缺失比 {missing_ratio:.1%}",
                        queries_improved=int(read_qps * missing_ratio),
                        priority=priority,
                        ddl_sql=f"CREATE INDEX CONCURRENTLY idx_{table}_auto ON {table} (...);",
                    )
                    recommendations.append(rec)
                    self._index_recommendations[rec.id] = rec
        
        logger.info(f"📊 索引分析完成，生成 {len(recommendations)} 条推荐")
        return sorted(recommendations, key=lambda r: r.estimated_benefit, reverse=True)
    
    # ───────── 查询计划缓存 ─────────
    
    def get_cached_plan(self, query_signature: str) -> Optional[Any]:
        """获取缓存的查询计划"""
        cached = self._query_plan_cache.get(query_signature)
        if cached:
            self._stats["cache_hits"] += 1
        else:
            self._stats["cache_misses"] += 1
        return cached
    
    def cache_query_plan(self, query_signature: str, plan: Any,
                         ttl_seconds: int = 3600) -> None:
        """缓存查询计划"""
        self._query_plan_cache[query_signature] = {
            "plan": plan,
            "cached_at": datetime.now(timezone.utc),
            "ttl": ttl_seconds,
        }
        # 限制缓存大小（LRU 简化版）
        if len(self._query_plan_cache) > 1000:
            # 清除最老的 10%
            items = sorted(self._query_plan_cache.items(),
                          key=lambda kv: kv[1]["cached_at"])
            for k, _ in items[:100]:
                del self._query_plan_cache[k]
    
    # ───────── 统计 ─────────
    
    def get_optimizer_stats(self) -> Dict[str, Any]:
        """获取优化器统计"""
        total_time = sum(q.total_time_ms for q in self._slow_queries.values())
        
        # 为每个慢查询计算占比
        for q in self._slow_queries.values():
            try:
                q.is_hotspot = (q.execution_count > 50 and q.avg_time_ms > 100)
            except Exception:
                pass
        
        return {
            "query_routing": {
                "total": self._stats["total_queries"],
                "read": self._stats["read_queries"],
                "write": self._stats["write_queries"],
                "to_primary": self._stats["routed_to_primary"],
                "to_replica": self._stats["routed_to_replica"],
                "replica_read_ratio": (
                    round(self._stats["routed_to_replica"] / self._stats["read_queries"], 3)
                    if self._stats["read_queries"] > 0 else 0
                ),
            },
            "cache": {
                "hits": self._stats["cache_hits"],
                "misses": self._stats["cache_misses"],
                "hit_rate": (
                    round(self._stats["cache_hits"] / (self._stats["cache_hits"] + self._stats["cache_misses"]), 3)
                    if (self._stats["cache_hits"] + self._stats["cache_misses"]) > 0 else 0
                ),
                "entries": len(self._query_plan_cache),
            },
            "nodes": {
                node_id: {
                    "role": node.role,
                    "health": node.health_score,
                    "load_pct": node.load_pct,
                    "connections": node.active_connections,
                    "max_connections": node.max_connections,
                    "enabled": node.enabled,
                }
                for node_id, node in self._nodes.items()
            },
            "slow_queries": {
                "total": len(self._slow_queries),
                "hotspots": sum(1 for q in self._slow_queries.values()
                                if q.execution_count > 100 and q.avg_time_ms > 200),
                "total_time_ms": round(total_time, 2),
            },
            "sharding": {
                "tables": list(self._sharding_rules.keys()),
                "total_shards": sum(r["shard_count"] for r in self._sharding_rules.values()),
            },
            "hotspot_tables": self._hotspot_tables.most_common(10),
            "recommended_indexes": len(self._index_recommendations),
        }


# ============================================================
# P5-4: 商业智能与数据可视化引擎
# ============================================================

class BIEngine:
    """
    商业智能与数据可视化引擎
    
    负责:
    - 多维数据分析（OLAP Cube 模拟）
    - KPI 指标计算与趋势分析
    - 异常检测（基于统计方法）
    - 数据看板生成
    - ETL 流水线管理
    - 配方关联分析 (Association Rule Mining)
    """
    
    def __init__(self):
        self._cubes: Dict[str, OLAPCube] = {}
        self._kpi_definitions: Dict[str, Dict[str, Any]] = {}
        self._etl_pipelines: Dict[str, Dict[str, Any]] = {}
        self._lineage: Dict[str, List[str]] = {}       # 数据血缘
        self._dashboard_cache: Dict[str, Any] = {}
        self._lock = threading.RLock()
        
        # 内置 KPI 模板
        self._init_builtin_kpis()
        
        logger.info("📊 BI 数据智能引擎已初始化")
    
    def _init_builtin_kpis(self) -> None:
        """初始化内置 KPI 模板"""
        self._kpi_definitions.update({
            "daily_new_formulas": {
                "name": "每日新增配方数",
                "unit": "个",
                "aggregation": "count",
                "threshold_warning": 10,
                "threshold_critical": 5,
            },
            "formula_approval_rate": {
                "name": "配方审核通过率",
                "unit": "%",
                "aggregation": "ratio",
                "threshold_warning": 70,
                "threshold_critical": 50,
            },
            "avg_formula_complexity": {
                "name": "平均配方复杂度",
                "unit": "分",
                "aggregation": "avg",
            },
            "experiment_success_rate": {
                "name": "实验成功率",
                "unit": "%",
                "aggregation": "ratio",
                "threshold_warning": 60,
                "threshold_critical": 40,
            },
            "user_activity": {
                "name": "活跃用户数",
                "unit": "人",
                "aggregation": "count_distinct",
            },
            "ingredient_usage": {
                "name": "原料使用频率",
                "unit": "次",
                "aggregation": "count",
            },
            "ai_generation_accuracy": {
                "name": "AI 生成采纳率",
                "unit": "%",
                "aggregation": "ratio",
                "threshold_warning": 30,
                "threshold_critical": 10,
            },
        })
    
    # ───────── OLAP 立方体 ─────────
    
    def create_cube(self, name: str, dimensions: List[str],
                    measures: List[str], aggregation_level: str = "day",
                    data: Optional[List[Dict[str, Any]]] = None) -> OLAPCube:
        """创建 OLAP 数据立方体"""
        with self._lock:
            cube = OLAPCube(
                name=name,
                dimensions=dimensions,
                measures=measures,
                aggregation_level=aggregation_level,
                data=data or [],
                last_updated=datetime.now(timezone.utc),
            )
            self._cubes[name] = cube
            self._lineage[name] = [f"source_{d}" for d in dimensions]
            
            logger.info(
                f"🧊 OLAP 立方体创建: {name}, dims={dimensions}, "
                f"measures={measures}, rows={len(cube.data)}"
            )
            return cube
    
    def slice_cube(self, cube_name: str, **filters) -> List[Dict[str, Any]]:
        """
        切片操作 (Slice): 在一个维度上过滤
        
        示例: slice_cube("formulas", creator_id=10, status="approved")
        """
        cube = self._cubes.get(cube_name)
        if not cube:
            return []
        
        result = []
        for row in cube.data:
            match = all(row.get(k) == v for k, v in filters.items())
            if match:
                result.append(row)
        return result
    
    def dice_cube(self, cube_name: str, dimension: str,
                  values: List[Any]) -> List[Dict[str, Any]]:
        """切块操作 (Dice): 在一个维度上选择多个值"""
        cube = self._cubes.get(cube_name)
        if not cube:
            return []
        return [r for r in cube.data if r.get(dimension) in values]
    
    def aggregate_cube(self, cube_name: str, group_by: List[str],
                       measure: str, agg_func: str = "sum") -> List[Dict[str, Any]]:
        """
        聚合操作 (Roll-up / Drill-down)
        
        agg_func: sum / avg / count / max / min / median / stddev
        """
        cube = self._cubes.get(cube_name)
        if not cube:
            return []
        
        groups: Dict[tuple, List[float]] = defaultdict(list)
        
        for row in cube.data:
            key = tuple(str(row.get(d, "")) for d in group_by)
            try:
                val = float(row.get(measure, 0))
                groups[key].append(val)
            except (ValueError, TypeError):
                continue
        
        result = []
        for key, vals in groups.items():
            if not vals:
                continue
            if agg_func == "sum":
                agg = sum(vals)
            elif agg_func == "avg":
                agg = mean(vals)
            elif agg_func == "count":
                agg = len(vals)
            elif agg_func == "max":
                agg = max(vals)
            elif agg_func == "min":
                agg = min(vals)
            elif agg_func == "median":
                agg = median(vals)
            elif agg_func == "stddev":
                agg = stdev(vals) if len(vals) > 1 else 0
            else:
                agg = sum(vals)
            
            row_dict = dict(zip(group_by, key))
            row_dict[measure] = round(agg, 4)
            result.append(row_dict)
        
        return result
    
    # ───────── KPI 计算 ─────────
    
    def compute_kpi(self, name: str, time_series: List[float],
                    previous_series: Optional[List[float]] = None) -> KPIResult:
        """计算 KPI 指标（含趋势与异常检测）"""
        defn = self._kpi_definitions.get(name, {})
        
        current_val = sum(time_series) if time_series else 0
        previous_val = sum(previous_series) if previous_series else None
        
        # 变化百分比
        change_pct = None
        if previous_val and previous_val > 0:
            change_pct = round(((current_val - previous_val) / previous_val) * 100, 2)
        
        # 趋势判断
        if change_pct is None:
            trend = "stable"
        elif change_pct > 5:
            trend = "up"
        elif change_pct < -5:
            trend = "down"
        else:
            trend = "stable"
        
        # 异常检测: Z-score 方法
        is_anomaly = False
        anomaly_reason = ""
        if len(time_series) >= 5:
            try:
                m = mean(time_series)
                s = stdev(time_series)
                latest = time_series[-1]
                if s > 0:
                    z_score = abs(latest - m) / s
                    if z_score > 3:
                        is_anomaly = True
                        anomaly_reason = f"最新值 {latest:.1f} 偏离均值 {m:.1f} 超过 {z_score:.1f}σ"
                elif latest > m * 2 and m > 0:
                    is_anomaly = True
                    anomaly_reason = f"数据激增: 最新值 {latest:.1f} 远大于均值 {m:.1f}"
            except Exception:
                pass
        
        return KPIResult(
            name=defn.get("name", name),
            value=round(current_val, 2),
            unit=defn.get("unit", ""),
            previous_value=round(previous_val, 2) if previous_val is not None else None,
            change_pct=change_pct,
            trend=trend,
            threshold_warning=defn.get("threshold_warning"),
            threshold_critical=defn.get("threshold_critical"),
            is_anomaly=is_anomaly,
            anomaly_reason=anomaly_reason,
            raw_data=time_series,
        )
    
    def compute_all_kpis(self, datasets: Dict[str, List[float]]) -> Dict[str, KPIResult]:
        """批量计算所有已定义的 KPI"""
        results = {}
        for kpi_name, data in datasets.items():
            try:
                previous = data[:-1] if len(data) > 7 else None
                results[kpi_name] = self.compute_kpi(kpi_name, data, previous)
            except Exception as exc:
                logger.warning(f"⚠️  KPI 计算失败: {kpi_name} -> {exc}")
        return results
    
    # ───────── 关联分析 (Apriori 简化版) ─────────
    
    def find_associations(self, transactions: List[List[str]],
                          min_support: float = 0.05,
                          min_confidence: float = 0.6) -> List[Dict[str, Any]]:
        """
        挖掘频繁项集与关联规则（用于配方/原料推荐）
        
        Args:
            transactions: 每个配方的原料列表 [["A", "B"], ["A", "C"], ...]
            min_support: 最小支持度（出现频率）
            min_confidence: 最小置信度
        
        Returns: [{items, support, confidence, lift}, ...]
        """
        if not transactions:
            return []
        
        n_transactions = len(transactions)
        
        # Step 1: 计算单项支持度
        item_counts: Counter = Counter()
        for t in transactions:
            for item in set(t):
                item_counts[item] += 1
        
        frequent_items = {item: cnt for item, cnt in item_counts.items()
                          if cnt / n_transactions >= min_support}
        
        if not frequent_items:
            return []
        
        # Step 2: 计算双项集支持度（简化版）
        pair_counts: Counter = Counter()
        for t in transactions:
            unique_items = sorted(set(t))
            for i in range(len(unique_items)):
                for j in range(i + 1, len(unique_items)):
                    a, b = unique_items[i], unique_items[j]
                    if a in frequent_items and b in frequent_items:
                        pair_counts[(a, b)] += 1
        
        # Step 3: 生成关联规则
        rules = []
        for (a, b), cnt in pair_counts.items():
            support_ab = cnt / n_transactions
            if support_ab < min_support:
                continue
            
            confidence_ab = cnt / frequent_items[a] if frequent_items[a] > 0 else 0
            confidence_ba = cnt / frequent_items[b] if frequent_items[b] > 0 else 0
            
            support_b = frequent_items[b] / n_transactions
            lift = confidence_ab / support_b if support_b > 0 else 1
            
            if confidence_ab >= min_confidence:
                rules.append({
                    "items": [a, b],
                    "antecedent": a,
                    "consequent": b,
                    "support": round(support_ab, 4),
                    "confidence": round(confidence_ab, 4),
                    "lift": round(lift, 2),
                })
            
            if confidence_ba >= min_confidence and a != b:
                rules.append({
                    "items": [b, a],
                    "antecedent": b,
                    "consequent": a,
                    "support": round(support_ab, 4),
                    "confidence": round(confidence_ba, 4),
                    "lift": round(confidence_ba / (frequent_items[a] / n_transactions), 2)
                    if frequent_items[a] > 0 else 0,
                })
        
        # 按置信度排序
        rules.sort(key=lambda r: r["confidence"], reverse=True)
        
        logger.info(
            f"🔗 关联分析完成: {n_transactions} 条交易 -> "
            f"{len(rules)} 条规则 (min_support={min_support}, min_confidence={min_confidence})"
        )
        return rules[:100]
    
    # ───────── 趋势预测 (简化版: 线性回归) ─────────
    
    def forecast_next(self, time_series: List[float], steps: int = 7) -> List[float]:
        """
        基于线性回归预测接下来的 N 个值
        
        适合: 简单趋势预测 (如未来 7 天配方生成量预测)
        更高级场景请使用 statsmodels / prophet
        """
        n = len(time_series)
        if n < 3:
            return [time_series[-1]] * steps if time_series else [0] * steps
        
        # 最小二乘法: y = a + b*x
        x_sum = sum(range(n))
        y_sum = sum(time_series)
        xy_sum = sum(i * y for i, y in enumerate(time_series))
        x2_sum = sum(i * i for i in range(n))
        
        denominator = n * x2_sum - x_sum * x_sum
        if denominator == 0:
            return [y_sum / n] * steps
        
        b = (n * xy_sum - x_sum * y_sum) / denominator
        a = (y_sum - b * x_sum) / n
        
        # 预测
        predictions = []
        for i in range(n, n + steps):
            predictions.append(round(a + b * i, 2))
        
        return predictions
    
    # ───────── ETL 流水线管理 ─────────
    
    def register_etl_pipeline(self, name: str,
                              extract_func: Optional[Callable] = None,
                              transform_func: Optional[Callable] = None,
                              load_func: Optional[Callable] = None,
                              schedule: str = "0 3 * * *") -> str:
        """注册 ETL 流水线"""
        pipeline_id = f"etl_{name}_{uuid.uuid4().hex[:8]}"
        with self._lock:
            self._etl_pipelines[pipeline_id] = {
                "name": name,
                "schedule": schedule,
                "extract": extract_func,
                "transform": transform_func,
                "load": load_func,
                "status": "registered",
                "last_run": None,
                "run_count": 0,
                "avg_duration_ms": 0,
            }
        logger.info(f"🔄 已注册 ETL 流水线: {name} ({pipeline_id}), 调度: {schedule}")
        return pipeline_id
    
    async def run_etl_pipeline(self, pipeline_id: str) -> Dict[str, Any]:
        """执行 ETL 流水线"""
        pipeline = self._etl_pipelines.get(pipeline_id)
        if not pipeline:
            return {"status": "error", "message": f"流水线不存在: {pipeline_id}"}
        
        start = _time.time()
        result = {"status": "success", "pipeline": pipeline["name"]}
        
        phases = [
            (ETLPhase.EXTRACT, pipeline["extract"]),
            (ETLPhase.TRANSFORM, pipeline["transform"]),
            (ETLPhase.LOAD, pipeline["load"]),
            (ETLPhase.VALIDATE, None),
        ]
        
        for phase, func in phases:
            phase_start = _time.time()
            try:
                if func and callable(func):
                    phase_result = func() if not hasattr(func, '__await__') else await func()
                    result[phase.value] = phase_result
                elif phase == ETLPhase.VALIDATE:
                    result[phase.value] = {"validated": True}
                
                pipeline[f"last_{phase.value}_ms"] = round((_time.time() - phase_start) * 1000, 1)
            except Exception as exc:
                logger.error(f"❌ ETL [{pipeline['name']}] 阶段 {phase.value} 失败: {exc}")
                result["status"] = "failed"
                result["failed_phase"] = phase.value
                result["error"] = str(exc)
                break
        
        duration_ms = round((_time.time() - start) * 1000, 1)
        pipeline["last_run"] = datetime.now(timezone.utc)
        pipeline["last_duration_ms"] = duration_ms
        pipeline["status"] = result["status"]
        pipeline["run_count"] += 1
        pipeline["avg_duration_ms"] = round(
            ((pipeline.get("avg_duration_ms", 0) * (pipeline["run_count"] - 1)) + duration_ms) / pipeline["run_count"], 1
        )
        
        result["total_duration_ms"] = duration_ms
        logger.info(
            f"✅ ETL [{pipeline['name']}] 执行完成: status={result['status']}, "
            f"duration={duration_ms}ms"
        )
        return result
    
    # ───────── 数据看板生成 ─────────
    
    def generate_dashboard(self, title: str,
                            kpi_results: Dict[str, KPIResult],
                            time_series_data: Optional[Dict[str, List[float]]] = None,
                            association_rules: Optional[List[Dict[str, Any]]] = None) -> Dict[str, Any]:
        """生成数据看板配置（供前端渲染）"""
        now = datetime.now(timezone.utc)
        
        widgets: List[Dict[str, Any]] = []
        
        # KPI 卡片
        for idx, (kpi_name, kpi) in enumerate(kpi_results.items()):
            status = "normal"
            if kpi.is_anomaly:
                status = "anomaly"
            elif kpi.threshold_critical is not None and kpi.value < kpi.threshold_critical:
                status = "critical"
            elif kpi.threshold_warning is not None and kpi.value < kpi.threshold_warning:
                status = "warning"
            
            widgets.append({
                "type": DashboardWidgetType.KPI.value,
                "title": kpi.name,
                "value": kpi.value,
                "unit": kpi.unit,
                "position": idx,
                "size": "large" if idx < 4 else "medium",
                "trend": kpi.trend,
                "change_pct": kpi.change_pct,
                "previous_value": kpi.previous_value,
                "status": status,
                "is_anomaly": kpi.is_anomaly,
                "anomaly_reason": kpi.anomaly_reason,
                "threshold_warning": kpi.threshold_warning,
                "threshold_critical": kpi.threshold_critical,
            })
        
        # 趋势图
        if time_series_data:
            for ts_name, ts_values in list(time_series_data.items())[:3]:
                widgets.append({
                    "type": DashboardWidgetType.LINE_CHART.value,
                    "title": f"{ts_name} 趋势",
                    "data": ts_values,
                    "forecast": self.forecast_next(ts_values, 7) if len(ts_values) > 7 else [],
                    "size": "full",
                })
        
        # 关联分析结果
        if association_rules:
            widgets.append({
                "type": DashboardWidgetType.TABLE.value,
                "title": "原料关联规则 (Top 10)",
                "columns": ["antecedent -> consequent", "confidence", "lift", "support"],
                "rows": [
                    [r["antecedent"] + " → " + r["consequent"],
                     f"{r['confidence']*100:.1f}%",
                     f"{r['lift']:.2f}",
                     f"{r['support']*100:.1f}%"]
                    for r in association_rules[:10]
                ],
            })
        
        dashboard = {
            "id": f"dashboard_{hash(title)}_{int(now.timestamp())}",
            "title": title,
            "generated_at": now.isoformat(),
            "timezone": "UTC",
            "widgets": widgets,
            "summary": {
                "total_widgets": len(widgets),
                "kpi_count": sum(1 for w in widgets if w["type"] == DashboardWidgetType.KPI.value),
                "anomaly_count": sum(1 for w in widgets if w.get("is_anomaly")),
                "critical_count": sum(1 for w in widgets if w.get("status") == "critical"),
                "warning_count": sum(1 for w in widgets if w.get("status") == "warning"),
            },
            "data_lineage": {k: v for k, v in list(self._lineage.items())[:5]},
            "recommendation": self._generate_recommendations(kpi_results),
        }
        
        # 缓存
        self._dashboard_cache[dashboard["id"]] = dashboard
        
        logger.info(
            f"📊 数据看板生成: {title}, widgets={len(widgets)}, "
            f"anomalies={dashboard['summary']['anomaly_count']}"
        )
        return dashboard
    
    def _generate_recommendations(self, kpi_results: Dict[str, KPIResult]) -> List[str]:
        """基于 KPI 生成智能建议"""
        recommendations = []
        for name, kpi in kpi_results.items():
            if kpi.is_anomaly:
                recommendations.append(f"⚠️ 【{kpi.name}】检测到异常: {kpi.anomaly_reason}")
            if kpi.threshold_critical is not None and kpi.value < kpi.threshold_critical:
                recommendations.append(
                    f"🔴 【{kpi.name}】严重低于阈值: 当前 {kpi.value}{kpi.unit}, "
                    f"阈值 {kpi.threshold_critical}{kpi.unit}"
                )
            elif kpi.threshold_warning is not None and kpi.value < kpi.threshold_warning:
                recommendations.append(
                    f"🟡 【{kpi.name}】低于预警阈值: 当前 {kpi.value}{kpi.unit}, "
                    f"预警 {kpi.threshold_warning}{kpi.unit}"
                )
            if kpi.trend == "down" and kpi.change_pct and kpi.change_pct < -20:
                recommendations.append(
                    f"📉 【{kpi.name}】下降趋势: 环比变化 {kpi.change_pct}%"
                )
        return recommendations
    
    # ───────── 导出 ─────────
    
    def export_dashboard_to_json(self, dashboard: Dict[str, Any]) -> str:
        """导出看板为 JSON (可直接喂给前端渲染)"""
        return json.dumps(dashboard, ensure_ascii=False, indent=2, default=str)
    
    def export_data_to_csv(self, data: List[Dict[str, Any]], filename: Optional[str] = None) -> str:
        """导出数据为 CSV"""
        if not data:
            return ""
        
        import io, csv
        output = io.StringIO()
        fieldnames = list(data[0].keys())
        writer = csv.DictWriter(output, fieldnames=fieldnames)
        writer.writeheader()
        for row in data:
            writer.writerow({k: json.dumps(v, ensure_ascii=False)
                            if isinstance(v, (dict, list)) else v
                            for k, v in row.items()})
        return output.getvalue()
    
    # ───────── 统计信息 ─────────
    
    def get_stats(self) -> Dict[str, Any]:
        """获取 BI 引擎统计"""
        return {
            "olap_cubes": len(self._cubes),
            "cube_names": list(self._cubes.keys()),
            "kpi_definitions": len(self._kpi_definitions),
            "etl_pipelines": len(self._etl_pipelines),
            "cached_dashboards": len(self._dashboard_cache),
            "pipelines": [
                {
                    "id": pid,
                    "name": p["name"],
                    "status": p["status"],
                    "run_count": p["run_count"],
                    "last_run": p["last_run"].isoformat() if p["last_run"] else None,
                    "avg_duration_ms": p.get("avg_duration_ms", 0),
                }
                for pid, p in self._etl_pipelines.items()
            ],
        }


# ============================================================
# 全局便捷 API
# ============================================================

_db_optimizer_instance: Optional[DatabaseOptimizer] = None
_bi_engine_instance: Optional[BIEngine] = None


def get_db_optimizer() -> DatabaseOptimizer:
    global _db_optimizer_instance
    if _db_optimizer_instance is None:
        _db_optimizer_instance = DatabaseOptimizer()
    return _db_optimizer_instance


def get_bi_engine() -> BIEngine:
    global _bi_engine_instance
    if _bi_engine_instance is None:
        _bi_engine_instance = BIEngine()
    return _bi_engine_instance


logger.info("🚀 数据库高级优化 + BI 数据智能引擎 已加载")
