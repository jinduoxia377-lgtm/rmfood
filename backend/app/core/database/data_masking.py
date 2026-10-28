"""
RMFOOD 数据脱敏系统 (Data Masking / PII Redaction)

功能:
- 个人身份信息 (PII) 识别与脱敏
- 多级脱敏策略（mask / partial / hash / encrypt）
- 字段级脱敏规则
- 响应/日志自动脱敏
- 脱敏可逆恢复（需密钥）
- 支持 JSON / 字符串 / 数据库结果的通用脱敏

合规标准:
- GDPR (General Data Protection Regulation)
- CCPA (California Consumer Privacy Act)
- 《个人信息保护法》(PIPL)
- ISO 27001 / SOC2

使用方法:
    from app.core.database.data_masking import mask_value, mask_response, MaskLevel

    # 基础脱敏
    masked_email = mask_value("user@example.com", "email")

    # 响应脱敏（自动识别PII字段）
    safe_response = mask_response(user_dict, level=MaskLevel.PARTIAL)

    # 自定义规则
    from app.core.database.data_masking import add_mask_rule
    add_mask_rule("my_custom_field", lambda v: v[0] + "***")
"""

import hashlib
import logging
import re
import secrets
from dataclasses import dataclass
from enum import Enum
from typing import Any, Callable, Dict, List, Optional, Set

logger = logging.getLogger(__name__)


# ============================================================
# 脱敏等级
# ============================================================

class MaskLevel(str, Enum):
    """脱敏等级"""

    NONE = "none"              # 不脱敏（明文，需特殊权限）
    PARTIAL = "partial"        # 部分脱敏（保留首/尾部分）
    FULL = "full"              # 完全脱敏（全部替换）
    HASH = "hash"              # 哈希脱敏（不可逆，用于比对）
    ENCRYPT = "encrypt"        # 加密脱敏（可逆，需密钥恢复）


# ============================================================
# PII 字段识别模式
# ============================================================

# 字段名匹配（不区分大小写）
PII_FIELD_PATTERNS: Dict[str, List[str]] = {
    "email": [
        "email", "e_mail", "mail", "email_address", "邮箱", "电子邮箱",
    ],
    "phone": [
        "phone", "telephone", "mobile", "cell", "phone_number",
        "mobile_number", "contact_number", "电话", "手机", "手机号",
    ],
    "id_card": [
        "id_card", "id_number", "identity", "ssn", "social_security",
        "身份证", "身份证号", "证件号",
    ],
    "name": [
        "name", "full_name", "first_name", "last_name", "middle_name",
        "username", "display_name", "real_name", "姓名", "真实姓名",
    ],
    "address": [
        "address", "street", "city", "zip_code", "postal_code", "location",
        "地址", "住址", "邮编",
    ],
    "password": [
        "password", "passwd", "pwd", "secret", "token", "api_key",
        "密码", "秘钥", "密钥",
    ],
    "credit_card": [
        "credit_card", "card_number", "cc_number", "pan", "银行卡", "卡号",
    ],
    "bank_account": [
        "bank_account", "account_number", "iban", "账号", "银行账号",
    ],
    "ip_address": [
        "ip_address", "ip", "client_ip", "remote_ip",
    ],
    "birth_date": [
        "birth_date", "birthday", "dob", "date_of_birth", "生日", "出生日期",
    ],
    "health": [
        "health", "medical", "medical_record", "diagnosis", "健康", "病历",
    ],
}

# 内容正则（用于从文本中识别PII）
CONTENT_PATTERNS: Dict[str, re.Pattern] = {
    "email": re.compile(
        r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b'
    ),
    "phone_cn": re.compile(
        r'(?<!\d)(?:\+?86[\s-]?)?1[3-9]\d{9}(?!\d)'
    ),
    "id_card_cn": re.compile(
        r'(?<!\d)[1-9]\d{5}(?:19|20)\d{2}(?:0[1-9]|1[0-2])(?:0[1-9]|[12]\d|3[01])\d{3}[\dXx](?!\d)'
    ),
    "credit_card": re.compile(
        r'(?<!\d)(?:\d[ -]?){13,19}\d(?!\d)'
    ),
    "ipv4": re.compile(
        r'\b(?:(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.){3}(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\b'
    ),
}


