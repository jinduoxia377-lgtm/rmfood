"""
🔒 P5-3: API 版本兼容性框架与灰度发布

提供:
1. **API 版本协商** - 客户端/服务端版本协商
2. **请求/响应转换** - 跨版本的字段映射
3. **弃用管理** - 弃用警告 + 迁移指南
4. **灰度发布** - 百分比/用户群/地区灰度
5. **特性开关** - Feature Flags 动态控制

使用方式:
    from app.core.api_framework.api_versioning import (
        register_version_middleware,
        versioned,
        feature_flag,
        gray_release,
    )

    # 方式 1: 版本化路由
    @versioned("v1", deprecated=True, sunset_date="2026-12-31")
    @app.get("/api/v1/legacy-endpoint")
    async def legacy_endpoint():
        return {"legacy": True}

    # 方式 2: 特性开关
    @feature_flag("new_ai_model", default=False)
    async def use_ai_v2():
        ...

    # 方式 3: 灰度发布
    @gray_release(percentage=10, rollout_config={"new_users": True})
    async def new_feature():
        ...
"""

from __future__ import annotations

import logging
import time
import hashlib
import json
import random
from dataclasses import dataclass, field
from datetime import datetime, timezone, date
from enum import Enum
from functools import wraps
from typing import Any, Callable, Dict, List, Optional, Set, Tuple, TypeVar, Union

from fastapi import FastAPI, Request, Response, HTTPException, status
from fastapi.responses import JSONResponse

logger = logging.getLogger(__name__)

T = TypeVar('T')


# ════════════════════════════════════════════
# 🔒 P5-3: 版本状态枚举
# ════════════════════════════════════════════

class VersionStatus(Enum):
    ACTIVE = "active"
    DEPRECATED = "deprecated"
    SUNSET = "sunset"
    REMOVED = "removed"


class FeatureFlagStrategy(Enum):
    PERCENTAGE = "percentage"    # 百分比
    USER_ID = "user_id"         # 按用户 ID
    USER_GROUP = "user_group"    # 按用户组
    REGION = "region"           # 按地区
    CUSTOM = "custom"            # 自定义


# ════════════════════════════════════════════
# 🔒 P5-3: 版本信息
# ════════════════════════════════════════════

@dataclass
class EndpointVersion:
    """API 端点版本信息"""
    path: str
    method: str
    version: str
    status: VersionStatus = VersionStatus.ACTIVE
    deprecated_reason: Optional[str] = None
    sunset_date: Optional[date] = None
    migration_guide: Optional[str] = None
    response_schema_version: Optional[str] = None
    request_schema_version: Optional[str] = None

    @property
    def is_deprecated(self) -> bool:
        return self.status in (VersionStatus.DEPRECATED, VersionStatus.SUNSET)

    @property
    def days_until_sunset(self) -> Optional[int]:
        if not self.sunset_date:
            return None
        delta = self.sunset_date - date.today()
        return delta.days


@dataclass
class FieldMapping:
    """字段映射规则"""
    old_name: str
    new_name: str
    transform: Optional[Callable[[Any], Any]] = None  # 自定义转换函数


# ════════════════════════════════════════════
# 🔒 P5-3: 请求/响应转换器
# ════════════════════════════════════════════

class SchemaTransformer:
    """
    跨版本 Schema 转换器

    自动处理:
    - 字段重命名
    - 字段类型转换
    - 字段新增/删除
    - 嵌套对象转换
    """

    def __init__(self):
        self._request_mappings: Dict[str, List[FieldMapping]] = {}
        self._response_mappings: Dict[str, List[FieldMapping]] = {}

    def register_request_mapping(
        self,
        version: str,
        path: str,
        mappings: List[FieldMapping],
    ) -> None:
        key = f"{version}:{path}"
        self._request_mappings[key] = mappings

    def register_response_mapping(
        self,
        version: str,
        path: str,
        mappings: List[FieldMapping],
    ) -> None:
        key = f"{version}:{path}"
        self._response_mappings[key] = mappings

    def transform_request(
        self,
        version: str,
        path: str,
        data: Dict[str, Any],
    ) -> Dict[str, Any]:
        key = f"{version}:{path}"
        mappings = self._request_mappings.get(key, [])

        if not mappings:
            return data

        result = {}
        for field in mappings:
            if field.new_name in data:
                value = data[field.new_name]
                if field.transform:
                    value = field.transform(value)
                result[field.old_name] = value

        # 保留未映射的字段
        mapped_new_names = {m.new_name for m in mappings}
        for k, v in data.items():
            if k not in mapped_new_names:
                result[k] = v

        return result

    def transform_response(
        self,
        version: str,
        path: str,
        data: Dict[str, Any],
    ) -> Dict[str, Any]:
        key = f"{version}:{path}"
        mappings = self._response_mappings.get(key, [])

        if not mappings:
            return data

        result = {}
        for field in mappings:
            if field.old_name in data:
                value = data[field.old_name]
                if field.transform:
                    value = field.transform(value)
                result[field.new_name] = value

        # 保留未映射的字段
        mapped_old_names = {m.old_name for m in mappings}
        for k, v in data.items():
            if k not in mapped_old_names:
                result[k] = v

        return result


