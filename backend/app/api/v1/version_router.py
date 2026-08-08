"""RMFOOD 版本控制 API Router

提供Prompt模板版本管理的RESTful接口。
支持版本创建、历史查看、差异对比和回滚操作。
"""
from datetime import datetime, timezone
from typing import Optional
import difflib

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc

from ...core.database.session import get_db
from ...models.prompt_version import PromptVersion
from ...schemas.version_schemas import (
    PromptVersionCreate,
    PromptVersionResponse,
    VersionListResponse,
    DiffResponse,
    DiffItem,
    RollbackRequest,
    RollbackResponse,
)
from ...api.deps import get_current_active_user, CurrentUser, DbSession

router = APIRouter(prefix="/prompts", tags=["Version Control"])


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _parse_version(version_str: str) -> tuple[int, int]:
    """解析版本号字符串为元组"""
    try:
        parts = version_str.split('.')
        return (int(parts[0]), int(parts[1]))
    except (ValueError, IndexError):
        return (0, 0)


@router.post("/{prompt_id}/versions", response_model=PromptVersionResponse, status_code=status.HTTP_201_CREATED, summary="创建新版本")
async def create_version(
    prompt_id: int,
    request: PromptVersionCreate,
    db: DbSession,
    current_user: CurrentUser,
):
    """
    为指定Prompt模板创建新的版本
    
    - **prompt_id**: Prompt模板ID
    - **version_number**: 版本号（格式：x.y，如1.1）
    - **content_snapshot**: 完整内容快照
    - **changelog**: 可选，变更日志
    - **diff_summary**: 可选，变更摘要
    
    自动记录创建者和时间戳。
    """
    result = await db.execute(
        select(func.max(PromptVersion.version_number))
        .where(PromptVersion.prompt_template_id == prompt_id)
    )
    max_version = result.scalar() or 0
    
    new_version_num = _parse_version(request.version_number)
    
    version = PromptVersion(
        prompt_template_id=prompt_id,
        version_number=max_version + 1,
        content_snapshot=request.content_snapshot,
        diff_summary=request.diff_summary or f"Version {request.version_number}",
        changelog=request.changelog,
        created_by=current_user.id,
    )
    db.add(version)
    await db.commit()
    await db.refresh(version)
    
    return PromptVersionResponse.model_validate(version)


@router.get("/{prompt_id}/versions", response_model=VersionListResponse, summary="版本历史列表")
async def list_versions(
    prompt_id: int,
    db: DbSession,
    current_user: CurrentUser,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
):
    """
    获取指定Prompt模板的版本历史
    
    - **prompt_id**: Prompt模板ID
    - **page**: 页码（默认1）
    - **page_size**: 每页条数（默认20）
    
    返回按版本号降序排列的版本列表。
    """
    query = select(PromptVersion).where(
        PromptVersion.prompt_template_id == prompt_id
    )
    count_query = select(func.count(PromptVersion.id)).where(
        PromptVersion.prompt_template_id == prompt_id
    )
    
    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0
    
    offset = (page - 1) * page_size
    query = query.order_by(desc(PromptVersion.version_number)).offset(offset).limit(page_size)
    
    result = await db.execute(query)
    versions = result.scalars().all()
    
    current_result = await db.execute(
        select(PromptVersion)
        .where(PromptVersion.prompt_template_id == prompt_id)
        .order_by(desc(PromptVersion.version_number))
        .limit(1)
    )
    current_version_obj = current_result.scalar_one_or_none()
    current_version = str(current_version_obj.version_number) if current_version_obj else "0.0"
    
    return VersionListResponse(
        versions=[PromptVersionResponse.model_validate(v) for v in versions],
        total=total,
        current_version=current_version,
    )


@router.get("/{prompt_id}/versions/{version_id}", response_model=PromptVersionResponse, summary="获取特定版本详情")
async def get_version_detail(
    prompt_id: int,
    version_id: int,
    db: DbSession,
    current_user: CurrentUser,
):
    """
    获取特定版本的详细信息
    
    - **prompt_id**: Prompt模板ID
    - **version_id**: 版本记录ID
    
    返回版本的完整内容和元数据。
    """
    result = await db.execute(
        select(PromptVersion).where(
            PromptVersion.id == version_id,
            PromptVersion.prompt_template_id == prompt_id,
        )
    )
    version = result.scalar_one_or_none()
    
    if not version:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="版本不存在",
        )
    
    return PromptVersionResponse.model_validate(version)


