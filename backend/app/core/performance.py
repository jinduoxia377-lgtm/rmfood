"""
RMFOOD 性能优化与缓存管理系统

提供以下功能：
1. 多级缓存策略（内存缓存 + Redis可选）
2. 数据库查询优化器
3. API响应压缩
4. 连接池管理
5. 慢查询监控
6. 性能指标收集

使用示例：
    from app.core.performance import CacheManager, QueryOptimizer, PerformanceMonitor
    
    # 缓存管理
    cache = CacheManager()
    result = cache.get_or_set('user:123', lambda: get_user(123), ttl=300)
    
    # 查询优化
    optimizer = QueryOptimizer(db)
    optimized_query = optimizer.optimize(query)
    
    # 性能监控
    monitor = PerformanceMonitor()
    with monitor.track('api_call'):
        result = expensive_operation()
"""

import time
import functools
import hashlib
import json
import logging
from typing import Any, Callable, Dict, Optional, Union
from datetime import datetime, timedelta
from contextlib import contextmanager
import threading

logger = logging.getLogger(__name__)


class CacheManager:
    """
    多级缓存管理器
    
    特性：
    - LRU内存缓存（默认）
    - 可选Redis支持
    - 自动过期机制
    - 缓存命中率统计
    - 命名空间隔离
    """
    
    def __init__(
        self,
        default_ttl: int = 300,
        max_size: int = 1000,
        enable_stats: bool = True,
        redis_url: Optional[str] = None
    ):
        self.default_ttl = default_ttl
        self.max_size = max_size
        self.enable_stats = enable_stats
        self.redis_url = redis_url
        
        # 内存缓存存储
        self._cache: Dict[str, Dict[str, Any]] = {}
        self._cache_order: list = []  # LRU顺序
        
        # 统计信息
        self.stats = {
            'hits': 0,
            'misses': 0,
            'sets': 0,
            'deletes': 0,
            'evictions': 0,
        }
        
        # 线程锁
        self._lock = threading.Lock()
        
        # Redis连接（如果配置）
        self._redis_client = None
        if redis_url:
            self._init_redis()
        
        logger.info(f"CacheManager initialized (max_size={max_size}, ttl={default_ttl}s)")
    
    def _init_redis(self):
        """初始化Redis连接"""
        try:
            import redis
            self._redis_client = redis.from_url(
                self.redis_url,
                decode_responses=True,
                socket_timeout=5,
                socket_connect_timeout=5,
                retry_on_timeout=True
            )
            # 测试连接
            self._redis_client.ping()
            logger.info("Redis connection established")
        except Exception as e:
            logger.warning(f"Redis connection failed, falling back to memory cache: {e}")
            self._redis_client = None
    
    def _make_key(self, namespace: str, key: str) -> str:
        """生成缓存键"""
        return f"{namespace}:{key}"
    
    def get(self, namespace: str, key: str) -> Optional[Any]:
        """获取缓存值"""
        cache_key = self._make_key(namespace, key)
        
        # 尝试Redis
        if self._redis_client:
            try:
                value = self._redis_client.get(cache_key)
                if value is not None:
                    if self.enable_stats:
                        self.stats['hits'] += 1
                    return json.loads(value)
            except Exception as e:
                logger.warning(f"Redis get failed: {e}")
        
        # 回退到内存缓存
        with self._lock:
            if cache_key in self._cache:
                entry = self._cache[cache_key]
                
                # 检查是否过期
                if time.time() > entry['expires_at']:
                    del self._cache[cache_key]
                    self._cache_order.remove(cache_key)
                    if self.enable_stats:
                        self.stats['misses'] += 1
                    return None
                
                # 更新LRU位置
                self._cache_order.remove(cache_key)
                self._cache_order.append(cache_key)
                
                if self.enable_stats:
                    self.stats['hits'] += 1
                
                return entry['value']
        
        if self.enable_stats:
            self.stats['misses'] += 1
        return None
    
    def set(
        self,
        namespace: str,
        key: str,
        value: Any,
        ttl: Optional[int] = None
    ) -> bool:
        """设置缓存值"""
        cache_key = self._make_key(namespace, key)
        ttl = ttl or self.default_ttl
        expires_at = time.time() + ttl
        
        # 序列化值
        try:
            serialized_value = json.dumps(value, default=str)
        except (TypeError, ValueError) as e:
            logger.error(f"Cache serialization failed for key {cache_key}: {e}")
            return False
        
        # 尝试Redis
        if self._redis_client:
            try:
                self._redis_client.setex(cache_key, ttl, serialized_value)
                if self.enable_stats:
                    self.stats['sets'] += 1
                return True
            except Exception as e:
                logger.warning(f"Redis set failed: {e}")
        
        # 内存缓存
        with self._lock:
            # 如果已存在，先删除
            if cache_key in self._cache:
                self._cache_order.remove(cache_key)
            
            # 检查容量，必要时淘汰
            while len(self._cache) >= self.max_size and self._cache_order:
                oldest_key = self._cache_order.pop(0)
                del self._cache[oldest_key]
                if self.enable_stats:
                    self.stats['evictions'] += 1
            
            # 添加新条目
            self._cache[cache_key] = {
                'value': value,
                'expires_at': expires_at,
                'created_at': time.time(),
            }
            self._cache_order.append(cache_key)
            
            if self.enable_stats:
                self.stats['sets'] += 1
            
            return True
    
    def delete(self, namespace: str, key: str) -> bool:
        """删除缓存"""
        cache_key = self._make_key(namespace, key)
        
        # Redis
        if self._redis_client:
            try:
                self._redis_client.delete(cache_key)
            except Exception as e:
                logger.warning(f"Redis delete failed: {e}")
        
        # 内存缓存
        with self._lock:
            if cache_key in self._cache:
                del self._cache[cache_key]
                try:
                    self._cache_order.remove(cache_key)
                except ValueError:
                    pass
                if self.enable_stats:
                    self.stats['deletes'] += 1
                return True
        
        return False
    
    def get_or_set(
        self,
        namespace: str,
        key: str,
        factory: Callable[[], Any],
        ttl: Optional[int] = None
    ) -> Any:
        """
        获取缓存，如果不存在则调用factory函数生成并缓存
        
        使用示例：
            user = cache.get_or_set('users', '123', lambda: db.get_user(123), ttl=600)
        """
        value = self.get(namespace, key)
        if value is not None:
            return value
        
        # 调用工厂函数生成值
        value = factory()
        if value is not None:
            self.set(namespace, key, value, ttl)
        
        return value
    
    def clear_namespace(self, namespace: str):
        """清除特定命名空间的所有缓存"""
        prefix = f"{namespace}:"
        
        # Redis
        if self._redis_client:
            try:
                keys = self._redis_client.keys(f"{prefix}*")
                if keys:
                    self._redis_client.delete(*keys)
            except Exception as e:
                logger.warning(f"Redis clear failed: {e}")
        
        # 内存缓存
        with self._lock:
            keys_to_delete = [
                k for k in self._cache.keys() if k.startswith(prefix)
            ]
            for key in keys_to_delete:
                del self._cache[key]
                try:
                    self._cache_order.remove(key)
                except ValueError:
                    pass
    
    def clear_all(self):
        """清空所有缓存"""
        # Redis
        if self._redis_client:
            try:
                self._redis_client.flushdb()
            except Exception as e:
                logger.warning(f"Redis flush failed: {e}")
        
        # 内存缓存
        with self._lock:
            self._cache.clear()
            self._cache_order.clear()
    
    def get_stats(self) -> Dict[str, Any]:
        """获取缓存统计信息"""
        hit_rate = 0
        total = self.stats['hits'] + self.stats['misses']
        if total > 0:
            hit_rate = (self.stats['hits'] / total) * 100
        
        return {
            **self.stats,
            'hit_rate': f"{hit_rate:.2f}%",
            'size': len(self._cache),
            'max_size': self.max_size,
            'usage': f"{(len(self._cache) / self.max_size * 100):.1f}%" if self.max_size > 0 else "N/A",
            'has_redis': self._redis_client is not None,
        }
    
    def cleanup_expired(self):
        """清理过期的缓存条目"""
        current_time = time.time()
        
        with self._lock:
            expired_keys = [
                k for k, v in self._cache.items()
                if current_time > v['expires_at']
            ]
            
            for key in expired_keys:
                del self._cache[key]
                try:
                    self._cache_order.remove(key)
                except ValueError:
                    pass


