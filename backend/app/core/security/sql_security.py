"""
SQL 安全工具模块

提供安全的SQL查询构建功能，防止SQL注入攻击。
所有原始SQL查询必须通过此模块进行参数化处理。

安全原则:
1. 永远不要使用 f-string 或 + 拼接用户输入到 SQL 中
2. 使用命名参数 (:param) 而非位置参数 (?)
3. 对表名和列名使用白名单验证
4. 优先使用 ORM，仅在必要时使用 Raw SQL
"""

import logging
import re
from typing import Any, Dict, List, Optional, Tuple, Union
from sqlalchemy import text as sa_text

logger = logging.getLogger(__name__)


class SafeQueryBuilder:
    """
    安全的SQL查询构建器
    
    Usage:
        builder = SafeQueryBuilder()
        query, params = builder.select("users").where("id = :id", {"id": user_id}).build()
        
        # 执行
        result = await db.execute(query, params)
    """
    
    # 允许的表名白名单（防止表名注入）
    ALLOWED_TABLES = {
        'users', 'formulas', 'experiments', 'ingredients', 'peptides',
        'peptide_analyses', 'peptide_designs', 'notifications',
        'notification_preferences', 'workflows', 'workflow_tasks',
        'audit_logs', 'attachments', 'categories', 'tags',
        'comments', 'comment_likes', 'organizations', 'organization_members',
        'tcm_herbs', 'bioactive_peptides', 'knowledge_graph_nodes',
        'knowledge_graph_edges', 'data_snapshots',
    }
    
    # 允许的列名模式（只允许字母、数字、下划线）
    COLUMN_PATTERN = re.compile(r'^[a-zA-Z_][a-zA-Z0-9_]*$')
    
    # 危险的SQL关键字（用于检测）
    DANGEROUS_PATTERNS = [
        r'\bDROP\b', r'\bDELETE\b(?!.*WHERE)', r'\bTRUNCATE\b',
        r'\bALTER\s+TABLE\b', r'\bGRANT\b', r'\bREVOKE\b',
        r';\s*--', r'/\*', r'\*/\s*;',
        r'\bEXEC\b', r'\bEXECUTE\b', r'\bxp_cmdshell\b',
        r'\bUNION\b.*\bSELECT\b', r'--\s*$',
    ]
    
    def __init__(self, table_name: Optional[str] = None):
        self._table_name = None
        self._columns = ['*']
        self._conditions = []
        self._params: Dict[str, Any] = {}
        self._order_by = None
        self._limit = None
        self._offset = None
        self._joins = []
        
        if table_name:
            self.table(table_name)
    
    def table(self, name: str) -> 'SafeQueryBuilder':
        """设置查询的主表"""
        if name not in self.ALLOWED_TABLES:
            raise ValueError(f"不允许的表名: {name}. 必须在白名单中.")
        self._table_name = name
        return self
    
    def select(self, *columns: str) -> 'SafeQueryBuilder':
        """设置查询的列"""
        if columns:
            validated_cols = []
            for col in columns:
                if col == '*' or self.COLUMN_PATTERN.match(col):
                    validated_cols.append(col)
                else:
                    raise ValueError(f"不允许的列名: {col}")
            self._columns = validated_cols
        return self
    
    def where(self, condition: str, params: Dict[str, Any]) -> 'SafeQueryBuilder':
        """添加 WHERE 条件（必须使用命名参数）"""
        if not isinstance(params, dict):
            raise TypeError("params 必须是字典类型")
        
        # 验证条件中没有危险的SQL模式
        self._validate_sql_safety(condition)
        
        self._conditions.append(condition)
        self._params.update(params)
        return self
    
    def order_by(self, column: str, direction: str = 'ASC') -> 'SafeQueryBuilder':
        """设置排序"""
        direction = direction.upper()
        if direction not in ('ASC', 'DESC'):
            raise ValueError(f"无效的排序方向: {direction}，必须是 ASC 或 DESC")
        
        if column != '*' and not self.COLUMN_PATTERN.match(column):
            raise ValueError(f"不允许的排序列: {column}")
        
        self._order_by = f"{column} {direction}"
        return self
    
    def limit(self, count: int) -> 'SafeQueryBuilder':
        """设置 LIMIT"""
        if not isinstance(count, int) or count < 0:
            raise TypeError("limit 必须是非负整数")
        self._limit = count
        return self
    
    def offset(self, count: int) -> 'SafeQueryBuilder':
        """设置 OFFSET"""
        if not isinstance(count, int) or count < 0:
            raise TypeError("offset 必须是非负整数")
        self._offset = count
        return self
    
    def join(self, table: str, on_condition: str, params: Optional[Dict] = None) -> 'SafeQueryBuilder':
        """添加 JOIN"""
        if table not in self.ALLOWED_TABLES:
            raise ValueError(f"不允许的连接表: {table}")
        
        self._validate_sql_safety(on_condition)
        self._joins.append((table, on_condition))
        if params:
            self._params.update(params)
        return self
    
    def build(self) -> Tuple[str, Dict[str, Any]]:
        """构建最终的 SQL 和 参数字典"""
        if not self._table_name:
            raise ValueError("未设置查询表名，请调用 .table() 方法")
        
        parts = [f"SELECT {', '.join(self._columns)} FROM {self._table_name}"]
        
        # JOINs
        for table, condition in self._joins:
            parts.append(f"JOIN {table} ON {condition}")
        
        # WHERE
        if self._conditions:
            conditions_str = " AND ".join(f"({c})" for c in self._conditions)
            parts.append(f"WHERE {conditions_str}")
        
        # ORDER BY
        if self._order_by:
            parts.append(f"ORDER BY {self._order_by}")
        
        # LIMIT & OFFSET
        if self._limit is not None:
            parts.append(f"LIMIT :_limit")
            self._params['_limit'] = self._limit
        
        if self._offset is not None:
            parts.append(f"OFFSET :_offset")
            self._params['_offset'] = self._offset
        
        sql = " ".join(parts)
        return sql, self._params
    
    def _validate_sql_safety(self, sql_fragment: str):
        """验证SQL片段安全性"""
        sql_upper = sql_fragment.upper()
        for pattern in self.DANGEROUS_PATTERNS:
            if re.search(pattern, sql_upper, re.IGNORECASE):
                raise SecurityError(
                    f"检测到潜在的安全风险: {pattern}",
                    "禁止在SQL中使用 DROP、DELETE无WHERE、UNION SELECT 等危险操作"
                )
    
    @classmethod
    def execute_safe(cls, db, sql: str, params: Dict[str, Any]):
        """执行安全的原始SQL查询（包装方法）"""
        # 最终安全验证
        instance = cls()
        instance._validate_sql_safety(sql)
        
        # 确保所有参数都是基本类型（防止对象注入）
        safe_params = {}
        for key, value in params.items():
            if not isinstance(value, (str, int, float, bool, type(None), bytes)):
                raise TypeError(f"参数 {key} 的类型不安全: {type(value)}")
            safe_params[key] = value
        
        return db.execute(sa_text(sql), safe_params)


