"""
数据库检索 API 路由 - 重组版

原 databases.py (1502行) 已拆分为 6 个子模块:
- herbs.py: TCMSP 中药材检索
- peptides.py: DFBP 活性肽检索
- dashboard.py: 仪表盘、排行、趋势、搜索建议
- search.py: 统一搜索、数据同步、快照
- food_materials.py: 食品原料搜索 (Potion AI VFT 融合)
- retail_products.py: 零售产品 CRUD (Potion AI VFT 融合)

所有子模块共享同一个 router 实例（来自 db_modules/__init__.py）。
"""
# Import all submodules to register their endpoints
from . import search_analytics  # noqa: F401

# Re-export the shared router for main.py to include
from .db_modules import (
    compounds,  # noqa: F401
    dashboard,  # noqa: F401
    database_extras,  # noqa: F401  # RMCHM + CFAM 检索
    food_materials,  # noqa: F401
    herbs,  # noqa: F401
    openfoodfacts,  # noqa: F401
    pantry,  # noqa: F401  # 收藏/书架（frontend 依赖 POST /pantry/*）
    peptides,  # noqa: F401
    retail_products,  # noqa: F401
    router,  # noqa: F401
    search,  # noqa: F401
)
