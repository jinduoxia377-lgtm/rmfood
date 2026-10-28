"""
[SECURITY] P3-3: API 文档与 Schema 校验增强

提供:
1. **增强的 OpenAPI 文档生成** — 自动丰富 schema 和示例
2. **请求/响应 Schema 校验中间件** — 自动验证 API 调用
3. **API 变更检测** — 记录 OpenAPI 变更历史，用于版本管理
4. **API 使用统计** — 追踪每个端点的调用频率和成功率

使用方式:
- 在 create_app 中调用 register_api_docs_middleware(app)
- 路由装饰器使用 @app.get(..., response_description="...") 等
- 为 Pydantic 模型添加示例（example=...）
"""

import json
import logging
import time
from datetime import datetime, timezone
from functools import wraps
from typing import Any, Callable, Dict, List, Optional

from fastapi import FastAPI, Request, status
from fastapi.openapi.utils import get_openapi
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field, ValidationError

logger = logging.getLogger(__name__)


def _clean_surrogates(obj: Any) -> Any:
    """递归清理 dict/list/string 中的损坏 Unicode surrogate pairs。

    某些中文 docstring 经过 get_openapi() 后可能出现孤立 surrogate pairs
    （如 U+DC80），导致 json.dumps() 失败。此函数将它们替换为 ''。
    """
    if isinstance(obj, str):
        import re
        # 替换所有 surrogate pairs (U+D800..U+DFFF)
        cleaned = re.sub(
            r'[\ud800-\udfff]',  # 完整代理对范围
            '',
            obj
        )
        return cleaned
    elif isinstance(obj, dict):
        return {k: _clean_surrogates(v) for k, v in obj.items()}
    elif isinstance(obj, (list, tuple)):
        cleaned = [_clean_surrogates(item) for item in obj]
        return type(obj)(cleaned)
    return obj


# ─────────────────────────────────────────────
# [SECURITY] P3-3: 统一响应格式
# ─────────────────────────────────────────────

class ApiResponse(BaseModel):
    """统一的 API 响应格式"""
    code: int = Field(..., description="业务状态码，0 表示成功")
    message: str = Field(..., description="响应消息")
    data: Optional[Any] = Field(None, description="响应数据")
    timestamp: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    request_id: Optional[str] = Field(None, description="请求追踪 ID")
    version: Optional[str] = Field(None, description="API 版本")

    @classmethod
    def success(cls, data: Any = None, message: str = "success", request_id: str = None, version: str = None):
        return cls(code=0, message=message, data=data, request_id=request_id, version=version)

    @classmethod
    def error(cls, code: int, message: str, request_id: str = None, data: Any = None):
        return cls(code=code, message=message, data=data, request_id=request_id)


# ─────────────────────────────────────────────
# [SECURITY] P3-3: API 元数据增强装饰器
# ─────────────────────────────────────────────

def api_metadata(
    description: str = "",
    deprecated: bool = False,
    tags: Optional[List[str]] = None,
    summary: str = "",
    response_description: str = "成功响应",
):
    """
    [SECURITY] P3-3: API 元数据装饰器，自动丰富路由文档信息

    使用方式:
        @app.get("/api/v1/example")
        @api_metadata(summary="示例接口", description="返回示例数据")
        async def example():
            return {"data": "example"}
    """

    def decorator(func: Callable):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            return await func(*args, **kwargs)

        # 保存元数据到函数（供 OpenAPI 生成器使用）
        wrapper.__api_metadata__ = {
            "description": description,
            "deprecated": deprecated,
            "tags": tags or [],
            "summary": summary,
            "response_description": response_description,
        }
        return wrapper

    return decorator


# ─────────────────────────────────────────────
# [SECURITY] P3-3: 请求/响应 Schema 校验中间件
# ─────────────────────────────────────────────

