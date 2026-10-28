"""RMFOOD 数据脱敏中间件（同步模块增强）

提供敏感数据的自动脱敏功能，用于：
- 同步日志中的payload内容
- 设备ID遮盖
- 冲突详情中的敏感数据
- API响应日志过滤
"""
import json
import logging
from typing import Any, Dict, List, Optional, Set

logger = logging.getLogger(__name__)


class DataMaskingRule:
    """脱敏规则定义"""

    def __init__(
        self,
        field_pattern: str,
        mask_func: callable,
        description: str = "",
    ):
        self.field_pattern = field_pattern.lower()
        self.mask_func = mask_func
        self.description = description

    def matches(self, field_name: str) -> bool:
        return self.field_pattern in field_name.lower()


class DataMasker:
    """
    数据脱敏器
    
    功能：
    - 字段级脱敏（基于规则匹配）
    - 支持多种脱敏策略（遮盖、截断、哈希等）
    - 递归处理嵌套结构（dict/list）
    - 可配置的保留策略
    
    脱敏规则：
    1. payload内容：显示前100字符 + "..."
    2. device_id：部分遮盖 abc12******xy
    3. 敏感字段（password/token等）：完全隐藏
    4. 冲突详情：脱敏local_data和server_data
    """

    DEFAULT_MASK = "******"

    SENSITIVE_FIELDS: Set[str] = {
        "password", "secret", "token", "api_key", "private_key",
        "access_token", "refresh_token", "auth_code", "credential",
        "ssn", "credit_card", "bank_account", "cvv",
    }

    SYNC_SPECIFIC_RULES = [
        DataMaskingRule(
            field_pattern="payload",
            mask_func=lambda v, **kw: _truncate_data(v, max_length=100),
            description="截断payload为前100字符",
        ),
        DataMaskingRule(
            field_pattern="device_id",
            mask_func=lambda v, **kw: _mask_device_id(str(v)),
            description="设备ID部分遮盖",
        ),
        DataMaskingRule(
            field_pattern="local_data",
            mask_func=lambda v, **kw: _mask_sensitive_fields(v),
            description="本地数据敏感字段脱敏",
        ),
        DataMaskingRule(
            field_pattern="server_data",
            mask_func=lambda v, **kw: _mask_sensitive_fields(v),
            description="服务器数据敏感字段脱敏",
        ),
    ]

    def __init__(
        self,
        custom_rules: Optional[List[DataMaskingRule]] = None,
        enabled: bool = True,
        debug_mode: bool = False,
    ):
        """
        初始化数据脱敏器
        
        Args:
            custom_rules: 自定义脱敏规则列表
            enabled: 是否启用脱敏
            debug_mode: 调试模式（禁用脱敏）
        """
        self.enabled = enabled and not debug_mode
        self.rules = list(self.SYNC_SPECIFIC_RULES)

        if custom_rules:
            self.rules.extend(custom_rules)

    def mask(
        self,
        data: Any,
        context: Optional[Dict[str, Any]] = None,
    ) -> Any:
        """
        对数据进行脱敏处理
        
        Args:
            data: 原始数据（支持dict/list/str等类型）
            context: 上下文信息（如用户角色、请求路径等）
            
        Returns:
            脱敏后的数据
        """
        if not self.enabled or data is None:
            return data

        if isinstance(data, dict):
            return self._mask_dict(data, context)
        elif isinstance(data, list):
            return [self.mask(item, context) for item in data]
        elif isinstance(data, str):
            return self._mask_string(data)
        else:
            return data

    def _mask_dict(
        self,
        data: Dict[str, Any],
        context: Optional[Dict[str, Any]],
    ) -> Dict[str, Any]:
        """递归处理字典"""
        result = {}

        for key, value in data.items():
            key_lower = key.lower()

            if key_lower in self.SENSITIVE_FIELDS:
                result[key] = self.DEFAULT_MASK
                continue

            matched_rule = None
            for rule in self.rules:
                if rule.matches(key):
                    matched_rule = rule
                    break

            if matched_rule:
                try:
                    result[key] = matched_rule.mask_func(value, context=context)
                except Exception as mask_err:
                    logger.debug("掩码规则应用失败，使用原始值: %s", mask_err)
                    result[key] = value
            elif isinstance(value, (dict, list)):
                result[key] = self.mask(value, context)
            else:
                result[key] = value

        return result

    def _mask_string(self, value: str) -> str:
        """处理字符串值"""
        if len(value) <= 8:
            return self.DEFAULT_MASK

        return value[:3] + self.DEFAULT_MASK + value[-2:]

    def add_rule(self, rule: DataMaskingRule):
        """添加自定义脱敏规则"""
        self.rules.append(rule)

    def remove_rule(self, field_pattern: str):
        """移除指定字段的脱敏规则"""
        self.rules = [
            r for r in self.rules
            if r.field_pattern != field_pattern.lower()
        ]

    def get_masked_keys(self, data: Dict[str, Any]) -> List[str]:
        """获取将被脱敏的字段名列表"""
        masked = []

        for key in data.keys():
            if key.lower() in self.SENSITIVE_FIELDS:
                masked.append(key)
                continue

            for rule in self.rules:
                if rule.matches(key):
                    masked.append(key)
                    break

        return masked


