# -*- coding: utf-8 -*-
"""Formula Case Study API"""

import logging
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy import desc, func, or_, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from ...api.deps import get_db_session
from ...core.multi_tenant.tenant_security import current_tenant_id
from ...models.formula import Formula
from ...models.formula_case import CaseComment, CaseLike, FormulaCase
from ...models.user_model import User

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/formulas/cases", tags=["配方案例"])


class CaseCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=200)
    formula_id: int
    category: Optional[str] = Field(None, max_length=100)
    tags: List[str] = Field(default_factory=list)
    summary: str = Field(..., min_length=10, max_length=500)
    content: str = Field(..., min_length=1)
    cover_image: Optional[str] = None
    is_featured: bool = False
    generated_by_ai: bool = False


class CaseUpdate(BaseModel):
    title: Optional[str] = Field(None, max_length=200)
    category: Optional[str] = None
    tags: Optional[List[str]] = None
    summary: Optional[str] = None
    content: Optional[str] = None
    cover_image: Optional[str] = None
    is_featured: Optional[bool] = None


class CaseResponse(BaseModel):
    id: int
    title: str
    formula_id: int
    category: Optional[str]
    tags: List[str]
    summary: str
    content: str
    cover_image: Optional[str]
    views: int
    likes: int
    bookmarks: int
    is_featured: bool
    generated_by_ai: bool
    created_by: int
    creator_name: Optional[str]
    formula_name: Optional[str]
    created_at: str
    updated_at: str

    class Config:
        from_attributes = True


class BookmarkResponse(BaseModel):
    case_id: int
    is_bookmarked: bool


class TrendingCase(BaseModel):
    id: int
    title: str
    category: Optional[str]
    views: int
    likes: int
    bookmarks: int
    summary: str
    cover_image: Optional[str]
    formula_name: Optional[str]
    creator_name: Optional[str]
    created_at: str


def _build_base_query(org_id):
    q = select(FormulaCase).join(Formula, FormulaCase.formula_id == Formula.id)
    if org_id:
        q = q.where(
            or_(
                FormulaCase.organization_id == org_id,
                FormulaCase.organization_id.is_(None),
            )
        )
    else:
        q = q.where(FormulaCase.organization_id.is_(None))
    return q


async def _enrich_case(db, case):
    formula = await db.get(Formula, case.formula_id) if case.formula_id else None
    creator_name = None
    formula_name = None
    if formula:
        formula_name = formula.name
        if formula.creator_id:
            try:
                creator = await db.get(User, formula.creator_id)
                creator_name = creator.username if creator else None
            except Exception:
                pass
    return CaseResponse(
        id=case.id, title=case.title, formula_id=case.formula_id,
        category=case.category, tags=case.tags or [],
        summary=case.summary, content=case.content,
        cover_image=case.cover_image, views=case.views,
        likes=case.likes, bookmarks=case.bookmarks,
        is_featured=case.is_featured, generated_by_ai=case.generated_by_ai,
        created_by=case.created_by, creator_name=creator_name,
        formula_name=formula_name, created_at=str(case.created_at),
        updated_at=str(case.updated_at),
    )