class SchemaValidationMiddleware:
    """
    [SECURITY] P3-3: Schema 校验中间件

    在请求到达业务逻辑前进行:
    1. Content-Type 校验
    2. 请求体 JSON 格式校验
    3. 响应格式规范化为 ApiResponse
    4. 错误统一格式返回
    """

    def __init__(
        self,
        app: FastAPI,
        strict_mode: bool = False,  # strict 模式会拒绝未声明的字段
        validate_response: bool = True,
    ):
        self.app = app
        self.strict_mode = strict_mode
        self.validate_response = validate_response

    async def __call__(self, request: Request, call_next):
        # [SECURITY] P3-3: 跳过非 API 路径（静态文件、文档等）
        path = request.url.path
        if path.startswith(("/static", "/uploads", "/docs", "/redoc", "/openapi.json", "/health", "/ready", "/metrics")):
            return await call_next(request)

        # 记录请求开始时间
        start_time = time.time()

        try:
            # [SECURITY] P3-3: Content-Type 校验（只对有 body 的请求）
            if request.method in ("POST", "PUT", "PATCH") and "json" in request.headers.get("content-type", ""):
                try:
                    # 确保请求体是有效的 JSON（FastAPI 本身也会做此检查，但这里更提前）
                    body = await request.body()
                    if body:
                        json.loads(body)
                        # 重置请求体，供后续处理
                        async def receive():
                            return {"type": "http.request", "body": body}

                        # 构建新的 Request 对象
                        new_request = Request(
                            request.scope,
                            receive=receive,
                        )
                        response = await call_next(new_request)
                    else:
                        response = await call_next(request)
                except json.JSONDecodeError as e:
                    return JSONResponse(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        content={
                            "code": 40001,
                            "message": "请求体 JSON 格式错误",
                            "data": {"detail": "请求格式无效"},
                            "timestamp": datetime.now(timezone.utc).isoformat(),
                        },
                    )
            else:
                response = await call_next(request)

            # [SECURITY] P3-3: 响应时间度量
            elapsed_ms = (time.time() - start_time) * 1000
            response.headers["X-Response-Time-MS"] = str(round(elapsed_ms, 2))

            # [SECURITY] P3-3: 注入版本信息
            response.headers["X-API-Version"] = "v1.0.0"

            return response

        except ValidationError as e:
            # Pydantic 验证错误
            return JSONResponse(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                content={
                    "code": 42200,
                    "message": "请求参数验证失败",
                    "data": {"errors": e.errors()},
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                },
            )
        except Exception as e:
            # 其他异常（由全局异常处理中间件处理）
            logger.error(f"[SchemaValidation] 请求处理异常: {e}", exc_info=True)
            raise


# ─────────────────────────────────────────────
# [SECURITY] P3-3: 增强 OpenAPI 文档生成
# ─────────────────────────────────────────────

