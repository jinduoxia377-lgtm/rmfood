"""
数据库索引优化建议
为常用查询字段添加索引以提升查询性能
"""
from sqlalchemy import text


# 建议添加的索引
INDEX_RECOMMENDATIONS = [
    # 用户相关表索引
    {
        "name": "idx_users_email",
        "table": "users",
        "columns": ["email"],
        "reason": "用户登录按邮箱查询频繁"
    },
    {
        "name": "idx_users_username",
        "table": "users",
        "columns": ["username"],
        "reason": "用户名查询"
    },
    {
        "name": "idx_users_created_at",
        "table": "users",
        "columns": ["created_at"],
        "reason": "按创建时间排序和统计"
    },

    # 配方相关表索引
    {
        "name": "idx_formulas_name",
        "table": "formulas",
        "columns": ["name"],
        "reason": "配方名称搜索"
    },
    {
        "name": "idx_formulas_status",
        "table": "formulas",
        "columns": ["status"],
        "reason": "按状态筛选配方"
    },
    {
        "name": "idx_formulas_created_at",
        "table": "formulas",
        "columns": ["created_at"],
        "reason": "按创建时间排序"
    },
    {
        "name": "idx_formulas_user_id",
        "table": "formulas",
        "columns": ["user_id"],
        "reason": "查询用户的所有配方"
    },

    # 实验记录表索引
    {
        "name": "idx_experiments_formula_id",
        "table": "experiments",
        "columns": ["formula_id"],
        "reason": "查询配方的所有实验"
    },
    {
        "name": "idx_experiments_status",
        "table": "experiments",
        "columns": ["status"],
        "reason": "按状态筛选实验"
    },
    {
        "name": "idx_experiments_created_at",
        "table": "experiments",
        "columns": ["created_at"],
        "reason": "按创建时间排序"
    },

    # 配方-实验关系表索引（如果存在）
    {
        "name": "idx_formula_experiments_formula_id",
        "table": "formula_experiments",
        "columns": ["formula_id"],
        "reason": "配方关联查询"
    },
    {
        "name": "idx_formula_experiments_experiment_id",
        "table": "formula_experiments",
        "columns": ["experiment_id"],
        "reason": "实验关联查询"
    },

    # 数据库检索表索引
    {
        "name": "idx_database_records_name",
        "table": "database_records",
        "columns": ["name"],
        "reason": "数据库记录名称搜索"
    },
    {
        "name": "idx_database_records_category",
        "table": "database_records",
        "columns": ["category"],
        "reason": "按分类筛选记录"
    },
    {
        "name": "idx_database_records_created_at",
        "table": "database_records",
        "columns": ["created_at"],
        "reason": "按创建时间排序"
    },
]


def generate_create_index_sql():
    """生成创建索引的 SQL 语句"""
    sql_statements = []

    for idx in INDEX_RECOMMENDATIONS:
        columns_str = ", ".join(idx["columns"])
        sql = f"""
-- 索引: {idx['name']}
-- 原因: {idx['reason']}
CREATE INDEX IF NOT EXISTS {idx['name']}
ON {idx['table']} ({columns_str});
"""
        sql_statements.append(sql.strip())

    return "\n\n".join(sql_statements)


def generate_drop_index_sql():
    """生成删除索引的 SQL 语句（用于回滚）"""
    sql_statements = []

    for idx in INDEX_RECOMMENDATIONS:
        sql = f"DROP INDEX IF EXISTS {idx['name']};"
        sql_statements.append(sql)

    return "\n".join(sql_statements)


async def apply_indexes(session):
    """应用所有建议的索引"""
    results = []

    for idx in INDEX_RECOMMENDATIONS:
        try:
            columns_str = ", ".join(idx["columns"])
            await session.execute(
                text(f"""
                CREATE INDEX IF NOT EXISTS {idx['name']}
                ON {idx['table']} ({columns_str})
                """)
            )
            results.append({
                "index": idx['name'],
                "status": "success",
                "reason": idx['reason']
            })
        except Exception as e:
            results.append({
                "index": idx['name'],
                "status": "error",
                "error": str(e),
                "reason": idx['reason']
            })

    await session.commit()
    return results


if __name__ == "__main__":
    print("数据库索引优化建议")
    print("=" * 60)
    print("\n创建索引 SQL:")
    print(generate_create_index_sql())
    print("\n" + "=" * 60)
    print("\n回滚索引 SQL:")
    print(generate_drop_index_sql())
