"""
数据分类分级体系测试（ADR-003）

覆盖：脱敏规则、分类访问控制、数据分类 Mixin
"""
import pytest
from datetime import datetime

from app.infrastructure.data_masking import (
    mask_value, mask_dict, check_classification_access,
)
from app.models.enums import DataClassification


class TestDataMasking:
    """数据脱敏规则测试"""

    # ─── 手机号脱敏 ───

    def test_phone_public(self):
        result = mask_value("13812345678", "public", "phone")
        assert result == "13812345678"

    def test_phone_internal(self):
        result = mask_value("13812345678", "internal", "phone")
        assert result == "138****5678"

    def test_phone_secret(self):
        result = mask_value("13812345678", "secret", "phone")
        assert result == "138****5678"  # 保留前3后4

    def test_phone_top_secret(self):
        result = mask_value("13812345678", "top_secret", "phone")
        assert result == "***"

    # ─── 邮箱脱敏 ───

    def test_email_public(self):
        result = mask_value("user@example.com", "public", "email")
        assert result == "user@example.com"

    def test_email_internal(self):
        result = mask_value("user@example.com", "internal", "email")
        assert result == "u***@example.com"

    def test_email_secret(self):
        result = mask_value("user@example.com", "secret", "email")
        assert "***" in result

    def test_email_top_secret(self):
        result = mask_value("user@example.com", "top_secret", "email")
        assert result == "***"

    # ─── 姓名脱敏 ───

    @pytest.mark.parametrize("name,internal_expected", [
        ("张三", "张*"),
        ("李四光", "李**"),
        ("司马相如", "司***"),
    ])
    def test_name_internal(self, name, internal_expected):
        result = mask_value(name, "internal", "name")
        assert result == internal_expected

    @pytest.mark.parametrize("name,secret_expected", [
        ("张三", "张**"),
        ("李四光", "李**"),
    ])
    def test_name_secret(self, name, secret_expected):
        result = mask_value(name, "secret", "name")
        assert result == secret_expected

    def test_name_single_char(self):
        """单字名测试"""
        assert mask_value("李", "internal", "name") == "李"
        assert mask_value("李", "secret", "name") == "*"

    # ─── 身份证号脱敏 ───

    def test_id_internal(self):
        result = mask_value("110101199001011234", "internal", "id")
        assert result == "110***********1234"
        assert len(result) == len("110101199001011234")  # 长度不变

    def test_id_secret(self):
        result = mask_value("110101199001011234", "secret", "id")
        assert result.startswith("1") and result.endswith("234")
        assert len(result) == len("110101199001011234")

    # ─── 地址脱敏 ───

    def test_address_internal(self):
        result = mask_value("北京市海淀区中关村大街1号", "internal", "address")
        assert "****" in result

    def test_address_secret(self):
        result = mask_value("北京市海淀区中关村大街1号", "secret", "address")
        assert result.startswith("北京")

    # ─── 通用字段脱敏 ───

    def test_generic_short_value(self):
        """短文本应正确处理"""
        assert mask_value("ab", "internal", "generic") == "a*"
        assert mask_value("abc", "internal", "generic") == "a**"
        assert mask_value("a", "internal", "generic") == "a"

    def test_generic_long_value(self):
        assert mask_value("abcdefghij", "internal", "generic") == "ab******ij"

    def test_empty_value(self):
        assert mask_value("", "internal", "phone") == ""
        assert mask_value(None, "top_secret", "phone") is None

    # ─── 批量字段脱敏 ───

    def test_mask_dict(self):
        data = {
            "name": "张三丰",
            "phone": "13812345678",
            "email": "test@example.com",
            "formula_name": "抗氧化配方",  # 非敏感字段不脱敏
        }
        schema = {
            "name": "name",
            "phone": "phone",
            "email": "email",
        }
        result = mask_dict(data, "internal", schema)
        assert result["name"] == "张**"
        assert result["phone"] == "138****5678"
        assert result["email"] == "t***@example.com"
        assert result["formula_name"] == "抗氧化配方"  # 未脱敏

    def test_mask_dict_public_skips(self):
        """L1 公开数据不脱敏"""
        data = {"name": "张三", "phone": "13812345678"}
        result = mask_dict(data, "public", {"name": "name", "phone": "phone"})
        assert result == data


class TestClassificationAccess:
    """数据分类访问控制测试"""

    @pytest.mark.parametrize("role,classification,expected", [
        # L1 公开：所有人可访问
        ("guest", "public", True),
        ("researcher", "public", True),
        ("admin", "public", True),
        # L2 内部：researcher+
        ("guest", "internal", False),
        ("researcher", "internal", True),
        ("admin", "internal", True),
        # L3 机密：formulator+
        ("researcher", "secret", False),
        ("formulator", "secret", True),
        ("reviewer", "secret", True),
        # L4 绝密：reviewer+
        ("formulator", "top_secret", False),
        ("reviewer", "top_secret", True),
        ("admin", "top_secret", True),
    ])
    def test_access_check(self, role, classification, expected):
        assert check_classification_access(role, classification) is expected


class TestDataClassificationEnum:
    """DataClassification 枚举测试"""

    def test_enum_values(self):
        assert DataClassification.PUBLIC.value == "public"
        assert DataClassification.INTERNAL.value == "internal"
        assert DataClassification.SECRET.value == "secret"
        assert DataClassification.TOP_SECRET.value == "top_secret"

    def test_enum_ordered(self):
        """验证枚举顺序符合安全等级"""
        levels = list(DataClassification)
        assert levels[0] == DataClassification.PUBLIC
        assert levels[1] == DataClassification.INTERNAL
        assert levels[2] == DataClassification.SECRET
        assert levels[3] == DataClassification.TOP_SECRET