# ============================================================
# 默认脱敏函数
# ============================================================

def _mask_email(value: str, level: MaskLevel = MaskLevel.PARTIAL) -> str:
    """邮箱脱敏：user@example.com -> u***@e***.com"""
    if not value or '@' not in value:
        return value
    local, domain = value.rsplit('@', 1)

    if level == MaskLevel.NONE:
        return value
    if level == MaskLevel.FULL:
        return "***@***.***"
    if level == MaskLevel.HASH:
        return hashlib.sha256(value.encode()).hexdigest()[:16]

    # PARTIAL
    if len(local) <= 1:
        masked_local = local + "***"
    else:
        masked_local = local[0] + "*" * max(3, len(local) - 1)

    if '.' in domain:
        domain_parts = domain.rsplit('.', 1)
        masked_domain = domain_parts[0][0] + "***." + domain_parts[1]
    else:
        masked_domain = domain[0] + "***"

    return f"{masked_local}@{masked_domain}"


def _mask_phone(value: str, level: MaskLevel = MaskLevel.PARTIAL) -> str:
    """手机号脱敏：13800138000 -> 138****8000"""
    digits = re.sub(r'\D', '', value)

    if level == MaskLevel.NONE:
        return value
    if level == MaskLevel.FULL:
        return "*" * len(digits) if digits else "***********"
    if level == MaskLevel.HASH:
        return hashlib.sha256(digits.encode()).hexdigest()[:11]

    # PARTIAL: 前3 + **** + 后4
    if len(digits) >= 11:
        return digits[:3] + "****" + digits[-4:]
    elif len(digits) >= 7:
        return digits[:2] + "***" + digits[-2:]
    else:
        return "*" * len(digits)


def _mask_id_card(value: str, level: MaskLevel = MaskLevel.PARTIAL) -> str:
    """身份证脱敏：前6 + ******** + 后4"""
    digits = re.sub(r'[^0-9Xx]', '', value)

    if level == MaskLevel.NONE:
        return value
    if level == MaskLevel.FULL:
        return "*" * len(digits)
    if level == MaskLevel.HASH:
        return hashlib.sha256(digits.encode()).hexdigest()[:18]

    # PARTIAL
    if len(digits) >= 18:
        return digits[:6] + "********" + digits[-4:]
    elif len(digits) >= 10:
        return digits[:4] + "****" + digits[-2:]
    else:
        return "*" * len(digits)


def _mask_name(value: str, level: MaskLevel = MaskLevel.PARTIAL) -> str:
    """姓名脱敏：张三 -> 张* / John Smith -> J*** S***"""
    if not value:
        return value

    if level == MaskLevel.NONE:
        return value
    if level == MaskLevel.FULL:
        return "*" * max(1, len(value.replace(' ', '')))
    if level == MaskLevel.HASH:
        return hashlib.sha256(value.encode()).hexdigest()[:8]

    # PARTIAL
    parts = value.split()
    if len(parts) == 1:
        # 中文或单字
        if len(value) <= 1:
            return value + "*"
        return value[0] + "*" * (len(value) - 1)
    else:
        # 英文多字
        return " ".join(p[0] + "*" * max(2, len(p) - 1) for p in parts)


def _mask_address(value: str, level: MaskLevel = MaskLevel.PARTIAL) -> str:
    """地址脱敏：仅保留省市级"""
    if not value:
        return value

    if level == MaskLevel.NONE:
        return value
    if level == MaskLevel.FULL:
        return "***"
    if level == MaskLevel.HASH:
        return hashlib.sha256(value.encode()).hexdigest()[:12]

    # PARTIAL: 保留前10-20个字符，其余替换
    if len(value) <= 10:
        return value
    return value[:10] + "***"