class SecurityError(Exception):
    """SQL安全相关的异常"""
    def __init__(self, message: str, suggestion: str = ""):
        super().__init__(message)
        self.suggestion = suggestion


def validate_table_name(name: str) -> str:
    """验证并返回安全的表名"""
    if name not in SafeQueryBuilder.ALLOWED_TABLES:
        available = ", ".join(sorted(SafeQueryBuilder.ALLOWED_TABLES)[:10])
        raise ValueError(
            f"表名 '{name}' 不在允许列表中。\n"
            f"可用表: {available}..."
        )
    return name


def validate_column_name(name: str) -> str:
    """验证并返回安全的列名"""
    if name != '*' and not SafeQueryBuilder.COLUMN_PATTERN.match(name):
        raise ValueError(
            f"列名 '{name}' 不符合规范。"
            f"只允许字母、数字和下划线，且不能以数字开头。"
        )
    return name


def sanitize_like_pattern(pattern: str) -> str:
    """清理 LIKE 查询中的特殊字符（防止通配符注入）"""
    # 转义SQL LIKE 特殊字符
    escaped = pattern.replace('\\', '\\\\')
    escaped = escaped.replace('%', '\\%')
    escaped = escaped.replace('_', '\\_')
    return escaped


# 便捷函数
def build_select_query(
    table: str,
    columns: List[str] = None,
    conditions: List[Tuple[str, Dict]] = None,
    order_by: Optional[str] = None,
    limit: Optional[int] = None,
    offset: Optional[int] = None,
) -> Tuple[str, Dict]:
    """
    构建安全的 SELECT 查询
    
    Args:
        table: 表名（必须在白名单中）
        columns: 列名列表
        conditions: [(condition_sql, params_dict), ...]
        order_by: 排序子句
        limit: 返回行数限制
        offset: 偏移量
        
    Returns:
        (sql, params) 元组
    """
    builder = SafeQueryBuilder(table)
    
    if columns:
        builder.select(*columns)
    
    if conditions:
        for cond, params in conditions:
            builder.where(cond, params)
    
    if order_by:
        # 解析简单的 "column ASC/DESC" 格式
        parts = order_by.split()
        if len(parts) == 2:
            builder.order_by(parts[0], parts[1])
        else:
            builder.order_by(order_by)
    
    if limit is not None:
        builder.limit(limit)
    
    if offset is not None:
        builder.offset(offset)
    
    return builder.build()


logger.info("✅ SQL 安全工具模块加载完成")
