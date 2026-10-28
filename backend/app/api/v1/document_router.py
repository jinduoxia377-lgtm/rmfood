"""
文档提取 API 路由

端点：
- POST /api/v1/documents/extract   — 上传文档并提取结构化数据
- GET  /api/v1/documents/schemas   — 查询文档字段定义
- GET  /api/v1/documents/health    — 健康检查
"""
import logging
from typing import Optional

from fastapi import APIRouter, Depends, File, Form, Query, UploadFile
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_db_session
from app.core.database.session import get_db
from app.models.document_extraction import DocumentExtraction
from app.models.peptide_batch_coa import COATestItem, PeptideBatchCOA
from app.models.user_model import User
from app.services.document_extractor.extractor import (
    DOCUMENT_FIELD_SCHEMAS,
    get_document_extractor,
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


class ExtractionSaveRequest(BaseModel):
    """保存提取结果（备案）请求体"""
    document_type: str = Field(..., pattern="^(coa|pds|sd)$", description="文档类型")
    ingredient_id: Optional[int] = Field(None, description="关联原料 ID")
    extracted_fields: dict = Field(default_factory=dict, description="提取字段 {key: {value,label,confidence}}")
    confidence_scores: dict = Field(default_factory=dict, description="字段置信度")
    inspection_items: list = Field(default_factory=list, description="检验明细 [{item,standard,result,judgment}]")
    overall_confidence: float = Field(0.0, ge=0, le=1, description="整体置信度 0-1")
    requires_review: bool = Field(False, description="是否需人工复核")
    raw_text_preview: Optional[str] = Field(None, description="原始文本预览")
    source_file_name: Optional[str] = Field(None, description="来源文件名")
    source_hash: Optional[str] = Field(None, description="原文哈希（去重）")


@router.post("/extractions", summary="保存提取结果（备案）")
async def save_extraction(
    req: ExtractionSaveRequest,
    db: AsyncSession = Depends(get_db_session),
    current_user: Optional[User] = Depends(get_current_user),
) -> dict:
    """将一次文档提取结果持久化到数据库，实现备案与后续调用。"""
    if not req.extracted_fields:
        return {"status": "error", "error": "extracted_fields 不能为空"}
    record = DocumentExtraction(
        document_type=req.document_type,
        ingredient_id=req.ingredient_id,
        extracted_fields=req.extracted_fields,
        confidence_scores=req.confidence_scores,
        inspection_items=req.inspection_items,
        overall_confidence=req.overall_confidence,
        requires_review=req.requires_review,
        raw_text_preview=req.raw_text_preview[:2000] if req.raw_text_preview else None,
        source_file_name=req.source_file_name,
        source_hash=req.source_hash,
        created_by=current_user.id if current_user else None,
    )
    db.add(record)
    await db.commit()
    await db.refresh(record)
    return {
        "status": "ok",
        "data": {
            "id": record.id,
            "document_type": record.document_type,
            "ingredient_id": record.ingredient_id,
            "overall_confidence": record.overall_confidence,
            "requires_review": record.requires_review,
            "field_count": len(record.extracted_fields or {}),
            "created_at": record.created_at.isoformat() if record.created_at else None,
        },
    }


@router.get("/extractions", summary="查询备案列表")
async def list_extractions(
    document_type: Optional[str] = Query(None, pattern="^(coa|pds|sd)$", description="按文档类型筛选"),
    ingredient_id: Optional[int] = Query(None, description="按原料 ID 筛选"),
    skip: int = Query(0, ge=0, description="跳过条数"),
    limit: int = Query(20, ge=1, le=100, description="返回条数"),
    db: AsyncSession = Depends(get_db_session),
    current_user: Optional[User] = Depends(get_current_user),
) -> dict:
    """查询已备案的文档提取记录（按时间倒序）。"""
    stmt = select(DocumentExtraction).order_by(DocumentExtraction.created_at.desc()).offset(skip).limit(limit)
    if document_type:
        stmt = stmt.where(DocumentExtraction.document_type == document_type)
    if ingredient_id is not None:
        stmt = stmt.where(DocumentExtraction.ingredient_id == ingredient_id)
    rows = (await db.execute(stmt)).scalars().all()
    return {
        "status": "ok",
        "data": [
            {
                "id": r.id,
                "document_type": r.document_type,
                "ingredient_id": r.ingredient_id,
                "product_name": (r.extracted_fields or {}).get("product_name", {}).get("value"),
                "overall_confidence": r.overall_confidence,
                "requires_review": r.requires_review,
                "field_count": len(r.extracted_fields or {}),
                "inspection_count": len(r.inspection_items or []),
                "source_file_name": r.source_file_name,
                "created_by": r.created_by,
                "created_at": r.created_at.isoformat() if r.created_at else None,
            }
            for r in rows
        ],
    }


class ExtractionUpdateRequest(BaseModel):
    """更新备案记录（人工复核后修正）请求体"""
    extracted_fields: dict = Field(default_factory=dict, description="提取字段 {key: {value,label,confidence}}")
    confidence_scores: dict = Field(default_factory=dict, description="字段置信度")
    inspection_items: list = Field(default_factory=list, description="检验明细")
    overall_confidence: float = Field(0.0, ge=0, le=1, description="整体置信度 0-1")
    requires_review: bool = Field(False, description="是否仍需人工复核")


@router.put("/extractions/{extraction_id}", summary="更新备案记录（复核后修正）")
async def update_extraction(
    extraction_id: int,
    req: ExtractionUpdateRequest,
    db: AsyncSession = Depends(get_db_session),
    current_user: Optional[User] = Depends(get_current_user),
) -> dict:
    """人工复核后，将修正的字段值写回已备案记录。"""
    record = await db.get(DocumentExtraction, extraction_id)
    if not record:
        return {"status": "error", "error": "备案记录不存在"}
    record.extracted_fields = req.extracted_fields
    record.confidence_scores = req.confidence_scores
    record.inspection_items = req.inspection_items
    record.overall_confidence = req.overall_confidence
    record.requires_review = req.requires_review
    await db.commit()
    await db.refresh(record)
    return {
        "status": "ok",
        "data": {
            "id": record.id,
            "document_type": record.document_type,
            "product_name": (record.extracted_fields or {}).get("product_name", {}).get("value"),
            "overall_confidence": record.overall_confidence,
            "requires_review": record.requires_review,
            "field_count": len(record.extracted_fields or {}),
            "inspection_count": len(record.inspection_items or []),
            "created_at": record.created_at.isoformat() if record.created_at else None,
        },
    }


@router.get("/extractions/{extraction_id}", summary="查询备案详情")
async def get_extraction(
    extraction_id: int,
    db: AsyncSession = Depends(get_db_session),
    current_user: Optional[User] = Depends(get_current_user),
) -> dict:
    """查询单条备案记录，含全部提取字段与置信度。"""
    record = await db.get(DocumentExtraction, extraction_id)
    if not record:
        return {"status": "error", "error": "备案记录不存在"}
    return {
        "status": "ok",
        "data": {
            "id": record.id,
            "document_type": record.document_type,
            "ingredient_id": record.ingredient_id,
            "product_name": (record.extracted_fields or {}).get("product_name", {}).get("value"),
            "extracted_fields": record.extracted_fields,
            "confidence_scores": record.confidence_scores,
            "inspection_items": record.inspection_items or [],
            "overall_confidence": record.overall_confidence,
            "requires_review": record.requires_review,
            "raw_text_preview": record.raw_text_preview,
            "source_file_name": record.source_file_name,
            "created_by": record.created_by,
            "created_at": record.created_at.isoformat() if record.created_at else None,
        },
    }


@router.delete("/extractions/{extraction_id}", summary="删除备案记录")
async def delete_extraction(
    extraction_id: int,
    db: AsyncSession = Depends(get_db_session),
    current_user: Optional[User] = Depends(get_current_user),
) -> dict:
    """删除一条备案记录。"""
    record = await db.get(DocumentExtraction, extraction_id)
    if not record:
        return {"status": "error", "error": "备案记录不存在"}
    await db.delete(record)
    await db.commit()
    return {"status": "ok", "deleted_id": extraction_id}


@router.post("/extractions/{extraction_id}/to-peptide-coa", summary="生成为食源性多肽质检档案")
async def to_peptide_coa(
    extraction_id: int,
    db: AsyncSession = Depends(get_db_session),
    current_user: Optional[User] = Depends(get_current_user),
) -> dict:
    """将备案记录写入专门的食源性多肽批次 COA 数据库（PeptideBatchCOA + COATestItem）。

    不匹配通用原料库，而是直接归档到多肽专用质检档案表。
    """
    from datetime import datetime as dt

    record = await db.get(DocumentExtraction, extraction_id)
    if not record:
        return {"status": "error", "error": "备案记录不存在"}

    ef = record.extracted_fields or {}

    def fval(field: str) -> Optional[str]:
        v = (ef.get(field) or {}).get("value")
        return str(v).strip() if v else None

    def parse_date(s: Optional[str]):
        if not s:
            return None
        try:
            cleaned = str(s).replace("年", "-").replace("月", "-").replace("日", "").strip()
            return dt.strptime(cleaned, "%Y-%m-%d")
        except Exception:
            try:
                return dt.strptime(str(s)[:10], "%Y-%m-%d")
            except Exception:
                return None

    conclusion_text = (fval("pass_fail") or "").lower()
    qualified = any(k in conclusion_text for k in ("合格", "符合", "pass", "conform", "qualifed", "qualified"))
    test_conclusion = (
        "合格" if qualified
        else ("不合格" if any(k in conclusion_text for k in ("不合格", "不符合", "fail")) else "待检")
    )

    coa = PeptideBatchCOA(
        product_name_cn=fval("product_name") or "未命名多肽产品",
        product_name_en=fval("product_name_en"),
        product_type=fval("product_type") or "其他食品",
        product_code=fval("product_code") or fval("code"),
        spec=fval("specification") or fval("spec"),
        batch_no=fval("batch_number") or "UNKNOWN",
        mfg_date=parse_date(fval("test_date") or fval("mfg_date")),
        expiry_date=parse_date(fval("expiry_date")),
        gb_standard=fval("gb_standard"),
        test_conclusion=test_conclusion,
        qualified=qualified,
        created_by=current_user.id if current_user else None,
    )
    db.add(coa)
    await db.flush()

    # 写入检验明细（COATestItem）
    for idx, item in enumerate(record.inspection_items or []):
        name = (item.get("item") or "").strip()
        if not name:
            continue
        name_l = name.lower()
        if any(k in name_l for k in ("菌落", "大肠", "沙门", "霉菌", "酵母", "微生物", "细菌")):
            category = "microbial"
        elif any(k in name_l for k in ("色泽", "性状", "感官", "外观", "气味", "滋味", "杂质", "包装", "标签", "净含量")):
            category = "sensory"
        else:
            category = "chemical"
        judgment_raw = (item.get("judgment") or "").strip()
        judgment = (
            "符合" if any(k in judgment_raw for k in ("符合", "conform", "pass", "合格"))
            else ("不符合" if any(k in judgment_raw for k in ("不符合", "fail")) else "待判定")
        )
        db.add(COATestItem(
            coa_id=coa.id,
            category=category,
            item_name=name,
            item_name_en=(item.get("item_en") or "").strip() or None,
            standard=(item.get("standard") or "").strip(),
            result=(item.get("result") or "").strip(),
            judgment=judgment,
            sort_order=idx,
        ))

    await db.commit()
    await db.refresh(coa)
    return {"status": "ok", "data": coa.to_dict()}
