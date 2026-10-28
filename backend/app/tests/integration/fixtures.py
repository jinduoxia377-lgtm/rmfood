"""
集成测试夹具 (Integration Test Fixtures)

提供数据库 schema 隔离、临时表创建/清理等能力。
"""

import pytest

TEST_DATABASE_URL = "postgresql+asyncpg://postgres:postgres@localhost:5432/rmfood_test"


@pytest.fixture(scope="session")
def postgres_dsn():
    """返回测试用的 PostgreSQL DSN。"""
    return TEST_DATABASE_URL


@pytest.fixture()
def isolation_schema():
    """
    返回一个唯一的 schema 名称（基于 fixture id），用于测试时隔离数据。
    每个 test 可以 CREATE SCHEMA IF NOT EXISTS，并在 teardown 时 DROP SCHEMA CASCADE。
    """
    import uuid
    schema_name = f"test_{uuid.uuid4().hex[:8]}"
    return schema_name
