"""
# RMFOOD 配方设计平台 - 应用入口
FastAPI 应用工厂 + 生命周期事件
"""
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from .core.config import settings
from .core.init_db import init_db
from .core.cache_system import init_cache, close_cache
from .core.logging_config import logger
from .core.monitoring import setup_monitoring
from .core.error_alert import setup_error_handling
from .core.security_middleware import (
    SecurityHeadersMiddleware,
    RateLimitMiddleware,
    RequestLoggingMiddleware,
    RateLimitConfig,
)
from .core.encoding import UTF8EncodingMiddleware
from .core.exceptions import GlobalExceptionHandler  # 新增：全局异常处理
from .api import api_router, register_lazy_routers
from .api.router_registry import registry as router_registry
from .core.websocket import connection_manager


@asynccontextmanager
async def lifespan(app: FastAPI):
    """应用生命周期：启动初始化 + 关闭清理"""
    # ── 启动 ──
    logger.info("=" * 50)
    logger.info(f"  {settings.app_name} v{settings.app_version}")
    logger.info("=" * 50)

    # Phase PG: 启动时数据库连接验证（重试机制）
    from .core.session import ensure_connection
    db_ok = await ensure_connection()
    if not db_ok:
        logger.error("🚫 数据库连接失败，应用可能无法正常工作！请检查数据库服务是否运行。")
    else:
        logger.info("✅ 数据库连接验证通过")

    await init_db()
    logger.info("数据库初始化完成")

    # 启动 CDC 变更捕获监听器
    from .core.cdc_listener import cdc_listener
    cdc_listener.start()

    # 延迟注册非关键路由（失败不阻塞启动）
    register_lazy_routers()

    # 注册重型服务到懒加载注册表（首次使用时才导入）
    from .core.lazy_module import service_registry
    service_registry.register("formula.synergy", "app.services.formula.synergy_engine")
    service_registry.register("formula.safety", "app.services.formula.safety_alert_system")
    service_registry.register("formula.ratio", "app.services.formula.ratio_optimizer")
    service_registry.register("formula.compatibility", "app.services.formula.compatibility_checker")
    service_registry.register("formula.effect", "app.services.formula.effect_simulator")
    service_registry.register("ai.neural", "app.services.ai.neural_formula_network")
    service_registry.register("ai.chat_engine", "app.services.ai.chat_engine")
    service_registry.register("ai.generation", "app.services.ai.generation_service")
    service_registry.register("ai.optimization", "app.services.ai.optimization_service")
    service_registry.register("ai.recommendation", "app.services.ai.recommendation_engine")
    service_registry.register("ai_models.simulated_annealing", "app.services.ai_models.simulated_annealing")
    service_registry.register("ai_models.gradient_descent", "app.services.ai_models.gradient_descent_optimizer")
    service_registry.register("ai_models.neural_engine", "app.services.ai_models.neural_formula_engine")
    service_registry.register("peptide.preprocessor", "app.services.peptide_analysis_v2.core_algorithms.preprocessor")
    service_registry.register("peptide.feature_extractor", "app.services.peptide_analysis_v2.core_algorithms.feature_extractor")
    service_registry.register("peptide.analyzer", "app.services.peptide_analysis_v2.core_algorithms.food_peptide_analyzer")
    service_registry.register("data_sources.expand_herbs", "app.services.data_sources.expand_herbs")
    service_registry.register("data_sources.tcmsp", "app.services.data_sources.tcmsp_client")
    service_registry.register("data_sources.graph", "app.services.data_sources.graph_service")
    service_registry.register("kg.graph_engine", "app.services.kg.graph_engine")
    service_registry.register("document_templates", "app.services.document_templates")
    logger.info(f"📦 懒加载服务注册完成: {len(service_registry)} 个服务")

    # 初始化缓存服务
    await init_cache()
    logger.info("缓存服务初始化完成")

    # 从数据库恢复 LLM 运行时配置（覆盖 settings 默认值）
    try:
        from .services.llm_service import llm_service, load_config_from_db
        db_cfg = await load_config_from_db()
        if db_cfg and db_cfg.api_key:
            llm_service.update_config(db_cfg)
            logger.info(f"✅ LLM 配置已从数据库恢复 (provider={db_cfg.provider}, model={db_cfg.model})")
        else:
            logger.info("ℹ️ 数据库中无已保存的 LLM 配置，使用 settings 默认值")
    except Exception as e:
        logger.warning(f"⚠️ LLM 配置数据库恢复失败: {e}")

    # 启动WebSocket连接管理器
    await connection_manager.start()
    logger.info("WebSocket连接管理器已启动")

    yield

    # ── 关闭 ──
    # 停止 CDC 监听器
    from .core.cdc_listener import cdc_listener
    cdc_listener.stop()

    # 停止WebSocket连接管理器
    await connection_manager.stop()
    logger.info("WebSocket连接管理器已停止")

    # 关闭缓存服务
    await close_cache()
    logger.info("缓存服务已关闭")

    logger.info("应用关闭")


