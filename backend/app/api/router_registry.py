"""
路由自动发现注册中心

统一管理所有 API 路由的注册，替代 main.py 中的 15+ 直接 import。

使用方式:
    from .api.router_registry import registry
    registry.register_all(app, prefix="/api/v1")

路由模块约定:
    - api/*.py 中定义 router = APIRouter() 的模块会被自动发现
    - api/v1/*.py 中的路由器自动归入 v1 命名空间
    - 模块级变量 __critical__ = True 表示立即加载（默认 False = 延迟加载）
    - 模块级变量 __tags__ = ["Tag1", "Tag2"] 指定 OpenAPI 标签
"""
from __future__ import annotations

import importlib
import logging
import pkgutil
from pathlib import Path
from typing import Any

from fastapi import APIRouter

logger = logging.getLogger(__name__)

# 关键路由 — 启动时必须加载，失败则阻塞启动
IMPORTANT_ROUTER_MODULES = [
    "auth",              # 认证
    "oauth2_auth",       # OAuth2
    "users",             # 用户管理
    "formulas",          # 配方管理
    "databases",         # 知识数据库
    "knowledge_graph",   # 图谱查询
    "experiments",       # 实验管理
    "notifications",     # 通知系统
    "analytics",         # 数据分析
    "dashboard",         # 仪表盘
    "peptide_analysis_routes",  # 肽分析
    "peptide_design_routes",    # 肽设计
]
CRITICAL_MODULES = frozenset(IMPORTANT_ROUTER_MODULES)

# v1 子路由模块 - 使用可变 set 以便后续添加
V1_MODULES = {
    "sync_router",
    "team_router",
    "team_dashboard_router",
    "version_router",
    "notification_router",
    "ai_task_router",       # Phase 4-A: AI 推理任务队列
    "quota_router",         # Phase 4-B: 多租户配额管理
    "websocket_router",
}

# ====== CQRS Query Routes (NEW) ======
TAG_OVERRIDES: dict[str, list[str]] = {
    "auth": ["认证管理"],
    "oauth2_auth": ["认证管理"],
    "users": ["用户管理"],
    "formulas": ["配方管理"],
    "databases": ["知识数据库"],
    "knowledge_graph": ["知识数据库"],
    "experiments": ["实验管理"],
    "ai": ["AI智能"],
    "ai_task_router": ["AI推理任务队列"],
    "quota_router": ["配额管理"],
    "chat": ["AI智能"],
    "dashboard": ["仪表盘"],
    "notifications": ["通知系统"],
    "websocket": ["WebSocket"],
    "analytics": ["数据分析"],
    "organizations": ["组织管理"],
    "integrations": ["集成框架"],
    "activity": ["活动日志"],
    "peptide_analysis_routes": ["肽分析"],
    "peptide_design_routes": ["肽设计"],
    "user_settings": ["用户设置"],
}
# 为 query_routes 添加特殊标签（在定义后追加）
TAG_OVERRIDES["query_routes"] = ["Query API", "Read-optimized endpoints"]
V1_MODULES.add("query_routes")  # 现在可以使用 add()，因为 V1_MODULES 是 set 而不是 frozenset

# v1 子路由模块
V1_MODULES = frozenset({
    "sync_router",
    "team_router",
    "team_dashboard_router",
    "version_router",
    "notification_router",
    "ai_task_router",       # Phase 4-A: AI 推理任务队列
    "quota_router",         # Phase 4-B: 多租户配额管理
    "websocket_router",
    "metrics_router",       # 客户端性能指标上报
})


