"""RAG 知识库 API 路由

v2.0 (2026-07-06): 增强文档版本管理和多格式支持
"""

import hashlib
import logging
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from sqlalchemy.ext.asyncio import AsyncSession

from ..services.ai.rag.document_version_manager import DocumentVersion, DocumentVersionManager
from ..services.ai.rag.rag_service import rag_service
from ..services.ai.rag.seeder import SEED_DOCUMENT_NAMES, seed_if_needed
from .deps import get_current_active_user, get_db_session

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
    current_user=Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db_session),
):
    """上传文档到知识库，支持多格式和版本管理"""
    content = await file.read()

    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(status_code=413, detail="文件大小超过 50MB 限制")

    try:
        # 计算文件哈希
        checksum = hashlib.sha256(content).hexdigest()[:16]

        # 导入文档（注入 user_id 实现租户隔离）
        user_id = str(current_user.id) if hasattr(current_user, 'id') else "system"
        doc_info = await rag_service.ingest_document(content, file.filename or "unknown", user_id=user_id)

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

        # 持久化到数据库
        await _version_mgr.sync_to_db(db)

        # 🔧 修复（2026-10-28）：DocumentInfo（services/ai/rag/models.py:29-36）无 checksum 字段，
        # 直接赋值抛 ValueError 被 except ValueError 捕获 → 上传误返回 400（文档/版本其实已入库）。
        # 改为防御式赋值：字段存在才写入（checksum 已随 DocumentVersion 落库）。
        if hasattr(doc_info, "checksum"):
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
async def list_documents(current_user=Depends(get_current_active_user)):
    """返回知识库中当前租户可见的文档及版本历史（含公共种子库）"""
    user_id = str(current_user.id) if hasattr(current_user, 'id') else "system"
    docs = rag_service.list_documents(user_id=user_id)
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
async def get_document_versions(filename: str, current_user=Depends(get_current_active_user)):
    """查询指定文档的版本历史（需认证）"""
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
async def delete_document(
    filename: str,
    current_user=Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db_session),
):
    """从向量库中删除指定文档的所有分块和版本"""
    # P0-5：种子库（user_id="system"）为公共知识库，任何租户禁止删除。
    # 即使绕过此守卫，vector_store.delete_by_source 的 where 只匹配用户自己的
    # user_id（不带 "system"），对种子 source 删除也为「无效果」——双保险。
    if filename in SEED_DOCUMENT_NAMES:
        raise HTTPException(
            status_code=403,
            detail=f"种子库文档 {filename} 为公共知识库，禁止删除",
        )
    user_id = str(current_user.id) if hasattr(current_user, 'id') else "system"
    rag_service.delete_document(filename, user_id=user_id)
    _version_mgr._versioned_docs.pop(filename, None)
    # 持久化删除操作
    await _version_mgr.sync_to_db(db)
    return {"status": "deleted", "filename": filename}


@router.get("/stats", summary="知识库统计")
async def get_stats(current_user=Depends(get_current_active_user)):
    """返回知识库统计信息（含版本统计）"""
    user_id = str(current_user.id) if hasattr(current_user, 'id') else "system"
    rag_stats = rag_service.get_stats(user_id=user_id)
    return {
        **rag_stats,
        "document_count": _version_mgr.get_document_count(),
        "total_versions": _version_mgr.get_total_versions(),
    }


@router.post(
    "/query",
    summary="RAG 知识库问答（已废弃，请改用 /search）",
    deprecated=True,
)
async def query_rag(
    question: str,
    top_k: int = 5,
    current_user=Depends(get_current_active_user),
):
    """基于知识库内容回答问题（带租户隔离）。

    ⚠️ 已废弃（deprecated）：请改用 ``POST /rag/search``，二者调用同一检索逻辑。
    P2-4 收敛：保留本端点仅为兼容前端 ``queryRAG`` 的平铺返回形态
    （chunks / augmented_prompt / total_chunks 直接位于顶层），并新增冗余字段
    ``total_chunks_indexed`` 以与 ``/rag/search`` 统一字段命名。
    """
    if not question or not question.strip():
        raise HTTPException(status_code=400, detail="问题不能为空")

    # P2-4：复用 /search 的检索逻辑（唯一检索端点），保证两端点字段一致、
    # 租户隔离一致（user_id 取自 token）。
    data = (
        await search_rag(
            question=question.strip(),
            top_k=top_k,
            current_user=current_user,
        )
    )["data"]
    # 平铺形态（前端 queryRAG 依赖），并补齐统一命名 total_chunks_indexed。
    return {
        "chunks": data["chunks"],
        "augmented_prompt": data["augmented_prompt"],
        "total_chunks": data["total_chunks_indexed"],
        "total_chunks_indexed": data["total_chunks_indexed"],
    }


