"""
文档提取 API 路由

端点：
- POST /api/v1/documents/extract   — 上传文档并提取结构化数据
- GET  /api/v1/documents/schemas   — 查询文档字段定义
- GET  /api/v1/documents/health    — 健康检查
"""
import logging
from typing import List, Optional

from fastapi import APIRouter, Depends, UploadFile, File, Form
from pydantic import BaseModel, Field

from app.core.database.session import get_db
from app.services.document_extractor.extractor import (
    DocumentExtractor,
    get_document_extractor,
    DOCUMENT_FIELD_SCHEMAS,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/documents", tags=["Document Extractor"])


class ExtractRequest(BaseModel):
    document_type: str = Field(..., pattern="^(coa|pds|sd)$", description="文档类型")
    ingredient_id: Optional[int] = Field(None, description="关联食材 ID")


class ExtractResponse(BaseModel):
    status: str
    data: dict


@router.post("/extract", summary="提取文档结构化数据", response_model=ExtractResponse)
async def extract_document(
    file: UploadFile = File(..., description="文档文件（PDF/DOCX/TXT）"),
    document_type: str = Form("coa", description="文档类型 coa/pds/sd"),
    ingredient_id: Optional[int] = Form(None, description="关联食材 ID"),
    db=Depends(get_db),
) -> dict:
    """
    上传供应商文档（CoA/PDS/SD），自动提取结构化字段。

    form 字段：file（文档）、document_type（coa|pds|sd）、ingredient_id（可选）

    返回提取提案，低置信度字段标记为需要人工审核。
    """
    if document_type not in ("coa", "pds", "sd"):
        return {"status": "error", "error": f"Unknown document type: {document_type}"}

    if not file.filename:
        return {"status": "error", "error": "No file provided"}

    document_bytes = await file.read()
    if len(document_bytes) == 0:
        return {"status": "error", "error": "Empty file"}

    extractor = get_document_extractor()

    try:
        result = await extractor.extract(
            document_bytes=document_bytes,
            document_type=document_type,
            ingredient_id=ingredient_id,
        )
        return {"status": "ok", "data": result}
    except Exception as e:
        logger.exception("Document extraction failed")
        return {"status": "error", "error": str(e)}


class ExtractTextRequest(BaseModel):
    text: str = Field(..., description="文档文本内容")
    document_type: str = Field("coa", pattern="^(coa|pds|sd)$")
    ingredient_id: Optional[int] = Field(None, description="关联食材 ID")


@router.post("/extract/text", summary="从纯文本提取字段")
async def extract_from_text(
    req: ExtractTextRequest,
    db=Depends(get_db),
) -> dict:
    """直接从文本提取字段（无需上传文件）"""
    extractor = get_document_extractor()
    document_bytes = req.text.encode("utf-8")

    try:
        result = await extractor.extract(
            document_bytes=document_bytes,
            document_type=req.document_type,
            ingredient_id=req.ingredient_id,
        )
        return {"status": "ok", "data": result}
    except Exception as e:
        return {"status": "error", "error": str(e)}


@router.get("/schemas", summary="查询文档字段定义")
async def get_schemas() -> dict:
    """返回各文档类型的字段定义 Schema"""
    return {
        "status": "ok",
        "schemas": {
            doc_type: [
                {"field": f["field"], "label": f["label"], "type": f["type"], "required": f["required"]}
                for f in fields
            ]
            for doc_type, fields in DOCUMENT_FIELD_SCHEMAS.items()
        },
    }


@router.get("/health", summary="文档提取服务健康检查")
async def health_check() -> dict:
    return {
        "status": "healthy",
        "service": "document-extractor",
        "supported_types": list(DOCUMENT_FIELD_SCHEMAS.keys()),
        "total_fields": sum(len(v) for v in DOCUMENT_FIELD_SCHEMAS.values()),
        "note": "Requires pdfminer.six / python-docx for full document parsing",
    }
