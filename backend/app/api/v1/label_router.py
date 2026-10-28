"""
标签生成 API 路由

端点：
- POST /api/v1/labels/generate  — 生成条码/QR 标签
- GET  /api/v1/labels/preview    — 预览标签配置
- GET  /api/v1/labels/health     — 健康检查
"""
import logging
from typing import Literal, Optional

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response
from pydantic import BaseModel, Field

from app.core.database.session import get_db
from app.services.label_generator.generator import (
    LABEL_SIZES,
    get_label_generator,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/labels", tags=["Label Generator"])


class GenerateLabelRequest(BaseModel):
    entity_type: Literal["batch", "sample", "ingredient", "equipment"]
    entity_id: int = Field(..., ge=1)
    entity_name: str = Field(..., min_length=1, max_length=100)
    label_size: Literal["small", "medium", "large"] = "medium"
    format: Literal["code128", "qr", "both"] = "both"
    output_format: Literal["png", "svg"] = "png"


class GenerateLabelResponse(BaseModel):
    status: str
    format: str          # "png" | "svg"
    size: str
    entity_type: str
    entity_id: int
    mime_type: str
    download_url: Optional[str] = None  # 暂不支持文件存储


@router.post("/generate", summary="生成条码/QR 标签", response_model=GenerateLabelResponse)
async def generate_label(
    req: GenerateLabelRequest,
    db=Depends(get_db),
) -> Response:
    """
    为指定实体生成条码/QR 标签

    - entity_type: 实体类型（batch/sample/ingredient/equipment）
    - entity_id: 实体 ID
    - entity_name: 实体显示名称
    - label_size: 标签尺寸（small/medium/large）
    - format: 条码类型（code128/qr/both）
    - output_format: 输出格式（png/svg）
    """
    generator = get_label_generator()

    try:
        if req.output_format == "svg":
            svg_bytes = await generator.generate_label_svg(
                entity_type=req.entity_type,
                entity_id=req.entity_id,
                entity_name=req.entity_name,
                label_size=req.label_size,
                format=req.format,
            )
            return Response(
                content=svg_bytes.encode("utf-8"),
                media_type="image/svg+xml",
                headers={"Content-Disposition": f'inline; filename="label_{req.entity_id}.svg"'},
            )
        else:
            png_bytes = await generator.generate_label(
                entity_type=req.entity_type,
                entity_id=req.entity_id,
                entity_name=req.entity_name,
                label_size=req.label_size,
                format=req.format,
            )
            return Response(
                content=png_bytes,
                media_type="image/png",
                headers={"Content-Disposition": f'inline; filename="label_{req.entity_id}.png"'},
            )
    except ImportError as e:
        raise HTTPException(status_code=503, detail=f"Label generation service unavailable: {e}")
    except Exception as e:
        logger.exception("Label generation failed")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/preview", summary="预览标签配置（生成 PNG 并返回 data URL 供前端直接显示）")
async def preview_label(
    entity_type: Literal["batch", "sample", "ingredient", "equipment"] = "batch",
    entity_id: int = 1,
    entity_name: str = "预览实体",
    label_size: Literal["small", "medium", "large"] = "medium",
    format: Literal["code128", "qr", "both"] = "both",
) -> dict:
    """
    生成标签 PNG 并返回 base64 data URL，供前端 `<img>` 直接预览，
    无需下载字节流。配置与 /generate 完全一致。

    返回结构：{ status: "ok", data: { data_url, mime_type, width_px, height_px, ... } }
    """
    import base64

    generator = get_label_generator()
    try:
        png_bytes = await generator.generate_label(
            entity_type=entity_type,
            entity_id=entity_id,
            entity_name=entity_name,
            label_size=label_size,
            format=format,
        )
    except ImportError as e:
        raise HTTPException(status_code=503, detail=f"Label generation service unavailable: {e}")

    data_url = f"data:image/png;base64,{base64.b64encode(png_bytes).decode('ascii')}"
    size_cfg = LABEL_SIZES.get(label_size, LABEL_SIZES["medium"])
    return {
        "status": "ok",
        "data": {
            "data_url": data_url,
            "mime_type": "image/png",
            "width_px": size_cfg["width"],
            "height_px": size_cfg["height"],
            "qr_size_px": size_cfg["qr_size"],
            "entity_type": entity_type,
            "entity_id": entity_id,
            "entity_name": entity_name,
            "format": format,
        },
    }


@router.get("/sizes", summary="查询可用标签尺寸")
async def list_sizes() -> dict:
    return {
        "status": "ok",
        "sizes": {
            k: {"width_px": v["width"], "height_px": v["height"], "qr_size_px": v["qr_size"]}
            for k, v in LABEL_SIZES.items()
        },
    }


@router.get("/health", summary="标签服务健康检查")
async def health_check() -> dict:
    try:
        gen = get_label_generator()
        gen._ensure_deps()
        return {"status": "healthy", "service": "label-generator", "deps": ["barcode", "qrcode", "pillow"]}
    except ImportError as e:
        return {"status": "degraded", "service": "label-generator", "error": str(e)}
