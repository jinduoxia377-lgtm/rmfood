"""RAG 知识库 API 路由

v2.0 (2026-07-06): 增强文档版本管理和多格式支持
"""

import hashlib
import logging
import math
import os
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from ..core.security.secure_upload import DANGEROUS_EXTENSIONS
from ..models.rag_knowledge_source import RagKnowledgeSource
from ..services.ai.rag.document_version_manager import DocumentVersion, DocumentVersionManager
from ..services.ai.rag.rag_service import rag_service
from ..services.ai.rag.rate_limiter import get_rate_limiter
from ..services.ai.rag.seeder import SEED_DOCUMENT_NAMES, seed_if_needed
from ..services.ai.rag.source_display import get_display_name
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
_READ_CHUNK_SIZE = 1024 * 1024  # 流式读取分块大小（1MB）

# P1-2：RAG 检索限流配置（参考 .env.rag.example 默认值）
RAG_RATE_LIMIT_ENABLED = os.getenv("RAG_RATE_LIMIT_ENABLED", "true").lower() in ("1", "true", "yes")
RAG_RATE_LIMIT_CAPACITY = int(os.getenv("RAG_RATE_LIMIT_CAPACITY", "100"))
RAG_RATE_LIMIT_REFILL_RATE = float(os.getenv("RAG_RATE_LIMIT_REFILL_RATE", "10.0"))
RAG_RATE_LIMIT_WINDOW = int(os.getenv("RAG_RATE_LIMIT_WINDOW", "60"))

_rag_limiter = get_rate_limiter(
    default_capacity=RAG_RATE_LIMIT_CAPACITY,
    default_refill_rate=RAG_RATE_LIMIT_REFILL_RATE,
    default_window=RAG_RATE_LIMIT_WINDOW,
)


async def _read_upload_stream(file: UploadFile, max_size: int) -> bytes:
    """流式读取上传文件，累计超过 max_size 立即抛 413。

    P1-1：原先 ``await file.read()`` 会把整个文件读入内存后才检查 50MB 上限，
    超大文件可导致内存耗尽（OOM DoS）。改为逐块读取（1MB），累计超限立即拒绝。
    """
    chunks: list[bytes] = []
    total = 0
    while True:
        chunk = await file.read(_READ_CHUNK_SIZE)
        if not chunk:
            break
        total += len(chunk)
        if total > max_size:
            raise HTTPException(status_code=413, detail="文件大小超过 50MB 限制")
        chunks.append(chunk)
    return b"".join(chunks)