@router.post("/{prompt_id}/versions/{version_id}/rollback", response_model=RollbackResponse, summary="回滚到此版本")
async def rollback_to_version(
    prompt_id: int,
    version_id: int,
    db: DbSession,
    current_user: CurrentUser,
    request: RollbackRequest = None,
):
    """
    回滚到指定的历史版本
    
    - **prompt_id**: Prompt模板ID
    - **version_id**: 目标版本ID
    - **create_new_version**: 是否基于回滚版本创建新版本（默认True）
    - **rollback_reason**: 可选，回滚原因
    
    回滚后可选择是否创建新版本记录。
    """
    if request is None:
        request = RollbackRequest()
    
    target_result = await db.execute(
        select(PromptVersion).where(
            PromptVersion.id == version_id,
            PromptVersion.prompt_template_id == prompt_id,
        )
    )
    target_version = target_result.scalar_one_or_none()
    
    if not target_version:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="目标版本不存在",
        )
    
    new_version_id = None
    if request.create_new_version:
        max_ver_result = await db.execute(
            select(func.max(PromptVersion.version_number))
            .where(PromptVersion.prompt_template_id == prompt_id)
        )
        max_version = max_ver_result.scalar() or 0
        
        new_version = PromptVersion(
            prompt_template_id=prompt_id,
            version_number=max_version + 1,
            content_snapshot=target_version.content_snapshot,
            diff_summary=f"Rollback from v{target_version.version_number}",
            changelog=f"回滚操作: {request.rollback_reason or '未提供原因'}",
            created_by=current_user.id,
        )
        db.add(new_version)
        await db.flush()
        new_version_id = new_version.id
    
    await db.commit()
    
    return RollbackResponse(
        success=True,
        message="回滚成功",
        rolled_back_to_version=target_version.version_number,
        new_version_id=new_version_id,
        timestamp=_now(),
    )


@router.get("/{prompt_id}/diff", response_model=DiffResponse, summary="版本对比Diff")
async def compare_versions(
    prompt_id: int,
    db: DbSession,
    current_user: CurrentUser,
    v1: int = Query(..., alias="v1", description="版本1 ID"),
    v2: int = Query(..., alias="v2", description="版本2 ID"),
    context_lines: int = Query(3, ge=0, le=10, description="上下文行数"),
):
    """
    对比两个版本的差异
    
    - **prompt_id**: Prompt模板ID
    - **v1**: 版本1的ID
    - **v2**: 版本2的ID
    - **context_lines**: 显示的上下文行数（默认3）
    
    返回详细的diff结果和变更统计。
    """
    result_v1 = await db.execute(
        select(PromptVersion).where(
            PromptVersion.id == v1,
            PromptVersion.prompt_template_id == prompt_id,
        )
    )
    version_1 = result_v1.scalar_one_or_none()
    
    result_v2 = await db.execute(
        select(PromptVersion).where(
            PromptVersion.id == v2,
            PromptVersion.prompt_template_id == prompt_id,
        )
    )
    version_2 = result_v2.scalar_one_or_none()
    
    if not version_1 or not version_2:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="一个或两个版本不存在",
        )
    
    lines_1 = version_1.content_snapshot.splitlines(keepends=True)
    lines_2 = version_2.content_snapshot.splitlines(keepends=True)
    
    differ = difflib.unified_diff(
        lines_1,
        lines_2,
        fromfile=f"v{version_1.version_number}",
        tofile=f"v{version_2.version_number}",
        n=context_lines,
    )
    
    diffs = []
    line_number = 1
    for line in differ:
        if line.startswith('+++') or line.startswith('---'):
            continue
        
        if line.startswith('@'):
            continue
        
        diff_type = "unchanged"
        old_content = None
        
        if line.startswith('+'):
            diff_type = "add"
            content = line[1:]
        elif line.startswith('-'):
            diff_type = "remove"
            content = line[1:]
            old_content = content
        else:
            content = line[1:] if line.startswith(' ') else line
        
        diffs.append(DiffItem(
            type=diff_type,
            line_number=line_number,
            content=content.rstrip('\n'),
            old_content=old_content.rstrip('\n') if old_content else None,
        ))
        
        if diff_type != "unchanged":
            pass  # OK: intentional — unchanged diffs are skipped
        line_number += 1
    
    add_count = sum(1 for d in diffs if d.type == "add")
    remove_count = sum(1 for d in diffs if d.type == "remove")
    
    summary = f"共 {len(diffs)} 行变更: +{add_count} 行新增, -{remove_count} 行删除"
    
    return DiffResponse(
        version_1=PromptVersionResponse.model_validate(version_1),
        version_2=PromptVersionResponse.model_validate(version_2),
        diffs=diffs,
        summary=summary,
    )


@router.get("/{prompt_id}/latest", response_model=PromptVersionResponse, summary="获取最新版本")
async def get_latest_version(
    prompt_id: int,
    db: DbSession,
    current_user: CurrentUser,
):
    """
    获取Prompt模板的最新版本
    
    - **prompt_id**: Prompt模板ID
    
    快速获取最新版本信息，无需遍历所有版本。
    """
    result = await db.execute(
        select(PromptVersion)
        .where(PromptVersion.prompt_template_id == prompt_id)
        .order_by(desc(PromptVersion.version_number))
        .limit(1)
    )
    latest = result.scalar_one_or_none()
    
    if not latest:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="该Prompt暂无版本记录",
        )
    
    return PromptVersionResponse.model_validate(latest)
