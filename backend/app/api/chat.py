"""
RMFOOD 对话管理 API

提供对话会话和消息的完整CRUD操作，支持：
- 会话管理（创建/读取/更新/删除/列表）
- 消息管理（创建/读取/删除/批量删除）
- 导出功能（JSON/CSV格式）
"""
import logging
import csv
from io import StringIO
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Query, Body, Path
from fastapi.responses import JSONResponse, StreamingResponse
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete, func
from sqlalchemy.orm import joinedload

from ..api.deps import get_db_session, get_current_active_user
from ..models import User
from ..models.chat import ChatSession, ChatMessage

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/chat", tags=["对话管理"])


# ===== 会话管理 =====

@router.get("/sessions", summary="获取用户会话列表")
async def get_sessions(
    page: int = Query(1, ge=1, description="页码"),
    page_size: int = Query(20, ge=1, le=100, description="每页数量"),
    search: str = Query(None, description="搜索关键词（匹配标题）"),
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_active_user),
):
    """获取当前用户的对话会话列表，支持分页和搜索"""
    try:
        query = select(ChatSession).filter(
            ChatSession.user_id == current_user.id,
            ChatSession.is_active == True
        )
        
        if search:
            query = query.filter(ChatSession.title.ilike(f"%{search}%"))
        
        query = query.order_by(ChatSession.updated_at.desc())
        
        # 分页
        offset = (page - 1) * page_size
        query = query.offset(offset).limit(page_size)
        
        result = await db.execute(query)
        sessions = result.scalars().all()
        
        # 获取总数
        count_query = select(func.count(ChatSession.id)).filter(
            ChatSession.user_id == current_user.id,
            ChatSession.is_active == True
        )
        if search:
            count_query = count_query.filter(ChatSession.title.ilike(f"%{search}%"))
        count_result = await db.execute(count_query)
        total = count_result.scalar_one()
        
        return {
            "items": [s.to_dict() for s in sessions],
            "total": total,
            "page": page,
            "page_size": page_size,
            "total_pages": (total + page_size - 1) // page_size,
        }
    except Exception as e:
        logger.error(f"获取会话列表失败: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="获取会话列表失败")


@router.get("/sessions/{session_id}", summary="获取会话详情")
async def get_session(
    session_id: int = Path(..., description="会话ID"),
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_active_user),
):
    """获取指定会话的详细信息和消息列表"""
    try:
        query = select(ChatSession).options(joinedload(ChatSession.messages)).filter(
            ChatSession.id == session_id,
            ChatSession.user_id == current_user.id,
            ChatSession.is_active == True
        )
        
        result = await db.execute(query)
        # joinedload 集合（messages）后必须调用 unique()，否则 scalar_one_or_none 抛 InvalidRequestError
        session = result.unique().scalar_one_or_none()
        
        if not session:
            raise HTTPException(status_code=404, detail="会话不存在或无权访问")
        
        return {
            "session": session.to_dict(),
            "messages": [m.to_dict() for m in session.messages],
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"获取会话详情失败: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="获取会话详情失败")


@router.post("/sessions", summary="创建新会话")
async def create_session(
    title: str = Body(..., description="会话标题"),
    tags: list[str] = Body([], description="标签列表"),
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_active_user),
):
    """创建一个新的对话会话"""
    try:
        session = ChatSession(
            user_id=current_user.id,
            title=title,
            tags=tags,
            message_count=0,
            is_active=True,
        )
        
        db.add(session)
        await db.commit()
        await db.refresh(session)
        
        logger.info(f"用户 {current_user.id} 创建会话: {session.id}")
        return session.to_dict()
    except Exception as e:
        logger.error(f"创建会话失败: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="创建会话失败")


@router.put("/sessions/{session_id}", summary="更新会话")
async def update_session(
    session_id: int = Path(..., description="会话ID"),
    title: str = Body(None, description="新标题"),
    tags: list[str] = Body(None, description="新标签列表"),
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_active_user),
):
    """更新会话信息（标题、标签）"""
    try:
        query = select(ChatSession).filter(
            ChatSession.id == session_id,
            ChatSession.user_id == current_user.id,
            ChatSession.is_active == True
        )
        
        result = await db.execute(query)
        session = result.scalar_one_or_none()
        
        if not session:
            raise HTTPException(status_code=404, detail="会话不存在或无权访问")
        
        if title is not None:
            session.title = title
        if tags is not None:
            session.tags = tags
        
        await db.commit()
        await db.refresh(session)
        
        return session.to_dict()
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"更新会话失败: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="更新会话失败")


