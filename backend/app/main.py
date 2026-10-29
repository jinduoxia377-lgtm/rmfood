"""
# RMFOOD 配方设计平台 - 应用入口
FastAPI 应用工厂 + 生命周期事件
"""
# NOTE: DATABASE_URL is provided via Docker environment variables.
# Do NOT call load_dotenv here to avoid overwriting container env vars.
import os

if os.environ.get("ENV", "development") in ("development", "test"):
    try:
        from pathlib import Path

        from dotenv import load_dotenv

        # 从 backend/ 目录加载 .env（绝对路径，不依赖 CWD）
        # __file__ = backend/app/main.py → .parent.parent = backend/
        _env_path = Path(__file__).parent.parent / ".env"
        if _env_path.exists():
            load_dotenv(dotenv_path=_env_path)
        else:
            # 兼容: 回退到默认 CWD 查找（Docker 等场景）
            load_dotenv()
    except ImportError:
        pass  # 未安装 python-dotenv，跳过

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy import text

from .api import (
    api_router,
    mobile,  # 🔒 P2-5: 移动端专用 API
    register_lazy_routers,
    search_analytics,  # 🔒 Potion AI VFT: 搜索分析
)
from .api import search as search_router_module  # 🔒 全局搜索 API

# 🔒 P1-5: API 版本管理
from .api.api_version import (
    register_version_middleware,
    register_version_routes,
)
from .api.router_registry import registry as router_registry
from .core.api_framework.api_docs import register_api_docs_middleware
from .core.config import settings
from .core.database.database_pool import (
    pool_monitor_task,
)
from .core.database.init_db import init_db
from .core.middleware.audit_middleware import AuditMiddleware
from .core.middleware.encoding import UTF8EncodingMiddleware
from .core.middleware.error_alert import setup_error_handling
from .core.middleware.exceptions import GlobalExceptionHandler
from .core.middleware.health_check import register_health_routes
from .core.multi_tenant.tenant_security import (
    TenantMiddleware,
)
from .core.observability.logging_config import get_logger
from .core.observability.metrics_extended import setup_enhanced_metrics
from .core.observability.telemetry import (
    TelemetryMiddleware,
    enable_otel_sdk,
    get_trace_summary,
)
from .core.realtime.websocket_manager import get_ws_manager
from .core.security.security_middleware import (
    CsrfProtectMiddleware,
    RateLimitConfig,
    RateLimitMiddleware,
    RequestLoggingMiddleware,
    SecurityHeadersMiddleware,
)
from .core.security.sentry_config import sentry_init


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    应用生命周期：启动初始化 + 关闭清理
    启动阶段:
    1. 验证 PostgreSQL 连接可用性
    2. 初始化数据库表结构
    3. 种子数据导入
    4. 注册延迟加载路由
    5. 初始化 AI 服务
    关闭阶段:
    1. 关闭数据库连接池
    """
    # 创建模块级 logger
    logger = get_logger(__name__)
    logger.info("应用启动中...")
    # 初始化 Sentry 错误追踪
    sentry_init(app)

    # ── OTel SDK 切换开关（P2-1: 自研实现 → 官方 SDK） ──
    if settings.monitoring.use_otel_sdk:
        enable_otel_sdk(endpoint=settings.monitoring.otel_exporter_endpoint)
        logger.info("[Telemetry] OTel 官方 SDK 已启用")
    else:
        logger.info("[Telemetry] 使用自研 Tracer 实现（设置 USE_OTEL_SDK=true 切换至官方 SDK）")

    # ── 导入所有模型，确保 Base.metadata 包含所有表定义 ──
    # ── 启动阶段：验证 PostgreSQL 连接 ──
    from .core.database.session import close_database, ensure_connection, get_engine
    from .models import (  # noqa: F401
        ai_suggestion,
        change_event,
        chat,
        data_source_health,
        dfbp_schema,
        document_version,
        experiment,
        external_data,
        food_material,
        formula,
        knowledge_graph,
        models,
        notification,
        peptide_analysis,
        peptide_design,
        prompt_template,
        prompt_version,
        retail_product,
        seed_data,
        sync_log,
        system,
        tcm_schema,
        team,
        team_member,
        user_device,
        user_model,
        workflow,
    )
    # 1. 验证数据库连接（指数退避重试，最多5次）
    db_connected = await ensure_connection()
    if not db_connected:
        logger.error("[Startup] PostgreSQL 连接验证失败！")
        if settings.is_production:
            # 生产环境中数据库不可用则阻止启动
            raise SystemExit("Production startup aborted: database connection failed")
        logger.warning("应用将以降级模式运行。请检查数据库配置和连接状态。")
        # 不直接退出，允许应用启动（降级模式），但数据库操作将失败
    else:
        logger.info("[Startup] PostgreSQL 连接验证通过")
        # 2. 初始化数据库表结构 + 种子数据
        try:
            await init_db()
            logger.info("[Startup] 数据库初始化完成")
        except Exception as e:
            logger.error(f"[Startup] 数据库初始化失败: {e}")
    # 2.5 ② 配额安全接线：加载组织 plan 缓存并挂载 plan 感知 quota provider
    try:
        from .core.multi_tenant.tenant_quota import wire_plan_aware_quota
        plan_count = await wire_plan_aware_quota()
        logger.info("[Startup] 配额 plan 感知 provider 已挂载（%d 个租户 plan 加载）", plan_count)
    except Exception as e:
        logger.warning(f"[Startup] 配额 plan provider 挂载失败（非阻塞，回退 free）: {e}")
    # 3. 注册延迟加载路由（包括 ingredients）
    try:
        register_lazy_routers()
        logger.info("[Startup] 延迟路由注册完成")
    except Exception as e:
        logger.error(f"[Startup] 延迟路由注册失败: {e}")
    # 4. 初始化 AI 服务
    try:
        from .services.ai import init_ai_services
        await init_ai_services()
        logger.info("[Startup] AI 服务初始化完成")
    except Exception as e:
        logger.error(f"[Startup] AI 服务初始化失败: {e}")

    # 4.2 任务持久化恢复（P2 演进项）：启动时扫描超时任务
    try:
        from .services.ai.agent.task_team_service import recover_stale_tasks
        await recover_stale_tasks(timeout_minutes=30)
        logger.info("[Startup] 超时任务扫描完成")
    except Exception as e:
        logger.warning(f"[Startup] 超时任务扫描失败（非阻塞）: {e}")

    # 4.2.1 RAG 文档版本持久化恢复：从数据库加载版本历史
    try:
        from .api.rag_router import _version_mgr
        from .core.database.session import AsyncSessionLocal
        async with AsyncSessionLocal() as db:
            await _version_mgr.load_from_db(db)
        logger.info("[Startup] RAG 文档版本历史已从数据库加载")
    except Exception as e:
        logger.warning(f"[Startup] RAG 版本历史加载失败（非阻塞）: {e}")

    # 4.3 预置内置 GitHub MCP 服务器（方案 A：用户零配置）
    try:
        from .services.ai.agent.task_team_service import seed_github_mcp_server
        await seed_github_mcp_server()
        logger.info("[Startup] GitHub MCP 内置服务器就绪")
    except Exception as e:
        logger.warning(f"[Startup] GitHub MCP 种子失败（非阻塞）: {e}")

    # 4.5. 验证配方生成数据完整性
    try:
        from .core.database.session import async_session_factory
        from .services.recipe_generation_data_checker import (
            check_herb_data_completeness,
            check_herb_knowledge_service,
        )
        async with async_session_factory() as db:
            db_stats = await check_herb_data_completeness(db)
            service_stats = await check_herb_knowledge_service(db)

            logger.info("[Startup] 配方生成数据检查:")
            logger.info(f"  药材数: {db_stats['total_herbs']}, 覆盖率: {db_stats['knowledge_coverage_rate']}")
            logger.info(f"  适配器: {'✅' if service_stats['adapter_working'] else '❌'}, 加载: {service_stats.get('herbs_loaded', 0)}")

            if not db_stats['sufficient_data'] or not service_stats.get('sufficient', False):
                logger.warning("[Startup] 配方生成数据不完整，建议运行数据补全脚本")
                logger.warning("  命令: python -m app.services.recipe_generation_data_completer")
    except Exception as e:
        logger.warning(f"[Startup] 配方生成数据检查失败（非致命）: {e}")
    # 4b. 启动 WebSocket 心跳任务（统一使用 WebSocketManager）
    try:
        ws_manager = get_ws_manager()
        await ws_manager.start_heartbeat()
        logger.info("[Startup] WebSocket 心跳管理已启动")
    except Exception as e:
        logger.warning(f"[Startup] WebSocket 心跳启动失败（非致命）: {e}")
    # 4c. 启动异步任务队列
    try:
        from app.core.performance.task_queue import get_task_queue
        _task_queue = get_task_queue()
        await _task_queue.start()
        logger.info("[Startup] 异步任务队列已启动")
    except Exception as e:
        logger.warning(f"[Startup] 任务队列启动失败（非致命）: {e}")
    # 5b. 启动定时报表调度器
    try:
        from app.core.analytics_reports.scheduled_reports import get_scheduler
        sched = get_scheduler()
        await sched.start()
        logger.info("[Startup] 定时报表调度器已启动")
    except Exception as e:
        logger.warning(f"[Startup] 定时报表调度器启动失败（非致命）: {e}")
    # 6. 启动定时数据同步调度器
    try:
        from app.services.data_sources.auto_sync import start_auto_sync
        start_auto_sync()
        logger.info("[Startup] 定时数据同步调度器已启动")
    except Exception as e:
        logger.warning(f"[Startup] 定时同步调度器启动失败（非致命）: {e}")
    # 6. 启动连接池监控
    try:
        await pool_monitor_task.start()
        logger.info("[Startup] 连接池监控已启动")
    except Exception as e:
        logger.warning(f"[Startup] 连接池监控启动失败（非致命）: {e}")
    # 7. 启动后刷新引擎上下文，消除长时间启动对异步连接的污染
    try:
        async with get_engine().connect() as _warmup_conn:
            await _warmup_conn.execute(text("SELECT 1"))
        logger.info("[Startup] 引擎上下文刷新完成")
    except Exception as e:
        logger.warning(f"[Startup] 引擎上下文刷新失败（非致命）: {e}")
    # 7b. 启动账号锁定自动过期清理任务
    try:
        from app.core.security.account_lockout import cleanup_expired_locks
        await cleanup_expired_locks()
        logger.info("[Startup] 账号锁定过期清理完成")
    except Exception as e:
        logger.warning(f"[Startup] 账号锁定清理失败（非致命）: {e}")

    # 4.6 启动任务超时定时恢复循环（P0-3：运行中卡住的任务也能自动恢复）
    stale_loop_task = None
    try:
        import asyncio as _asyncio

        from .services.ai.agent.task_team_service import recover_stale_tasks

        async def _stale_recovery_loop():
            while True:
                await _asyncio.sleep(300)
                try:
                    await recover_stale_tasks(timeout_minutes=30)
                except Exception as e:
                    logger.warning(f"[TaskRecovery] 定时扫描失败（非致命）: {e}")

        stale_loop_task = _asyncio.create_task(_stale_recovery_loop())
        logger.info("[Startup] 任务超时定时恢复循环已启动（每5分钟）")
    except Exception as e:
        logger.warning(f"[Startup] 任务超时定时恢复循环启动失败（非致命）: {e}")

    # 7d. 白名单申请审核超时自动过期任务（每 5 分钟扫描）
    whitelist_expiry_task = None
    try:
        import asyncio as _asyncio

        from .core.database.session import get_session_factory
        from .services.whitelist import expire_overdue_applications

        async def _whitelist_expiry_loop():
            while True:
                await _asyncio.sleep(300)
                try:
                    _factory = get_session_factory()
                    async with _factory() as _session:
                        await expire_overdue_applications(_session)
                except Exception as e:
                    logger.warning(f"[WhitelistExpiry] 白名单过期扫描失败（非致命）: {e}")

        whitelist_expiry_task = _asyncio.create_task(_whitelist_expiry_loop())
        logger.info("[Startup] 白名单审核超时自动过期任务已启动（每5分钟）")
    except Exception as e:
        logger.warning(f"[Startup] 白名单过期任务启动失败（非致命）: {e}")

    # 7e. 白名单生产就绪性自检（SMTP/盐/开发模式提示，非致命）
    try:
        from .services.whitelist import log_readiness_warnings
        log_readiness_warnings()
    except Exception as e:
        logger.warning(f"[Startup] 白名单就绪性自检失败（非致命）: {e}")

    yield
    # ── 关闭阶段：释放资源 ──
    logger.info("应用关闭中...")
    # 5a. 取消任务超时定时恢复循环
    if stale_loop_task is not None:
        try:
            stale_loop_task.cancel()
        except Exception:
            pass
    # 5a2. 取消白名单过期扫描循环
    if whitelist_expiry_task is not None:
        try:
            whitelist_expiry_task.cancel()
        except Exception:
            pass
    # 5b. 停止定时同步调度器
    try:
        from app.services.data_sources.auto_sync import stop_auto_sync
        stop_auto_sync()
        logger.info("[Shutdown] 定时数据同步调度器已停止")
    except Exception as e:
        logger.warning(f"[Shutdown] 定时同步调度器清理异常: {e}")
    # 4c. 停止 WebSocket 心跳
    try:
        ws_manager = get_ws_manager()
        await ws_manager.stop_heartbeat()
        logger.info("[Shutdown] WebSocket 心跳已停止")
    except Exception as e:
        logger.warning(f"[Shutdown] WebSocket 心跳清理异常: {e}")
    # 4d. 停止异步任务队列
    try:
        _task_queue = get_task_queue()
        await _task_queue.stop(wait_for_completion=True)
        logger.info("[Shutdown] 异步任务队列已停止")
    except Exception as e:
        logger.warning(f"[Shutdown] 任务队列清理异常（非致命）: {e}")
    # 停止定时报表调度器
    try:
        from app.core.analytics_reports.scheduled_reports import get_scheduler
        await get_scheduler().stop()
        logger.info("[Shutdown] 定时报表调度器已停止")
    except Exception as e:
        logger.warning(f"[Shutdown] 定时报表调度器清理异常（非致命）: {e}")
    try:
        await close_database()
    except Exception as e:
        logger.warning(f"[Shutdown] 数据库连接池关闭异常: {e}")


def _eff_api_prefix(router, prefix: str = "/api/v1") -> str:
    """
    A-37b: 路由前缀去重。

    ``app/api/*.py`` 里有一部分模块在自己声明 ``APIRouter(prefix="/api/v1/...")`` 时
    就写死了完整前缀，而 ``create_app()`` 与 ``router_registry`` 都会再叠加一次全局
    ``/api/v1``，结果实际挂出来的是 ``/api/v1/api/v1/...`` —— 可达但和 OpenAPI 文档、
    前端调用路径都不一致，属于幽灵路由。

    这里统一判断：路由器自身前缀若已以全局前缀开头，就不再叠加。
    """
    own = getattr(router, "prefix", "") or ""
    return "" if own.startswith(prefix) else prefix


def create_app() -> FastAPI:
    """创建 FastAPI 应用实例"""
    logger = get_logger(__name__)
    # 预初始化 settings 确保环境变量已加载
    from app.core.config import settings as _init_settings
    _ = _init_settings.database.url

    app = FastAPI(
        title=settings.app_name,
        description="""
## 🧪 RMFOOD 配方设计平台 API
面向**药食同源功能性食品**的专业配方研发平台。
### 🎯 核心功能
- **🤖 AI 智能配方生成**: 基于神经网络的自动化配方设计
- **📊 多目标优化**: 功效 + 口感 + 成本 + 安全性综合优化
- **🔬 实验数据管理**: 全生命周期的实验数据追踪与分析
- **🔄 工作流引擎**: 可视化的流程编排与执行
- **📚 知识库集成**: TCMSP中药材 + DFBP活性肽数据库
- **📄 学术报告自动生成**: AI辅助的文献综述与报告输出
### 📡 API 概览
| 模块 | 前缀 | 说明 |
|------|------|------|
| 认证 | `/api/v1/auth` | 登录/注册/Token管理 |
| 配方 | `/api/v1/formulas` | CRUD + 版本控制 + 审核 |
| 实验 | `/api/v1/experiments` | 实验管理与数据分析 |
| 工作流 | `/api/v1/workflows` | 流程编排与监控 |
| AI | `/api/v1/ai` | 智能生成与优化 |
| 用户 | `/api/v1/users` | 用户与权限管理 |
| 系统 | `/api/v1/admin` | 管理员功能 |
| **🔔 通知中心** | `/api/v1/notifications` | **多渠道通知 + 偏好设置 (SSS)** |
| **📊 数据分析** | `/api/v1/analytics` | **仪表盘 + 报表 + 导出引擎 (SSS)** |
| **🏢 组织管理** | `/api/v1/organizations` | **多租户 + 团队 + 配额 (SSS)** |
| **🔌 集成框架** | `/api/v1/integrations` | **Webhook + API密钥 + 第三方集成 (SSS)** |
| **☁️ 云端同步** | `/api/v1/sync` | **多设备数据同步 + 冲突检测** |
| **👥 团队协作** | `/api/v1/teams` | **团队管理 + 成员权限 + 邀请链接** |
| **📝 版本控制** | `/api/v1/prompts` | **Prompt版本历史 + Diff对比 + 回滚** |
| **🤖 AI助手（增强）** | `/api/v1/ai` | **流式生成 + 优化 + 推荐 + 模板库** |
| 文件服务 | `/api/v1/files` | 附件上传、下载、报告导出（PDF/Excel/Word） |
### 🔐 认证方式
所有需要认证的接口使用 **Bearer Token**:
```
Authorization: Bearer <your_access_token>
```
### 📝 错误响应格式
```json
{
  "detail": "错误描述",
  "error_code": "ERROR_CODE",
  "request_id": "uuid-xxx"
}
```
### 🌐 版本信息
- **当前版本**: v1.0.0
- **API基础路径**: `/api/v1`
- **文档地址**: /docs (开发环境) | /redoc (生产环境只读)
        """,
        version=settings.app_version,
        docs_url="/docs",
        redoc_url="/redoc",
        openapi_tags=[
            {
                "name": "认证管理",
                "description": "用户登录、注册、Token刷新等身份认证功能"
            },
            {
                "name": "配方管理",
                "description": "配方的完整生命周期：创建、编辑、版本控制、审核、发布"
            },
            {
                "name": "实验管理",
                "description": "实验数据采集、分析、统计和状态跟踪"
            },
            {
                "name": "工作流",
                "description": "可视化工作流编辑、执行、监控和管理"
            },
            {
                "name": "AI智能",
                "description": "AI驱动的配方生成、优化、安全性和稳定性预测"
            },
            {
                "name": "知识数据库",
                "description": "中药材、活性肽、知识图谱的查询与管理"
            },
            {
                "name": "用户管理",
                "description": "用户CRUD、角色权限、账号安全设置"
            },
            {
                "name": "系统管理",
                "description": "管理员专属功能：用户管理、审计日志、系统配置"
            },
            {
                "name": "通知系统",
                "description": "站内通知、消息推送、已读状态管理"
            },
            {
                "name": "文件服务",
                "description": "附件上传、下载、报告导出（PDF/Excel/Word）"
            },
        ],
        lifespan=lifespan,
        # OpenAPI 扩展配置
        terms_of_service="https://rmfood.example.com/terms",
        contact={
            "name": "RMFOOD 技术支持",
            "email": "support@rmfood.com",
            "url": "https://rmfood.example.com/support",
        },
        license_info={
            "name": "Proprietary",
            "url": "https://rmfood.example.com/license",
        },
        # 服务器定义
        servers=[
            {
                "url": "http://localhost:8000",
                "description": "本地开发服务器",
                "variables": {
                    "port": {
                        "default": "8000",
                        "description": "服务器端口"
                    }
                }
            },
            {
                "url": "https://api.rmfood.com/v1",
                "description": "生产环境服务器",
            },
        ],
    )
    # ── 可观测性中间件 ──
    from .core.observability.metrics import metrics as metrics_collector
    app.add_middleware(
        TelemetryMiddleware,
        metrics_collector=metrics_collector,
        slow_threshold_ms=500,
    )
    logger.info("[TelemetryMiddleware] 可观测性中间件已注册")
    # 🔒 P4-3: 增强日志系统 (待激活: 需要 init_enhanced_logging 完成)
    # try:
    #     init_enhanced_logging(app)
    #     logger.info("[LoggingEnhanced] 增强日志系统已注册")
    # except Exception as e:
    #     logger.warning(f"[LoggingEnhanced] 日志系统初始化失败（非阻塞）: {e}")
    # ── 安全中间件 (按顺序添加，后添加的先执行) ──
    app.add_middleware(RequestLoggingMiddleware)
    app.add_middleware(CsrfProtectMiddleware)  # CSRF 双提交保护
    app.add_middleware(UTF8EncodingMiddleware)
    app.add_middleware(SecurityHeadersMiddleware, is_production=not settings.debug)
    app.add_middleware(RateLimitMiddleware, config=RateLimitConfig(
        requests_per_minute=60 if settings.debug else 30,
        requests_per_hour=1000,
    ))
    # ── 多租户行级安全（tenant isolation） ──
    app.add_middleware(TenantMiddleware)
    # ── 公开搜索端点限流 (在 TenantMiddleware 之后、CORS 之前注册) ──
    from .core.middleware.rate_limiter import RateLimitMiddleware as EndpointRateLimiter
    app.add_middleware(EndpointRateLimiter)
    logger.info("[EndpointRateLimiter] 公开搜索端点限流已注册")
    # ── CORS 中间件 ──
    cors_origins = settings.get_cors_origins()
    # 生产环境禁止空列表（等于拒绝所有 CORS），至少允许自身
    if not cors_origins and settings.is_production:
        cors_origins = [f"http://localhost:{settings.server.port}"]
        logger.warning(
            f"[CORS] 生产环境未配置 cors_origins，仅允许 localhost:{settings.server.port}"
        )
    app.add_middleware(
        CORSMiddleware,
        allow_origins=cors_origins,
        allow_credentials=settings.security.cors_allow_credentials,
        allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        allow_headers=["Authorization", "Content-Type", "Accept", "X-Requested-With", "X-CSRF-Token"],
        max_age=86400,  # 24小时缓存预检请求，减少 OPTIONS 开销
    )
    # ── 全局异常处理 ──
    app.add_middleware(GlobalExceptionHandler)
    # 原生 FastAPI 异常处理器（比 middleware 更早捕获异常）
    from fastapi.exceptions import RequestValidationError
    from pydantic_core import ValidationError as PydanticValidationError
    @app.exception_handler(RequestValidationError)
    async def validation_exception_handler(request, exc):
        return JSONResponse(status_code=422, content={"success": False, "error": "数据验证失败", "detail": exc.errors()})
    @app.exception_handler(PydanticValidationError)
    async def pydantic_validation_exception_handler(request, exc):
        return JSONResponse(status_code=422, content={"success": False, "error": "数据验证失败", "detail": str(exc)})
    # 🔒 P5-1: 审计中间件
    try:
        app.add_middleware(AuditMiddleware,
            include_paths=["/api/v1/"],
            exclude_paths=["/health", "/metrics", "/static", "/docs", "/redoc", "/openapi.json"],
            sampling_rate=1.0,
            record_body=False,
            alert_threshold_ms=5000,
        )
        logger.info("[AuditMiddleware] HTTP 审计中间件已注册")
    except Exception as e:
        logger.warning(f"[AuditMiddleware] 注册失败（非阻塞）: {e}")
    # ── 分析接口响应时间记录中间件 ──
    try:
        from .core.middleware.analytics_response_time import AnalyticsResponseTimeMiddleware
        app.add_middleware(AnalyticsResponseTimeMiddleware)
        logger.info("[AnalyticsResponseTimeMiddleware] 响应时间记录中间件已注册")
    except Exception as e:
        logger.warning(f"[AnalyticsResponseTimeMiddleware] 注册失败（非阻塞）: {e}")
    # ── 监控和错误处理 ──
    # setup_monitoring(app)  # 监控功能已集成到 monitoring.py，可按需启用
    setup_error_handling(app)
    # ── 调试端点：Trace 摘要（仅开发环境） ──
    # 生产环境绝对不注册调试端点（双重防护）
    if settings.debug and not settings.is_production:
        from fastapi import Depends

        from .api.deps import admin_route
        @app.get("/debug/traces", tags=["调试"], summary="查看最近 Trace 摘要（管理员）")
        async def debug_traces(_=Depends(admin_route)):
            """返回各 Tracer 的 Span 统计摘要（仅开发环境可用）"""
            return get_trace_summary()
        @app.get("/debug/context", tags=["调试"], summary="查看当前请求 Trace 上下文")
        async def debug_context(request, _=Depends(admin_route)):
            """返回当前请求的 Trace 上下文（用于验证中间件注入正确性）"""
            from .core.observability.telemetry import get_trace_context
            return get_trace_context()
    elif settings.is_production:
        logger.info("[Debug] 调试端点已禁用（生产环境）")
    # ── 注册路由（路由注册管理）──
    # 院士级修复[P1]: 统一路由注册，增加冲突检测和明确失败告警。
    # 路由注册原则:
    #   1. api_router  — 关键核心路由（auth/users/formulas/experiments/...）
    #   2. router_registry — 动态发现的扩展路由（peptide/ai/analytics/...）
    #   3. version_routes — API 版本管理和元数据
    # 若注册中心出现异常，必须记录明确错误，禁止静默降级。
    # ── 配方案例库 API（必须在 api_router 之前注册，避免 /formulas/{id} 先匹配 /formulas/cases）──
    try:
        from .api.v1.formula_cases import router as formula_cases_router
        app.include_router(formula_cases_router, prefix=_eff_api_prefix(formula_cases_router))
        logger.info("[FormulaCases] Formula case study API registered")
    except Exception as e:
        logger.warning(f"[FormulaCases] Router registration failed (non-blocking): {e}")
    # ── 配料分析API（必须在 api_router 之前注册，避免 /ingredients/{id} 先匹配 /ingredients/additives 等）──
    try:
        from .api.v1.ingredient_analysis_router import router as ingredient_analysis_router
        app.include_router(ingredient_analysis_router, prefix=_eff_api_prefix(ingredient_analysis_router))
        logger.info("[IngredientAnalysis] 配料分析路由注册成功")
    except Exception as e:
        logger.warning(f"[IngredientAnalysis] 配料分析路由注册失败（非阻塞）: {e}")
    app.include_router(api_router, prefix=_eff_api_prefix(api_router))
    # 🔒 P5: 注册企业级管理与合规路由
    try:
        from .api.enterprise import router as enterprise_router
        app.include_router(enterprise_router, prefix=_eff_api_prefix(enterprise_router))
        logger.info("[EnterpriseRouter] 企业级管理路由注册成功")
    except Exception as e:
        logger.warning(f"[EnterpriseRouter] 企业级路由注册失败（非阻塞）: {e}")
    # 🔒 P1-5: 注册 API 版本管理路由（在核心路由注册之后）
    try:
        register_version_routes(app)
        logger.info("[APIVersion] API 版本管理路由注册成功")
    except Exception as e:
        logger.warning(f"[APIVersion] 版本管理路由注册失败（非阻塞）: {e}")
    # 🔒 P1-5: 注册 API 版本中间件
    try:
        register_version_middleware(app)
        logger.info("[APIVersion] API 版本中间件注册成功")
    except Exception as e:
        logger.warning(f"[APIVersion] 版本中间件注册失败（非阻塞）: {e}")
    try:
        router_registry_stats = router_registry.register_all(app, prefix="/api/v1")
        if router_registry_stats:
            critical_count = router_registry_stats.get("critical", 0)
            lazy_count = router_registry_stats.get("lazy", 0)
            failed_count = router_registry_stats.get("failed", 0)
            logger.info(
                f"[RouterRegistry] 自动注册完成: "
                f"关键 {critical_count} 个, "
                f"延迟 {lazy_count} 个, "
                f"失败 {failed_count} 个"
            )
            if failed_count > 0:
                logger.error(
                    f"[RouterRegistry] ⚠️ {failed_count} 个路由注册失败（接口可能不可用）"
                )
    except Exception as e:
        logger.error(
            f"[RouterRegistry] 路由注册中心初始化失败 — 部分扩展接口可能不可用: {e}",
            exc_info=True,
        )
    # ── 移动端专用 API ──
    try:
        app.include_router(mobile.router, prefix=_eff_api_prefix(mobile.router))
        logger.info("[MobileAPI] 移动端专用路由注册成功")
    except Exception as e:
        logger.warning(f"[MobileAPI] 移动端路由注册失败（非阻塞）: {e}")
    # ── Core system API (cache / tasks / health) ──
    try:
        from .api.v1.core_router import router as core_router
        app.include_router(core_router, prefix=_eff_api_prefix(core_router))
        logger.info("[CoreRouter] Core system API registered")
    except Exception as e:
        logger.warning(f"[CoreRouter] Core router registration failed (non-blocking): {e}")
    # ── AI Agent API ──
    try:
        from app.api.v1.agent_router import router as agent_router
        app.include_router(agent_router, prefix=_eff_api_prefix(agent_router))
        logger.info("[AgentRouter] AI Agent API registered")
    except Exception as e:
        logger.warning(f"[AgentRouter] Agent router registration failed (non-blocking): {e}")
    # ── 多智能体协作 Bot API（DS Bot 移植）──
    try:
        from app.api.v1.bot_router import router as bot_router
        app.include_router(bot_router, prefix=_eff_api_prefix(bot_router))
        logger.info("[BotRouter] 多智能体协作 Bot API registered")
    except Exception as e:
        logger.warning(f"[BotRouter] Bot router registration failed (non-blocking): {e}")
    # ── 群聊协作 API（DS Bot 移植 Phase 2）──
    try:
        from app.api.v1.group_router import router as group_router
        app.include_router(group_router, prefix=_eff_api_prefix(group_router))
        logger.info("[GroupRouter] 群聊协作 API registered")
    except Exception as e:
        logger.warning(f"[GroupRouter] Group router registration failed (non-blocking): {e}")
    # ── 研发任务中心 API（v3.3 任务驱动自动建群）──
    try:
        from app.api.v1.task_router import router as task_router
        app.include_router(task_router, prefix=_eff_api_prefix(task_router))
        logger.info("[TaskRouter] 研发任务中心 API registered")
    except Exception as e:
        logger.warning(f"[TaskRouter] Task router registration failed (non-blocking): {e}")
    # ── MCP 服务器管理 API（v3.3）──
    try:
        from app.api.v1.admin_mcp_router import router as admin_mcp_router
        app.include_router(admin_mcp_router, prefix=_eff_api_prefix(admin_mcp_router))
        logger.info("[AdminMcpRouter] MCP 服务器管理 API registered")
    except Exception as e:
        logger.warning(f"[AdminMcpRouter] MCP router registration failed (non-blocking): {e}")
    # ── GitHub MCP 代理端点（方案 A 内置）──
    try:
        from app.api.v1.github_mcp_router import router as github_mcp_router
        app.include_router(github_mcp_router, prefix=_eff_api_prefix(github_mcp_router))
        logger.info("[GithubMcpRouter] GitHub MCP 代理端点 registered")
    except Exception as e:
        logger.warning(f"[GithubMcpRouter] GitHub MCP router registration failed (non-blocking): {e}")
    # ── AI 用量统计 API（Phase 3）──
    try:
        from app.api.v1.usage_router import router as usage_router
        app.include_router(usage_router, prefix=_eff_api_prefix(usage_router))
        logger.info("[UsageRouter] AI 用量统计 API registered")
    except Exception as e:
        logger.warning(f"[UsageRouter] Usage router registration failed (non-blocking): {e}")
    # ── 实验室验证 API ──
    try:
        from .api.lab_validation import router as lab_validation_router
        app.include_router(lab_validation_router, prefix=_eff_api_prefix(lab_validation_router))
        logger.info("[LabValidation] Lab validation API registered")
    except Exception as e:
        logger.warning(f"[LabValidation] Router registration failed (non-blocking): {e}")
    # ── Data Flywheel API (P1-C: automated collection, validation, ML training) ──
    try:
        from .api.v1.data_flywheel_router import router as data_flywheel_router
        app.include_router(data_flywheel_router, prefix=_eff_api_prefix(data_flywheel_router))
        logger.info("[DataFlywheel] Data flywheel router registered")
    except Exception as e:
        logger.warning(f"[DataFlywheel] Router registration failed (non-blocking): {e}")
    # ── 实时合规检查 API ──
    try:
        from .api.v1.compliance_router import router as compliance_router
        app.include_router(compliance_router, prefix=_eff_api_prefix(compliance_router))
        logger.info("[ComplianceRouter] Real-time compliance API registered")
    except Exception as e:
        logger.warning(f"[ComplianceRouter] Compliance router registration failed (non-blocking): {e}")
    # ── 配料表核查 API ──
    try:
        from .api.v1.label_check_router import router as label_check_router
        app.include_router(label_check_router, prefix=_eff_api_prefix(label_check_router))
        logger.info("[LabelCheckRouter] Ingredient label check API registered")
    except Exception as e:
        logger.warning(f"[LabelCheckRouter] Label check router registration failed (non-blocking): {e}")
    # ── 实验数据解析 API ──
    try:
        from .api.v1.experiment_data_router import router as experiment_data_router
        app.include_router(experiment_data_router, prefix=_eff_api_prefix(experiment_data_router))
        logger.info("[ExperimentDataRouter] Experiment data parsing API registered")
    except Exception as e:
        logger.warning(f"[ExperimentDataRouter] Experiment data router registration failed (non-blocking): {e}")
    # ── 配方在线验证工作流 API ──
    try:
        from .api.formula_validation import router as formula_validation_router
        app.include_router(formula_validation_router, prefix=_eff_api_prefix(formula_validation_router))
        logger.info("[FormulaValidationRouter] Formula online validation workflow API registered")
    except Exception as e:
        logger.warning(f"[FormulaValidationRouter] Formula validation router registration failed (non-blocking): {e}")
    # ── 工作流执行 API ──
    try:
        from .api.v1.workflow_exec_router import router as workflow_exec_router
        app.include_router(workflow_exec_router, prefix=_eff_api_prefix(workflow_exec_router))
        logger.info("[WorkflowExecRouter] Workflow execution API registered")
    except Exception as e:
        logger.warning(f"[WorkflowExecRouter] Workflow execution router registration failed (non-blocking): {e}")
    # ── 可解释性报告 API ──
    try:
        from .api.v1.explainability_router import router as explainability_router
        app.include_router(explainability_router, prefix=_eff_api_prefix(explainability_router))
        logger.info("[ExplainabilityRouter] Explainability report API registered")
    except Exception as e:
        logger.warning(f"[ExplainabilityRouter] Explainability router registration failed (non-blocking): {e}")
    # ── 报告导出 API ──
    try:
        from .api.v1.report_export_router import router as report_export_router
        app.include_router(report_export_router, prefix=_eff_api_prefix(report_export_router))
        logger.info("[ReportExportRouter] Report export API registered")
    except Exception as e:
        logger.warning(f"[ReportExportRouter] Report export router registration failed (non-blocking): {e}")
    # ── 产品方案报告 API ──
    try:
        from .api.v1.report_router import router as report_router
        app.include_router(report_router, prefix=_eff_api_prefix(report_router))
        logger.info("[ReportRouter] Product plan report API registered")
    except Exception as e:
        logger.warning(f"[ReportRouter] Product plan report router registration failed (non-blocking): {e}")
    # ── 知识图谱推理 API ──
    try:
        from .api.v1.kg_router import router as kg_router
        app.include_router(kg_router, prefix=_eff_api_prefix(kg_router))
        logger.info("[KGRouter] Knowledge graph reasoning API registered")
    except Exception as e:
        logger.warning(f"[KGRouter] Knowledge graph router registration failed (non-blocking): {e}")
    # ── 多租户管理 API ──
    try:
        from .api.v1.tenant_router import router as tenant_router
        app.include_router(tenant_router, prefix=_eff_api_prefix(tenant_router))
        logger.info("[TenantRouter] Multi-tenant management API registered")
    except Exception as e:
        logger.warning(f"[TenantRouter] Tenant router registration failed (non-blocking): {e}")
    # ── 插件管理与开放 API ──
    try:
        from .api.v1.plugin_router import router as plugin_router
        app.include_router(plugin_router, prefix=_eff_api_prefix(plugin_router))
        logger.info("[PluginRouter] Plugin management API registered")
    except Exception as e:
        logger.warning(f"[PluginRouter] Plugin router registration failed (non-blocking): {e}")
    # ── 客户端性能指标上报 API ──
    try:
        from .api.v1.metrics_router import router as metrics_router
        app.include_router(metrics_router, prefix=_eff_api_prefix(metrics_router))
        logger.info("[MetricsRouter] Client performance metrics API registered")
    except Exception as e:
        logger.warning(f"[MetricsRouter] Metrics router registration failed (non-blocking): {e}")
    # ── Potion AI VFT: 搜索分析 API ──
    try:
        # A-37b: search_analytics.router 自带 prefix=/api/v1/search/analytics，
        #   registry 自动发现时已按 effective="" 挂到正确路径；这里若再叠一层
        #   /api/v1 会多出一份 /api/v1/api/v1/... 的幽灵路由（可达但与文档不符）。
        app.include_router(
            search_analytics.router,
            prefix=_eff_api_prefix(search_analytics.router),
        )
        logger.info("[SearchAnalytics] 搜索分析路由注册成功")
    except Exception as e:
        logger.warning(f"[SearchAnalytics] 搜索分析路由注册失败（非阻塞）: {e}")
    # ── 全局搜索 API ──
    try:
        app.include_router(
            search_router_module.router,
            prefix=_eff_api_prefix(search_router_module.router),
        )
        logger.info("[Search] 全局搜索路由注册成功")
    except Exception as e:
        logger.warning(f"[Search] 全局搜索路由注册失败（非阻塞）: {e}")
    # ── 定时报表调度 API ──
    try:
        from .api.analytics_scheduler import router as analytics_scheduler_router
        app.include_router(analytics_scheduler_router, prefix=_eff_api_prefix(analytics_scheduler_router))
        logger.info("[AnalyticsScheduler] 定时报表调度路由注册成功")
    except Exception as e:
        logger.warning(f"[AnalyticsScheduler] 定时报表路由注册失败（非阻塞）: {e}")
    # ── 健康知识文章 API ──
    try:
        from .api.articles import router as articles_router
        app.include_router(articles_router, prefix=_eff_api_prefix(articles_router))
        logger.info("[Articles] 健康知识文章API注册成功")
    except Exception as e:
        logger.warning(f"[Articles] 文章路由注册失败（非阻塞）: {e}")
    # ── API v1 根路径 ──
    @app.get("/api/v1", tags=["系统"])
    async def api_v1_root():
        return {
            "name": settings.app_name,
            "version": settings.app_version,
            "description": "面向药食同源功能性食品的专业配方研发平台 API",
            "docs": "/docs" if settings.debug else None,
            "health": "/health",
            "endpoints": {
                "auth": "/api/v1/auth",
                "users": "/api/v1/users",
                "formulas": "/api/v1/formulas",
                "experiments": "/api/v1/experiments",
                "ingredients": "/api/v1/ingredients",
                "peptides": "/api/v1/peptides",
                "notifications": "/api/v1/notifications",
                "workflows": "/api/v1/workflows",
                "admin": "/api/v1/admin",
                "dashboard": "/api/v1/dashboard",
                "ai": "/api/v1/ai",
                "search": "/api/v1/search",
                "websocket": "/api/v1/ws",
                # SSS 企业级功能端点
                "analytics": "/api/v1/analytics",
                "organizations": "/api/v1/organizations",
                "integrations": "/api/v1/integrations",
                # 新增模块端点
                "cloud_sync": "/api/v1/sync",
                "teams": "/api/v1/teams",
                "version_control": "/api/v1/prompts",
                "imports": "/api/v1/imports",
                "data_flywheel": "/api/v1/data-flywheel",
                # 🔒 P5 企业级合规模块端点
                "enterprise": "/api/v1/enterprise",
                "backup": "/api/v1/enterprise/backups",
                "permissions": "/api/v1/enterprise/permissions",
                "compliance": "/api/v1/enterprise/compliance",
                "bi": "/api/v1/enterprise/bi",
                "db_optimizer": "/api/v1/enterprise/db-optimizer",
            }
        }
    # ── 静态文件服务 ──
    import mimetypes
    from pathlib import Path
    # Windows 的 mimetypes 注册表常缺少 webp/avif/svg 映射，
    # 否则图片会以 text/plain 返回，浏览器拒绝渲染（头像显示破碎图标）
    mimetypes.add_type("image/webp", ".webp")
    mimetypes.add_type("image/avif", ".avif")
    mimetypes.add_type("image/svg+xml", ".svg")
    # 使用应用根目录作为基准，避免 Docker 内相对路径问题
    app_root = Path(__file__).resolve().parent.parent  # backend/
    uploads_dir = app_root / "uploads"
    static_dir = app_root / "static"
    uploads_dir.mkdir(exist_ok=True)
    app.mount("/uploads", StaticFiles(directory=str(uploads_dir)), name="uploads")
    if static_dir.exists():
        app.mount("/static", StaticFiles(directory=str(static_dir)), name="static")
    else:
        logger.warning(f"[Static] 静态目录不存在: {static_dir}，跳过挂载")

    # 药材图片静态目录（106FAM，用于 /herb-images/xxx.jpg 直接访问）
    herb_images_dir = Path(__file__).resolve().parent.parent.parent / "data" / "106FAM"
    if herb_images_dir.exists():
        app.mount("/herb-images", StaticFiles(directory=str(herb_images_dir)), name="herb-images")
    else:
        logger.warning(f"[Static] 药材图片目录不存在: {herb_images_dir}，跳过挂载")
# ── 根路径 ──
    @app.get("/", tags=["系统"])
    async def root():
        return {
            "name": settings.app_name,
            "version": settings.app_version,
            "docs": "/docs" if settings.debug else None,
            "health": "/health",
        }
    # 🔒 P3-2: 注册增强的健康检查（liveness + readiness + detailed + metrics）
    # 替换基础健康检查：使用专门的健康检查模块
    register_health_routes(app)
    # 🔒 P3-3: 注册 API 文档增强中间件
    try:
        register_api_docs_middleware(app, version=settings.app_version)
        logger.info("[APIDocs] API 文档与 Schema 校验中间件已注册")
    except Exception as e:
        logger.warning(f"[APIDocs] API 文档中间件注册失败（非阻塞）: {e}")
    # 🔒 P3-5: 注册增强的 Prometheus 指标（需排除自身端点的统计）
    try:
        setup_enhanced_metrics(app)
        logger.info("[Metrics] 增强 Prometheus 指标已启用")
    except Exception as e:
        logger.warning(f"[Metrics] 指标模块注册失败（非阻塞）: {e}")
    @app.get("/api/v1/system/info", tags=["系统"])
    async def system_info():
        return {
            "app_name": settings.app_name,
            "version": settings.app_version,
        }
    @app.get("/api/v1/system/modules", tags=["系统"])
    async def system_modules():
        """查询所有懒加载模块的加载状态"""
        from .core.api_framework.lazy_module import service_registry
        return {
            "total": len(service_registry),
            "modules": service_registry.get_status(),
        }
    @app.get("/metrics/prometheus", tags=["系统"], include_in_schema=False)
    async def prometheus_metrics():
        """Prometheus 格式指标端点"""
        from fastapi.responses import PlainTextResponse

        from .core.observability.metrics import metrics
        return PlainTextResponse(metrics.expose(), media_type="text/plain; version=0.0.4; charset=utf-8")
    return app
app = create_app()
# 修复 OpenAPI JSON 格式问题
import re  # noqa: E402


@app.get("/openapi.json", include_in_schema=False)
async def get_openapi_fixed():
    """返回清理后的 OpenAPI JSON"""
    from fastapi.openapi.utils import get_openapi
    openapi = get_openapi(
        title=app.title,
        version=app.version,
        openapi_version=app.openapi_version,
        description=app.description,
        routes=app.routes,
    )
    # 清理 surrogate pairs
    def clean_surrogates(obj):
        if isinstance(obj, str):
            return re.sub(r'[\ud800-\udfff]', '', obj)
        elif isinstance(obj, dict):
            return {k: clean_surrogates(v) for k, v in obj.items()}
        elif isinstance(obj, list):
            return [clean_surrogates(item) for item in obj]
        return obj
    openapi = clean_surrogates(openapi)
    return JSONResponse(content=openapi)
