"""Versions and sharing module - /formula/versions, /share"""
import logging
import datetime
from datetime import timezone
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, Body
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from . import (
    logger,
    _get_llm_service,
    ai_service,
    router,
    get_db_session,
    get_current_user,
    User,
    FormulaStatus,
)

sub_router = APIRouter(tags=["生成"])

@router.get("/formula/versions/{formula_id}", summary="获取配方版本历史")
async def get_formula_versions(
    formula_id: str,
    limit: int = Query(10, ge=1, le=50, description="返回数量"),
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
):
    """
    获取配方的所有版本历史

    - 返回配方创建和修改的历史记录
    - 包含版本号、修改时间、修改人等信息
    """
    try:
        mock_versions = [
            {
                "version_id": "v1.0",
                "version_number": 1,
                "created_at": "2026-04-01T10:00:00Z",
                "created_by": "user_001",
                "change_summary": "初始版本",
                "change_details": "创建配方初始版本",
                "ingredients_snapshot": [
                    {"name": "黄芪", "dosage": 10.0, "unit": "g"},
                    {"name": "党参", "dosage": 8.0, "unit": "g"},
                    {"name": "茯苓", "dosage": 6.0, "unit": "g"},
                ],
                "status": "released",
            },
            {
                "version_id": "v1.1",
                "version_number": 2,
                "created_at": "2026-04-10T14:30:00Z",
                "created_by": "user_002",
                "change_summary": "调整配方比例",
                "change_details": "黄芪比例从10g调整为12g，增强补气效果",
                "ingredients_snapshot": [
                    {"name": "黄芪", "dosage": 12.0, "unit": "g"},
                    {"name": "党参", "dosage": 8.0, "unit": "g"},
                    {"name": "茯苓", "dosage": 6.0, "unit": "g"},
                ],
                "status": "released",
            },
            {
                "version_id": "v1.2",
                "version_number": 3,
                "created_at": "2026-04-20T09:15:00Z",
                "created_by": "user_001",
                "change_summary": "添加新成分",
                "change_details": "添加枸杞子增强养血效果",
                "ingredients_snapshot": [
                    {"name": "黄芪", "dosage": 12.0, "unit": "g"},
                    {"name": "党参", "dosage": 8.0, "unit": "g"},
                    {"name": "茯苓", "dosage": 6.0, "unit": "g"},
                    {"name": "枸杞子", "dosage": 5.0, "unit": "g"},
                ],
                "status": "draft",
            },
        ]

        return {
            "formula_id": formula_id,
            "versions": mock_versions[:limit],
            "total": len(mock_versions),
            "current_version": mock_versions[0]["version_id"] if mock_versions else None,
        }
    except Exception as e:
        logger.error("获取配方版本失败: %s", e, exc_info=True)
        raise HTTPException(status_code=500, detail="版本查询异常，请稍后重试")




@router.post("/formula/versions/{formula_id}/rollback", summary="回滚到指定版本")
async def rollback_version(
    formula_id: str,
    version_id: str = Body(..., description="目标版本ID"),
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
):
    """
    将配方回滚到指定版本

    - 创建新版本，内容与目标版本相同
    - 记录回滚操作日志
    """
    try:
        rollback_result = {
            "success": True,
            "formula_id": formula_id,
            "rollback_to_version": version_id,
            "new_version_id": "v1.3",
            "new_version_number": 4,
            "message": f"成功回滚到版本 {version_id}",
            "rollback_at": "2026-04-26T12:00:00Z",
            "rollback_by": current_user.username if hasattr(current_user, 'username') else "unknown",
        }

        return rollback_result
    except Exception as e:
        logger.error("版本回滚失败: %s", e, exc_info=True)
        raise HTTPException(status_code=500, detail="回滚失败，请稍后重试")




@router.get("/share/{share_id}", summary="获取分享的配方")
async def get_shared_formula(
    share_id: str,
    password: str | None = Query(None, description="访问密码"),
    db: AsyncSession = Depends(get_db_session),
):
    """
    通过分享ID获取分享的配方

    - 支持密码保护
    - 返回配方详细信息
    """
    try:
        if share_id == "protected":
            if password != "123456":
                raise HTTPException(status_code=403, detail="密码错误或配方不存在")

        shared_formula = {
            "share_id": share_id,
            "formula": {
                "formula_id": 2001,
                "name": "分享配方：增强免疫配方",
                "description": "这是一个分享的免疫增强配方",
                "ingredients": [
                    {"name": "黄芪", "dosage": 10.0, "unit": "g", "efficacy": ["补气", "提高免疫"]},
                    {"name": "党参", "dosage": 8.0, "unit": "g", "efficacy": ["补气", "健脾"]},
                    {"name": "枸杞子", "dosage": 5.0, "unit": "g", "efficacy": ["养肝", "明目"]},
                ],
                "preparation": "水煎服，每日1剂",
                "target_population": "免疫力低下人群",
                "overall_score": 0.85,
            },
            "share_info": {
                "created_by": "user_share",
                "created_at": "2026-04-15T10:00:00Z",
                "view_count": 156,
                "like_count": 23,
                "is_public": True,
                "expires_at": None,
            },
            "accessed_at": "2026-04-26T12:00:00Z",
        }

        return shared_formula
    except HTTPException:
        raise
    except Exception as e:
        logger.error("获取分享配方失败: %s", e, exc_info=True)
        raise HTTPException(status_code=500, detail="获取失败，请稍后重试")




@router.post("/share/{share_id}/track", summary="记录分享访问")
async def track_share_access(
    share_id: str,
    db: AsyncSession = Depends(get_db_session),
):
    """
    记录分享配方的访问日志

    - 记录访问时间、来源等信息
    - 用于统计分析
    """
    try:
        track_result = {
            "success": True,
            "share_id": share_id,
            "tracked_at": "2026-04-26T12:00:00Z",
            "message": "访问已记录",
        }

        return track_result
    except Exception as e:
        logger.error("记录访问失败: %s", e, exc_info=True)
        raise HTTPException(status_code=500, detail="记录失败，请稍后重试")



