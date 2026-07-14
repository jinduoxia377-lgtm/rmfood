"""RAG 知识库 API 路由

v2.0 (2026-07-06): 增强文档版本管理和多格式支持
"""

import logging
import hashlib
from fastapi import APIRouter, UploadFile, File, HTTPException

from ..services.ai.rag.rag_service import rag_service
from ..services.ai.rag.document_version_manager import DocumentVersionManager, DocumentVersion
from ..services.ai.rag.seeder import seed_if_needed
from datetime import datetime, timezone

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/rag", tags=["RAG知识库"])

# 文档版本管理器
_version_mgr = DocumentVersionManager()

# 允许的 MIME 类型（扩展）
ALLOWED_CONTENT_TYPES = {
    "application/pdf",
    "text/plain",
    "text/csv",
    "text/markdown",
    "text/html",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",  # docx
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",  # xlsx
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",  # pptx
    "application/octet-stream",
}

MAX_FILE_SIZE = 50 * 1024 * 1024  # 50MB


@router.post("/upload", summary="上传文档到知识库")
async def upload_document(
    file: UploadFile = File(..., description="文档文件 (PDF/TXT/CSV/MD/DOCX/XLSX/PPTX/HTML)"),
):
    """上传文档到知识库，支持多格式和版本管理"""
    content = await file.read()

    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(status_code=413, detail=f"文件大小超过 50MB 限制")

    try:
        # 计算文件哈希
        checksum = hashlib.sha256(content).hexdigest()[:16]

        # 导入文档
        doc_info = await rag_service.ingest_document(content, file.filename or "unknown")

        # 创建版本记录
        version = DocumentVersion(
            id="",
            version=0,
            filename=doc_info.filename,
            content_type=doc_info.content_type,
            chunk_count=doc_info.chunk_count,
            file_size=doc_info.file_size,
            created_at=datetime.now(timezone.utc),
            checksum=checksum,
        )
        _version_mgr.add_version(version)

        doc_info.checksum = checksum
        logger.info("文档导入成功: %s (%d 个分块, checksum=%s)", doc_info.filename, doc_info.chunk_count, checksum)
        return doc_info
    except ValueError as e:
        logger.error("参数无效: %s", e, exc_info=True)
        raise HTTPException(status_code=400, detail="参数无效")
    except Exception as e:
        logger.error("文档导入失败: %s", e, exc_info=True)
        raise HTTPException(status_code=500, detail="服务器内部错误，请稍后重试")


@router.get("/documents", summary="列出知识库中的文档（含版本信息）")
async def list_documents():
    """返回知识库中所有文档及版本历史"""
    docs = rag_service.list_documents()
    result = []
    for filename in docs:
        versions = _version_mgr.get_all_versions(filename)
        latest = _version_mgr.get_latest(filename)
        result.append({
            "filename": filename,
            "latest_version": latest.version if latest else 0,
            "total_versions": len(versions),
            "chunks": latest.chunk_count if latest else 0,
            "created_at": latest.created_at.isoformat() if latest else None,
        })
    return {"documents": result}


@router.get("/documents/{filename}/versions", summary="获取文档版本历史")
async def get_document_versions(filename: str):
    """查询指定文档的版本历史"""
    versions = _version_mgr.get_all_versions(filename)
    if not versions:
        raise HTTPException(status_code=404, detail=f"文档不存在: {filename}")
    return {
        "filename": filename,
        "versions": [
            {
                "version": v.version,
                "chunks": v.chunk_count,
                "file_size": v.file_size,
                "created_at": v.created_at.isoformat(),
                "metadata": v.metadata,
            }
            for v in versions
        ],
    }


@router.delete("/documents/{filename:path}", summary="从知识库删除文档")
async def delete_document(filename: str):
    """从向量库中删除指定文档的所有分块和版本"""
    rag_service.delete_document(filename)
    _version_mgr._versioned_docs.pop(filename, None)
    return {"status": "deleted", "filename": filename}


@router.get("/stats", summary="知识库统计")
async def get_stats():
    """返回知识库统计信息（含版本统计）"""
    rag_stats = rag_service.get_stats()
    return {
        **rag_stats,
        "document_count": _version_mgr.get_document_count(),
        "total_versions": _version_mgr.get_total_versions(),
    }


@router.post("/query", summary="RAG 知识库问答")
async def query_rag(
    question: str,
    top_k: int = 5,
):
    """基于知识库内容回答问题"""
    if not question or not question.strip():
        raise HTTPException(status_code=400, detail="问题不能为空")

    result = await rag_service.augment_query(question.strip(), top_k=top_k)
    return {
        "chunks": [
            {
                "content": c.chunk.content,
                "source": c.chunk.metadata.get("source", "unknown"),
                "score": round(c.score, 4),
                "section": c.chunk.metadata.get("section", ""),
            }
            for c in result.chunks
        ],
        "augmented_prompt": result.augmented_prompt,
        "total_chunks": result.total_chunks,
    }


@router.post("/seed", summary="注入内置知识库种子")
async def seed_knowledge_base():
    """手动触发内置知识库种子注入（幂等操作）"""
    try:
        result = await seed_if_needed()
        return result
    except Exception as e:
        logger.error("种子注入失败: %s", e, exc_info=True)
        raise HTTPException(status_code=500, detail="服务器内部错误，请稍后重试")


@router.get("/seed/status", summary="查询种子注入状态")
async def get_seed_status():
    """查询知识库种子注入状态"""
    stats = rag_service.get_stats()
    is_seeded = stats.get("total_chunks", 0) > 0
    return {
        "is_seeded": is_seeded,
        "total_chunks": stats.get("total_chunks", 0),
        "documents": stats.get("documents", []),
    }


@router.get("/audit-log", summary="知识库操作审计日志")
async def get_audit_log(
    filename: str | None = None,
    limit: int = 50,
):
    """查询知识库操作审计日志"""
    logs = _version_mgr.get_audit_log(filename, limit)
    return {"logs": logs, "total": len(logs)}