# 全局转换器实例
schema_transformer = SchemaTransformer()


# ════════════════════════════════════════════
# 🔒 P5-3: 弃用管理
# ════════════════════════════════════════════

class DeprecationManager:
    """
    API 弃用管理器

    跟踪所有已弃用的端点：
    - 自动发送 Deprecation 响应头
    - 记录弃用统计
    - 即将 sunset 的端点告警
    """

    def __init__(self):
        self._endpoints: Dict[str, EndpointVersion] = {}
        self._deprecation_counts: Dict[str, int] = {}

    def register_endpoint(self, endpoint: EndpointVersion) -> None:
        key = f"{endpoint.method}:{endpoint.path}:{endpoint.version}"
        self._endpoints[key] = endpoint
        logger.info(
            f"[Deprecation] 注册端点: {endpoint.method} {endpoint.path} v{endpoint.version} "
            f"状态: {endpoint.status.value}"
        )

    def get_endpoint(self, method: str, path: str, version: str) -> Optional[EndpointVersion]:
        key = f"{method}:{path}:{version}"
        return self._endpoints.get(key)

    def is_deprecated(self, method: str, path: str, version: str) -> bool:
        endpoint = self.get_endpoint(method, path, version)
        return endpoint.is_deprecated if endpoint else False

    def record_usage(self, method: str, path: str, version: str) -> None:
        key = f"{method}:{path}:{version}"
        self._deprecation_counts[key] = self._deprecation_counts.get(key, 0) + 1

    def get_deprecated_endpoints(self) -> List[Dict[str, Any]]:
        result = []
        for key, endpoint in self._endpoints.items():
            if endpoint.is_deprecated:
                count = self._deprecation_counts.get(key, 0)
                result.append({
                    "method": endpoint.method,
                    "path": endpoint.path,
                    "version": endpoint.version,
                    "status": endpoint.status.value,
                    "days_until_sunset": endpoint.days_until_sunset,
                    "usage_count": count,
                    "migration_guide": endpoint.migration_guide,
                })
        return sorted(result, key=lambda x: x.get("days_until_sunset") or 999)

    def check_sunset_warnings(self) -> List[str]:
        """检查即将 sunset 的端点"""
        warnings = []
        for endpoint in self._endpoints.values():
            if endpoint.status == VersionStatus.SUNSET:
                days = endpoint.days_until_sunset
                if days is not None and days <= 30:
                    warnings.append(
                        f"⚠️ 端点 {endpoint.method} {endpoint.path} "
                        f"将在 {days} 天后永久移除"
                    )
        return warnings


# 全局弃用管理器
deprecation_manager = DeprecationManager()


# ════════════════════════════════════════════
# 🔒 P5-3: 灰度发布
# ════════════════════════════════════════════

@dataclass
class GrayReleaseConfig:
    """灰度发布配置"""
    name: str
    percentage: float = 0.0  # 0.0 ~ 100.0
    user_ids: Set[str] = field(default_factory=set)
    user_groups: Set[str] = field(default_factory=set)
    regions: Set[str] = field(default_factory=set)
    conditions: Dict[str, Any] = field(default_factory=dict)
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None


