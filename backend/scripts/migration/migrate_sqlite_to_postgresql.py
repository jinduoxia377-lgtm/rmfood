#!/usr/bin/env python3
"""
SQLite → PostgreSQL 数据迁移工具
====================================

功能特性:
- 自动分析 SQLite schema 并生成 PostgreSQL 兼容 DDL
- 分批数据导入，支持断点续传
- JSON 字段自动转换为 JSONB
- 使用 COPY 协议批量导入以获得最佳性能
- 完整的数据验证和迁移报告生成

使用方法:
    python migrate_sqlite_to_postgresql.py --source ./rmfood_platform.db --target-url "postgresql://postgres@localhost:5432/rmfood_platform"
    python migrate_sqlite_to_postgresql.py --resume  # 断点续传
    python migrate_sqlite_to_postgresql.py --tables tcm_herbs,bioactive_peptides  # 指定表

作者: RMFOOD Team
"""

import argparse
import json
import logging
import os
import random
import re
import sys
import time
from collections import Counter, defaultdict
from datetime import datetime
from io import StringIO
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

# 尝试导入依赖库
try:
    import sqlite3
except ImportError:
    print("错误: 缺少 sqlite3 模块 (Python 标准库)")
    sys.exit(1)

try:
    import psycopg2
    from psycopg2 import sql as pg_sql
    from psycopg2.extras import execute_values
except ImportError:
    print("错误: 缺少 psycopg2 库。请执行: pip install psycopg2-binary")
    sys.exit(1)

try:
    from tqdm import tqdm
except ImportError:
    # 简单的进度条实现
    class tqdm:
        def __init__(self, iterable=None, **kwargs):
            self.iterable = iterable
            self.total = kwargs.get('total', None)
            self.desc = kwargs.get('desc', '')
            self.n = 0
            self._iter = iter(iterable) if iterable else None

        def __iter__(self):
            return self

        def __next__(self):
            if self._iter is None:
                raise StopIteration
            try:
                item = next(self._iter)
                self.n += 1
                if self.total:
                    pct = (self.n / self.total) * 100
                    print(f"\r{self.desc}: {self.n}/{self.total} ({pct:.1f}%)", end='', flush=True)
                else:
                    print(f"\r{self.desc}: {self.n}", end='', flush=True)
                return item
            except StopIteration:
                if self.total:
                    print(f"\r{self.desc}: {self.n}/{self.total} (100.0%)", flush=True)
                else:
                    print(f"\r{self.desc}: {self.n} 完成", flush=True)
                raise

        def update(self, n=1):
            self.n += n
            if self.total:
                pct = (self.n / self.total) * 100
                print(f"\r{self.desc}: {self.n}/{self.total} ({pct:.1f}%)", end='', flush=True)

        def close(self):
            pass


# ============================================================================
# 日志配置
# ============================================================================

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S',
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler(
            Path(__file__).parent / 'migration.log',
            mode='a',
            encoding='utf-8'
        )
    ]
)
logger = logging.getLogger(__name__)


# ============================================================================
# 类型映射配置
# ============================================================================

SQLITE_TO_PG_TYPE_MAP = {
    'INTEGER': 'INTEGER',
    'INT': 'INTEGER',
    'BIGINT': 'BIGINT',
    'SMALLINT': 'SMALLINT',
    'TINYINT': 'SMALLINT',
    'TEXT': 'TEXT',
    'VARCHAR': 'VARCHAR',
    'VARCHAR2': 'VARCHAR',
    'CHAR': 'CHAR',
    'STRING': 'TEXT',
    'FLOAT': 'DOUBLE PRECISION',
    'REAL': 'DOUBLE PRECISION',
    'DOUBLE': 'DOUBLE PRECISION',
    'NUMERIC': 'NUMERIC',
    'DECIMAL': 'DECIMAL',
    'NUMBER': 'NUMERIC',
    'BOOLEAN': 'BOOLEAN',
    'BOOL': 'BOOLEAN',
    'JSON': 'JSONB',
    'JSONB': 'JSONB',
    'DATE': 'DATE',
    'DATETIME': 'TIMESTAMP WITH TIME ZONE',
    'TIMESTAMP': 'TIMESTAMP WITH TIME ZONE',
    'TIME': 'TIME',
    'BLOB': 'BYTEA',
    'CLOB': 'TEXT',
    'UUID': 'UUID',
}


class MigrationError(Exception):
    """迁移过程中的自定义异常"""


class MigrationState:
    """迁移状态管理器 - 支持断点续传"""

    STATE_FILE = 'migration_state.json'

    def __init__(self, work_dir: Path):
        self.work_dir = work_dir
        self.state_file = work_dir / self.STATE_FILE
        self.state: Dict[str, Any] = {
            'started_at': None,
            'completed_at': None,
            'tables': {},
            'current_table': None,
            'errors': [],
            'statistics': {}
        }
        self._load()

    def _load(self):
        """加载已有状态"""
        if self.state_file.exists():
            try:
                with open(self.state_file, 'r', encoding='utf-8') as f:
                    saved_state = json.load(f)
                    self.state.update(saved_state)
                    logger.info(f"已加载迁移状态: {len(self.state.get('tables', {}))} 个表已处理")
            except Exception as e:
                logger.warning(f"加载状态文件失败: {e}")

    def save(self):
        """保存当前状态"""
        with open(self.state_file, 'w', encoding='utf-8') as f:
            json.dump(self.state, f, ensure_ascii=False, indent=2, default=str)

    def set_table_progress(self, table_name: str, migrated_rows: int, total_rows: int, status: str = 'in_progress'):
        """设置表的迁移进度"""
        self.state['tables'][table_name] = {
            'migrated_rows': migrated_rows,
            'total_rows': total_rows,
            'status': status,
            'updated_at': datetime.now().isoformat()
        }
        self.state['current_table'] = table_name
        self.save()

    def is_table_completed(self, table_name: str) -> bool:
        """检查表是否已完成迁移"""
        table_info = self.state['tables'].get(table_name, {})
        return table_info.get('status') == 'completed'

    def get_table_migrated_count(self, table_name: str) -> int:
        """获取已迁移的行数"""
        table_info = self.state['tables'].get(table_name, {})
        return table_info.get('migrated_rows', 0)

    def mark_table_complete(self, table_name: str):
        """标记表为完成"""
        self.set_table_progress(
            table_name,
            self.state['tables'].get(table_name, {}).get('migrated_rows', 0),
            self.state['tables'].get(table_name, {}).get('total_rows', 0),
            'completed'
        )

    def add_error(self, error: str):
        """记录错误"""
        self.state['errors'].append({
            'time': datetime.now().isoformat(),
            'error': str(error)
        })
        self.save()

    def reset(self):
        """重置状态"""
        self.state = {
            'started_at': None,
            'completed_at': None,
            'tables': {},
            'current_table': None,
            'errors': [],
            'statistics': {}
        }
        if self.state_file.exists():
            self.state_file.unlink()
        logger.info("迁移状态已重置")


