"""
🔴 P0-2: 数据库索引自动优化器

根据业务场景分析，识别高频查询的索引缺失问题，
并生成 CREATE INDEX 语句。

关键索引场景分析:
1. 配方核心查询 - code/status/creator_id/created_at
2. 配方文本搜索 - name/code/description
3. 高频过滤字段 - status/creator_id
4. 排序优化 - updated_at

性能提升预估: 2-5 倍（缺失索引场景
使用方式:

from app.core.api_framework.index_optimizer import (
    run_index_analysis,
    get_missing_indexes,
    generate_index_creation_sql,
)

# 在 main.py 启动时
# index_analysis = await run_index_analysis(db_session)
# logger.info("缺失的索引: %s", index_analysis.get('missing_indexes', []))

# 生成 SQL 供 DBA 审核
sql = generate_index_creation_sql(index_analysis['missing_indexes'])
"""
from __future__ import annotations

import logging
import time
from dataclasses import dataclass
from typing import Any, Dict, List, Optional

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.utils.error_sanitize import sanitize_error

logger = logging.getLogger(__name__)

# ═════════════════════════════════════════
# 🔴 P0-2: 索引定义
# ═════════════════════════════════════════

@dataclass
class IndexCandidate:
    """索引候选 - 定义建议创建的索引"""
    table: str
    columns: List[str]
    index_type: str = "btree"
    is_unique: bool = False
    reason: str = ""
    estimated_size_bytes: int = 0
    estimated_improvement: str = "2-5x"  # 预估提升倍数
    priority: str = "medium"  # high/medium/low

    @property
    def name(self) -> str:
        cols = "_".join(self.columns)
        prefix = "uk" if self.is_unique else "idx"
        return f"{prefix}_{self.table}_{cols}"

    def to_sql(self) -> str:
        """生成 CREATE INDEX SQL"""
        col_list = ", ".join(self.columns)
        unique = "UNIQUE" if self.is_unique else ""
        return (
            f"CREATE {unique} INDEX IF NOT EXISTS "
            f"{self.name} ON {self.table} "
            f"USING {self.index_type} ({col_list});"
        )

# ═════════════════════════════════════════
# 🔴 P0-2: 高频查询索引建议
# ═════════════════════════════════════════

