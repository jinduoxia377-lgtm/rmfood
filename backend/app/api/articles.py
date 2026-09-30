"""
Health Articles API Routes
提供健康知识文章列表和详情接口
"""

from fastapi import APIRouter, Query, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional, List
from datetime import datetime

from ..api.deps import get_db_session, get_current_user
from ..models import User

router = APIRouter(prefix="/articles", tags=["健康知识文章"])


# 模拟文章数据（实际应从数据库获取）
SAMPLE_ARTICLES = [
    {
        "id": 1,
        "title": "Introduction to Medicinal Food",
        "summary": "Understand the basic principles of medicinal food therapy",
        "content": "Medicinal food therapy is a unique traditional Chinese medicine concept...",
        "coverImage": "",
        "category": " basics",
        "tags": ["入门", "基础知识"],
        "author": "RMFOOD Team",
        "publishTime": "2024-03-15T10:00:00Z",
        "views": 1234,
        "likes": 56
    },
    {
        "id": 2,
        "title": "Four Seasons Healthy Diet",
        "summary": "Seasonal healthy eating wisdom for different constitutions",
        "content": "According to traditional Chinese medicine, diet should follow the seasons...",
        "coverImage": "",
        "category": "seasonal",
        "tags": ["四季", "养生"],
        "author": "RMFOOD Team",
        "publishTime": "2024-03-10T10:00:00Z",
        "views": 987,
        "likes": 42
    },
    {
        "id": 3,
        "title": "Common Ingredients Guide",
        "summary": "Effects and applications of common medicinal foods",
        "content": "Goji berries, Chinese yam, and other common ingredients have unique properties...",
        "coverImage": "",
        "category": "ingredients",
        "tags": ["食材", "功效"],
        "author": "RMFOOD Team",
        "publishTime": "2024-03-05T10:00:00Z",
        "views": 2345,
        "likes": 89
    }
]


@router.get("/", summary="获取文章列表")
async def list_articles(
    category: Optional[str] = Query(None, description="按分类筛选"),
    tag: Optional[str] = Query(None, description="按标签筛选"),
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=50),
    db: AsyncSession = Depends(get_db_session),
    current_user: Optional[User] = Depends(get_current_user),
):
    """获取健康知识文章列表"""
    articles = SAMPLE_ARTICLES
    
    # Apply filters
    if category:
        articles = [a for a in articles if a.get("category") == category]
    if tag:
        articles = [a for a in articles if tag in a.get("tags", [])]
    
    # Pagination
    start = (page - 1) * page_size
    end = start + page_size
    paginated_articles = articles[start:end]
    
    return {
        "items": paginated_articles,
        "total": len(articles),
        "page": page,
        "page_size": page_size
    }


@router.get("/{article_id}", summary="获取文章详情")
async def get_article(
    article_id: int,
    db: AsyncSession = Depends(get_db_session),
    current_user: Optional[User] = Depends(get_current_user),
):
    """获取单篇文章详情"""
    article = next((a for a in SAMPLE_ARTICLES if a["id"] == article_id), None)
    
    if not article:
        raise HTTPException(status_code=404, detail="文章不存在")
    
    # Increment views
    article["views"] += 1
    
    return article


@router.get("/categories", summary="获取文章分类")
async def list_categories(
    db: AsyncSession = Depends(get_db_session),
    current_user: Optional[User] = Depends(get_current_user),
):
    """获取所有文章分类"""
    categories = list(set(a.get("category", "") for a in SAMPLE_ARTICLES if a.get("category")))
    return {"categories": categories}


@router.get("/hot", summary="获取热门文章")
async def hot_articles(
    limit: int = Query(5, ge=1, le=20),
    db: AsyncSession = Depends(get_db_session),
    current_user: Optional[User] = Depends(get_current_user),
):
    """获取热门文章（按浏览量排序）"""
    sorted_articles = sorted(SAMPLE_ARTICLES, key=lambda x: x.get("views", 0), reverse=True)
    return {"items": sorted_articles[:limit], "total": len(sorted_articles)}