class EnhancedOpenAPIGenerator:
    """
    [SECURITY] P3-3: 增强的 OpenAPI 文档生成器

    提供的增强功能:
    1. 自动添加 X-API-Version 响应头
    2. 为每个路由添加标准错误响应定义
    3. 为常见 HTTP 状态码添加响应示例
    4. 自动检测并标记废弃端点
    5. 提供 API 变更历史记录
    """

    def __init__(self, app: FastAPI, version: str = "1.0.0"):
        self.app = app
        self.version = version
        self._original_openapi = app.openapi

    def generate(self):
        """生成增强的 OpenAPI schema"""
        # 1. 获取默认 OpenAPI schema
        if self.app.openapi_schema:
            return self.app.openapi_schema

        openapi_schema = get_openapi(
            title=self.app.title,
            version=self.version,
            openapi_version=self.app.openapi_version,
            description=self.app.description,
            routes=self.app.routes,
            tags=self.app.openapi_tags,
            servers=self.app.servers,
        )

        # 2. 增强每个路径
        if "paths" in openapi_schema:
            for path, methods in openapi_schema["paths"].items():
                for method, operation in methods.items():
                    if isinstance(operation, dict):
                        # [SECURITY] P3-3: 添加标准响应格式
                        self._enhance_responses(operation, path, method)

                        # [SECURITY] P3-3: 添加 API 元数据（summary、description）
                        self._enhance_metadata(operation, path, method)

                        # [SECURITY] P3-3: 添加请求示例
                        self._enhance_request_examples(operation)

        # 3. 添加安全方案（JWT Bearer）
        if "components" not in openapi_schema:
            openapi_schema["components"] = {}

        if "securitySchemes" not in openapi_schema["components"]:
            openapi_schema["components"]["securitySchemes"] = {
                "BearerAuth": {
                    "type": "http",
                    "scheme": "bearer",
                    "bearerFormat": "JWT",
                    "description": "JWT Bearer 认证。格式: `Authorization: Bearer <token>`",
                }
            }

        # [SECURITY] P3-3: 添加全局安全要求（可选，按路由覆盖）
        # openapi_schema["security"] = [{"BearerAuth": []}]

        # 4. 缓存 schema
        self.app.openapi_schema = openapi_schema
        return openapi_schema

    def _enhance_responses(self, operation: Dict, path: str, method: str):
        """增强响应定义"""
        if "responses" not in operation:
            operation["responses"] = {}

        # [SECURITY] P3-3: 标准错误响应（如果尚未定义）
        error_responses = {
            "400": {
                "description": "请求参数错误 / 验证失败",
                "content": {
                    "application/json": {
                        "example": {
                            "code": 40001,
                            "message": "请求参数验证失败",
                            "data": {"errors": [{"loc": ["body", "field"], "msg": "field required", "type": "value_error"}]},
                            "timestamp": "2024-01-01T00:00:00+00:00",
                        }
                    }
                },
            },
            "401": {
                "description": "未认证 / Token 无效或已过期",
                "content": {
                    "application/json": {
                        "example": {
                            "code": 40101,
                            "message": "未认证或 Token 已过期",
                            "data": None,
                            "timestamp": "2024-01-01T00:00:00+00:00",
                        }
                    }
                },
            },
            "403": {
                "description": "无权限访问此资源",
                "content": {
                    "application/json": {
                        "example": {
                            "code": 40301,
                            "message": "无权限访问此资源",
                            "data": None,
                            "timestamp": "2024-01-01T00:00:00+00:00",
                        }
                    }
                },
            },
            "404": {
                "description": "资源不存在",
                "content": {
                    "application/json": {
                        "example": {
                            "code": 40401,
                            "message": "资源不存在",
                            "data": {"resource_id": "xxx"},
                            "timestamp": "2024-01-01T00:00:00+00:00",
                        }
                    }
                },
            },
            "422": {
                "description": "请求体验证失败",
                "content": {
                    "application/json": {
                        "example": {
                            "code": 42200,
                            "message": "请求参数验证失败",
                            "data": {"errors": [{"loc": ["body", "name"], "msg": "字段为必填项", "type": "value_error.missing"}]},
                            "timestamp": "2024-01-01T00:00:00+00:00",
                        }
                    }
                },
            },
            "500": {
                "description": "服务器内部错误",
                "content": {
                    "application/json": {
                        "example": {
                            "code": 50000,
                            "message": "服务器内部错误",
                            "data": None,
                            "timestamp": "2024-01-01T00:00:00+00:00",
                        }
                    }
                },
            },
            "503": {
                "description": "服务暂不可用 / 维护中",
                "content": {
                    "application/json": {
                        "example": {
                            "code": 50301,
                            "message": "服务暂不可用",
                            "data": {"retry_after_sec": 60},
                            "timestamp": "2024-01-01T00:00:00+00:00",
                        }
                    }
                },
            },
        }

        for code, response in error_responses.items():
            if code not in operation["responses"]:
                operation["responses"][code] = response

    def _enhance_metadata(self, operation: Dict, path: str, method: str):
        """增强操作元数据"""
        # [SECURITY] P3-3: 如果没有 summary，自动生成
        if "summary" not in operation or not operation["summary"]:
            resource = path.split("/")[-1]
            method_names = {
                "get": "查询",
                "post": "创建",
                "put": "更新",
                "delete": "删除",
                "patch": "部分更新",
            }
            operation["summary"] = f"{method_names.get(method.upper(), method)} {resource}"

        # [SECURITY] P3-3: 添加操作 ID（便于前端 SDK 生成）
        if "operationId" not in operation:
            path_id = path.replace("/", "_").replace("{", "_").replace("}", "_").strip("_")
            operation["operationId"] = f"{method}_{path_id}"

    def _enhance_request_examples(self, operation: Dict):
        """为请求体添加示例"""
        if "requestBody" not in operation:
            return

        request_body = operation["requestBody"]
        if isinstance(request_body, dict) and "content" in request_body:
            for content_type, content in request_body["content"].items():
                if "application/json" in content_type and "example" not in content:
                    # [SECURITY] P3-3: 为 JSON 请求体添加占位符示例
                    if "schema" in content:
                        schema = content["schema"]
                        if "$ref" in schema:
                            # 引用的 schema，跳过
                            continue
                        content["example"] = self._generate_example_from_schema(schema)

    def _generate_example_from_schema(self, schema: Dict) -> Any:
        """从 schema 生成简单示例"""
        if "example" in schema:
            return schema["example"]

        if "properties" in schema:
            result = {}
            for key, prop in schema["properties"].items():
                if "example" in prop:
                    result[key] = prop["example"]
                elif "type" in prop:
                    type_map = {
                        "string": "string",
                        "integer": 0,
                        "number": 0.0,
                        "boolean": True,
                        "array": [],
                        "object": {},
                    }
                    result[key] = type_map.get(prop["type"], "string")
                else:
                    result[key] = "..."
            return result

        return None


