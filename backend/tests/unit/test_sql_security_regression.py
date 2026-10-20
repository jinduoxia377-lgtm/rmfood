"""回归测试：app.core.security.sql_security 模块可正常导入。

历史 bug：该模块在模块级调用 logger.info(...)，但文件顶部没有 import logging /
定义 logger，直接 import 即抛 NameError: name 'logger' is not defined。
修复后应能正常导入，且 logger 已正确配置。

另：tests/unit/test_core_security.py 中两个旧测试的导入路径已从
app.core.sql_security 修正为 app.core.security.sql_security，并在
tests/unit/conftest.py 中移除了对应 xfail 条目。
"""
import pytest


class TestSqlSecurityModuleImport:
    """回归测试：模块导入不抛错"""

    def test_module_imports_without_error(self):
        import app.core.security.sql_security as sql_security

        # logger 应已定义且指向本模块
        assert hasattr(sql_security, "logger")
        assert sql_security.logger.name == "app.core.security.sql_security"

    def test_safe_query_builder_basic(self):
        from app.core.security.sql_security import SafeQueryBuilder

        builder = SafeQueryBuilder("users")
        query, params = builder.where("id = :id", {"id": 1}).limit(5).build()

        assert "FROM users" in query
        assert ":id" in query
        assert params["id"] == 1
        assert params["_limit"] == 5

    def test_safe_query_builder_rejects_dangerous_sql(self):
        from app.core.security.sql_security import SafeQueryBuilder, SecurityError

        builder = SafeQueryBuilder("users")
        with pytest.raises(SecurityError):
            builder.where("id = 1; DROP TABLE users--", {})

    def test_validate_table_name_whitelist(self):
        from app.core.security.sql_security import validate_table_name

        assert validate_table_name("users") == "users"
        with pytest.raises(ValueError):
            validate_table_name("sensitive_table; DROP DATABASE")