# 🔴 P0-2: 核心索引策略
# 根据系统分析，以下索引缺失是性能瓶颈
INDEX_CANDIDATES: List[IndexCandidate] = [
    # ────────────────────────
    # 配方表核心索引 (formulas)
    # ────────────────────────
    IndexCandidate(
        table="formulas",
        columns=["status"],
        reason="筛选不同状态的配方列表（DRAFT/REVIEWED/APPROVED/REJECTED）",
        priority="high",
    ),
    IndexCandidate(
        table="formulas",
        columns=["creator_id"],
        reason="按创建者查询配方列表",
        priority="high",
    ),
    IndexCandidate(
        table="formulas",
        columns=["created_at"],
        reason="时间范围查询、排序、报表统计",
        priority="high",
    ),
    IndexCandidate(
        table="formulas",
        columns=["updated_at"],
        reason="最近更新列表排序（配方列表页默认排序）",
        priority="high",
    ),
    IndexCandidate(
        table="formulas",
        columns=["reviewer_id"],
        reason="审核者过滤查询（审核员列表）",
        priority="medium",
    ),
    IndexCandidate(
        table="formulas",
        columns=["version"],
        reason="按版本号过滤配方",
        priority="low",
    ),
    IndexCandidate(
        table="formulas",
        columns=["status", "updated_at"],
        reason="配方列表页的组合查询（状态+时间排序）",
        priority="high",
    ),
    IndexCandidate(
        table="formulas",
        columns=["creator_id", "status"],
        reason="用户的配方状态过滤（我的配方列表）",
        priority="high",
    ),

    # ────────────────────────
    # 用户表核心索引 (users)
    # ────────────────────────
    IndexCandidate(
        table="users",
        columns=["email"],
        is_unique=True,
        reason="登录时按邮箱查询用户",
        priority="high",
    ),
    IndexCandidate(
        table="users",
        columns=["username"],
        is_unique=True,
        reason="按用户名查询（登录可选方式）",
        priority="high",
    ),
    IndexCandidate(
        table="users",
        columns=["role"],
        reason="按角色查询用户列表（仅显示管理员/配方师等）",
        priority="medium",
    ),
    IndexCandidate(
        table="users",
        columns=["organization_id"],
        reason="按组织查询用户列表（多租户场景）",
        priority="medium",
    ),
    IndexCandidate(
        table="users",
        columns=["last_login_at"],
        reason="按最后登录时间排序（用户活跃报表）",
        priority="low",
    ),

    # ────────────────────────
    # 成分/配料表核心索引 (ingredients)
    # ────────────────────────
    IndexCandidate(
        table="ingredients",
        columns=["name"],
        reason="按名称搜索配料成分",
        priority="medium",
    ),
    IndexCandidate(
        table="ingredients",
        columns=["created_at"],
        reason="时间范围查询",
        priority="low",
    ),

    # ────────────────────────
    # 实验核心索引 (experiments)
    # ────────────────────────
    IndexCandidate(
        table="experiments",
        columns=["formula_id"],
        reason="按配方查询实验数据",
        priority="high",
    ),
    IndexCandidate(
        table="experiments",
        columns=["researcher_id"],
        reason="按研究员查询实验列表",
        priority="medium",
    ),
    IndexCandidate(
        table="experiments",
        columns=["status"],
        reason="按实验状态筛选（进行中/已完成）",
        priority="medium",
    ),
    IndexCandidate(
        table="experiments",
        columns=["created_at"],
        reason="时间排序",
        priority="low",
    ),

    # ────────────────────────
    # 肽段/活性肽核心索引
    # ────────────────────────
    IndexCandidate(
        table="peptides",
        columns=["name"],
        reason="按名称查询肽段",
        priority="medium",
    ),
    IndexCandidate(
        table="peptides",
        columns=["molecular_weight"],
        reason="按分子量范围查询",
        priority="medium",
    ),
    IndexCandidate(
        table="peptides",
        columns=["created_at"],
        reason="时间排序",
        priority="low",
    ),

    # ────────────────────────
    # 通知系统索引 (notifications)
    # ────────────────────────
    IndexCandidate(
        table="notifications",
        columns=["user_id"],
        reason="用户通知列表查询",
        priority="high",
    ),
    IndexCandidate(
        table="notifications",
        columns=["read_at"],
        reason="按已读状态筛选（未读通知查询）",
        priority="medium",
    ),
    IndexCandidate(
        table="notifications",
        columns=["created_at"],
        reason="按时间排序",
        priority="low",
    ),

    # ────────────────────────
    # 类别与标签索引
    # ────────────────────────
    IndexCandidate(
        table="categories",
        columns=["name"],
        is_unique=True,
        reason="类别名称唯一索引",
        priority="medium",
    ),
    IndexCandidate(
        table="tags",
        columns=["name"],
        is_unique=True,
        reason="标签名称唯一索引（已有但强化约束）",
        priority="low",
    ),
    IndexCandidate(
        table="tags",
        columns=["usage_count"],
        reason="按使用量排序（热门标签推荐）",
        priority="low",
    ),

    # ────────────────────────
    # 配方版本索引 (formula_versions)
    # ────────────────────────
    IndexCandidate(
        table="formula_versions",
        columns=["formula_id", "version"],
        is_unique=True,
        reason="配方+版本唯一组合（防止重复版本）",
        priority="high",
    ),
    IndexCandidate(
        table="formula_versions",
        columns=["formula_id"],
        reason="按配方查询版本历史",
        priority="high",
    ),

    # ────────────────────────
    # 多对多关联表索引
    # ────────────────────────
    IndexCandidate(
        table="formula_categories",
        columns=["category_id"],
        reason="反查：按类别查询配方列表",
        priority="medium",
    ),
    IndexCandidate(
        table="formula_tags",
        columns=["tag_id"],
        reason="反查：按标签查询配方列表",
        priority="medium",
    ),
    IndexCandidate(
        table="formula_ingredients",
        columns=["ingredient_id"],
        reason="反查：按成分查询配方列表",
        priority="medium",
    ),
    IndexCandidate(
        table="formula_peptides",
        columns=["peptide_id"],
        reason="反查：按肽段查询配方列表",
        priority="medium",
    ),
]