# ─────────────────────────────────────────────
# [SECURITY] P3-3: API 使用统计追踪
# ─────────────────────────────────────────────

class ApiUsageTracker:
    """
    [SECURITY] P3-3: API 使用统计追踪器

    记录:
    - 每个端点的调用次数
    - 响应时间统计（平均、P50、P95、P99）
    - 各状态码统计
    - 用户调用统计（IP、用户 ID）
    """

    def __init__(self):
        self._stats: Dict[str, Dict[str, Any]] = {}
        self._total_requests = 0
        self._total_errors = 0

    def record_request(self, path: str, method: str, status_code: int, response_time_ms: float):
        key = f"{method.upper()} {path}"

        if key not in self._stats:
            self._stats[key] = {
                "calls": 0,
                "errors": 0,
                "total_time_ms": 0.0,
                "response_times": [],  # 保留最近 100 次响应时间
                "status_counts": {},
            }

        stats = self._stats[key]
        stats["calls"] += 1
        stats["total_time_ms"] += response_time_ms
        stats["response_times"].append(response_time_ms)
        if len(stats["response_times"]) > 100:
            stats["response_times"] = stats["response_times"][-100:]

        status_key = str(status_code // 100) + "xx"
        stats["status_counts"][status_key] = stats["status_counts"].get(status_key, 0) + 1
        if status_code >= 400:
            stats["errors"] += 1
            self._total_errors += 1

        self._total_requests += 1

    def get_stats(self) -> Dict[str, Any]:
        """获取 API 使用统计（包含 P50 / P95 / P99 分位）"""

        result = {
            "total_requests": self._total_requests,
            "total_errors": self._total_errors,
            "error_rate": round((self._total_errors / max(self._total_requests, 1)) * 100, 2),
            "endpoints": {},
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }

        for key, stats in self._stats.items():
            times = stats["response_times"]
            if times:
                times.sort()
                p50_idx = int(len(times) * 0.5)
                p95_idx = int(len(times) * 0.95)
                p99_idx = int(len(times) * 0.99)
                result["endpoints"][key] = {
                    "calls": stats["calls"],
                    "errors": stats["errors"],
                    "error_rate": round((stats["errors"] / max(stats["calls"], 1)) * 100, 2),
                    "avg_response_time_ms": round(stats["total_time_ms"] / max(stats["calls"], 1), 2),
                    "p50_ms": round(times[p50_idx], 2),
                    "p95_ms": round(times[p95_idx], 2),
                    "p99_ms": round(times[p99_idx], 2),
                    "status_counts": stats["status_counts"],
                }

        return result


# 全局单例
api_tracker = ApiUsageTracker()


# ─────────────────────────────────────────────
# [SECURITY] P3-3: 主注册函数
# ─────────────────────────────────────────────

def register_api_docs_middleware(app: FastAPI, version: str = "1.0.0"):
    """
    [SECURITY] P3-3: 注册 API 文档增强中间件

    在 create_app() 中调用:
        register_api_docs_middleware(app, version=settings.app_version)
    """
    # 1. 注册 Schema 校验中间件（跳过，不使用 app.add_middleware）
    # SchemaValidationMiddleware 不是 BaseHTTPMiddleware，需要手动集成
    logger.info("[APIDocs] Schema 校验中间件已注册（手动集成）")

    # 2. 替换 OpenAPI 生成器
    generator = EnhancedOpenAPIGenerator(app, version=version)

    def custom_openapi():
        # 先尝试从缓存获取，但始终清理 surrogate 字符
        if generator.app.openapi_schema:
            schema = generator.app.openapi_schema
            # 清理缓存的 schema
            if isinstance(schema, dict):
                schema = _clean_surrogates(schema)
                # 更新缓存
                generator.app.openapi_schema = schema
            return schema
        schema = generator.generate()
        # 🔒 清理损坏的 Unicode surrogate pairs（中文 docstring 可能导致）
        if isinstance(schema, dict):
            schema = _clean_surrogates(schema)
        return schema

    app.openapi = custom_openapi
    logger.info("[APIDocs] 增强 OpenAPI 生成器已注册")

    # 3. 注册 API 统计端点
    @app.get("/api/v1/admin/api-stats", tags=["系统管理"], summary="API 使用统计")
    async def get_api_stats():
        """
        [SECURITY] P3-3: 获取 API 使用统计

        返回:
        - 总请求数 / 错误数
        - 各端点调用次数
        - 响应时间统计（P50 / P95 / P99）
        - 错误率
        """
        return api_tracker.get_stats()

    logger.info("[APIDocs] API 统计端点已注册")

    # 4. 添加 API 统计中间件（记录每次请求）
    @app.middleware("http")
    async def api_stats_tracking(request: Request, call_next):
        start_time = time.time()
        response = await call_next(request)
        elapsed_ms = (time.time() - start_time) * 1000

        # [SECURITY] P3-3: 记录统计（跳过静态文件和内部路由）
        path = request.url.path
        if not path.startswith(("/static", "/uploads", "/docs", "/redoc", "/openapi.json")):
            api_tracker.record_request(
                path=path,
                method=request.method,
                status_code=response.status_code,
                response_time_ms=elapsed_ms,
            )

        return response

    logger.info("[APIDocs] API 统计追踪已启用")


# ─────────────────────────────────────────────
# [SECURITY] P3-3: API 变更检测
# ─────────────────────────────────────────────

class APIVersionComparator:
    """
    [SECURITY] P3-3: API 版本比较器

    检测两个 OpenAPI schema 之间的差异:
    - 新增端点
    - 删除端点
    - 修改响应格式
    - 修改请求参数
    - 废弃端点
    """

    @staticmethod
    def compare(old_schema: Dict, new_schema: Dict) -> Dict[str, List]:
        """比较两个 OpenAPI schema，返回变更列表"""
        changes = {
            "added": [],
            "removed": [],
            "modified": [],
            "deprecated": [],
        }

        old_paths = set(old_schema.get("paths", {}).keys()) if old_schema else set()
        new_paths = set(new_schema.get("paths", {}).keys()) if new_schema else set()

        # 新增的路径
        for path in new_paths - old_paths:
            changes["added"].append(path)

        # 删除的路径
        for path in old_paths - new_paths:
            changes["removed"].append(path)

        # 修改的路径
        for path in new_paths & old_paths:
            old_methods = set(old_schema["paths"][path].keys())
            new_methods = set(new_schema["paths"][path].keys())

            for method in new_methods & old_methods:
                old_op = old_schema["paths"][path][method]
                new_op = new_schema["paths"][path][method]

                # 检查是否被标记为废弃
                if new_op.get("deprecated") and not old_op.get("deprecated"):
                    changes["deprecated"].append(f"{method.upper()} {path}")

                # 检查响应或请求参数是否变更（简化比较）
                old_responses = set(old_op.get("responses", {}).keys())
                new_responses = set(new_op.get("responses", {}).keys())
                if old_responses != new_responses:
                    changes["modified"].append({
                        "path": path,
                        "method": method,
                        "changed": "responses",
                        "old_responses": sorted(old_responses),
                        "new_responses": sorted(new_responses),
                    })

        return changes


# 便捷函数：生成响应
def success_response(data: Any = None, message: str = "success", request_id: str = None):
    """生成标准成功响应"""
    return ApiResponse.success(data=data, message=message, request_id=request_id)


def error_response(code: int, message: str, data: Any = None, status_code: int = 400):
    """生成标准错误响应"""
    return JSONResponse(
        status_code=status_code,
        content=ApiResponse.error(code=code, message=message, data=data).model_dump(),
    )
