"""
配方/实验评论 API
支持嵌套评论（回复）、内部备注（仅内部可见）
"""
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from ..models.models import (
    Comment, User, Formula, Experiment,
)
from ..services.auth import get_current_user as _auth_get_current_user
from ..api.deps import get_db_session, PaginationParams, get_current_user
from pydantic import BaseModel
from typing import Optional

router = APIRouter(prefix="/comments", tags=["评论"])


# ── Schemas ──

class CommentCreate(BaseModel):
    formula_id: Optional[int] = None
    experiment_id: Optional[int] = None
    content: str
    parent_id: Optional[int] = None
    is_internal: bool = False


class CommentUpdate(BaseModel):
    content: str


class CommentResponse(BaseModel):
    id: int
    formula_id: Optional[int] = None
    experiment_id: Optional[int] = None
    user_id: int
    content: str
    parent_id: Optional[int] = None
    is_internal: bool
    created_at: str
    updated_at: str
    # 展开字段
    author_name: Optional[str] = None
    author_role: Optional[str] = None
    replies_count: int = 0


# ── 获取评论列表 ──

@router.get("", summary="获取评论列表")
async def list_comments(
    formula_id: Optional[int] = Query(None),
    experiment_id: Optional[int] = Query(None),
    include_internal: bool = Query(False),
    pagination: PaginationParams = Depends(),
    db: AsyncSession = Depends(get_db_session),
    current_user: Optional[User] = Depends(get_current_user),
):
    """获取指定配方或实验的评论"""
    stmt = (
        select(Comment)
        .where(Comment.parent_id.is_(None))
    )
    if formula_id:
        stmt = stmt.where(Comment.formula_id == formula_id)
    elif experiment_id:
        stmt = stmt.where(Comment.experiment_id == experiment_id)
    else:
        raise HTTPException(status_code=400, detail="需要指定 formula_id 或 experiment_id")

    if not include_internal:
        stmt = stmt.where(Comment.is_internal == False)

    # 总数
    count_stmt = select(func.count()).select_from(stmt.subquery())
    total = (await db.execute(count_stmt)).scalar() or 0

    stmt = stmt.order_by(Comment.created_at.desc()).offset((pagination.page - 1) * pagination.page_size).limit(pagination.page_size)
    comments = (await db.execute(stmt)).scalars().all()

    # 回复数统计
    results = []
    for c in comments:
        replies_count = (
            await db.execute(
                select(func.count()).where(Comment.parent_id == c.id)
            )
        ).scalar() or 0

        author = await db.get(User, c.user_id)
        results.append({
            "id": c.id,
            "formula_id": c.formula_id,
            "experiment_id": c.experiment_id,
            "user_id": c.user_id,
            "content": c.content,
            "parent_id": c.parent_id,
            "is_internal": c.is_internal,
            "created_at": c.created_at.isoformat(),
            "updated_at": c.updated_at.isoformat(),
            "author_name": author.full_name or author.username if author else "未知用户",
            "author_role": author.role.value if author else None,
            "replies_count": replies_count,
        })

    return {"items": results, "total": total, "page": pagination.page, "page_size": pagination.page_size}


@router.get("/{comment_id}/replies", summary="获取评论回复")
async def get_replies(
    comment_id: int,
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
):
    """获取指定评论的回复列表"""
    stmt = (
        select(Comment)
        .where(Comment.parent_id == comment_id)
        .order_by(Comment.created_at.asc())
    )
    replies = (await db.execute(stmt)).scalars().all()

    results = []
    for r in replies:
        author = await db.get(User, r.user_id)
        results.append({
            "id": r.id,
            "formula_id": r.formula_id,
            "experiment_id": r.experiment_id,
            "user_id": r.user_id,
            "content": r.content,
            "parent_id": r.parent_id,
            "is_internal": r.is_internal,
            "created_at": r.created_at.isoformat(),
            "updated_at": r.updated_at.isoformat(),
            "author_name": author.full_name or author.username if author else "未知用户",
            "author_role": author.role.value if author else None,
            "replies_count": 0,
        })
    return results


@router.post("", status_code=201, summary="创建评论")
async def create_comment(
    data: CommentCreate,
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
):
    """创建评论或回复"""
    if not data.formula_id and not data.experiment_id:
        raise HTTPException(status_code=400, detail="需要指定 formula_id 或 experiment_id")

    # 验证目标存在
    if data.formula_id:
        formula = await db.get(Formula, data.formula_id)
        if not formula:
            raise HTTPException(status_code=404, detail="配方不存在")
    if data.experiment_id:
        experiment = await db.get(Experiment, data.experiment_id)
        if not experiment:
            raise HTTPException(status_code=404, detail="实验不存在")

    # 验证父评论
    if data.parent_id:
        parent = await db.get(Comment, data.parent_id)
        if not parent:
            raise HTTPException(status_code=404, detail="父评论不存在")

    comment = Comment(
        formula_id=data.formula_id,
        experiment_id=data.experiment_id,
        user_id=current_user.id,
        content=data.content,
        parent_id=data.parent_id,
        is_internal=data.is_internal,
    )
    db.add(comment)
    await db.commit()
    await db.refresh(comment)

    return {
        "id": comment.id,
        "formula_id": comment.formula_id,
        "experiment_id": comment.experiment_id,
        "user_id": comment.user_id,
        "content": comment.content,
        "parent_id": comment.parent_id,
        "is_internal": comment.is_internal,
        "created_at": comment.created_at.isoformat(),
        "updated_at": comment.updated_at.isoformat(),
        "author_name": current_user.full_name or current_user.username,
        "author_role": current_user.role.value,
        "replies_count": 0,
    }


@router.put("/{comment_id}", summary="更新评论")
async def update_comment(
    comment_id: int,
    data: CommentUpdate,
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
):
    """仅评论作者可编辑"""
    comment = await db.get(Comment, comment_id)
    if not comment:
        raise HTTPException(status_code=404, detail="评论不存在")
    if comment.user_id != current_user.id and current_user.role.value != "admin":
        raise HTTPException(status_code=403, detail="无权编辑此评论")

    comment.content = data.content
    await db.commit()
    await db.refresh(comment)

    return {"message": "评论已更新", "id": comment.id}


@router.delete("/{comment_id}", summary="删除评论")
async def delete_comment(
    comment_id: int,
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
):
    """删除评论（作者或管理员）"""
    comment = await db.get(Comment, comment_id)
    if not comment:
        raise HTTPException(status_code=404, detail="评论不存在")
    if comment.user_id != current_user.id and current_user.role.value != "admin":
        raise HTTPException(status_code=403, detail="无权删除此评论")

    await db.delete(comment)
    await db.commit()
    return {"message": "评论已删除"}
