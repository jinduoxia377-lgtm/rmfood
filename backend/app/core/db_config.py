"""
RMFOOD 数据库性能配置

提供以下功能：
1. 连接池优化配置
2. 查询性能监控
3. 慢查询日志
4. 数据库索引建议
5. 批量操作优化
6. 事务管理增强
"""

import time
import logging
from contextlib import contextmanager
from typing import Any, Callable, Dict, List, Optional
from functools import wraps
from sqlalchemy import event, text
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session
from sqlalchemy.exc import SQLAlchemyError

logger = logging.getLogger(__name__)


class DatabasePerformanceConfig:
    """
    数据库性能配置类
    
    集中管理所有数据库相关的性能参数
    """
    
    # 连接池配置
    POOL_SIZE = 10
    MAX_OVERFLOW = 20
    POOL_RECYCLE = 3600  # 1小时
    POOL_PRE_PING = True  # 连接前预检
    
    # 查询超时设置（秒）
    STATEMENT_TIMEOUT = 30
    SLOW_QUERY_THRESHOLD = 1.0  # 慢查询阈值
    
    # 批量操作配置
    BATCH_SIZE = 1000  # 批量插入/更新的批次大小
    
    # 缓存配置
    QUERY_CACHE_ENABLED = True
    QUERY_CACHE_TTL = 300  # 5分钟
    
    # 日志配置
    LOG_SLOW_QUERIES = True
    LOG_QUERY_COUNTS = True


def configure_engine(engine: Engine) -> Engine:
    """
    配置SQLAlchemy引擎的性能参数
    
    Args:
        engine: SQLAlchemy引擎实例
        
    Returns:
        配置后的引擎实例
    """
    
    @event.listens_for(engine, "before_cursor_execute")
    def receive_before_cursor_execute(
        conn,
        cursor,
        statement,
        parameters,
        context,
        executemany
    ):
        """在执行前记录开始时间"""
        context._query_start_time = time.time()
        
        # 设置语句超时（如果支持）
        if DatabasePerformanceConfig.STATEMENT_TIMEOUT > 0:
            try:
                cursor.execute(
                    f"SET STATEMENT_TIMEOUT = {DatabasePerformanceConfig.STATEMENT_TIMEOUT * 1000}"
                )
            except Exception:
                pass  # 不支持此命令的数据库会忽略
    
    @event.listens_for(engine, "after_cursor_execute")
    def receive_after_cursor_execute(
        conn,
        cursor,
        statement,
        parameters,
        context,
        executemany
    ):
        """在执行后记录耗时"""
        if hasattr(context, '_query_start_time'):
            elapsed = time.time() - context._query_start_time
            
            if elapsed > DatabasePerformanceConfig.SLOW_QUERY_THRESHOLD:
                logger.warning(
                    f"SLOW QUERY ({elapsed:.3f}s): {statement[:200]}..."
                )
    
    logger.info("Database engine performance monitoring configured")
    
    return engine


@contextmanager
def batch_session(db_session: Session, batch_size: int = None):
    """
    批量操作会话上下文管理器
    
    自动分批提交，避免长事务导致的锁问题
    
    使用示例：
        with batch_session(db) as session:
            for i, item in enumerate(items):
                session.add(item)
                if i % batch_size == 0:
                    session.flush()  # 分批刷新
    """
    batch_size = batch_size or DatabasePerformanceConfig.BATCH_SIZE
    counter = 0
    
    try:
        yield db_session, counter
        
        # 最终提交
        db_session.commit()
        logger.info(f"Batch operation completed: {counter} items")
        
    except Exception as e:
        db_session.rollback()
        logger.error(f"Batch operation failed: {e}")
        raise
    finally:
        counter = 0


def optimized_bulk_insert(
    db_session: Session,
    model_class: type,
    items: List[Dict[str, Any]],
    batch_size: int = None
) -> int:
    """
    优化的批量插入
    
    特性：
    - 自动分批处理
    - 进度日志
    - 错误恢复
    - 返回成功插入的数量
    
    Args:
        db_session: 数据库会话
        model_class: ORM模型类
        items: 要插入的数据字典列表
        batch_size: 每批大小
        
    Returns:
        成功插入的记录数
    """
    batch_size = batch_size or DatabasePerformanceConfig.BATCH_SIZE
    total_items = len(items)
    inserted_count = 0
    
    logger.info(f"Starting bulk insert of {total_items} {model_class.__name__} records...")
    
    try:
        for batch_start in range(0, total_items, batch_size):
            batch_end = min(batch_start + batch_size, total_items)
            batch = items[batch_start:batch_end]
            
            # 创建ORM实例
            instances = [model_class(**item) for item in batch]
            
            # 批量添加
            db_session.add_all(instances)
            db_session.flush()  # 刷新到数据库但不提交
            
            inserted_count += len(batch)
            
            # 进度日志
            progress = (batch_end / total_items) * 100
            if batch_end % (batch_size * 10) == 0 or batch_end == total_items:
                logger.info(f"Bulk insert progress: {progress:.1f}% ({inserted_count}/{total_items})")
        
        # 提交所有批次
        db_session.commit()
        
        logger.info(f"Bulk insert completed: {inserted_count} records inserted")
        
        return inserted_count
        
    except Exception as e:
        db_session.rollback()
        logger.error(f"Bulk insert failed after {inserted_count} records: {e}")
        raise


