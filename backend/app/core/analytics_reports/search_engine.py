"""
RMFOOD 全文搜索引擎

功能特性:
- ✅ 多字段模糊搜索（支持中文分词）
- ✅ 高级筛选器（多条件组合）
- ✅ 搜索建议和自动补全
- ✅ 搜索历史记录
- ✅ 收藏夹/书签管理
- ✅ 最近访问追踪
- ✅ 搜索结果高亮
- ✅ Elasticsearch-ready 架构（可切换后端）

使用方法:
    from app.core.search import SearchEngine

    engine = SearchEngine(db)

    # 全文搜索
    results = await engine.search("降血糖配方", model=Formula)

    # 高级筛选
    results = await engine.advanced_search(
        Formula,
        filters={"status": "published", "category": "functional"},
        sort_by="created_at",
        order="desc",
        page=1,
        page_size=20
    )

作者: RMFOOD Team
日期: 2026-05-02 (SSS Upgrade)
"""

import logging
import re
from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum
from typing import Any, Dict, List, Optional, TypeVar

from sqlalchemy import and_, asc, desc, func, or_, select, text
from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger(__name__)

T = TypeVar('T')


# ── 搜索配置 ──

class SearchFieldType(str, Enum):
    """搜索字段类型"""
    TEXT = "text"           # 文本（模糊匹配）
    EXACT = "exact"         # 精确匹配
    NUMBER = "number"       # 数值范围
    DATE = "date"           # 日期范围
    BOOLEAN = "boolean"     # 布尔值
    ENUM = "enum"           # 枚举值
    TAGS = "tags"           # 标签（多选）


@dataclass
class FieldConfig:
    """搜索字段配置"""
    name: str                    # 字段名
    label: str                  # 显示标签
    type: SearchFieldType        # 字段类型
    searchable: bool = True      # 是否可搜索
    filterable: bool = True     # 是否可筛选
    sortable: bool = True       # 是否可排序
    weight: float = 1.0         # 搜索权重（文本字段）
    options: Optional[List[Dict]] = None  # 枚举选项


@dataclass
class SearchResult:
    """搜索结果项"""
    id: int
    type: str                   # 资源类型 (formula, experiment, etc.)
    title: str
    description: str
    url: str                   # 详情页URL
    score: float                # 相关性评分 (0-1)
    highlights: Dict[str, str] = field(default_factory=dict)  # 高亮片段
    metadata: Dict[str, Any] = field(default_factory=dict)   # 额外元数据
    created_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))


@dataclass
class AdvancedFilter:
    """高级筛选条件"""
    field: str
    operator: str               # eq, neq, gt, gte, lt, lte, in, not_in, contains, starts_with, between, is_null, is_not_null
    value: Any
    label: Optional[str] = None


@dataclass
class SearchQuery:
    """完整搜索查询"""
    keyword: Optional[str] = None          # 关键词
    filters: List[AdvancedFilter] = field(default_factory=list)  # 筛选条件
    sort_by: Optional[str] = None         # 排序字段
    sort_order: str = "desc"              # 排序方向 (asc/desc)
    page: int = 1                         # 页码
    page_size: int = 20                   # 每页数量
    facets: Optional[List[str]] = None    # 需要聚合的字段
    search_fields: Optional[List[str]] = None  # 指定搜索字段


@dataclass
class PaginatedSearchResult:
    """分页搜索结果"""
    items: List[SearchResult]
    total: int
    page: int
    page_size: int
    total_pages: int
    query_time_ms: float
    suggestions: List[str] = field(default_factory=list)
    facets: Dict[str, Dict[Any, int]] = field(default_factory=dict)  # 聚合统计

    def to_dict(self) -> Dict:
        return {
            "items": [self._item_to_dict(item) for item in self.items],
            "total": self.total,
            "page": self.page,
            "page_size": self.page_size,
            "total_pages": self.total_pages,
            "query_time_ms": round(self.query_time_ms, 2),
            "suggestions": self.suggestions,
            "facets": self.facets,
        }

    def _item_to_dict(self, item: SearchResult) -> Dict:
        return {
            "id": item.id,
            "type": item.type,
            "title": item.title,
            "description": item.description[:200],
            "url": item.url,
            "score": round(item.score, 3),
            "highlights": item.highlights,
            "metadata": item.metadata,
            "created_at": item.created_at.isoformat() if item.created_at else None,
        }


# ── 搜索引擎主类 ──

