"""core/security 工具模块单元测试

覆盖:
- app.core.security.sql_security: SafeQueryBuilder / 表名列名白名单 / LIKE 转义
- app.core.security.totp: RFC 6238 TOTP 生成与校验
- app.core.security.crypto: Fernet 加密 / 解密 / 密钥工具
"""
import pytest

from app.core.security.sql_security import (
    SafeQueryBuilder,
    SecurityError,
    validate_table_name,
    validate_column_name,
    sanitize_like_pattern,
    build_select_query,
)
from app.core.security import totp
from app.core.security import crypto


class TestSafeQueryBuilder:
    def test_build_simple_select(self):
        builder = SafeQueryBuilder("users")
        sql, params = builder.select("id", "name").where("id = :id", {"id": 1}).build()
        assert "SELECT id, name FROM users" in sql
        assert "WHERE (id = :id)" in sql
        assert params == {"id": 1}

    def test_build_with_order_limit_offset(self):
        builder = SafeQueryBuilder("users")
        sql, params = builder.select("*").order_by("name", "DESC").limit(10).offset(20).build()
        assert "ORDER BY name DESC" in sql
        assert "LIMIT :_limit" in sql
        assert "OFFSET :_offset" in sql
        assert params == {"_limit": 10, "_offset": 20}

    def test_build_with_join(self):
        builder = SafeQueryBuilder("users")
        sql, _ = builder.join("formulas", "formulas.creator_id = users.id").build()
        assert "JOIN formulas ON formulas.creator_id = users.id" in sql

    def test_invalid_table_raises(self):
        with pytest.raises(ValueError):
            SafeQueryBuilder("users; DROP TABLE users")

    def test_invalid_column_raises(self):
        builder = SafeQueryBuilder("users")
        with pytest.raises(ValueError):
            builder.select("id; DROP TABLE users")

    def test_dangerous_where_raises(self):
        builder = SafeQueryBuilder("users")
        with pytest.raises(SecurityError):
            builder.where("1=1; DROP TABLE users", {})
        with pytest.raises(SecurityError):
            builder.where("1=1 UNION SELECT * FROM users", {})

    def test_where_requires_dict_params(self):
        builder = SafeQueryBuilder("users")
        with pytest.raises(TypeError):
            builder.where("id = :id", [1, 2])

    def test_invalid_order_direction(self):
        builder = SafeQueryBuilder("users")
        with pytest.raises(ValueError):
            builder.order_by("name", "SIDEWAYS")

    def test_invalid_limit(self):
        builder = SafeQueryBuilder("users")
        with pytest.raises(TypeError):
            builder.limit(-1)

    def test_build_without_table_raises(self):
        builder = SafeQueryBuilder()
        with pytest.raises(ValueError):
            builder.build()

    def test_validate_table_name(self):
        assert validate_table_name("users") == "users"
        with pytest.raises(ValueError):
            validate_table_name("users; DROP")

    def test_validate_column_name(self):
        assert validate_column_name("*") == "*"
        assert validate_column_name("created_at") == "created_at"
        with pytest.raises(ValueError):
            validate_column_name("bad column;")

    def test_sanitize_like_pattern(self):
        assert sanitize_like_pattern("a%b_c") == "a\\%b\\_c"
        assert sanitize_like_pattern("100\\%") == "100\\\\\\%"

    def test_build_select_query(self):
        sql, params = build_select_query(
            "users",
            columns=["id", "name"],
            conditions=[("id = :id", {"id": 5})],
            order_by="name ASC",
            limit=1,
        )
        assert "SELECT id, name FROM users" in sql
        assert "WHERE (id = :id)" in sql
        assert params["id"] == 5

    def test_execute_safe(self):
        class FakeDB:
            def __init__(self):
                self.executed = None

            def execute(self, stmt, params):
                self.executed = (stmt, params)
                return "result"

        db = FakeDB()
        result = SafeQueryBuilder.execute_safe(
            db, "SELECT * FROM users WHERE id = :id", {"id": 1}
        )
        assert db.executed is not None
        assert result == "result"

    def test_execute_safe_rejects_object_param(self):
        class FakeDB:
            def execute(self, stmt, params):
                return None

        with pytest.raises(TypeError):
            SafeQueryBuilder.execute_safe(
                FakeDB(), "SELECT * FROM users WHERE id = :id", {"id": object()}
            )


class TestTotp:
    def test_generate_secret_is_base32(self):
        secret = totp.generate_secret()
        # 必须是 Base32 字符集（去掉 padding）
        assert all(c in "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567" for c in secret)
        assert len(secret) >= 26

    def test_totp_at_deterministic(self):
        secret = totp.generate_secret()
        code1 = totp.totp_at(secret, timestamp=1_700_000_000)
        code2 = totp.totp_at(secret, timestamp=1_700_000_000)
        assert code1 == code2
        assert len(code1) == 6
        assert code1.isdigit()

    def test_verify_totp_correct(self):
        secret = totp.generate_secret()
        code = totp.totp_at(secret)
        assert totp.verify_totp(secret, code) is True

    def test_verify_totp_wrong(self):
        secret = totp.generate_secret()
        assert totp.verify_totp(secret, "000000") is False

    def test_verify_totp_invalid_format(self):
        secret = totp.generate_secret()
        assert totp.verify_totp(secret, "abc") is False
        assert totp.verify_totp(secret, "12345") is False

    def test_totp_uri(self):
        secret = totp.generate_secret()
        uri = totp.totp_uri(secret, "RMFOOD", "user@example.com")
        assert uri.startswith("otpauth://totp/")
        assert "secret=" in uri
        assert "issuer=RMFOOD" in uri


class TestCrypto:
    def test_encrypt_decrypt_roundtrip(self):
        encrypted = crypto.encrypt_value("sk-secret-123")
        assert encrypted.startswith("enc::")
        assert crypto.decrypt_value(encrypted) == "sk-secret-123"

    def test_encrypt_empty_returns_empty(self):
        assert crypto.encrypt_value("") == ""

    def test_decrypt_plain_returns_plain(self):
        assert crypto.decrypt_value("plain-value") == "plain-value"

    def test_is_encrypted(self):
        assert crypto.is_encrypted("enc::abc")
        assert not crypto.is_encrypted("abc")

    def test_encrypt_decrypt_dict_field(self):
        data = {"api_key": "sk-123", "base_url": "https://example.com"}
        encrypted = crypto.encrypt_dict_field(data, sensitive_keys=["api_key"])
        assert encrypted["api_key"].startswith("enc::")
        assert encrypted["base_url"] == "https://example.com"
        # 原字典不被修改
        assert data["api_key"] == "sk-123"
        decrypted = crypto.decrypt_dict_field(encrypted, sensitive_keys=["api_key"])
        assert decrypted["api_key"] == "sk-123"

    def test_generate_encryption_key(self):
        key = crypto.generate_encryption_key()
        assert isinstance(key, str)
        assert len(key) > 0

    def test_rotate_encryption_key(self):
        old_key = crypto.generate_encryption_key()
        new_key = crypto.generate_encryption_key()
        result = crypto.rotate_encryption_key(old_key, new_key)
        assert set(result.keys()) == {"rotated_count", "failed_count"}