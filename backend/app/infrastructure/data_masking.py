"""
数据脱敏工具（ADR-003）

根据数据分类等级，对敏感字段进行脱敏处理。
脱敏规则：
- L1 PUBLIC：不脱敏
- L2 INTERNAL：脱敏部分字段（如联系方式中间四位）
- L3 SECRET：脱敏大多数敏感字段
- L4 TOP_SECRET：强脱敏（仅保留必要信息）
"""
from __future__ import annotations

import re


def mask_value(value: str, level: str, field_type: str = "generic") -> str:
    """
    根据数据分类等级对字符串值进行脱敏

    Args:
        value: 原始值
        level: 数据分类等级 (public/internal/secret/top_secret)
        field_type: 字段类型 (phone/email/name/id/address/generic)

    Returns:
        脱敏后的值
    """
    if not value:
        return value

    if level == "public":
        return value

    if level == "internal":
        return _mask_internal(value, field_type)

    if level == "secret":
        return _mask_secret(value, field_type)

    if level == "top_secret":
        return _mask_top_secret(value, field_type)

    return value


def _mask_internal(value: str, field_type: str) -> str:
    """L2 内部级脱敏"""
    if field_type == "phone":
        # 138****5678
        return re.sub(r'(\d{3})\d{4}(\d{4})', r'\1****\2', value)
    elif field_type == "email":
        # u***@example.com
        local, domain = value.split("@", 1)
        return f"{local[0]}***@{domain}"
    elif field_type == "name":
        # 张* 或 李**（保留姓）
        if len(value) <= 1:
            return value
        return value[0] + "*" * (len(value) - 1)
    elif field_type == "id":
        # 110************456
        if len(value) >= 10:
            return value[:3] + "*" * (len(value) - 7) + value[-4:]
        return "****"
    elif field_type == "address":
        # 保留前6位（省市区），其余隐藏
        return value[:6] + "****"
    # 通用：保留前后各2字符
    if len(value) <= 4:
        return value[0] + "*" * (len(value) - 1) if len(value) > 1 else value
    return value[:2] + "*" * (len(value) - 4) + value[-2:]


def _mask_secret(value: str, field_type: str) -> str:
    """L3 机密级脱敏"""
    if field_type == "phone":
        return "138****" + value[-4:] if len(value) >= 7 else "****"
    elif field_type == "email":
        return value.split("@")[0][:1] + "***@***.com"
    elif field_type == "name":
        return value[0] + "**" if len(value) >= 2 else "*"
    elif field_type == "id":
        return value[:1] + "*" * (len(value) - 4) + value[-3:] if len(value) >= 4 else "****"
    elif field_type == "address":
        return value[:4] + "******"
    # 通用：仅保留首尾各1字符
    if len(value) <= 2:
        return value[0] + "*"
    return value[0] + "*" * (len(value) - 2) + value[-1]


def _mask_top_secret(value: str, field_type: str) -> str:
    """L4 绝密级脱敏"""
    if field_type in ("phone", "email", "id", "name", "address"):
        return "***"
    # 通用：全隐藏
    return "*" * min(len(value), 8)


def mask_dict(data: dict, level: str, field_schema: dict[str, str]) -> dict:
    """
    对字典中的指定字段进行脱敏

    Args:
        data: 原始数据字典
        level: 数据分类等级
        field_schema: 字段类型映射 {字段名: field_type}

    Returns:
        脱敏后的字典
    """
    if level == "public":
        return data

    result = dict(data)
    for field, field_type in field_schema.items():
        if field in result and isinstance(result[field], str):
            result[field] = mask_value(result[field], level, field_type)
    return result


# ──────────── 数据分类检查工具 ────────────


def check_classification_access(
    user_role: str,
    data_classification: str,
) -> bool:
    """
    检查用户角色是否有权访问指定分类的数据

    Args:
        user_role: 用户角色 (admin/reviewer/formulator/researcher/guest)
        data_classification: 数据分类等级

    Returns:
        True 允许访问, False 拒绝访问
    """
    # 角色等级（数字越大权限越高）
    role_level = {
        "guest": 0,
        "researcher": 1,
        "formulator": 2,
        "reviewer": 3,
        "admin": 4,
    }

    # 数据分类所需的最低角色等级
    classification_min_role = {
        "public": 0,        # 所有人
        "internal": 1,      # researcher+
        "secret": 2,        # formulator+
        "top_secret": 3,    # reviewer+
    }

    min_role = classification_min_role.get(data_classification, 1)
    user_lvl = role_level.get(user_role, 0)
    return user_lvl >= min_role
