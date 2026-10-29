"""app/core/database/data_masking.py 单元测试

覆盖 PII 脱敏的等级枚举、单值/字典/列表脱敏与字段类型自动识别。
"""

from app.core.database.data_masking import (
    MaskLevel,
    mask_value,
    mask_dict,
    mask_list,
    get_masking_registry,
    add_mask_rule,
)


class TestMaskLevel:
    def test_enum_values(self):
        assert MaskLevel.NONE.value == "none"
        assert MaskLevel.PARTIAL.value == "partial"
        assert MaskLevel.FULL.value == "full"
        assert MaskLevel.HASH.value == "hash"
        assert MaskLevel.ENCRYPT.value == "encrypt"


class TestMaskValue:
    def test_none_unchanged(self):
        assert mask_value(None) is None

    def test_number_unchanged(self):
        assert mask_value(12345) == 12345
        assert mask_value(3.14) == 3.14

    def test_bool_unchanged(self):
        assert mask_value(True) is True

    def test_email_by_field_type(self):
        masked = mask_value("user@example.com", field_type="email")
        assert masked != "user@example.com"
        assert "@" not in masked or masked != "user@example.com"

    def test_phone_by_field_type(self):
        masked = mask_value("13800138000", field_type="phone")
        assert masked != "13800138000"

    def test_name_auto_detected(self):
        masked = mask_value("张三", field_name="full_name")
        assert masked != "张三"

    def test_password_full(self):
        masked = mask_value("mysecret", field_type="password", level=MaskLevel.FULL)
        assert set(masked) == {"*"} or masked != "mysecret"

    def test_id_card_by_field_type(self):
        masked = mask_value("110101199003071234", field_type="id_card")
        assert masked != "110101199003071234"

    def test_ip_by_field_type(self):
        masked = mask_value("192.168.1.1", field_type="ip_address")
        assert masked != "192.168.1.1"

    def test_unknown_value_unchanged(self):
        assert mask_value("hello world") == "hello world"


class TestMaskDict:
    def test_mask_dict_pii_fields(self):
        data = {
            "username": "alice",
            "email": "alice@example.com",
            "age": 30,
        }
        masked = mask_dict(data)
        assert masked["age"] == 30
        assert masked["email"] != "alice@example.com"
        assert masked["username"] != "alice"

    def test_mask_dict_exempt_fields(self):
        data = {"email": "alice@example.com"}
        masked = mask_dict(data, exempt_fields={"email"})
        assert masked["email"] == "alice@example.com"

    def test_mask_dict_nested(self):
        data = {"user": {"email": "bob@example.com"}}
        masked = mask_dict(data)
        assert masked["user"]["email"] != "bob@example.com"

    def test_mask_dict_override_levels(self):
        data = {"email": "alice@example.com"}
        masked = mask_dict(data, override_levels={"email": MaskLevel.FULL})
        assert masked["email"] != "alice@example.com"


class TestMaskList:
    def test_mask_list(self):
        items = [{"email": "a@example.com"}, {"email": "b@example.com"}]
        masked = mask_list(items)
        assert masked[0]["email"] != "a@example.com"
        assert masked[1]["email"] != "b@example.com"


class TestMaskingRegistry:
    def test_singleton(self):
        assert get_masking_registry() is get_masking_registry()

    def test_field_types(self):
        registry = get_masking_registry()
        types = registry.field_types
        assert "email" in types
        assert "phone" in types

    def test_add_mask_rule(self):
        registry = get_masking_registry()
        add_mask_rule("custom_field", lambda v, level: "MASKED")
        assert "custom_field" in registry.field_types
        assert mask_value("secret", field_type="custom_field") == "MASKED"
        # 清理：移除自定义规则（避免影响其它测试）
        registry._rules.pop("custom_field", None)