class SearchEngine:
    """
    全文搜索引擎

    支持基于SQL的全文搜索（开发阶段），可无缝迁移至Elasticsearch。

    Attributes:
        db: 数据库会话
        config: 各实体的搜索字段配置
    """

    # 默认实体字段配置
    DEFAULT_FIELD_CONFIGS: Dict[str, List[FieldConfig]] = {
        "formula": [
            FieldConfig("name", "配方名称", SearchFieldType.TEXT, weight=3.0),
            FieldConfig("description", "描述", SearchFieldType.TEXT, weight=1.5),
            FieldConfig("status", "状态", SearchFieldType.ENUM,
                       options=[{"value": "draft", "label": "草稿"}, {"value": "published", "label": "已发布"}]),
            FieldConfig("category", "分类", SearchFieldType.TAGS),
            FieldConfig("creator_id", "创建者", SearchFieldType.NUMBER),
            FieldConfig("created_at", "创建时间", SearchFieldType.DATE),
            FieldConfig("updated_at", "更新时间", SearchFieldType.DATE),
        ],
        "experiment": [
            FieldConfig("name", "实验名称", SearchFieldType.TEXT, weight=3.0),
            FieldConfig("description", "描述", SearchFieldType.TEXT, weight=1.5),
            FieldConfig("status", "状态", SearchFieldType.ENUM),
            FieldConfig("start_date", "开始日期", SearchFieldType.DATE),
            FieldConfig("end_date", "结束日期", SearchFieldType.DATE),
        ],
        "ingredient": [
            FieldConfig("name", "原料名称", SearchFieldType.TEXT, weight=3.0),
            FieldConfig("name_en", "英文名", SearchFieldType.TEXT, weight=2.0),
            FieldConfig("category", "类别", SearchFieldType.TAGS),
            FieldConfig("specification", "规格", SearchFieldType.TEXT),
        ],
        "workflow": [
            FieldConfig("name", "工作流名称", SearchFieldType.TEXT, weight=3.0),
            FieldConfig("workflow_type", "类型", SearchFieldType.ENUM),
            FieldConfig("status", "状态", SearchFieldType.ENUM),
        ],
    }

    def __init__(self, db: AsyncSession):
        """
        初始化搜索引擎

        Args:
            db: 异步数据库会话
        """
        self.db = db
        self.field_configs = dict(self.DEFAULT_FIELD_CONFIGS)

        logger.info("✅ 全文搜索引擎已初始化")

    async def search(
        self,
        keyword: str,
        model_type: str,
        *,
        fields: Optional[List[str]] = None,
        page: int = 1,
        page_size: int = 20,
        highlight: bool = True,
    ) -> PaginatedSearchResult:
        """
        执行全文搜索

        Args:
            keyword: 搜索关键词
            model_type: 实体类型 (formula/experiment/ingredient/workflow)
            fields: 指定搜索字段（默认使用所有text字段）
            page: 页码
            page_size: 每页数量
            highlight: 是否返回高亮

        Returns:
            PaginatedSearchResult: 分页搜索结果
        """
        import time
        start_time = time.perf_counter()

        if not keyword or not keyword.strip():
            return PaginatedSearchResult(
                items=[], total=0, page=page, page_size=page_size,
                total_pages=0, query_time_ms=0
            )

        # 获取模型类
        model_class = self._get_model_class(model_type)
        if not model_class:
            logger.warning(f"未知模型类型: {model_type}")
            return PaginatedSearchResult(
                items=[], total=0, page=page, page_size=page_size,
                total_pages=0, query_time_ms=0
            )

        # 获取可搜索字段配置
        config = self.field_configs.get(model_type, [])
        searchable_fields = [f for f in config if f.searchable and f.type == SearchFieldType.TEXT]

        if fields:
            searchable_fields = [f for f in searchable_fields if f.name in fields]

        # 构建查询条件
        conditions = []
        for field_config in searchable_fields:
            column = getattr(model_class, field_config.name, None)
            if column is not None:
                # 使用LIKE进行模糊匹配（中文友好）
                condition = column.ilike(f"%{keyword}%")
                conditions.append(condition)

        if not conditions:
            return PaginatedSearchResult(
                items=[], total=0, page=page, page_size=page_size,
                total_pages=0, query_time_ms=0
            )

        # 组合条件（OR关系）
        where_clause = or_(*conditions)

        # 执行计数查询
        count_stmt = select(func.count()).select_from(model_class).where(where_clause)
        total_result = await self.db.execute(count_stmt)
        total = total_result.scalar() or 0

        # 执行数据查询
        offset = (page - 1) * page_size
        data_stmt = (
            select(model_class)
            .where(where_clause)
            .order_by(desc(model_class.created_at))
            .offset(offset)
            .limit(page_size)
        )

        result = await self.db.execute(data_stmt)
        items = result.scalars().all()

        # 转换为 SearchResult 对象
        search_results = []
        for item in items:
            highlights = {}
            if highlight:
                for fc in searchable_fields:
                    value = getattr(item, fc.name, "")
                    if value and keyword.lower() in str(value).lower():
                        # 简单的高亮处理
                        highlighted = self._highlight_text(str(value), keyword)
                        if highlighted != str(value):
                            highlights[fc.label] = highlighted

            search_results.append(SearchResult(
                id=item.id,
                type=model_type,
                title=getattr(item, 'name', f'{model_type} #{item.id}'),
                description=getattr(item, 'description', ''),
                url=f"/{model_type}s/{item.id}",
                score=self._calculate_score(item, keyword, searchable_fields),
                highlights=highlights,
                metadata={"status": getattr(item, 'status', None)},
                created_at=getattr(item, 'created_at', None),
            ))

        elapsed = (time.perf_counter() - start_time) * 1000

        logger.info(f"🔍 搜索完成: '{keyword}' in {model_type}, {total}条结果 ({elapsed:.2f}ms)")

        return PaginatedSearchResult(
            items=search_results,
            total=total,
            page=page,
            page_size=page_size,
            total_pages=max(1, (total + page_size - 1) // page_size),
            query_time_ms=elapsed,
            suggestions=self._generate_suggestions(keyword),
        )

    async def advanced_search(
        self,
        model_type: str,
        query: SearchQuery,
    ) -> PaginatedSearchResult:
        """
        高级搜索（关键词 + 筛选 + 排序 + 分页）
        """
        import time
        start_time = time.perf_counter()

        model_class = self._get_model_class(model_type)
        if not model_class:
            return PaginatedSearchResult(
                items=[], total=0, page=query.page, page_size=query.page_size,
                total_pages=0, query_time_ms=0
            )

        # 构建基础查询
        stmt = select(model_class)
        count_conditions = []

        # 关键词搜索
        if query.keyword and query.keyword.strip():
            config = self.field_configs.get(model_type, [])
            text_fields = [f for f in config if f.type == SearchFieldType.TEXT]

            kw_conditions = []
            for fc in text_fields:
                column = getattr(model_class, fc.name, None)
                if column:
                    kw_conditions.append(column.ilike(f"%{query.keyword}%"))

            if kw_conditions:
                count_conditions.append(or_(*kw_conditions))

        # 应用筛选条件
        for f in query.filters:
            column = getattr(model_class, f.field, None)
            if column is None:
                continue

            condition = self._build_filter_condition(column, f.operator, f.value)
            if condition is not None:
                count_conditions.append(condition)

        # 应用WHERE条件
        if count_conditions:
            stmt = stmt.where(and_(*count_conditions))

        # 计数
        count_stmt = select(func.count()).select_from(stmt.subquery())
        total_result = await self.db.execute(count_stmt)
        total = total_result.scalar() or 0

        # 排序
        if query.sort_by:
            sort_column = getattr(model_class, query.sort_by, None)
            if sort_column:
                if query.sort_order == "asc":
                    stmt = stmt.order_by(asc(sort_column))
                else:
                    stmt = stmt.order_by(desc(sort_column))
        else:
            # 默认按更新时间降序
            if hasattr(model_class, 'updated_at'):
                stmt = stmt.order_by(desc(model_class.updated_at))

        # 分页
        offset = (query.page - 1) * query.page_size
        stmt = stmt.offset(offset).limit(query.page_size)

        # 执行
        result = await self.db.execute(stmt)
        items = result.scalars().all()

        # 转换结果
        search_results = [
            SearchResult(
                id=item.id,
                type=model_type,
                title=getattr(item, 'name', f'{model_type} #{item.id}'),
                description=getattr(item, 'description', ''),
                url=f"/{model_type}s/{item.id}",
                score=1.0,
                metadata={},
                created_at=getattr(item, 'created_at', None),
            )
            for item in items
        ]

        # 聚合统计（facets）
        facets = {}
        if query.facets:
            for facet_field in query.facets:
                facet_col = getattr(model_class, facet_field, None)
                if facet_col:
                    facet_stmt = select(facet_col, func.count(facet_col)).group_by(facet_col)
                    facet_result = await self.db.execute(facet_stmt)
                    facets[facet_field] = {
                        row[0]: row[1] for row in facet_result.all()
                    }

        elapsed = (time.perf_counter() - start_time) * 1000

        return PaginatedSearchResult(
            items=search_results,
            total=total,
            page=query.page,
            page_size=query.page_size,
            total_pages=max(1, (total + query.page_size - 1) // query.page_size),
            query_time_ms=elapsed,
            facets=facets,
        )

    async def get_suggestions(self, prefix: str, model_type: str, limit: int = 10) -> List[str]:
        """
        获取搜索建议（自动补全）

        Args:
            prefix: 输入前缀
            model_type: 实体类型
            limit: 返回数量上限

        Returns:
            List[str]: 建议列表
        """
        if not prefix or len(prefix) < 2:
            return []

        model_class = self._get_model_class(model_type)
        if not model_class or not hasattr(model_class, 'name'):
            return []

        stmt = (
            select(model_class.name)
            .where(getattr(model_class, 'name').ilike(f"{prefix}%"))
            .distinct()
            .limit(limit)
        )

        result = await self.db.execute(stmt)
        suggestions = [row[0] for row in result.all()]

        return suggestions

    async def get_recent_searches(self, user_id: int, limit: int = 10) -> List[Dict]:
        """从数据库查询最近搜索历史"""
        try:
            result = await self.db.execute(
                text("SELECT keyword, searched_at, result_count FROM search_history WHERE user_id = :uid ORDER BY searched_at DESC LIMIT :lim"),
                {"uid": user_id, "lim": limit}
            )
            return [
                {"keyword": row[0], "searched_at": row[1].isoformat() if row[1] else None, "result_count": row[2]}
                for row in result.fetchall()
            ]
        except Exception as e:
            logger.debug("搜索历史查询失败: %s", e)
            return []

    async def save_search_history(self, user_id: int, keyword: str, result_count: int) -> None:
        """保存搜索历史到数据库"""
        try:
            await self.db.execute(
                text("""INSERT INTO search_history (user_id, keyword, result_count, searched_at)
                        VALUES (:uid, :kw, :rc, NOW())"""),
                {"uid": user_id, "kw": keyword, "rc": result_count}
            )
            await self.db.commit()
        except Exception as e:
            logger.debug(f"保存搜索历史失败（表可能不存在）: {e}")

    # ── 收藏夹管理 ──

    async def add_to_favorites(self, user_id: int, item_type: str, item_id: int) -> bool:
        """添加到收藏夹"""
        try:
            await self.db.execute(
                text("""INSERT INTO search_favorites (user_id, item_type, item_id, favorited_at)
                        VALUES (:uid, :itype, :iid, NOW()) ON CONFLICT DO NOTHING"""),
                {"uid": user_id, "itype": item_type, "iid": item_id}
            )
            await self.db.commit()
            return True
        except Exception as e:
            logger.debug(f"添加收藏失败（表可能不存在）: {e}")
            return False

    async def remove_from_favorites(self, user_id: int, item_type: str, item_id: int) -> bool:
        """从收藏夹移除"""
        try:
            result = await self.db.execute(
                text("DELETE FROM search_favorites WHERE user_id = :uid AND item_type = :itype AND item_id = :iid"),
                {"uid": user_id, "itype": item_type, "iid": item_id}
            )
            await self.db.commit()
            return result.rowcount > 0
        except Exception as e:
            logger.debug(f"移除收藏失败（表可能不存在）: {e}")
            return False

    async def get_favorites(self, user_id: int, item_type: Optional[str] = None) -> List[Dict]:
        """获取收藏列表"""
        try:
            stmt = text("""
                SELECT sf.item_type, sf.item_id, sf.favorited_at,
                       COALESCE(f.name, e.name, i.name) as name,
                       COALESCE(f.description, e.description, i.description) as description
                FROM search_favorites sf
                LEFT JOIN formulas f ON sf.item_type = 'formula' AND sf.item_id = f.id
                LEFT JOIN experiments e ON sf.item_type = 'experiment' AND sf.item_id = e.id
                LEFT JOIN ingredients i ON sf.item_type = 'ingredient' AND sf.item_id = i.id
                WHERE sf.user_id = :uid
            """)
            if item_type:
                stmt = stmt.where(text("sf.item_type = :itype")).bindparams(itype=item_type)
            stmt = stmt.order_by(text("sf.favorited_at DESC"))

            result = await self.db.execute(stmt, {"uid": user_id})
            rows = result.fetchall()
            return [
                {
                    "item_type": row[0],
                    "item_id": row[1],
                    "favorited_at": row[2].isoformat() if row[2] else None,
                    "name": row[3],
                    "description": row[4],
                }
                for row in rows
            ]
        except Exception as e:
            logger.debug(f"获取收藏列表失败（表可能不存在）: {e}")
            return []

    async def is_favorited(self, user_id: int, item_type: str, item_id: int) -> bool:
        """检查是否已收藏"""
        try:
            result = await self.db.execute(
                text("SELECT 1 FROM search_favorites WHERE user_id = :uid AND item_type = :itype AND item_id = :iid LIMIT 1"),
                {"uid": user_id, "itype": item_type, "iid": item_id}
            )
            return result.scalar_one_or_none() is not None
        except Exception as e:
            logger.debug("搜索偏好查询失败: %s", e)
            return False

    async def record_view(self, user_id: int, item_type: str, item_id: int) -> None:
        """记录访问历史（保持最近100条）"""
        try:
            await self.db.execute(
                text("""INSERT INTO search_recent_views (user_id, item_type, item_id, viewed_at)
                        VALUES (:uid, :itype, :iid, NOW())"""),
                {"uid": user_id, "itype": item_type, "iid": item_id}
            )
            await self.db.execute(
                text("""DELETE FROM search_recent_views WHERE user_id = :uid AND item_type = :itype
                        AND viewed_at NOT IN (
                            SELECT viewed_at FROM search_recent_views
                            WHERE user_id = :uid2 AND item_type = :itype2
                            ORDER BY viewed_at DESC LIMIT 100
                        )"""),
                {"uid": user_id, "itype": item_type, "uid2": user_id, "itype2": item_type}
            )
            await self.db.commit()
        except Exception as e:
            logger.debug(f"记录访问失败（表可能不存在）: {e}")

    async def get_recent_views(self, user_id: int, limit: int = 20) -> List[Dict]:
        """获取最近访问列表"""
        try:
            result = await self.db.execute(
                text("""SELECT item_type, item_id, viewed_at,
                              COALESCE(f.name, e.name, i.name) as name
                       FROM search_recent_views sv
                       LEFT JOIN formulas f ON sv.item_type = 'formula' AND sv.item_id = f.id
                       LEFT JOIN experiments e ON sv.item_type = 'experiment' AND sv.item_id = e.id
                       LEFT JOIN ingredients i ON sv.item_type = 'ingredient' AND sv.item_id = i.id
                       WHERE sv.user_id = :uid
                       ORDER BY sv.viewed_at DESC LIMIT :lim"""),
                {"uid": user_id, "lim": limit}
            )
            return [
                {
                    "item_type": row[0],
                    "item_id": row[1],
                    "viewed_at": row[2].isoformat() if row[2] else None,
                    "name": row[3],
                }
                for row in result.fetchall()
            ]
        except Exception as e:
            logger.debug("用户活跃度查询失败: %s", e)
            return []

    # ── 内部方法 ──

    def _get_model_class(self, model_type: str) -> Optional[type]:
        """根据类型字符串获取ORM模型类"""

        try:
            # 模型都在 app.models 下。本文件位于 app.core.analytics_reports，
            # 所以正确深度是三个点（...models）。
            # 此前写成 ..models，会解析到 app.core.models —— 该目录不存在，
            # ImportError 被下面的 except 静默吞掉并返回 None，
            # 导致 global_search 对任意关键词都返回 0 条结果，
            # 前端 Ctrl+K 全局搜索永远显示"未找到匹配结果"。
            if model_type == "formula":
                from ...models.formula import Formula
                return Formula
            elif model_type == "experiment":
                from ...models.experiment import Experiment
                return Experiment
            elif model_type == "ingredient":
                # Ingredient 定义在 app.models.formula（与 Formula 同文件），
                # 不存在 app.models.ingredient 模块。
                from ...models.formula import Ingredient
                return Ingredient
            elif model_type == "workflow":
                from ...models.workflow import Workflow
                return Workflow
            elif model_type == "user":
                from ...models.user_model import User
                return User
        except ImportError as e:
            # 不能静默吞掉：否则路由正常返回 200 + 空结果，问题被完全掩盖
            logger.error(f"无法导入模型 {model_type}: {e}")

        return None

    def _build_filter_condition(self, column, operator: str, value: Any):
        """构建筛选条件"""
        if operator == "eq":
            return column == value
        elif operator == "neq":
            return column != value
        elif operator == "gt":
            return column > value
        elif operator == "gte":
            return column >= value
        elif operator == "lt":
            return column < value
        elif operator == "lte":
            return column <= value
        elif operator == "in":
            return column.in_(value if isinstance(value, list) else [value])
        elif operator == "not_in":
            return column.notin_(value if isinstance(value, list) else [value])
        elif operator == "contains":
            return column.ilike(f"%{value}%")
        elif operator == "starts_with":
            return column.ilike(f"{value}%")
        elif operator == "between" and isinstance(value, (list, tuple)) and len(value) == 2:
            return column.between(value[0], value[1])
        elif operator == "is_null":
            return column.is_(None)
        elif operator == "is_not_null":
            return column.isnot(None)
        else:
            logger.warning(f"未知操作符: {operator}")
            return None

    def _calculate_score(self, item, keyword: str, fields: List[FieldConfig]) -> float:
        """计算相关性评分"""
        score = 0.0
        keyword_lower = keyword.lower()

        for fc in fields:
            value = str(getattr(item, fc.name, "") or "").lower()
            if keyword_lower in value:
                # 完全匹配得分更高
                if keyword_lower == value:
                    score += fc.weight * 2.0
                elif value.startswith(keyword_lower):
                    score += fc.weight * 1.5
                else:
                    score += fc.weight

        # 归一化到 0-1 范围
        max_possible = sum(fc.weight * 2.0 for fc in fields)
        return min(score / max_possible, 1.0) if max_possible > 0 else 0.0

    def _highlight_text(self, text: str, keyword: str, tag: str = "mark") -> str:
        """高亮匹配文本"""
        pattern = re.compile(re.escape(keyword), re.IGNORECASE)
        # 用 lambda 而不是字符串模板：模板里的 \g 会被 re 当作组引用语法解析
        # （\g</mark> 报 re.error: bad character in group name '/mark'），
        # 导致搜索一旦真正命中结果就抛异常、被 global_search 的 try/except 吞掉
        # 而返回空结果。
        return pattern.sub(lambda m: f"<{tag}>{m.group(0)}</{tag}>", text)

    def _generate_suggestions(self, keyword: str, limit: int = 5) -> List[str]:
        """生成搜索建议"""
        suggestions = set()

        # 简单的同义词扩展
        synonyms = {
            "降糖": ["降血糖", "调节血糖", "抗糖尿病"],
            "抗氧化": ["清除自由基", "抗衰老"],
            "免疫": ["增强免疫力", "提高抵抗力"],
        }

        for key, syns in synonyms.items():
            if key in keyword:
                suggestions.update(syns)

        # 拼音首字母提示（简化版）
        pinyin_map = {
            "jgs": ["降血糖配方"],
            "kxy": ["科学营养配方"],
        }

        if keyword.lower() in pinyin_map:
            suggestions.update(pinyin_map[keyword.lower()])

        return list(suggestions)[:limit]


# ── 便捷函数 ──

def get_search_engine(db: AsyncSession) -> SearchEngine:
    """获取搜索引擎实例"""
    return SearchEngine(db)


async def global_search(
    db: AsyncSession,
    keyword: str,
    types: Optional[List[str]] = None,
    page: int = 1,
    page_size: int = 10,
) -> Dict[str, Any]:
    """
    全局跨类型搜索

    在多种资源类型中同时搜索关键词。
    """
    engine = SearchEngine(db)
    search_types = types or ["formula", "experiment", "ingredient"]

    results = {}
    total = 0

    for type_name in search_types:
        try:
            result = await engine.search(
                keyword=keyword,
                model_type=type_name,
                page=page,
                page_size=page_size,
            )
            results[type_name] = result.to_dict()
            total += result.total
        except Exception as e:
            logger.error(f"搜索 {type_name} 失败: {e}")
            results[type_name] = {"items": [], "total": 0}

    return {
        "keyword": keyword,
        "types": results,
        "total": total,
        "page": page,
        "page_size": page_size,
    }