class QueryCache:
    """
    查询结果缓存
    
    基于SQL语句和参数的自动缓存
    """
    
    def __init__(self, ttl: int = None):
        self.ttl = ttl or DatabasePerformanceConfig.QUERY_CACHE_TTL
        self._cache: Dict[str, tuple] = {}
        self._enabled = DatabasePerformanceConfig.QUERY_CACHE_ENABLED
    
    def _make_cache_key(self, statement: str, params: dict = None) -> str:
        """生成缓存键"""
        import hashlib
        data = f"{statement}:{params or {}}"
        return hashlib.md5(data.encode()).hexdigest()
    
    def get(self, statement: str, params: dict = None) -> Optional[Any]:
        """获取缓存的查询结果"""
        if not self._enabled:
            return None
        
        cache_key = self._make_cache_key(statement, params)
        
        if cache_key in self._cache:
            result, timestamp = self._cache[cache_key]
            
            if time.time() - timestamp < self.ttl:
                return result
            else:
                del self._cache[cache_key]
        
        return None
    
    def set(self, statement: str, result: Any, params: dict = None):
        """缓存查询结果"""
        if not self._enabled:
            return
        
        cache_key = self._make_cache_key(statement, params)
        self._cache[cache_key] = (result, time.time())
    
    def invalidate(self, pattern: str = None):
        """使缓存失效"""
        if pattern:
            keys_to_delete = [
                k for k in self._cache.keys() if pattern in k
            ]
            for key in keys_to_delete:
                del self._cache[key]
        else:
            self._cache.clear()
    
    def clear_expired(self):
        """清理过期缓存"""
        current_time = time.time()
        expired_keys = [
            k for k, (_, t) in self._cache.items()
            if current_time - t > self.ttl
        ]
        
        for key in expired_keys:
            del self._cache[key]


def with_query_cache(ttl: int = None):
    """
    查询缓存装饰器
    
    用于缓存只读查询的结果
    
    使用示例：
        @with_query_cache(ttl=600)
        def get_active_users(session):
            return session.query(User).filter_by(is_active=True).all()
    """
    query_cache = QueryCache(ttl)
    
    def decorator(func: Callable) -> Callable:
        @wraps(func)
        def wrapper(*args, **kwargs) -> Any:
            # 尝试从缓存获取
            cache_key = str(args) + str(kwargs)
            cached_result = query_cache.get(cache_key)
            
            if cached_result is not None:
                return cached_result
            
            # 执行查询
            result = func(*args, **kwargs)
            
            # 缓存结果
            query_cache.set(cache_key, result)
            
            return result
        
        wrapper.cache = query_cache  # 暴露缓存对象以便手动清理
        
        return wrapper
    
    return decorator


class IndexAdvisor:
    """
    索引建议器
    
    分析查询模式并推荐索引
    """
    
    def __init__(self, db_session: Session):
        self.db = db_session
        self.query_log: List[Dict] = []
    
    def log_query(self, query: str, table: str, columns: List[str], elapsed: float):
        """记录查询以供分析"""
        if elapsed > DatabasePerformanceConfig.SLOW_QUERY_THRESHOLD:
            self.query_log.append({
                'query': query,
                'table': table,
                'columns': columns,
                'elapsed': elapsed,
                'timestamp': time.time(),
            })
    
    def analyze_and_suggest(self) -> List[Dict]:
        """
        分析查询日志并生成索引建议
        
        Returns:
            索引建议列表
        """
        from collections import Counter
        
        suggestions = []
        column_usage = Counter()
        
        # 统计列使用频率
        for entry in self.query_log:
            for col in entry['columns']:
                column_usage[(entry['table'], col)] += 1
        
        # 生成建议
        for (table, column), count in column_usage.most_common(10):
            if count >= 3:  # 至少出现3次才建议
                suggestions.append({
                    'table': table,
                    'column': column,
                    'usage_count': count,
                    'suggested_index_name': f'idx_{table}_{column}',
                    'reason': f'Column used in {count} slow queries',
                    'priority': 'high' if count >= 5 else 'medium',
                })
        
        return suggestions


# 全局实例
_global_query_cache: Optional[QueryCache] = None

def get_query_cache() -> QueryCache:
    """获取全局查询缓存实例"""
    global _global_query_cache
    if _global_query_cache is None:
        _global_query_cache = QueryCache()
    return _global_query_cache


# 导出的便捷函数和类
__all__ = [
    'DatabasePerformanceConfig',
    'configure_engine',
    'batch_session',
    'optimized_bulk_insert',
    'QueryCache',
    'with_query_cache',
    'IndexAdvisor',
    'get_query_cache',
]