class RouterRegistry:
    """路由自动发现注册中心"""

    def __init__(self):
        self._routers: dict[str, tuple[APIRouter, list[str], bool]] = {}
        self._deferred_modules: dict[str, tuple[str, str]] = {}  # key → (full_module_name, short_name)
        self._loaded = False

    def discover(self, api_package_path: str = "app.api") -> None:
        """
        自动发现 api/ 目录下所有包含 router 的模块。

        Args:
            api_package_path: api 包的 Python 路径
        """
        if self._loaded:
            return

        # 发现 api/ 一级模块
        self._discover_modules(api_package_path, is_v1=False)

        # 发现 api/v1/ 子模块
        v1_package = f"{api_package_path}.v1"
        self._discover_modules(v1_package, is_v1=True)

        self._loaded = True
        logger.info(f"📦 路由发现完成: {len(self._routers)} 个路由模块")

        # ===== 新增：检测未被标记为关键的模块 =====
        try:
            package = importlib.import_module(api_package_path)
            package_dir = Path(package.__file__).parent

            all_scanned = set()
            for module_info in pkgutil.iter_modules([str(package_dir)]):
                if not module_info.name.startswith("_"):
                    all_scanned.add(module_info.name)

            discovered_important = all_scanned - CRITICAL_MODULES - V1_MODULES
            if discovered_important:
                logger.warning(
                    f"[RouterRegistry] 以下检测到的重要模块未列入关键列表，建议审核: {discovered_important}"
                )
        except Exception as e:
            logger.debug(f"[RouterRegistry] 模块扫描检测失败（非阻塞）: {e}")

    def _discover_modules(self, package_path: str, is_v1: bool) -> None:
        """扫描包目录，发现路由模块（关键模块立即导入，非关键延迟）"""
        try:
            package = importlib.import_module(package_path)
        except ImportError as e:
            logger.warning(f"无法导入包 {package_path}: {e}")
            return

        package_dir = Path(package.__file__).parent

        for module_info in pkgutil.iter_modules([str(package_dir)]):
            if module_info.name.startswith("_"):
                continue

            registry_key = f"v1.{module_info.name}" if is_v1 else module_info.name
            is_critical = module_info.name in CRITICAL_MODULES

            # 关键模块立即导入，非关键模块延迟到注册时
            if is_critical:
                full_module_name = f"{package_path}.{module_info.name}"
                try:
                    module = importlib.import_module(full_module_name)
                except Exception as e:
                    logger.warning(f"无法导入关键模块 {full_module_name}: {e}")
                    continue

                router = getattr(module, "router", None)
                if not isinstance(router, APIRouter):
                    continue

                tags = getattr(module, "__tags__", None) or TAG_OVERRIDES.get(
                    module_info.name, [module_info.name.replace("_", " ").title()]
                )
                self._routers[registry_key] = (router, tags, True)
            else:
                # 非关键模块：仅记录路径，不导入
                self._deferred_modules[registry_key] = (
                    f"{package_path}.{module_info.name}",
                    module_info.name,
                )

            # 标签和注册已在 if/else 分支中处理

    def _load_deferred_modules(self) -> None:
        """加载延迟模块（非关键路由，首次注册时才导入）"""
        for key, (full_module_name, short_name) in list(self._deferred_modules.items()):
            try:
                module = importlib.import_module(full_module_name)
                router = getattr(module, "router", None)
                if isinstance(router, APIRouter):
                    tags = getattr(module, "__tags__", None) or TAG_OVERRIDES.get(
                        short_name, [short_name.replace("_", " ").title()]
                    )
                    self._routers[key] = (router, tags, False)
            except Exception as e:
                logger.warning(f"延迟加载失败 {full_module_name}: {e}")

        self._deferred_modules.clear()

    def register_all(
        self,
        app: Any,
        prefix: str = "/api/v1",
        critical_only: bool = False,
    ) -> dict[str, int]:
        """
        注册所有发现的路由到 FastAPI 应用。

        Args:
            app: FastAPI 应用实例
            prefix: API 路由前缀
            critical_only: 仅注册关键路由

        Returns:
            注册统计 {"critical": N, "lazy": N, "failed": N}
        """
        if not self._loaded:
            self.discover()

        stats = {"critical": 0, "lazy": 0, "failed": 0}

        # 如果非仅关键模式，加载延迟模块
        if not critical_only:
            self._load_deferred_modules()

        for name, (router, tags, is_critical) in self._routers.items():
            if critical_only and not is_critical:
                continue

            try:
                # A-37：app/api/*.py 里有几个模块把自己写成了完整前缀
                #   （formula_integration=/api/v1/formula、herb_food=/api/v1/herb-food、
                #     search_analytics=/api/v1/search/analytics），
                #   而这里对所有路由统一再叠加一次 /api/v1 → 实际挂成了
                #   /api/v1/api/v1/...，前端按文档里的路径永远调不到。
                #   自身前缀已以全局前缀开头时不再叠加。
                own_prefix = getattr(router, "prefix", "") or ""
                effective = "" if own_prefix.startswith(prefix) else prefix
                app.include_router(router, prefix=effective, tags=tags)
                if is_critical:
                    stats["critical"] += 1
                else:
                    stats["lazy"] += 1
            except Exception as e:
                stats["failed"] += 1
                logger.warning(f"⚠️ 路由注册失败 {name}: {e}")

        logger.info(
            f"✅ 路由注册完成: "
            f"{stats['critical']} 关键 + {stats['lazy']} 延迟"
            + (f", {stats['failed']} 失败" if stats["failed"] else "")
        )

        return stats

    def get_route_summary(self) -> list[dict[str, Any]]:
        """获取所有已发现路由的摘要信息"""
        if not self._loaded:
            self.discover()

        summary = []
        for name, (router, tags, is_critical) in sorted(self._routers.items()):
            route_count = len(router.routes) if hasattr(router, "routes") else 0
            summary.append({
                "name": name,
                "routes": route_count,
                "tags": tags,
                "critical": is_critical,
            })

        return summary


# 全局单例
registry = RouterRegistry()
