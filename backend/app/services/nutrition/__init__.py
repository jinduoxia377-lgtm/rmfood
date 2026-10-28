"""营养成分服务模块

包含：
- 统一营养数据库（合并原 nutrition_service + nutrition_database 双数据源）
- 营养成分标签生成引擎（GB 28050-2011）
- 营养导出服务（Excel / PDF）
- 营养查询接口
"""

from .nutrition_database import (
    HERB_NUTRITION_DB,
    get_all_ingredients,
    get_coverage_stats,
    get_ingredient_nutrition,
)
from .nutrition_export import (
    export_nutrition_label,
    export_to_excel,
    export_to_pdf,
)
from .nutrition_label_generator import (
    CALORIC_CONVERSION,
    MANDATORY_NUTRIENTS,
    NRV_VALUES,
    NutritionLabelGenerator,
    get_nutrition_label_generator,
)

__all__ = [
    "HERB_NUTRITION_DB",
    "get_ingredient_nutrition",
    "get_all_ingredients",
    "get_coverage_stats",
    "NutritionLabelGenerator",
    "get_nutrition_label_generator",
    "NRV_VALUES",
    "CALORIC_CONVERSION",
    "MANDATORY_NUTRIENTS",
    "export_nutrition_label",
    "export_to_excel",
    "export_to_pdf",
]