class SchemaAnalyzer:
    """SQLite Schema 分析器"""

    def __init__(self, sqlite_conn: sqlite3.Connection):
        self.conn = sqlite_conn
        self.cursor = sqlite_conn.cursor()
        self.tables: Dict[str, Dict] = {}
        self.indexes: Dict[str, List[Dict]] = defaultdict(list)
        self.foreign_keys: Dict[str, List[Dict]] = defaultdict(list)

    def analyze(self) -> Dict[str, Any]:
        """
        分析完整的数据库结构

        Returns:
            包含所有表、索引、约束信息的字典
        """
        logger.info("开始分析 SQLite 数据库结构...")

        # 获取所有表
        self._analyze_tables()

        # 获取所有索引
        self._analyze_indexes()

        # 获取外键约束
        self._analyze_foreign_keys()

        result = {
            'tables': self.tables,
            'indexes': dict(self.indexes),
            'foreign_keys': dict(self.foreign_keys),
            'table_names': list(self.tables.keys())
        }

        logger.info(f"分析完成: 发现 {len(self.tables)} 个表, "
                     f"{sum(len(v) for v in self.indexes.values())} 个索引")

        return result

    def _analyze_tables(self):
        """分析所有表的结构"""
        self.cursor.execute("""
            SELECT name, sql FROM sqlite_master
            WHERE type='table' AND name NOT LIKE 'sqlite_%'
            ORDER BY name
        """)

        for table_name, create_sql in self.cursor.fetchall():
            columns = self._parse_columns(create_sql)
            primary_key = self._find_primary_key(columns)

            # 获取行数
            try:
                self.cursor.execute(f'SELECT COUNT(*) FROM "{table_name}"')
                row_count = self.cursor.fetchone()[0]
            except Exception:
                row_count = 0

            self.tables[table_name] = {
                'name': table_name,
                'create_sql': create_sql or '',
                'columns': columns,
                'primary_key': primary_key,
                'row_count': row_count
            }

    def _parse_columns(self, create_sql: str) -> List[Dict]:
        """
        解析 CREATE TABLE SQL 中的列定义

        Args:
            create_sql: CREATE TABLE 语句

        Returns:
            列信息列表
        """
        if not create_sql:
            return []

        columns = []

        # 提取括号内的内容
        match = re.search(r'\((.+)\)$', create_sql, re.DOTALL | re.IGNORECASE)
        if not match:
            return columns

        content = match.group(1)

        # 分割列定义（考虑括号嵌套和逗号）
        parts = []
        depth = 0
        current = []

        for char in content:
            if char == '(':
                depth += 1
                current.append(char)
            elif char == ')':
                depth -= 1
                current.append(char)
            elif char == ',' and depth == 0:
                parts.append(''.join(current).strip())
                current = []
            else:
                current.append(char)

        if current:
            parts.append(''.join(current).strip())

        for part in parts:
            part = part.strip()
            if not part:
                continue

            # 跳过约束定义
            upper_part = part.upper()
            if upper_part.startswith(('PRIMARY KEY', 'UNIQUE', 'CHECK', 'FOREIGN KEY',
                                      'CONSTRAINT')):
                continue

            # 解析列名和类型
            col_match = re.match(
                r'["\']?(\w+)["\']?\s+(\w+)(?:\s*\(\s*(\d+)\s*(?:,\s*(\d+))?\s*\))?'
                r'(.*?)?(?:$|DEFAULT|NOT NULL|PRIMARY|UNIQUE|CHECK|REFERENCES|COLLATE)',
                part,
                re.IGNORECASE | re.DOTALL
            )

            if col_match:
                col_name = col_match.group(1)
                col_type = col_match.group(2).upper()
                col_length = col_match.group(3)
                constraints_str = col_match.group(5) or ''

                column_info = {
                    'name': col_name,
                    'type': col_type,
                    'length': int(col_length) if col_length else None,
                    'not_null': 'NOT NULL' in constraints_str.upper(),
                    'primary_key': 'PRIMARY KEY' in constraints_str.upper() or
                                   'PRIMARY' in constraints_str.upper(),
                    'unique': 'UNIQUE' in constraints_str.upper(),
                    'autoincrement': 'AUTOINCREMENT' in part.upper(),
                    'default_value': self._extract_default(part),
                    'is_json': col_type.upper() in ('JSON', 'JSONB'),
                    'raw_definition': part
                }

                columns.append(column_info)

        return columns

    def _extract_default(self, column_def: str) -> Optional[Any]:
        """提取列的默认值"""
        default_match = re.search(
            r'DEFAULT\s+([^\s,]+(?:\([^)]+\))?)',
            column_def,
            re.IGNORECASE
        )
        if default_match:
            value = default_match.group(1)
            # 处理特殊值
            if value.upper() in ('NULL',):
                return None
            elif value.upper() in ('TRUE', 'FALSE'):
                return value.upper() == 'TRUE'
            elif value.startswith("'") and value.endswith("'"):
                return value[1:-1]
            try:
                return int(value)
            except ValueError:
                try:
                    return float(value)
                except ValueError:
                    return value
        return None

    def _find_primary_key(self, columns: List[Dict]) -> Optional[str]:
        """查找主键列"""
        for col in columns:
            if col.get('primary_key'):
                return col['name']
        return None

    def _analyze_indexes(self):
        """分析所有索引"""
        self.cursor.execute("""
            SELECT name, tbl_name, sql FROM sqlite_master
            WHERE type='index' AND name NOT LIKE 'sqlite_%' AND sql IS NOT NULL
            ORDER BY tbl_name, name
        """)

        for idx_name, table_name, idx_sql in self.cursor.fetchall():
            # 解析索引列
            cols_match = re.search(r'\(([^)]+)\)', idx_sql or '')
            columns = [c.strip().strip('"').strip("'") for c in cols_match.group(1).split(',')] \
                if cols_match else []

            is_unique = 'UNIQUE' in (idx_sql or '').upper()

            self.indexes[table_name].append({
                'name': idx_name,
                'table': table_name,
                'columns': columns,
                'sql': idx_sql,
                'unique': is_unique
            })

    def _analyze_foreign_keys(self):
        """分析外键约束"""
        # SQLite 需要启用外键 PRAGMA 才能查询
        try:
            self.cursor.execute("PRAGMA foreign_keys = ON")
            for table_name in self.tables.keys():
                self.cursor.execute(f'PRAGMA foreign_key_list("{table_name}")')
                for fk_row in self.cursor.fetchall():
                    self.foreign_keys[table_name].append({
                        'id': fk_row[0],
                        'seq': fk_row[1],
                        'table': fk_row[2],
                        'from': fk_row[3],
                        'to': fk_row[4]
                    })
        except Exception as e:
            logger.warning(f"分析外键时出错: {e}")


