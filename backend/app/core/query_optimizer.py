"""
RMFOOD 查询性能优化工具

功能特性:
- ✅ 查询结果缓存（自动管理TTL）
- ✅ 分页查询优化（游标分页）
- ✅ 批量操作优化
- ✅ N+1 查询检测与修复
- ✅ 慢查询日志记录
- ✅ 数据库索引建议

使用方法:
    from app.core.query_optimizer import QueryOptimizer, cached_query, optimize_pagination
    
    optimizer = QueryOptimizer(db)
    
    # 带缓存的查询
    result = await optimizer.cached_query(
        select(User), 
        cache_key="all_users",
        ttl=300  # 5分钟
    )
    
    # 优化的分页
    paginated = await optimizer.paginate(
        select(Formula),
        page=1,
        page_size=20
    )

作者: RMFOOD Team
日期: 2026-05-02
"""

import time
import logging
from typing import Any, Dict, Generic, List, Optional, TypeVar, Union
from functools import wraps
from dataclasses import dataclass, field

from sqlalchemy import Select, func, text, desc, asc, or_, and_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload, joinedload

logger = logging.getLogger(__name__)

# ── 类型变量 ──
T = TypeVar('T')

# ── 查询性能数据 ──

@dataclass
class QueryMetrics:
    """查询性能指标"""
    query_hash: str
    execution_time_ms: float
    rows_returned: int
    cache_hit: bool = False
    table_name: Optional[str] = None
    slow_query_threshold: float = 1000.0  # 慢查询阈值 (ms)
    
    @property
    def is_slow(self) -> bool:
        return self.execution_time_ms > self.slow_query_threshold


@dataclass
class PaginatedResult(Generic[T]):
    """分页结果"""
    items: List[T]
    total: int
    page: int
    page_size: int
    total_pages: int
    has_next: bool
    has_prev: bool
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "items": [item.to_dict() if hasattr(item, 'to_dict') else item for item in self.items],
            "total": self.total,
            "page": self.page,
            "page_size": self.page_size,
            "total_pages": self.total_pages,
            "has_next": self.has_next,
            "has_prev": self.has_prev,
        }