# ═════════════════════════════════════════
# 🔴 P0-2: 索引分析工具
# ═════════════════════════════════════════

class IndexAnalyzer:
    """索引分析器

    功能:
    1. 检查现有索引使用情况
    2. 生成缺失的索引建议
    3. 输出 CREATE INDEX 语句
    """

    def __init__(self, session: AsyncSession):
        self._session = session

    async def get_existing_indexes(self) -> Dict[str, List[str]]:
        """
        查询数据库中已存在的索引

        Returns:
            {table_name: [index_name1, index_name2, ...]}
        """
        query = text("""
            SELECT t.relname AS table_name,
                   i.relname AS index_name
            FROM pg_class t
            JOIN pg_index ix ON t.oid = ix.indrelid
            JOIN pg_class i ON i.oid = ix.indexrelid
            JOIN pg_namespace n ON t.relnamespace = n.oid
            WHERE n.nspname = 'public'
              AND t.relkind = 'r'
              AND i.relkind = 'i'
            ORDER BY t.relname, i.relname;
        """)

        result = await self._session.execute(query)
        rows = result.fetchall()

        existing: Dict[str, List[str]] = {}
        for row in rows:
            if row.table_name not in existing:
                existing[row.table_name] = []
            existing[row.table_name].append(row.index_name)

        logger.info(f"[IndexAnalyzer] 已发现 {len(rows)} 个索引，覆盖 {len(existing)} 个表")
        return existing

    async def get_unused_indexes(self) -> List[Dict[str, Any]]:
        """
        识别未使用的索引（需要 pg_stat_user_indexes 视图）

        Returns:
            [{table_name, index_name, scans}]
        """
        query = text("""
            SELECT s.relname AS table_name,
                   s.indexrelname AS index_name,
                   s.idx_scan AS scan_count
            FROM pg_stat_user_indexes s
            JOIN pg_index i ON s.indexrelid = i.indexrelid
            WHERE s.idx_scan = 0
              AND i.indisunique = false  -- 排除唯一索引（可能用于约束）
              AND i.indisprimary = false  -- 排除主键索引
            ORDER BY s.relname, s.indexrelname;
        """)

        try:
            result = await self._session.execute(query)
            rows = result.fetchall()
            return [
                {
                    'table_name': row.table_name,
                    'index_name': row.index_name,
                    'scan_count': row.scan_count,
                }
                for row in rows
            ]
        except Exception as e:
            logger.warning(f"[IndexAnalyzer] 无法查询索引使用统计: {e}")
            return []

    async def analyze_index_usage(self) -> Dict[str, Any]:
        """
        综合分析：现有索引 + 未使用索引 + 建议创建的索引
        """
        start = time.time()

        existing = await self.get_existing_indexes()
        unused = await self.get_unused_indexes()

        # 识别缺失索引：对比现有索引与建议索引
        existing_names = set()
        for table, indexes in existing.items():
            for idx in indexes:
                existing_names.add(idx)

        # 过滤出未在数据库中存在的索引
        missing: List[IndexCandidate] = []
        for candidate in INDEX_CANDIDATES:
            if candidate.name not in existing_names:
                missing.append(candidate)

        # 按优先级排序
        priority_order = {'high': 0, 'medium': 1, 'low': 2}
        missing.sort(key=lambda c: priority_order.get(c.priority, 1))

        elapsed = time.time() - start

        result = {
            "analysis_time_ms": int(elapsed * 1000),
            "total_existing_indexes": sum(len(v) for v in existing.values()),
            "unused_indexes": unused,
            "missing_indexes_by_table": {},  # 按表分组
            "missing_indexes_summary": [],
        }

        # 按表分组
        for c in missing:
            table = c.table
            if table not in result["missing_indexes_by_table"]:
                result["missing_indexes_by_table"][table] = []
            result["missing_indexes_by_table"][table].append(c.to_dict())

        # 汇总列表（方便生成 SQL
        result["missing_indexes"] = [c.to_dict() for c in missing]

        logger.info(
            f"[IndexAnalyzer] 分析完成，发现 {len(missing)} 个建议索引 "
            f"(耗时: {result['analysis_time_ms']}ms)"
        )

        return result

    def generate_creation_sql(
        self,
        candidates: Optional[List[IndexCandidate]] = None,
        priority_filter: Optional[str] = None,
    ) -> str:
        """
        生成 CREATE INDEX SQL 脚本

        Args:
            candidates: 要创建的索引候选列表（None 时使用预定义列表）
            priority_filter: 只创建特定优先级（high/medium/low）

        Returns:
            包含 SQL 语句的字符串
        """
        candidates = candidates or INDEX_CANDIDATES
        # 过滤优先级
        if priority_filter:
            candidates = [c for c in candidates if c.priority == priority_filter]

        if not candidates:
            return "-- 没有需要创建的索引"

        # 按表名分组，方便 DBA 按表审核
        table_groups: Dict[str, List[str]] = {}
        for c in candidates:
            if c.table not in table_groups:
                table_groups[c.table] = []
            table_groups[c.table].append(c.to_sql())

        # 生成带注释的 SQL 脚本
        sql_lines = [
            "-- ==========================================",
            "-- RMFOOD 配方平台数据库索引优化脚本",
            "-- 生成时间: " + time.strftime("%Y-%m-%d %H:%M:%S"),
            "-- 预计创建: " + str(len(candidates)) + " 个索引",
            "-- 执行方式: psql -f this_file.sql",
            "-- ==========================================",
            "",
            "-- 注意事项:",
            "-- 1. 建议在低峰期执行 (CREATE INDEX CONCURRENTLY 替代 CREATE INDEX)",
            "-- 2. 大表上的索引创建可能需要较长时间",
            "-- 3. 创建前建议先查询表大小: SELECT pg_size_pretty(pg_total_relation_size('table_name'));",
            "-- 4. 如需并发创建，可替换为 CREATE INDEX CONCURRENTLY (需要更长时间但不阻塞表)",
            "",
        ]

        for table, sqls in table_groups.items():
            sql_lines.append(f"-- 表: {table}")
            sql_lines.extend(sqls)
            sql_lines.append("")

        sql_lines.append("-- ==========================================")
        sql_lines.append("-- 脚本执行完成")
        sql_lines.append("-- ==========================================")

        return "\n".join(sql_lines)

    async def get_table_sizes(self) -> List[Dict[str, Any]]:
        """
        获取各表大小（辅助判断索引创建成本）

        Returns:
            [{table_name, size_bytes, size_mb, row_count}]
        """
        query = text("""
            SELECT
                c.relname AS table_name,
                pg_total_relation_size(c.oid) AS total_size,
                c.reltuples::bigint AS approx_rows
            FROM pg_class c
            JOIN pg_namespace n ON c.relnamespace = n.oid
            WHERE n.nspname = 'public'
              AND c.relkind = 'r'
              AND c.reltuples > 0
            ORDER BY total_size DESC;
        """)

        result = await self._session.execute(query)
        rows = result.fetchall()

        return [
            {
                'table_name': row.table_name,
                'size_bytes': row.total_size,
                'size_mb': round(row.total_size / 1024 / 1024, 2),
                'approx_rows': row.approx_rows,
            }
            for row in rows
        ]

    async def create_indexes(self, candidates: List[IndexCandidate]) -> Dict[str, Any]:
        """
        【危险操作】直接创建索引（不推荐，仅供开发环境使用）

        生产环境建议:
        1. 先生成 SQL: generate_creation_sql()
        2. DBA 审核后手动执行
        3. 优先使用 CREATE INDEX CONCURRENTLY

        Returns:
            {created: count, errors: [...], sql: [...]}
        """
        created = 0
        errors = []
        executed_sql = []

        for candidate in candidates:
            sql = candidate.to_sql()
            executed_sql.append(sql)
            try:
                await self._session.execute(text(sql))
                await self._session.commit()
                created += 1
                logger.info(f"[IndexAnalyzer] 成功创建索引: {candidate.name}")
            except Exception as e:
                errors.append({
                    "index": candidate.name,
                    "error": sanitize_error(e, "索引创建失败"),
                })
                await self._session.rollback()
                logger.warning(f"[IndexAnalyzer] 索引创建失败: {candidate.name}: {e}")

        return {
            "created_count": created,
            "error_count": len(errors),
            "total_count": len(candidates),
            "errors": errors,
            "executed_sql": executed_sql,
        }