class PostgreSQLEngine:
    """PostgreSQL 引擎封装"""

    def __init__(self, connection_url: str):
        self.connection_url = connection_url
        self.conn: Optional[psycopg2.extensions.connection] = None
        self._connect()

    def _connect(self):
        """建立连接"""
        try:
            self.conn = psycopg2.connect(self.connection_url)
            self.conn.autocommit = False
            logger.info(f"成功连接到 PostgreSQL: {self._mask_url(self.connection_url)}")
        except Exception as e:
            raise MigrationError(f"连接 PostgreSQL 失败: {e}")

    @staticmethod
    def _mask_url(url: str) -> str:
        """隐藏 URL 中的密码"""
        if '@' in url:
            prefix, suffix = url.split('@', 1)
            if ':' in prefix.replace('://', '', 1):
                proto = prefix.split('://')[0] + '://' if '://' in prefix else ''
                user = prefix.split('://')[-1].split(':')[0] if '://' in prefix else prefix.split(':')[0]
                return f"{proto}{user}:****@{suffix}"
        return url

    def execute(self, query: str, params=None, fetch: bool = False):
        """
        执行 SQL 语句

        Args:
            query: SQL 语句
            params: 参数
            fetch: 是否返回结果

        Returns:
            查询结果（如果 fetch=True）
        """
        cursor = self.conn.cursor()
        try:
            cursor.execute(query, params)
            if fetch:
                return cursor.fetchall()
            self.conn.commit()
        except Exception as e:
            self.conn.rollback()
            raise MigrationError(f"SQL 执行失败: {e}\n\nSQL: {query[:500]}")
        finally:
            cursor.close()

    def execute_many(self, query: str, data: List[Tuple]):
        """
        批量执行 SQL（使用 executemany，兼容多占位符查询）

        Args:
            query: SQL 语句
            data: 数据列表
        """
        cursor = self.conn.cursor()
        try:
            # 使用 executemany 逐行插入（兼容多 %s 占位符的 INSERT 语句）
            for row in data:
                cursor.execute(query, row)
            self.conn.commit()
        except Exception as e:
            self.conn.rollback()
            raise MigrationError(f"批量插入失败: {e}")
        finally:
            cursor.close()

    def copy_from_data(self, table: str, columns: List[str], data: List[Tuple], batch_size: int = 1000):
        """
        使用 psycopg2 execute_values 批量导入数据（高兼容性，自动处理类型适配）

        Args:
            table: 表名
            columns: 列名列表
            data: 数据元组列表（值已通过 _convert_value 转换）
            batch_size: 每批大小
        """
        from psycopg2.extras import execute_values

        total_inserted = 0
        col_list = ', '.join(f'"{c}"' for c in columns)
        # execute_values 模板：%s 会被替换为所有行的 VALUES 子句
        template = f'INSERT INTO "{table}" ({col_list}) VALUES %s ON CONFLICT DO NOTHING'

        cursor = self.conn.cursor()
        try:
            for i in range(0, len(data), batch_size):
                batch = data[i:i + batch_size]
                # execute_values 自动处理 Python None → SQL NULL, dict/list → JSON
                execute_values(cursor, template, batch)
                self.conn.commit()
                total_inserted += len(batch)
        except Exception as e:
            self.conn.rollback()
            raise MigrationError(f"execute_values 批量导入失败: {e}")
        finally:
            cursor.close()

        return total_inserted

    @staticmethod
    def _format_copy_value(value: Any) -> str:
        """格式化 COPY 协议的值（保留作为备用）"""
        if value is None:
            return '\\N'
        # 处理常见的 NULL 替代值（部分 ORM 用 "N"/"NULL"/"" 表示 NULL）
        if isinstance(value, str):
            if value.upper() in ('N', 'NULL', 'NONE', ''):
                return '\\N'
        if isinstance(value, bool):
            return 't' if value else 'f'
        if isinstance(value, (dict, list)):
            return json.dumps(value, ensure_ascii=False)
        if isinstance(value, datetime):
            return value.isoformat()
        return str(value)

    def table_exists(self, table_name: str) -> bool:
        """检查表是否存在"""
        result = self.execute(
            "SELECT EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name=%s)",
            (table_name,),
            fetch=True
        )
        return result[0][0]

    def drop_table(self, table_name: str):
        """删除表"""
        self.execute(f'DROP TABLE IF EXISTS "{table_name}" CASCADE')
        logger.debug(f"已删除表: {table_name}")

    def truncate_table(self, table_name: str):
        """清空表数据"""
        self.execute(f'TRUNCATE TABLE "{table_name}" RESTART IDENTITY CASCADE')
        logger.debug(f"已清空表: {table_name}")

    def get_row_count(self, table_name: str) -> int:
        """获取表的行数"""
        result = self.execute(
            f'SELECT COUNT(*) FROM "{table_name}"',
            fetch=True
        )
        return result[0][0]

    def close(self):
        """关闭连接"""
        if self.conn:
            self.conn.close()