class GrayReleaseManager:
    """
    灰度发布管理器

    支持:
    - 百分比灰度
    - 指定用户灰度
    - 用户组灰度
    - 地区灰度
    - 时间窗口灰度
    - 条件表达式灰度
    """

    def __init__(self):
        self._releases: Dict[str, GrayReleaseConfig] = {}

    def register(
        self,
        name: str,
        percentage: float = 0,
        user_ids: Set[str] = None,
        user_groups: Set[str] = None,
        regions: Set[str] = None,
        conditions: Dict[str, Any] = None,
        start_time: datetime = None,
        end_time: datetime = None,
    ) -> None:
        self._releases[name] = GrayReleaseConfig(
            name=name,
            percentage=percentage,
            user_ids=user_ids or set(),
            user_groups=user_groups or set(),
            regions=regions or set(),
            conditions=conditions or {},
            start_time=start_time,
            end_time=end_time,
        )
        logger.info(
            f"[GrayRelease] 注册: {name}, percentage={percentage}%, "
            f"users={len(user_ids or [])}, groups={len(user_groups or [])}"
        )

    def is_enabled(
        self,
        name: str,
        user_id: Optional[str] = None,
        user_groups: Optional[Set[str]] = None,
        region: Optional[str] = None,
        custom_conditions: Optional[Dict[str, Any]] = None,
    ) -> bool:
        """
        判断灰度是否启用

        Args:
            name: 灰度发布名称
            user_id: 当前用户 ID
            user_groups: 当前用户所属组
            region: 当前用户地区
            custom_conditions: 自定义条件

        Returns:
            True 表示该请求命中灰度，启用新功能
        """
        config = self._releases.get(name)
        if not config:
            return False

        # 时间窗口检查
        now = datetime.now(timezone.utc)
        if config.start_time and now < config.start_time:
            return False
        if config.end_time and now > config.end_time:
            return False

        # 1. 强制指定用户
        if user_id and user_id in config.user_ids:
            return True

        # 2. 用户组检查
        if user_groups and config.user_groups:
            if user_groups & config.user_groups:
                return True

        # 3. 地区检查
        if region and region in config.regions:
            return True

        # 4. 自定义条件检查
        if custom_conditions and config.conditions:
            if self._evaluate_conditions(custom_conditions, config.conditions):
                return True

        # 5. 百分比灰度
        if config.percentage > 0:
            # 基于用户 ID 的确定性哈希（保证同一用户始终命中）
            if user_id:
                hash_input = f"{name}:{user_id}"
            else:
                hash_input = f"{name}:{random.random()}"

            hash_value = int(hashlib.md5(hash_input.encode()).hexdigest(), 16)
            bucket = (hash_value % 10000) / 100  # 0.00 ~ 99.99
            if bucket < config.percentage:
                return True

        return False

    def _evaluate_conditions(
        self,
        actual: Dict[str, Any],
        expected: Dict[str, Any],
    ) -> bool:
        """评估条件表达式"""
        for key, expected_value in expected.items():
            if key not in actual:
                return False
            actual_value = actual[key]

            if isinstance(expected_value, dict):
                # 支持比较操作符
                for op, value in expected_value.items():
                    if op == "$eq" and actual_value != value:
                        return False
                    elif op == "$ne" and actual_value == value:
                        return False
                    elif op == "$gt" and not (actual_value > value):
                        return False
                    elif op == "$gte" and not (actual_value >= value):
                        return False
                    elif op == "$lt" and not (actual_value < value):
                        return False
                    elif op == "$lte" and not (actual_value <= value):
                        return False
                    elif op == "$in" and actual_value not in value:
                        return False
                    elif op == "$contains" and value not in str(actual_value):
                        return False
            elif actual_value != expected_value:
                return False

        return True

    def get_config(self, name: str) -> Optional[GrayReleaseConfig]:
        return self._releases.get(name)

    def get_all_releases(self) -> List[Dict[str, Any]]:
        return [
            {
                "name": r.name,
                "percentage": r.percentage,
                "user_count": len(r.user_ids),
                "group_count": len(r.user_groups),
                "region_count": len(r.regions),
                "start_time": r.start_time.isoformat() if r.start_time else None,
                "end_time": r.end_time.isoformat() if r.end_time else None,
            }
            for r in self._releases.values()
        ]

    def get_release_stats(self, name: str) -> Dict[str, Any]:
        """获取灰度发布统计（需要配合 metrics 使用）"""
        return {
            "name": name,
            "enabled": name in self._releases,
            "config": self.get_config(name).__dict__ if name in self._releases else None,
        }


# 全局灰度管理器
gray_release_manager = GrayReleaseManager()


# ════════════════════════════════════════════
# 🔒 P5-3: 特性开关 (Feature Flags)
# ════════════════════════════════════════════