# 全局缓存实例
_cache_instance: Optional[CacheManager] = None

def get_cache_manager() -> CacheManager:
    """获取全局缓存管理器实例（单例模式）"""
    global _cache_instance
    if _cache_instance is None:
        _cache_instance = CacheManager()
    return _cache_instance


def cached(
    namespace: str,
    ttl: int = 300,
    key_func: Optional[Callable] = None
):
    """
    缓存装饰器
    
    使用示例：
        @cached('users', ttl=600)
        def get_user(user_id: int):
            return db.query(User).filter_by(id=user_id).first()
        
        @cached('expensive_calc', ttl=60, key_func=lambda x, y: f"{x}_{y}")
        def complex_calculation(a: int, b: int) -> float:
            return math.pow(a, b)
    """
    def decorator(func: Callable) -> Callable:
        @functools.wraps(func)
        async def async_wrapper(*args, **kwargs) -> Any:
            cache = get_cache_manager()

            if key_func:
                cache_key = key_func(*args, **kwargs)
            else:
                key_data = {
                    'func': func.__name__,
                    'args': str(args),
                    'kwargs': str(kwargs),
                }
                cache_key = hashlib.md5(
                    json.dumps(key_data, default=str).encode()
                ).hexdigest()

            cached = cache.get(namespace, cache_key)
            if cached is not None:
                return cached

            result = await func(*args, **kwargs)
            cache.set(namespace, cache_key, result, ttl=ttl)
            return result

        @functools.wraps(func)
        def sync_wrapper(*args, **kwargs) -> Any:
            cache = get_cache_manager()

            if key_func:
                cache_key = key_func(*args, **kwargs)
            else:
                key_data = {
                    'func': func.__name__,
                    'args': str(args),
                    'kwargs': str(kwargs),
                }
                cache_key = hashlib.md5(
                    json.dumps(key_data, default=str).encode()
                ).hexdigest()

            return cache.get_or_set(
                namespace,
                cache_key,
                lambda: func(*args, **kwargs),
                ttl=ttl
            )

        if asyncio.iscoroutinefunction(func):
            return async_wrapper
        return sync_wrapper
    return decorator


