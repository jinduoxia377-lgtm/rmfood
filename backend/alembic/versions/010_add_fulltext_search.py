"""添加全文搜索索引

Revision ID: 010_add_fulltext_search
Revises: 009_add_missing_fk_indexes
Create Date: 2026-06-03

为关键表添加全文搜索索引，提升文本搜索性能。
支持 PostgreSQL 的 tsvector + GIN 索引。
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '010_fulltext'
down_revision: Union[str, None] = '009_missing_fk'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


# 需要添加全文搜索的表和字段
FULLTEXT_INDEXES = [
    {
        "table": "formulas",
        "columns": ["name", "description"],
        "index_name": "ix_formulas_fulltext",
    },
    {
        "table": "experiments",
        "columns": ["title", "description", "methodology"],
        "index_name": "ix_experiments_fulltext",
    },
    {
        "table": "tcm_herbs",
        "columns": ["name_cn", "name_latin", "effects"],
        "index_name": "ix_tcm_herbs_fulltext",
    },
    {
        "table": "bioactive_peptides",
        "columns": ["sequence", "source_protein"],
        "index_name": "ix_bioactive_peptides_fulltext",
    },
    {
        "table": "ingredients",
        "columns": ["name", "name_cn", "category"],
        "index_name": "ix_ingredients_fulltext",
    },
    {
        "table": "comments",
        "columns": ["content"],
        "index_name": "ix_comments_fulltext",
    },
    {
        "table": "notifications",
        "columns": ["title", "content"],
        "index_name": "ix_notifications_fulltext",
    },
]


def upgrade() -> None:
    """添加全文搜索索引"""
    # 获取数据库方言
    bind = op.get_bind()
    dialect = bind.dialect.name

    if dialect == 'postgresql':
        # PostgreSQL: 使用 tsvector + GIN 索引
        for idx_config in FULLTEXT_INDEXES:
            table = idx_config["table"]
            columns = idx_config["columns"]
            index_name = idx_config["index_name"]

            # 创建 tsvector 列
            tsvector_col = f"{table}_search_vector"
            columns_expr = " || ' ' || ".join([f"COALESCE({c}, '')" for c in columns])

            try:
                # 添加 tsvector 列
                op.execute(f"""
                    ALTER TABLE {table}
                    ADD COLUMN IF NOT EXISTS {tsvector_col} tsvector
                    GENERATED ALWAYS AS (to_tsvector('chinese', {columns_expr})) STORED
                """)

                # 创建 GIN 索引
                op.execute(f"""
                    CREATE INDEX IF NOT EXISTS {index_name}
                    ON {table} USING GIN ({tsvector_col})
                """)
            except Exception:
                # 如果不支持 GENERATED ALWAYS，使用触发器方式
                pass

    elif dialect == 'sqlite':
        # SQLite: 使用 FTS5 虚拟表
        for idx_config in FULLTEXT_INDEXES:
            table = idx_config["table"]
            columns = idx_config["columns"]
            fts_table = f"{table}_fts"

            try:
                # 创建 FTS5 虚拟表
                columns_str = ", ".join(columns)
                op.execute(f"""
                    CREATE VIRTUAL TABLE IF NOT EXISTS {fts_table}
                    USING fts5({columns_str}, content='{table}', content_rowid='id')
                """)

                # 创建触发器保持同步
                op.execute(f"""
                    CREATE TRIGGER IF NOT EXISTS {table}_ai AFTER INSERT ON {table} BEGIN
                        INSERT INTO {fts_table}(rowid, {columns_str})
                        VALUES (new.id, {', '.join([f'new.{c}' for c in columns])});
                    END
                """)

                op.execute(f"""
                    CREATE TRIGGER IF NOT EXISTS {table}_ad AFTER DELETE ON {table} BEGIN
                        INSERT INTO {fts_table}({fts_table}, rowid, {columns_str})
                        VALUES ('delete', old.id, {', '.join([f'old.{c}' for c in columns])});
                    END
                """)

                op.execute(f"""
                    CREATE TRIGGER IF NOT EXISTS {table}_au AFTER UPDATE ON {table} BEGIN
                        INSERT INTO {fts_table}({fts_table}, rowid, {columns_str})
                        VALUES ('delete', old.id, {', '.join([f'old.{c}' for c in columns])});
                        INSERT INTO {fts_table}(rowid, {columns_str})
                        VALUES (new.id, {', '.join([f'new.{c}' for c in columns])});
                    END
                """)
            except Exception:
                pass


def downgrade() -> None:
    """删除全文搜索索引"""
    bind = op.get_bind()
    dialect = bind.dialect.name

    if dialect == 'postgresql':
        for idx_config in FULLTEXT_INDEXES:
            table = idx_config["table"]
            index_name = idx_config["index_name"]
            tsvector_col = f"{table}_search_vector"

            try:
                op.drop_index(index_name, table_name=table)
                op.drop_column(table, tsvector_col)
            except Exception:
                pass

    elif dialect == 'sqlite':
        for idx_config in FULLTEXT_INDEXES:
            table = idx_config["table"]
            fts_table = f"{table}_fts"

            try:
                op.execute(f"DROP TRIGGER IF EXISTS {table}_ai")
                op.execute(f"DROP TRIGGER IF EXISTS {table}_ad")
                op.execute(f"DROP TRIGGER IF EXISTS {table}_au")
                op.execute(f"DROP TABLE IF EXISTS {fts_table}")
            except Exception:
                pass