@router.get("", response_model=List[CaseResponse], summary="案例列表")
async def list_cases(
    category: Optional[str] = Query(None),
    tag: Optional[str] = Query(None),
    keyword: Optional[str] = Query(None),
    sort_by: str = Query("created_at"),
    sort_dir: str = Query("desc"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    featured_only: bool = Query(False),
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(lambda: None),
):
    org_id = current_tenant_id()
    q = _build_base_query(org_id)
    if category:
        q = q.where(FormulaCase.category == category)
    if tag:
        q = q.where(FormulaCase.tags.contains([tag]))
    if keyword:
        q = q.where(
            or_(
                FormulaCase.title.ilike(f"%{keyword}%"),
                FormulaCase.summary.ilike(f"%{keyword}%"),
            )
        )
    if featured_only:
        q = q.where(FormulaCase.is_featured.is_(True))
    order_col = getattr(FormulaCase, sort_by, FormulaCase.created_at)
    q = q.order_by(desc(order_col) if sort_dir == "desc" else order_col)
    total_q = select(func.count()).select_from(q.subquery())
    (await db.execute(total_q)).scalar_one()
    q = q.offset((page - 1) * page_size).limit(page_size)
    result = await db.execute(q)
    cases = result.scalars().all()
    return [await _enrich_case(db, c) for c in cases]


@router.get("/stats", summary="案例统计")
async def case_stats(db: AsyncSession = Depends(get_db_session)):
    org_id = current_tenant_id()
    q = _build_base_query(org_id)
    total = (await db.execute(select(func.count()).select_from(q.subquery()))).scalar_one()
    featured = (await db.execute(
        select(func.count()).select_from(q.subquery()).where(text("is_featured = true"))
    )).scalar_one()
    total_views = (await db.execute(
        select(func.sum(func.coalesce(FormulaCase.views, 0)))
    )).scalar_one() or 0
    total_likes = (await db.execute(
        select(func.sum(func.coalesce(FormulaCase.likes, 0)))
    )).scalar_one() or 0
    total_bookmarks = (await db.execute(
        select(func.sum(func.coalesce(FormulaCase.bookmarks, 0)))
    )).scalar_one() or 0
    cat_q = select(FormulaCase.category, func.count().label("cnt")).group_by(FormulaCase.category).where(FormulaCase.category.isnot(None))
    if org_id:
        cat_q = cat_q.where(
            or_(
                FormulaCase.organization_id == org_id,
                FormulaCase.organization_id.is_(None),
            )
        )
    cats = [(r[0], r[1]) for r in (await db.execute(cat_q)).all() if r[0]]
    return {
        "total": total,
        "featured": featured,
        "total_views": total_views,
        "total_likes": total_likes,
        "total_bookmarks": total_bookmarks,
        "categories": [{"category": c, "count": n} for c, n in cats],
    }


@router.get("/categories", summary="分类列表")
async def list_categories(db: AsyncSession = Depends(get_db_session)):
    org_id = current_tenant_id()
    q = select(FormulaCase.category, func.count().label("count")).group_by(FormulaCase.category)
    if org_id:
        q = q.where(
            or_(
                FormulaCase.organization_id == org_id,
                FormulaCase.organization_id.is_(None),
            )
        )
    result = await db.execute(q)
    return [{"category": row[0], "count": row[1]} for row in result.all() if row[0]]


@router.get("/trending", response_model=List[TrendingCase], summary="热门案例排行")
async def trending_cases(limit: int = Query(10, ge=1, le=50), db: AsyncSession = Depends(get_db_session)):
    org_id = current_tenant_id()
    q = _build_base_query(org_id)
    score_expr = desc(
        func.coalesce(FormulaCase.views, 0)
        + func.coalesce(FormulaCase.likes, 0) * 3
        + func.coalesce(FormulaCase.bookmarks, 0) * 5
    )
    q = q.order_by(score_expr).limit(limit)
    result = await db.execute(q)
    cases = result.scalars().all()
    response = []
    for case in cases:
        formula = await db.get(Formula, case.formula_id) if case.formula_id else None
        creator_name = None
        formula_name = None
        if formula:
            formula_name = formula.name
            if formula.creator_id:
                try:
                    u = await db.get(User, formula.creator_id)
                    creator_name = u.username if u else None
                except Exception:
                    pass
        response.append(TrendingCase(
            id=case.id, title=case.title, category=case.category,
            views=case.views, likes=case.likes, bookmarks=case.bookmarks,
            summary=case.summary, cover_image=case.cover_image,
            formula_name=formula_name, creator_name=creator_name,
            created_at=str(case.created_at),
        ))
    return response


@router.get("/by-formula/{formula_id}", response_model=List[CaseResponse], summary="按配方查询案例")
async def cases_by_formula(formula_id: int, db: AsyncSession = Depends(get_db_session)):
    org_id = current_tenant_id()
    q = _build_base_query(org_id).where(FormulaCase.formula_id == formula_id)
    q = q.order_by(desc(FormulaCase.created_at))
    result = await db.execute(q)
    cases = result.scalars().all()
    return [await _enrich_case(db, c) for c in cases]


@router.get("/{case_id}", response_model=CaseResponse, summary="案例详情")
async def get_case(case_id: int, db: AsyncSession = Depends(get_db_session)):
    case = await db.get(FormulaCase, case_id)
    if not case:
        raise HTTPException(status_code=404, detail="案例不存在")
    org_id = current_tenant_id()
    if org_id and case.organization_id != org_id and case.organization_id is not None:
        raise HTTPException(status_code=403, detail="无权访问")
    case.views += 1
    await db.commit()
    await db.refresh(case)
    return await _enrich_case(db, case)


class CaseCommentCreate(BaseModel):
    content: str = Field(..., min_length=1, max_length=2000)
    author: Optional[str] = Field(None, max_length=100)


class CaseCommentResponse(BaseModel):
    id: int
    content: str
    author: Optional[str]
    parent_id: Optional[int]
    likes: int
    created_at: str
    replies: List["CaseCommentResponse"] = []

    class Config:
        from_attributes = True


@router.get("/{case_id}/comments", response_model=List[CaseCommentResponse], summary="获取案例评论")
async def get_case_comments(
    case_id: int,
    db: AsyncSession = Depends(get_db_session),
):
    case = await db.get(FormulaCase, case_id)
    if not case:
        raise HTTPException(status_code=404, detail="案例不存在")
    comments = (await db.execute(
        select(CaseComment).where(CaseComment.case_id == case_id).order_by(CaseComment.created_at)
    )).scalars().all()
    top_level = [c for c in comments if not c.parent_id]
    reply_map: dict[int, List[CaseComment]] = {}
    for c in comments:
        if c.parent_id:
            reply_map.setdefault(c.parent_id, []).append(c)
    def build_response(c: CaseComment) -> CaseCommentResponse:
        return CaseCommentResponse(
            id=c.id, content=c.content, author=c.user.username if c.user else None,
            parent_id=c.parent_id, likes=c.likes, created_at=str(c.created_at),
            replies=[build_response(r) for r in reply_map.get(c.id, [])],
        )
    return [build_response(c) for c in top_level]


@router.post("/{case_id}/comments", response_model=CaseCommentResponse, summary="发表案例评论")
async def create_case_comment(
    case_id: int,
    req: CaseCommentCreate,
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(lambda: __import__('fastapi', fromlist=['Depends']).Depends(__import__('..api.deps', fromlist=['get_current_user']).get_current_user)),
):
    case = await db.get(FormulaCase, case_id)
    if not case:
        raise HTTPException(status_code=404, detail="案例不存在")
    comment = CaseComment(case_id=case_id, user_id=current_user.id, content=req.content)
    db.add(comment)
    await db.commit()
    await db.refresh(comment)
    return CaseCommentResponse(
        id=comment.id, content=comment.content, author=current_user.username,
        parent_id=comment.parent_id, likes=0, created_at=str(comment.created_at),
    )


@router.post("", response_model=CaseResponse, summary="创建案例")
async def create_case(
    req: CaseCreate,
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(lambda: __import__('fastapi', fromlist=['Depends']).Depends(__import__('..api.deps', fromlist=['get_current_user']).get_current_user)),
):
    formula = await db.get(Formula, req.formula_id)
    if not formula:
        raise HTTPException(status_code=404, detail="配方不存在")
    org_id = current_tenant_id()
    if org_id and formula.organization_id != org_id:
        raise HTTPException(status_code=403, detail="无权操作该配方的案例")
    case = FormulaCase(
        title=req.title, formula_id=req.formula_id,
        category=req.category, tags=req.tags or [],
        summary=req.summary, content=req.content,
        cover_image=req.cover_image, is_featured=req.is_featured,
        generated_by_ai=req.generated_by_ai,
        created_by=current_user.id, organization_id=org_id,
    )
    db.add(case)
    await db.commit()
    await db.refresh(case)
    return await _enrich_case(db, case)


@router.put("/{case_id}", response_model=CaseResponse, summary="更新案例")
async def update_case(
    case_id: int,
    req: CaseUpdate,
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(lambda: __import__('fastapi', fromlist=['Depends']).Depends(__import__('..api.deps', fromlist=['get_current_user']).get_current_user)),
):
    case = await db.get(FormulaCase, case_id)
    if not case:
        raise HTTPException(status_code=404, detail="案例不存在")
    if case.created_by != current_user.id:
        raise HTTPException(status_code=403, detail="无权修改此案例")
    for field, value in req.dict(exclude_unset=True).items():
        setattr(case, field, value)
    await db.commit()
    await db.refresh(case)
    return await _enrich_case(db, case)


@router.delete("/{case_id}", summary="删除案例")
async def delete_case(
    case_id: int,
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(lambda: __import__('fastapi', fromlist=['Depends']).Depends(__import__('..api.deps', fromlist=['get_current_user']).get_current_user)),
):
    case = await db.get(FormulaCase, case_id)
    if not case:
        raise HTTPException(status_code=404, detail="案例不存在")
    if case.created_by != current_user.id:
        raise HTTPException(status_code=403, detail="无权删除此案例")
    await db.delete(case)
    await db.commit()
    return {"success": True}


@router.post("/{case_id}/like", summary="点赞案例")
async def like_case(
    case_id: int,
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(lambda: __import__('fastapi', fromlist=['Depends']).Depends(__import__('..api.deps', fromlist=['get_current_user']).get_current_user)),
):
    case = await db.get(FormulaCase, case_id)
    if not case:
        raise HTTPException(status_code=404, detail="案例不存在")
    existing = await db.execute(
        select(CaseLike).where(CaseLike.case_id == case_id, CaseLike.user_id == current_user.id)
    )
    liked = existing.scalar_one_or_none() is not None
    if liked:
        await db.delete(existing.scalar_one())
        case.likes = max(0, case.likes - 1)
    else:
        db.add(CaseLike(case_id=case_id, user_id=current_user.id))
        case.likes += 1
    await db.commit()
    await db.refresh(case)
    return {"case_id": case_id, "is_liked": not liked}


@router.post("/{case_id}/bookmark", response_model=BookmarkResponse, summary="收藏案例")
async def bookmark_case(
    case_id: int,
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(lambda: __import__('fastapi', fromlist=['Depends']).Depends(__import__('..api.deps', fromlist=['get_current_user']).get_current_user)),
):
    case = await db.get(FormulaCase, case_id)
    if not case:
        raise HTTPException(status_code=404, detail="案例不存在")
    result = await db.execute(
        text("SELECT id FROM case_bookmarks WHERE case_id = :cid AND user_id = :uid LIMIT 1"),
        {"cid": case_id, "uid": current_user.id},
    )
    existing = result.fetchone()
    if existing:
        await db.execute(text("DELETE FROM case_bookmarks WHERE id = :bid"), {"bid": existing.id})
        case.bookmarks = max(0, case.bookmarks - 1)
        is_bookmarked = False
    else:
        await db.execute(
            text("INSERT INTO case_bookmarks (case_id, user_id, created_at) VALUES (:cid, :uid, NOW())"),
            {"cid": case_id, "uid": current_user.id},
        )
        case.bookmarks += 1
        is_bookmarked = True
    await db.commit()
    await db.refresh(case)
    return BookmarkResponse(case_id=case_id, is_bookmarked=is_bookmarked)


@router.get("/my-bookmarks", response_model=List[CaseResponse], summary="我的收藏")
async def my_bookmarks(
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(lambda: __import__('fastapi', fromlist=['Depends']).Depends(__import__('..api.deps', fromlist=['get_current_user']).get_current_user)),
):
    org_id = current_tenant_id()
    q = _build_base_query(org_id)
    q = q.join(text("case_bookmarks"), text("formula_cases.id = case_bookmarks.case_id")) \
         .where(text("case_bookmarks.user_id = :uid"), uid=current_user.id)
    q = q.order_by(desc(text("case_bookmarks.created_at")))
    result = await db.execute(q)
    cases = result.scalars().all()
    return [await _enrich_case(db, c) for c in cases]


@router.post("/{case_id}/report", summary="举报案例")
async def report_case(
    case_id: int,
    reason: str = Query(..., min_length=5, max_length=500),
    report_type: str = Query(..., pattern="^(spam|inappropriate|wrong_content|copyright)$"),
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(lambda: __import__('fastapi', fromlist=['Depends']).Depends(__import__('..api.deps', fromlist=['get_current_user']).get_current_user)),
):
    case = await db.get(FormulaCase, case_id)
    if not case:
        raise HTTPException(status_code=404, detail="案例不存在")
    await db.execute(
        text("INSERT INTO case_reports (case_id, user_id, report_type, reason, created_at) VALUES (:cid, :uid, :rtype, :reason, NOW())"),
        {"cid": case_id, "uid": current_user.id, "rtype": report_type, "reason": reason},
    )
    await db.commit()
    return {"success": True, "message": "举报已提交"}