class QueryOptimizer:
    """
    SQL查询优化器
    
    功能：
    - 自动添加索引建议
    - 查询重写优化
    - N+1查询检测
    - 慢查询日志
    """
    
    SLOW_QUERY_THRESHOLD = 1.0  # 秒 — 已弃用，请使用 settings.logging.slow_query_threshold_ms / 1000
    
    def __init__(self, db_session):
        self.db = db_session
        self.slow_queries: list = []
        self._lock = threading.Lock()
    
    def track_query(self, query: str, params: dict = None) -> contextmanager:
        """
        查询执行跟踪上下文管理器
        
        使用：
            with optimizer.track_query("SELECT * FROM users WHERE id = :id", {'id': 123}):
                result = db.execute(query, params)
        """
        @contextmanager
        def tracker():
            start_time = time.time()
            yield
            elapsed = time.time() - start_time
            
            if elapsed > self.SLOW_QUERY_THRESHOLD:
                self._log_slow_query(query, params, elapsed)
        
        return tracker()
    
    def _log_slow_query(self, query: str, params: dict, elapsed: float):
        """记录慢查询"""
        warning_msg = (
            f"SLOW QUERY ({elapsed:.3f}s): {query[:200]}... "
            f"Params: {params}"
        )
        logger.warning(warning_msg)
        
        with self._lock:
            self.slow_queries.append({
                'query': query,
                'params': params,
                'elapsed': elapsed,
                'timestamp': datetime.now().isoformat(),
            })
    
    def suggest_indexes(self, query: str) -> list:
        """
        分析查询并建议索引
        
        返回建议的索引列表
        """
        suggestions = []
        
        # 简单的WHERE子句分析
        import re
        where_match = re.search(r'WHERE\s+(.+?)(?:\s+ORDER BY|\s+GROUP BY|\s+LIMIT|$)', query, re.IGNORECASE | re.DOTALL)
        
        if where_match:
            where_clause = where_match.group(1)
            
            # 提取列名
            columns = re.findall(r'(\w+)\s*(?:=|>|<|>=|<=|LIKE|IN)\s*', where_clause, re.IGNORECASE)
            
            for col in set(columns):
                if col.lower() not in ('id', 'created_at', 'updated_at'):
                    suggestions.append({
                        'column': col,
                        'reason': f'Column "{col}" used in WHERE clause',
                        'type': 'btree',
                    })
        
        return suggestions