class DDLGenerator:
    """PostgreSQL DDL 生成器"""

    @staticmethod
    def generate_create_table(table_info: Dict) -> str:
        """
        生成 CREATE TABLE DDL

        Args:
            table_info: 表信息字典

        Returns:
            PostgreSQL 兼容的 CREATE TABLE 语句
        """
        table_name = table_info['name']
        columns = table_info['columns']
        lines = [f'CREATE TABLE IF NOT EXISTS "{table_name}" (']

        col_definitions = []
        pk_columns = []

        for col in columns:
            pg_type = DDLGenerator.map_type(col)
            col_def = f'    "{col["name"]}" {pg_type}'

            # NOT NULL
            if col.get('not_null'):
                col_def += ' NOT NULL'

            # UNIQUE
            if col.get('unique'):
                col_def += ' UNIQUE'

            # DEFAULT 值
            default = col.get('default_value')
            if default is not None:
                col_def += f' DEFAULT {DDLGenerator.format_default(default, col["type"])}'

            # 主键
            if col.get('primary_key'):
                pk_columns.append(col['name'])
                # 对于自增主键，使用 SERIAL
                if col.get('autoincrement') or col['name'] == 'id':
                    col_def = f'    "{col["name"]}" SERIAL PRIMARY KEY'
                    if col.get('not_null'):
                        col_def += ' NOT NULL'

            col_definitions.append(col_def)

        # 如果有复合主键
        if len(pk_columns) > 1 and all(not c.get('primary_key') for c in columns if c['name'] not in pk_columns):
            col_definitions.append(f'    PRIMARY KEY ({", ".join(pk_columns)})')

        lines.extend(col_definitions)
        lines.append(');')

        return '\n'.join(lines)

    @staticmethod
    def map_type(col: Dict) -> str:
        """
        映射 SQLite 类型到 PostgreSQL 类型

        Args:
            col: 列信息

        Returns:
            PostgreSQL 类型字符串
        """
        sqlite_type = col['type'].upper()
        length = col.get('length')

        # 直接映射
        if sqlite_type in SQLITE_TO_PG_TYPE_MAP:
            pg_type = SQLITE_TO_PG_TYPE_MAP[sqlite_type]
        else:
            # 尝试模糊匹配
            matched = False
            for st, pt in SQLITE_TO_PG_TYPE_MAP.items():
                if st in sqlite_type or sqlite_type in st:
                    pg_type = pt
                    matched = True
                    break
            if not matched:
                logger.warning(f"未知类型 '{sqlite_type}'，默认映射为 TEXT")
                pg_type = 'TEXT'

        # 处理 VARCHAR 长度
        if pg_type == 'VARCHAR' and length:
            pg_type = f'VARCHAR({length})'
        elif pg_type == 'CHAR' and length:
            pg_type = f'CHAR({length})'

        # JSON 类型统一为 JSONB
        if col.get('is_json'):
            pg_type = 'JSONB'

        return pg_type

    @staticmethod
    def format_default(value: Any, sqlite_type: str) -> str:
        """格式化默认值"""
        if value is None:
            return 'NULL'
        if isinstance(value, bool):
            return 'TRUE' if value else 'FALSE'
        if isinstance(value, (int, float)):
            return str(value)
        if isinstance(value, str):
            # 特殊关键字
            if value.upper() in ('CURRENT_TIMESTAMP', 'NOW()', 'NULL'):
                return value.upper()
            return f"'{value}'"
        return str(value)

    @staticmethod
    def generate_index(index_info: Dict) -> str:
        """
        生成 CREATE INDEX DDL

        Args:
            index_info: 索引信息

        Returns:
            CREATE INDEX 语句
        """
        idx_name = index_info['name']
        table_name = index_info['table']
        columns = index_info['columns']

        unique = 'UNIQUE ' if index_info.get('unique') else ''
        col_list = ', '.join(f'"{c}"' for c in columns)

        return f'CREATE {unique}INDEX IF NOT EXISTS "{idx_name}" ON "{table_name}" ({col_list});'


