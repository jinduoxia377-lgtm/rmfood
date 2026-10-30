"""
Ingredient Analysis Router - 配料分析API
提供：OCR识别 + 六维分析 + 数据库查询
"""

import io
import logging
import re
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, File, HTTPException, UploadFile
from app.api.deps import CurrentUser
from pydantic import BaseModel, Field

from ...services.ingredient_analysis import analysis_service

router = APIRouter(prefix="/ingredients", tags=["配料分析"])
logger = logging.getLogger(__name__)


# ========== Pydantic Models ==========

class IngredientItem(BaseModel):
    name: str = Field(..., description="成分名称")
    additive: Optional[str] = Field(None, description="E编码")


class AnalyzeRequest(BaseModel):
    ingredient_text: str = Field(..., min_length=1, max_length=2000, description="配料表文本")
    ingredients: Optional[List[IngredientItem]] = Field(None, description="结构化成分列表")
    nutrition: Optional[Dict[str, Any]] = Field(None, description="营养成分数据")
    serving_size: Optional[str] = Field("100g", description="食用份量")


class OCRResponse(BaseModel):
    success: bool
    text: Optional[str] = None
    ingredients: Optional[List[IngredientItem]] = None
    message: Optional[str] = None


class AdditiveInfo(BaseModel):
    eCode: str
    name: str
    function: str
    risk: str
    maxUsage: Optional[str] = None
    carcinogen: Optional[bool] = None
    allergen: Optional[bool] = None


class AnalysisResult(BaseModel):
    timestamp: str
    ingredientText: str
    ingredients: List[str]
    nutriScore: int
    nutriGrade: Dict[str, Any]
    novaResult: Dict[str, Any]
    additives: List[AdditiveInfo]
    allergens: List[Dict[str, Any]]
    herbalIngredients: List[Dict[str, str]]
    nutritionTable: List[Dict[str, Any]]
    suggestions: List[Dict[str, str]]
    overallScore: int
    overallGrade: Dict[str, Any]
    riskLevel: str
    riskMessages: List[str]
    servingSize: str


# ========== API Endpoints ==========

@router.get("/health", summary="配料分析服务健康检查")
async def health_check():
    """验证配料分析服务可用"""
    return {
        "success": True,
        "data": {
            "status": "healthy",
            "service": "ingredient-analysis",
            "features": ["six_dim_analysis", "ocr_recognition", "additive_database", "food_homology"],
        },
    }