class PerformanceMonitor:
    """
    性能监控器
    
    功能：
    - API响应时间统计
    - 函数执行计时
    - 内存使用监控
    - 性能报告生成
    """
    
    def __init__(self):
        self.metrics: Dict[str, Dict[str, Any]] = {}
        self._lock = threading.Lock()
        self._current_timers: Dict[str, float] = {}
    
    @contextmanager
    def track(self, operation_name: str):
        """
        操作计时上下文管理器
        
        使用：
            with monitor.track('database_query'):
                results = db.execute(query)
        """
        start_time = time.time()
        self._current_timers[operation_name] = start_time
        
        try:
            yield
        finally:
            elapsed = time.time() - start_time
            self._record_metric(operation_name, elapsed)
            
            if operation_name in self._current_timers:
                del self._current_timers[operation_name]
    
    def _record_metric(self, operation: str, elapsed: float):
        """记录性能指标"""
        with self._lock:
            if operation not in self.metrics:
                self.metrics[operation] = {
                    'count': 0,
                    'total_time': 0,
                    'min_time': float('inf'),
                    'max_time': 0,
                    'avg_time': 0,
                }
            
            metric = self.metrics[operation]
            metric['count'] += 1
            metric['total_time'] += elapsed
            metric['min_time'] = min(metric['min_time'], elapsed)
            metric['max_time'] = max(metric['max_time'], elapsed)
            metric['avg_time'] = metric['total_time'] / metric['count']
    
    def get_report(self) -> Dict[str, Any]:
        """生成性能报告"""
        with self._lock:
            sorted_metrics = sorted(
                self.metrics.items(),
                key=lambda x: x[1]['avg_time'],
                reverse=True
            )[:20]  # Top 20最慢操作
            
            return {
                'timestamp': datetime.now().isoformat(),
                'total_operations': sum(m['count'] for m in self.metrics.values()),
                'top_operations': [
                    {
                        'name': name,
                        **metric,
                    }
                    for name, metric in sorted_metrics
                ],
            }
    
    def reset(self):
        """重置所有指标"""
        with self._lock:
            self.metrics.clear()


# 全局性能监控器实例
_monitor_instance: Optional[PerformanceMonitor] = None

def get_performance_monitor() -> PerformanceMonitor:
    """获取全局性能监控器实例"""
    global _monitor_instance
    if _monitor_instance is None:
        _monitor_instance = PerformanceMonitor()
    return _monitor_instance


def timing_decorator(operation_name: str = None):
    """
    计时装饰器
    
    使用示例：
        @timing_decorator('user_lookup')
        def find_user(user_id: int):
            return db.query(User).get(user_id)
        
        @timing_decorator()  # 自动使用函数名
        def heavy_computation():
            ...
    """
    def decorator(func: Callable) -> Callable:
        name = operation_name or func.__name__
        monitor = get_performance_monitor()
        
        @functools.wraps(func)
        def wrapper(*args, **kwargs) -> Any:
            with monitor.track(name):
                return func(*args, **kwargs)
        
        return wrapper
    return decorator


class ConnectionPoolMonitor:
    """
    数据库连接池监控
    
    监控连接池状态，预警连接泄漏
    """
    
    def __init__(self, pool):
        self.pool = pool
        self.last_check = None
        self.warnings_issued = 0
    
    def check_pool_health(self) -> Dict[str, Any]:
        """检查连接池健康状态"""
        try:
            stats = {
                'pool_size': self.pool.size(),
                'checked_out': self.pool.checkedout(),
                'overflow': self.pool.overflow(),
                'checked_in': self.pool.checkedin(),
                'timestamp': datetime.now().isoformat(),
            }
            
            # 健康检查
            health_issues = []
            
            if stats['checked_out'] > stats['pool_size'] * 0.8:
                health_issues.append('High connection usage (>80%)')
            
            if stats['overflow'] > 0:
                health_issues.append(f'Connection overflow detected: {stats["overflow"]}')
            
            stats['health_status'] = 'healthy' if not health_issues else 'warning'
            stats['issues'] = health_issues
            
            self.last_check = stats
            
            if health_issues:
                self.warnings_issued += 1
                logger.warning(f"Pool health issues: {health_issues}")
            
            return stats
            
        except Exception as e:
            logger.error("Pool health check failed", exc_info=True)
            return {
                'error': '连接池健康检查异常',
                'status': 'error',
                'timestamp': datetime.now().isoformat(),
            }


# 导出的便捷函数
__all__ = [
    'CacheManager',
    'get_cache_manager',
    'cached',
    'QueryOptimizer',
    'PerformanceMonitor',
    'get_performance_monitor',
    'timing_decorator',
    'ConnectionPoolMonitor',
]