class FeatureFlagManager:
    """
    特性开关管理器

    支持:
    - 特性启用/禁用
    - 百分比灰度
    - 用户白名单
    - 特性依赖检查
    - 实时切换
    """

    def __init__(self, gray_manager: GrayReleaseManager = None):
        self._flags: Dict[str, bool] = {}
        self._gray_manager = gray_manager or gray_release_manager

    def set(self, name: str, enabled: bool) -> None:
        """设置特性开关状态"""
        self._flags[name] = enabled
        logger.info(f"[FeatureFlag] {'启用' if enabled else '禁用'}: {name}")

    def get(self, name: str) -> bool:
        """获取特性开关状态"""
        return self._flags.get(name, False)

    def is_enabled(
        self,
        name: str,
        user_id: Optional[str] = None,
        user_groups: Optional[Set[str]] = None,
    ) -> bool:
        """
        判断特性是否启用

        支持基于灰度发布配置的复杂判断
        """
        # 先检查基础开关
        if not self._flags.get(name, True):
            return False

        # 检查灰度发布配置
        return self._gray_manager.is_enabled(
            name=f"feature:{name}",
            user_id=user_id,
            user_groups=user_groups,
        )

    def check_dependencies(self, feature_name: str) -> Tuple[bool, List[str]]:
        """
        检查特性依赖

        Returns:
            (是否满足, 缺失的依赖列表)
        """
        # 从配置中读取依赖关系
        dependencies = self._get_feature_dependencies(feature_name)
        missing = [dep for dep in dependencies if not self.is_enabled(dep)]

        return len(missing) == 0, missing

    def _get_feature_dependencies(self, feature_name: str) -> List[str]:
        """获取特性依赖（从配置中读取）"""
        # 可以扩展为从配置文件/数据库读取
        return []


# 全局特性开关管理器
feature_flag_manager = FeatureFlagManager()


# ════════════════════════════════════════════
# 🔒 P5-3: 装饰器
# ════════════════════════════════════════════

def versioned(
    version: str,
    status: VersionStatus = VersionStatus.ACTIVE,
    deprecated_reason: Optional[str] = None,
    sunset_date: Optional[str] = None,
    migration_guide: Optional[str] = None,
):
    """
    版本化装饰器

    用法:
        @versioned("v1", status=VersionStatus.DEPRECATED, sunset_date="2026-12-31")
        @app.get("/api/v1/legacy")
        async def legacy_endpoint():
            ...
    """
    def decorator(func: Callable) -> Callable:
        # 注册到弃用管理器
        if status != VersionStatus.ACTIVE:
            endpoint = EndpointVersion(
                path=func.__dict__.get("path", ""),
                method=func.__dict__.get("methods", ["GET"])[0],
                version=version,
                status=status,
                deprecated_reason=deprecated_reason,
                sunset_date=datetime.strptime(sunset_date, "%Y-%m-%d").date() if sunset_date else None,
                migration_guide=migration_guide,
            )
            deprecation_manager.register_endpoint(endpoint)

        @wraps(func)
        async def wrapper(*args, **kwargs):
            result = await func(*args, **kwargs)

            # 添加 Deprecation 响应头
            if status != VersionStatus.ACTIVE:
                # 实际应用中通过中间件添加
                pass

            return result

        return wrapper
    return decorator


def feature_flag(
    name: str,
    default: bool = False,
):
    """
    特性开关装饰器

    用法:
        @feature_flag("new_ai_model", default=False)
        async def generate_with_v2():
            ...
    """
    def decorator(func: Callable) -> Callable:
        feature_flag_manager.set(name, default)

        @wraps(func)
        async def wrapper(*args, **kwargs):
            # 获取请求上下文中的用户信息
            user_id = kwargs.get("user_id") or "anonymous"
            user_groups = kwargs.get("user_groups", set())

            if not feature_flag_manager.is_enabled(name, user_id, user_groups):
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"功能 '{name}' 未对该用户启用",
                )

            return await func(*args, **kwargs)

        return wrapper
    return decorator