def create_app() -> FastAPI:
    """创建 FastAPI 应用实例"""
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
        docs_url="/docs" if settings.debug else "/docs",  # 生产环境也可访问（只读）
        redoc_url="/redoc" if settings.debug else None,
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

    # ── 安全中间件 (按顺序添加，后添加的先执行) ──
    app.add_middleware(RequestLoggingMiddleware)
    app.add_middleware(UTF8EncodingMiddleware)
    app.add_middleware(SecurityHeadersMiddleware, is_production=not settings.debug)
    app.add_middleware(RateLimitMiddleware, config=RateLimitConfig(
        requests_per_minute=60 if settings.debug else 100,
        requests_per_hour=1000,
    ))

    # ── CORS 中间件 ──
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=settings.cors_methods if hasattr(settings, "cors_methods") else ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
        allow_headers=settings.cors_headers if hasattr(settings, "cors_headers") else ["Authorization", "Content-Type", "Accept"],
    )

    # ── 全局异常处理中间件 (新增) ──
    app.add_middleware(GlobalExceptionHandler)

    # ── 监控和错误处理 ──
    setup_monitoring(app)
    setup_error_handling(app)

    # ── 注册路由（统一使用路由注册中心） ──
    # api_router 包含关键路由（阶段1）+ 延迟路由（阶段2）
    app.include_router(api_router, prefix="/api/v1")

    # 使用路由注册中心自动发现并注册所有剩余路由
    # 覆盖: peptide_analysis, peptide_design, v1/*, ai, dashboard, experiments, activity, notifications, websocket
    router_registry_stats = router_registry.register_all(app, prefix="/api/v1")

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
            }
        }

    # ── 静态文件服务 ──
    import os
    uploads_dir = "uploads"
    os.makedirs(uploads_dir, exist_ok=True)
    app.mount("/uploads", StaticFiles(directory=uploads_dir), name="uploads")

    # ── 根路径 ──
    @app.get("/", tags=["系统"])
    async def root():
        return {
            "name": settings.app_name,
            "version": settings.app_version,
            "docs": "/docs" if settings.debug else None,
            "health": "/health",
        }

    # ── 健康检查（含数据库状态） ──
    @app.get("/health", tags=["系统"])
    async def health_check():
        from .core.session import check_database_health
        db_health = await check_database_health()
        overall_status = "healthy" if db_health["status"] == "healthy" else db_health["status"]
        return {
            "status": overall_status,
            "app": settings.app_name,
            "version": settings.app_version,
            "database": {
                "type": db_health["database"],
                "status": db_health["status"],
                "latency_ms": db_health["latency_ms"],
                "pool": db_health["pool"],
            },
        }

    @app.get("/api/v1/system/info", tags=["系统"])
    async def system_info():
        return {
            "app_name": settings.app_name,
            "version": settings.app_version,
            "debug": settings.debug,
        }

    @app.get("/api/v1/system/modules", tags=["系统"])
    async def system_modules():
        """查询所有懒加载模块的加载状态"""
        from .core.lazy_module import service_registry
        return {
            "total": len(service_registry),
            "modules": service_registry.get_status(),
        }

    @app.get("/metrics/prometheus", tags=["系统"], include_in_schema=False)
    async def prometheus_metrics():
        """Prometheus 格式指标端点"""
        from .core.metrics import metrics
        from fastapi.responses import PlainTextResponse
        return PlainTextResponse(metrics.expose(), media_type="text/plain; version=0.0.4; charset=utf-8")

    return app


app = create_app()