@router.post("/analyze", response_model=Dict[str, Any], summary="配料六维分析")
async def analyze_ingredient(req: AnalyzeRequest, current_user: CurrentUser):
    """
    配料表六维分析接口

    分析维度：
    1. Nutri-Score 健康评分 (0-100分, A-E等级)
    2. NOVA 超加工食品分组 (1-4组)
    3. E编码添加剂分析 (50+种数据库)
    4. 八大过敏原检测
    5. 药食同源成分识别 (50+种)
    6. GB 28050 营养成分表
    """
    try:
        # 构建成分列表
        ingredients = []
        if req.ingredients:
            for ing in req.ingredients:
                ingredients.append({
                    'name': ing.name,
                    'additive': ing.additive
                })
        elif req.ingredient_text:
            # 从文本解析成分
            parts = [p.strip() for p in re.split(r'[，,、\s]+', req.ingredient_text) if p.strip()]
            for name in parts[:30]:  # 限制最多30个成分
                ingredients.append({'name': name, 'additive': None})

        # 执行分析
        result = analysis_service.analyze(
            ingredient_text=req.ingredient_text,
            ingredients=ingredients,
            nutrition=req.nutrition
        )
        result['servingSize'] = req.serving_size or '100g'

        return {
            "success": True,
            "data": result,
            "message": "分析完成"
        }
    except Exception as e:
        logger.error(f"[IngredientAnalysis] 分析失败: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"分析失败: {str(e)}")


@router.post("/ocr", response_model=OCRResponse, summary="OCR识别配料表")
async def ocr_ingredient_image(file: UploadFile = File(...)):
    """
    OCR识别食品包装配料表图片

    真实行为：
    - 若部署环境安装了可用的 OCR 引擎（pytesseract / paddleocr / easyocr / cnocr），
      则对上传图片执行真实识别，返回识别文本 + 结构化成分列表。
    - 若未安装任何 OCR 引擎，则如实返回 success=False 并说明原因，
      绝不返回模拟数据（遵守"禁止假数据"约束）。
    """
    content = await file.read()
    if not content:
        return OCRResponse(success=False, message="图片内容为空")

    text = _run_ocr(content)
    if text is None:
        return OCRResponse(
            success=False,
            message=(
                "当前环境未安装可用的 OCR 引擎（rapidocr/pytesseract/paddleocr/easyocr/cnocr）。"
                "请先安装任一引擎（推荐 rapidocr-onnxruntime，无需 torch）后再使用图片识别；"
                "或直接使用 /analyze 文本分析接口。"
            ),
        )

    # 从识别文本解析成分（与 /analyze 相同的分词逻辑）
    parts = [p.strip() for p in re.split(r"[，,、\s]+", text) if p.strip()]
    ingredients = [IngredientItem(name=name) for name in parts[:30]]

    return OCRResponse(success=True, text=text, ingredients=ingredients)


def _run_ocr(content: bytes) -> Optional[str]:
    """尝试可用的 OCR 引擎，返回识别文本；无可用引擎返回 None。"""
    # 1. RapidOCR / ONNX（纯 ONNX、无 torch 依赖，中文效果好，首选）
    try:
        import numpy as np
        from PIL import Image
        from rapidocr_onnxruntime import RapidOCR

        img = Image.open(io.BytesIO(content))
        arr = np.array(img)
        engine = RapidOCR()
        result, elapse = engine(arr)
        # rapidocr 返回 [[box, text, score], ...] 或 None
        if result:
            lines = []
            for item in result:
                if item and len(item) >= 2:
                    lines.append(str(item[1]))
            text = " ".join(lines).strip()
            if text:
                return text
    except ImportError:
        pass
    except Exception as e:
        logger.debug(f"rapidocr OCR failed: {e}")

    # 2. 本地 tesseract（pytesseract）
    try:
        import pytesseract
        from PIL import Image

        img = Image.open(io.BytesIO(content))
        result = pytesseract.image_to_string(img, lang="chi_sim")
        if result and result.strip():
            return result.strip()
    except ImportError:
        pass
    except Exception as e:
        logger.debug(f"pytesseract OCR failed: {e}")

    # 3. PaddleOCR
    try:
        from paddleocr import PaddleOCR

        ocr = PaddleOCR(use_angle_cls=False, lang="ch", show_log=False)
        out = ocr.ocr(io.BytesIO(content), cls=False)
        lines = []
        for page in out or []:
            for item in page or []:
                if item and len(item) >= 2:
                    lines.append(str(item[1][0]))
        text = "\n".join(lines).strip()
        if text:
            return text
    except ImportError:
        pass
    except Exception as e:
        logger.debug(f"PaddleOCR failed: {e}")

    # 4. EasyOCR
    try:
        import easyocr

        reader = easyocr.Reader(["ch_sim", "en"])
        results = reader.readtext(io.BytesIO(content))
        text = " ".join(r[2] for r in results if r and len(r) >= 3).strip()
        if text:
            return text
    except ImportError:
        pass
    except Exception as e:
        logger.debug(f"EasyOCR failed: {e}")

    # 5. CNOCR
    try:
        from cnocr import CnOcr

        model = CnOcr()
        result = model.ocr(io.BytesIO(content))
        lines = []
        for item in result.get("detail", []):
            if item.get("text"):
                lines.append(item["text"])
        text = "\n".join(lines).strip()
        if text:
            return text
    except ImportError:
        pass
    except Exception as e:
        logger.debug(f"CNOCR failed: {e}")

    return None


@router.get("/additives", summary="获取添加剂数据库")
async def get_additives():
    """返回完整的E编码添加剂数据库"""
    from ...services.ingredient_analysis import ADDITIVE_DB
    return {
        "success": True,
        "data": list(ADDITIVE_DB.values()),
        "total": len(ADDITIVE_DB)
    }


@router.get("/food-homology", summary="获取药食同源目录")
async def get_food_homology():
    """返回药食同源成分目录"""
    from ...services.ingredient_analysis import FOOD_HOMOLOGY_DB
    return {
        "success": True,
        "data": FOOD_HOMOLOGY_DB,
        "total": len(FOOD_HOMOLOGY_DB)
    }


@router.get("/allergens", summary="获取过敏原配置")
async def get_allergens():
    """返回八大过敏原配置"""
    from ...services.ingredient_analysis import ALLERGEN_MAP
    return {
        "success": True,
        "data": [{"id": k, **v} for k, v in ALLERGEN_MAP.items()]
    }


@router.post("/batch-analyze", summary="批量配料分析")
async def batch_analyze(request: Dict[str, Any]):
    """
    批量配料分析接口
    支持一次分析多个配料表
    """
    items = request.get("items", [])
    if not items:
        raise HTTPException(status_code=400, detail="请提供待分析的配料列表")

    results = []
    for item in items[:20]:  # 限制最多20条
        try:
            result = analysis_service.analyze(
                ingredient_text=item.get("ingredient_text", ""),
                ingredients=item.get("ingredients", []),
                nutrition=item.get("nutrition")
            )
            results.append(result)
        except Exception as e:
            logger.error(f"[BatchAnalyze] 单条分析失败: {e}")
            results.append({"error": str(e), "item": item})

    return {
        "success": True,
        "data": {"results": results, "total": len(results)},
        "message": f"批量分析完成，成功{len(results)}条"
    }


@router.get("/health-score/{score}", summary="获取评分详情")
async def get_health_score_detail(score: int):
    """根据分数获取详细的评分解读"""
    grade = analysis_service.get_nutri_grade(score)
    return {
        "success": True,
        "data": {
            "score": score,
            "grade": grade,
            "description": _get_score_description(score),
            "recommendations": _get_score_recommendations(score)
        }
    }


def _get_score_description(score: int) -> str:
    if score >= 85:
        return "该产品营养构成优秀，高纤维高蛋白，低脂低糖低钠，是值得推荐的健康食品选择。"
    elif score >= 70:
        return "该产品营养状况良好，少量添加剂，整体健康风险可控。"
    elif score >= 55:
        return "该产品含有一定量的添加剂或较高糖/钠，建议适量食用。"
    elif score >= 40:
        return "该产品营养质量一般，含有较多添加剂，建议减少食用频率。"
    else:
        return "该产品营养质量较差，含多种高风险添加剂，不建议长期食用。"


def _get_score_recommendations(score: int) -> List[str]:
    recs = []
    if score >= 70:
        recs.append("可作为日常食品适量食用")
    if score < 55:
        recs.append("建议减少食用频率")
        recs.append("关注添加剂使用情况")
    recs.append("参考配料表选择更健康的替代品")
    return recs
