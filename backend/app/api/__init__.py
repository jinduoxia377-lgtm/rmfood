"""RMFOOD API 路由模块

路由分两阶段注册:
1. 关键路由 — 模块导入时立即注册（认证、用户、配方等核心功能）
2. 非关键路由 — 在 lifespan 启动阶段延迟注册（优化启动速度 + 失败不阻塞）
"""
import logging
from fastapi import APIRouter

logger = logging.getLogger(__name__)

api_router = APIRouter()

# ── 阶段1: 关键路由立即注册 ──
from .auth import router as auth_router
from .oauth2_auth import router as oauth2_router
from .users import router as users_router
from .formulas import router as formulas_router
from .databases import router as databases_router  # 数据库检索（立即加载，确保路由注册）
from .knowledge_graph import router as knowledge_graph_router  # 知识图谱分析（立即加载，智能分析核心功能）

api_router.include_router(auth_router)
api_router.include_router(oauth2_router)
api_router.include_router(users_router)
api_router.include_router(formulas_router)
api_router.include_router(databases_router)
api_router.include_router(knowledge_graph_router)

# ── 阶段2: 非关键路由延迟注册 ──
_LAZY_ROUTER_MODULES = [
    # 核心业务模块 (experiments, notifications, dashboard, activity, ai 由 main.py 直接注册)
    'ingredients',
    'peptides',
    'workflows',
    'admin',
    'audit',
    'attachments',
    # databases 已移至阶段1立即加载
    'search',
    'comments',
    'comment_likes',
    'websocket',
    'categories',
    'tags',
    'file_generator',
    'chat',
    'food_peptide_routes',  # RMFOOD食品活性肽分析

    # SSS 企业级功能模块
    'analytics',
    'organizations',
    'integrations',
    'pepinvent',
    'advanced_peptide',

    # 知识库模块
    'knowledge_base',
    'rag_router',  # RAG 向量知识库
    # knowledge_graph 已移至阶段1立即加载（智能分析核心功能）
]

_lazy_loaded = False


def register_lazy_routers():
    """
    延迟注册非关键路由。

    应在 app lifespan 启动阶段调用，而非模块导入时。
    失败的路由会记录 warning 但不阻塞其他路由注册。
    """
    global _lazy_loaded
    if _lazy_loaded:
        return

    import importlib

    loaded = []
    failed = []

    for module_name in _LAZY_ROUTER_MODULES:
        try:
            module = importlib.import_module(f'.{module_name}', __name__)
            router = getattr(module, 'router', None)
            if router:
                route_count = len(router.routes) if hasattr(router, 'routes') else '?'
                logger.info(f"  ✅ {module_name}: {route_count} routes")
                api_router.include_router(router)
                loaded.append(module_name)
            else:
                logger.warning(f"  ⚠️ {module_name}: no 'router' attribute")
        except Exception as e:
            failed.append((module_name, "模块加载失败"))
            logger.warning(f"⚠️ 路由模块加载失败 {module_name}: {e}")

    _lazy_loaded = True

    logger.info(
        f"📦 非关键路由注册完成: "
        f"{len(loaded)} 成功"
        + (f", {len(failed)} 失败" if failed else "")
    )

    if failed:
        logger.warning(f"失败的路由模块: {[f[0] for f in failed]}")