@router.delete("/sessions/{session_id}", summary="删除会话")
async def delete_session(
    session_id: int = Path(..., description="会话ID"),
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_active_user),
):
    """软删除会话（标记为非活跃）"""
    try:
        query = select(ChatSession).filter(
            ChatSession.id == session_id,
            ChatSession.user_id == current_user.id,
            ChatSession.is_active == True
        )
        
        result = await db.execute(query)
        session = result.scalar_one_or_none()
        
        if not session:
            raise HTTPException(status_code=404, detail="会话不存在或无权访问")
        
        session.is_active = False
        await db.commit()
        
        logger.info(f"用户 {current_user.id} 删除会话: {session_id}")
        return {"success": True, "message": "会话已删除"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"删除会话失败: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="删除会话失败")


# ===== 消息管理 =====

@router.get("/sessions/{session_id}/messages", summary="获取会话消息")
async def get_session_messages(
    session_id: int = Path(..., description="会话ID"),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_active_user),
):
    """获取指定会话的消息列表，支持分页"""
    try:
        # 验证会话归属
        session_query = select(ChatSession).filter(
            ChatSession.id == session_id,
            ChatSession.user_id == current_user.id,
            ChatSession.is_active == True
        )
        session_result = await db.execute(session_query)
        if not session_result.scalar_one_or_none():
            raise HTTPException(status_code=404, detail="会话不存在或无权访问")
        
        query = select(ChatMessage).filter(
            ChatMessage.session_id == session_id
        ).order_by(ChatMessage.timestamp.asc())
        
        offset = (page - 1) * page_size
        query = query.offset(offset).limit(page_size)
        
        result = await db.execute(query)
        messages = result.scalars().all()
        
        # 获取总数
        count_query = select(func.count(ChatMessage.id)).filter(
            ChatMessage.session_id == session_id
        )
        count_result = await db.execute(count_query)
        total = count_result.scalar_one()
        
        return {
            "items": [m.to_dict() for m in messages],
            "total": total,
            "page": page,
            "page_size": page_size,
            "total_pages": (total + page_size - 1) // page_size,
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"获取消息列表失败: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="获取消息列表失败")


@router.get("/sessions/{session_id}/messages/{message_id}", summary="获取单条消息")
async def get_message(
    session_id: int = Path(..., description="会话ID"),
    message_id: int = Path(..., description="消息ID"),
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_active_user),
):
    """获取单条消息详情"""
    try:
        # 验证会话归属
        session_query = select(ChatSession).filter(
            ChatSession.id == session_id,
            ChatSession.user_id == current_user.id,
            ChatSession.is_active == True
        )
        session_result = await db.execute(session_query)
        if not session_result.scalar_one_or_none():
            raise HTTPException(status_code=404, detail="会话不存在或无权访问")
        
        query = select(ChatMessage).filter(
            ChatMessage.id == message_id,
            ChatMessage.session_id == session_id
        )
        
        result = await db.execute(query)
        message = result.scalar_one_or_none()
        
        if not message:
            raise HTTPException(status_code=404, detail="消息不存在")
        
        return message.to_dict()
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"获取消息失败: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="获取消息失败")