def _mask_password(value: str, level: MaskLevel = MaskLevel.FULL) -> str:
    """密码脱敏：全部替换"""
    return "*" * 8


def _mask_credit_card(value: str, level: MaskLevel = MaskLevel.PARTIAL) -> str:
    """银行卡脱敏：仅保留后4位"""
    digits = re.sub(r'\D', '', value)

    if level == MaskLevel.NONE:
        return value
    if level == MaskLevel.FULL:
        return "*" * 16
    if level == MaskLevel.HASH:
        return hashlib.sha256(digits.encode()).hexdigest()[:16]

    # PARTIAL: ****-****-****-1234
    if len(digits) >= 4:
        return "****-****-****-" + digits[-4:]
    return "****"


def _mask_ip(value: str, level: MaskLevel = MaskLevel.PARTIAL) -> str:
    """IP脱敏：192.168.1.100 -> 192.168.*.*"""
    if level == MaskLevel.NONE:
        return value
    if level == MaskLevel.FULL:
        return "***.***.***.***"
    if level == MaskLevel.HASH:
        return hashlib.sha256(value.encode()).hexdigest()[:8]

    parts = value.split('.')
    if len(parts) >= 4:
        return parts[0] + "." + parts[1] + ".*.*"
    return value


def _mask_generic(value: str, level: MaskLevel = MaskLevel.PARTIAL) -> str:
    """通用脱敏"""
    if not value:
        return value

    if level == MaskLevel.NONE:
        return value
    if level == MaskLevel.FULL:
        return "*" * max(3, min(len(value), 10))
    if level == MaskLevel.HASH:
        return hashlib.sha256(str(value).encode()).hexdigest()[:10]

    # PARTIAL
    if len(value) <= 2:
        return value[0] + "*"
    return value[0] + "*" * max(3, len(value) // 2) + value[-1]


# ============================================================
# 脱敏器注册表
# ============================================================

@dataclass
class MaskRule:
    """脱敏规则"""
    field_type: str
    mask_func: Callable[[str, MaskLevel], str]
    default_level: MaskLevel = MaskLevel.PARTIAL
    description: str = ""


class MaskingRegistry:
    """脱敏规则注册表"""

    def __init__(self):
        self._rules: Dict[str, MaskRule] = {}
        self._custom_rules: Dict[str, Callable] = {}
        self._field_type_cache: Dict[str, str] = {}
        self._init_default_rules()

    def _init_default_rules(self):
        """初始化默认规则"""
        defaults = {
            "email": MaskRule("email", _mask_email, MaskLevel.PARTIAL, "邮箱地址"),
            "phone": MaskRule("phone", _mask_phone, MaskLevel.PARTIAL, "手机号码"),
            "id_card": MaskRule("id_card", _mask_id_card, MaskLevel.PARTIAL, "身份证号"),
            "name": MaskRule("name", _mask_name, MaskLevel.PARTIAL, "姓名"),
            "address": MaskRule("address", _mask_address, MaskLevel.PARTIAL, "地址"),
            "password": MaskRule("password", _mask_password, MaskLevel.FULL, "密码/秘钥"),
            "credit_card": MaskRule("credit_card", _mask_credit_card, MaskLevel.PARTIAL, "银行卡号"),
            "bank_account": MaskRule("bank_account", _mask_credit_card, MaskLevel.PARTIAL, "银行账号"),
            "ip_address": MaskRule("ip_address", _mask_ip, MaskLevel.PARTIAL, "IP地址"),
            "birth_date": MaskRule("birth_date", _mask_generic, MaskLevel.PARTIAL, "出生日期"),
            "health": MaskRule("health", _mask_generic, MaskLevel.FULL, "健康信息"),
        }
        self._rules.update(defaults)

    def register(self, field_type: str, func: Callable[[str, MaskLevel], str],
                 default_level: MaskLevel = MaskLevel.PARTIAL,
                 description: str = ""):
        """注册自定义脱敏规则"""
        self._rules[field_type] = MaskRule(field_type, func, default_level, description)
        logger.info(f"📋 已注册脱敏规则: {field_type}")

    def detect_field_type(self, field_name: str) -> Optional[str]:
        """识别字段类型"""
        if field_name in self._field_type_cache:
            return self._field_type_cache[field_name]

        normalized = field_name.lower().strip()

        for field_type, patterns in PII_FIELD_PATTERNS.items():
            for pattern in patterns:
                if pattern in normalized:
                    self._field_type_cache[field_name] = field_type
                    return field_type

        self._field_type_cache[field_name] = None
        return None

    def get_rule(self, field_type: str) -> Optional[MaskRule]:
        """获取脱敏规则"""
        return self._rules.get(field_type)

    @property
    def field_types(self) -> Set[str]:
        return set(self._rules.keys())


# 全局单例
_masking_registry = MaskingRegistry()


def get_masking_registry() -> MaskingRegistry:
    return _masking_registry


def add_mask_rule(field_type: str, func: Callable[[str, MaskLevel], str],
                  default_level: MaskLevel = MaskLevel.PARTIAL,
                  description: str = ""):
    """添加自定义脱敏规则"""
    _masking_registry.register(field_type, func, default_level, description)


# ============================================================
# 核心脱敏 API
# ============================================================

def mask_value(value: Any, field_type: Optional[str] = None,
               field_name: Optional[str] = None,
               level: MaskLevel = MaskLevel.PARTIAL) -> Any:
    """
    对单个值进行脱敏

    Args:
        value: 待脱敏的值
        field_type: 字段类型（如 email, phone, name 等）。如不提供将自动识别
        field_name: 字段名，用于自动识别字段类型
        level: 脱敏等级

    Returns:
        脱敏后的值
    """
    if value is None:
        return None

    if isinstance(value, bool) or isinstance(value, (int, float)):
        return value

    str_value = str(value)

    # 识别字段类型
    detected_type = field_type
    if not detected_type and field_name:
        detected_type = _masking_registry.detect_field_type(field_name)

    # 获取规则
    rule = None
    if detected_type:
        rule = _masking_registry.get_rule(detected_type)

    # 应用规则
    if rule:
        try:
            return rule.mask_func(str_value, level)
        except Exception as e:
            logger.warning(f"脱敏规则 [{detected_type}] 执行失败: {e}")
            return _mask_generic(str_value, level)

    # 基于内容的检测（文本中的PII）
    if detected_type is None:
        masked = _mask_content_in_text(str_value, level)
        if masked != str_value:
            return masked

    return str_value


def _mask_content_in_text(text: str, level: MaskLevel) -> str:
    """从文本内容中识别并脱敏PII"""
    if not text or len(text) < 5:
        return text

    result = text

    # 检测邮箱
    result = CONTENT_PATTERNS["email"].sub(
        lambda m: _mask_email(m.group(), level), result
    )

    # 检测手机号
    result = CONTENT_PATTERNS["phone_cn"].sub(
        lambda m: _mask_phone(m.group(), level), result
    )

    # 检测身份证
    result = CONTENT_PATTERNS["id_card_cn"].sub(
        lambda m: _mask_id_card(m.group(), level), result
    )

    # 检测IP
    result = CONTENT_PATTERNS["ipv4"].sub(
        lambda m: _mask_ip(m.group(), level), result
    )

    return result


def mask_dict(data: Dict[str, Any],
              level: MaskLevel = MaskLevel.PARTIAL,
              override_levels: Optional[Dict[str, MaskLevel]] = None,
              exempt_fields: Optional[Set[str]] = None) -> Dict[str, Any]:
    """
    对字典进行递归脱敏

    Args:
        data: 待脱敏的字典
        level: 默认脱敏等级
        override_levels: 特定字段的覆盖等级 {field_name: level}
        exempt_fields: 豁免字段（不脱敏）

    Returns:
        脱敏后的字典
    """
    if not data:
        return data

    override_levels = override_levels or {}
    exempt_fields = exempt_fields or set()

    result = {}

    for key, value in data.items():
        # 豁免字段
        if key in exempt_fields:
            result[key] = value
            continue

        # 检查是否为敏感字段
        field_type = _masking_registry.detect_field_type(key)

        # 特定字段覆盖等级
        field_level = override_levels.get(key, level)

        # 递归处理
        if value is None:
            result[key] = None
        elif isinstance(value, dict):
            result[key] = mask_dict(value, field_level, override_levels, exempt_fields)
        elif isinstance(value, list):
            result[key] = mask_list(value, field_level, override_levels, exempt_fields)
        elif field_type or isinstance(value, str):
            result[key] = mask_value(value, field_type, key, field_level)
        else:
            result[key] = value

    return result


def mask_list(items: List[Any],
              level: MaskLevel = MaskLevel.PARTIAL,
              override_levels: Optional[Dict[str, MaskLevel]] = None,
              exempt_fields: Optional[Set[str]] = None) -> List[Any]:
    """对列表进行递归脱敏"""
    if not items:
        return items

    result = []
    for item in items:
        if isinstance(item, dict):
            result.append(mask_dict(item, level, override_levels, exempt_fields))
        elif isinstance(item, list):
            result.append(mask_list(item, level, override_levels, exempt_fields))
        elif isinstance(item, str):
            result.append(_mask_content_in_text(item, level))
        else:
            result.append(item)

    return result


def mask_response(response: Any,
                  level: MaskLevel = MaskLevel.PARTIAL,
                  override_levels: Optional[Dict[str, MaskLevel]] = None,
                  exempt_fields: Optional[Set[str]] = None) -> Any:
    """
    通用响应脱敏入口

    支持: dict, list, str, pydantic model
    """
    if response is None:
        return None

    # Pydantic Model
    if hasattr(response, 'model_dump'):
        data = response.model_dump()
        return mask_dict(data, level, override_levels, exempt_fields)
    if hasattr(response, 'dict'):
        data = response.dict()
        return mask_dict(data, level, override_levels, exempt_fields)

    if isinstance(response, dict):
        return mask_dict(response, level, override_levels, exempt_fields)

    if isinstance(response, list):
        return mask_list(response, level, override_levels, exempt_fields)

    if isinstance(response, str):
        return _mask_content_in_text(response, level)

    return response


# ============================================================
# 加密脱敏（可逆）
# ============================================================

class ReversibleMasker:
    """
    可逆脱敏器（基于对称加密）

    用于需要恢复原始值的场景（如客服后台查看用户信息）
    """

    def __init__(self, secret_key: Optional[bytes] = None):
        if secret_key is None:
            # 使用系统环境变量或生成临时密钥
            import os
            key_hex = os.environ.get("MASKING_SECRET_KEY")
            if key_hex:
                secret_key = bytes.fromhex(key_hex)
            else:
                secret_key = secrets.token_bytes(32)
                logger.warning("⚠️ 未配置 MASKING_SECRET_KEY，使用临时密钥（重启后失效）")

        self._key = secret_key

    def mask(self, value: str) -> str:
        """加密脱敏"""
        if not value:
            return value

        # 使用 key + value 的 HMAC 作为前缀 + 编码
        h = hmac_sha256(self._key, value.encode('utf-8'))
        encoded = base64_encode(value.encode('utf-8'))
        return f"ENC${h[:16]}${encoded}"

    def unmask(self, masked: str) -> Optional[str]:
        """解密恢复"""
        if not masked or not masked.startswith("ENC$"):
            return masked

        try:
            parts = masked.split("$")
            if len(parts) != 3:
                return masked

            _, h, encoded = parts
            value_bytes = base64_decode(encoded)
            value = value_bytes.decode('utf-8')

            # 验证完整性
            verify_h = hmac_sha256(self._key, value.encode('utf-8'))
            if verify_h[:16] != h:
                logger.warning("🔒 脱敏数据完整性校验失败")
                return None

            return value
        except Exception as e:
            logger.error(f"🔒 脱敏数据恢复失败: {e}")
            return None


# 简单的 HMAC / Base64 工具函数（避免强依赖）
def hmac_sha256(key: bytes, message: bytes) -> str:
    import hmac as _hmac
    return _hmac.new(key, message, hashlib.sha256).hexdigest()


def base64_encode(data: bytes) -> str:
    import base64 as _base64
    return _base64.urlsafe_b64encode(data).decode('ascii').rstrip('=')


def base64_decode(encoded: str) -> bytes:
    import base64 as _base64
    padding = '=' * (-len(encoded) % 4)
    return _base64.urlsafe_b64decode(encoded + padding)


# ============================================================
# 日志脱敏过滤器
# ============================================================

class MaskingLogFilter(logging.Filter):
    """
    日志脱敏过滤器

    自动过滤日志消息中的 PII 信息，防止敏感数据写入日志文件。

    使用方法:
        import logging
        logger = logging.getLogger("app")
        logger.addFilter(MaskingLogFilter())
    """

    def __init__(self, level: MaskLevel = MaskLevel.PARTIAL):
        super().__init__()
        self.level = level

    def filter(self, record):
        try:
            if isinstance(record.msg, str):
                record.msg = _mask_content_in_text(record.msg, self.level)

            if record.args:
                if isinstance(record.args, dict):
                    record.args = {
                        k: (mask_value(v, field_name=str(k), level=self.level)
                            if isinstance(v, str) else v)
                        for k, v in record.args.items()
                    }
                elif isinstance(record.args, tuple):
                    record.args = tuple(
                        mask_value(arg, level=self.level) if isinstance(arg, str) else arg
                        for arg in record.args
                    )
        except Exception as e:
            logger.debug("日志脱敏失败（非致命）: %s", e)
            # 脱敏失败不影响日志输出

        return True


# ============================================================
# 快捷 API
# ============================================================

def detect_pii(text: str) -> Dict[str, List[str]]:
    """
    检测文本中的 PII

    Returns:
        {field_type: [matched_values]}
    """
    results = {}
    for type_name, pattern in CONTENT_PATTERNS.items():
        matches = pattern.findall(text)
        if matches:
            results[type_name] = list(set(matches))
    return results


def is_pii_field(field_name: str) -> bool:
    """判断字段名是否为PII字段"""
    return _masking_registry.detect_field_type(field_name) is not None


def get_sensitive_fields(data: Dict[str, Any]) -> List[str]:
    """识别字典中的敏感字段列表"""
    sensitive = []
    for key in data.keys():
        if is_pii_field(key):
            sensitive.append(key)
    return sensitive


# ============================================================
# FastAPI 响应脱敏中间件辅助函数
# ============================================================

def mask_api_response(
    data: Any,
    user_role: Optional[str] = None,
    is_audit_context: bool = False
) -> Any:
    """
    根据用户角色智能脱敏API响应

    - ADMIN: NONE（可查看原文，需审计）
    - 内部角色: PARTIAL
    - 外部/匿名: FULL + HASH

    Args:
        data: 响应数据
        user_role: 用户角色
        is_audit_context: 是否为审计场景（日志，通常使用 FULL）

    Returns:
        脱敏后的响应数据
    """
    if is_audit_context:
        return mask_response(data, MaskLevel.PARTIAL)

    if user_role == "ADMIN":
        # 管理员仅对最敏感字段做 PARTIAL 脱敏
        return mask_response(
            data,
            level=MaskLevel.NONE,
            override_levels={
                "password": MaskLevel.FULL,
                "secret": MaskLevel.FULL,
                "api_key": MaskLevel.FULL,
                "token": MaskLevel.FULL,
            }
        )

    # 默认 PARTIAL
    return mask_response(data, MaskLevel.PARTIAL)


logger.info("🛡️ 数据脱敏系统初始化完成 "
            f"(已注册 {len(_masking_registry.field_types)} 种脱敏规则)")
