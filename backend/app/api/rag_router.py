"""RAG 知识库 API 路由

提供文档上传、检索、管理等相关端点。
"""

import logging
from fastapi import APIRouter, UploadFile, File, HTTPException

from app.services.ai.rag.rag_service import rag_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/rag", tags=["RAG知识库"])

# 允许的 MIME 类型
ALLOWED_CONTENT_TYPES = {
    "application/pdf",
    "text/plain",
    "text/csv",
    "text/markdown",
    "application/octet-stream",  # 某些系统未识别时
}

MAX_FILE_SIZE = 20 * 1024 * 1024  # 20MB


@router.post("/upload", summary="上传文档到知识库")
async def upload_document(
    file: UploadFile = File(..., description="文档文件 (PDF/TXT/CSV/MD)"),
):
    """上传文档到知识库

    自动执行：文本提取 → 分块 → 向量化 → 存储。
    支持格式：PDF、TXT、CSV、Markdown。
    大小限制：20MB。
    """
    content = await file.read()

    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=413,
            detail=f"文件大小超过 20MB 限制（当前: {len(content) / 1024 / 1024:.1f}MB）",
        )

    try:
        doc_info = await rag_service.ingest_document(content, file.filename or "unknown")
        logger.info("文档导入成功: %s (%d 个分块)", doc_info.filename, doc_info.chunk_count)
        return doc_info
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error("文档导入失败: %s", e, exc_info=True)
        raise HTTPException(status_code=500, detail=f"文档处理失败: {str(e)}")


@router.get("/documents", summary="列出知识库中的文档")
async def list_documents():
    """返回知识库中所有文档的文件名列表"""
    return {"documents": rag_service.list_documents()}


@router.delete("/documents/{filename:path}", summary="从知识库删除文档")
async def delete_document(filename: str):
    """从向量库中删除指定文档的所有分块"""
    rag_service.delete_document(filename)
    return {"status": "deleted", "filename": filename}


@router.get("/stats", summary="知识库统计")
async def get_stats():
    """返回知识库统计信息"""
    return rag_service.get_stats()


@router.post("/query", summary="RAG 知识库问答")
async def query_rag(
    question: str,
    top_k: int = 5,
):
    """基于知识库内容回答问题

    通过向量检索找到相关文档块，并返回增强后的上下文。
    """
    if not question or not question.strip():
        raise HTTPException(status_code=400, detail="问题不能为空")

    result = await rag_service.augment_query(question.strip(), top_k=top_k)
    return {
        "chunks": [
            {
                "content": c.chunk.content,
                "source": c.chunk.metadata.get("source", "unknown"),
                "score": round(c.score, 4),
            }
            for c in result.chunks
        ],
        "augmented_prompt": result.augmented_prompt,
        "total_chunks": result.total_chunks,
    }