def gray_release(
    name: str,
    percentage: float = 0,
    user_ids: Set[str] = None,
    user_groups: Set[str] = None,
    regions: Set[str] = None,
    start_time: datetime = None,
    end_time: datetime = None,
):
    """
    灰度发布装饰器

    用法:
        @gray_release(name="ai_v2", percentage=10)
        async def new_ai_feature():
            ...
    """
    # 注册灰度发布配置
    gray_release_manager.register(
        name=name,
        percentage=percentage,
        user_ids=user_ids,
        user_groups=user_groups,
        regions=regions,
        start_time=start_time,
        end_time=end_time,
    )

    def decorator(func: Callable) -> Callable:
        @wraps(func)
        async def wrapper(*args, **kwargs):
            user_id = kwargs.get("user_id")
            user_groups = kwargs.get("user_groups")
            region = kwargs.get("region")

            if not gray_release_manager.is_enabled(
                name,
                user_id=user_id,
                user_groups=user_groups,
                region=region,
            ):
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"功能 '{name}' 对该用户不可用",
                )

            return await func(*args, **kwargs)

        return wrapper
    return decorator


# ════════════════════════════════════════════
# 🔒 P5-3: 版本协商中间件
# ════════════════════════════════════════════

class VersionNegotiationMiddleware:
    """
    版本协商中间件

    支持:
    - Accept-Version 请求头
    - X-API-Version 响应头
    - 版本不匹配警告
    """

    def __init__(self, app: FastAPI, current_version: str = "1.0.0"):
        self.app = app
        self.current_version = current_version

    async def __call__(self, request: Request, call_next):
        # 获取客户端期望的版本
        client_version = request.headers.get("Accept-Version")
        request.state.api_version = client_version or self.current_version

        response = await call_next(request)

        # 添加版本响应头
        response.headers["X-API-Version"] = self.current_version
        response.headers["X-API-Min-Version"] = "1.0.0"

        # 检查弃用状态
        path = request.url.path
        method = request.method
        version = request.state.api_version

        endpoint = deprecation_manager.get_endpoint(method, path, version)
        if endpoint and endpoint.is_deprecated:
            response.headers["Deprecation"] = "true"
            response.headers["Sunset"] = endpoint.sunset_date.isoformat() if endpoint.sunset_date else ""
            if endpoint.deprecated_reason:
                response.headers["Link"] = f'<{endpoint.migration_guide}>; rel="deprecation"'

        return response


# ════════════════════════════════════════════
# 🔒 P5-3: 注册函数
# ════════════════════════════════════════════

def register_versioning(app: FastAPI, current_version: str = "1.0.0") -> None:
    """
    注册 API 版本管理中间件
    """
    app.add_middleware(
        VersionNegotiationMiddleware,
        current_version=current_version,
    )

    # 注册版本管理端点
    @app.get("/api/v1/admin/versions", tags=["系统管理"], summary="已弃用端点列表")
    async def get_deprecated_endpoints():
        return {
            "deprecated": deprecation_manager.get_deprecated_endpoints(),
            "warnings": deprecation_manager.check_sunset_warnings(),
        }

    @app.get("/api/v1/admin/gray-releases", tags=["系统管理"], summary="灰度发布状态")
    async def get_gray_releases():
        return {
            "releases": gray_release_manager.get_all_releases(),
        }

    @app.get("/api/v1/admin/feature-flags", tags=["系统管理"], summary="特性开关状态")
    async def get_feature_flags():
        return {
            "flags": feature_flag_manager._flags,
        }

    # 特性开关管理端点
    @app.post("/api/v1/admin/feature-flags/{name}", tags=["系统管理"], summary="设置特性开关")
    async def set_feature_flag(name: str, enabled: bool):
        feature_flag_manager.set(name, enabled)
        return {"name": name, "enabled": enabled}

    # 灰度发布管理端点
    @app.post("/api/v1/admin/gray-releases/{name}", tags=["系统管理"], summary="更新灰度发布")
    async def update_gray_release(
        name: str,
        percentage: float = 0,
        enabled: bool = True,
    ):
        if enabled:
            gray_release_manager.register(name, percentage=percentage)
        return {"name": name, "percentage": percentage if enabled else 0}

    logger.info(f"[APIVersioning] 版本管理已启用，当前版本: {current_version}")


__all__ = [
    "VersionStatus",
    "EndpointVersion",
    "FieldMapping",
    "SchemaTransformer",
    "schema_transformer",
    "DeprecationManager",
    "deprecation_manager",
    "GrayReleaseConfig",
    "GrayReleaseManager",
    "gray_release_manager",
    "FeatureFlagManager",
    "feature_flag_manager",
    "VersionNegotiationMiddleware",
    "register_versioning",
    "versioned",
    "feature_flag",
    "gray_release",
]