@router.post("/sessions/{session_id}/messages", summary="添加消息")
async def add_message(
    session_id: int = Path(..., description="会话ID"),
    role: str = Body(..., description="角色: user, assistant, system"),
    content: str = Body(..., description="消息内容"),
    metadata: dict = Body({}, description="附加元数据"),
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_active_user),
):
    """向会话添加一条新消息"""
    try:
        # 验证会话归属
        session_query = select(ChatSession).filter(
            ChatSession.id == session_id,
            ChatSession.user_id == current_user.id,
            ChatSession.is_active == True
        )
        result = await db.execute(session_query)
        session = result.scalar_one_or_none()
        
        if not session:
            raise HTTPException(status_code=404, detail="会话不存在或无权访问")
        
        # 验证角色
        if role not in ['user', 'assistant', 'system']:
            raise HTTPException(status_code=400, detail="无效的角色值")
        
        message = ChatMessage(
            session_id=session_id,
            role=role,
            content=content,
            timestamp=datetime.now(timezone.utc),
            message_metadata=metadata,
        )
        
        db.add(message)
        
        # 更新会话消息计数
        session.message_count += 1
        session.updated_at = datetime.now(timezone.utc)
        
        await db.commit()
        await db.refresh(message)
        
        logger.info(f"用户 {current_user.id} 在会话 {session_id} 添加消息: {message.id}")
        return message.to_dict()
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"添加消息失败: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="添加消息失败")


