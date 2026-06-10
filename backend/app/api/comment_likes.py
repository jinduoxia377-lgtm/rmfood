"""
评论点赞 API
支持对评论进行点赞、取消点赞、获取点赞数
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from ..models.models import Comment, User
from ..services.auth import get_current_user
from ..api.deps import get_db_session
from pydantic import BaseModel
from ..models.formula import CommentLike

router = APIRouter(prefix="/comments", tags=["评论点赞"])


class CommentLikeResponse(BaseModel):
    comment_id: int
    like_count: int
    is_liked: bool


@router.post("/{comment_id}/like", status_code=201, summary="点赞评论")
async def like_comment(
    comment_id: int,
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
):
    """为指定评论点赞（可重复点赞但不会增加计数）"""
    comment = await db.get(Comment, comment_id)
    if not comment:
        raise HTTPException(status_code=404, detail="评论不存在")

    existing = (
        await db.execute(
            select(CommentLike).where(
                CommentLike.comment_id == comment_id,
                CommentLike.user_id == current_user.id
            )
        )
    ).scalar_one_or_none()

    if existing:
        return {"message": "已点赞", "comment_id": comment_id, "is_liked": True}

    like = CommentLike(comment_id=comment_id, user_id=current_user.id)
    db.add(like)
    await db.commit()

    count = (
        await db.execute(
            select(func.count()).where(CommentLike.comment_id == comment_id)
        )
    ).scalar() or 0

    return {"message": "点赞成功", "comment_id": comment_id, "is_liked": True, "like_count": count}


@router.delete("/{comment_id}/like", summary="取消点赞评论")
async def unlike_comment(
    comment_id: int,
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
):
    """取消对指定评论的点赞"""
    comment = await db.get(Comment, comment_id)
    if not comment:
        raise HTTPException(status_code=404, detail="评论不存在")

    existing = (
        await db.execute(
            select(CommentLike).where(
                CommentLike.comment_id == comment_id,
                CommentLike.user_id == current_user.id
            )
        )
    ).scalar_one_or_none()

    if not existing:
        return {"message": "未点赞", "comment_id": comment_id, "is_liked": False}

    await db.delete(existing)
    await db.commit()

    count = (
        await db.execute(
            select(func.count()).where(CommentLike.comment_id == comment_id)
        )
    ).scalar() or 0

    return {"message": "取消点赞成功", "comment_id": comment_id, "is_liked": False, "like_count": count}


@router.get("/{comment_id}/likes", summary="获取评论点赞信息")
async def get_comment_likes(
    comment_id: int,
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
):
    """获取指定评论的点赞数和当前用户是否已点赞"""
    comment = await db.get(Comment, comment_id)
    if not comment:
        raise HTTPException(status_code=404, detail="评论不存在")

    count = (
        await db.execute(
            select(func.count()).where(CommentLike.comment_id == comment_id)
        )
    ).scalar() or 0

    is_liked = (
        await db.execute(
            select(CommentLike).where(
                CommentLike.comment_id == comment_id,
                CommentLike.user_id == current_user.id
            )
        )
    ).scalar_one_or_none() is not None

    return {"comment_id": comment_id, "like_count": count, "is_liked": is_liked}