# ═════════════════════════════════════════
# 🔴 P0-2: IndexCandidate 辅助方法
# ═════════════════════════════════════════

def _candidate_to_dict(self) -> Dict[str, Any]:
    return {
        "name": self.name,
        "table": self.table,
        "columns": self.columns,
        "index_type": self.index_type,
        "is_unique": self.is_unique,
        "reason": self.reason,
        "estimated_improvement": self.estimated_improvement,
        "priority": self.priority,
        "sql": self.to_sql(),
    }

# 绑定 to_dict 方法到 IndexCandidate 类
IndexCandidate.to_dict = _candidate_to_dict

# ═════════════════════════════════════════
# 🔴 P0-2: 便捷函数
# ═════════════════════════════════════════

async def run_index_analysis(session: AsyncSession) -> Dict[str, Any]:
    """执行完整的索引分析"""
    analyzer = IndexAnalyzer(session)
    return await analyzer.analyze_index_usage()


async def get_missing_indexes(session: AsyncSession) -> List[Dict[str, Any]]:
    """获取缺失索引列表"""
    analyzer = IndexAnalyzer(session)
    result = await analyzer.analyze_index_usage()
    return result.get("missing_indexes", [])


def generate_index_creation_sql(
    missing_indexes: List[Dict[str, Any]],
) -> str:
    """生成索引创建 SQL（兼容 Dict 结构，便于缓存序列化）"""
    analyzer = IndexAnalyzer(session=None)  # 不依赖 session

    # 反向重建 IndexCandidate 对象
    candidates = []
    for d in missing_indexes:
        candidates.append(IndexCandidate(
            table=d["table"],
            columns=d["columns"],
            is_unique=d["is_unique"],
            index_type=d["index_type"],
            reason=d["reason"],
            priority=d["priority"],
            estimated_improvement=d["estimated_improvement"],
        ))

    return analyzer.generate_creation_sql(candidates)


async def analyze_table_sizes(session: AsyncSession) -> List[Dict[str, Any]]:
    """获取表大小信息"""
    analyzer = IndexAnalyzer(session)
    return await analyzer.get_table_sizes()


__all__ = [
    # 核心类
    'IndexCandidate',
    'IndexAnalyzer',
    # 便捷函数
    'run_index_analysis',
    'get_missing_indexes',
    'generate_index_creation_sql',
    'analyze_table_sizes',
    # 预定义索引列表（便于扩展）
    'INDEX_CANDIDATES',
]
