"""RMFOOD 团队协作扩展 API Router

提供团队仪表盘、统计和高级功能的RESTful接口。
"""
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from ...core.session import get_db
from ...api.deps import get_current_active_user, CurrentUser, DbSession
from ...services.team.team_service import TeamService
from ...services.team.team_dashboard import TeamDashboardService
from ...services.search.elasticsearch_service import ElasticsearchService, SearchFilters

router = APIRouter(prefix="/teams", tags=["Team Dashboard"])


@router.get("/{team_id}/dashboard", summary="团队仪表盘")
async def get_team_dashboard(
    team_id: int,
    db: DbSession,
    current_user: CurrentUser,
):
    """
    获取团队仪表盘数据
    
    包括：
    - 成员统计和角色分布
    - 提示词和版本数量
    - 版本提交趋势（近30天）
    - 活跃度排名Top 10成员
    - 最近动态
    
    - **team_id**: 团队ID
    """
    dashboard_service = TeamDashboardService(db)
    
    try:
        stats = await dashboard_service.get_stats(team_id)
        return stats
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"获取仪表盘数据失败: {str(e)}"
        )


@router.get("/{team_id}/activity", summary="团队动态流")
async def get_team_activity_feed(
    team_id: int,
    db: DbSession,
    current_user: CurrentUser,
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
):
    """
    获取团队动态时间线
    
    按时间倒序排列，包括：
    - 成员加入/离开
    - 版本提交
    - 通知记录
    
    - **team_id**: 团队ID
    - **limit**: 返回条数限制
    - **offset**: 偏移量
    """
    dashboard_service = TeamDashboardService(db)
    
    feed = await dashboard_service.get_activity_feed(team_id, limit=limit, offset=offset)
    return feed


@router.post("/search/advanced", summary="高级搜索")
async def advanced_search(
    db: DbSession,
    current_user: CurrentUser,
    query: str = Query(..., min_length=1, description="搜索关键词"),
    category: Optional[str] = Query(None, description="分类筛选"),
    author_id: Optional[int] = Query(None, description="作者ID筛选"),
    date_from: Optional[str] = Query(None, description="开始日期 (YYYY-MM-DD)"),
    date_to: Optional[str] = Query(None, description="结束日期 (YYYY-MM-DD)"),
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
):
    """
    高级搜索接口
    
    支持多维度筛选组合，返回高亮片段和聚合统计。
    
    - **query**: 搜索关键词
    - **category**: 可选，分类筛选
    - **author_id**: 可选，作者筛选
    - **date_from/date_to**: 可选，日期范围
    """
    from datetime import datetime as dt
    
    filters = SearchFilters(
        category=category,
        author_id=author_id,
        date_from=dt.fromisoformat(date_from) if date_from else None,
        date_to=dt.fromisoformat(date_to) if date_to else None,
    )
    
    es_service = ElasticsearchService(db)
    result = await es_service.search(query, filters, page=page, per_page=per_page)
    
    return result


@router.get("/search/suggestions", summary="搜索建议")
async def search_suggestions(
    db: DbSession,
    current_user: CurrentUser,
    prefix: str = Query(..., min_length=1, description="输入前缀"),
    team_id: Optional[int] = Query(None, description="团队ID限制"),
    limit: int = Query(5, ge=1, le=10),
):
    """
    搜索建议接口（自动补全）
    
    输入时实时返回匹配建议。
    前端应配合debounce 300ms使用。
    
    - **prefix**: 输入前缀
    - **team_id**: 可选，限制在指定团队内搜索
    - **limit**: 返回数量
    """
    es_service = ElasticsearchService(db)
    suggestions = await es_service.suggest(prefix, team_id=team_id, limit=limit)
    
    return {
        "suggestions": [
            {
                "text": s.text,
                "score": s.score,
                "payload": s.payload,
            }
            for s in suggestions
        ]
    }