class DataMigrator:
    """数据迁移核心类"""

    def __init__(
        self,
        source_path: str,
        target_url: str,
        batch_size: int = 500,
        resume: bool = False,
        tables: Optional[List[str]] = None,
        skip_validation: bool = False
    ):
        self.source_path = source_path
        self.target_url = target_url
        self.batch_size = batch_size
        self.resume = resume
        self.tables_filter = tables
        self.skip_validation = skip_validation

        # 工作目录
        self.work_dir = Path(__file__).parent

        # 初始化组件
        self.sqlite_conn: Optional[sqlite3.Connection] = None
        self.pg_engine: Optional[PostgreSQLEngine] = None
        self.analyzer: Optional[SchemaAnalyzer] = None
        self.state: Optional[MigrationState] = None
        self.schema: Optional[Dict] = None

        # 统计信息
        self.stats = {
            'start_time': None,
            'end_time': None,
            'total_tables': 0,
            'migrated_tables': 0,
            'total_rows_source': 0,
            'total_rows_target': 0,
            'errors': [],
            'validation_results': []
        }

    def run(self) -> Dict[str, Any]:
        """
        执行完整迁移流程

        Returns:
            迁移统计信息
        """
        self.stats['start_time'] = datetime.now()
        logger.info("=" * 70)
        logger.info("SQLite → PostgreSQL 数据迁移工具 启动")
        logger.info("=" * 70)
        logger.info(f"源数据库: {self.source_path}")
        logger.info(f"目标数据库: {self._mask_pg_url(self.target_url)}")
        logger.info(f"批处理大小: {self.batch_size}")
        logger.info(f"断点续传: {'是' if self.resume else '否'}")

        try:
            # 1. 初始化连接
            self._initialize_connections()

            # 2. 分析源数据库
            self._analyze_source_database()

            # 3. 过滤要迁移的表
            self._filter_tables()

            # 4. 创建目标 Schema
            self._create_target_schema()

            # 5. 迁移数据
            self._migrate_all_tables()

            # 6. 创建索引
            self._create_indexes()

            # 7. 数据验证
            if not self.skip_validation:
                self._validate_migration()

            # 8. 生成报告
            report_path = self._generate_report()

            self.stats['end_time'] = datetime.now()
            self.state.state['completed_at'] = datetime.now().isoformat()
            self.state.save()

            logger.info("=" * 70)
            logger.info("✅ 迁移完成!")
            logger.info(f"   迁移报告: {report_path}")
            logger.info(f"   总耗时: {(self.stats['end_time'] - self.stats['start_time']).total_seconds():.2f} 秒")
            logger.info("=" * 70)

            return self.stats

        except Exception as e:
            logger.error(f"❌ 迁移失败: {e}")
            self.stats['errors'].append(str(e))
            if self.state:
                self.state.add_error(e)
            raise
        finally:
            self._cleanup()

    def _initialize_connections(self):
        """初始化数据库连接"""
        # 连接 SQLite
        if not os.path.exists(self.source_path):
            raise MigrationError(f"源数据库文件不存在: {self.source_path}")

        self.sqlite_conn = sqlite3.connect(self.source_path)
        self.sqlite_conn.row_factory = sqlite3.Row
        logger.info(f"已连接到 SQLite: {self.source_path}")

        # 连接 PostgreSQL
        self.pg_engine = PostgreSQLEngine(self.target_url)

        # 初始化状态管理
        self.state = MigrationState(self.work_dir)

        if not self.resume:
            self.state.reset()
            self.state.state['started_at'] = datetime.now().isoformat()
            self.state.save()

    def _analyze_source_database(self):
        """分析源数据库结构"""
        logger.info("\n📊 分析源数据库结构...")

        self.analyzer = SchemaAnalyzer(self.sqlite_conn)
        self.schema = self.analyzer.analyze()

        # 打印表概览
        logger.info(f"\n发现 {len(self.schema['tables'])} 个表:")
        for table_name, info in sorted(self.schema['tables'].items()):
            col_count = len(info['columns'])
            row_count = info['row_count']
            logger.info(f"  • {table_name}: {col_count} 列, {row_count:,} 行")

    def _filter_tables(self):
        """过滤要迁移的表"""
        if self.tables_filter:
            filtered_tables = {}
            for t in self.tables_filter:
                if t in self.schema['tables']:
                    filtered_tables[t] = self.schema['tables'][t]
                else:
                    logger.warning(f"警告: 表 '{t}' 不存在于源数据库")

            self.schema['tables'] = filtered_tables
            self.schema['table_names'] = list(filtered_tables.keys())
            logger.info(f"\n已过滤到 {len(filtered_tables)} 个指定表")

    def _create_target_schema(self):
        """在 PostgreSQL 中创建目标 Schema"""
        logger.info("\n🔨 创建目标数据库 Schema...")

        for table_name, table_info in self.schema['tables'].items():
            # 检查是否需要重新创建（非续传模式或表未完成）
            if not self.resume or not self.state.is_table_completed(table_name):

                # 如果是续传模式且表已部分完成，先删除重建
                if self.resume and table_name in self.state.state.get('tables', {}):
                    logger.info(f"  重建表: {table_name} (断点续传)")
                    self.pg_engine.drop_table(table_name)

                ddl = DDLGenerator.generate_create_table(table_info)
                logger.info(f"  创建表: {table_name} ({len(table_info['columns'])} 列)")

                try:
                    self.pg_engine.execute(ddl)
                except Exception as e:
                    logger.error(f"  创建表 {table_name} 失败: {e}")
                    # 尝试简化版 DDL（去掉约束）
                    simple_ddl = self._generate_simple_ddl(table_info)
                    self.pg_engine.execute(simple_ddl)

    def _generate_simple_ddl(self, table_info: Dict) -> str:
        """生成简化的 DDL（用于回退）"""
        table_name = table_info['name']
        columns = table_info['columns']
        lines = [f'CREATE TABLE IF NOT EXISTS "{table_name}" (']

        for i, col in enumerate(columns):
            pg_type = DDLGenerator.map_type(col)
            col_def = f'    "{col["name"]}" {pg_type}'
            if col.get('primary_key') and col.get('autoincrement'):
                col_def += ' SERIAL PRIMARY KEY'
            if i < len(columns) - 1:
                col_def += ','
            lines.append(col_def)

        lines.append(');')
        return '\n'.join(lines)

    def _migrate_all_tables(self):
        """迁移所有表的数据"""
        logger.info("\n📦 开始数据迁移...")

        tables_to_migrate = [
            (name, info) for name, info in self.schema['tables'].items()
            if not self.resume or not self.state.is_table_completed(name)
        ]

        self.stats['total_tables'] = len(tables_to_migrate)

        for table_name, table_info in tables_to_migrate:
            try:
                rows_migrated = self._migrate_single_table(table_name, table_info)
                self.stats['migrated_tables'] += 1
                self.stats['total_rows_target'] += rows_migrated
                self.state.mark_table_complete(table_name)
            except Exception as e:
                logger.error(f"❌ 迁移表 {table_name} 失败: {e}")
                self.stats['errors'].append(f"{table_name}: {e}")
                self.state.add_error(f"{table_name}: {e}")
                # 继续迁移其他表
                continue

    def _migrate_single_table(self, table_name: str, table_info: Dict) -> int:
        """
        迁移单个表的数据

        Args:
            table_name: 表名
            table_info: 表信息

        Returns:
            成功迁移的行数
        """
        columns = table_info['columns']
        total_rows = table_info['row_count']
        col_names = [col['name'] for col in columns]

        logger.info(f"\n  📥 迁移表: {table_name} ({total_rows:,} 行)")

        # 获取已迁移的行数（断点续传）
        start_offset = 0
        if self.resume:
            start_offset = self.state.get_table_migrated_count(table_name)
            if start_offset > 0:
                logger.info(f"     断点续传: 从第 {start_offset} 行开始")

        # 如果没有数据，直接返回
        if total_rows == 0:
            logger.info(f"     表为空，跳过")
            self.state.set_table_progress(table_name, 0, 0, 'completed')
            return 0

        # 清空目标表（如果是重新开始）
        if start_offset == 0:
            self.pg_engine.truncate_table(table_name)

        cursor = self.sqlite_conn.cursor()
        migrated_count = start_offset

        try:
            # 分批读取并写入
            pbar = tqdm(
                total=total_rows,
                desc=f"     {table_name}",
                initial=start_offset
            )

            while start_offset < total_rows:
                # 读取一批数据
                query = f'SELECT * FROM "{table_name}" LIMIT ? OFFSET ?'
                cursor.execute(query, (self.batch_size, start_offset))
                batch = cursor.fetchall()

                if not batch:
                    break

                # 转换数据格式（包含 JSON 类型适配）
                converted_batch = []
                for row in batch:
                    converted_row = tuple(
                        self._convert_value(val, col)
                        for val, col in zip(row, columns)
                    )
                    # 后处理：将 Python dict/list 包装为 psycopg2.Json 适配器
                    from psycopg2.extras import Json
                    adapted_row = tuple(
                        Json(v) if isinstance(v, (dict, list)) else v
                        for v in converted_row
                    )
                    converted_batch.append(adapted_row)

                # 使用 COPY 协议批量导入
                try:
                    inserted = self.pg_engine.copy_from_data(
                        table_name,
                        col_names,
                        converted_batch,
                        batch_size=self.batch_size
                    )
                except Exception as copy_error:
                    # COPY 失败时回退到 INSERT
                    logger.warning(f"     COPY 失败，回退到 INSERT: {copy_error}")
                    self._insert_batch_fallback(table_name, col_names, converted_batch)
                    inserted = len(converted_batch)

                migrated_count += len(batch)
                start_offset += self.batch_size

                # 更新进度
                self.state.set_table_progress(table_name, migrated_count, total_rows)
                pbar.update(len(batch))

            pbar.close()
            logger.info(f"     ✅ 完成: {migrated_count:,} 行")

            return migrated_count

        finally:
            cursor.close()

    def _convert_value(self, value: Any, col_info: Dict) -> Any:
        """
        转换单个值从 SQLite 格式到 PostgreSQL 格式

        Args:
            value: 原始值
            col_info: 列信息

        Returns:
            转换后的值
        """
        # 处理 None
        if value is None:
            return None

        # 处理常见的 NULL 替代字符串（SQLite 中可能存储的伪 NULL 值）
        if isinstance(value, str):
            if value.upper() in ('N', 'NULL', 'NONE', '\\N'):
                return None

        # JSON 字段转换
        if col_info.get('is_json') or col_info['type'].upper() in ('JSON', 'JSONB'):
            if isinstance(value, str):
                # 空字符串或 "null"/"NULL" 字符串 → Python None（JSONB 的 NULL）
                if not value.strip() or value.strip().upper() in ('NULL', 'NONE', 'N'):
                    return None
                # 尝试作为 JSON 解析
                try:
                    parsed = json.loads(value)
                    return parsed  # 返回 Python dict/list，psycopg2 会自动处理
                except json.JSONDecodeError:
                    pass
                # 检查是否为 PostgreSQL ARRAY 字面量（如 ARRAY['a','b']::text[]）
                if value.startswith('ARRAY[') or value.startswith('{'):
                    converted = self._pg_array_to_json(value)
                    if converted is not None:
                        return converted
                return value  # 无法解析的字符串原样返回
            elif isinstance(value, (dict, list)):
                return value

        # Boolean 转换
        if col_info['type'].upper() in ('BOOLEAN', 'BOOL'):
            if isinstance(value, int):
                return bool(value)
            if isinstance(value, str):
                if value.upper() in ('N', 'NULL', 'NONE', ''):
                    return None
                return value.lower() in ('1', 'true', 'yes', 't')

        # DateTime 转换
        if col_info['type'].upper() in ('DATETIME', 'TIMESTAMP', 'DATE'):
            if isinstance(value, str):
                if value.upper() in ('N', 'NULL', 'NONE', ''):
                    return None
                # 尝试解析各种日期格式
                for fmt in (
                    '%Y-%m-%d %H:%M:%S.%f',
                    '%Y-%m-%d %H:%M:%S',
                    '%Y-%m-%dT%H:%M:%S.%f',
                    '%Y-%m-%dT%H:%M:%S',
                    '%Y-%m-%d',
                ):
                    try:
                        return datetime.strptime(value, fmt)
                    except ValueError:
                        continue
            return value

        # Float/Integer 字段中的 NULL 替代值
        if col_info['type'].upper() in ('FLOAT', 'REAL', 'DOUBLE', 'INTEGER', 'INT', 'BIGINT', 'NUMERIC', 'DECIMAL'):
            if isinstance(value, str) and value.upper() in ('N', 'NULL', 'NONE', ''):
                return None

        return value

    @staticmethod
    def _pg_array_to_json(array_str: str) -> Any:
        """将 PostgreSQL ARRAY 字面量转换为 Python list（JSON 兼容）"""
        import re
        # 匹配 ARRAY['a','b'] 或 {a,b} 格式
        match = re.match(r'ARRAY\[(.+)\](?:::\w+)?$', array_str)
        if not match:
            match = re.match(r'\{(.+)\}$', array_str)

        if match:
            content = match.group(1)
            # 简单分割（不考虑嵌套和转义引号）
            items = [item.strip().strip("'\"") for item in content.split(',')]
            return items

        return None

    def _insert_batch_fallback(self, table_name: str, columns: List[str], data: List[Tuple]):
        """INSERT 回退方案（逐行插入，最大兼容性）"""
        col_list = ', '.join(f'"{c}"' for c in columns)
        placeholders = ', '.join(['%s'] * len(columns))
        query = f'INSERT INTO "{table_name}" ({col_list}) VALUES ({placeholders}) ON CONFLICT DO NOTHING'

        cursor = self.pg_engine.conn.cursor()
        try:
            for row in data:
                cursor.execute(query, row)
            self.pg_engine.conn.commit()
        except Exception as e:
            self.pg_engine.conn.rollback()
            raise MigrationError(f"批量插入失败: {e}")
        finally:
            cursor.close()

    def _create_indexes(self):
        """创建索引"""
        logger.info("\n🔍 创建索引...")

        indexes_created = 0

        for table_name, indexes in self.schema['indexes'].items():
            if table_name not in self.schema['tables']:
                continue

            for idx_info in indexes:
                try:
                    ddl = DDLGenerator.generate_index(idx_info)
                    self.pg_engine.execute(ddl)
                    indexes_created += 1
                    logger.info(f"  ✓ 创建索引: {idx_info['name']} ON {table_name}")
                except Exception as e:
                    logger.warning(f"  ⚠ 创建索引 {idx_info['name']} 失败: {e}")

        logger.info(f"\n共创建/验证 {indexes_created} 个索引")

    def _validate_migration(self):
        """验证迁移结果"""
        logger.info("\n✅ 验证迁移结果...")

        validation_results = []

        for table_name, table_info in self.schema['tables'].items():
            result = self._validate_table(table_name, table_info)
            validation_results.append(result)

        self.stats['validation_results'] = validation_results

        # 输出验证摘要
        passed = sum(1 for r in validation_results if r['passed'])
        failed = len(validation_results) - passed

        logger.info(f"\n{'='*50}")
        logger.info(f"验证摘要: {passed} 通过, {failed} 失败")
        logger.info(f"{'='*50}")

        for result in validation_results:
            status = "✅" if result['passed'] else "❌"
            logger.info(f"  {status} {result['table']}: "
                       f"源={result['source_rows']:,}, 目标={result['target_rows']:,}"
                       f", 抽样={'通过' if result['sample_ok'] else '失败'}")

    def _validate_table(self, table_name: str, table_info: Dict) -> Dict:
        """
        验证单个表的迁移结果

        Returns:
            验证结果字典
        """
        result = {
            'table': table_name,
            'source_rows': table_info['row_count'],
            'target_rows': 0,
            'row_match': False,
            'sample_ok': True,
            'distribution_ok': True,
            'details': [],
            'passed': False
        }

        # 1. 行数对比
        try:
            target_rows = self.pg_engine.get_row_count(table_name)
            result['target_rows'] = target_rows
            result['row_match'] = (target_rows == table_info['row_count'])

            if not result['row_match']:
                result['details'].append(
                    f"行数不匹配: 源={table_info['row_count']:,}, 目标={target_rows:,}"
                )

        except Exception as e:
            result['details'].append(f"获取目标行数失败: {e}")

        # 2. 抽样检查
        try:
            sample_result = self._validate_sample(table_name, table_info)
            result['sample_ok'] = sample_result['ok']
            result['details'].extend(sample_result['details'])
        except Exception as e:
            result['sample_ok'] = False
            result['details'].append(f"抽样验证失败: {e}")

        # 3. 分类字段分布对比（仅对特定表）
        if table_name in ('tcm_herbs', 'bioactive_peptides'):
            try:
                dist_result = self._validate_distribution(table_name, table_info)
                result['distribution_ok'] = dist_result['ok']
                result['details'].extend(dist_result['details'])
            except Exception as e:
                result['distribution_ok'] = False
                result['details'].append(f"分布验证失败: {e}")

        # 综合判断
        result['passed'] = result['row_match'] and result['sample_ok'] and result['distribution_ok']

        return result

    def _validate_sample(self, table_name: str, table_info: Dict) -> Dict:
        """抽样检查数据一致性"""
        sample_size = min(5, table_info['row_count'])
        columns = table_info['columns']
        col_names = [col['name'] for col in columns]

        result = {'ok': True, 'details': []}

        if sample_size == 0:
            return result

        # 从源获取随机样本
        cursor = self.sqlite_conn.cursor()
        try:
            cursor.execute(f'SELECT COUNT(*) FROM "{table_name}"')
            total = cursor.fetchone()[0]

            if total == 0:
                return result

            # 随机选择行号
            random_ids = random.sample(range(total), min(sample_size, total))

            for rid in random_ids:
                cursor.execute(f'SELECT * FROM "{table_name}" LIMIT 1 OFFSET ?', (rid,))
                source_row = cursor.fetchone()

                if not source_row:
                    continue

                # 从目标获取对应行（按 ID 或行号）
                pk_col = table_info.get('primary_key') or 'id'
                pk_val = dict(zip(col_names, source_row)).get(pk_col)

                if pk_val is not None:
                    target_query = f'SELECT * FROM "{table_name}" WHERE "{pk_col}" = %s'
                    target_rows = self.pg_engine.execute(target_query, (pk_val,), fetch=True)

                    if target_rows:
                        target_row = target_rows[0]

                        # 对比关键列
                        for i, col in enumerate(columns):
                            src_val = source_row[i]
                            tgt_val = target_row[i]

                            if not self._values_equal(src_val, tgt_val, col):
                                result['ok'] = False
                                result['details'].append(
                                    f"样本 ID={pk_val}, 列 {col['name']} 不匹配: "
                                    f"源={repr(src_val)[:50]}, 目标={repr(tgt_val)[:50]}"
                                )
                                break  # 只记录第一个不匹配

        finally:
            cursor.close()

        return result

    def _validate_distribution(self, table_name: str, table_info: Dict) -> Dict:
        """验证分类字段分布"""
        result = {'ok': True, 'details': []}

        # 确定分布字段
        dist_column = 'category' if table_name == 'tcm_herbs' else 'activity_type'

        # 检查该列是否存在
        col_names = [col['name'] for col in table_info['columns']]
        if dist_column not in col_names:
            return result

        # 获取源分布
        cursor = self.sqlite_conn.cursor()
        try:
            cursor.execute(
                f'SELECT "{dist_column}", COUNT(*) FROM "{table_name}" GROUP BY "{dist_column}" ORDER BY COUNT(*) DESC LIMIT 10'
            )
            source_dist = {row[0]: row[1] for row in cursor.fetchall()}
        finally:
            cursor.close()

        # 获取目标分布
        try:
            target_rows = self.pg_engine.execute(
                f'SELECT "{dist_column}", COUNT(*) FROM "{table_name}" '
                f'GROUP BY "{dist_column}" ORDER BY COUNT(*) DESC LIMIT 10',
                fetch=True
            )
            target_dist = {row[0]: row[1] for row in target_rows}
        except Exception as e:
            result['ok'] = False
            result['details'].append(f"获取目标分布失败: {e}")
            return result

        # 对比分布
        all_categories = set(source_dist.keys()) | set(target_dist.keys())
        mismatches = []

        for cat in all_categories:
            src_count = source_dist.get(cat, 0)
            tgt_count = target_dist.get(cat, 0)
            if src_count != tgt_count:
                mismatches.append(f"{cat}: 源={src_count}, 目标={tgt_count}")

        if mismatches:
            result['ok'] = False
            result['details'].append(f"分布不匹配: {'; '.join(mismatches[:5])}")
        else:
            result['details'].append(f"{dist_column} 分布一致 ({len(all_categories)} 个类别)")

        return result

    @staticmethod
    def _values_equal(src_val: Any, tgt_val: Any, col_info: Dict) -> bool:
        """比较两个值是否相等"""
        if src_val is None and tgt_val is None:
            return True
        if src_val is None or tgt_val is None:
            return False

        # JSON 比较
        if col_info.get('is_json'):
            if isinstance(src_val, str):
                try:
                    src_val = json.loads(src_val)
                except:
                    pass
            if isinstance(tgt_val, str):
                try:
                    tgt_val = json.loads(tgt_val)
                except:
                    pass
            return src_val == tgt_val

        # 浮点数比较（允许微小误差）
        if isinstance(src_val, float) and isinstance(tgt_val, float):
            return abs(src_val - tgt_val) < 0.001

        # DateTime 比较
        if isinstance(src_val, datetime) and isinstance(tgt_val, datetime):
            return abs((src_val - tgt_val).total_seconds()) < 1

        return src_val == tgt_val

    def _generate_report(self) -> str:
        """生成 Markdown 迁移报告"""
        report_path = self.work_dir / 'migration_report.md'

        duration = (self.stats['end_time'] - self.stats['start_time']).total_seconds() if self.stats['end_time'] else 0

        report_lines = [
            "# SQLite → PostgreSQL 数据迁移报告",
            "",
            f"> 生成时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}",
            "",
            "## 迁移概览",
            "",
            "| 项目 | 值 |",
            "|------|-----|",
            f"| 源数据库 | `{self.source_path}` |",
            f"| 目标数据库 | `postgresql://localhost:5432/rmfood_platform` |",
            f"| 总表数 | {self.stats['total_tables']} |",
            f"| 成功迁移 | {self.stats['migrated_tables']} |",
            f"| 源总行数 | {sum(t['row_count'] for t in self.schema['tables'].values()):,} |",
            f"| 目标总行数 | {self.stats['total_rows_target']:,} |",
            f"| 总耗时 | {duration:.2f} 秒 |",
            f"| 错误数量 | {len(self.stats['errors'])} |",
            "",
            "## 各表详情",
            "",
            "| 表名 | 源行数 | 目标行数 | 状态 |",
            "|------|--------|----------|------|",
        ]

        for table_name, table_info in self.schema['tables'].items():
            state_info = self.state.state.get('tables', {}).get(table_name, {})
            status = state_info.get('status', '未知')
            target_rows = self.stats.get('validation_results', [])
            tr = next((r['target_rows'] for r in target_rows if r['table'] == table_name), '-')
            status_icon = "✅" if status == 'completed' else "⚠️"

            report_lines.append(
                f"| {table_name} | {table_info['row_count']:,} | {tr} | {status_icon} {status} |"
            )

        report_lines.extend([
            "",
            "## 验证结果",
            ""
        ])

        if self.stats.get('validation_results'):
            for vr in self.stats['validation_results']:
                icon = "✅" if vr['passed'] else "❌"
                report_lines.append(f"- {icon} **{vr['table']}**: ")
                report_lines.append(f"  - 行数: 源={vr['source_rows']:,}, 目标={vr['target_rows']:,}")
                for detail in vr['details']:
                    report_lines.append(f"  - {detail}")
                report_lines.append("")

        if self.stats['errors']:
            report_lines.extend([
                "## 错误日志",
                ""
            ])
            for err in self.stats['errors']:
                report_lines.append(f"- ❌ {err}")
            report_lines.append("")

        report_lines.extend([
            "---",
            f"*由 RMFOOD 迁移工具自动生成*",
            ""
        ])

        report_content = '\n'.join(report_lines)

        with open(report_path, 'w', encoding='utf-8') as f:
            f.write(report_content)

        logger.info(f"迁移报告已生成: {report_path}")
        return str(report_path)

    def _mask_pg_url(self, url: str) -> str:
        """隐藏 PostgreSQL URL 中的敏感信息"""
        if '@' in url:
            parts = url.split('@')
            if '://' in parts[0]:
                proto_user = parts[0].split('://')
                user = proto_user[1].split(':')[0] if ':' in proto_user[1] else proto_user[1]
                return f"{proto_user[0]}://{user}:****@{parts[1]}"
        return url

    def _cleanup(self):
        """清理资源"""
        if self.sqlite_conn:
            self.sqlite_conn.close()
        if self.pg_engine:
            self.pg_engine.close()


