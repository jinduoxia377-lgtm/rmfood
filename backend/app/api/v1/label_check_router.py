"""
配料表核查 API — C端「配料表核查」服务端点

- POST /label-check             提交配料表文本（OCR 或粘贴）
- POST /label-check/ocr         上传配料表图片，OCR 识别后核查
- POST /label-check/ingredients 提交成分名称列表
"""
from __future__ import annotations

import logging
from typing import List, Optional

from fastapi import APIRouter, File, HTTPException, UploadFile
from app.api.deps import CurrentUser
from pydantic import BaseModel, Field

from app.services.label_check.label_check_service import (
    check_ingredient_names,
    check_label_text,
    get_label_check_templates,
    get_directory_stats,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/label-check", tags=["配料表核查"])


class LabelCheckTextRequest(BaseModel):
    text: str = Field(..., min_length=1, max_length=5000, description="配料表文本（OCR 或粘贴）")


class LabelCheckListRequest(BaseModel):
    ingredients: List[str] = Field(..., min_length=1, max_length=200, description="成分名称列表")


class LabelCheckOCRResponse(BaseModel):
    success: bool
    ocr_text: Optional[str] = None
    data: Optional[dict] = None
    message: Optional[str] = None


@router.post("", summary="配料表核查（文本）")
async def check_label_text_api(req: LabelCheckTextRequest, current_user: CurrentUser):
    """输入配料表文本，返回成分分类与提示（信息参考，不构成合规结论）。"""
    try:
        return check_label_text(req.text)
    except Exception as e:
        logger.error(f"[LabelCheck] 文本核查失败: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="配料表核查失败，请稍后重试")


@router.post("/ocr", response_model=LabelCheckOCRResponse, summary="配料表核查（图片 OCR）")
async def check_label_ocr_api(current_user: CurrentUser, file: UploadFile = File(...)):
    """上传配料表图片，OCR 识别后执行目录比对核查。"""
    try:
        from app.api.v1.ingredient_analysis_router import _run_ocr

        content = await file.read()
        if not content:
            return LabelCheckOCRResponse(success=False, message="图片内容为空")

        text = _run_ocr(content)
        if text is None:
            return LabelCheckOCRResponse(
                success=False,
                message=(
                    "当前环境未安装可用的 OCR 引擎（推荐 rapidocr-onnxruntime）。"
                    "可先安装引擎后使用图片识别，或直接粘贴文本核查。"
                ),
            )

        report = check_label_text(text)
        return LabelCheckOCRResponse(
            success=True,
            ocr_text=text,
            data=report["data"],
        )
    except Exception as e:
        logger.error(f"[LabelCheck] OCR 核查失败: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="OCR 配料表核查失败，请稍后重试")


@router.post("/ingredients", summary="配料表核查（成分列表）")
async def check_label_ingredients_api(req: LabelCheckListRequest, current_user: CurrentUser):
    """输入成分名称列表，返回成分分类与提示（信息参考，不构成合规结论）。"""
    try:
        return check_ingredient_names(req.ingredients)
    except Exception as e:
        logger.error(f"[LabelCheck] 成分列表核查失败: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="配料表核查失败，请稍后重试")


@router.get("/health", summary="配料表核查服务健康检查")
async def health_check():
    return {"status": "healthy", "service": "label-check"}


@router.get("/templates", summary="示例配料表模板（v2）")
async def get_templates():
    """返回内置示例配料表模板数组，供前端一键填入。"""
    return get_label_check_templates()


@router.get("/directory-stats", summary="内置目录规模统计（v2）")
async def get_directory_stats_api():
    """返回内置比对目录各条目数量。"""
    try:
        return get_directory_stats()
    except Exception as e:
        logger.error(f"[LabelCheck] 目录统计失败: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="目录统计获取失败，请稍后重试")