@router.post("/upload", summary="上传文档到知识库")
async def upload_document(
    file: UploadFile = File(..., description="文档文件 (PDF/TXT/CSV/MD/DOCX/XLSX/PPTX/HTML)"),
    current_user=Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db_session),
):
    """上传文档到知识库，支持多格式和版本管理"""
    # P1-1：Content-Type 白名单校验（忽略 charset 等参数；application/octet-stream 兼容浏览器兜底）
    raw_content_type = file.content_type or ""
    content_type = raw_content_type.split(";")[0].strip().lower()
    if content_type not in ALLOWED_CONTENT_TYPES:
        raise HTTPException(status_code=415, detail=f"不支持的文件类型: {raw_content_type}")

    # P1-1：危险扩展名黑名单校验（复用 secure_upload 既有规则）
    filename = file.filename or "unknown"
    _, ext = os.path.splitext(filename.lower())
    if ext in DANGEROUS_EXTENSIONS:
        raise HTTPException(status_code=415, detail=f"不支持的文件类型: {ext}")

    # P1-1：流式读取，超过 50MB 立即 413，避免超大文件整读导致 OOM
    content = await _read_upload_stream(file, MAX_FILE_SIZE)

    try:
        # 计算文件哈希
        checksum = hashlib.sha256(content).hexdigest()[:16]

        # 导入文档（注入 user_id 实现租户隔离）
        user_id = str(current_user.id) if hasattr(current_user, 'id') else "system"
        doc_info = await rag_service.ingest_document(content, filename, user_id=user_id)

        # 创建版本记录（P1-4：记录 user_id 归属，跨租户隔离）
        version = DocumentVersion(
            id="",
            version=0,
            filename=doc_info.filename,
            content_type=doc_info.content_type,
            chunk_count=doc_info.chunk_count,
            file_size=doc_info.file_size,
            created_at=datetime.now(timezone.utc),
            checksum=checksum,
            user_id=user_id,
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


# ═══════════════════════════════════════════════════
# 文档列表增强（2026-11-06）：分类 / 展示名 / 古籍元数据 / 过滤排序分页
# ═══════════════════════════════════════════════════

# 文档分类：seed（内置种子库）/ ancient_book（本草古籍）/ upload（用户上传）
CATEGORY_SEED = "seed"
CATEGORY_ANCIENT_BOOK = "ancient_book"
CATEGORY_UPLOAD = "upload"

# 古籍 source 前缀（与 source_display.ANCIENT_BOOK_DISPLAY_NAMES 的键一致）
_ANCIENT_SOURCE_PREFIX = "ancient/"

# 允许的排序方式：name（展示名升序）/ chunks_desc（分块数降序）/ updated_desc（更新时间降序）
_RAG_DOCUMENT_SORT_PATTERN = "^(name|chunks_desc|updated_desc)$"


def _classify_rag_document(source: str) -> str:
    """判定文档分类（不查库，纯规则）。

    - source 命中内置种子库文件名 → seed
    - source 以 ``ancient/`` 开头 → ancient_book
    - 其余 → upload（用户上传）
    """
    if source in SEED_DOCUMENT_NAMES:
        return CATEGORY_SEED
    if source.startswith(_ANCIENT_SOURCE_PREFIX):
        return CATEGORY_ANCIENT_BOOK
    return CATEGORY_UPLOAD


def _iso_or_none(value) -> str | None:
    """datetime → ISO 字符串（None 或其他类型返回 None，保证 JSON 可序列化）"""
    return value.isoformat() if isinstance(value, datetime) else None


@router.get("/documents", summary="列出知识库中的文档（含版本、展示名与分类）")
async def list_documents(
    q: str | None = Query(None, description="按展示名/文件名模糊过滤（不区分大小写）"),
    category: str | None = Query(
        None,
        pattern="^(seed|ancient_book|upload)$",
        description="按分类过滤：seed（种子库）/ ancient_book（本草古籍）/ upload（用户上传）",
    ),
    sort: str = Query(
        "name",
        pattern=_RAG_DOCUMENT_SORT_PATTERN,
        description="排序：name（展示名升序）/ chunks_desc（分块数降序）/ updated_desc（更新时间降序）",
    ),
    page: int = Query(1, ge=1, description="页码，从 1 开始（page_size=0 时忽略）"),
    page_size: int = Query(
        0, ge=0, le=500, description="每页条数；0 表示不分页（返回全部，保持旧行为）"
    ),
    current_user=Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db_session),
):
    """返回知识库中当前租户可见的文档及版本历史（含公共种子库与本草古籍）。

    向后兼容：不带任何查询参数时返回全部文档；``documents`` 每项保留原有 5 个字段
    （filename / latest_version / total_versions / chunks / created_at），并新增：
    display_name / category / dynasty / author / is_protected / updated_at / size_bytes。

    - ``display_name``：古籍/种子取自 ``get_display_name``（专业专有名称），上传文档为友好文件名
    - ``category``：seed / ancient_book / upload
    - ``dynasty`` / ``author``：仅古籍，来自 ``rag_knowledge_sources``（一次批量查询，无 N+1）
    - ``is_protected``：seed 或 ancient_book 为 True（租户不可删除）
    - ``updated_at``：古籍取书目表 updated_at；上传取最新版本 created_at；种子取版本时间（无则 null）
    - ``size_bytes``：最新版本文件大小（无版本记录时为 null）

    顶层 ``summary`` 为**全库口径**（不受 q/category 过滤影响），便于前端展示分类计数：
    ``{seed, ancient_book, upload, total_chunks}``。
    ``page_size > 0`` 时额外返回 ``total``（过滤后总数）/ ``page`` / ``page_size``。
    """
    user_id = str(current_user.id) if hasattr(current_user, 'id') else "system"
    docs = rag_service.list_documents(user_id=user_id)
    # 一次取齐当前租户全部版本（内存字典），避免逐个文档查询
    versions_by_doc = _version_mgr.get_all_documents(user_id=user_id)

    # 1) 古籍元数据：单次批量查询（where source in (...)，避免 N+1）
    ancient_sources = [src for src in docs if src.startswith(_ANCIENT_SOURCE_PREFIX)]
    meta_by_source: dict[str, RagKnowledgeSource] = {}
    if ancient_sources:
        try:
            rows = (
                await db.execute(
                    select(RagKnowledgeSource).where(
                        RagKnowledgeSource.source.in_(ancient_sources)
                    )
                )
            ).scalars().all()
            meta_by_source = {row.source: row for row in rows}
        except Exception as e:
            # 书目元数据查询失败不应令文档列表整体 500：降级为无朝代/作者
            logger.warning("批量查询古籍元数据失败（降级为无元数据）: %s", e)

    items: list[dict] = []
    for filename in docs:
        versions = versions_by_doc.get(filename, [])
        latest = versions[-1] if versions else None
        doc_category = _classify_rag_document(filename)
        meta = meta_by_source.get(filename)

        chunks = latest.chunk_count if latest else 0
        # 古籍分块数以书目表为准（导入时统计，比内存版本记录更准）；为 0 时回退版本信息
        if meta is not None and (meta.chunk_count or 0) > 0:
            chunks = meta.chunk_count

        display_name = get_display_name(filename) or (meta.display_name if meta else "") or filename

        if doc_category == CATEGORY_ANCIENT_BOOK and meta is not None:
            dynasty = meta.dynasty
            author = meta.author
            updated_at = _iso_or_none(meta.updated_at)
        else:
            dynasty = None
            author = None
            updated_at = _iso_or_none(latest.created_at) if latest else None

        items.append({
            # ── 原有字段（向后兼容）──
            "filename": filename,
            "latest_version": latest.version if latest else 0,
            "total_versions": len(versions),
            "chunks": chunks,
            "created_at": _iso_or_none(latest.created_at) if latest else None,
            # ── 新增字段 ──
            "display_name": display_name,
            "category": doc_category,
            "dynasty": dynasty,
            "author": author,
            "is_protected": doc_category in (CATEGORY_SEED, CATEGORY_ANCIENT_BOOK),
            "updated_at": updated_at,
            "size_bytes": latest.file_size if latest else None,
        })

    # 1.5) 回填分块数：种子库/上传文档没有版本记录时 chunks 为 0，
    # 用向量库按来源统计（SQLite 直查，毫秒级）补齐，保证前端展示准确。
    try:
        source_counts = rag_service.vector_store.counts_by_source(user_id=user_id)
    except Exception as e:  # noqa: BLE001
        logger.warning("按来源统计分块数失败（保留原值）: %s", e)
        source_counts = {}
    if source_counts:
        for item in items:
            if not item.get("chunks"):
                item["chunks"] = int(source_counts.get(item["filename"], 0))

    # 2) summary：全库口径分类计数（不受 q/category 影响）
    summary = {"seed": 0, "ancient_book": 0, "upload": 0, "total_chunks": 0}
    for item in items:
        summary[item["category"]] += 1
    # total_chunks 以向量库真实可见块数为准（与 /rag/stats 一致，种子库无版本记录也能计入）；
    # 统计失败时回退为按文档分块数求和，保证接口可用。
    try:
        summary["total_chunks"] = int(
            rag_service.get_stats(user_id=user_id).get("total_chunks") or 0
        )
    except Exception as e:
        logger.warning("统计 total_chunks 失败，回退为按文档求和: %s", e)
        summary["total_chunks"] = sum(item["chunks"] for item in items)

    # 3) 过滤：q（展示名/文件名，不区分大小写）+ category
    filtered = items
    if q and q.strip():
        needle = q.strip().lower()
        filtered = [
            item for item in filtered
            if needle in (item["display_name"] or "").lower()
            or needle in (item["filename"] or "").lower()
        ]
    if category:
        filtered = [item for item in filtered if item["category"] == category]

    # 4) 排序
    if sort == "chunks_desc":
        filtered.sort(key=lambda it: (-int(it["chunks"] or 0), it["display_name"]))
    elif sort == "updated_desc":
        # 时间解析后降序比较（ISO 字符串字面序在时区偏移不同时不可靠）；None 排最后
        def _updated_ts(item: dict) -> float:
            value = item["updated_at"]
            if not value:
                return float("-inf")
            try:
                return datetime.fromisoformat(value).timestamp()
            except (TypeError, ValueError):
                return float("-inf")

        filtered.sort(key=_updated_ts, reverse=True)
    else:  # name（默认）：展示名升序，文件名兜底保证稳定
        filtered.sort(key=lambda it: ((it["display_name"] or it["filename"]).casefold(), it["filename"]))

    # 5) 分页（page_size=0 → 不分页，返回全部，保持旧行为）
    if page_size > 0:
        total = len(filtered)
        start = (page - 1) * page_size
        return {
            "documents": filtered[start:start + page_size],
            "summary": summary,
            "total": total,
            "page": page,
            "page_size": page_size,
        }
    return {"documents": filtered, "summary": summary}