def main():
    """命令行入口"""
    parser = argparse.ArgumentParser(
        description="SQLite → PostgreSQL 数据迁移工具",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
示例:
  # 完整迁移
  python migrate_sqlite_to_postgresql.py \\
      --source ../rmfood_platform.db \\
      --target-url "postgresql://postgres@localhost:5432/rmfood_platform"

  # 断点续传
  python migrate_sqlite_to_postgresql.py --resume

  # 只迁移指定表
  python migrate_sqlite_to_postgresql.py --tables tcm_herbs,bioactive_peptides

  # 自定义批大小
  python migrate_sqlite_to_postgresql.py --batch-size 1000
        """
    )

    parser.add_argument(
        '--source', '-s',
        type=str,
        default=r'd:\RMFOOD配方平台\backend\rmfood_platform.db',
        help='SQLite 源数据库路径 (默认: ../rmfood_platform.db)'
    )

    parser.add_argument(
        '--target-url', '-t',
        type=str,
        default='postgresql://postgres@localhost:5432/rmfood_platform',
        help='PostgreSQL 目标连接 URL'
    )

    parser.add_argument(
        '--batch-size', '-b',
        type=int,
        default=500,
        help='每批处理的行数 (默认: 500)'
    )

    parser.add_argument(
        '--resume', '-r',
        action='store_true',
        help='从上次中断的位置继续迁移'
    )

    parser.add_argument(
        '--tables',
        type=str,
        help='只迁移指定的表（逗号分隔）'
    )

    parser.add_argument(
        '--skip-validation',
        action='store_true',
        help='跳过数据验证步骤'
    )

    parser.add_argument(
        '--reset',
        action='store_true',
        help='重置迁移状态（清除断点续传记录）'
    )

    args = parser.parse_args()

    # 处理表过滤
    tables = None
    if args.tables:
        tables = [t.strip() for t in args.tables.split(',')]

    # 重置状态
    if args.reset:
        state_file = Path(__file__).parent / 'migration_state.json'
        if state_file.exists():
            state_file.unlink()
            print("✓ 已重置迁移状态")

    try:
        migrator = DataMigrator(
            source_path=args.source,
            target_url=args.target_url,
            batch_size=args.batch_size,
            resume=args.resume,
            tables=tables,
            skip_validation=args.skip_validation
        )

        stats = migrator.run()

        # 返回退出码
        if stats['errors']:
            sys.exit(1)
        sys.exit(0)

    except KeyboardInterrupt:
        print("\n\n⚠️ 用户中断迁移。可使用 --resume 参数继续。")
        sys.exit(130)
    except MigrationError as e:
        print(f"\n❌ 迁移错误: {e}")
        sys.exit(1)
    except Exception as e:
        print(f"\n💥 未预期的错误: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == '__main__':
    main()