@router.post("/seed", summary="注入内置知识库种子")
async def seed_knowledge_base(current_user = Depends(get_current_active_user)):
    """手动触发内置知识库种子注入（幂等操作）"""
    try:
        result = await seed_if_needed()
        if not result.get('seeded', False) and result.get('errors'):
            # 种子注入失败时返回明确错误，避免前端误认为成功
            raise HTTPException(
                status_code=503,
                detail=f"种子注入失败: {result['errors'][0]}" if isinstance(result.get('errors'), list) else "种子注入失败",
            )
        return result
    except HTTPException:
        # 🔧 修复（2026-10-28）：保持 503 语义。此前 raise HTTPException(503)（种子注入失败）
        # 被下方 except Exception 吞并改写为 500，前端 triggerSeed 依赖 503 判断 embedding 不可用。
        raise
    except Exception as e:
        logger.error("种子注入失败: %s", e, exc_info=True)
        raise HTTPException(status_code=500, detail="服务器内部错误，请稍后重试")


@router.get("/seed/status", summary="查询种子注入状态")
async def get_seed_status(current_user=Depends(get_current_active_user)):
    """查询知识库种子注入状态（需认证）

    P0-5 联动：get_stats(user_id) 按「自己的 + system 种子」的可见性统计，
    因此 is_seeded 能正确识别已注入的种子（system 对租户可见），且不会
    泄露其他租户的文档名。种子注入为全局操作，但状态查询按调用方可见范围返回。
    """
    from ..services.ai.rag.seeder import SEED_DOCUMENT_NAMES
    user_id = str(current_user.id) if hasattr(current_user, 'id') else "system"
    stats = rag_service.get_stats(user_id=user_id)
    existing_sources = set(stats.get("documents", []) or [])
    is_seeded = SEED_DOCUMENT_NAMES.issubset(existing_sources)
    return {
        "is_seeded": is_seeded,
        "total_chunks": stats.get("total_chunks", 0),
        "documents": stats.get("documents", []),
    }


@router.get("/audit-log", summary="知识库操作审计日志")
async def get_audit_log(
    current_user=Depends(get_current_active_user),
    filename: str | None = None,
    limit: int = 50,
):
    """查询知识库操作审计日志（需认证）"""
    logs = _version_mgr.get_audit_log(filename, limit)
    return {"logs": logs, "total": len(logs)}


@router.post("/search", summary="直接搜索 RAG 知识库")
async def search_rag(
    question: str,
    top_k: int = Query(5, ge=1, le=20, description="返回结果数量"),
    current_user=Depends(get_current_active_user),
):
    """
    直接搜索知识库，不经过 Agent。
    适合需要快速获取检索结果的场景。

    P0-1 修复：强制认证 + user_id 取自 token（删除客户端可控的 Query 参数），
    杜绝任意未登录调用者传任意 user_id 检索他人知识库的跨租户泄露。
    """
    if not question or not question.strip():
        raise HTTPException(status_code=400, detail="问题不能为空")

    user_id = str(current_user.id) if hasattr(current_user, 'id') else "system"
    result = await rag_service.augment_query(question.strip(), top_k=top_k, user_id=user_id)
    return {
        "success": True,
        "data": {
            "question": question.strip(),
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
            "total_chunks_indexed": result.total_chunks,
        },
    }


# ═══════════════════════════════════════════════════
# 缓存管理端点
# ═══════════════════════════════════════════════════

@router.get("/cache/stats", summary="嵌入缓存统计")
async def get_cache_stats(current_user=Depends(get_current_active_user)):
    """获取嵌入缓存统计信息（需认证）"""
    return rag_service.embedding_service.cache_stats()


@router.post("/cache/clear", summary="清空嵌入缓存")
async def clear_cache(current_user=Depends(get_current_active_user)):
    """清空嵌入向量缓存"""
    rag_service.embedding_service.clear_cache()
    return {"success": True, "message": "嵌入缓存已清空"}