@router.get("/documents/{filename}/versions", summary="获取文档版本历史")
async def get_document_versions(filename: str, current_user=Depends(get_current_active_user)):
    """查询指定文档的版本历史（需认证，按当前租户过滤）"""
    user_id = str(current_user.id) if hasattr(current_user, 'id') else "system"
    versions = _version_mgr.get_all_versions(filename, user_id=user_id)
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
    # P1-4：只删除当前租户的版本记录，避免 pop 全局键清掉其他租户同名版本
    _version_mgr.remove_document(filename, user_id=user_id)
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
        # P1-4：版本统计按当前租户过滤，避免泄露全局版本数
        "document_count": _version_mgr.get_document_count(user_id=user_id),
        "total_versions": _version_mgr.get_total_versions(user_id=user_id),
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
    """查询知识库操作审计日志（需认证，按当前租户过滤）"""
    user_id = str(current_user.id) if hasattr(current_user, 'id') else "system"
    logs = _version_mgr.get_audit_log(filename, limit, user_id=user_id)
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

    # P1-2：检索触发 jieba+BM25+fastembed+reranker CPU 推理，按用户限流防 CPU 饱和 DoS。
    # /rag/query 内部复用本端点（search_rag），因此同样受到保护，不会重复计数。
    if RAG_RATE_LIMIT_ENABLED:
        limit_result = await _rag_limiter.check_with_window(
            key=f"rag:search:{user_id}",
            limit=RAG_RATE_LIMIT_CAPACITY,
            window=RAG_RATE_LIMIT_WINDOW,
        )
        if not limit_result.allowed:
            retry_after = max(1, int(math.ceil(limit_result.retry_after or 1)))
            raise HTTPException(
                status_code=429,
                detail="请求过于频繁，请稍后重试",
                headers={"Retry-After": str(retry_after)},
            )

    result = await rag_service.augment_query(question.strip(), top_k=top_k, user_id=user_id)
    return {
        "success": True,
        "data": {
            "question": question.strip(),
            "chunks": [
                {
                    "content": c.chunk.content,
                    "source": c.chunk.metadata.get("source", "unknown"),
                    "display_name": get_display_name(c.chunk.metadata.get("source", "unknown")),
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


# ═══════════════════════════════════════════════════
# 本草古籍书目（rag_knowledge_sources）只读查询端点
# ═══════════════════════════════════════════════════
# 说明：古籍为平台公共知识（user_id='system'），列表/统计不按租户过滤；
# 但接口本身强制登录（Depends(get_current_active_user)）。

# 允许的排序方式 → (order_by 子句构造)
_KNOWLEDGE_SOURCE_SORT_PATTERN = "^(dynasty_asc|chunk_desc|title_asc|imported_desc)$"


def _serialize_knowledge_source(row: RagKnowledgeSource) -> dict:
    """to_dict() + datetime → ISO 字符串（JSON 可序列化）"""
    data = row.to_dict()
    for key in ("imported_at", "created_at", "updated_at"):
        value = data.get(key)
        if isinstance(value, datetime):
            data[key] = value.isoformat()
    return data


@router.get("/knowledge-sources", summary="本草古籍书目列表")
async def list_knowledge_sources(
    category: str | None = Query(None, description="分类精确匹配，如 ancient_book"),
    dynasty: str | None = Query(None, description="朝代精确匹配，如 明"),
    author: str | None = Query(None, description="作者（模糊匹配）"),
    q: str | None = Query(None, description="关键词（按 title/source/display_name 模糊匹配）"),
    page: int = Query(1, ge=1, description="页码，从 1 开始"),
    page_size: int = Query(20, ge=1, le=100, description="每页条数"),
    sort: str = Query(
        "dynasty_asc",
        pattern=_KNOWLEDGE_SOURCE_SORT_PATTERN,
        description="排序：dynasty_asc / chunk_desc / title_asc / imported_desc",
    ),
    current_user=Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db_session),
):
    """本草古籍书目分页列表（公共知识，不按租户过滤）"""
    conditions = []
    if category:
        conditions.append(RagKnowledgeSource.category == category)
    if dynasty:
        conditions.append(RagKnowledgeSource.dynasty == dynasty)
    if author:
        conditions.append(RagKnowledgeSource.author.ilike(f"%{author}%"))
    if q:
        pattern = f"%{q}%"
        conditions.append(
            RagKnowledgeSource.title.ilike(pattern)
            | RagKnowledgeSource.source.ilike(pattern)
            | RagKnowledgeSource.display_name.ilike(pattern)
        )

    count_stmt = select(func.count()).select_from(RagKnowledgeSource)
    rows_stmt = select(RagKnowledgeSource)
    if conditions:
        count_stmt = count_stmt.where(*conditions)
        rows_stmt = rows_stmt.where(*conditions)

    total = (await db.execute(count_stmt)).scalar() or 0

    if sort == "chunk_desc":
        order_by = (RagKnowledgeSource.chunk_count.desc(), RagKnowledgeSource.title.asc())
    elif sort == "title_asc":
        order_by = (RagKnowledgeSource.title.asc(),)
    elif sort == "imported_desc":
        order_by = (RagKnowledgeSource.imported_at.desc(), RagKnowledgeSource.id.desc())
    else:  # dynasty_asc（默认）
        order_by = (
            RagKnowledgeSource.dynasty.asc().nulls_last(),
            RagKnowledgeSource.title.asc(),
        )

    rows = (
        await db.execute(
            rows_stmt.order_by(*order_by).offset((page - 1) * page_size).limit(page_size)
        )
    ).scalars().all()

    return {
        "items": [_serialize_knowledge_source(row) for row in rows],
        "total": total,
        "page": page,
        "page_size": page_size,
    }


# ⚠️ 必须声明在 /knowledge-sources/{source_id} 之前，避免 "stats" 被路径参数吞掉
@router.get("/knowledge-sources/stats", summary="本草古籍书目统计")
async def get_knowledge_source_stats(
    current_user=Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db_session),
):
    """本草古籍汇总统计（总量 + 按朝代会分类，公共知识不按租户过滤）"""
    totals_stmt = select(
        func.count(RagKnowledgeSource.id).label("total_books"),
        func.coalesce(func.sum(RagKnowledgeSource.chunk_count), 0).label("total_chunks"),
        func.coalesce(func.sum(RagKnowledgeSource.char_count), 0).label("total_chars"),
    )
    total_books, total_chunks, total_chars = (await db.execute(totals_stmt)).one()

    dynasty_stmt = (
        select(
            RagKnowledgeSource.dynasty.label("dynasty"),
            func.count().label("count"),
            func.coalesce(func.sum(RagKnowledgeSource.chunk_count), 0).label("chunks"),
        )
        .group_by(RagKnowledgeSource.dynasty)
        .order_by(func.count().desc(), RagKnowledgeSource.dynasty.asc().nulls_last())
    )
    dynasty_rows = (await db.execute(dynasty_stmt)).all()

    category_stmt = (
        select(
            RagKnowledgeSource.category.label("category"),
            func.count().label("count"),
            func.coalesce(func.sum(RagKnowledgeSource.chunk_count), 0).label("chunks"),
        )
        .group_by(RagKnowledgeSource.category)
        .order_by(func.count().desc(), RagKnowledgeSource.category.asc())
    )
    category_rows = (await db.execute(category_stmt)).all()

    return {
        "total_books": total_books or 0,
        "total_chunks": total_chunks or 0,
        "total_chars": total_chars or 0,
        "by_dynasty": [
            {"dynasty": r.dynasty, "count": r.count, "chunks": r.chunks or 0}
            for r in dynasty_rows
        ],
        "by_category": [
            {"category": r.category, "count": r.count, "chunks": r.chunks or 0}
            for r in category_rows
        ],
    }


@router.get("/knowledge-sources/{source_id}", summary="本草古籍书目详情")
async def get_knowledge_source(
    source_id: int,
    current_user=Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db_session),
):
    """按主键查询单部古籍书目（公共知识，不按租户过滤）"""
    row = (
        await db.execute(
            select(RagKnowledgeSource).where(RagKnowledgeSource.id == source_id)
        )
    ).scalar_one_or_none()
    if row is None:
        raise HTTPException(status_code=404, detail="书目不存在")
    return _serialize_knowledge_source(row)
