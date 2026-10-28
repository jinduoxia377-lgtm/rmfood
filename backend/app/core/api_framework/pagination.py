"""RMFOOD 分页工具

提供分页查询的辅助函数
"""
from typing import Sequence, TypeVar

from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

T = TypeVar('T')


class PaginationParams(BaseModel):
    """分页参数"""
    page: int = 1
    page_size: int = 20

    @property
    def offset(self) -> int:
        return (self.page - 1) * self.page_size

    @property
    def limit(self) -> int:
        return self.page_size


async def paginate(
    session: AsyncSession,
    query,
    page: int = 1,
    page_size: int = 20
) -> tuple[Sequence, int]:
    """分页查询

    Args:
        session: 数据库会话
        query: SQLAlchemy查询对象
        page: 页码（从1开始）
        page_size: 每页数量

    Returns:
        (items, total) 元组，包含查询结果和总数
    """
    # 计算总数
    count_query = select(func.count()).select_from(query.subquery())
    total_result = await session.execute(count_query)
    total = total_result.scalar() or 0

    # 分页查询
    offset = (page - 1) * page_size
    paginated_query = query.offset(offset).limit(page_size)
    result = await session.execute(paginated_query)
    items = result.scalars().all()

    return items, total


def create_paginated_response(
    items: list[T],
    total: int,
    page: int,
    page_size: int
) -> dict:
    """创建分页响应

    Args:
        items: 查询结果列表
        total: 总数
        page: 当前页
        page_size: 每页数量

    Returns:
        分页响应字典
    """
    total_pages = (total + page_size - 1) // page_size if page_size > 0 else 0

    return {
        "items": items,
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": total_pages
    }
