"""
# RMFOOD 配方设计平台 - 应用入口
FastAPI 应用工厂 + 生命周期事件
"""
# NOTE: DATABASE_URL is provided via Docker environment variables.
# Do NOT call load_dotenv here to avoid overwriting container env vars.

from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy import text
from .core.config import settings
from .core.database.init_db import init_db
from .core.performance.cache_system import init_cache, close_cache
from .core.observability.logging_config import get_logger, setup_logging
from .core.middleware.error_alert import setup_error_handling
from .core.security.security_middleware import (
    SecurityHeadersMiddleware,
    RateLimitMiddleware,
    RequestLoggingMiddleware,
    RateLimitConfig,
    CsrfProtectMiddleware,
)
from .core.middleware.encoding import UTF8EncodingMiddleware
from .core.middleware.exceptions import GlobalExceptionHandler
from .core.observability.telemetry import (
    TelemetryMiddleware, configure_trace_logging, get_trace_summary,
    enable_otel_sdk,
)
from .core.multi_tenant.tenant_security import (
    TenantMiddleware, tenant_query_guard,
)
from .core.middleware.health_check import register_health_routes
from .core.api_framework.api_docs import register_api_docs_middleware
from .core.observability.metrics_extended import setup_enhanced_metrics
from .core.database.database_pool import (
    pool_monitor_task,
    check_pool_health,
)
from .core.api_framework.http_client import http_client
from .core.observability.logging_enhanced import init_enhanced_logging
from .core.realtime.websocket import connection_manager
from .core.realtime.websocket_manager import get_ws_manager
from .api import api_router, register_lazy_routers
from .api.router_registry import registry as router_registry
from .api import mobile  # 🔒 P2-5: 移动端专用 API
from .api import search_analytics  # 🔒 Potion AI VFT: 搜索分析
# 🔒 P1-5: API 版本管理
from .api.api_version import (
    register_version_routes,
    register_version_middleware,
)
from .infrastructure.event_bus import RedisStreamsEventBus
from .core.middleware.audit_middleware import create_audit_middleware, AuditMiddleware
from .core.database.data_masking import MaskingLogFilter
from .core.compliance.backup_and_recovery import get_backup_manager
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
    from .models import (  # noqa: F401
        user_model,
        models,
        system,
        chat,
        formula,
        peptide_design,
        peptide_analysis,
        workflow,
        team,
        team_member,
        notification,
        prompt_template,
        prompt_version,
        experiment,
        knowledge_graph,
        external_data,
        change_event,
        seed_data,
        sync_log,
        tcm_schema,
        dfbp_schema,
        ai_suggestion,
        food_material,
        retail_product,
        data_source_health,
        user_device,
    )
    # ── 启动阶段：验证 PostgreSQL 连接 ──
    from .core.database.session import ensure_connection, init_database, close_database
    from .core.database.session import get_engine
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
    # 5. 启动定时数据同步调度器
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
    yield
    # ── 关闭阶段：释放资源 ──
    logger.info("应用关闭中...")
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
    try:
        await close_database()
    except Exception as e:
        logger.warning(f"[Shutdown] 数据库连接池关闭异常: {e}")
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
        from fastapi.responses import JSONResponse
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
    app.include_router(api_router, prefix="/api/v1")
    # 🔒 P5: 注册企业级管理与合规路由
    try:
        from .api.enterprise import router as enterprise_router
        app.include_router(enterprise_router, prefix="/api/v1")
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
        app.include_router(mobile.router, prefix="/api/v1")
        logger.info("[MobileAPI] 移动端专用路由注册成功")
    except Exception as e:
        logger.warning(f"[MobileAPI] 移动端路由注册失败（非阻塞）: {e}")
    # ── Core system API (cache / tasks / health) ──
    try:
        from .api.v1.core_router import router as core_router
        app.include_router(core_router, prefix="/api")
        logger.info("[CoreRouter] Core system API registered")
    except Exception as e:
        logger.warning(f"[CoreRouter] Core router registration failed (non-blocking): {e}")
    # ── AI Agent API ──
    try:
        from app.api.v1.agent_router import router as agent_router
        app.include_router(agent_router, prefix="/api/v1")
        logger.info("[AgentRouter] AI Agent API registered")
    except Exception as e:
        logger.warning(f"[AgentRouter] Agent router registration failed (non-blocking): {e}")
    # ── 实验室验证 API ──
    try:
        from .api.lab_validation import router as lab_validation_router
        app.include_router(lab_validation_router, prefix="/api/v1")
        logger.info("[LabValidation] Lab validation API registered")
    except Exception as e:
        logger.warning(f"[LabValidation] Router registration failed (non-blocking): {e}")
    # ── Data Flywheel API (P1-C: automated collection, validation, ML training) ──
    try:
        from .api.v1.data_flywheel_router import router as data_flywheel_router
        app.include_router(data_flywheel_router, prefix="/api/v1")
        logger.info("[DataFlywheel] Data flywheel router registered")
    except Exception as e:
        logger.warning(f"[DataFlywheel] Router registration failed (non-blocking): {e}")
    # ── 实时合规检查 API ──
    try:
        from .api.v1.compliance_router import router as compliance_router
        app.include_router(compliance_router, prefix="/api/v1")
        logger.info("[ComplianceRouter] Real-time compliance API registered")
    except Exception as e:
        logger.warning(f"[ComplianceRouter] Compliance router registration failed (non-blocking): {e}")
    # ── 实验数据解析 API ──
    try:
        from .api.v1.experiment_data_router import router as experiment_data_router
        app.include_router(experiment_data_router, prefix="/api/v1")
        logger.info("[ExperimentDataRouter] Experiment data parsing API registered")
    except Exception as e:
        logger.warning(f"[ExperimentDataRouter] Experiment data router registration failed (non-blocking): {e}")
    # ── 工作流执行 API ──
    try:
        from .api.v1.workflow_exec_router import router as workflow_exec_router
        app.include_router(workflow_exec_router, prefix="/api/v1")
        logger.info("[WorkflowExecRouter] Workflow execution API registered")
    except Exception as e:
        logger.warning(f"[WorkflowExecRouter] Workflow execution router registration failed (non-blocking): {e}")
    # ── 可解释性报告 API ──
    try:
        from .api.v1.explainability_router import router as explainability_router
        app.include_router(explainability_router, prefix="/api/v1")
        logger.info("[ExplainabilityRouter] Explainability report API registered")
    except Exception as e:
        logger.warning(f"[ExplainabilityRouter] Explainability router registration failed (non-blocking): {e}")
    # ── 报告导出 API ──
    try:
        from .api.v1.report_export_router import router as report_export_router
        app.include_router(report_export_router, prefix="/api/v1")
        logger.info("[ReportExportRouter] Report export API registered")
    except Exception as e:
        logger.warning(f"[ReportExportRouter] Report export router registration failed (non-blocking): {e}")
    # ── 产品方案报告 API ──
    try:
        from .api.v1.report_router import router as report_router
        app.include_router(report_router, prefix="/api/v1")
        logger.info("[ReportRouter] Product plan report API registered")
    except Exception as e:
        logger.warning(f"[ReportRouter] Product plan report router registration failed (non-blocking): {e}")
    # ── 知识图谱推理 API ──
    try:
        from .api.v1.kg_router import router as kg_router
        app.include_router(kg_router, prefix="/api/v1")
        logger.info("[KGRouter] Knowledge graph reasoning API registered")
    except Exception as e:
        logger.warning(f"[KGRouter] Knowledge graph router registration failed (non-blocking): {e}")
    # ── 多租户管理 API ──
    try:
        from .api.v1.tenant_router import router as tenant_router
        app.include_router(tenant_router, prefix="/api/v1")
        logger.info("[TenantRouter] Multi-tenant management API registered")
    except Exception as e:
        logger.warning(f"[TenantRouter] Tenant router registration failed (non-blocking): {e}")
    # ── 插件管理与开放 API ──
    try:
        from .api.v1.plugin_router import router as plugin_router
        app.include_router(plugin_router, prefix="/api/v1")
        logger.info("[PluginRouter] Plugin management API registered")
    except Exception as e:
        logger.warning(f"[PluginRouter] Plugin router registration failed (non-blocking): {e}")
    # ── 配方案例库 API ──
    try:
        from .api.v1.formula_cases import router as formula_cases_router
        app.include_router(formula_cases_router, prefix="/api/v1")
        logger.info("[FormulaCases] Formula case study API registered")
    except Exception as e:
        logger.warning(f"[FormulaCases] Router registration failed (non-blocking): {e}")
    # ── Potion AI VFT: 搜索分析 API ──
    try:
        app.include_router(search_analytics.router, prefix="/api/v1")
        logger.info("[SearchAnalytics] 搜索分析路由注册成功")
    except Exception as e:
        logger.warning(f"[SearchAnalytics] 搜索分析路由注册失败（非阻塞）: {e}")
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
    import os
    from pathlib import Path
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
        from .core.observability.metrics import metrics
        from fastapi.responses import PlainTextResponse
        return PlainTextResponse(metrics.expose(), media_type="text/plain; version=0.0.4; charset=utf-8")
    return app
app = create_app()
# 修复 OpenAPI JSON 格式问题
import re
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