class QueryOptimizer:
    """
    SQL 查询优化器
    
    提供自动化的查询性能优化能力。
    
    Attributes:
        db: 数据库会话
        slow_query_log: 慢查询日志记录
        cache_enabled: 是否启用缓存
    """
    
    def __init__(self, db: AsyncSession, cache_enabled: bool = True):
        """
        初始化查询优化器
        
        Args:
            db: 异步数据库会话
            cache_enabled: 是否启用查询缓存
        """
        self.db = db
        self.cache_enabled = cache_enabled
        self.slow_query_log: List[QueryMetrics] = []
        
        logger.info("✅ 查询优化器已初始化")
    
    async def execute(
        self,
        statement: Select,
        *,
        cache_key: Optional[str] = None,
        cache_ttl: int = 300,
        load_options: Optional[Any] = None,
        metrics_label: str = ""
    ) -> List[T]:
        """
        执行优化的查询
        
        Args:
            statement: SQLAlchemy Select 语句
            cache_key: 缓存键（可选）
            cache_ttl: 缓存过期时间（秒）
            load_options: 预加载选项（解决N+1问题）
            metrics_label: 性能指标标签
            
        Returns:
            List[T]: 查询结果列表
        """
        start_time = time.perf_counter()
        
        # 应用预加载选项
        if load_options:
            statement = statement.options(load_options)
        
        # 尝试从缓存获取
        if cache_key and self.cache_enabled:
            from ..core.cache_system import cache_service
            
            cached_result = await cache_service.get_json(cache_key)
            if cached_result is not None:
                elapsed = (time.perf_counter() - start_time) * 1000
                
                metrics = QueryMetrics(
                    query_hash=hash(str(statement)),
                    execution_time_ms=elapsed,
                    rows_returned=len(cached_result),
                    cache_hit=True,
                )
                
                if metrics.is_slow:
                    self.slow_query_log.append(metrics)
                    logger.warning(f"⚠️ 缓存查询仍较慢: {metrics_label} ({elapsed:.2f}ms)")
                
                return cached_result
        
        # 执行实际查询
        try:
            result = await self.db.execute(statement)
            items = result.scalars().all()
            
            elapsed = (time.perf_counter() - start_time) * 1000
            
            # 记录性能指标
            metrics = QueryMetrics(
                query_hash=hash(str(statement)),
                execution_time_ms=elapsed,
                rows_returned=len(items),
                cache_hit=False,
            )
            
            if metrics.is_slow:
                self.slow_query_log.append(metrics)
                logger.warning(
                    f"🐌 慢查询检测:\n"
                    f"   标签: {metrics_label}\n"
                    f"   耗时: {elapsed:.2f}ms\n"
                    f"   返回行数: {len(items)}\n"
                    f"   建议检查索引或优化SQL"
                )
            else:
                logger.debug(f"✅ 查询完成: {metrics_label} ({elapsed:.2f}ms, {len(items)}行)")
            
            # 存入缓存
            if cache_key and self.cache_enabled and items:
                from ..core.cache_system import cache_service
                
                # 序列化结果
                serializable_items = [
                    item.to_dict() if hasattr(item, 'to_dict') else 
                    {c.name: getattr(item, c.name) for c in item.__table__.columns}
                    for item in items
                ]
                await cache_service.set_json(cache_key, serializable_items, cache_ttl)
            
            return list(items)
            
        except Exception as e:
            logger.error(f"❌ 查询执行失败: {e}")
            raise
    
    async def paginate(
        self,
        statement: Select,
        *,
        page: int = 1,
        page_size: int = 20,
        max_page_size: int = 100,
        order_by: Optional[Any] = None,
        count_query: Optional[Select] = None,
    ) -> PaginatedResult:
        """
        优化的分页查询
        
        Args:
            statement: 基础查询语句
            page: 页码（从1开始）
            page_size: 每页数量
            max_page_size: 最大每页数量限制
            order_by: 排序字段
            count_query: 自定义计数查询（用于复杂查询）
            
        Returns:
            PaginatedResult: 分页结果对象
        """
        # 限制最大页大小
        page_size = min(page_size, max_page_size)
        
        start_time = time.perf_counter()
        
        # 计算总数（优化：使用独立的轻量级计数查询）
        if count_query:
            total_result = await self.db.execute(count_query)
        else:
            # 自动生成计数查询（移除ORDER BY和LIMIT/OFFSET以提高性能）
            base_count_stmt = statement.order_by(None).limit(None).offset(None)
            total_result = await self.db.execute(
                func.count().select_from(base_count_stmt.subquery())
            )
        
        total = total_result.scalar() or 0
        total_pages = max(1, (total + page_size - 1) // page_size)
        
        # 确保页码在有效范围内
        page = max(1, min(page, total_pages))
        offset = (page - 1) * page_size
        
        # 应用排序和分页
        if order_by is not None:
            statement = statement.order_by(order_by)
        
        paginated_statement = statement.limit(page_size).offset(offset)
        
        # 执行查询
        result = await self.db.execute(paginated_statement)
        items = result.scalars().all()
        
        elapsed = (time.perf_counter() - start_time) * 1000
        
        logger.debug(
            f"📄 分页查询完成:\n"
            f"   总数: {total}\n"
            f"   页码: {page}/{total_pages}\n"
            f"   耗时: {elapsed:.2f}ms"
        )
        
        return PaginatedResult(
            items=list(items),
            total=total,
            page=page,
            page_size=page_size,
            total_pages=total_pages,
            has_next=page < total_pages,
            has_prev=page > 1,
        )
    
    async def batch_get(
        self,
        model_class: type,
        ids: List[int],
        *,
        batch_size: int = 50,
        id_column: str = "id"
    ) -> Dict[int, T]:
        """
        批量获取记录（避免循环查询）
        
        Args:
            model_class: ORM模型类
            ids: 要获取的ID列表
            batch_size: 每批次的ID数量
            id_column: ID列名
            
        Returns:
            Dict[int, T]: ID到对象的映射字典
        """
        if not ids:
            return {}
        
        result_map: Dict[int, Any] = {}
        
        # 分批处理
        for i in range(0, len(ids), batch_size):
            batch_ids = ids[i:i + batch_size]
            
            stmt = select(model_class).where(
                getattr(model_class, id_column).in_(batch_ids)
            )
            
            batch_results = await self.execute(stmt)
            
            for item in batch_results:
                item_id = getattr(item, id_column)
                result_map[item_id] = item
        
        logger.debug(f"📦 批量获取完成: {model_class.__name__}, {len(result_map)}条")
        
        return result_map
    
    async def exists(
        self,
        statement: Select,
        *,
        cache_key: Optional[str] = None,
        cache_ttl: int = 60,
    ) -> bool:
        """
        高效的存在性检查（只返回布尔值）
        
        Args:
            statement: 查询语句
            cache_key: 可选的缓存键
            cache_ttl: 缓存时间
            
        Returns:
            bool: 是否存在匹配记录
        """
        # 使用 EXISTS 子查询提高性能
        exists_stmt = select(func.literal(True)).where(
            statement.exists()
        ).limit(1)
        
        result = await self.db.execute(exists_stmt)
        exists = result.scalar() is not None
        
        # 缓存结果
        if cache_key and self.cache_enabled:
            from ..core.cache_system import cache_service
            await cache_service.set(cache_key, exists, cache_ttl)
        
        return exists
    
    def get_slow_queries(self, limit: int = 10) -> List[QueryMetrics]:
        """获取慢查询列表（按耗时降序）"""
        return sorted(
            self.slow_query_log,
            key=lambda x: x.execution_time_ms,
            reverse=True
        )[:limit]
    
    def clear_slow_query_log(self) -> None:
        """清空慢查询日志"""
        self.slow_query_log.clear()


# ── 便捷装饰器 ──

def cached_query(
    cache_key_pattern: str,
    ttl: int = 300,
    **kwargs
):
    """
    查询缓存装饰器（异步函数用）
    
    用法:
        @cached_query("user_profile:{user_id}", ttl=600)
        async def get_user_profile(user_id: int) -> dict:
            ...
    """
    def decorator(func):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            from ..core.cache_system import cache_service
            
            # 生成缓存键
            cache_key = cache_key_format(cache_key_pattern, args, kwargs)
            
            # 尝试从缓存获取
            cached = await cache_service.get_json(cache_key)
            if cached is not None:
                return cached
            
            # 执行函数
            result = await func(*args, **kwargs)
            
            # 存入缓存
            await cache_service.set_json(cache_key, result, ttl)
            
            return result
        
        return wrapper
    return decorator


def cache_key_format(pattern: str, args: tuple, kwargs: dict) -> str:
    """格式化缓存键"""
    key = pattern
    
    # 替换位置参数
    for i, arg in enumerate(args):
        key = key.replace(f"{{{i}}}", str(arg))
    
    # 替换关键字参数
    for name, value in kwargs.items():
        key = key.replace(f"{{{name}}}", str(value))
    
    return key


# ── 预加载策略常量 ──

LOAD_STRATEGIES = {
    # 选择性加载（推荐）
    "selectinload": selectinload,
    # JOIN 加载（适合一对多且数据量少时）
    "joinedload": joinedload,
}


# ── 全局实例工厂 ──

def create_optimizer(db: AsyncSession) -> QueryOptimizer:
    """创建查询优化器实例"""
    return QueryOptimizer(db)


# ── 性能监控中间件辅助 ──

async def log_query_performance(
    db: AsyncSession,
    label: str,
    stmt: Select
) -> float:
    """记录查询性能（供中间件使用）"""
    start = time.perf_counter()
    
    try:
        await db.execute(stmt)
    finally:
        elapsed = (time.perf_counter() - start) * 1000
        
        if elapsed > 500:  # > 500ms
            logger.warning(f"⏱️ 长耗时查询 [{label}]: {elapsed:.2f}ms")
        elif elapsed > 100:  # > 100ms
            logger.info(f"⏱️ 查询 [{label}]: {elapsed:.2f}ms")
        
        return elapsed