def _truncate_data(
    data: Any,
    max_length: int = 100,
) -> Any:
    """截断数据显示前N个字符"""
    if data is None:
        return None

    if isinstance(data, (dict, list)):
        data_str = json.dumps(data, ensure_ascii=False)
        if len(data_str) > max_length:
            return data_str[:max_length] + f"... (truncated, total {len(data_str)} chars)"
        return data

    if isinstance(data, str):
        if len(data) > max_length:
            return data[:max_length] + "..."
        return data

    return data


def _mask_device_id(device_id: str) -> str:
    """部分遮盖设备ID"""
    if not device_id or len(device_id) < 6:
        return "****"

    visible_start = min(4, len(device_id) // 3)
    visible_end = min(2, len(device_id) // 4)

    return (
        device_id[:visible_start]
        + "******"
        + device_id[-visible_end:] if visible_end > 0 else ""
    )


def _mask_sensitive_fields(data: Any) -> Any:
    """递归脱敏字典中的敏感字段"""
    if not isinstance(data, dict):
        return data

    result = {}
    sensitive = DataMasker.SENSITIVE_FIELDS

    for key, value in data.items():
        if key.lower() in sensitive:
            result[key] = DataMasker.DEFAULT_MASK
        elif isinstance(value, dict):
            result[key] = _mask_sensitive_fields(value)
        elif isinstance(value, list):
            result[key] = [
                _mask_sensitive_fields(item) if isinstance(item, dict) else item
                for item in value
            ]
        else:
            result[key] = value

    return result


def mask_sync_log_payload(log_entry: Dict[str, Any]) -> Dict[str, Any]:
    """
    专用函数：脱敏同步日志条目
    
    Args:
        log_entry: 同步日志字典
        
    Returns:
        脱敏后的日志条目
    """
    masker = DataMasker()
    return masker.mask(log_entry, {"context": "sync_log"})


def mask_device_info_for_logging(device: Dict[str, Any]) -> Dict[str, Any]:
    """
    专用函数：脱敏设备信息用于日志输出
    
    保留必要信息但隐藏完整标识符。
    """
    if not isinstance(device, dict):
        return {"masked": True}

    return {
        "id": device.get("id"),
        "device_type": device.get("device_type"),
        "device_name": device.get("device_name"),
        "device_id": _mask_device_id(device.get("device_id", "")),
        "last_sync_at": device.get("last_sync_at"),
        "is_active": device.get("is_active"),
    }


def mask_conflict_for_display(conflict: Dict[str, Any]) -> Dict[str, Any]:
    """
    专用函数：脱敏冲突信息用于前端显示
    
    保留冲突元数据，脱敏具体数据内容。
    """
    if not isinstance(conflict, dict):
        return conflict

    return {
        "id": conflict.get("id"),
        "entity_type": conflict.get("entity_type"),
        "entity_id": conflict.get("entity_id"),
        "conflict_type": conflict.get("conflict_type"),
        "conflicting_fields": conflict.get("conflicting_fields", []),
        "recommended_strategy": conflict.get("recommended_strategy"),
        "detected_at": conflict.get("detected_at"),
        "local_data_preview": _truncate_data(conflict.get("local_data"), max_length=200),
        "server_data_preview": _truncate_data(conflict.get("server_data"), max_length=200),
    }


class SyncDataMaskingMiddleware:
    """
    FastAPI中间件：自动对同步API响应进行数据脱敏
    
    使用方式：
        app.add_middleware(SyncDataMaskingMiddleware)
    """

    def __init__(self, app):
        self.app = app
        self._masker = DataMasker()

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        path = scope.get("path", "")

        if "/sync" not in path and "/api" not in path:
            await self.app(scope, receive, send)
            return

        async def send_wrapper(message):
            if message["type"] == "http.response.body":
                try:
                    body = message.get("body", b"")

                    if body:
                        import json as _json

                        try:
                            data = _json.loads(body.decode())

                            if isinstance(data, dict):
                                masked = self._masker.mask(data)
                                new_body = _json.dumps(masked).encode()
                                message = {
                                    **message,
                                    "body": new_body,
                                    "headers": message.get("headers", []) + [
                                        (b"x-data-masked", b"true")
                                    ],
                                }
                        except (_json.JSONDecodeError, UnicodeDecodeError):
                            pass
                except Exception as resp_err:
                    logger.debug("响应掩码处理失败: %s", resp_err)

            await send(message)

        await self.app(scope, receive, send_wrapper)