@router.delete("/sessions/{session_id}/messages/{message_id:int}", summary="删除单条消息")
async def delete_message(
    session_id: int = Path(..., description="会话ID"),
    message_id: int = Path(..., description="消息ID"),
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_active_user),
):
    """删除单条消息"""
    try:
        # 验证会话归属
        session_query = select(ChatSession).filter(
            ChatSession.id == session_id,
            ChatSession.user_id == current_user.id,
            ChatSession.is_active == True
        )
        session_result = await db.execute(session_query)
        session = session_result.scalar_one_or_none()
        
        if not session:
            raise HTTPException(status_code=404, detail="会话不存在或无权访问")
        
        query = select(ChatMessage).filter(
            ChatMessage.id == message_id,
            ChatMessage.session_id == session_id
        )
        
        result = await db.execute(query)
        message = result.scalar_one_or_none()
        
        if not message:
            raise HTTPException(status_code=404, detail="消息不存在")
        
        await db.delete(message)
        
        # 更新会话消息计数
        session.message_count = max(0, session.message_count - 1)
        session.updated_at = datetime.now(timezone.utc)
        
        await db.commit()
        
        logger.info(f"用户 {current_user.id} 删除消息: {message_id}")
        return {"success": True, "message": "消息已删除"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"删除消息失败: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="删除消息失败")


@router.delete("/sessions/{session_id}/messages/batch", summary="批量删除消息")
async def batch_delete_messages(
    session_id: int = Path(..., description="会话ID"),
    message_ids: list[int] = Body(..., description="要删除的消息ID列表"),
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_active_user),
):
    """批量删除多条消息"""
    try:
        # 验证会话归属
        session_query = select(ChatSession).filter(
            ChatSession.id == session_id,
            ChatSession.user_id == current_user.id,
            ChatSession.is_active == True
        )
        session_result = await db.execute(session_query)
        session = session_result.scalar_one_or_none()
        
        if not session:
            raise HTTPException(status_code=404, detail="会话不存在或无权访问")
        
        if not message_ids or len(message_ids) == 0:
            raise HTTPException(status_code=400, detail="请提供要删除的消息ID")
        
        # 执行批量删除
        delete_query = delete(ChatMessage).where(
            ChatMessage.id.in_(message_ids),
            ChatMessage.session_id == session_id
        )
        
        result = await db.execute(delete_query)
        
        # 更新会话消息计数
        session.message_count = max(0, session.message_count - result.rowcount)
        session.updated_at = datetime.now(timezone.utc)
        
        await db.commit()
        
        logger.info(f"用户 {current_user.id} 批量删除 {result.rowcount} 条消息")
        return {
            "success": True,
            "message": f"成功删除 {result.rowcount} 条消息",
            "deleted_count": result.rowcount,
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"批量删除消息失败: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="批量删除消息失败")


# ===== 导出功能 =====

@router.get("/sessions/{session_id}/export/json", summary="导出会话为JSON格式")
async def export_session_json(
    session_id: int = Path(..., description="会话ID"),
    include_metadata: bool = Query(True, description="是否包含所有元数据"),
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_active_user),
):
    """导出会话的所有消息为JSON格式，包含完整元数据"""
    try:
        query = select(ChatSession).options(joinedload(ChatSession.messages)).filter(
            ChatSession.id == session_id,
            ChatSession.user_id == current_user.id,
            ChatSession.is_active == True
        )
        
        result = await db.execute(query)
        session = result.unique().scalar_one_or_none()
        
        if not session:
            raise HTTPException(status_code=404, detail="会话不存在或无权访问")
        
        export_data = {
            "session": session.to_dict(),
            "exported_at": datetime.now(timezone.utc).isoformat(),
            "export_format": "json",
            "include_metadata": include_metadata,
            "messages": [m.to_dict(include_metadata) for m in session.messages],
        }
        
        return JSONResponse(
            content=export_data,
            media_type="application/json",
            headers={
                "Content-Disposition": f"attachment; filename=chat_session_{session_id}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json",
            },
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"导出JSON失败: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="导出失败")


@router.get("/sessions/{session_id}/export/csv", summary="导出会话为CSV格式")
async def export_session_csv(
    session_id: int = Path(..., description="会话ID"),
    include_metadata: bool = Query(True, description="是否包含所有元数据"),
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_active_user),
):
    """导出会话的所有消息为CSV格式"""
    try:
        query = select(ChatSession).options(joinedload(ChatSession.messages)).filter(
            ChatSession.id == session_id,
            ChatSession.user_id == current_user.id,
            ChatSession.is_active == True
        )
        
        result = await db.execute(query)
        session = result.unique().scalar_one_or_none()
        
        if not session:
            raise HTTPException(status_code=404, detail="会话不存在或无权访问")
        
        # 创建CSV内容
        output = StringIO()
        writer = csv.writer(output)
        
        # 表头
        headers = ["消息ID", "角色", "内容", "时间戳"]
        if include_metadata:
            headers.extend([
                "是否编辑", "编辑时间", "原始内容", "是否撤回",
                "撤回时间", "撤回原因", "回复目标", "引用内容",
                "评价", "反馈", "是否书签", "书签备注", "标签", "元数据"
            ])
        writer.writerow(headers)
        
        # 数据行
        for message in session.messages:
            row = [
                message.id,
                message.role,
                message.content.replace("\n", "\\n"),
                message.timestamp.strftime("%Y-%m-%d %H:%M:%S")
            ]
            
            if include_metadata:
                row.extend([
                    message.is_edited,
                    message.edited_at.strftime("%Y-%m-%d %H:%M:%S") if message.edited_at else "",
                    message.original_content.replace("\n", "\\n") if message.original_content else "",
                    message.is_withdrawn,
                    message.withdrawn_at.strftime("%Y-%m-%d %H:%M:%S") if message.withdrawn_at else "",
                    message.withdraw_reason or "",
                    message.reply_to or "",
                    (message.quote_content or "").replace("\n", "\\n"),
                    message.rating or "",
                    (message.feedback or "").replace("\n", "\\n"),
                    message.is_bookmarked,
                    message.bookmark_note or "",
                    ",".join(message.message_tags or []),
                    str(message.message_metadata or {})
                ])
            
            writer.writerow(row)
        
        output.seek(0)
        csv_content = output.getvalue()
        
        return StreamingResponse(
            iter([csv_content]),
            media_type="text/csv;charset=utf-8",
            headers={
                "Content-Disposition": f"attachment; filename=chat_session_{session_id}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv",
                "Content-Type": "text/csv;charset=utf-8",
            },
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"导出CSV失败: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="导出失败")


@router.get("/export/all/json", summary="导出所有会话为JSON格式")
async def export_all_sessions_json(
    include_metadata: bool = Query(True, description="是否包含所有元数据"),
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_active_user),
):
    """导出当前用户的所有会话为JSON格式"""
    try:
        query = select(ChatSession).options(joinedload(ChatSession.messages)).filter(
            ChatSession.user_id == current_user.id,
            ChatSession.is_active == True
        ).order_by(ChatSession.updated_at.desc())
        
        result = await db.execute(query)
        # joinedload 集合（messages）后必须调用 unique()，否则同一会话会按消息数重复返回
        sessions = result.unique().scalars().all()
        
        export_data = {
            "user_id": current_user.id,
            "username": current_user.username,
            "exported_at": datetime.now(timezone.utc).isoformat(),
            "export_format": "json",
            "include_metadata": include_metadata,
            "total_sessions": len(sessions),
            "sessions": [
                {
                    "session": s.to_dict(),
                    "messages": [m.to_dict(include_metadata) for m in s.messages],
                }
                for s in sessions
            ],
        }
        
        return JSONResponse(
            content=export_data,
            media_type="application/json",
            headers={
                "Content-Disposition": f"attachment; filename=all_chats_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json",
            },
        )
    except Exception as e:
        logger.error(f"导出所有会话JSON失败: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="导出失败")


# ===== 会话同步（前端本地会话快照）=====

@router.get("/sync/restore", summary="恢复云端会话快照（跨设备）")
async def restore_chat_sessions(
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_active_user),
):
    """返回该用户的全部本地会话快照（含消息），供跨设备恢复。

    与 POST /sync 配对：新设备登录同一账号后调用本端点，
    即可拉回旧设备同步过的会话历史（快照级，非实时同步）。
    """
    from ..models.system import SystemConfig
    from sqlalchemy import select
    import json as _json

    config_key = f"chat_sync_{current_user.id}"
    try:
        result = await db.execute(select(SystemConfig).where(SystemConfig.config_key == config_key))
        row = result.scalar_one_or_none()
        snapshot: list[dict] = []
        if row and row.config_value:
            try:
                v = row.config_value
                if isinstance(v, str):
                    v = _json.loads(v)
                if isinstance(v, list):
                    snapshot = v
            except Exception:
                snapshot = []
        logger.info(f"[ChatSync] 用户 {current_user.id} 恢复 {len(snapshot)} 个会话快照")
        return {"success": True, "sessions": snapshot, "total": len(snapshot)}
    except Exception as e:
        logger.error(f"[ChatSync] 快照恢复失败: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="会话快照恢复失败")


class ChatSyncRequest(BaseModel):
    """前端本地会话快照同步请求"""
    sessions: list[dict] = Field(default_factory=list, description="本地会话对象列表")


@router.post("/sync", summary="同步本地会话快照到服务器")
async def sync_chat_sessions(
    req: ChatSyncRequest,
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_active_user),
):
    """接收前端 IndexedDB/localStorage 中的会话快照并持久化到 SystemConfig。

    说明：这是快照级同步（JSON 存储，按 session id 去重合并），供备份/恢复使用；
    完整的跨设备会话恢复需要 client_id 关联，属结构性改造，暂未实现。
    """
    from ..models.system import SystemConfig
    from sqlalchemy import select
    import json as _json

    config_key = f"chat_sync_{current_user.id}"
    try:
        result = await db.execute(select(SystemConfig).where(SystemConfig.config_key == config_key))
        row = result.scalar_one_or_none()
        snapshot: list[dict] = []
        if row and row.config_value:
            try:
                v = row.config_value
                if isinstance(v, str):
                    v = _json.loads(v)
                if isinstance(v, list):
                    snapshot = v
            except Exception:
                snapshot = []

        by_id: dict[str, dict] = {}
        for s in snapshot:
            if isinstance(s, dict) and s.get("id"):
                by_id[str(s["id"])] = s
        for s in req.sessions:
            if isinstance(s, dict) and s.get("id"):
                by_id[str(s["id"])] = s
        merged = list(by_id.values())[-200:]  # 最多保留 200 个会话快照

        if row:
            row.config_value = merged
            row.updated_by = current_user.id
        else:
            db.add(SystemConfig(config_key=config_key, config_value=merged, updated_by=current_user.id))
        await db.commit()
        logger.info(f"[ChatSync] 用户 {current_user.id} 同步 {len(req.sessions)} 个会话快照，累计 {len(merged)} 个")
        return {"success": True, "synced": len(req.sessions), "total": len(merged)}
    except Exception as e:
        logger.error(f"[ChatSync] 同步失败: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="会话同步失败")
