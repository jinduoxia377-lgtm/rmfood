"""
产品方案报告 API

提供产品方案报告的生成和导出接口。
"""
import logging
from typing import Any, Dict

from fastapi import APIRouter
from pydantic import BaseModel, Field

from app.services.report.product_plan_reporter import ProductPlanReporter, get_reporter

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/reports", tags=["产品方案报告"])


# ── 请求/响应模型 ─────────────────────────────────────────────────

class ProductPlanRequest(BaseModel):
    formula_name: str = Field(..., min_length=1, max_length=100, description="配方名称")
    target_population: str = Field("adults", description="目标人群")
    ingredients: list[Dict[str, Any]] = Field(
        ..., min_length=1,
        description="成分列表，每项包含 name(名称) 和 dosage_mg(用量mg)"
    )
    core_effects: list[str] = Field(..., min_length=1, description="核心功效列表")
    dosage_form: str = Field("liquid", pattern="^(liquid|powder|tablet|capsule)$", description="剂型")


class ProductPlanResponse(BaseModel):
    success: bool
    data: Dict[str, Any]


# ── 端点 ──────────────────────────────────────────────────────────


@router.post("/product-plan", summary="生成产品方案报告", response_model=dict)
async def generate_product_plan(req: ProductPlanRequest):
    """
    生成完整的产品方案报告。

    报告包含5大模块：
    1. 产品定位与目标市场分析
    2. 核心原料的功效说明与科学依据
    3. 初步成本估算与利润空间分析
    4. 建议的工艺路线与关键控制点
    5. 法规合规性预审提示
    """
    reporter: ProductPlanReporter = get_reporter()

    report = reporter.generate({
        "formula_name": req.formula_name,
        "target_population": req.target_population,
        "ingredients": req.ingredients,
        "core_effects": req.core_effects,
        "dosage_form": req.dosage_form,
    })

    return {
        "success": True,
        "data": report.to_dict(),
        "markdown": report.to_markdown(),
    }


@router.get("/product-plan/template", summary="获取报告模板")
async def get_report_template():
    """
    返回产品方案报告的模板结构。

    用于前端预览报告格式。
    """
    reporter: ProductPlanReporter = get_reporter()

    # 生成一个空模板报告
    template = reporter.generate({
        "formula_name": "[配方名称]",
        "target_population": "adults",
        "ingredients": [
            {"name": "[药材名称]", "dosage_mg": 0, "effect": "[功效]"}
        ],
        "core_effects": ["[核心功效]"],
        "dosage_form": "liquid",
    })

    return {
        "success": True,
        "data": {
            "sections": [
                "一、产品定位",
                "二、配方组成",
                "三、成本估算",
                "四、工艺建议",
                "五、法规合规预审",
            ],
            "template_markdown": template.to_markdown(),
            "cost_estimate_fields": list(template.cost_estimate.keys()),
        },
    }


@router.get("/product-plan/cost-reference", summary="原料单价参考")
async def get_cost_reference():
    """
    返回原料单价参考表。

    用于成本估算的基准数据。
    """
    reporter: ProductPlanReporter = get_reporter()

    return {
        "success": True,
        "data": {
            "herb_prices": reporter.HERB_PRICES,
            "default_unit_price": 50.0,
            "markup_rate": 3.0,
            "note": "单价为参考值，实际价格请以市场采购价为准",
        },
    }


@router.get("/product-plan/process-suggestions", summary="工艺建议模板")
async def get_process_suggestions():
    """
    返回不同剂型的工艺建议模板。
    """
    reporter: ProductPlanReporter = get_reporter()

    return {
        "success": True,
        "data": reporter.PROCESS_SUGGESTIONS,
    }
